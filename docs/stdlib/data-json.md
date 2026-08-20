---
title: Data JSON
---

# std.data.json — JSON helpers

`std.data.json` (also exported as `std.json`) gives you explicit JSON parsing and conversion routines for working with Mux `Json` values.

- `data.json.parse(string source) -> result<Json, string>` — parses a JSON string.
- `data.json.from_map(map<string, T>) -> result<Json, string>` — converts a string-keyed map into a `Json` object (generic over values).
- `data.json.to_map(Json value) -> result<map<string, Json>, string>` — extracts an object map if the `Json` value is an object.

## Reading values out of a document

A `Json` value has typed accessors. Each returns a `result<T, string>`, and the
error names what was actually there:

| Accessor | Returns |
| --- | --- |
| `as_string()` | `result<string, string>` |
| `as_int()` | `result<int, string>` |
| `as_float()` | `result<float, string>` |
| `as_bool()` | `result<bool, string>` |
| `as_list()` | `result<list<Json>, string>` |
| `as_map()` | `result<map<string, Json>, string>` |
| `is_null()` | `bool` |

They return a `result` rather than an `optional` because "not an int" is worth
saying *why*. A bare `none` leaves you unable to tell a string from a null from
something else - exactly the information you need when a document is not the
shape you expected:

```
expected an int, found a string
```

That matters most in the escape hatch, where you are deliberately reading data
whose shape you could not declare. For a document you *can* describe, prefer
[parsing straight into a class](../language-guide/classes.md) - the error there
names the field as well.

```mux
import std.data.json

func main() returns void {
    match json.parse("{\"user\": \"mux\", \"age\": 36}") {
        ok(j) {
            match json.to_map(j) {
                ok(fields) {
                    match fields["user"].as_string() {
                        ok(name) { print("user=" + name) }
                        err(e) { print("user: " + e) }
                    }
                    match fields["age"].as_int() {
                        ok(age) { print("age=" + age.to_string()) }
                        err(e) { print("age: " + e) }
                    }
                }
                err(e) { print("not object: " + e) }
            }
        }
        err(e) { print("parse failed: " + e) }
    }
    return
}
```

### `stringify` is not an accessor

`stringify` returns the JSON **encoding** of a value, which for a string
includes its quotes:

```mux
import std.data.json

func main() returns void {
    match json.parse("{\"user\": \"mux\"}") {
        ok(j) {
            match json.to_map(j) {
                ok(fields) {
                    // stringify gives  "mux"  - with the quotes
                    match fields["user"].stringify(none) {
                        ok(encoded) { print(encoded) }
                        err(e) { print(e) }
                    }

                    // as_string gives  mux
                    match fields["user"].as_string() {
                        ok(name) { print(name) }
                        err(e) { print(e) }
                    }
                }
                err(e) { print(e) }
            }
        }
        err(e) { print(e) }
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

func main() returns void {
    auto source = "{\"zebra\":1,\"apple\":2,\"id\":9007199254740993}"
    match json.parse(source) {
        ok(document) {
            match document.stringify(none) {
                // Same key order, and the large integer is unchanged
                ok(text) { print(text) }
                err(e) { print(e) }
            }
        }
        err(e) { print("parse failed: " + e) }
    }
    return
}
```
