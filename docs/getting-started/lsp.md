---
title: Language Server
description: Configure Mux's language server in your editor.
---

# Language Server

The Mux compiler includes a Language Server Protocol (LSP) server. It runs over
stdio and starts with:

```sh
mux lsp
```

Install a compiler release that includes the language server and make sure
`mux` is available in the editor's environment. The editor still needs Mux
syntax grammar support for highlighting; the grammar and language server are
separate tools.

Compiler v0.13.0 provides diagnostics, formatting, safe compiler fixes,
document symbols, go to definition, hover, completion, and signature help. The
next compiler release is being prepared with workspace references, rename,
semantic tokens, inferred type hints, and folding ranges. Those additions will
be available after that release; editor clients may expose different subsets.

## VS Code

The maintained `mux-lang.language-mux` extension starts `mux lsp` automatically.
Its v0.13.0 registry release is still pending; until then, use the
[source installation steps](https://github.com/muxlang/mux-syntax-highlighting/blob/main/INSTALL.md#vscode).
If the compiler is not on `PATH`, set `mux.serverPath` to the full path of the
`mux` executable in your editor settings.

## Neovim

For Neovim 0.11 or later, add a filetype and server configuration:

```lua
vim.filetype.add({ extension = { mux = "mux" } })

vim.lsp.config("mux", {
  cmd = { "mux", "lsp" },
  filetypes = { "mux" },
  root_markers = { "mux-project.json", ".git" },
})

vim.lsp.enable("mux")
```

Install a Mux syntax plugin separately if you want grammar-based highlighting.

## Helix

Add a server and language entry to `languages.toml`. Merge the `[[language]]`
settings into an existing Mux language entry if your syntax plugin already
defines one.

```toml
[language-server.mux-lsp]
command = "mux"
args = ["lsp"]

[[language]]
name = "mux"
scope = "source.mux"
file-types = ["mux"]
language-servers = ["mux-lsp"]
roots = ["mux-project.json", ".git"]
```

## Other editors

Configure the editor's LSP client to run `mux lsp` over stdio for `.mux`
files. Set the workspace root to the project directory so the server can
resolve imports and workspace references. Consult the editor's LSP setup docs
for its client-specific configuration format.
