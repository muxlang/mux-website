---
title: Diagnostics
---

# Diagnostics

Mux reports two kinds of compiler diagnostic: errors and warnings. An error
means the program is invalid and compilation stops. A warning means the
program is valid, but the analyzer proved that part of it is redundant,
unreachable, unused, or otherwise likely to be a defect.

Every diagnostic has a stable code. The English message may include names and
types from your source, but the code does not change when that detail changes.
Notes, labels, help text, and fix-its are attached to an error or warning.

## Error and warning codes

The registry is owned by `mux-compiler`. Codes are never reused.

| Code | Kind | Trigger | Example | Fix |
| --- | --- | --- | --- | --- |
| E0100 | Error | Unexpected lexer character | `?` | Remove or replace it |
| E0101 | Error | Unterminated string | `"hello` | Close the string |
| E0102 | Error | Unknown string escape | `"hi\z"` | Use a supported escape |
| E0103 | Error | Unterminated block comment | `/* note` | Add `*/` |
| E0104 | Error | Invalid number literal | `12abc` | Correct or separate it |
| E0105 | Error | Range literal syntax | `0..10` | Use `range(0, 10)` |
| E0106 | Error | Invalid character literal | `'ab'` | Use one character and close it |
| E0200 | Error | Missing parser token | `func main( {` | Add the expected token |
| E0201 | Error | Missing expression | `if { ... }` | Write the expression |
| E0202 | Error | Missing type | `returns` | Add the type |
| E0203 | Error | `break` or `continue` outside a loop | `break` | Move it into a loop |
| E0204 | Error | `return` outside a function | `return 42` | Put it in a function |
| E0205 | Error | Parser recovery reached 100 errors | malformed source | Fix the earliest errors |
| E0300 | Error | Undefined name | `print(missing)` | Declare, import, or rename it |
| E0301 | Error | Duplicate declaration | `auto x = 1` twice | Rename or assign instead |
| E0302 | Error | Type mismatch | `int n = "hello"` | Use a matching type |
| E0303 | Error | Wrong call argument count | `add(1)` | Add or remove arguments |
| E0304 | Error | Missing return on a reachable path | non-void `if` without `else` | Return on every path |
| E0305 | Error | Non-exhaustive match | one arm for many values | Add arms or `_` |
| E0306 | Error | Assignment to a non-assignable value | assigning to `const` | Use a mutable binding |
| E0307 | Error | Unknown field or method | `value.missing()` | Correct the member name |
| E0308 | Error | Invalid operator operands | `true + false` | Use compatible operands |
| E0309 | Error | Invalid match pattern | wrong enum pattern | Match the value's type |
| E0310 | Error | Invalid generic arguments | `list<int, string>` | Use the declared arity |
| E0311 | Error | Read before assignment | `int value` then `print(value)` | Initialize it on every path |
| E0312 | Error | Division or modulo by a provable zero | `10 / 0` | Use a non-zero divisor |
| E0313 | Error | Named nested function captures a local | nested `inner` uses `outer`'s local | Pass it as a parameter or use a lambda |
| E0400 | Error | Module cannot be found | `import missing` | Correct the path or add it |
| E0401 | Error | Imported module cannot be loaded | broken imported file | Fix that module |
| E0600 | Runtime | List index out of bounds | `items[99]` | Use an index in range |
| E0601 | Runtime | Missing map key | `values["missing"]` | Check membership first |
| E0602 | Runtime | Division or modulo by zero | `n / 0` | Use a non-zero divisor |
| E0603 | Runtime | Assertion failure | `assert(false, "bad")` | Fix the failed invariant |
| E0604 | Runtime | Where-constraint violation | invalid constrained value | Satisfy the constraint |
| E0605 | Runtime | Integer overflow | checked arithmetic overflow | Use a safe range or type |
| E0699 | Runtime | Internal runtime failure | runtime invariant failure | Report the complete output |
| E0900 | Error | Internal compiler failure | compiler bug | Report the complete output |
| W0300 | Warning | Unused binding | `auto unused = 1` | Remove it, use it, or write `_` |
| W0301 | Warning | Shadowed binding | inner `auto x` hides outer `x` | Rename the inner binding |
| W0302 | Warning | Unreachable code | after `return` | Remove or move it |
| W0303 | Warning | Dead assignment | `x = 1` then `x = 2` | Remove the overwritten assignment |
| W0305 | Warning | Provably constant condition | `if 1 == 1` | Remove it or use runtime data |
| W0306 | Warning | Safe redundant construct | `value && true` or equivalent | Apply the suggested simplification |

Warning rules are added only when the analyzer can prove the result. Mux does
not use warnings for style preferences, guesses about performance, or ignored
return values. A bare `_` is the intentional unused-binding escape hatch.
`_name` is an ordinary identifier.

`W0300`, `W0301`, and `W0303` are emitted only after successful semantic
analysis. `W0304` is reserved: an actual read before assignment is the error
`E0311`, so the compiler does not downgrade it to a warning.

Runtime failures are terminating diagnostics from the separately built
runtime. They use the `E06xx` registry above and preserve a source location
when the compiler has one.

## `mux explain`

The compiler embeds the same registry used by diagnostics, so code lookup does
not need a network connection:

```text
mux explain E0302
mux explain W0302
```

The command prints the trigger, a small example, why the diagnostic exists,
and the recommended fix. Unknown codes fail with a short command-line error.

## Recovery and output limits

The parser keeps the valid prefix of the AST while it tries to recover after a
syntax error. It continues with independent declarations when that is safe.
Semantic analysis and code generation do not run after a parse failure, so
syntax errors cannot create later code-generation failures.

Mux emits at most 100 diagnostics in one batch. If more are available, the
output ends with an explicit truncation message containing the number omitted.
Diagnostics are sorted by file, source position, severity, and code, so output
is stable across runs.

Code generation never runs when syntax errors remain. Runtime panics are a
separate terminating failure channel and do not receive compiler diagnostic
codes.

## Denying warnings

Pass `--deny-warnings` to keep warning output while making warnings fail the
compile:

```text
mux build app.mux --deny-warnings
```

The check happens before code generation, linking, or running the program.

## `mux fix`

Preview or apply safe compiler edits with:

```text
mux fix app.mux --dry-run
mux fix app.mux
mux fix app.mux --format json
```

`mux fix` applies only machine-applicable edits. Each edit includes a file,
byte range, replacement text, and applicability. The compiler rejects
overlapping edits and edits that touch recovered source. Help text such as
“did you mean” is not treated as an edit. If the current compiler has no
proven safe edit for a diagnostic, the command reports that no fixes are
available and leaves the source unchanged.

Before writing anything, Mux will apply the edits in memory, reparse every
affected module, and run analysis again. Failed validation will leave the
source unchanged and report the proposed edits for inspection. Successful
writes will be atomic and may cover more than one file.

An edit is machine-applicable only when the compiler can prove that it
preserves meaning. Suggestions that need a human decision remain ordinary help
text and are never applied automatically.
