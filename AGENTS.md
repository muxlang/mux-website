# mux-website: AI Agent Guidelines

This repo is the Docusaurus docs site for Mux (served at mux-lang.dev), plus the
docs AI worker (`workers/mux-ai/`) and the docs indexer (`tools/docs-indexer/`).
It is part of the multi-repo [muxlang](https://github.com/muxlang) ecosystem.

> Cross-repo architecture, design rationale, the feature map, and the release
> process live in [muxlang/context](https://github.com/muxlang/context).

## Critical Rules

- **No special characters** - avoid em-dashes, emojis, or other non-ASCII in code,
  comments, or commit messages.
- **Understand existing code first** - read relevant components/config before
  changing anything. Follow existing patterns.
- **No LLVM/Rust toolchain needed** - this is a JS/TS + Markdown repo. Node 20 is
  the only requirement. This is intentional: docs/content work must not require
  the compiler toolchain.
- **Remove outdated comments** - keep comments in sync with code.
- **Ask when unsure**, especially about language semantics documented here - the
  source of truth for the language is `mux-compiler`.

## Development

```bash
npm install
npm start          # dev server at http://localhost:3000
npm run build      # production build (must pass in CI)
npm run lint       # eslint src/
npm run typecheck  # tsc
```

Before pushing: run `lint`, `typecheck`, and `build`. CI runs all three plus a
SonarQube scan.

## Structure

- `docs/` - the documentation content (Markdown/MDX).
- `src/` - site components, pages, the interactive playground.
- `static/` - assets (logo at `static/img/mux-logo.png`).
- `workers/mux-ai/` - Cloudflare Worker (Workers AI + Vectorize). See its README
  for deploy + the maintenance runbook (re-index after docs changes).
- `tools/docs-indexer/` - builds the `mux-docs` Vectorize index from `docs/`.
  `DOCS_ROOT` in `src/index.ts` resolves to this repo's `docs/`.

## Syntax highlighting on the site

`.mux` code blocks are highlighted with a Shiki grammar vendored at
`src/shiki/mux.json`. This is a GENERATED artifact: the canonical syntax spec
lives in the `mux-syntax-highlighting` repo. When that repo's generator is wired
up, `src/shiki/mux.json` gets a CI parity check against the published spec. Until
then, keep it in sync manually and do not hand-edit it as the source of truth.

## Coupling notes

- The site talks to `mux-website-api` (compile/run) and the `mux-ai` worker over
  HTTP only - no build-time coupling to the compiler.
- User-facing install/clone/issue links point at `muxlang/mux-compiler` (the
  flagship), not this repo.

## Related repos

- `mux-compiler` - compiler + CLI, the canonical language version + docs source of truth.
- `mux-syntax-highlighting` - canonical syntax spec (feeds the Shiki grammar here).
- `mux-website-api`, `tree-sitter-mux`.

**Add to this document as you learn vital information.**
