# Where Clauses

A `where { ... }` clause attaches runtime constraints to a declaration: a braced
block of boolean predicates, comma-separated with optional newlines (a trailing
comma is fine). Every predicate must typecheck as `bool`, and all of them must
hold (they are ANDed).

```mux title="where_basics.mux"
func divide(float a, float b)
    where {
        b != 0.0
    }
    returns float {
    return a / b
}
```

## Placement

| Construct | Position | Checked |
|---|---|---|
| Functions and methods | between the parameter list and `returns` | at entry |
| Lambdas | between the parameter list and `returns` | at entry |
| Class fields | after the field declaration | at `.new()` and on every assignment |
| Classes (invariants) | after the class body's closing brace | at `.new()` and on assignments to referenced fields |
| Interface methods | after the signature | at entry of every implementing method |
| Enum variants | after the payload | at construction |

```mux title="where_placement.mux"
class Server {
    string host where { host.length() < 64 }
    int port = 8080 where { port > 0, port < 65535 }

    func address(int retries) where { retries >= 0 } returns string {
        return self.host + ":" + self.port.to_string()
    }
} where {
    port != 22
}

interface Divider {
    func div(int n) where { n != 0 } returns int
}

enum Status {
    Unknown,
    Code(int value) where { value >= 100, value <= 599 }
}
```

Class-level invariants refer to fields by bare name (`port`, not `self.port`).
Interface preconditions are written against the interface's parameter names and
are enforced by every implementing class, even when the implementation renames
the parameter.

## Violations panic

A failed predicate panics through the unified panic path and points at the
failing predicate:

```text
panic[E0604]: where constraint violated
--> server.mux:3:27
```

## Objects are born valid

Invariants are checked when `.new()` runs, after field defaults are applied.
A constrained field therefore needs a default that satisfies its constraints:
`int port where { port > 0 }` without a default zero-initializes to `0` and
would panic at construction (and, since the violation is provable, is rejected
at compile time - see below).

## Provable violations are compile errors

When the compiler can prove a predicate fails from literal values alone, the
program is rejected at compile time instead of panicking at runtime:

```mux
divide(10.0, 0.0)      // error: arguments to 'divide' violate its where constraint
Status.Code(9999)      // error: arguments to 'Status.Code' violate its where constraint
server.port = 70000    // error: assignment violates where constraint of 'Server.port'
func f(int a) where { 1 > 2 } returns int { ... }
                       // error: where predicate is always false
```

Anything the compiler cannot prove (variables, method calls in predicates,
generic values) stays a runtime check. There are no warnings: a check either
fails compilation because the panic is certain, or it runs at runtime.
