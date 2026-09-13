# Math Module

The `math` module provides common floating-point math functions and constants.
Checked operations return `MathError`, with read-only `kind` and `detail`
fields plus `message()` and `to_string()`.

## Import

```mux
import std.math
```

## Constants

- `math.pi` returns `float`
- `math.e` returns `float`

## Unary Functions

All unary math functions take one `float` and return a `float`:

- `math.sqrt(x)`
- `math.sin(x)`
- `math.cos(x)`
- `math.tan(x)`
- `math.asin(x)`
- `math.acos(x)`
- `math.atan(x)`
- `math.ln(x)`
- `math.log2(x)`
- `math.log10(x)`
- `math.exp(x)`
- `math.abs(x)`
- `math.floor(x)`
- `math.ceil(x)`
- `math.round(x)`
- `math.trunc(x)`
- `math.fract(x)`
- `math.sinh(x)`
- `math.cosh(x)`
- `math.tanh(x)`
- `math.asinh(x)`
- `math.acosh(x)`
- `math.atanh(x)`
- `math.to_radians(x)`
- `math.to_degrees(x)`
- `math.exp2(x)`
- `math.exp_m1(x)` (computes `exp(x) - 1` accurately near zero)
- `math.ln_1p(x)`
- `math.cbrt(x)`
- `math.signum(x)`
- `math.erf(x)`
- `math.gamma(x)`

Sequence reductions take `list<float>` and return `result<float, MathError>`.
`math.sum(values)` uses Neumaier compensation; `math.product(values)` retains
the rounding error of each finite multiplication. Empty inputs use the usual
identities (`0.0` and `1.0`). A non-float element is reported as an error.

Classification helpers return `bool`: `math.is_nan(x)`,
`math.is_infinite(x)`, and `math.is_finite(x)`.

Integer helpers take and return `int`: `math.gcd(a, b)`, `math.lcm(a, b)`,
and `math.isqrt(x)`. `isqrt` returns zero for non-positive inputs; overflowing
integer results saturate at the largest representable `int`.

## Binary Functions

All binary math functions take two `float` values and return a `float`:

- `math.atan2(y, x)`
- `math.log(x, base)`
- `math.min(a, b)`
- `math.max(a, b)`
- `math.hypot(a, b)`
- `math.pow(base, exp)`

## Interpolation and Integer Helpers

- `math.clamp(value, lower, upper)` returns the value limited to the inclusive
  range. Reversed bounds are normalized; `math.clamp_checked` reports them as
  an error instead.
- `math.lerp(start, end, amount)` linearly interpolates without restricting
  `amount` to `0..1`.
- `math.inverse_lerp(start, end, value)` returns a `result<float, MathError>` and
  rejects equal endpoints.
- `math.smoothstep(edge0, edge1, value)` returns a clamped cubic interpolation
  and rejects non-increasing edges.
- `math.factorial(n)`, `math.combinations(n, k)`, and
  `math.permutations(n, k)` return `result<int, MathError>` and report negative,
  out-of-range, or overflowing inputs.

## Example

```mux title="math_example.mux"
import std.math

func main() returns void {
    auto radius = 5.0
    auto area = math.pi * math.pow(radius, 2.0)
    auto angle = math.atan2(1.0, 1.0)
    auto rounded = math.round(area)

    print("area: " + area.to_string())
    print("angle: " + angle.to_string())
    print("rounded: " + rounded.to_string())
    return
}
```
