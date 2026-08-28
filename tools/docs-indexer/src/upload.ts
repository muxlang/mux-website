import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
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

const WORKER_DIR = path.resolve(import.meta.dirname, '..', '..', '..', 'workers', 'mux-ai');
const OUT_DIR = path.resolve(import.meta.dirname, '..', 'out');
// Vectorize caps deleteByIds per request; batch well under any limit.
const DELETE_BATCH_SIZE = 500;

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
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(target.manifestPath, 'utf8'));
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return null;
  }
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

// Absolute path to the wrangler binary installed in the worker package, so the
// command does not rely on PATH resolution (which could pick up an attacker-
// controlled `npx`/`wrangler` earlier on PATH).
const WRANGLER_BIN = path.join(WORKER_DIR, 'node_modules', '.bin', 'wrangler');

function wranglerEnv(): NodeJS.ProcessEnv {
  // CI supplies a protected token with both Workers AI and Vectorize rights.
  // Local runs may omit it and use an existing `wrangler login` session.
  return process.env;
}

export function upsertToVectorize(
  ndjsonPath: string,
  target: VectorizeTarget = targetFromEnv(),
): void {
  execFileSync(
    WRANGLER_BIN,
    ['vectorize', 'upsert', target.indexName, '--file', ndjsonPath],
    { cwd: WORKER_DIR, stdio: 'inherit', env: wranglerEnv() },
  );
}

export function deleteVectors(
  ids: string[],
  target: VectorizeTarget = targetFromEnv(),
): void {
  for (let i = 0; i < ids.length; i += DELETE_BATCH_SIZE) {
    const batch = ids.slice(i, i + DELETE_BATCH_SIZE);
    execFileSync(
      WRANGLER_BIN,
      ['vectorize', 'delete-vectors', target.indexName, '--ids', ...batch],
      { cwd: WORKER_DIR, stdio: 'inherit', env: wranglerEnv() },
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

export function publishIndex(
  ndjsonPath: string,
  newIds: string[],
  target: VectorizeTarget = targetFromEnv(),
): void {
  const staleIds = computeStaleIds(readManifest(target), newIds);

  console.log(`Upserting to Vectorize index "${target.indexName}"...`);
  upsertToVectorize(ndjsonPath, target);

  if (staleIds.length > 0) {
    console.log(`Deleting ${staleIds.length} stale vectors from the previous run...`);
    deleteVectors(staleIds, target);
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
