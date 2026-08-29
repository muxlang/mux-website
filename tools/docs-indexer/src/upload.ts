import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ExtractedDoc } from './extract';
import type { Chunk } from './chunk';

export interface IndexedChunk {
  doc: ExtractedDoc;
  chunk: Chunk;
  chunkIndex: number;
  vector: number[];
}

export interface VectorizeRecord {
  id: string;
  values: number[];
  namespace?: string;
  metadata: {
    docId: string;
    title: string;
    path: string;
    section: string;
    codes: string[];
    heading: string | null;
    text: string;
    _muxSourceId?: string;
    _muxPublicationId?: string;
  };
}

export interface VectorizeTarget {
  indexName: string;
  namespace?: string;
  idPrefix: string;
  ndjsonPath: string;
  manifestPath: string;
}

function vectorId(docId: string, chunkIndex: number): string {
  // SHA-256 (not SHA-1) purely as a stable, collision-resistant id for the
  // chunk; not a security context, but avoids flagging a weak hash algorithm.
  return createHash('sha256').update(`${docId}:${chunkIndex}`).digest('hex');
}

function baseVectorId(docId: string, chunkIndex: number): string {
  return vectorId(docId, chunkIndex);
}

function targetVectorId(entry: IndexedChunk, target: VectorizeTarget): string {
  const baseId = baseVectorId(entry.doc.docId, entry.chunkIndex);
  if (!target.idPrefix) {
    return baseId;
  }

  const availableHashLength = 64 - target.idPrefix.length;
  if (availableHashLength < 32) {
    throw new Error('VECTORIZE_ID_PREFIX leaves too little room for a stable vector id');
  }
  return `${target.idPrefix}${baseId.slice(0, availableHashLength)}`;
}

function toRecord(entry: IndexedChunk, target: VectorizeTarget): VectorizeRecord {
  const sourceId = baseVectorId(entry.doc.docId, entry.chunkIndex);
  return {
    id: targetVectorId(entry, target),
    values: entry.vector,
    ...(target.namespace ? { namespace: target.namespace } : {}),
    metadata: {
      docId: entry.doc.docId,
      title: entry.doc.title,
      path: entry.doc.docPath,
      section: entry.doc.section,
      codes: entry.doc.codes,
      heading: entry.chunk.heading,
      text: entry.chunk.text,
      ...(target.idPrefix ? { _muxSourceId: sourceId } : {}),
    },
  };
}

const OUT_DIR = path.resolve(import.meta.dirname, '..', 'out');
// Vectorize rejects delete-by-ID requests containing more than 20 IDs.
const VECTORIZE_DELETE_BATCH_SIZE = 20;
const VECTORIZE_API_BASE_URL = 'https://api.cloudflare.com/client/v4';
const MUTATION_POLL_INTERVAL_MS = 2_000;
const MUTATION_WAIT_TIMEOUT_MS = 5 * 60_000;

interface CloudflareApiResponse<T> {
  success: boolean;
  errors?: { message: string }[];
  result?: T;
}

interface VectorizeMutation {
  mutationId?: string;
}

interface ReadinessWaitOptions {
  maxAttempts?: number;
  pollIntervalMs?: number;
}

interface DeleteBatchProgress {
  batchNumber: number;
  batchCount: number;
}

type ProgressReporter = (message: string) => void;
type DeleteBatch = (
  ids: string[],
  target: VectorizeTarget,
  progress: DeleteBatchProgress,
  report: ProgressReporter,
) => Promise<void>;

function defaultTarget(): VectorizeTarget {
  return {
    indexName: process.env.VECTORIZE_INDEX_NAME ?? 'mux-docs',
    namespace: process.env.VECTORIZE_NAMESPACE || undefined,
    idPrefix: process.env.VECTORIZE_ID_PREFIX ?? '',
    ndjsonPath: process.env.VECTORIZE_NDJSON_PATH ?? path.join(OUT_DIR, 'vectors.ndjson'),
    manifestPath: process.env.VECTORIZE_MANIFEST_PATH ?? path.join(OUT_DIR, 'manifest.json'),
  };
}

export function targetFromEnv(overrides: Partial<VectorizeTarget> = {}): VectorizeTarget {
  const target = { ...defaultTarget(), ...overrides };
  const invocationDirectory = process.env.INIT_CWD ?? process.cwd();
  return {
    ...target,
    ndjsonPath: path.resolve(invocationDirectory, target.ndjsonPath),
    manifestPath: path.resolve(invocationDirectory, target.manifestPath),
  };
}

function writeAtomically(filePath: string, contents: string): void {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, contents, 'utf8');
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) {
      fs.unlinkSync(temporaryPath);
    }
  }
}

function writeRecords(filePath: string, records: VectorizeRecord[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const lines = records.map((record) => JSON.stringify(record));
  writeAtomically(filePath, `${lines.join('\n')}\n`);
}

export function writeNdjson(
  entries: IndexedChunk[],
  target: VectorizeTarget = targetFromEnv(),
): string {
  writeRecords(target.ndjsonPath, entries.map((entry) => toRecord(entry, target)));
  return target.ndjsonPath;
}

export function vectorIds(
  entries: IndexedChunk[],
  target: VectorizeTarget = targetFromEnv(),
): string[] {
  return entries.map((entry) => targetVectorId(entry, target));
}

export function readManifest(target: VectorizeTarget = targetFromEnv()): string[] | null {
  let contents: string;
  try {
    contents = fs.readFileSync(target.manifestPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // A first publication from a clean checkout has no previous IDs. The
      // caller deliberately skips destructive cleanup in that case.
      return null;
    }
    const wrapped = new Error(`Unable to read Vectorize manifest: ${target.manifestPath}`);
    (wrapped as Error & { cause?: unknown }).cause = error;
    throw wrapped;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    const wrapped = new Error(`Vectorize manifest is not valid JSON: ${target.manifestPath}`);
    (wrapped as Error & { cause?: unknown }).cause = error;
    throw wrapped;
  }
  if (!Array.isArray(parsed) || !parsed.every((id): id is string => typeof id === 'string')) {
    throw new Error(`Vectorize manifest must be a JSON string array: ${target.manifestPath}`);
  }
  return parsed;
}

export function writeManifest(ids: string[], target: VectorizeTarget = targetFromEnv()): void {
  fs.mkdirSync(path.dirname(target.manifestPath), { recursive: true });
  writeAtomically(target.manifestPath, JSON.stringify(ids));
}

/** IDs present in the previous run but not the current one (orphans to delete). */
export function computeStaleIds(oldIds: string[] | null, newIds: string[]): string[] {
  if (!oldIds) {
    return [];
  }
  const current = new Set(newIds);
  return oldIds.filter((id) => !current.has(id));
}

function cloudflareCredentials(): { accountId: string; apiToken: string } {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set');
  }
  return { accountId, apiToken };
}

async function vectorizeRequest<T>(
  endpoint: string,
  init: RequestInit = {},
): Promise<T> {
  const { apiToken } = cloudflareCredentials();
  const response = await fetch(`${VECTORIZE_API_BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...init.headers,
    },
  });
  const responseText = await response.text();
  let body: CloudflareApiResponse<T>;
  try {
    body = JSON.parse(responseText) as CloudflareApiResponse<T>;
  } catch {
    throw new Error(
      `Vectorize request failed for ${endpoint}: HTTP ${response.status} returned a non-JSON response`,
    );
  }
  if (!response.ok || !body.success || body.result === undefined) {
    const message =
      body.errors?.map((error) => error.message).join('; ') || `HTTP ${response.status}`;
    throw new Error(`Vectorize request failed: ${message}`);
  }
  return body.result;
}

export async function waitForReadiness(
  description: string,
  isReady: () => Promise<boolean>,
  pause: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  options: ReadinessWaitOptions = {},
): Promise<void> {
  const pollIntervalMs = options.pollIntervalMs ?? MUTATION_POLL_INTERVAL_MS;
  const maxAttempts = options.maxAttempts ?? Math.ceil(MUTATION_WAIT_TIMEOUT_MS / pollIntervalMs);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (await isReady()) {
      return;
    }
    if (attempt < maxAttempts) {
      await pause(pollIntervalMs);
    }
  }

  throw new Error(`Vectorize ${description} was not queryable after ${maxAttempts} attempts`);
}

async function readVectorsByIds(
  ids: string[],
  target: VectorizeTarget,
): Promise<VectorizeRecord[]> {
  const { accountId } = cloudflareCredentials();
  return vectorizeRequest<VectorizeRecord[]>(
    `/accounts/${accountId}/vectorize/v2/indexes/${encodeURIComponent(target.indexName)}/get_by_ids`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    },
  );
}

function markPublication(ndjsonPath: string, publicationId: string): void {
  const records = readRecords(ndjsonPath).map((record) => ({
    ...record,
    metadata: { ...record.metadata, _muxPublicationId: publicationId },
  }));
  writeRecords(ndjsonPath, records);
}

export async function upsertToVectorize(
  ndjsonPath: string,
  target: VectorizeTarget = targetFromEnv(),
): Promise<string> {
  const { accountId } = cloudflareCredentials();
  const formData = new FormData();
  const contents = new Uint8Array(fs.readFileSync(ndjsonPath));
  formData.append(
    'vectors',
    new Blob([contents], { type: 'application/x-ndjson' }),
    path.basename(ndjsonPath),
  );
  const mutation = await vectorizeRequest<VectorizeMutation>(
    `/accounts/${accountId}/vectorize/v2/indexes/${encodeURIComponent(target.indexName)}/upsert`,
    { method: 'POST', body: formData },
  );
  if (!mutation.mutationId) {
    throw new Error('Vectorize upsert returned no mutation id');
  }
  return mutation.mutationId;
}

async function deleteVectorBatch(
  ids: string[],
  target: VectorizeTarget,
  progress: DeleteBatchProgress,
  report: ProgressReporter,
): Promise<void> {
  const { accountId } = cloudflareCredentials();
  const mutation = await vectorizeRequest<VectorizeMutation>(
    `/accounts/${accountId}/vectorize/v2/indexes/${encodeURIComponent(target.indexName)}/delete_by_ids`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    },
  );
  if (!mutation.mutationId) {
    throw new Error('Vectorize deletion returned no mutation id');
  }
  const startedAt = Date.now();
  const heartbeat = setInterval(() => {
    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    report(
      `Still waiting for cleanup batch ${progress.batchNumber}/${progress.batchCount} ` +
        `(${elapsedSeconds}s elapsed)...`,
    );
  }, 10_000);
  try {
    await waitForReadiness(
      `deletion mutation ${mutation.mutationId}`,
      async () => (await readVectorsByIds(ids, target)).length === 0,
    );
  } finally {
    clearInterval(heartbeat);
  }
}

export async function deleteVectors(
  ids: string[],
  target: VectorizeTarget = targetFromEnv(),
  deleteBatch: DeleteBatch = deleteVectorBatch,
  report: ProgressReporter = (message) => console.log(message),
): Promise<void> {
  const batchCount = Math.ceil(ids.length / VECTORIZE_DELETE_BATCH_SIZE);
  if (batchCount === 0) {
    return;
  }

  report(`Removing ${ids.length} vectors in ${batchCount} batches.`);
  for (let i = 0; i < ids.length; i += VECTORIZE_DELETE_BATCH_SIZE) {
    const batch = ids.slice(i, i + VECTORIZE_DELETE_BATCH_SIZE);
    const batchNumber = Math.floor(i / VECTORIZE_DELETE_BATCH_SIZE) + 1;
    const progress = { batchNumber, batchCount };
    const vectorLabel = batch.length === 1 ? 'vector' : 'vectors';
    report(`Deleting cleanup batch ${batchNumber}/${batchCount} (${batch.length} ${vectorLabel})...`);
    await deleteBatch(batch, target, progress, report);
    const completedIds = Math.min(i + batch.length, ids.length);
    report(
      `Completed cleanup batch ${batchNumber}/${batchCount} ` +
        `(${completedIds}/${ids.length} vectors removed).`,
    );
  }
}

export function readRecords(ndjsonPath: string): VectorizeRecord[] {
  const contents = fs.readFileSync(ndjsonPath, 'utf8');
  return contents
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line, lineNumber) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        throw new Error(`Invalid vector JSON on line ${lineNumber + 1}`);
      }
      if (!parsed || typeof parsed !== 'object') {
        throw new Error(`Invalid vector record on line ${lineNumber + 1}`);
      }
      const record = parsed as Partial<VectorizeRecord>;
      if (
        typeof record.id !== 'string' ||
        !Array.isArray(record.values) ||
        !record.values.every((value) => typeof value === 'number') ||
        !record.metadata ||
        typeof record.metadata !== 'object'
      ) {
        throw new Error(`Invalid vector record on line ${lineNumber + 1}`);
      }
      return record as VectorizeRecord;
    });
}

export async function publishIndex(
  ndjsonPath: string,
  newIds: string[],
  target: VectorizeTarget = targetFromEnv(),
  allowEmptyPublication = process.env.MUX_ALLOW_EMPTY_PUBLICATION === '1',
): Promise<void> {
  const staleIds = computeStaleIds(readManifest(target), newIds);
  // Empty publications are destructive: the stale set is the entire live
  // index. Require an explicit operator opt-in so a broken crawl or embedding
  // response cannot erase every document while still reporting success.
  if (newIds.length === 0) {
    if (!allowEmptyPublication) {
      throw new Error(
        'Refusing to publish an empty Vectorize index; set MUX_ALLOW_EMPTY_PUBLICATION=1 only when intentional',
      );
    }
    if (staleIds.length > 0) {
      console.log(`Deleting ${staleIds.length} stale vectors from an empty publication...`);
      await deleteVectors(staleIds, target);
    }
    writeManifest([], target);
    console.log('Published an empty Vectorize index.');
    return;
  }
  const publicationId = randomUUID();
  markPublication(ndjsonPath, publicationId);

  console.log(`Upserting to Vectorize index "${target.indexName}"...`);
  const mutationId = await upsertToVectorize(ndjsonPath, target);
  console.log('Waiting for Vectorize upsert to become queryable...');
  await waitForReadiness(
    `upsert mutation ${mutationId}`,
    async () => {
      const [record] = await readVectorsByIds([newIds[0]], target);
      return record?.metadata?._muxPublicationId === publicationId;
    },
  );
  console.log('Vectorize upsert is queryable.');

  if (staleIds.length > 0) {
    console.log(`Deleting ${staleIds.length} stale vectors from the previous run...`);
    await deleteVectors(staleIds, target);
  } else {
    console.log('No stale vectors to delete.');
  }

  // The manifest is the commit marker. A failed upsert or cleanup leaves the
  // previous manifest in place so the next run retries the outstanding work.
  writeManifest(newIds, target);
}

export function promoteRecords(
  stagedTarget: VectorizeTarget,
  liveTarget: VectorizeTarget,
): string[] {
  if (!stagedTarget.idPrefix) {
    throw new Error('Staged vectors must have VECTORIZE_ID_PREFIX set');
  }
  if (liveTarget.namespace || liveTarget.idPrefix) {
    throw new Error('Live vectors must use the default namespace and source ids');
  }

  const promoted = readRecords(stagedTarget.ndjsonPath).map((record, index) => {
    const sourceId = record.metadata?._muxSourceId;
    if (
      (stagedTarget.namespace && record.namespace !== stagedTarget.namespace) ||
      !sourceId ||
      !/^[a-f0-9]{64}$/.test(sourceId) ||
      !record.id.startsWith(stagedTarget.idPrefix)
    ) {
      throw new Error(`Staged vector ${index + 1} is missing its source id`);
    }
    return {
      id: sourceId,
      values: record.values,
      metadata: Object.fromEntries(
        Object.entries(record.metadata).filter(([key]) => key !== '_muxSourceId'),
      ) as VectorizeRecord['metadata'],
    };
  });

  const ids = promoted.map((record) => record.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Staged vectors contain duplicate source ids');
  }
  writeRecords(liveTarget.ndjsonPath, promoted);
  return ids;
}
