---
title: Data JSON
---

# std.data.json — JSON helpers

`std.data.json` (also exported as `std.json`) gives you explicit JSON parsing and conversion routines for working with Mux `Json` values.

- `data.json.parse(string source) -> result<Json, string>` — parses a JSON string.
- `data.json.from_map(map<string, T>) -> result<Json, string>` — converts a string-keyed map into a `Json` object (generic over values).
- `data.json.to_map(Json value) -> result<map<string, Json>, string>` — extracts an object map if the `Json` value is an object.

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
