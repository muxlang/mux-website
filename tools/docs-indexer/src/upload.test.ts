import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  deleteVectors,
  promoteRecords,
  targetFromEnv,
  upsertToVectorize,
  waitForMutation,
  writeNdjson,
  type IndexedChunk,
  type VectorizeTarget,
} from './upload';

const VECTORIZE_DELETE_LIMIT = 100;

function makeTarget(root: string, overrides: Partial<VectorizeTarget>): VectorizeTarget {
  return {
    indexName: 'mux-docs',
    namespace: 'docs-candidate-123',
    idPrefix: 'candidate-123-',
    ndjsonPath: path.join(root, 'candidate.ndjson'),
    manifestPath: path.join(root, 'candidate-manifest.json'),
    ...overrides,
  };
}

test('promoteRecords strips candidate-only fields and preserves source data', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mux-docs-indexer-'));
  try {
    const sourceId = 'a'.repeat(64);
    const staged = makeTarget(root, {});
    const live = makeTarget(root, {
      namespace: undefined,
      idPrefix: '',
      ndjsonPath: path.join(root, 'live.ndjson'),
      manifestPath: path.join(root, 'live-manifest.json'),
    });
    fs.writeFileSync(
      staged.ndjsonPath,
      `${JSON.stringify({
        id: `${staged.idPrefix}${'b'.repeat(40)}`,
        namespace: staged.namespace,
        values: [0.25, -0.5],
        metadata: {
          docId: 'reference/diagnostics',
          title: 'Diagnostics',
          path: 'reference/diagnostics.md',
          section: 'Language Reference',
          codes: ['E0600'],
          heading: 'Runtime failures',
          text: 'Runtime failures use stable codes.',
          _muxSourceId: sourceId,
        },
      })}\n`,
      'utf8',
    );

    assert.deepEqual(promoteRecords(staged, live), [sourceId]);
    assert.deepEqual(JSON.parse(fs.readFileSync(live.ndjsonPath, 'utf8')), {
      id: sourceId,
      values: [0.25, -0.5],
      metadata: {
        docId: 'reference/diagnostics',
        title: 'Diagnostics',
        path: 'reference/diagnostics.md',
        section: 'Language Reference',
        codes: ['E0600'],
        heading: 'Runtime failures',
        text: 'Runtime failures use stable codes.',
      },
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('promoteRecords rejects a candidate record from another namespace', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mux-docs-indexer-'));
  try {
    const staged = makeTarget(root, {});
    const live = makeTarget(root, {
      namespace: undefined,
      idPrefix: '',
      ndjsonPath: path.join(root, 'live.ndjson'),
      manifestPath: path.join(root, 'live-manifest.json'),
    });
    fs.writeFileSync(
      staged.ndjsonPath,
      `${JSON.stringify({
        id: `${staged.idPrefix}${'b'.repeat(40)}`,
        namespace: 'other-candidate',
        values: [1],
        metadata: { _muxSourceId: 'a'.repeat(64) },
      })}\n`,
      'utf8',
    );

    assert.throws(() => promoteRecords(staged, live), /missing its source id/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('targetFromEnv resolves workflow paths from the npm invocation directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mux-docs-indexer-'));
  const originalInitCwd = process.env.INIT_CWD;
  const originalNdjsonPath = process.env.VECTORIZE_NDJSON_PATH;
  const originalManifestPath = process.env.VECTORIZE_MANIFEST_PATH;
  try {
    process.env.INIT_CWD = root;
    process.env.VECTORIZE_NDJSON_PATH = 'tools/docs-indexer/out/candidate-vectors.ndjson';
    process.env.VECTORIZE_MANIFEST_PATH = 'tools/docs-indexer/out/candidate-manifest.json';

    const target = targetFromEnv();

    assert.equal(
      target.ndjsonPath,
      path.join(root, 'tools/docs-indexer/out/candidate-vectors.ndjson'),
    );
    assert.equal(
      target.manifestPath,
      path.join(root, 'tools/docs-indexer/out/candidate-manifest.json'),
    );

    const entry: IndexedChunk = {
      doc: {
        docId: 'reference/diagnostics',
        docPath: '/docs/reference/diagnostics/',
        title: 'Diagnostics',
        section: 'Language Reference',
        codes: ['E0600'],
        content: 'Runtime failures use stable codes.',
      },
      chunk: {
        heading: 'Runtime failures',
        text: 'Runtime failures use stable codes.',
      },
      chunkIndex: 0,
      vector: [0.25, -0.5],
    };
    assert.equal(writeNdjson([entry], target), target.ndjsonPath);
    assert.ok(fs.statSync(target.ndjsonPath).size > 0);
  } finally {
    if (originalInitCwd === undefined) {
      delete process.env.INIT_CWD;
    } else {
      process.env.INIT_CWD = originalInitCwd;
    }
    if (originalNdjsonPath === undefined) {
      delete process.env.VECTORIZE_NDJSON_PATH;
    } else {
      process.env.VECTORIZE_NDJSON_PATH = originalNdjsonPath;
    }
    if (originalManifestPath === undefined) {
      delete process.env.VECTORIZE_MANIFEST_PATH;
    } else {
      process.env.VECTORIZE_MANIFEST_PATH = originalManifestPath;
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('deleteVectors dispatches sequential requests within the Vectorize ID limit', async () => {
  const target = makeTarget(os.tmpdir(), {});
  const cases = [0, 1, 100, 101, 303];

  for (const count of cases) {
    const ids = Array.from({ length: count }, (_, index) => `id-${index}`);
    const invocations: string[][] = [];

    await deleteVectors(ids, target, async (batch) => {
      invocations.push(batch);
    });

    const expected = Array.from(
      { length: Math.ceil(count / VECTORIZE_DELETE_LIMIT) },
      (_, batchIndex) =>
        ids.slice(
          batchIndex * VECTORIZE_DELETE_LIMIT,
          (batchIndex + 1) * VECTORIZE_DELETE_LIMIT,
        ),
    );
    assert.deepEqual(invocations, expected, `${count} ids`);
  }
});

test('deleteVectors stops after the first failed batch', async () => {
  const target = makeTarget(os.tmpdir(), {});
  const ids = Array.from({ length: 303 }, (_, index) => `id-${index}`);
  const invocations: string[][] = [];
  const failure = new Error('Vectorize delete failed');

  await assert.rejects(
    deleteVectors(ids, target, async (batch) => {
      invocations.push(batch);
      if (invocations.length === 2) {
        throw failure;
      }
    }),
    (error) => error === failure,
  );

  assert.equal(invocations.length, 2);
  assert.deepEqual(
    invocations[0],
    ids.slice(0, VECTORIZE_DELETE_LIMIT),
  );
  assert.deepEqual(
    invocations[1],
    ids.slice(VECTORIZE_DELETE_LIMIT, 2 * VECTORIZE_DELETE_LIMIT),
  );
});

test('deleteVectors sends the Cloudflare delete-by-IDs request envelope', async () => {
  const target = makeTarget(os.tmpdir(), {});
  const originalAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const originalApiToken = process.env.CLOUDFLARE_API_TOKEN;
  const originalFetch = globalThis.fetch;
  const requests: { url: string; init?: RequestInit }[] = [];

  try {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'account-id';
    process.env.CLOUDFLARE_API_TOKEN = 'api-token';
    globalThis.fetch = async (input, init) => {
      requests.push({ url: String(input), init });
      const result =
        requests.length === 1
          ? { mutationId: 'delete-mutation' }
          : { processedUpToMutation: 'delete-mutation' };
      return new Response(JSON.stringify({ success: true, result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    await deleteVectors(['id-1', 'id-2'], target);

    assert.equal(requests.length, 2);
    assert.equal(
      requests[0].url,
      'https://api.cloudflare.com/client/v4/accounts/account-id/vectorize/v2/indexes/mux-docs/delete_by_ids',
    );
    assert.equal(requests[0].init?.method, 'POST');
    assert.equal(new Headers(requests[0].init?.headers).get('Content-Type'), 'application/json');
    assert.equal(requests[0].init?.body, JSON.stringify({ ids: ['id-1', 'id-2'] }));
    assert.match(requests[1].url, /\/indexes\/mux-docs\/info$/);
  } finally {
    if (originalAccountId === undefined) {
      delete process.env.CLOUDFLARE_ACCOUNT_ID;
    } else {
      process.env.CLOUDFLARE_ACCOUNT_ID = originalAccountId;
    }
    if (originalApiToken === undefined) {
      delete process.env.CLOUDFLARE_API_TOKEN;
    } else {
      process.env.CLOUDFLARE_API_TOKEN = originalApiToken;
    }
    globalThis.fetch = originalFetch;
  }
});

test('waitForMutation does not return until Vectorize processes the target mutation', async () => {
  const observedMutations = ['previous-mutation', 'target-mutation'];
  const pauses: number[] = [];

  await waitForMutation(
    'target-mutation',
    async () => ({ processedUpToMutation: observedMutations.shift() ?? '' }),
    async (milliseconds) => {
      pauses.push(milliseconds);
    },
    { maxAttempts: 3, pollIntervalMs: 25 },
  );

  assert.deepEqual(pauses, [25]);
});

test('waitForMutation fails when Vectorize never processes the target mutation', async () => {
  await assert.rejects(
    waitForMutation(
      'target-mutation',
      async () => ({ processedUpToMutation: 'previous-mutation' }),
      async () => {},
      { maxAttempts: 2, pollIntervalMs: 1 },
    ),
    /target-mutation.*2 attempts/,
  );
});

test('upsertToVectorize returns the mutation id from the Vectorize API', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mux-docs-indexer-'));
  const target = makeTarget(root, {});
  const originalAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const originalApiToken = process.env.CLOUDFLARE_API_TOKEN;
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  let requestedInit: RequestInit | undefined;

  try {
    fs.writeFileSync(target.ndjsonPath, '{"id":"candidate"}\n', 'utf8');
    process.env.CLOUDFLARE_ACCOUNT_ID = 'account-id';
    process.env.CLOUDFLARE_API_TOKEN = 'api-token';
    globalThis.fetch = async (input, init) => {
      requestedUrl = String(input);
      requestedInit = init;
      return new Response(
        JSON.stringify({ success: true, result: { mutationId: 'target-mutation' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    assert.equal(await upsertToVectorize(target.ndjsonPath, target), 'target-mutation');
    assert.equal(
      requestedUrl,
      'https://api.cloudflare.com/client/v4/accounts/account-id/vectorize/v2/indexes/mux-docs/upsert',
    );
    assert.equal(requestedInit?.method, 'POST');
    assert.equal(new Headers(requestedInit?.headers).get('Authorization'), 'Bearer api-token');
    assert.ok(requestedInit?.body instanceof FormData);
  } finally {
    if (originalAccountId === undefined) {
      delete process.env.CLOUDFLARE_ACCOUNT_ID;
    } else {
      process.env.CLOUDFLARE_ACCOUNT_ID = originalAccountId;
    }
    if (originalApiToken === undefined) {
      delete process.env.CLOUDFLARE_API_TOKEN;
    } else {
      process.env.CLOUDFLARE_API_TOKEN = originalApiToken;
    }
    globalThis.fetch = originalFetch;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('upsertToVectorize reports non-JSON API failures with their status', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mux-docs-indexer-'));
  const target = makeTarget(root, {});
  const originalAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const originalApiToken = process.env.CLOUDFLARE_API_TOKEN;
  const originalFetch = globalThis.fetch;

  try {
    fs.writeFileSync(target.ndjsonPath, '{"id":"candidate"}\n', 'utf8');
    process.env.CLOUDFLARE_ACCOUNT_ID = 'account-id';
    process.env.CLOUDFLARE_API_TOKEN = 'api-token';
    globalThis.fetch = async () => new Response('upstream unavailable', { status: 502 });

    await assert.rejects(
      upsertToVectorize(target.ndjsonPath, target),
      /HTTP 502.*non-JSON response/,
    );
  } finally {
    if (originalAccountId === undefined) {
      delete process.env.CLOUDFLARE_ACCOUNT_ID;
    } else {
      process.env.CLOUDFLARE_ACCOUNT_ID = originalAccountId;
    }
    if (originalApiToken === undefined) {
      delete process.env.CLOUDFLARE_API_TOKEN;
    } else {
      process.env.CLOUDFLARE_API_TOKEN = originalApiToken;
    }
    globalThis.fetch = originalFetch;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
