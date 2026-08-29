# mux-website

`mux-website` is the Docusaurus documentation site and its Worker, indexer,
and retrieval tooling. It serves the public language documentation and the
interactive playground UI.

Cross-repository architecture and release facts live in
[`mux-context`](https://github.com/muxlang/mux-context). Read its canonical
[`SKILL.md`](https://github.com/muxlang/mux-context/blob/main/SKILL.md) before
changing language behavior or a cross-repository generated artifact.

## Invariants

- Documentation examples must describe the released compiler behavior used by
  the playground; compile complete snippets before publishing them.
- `src/shiki/mux.json` and other generated/derived syntax files must identify
  their source and pass the parity check; do not make the website grammar a
  second source of truth.
- Worker requests are untrusted. Preserve authentication boundaries, message
  and body limits, rate controls, and bounded CPU/memory work.
- Keep indexer and retrieval tooling independently typechecked and testable
  without production credentials.

## Quality gate

Run `npm run lint`, `npm run typecheck`, and `npm run build`. For related work,
also run the Worker, docs-indexer, retrieval-tool, and docs-snippet checks named
in `CONTRIBUTING.md`.

## Documentation

See [`README.md`](README.md), [`CONTRIBUTING.md`](CONTRIBUTING.md), and the
component READMEs under `workers/` and `tools/`.
