# Datetime Module

The `datetime` module provides Unix timestamp utilities, calendar field extraction, formatting, and blocking sleep helpers.
Fallible operations return `DateTimeError`, with portable `kind` and `detail`
fields plus `message()`/`to_string()` helpers.

## Import

```mux
import std.datetime
```

## Time Retrieval

- `datetime.now() returns result<int, DateTimeError>`
- `datetime.now_millis() returns result<int, DateTimeError>`
- `datetime.now_micros() returns result<int, DateTimeError>`
- `datetime.now_nanos() returns result<int, DateTimeError>`

These functions return seconds, milliseconds, microseconds, or nanoseconds
since the Unix epoch in UTC. The sub-second forms return an error when the
current instant cannot be represented by a signed Mux integer.

## Calendar Fields

- `datetime.year(int ts) returns result<int, DateTimeError>`
- `datetime.month(int ts) returns result<int, DateTimeError>`
- `datetime.day(int ts) returns result<int, DateTimeError>`
- `datetime.hour(int ts) returns result<int, DateTimeError>`
- `datetime.minute(int ts) returns result<int, DateTimeError>`
- `datetime.second(int ts) returns result<int, DateTimeError>`
- `datetime.weekday(int ts) returns result<int, DateTimeError>` where `0 = Sunday ... 6 = Saturday`

## Formatting

- `datetime.format(int ts, string pattern) returns result<string, DateTimeError>` for UTC output
- `datetime.format_local(int ts, string pattern) returns result<string, DateTimeError>` for local timezone output

Format patterns use chrono `strftime` tokens:

- `%A` full weekday name
- `%a` abbreviated weekday name
- `%B` full month name
- `%b` abbreviated month name
- `%Y-%m-%d %H:%M:%S` date and time

## Sleep

- `datetime.sleep(int seconds) returns result<void, DateTimeError>`
- `datetime.sleep_millis(int milliseconds) returns result<void, DateTimeError>`

Both functions block at the call site and return `err` for negative durations.

## RFC 3339 timestamps

`datetime.parse_timestamp(string)` accepts an RFC 3339 timestamp, including a
numeric timezone offset, and returns Unix seconds. `datetime.format_timestamp`
emits a normalized UTC timestamp. Invalid input and out-of-range timestamps
are returned as errors; parser and format-pattern inputs must be valid UTF-8.

## HTTP dates

- `datetime.parse_http_date(string) returns result<int, DateTimeError>`
- `datetime.format_http_date(int ts) returns result<string, DateTimeError>`

`parse_http_date` accepts all three HTTP-date forms from RFC 9110: IMF-fixdate,
RFC 850, and the obsolete asctime form. `format_http_date` always emits the
canonical IMF-fixdate representation in UTC.

## Typed calendar and clock values

The value-oriented API keeps calendar data separate from Unix timestamps.
`datetime.parse_datetime(string)` returns
`result<DateTime, DateTimeError>` after validating RFC 3339 input. Use this
module-level parser instead of reaching through the `DateTime` class name.
`new()` constructor takes no arguments; parameterized construction uses an
explicit `from_*` or `parse` function.

- `datetime.Date.new()` defaults to `1970-01-01`; `Date.from_parts(year, month, day)`
  and `Date.parse(string)` validate ISO dates. `year`, `month`, `day`,
  `weekday`, `to_string`, `format(pattern)`, and `add_days` inspect or produce
  checked dates.
- `datetime.Time.new()` defaults to midnight; `Time.from_parts(hour, minute,
second, nanosecond)` and `Time.parse(string)` preserve nanoseconds. `format`
  accepts a validated caller-supplied strftime pattern.
- `datetime.DateTime.new()` defaults to the Unix epoch; `DateTime.now()`,
  `from_timestamp(seconds, nanoseconds)`, `from_date_time`, and
  `parse_pattern(text, pattern)` create UTC values. Use the module-level
  `datetime.parse_datetime(text)` for RFC 3339 text. `date`, `time`,
  `unix_seconds`, `unix_nanos`, `to_string`, `format(pattern)`, and
  `add_duration` provide checked conversions.
- `datetime.ZonedDateTime.new()` defaults to the Unix epoch in UTC.
  `from_instant(instant, zone)` converts an absolute point into a bundled IANA
  timezone. `resolve_local(date, time, zone)` returns a `LocalResolution` whose
  `kind()` is `unique`, `ambiguous`, or `nonexistent`; `earlier()` and `later()`
  expose the valid candidates as optionals. `from_local` accepts only unique
  local times and reports the other two outcomes as errors. `zone`,
  `offset_seconds`, `date`, `time`, `instant`, `to_string`, and `add_duration`
  inspect or transform the zoned value.
- `datetime.LocalResolution` makes DST behavior explicit instead of silently
  choosing an offset. Its `earlier` candidate is the first instant and its
  `later` candidate is the second when a local time is ambiguous.
- `datetime.Instant` represents an absolute Unix-nanosecond point. `new()` is
  the epoch, `now()` reads the direct system clock, and `duration_since` returns
  a signed `Duration`.
- `datetime.Duration` is a signed nanosecond span with explicit constructors
  from seconds, milliseconds, microseconds, or nanoseconds and checked `add`,
  `sub`, and `to_nanos` operations.
- `datetime.Period` stores calendar-relative years, months, and days. Applying
  it to a `Date` clamps month ends (for example, January 31 plus one month is
  February 28 or 29).

The timezone database is bundled with the runtime, so results do not depend on
the host's timezone files. Parsed RFC 3339 offsets remain normalized to UTC by
`datetime.parse_datetime`; use `ZonedDateTime.from_instant` when a named zone is needed.

## Example

```mux title="datetime_example.mux"
import std.datetime

func show_time() returns result<int, DateTimeError> {
    auto ts = use datetime.now()
    auto utc = use datetime.format(ts, "%A, %B %d, %Y %H:%M:%S UTC")
    print("UTC: " + utc)
    auto local = use datetime.format_local(ts, "%A, %B %d, %Y %H:%M:%S %Z")
    print("Local: " + local)
    print("before sleep")
    use datetime.sleep_millis(1000)
    print("after sleep")
    return ok(0)
}

func main() returns void {
    auto result = show_time()
    if result.is_err() {
        print(result.error().message())
        return
    }
    return
}
```
