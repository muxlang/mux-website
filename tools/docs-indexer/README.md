# docs-indexer

Indexes `mux-website/docs/` into the `mux-docs` Vectorize index used by the
Mux AI assistant. Reads MDX source files directly (no build/crawl of the
deployed site needed) and excludes `design-notes/` - internal design
rationale, not language documentation.

The `docs-index.yml` workflow runs this tool after a docs change lands on
`main`. It stages vectors in a run-specific Vectorize namespace, evaluates the
Worker against that namespace, and promotes the exact validated records only
after both evaluations pass. It fails the workflow if embedding, staging,
promotion, cleanup, or either retrieval evaluation fails. The Worker is not
redeployed for docs-only changes.

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
6. Upsert the vectors through the Vectorize API and wait until its mutation is
   queryable.
7. Delete any orphaned vectors from the previous run, then record the new
   vector-id set in `out/manifest.json`.

For a safe validation before publication, use a run-specific namespace and ID
prefix, then run the evaluations against a Worker started with the same
namespace:

```bash
export VECTORIZE_NAMESPACE="docs-candidate-$RANDOM"
export VECTORIZE_ID_PREFIX="candidate-$RANDOM-"
export VECTORIZE_NDJSON_PATH=out/candidate-vectors.ndjson
export VECTORIZE_MANIFEST_PATH=out/candidate-manifest.json
npm run index
npm --prefix ../../workers/mux-ai run dev -- --remote \
  --var "VECTORIZE_NAMESPACE:$VECTORIZE_NAMESPACE"
```

After both retrieval evaluations pass, run `npm run publish` with the staging
variables still set. It strips the candidate IDs and namespace, promotes the
validated records to the live namespace, and updates the live manifest. Run
`npm run cleanup` afterward, including when validation fails.

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
environment. Local indexing and publication runs use the same environment
variables.

Vectorize writes are asynchronous. The indexer polls the index's
`processedUpToMutation` value after each upsert and deletion. Retrieval
evaluation, publication, and manifest updates therefore wait for query-visible
state instead of treating an enqueued mutation as completed work.

## Manual recovery

If the workflow fails, fix the reported credential, embedding, or evaluation
problem and rerun the failed job. Candidate records are isolated from live
search and are removed by the workflow cleanup step. Operators can recover
locally with:

```bash
cd mux-website
npm --prefix workers/mux-ai ci --ignore-scripts
npm --prefix tools/docs-indexer ci --ignore-scripts
export VECTORIZE_NAMESPACE="docs-recovery-$RANDOM"
export VECTORIZE_ID_PREFIX="recovery-$RANDOM-"
export VECTORIZE_NDJSON_PATH=tools/docs-indexer/out/candidate-vectors.ndjson
export VECTORIZE_MANIFEST_PATH=tools/docs-indexer/out/candidate-manifest.json
npm --prefix tools/docs-indexer run index
# Start the Worker with --var VECTORIZE_NAMESPACE:$VECTORIZE_NAMESPACE,
# then run both retrieval evaluations before publishing.
npm --prefix tools/docs-indexer run publish
npm --prefix tools/docs-indexer run cleanup
```

Relative `VECTORIZE_NDJSON_PATH` and `VECTORIZE_MANIFEST_PATH` values resolve
from the directory where npm was invoked. This keeps the indexer and Wrangler
on the same file even though npm and Wrangler run their commands from different
package directories.

Run the retrieval checks against a remote development Worker before declaring
the recovery complete. The old live manifest is retained whenever promotion or
live stale deletion fails, so a retry can finish publication cleanup.
