import path from "node:path";
import "dotenv/config";
import { crawlDocs } from "./crawl";
import { extractDoc } from "./extract";
import { chunkContent } from "./chunk";
import { embedTexts } from "./embed";
import { writeNdjson, vectorIds, publishIndex, targetFromEnv, type IndexedChunk } from "./upload";

const DOCS_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "docs");

async function main(): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set (see tools/docs-indexer/.env)",
    );
  }

  const files = crawlDocs(DOCS_ROOT);
  console.log(`Found ${files.length} doc files`);

  const docs = files.map(extractDoc);

  const pending: {
    doc: (typeof docs)[number];
    chunk: ReturnType<typeof chunkContent>[number];
    chunkIndex: number;
  }[] = [];
  for (const doc of docs) {
    const chunks = chunkContent(doc.content);
    chunks.forEach((chunk, chunkIndex) => {
      pending.push({ doc, chunk, chunkIndex });
    });
  }
  console.log(`Chunked into ${pending.length} chunks`);

  const texts = pending.map((entry) => entry.chunk.text);
  console.log("Generating embeddings via Workers AI...");
  const vectors = await embedTexts(texts, accountId, apiToken);

  if (vectors.length !== pending.length) {
    throw new Error(`Embedding count mismatch: expected ${pending.length}, got ${vectors.length}`);
  }

  const indexed: IndexedChunk[] = pending.map((entry, i) => ({
    doc: entry.doc,
    chunk: entry.chunk,
    chunkIndex: entry.chunkIndex,
    vector: vectors[i],
  }));

  const target = targetFromEnv();
  const ndjsonPath = writeNdjson(indexed, target);
  console.log(`Wrote ${indexed.length} vectors to ${ndjsonPath}`);

  await publishIndex(ndjsonPath, vectorIds(indexed, target), target);

  console.log("Done.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
