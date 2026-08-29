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
