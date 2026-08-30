import { SYSTEM_PROMPT, NO_ANSWER_RESPONSE } from './prompts';
import { log } from './logger';

export interface Env {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  VECTORIZE_NAMESPACE?: string;
  // Production uses a per-client Durable Object so the cooldown survives
  // isolate eviction and is consistent across Cloudflare points of presence.
  // Development intentionally keeps this optional for local Wrangler runs.
  CHAT_RATE_LIMITER?: DurableObjectNamespace;
  ALLOWED_ORIGIN: string;
  // Deploy-time only (set in wrangler.toml, never request-derived). Gates the
  // dev-only /api/search endpoint; production deploys set this to "production".
  ENVIRONMENT: string;
  // The Worker is the only public compile entry point. The origin URL is a
  // deploy-time variable and the token is a secret shared with Fly.io.
  MUX_API_ORIGIN?: string;
  MUX_API_ORIGIN_TOKEN?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSource {
  title: string;
  path: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
}

export type ErrorCode = 'RATE_LIMIT' | 'MODEL_UNAVAILABLE';

export interface ChatResponse {
  message?: string;
  sources?: ChatSource[];
  error?: string;
  errorCode?: ErrorCode;
}

export interface SearchResult {
  title: string;
  path: string;
  section: string;
  heading: string | null;
  text: string;
  score: number;
  codes: string[];
}

export interface SearchResponse {
  results: SearchResult[];
}

// Must stay on the exact same model + version the docs-indexer uses at index
// time (tools/docs-indexer/src/embed.ts); query and passage vectors only share
// a space if both are produced by the same model.
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
// bge-base-en-v1.5 is an asymmetric retrieval model: queries are prefixed with
// this instruction, passages are embedded raw (see the indexer). Keeping them
// asymmetric separates query/passage vectors and improves ranking.
const QUERY_INSTRUCTION = 'Represent this sentence for searching relevant passages: ';
const GENERATION_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const VECTOR_QUERY_TOP_K = 20;
const TOP_K = 5;
// Number of recent user turns combined into the retrieval query so contextual
// follow-ups ("show me an example") inherit the topic of earlier turns. Only
// affects what is embedded for search; the generation prompt still answers the
// single latest message.
const RETRIEVAL_HISTORY_TURNS = 3;
// Maximum prior messages (excluding the current question) sent to the
// generation model. Bounds per-call token cost so a long conversation does not
// grow neuron consumption turn over turn; recent turns carry the conversational
// context, older ones add cost with little value since the retrieved excerpts
// dominate the prompt. Enforced server-side so a client cannot bypass it.
const GENERATION_HISTORY_LIMIT = 6;
// Maximum characters per message. Message count is already bounded by the
// retrieval/generation history slices, so size is the only remaining cost
// lever: a single oversized message would inflate the embedding/generation
// call. Generous for a question or a pasted compiler error; not a blob.
const MAX_CONTENT_CHARS = 2000;
// Bound the serialized request before parsing so an attacker cannot send a
// huge JSON array of tiny messages and make parsing itself the expensive work.
const MAX_REQUEST_BODY_BYTES = 128 * 1024;
// Compile source is validated after JSON decoding. Leave room for escaping
// overhead while matching the API's 512 KiB request cap.
const MAX_COMPILE_REQUEST_BODY_BYTES = 512 * 1024;
const MAX_MESSAGE_COUNT = 32;
// Minimum cosine similarity for a chunk to be considered relevant. There is a
// consistent gap between on-topic chunk scores and the highest off-topic leak;
// this floor sits in that gap. The exact value depends on the embedding model,
// the query instruction prefix (see QUERY_INSTRUCTION), and the chunking, so it
// must be re-checked whenever any of those change. The retrieval-test harness
// asserts both the positive margin and off-topic rejection, so a stale value
// fails `npm run eval` rather than silently shifting recall.
const MIN_SCORE = 0.61;
// Minimum milliseconds between requests from the same IP.
const RATE_LIMIT_MS = 2000;
// When the cooldown map grows past this, sweep out expired entries. Bounds
// memory for one-shot IPs that never return, without paying a sweep per request.
const RATE_LIMIT_MAP_CAP = 10000;
const MAX_COMPILE_CODE_BYTES = 100 * 1024;
const UPSTREAM_TIMEOUT_MS = 35_000;

// Per-isolate cooldown map. Resets on isolate eviction, which is acceptable —
// the goal is basic abuse prevention, not perfect rate limiting across all PoPs.
const lastRequestByIp = new Map<string, number>();

export class ChatRateLimiter implements DurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('method not allowed', { status: 405 });
    }

    const now = Date.now();
    const last = await this.state.storage.get<number>('lastRequestAt');
    if (last !== undefined && now - last < RATE_LIMIT_MS) {
      return new Response(null, { status: 429 });
    }

    await this.state.storage.put('lastRequestAt', now);
    return new Response(null, { status: 204 });
  }
}

function corsHeaders(env: Env): HeadersInit {
  if (!env.ALLOWED_ORIGIN) {
    throw new Error('ALLOWED_ORIGIN is not configured for this environment');
  }
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(body: unknown, env: Env, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

function sweepExpired(now: number): void {
  for (const [ip, ts] of lastRequestByIp) {
    if (now - ts >= RATE_LIMIT_MS) {
      lastRequestByIp.delete(ip);
    }
  }
}

function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'unknown';
}

// Read-only cooldown check; does not record the request. Recording is deferred
// to markRequest() so a request rejected by validation (bad JSON, oversized)
// never burns the caller's cooldown, and only requests that actually reach the
// AI calls consume a slot.
function isWithinCooldown(ip: string): boolean {
  const now = Date.now();
  if (lastRequestByIp.size > RATE_LIMIT_MAP_CAP) {
    sweepExpired(now);
  }
  const last = lastRequestByIp.get(ip) ?? 0;
  return now - last < RATE_LIMIT_MS;
}

function markRequest(ip: string): void {
  lastRequestByIp.set(ip, Date.now());
}

type RateLimitDecision =
  | { available: true; allowed: boolean }
  | { available: false; allowed: false };

async function consumeRateLimit(ip: string, env: Env): Promise<RateLimitDecision> {
  if (env.ENVIRONMENT !== 'production') {
    if (isWithinCooldown(ip)) {
      return { available: true, allowed: false };
    }
    markRequest(ip);
    return { available: true, allowed: true };
  }

  if (!env.CHAT_RATE_LIMITER) {
    log({ event: 'rate_limit_backend_unavailable' });
    return { available: false, allowed: false };
  }

  try {
    const id = env.CHAT_RATE_LIMITER.idFromName(ip);
    const response = await env.CHAT_RATE_LIMITER.get(id).fetch(
      'https://rate-limit/check',
      { method: 'POST' },
    );
    if (response.status === 429) {
      return { available: true, allowed: false };
    }
    if (!response.ok) {
      log({ event: 'rate_limit_backend_unavailable' });
      return { available: false, allowed: false };
    }
    return { available: true, allowed: true };
  } catch (err) {
    log({
      event: 'rate_limit_backend_unavailable',
      message: err instanceof Error ? err.message : String(err),
    });
    return { available: false, allowed: false };
  }
}

async function embedQuery(query: string, env: Env): Promise<number[]> {
  // The workers-types union includes an async variant; cast to the sync shape
  // since we never pass stream/async options to this model.
  const result = (await env.AI.run(EMBEDDING_MODEL, {
    text: [`${QUERY_INSTRUCTION}${query}`],
  })) as {
    data?: number[][];
  };
  if (!result.data?.[0]) {
    throw new Error('Embedding model returned no vector data');
  }
  return result.data[0];
}

async function retrieveChunks(
  query: string,
  env: Env,
  diagnosticCodeQuery = query,
): Promise<SearchResult[]> {
  const vector = await embedQuery(query, env);
  const queryResult = await env.VECTORIZE.query(vector, {
    topK: VECTOR_QUERY_TOP_K,
    returnMetadata: 'all',
    ...(env.VECTORIZE_NAMESPACE
      ? { namespace: env.VECTORIZE_NAMESPACE }
      : {}),
  });

  const diagnosticCodes = new Set(
    diagnosticCodeQuery.toUpperCase().match(/\b[EW]\d{4}\b/g) ?? [],
  );

  return queryResult.matches
    .filter((match) => match.score >= MIN_SCORE)
    .map((match) => {
      const meta = match.metadata as Record<string, unknown> | undefined;
      return {
        title: typeof meta?.title === 'string' ? meta.title : '',
        path: typeof meta?.path === 'string' ? meta.path : '',
        section: typeof meta?.section === 'string' ? meta.section : '',
        heading: typeof meta?.heading === 'string' ? meta.heading : null,
        text: typeof meta?.text === 'string' ? meta.text : '',
        score: match.score,
        codes: Array.isArray(meta?.codes)
          ? meta.codes.filter((code): code is string => typeof code === 'string')
          : [],
      };
    })
    .sort((left, right) => {
      const leftMatchesCode = left.codes.some((code) => diagnosticCodes.has(code));
      const rightMatchesCode = right.codes.some((code) => diagnosticCodes.has(code));
      if (leftMatchesCode !== rightMatchesCode) {
        return leftMatchesCode ? -1 : 1;
      }
      return right.score - left.score;
    })
    .slice(0, TOP_K);
}

function deduplicateSources(chunks: SearchResult[]): ChatSource[] {
  const seen = new Set<string>();
  const sources: ChatSource[] = [];
  for (const chunk of chunks) {
    if (!seen.has(chunk.path)) {
      seen.add(chunk.path);
      sources.push({ title: chunk.title, path: chunk.path });
    }
  }
  return sources;
}

function buildContextBlock(chunks: SearchResult[]): string {
  return chunks
    .map((chunk, i) => {
      const heading = chunk.heading ? ` > ${chunk.heading}` : '';
      const codes = chunk.codes.length ? ` [${chunk.codes.join(', ')}]` : '';
      return `[${i + 1}] ${chunk.title}${heading}${codes} (${chunk.path})\n${chunk.text}`;
    })
    .join('\n\n---\n\n');
}

function buildUserMessageWithContext(userContent: string, chunks: SearchResult[]): string {
  const context = buildContextBlock(chunks);
  return `Documentation excerpts:\n${context}\n\nQuestion: ${userContent}`;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

// True when the model declined to answer. Uses a normalized startsWith rather
// than strict equality: models sometimes append a sentence or tweak punctuation,
// and the refusal phrase is distinctive enough that a prefix match is safe.
function isRefusal(message: string): boolean {
  return normalize(message).startsWith(normalize(NO_ANSWER_RESPONSE));
}

function buildRetrievalQuery(messages: ChatMessage[]): string {
  const userTurns = messages.filter((m) => m.role === 'user').map((m) => m.content);
  // Newest first: if the combined text exceeds the embedding model's context
  // window and is truncated, the most recent (most important) turn survives and
  // older context is dropped instead.
  const recent = userTurns.slice(-RETRIEVAL_HISTORY_TURNS).reverse();
  return recent.join('\n\n');
}

function parseChatRequest(body: unknown): ChatRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.messages)) return null;
  for (const msg of b.messages) {
    if (
      typeof msg !== 'object' ||
      msg === null ||
      ((msg as Record<string, unknown>).role !== 'user' &&
        (msg as Record<string, unknown>).role !== 'assistant') ||
      typeof (msg as Record<string, unknown>).content !== 'string'
    ) {
      return null;
    }
  }
  return b as unknown as ChatRequest;
}

async function readJsonBody(
  request: Request,
  maxBytes = MAX_REQUEST_BODY_BYTES,
): Promise<unknown> {
  const bytes = await readBodyBytes(request, maxBytes);
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

async function readBodyBytes(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null && Number(declaredLength) > maxBytes) {
    throw new Error('request body too large');
  }

  // Content-Length is absent for chunked requests, so arrayBuffer() would
  // buffer an attacker-controlled body before the size check. Read through a
  // capped stream instead and cancel as soon as the budget is exceeded.
  const reader = request.body?.getReader();
  if (!reader) {
    return new Uint8Array();
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel('request body too large');
        throw new Error('request body too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function validateCompileBody(body: unknown): { code: string } | { error: string; status: number } {
  if (typeof body !== 'object' || body === null) {
    return { error: 'Request body must be a JSON object', status: 400 };
  }
  const code = (body as Record<string, unknown>).code;
  if (typeof code !== 'string') {
    return { error: "'code' must be a string", status: 400 };
  }
  if (new TextEncoder().encode(code).byteLength > MAX_COMPILE_CODE_BYTES) {
    return { error: 'Source code exceeds 100KB limit', status: 413 };
  }
  return { code };
}

async function handleCompile(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, env, 405);
  }
  if (!env.MUX_API_ORIGIN || (env.ENVIRONMENT === 'production' && !env.MUX_API_ORIGIN_TOKEN)) {
    log({ event: 'compile_origin_unavailable' });
    return jsonResponse(
      { error: 'The compile service is temporarily unavailable.', errorCode: 'MODEL_UNAVAILABLE' },
      env,
      503,
    );
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, MAX_COMPILE_REQUEST_BODY_BYTES);
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, env, 400);
  }
  const validated = validateCompileBody(body);
  if ('error' in validated) {
    return jsonResponse({ error: validated.error }, env, validated.status);
  }

  const rateLimit = await consumeRateLimit(`compile:${clientIp(request)}`, env);
  if (!rateLimit.available) {
    return jsonResponse(
      { error: 'The compile service is temporarily unavailable.', errorCode: 'MODEL_UNAVAILABLE' },
      env,
      503,
    );
  }
  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: 'Too many requests. Please wait and try again.', errorCode: 'RATE_LIMIT' },
      env,
      429,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const origin = new URL(env.MUX_API_ORIGIN);
    origin.pathname = `${origin.pathname.replace(/\/$/, '')}/api/compile`;
    origin.search = '';
    const upstreamHeaders = new Headers({ 'Content-Type': 'application/json' });
    if (env.MUX_API_ORIGIN_TOKEN) {
      upstreamHeaders.set('X-Mux-Origin-Token', env.MUX_API_ORIGIN_TOKEN);
    }
    const upstream = await fetch(origin, {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify({ code: validated.code }),
      signal: controller.signal,
    });
    const headers = new Headers({ ...corsHeaders(env), 'Cache-Control': 'no-store' });
    const contentType = upstream.headers.get('Content-Type');
    if (contentType) headers.set('Content-Type', contentType);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    log({
      event: 'compile_origin_error',
      message: err instanceof Error ? err.message : String(err),
    });
    return jsonResponse(
      { error: 'The compile service is temporarily unavailable.', errorCode: 'MODEL_UNAVAILABLE' },
      env,
      504,
    );
  } finally {
    clearTimeout(timeout);
  }
}

type ValidatedChat =
  | { ok: true; messages: ChatMessage[]; lastUserIndex: number }
  | { ok: false; error: string };

// Parse and validate a chat request body: shape, per-message size, and the
// presence of a user message. Extracted from handleChat to keep that handler's
// branching (and cognitive complexity) low.
function validateChatBody(body: unknown): ValidatedChat {
  const chatRequest = parseChatRequest(body);
  if (!chatRequest || chatRequest.messages.length === 0) {
    return { ok: false, error: 'messages must be a non-empty array of {role, content}' };
  }
  if (chatRequest.messages.length > MAX_MESSAGE_COUNT) {
    return { ok: false, error: `messages must contain at most ${MAX_MESSAGE_COUNT} items` };
  }
  if (chatRequest.messages.some((m) => m.content.length > MAX_CONTENT_CHARS)) {
    return { ok: false, error: `Each message must be at most ${MAX_CONTENT_CHARS} characters.` };
  }
  let lastUserIndex = -1;
  for (let i = chatRequest.messages.length - 1; i >= 0; i--) {
    if (chatRequest.messages[i].role === 'user') {
      lastUserIndex = i;
      break;
    }
  }
  if (lastUserIndex === -1) {
    return { ok: false, error: 'At least one user message is required' };
  }
  return { ok: true, messages: chatRequest.messages, lastUserIndex };
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  const start = Date.now();

  const ip = clientIp(request);

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' } satisfies ChatResponse, env, 400);
  }

  const validated = validateChatBody(body);
  if (!validated.ok) {
    return jsonResponse({ error: validated.error } satisfies ChatResponse, env, 400);
  }
  const { messages, lastUserIndex } = validated;
  const lastUserMessage = messages[lastUserIndex];

  // Request is valid and about to hit the AI calls; consume the cooldown slot now.
  const rateLimit = await consumeRateLimit(ip, env);
  if (!rateLimit.available) {
    return jsonResponse(
      {
        error: 'The rate-limit service is temporarily unavailable.',
        errorCode: 'MODEL_UNAVAILABLE',
      } satisfies ChatResponse,
      env,
      503,
    );
  }
  if (!rateLimit.allowed) {
    log({ event: 'rate_limit' });
    return jsonResponse(
      {
        error: 'Too many requests. Please wait a moment before sending another message.',
        errorCode: 'RATE_LIMIT',
      } satisfies ChatResponse,
      env,
      429,
    );
  }

  log({ event: 'chat_request', turn_count: messages.length });

  const retrievalQuery = buildRetrievalQuery(messages);

  let chunks: SearchResult[];
  try {
    chunks = await retrieveChunks(retrievalQuery, env, lastUserMessage.content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ event: 'retrieval_error', message });
    return jsonResponse(
      {
        error: 'The AI assistant is temporarily unavailable. Please try again shortly.',
        errorCode: 'MODEL_UNAVAILABLE',
      } satisfies ChatResponse,
      env,
      503,
    );
  }

  if (chunks.length === 0) {
    log({ event: 'no_results', query_length: retrievalQuery.length });
    return jsonResponse(
      { message: NO_ANSWER_RESPONSE, sources: [] } satisfies ChatResponse,
      env,
    );
  }

  log({
    event: 'retrieval_result',
    chunk_count: chunks.length,
    top_score: chunks[0].score,
    query_length: retrievalQuery.length,
  });

  // Build the messages array for the generation model. Everything before the
  // last user message is prior context (capped for bounded cost); that last user
  // message is the one we inject the retrieved excerpts into below.
  const priorMessages = messages.slice(0, lastUserIndex).slice(-GENERATION_HISTORY_LIMIT);
  const augmentedUserContent = buildUserMessageWithContext(lastUserMessage.content, chunks);

  const llmMessages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...priorMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: augmentedUserContent },
  ];

  let generation: { response?: string };
  try {
    generation = (await env.AI.run(GENERATION_MODEL, {
      messages: llmMessages,
      max_tokens: 1024,
    })) as { response?: string };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ event: 'generation_error', message });
    return jsonResponse(
      {
        error: 'The AI assistant is temporarily unavailable. Please try again shortly.',
        errorCode: 'MODEL_UNAVAILABLE',
      } satisfies ChatResponse,
      env,
      503,
    );
  }

  const message = generation.response?.trim() ?? '';
  // Don't cite sources for a refusal: the retrieved chunks cleared the score
  // floor but the model judged they don't actually answer the question, so
  // showing them under an "I couldn't find that" message would be contradictory.
  const sources = isRefusal(message) ? [] : deduplicateSources(chunks);
  log({
    event: 'chat_response',
    latency_ms: Date.now() - start,
    chunk_count: chunks.length,
    source_count: sources.length,
  });

  return jsonResponse({ message, sources } satisfies ChatResponse, env);
}

async function handleSearch(request: Request, env: Env): Promise<Response> {
  const start = Date.now();

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, env, 400);
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).query !== 'string'
  ) {
    return jsonResponse({ error: 'Missing required field: query' }, env, 400);
  }

  const query = ((body as Record<string, unknown>).query as string).trim();
  if (!query) {
    return jsonResponse({ error: 'query must not be empty' }, env, 400);
  }

  log({ event: 'search_request', query_length: query.length });

  const results = await retrieveChunks(query, env);

  log({ event: 'search_response', latency_ms: Date.now() - start, chunk_count: results.length });

  return jsonResponse({ results } satisfies SearchResponse, env);
}

function handleHealth(env: Env): Response {
  return jsonResponse({ status: 'ok' }, env);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    const url = new URL(request.url);

    if (url.pathname === '/health' && request.method === 'GET') {
      return handleHealth(env);
    }

    if (url.pathname === '/api/chat/health' && request.method === 'GET') {
      return handleHealth(env);
    }

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      return handleChat(request, env);
    }

    if (url.pathname === '/api/compile') {
      return handleCompile(request, env);
    }

    // Dev-only retrieval endpoint for the eval harness. ENVIRONMENT is a
    // deploy-time var, so in production this falls through to 404 and there is
    // no request-controllable way to reach handleSearch.
    if (
      url.pathname === '/api/search' &&
      request.method === 'POST' &&
      env.ENVIRONMENT === 'development'
    ) {
      return handleSearch(request, env);
    }

    return jsonResponse({ error: 'NOT_FOUND' }, env, 404);
  },
};
