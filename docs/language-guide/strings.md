# Strings

A Mux string is a sequence of **characters**, not bytes. Everything that
positions a string - its length, an index, a slice, the result of `index_of` -
counts characters, so a string behaves like a list of `char` and the same
operations work on both.

```mux title="string_positions.mux"
// The accented character is deliberate: it takes two bytes and one character,
// which is the whole distinction being shown here.
auto plain = "hello"
auto accented = "héllo"

print(plain.length().to_string())      // 5
print(accented.length().to_string())   // 5, not 6
```

`héllo` occupies six bytes and five characters. Reporting six would make
`accented[4]` an error on a string that plainly has five characters in it, so
`length` counts what you can index.

The cost is worth knowing: because characters vary in width, `length` walks the
string rather than reading a stored count. It is O(n), not O(1). Take it once
into a variable rather than calling it inside a loop condition.

## Indexing

Indexing yields a `char`, and negative indices count back from the end - the
same rule lists follow.

```mux title="string_indexing.mux"
auto s = "Hello"

print(s[0].to_string())    // "H"
print(s[-1].to_string())   // "o"
```

Reading past either end is a runtime error. There is a single character at a
position or there is not.

## Slicing

Slicing takes a range of positions and returns a new string. The bounds are
half-open: `[0:5]` takes positions 0 through 4.

```mux title="string_slicing.mux"
auto s = "Hello, World"

print(s[0:5])     // "Hello"
print(s[7:])      // "World"
print(s[:5])      // "Hello"
print(s[-5:])     // "World"
```

Either bound may be omitted and defaults to that end. Out-of-range bounds clamp
rather than fail, unlike indexing - a slice asks what is in a range, and an
empty answer is a real one.

## Taking a string apart

```mux title="string_methods.mux"
auto s = "Hello, World"

print(s.to_upper())                  // "HELLO, WORLD"
print(s.to_lower())                  // "hello, world"
print(s.trim())                      // "Hello, World" (no surrounding space)

print(s.starts_with("Hello").to_string())  // "true"
print(s.ends_with("World").to_string())    // "true"
print(s.index_of("World").to_string())     // "7"

print(s.replace("World", "Mux"))     // "Hello, Mux"
print(s.split(", ").to_string())     // [Hello, World]
```

`index_of` returns a **character** offset, not a byte offset, so it can be fed
straight back into an index or a slice:

```mux title="index_of_roundtrip.mux"
auto s = "name=value"
auto cut = s.index_of("=")
auto key = s[:cut]        // "name"
auto val = s[cut + 1:]    // "value"
```

## Iterating

A string converts to a list of characters with `to_list`, and a `for` loop over
a string walks its characters directly.

```mux title="string_iteration.mux"
auto s = "hey"

for char c in s {
    print(c.to_string())   // "h", "e", "y"
}

auto chars = s.to_list()   // list<char>
```

Printing a `list<char>` shows the code point of each character rather than the
character itself, because that is how a `char` renders inside a collection:

```mux title="char_list_display.mux"
print("héllo".to_list().to_string())   // [104, 233, 108, 108, 111]
```

Those are the code points of `h é l l o`. Print the string itself, or a single
`char` with `.to_string()`, when you want the characters.

## Building strings

`+` concatenates, and every type with a `to_string` can join a string that way.

```mux title="string_building.mux"
auto name = "Ada"
auto age = 36

auto line = name + " is " + age.to_string()
```

There is no implicit conversion: `name + age` does not compile. The `to_string`
call is the conversion, written where it happens.

## See Also

- [Types](types.md) - `char`, and converting between types
- [Collections](collections.md) - lists, and the slicing rules strings share with them
