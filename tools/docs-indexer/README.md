# docs-indexer

Indexes `mux-website/docs/` into the `mux-docs` Vectorize index used by the
Mux AI assistant. Reads MDX source files directly (no build/crawl of the
deployed site needed) and excludes `design-notes/` - internal design
rationale, not language documentation.

The `docs-index.yml` workflow runs this tool after a docs change lands on
`main`. It fails the workflow if embedding, Vectorize upsert, stale-vector
cleanup, or either retrieval evaluation fails. The Worker is not redeployed
for docs-only changes.

## Setup

For a local recovery run, create `tools/docs-indexer/.env` (gitignored) with:

```
CLOUDFLARE_ACCOUNT_ID=<your account id>
CLOUDFLARE_API_TOKEN=<your token>
```

The token needs Workers AI read access plus Vectorize write and delete access.
The indexer passes the protected token to both the embedding request and
Wrangler, so it can update the index and remove stale vectors in one run.

```bash
npm install
```

## Re-indexing

```bash
npm run index
```

This will:
1. Walk `mux-website/docs/**/*.{md,mdx}` (skipping `design-notes/`).
2. Strip frontmatter, derive each doc's title and sidebar section.
3. Chunk each doc into sections that fit the embedding model's context window
   (~175-450 tokens), preferring heading boundaries.
4. Embed every chunk with Workers AI (`@cf/baai/bge-base-en-v1.5`).
5. Write the vectors + metadata to `out/vectors.ndjson`.
6. Run `wrangler vectorize upsert mux-docs --file out/vectors.ndjson` from
   `workers/mux-ai`.
7. Delete any orphaned vectors from the previous run, then record the new
   vector-id set in `out/manifest.json`.

Each chunk's vector ID is a deterministic hash of its doc id and position, so
re-running overwrites a doc's existing chunks rather than duplicating them. When
a doc shrinks to fewer chunks or is removed, the leftover IDs no longer appear
in the new run; step 7 diffs the new id set against `out/manifest.json` and
deletes the difference, so the index self-heals without manual cleanup.

`out/manifest.json` is gitignored, so this cleanup is scoped to the machine that
does the indexing. A fresh checkout with no manifest skips deletion on its first
run (never destructive by surprise); to force a full purge, delete and recreate
the `mux-docs` index, then re-index.

The indexing token must have Workers AI read access and Vectorize write/delete
access. The workflow reads these values from the protected `docs-indexing`
environment. A local run may instead use an existing `wrangler login` session.

## Manual recovery

If the workflow fails, fix the reported credential, embedding, or evaluation
problem and rerun the failed job. Operators can recover locally with:

```bash
cd mux-website
npm --prefix workers/mux-ai ci --ignore-scripts
npm --prefix tools/docs-indexer ci --ignore-scripts
npm --prefix tools/docs-indexer run index
```

Run the retrieval checks against a remote development Worker before declaring
the recovery complete. The old manifest is retained whenever upsert or stale
deletion fails, so a retry can finish cleanup.
