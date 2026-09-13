---
title: Data JSON
---

# std.data.json - JSON helpers

`std.data.json` gives you explicit JSON parsing and conversion routines for working with Mux `Json` values.

Parsing rejects duplicate object keys by default, including duplicates nested
inside arrays or other objects, so malformed input cannot silently overwrite a
value. Interoperability callers can opt into an explicit policy with
`json.JsonDuplicatePolicy.First` or `json.JsonDuplicatePolicy.Last`; the selected value's
original number spelling is still preserved exactly.
The C-ABI entry points require UTF-8 and cap JSON and JSON Lines input at
16 MiB; oversize documents return errors before parsing.

- `data.json.parse(string source) -> result<Json, JsonError>` - parses a JSON string.
- `data.json.parse_with(string source, JsonDuplicatePolicy policy) -> result<Json, JsonError>` - parses with explicit duplicate-key handling (`Reject`, `First`, or `Last`).
- `data.json.parse_reader(io.Reader reader, int limit) -> result<Json, JsonError>` -
  consumes at most `limit` bytes from a reader and parses one UTF-8 document;
  the reader remains open.
- `data.json.parse_reader_with(io.Reader reader, int limit, JsonDuplicatePolicy policy) -> result<Json, JsonError>` - the bounded reader form with explicit duplicate-key handling.
- `data.json.token_reader(io.Reader reader, int limit) ->
result<JsonTokenReader, JsonError>` - validates one bounded UTF-8 document and
  exposes its lexical tokens incrementally. The source reader remains open.
- `data.json.from_map(map<string, T>) -> result<Json, JsonError>` - converts a string-keyed map into a `Json` object (generic over values).
- `data.json.to_map(Json value) -> result<map<string, Json>, JsonError>` - extracts an object map if the `Json` value is an object.
- `Json.stringify(optional<int> indent) -> result<string, JsonError>` - serializes
  compactly with `none`, or pretty-prints using 0-64 spaces per indentation
  level.
- `Json.as_number() -> result<JsonNumber, JsonError>` - exposes a JSON number
  without rounding or changing its spelling.
- `data.json.parse_lines(string source) -> result<list<Json>, JsonError>` - parses newline-delimited JSON, ignoring blank lines.
- `data.json.parse_lines_with(string source, JsonDuplicatePolicy policy) -> result<list<Json>, JsonError>` - JSON Lines form with explicit duplicate-key handling per line.
- `data.json.stringify_lines(list<Json> values) -> result<string, JsonError>` - writes one compact JSON value per line, bounded to a 16 MiB total output.
- `data.json.stringify_to(Json value, io.Writer writer, optional<int> indent) -> result<void, JsonError>` -
  serializes one value directly to a byte writer, leaving it open for further
  output.

`parse_reader` and `stringify_to` are bounded bridge operations for one
materialized `Json` value. `token_reader` is incremental at the lexical-token
level; a value-level streaming parser/writer will require a separate callback
or state-machine contract and is not implied by these functions.

`JsonTokenReader.next()` returns `result<optional<JsonToken>, JsonError>` and
advances one token at a time. A token has `kind()`, `text()`, and `value()`
methods. `kind()` returns the payloadless `JsonTokenKind` enum with variants
`StartObject`, `EndObject`, `StartArray`, `EndArray`, `Colon`, `Comma`,
`String`, `Number`, `Bool`, and `Null`; `text()` preserves the exact source
spelling. `value()` returns the decoded scalar as a `Json` result and errors
for structural tokens. Call `close()` when token consumption is finished.

`Json` values are mutable trees. `set_field(name, value)` replaces or inserts
an object field, and `push(value)` appends to an array. Both mutate the
receiver and return `result<void, JsonError>`; they reject scalar receivers and
values that cannot be represented as JSON.

All fallible JSON operations return `JsonError`. Its `kind` is the typed
`json.JsonErrorKind` enum (`Invalid`, `Parse`, `Type`, `Missing`, `Duplicate`,
`Limit`, or `Io`), while `detail` remains textual. Compare or match the enum
for programmatic handling and use `error.message()` for display.

`json.JsonDuplicatePolicy.Reject` is the default used by `parse`, `parse_reader`,
`parse_lines`, and the token reader. `First` keeps the first value for each
repeated key; `Last` keeps the final value. Both policies still parse and
validate every discarded value, including nested values, so malformed input is
never hidden by a duplicate-key choice.

For nested data, `at_pointer(pointer)`, `set_pointer(pointer, value)`, and
`remove_pointer(pointer)` use RFC 6901 JSON Pointers. The empty pointer names
the document root; object tokens decode `~1` as `/` and `~0` as `~`. Array
indices are canonical decimal numbers, and `set_pointer` also accepts `-` to
append. Pointer paths are bounded to 16 MiB and one million decoded tokens.
Pointer operations return `result<..., JsonError>` and report malformed,
missing, out-of-range, or over-limit paths instead of panicking.

`canonical()` returns compact deterministic JSON with object keys sorted
recursively. Use it when stable text is needed for cache keys or deterministic
snapshots; ordinary `stringify` preserves insertion order instead.

`merge_patch(patch)` applies RFC 7396 semantics in place: object fields are
replaced or recursively merged, `null` deletes a field, and a non-object patch
replaces the whole document. It returns `result<void, JsonError>`.

`apply_patch(operations)` applies an RFC 6902 JSON Patch list atomically. It
supports `add`, `remove`, `replace`, `move`, `copy`, and `test`; if any
operation fails, the document remains unchanged.

```mux
import std.data.json

func update_document() returns result<int, JsonError> {
    auto object = use json.parse("{}")
    auto value = use json.parse("3")
    use object.set_field("answer", value)
    print("updated")
    return ok(0)
}

func main() returns void {
    auto result = update_document()
    if result.is_err() {
        print(result.error().message())
        return
    }
    return
}
```

For parsers that need framing rather than a complete in-memory tree, consume
tokens directly:

```mux title="json_tokens.mux"
import std.data.json
import std.io

func read_tokens() returns result<int, JsonError> {
    io.Reader source = io.Reader.from_bytes(b"[1, true]")
    auto tokens = use json.token_reader(source, 1024)
    auto item = use tokens.next()
    if item.is_some() {
        auto token = item.value()
        auto kind = use token.kind()
        match kind {
            StartObject { print("start_object") }
            EndObject { print("end_object") }
            StartArray { print("start_array") }
            EndArray { print("end_array") }
            Colon { print("colon") }
            Comma { print("comma") }
            String { print("string") }
            Number { print("number") }
            Bool { print("bool") }
            Null { print("null") }
        }
    } else {
        print("end")
    }
    tokens.close()
    source.close()
    return ok(0)
}

func main() returns void {
    auto result = read_tokens()
    if result.is_err() {
        print(result.error().message())
        return
    }
    return
}
```

## Reading values out of a document

A `Json` value has typed accessors. Each returns a `result<T, JsonError>`, and the
error names what was actually there:

| Accessor      | Returns                                |
| ------------- | -------------------------------------- |
| `as_string()` | `result<string, JsonError>`            |
| `as_int()`    | `result<int, JsonError>`               |
| `as_float()`  | `result<float, JsonError>`             |
| `as_bool()`   | `result<bool, JsonError>`              |
| `as_list()`   | `result<list<Json>, JsonError>`        |
| `as_map()`    | `result<map<string, Json>, JsonError>` |
| `is_null()`   | `bool`                                 |

They return a `result` rather than an `optional` because "not an int" is worth
saying _why_. A bare `none` leaves you unable to tell a string from a null from
something else - exactly the information you need when a document is not the
shape you expected:

```
expected an int, found a string
```

That matters most in the escape hatch, where you are deliberately reading data
whose shape you could not declare. For a document you can describe, define an
explicit parser on a class and validate each field in that method. See
[explicit class conversion](../language-guide/classes.md#building-a-class-from-a-document)
for the interface and parser pattern.

```mux
import std.data.json

func read_fields() returns result<int, JsonError> {
    auto j = use json.parse("{\"user\": \"mux\", \"age\": 36}")
    auto fields = use json.to_map(j)
    auto name = use fields["user"].as_string()
    print("user=" + name)
    auto age = use fields["age"].as_int()
    print("age=" + age.to_string())
    return ok(0)
}

func main() returns void {
    auto result = read_fields()
    if result.is_err() {
        print(result.error().message())
        return
    }
    return
}
```

### `stringify` is not an accessor

`stringify` returns the JSON **encoding** of a value, which for a string
includes its quotes:

```mux
import std.data.json

func show_accessors() returns result<int, JsonError> {
    auto j = use json.parse("{\"user\": \"mux\"}")
    auto fields = use json.to_map(j)
    // stringify gives  "mux"  - with the quotes
    auto encoded = use fields["user"].stringify(none)
    print(encoded)

    // as_string gives  mux
    auto name = use fields["user"].as_string()
    print(name)
    return ok(0)
}

func main() returns void {
    auto result = show_accessors()
    if result.is_err() {
        print(result.error().message())
        return
    }
    return
}
```

Use `stringify` when you want JSON text back out. Use an accessor when you want
the value.

### Pick the accessor by what the field holds

An accessor reports the wrong kind rather than converting, so a number read with
`as_string` is `err("expected a string, found an int")`, not `"36"`. A status
code in a document is a number, so it reads through `as_int`.

An integral float converts: `{"n": 42.0}` reads through `as_int` as `42`. A
fractional one does not - `1.5` is an error rather than silently truncating to
`1` - and neither does a value outside the range of an `int`.

### Lossless numbers

JSON has more valid number spellings and range than a single Mux `int` or
`float` can represent. Parsing keeps ordinary canonical integers and finite
reals in those native forms, but a spelling such as `1e3`, `1.50`, `-0`, or an
integer outside the `int` range is represented by `JsonNumber`. Its original
token is retained exactly, so serializing the document does not rewrite it.

`JsonNumber` provides:

- `to_string() -> string` - the exact source token;
- `as_int() -> result<int, JsonError>` - succeeds only for an exact/integral value
  in the Mux `int` range;
- `as_float() -> result<float, JsonError>` - succeeds only when the token parses
  to a finite Mux `float`.

Use `as_number()` when the spelling itself matters, such as preserving a
decimal scale or an identifier-sized integer. Use `as_int()` or `as_float()`
when you explicitly want a native numeric conversion.

```mux
import std.data.json

func show_number() returns result<int, JsonError> {
    auto document = use json.parse("{\"amount\":1.50}")
    auto fields = use json.to_map(document)
    auto number = use fields["amount"].as_number()
    print(number.to_string())
    return ok(0)
}

func main() returns void {
    auto result = show_number()
    if result.is_err() {
        print(result.error().message())
        return
    }
    return
}
```

## Round-trip fidelity

Parsing a document and serializing it again preserves its **values and their
order**.

**Integers stay integers.** A whole number is not widened to a floating-point
value, so `{"id":42}` comes back as `{"id":42}` and not `{"id":42.0}`. That
matters wherever a receiver is strict about the difference - an HTTP status, a
record id, an array index - and it means values beyond the range a float can
represent exactly keep their value rather than silently rounding to a nearby
one. A number written with a decimal point stays a float.

**Key order is preserved.** Object keys come back in the order the document
listed them rather than sorted, so a re-serialized document reads the way it was
written and diffs stay meaningful. This is the same guarantee Mux's own `map`
gives: printed output does not depend on how a container arranged itself
internally.

**What is not preserved is source formatting.** Insignificant whitespace, the
choice between an escape and a literal character, and other spelling details of
the original text are normalized by serialization. So a round trip is not
byte-for-byte, and re-serialized output is not by itself a canonical form -
signing or byte-comparing it requires a canonicalization step these routines do
not provide.

```mux
import std.data.json

func show_round_trip() returns result<int, JsonError> {
    auto source = "{\"zebra\":1,\"apple\":2,\"id\":9007199254740993}"
    auto document = use json.parse(source)
    // Same key order, and the large integer is unchanged
    auto text = use document.stringify(none)
    print(text)
    return ok(0)
}

func main() returns void {
    auto result = show_round_trip()
    if result.is_err() {
        print("parse failed: " + result.error().message())
        return
    }
    return
}
```
