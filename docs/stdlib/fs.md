# std.fs - filesystem operations

`std.fs` is the filesystem-focused package. It exposes checked,
error-reporting operations for paths, files, and directories.

```mux
import std.fs

func fs_error_label(FsError error) returns string {
    return error.message() + ":" + error.path
}

func run_fs() returns result<int, FsError> {
    auto data = use fs.read_bytes("data.bin")
    print("read " + data.size().to_string() + " bytes")
    auto entries = use fs.listdir(".")
    print(entries.size().to_string() + " entries")
    return ok(1)
}

func main() returns void {
    auto result = run_fs()
    if result.is_err() {
        print(result.error().message())
    }
    return
}
```

`FsError.kind` is the typed `fs.FsErrorKind` enum with `Invalid`, `Io`,
`NotFound`, `Permission`, `NotUnicode`, and `Os` variants. Compare or match
those variants directly; use `message()` when rendering the detail text.

Available operations include `read_file`, `write_file`, `read_bytes`,
`write_bytes`, `exists`, `is_file`, `is_dir`, `mkdir`, `listdir`, `remove`,
`remove_dir_all`, `join`, `basename`, `dirname`, `cwd`, `absolute`, `canonical`,
`copy`, `rename`, `replace_atomic`, `file_size`, and `is_symlink`. `is_readonly`
and `set_readonly` expose the portable read-only permission flag. `read_link`
reads a symbolic link target without following it. `temp_file()`
and `temp_dir()` create unique empty resources in the platform temporary
directory and return their paths; callers own cleanup with `remove` or
`remove_dir_all`. Every operation that
touches the filesystem returns `result<..., FsError>` and reports an operating
system error instead of silently ignoring failures. `FsError.kind` classifies
failures as `not_found`, `permission`, `not_unicode`, `invalid`, or `io`;
`detail` contains the stable human-readable message and `path` contains the
path supplied by the operation when available. Operating-system failures from
file, directory, metadata, link, copy, rename, and permission operations retain
their `not_found` or `permission` category; callers do not need to inspect the
detail string. `FsError.from_message(text)` creates an error when adapting an
external failure.

Whole-file reads are bounded to 16 MiB, including `read_file` and `read_bytes`.
`listdir` is also bounded to 65,536 entries and 16 MiB of aggregate entry-name
bytes. Use the streaming `std.io` readers or `fs.Directory` iterator when input
must be processed in smaller pieces; an oversized file or directory listing
returns `FsErrorKind.Invalid` before an unbounded allocation can occur.

For large directories, `fs.Directory.open(path)` returns a shared streaming
directory handle. `directory.next()` returns the next entry name as
`optional<string>` and returns `none` at EOF; iteration errors and non-Unicode
entry names are reported as errors. Iteration enforces the same 65,536-entry
and 16 MiB aggregate-name limits as `listdir`; exceeding either returns
`FsErrorKind.Invalid`. `directory.close()` releases the iterator and invalidates
its aliases. Entry order is the platform filesystem order, so callers that need
deterministic ordering should collect and sort the names.

`Path` is the lossless native path value. `Path.new()` is the empty path;
parameterized construction is explicit:

```mux
import std.fs

func show_path() returns result<int, FsError> {
    auto path = use fs.Path.from_string("logs")
    auto file = use path.join("today.txt")
    auto display = use file.display()
    print(display)
    return ok(1)
}

func main() returns void {
    auto result = show_path()
    if result.is_err() {
        print(result.error().message())
    }
    return
}
```

`to_string()` is strict and returns an error for a non-UTF-8 native path;
`display()` uses the platform's loss-replacing display form. `parent`,
`file_name`, `extension`, and `stem` return optionals, while `join`,
`with_file_name`, and `with_extension` return new validated values.
