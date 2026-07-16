<div align="center">

<img src="https://mux-lang.dev/img/mux-logo.png" alt="Mux Logo" width="120">

# mux-website

**The documentation site and playground for [Mux](https://github.com/muxlang)**

[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)
[![Website](https://img.shields.io/badge/mux--lang.dev-online-blue.svg?style=flat-square)](https://mux-lang.dev)
[![Sonar Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=muxlang_mux-website&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=muxlang_mux-website)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=muxlang_mux-website&metric=coverage)](https://sonarcloud.io/summary/new_code?id=muxlang_mux-website)

</div>

The documentation site for Mux, served at **[mux-lang.dev](https://mux-lang.dev)**
and built with [Docusaurus](https://docusaurus.io/). This repo also holds the docs
AI assistant worker and the docs indexing tooling that powers it, since both are
coupled to the docs content.

---

## Layout

| Path | What it is |
|------|------------|
| `docs/` | Docusaurus documentation content (the language docs) |
| `src/` | Site React components, pages, and the interactive playground |
| `static/` | Static assets (logo, favicon, images) |
| `sidebars.ts`, `docusaurus.config.ts` | Docusaurus configuration |
| `workers/mux-ai/` | Cloudflare Worker that answers questions over the docs (Vectorize + Workers AI) |
| `tools/docs-indexer/` | Indexes `docs/` into the `mux-docs` Vectorize index used by the worker |

---

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

---

## Deployment

The site deploys to GitHub Pages on `mux-lang.dev`. Worker and indexer deploys
are documented in `workers/mux-ai/README.md`.

---

## Related repositories

| Repo | What it is |
|------|------------|
| [mux-compiler](https://github.com/muxlang/mux-compiler) | The language, compiler, and CLI (the canonical Mux version) |
| [mux-runtime](https://github.com/muxlang/mux-runtime) | Runtime + standard library linked by compiled programs |
| [mux-website-api](https://github.com/muxlang/mux-website-api) | Compile/run API behind the playground |
| [tree-sitter-mux](https://github.com/muxlang/tree-sitter-mux) | Tree-sitter grammar + highlight queries |
| [mux-syntax-highlighting](https://github.com/muxlang/mux-syntax-highlighting) | TextMate grammar, VSCode extension, canonical syntax spec |
| [mux-context](https://github.com/muxlang/mux-context) | Cross-repo architecture, design rationale, glossary, releases |

---

## License

[MIT](LICENSE) - Maintained by [Derek Corniello](https://github.com/DerekCorniello)
