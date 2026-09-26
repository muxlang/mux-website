# Formatting Mux source

The formatter is available in current compiler builds. It may not be included
in the latest published release.

Run `mux format` from a project directory to format its `.mux` files
recursively. You can also select files or directories:

```sh
mux format
mux format src tests
mux format ~/test.mux
```

The formatter uses four-space indentation and an 80-column target. It preserves
literal spellings, comment contents, and declaration order. Long literals,
comments, and expressions without a safe break point can exceed the target.
Configuration files are planned; the command currently uses these defaults.

Use `--check` or `-c` to report files that would change without writing them:

```sh
mux format --check
mux format -c src
```

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
