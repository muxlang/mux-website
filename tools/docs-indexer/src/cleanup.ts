import { deleteVectors, readRecords, targetFromEnv } from './upload';

async function main(): Promise<void> {
  const target = targetFromEnv();
  const ids = readRecords(target.ndjsonPath).map((record) => record.id);
  if (ids.length === 0) {
    console.log('No staged vectors to remove.');
    return;
  }
  await deleteVectors(ids, target);
  console.log(`Removed ${ids.length} staged vectors.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
