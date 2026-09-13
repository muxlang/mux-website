---
sidebar_position: 12
---

# Process

`std.process` exposes process metadata and explicit synchronous command
execution. A command is always executed directly; it is never interpreted by
a shell. Use an explicitly named shell command when shell syntax is required.
Fallible process operations return `ProcessError`; its `kind` is the typed
`process.ProcessErrorKind` enum and `detail` remains textual. Compare enum
variants directly and use `message()`/`to_string()` for display.

## Metadata

- `process.args() -> list<string>` returns the process argument vector.
- `process.id() -> int` returns the current process identifier.
- `process.parent_id() -> optional<int>` returns the parent identifier when the
  platform exposes one.
- `process.executable() -> result<string, ProcessError>` returns the current
  executable path.

## Commands

`Command.new()` returns a default command builder. Set its program with
`command.set_program(program)` before execution. It executes the program
directly and never invokes a shell. `Command.shell(command_line)` is
the explicit opt-in when shell parsing is desired (using the platform shell).
Configure either command before executing it:

- `command.set_program(value)` sets the direct executable path.
- `command.arg(value)` appends one argument.
- `command.env(name, value)` sets or replaces one child environment variable.
- `command.cwd(path)` sets the child working directory.
- `command.stdin_piped()`, `stdout_piped()`, and `stderr_piped()` request
  programmatic pipe access when spawning.
- `command.stdin_null()`, `stdout_null()`, and `stderr_null()` explicitly
  discard the corresponding stream.
- `command.status()` runs it and returns its normalized exit status.
- `command.output()` runs it and captures stdout and stderr as `bytes`; each
  captured stream is bounded to 16 MiB and an oversized process is terminated
  immediately with an error, including when it is blocked writing more output
  to a full pipe.
- `command.spawn()` starts it and returns a `Child` handle.

Status values are the platform exit code; a process terminated by a signal is
reported as `-1`.

## Process pools

`ProcessPool.new()` returns a `result<ProcessPool, ProcessError>` after creating
a bounded synchronous pool with four workers and a 64-command queue.
`ProcessPool.with_config(workers, queue_capacity)` lets the
caller choose those bounds. Submit a configured `Command` with
`pool.submit(command)`; it returns a result channel whose eventual item is the
same `result<Output, ProcessError>` produced by `Command.output()`. Use
`try_submit(command)` for an immediate `none` when the queue is full, or
`submit_timeout(command, milliseconds)` to wait for queue space. A negative
timeout is rejected. `cancel_pending()` drops queued commands and returns the
number cancelled; `close()` stops accepting work, drains accepted work, and
joins the workers. Commands submitted to a pool are copied as immutable
execution specifications, so later builder changes do not affect queued work.

## Children and captured output

`Child.wait()` blocks until completion, `try_wait()` polls once, and
`wait_timeout(milliseconds)` waits for at most the requested duration and
returns `none` when the child is still running. Waits poll without blocking
other aliases, so a caller can drain a piped stdout or stderr stream while a
wait is in progress; `wait()` closes an open stdin pipe before waiting. All three waiting methods
return `result<optional<int>, ProcessError>` except `wait()`, which returns
`result<int, ProcessError>`. `kill()` requests termination; `kill_group()` also
terminates descendants. Spawned children are placed in a private process group
on Unix and a private process tree on Windows.

`Output.status()`, `Output.stdout()`, and `Output.stderr()` expose the captured
result. Output is binary-safe. Copying a command, child, or output shares the
same underlying handle. Dropping the final child handle terminates and reaps
an unfinished child. For a piped child, `write_stdin(bytes)` writes a bounded
chunk, `close_stdin()` sends end-of-file, and `read_stdout(size)` /
`read_stderr(size)` read bounded binary chunks. Reading or writing an
unconfigured stream returns an error. Process pipes accept the built-in
`bytes` type only; convert a list explicitly with `to_bytes()` when that is
what the caller started with.
`ProcessError.kind` is the typed `process.ProcessErrorKind` enum with
`Invalid`, `Io`, `Spawn`, `Timeout`, `State`, and `NotFound` variants. Compare
those variants directly; use `message()` or `to_string()` for display.
