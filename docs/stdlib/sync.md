# sync

`sync` provides synchronous concurrency primitives for threads, locks, channels,
and coordination.

## Import

```mux
import std.sync
```

## Errors

Fallible synchronization operations return `SyncError`. Its `kind` is the typed
`sync.SyncErrorKind` enum (`Invalid`, `State`, `Timeout`, `Closed`, `Callback`,
`Spawn`, or `Io`); `detail` remains textual. Compare or match the enum for
programmatic handling. `message()` returns the detail for display and
`to_string()` adds the category. Use `SyncError.from_message(text)` when
adapting a synchronization failure at an application boundary.

## API

- `sync.spawn(fn() -> T) -> result<Thread<T>, SyncError>`; the callback's return
  value is owned by the worker and delivered once by `join()`
- `sync.sleep(int milliseconds) -> void`
- `Thread<T>.join() -> result<T, SyncError>` (one-shot)
- `Thread<T>.detach() -> result<void, SyncError>`
- `Mutex<T>.with_value(T) -> Mutex<T>`
- `Mutex<T>.with_lock(func(&T) returns void) -> result<void, SyncError>`
- `RwLock<T>.with_value(T) -> RwLock<T>`
- `RwLock<T>.with_read(func(&T) returns void) -> result<void, SyncError>`
- `RwLock<T>.with_write(func(&T) returns void) -> result<void, SyncError>`
- `CondVar.new() -> CondVar`
- `CondVar.wait(mutex: Mutex<T>) -> result<void, SyncError>`
- `CondVar.wait_timeout(mutex: Mutex<T>, milliseconds: int) -> result<bool, SyncError>`;
  returns `true` when notified and `false` when the deadline expires. A zero
  timeout performs a non-blocking check; negative values and values above
  `4_294_967_295` milliseconds are rejected so timeout behavior is consistent
  across Unix and Windows.
- `CondVar.signal() -> result<void, SyncError>`
- `CondVar.broadcast() -> result<void, SyncError>`
- `AtomicInt.new() -> AtomicInt` (initial value `0`)
- `AtomicInt.with_value(int) -> AtomicInt`
- `AtomicInt.load() -> result<int, SyncError>`, `store(int)`, `add(int)`,
  `swap(int)`, and `compare_exchange(int expected, int replacement)`
- `AtomicBool.new() -> AtomicBool` (initial value `false`)
- `AtomicBool.with_value(bool) -> AtomicBool`
- `AtomicBool.load() -> result<bool, SyncError>`, `store(bool)`, `swap(bool)`, and
  `compare_exchange(bool expected, bool replacement)`
- `Semaphore.with_permits(int) -> result<Semaphore, SyncError>`
- `Semaphore.acquire()`, `try_acquire()`, `acquire_timeout(milliseconds)`, and
  `release()`; timed acquisition returns `true` only when a permit was
  acquired before the deadline.
- `Barrier.with_size(int) -> result<Barrier, SyncError>`
- `Barrier.wait() -> result<bool, SyncError>`; the returned bool identifies the
  thread that opened the barrier
- `CancellationToken.new() -> CancellationToken`, `cancel()`, and
  `is_cancelled()` for cooperative one-way cancellation
- `Once.new() -> Once` and `Once.call(func() returns void)` run a callback at
  most once; concurrent callers wait for the first invocation to finish.
- `Channel<T>.new() -> Channel<T>` (an unbounded default),
  `Channel<T>.new_unbounded() -> Channel<T>`, and
  `Channel<T>.new_bounded(int) -> result<Channel<T>, SyncError>` create shared MPMC
  channels; bounded capacity is limited to 16 Mi entries. `send(value)` blocks, while `try_send(value)` and
  `send_timeout(value, milliseconds)` report whether a bounded send completed;
  timed channel operations reject values above `4_294_967_295` milliseconds.
  `recv()` blocks and returns `some(value)` or `none`; `try_recv()` and
  `recv_timeout(milliseconds)` return `none` when no value is ready. `close()`,
  `is_closed()`, and `capacity()` provide lifecycle and configuration state.
  `send_cancelled(value, token)` and `recv_cancelled(token)` stop a blocking
  operation when the supplied `CancellationToken` is cancelled. `Channel<T>.select(channels,
timeout_ms)` waits for the first available value and returns an optional
  `(index, value)` tuple; ties are resolved by input order and closed channels
  are skipped.
- `WorkerPool<T>.new() -> WorkerPool<T>` creates a bounded pool with four
  workers and a queue capacity of 64. `WorkerPool<T>.with_size(int)` keeps the
  default queue policy, while `with_config(int workers, int queue_capacity)`
  sets both values; both parameterized constructors return
  `result<WorkerPool<T>, SyncError>`.
- `WorkerPool<T>.map(list<U>, func(U) returns T) -> result<list<T>, SyncError>`
  runs callbacks on the pool and blocks until all submitted work finishes.
  Results follow input order, even when callbacks finish out of order. An
  empty input returns an empty list. Closing the pool or cancelling queued
  tasks during a map returns an error after accepted tasks finish or cancel.
  Each job gets independent copies of ordinary captured values; synchronization
  handles keep their shared behavior.
- `WorkerPool<T>.submit(func() returns T) -> result<Channel<T>, SyncError>` blocks
  until work is queued and returns a single-result channel. `try_submit` and
  `submit_timeout` return `result<optional<Channel<T>>, SyncError>`, using `none`
  when the queue is full or the deadline expires. `cancel_pending()` reports
  how many queued callbacks it cancelled, and `close()` stops new work and
  drains accepted work before returning.

`with_lock`, `with_read`, and `with_write` acquire the native lock, pass the
typed payload to a synchronously invoked callback, and release the lock before
returning. The callback receives a borrowed reference and is never retained by
the runtime. A write callback may update the payload; a read callback must only
read it. Mutexes are non-reentrant: acquiring the same mutex again from its
owning thread returns a `SyncError` instead of blocking or entering recursively.
`Mutex<T>` and `RwLock<T>` use the explicit `with_value` constructors;
they do not overload `new()` with a payload argument.
Mux panic behavior is process-wide: a panic on a worker thread terminates the
process instead of becoming a recoverable `join()` error.
Spawned callbacks may capture ordinary owned values, but borrowed references are
rejected because the worker can outlive the referenced scope.
Atomic operations are sequentially consistent. Semaphores and barriers block
the calling thread directly; they do not create futures or background tasks.
Channel payloads are copied values. Resource handles (including sockets,
processes, and other synchronization handles) are rejected as payloads so a
channel cannot smuggle non-thread-safe shared state across workers.

## Example

```mux
import std.sync

func main() returns void {
    Mutex<int> m = Mutex<int>.with_value(0)
    CondVar cv = CondVar.new()

    auto worker_result = sync.spawn(func() returns void {
        sync.sleep(50)
        auto updated = m.with_lock(func(&int count) returns void {
            *count = *count + 1
            auto signalled = cv.signal()
            if signalled.is_err() {
                print(signalled.error().message())
            }
            return
        })
        if updated.is_err() {
            print(updated.error().message())
        }
        return
    })
    if worker_result.is_err() {
        print(worker_result.error().message())
        return
    }
    auto worker = worker_result.value()

    auto waited = m.with_lock(func(&int _count) returns void {
        auto wait_result = cv.wait(m)
        if wait_result.is_err() {
        print(wait_result.error().message())
        }
        return
    })
    if waited.is_err() {
        print(waited.error().message())
        return
    }
    print("condition satisfied")

    auto joined = worker.join()
    if joined.is_err() {
        print(joined.error().message())
        return
    }
    print("worker joined")
    return
}
```

`Thread<T>` is generic over the callback's return type. A value-producing worker
is joined in exactly the same way:

```mux
import std.sync

func main() returns void {
    auto worker_result = sync.spawn(func() returns int {
        return 42
    })
    if worker_result.is_err() {
        print(worker_result.error().message())
        return
    }
    auto worker = worker_result.value()
    auto value_result = worker.join()
    if value_result.is_err() {
        print(value_result.error().message())
        return
    }
    print(value_result.value().to_string())
    return
}
```

Condition-variable waits are performed from inside a `with_lock` callback so
the runtime can atomically release and reacquire the associated mutex while
waiting. `wait_timeout` uses the same lock discipline and reports whether a
notification arrived before the deadline. Manual lock and unlock methods are
intentionally not part of the Mux surface.

Worker pools own their worker threads and use channels for results. A callback
that has been accepted runs exactly once; closing a pool allows accepted work to
finish, while `cancel_pending` closes the result channels for callbacks that
never run.

```mux
import std.sync

func main() returns void {
    WorkerPool<int> pool = WorkerPool<int>.new()
    auto submitted = pool.submit(func() returns int {
        return 42
    })
    if submitted.is_err() {
        print(submitted.error().message())
        return
    }
    auto channel = submitted.value()
    auto received = channel.recv()
    if received.is_err() {
        print(received.error().message())
        return
    }
    auto maybe_number = received.value()
    if maybe_number.is_some() {
        print(maybe_number.value().to_string())
    } else {
        print("no result")
    }

    auto closed = pool.close()
    if closed.is_err() {
        print(closed.error().message())
        return
    }
    print("pool closed")
    return
}
```
