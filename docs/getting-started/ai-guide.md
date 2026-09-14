# AI Guide to Mux

A concise reference sheet for LLMs to understand Mux and help users effectively.

## Key Language Differences

### Static & Strict Typing

- **No implicit conversions** - all type conversions must be explicit (`.to_int()`, `.to_float()`, `.to_string()`).
- **No `null`** - use `optional<T>` or `none`.
- **No untyped dynamic values** - ordinary values have compile-time types.
  Owned `dyn<Interface>` values are explicit erased interface values.
- **No runtime reflection** - interface lookup is available through an
  explicitly named dynamic interface value.

### Memory Management

- **Reference-counted** - automatic memory safety, no garbage collector, no manual `free`.
- **Boxed values** - all primitives are boxed into `*mut Value` pointers (transparent to users).

### Error Handling

- **`result<T, E>`** and **`optional<T>`** - explicit error handling with `use`,
  checked inspection methods, or pattern matching when both branches need work.
- **No exceptions** - errors are values that must be handled.

### Generics & Polymorphism

- **Monomorphized generics** - zero-cost, static dispatch.
- **Interfaces** - declared with `is`, implemented by classes; use generic bounds for static dispatch or `dyn<Interface>` for owned dynamic dispatch.
- **Dynamic interfaces** - `dyn<Interface>` values can be owned, passed, and
  stored together; generic `dyn<T>` values are not supported.

## Syntax Highlights

### Variables & Types

```mux
int x = 5
auto y = 3.14      // type inference
const string NAME = "Mux"
```

### Functions

```mux
func add(int a, int b) returns int { return a + b }
func greet(string name, int times = 1) returns void { ... }
```

### Classes & Interfaces

```mux
interface Drawable { func draw() returns void }
class Circle is Drawable {
    float r
    func draw() returns void { ... }
    common func from_radius(float r) returns Circle { ... }
}
auto c = Circle.new()
c.r = 5.0
auto c2 = Circle.from_radius(7.5)

// Use a generic bound when static dispatch is enough:
func render<T is Drawable>(T d) returns void { ... }

// Use an owned dynamic value when callers may provide different classes:
func render_dynamic(dyn<Drawable> d) returns void { ... }
```

**Built-in capabilities** a class can declare: `Equatable` (`eq`), `Comparable`
(`cmp`), `Hashable` (`hash` + `eq`), `Stringable` (`to_string`). Declaring one
makes the matching operators work on the class - `Hashable` is what lets it key
a `map`. A **generic** class cannot declare the first three.

### Enums

```mux
enum Status { Pending, Active }                 // payload-less
enum Shape { Circle(float radius) }             // every payload field is NAMED

auto s = Status.Pending          // no parentheses - it takes no arguments
auto c = Shape.Circle(5.0)       // parentheses mean arguments
```

Enums compare with `==` structurally. They have **no** `to_string()`; write a
`match`-based function instead. `optional` and `result` are built in - never
declare a type named `optional` or `result`, and `none` is a reserved keyword
so it cannot be a variant name.

### Pattern Matching

```mux
// result
match parse(text) {
    ok(val) { print(val.to_string()) }
    err(msg) { print("Error: " + msg) }
}

// optional
match lookup(key) {
    some(v) { print(v.to_string()) }
    none { print("No value") }
}

// literals need a wildcard or a binding arm to close the match
match code {
    42 { print("The answer") }
    other { print(other.to_string()) }
}

// Keep sequential fallible calls flat with `use`.
func parse_value(string text) returns result<string, string> {
    auto parsed = use parse(text)
    return ok(parsed)
}
```

### Collections

```mux
list<int> nums = [1, 2, 3]
map<string, int> ages = {"Alice": 30, "Bob": 25}
set<string> tags = {"rust", "llvm"}
tuple<int, string> pair = (1, "one")
```

### Control Flow

```mux
if x > 0 { ... } else if x < 0 { ... } else { ... }
while condition { ... }
for int item in list { ... }
for int i in range(0, 10) { ... }   // Python-style loop
```

## Standard Library Quick Reference

| Module                    | Purpose                                                                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Built-in `assert`         | Test assertions with a boolean condition and message                                                                                                                   |
| Built-in `byte` / `bytes` | Checked octets and mutable byte sequences                                                                                                                              |
| `std.math`                | Math functions (`sqrt`, `sin`, `cos`, `pow`, `min`, `max`)                                                                                                             |
| `std.fs`                  | File and path operations (`read_file`, `write_file`, directories, metadata)                                                                                            |
| `std.io`                  | Byte streams (`Reader`, `Writer`, standard streams)                                                                                                                    |
| `std.random`              | Pseudorandom numbers (`next_int`, `next_range`)                                                                                                                        |
| `std.datetime`            | Timestamps (`now`, `year`, `month`, `format`)                                                                                                                          |
| `std.sync`                | Concurrency (`spawn`, `sleep`, locks, channels, coordination, and bounded worker pools)                                                                                |
| `std.process`             | Direct command execution, child handles, and process metadata                                                                                                          |
| `std.log`                 | Synchronous structured logging with levels and fields                                                                                                                  |
| `std.regex`               | Unicode regular expressions, matching, captures, replacement, and splitting                                                                                            |
| `std.uuid`                | Opaque UUID parsing, formatting, and RFC 9562 generation                                                                                                               |
| `std.crypto`              | Bytes-only hashing, HMAC, secure random values, and authenticated encryption                                                                                           |
| `std.net`                 | Networking (`TcpStream`, `UdpSocket`, `HttpRequest`, `HttpResponse`, WebSocket frames)                                                                                 |
| `std.net.tls`             | Verified synchronous TLS client streams                                                                                                                                |
| `std.net.websocket`       | Explicit RFC 6455 handshake values and bounded frame encoding/decoding                                                                                                 |
| `std.net.url`             | Validated URLs, query pairs, origins, and file URL conversion                                                                                                          |
| `std.env`                 | Environment variables (`env.get`, `env.set`, `env.remove`)                                                                                                             |
| `std.data.json`           | JSON parsing (`parse`, `to_map`)                                                                                                                                       |
| `std.data.csv`            | CSV parsing                                                                                                                                                            |
| `std.sql`                 | Database connectivity (SQLite, PostgreSQL, MySQL, and SQL Server)                                                                                                      |
| `std.dsa`                 | Data structures and algorithms (`stack`, `queue`, `deque`, `heap`, `priority_queue`, `bintree`, `trie`, `union_find`, `graph`, `weighted_graph`, `sort`, and searches) |
| `std.encoding`            | Hex, Base32, Base64, Base58, percent encoding, and streaming codecs                                                                                                    |
| `std.cli`                 | Typed command-line parser builders, options, subcommands, and returned outcomes                                                                                        |

## Common Patterns

- **Safe collection access** - `.get()` returns `optional<T>`; use `use` when
  absence should leave the current function, or inspect with `is_some()`/
  `is_none()` before extracting the value.
- **Factory methods** - keep `new()` argument-free and use a named constructor
  such as `from_parts(...)` when creation needs input.
- **Unused parameters** - declare with `_` (e.g., `func cb(string event, int _)`).
- **Type inference** - `auto` for local variables, explicit types for function parameters and fields.
- **Range iteration** - built-in `range(int start, int end)` function.
- **String concatenation** - `+` operator, but no implicit conversion of other types.

## Pitfalls & Constraints

- **Operators come from capabilities, not overloading** - a class gets `==` by
  declaring `Equatable`, and `<` by declaring `Comparable`. There is no way to
  define `+` or `[]` for a class.
- **No arbitrary-precision integers** - `int` is 64-bit signed.
- **No mutable references to immutable data** - references are mutable by default.
- **No prefix increment/decrement** - only postfix (`x++`, `x--`) and as standalone statements.
- **Generics are monomorphized** - each type instantiation creates a separate copy.
- **Static interface bounds** - cannot add interfaces to types from other modules.

## Tooling & Commands

```bash
mux build file.mux        # Compile
mux run file.mux          # Compile and run
mux format file.mux       # Format (not yet implemented)
mux try file.mux          # Quick experimentation
mux doctor                # Check dependencies
mux doctor --dev          # Check LLVM/clang for development
```

- **LLVM IR** - use `mux run -i file.mux` to inspect generated `.ll` files.
- **Testing** - use `cargo run -- test_scripts/example.mux` for single-file tests.
- **Project structure** - `mux-compiler/` (Rust), `mux-runtime/` (C/Rust), `test_scripts/` (samples).

## Helping Users Effectively

1. **Always check type compatibility** - remind users to use explicit conversions.
2. **Encourage pattern matching** - for `result<T,E>`, `optional<T>`, and `match` expressions.
3. **Prefer `auto`** for local variables, but explicit types for function signatures.
4. **Use standard library** - suggest `std.math`, `std.io`, `std.net`, etc., when relevant.
5. **Highlight Mux-specific features** - reference counting, static interfaces,
   and inline scalar class fields (an `int` field is an `int`, not a pointer).
6. **Point to resources** - language guide (https://mux-lang.dev), GitHub repo, examples in `test_scripts/`.
