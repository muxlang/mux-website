---
title: Data CSV
---

# std.data.csv - CSV parsing

`std.data.csv` provides dialect-aware whole-table and streaming CSV parsing and
rendering. Parsed documents are structured `Csv` values; quoting, delimiters,
row shape, and contextual errors are handled by the package.

- `data.csv.parse(string text) -> result<Csv, CsvError>` - parse rows without headers (each row is a list of strings).
- `data.csv.parse_with_headers(string text) -> result<Csv, CsvError>` - parse rows and preserve the first line as header names.
- `data.csv.parse_with_options(string text, int delimiter, int quote, bool has_headers, bool trim, bool flexible) -> result<Csv, CsvError>` - configure the dialect explicitly; delimiter and quote are ASCII byte values.

The resulting `Csv` value is a first-class type in the stdlib (see `csv.stringify` for output).
Use `table.stringify_with(delimiter, quote)` when emitting a non-default
dialect. Both parsing and writing reject invalid control-byte delimiters and
quotes; malformed rows return contextual errors rather than being dropped.
Whole-table and byte-reader inputs must be valid UTF-8 and are bounded to
16 MiB before parsing.

All fallible CSV operations return `CsvError`. Its `kind` is the typed
`csv.CsvErrorKind` enum (`Invalid`, `Parse`, `Type`, `Limit`, or `Io`), while
`detail` remains textual. Compare or match the enum for programmatic handling
and use `error.message()` for display.

Example:

```mux
import std.data.csv

func render_table() returns result<int, CsvError> {
    string data = "name,age\nAlice,30"
    auto table = use csv.parse_with_headers(data)
    auto text = use table.stringify()  // uses Csv.stringify()
    print(text)
    return ok(0)
}

func main() returns void {
    auto result = render_table()
    if result.is_err() {
        print(result.error().message())
        return
    }
    return
}
```

For bounded incremental processing, use the typed stream handles. A reader
consumes one record at a time, and a writer can either retain encoded bytes or
forward each record to an existing `io.Writer`:

```mux
import std.data.csv

func stream_csv() returns result<int, CsvError> {
    auto reader = use csv.CsvReader.from_bytes(b"name,age\nAda,36\n", true)
    auto row = use reader.read()
    if row.is_some() {
        auto values = row.value()
        print(values[0])
    }

    auto writer = use csv.CsvWriter.from_config(44, 34)
    use writer.write(["name", "age"])
    auto output = use writer.bytes()
    print(output.to_utf8_lossy())
    return ok(0)
}

func main() returns void {
    auto result = stream_csv()
    if result.is_err() {
        print(result.error().message())
        return
    }
    return
}
```

Use an existing stream when the CSV is part of a larger pipeline:

```mux
import std.data.csv
import std.io

func copy_csv() returns result<void, CsvError> {
    io.Reader source = io.Reader.from_bytes(b"name,age\nAda,36\n")
    auto reader = use csv.CsvReader.from_reader(source, true)
    auto headers = use reader.headers()
    io.Writer destination = io.Writer.new()
    auto writer = use csv.CsvWriter.from_writer(destination, 44, 34)
    use writer.write(headers)
    auto row = use reader.read()
    if row.is_some() {
        use writer.write(row.value())
    }
    use writer.flush()
    return ok()
}
```

`CsvReader.from_reader(reader, has_headers)` pulls bytes from the supplied
reader as records are requested and leaves that reader open. It enforces the
same 16 MiB input limit as the byte constructor. `CsvWriter.from_writer`
forwards encoded records to the supplied writer and leaves it open; its
`bytes()` method returns an error because output is not retained by the CSV
handle. Call `flush()` when the destination needs an explicit flush.

`CsvReader.from_bytes(bytes, has_headers)` and
`CsvWriter.from_config(delimiter, quote)` are explicit parameterized
constructors; `new()` remains the no-argument default. Rows are
`list<string>`, and malformed records remain typed errors.
