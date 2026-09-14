# IO Module

The `io` module provides byte streams and standard process streams. Filesystem
and path operations belong to `std.fs`.

## Import

```mux
import std.io
import std.fs
```

## Byte streams

`io.Reader` and `io.Writer` are shared resource handles. Constructors take no
arguments; parameterized construction uses explicit `from_*`/`to_*` names.
Every fallible Reader/Writer operation returns `result<value, IoError>`.
`IoError` exposes read-only `kind`, `detail`, and `operation` fields, plus
`message()` and `to_string()`.

- `io.stdin()` returns a non-seekable reader over process standard input.
- `io.stdout()` returns a non-buffering writer over standard output.
- `io.stderr()` returns a non-buffering writer over standard error.
- `reader.read_line()` returns the next UTF-8 line without its LF/CRLF
  terminator, or `none` at EOF. A final unterminated line is returned normally;
  invalid UTF-8 and lines over 16 MiB are errors.

- `io.Reader.new()` creates an empty reader.
- `io.Reader.from_bytes(bytes)` creates a reader over a byte copy.
- `io.Reader.from_file(string path)` returns a reader backed by a live file
  stream; bytes are read incrementally rather than copied up front.
- `io.Reader.from_tcp(net.TcpStream)` returns a reader over a cloned TCP
  connection for incremental socket reads.
- `reader.read(int limit)` consumes up to `limit` bytes.
- `reader.limit(int limit)` caps the total bytes returned by future reads.
- `reader.tee(writer)` duplicates future reads into `writer`; `untee()` stops
  duplication.
- `reader.read_exact(int size)` errors if EOF arrives early.
- `reader.remaining()` reports unread bytes.
- `reader.read_to_end(int limit)` consumes all remaining bytes up to `limit`.
- `reader.copy_to(writer, int limit)` copies up to `limit` bytes into another
  writer and returns the count copied.
- `reader.position()` and `reader.seek(int position)` provide bounded cursor access.
- `reader.close()` releases the underlying file/socket resource and invalidates
  all aliases.
- `io.Writer.new()` creates an in-memory writer.
- `io.Writer.to_file(string path)` returns a writer that truncates and writes
  the destination file; call `flush()` to force buffered OS writes.
- `io.Writer.append_file(string path)` returns a writer that preserves the
  destination file and appends every write at its end.
- `io.Writer.from_tcp(net.TcpStream)` returns a writer over a cloned TCP
  connection for incremental socket writes.
- `writer.write(bytes)` appends and returns the number of bytes written.
- `writer.write_all(bytes)` appends all bytes and returns `result<void, IoError>`.
- `writer.bytes()` returns a copy of the accumulated bytes.
- `writer.position()` and `writer.seek(int position)` provide bounded cursor
  access for in-memory and truncating file writers. Append-mode, socket, and
  standard-stream writers are not seekable.
- `writer.flush()` is an explicit, synchronous flush point.
- `writer.close()` releases the underlying file/socket resource and invalidates
  all aliases.

File-backed constructors preserve native open failures in `IoError.kind` (for
example `not_found` or `permission`) and identify the failed operation through
`IoError.operation` (`reader.from_file`, `writer.to_file`, or
`writer.append_file`).

Low-level file-handle writes reject null handles or content pointers and report
failure without dereferencing them; normal Mux code should use the typed
`Reader` and `Writer` APIs above.

Dropping the last reader name also releases a writer retained by `reader.tee`;
an explicit `close()` is not required solely to clean up a tee relationship.

Standard output/error writers stream directly to the process handles and do not
support `writer.bytes()`; call `flush()` when an explicit flush boundary is
needed. Closing a standard-stream handle does not close the process stream.

Reads are bounded to 16 MiB per operation, including whole-file reads exposed
by `std.fs` and the internal adapters used by other standard-library readers;
buffered writers are bounded to a 16 MiB
total buffer.

## Stream capabilities

`std.io` also exports small interfaces for generic stream helpers. Import the
capabilities with `import std.io.*` and use them as generic bounds:

| Interface  | Required methods                                                          | Implemented by                                                       |
| ---------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `Readable` | `read(int) -> result<bytes, IoError>`                                     | `io.Reader`, `net.TcpStream`, `net.LocalStream`, `net.tls.TlsStream` |
| `Writable` | `write(bytes) -> result<int, IoError>`                                    | `io.Writer`, `net.TcpStream`, `net.LocalStream`, `net.tls.TlsStream` |
| `Seek`     | `position() -> result<int, IoError>`, `seek(int) -> result<int, IoError>` | `io.Reader`, `io.Writer`                                             |

The interfaces are capability contracts, not dynamic stream values. Calls are
statically dispatched after generic specialization, so a helper can accept any
current or future concrete type that implements the required methods. A
`Reader` or `Writer` may still return an error from `Seek` when its underlying
resource is not seekable (for example, standard input or a socket).

## Erased streams

`io.Stream` is an owned, type-erased handle for code that needs to store
different stream implementations together. It keeps one capability. A read
operation on a writer, or a write operation on a reader, returns
`IoError.kind == unsupported`.

- `io.Stream.from_reader(reader)` wraps a `Reader` capability.
- `io.Stream.from_writer(writer)` wraps a `Writer` capability.
- `stream.read(int)`, `stream.write(bytes)`, `stream.flush()`, and
  `stream.seek(int)` forward to the stored capability.
- `stream.close()` closes the erased handle and releases its owned capability.

Copies share the underlying capability and keep it alive until the last copy is
closed or dropped. The erased handle does not turn the static `Readable`,
`Writable`, or `Seek` interfaces into dynamic values. Use those interfaces as
generic bounds when the operation should be checked at compile time.

```mux title="stream_capabilities.mux"
import std.io.*

func read_prefix<T is Readable>(T source) returns result<bytes, IoError> {
    return source.read(2)
}

func copy_prefix() returns result<int, IoError> {
    Reader reader = Reader.from_bytes(b"hello")
    auto prefix = use read_prefix(reader)
    Writer writer = Writer.new()
    auto written = use writer.write(prefix)
    assert(written == 2, "the prefix should contain two bytes")
    reader.close()
    writer.close()
    return ok(written)
}

func main() returns void {
    auto result = copy_prefix()
    if result.is_err() {
        print(result.error().message())
    }
    return
}
```

## Example

```mux title="io_example.mux"
import std.io
import std.fs

func run_io() returns result<int, IoError> {
    auto out = io.stdout()
    auto write_result = out.write_all(b"")
    if write_result.is_err() {
        return err(write_result.error())
    }
    auto flush_result = out.flush()
    if flush_result.is_err() {
        return err(flush_result.error())
    }
    out.close()

    auto file_result = fs.write_file("hello.txt", "hello from mux")
    if file_result.is_err() {
        return err(IoError.from_message(file_result.error().message()))
    }
    auto content_result = fs.read_file("hello.txt")
    if content_result.is_err() {
        return err(IoError.from_message(content_result.error().message()))
    }
    auto content = content_result.value()
    print("read: " + content)
    return ok(1)
}

func main() returns void {
    auto result = run_io()
    if result.is_err() {
        print(result.error().message())
    }
    return
}
```
