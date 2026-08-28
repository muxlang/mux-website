import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  promoteRecords,
  type VectorizeTarget,
} from './upload';

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
