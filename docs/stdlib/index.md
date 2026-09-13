# Standard Library

The Mux standard library provides cohesive modules for common programming
tasks. APIs are explicit, typed, and consistent with Mux's value and resource
semantics.

The built-in `byte` and `bytes` types are available without an import. `byte`
is one checked octet; `bytes` is a contiguous mutable byte sequence.

## Using the Standard Library

Import standard library modules using the `import` keyword:

```mux title="import_example.mux"
import std.random
import std.datetime

func main() returns void {
    auto roll = random.next_range(1, 7)
    print("You rolled: " + roll.to_string())
    return
}
```

You can import stdlib in multiple forms:

```mux title="stdlib_import_forms.mux"
import std                      // namespace import: std.math, std.io, std.fs, std.random, std.datetime, std.sync, std.net, std.net.http, std.net.url, std.net.tls, std.net.websocket, std.env, std.data, std.data.json, std.data.csv, std.dsa, std.sql, std.process, std.log, std.regex, std.uuid, std.crypto, std.encoding, std.cli
import std.math                 // single module namespace
import std.data.json             // nested module namespace
import std.net.http              // nested module namespace
import std.net.websocket         // WebSocket handshake/frame codec
import std.(math, random as r)  // qualified and selective imports with aliasing
import std.*                    // flat import of all stdlib items
```

## API style

Stdlib APIs keep construction and use explicit. `new()` always returns a
default value or builder and never takes configuration arguments; use a named
`from_*` constructor when a value must be created from parts. Mutable handles
expose their fields directly, and fallible operations use a typed `result` or
`optional`. Use `use` when failure should leave the current function, or inspect
the value when local handling is needed:

```mux
import std.net

func configure_request() returns result<HttpRequest, HttpError> {
    auto request = net.HttpRequest.new()
    request.method = "POST"
    request.url = "https://example.com/data"
    return ok(request)
}
```

Serialization and transport stay separate: encode JSON, form data, or text in
its owning package, then put the resulting `bytes` and explicit headers on a
general request. There are no verb- or format-specific HTTP helper families.
Result and Optional values expose `is_ok()`, `is_err()`, `is_some()`, and
`is_none()` for checked local handling, plus `value()`/`error()` extraction after
a proven variant. `use` keeps sequential fallible code flat.
Removed APIs are not retained as aliases or compatibility shims; use the
current module path and current type directly.

## Available Modules

| Module                                   | Description                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| [math](./math)                           | Mathematical functions and constants                                              |
| [io](./io)                               | Byte streams, standard streams, and bounded reader/writer operations              |
| [fs](./fs)                               | Filesystem-oriented file and directory operations                                 |
| [net](./net)                             | TCP/UDP primitives plus typed HTTP, SSE framing, and WebSocket bindings           |
| [hosted acceptance](./hosted-acceptance) | Runtime CI contracts for service-backed SQL, native hosts, HTTP/3, and OAuth/OIDC |
| [tls](./tls)                             | Verified synchronous TLS client streams                                           |
| [net.url](./url)                         | Validated URLs, components, origins, query pairs, and file URLs                   |
| [sql](./sql)                             | SQL connections, transactions, result sets, and typed SQL values                  |
| [process](./process)                     | Explicit command execution, child handles, captured output, and process metadata  |
| [log](./log)                             | Synchronous structured logging with replaceable default logger                    |
| [regex](./regex)                         | Unicode regular expressions with captures, replacement, and splitting             |
| [uuid](./uuid)                           | Opaque UUID values, parsing, formatting, and RFC 9562 generation                  |
| [crypto](./crypto)                       | Hashing, HMAC, secure random bytes, and authenticated encryption                  |
| [env](./env)                             | Environment inspection and mutation (`env.get`, `env.set`, `env.remove`)          |
| [data.json](./data-json)                 | Mutable JSON parsing, conversion, and serialization helpers                       |
| [data.csv](./data-csv)                   | Dialect-aware CSV parsing, rendering, streaming, and typed mapping                |
| [random](./random)                       | Pseudorandom number generation                                                    |
| [sync](./sync)                           | Threads, locks, channels, coordination, and sleep helpers                         |
| [datetime](./datetime)                   | Typed calendar values, clocks, parsing, formatting, and durations                 |
| [dsa](./dsa)                             | Data structures and algorithms, including balanced trees and graph algorithms     |
| [encoding](./encoding)                   | One-shot and streaming binary, text, and percent codecs                           |
| [cli](./cli)                             | Typed command-line parser builders and returned matches                           |

## Contributing

The standard library is part of the Mux language project. Contributions are welcome! See the [Contributing Guide](https://github.com/muxlang/mux-compiler/blob/main/CONTRIBUTING.md) for guidelines.
