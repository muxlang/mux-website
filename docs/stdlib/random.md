# Random Module

The `random` module provides pseudorandom number generation for Mux programs. It uses a time-based seed by default, but can be manually seeded for reproducible results.

## Import

```mux
import std.random
```

## Functions

Fallible generation and collection operations return `RandomError`, with
read-only `kind` and `detail` fields plus `message()` and `to_string()`.

## Independent generators

Use `Random.seeded` for a reproducible generator that is independent of the
module-level state, or `Random.system` for a generator seeded from system
entropy and the process clock. Seeded generators use a specified SplitMix64
sequence, so the same seed has the same results on every supported platform.

```mux title="random_object.mux"
import std.random

func main() returns void {
    auto first = random.Random.seeded(42)
    auto second = random.Random.seeded(42)
    print(first.next_range(1, 7).to_string())
    print(second.next_range(1, 7).to_string())
    first.normal(0.0, 1.0)
    first.bytes(4)
    return
}
```

`Random` values are explicit shared generators: copying one shares its stream.
The object API covers integer, range, float, boolean, byte, normal, and
exponential generation. Collection operations are available as module
functions below and use the module's thread-local generator.

The module also provides collection operations:

- `random.choose(list<T>) -> optional<T>` returns none for an empty list.
- `random.shuffle(list<T>) -> void` applies Fisher-Yates in place.
- `random.sample(list<T>, int count) -> result<list<T>, RandomError>` samples without replacement.
- `random.weighted_choice(list<T>, list<float>) -> result<T, RandomError>` validates finite, non-negative weights.

`weighted_choice` also rejects a total weight that overflows to infinity; the
total must remain finite and positive.

### random.seed

```text
random.seed(int seed) returns void
```

Initialize the random number generator with a specific seed. Use this when you need reproducible random sequences, such as in testing or simulations.

```mux title="seed_example.mux"
import std.random

func main() returns void {
    // Seed for reproducible results
    random.seed(12345)

    auto a = random.next_int()

    // Same seed produces same sequence
    random.seed(12345)
    auto b = random.next_int()

    // a and b will be equal
    print(a.to_string())
    return
}
```

### random.next_int

```text
random.next_int() returns int
```

Generate a random integer between 0 and `2,147,483,647` (inclusive).

The generator auto-initializes with the current time on first use if not explicitly seeded.

```mux title="dice_roll.mux"
import std.random

func roll_die() returns int {
    // Random number from 1 to 6
    return random.next_range(1, 7)
}

func main() returns void {
    auto roll = roll_die()
    print("You rolled a " + roll.to_string())
    return
}
```

### random.next_range

```text
random.next_range(int min, int max) returns int
```

Generate a random integer in the range [min, max). The lower bound is inclusive, the upper bound is exclusive.

Returns `min` if `min >= max`.

```mux title="lottery_numbers.mux"
import std.random

func generate_lotto_numbers() returns list<int> {
    list<int> numbers = []

    for int _ in range(0, 6) {
        // Numbers from 1 to 49
        auto num = random.next_range(1, 50)
        numbers.push_back(num)
    }

    return numbers
}

func main() returns void {
    auto lotto = generate_lotto_numbers()
    print("Your lottery numbers:")
    for int num in lotto {
        print(num.to_string())
    }
    return
}
```

### random.next_float

```text
random.next_float() returns float
```

Generate a random floating-point number in the range [0.0, 1.0).

Useful for probabilities, animations, and scientific calculations.

```mux title="probability_example.mux"
import std.random

func should_event_occur(float probability) returns bool {
    auto roll = random.next_float()
    return roll < probability
}

func main() returns void {
    // 30% chance of rare event
    if should_event_occur(0.3) {
        print("Rare event occurred!")
    } else {
        print("Nothing special happened.")
    }
    return
}
```

### random.next_bool

```text
random.next_bool() returns bool
```

Generate a random boolean value (true or false) with equal probability (50/50).

```mux title="coin_flip.mux"
import std.random

func flip_coin() returns string {
    if random.next_bool() {
        return "Heads"
    }
    return "Tails"
}

func main() returns void {
    auto result = flip_coin()
    print("Coin flip result: " + result)
    return
}
```

### random.bytes

```text
random.bytes(int length) returns result<bytes, RandomError>
```

Generate `length` pseudorandom bytes from the module generator. A negative
length is returned as an error rather than being converted to a huge
allocation. Seed the module first when deterministic bytes are required.

```mux title="random_bytes.mux"
import std.random

func main() returns void {
    random.seed(42)
    auto result = random.bytes(16)
    if result.is_err() {
        print(result.error().message())
        return
    }
    auto data = result.value()
    print(data.size().to_string())
    return
}
```

### random.normal and random.exponential

```text
random.normal(float mean, float standard_deviation) returns result<float, RandomError>
random.exponential(float rate) returns result<float, RandomError>
```

`normal` uses a Box-Muller draw and requires a finite, non-negative standard
deviation. `exponential` requires a finite, positive rate. Invalid parameters
are returned as errors; a zero normal deviation returns the mean.

## Complete Example

```mux title="random_demo.mux"
import std.random

func main() returns void {
    // Seed for reproducible output
    random.seed(42)

    print("=== Random Number Demo ===")

    // Generate some random integers
    print("Random integers:")
    for int i in range(0, 5) {
        auto num = random.next_int()
        print(num.to_string())
    }

    // Generate random numbers in range
    print("\nRandom numbers (1-100):")
    for int i in range(0, 5) {
        auto num = random.next_range(1, 101)
        print(num.to_string())
    }

    // Generate random floats
    print("\nRandom floats:")
    for int i in range(0, 3) {
        auto f = random.next_float()
        print(f.to_string())
    }

    // Generate random booleans
    print("\nRandom booleans:")
    for int i in range(0, 5) {
        auto b = random.next_bool()
        print(b.to_string())
    }
    return
}
```

## Implementation Details

The random module uses a custom Linear Congruential Generator (LCG) with the following characteristics:

- **Thread safety**: Module shortcuts use one independent state per thread
- **Auto-initialization**: Seeds automatically with current time if not explicitly seeded
- **Range distribution**: `next_range` scales the generator's output by the span with a fixed-point multiply. It is intended for simulation and application randomness, not cryptographic use
- **Float precision**: Independent `Random` objects produce 53 bits of precision

Independent seeded `Random` objects use SplitMix64 instead of the module LCG so
their sequences are portable and reproducible.

For cryptographic applications or high-precision simulations, consider using a specialized library.
