import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { type Env } from './index';

const env = {
  ALLOWED_ORIGIN: 'https://mux-lang.dev',
  ENVIRONMENT: 'production',
} as Env;

test('rejects a serialized body above the request limit', async () => {
  const request = new Request('https://example.test/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': '131073' },
    body: JSON.stringify({ messages: [] }),
  });

  const response = await worker.fetch(request, env);

  assert.equal(response.status, 400);
  assert.match(await response.text(), /Invalid JSON body|too large/);
});

test('rejects an oversized chunked body before buffering it', async () => {
  const oversized = new Uint8Array(128 * 1024 + 1);
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(oversized);
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request('https://example.test/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: stream,
    // Node’s Request type requires this for a streaming request body; the
    // Worker runtime ignores the fetch-client-only option.
    duplex: 'half',
  } as RequestInit);

  const response = await worker.fetch(request, env);

  assert.equal(response.status, 400);
  assert.match(await response.text(), /Invalid JSON body|too large/);
  assert.equal(cancelled, true);
});

test('rejects a message array above the bounded conversation limit', async () => {
  const messages = Array.from({ length: 33 }, () => ({ role: 'user', content: 'hello' }));
  const request = new Request('https://example.test/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  const response = await worker.fetch(request, env);

  assert.equal(response.status, 400);
  assert.match(await response.text(), /at most 32/);
});
