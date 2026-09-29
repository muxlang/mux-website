# Setup

This page covers end-to-end Mux setup, including runtime installs, compiler/tooling, and editor integration.

## Language install

### Compiler and runtime (prebuilt binaries)

The installer downloads a prebuilt compiler and runtime library, so you do not
need Rust or the LLVM development libraries.

You do need a **C compiler**. Mux compiles your program to an object file and
then calls one to link it, so this is required to run anything, not just to
build from source. Any recent `clang` or `gcc` works and **the version does not
need to match** the LLVM the compiler was built against - the linker never
parses LLVM IR, only the object file:

- **Debian/Ubuntu:** `sudo apt-get install clang`
- **Arch Linux:** `sudo pacman -S clang`
- **macOS:** `xcode-select --install` (the Command Line Tools ship clang)
- **Windows:** install LLVM, for example via Chocolatey

The installer runs `mux doctor` when it finishes and tells you if anything is
missing. You can re-run that check at any time.

**Linux and macOS:**

```bash
curl -fsSL https://raw.githubusercontent.com/muxlang/mux-compiler/main/scripts/install.sh | sh
```

**Windows (PowerShell):**

```powershell
iwr -useb https://raw.githubusercontent.com/muxlang/mux-compiler/main/scripts/install.ps1 | iex
```

**Custom install directories:**

```bash
MUX_INSTALL_DIR=/usr/local/bin MUX_LIB_DIR=/usr/local/lib sh install.sh
```

### Compiler and tooling (source builds)

For compiler development or source builds, you need LLVM 22 and clang. The bootstrap script installs the toolchain automatically.

```bash
git clone https://github.com/muxlang/mux-compiler
cd mux-compiler
./scripts/bootstrap-dev.sh
./scripts/dev-cargo.sh build -p mux-runtime -p mux-lang
```

Build both packages. Compiled Mux programs link `libmux_runtime.a`, and cargo
emits a dependency's rlib but never its staticlib, so building only the compiler
leaves programs failing to link. `scripts/run-checks.sh` does this for you.

### Verify installation

```bash
mux version
mux doctor
mux doctor --dev
```

## Syntax highlighting

Mux ships TextMate and Tree-sitter grammars. Use the section that matches your
editor. The VSCode and compiler changes are under review. Neovim and Helix still
need manual registration until their upstream changes ship.

### TextMate family (VSCode, Sublime Text, JetBrains)

**VSCode:**

1. Package and verify a local extension build:
   ```bash
   cd mux-syntax-highlighting
   npm ci
   npm run package:vscode
   npm run verify:vscode-package
   ```
2. Install the generated `.vsix`:
   ```bash
   code --install-extension dist/language-mux.vsix
   ```
3. Reload VSCode.

The extension starts `mux lsp` automatically when the compiler is on `PATH`.
Set the machine-scoped `mux.serverPath` setting if the compiler executable is
installed elsewhere. A local extension build requires Node.js and npm; it does
not download or build the compiler.

**Sublime Text:**

1. Copy `mux-syntax-highlighting/textmate-mux/source.mux.json` into `Packages/User/Mux/`.
2. Add to `Packages/User/Package.sublime-settings`:
   ```json
   {
     "syntax": [
       {
         "name": "Mux",
         "scope": "source.mux",
         "file_extensions": [".mux"],
         "path": "User/Mux/source.mux.json"
       }
     ]
   }
   ```

**JetBrains (IntelliJ, WebStorm, etc.):**

1. Install the TextMate Bundles plugin.
2. Import `mux-syntax-highlighting/textmate-mux/source.mux.json`.
3. Associate `.mux` files in Settings > Editor > File Types.

### Tree-sitter family (Neovim, Helix)

**Neovim:**

Neovim does not yet recognize `.mux` files, and nvim-treesitter does not yet
include Mux in its parser list. Add the filetype and parser configuration:

```lua
vim.filetype.add({ extension = { mux = 'mux' } })

vim.api.nvim_create_autocmd('User', {
  pattern = 'TSUpdate',
  callback = function()
    require('nvim-treesitter.parsers').mux = {
      install_info = {
        url = 'https://github.com/muxlang/tree-sitter-mux',
        revision = 'd14c5d9e473f0bef87753eb1d1d9d8bd73e6d3a2',
        queries = 'queries',
      },
    }
  end,
})
```

Then run `:TSInstall mux` and enable highlighting with your usual
nvim-treesitter configuration. Remove the manual registration after the
upstream integrations ship.

**Helix:**

Until Helix includes Mux, add the language and grammar entries to
`~/.config/helix/languages.toml`:

```toml
[[language]]
name = "mux"
scope = "source.mux"
file-types = ["mux"]
comment-token = "//"
block-comment-tokens = { start = "/*", end = "*/" }
grammar = "mux"
language-servers = ["mux"]

[[grammar]]
name = "mux"
source = { git = "https://github.com/muxlang/tree-sitter-mux", rev = "d14c5d9e473f0bef87753eb1d1d9d8bd73e6d3a2" }

[language-server.mux]
command = "mux"
args = ["lsp"]
```

Fetch and build the grammar, then install its highlight query:

```bash
hx --grammar fetch
hx --grammar build
mkdir -p ~/.config/helix/runtime/queries/mux
cp path/to/tree-sitter-mux/queries/highlights.scm ~/.config/helix/runtime/queries/mux/
```

The language-server entry works with a compiler build that includes `mux lsp`.
The command is not in a released compiler yet.

## LSP

The compiler PR adds `mux lsp` over stdio. The command is not available in a
released compiler yet. Once a release includes it, install the compiler using
the standard Mux installation instructions so the server, formatter, and fix
tool are available together.

**Neovim 0.11 or newer:** add the Mux filetype entry shown above, then enable
the client:

```lua
vim.lsp.config('mux', {
  cmd = { 'mux', 'lsp' },
  filetypes = { 'mux' },
})
vim.lsp.enable('mux')
```

**Helix:** the Mux language configuration starts `mux lsp` automatically. Set
the compiler's executable path in the Helix language-server configuration if
`mux` is not on Helix's `PATH`.

**Emacs with Eglot:**

If your Mux major mode is named `mux-mode`, add:

```elisp
(add-to-list 'eglot-server-programs '(mux-mode . ("mux" "lsp")))
```

Set each editor's server command to the installed compiler path if `mux` is not
on that editor's `PATH`.

## Playground local development

To run the docs site and compiler API locally for playground testing:

1. Start the API server from the repo root:

```bash
uv run python api/server.py
```

2. In a second terminal, start the website:

```bash
cd mux-website
npm start
```

The site runs on `http://localhost:3000` and uses the production compile proxy
(`https://mux-ai.corniedj.workers.dev`) by default. The proxy keeps browser
traffic behind Cloudflare and authenticates its requests to the Fly origin.

To use your local API server instead, set this before starting the docs site:

```bash
MUX_API_URL=http://localhost:8080 npm start
```

Set `MUX_API_URL` when running a local API directly. Production deployments
should keep the default Worker URL; do not expose the Fly origin to browser
code.

## Profiling

Profiling is done with external tools so it stays decoupled from the compiler and runtime.

**Linux:**

- `perf` + flamegraph

**macOS:**

- Instruments

**Windows:**

- Windows Performance Analyzer or Visual Studio Profiler
