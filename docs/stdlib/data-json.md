---
title: Data JSON
---

# std.data.json — JSON helpers

`std.data.json` (also exported as `std.json`) gives you explicit JSON parsing and conversion routines for working with Mux `Json` values.

- `data.json.parse(string source) -> result<Json, string>` — parses a JSON string.
- `data.json.from_map(map<string, T>) -> result<Json, string>` — converts a string-keyed map into a `Json` object (generic over values).
- `data.json.to_map(Json value) -> result<map<string, Json>, string>` — extracts an object map if the `Json` value is an object.

## Reading values out of a document

A `Json` value has typed accessors. Each returns an `optional<T>` and answers
`none` when the value is a different kind:

| Accessor | Returns |
| --- | --- |
| `as_string()` | `optional<string>` |
| `as_int()` | `optional<int>` |
| `as_float()` | `optional<float>` |
| `as_bool()` | `optional<bool>` |
| `as_list()` | `optional<list<Json>>` |
| `as_map()` | `optional<map<string, Json>>` |
| `is_null()` | `bool` |

They return an optional rather than a `result` because a field holding a
different kind than you expected is ordinary when reading a document you did not
write - it is control flow, not an error worth reporting.

```mux
import std.data.json

func main() returns void {
    match json.parse("{\"user\": \"mux\", \"age\": 36}") {
        ok(j) {
            match json.to_map(j) {
                ok(fields) {
                    match fields["user"].as_string() {
                        some(name) { print("user=" + name) }
                        none { print("user is not a string") }
                    }
                    match fields["age"].as_int() {
                        some(age) { print("age=" + age.to_string()) }
                        none { print("age is not an int") }
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
                        some(name) { print(name) }
                        none { }
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

An accessor answers `none` for the wrong kind rather than converting, so a
number read with `as_string` is `none`, not `"36"`. A status code in a document
is a number, so it reads through `as_int`.

An integral float converts: `{"n": 42.0}` reads through `as_int` as `42`. A
fractional one does not - `1.5` is `none` rather than silently truncating to
`1` - and neither does a value outside the range of an `int`.
