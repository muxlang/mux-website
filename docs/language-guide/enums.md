# Enums / Tagged Unions

Enums in Mux are tagged unions (also called algebraic data types or sum types) that can hold different variants with associated data.

## Basic Enum Definition

```mux title="basic_enum.mux"
enum Status {
    Pending,
    Active,
    Completed
}

enum Shape {
    Circle(float radius),
    Rectangle(float width, float height),
    Square(float size)
}
```

**Key Points:**
- Each variant is a case of the enum
- Variants can carry associated data (or none)
- Every payload field is named, like a function parameter: `Circle(float radius)`

## Creating Enum Instances

A variant is always reached through the enum name, and **parentheses mean
arguments**. A variant with no payload takes none; writing `()` anyway is an
error, not an accepted alias.

```mux title="creating_enums.mux"
// No payload - no parentheses
auto status = Status.Pending

// With a payload
auto circle = Shape.Circle(5.0)
auto rect = Shape.Rectangle(10.0, 20.0)
auto square = Shape.Square(7.5)

// The type is inferred from the enum the variant belongs to
auto myShape = Shape.Circle(5.0)  // Shape
```

Three things are rejected, each with a suggestion:

```mux
auto a = Pending            // ERROR: reach it through the enum: Status.Pending
auto b = Status.Pending()   // ERROR: carries no payload and is not called
auto c = Shape.Circle       // ERROR: needs its arguments: Shape.Circle(5.0)
```

A variant is also not reachable through a *value* of the enum - `myShape.Circle`
is an error suggesting `match` instead.

## Pattern Matching with Enums

Use `match` to handle different enum variants:

```mux title="pattern_matching_enums.mux"
enum Shape {
    Circle(float radius),
    Rectangle(float width, float height),
    Square(float size)
}

auto myShape  = Shape.Circle(5.0)

match myShape {
    Circle(r) {
        auto area = 3.1415 * r * r
        print("Circle area: " + area.to_string())
    }
    Rectangle(w, h) {
        auto area = w * h
        print("Rectangle area: " + area.to_string())
    }
    Square(s) {
        auto area = s * s
        print("Square area: " + area.to_string())
    }
}
```

### Ignoring Associated Data

Use `_` to ignore data you don't need:

```mux title="ignoring_enum_data.mux"
enum Shape {
    Circle(float radius),
    Rectangle(float width, float height),
    Square(float size)
}

auto shape = Shape.Rectangle(10.0, 20.0)
match shape {
    Circle(_) {
        print("It's a circle")  // radius ignored
    }
    Rectangle(width, _) {
        print("Rectangle with width: " + width.to_string())  // height ignored
    }
    Square(size) {
        print("Square with size: " + size.to_string())
    }
}
```

## Pattern Matching with Guards

Add conditional logic with guards:

```mux title="enum_guards.mux"
enum MaybeValue<T> {
    Some(T value),
    None
}

auto value = MaybeValue<int>.Some(42)

match value {
    Some(v) if v > 10 {
        print("Large value: " + v.to_string())
    }
    Some(v) if v > 0 {
        print("Small positive: " + v.to_string())
    }
    Some(v) {
        print("Non-positive: " + v.to_string())
    }
    None {
        print("No value")
    }
}
```

Arms are tried in order, so the guarded arms have to come before the bare one -
`Some(v)` with no guard matches everything the guarded arms would have.

## Generic Enums

An enum can be generic over type parameters. Each instantiation is
monomorphized - `Box<int>` gets its own layout holding a real `int`, not a
boxed pointer - so there is no cost to reaching for one.

```mux title="enum_generics.mux"
enum Box<T> {
    Full(T value),
    Empty
}

enum Pair<A, B> {
    Both(A first, B second),
    Neither
}

func main() returns void {
    Box<int> boxed = Box<int>.Full(42)
    Box<string> named = Box<string>.Full("hello")
    Box<int> nothing = Box<int>.Empty

    match boxed {
        Full(v) { print("holds " + v.to_string()) }
        Empty { print("empty") }
    }

    Pair<int, string> p = Pair<int, string>.Both(1, "one")
    match p {
        Both(n, s) { print(n.to_string() + " = " + s) }
        Neither { print("neither") }
    }
    return
}
```

The type argument has to be concrete at the point of use: `Box<int>.Full(42)`,
not `Box.Full(42)`.

`optional` and `result` are built in and are **not** user enums - you cannot
declare your own type named `optional` or `result`, and you construct them with
`some`, `none`, `ok` and `err` rather than through an enum name. See
[optional Values](#optional-values) below.

## Comparing Enums

Enums compare structurally with `==` and `!=`: same variant, and equal payloads.
The comparison recurses, so nested and recursive enums compare all the way
down. This is the same comparison that lets an enum be a map key or a set
member.

```mux title="comparing_enums.mux"
enum Color { Red, Green, Blue }

enum Shape {
    Circle(float radius),
    Rectangle(float width, float height)
}

func main() returns void {
    print((Color.Red == Color.Red).to_string())                  // true
    print((Color.Red == Color.Blue).to_string())                 // false

    // Payloads participate.
    print((Shape.Circle(5.0) == Shape.Circle(5.0)).to_string())  // true
    print((Shape.Circle(5.0) == Shape.Circle(6.0)).to_string())  // false

    // Which is what makes them usable as keys.
    map<Color, string> names = {:}
    names[Color.Red] = "warm"
    print(names[Color.Red])
    return
}
```

`optional` and `result` compare the same way. There is no ordering for enums -
`<` is not defined on them.

## Enums Have No `to_string()`

`Color.Red.to_string()` is an error, and deliberately so: only you know whether
`HTTPCode.Ok` should render as `"Ok"` or as `"200"`. Write the conversion as a
function and call it:

```mux title="enum_display.mux"
enum HTTPCode { Ok, NotFound, ServerError }

func code_of(HTTPCode c) returns int {
    match c {
        Ok { return 200 }
        NotFound { return 404 }
        ServerError { return 500 }
    }
}

func label_of(HTTPCode c) returns string {
    match c {
        Ok { return "OK" }
        NotFound { return "Not Found" }
        ServerError { return "Server Error" }
    }
}

func main() returns void {
    print(code_of(HTTPCode.NotFound).to_string())   // 404
    print(label_of(HTTPCode.NotFound))              // Not Found
    return
}
```

Exhaustiveness checking makes this safe to extend: adding a variant turns every
such function into a compile error listing what is missing, rather than a
silently wrong default.

## Common Enum Patterns

### optional Values

```mux title="optional_values.mux"
func findFirst(list<int> items, int target) returns optional<int> {
    for int i in range(0, items.size()) {
        if items[i] == target {
            return some(i)
        }
    }
    return none
}

auto result = findFirst([10, 20, 30], 20)

match result {
    some(index) {
        print("Found at index: " + index.to_string())
    }
    none {
        print("Not found")
    }
}
```

### result Types for Error Handling

```mux title="result_types.mux"
func divide(int a, int b) returns result<int, string> {
    if b == 0 {
        return err("division by zero")
    }
    return ok(a / b)
}

auto result = divide(10, 2)

match result {
    ok(value) {
        print("result: " + value.to_string())
    }
    err(error) {
        print("Error: " + error)
    }
}
```

See [Error Handling](./error-handling.md) for more details on result and optional.

### State Machines

```mux title="state_machines.mux"
enum Connection {
    Disconnected,
    Connecting(string address),
    Connected(string address, int port),
    Failed(string error)
}

func handleConnection(Connection conn) returns void {
    match conn {
        Disconnected {
            print("Not connected")
        }
        Connecting(addr) {
            print("Connecting to: " + addr)
        }
        Connected(addr, port) {
            print("Connected to " + addr + ":" + port.to_string())
        }
        Failed(err) {
            print("Connection failed: " + err)
        }
    }
    return
}
```

### Nested Enums

```mux title="nested_enums.mux"
enum Message {
    Text(string content),
    Image(string url, int width, int height),
    Reply(string content, int replyToId)
}

enum Event {
    MessageReceived(Message msg),
    UserJoined(string username),
    UserLeft(string username)
}

auto event = MessageReceived(Text("Hello!"))

match event {
    MessageReceived(msg) {
        match msg {
            Text(content) {
                print("Text: " + content)
            }
            Image(url, w, h) {
                print("Image: " + url)
            }
            Reply(content, id) {
                print("Reply to " + id.to_string() + ": " + content)
            }
        }
    }
    UserJoined(name) {
        print(name + " joined")
    }
    UserLeft(name) {
        print(name + " left")
    }
}
```

## Enums in Collections

```mux title="enums_in_collections.mux"
enum Shape {
    Circle(float radius),
    Rectangle(float width, float height),
    Square(float size)
}

// List of shapes
list<Shape> shapes = [
    Circle(1.0),
    Rectangle(2.0, 3.0),
    Square(4.0)
]

for Shape shape in shapes {
    match shape {
        Circle(r) {
            print("Circle: " + r.to_string())
        }
        Rectangle(w, h) {
            print("Rectangle: " + w.to_string() + "x" + h.to_string())
        }
        Square(s) {
            print("Square: " + s.to_string())
        }
    }
}
```

## Exhaustiveness Checking

Mux enforces exhaustive pattern matching - all variants must be covered:

```mux title="exhaustiveness_checking.mux"
enum Color {
    Red,
    Green,
    Blue
}

// ERROR: Non-exhaustive match (missing Blue)
match color {
    Red { print("red") }
    Green { print("green") }
    // Blue case missing!
}

// Correct: All variants covered
match color {
    Red { print("red") }
    Green { print("green") }
    Blue { print("blue") }
}

// Correct: Using wildcard for catch-all
match color {
    Red { print("red") }
    _ { print("other color") }  // Covers Green and Blue
}
```

## Best Practices

1. **Use enums for mutually exclusive states** - Better than multiple booleans
2. **Match exhaustively** - Don't overuse wildcard patterns
3. **Use guards for additional logic** - Cleaner than nested if statements
4. **Ignore unused data with `_`** - Makes intent explicit
5. **Prefer result over exceptions** - Explicit error handling
6. **Prefer optional over null** - No null pointer errors
7. **Use generic enums for reusable patterns** - Option&lt;T&gt;, result&lt;T, E&gt;

## See Also

- [Error Handling](./error-handling.md) - result and optional types
- [Control Flow](./control-flow.md) - Pattern matching with match
- [Generics](./generics.md) - Generic enums
- [Collections](./collections.md) - Enums in lists and maps
