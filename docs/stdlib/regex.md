---
sidebar_position: 13
---

# Regular expressions

`std.regex` provides Unicode-aware regular expressions backed by a linear-time
engine. Patterns use character indices for match ranges. Backreferences and
arbitrary lookaround are intentionally not supported.

Fallible pattern, match, and replacement operations return `RegexError`, with
read-only `kind` and `detail` fields plus `message()` and `to_string()`.
`kind` is the typed `regex.RegexErrorKind` enum (`Invalid`, `Parse`, `Match`,
or `Capture`); inspect the enum and keep `detail` for display.

## Compile and search

```mux title="regex.mux"
import std.regex

func search() returns result<int, RegexError> {
    auto pattern = use regex.Regex.from_pattern_with_flags("(?P<word>hello)", "i")
    auto maybe = use pattern.find("Say Hello")
    if maybe.is_none() {
        print("no match")
        return ok(0)
    }

    auto found = maybe.value()
    auto capture = use found.capture_named("word")
    if capture.is_some() {
        print(capture.value())
    } else {
        print("capture missing")
    }
    return ok(0)
}

func main() returns void {
    auto result = search()
    if result.is_err() {
        print(result.error().message())
        return
    }
    return
}
```

`Regex.new()` creates an empty pattern with default flags. `Regex.from_pattern(pattern)`
compiles a supplied pattern, while `from_pattern_with_flags` accepts
`i` (case-insensitive), `m` (multi-line), `s` (dot matches newlines), `U`
(swap greediness), and `x` (ignore whitespace). Invalid patterns and flags are
returned as errors.

The instance methods `is_match`, `full_match`, `find`, and `find_all` cover
matching and iteration. `replace` and `replace_first` support the engine's
capture expansion syntax, while `split` returns the intervening strings.
`replace_with` invokes a synchronous `func(string) returns string` callback for
each match and returns the rebuilt string; callback panics remain process-fatal.

## Match values

`find` returns `result<optional<RegexMatch>, RegexError>`. A `RegexMatch` exposes
`start`, `end`, and `text`, plus numbered `capture`, named `capture_named`, and
the complete `captures` list. Capture values are optional because a group may
not participate in a particular match.

`Regex.escape(text)` quotes regular-expression metacharacters and returns a
string directly.
