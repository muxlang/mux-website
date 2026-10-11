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

Mux has maintained editor integrations for VS Code and Neovim. Both provide
syntax highlighting and use the language server included with compiler v0.13.0.
Sublime Text, JetBrains, Helix, and Emacs have manual syntax setup; they are not
part of the maintained editor support release.

### TextMate family (VSCode, Sublime Text, JetBrains)

**VSCode:**

Install **Mux Language Support** (`mux-lang.language-mux`) from the Visual
Studio Marketplace. In the Extensions view, search for "Mux Language Support"
and choose the extension published by `mux-lang`. From a terminal, run:

```bash
code --install-extension mux-lang.language-mux
```

For VSCodium or another editor using Open VSX, install the same extension from
Open VSX or use its command-line client:

```bash
codium --install-extension mux-lang.language-mux
```

If the extension is not available in your editor's registry, build and install
the verified VSIX from a clone:

```bash
cd mux-syntax-highlighting
npm ci
npm run package:vscode
npm run verify:vscode-package
```

```bash
code --install-extension dist/language-mux.vsix
```

Reload VS Code after installation.

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

Install the Mux plugin with lazy.nvim. Neovim 0.11 or newer, a C compiler, and
Mux 0.13.0 or newer on `PATH` are required:

```lua
{
  "muxlang/tree-sitter-mux",
  tag = "v0.7.0",
  lazy = false,
  build = "nvim --headless --clean -l scripts/build-nvim-parser.lua",
  config = function()
    require("mux").setup()
  end,
}
```

The plugin detects `.mux` files, builds the parser, enables highlighting, and
starts `mux lsp`. It does not require nvim-treesitter. To use a nonstandard
compiler path or turn off LSP startup, see the Neovim options in [LSP](#lsp).

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
source = { git = "https://github.com/muxlang/tree-sitter-mux", rev = "9d89fb021c15b70b967ef8574c7e28d640d2b705" }

[language-server.mux]
command = "mux"
args = ["lsp"]
```

Fetch and build the grammar, then install its highlight query:

```bash
hx --grammar fetch
hx --grammar build
mkdir -p ~/.config/helix/runtime/queries/mux
curl -fsSL \
  https://raw.githubusercontent.com/muxlang/tree-sitter-mux/9d89fb021c15b70b967ef8574c7e28d640d2b705/queries/highlights.scm \
  -o ~/.config/helix/runtime/queries/mux/highlights.scm
```

The language-server entry works with the released compiler's `mux lsp` command.

## LSP

Compiler v0.13.0 and later include `mux lsp` over stdio. Install the compiler
using the standard Mux installation instructions. The VS Code extension and
Neovim plugin start the server automatically when they open a Mux file.

The server provides live diagnostics, completion, hover, signature help,
document symbols, go-to-definition, formatting, and safe code actions. The
editor decides when to request formatting. Format-on-save is controlled by your
editor settings and is not enabled by the Mux Neovim plugin.

In the plugin's `config` function, replace `require("mux").setup()` with one
of these alternatives. Use the custom command when the compiler is not on your
PATH:

```lua
require("mux").setup({ lsp = { cmd = { "/path/to/mux", "lsp" } } })
```

To keep the plugin's filetype detection and highlighting but disable automatic
LSP startup, use this instead:

```lua
require("mux").setup({ lsp = false })
```

Other LSP-compatible editors can launch `mux lsp`, but their Mux setup is
manual and is not part of the maintained support release.

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
