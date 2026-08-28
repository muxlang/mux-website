import { deleteVectors, readRecords, targetFromEnv } from './upload';

function main(): void {
  const target = targetFromEnv();
  const ids = readRecords(target.ndjsonPath).map((record) => record.id);
  if (ids.length === 0) {
    console.log('No staged vectors to remove.');
    return;
  }
  deleteVectors(ids, target);
  console.log(`Removed ${ids.length} staged vectors.`);
}

try {
  main();
} catch (err: unknown) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
