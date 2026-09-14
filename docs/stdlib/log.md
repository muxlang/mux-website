# `std.log`

`std.log` provides synchronous, thread-safe structured text logging. Logger
handles share their configuration and write one atomic line at a time; no
background queue or JSON formatter is involved.

## Module functions

- `log.trace(message)`
- `log.debug(message)`
- `log.info(message)`
- `log.warn(message)`
- `log.error(message)`

Each function writes through the replaceable default logger and returns
`result<void, LogError>`. `LogError` exposes read-only `kind` and `detail`
fields plus `message()` and `to_string()`. `kind` is the typed
`log.LogErrorKind` enum (`Invalid`, `Io`, `Config`, or `State`), so callers do
not have to match rendered strings.

## Logger handles

- `log.Logger.new()` creates a logger with an `info` threshold.
- `log.Logger.default()` returns the current default logger.
- `log.Logger.set_default(logger)` replaces the process default.
- `logger.set_writer(writer)` routes atomic lines to an `io.Writer`; the
  logger retains a shared handle until it is replaced or dropped.
- `logger.set_level(level)` accepts `trace`, `debug`, `info`, `warn`, or `error`.
- `logger.set_name(name)` adds a stable logger name to each line.
- `logger.field(name, value)` adds or replaces an ordered string field.
- `logger.trace(message)`, `.debug(message)`, `.info(message)`, `.warn(message)`,
  and `.error(message)` emit through that logger.

All mutating and emitting operations return `result<void, LogError>`, so output
and writer failures are explicit. Without `set_writer`, lines go to stderr.

```mux
import std.log

func main() returns void {
    auto logger = log.Logger.new()
    auto level = logger.set_level("debug")
    if level.is_err() {
        print(level.error().message())
        return
    }
    auto name = logger.set_name("worker")
    if name.is_err() {
        print(name.error().message())
        return
    }
    auto field = logger.field("job", "42")
    if field.is_err() {
        print(field.error().message())
        return
    }
    auto started = logger.info("started")
    if started.is_err() {
        print(started.error().message())
    }
    return
}
```
