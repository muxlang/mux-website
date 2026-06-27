# mux-website

The documentation site for the [Mux programming language](https://github.com/muxlang),
served at **[mux-lang.dev](https://mux-lang.dev)**. Built with
[Docusaurus](https://docusaurus.io/).

This repo also holds the docs AI assistant worker and the docs indexing tooling
that powers it, since both are coupled to the docs content.

## Layout

| Path | What it is |
|------|------------|
| `docs/` | Docusaurus documentation content (the language docs) |
| `src/` | Site React components, pages, and the interactive playground |
| `static/` | Static assets (logo, favicon, images) |
| `sidebars.ts`, `docusaurus.config.ts` | Docusaurus configuration |
| `workers/mux-ai/` | Cloudflare Worker that answers questions over the docs (Vectorize + Workers AI) |
| `tools/docs-indexer/` | Indexes `docs/` into the `mux-docs` Vectorize index used by the worker |

## Development

```bash
npm install        # install dependencies
npm start          # run the dev server (http://localhost:3000)
npm run build      # production build
npm run lint       # eslint
npm run typecheck  # tsc
```

The site talks to the compile/run API ([mux-website-api](https://github.com/muxlang/mux-website-api))
and the AI worker over HTTP only; there is no build-time coupling to the compiler.

## Deployment

The site deploys to GitHub Pages on `mux-lang.dev`. Worker and indexer deploys
are documented in `workers/mux-ai/README.md`.

## Related repositories

- [mux-compiler](https://github.com/muxlang/mux-compiler) - the compiler and CLI (the canonical Mux version)
- [mux-website-api](https://github.com/muxlang/mux-website-api) - the playground compile/run API
- [mux-syntax-highlighting](https://github.com/muxlang/mux-syntax-highlighting) - canonical syntax spec (source for the site's Shiki grammar)
- [tree-sitter-mux](https://github.com/muxlang/tree-sitter-mux) - tree-sitter grammar

## License

[MIT](LICENSE)
