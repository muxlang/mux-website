import path from 'node:path';
import {
  promoteRecords,
  publishIndex,
  targetFromEnv,
} from './upload';

const OUT_DIR = path.resolve(import.meta.dirname, '..', 'out');

async function main(): Promise<void> {
  const stagedTarget = targetFromEnv();
  const liveTarget = targetFromEnv({
    namespace: undefined,
    idPrefix: '',
    ndjsonPath:
      process.env.VECTORIZE_LIVE_NDJSON_PATH ?? path.join(OUT_DIR, 'vectors.ndjson'),
    manifestPath:
      process.env.VECTORIZE_LIVE_MANIFEST_PATH ?? path.join(OUT_DIR, 'manifest.json'),
  });
  const newIds = promoteRecords(stagedTarget, liveTarget);
  await publishIndex(liveTarget.ndjsonPath, newIds, liveTarget);
  console.log(`Published ${newIds.length} validated vectors.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
