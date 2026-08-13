---
title: Data JSON
---

# std.data.json — JSON helpers

`std.data.json` (also exported as `std.json`) gives you explicit JSON parsing and conversion routines for working with Mux `Json` values.

- `data.json.parse(string source) -> result<Json, string>` — parses a JSON string.
- `data.json.from_map(map<string, T>) -> result<Json, string>` — converts a string-keyed map into a `Json` object (generic over values).
- `data.json.to_map(Json value) -> result<map<string, Json>, string>` — extracts an object map if the `Json` value is an object.

## Round-trip fidelity

Parsing a document and serializing it again returns what you started with.

**Integers stay integers.** A whole number is not widened to a floating-point
value, so `{"id":42}` comes back as `{"id":42}` and not `{"id":42.0}`. That
matters wherever a receiver is strict about the difference - an HTTP status, a
record id, an array index - and it means values beyond the range a float can
represent exactly keep their value rather than silently rounding to a nearby
one. A number written with a decimal point stays a float.

**Key order is preserved.** Object keys come back in the order the document
listed them rather than sorted, so re-serializing produces a byte-identical
document, diffs stay meaningful, and a canonical form you signed still matches.
This is the same guarantee Mux's own `map` gives: printed output does not depend
on how a container arranged itself internally.

Example:

```mux
import std.data.json

func main() returns void {
    match json.parse("{\"user\": \"mux\"}") {
        ok(j) {
            match json.to_map(j) {
                ok(map) {
                    match map["user"].stringify(none) {
                        ok(s) { print("user=" + s) }
                        err(e) { print("stringify error: " + e) }
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
