# Formatting Mux source

The formatter is included in Mux 0.12.0 and later releases.

Run `mux format` from a project directory to format its `.mux` files
recursively. You can also select files or directories:

```sh
mux format
mux format src tests
mux format ~/test.mux
```

By default, the formatter uses four-space indentation and an 80-column target.
It preserves literal spellings, comment contents, and declaration order. Long
literals, comments, and expressions without a safe break point can exceed the
target.

To change the layout, add a `format` object to `mux-project.json`:

```json
{
  "format": {
    "indent_type": "space",
    "indent_count": 2,
    "line_width": 100,
    "brace_style": "same_line",
    "where_position": "own_line",
    "blank_lines_between_declarations": 1,
    "blank_lines_between_members": 0,
    "blank_lines_before_functions": 1,
    "trailing_comma": "multiline"
  }
}
```

The CLI looks for `mux-project.json` in the working directory and its parent
directories. It stops at the nearest Git worktree root and does not search the
filesystem root. One config applies to every path in a command. Without a
config, the built-in defaults apply: braces stay on the declaration line,
`where` clauses start on their own line, there is one blank line between
declarations, ordinary class and type members have no extra blank lines, and
multiline lists use trailing commas. Function members have one blank line above
them. Invalid JSON uses all defaults; invalid settings use their individual
defaults, and warnings go to stderr.

`indent_type` accepts `space` or `tab`. The default indent count is four spaces
or one tab per level. `brace_style` accepts `same_line` or `next_line`, and
`where_position` accepts `own_line` or `same_line`. `trailing_comma` accepts
`multiline`, `never`, or `always`. Blank-line counts can be any nonnegative
integer.

Use `--check` or `-c` to report files that would change without writing them:

```sh
mux format --check
mux format -c src
```

The command exits with status 0 when the files are formatted, 1 when a check
finds changes, and 2 for syntax, input, or file-operation errors.

Formatting requires valid syntax, but missing imports and type errors do not
prevent it. Directory traversal skips `.git`, `target`, and `node_modules` and
does not follow discovered symlinks. Explicit symlink paths resolve to their
targets. Repeated paths are processed once; empty directories succeed without
changes. A missing path or an explicitly selected non-Mux file is an error.

The formatter prepares every selected file before writing, so a syntax error
leaves the selected files untouched. Each changed file is replaced atomically
with its permissions preserved. An I/O error during replacement can leave
earlier files formatted. Changes made concurrently during preparation or
staging are reported instead of overwritten, so avoid editing selected files
while formatting.
