---
sidebar_position: 16
---

# Testing

Mux test blocks are named, top-level blocks:

```mux
test "adds numbers" {
    auto total = 1 + 2
    assert(total == 3, "addition result mismatch")
}
```

The built-in `assert` always takes a boolean condition and a message. It panics
immediately when the condition is false, making failed invariants visible in
the test output. Use ordinary comparisons and optional/result inspection
methods such as `is_some()` or `is_ok()` to form the condition; there is no
assertion package to import.

The body uses ordinary Mux statements and standard-library helpers. Test blocks
are omitted from normal application builds; they are collected and run by the
`mux test` command. Keep setup in regular functions so it can be shared by
multiple named tests.

Run tests from a project containing `tests/**/*.mux`, or pass source files
explicitly:

```text
mux test
mux test tests/math.mux --filter addition --jobs 1
mux test --format json > test-results.json
mux test --tag integration
mux test --coverage
```

The runner starts each named test in its own process, runs tests concurrently
by default, and applies a 60-second timeout (override it with `--timeout`).
Human, JSON, and JUnit output formats are available.

Pass `--coverage` to instrument the generated test programs and write a merged
`lcov.info` report. The report includes statement and branch records for the
original Mux files, including imported functions. Coverage is opt-in, so normal
builds and test runs stay uninstrumented.

Instrumented sites are recorded separately from runtime hits, so unvisited
statements and branch outcomes remain visible in LCOV with zero coverage.
Runtime hit counts are aggregated by source site, so looping does not grow the
coverage file. Each test process writes its counts at normal exit. A missing
completion marker, such as after a crash or failed write, makes coverage
collection fail rather than publish an incomplete report.

An optional annotation immediately above a test can override its timeout and
attach filtering/reporting tags:

```mux
// mux:test timeout=5 tags=integration,slow
test "talks to the service" {
    return
}
```

Annotation values use `key=value` syntax. `timeout` is in seconds and must be
positive; tags contain letters, numbers, `_`, or `-`. `--tag` selects tests
carrying an exact tag.

Test names are quoted and must be non-empty. A test block cannot be nested in
a function, class, or another block.
