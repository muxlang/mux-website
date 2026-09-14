---
title: Env
---

# std.env - Environment Utilities

`std.env` exposes fallible access to the process environment.

All operations use `EnvError` for failures. `EnvError.kind` is the typed
`env.EnvErrorKind` enum with `Invalid`, `NotUnicode`, and `Os` variants; compare
or match those variants directly rather than searching display text. `detail`
contains the diagnostic and `key` contains the affected variable name when
available. Use `error.message()` for the detail or `error.to_string()` for a
decorated display string.
`EnvError.from_message(text)` creates an environment error when adapting an
application-level failure to an environment boundary.

- `env.get(string key) -> result<optional<string>, EnvError>` - returns `ok(none)` only when the variable does not exist; invalid names and non-Unicode values are errors.
- `env.set(string key, string value) -> result<void, EnvError>` - sets a process environment variable; invalid names are reported.
- `env.remove(string key) -> result<void, EnvError>` - removes a variable (including a missing variable) idempotently.
- `env.contains(string key) -> result<bool, EnvError>` - checks for a variable and reports values that are not valid UTF-8.
- `env.entries() -> result<list<tuple<string, string>>, EnvError>` - returns all entries sorted by key; invalid Unicode is an error.

Example:

```mux
import std.env

func main() returns void {
    auto path_result = env.get("PATH")
    if path_result.is_err() {
        print("PATH error: " + path_result.error().message())
    } else {
        auto path = path_result.value()
        if path.is_some() {
            print("PATH is set")
        } else {
            print("PATH not set")
        }
    }
    return
}
```
