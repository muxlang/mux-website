---
title: SQL
---

# std.sql: database primitives

`std.sql` provides typed SQL access with connection, transaction, result set,
and migration primitives.

SQL operations return `result<value, SqlError>`. `SqlError.kind` is the typed
`sql.SqlErrorKind` enum (`Constraint`, `Timeout`, `Unsupported`, `Invalid`,
`Database`, or `Cancelled`), so callers can compare or match categories directly rather than
matching display strings. The provider detail message remains textual. Its
`provider`, `code`, `constraint`, and `operation` fields are available when the provider supplies that context;
otherwise they are empty (or `"unknown"` for the provider). Use
`error.message()` for a displayable message, or `error.to_string()` when a
string representation is needed. `SqlError.from_message(text)` adapts an
application-level failure at a SQL boundary.

Provider integrity failures are classified as `SqlErrorKind.Constraint` when
the driver supplies a constraint result code or SQLSTATE class 23. This
classification survives prepared-statement, transaction, pool, and migration
wrappers.

Connection, prepared-statement, transaction, and pool operations fill
`provider` and `operation` from the typed handle and selected operation, so
callers do not need to infer context from diagnostic text.
Connection, prepared-statement, transaction, and pool execute/query failures
preserve native provider codes:
SQLite uses its extended numeric code, PostgreSQL uses SQLSTATE (and a
constraint name when supplied), and MySQL uses its state/vendor code. These
fields remain empty when a provider or wrapper cannot supply them. The runtime
keeps SQLSTATE and numeric vendor-code representations separate internally;
`code` is the canonical provider code exposed by `SqlError`.
The same provider diagnostics are preserved for explicit `execute_batch` calls
on connections, transactions, and pools.
Migration application failures preserve the selected provider, operation, and
native diagnostic code as well; configuration and lifecycle validation errors
remain typed with an empty provider code when no driver call occurred.

Current provider status:

- SQLite: supported (`sql.sqlite_memory()` or `sql.connect("sqlite:///path/to/file.db")`)
- PostgreSQL: supported (`postgres://...`, `postgresql://...`)
- MySQL/MariaDB: supported (`mysql://...`, `mariadb://...`)
- SQL Server: supported through the native TDS provider

SQL Server accepts `sqlserver://host/database` and `mssql://host/database`.
The default port is 1433 and TLS certificate verification is enabled by
default. Credentials and database names use URL percent-decoding. An explicit
`encrypt=false`, `trustServerCertificate=true`, or `insecure=true` query option
opts out of certificate verification. Valid SQL Server URIs currently return
successfully from URI parsing; connection failures are returned as typed
`SqlError` values. Malformed URIs return `SqlErrorKind.Invalid` before any
connection attempt.

## Live provider checks

The complete service matrix and platform split are documented in the [hosted
acceptance guide](./hosted-acceptance).

Runtime CI starts PostgreSQL and MySQL service containers and runs the shared
driver fixture through `mux-runtime/scripts/ci/run-live-sql.sh`. The script
requires `MUX_TEST_POSTGRES_URL` and `MUX_TEST_MYSQL_URL`. It exits before
starting Cargo when either variable is empty, so a broken service configuration
cannot turn the fixture into a silent skip.

Run the same check locally after starting compatible servers:

```text
MUX_TEST_POSTGRES_URL=postgres://user:password@localhost:5432/database \
MUX_TEST_MYSQL_URL=mysql://user:password@localhost:3306/database \
./scripts/ci/run-live-sql.sh
```

Runtime CI also starts SQL Server 2022 and calls
`mux-runtime/scripts/ci/run-live-sqlserver.sh` with
`MUX_TEST_SQLSERVER_URL`. The URL uses `trustServerCertificate=true` because
the disposable service uses a test certificate. This proves live TDS behavior,
not production certificate-chain verification. The native provider still
verifies certificates by default when the opt-out is absent. Local tests cover
URI parsing, placeholders, and connection failures without requiring SQL
Server.

Malformed MySQL/MariaDB URLs are rejected as `SqlErrorKind.Invalid` before
the driver opens a network connection. This keeps configuration errors
distinct from provider/database failures.

All SQL text entry points, including prepared statements, reject statements
larger than 16 MiB before placeholder scanning or provider execution. Batch
scripts and migration SQL use the same bound. Split a large operation into
smaller statements or use a parameterized design when practical.

## Connect

| Function              | Signature | Return                         | Description                                     |
| --------------------- | --------- | ------------------------------ | ----------------------------------------------- |
| `sql.connect(uri)`    | `string`  | `result<Connection, SqlError>` | Opens a database connection for a provider URI. |
| `sql.sqlite_memory()` | none      | `result<Connection, SqlError>` | Opens an isolated in-memory SQLite database.    |

Connections, transactions, pools, and prepared statements provide a
`query_with_timeout` family. Connections use
`query_with_timeout(sql, milliseconds)`,
`query_params_with_timeout(sql, params, milliseconds)`, and
`query_named_with_timeout(sql, params, milliseconds)`. These run one query
with a hard execution deadline. SQLite uses its progress hook and reports an
expired deadline as `SqlErrorKind.Timeout`; the timeout hook is removed before
the connection can be reused. PostgreSQL sends a wire-level cancel request,
waits for the query to reach the protocol-ready state, and reports
`SqlErrorKind.Timeout` for the resulting `57014` SQLSTATE. SQL Server applies a
bounded TDS wait and reports `SqlErrorKind.Timeout` when its deadline expires.
MySQL uses a second authenticated session to issue `KILL QUERY` and reports
`SqlErrorKind.Timeout` when the deadline interrupts the statement. If the
server rejects the interrupt, the runtime returns a typed database error.
The wrapper operations use the same provider behavior and preserve the
acquired connection/transaction for reuse; a PostgreSQL transaction should be
rolled back after a cancelled statement before further work is attempted.

The timeout must be non-negative. A timeout of zero is useful for probing
whether a statement can complete immediately, but may interrupt even a small
statement depending on where SQLite invokes its progress hook. Large valid
timeouts are measured from elapsed monotonic time, so they do not wrap into an
immediate deadline on platforms with a bounded clock range.

The same handles also provide `query_with_cancellation`,
`query_params_with_cancellation`, and `query_named_with_cancellation` (where
the handle supports named parameters). Pass a `std.sync.CancellationToken` to
cooperatively stop a query. These methods are available on connections,
transactions, and pools; prepared statements provide the positional and named
forms. SQLite installs a scoped progress hook and PostgreSQL sends a wire-level
cancel request; both report an interrupted operation as
`SqlErrorKind.Cancelled`, and both leave the handle available for reuse. SQL
Server checks the token before execution and while reading the TDS result
stream, and reports `SqlErrorKind.Cancelled` when it is set. MySQL uses a
second authenticated session to issue `KILL QUERY` and reports
`SqlErrorKind.Cancelled` when it is set. Cancellation is explicit and
synchronous: it does not create a `Future` or an implicit background task.

## Pool

`sql.Pool.from_config(uri, max_connections, acquire_timeout_ms)` creates a
bounded synchronous pool. Non-query operations return their connection when
the operation finishes. A query holds its connection until the `ResultSet`
reaches EOF or is closed, so a caller cannot accidentally reuse that lease
while rows are still being read. No guard or future type is exposed. A timeout
of `-1` waits indefinitely; `0` fails immediately when the pool is busy.
`pool.metrics()` returns integer counters for capacity, total, idle, in-use,
and waiting operations. `pool.close()` marks the pool closed and releases all
idle connections immediately. Active query leases finish when their
`ResultSet` reaches EOF, is closed, or is dropped. New operations fail after
close, and a second close is harmless.
Provider and operation context is retained for pool setup and for connections
opened lazily during later operations; provider-native codes remain available
through the returned `SqlError`.
Each pool connection is independent. For an in-memory SQLite URI, use
`max_connections = 1` so every operation sees the same database.

```mux
import std.sql

func use_pool() returns result<void, SqlError> {
    auto pool = use sql.Pool.from_config("sqlite:///path/to/items.db", 1, 0)
    auto created = use pool.execute("CREATE TABLE items (value INTEGER)")
    print(created.to_string())
    auto values = use pool.metrics()
    print(values["capacity"].to_string())
    return pool.close()
}

func main() returns void {
    auto result = use_pool()
    if result.is_err() {
        print(result.error().message())
    }
    return
}
```

Pools expose the same `execute`, `execute_params`, `execute_named`, `query`,
and `query_*` operations as connections, including
`query_with_timeout(sql, milliseconds)`,
`query_params_with_timeout(sql, params, milliseconds)`, and
`query_named_with_timeout(sql, params, milliseconds)`, plus the corresponding
`query_with_cancellation`, `query_params_with_cancellation`, and
`query_named_with_cancellation` forms. `pool.execute_batch(sql)` runs a
bounded, quote/comment-aware script without parameters. PostgreSQL dollar-quoted
function bodies are treated as one statement even when their body contains
semicolons; unterminated dollar-quoted bodies and block comments are rejected
before execution.
`pool.execute_many(sql,
rows)` reuses one statement for a bounded list of positional parameter rows.

## Migrations

`Migration.from_config(version, name, up_sql, down_sql)` defines one reversible
schema change. `Migrator.from_migrations(connection, migrations)` uses an
explicit list, while `Migrator.from_directory(connection, path)` loads paired
`V001__name.up.sql` and `V001__name.down.sql` files. Versions must be positive
and unique, names use ASCII letters, digits, `_`, or `-`, and each migration's
SQL is checksummed when it is created. Each migration's `up_sql` and `down_sql`
are limited to 16 MiB, and an explicit migration list is limited to 4096
definitions and 64 MiB of aggregate SQL text, matching the directory loader.

| Method                      | Signature | Return                                        | Description                                                                                  |
| --------------------------- | --------- | --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `migrator.up()`             | none      | `result<int, SqlError>`                       | Applies every pending migration in version order.                                            |
| `migrator.up_to(version)`   | `int`     | `result<int, SqlError>`                       | Applies pending migrations through `version`.                                                |
| `migrator.down()`           | none      | `result<int, SqlError>`                       | Rolls back the highest applied local migration.                                              |
| `migrator.down_to(version)` | `int`     | `result<int, SqlError>`                       | Rolls back applied migrations above `version`.                                               |
| `migrator.status()`         | none      | `result<list<map<string, string>>, SqlError>` | Reports each local migration as `pending`, `applied`, or `modified`, including its checksum. |
| `migrator.validate()`       | none      | `result<void, SqlError>`                      | Verifies that applied versions, names, checksums, and local history agree.                   |
| `migrator.dry_run()`        | none      | `result<list<string>, SqlError>`              | Returns pending up SQL in execution order without applying it or creating metadata.          |

Migration application creates a provider-specific metadata table and performs
each migration plus its metadata update in one transaction. SQLite takes an
immediate write lock; PostgreSQL and MySQL lock a dedicated metadata row, so
concurrent migrators serialize. A changed migration is rejected after it has
been applied. The metadata table name is fixed at `mux_schema_migrations`.

```mux
import std.sql

func run_migrations() returns result<int, SqlError> {
    auto conn = use sql.sqlite_memory()
    auto migration = use sql.Migration.from_config(
        1,
        "create_items",
        "CREATE TABLE items (id INTEGER)",
        "DROP TABLE items"
    )
    auto migrator = use sql.Migrator.from_migrations(conn, [migration])
    auto applied = use migrator.up()
    print(applied.to_string())
    use migrator.validate()
    auto rolled_back = migrator.down()
    conn.close()
    return rolled_back
}

func main() returns void {
    auto result = run_migrations()
    if result.is_err() {
        print(result.error().message())
    }
    return
}
```

## Connection

| Method                                                                  | Signature                                              | Return                                | Description                                                                                                                                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `conn.close()`                                                          | none                                                   | `void`                                | Closes the connection handle.                                                                                                                                                                            |
| `conn.execute(sql)`                                                     | `string`                                               | `result<int, SqlError>`               | Executes INSERT/UPDATE/DELETE and returns affected rows.                                                                                                                                                 |
| `conn.execute_batch(sql)`                                               | `string`                                               | `result<void, SqlError>`              | Executes a bounded SQL script; semicolons inside quoted text and comments are ignored.                                                                                                                   |
| `conn.execute_many(sql, rows)`                                          | `string`, `list<list<SqlValue>>`                       | `result<int, SqlError>`               | Executes one parameterized statement for each row and returns total affected rows.                                                                                                                       |
| `conn.execute_params(sql, params)`                                      | `string`, `list<SqlValue>`                             | `result<int, SqlError>`               | Parameterized execute.                                                                                                                                                                                   |
| `conn.execute_named(sql, params)`                                       | `string`, `map<string, SqlValue>`                      | `result<int, SqlError>`               | Named parameter execute. Use `:name`; repeated names are supported.                                                                                                                                      |
| `conn.query(sql)`                                                       | `string`                                               | `result<ResultSet, SqlError>`         | Executes SELECT and returns a result set cursor.                                                                                                                                                         |
| `conn.query_params(sql, params)`                                        | `string`, `list<SqlValue>`                             | `result<ResultSet, SqlError>`         | Parameterized query.                                                                                                                                                                                     |
| `conn.query_named(sql, params)`                                         | `string`, `map<string, SqlValue>`                      | `result<ResultSet, SqlError>`         | Named parameter query. Placeholders inside quoted strings and comments are ignored.                                                                                                                      |
| `conn.query_with_timeout(sql, milliseconds)`                            | `string`, `int`                                        | `result<ResultSet, SqlError>`         | Bounded query; every provider reports `Timeout` when its interrupt mechanism stops the statement.                                                                                                        |
| `conn.query_params_with_timeout(sql, params, milliseconds)`             | `string`, `list<SqlValue>`, `int`                      | `result<ResultSet, SqlError>`         | Bounded parameterized query.                                                                                                                                                                             |
| `conn.query_named_with_timeout(sql, params, milliseconds)`              | `string`, `map<string, SqlValue>`, `int`               | `result<ResultSet, SqlError>`         | Bounded named-parameter query.                                                                                                                                                                           |
| `conn.query_with_cancellation(sql, token)`                              | `string`, `CancellationToken`                          | `result<ResultSet, SqlError>`         | Cooperatively cancellable query; every provider reports `Cancelled` when its interrupt mechanism stops the statement.                                                                                    |
| `conn.query_params_with_cancellation(sql, params, token)`               | `string`, `list<SqlValue>`, `CancellationToken`        | `result<ResultSet, SqlError>`         | Cooperatively cancellable parameterized query.                                                                                                                                                           |
| `conn.query_named_with_cancellation(sql, params, token)`                | `string`, `map<string, SqlValue>`, `CancellationToken` | `result<ResultSet, SqlError>`         | Cooperatively cancellable named-parameter query.                                                                                                                                                         |
| `conn.begin_transaction()`                                              | none                                                   | `result<Transaction, SqlError>`       | Starts a transaction bound to this connection.                                                                                                                                                           |
| `conn.begin_transaction_with_options(isolation, read_only, deferrable)` | `string`, `bool`, `bool`                               | `result<Transaction, SqlError>`       | Starts a transaction with explicit isolation and access policy. Isolation is `default`, `read_uncommitted`, `read_committed`, `repeatable_read`, or `serializable`. Unsupported combinations are errors. |
| `conn.prepare(sql)`                                                     | `string`                                               | `result<PreparedStatement, SqlError>` | Creates a reusable statement handle bound to this connection.                                                                                                                                            |

The no-argument transaction constructor keeps the provider default. The
option form never silently downgrades a guarantee: SQLite currently accepts
only `default`, read-write, non-deferrable transactions; PostgreSQL supports
all listed isolation levels and PostgreSQL's `deferrable` restriction; MySQL
supports its isolation levels and read-only transactions but not deferrable
transactions. Dropping an active transaction rolls it back before its
connection is returned.

`PreparedStatement` exposes `execute(list<SqlValue>)`,
`execute_named(map<string, SqlValue>)`, `query(list<SqlValue>)`,
`query_named(map<string, SqlValue>)`,
`query_with_timeout(list<SqlValue>, milliseconds)`,
`query_named_with_timeout(map<string, SqlValue>, milliseconds)`,
`query_with_cancellation(list<SqlValue>, token)`,
`query_named_with_cancellation(map<string, SqlValue>, token)`, and
`close()`. A prepared handle is single-connection. Closing its connection
invalidates any retained prepared handles; close statements explicitly when
they are no longer needed for deterministic resource cleanup.

`execute(sql)` accepts one statement. Use `execute_batch(sql)` for an explicit
multi-statement script; it is quote/comment-aware and bounded. Batch execution
does not accept parameters, so caller-provided values should use the
parameterized single-statement methods instead. `execute_many` is the bounded
bulk form for repeated positional parameters. Every row must have the same
arity, and shape or placeholder errors are reported before the first row is
sent to the provider. It accepts the same portable `?`/`$n` positional forms
as other parameterized operations and sends the provider-normalized statement.
For atomic behavior, call it inside a transaction.

## Transaction

| Method                                                    | Signature                                              | Return                          | Description                                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `tx.begin_transaction()`                                  | none                                                   | `result<Transaction, SqlError>` | Starts a nested transaction backed by a savepoint.                                                                              |
| `tx.savepoint(name)`                                      | `string`                                               | `result<void, SqlError>`        | Creates a named savepoint. Names must be 1 to 128 ASCII letters, digits, and underscores, starting with a letter or underscore. |
| `tx.rollback_to(name)`                                    | `string`                                               | `result<void, SqlError>`        | Rolls the transaction back to a named savepoint while keeping the transaction active.                                           |
| `tx.release_savepoint(name)`                              | `string`                                               | `result<void, SqlError>`        | Releases a named savepoint.                                                                                                     |
| `tx.commit()`                                             | none                                                   | `result<void, SqlError>`        | Commits the active transaction.                                                                                                 |
| `tx.rollback()`                                           | none                                                   | `result<void, SqlError>`        | Rolls back the active transaction.                                                                                              |
| `tx.execute(sql)`                                         | `string`                                               | `result<int, SqlError>`         | Executes a statement inside the transaction.                                                                                    |
| `tx.execute_batch(sql)`                                   | `string`                                               | `result<void, SqlError>`        | Executes a bounded SQL script inside the transaction.                                                                           |
| `tx.execute_many(sql, rows)`                              | `string`, `list<list<SqlValue>>`                       | `result<int, SqlError>`         | Executes one parameterized statement for each row inside the transaction.                                                       |
| `tx.execute_params(sql, params)`                          | `string`, `list<SqlValue>`                             | `result<int, SqlError>`         | Parameterized execute inside the transaction.                                                                                   |
| `tx.execute_named(sql, params)`                           | `string`, `map<string, SqlValue>`                      | `result<int, SqlError>`         | Named parameter execute inside the transaction.                                                                                 |
| `tx.query(sql)`                                           | `string`                                               | `result<ResultSet, SqlError>`   | Executes a query inside the transaction.                                                                                        |
| `tx.query_params(sql, params)`                            | `string`, `list<SqlValue>`                             | `result<ResultSet, SqlError>`   | Parameterized query inside the transaction.                                                                                     |
| `tx.query_named(sql, params)`                             | `string`, `map<string, SqlValue>`                      | `result<ResultSet, SqlError>`   | Named parameter query inside the transaction.                                                                                   |
| `tx.query_with_timeout(sql, milliseconds)`                | `string`, `int`                                        | `result<ResultSet, SqlError>`   | Bounded query inside the transaction.                                                                                           |
| `tx.query_params_with_timeout(sql, params, milliseconds)` | `string`, `list<SqlValue>`, `int`                      | `result<ResultSet, SqlError>`   | Bounded parameterized query inside the transaction.                                                                             |
| `tx.query_named_with_timeout(sql, params, milliseconds)`  | `string`, `map<string, SqlValue>`, `int`               | `result<ResultSet, SqlError>`   | Bounded named-parameter query inside the transaction.                                                                           |
| `tx.query_with_cancellation(sql, token)`                  | `string`, `CancellationToken`                          | `result<ResultSet, SqlError>`   | Cooperatively cancellable query inside the transaction.                                                                         |
| `tx.query_params_with_cancellation(sql, params, token)`   | `string`, `list<SqlValue>`, `CancellationToken`        | `result<ResultSet, SqlError>`   | Cooperatively cancellable parameterized query inside the transaction.                                                           |
| `tx.query_named_with_cancellation(sql, params, token)`    | `string`, `map<string, SqlValue>`, `CancellationToken` | `result<ResultSet, SqlError>`   | Cooperatively cancellable named-parameter query inside the transaction.                                                         |

A nested transaction uses the same methods as its parent. While the child is
active, operations on the parent return an error. Committing the child keeps
its changes inside the parent; only the outermost commit makes them permanent.
Rolling back or dropping the child discards its changes and lets the parent
continue. Children can create further nested transactions.

Each child keeps its parent alive, and the outer transaction keeps its
connection alive. Dropping the last active transaction handle rolls it back.
If a child outlives the parent's variable, finishing the child also allows the
unreferenced parent to roll back. Explicitly closing the connection invalidates
all its transactions. Do not execute transaction-control SQL manually inside
managed transactions, since that bypasses their lifetime tracking.

## ResultSet

| Method                 | Signature | Return                            | Description                                                                      |
| ---------------------- | --------- | --------------------------------- | -------------------------------------------------------------------------------- |
| `rs.rows()`            | none      | `result<list<Row>, SqlError>`     | Drains and closes the cursor without losing duplicate columns.                   |
| `rs.next()`            | none      | `result<optional<Row>, SqlError>` | Reads one row; `ok(none)` means EOF.                                             |
| `rs.next_batch(limit)` | `int`     | `result<list<Row>, SqlError>`     | Consumes at most `limit` rows from the cursor; non-positive limits consume none. |
| `rs.columns()`         | none      | `list<string>`                    | Column names in result order.                                                    |
| `rs.close()`           | none      | `result<void, SqlError>`          | Releases the result-set lease. Calling it more than once is safe.                |

`Row` preserves every column occurrence, including duplicate names. Use
`row.columns()` and `row.values()` for ordered views, `row.at(index)` for
unambiguous positional access, and `row.get(name)` when the name occurs
exactly once. A duplicate or missing name is returned as an explicit error.
For large result sets, prefer `next_batch(limit)` to process a bounded number
of rows at a time without materializing another full list. `rows()` drains the
cursor and closes it. Reaching EOF also closes it, and dropping the last handle
releases it as a safety net. Query cancellation is a separate, explicit
operation described above. Read failures return `err(SqlError)`, not an empty
batch or EOF, and release the cursor lease. PostgreSQL, SQLite, MySQL, and SQL Server keep provider-owned
cursors and advance them as `next()` or `next_batch()` requests rows. Each
connection, transaction, and pool lease remains held until EOF, explicit
close, or result-set handle drop. Timeout and cancellation variants retain
their existing bounded execution behavior.
SQLite text columns are decoded as `string` when they contain valid UTF-8; raw
text bytes that are not valid UTF-8 are preserved as `bytes` instead of being
silently replaced.

The compiler does not generate class-to-row or row-to-class methods. If an
application wants typed records, define a parser that reads the `Row` values
with `row.at(index)` or `row.get(name)`, converts each `SqlValue`, and assigns
the fields explicitly. Handle nullable columns with `optional<T>` in that
method. Missing columns, `NULL` in a required field, and failed conversions
should be returned as the parser's typed `SqlError`.

```mux
import std.sql

class User {
    int id
    string name
    optional<string> note
}

func read_user(Row row) returns result<User, SqlError> {
    auto id_value = use row.at(0)
    auto name_value = use row.at(1)
    auto user = User.new()
    user.id = use id_value.as_int()
    user.name = use name_value.as_string()
    return ok(user)
}
```

```mux
import std.sql

func read_column(ResultSet result) returns result<int, SqlError> {
    auto maybe_row = use result.next()
    if maybe_row.is_none() {
        return err(SqlError.from_message("query returned no rows"))
    }
    auto row = maybe_row.value()
    auto value = use row.at(1)
    auto number = use value.as_int()
    return ok(number)
}

func read_duplicate_column() returns result<int, SqlError> {
    auto connection = use sql.sqlite_memory()
    auto result = use connection.query("SELECT 1 AS value, 2 AS value")
    auto value = read_column(result)
    connection.close()
    return value
}

func main() returns void {
    auto result = read_duplicate_column()
    if result.is_ok() {
        print(result.value().to_string())
    } else {
        print(result.error().message())
    }
    return
}
```

## SqlValue

Use `SqlValue` for typed parameters and typed row decoding.

`sql.json(value)` serializes a native `Json` value as a validated SQL text
parameter and returns a Result because JSON values can contain a value that is
not representable by the JSON format. `value.as_json()` performs the inverse
operation for text/JSON columns and reports parse failures instead of silently
returning a map or string.

Positional statements may use `?` placeholders on every provider. PostgreSQL
also accepts `$1`, `$2`, and so on. The runtime rewrites these forms for the
selected driver, rejects mixed or non-contiguous placeholders, and ignores
placeholder-looking text inside SQL strings and comments. Unterminated block
comments are rejected before a provider sees the statement. Named statements use
`:name` with a `map<string, SqlValue>` and reject missing or unused names before
execution, catching misspelled map keys instead of silently accepting values
that the SQL never uses. The scanner also follows provider literal escaping:
backslashes escape the next character in MySQL strings and PostgreSQL `E'...'`
strings, while SQLite treats backslashes as ordinary string characters.

### Constructors

| Function          | Signature  | Return                       |
| ----------------- | ---------- | ---------------------------- |
| `sql.int(v)`      | `int`      | `SqlValue`                   |
| `sql.float(v)`    | `float`    | `SqlValue`                   |
| `sql.bool(v)`     | `bool`     | `SqlValue`                   |
| `sql.string(v)`   | `string`   | `SqlValue`                   |
| `sql.bytes(v)`    | `bytes`    | `SqlValue`                   |
| `sql.json(v)`     | `Json`     | `result<SqlValue, SqlError>` |
| `sql.datetime(v)` | `DateTime` | `result<SqlValue, SqlError>` |
| `sql.uuid(v)`     | `Uuid`     | `result<SqlValue, SqlError>` |
| `sql.null()`      | none       | `SqlValue`                   |

### Methods

| Method                | Return                       | Description                                             |
| --------------------- | ---------------------------- | ------------------------------------------------------- |
| `value.is_null()`     | `bool`                       | True when value is SQL NULL.                            |
| `value.as_bool()`     | `result<bool, SqlError>`     | Converts SQL value to bool.                             |
| `value.as_int()`      | `result<int, SqlError>`      | Converts SQL value to int.                              |
| `value.as_float()`    | `result<float, SqlError>`    | Converts SQL value to float.                            |
| `value.as_string()`   | `result<string, SqlError>`   | Converts SQL value to string.                           |
| `value.as_bytes()`    | `result<bytes, SqlError>`    | Converts SQL value to bytes.                            |
| `value.as_json()`     | `result<Json, SqlError>`     | Parses a SQL text/JSON value as native JSON.            |
| `value.as_datetime()` | `result<DateTime, SqlError>` | Parses an RFC 3339 SQL text value as a native DateTime. |
| `value.as_uuid()`     | `result<Uuid, SqlError>`     | Parses a canonical SQL text value as a native Uuid.     |
| `value.to_string()`   | `string`                     | Generic string representation.                          |

## SQLite Example

```mux
import std.sql

func fill_and_read(Connection conn) returns result<int, SqlError> {
    auto created = use conn.execute("CREATE TABLE users (id INTEGER, name TEXT)")
    assert(created == 0, "table creation should not report changed rows")

    auto inserted = use conn.execute_params(
        "INSERT INTO users (id, name) VALUES (?, ?)",
        [sql.int(1), sql.string("Ada")]
    )
    assert(inserted == 1, "single-row insert should affect one row")

    auto bulk_inserted = use conn.execute_many(
        "INSERT INTO users (id, name) VALUES (?, ?)",
        [[sql.int(2), sql.string("Grace")], [sql.int(3), sql.string("Lin")]]
    )
    assert(bulk_inserted == 2, "bulk insert should affect two rows")

    auto result = use conn.query("SELECT id, name FROM users")
    auto rows = use result.rows()
    auto row = rows[0]
    auto id = use row.values()[0].as_int()
    auto name = use row.values()[1].as_string()
    assert(id == 1, "first user id mismatch")
    assert(name == "Ada", "first user name mismatch")
    return ok(id)
}

func prepare_and_query() returns result<int, SqlError> {
    auto conn = use sql.sqlite_memory()
    auto result = fill_and_read(conn)
    conn.close()
    return result
}
```

Prepared statements can be reused, and named parameters are translated for
the active provider. `sqlite_memory()` is a convenient isolated database for
tests and small programs; use `connect(...)` when selecting another provider
or a file-backed database. In the example, `:user_id` is a named SQL
placeholder supplied by the map passed to `query_named`:

```mux
import std.sql

func run_prepared(Connection conn) returns result<string, SqlError> {
    auto statement = use conn.prepare("SELECT :user_id AS user_id")
    auto rows = use statement.query_named({"user_id": sql.int(42)})
    auto maybe_row = use rows.next()
    if maybe_row.is_none() {
        statement.close()
        return err(SqlError.from_message("query returned no rows"))
    }
    auto row = maybe_row.value()
    auto output = row.values()[0].to_string()
    statement.close()
    return ok(output)
}

func main() returns void {
    auto connection = sql.sqlite_memory()
    if connection.is_err() {
        print(connection.error().message())
        return
    }
    auto conn = connection.value()
    auto result = run_prepared(conn)
    if result.is_err() {
        print(result.error().message())
    } else {
        print(result.value())
    }
    conn.close()
    return
}
```
