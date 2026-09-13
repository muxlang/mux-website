---
title: UUID
---

# `std.uuid`

`std.uuid` provides opaque 128-bit UUID values. Formatting and byte conversion
are explicit, and generated UUIDs never read a machine MAC address.

`UuidError.kind` is the typed `uuid.UuidErrorKind` enum with `Invalid`, `Parse`,
and `NotUnicode` variants. Compare or match those variants directly; use
`message()` or `to_string()` for display text.

| Function or method                               | Signature                                 | Description                                                             |
| ------------------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------- |
| `uuid.parse_uuid(text)`                          | `string -> result<Uuid, UuidError>`       | Parse canonical, compact, braced, or URN text.                          |
| `Uuid.from_bytes(value)`                         | `bytes -> result<Uuid, UuidError>`        | Parse exactly 16 octets.                                                |
| `Uuid.nil()` / `Uuid.max()`                      | `() -> Uuid`                              | Construct the nil or all-ones value.                                    |
| `Uuid.v1()` / `Uuid.v6()`                        | `() -> Uuid`                              | Generate timestamp UUIDs with a private multicast-marked process node.  |
| `Uuid.v3(ns, name)` / `Uuid.v5(ns, name)`        | `Uuid, string -> result<Uuid, UuidError>` | Generate namespace UUIDs using MD5 or SHA-1.                            |
| `Uuid.v4()`                                      | `() -> Uuid`                              | Generate a random UUID.                                                 |
| `Uuid.v7()`                                      | `() -> Uuid`                              | Generate a time-sortable UUID with process-local monotonic ordering.    |
| `Uuid.v8(bytes)`                                 | `bytes -> result<Uuid, UuidError>`        | Construct a custom UUID from exactly 16 octets.                         |
| `uuid.to_string()`                               | `() -> string`                            | Canonical lowercase hyphenated form.                                    |
| `uuid.to_compact()` / `to_braced()` / `to_urn()` | `() -> string`                            | Explicit alternate formats.                                             |
| `uuid.to_bytes()`                                | `() -> bytes`                             | Return the 16-byte representation.                                      |
| `uuid.to_parts()`                                | `() -> tuple<int, int>`                   | Return the high and low 64-bit words as bit-preserving signed integers. |
| `uuid.version()`                                 | `() -> optional<int>`                     | Return the UUID version when recognized.                                |
| `uuid.variant()`                                 | `() -> string`                            | Return `ncs`, `rfc4122`, `microsoft`, or `future`.                      |
| `uuid.is_nil()` / `uuid.is_max()`                | `() -> bool`                              | Test sentinel values.                                                   |

```mux
import std.uuid

func run_uuid() returns result<int, UuidError> {
    auto generated = uuid.Uuid.v7()
    print(generated.to_string())
    print(generated.to_bytes().size().to_string())
    auto parsed = use uuid.parse_uuid(generated.to_urn())
    print((parsed.to_string() == generated.to_string()).to_string())
    return ok(1)
}

func main() returns void {
    auto result = run_uuid()
    if result.is_err() {
        print(result.error().message())
    }
    return
}
```
