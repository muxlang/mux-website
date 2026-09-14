---
title: Net
---

# std.net - Networking Primitives

`std.net` exposes typed networking primitives for blocking and nonblocking TCP,
UDP, readiness polling, and HTTP request/response handling.

## Typed addresses

`IpAddr`, `SocketAddr`, and `Cidr` are validated opaque values. Use their
`parse` functions instead of passing unchecked address strings through an
application:

- `IpAddr.parse(string)` returns `result<IpAddr, NetError>`; `is_v4`, `is_v6`,
  `octets`, and `to_string` inspect it.
- `SocketAddr.parse(string)` returns `result<SocketAddr, NetError>` after
  validating an IP plus port; `ip`, `port`,
  `with_port`, and `to_string` expose its components.
- `SocketAddr.resolve(host, port)` returns `result<list<SocketAddr>, NetError>`
  after resolving a hostname without opening a connection.
- `Endpoint.from_host(host, port)` returns `result<Endpoint, NetError>` and
  keeps a validated host/port pair without resolving it. `host`, `port`, and
  `to_string` inspect it; `resolve` returns deterministic typed socket
  addresses. `Endpoint.from_socket_addr` converts an already-resolved
  `SocketAddr`.
- `Cidr.parse(string)` returns `result<Cidr, NetError>` and normalizes host bits
  to the network address; `contains`,
  `network`, `prefix_len`, and `to_string` inspect the range. IPv4 and IPv6
  networks never match each other.

`NetError` implements `Error`. Its `kind` is the typed `net.NetErrorKind` enum
with `Invalid`, `Timeout`, `Resolve`, `Unsupported`, and `Io` variants; `detail`
is the stable message and `address` contains an address/host context when one
was available. Compare or match the enum directly, and use `message()` or
`to_string()` when displaying the error.

```mux
import std.net

func main() returns void {
    auto endpoint = net.Endpoint.from_host("localhost", 8080)
    if endpoint.is_err() {
        print(endpoint.error().message())
        return
    }
    print(endpoint.value().to_string())
    return
}
```

## TcpStream

Use `TcpStream` to connect to a TCP server and perform bounded blocking or
nonblocking byte I/O.

| Method                                                             | Signature | Return                        | Description                                                                                         |
| ------------------------------------------------------------------ | --------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `TcpStream.connect(addr)`                                          | `string`  | `result<TcpStream, NetError>` | Establishes a connection to the supplied address. Returns an error if the socket could not connect. |
| `stream.read(size)`                                                | `int`     | `result<bytes, IoError>`      | Reads up to `size` bytes.                                                                           |
| `stream.write(data)`                                               | `bytes`   | `result<int, IoError>`        | Sends the provided bytes and returns the number written.                                            |
| `stream.close()`                                                   | -         | `void`                        | Releases the socket handle.                                                                         |
| `stream.set_nonblocking(enabled)`                                  | `bool`    | `result<void, NetError>`      | Toggle non-blocking mode; errors are returned via the result.                                       |
| `stream.set_read_timeout(timeout_ms)`                              | `int`     | `result<void, NetError>`      | Set the read timeout in milliseconds; `0` clears it. Negative values are rejected.                  |
| `stream.set_write_timeout(timeout_ms)`                             | `int`     | `result<void, NetError>`      | Set the write timeout in milliseconds; `0` clears it. Negative values are rejected.                 |
| `stream.set_nodelay(enabled)`                                      | `bool`    | `result<void, NetError>`      | Enable or disable TCP `NODELAY`.                                                                    |
| `stream.nodelay()`                                                 | -         | `result<bool, NetError>`      | Reads the current TCP `NODELAY` setting.                                                            |
| `stream.set_keepalive(enabled)`                                    | `bool`    | `result<void, NetError>`      | Enable or disable TCP keepalive probes.                                                             |
| `stream.keepalive()`                                               | -         | `result<bool, NetError>`      | Reads the current TCP keepalive setting.                                                            |
| `stream.set_ttl(ttl)`                                              | `int`     | `result<void, NetError>`      | Sets the IP time-to-live/hop limit; values must fit an unsigned 32-bit integer.                     |
| `stream.ttl()`                                                     | -         | `result<int, NetError>`       | Reads the IP time-to-live/hop limit.                                                                |
| `stream.set_recv_buffer_size(size)` / `set_send_buffer_size(size)` | `int`     | `result<void, NetError>`      | Request an OS socket receive/send buffer size, bounded to 16 MiB.                                   |
| `stream.recv_buffer_size()` / `send_buffer_size()`                 | -         | `result<int, NetError>`       | Read the OS-selected receive/send buffer size.                                                      |
| `stream.shutdown_read()`                                           | -         | `result<void, NetError>`      | Half-close the read side of the TCP stream.                                                         |
| `stream.shutdown_write()`                                          | -         | `result<void, NetError>`      | Half-close the write side of the TCP stream.                                                        |
| `stream.peer_addr()`                                               | -         | `result<string, NetError>`    | Returns the remote address or an error if the connection is closed.                                 |
| `stream.local_addr()`                                              | -         | `result<string, NetError>`    | Returns the local socket address or an error if the socket was closed.                              |

## UdpSocket

`UdpSocket` is useful for simple datagram protocols or probing localhost.

| Method                                                             | Signature          | Return                                              | Description                                                                                        |
| ------------------------------------------------------------------ | ------------------ | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `UdpSocket.bind(addr)`                                             | `string`           | `result<UdpSocket, NetError>`                       | Binds a new socket to the given port. Use `127.0.0.1:0` to let the OS pick an ephemeral port.      |
| `socket.send_to(data, addr)`                                       | `bytes`, `string`  | `result<int, NetError>`                             | Sends a datagram to the specified address.                                                         |
| `socket.recv_from(size)`                                           | `int`              | `result<UdpDatagram, NetError>`                     | Receives up to `size` bytes. Oversized datagrams are truncated and reported by the returned value. |
| `socket.close()`                                                   | -                  | `void`                                              | Closes the socket.                                                                                 |
| `socket.set_nonblocking(enabled)`                                  | `bool`             | `result<void, NetError>`                            | Toggle non-blocking mode; errors are returned via the result.                                      |
| `socket.set_read_timeout(timeout_ms)`                              | `int`              | `result<void, NetError>`                            | Set the receive timeout in milliseconds; `0` clears it. Negative values are rejected.              |
| `socket.set_write_timeout(timeout_ms)`                             | `int`              | `result<void, NetError>`                            | Set the send timeout in milliseconds; `0` clears it. Negative values are rejected.                 |
| `socket.set_ttl(ttl)`                                              | `int`              | `result<void, NetError>`                            | Sets the IP time-to-live for outgoing datagrams.                                                   |
| `socket.ttl()`                                                     | -                  | `result<int, NetError>`                             | Reads the current IP time-to-live.                                                                 |
| `socket.set_recv_buffer_size(size)` / `set_send_buffer_size(size)` | `int`              | `result<void, NetError>`                            | Request an OS socket receive/send buffer size, bounded to 16 MiB.                                  |
| `socket.recv_buffer_size()` / `send_buffer_size()`                 | -                  | `result<int, NetError>`                             | Read the OS-selected receive/send buffer size.                                                     |
| `socket.set_broadcast(enabled)`                                    | `bool`             | `result<void, NetError>`                            | Enables or disables broadcast datagrams.                                                           |
| `socket.broadcast()`                                               | -                  | `result<bool, NetError>`                            | Reads the broadcast setting.                                                                       |
| `socket.set_multicast_loop_v4(enabled)`                            | `bool`             | `result<void, NetError>`                            | Controls loopback delivery for IPv4 multicast datagrams.                                           |
| `socket.multicast_loop_v4()`                                       | -                  | `result<bool, NetError>`                            | Reads IPv4 multicast loopback state.                                                               |
| `socket.set_multicast_ttl_v4(ttl)`                                 | `int`              | `result<void, NetError>`                            | Sets the IPv4 multicast TTL.                                                                       |
| `socket.multicast_ttl_v4()`                                        | -                  | `result<int, NetError>`                             | Reads the IPv4 multicast TTL.                                                                      |
| `socket.join_multicast_v4(group, interface)`                       | `string`, `string` | `result<void, NetError>`                            | Joins an IPv4 multicast group on the specified interface address.                                  |
| `socket.leave_multicast_v4(group, interface)`                      | `string`, `string` | `result<void, NetError>`                            | Leaves an IPv4 multicast group.                                                                    |
| `socket.set_multicast_loop_v6(enabled)` / `multicast_loop_v6()`    | `bool` / -         | `result<void, NetError>` / `result<bool, NetError>` | Controls or reads IPv6 multicast loopback delivery.                                                |
| `socket.set_multicast_hops_v6(hops)` / `multicast_hops_v6()`       | `int` / -          | `result<void, NetError>` / `result<int, NetError>`  | Controls or reads the IPv6 multicast hop limit.                                                    |
| `socket.join_multicast_v6(group, interface)`                       | `string`, `int`    | `result<void, NetError>`                            | Joins an IPv6 multicast group using a numeric interface index.                                     |
| `socket.leave_multicast_v6(group, interface)`                      | `string`, `int`    | `result<void, NetError>`                            | Leaves an IPv6 multicast group.                                                                    |
| `socket.peer_addr()`                                               | -                  | `result<string, NetError>`                          | Returns the peer address when the socket is connected.                                             |
| `socket.local_addr()`                                              | -                  | `result<string, NetError>`                          | Returns the local bind address.                                                                    |

`UdpDatagram` is an immutable received packet. Its `bytes()` payload contains
only the requested prefix, `address()` returns the sender address, and
`truncated()` reports whether the original datagram was larger than the receive
limit.

| Method                 | Return                     | Description                          |
| ---------------------- | -------------------------- | ------------------------------------ |
| `datagram.bytes()`     | `result<bytes, NetError>`  | Return the received payload prefix.  |
| `datagram.address()`   | `result<string, NetError>` | Return the sender address.           |
| `datagram.truncated()` | `result<bool, NetError>`   | Report whether bytes were discarded. |

## TcpListener

`TcpListener` is the low-level server socket primitive for accepting inbound TCP connections.

| Method                              | Signature | Return                          | Description                                                                        |
| ----------------------------------- | --------- | ------------------------------- | ---------------------------------------------------------------------------------- |
| `TcpListener.bind(addr)`            | `string`  | `result<TcpListener, NetError>` | Binds a listener to the supplied address. Use `127.0.0.1:0` for an ephemeral port. |
| `listener.accept()`                 | -         | `result<TcpStream, NetError>`   | Blocks until a connection arrives and returns a connected `TcpStream`.             |
| `listener.local_addr()`             | -         | `result<string, NetError>`      | Returns the bound socket address.                                                  |
| `listener.set_nonblocking(enabled)` | `bool`    | `result<void, NetError>`        | Toggles non-blocking mode for accept operations.                                   |
| `listener.close()`                  | -         | `void`                          | Releases the listener handle.                                                      |

## Readiness polling

`Poller` provides cross-platform readiness notifications for cloned TCP,
listener, and UDP socket handles. Registration returns a positive token; the
poller owns the registration until `deregister(token)` is called.

- `Poller.new()` returns `result<Poller, NetError>`.
- `poller.register_tcp(stream, readable, writable)` and
  `poller.register_udp(socket, readable, writable)` return
  `result<int, NetError>` with a registration token.
- `poller.register_listener(listener)` returns `result<int, NetError>` for
  readable listener events.
- `poller.poll(timeout_ms)` returns `result<list<PollEvent>, NetError>`;
  `-1` waits indefinitely and `0` performs a non-blocking poll.
- `poller.deregister(token)` returns `result<void, NetError>` and removes a
  registration.
- `PollEvent.token()`, `readable()`, `writable()`, `error()`, and `closed()`
  return their field through `result<value, NetError>` and expose the
  readiness state.

## Local streams

`LocalListener` and `LocalStream` provide synchronous bytes-native local IPC.
Unix builds use Unix-domain sockets at the supplied filesystem path; Windows
builds use byte-mode named pipes (a logical name is placed under
`\\.\pipe\`). The listener remains usable after each `accept()`.

| Method                                                                  | Signature | Return                            | Description                                                                                       |
| ----------------------------------------------------------------------- | --------- | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `LocalListener.bind(path)`                                              | `string`  | `result<LocalListener, NetError>` | Binds a local IPC endpoint. Empty paths and platform-invalid paths are rejected.                  |
| `listener.accept()`                                                     | -         | `result<LocalStream, NetError>`   | Blocks until one local client connects.                                                           |
| `listener.set_nonblocking(enabled)`                                     | `bool`    | `result<void, NetError>`          | Toggles nonblocking accept mode on Unix; Windows named-pipe listeners report this as unsupported. |
| `listener.close()`                                                      | -         | `void`                            | Closes the listener and removes its Unix socket path.                                             |
| `LocalStream.connect(path)`                                             | `string`  | `result<LocalStream, NetError>`   | Connects to a local listener.                                                                     |
| `stream.read(size)`                                                     | `int`     | `result<bytes, IoError>`          | Reads up to `size` bytes.                                                                         |
| `stream.write(data)`                                                    | `bytes`   | `result<int, IoError>`            | Writes bytes and returns the count written.                                                       |
| `stream.set_read_timeout(timeout_ms)` / `set_write_timeout(timeout_ms)` | `int`     | `result<void, NetError>`          | Sets a blocking I/O timeout in milliseconds; `0` clears it and negative values are rejected.      |
| `stream.set_nonblocking(enabled)`                                       | `bool`    | `result<void, NetError>`          | Toggles nonblocking mode on Unix; Windows named pipes report this as unsupported.                 |
| `stream.shutdown_read()` / `shutdown_write()`                           | -         | `result<void, NetError>`          | Half-closes one direction on Unix; Windows named pipes report that half-close is unsupported.     |
| `stream.close()`                                                        | -         | `void`                            | Closes the stream and invalidates its aliases.                                                    |

## HTTP client

`std.net.http` uses typed request, response, and header handles. HTTP methods,
content types, and bodies are request data; they are not separate helper
functions. Import `std.net` to use the `net.*` namespace, or import
`std.net.http` to use the focused `http.*` namespace directly.

The current transport is bounded and blocking. When the `http3` feature is
enabled, eligible direct HTTPS requests try HTTP/3 through Quinn and h3 first.
Transport failure falls back to HTTP/2 through TLS ALPN and then HTTP/1.1. An
HTTP/2 connection actor owns each negotiated socket, keeps a bounded request
queue, and dispatches response bodies on independent protocol streams. The
public call still drains one bounded response before returning; the actor is
an internal ownership boundary, not a public stream handle.
The Mux-level synchronous server accepts HTTP/1.x connections. The runtime
also exposes `Http3ServerTransport` for native integrations. It accepts DER
certificates and serves one bounded request at a time through a blocking
handler callback; it is not a separate Mux class.

HTTP operations return `result<value, HttpError>`. `HttpError.kind` is a
payload-less `HttpErrorKind` enum with `Invalid`, `Transport`, `Timeout`,
`Resolve`, `Protocol`, and `Status` variants. Compare or match that value
directly; do not classify errors by searching display strings. `detail`,
`status`, `method`, and `url` preserve the failure context. Use
`error.message()` for the provider detail or `error.to_string()` for a
decorated display string. `HttpError.from_message(text)` adapts an
application-level error at an HTTP boundary.

```mux
if error.kind == http.HttpErrorKind.Timeout {
    print("the HTTP request timed out")
}
```

### `Headers`

- `Headers.new() returns Headers`
- `headers.set(name, value) returns result<void, HttpError>` replaces all values.
- `headers.append(name, value) returns result<void, HttpError>` preserves another
  value (useful for `Set-Cookie` and other repeatable fields).
- Header mutation enforces the shared 128-field and 64 KiB total header budget;
  a rejected `set` or `append` leaves the collection unchanged.
- `headers.get(name) returns result<optional<string>, HttpError>` returns the first
  value, case-insensitively.
- `headers.values(name) returns result<list<string>, HttpError>` returns all values
  in append order.
- `headers.remove(name) returns result<void, HttpError>` removes all values.

### `HttpRequest` and `HttpResponse`

- `HttpRequest.new()` returns a default request with empty `method` and `url`,
  plus empty `headers` and `body` fields. It never takes parameters; assign the
  method and URL before `send()`.
- `HttpRequest.from_config(method, url, headers, body)` creates a fully
  configured request with explicit values.
- `request.method`, `request.url`, `request.request_id`, `request.proxy`, `request.headers`, and
  `request.body` are mutable request fields. A non-empty `proxy` URL overrides
  the environment proxy for that request; an empty value uses the environment
  defaults.
- Server-side requests always have a bounded `request_id`. Mux preserves a
  valid incoming `X-Request-ID` or generates one. Client requests with a
  non-empty `request_id` send it as `X-Request-ID` unless that header is already
  present.
- `request.connect_timeout_ms`, `request.timeout_ms`, `request.max_redirects`,
  `request.retries`, and `request.retry_backoff_ms` are mutable integer policy
  fields. Zero disables a timeout or redirect/retry count; timeout values are
  bounded to one day, redirects to 100, and retries to 10. Retries apply only
  to transport failures and use a bounded exponential backoff. The total
  request timeout is one deadline shared by all retry attempts and their
  backoff delays.
- `request.set_body_reader(reader) returns result<void, HttpError>` retains a
  single-use `io.Reader` and transmits it incrementally when `send()` runs.
  Reader-backed requests cannot use retries; use the ordinary `body` bytes
  field when a request must be replayable.
- Buffered byte bodies are limited to 16 MiB; oversized bodies assigned
  through `request.body` report the error immediately, just like
  `HttpRequest.from_config` and the explicit body setter. For larger uploads,
  attach a reader and apply
  `reader.limit(...)` when you want an explicit cap.
- Replacing `request.headers` or `response.headers` validates the complete
  collection before changing the object; oversized collections are rejected
  at the field-assignment boundary as well as when sent or written.
- `request.send() returns result<HttpResponse, HttpError>` performs one blocking
  request using the request's timeout, redirect, and retry fields. Defaults are
  a 10-second connect timeout, 30-second total timeout, and 10 redirects; a
  request that starts on HTTPS will not downgrade to HTTP.
- `HttpResponse.new()` returns a default 200 response with empty headers and
  body for server code or test doubles.
  Server code may assign the mutable `body` field directly before calling
  `write()`.
- `HttpResponse.from_config(status, headers, body)` creates a response from an
  explicit status code, `Headers`, and `bytes` body. Buffered response bodies
  are limited to 16 MiB; an oversized body is rejected by the constructor.
- `response.write(stream) returns result<void, HttpError>` writes one complete
  HTTP/1.x response to a TCP stream.
- `response.status`, `response.headers`, and `response.body` are mutable
  response fields. Assigning `body` resets the single-use body cursor; all
  three fields default to an empty/200 response from `new()` and can instead
  be supplied by `from_config`. Body assignment enforces the same 16 MiB
  buffered response-body limit.
- `response.status` is the integer status field; `response.headers` is the
  duplicate-aware `Headers` field.
- `response.error_for_status() returns result<HttpResponse, HttpError>` returns the
  same response for a 2xx status or a typed status error.
- `response.read_bytes(limit) returns result<bytes, HttpError>` consumes at most
  `limit` remaining bytes. Network responses retain a bounded reader and do
  not materialize the complete body before this call; constructed responses
  read from their in-memory body.
- `response.reader(limit) returns result<io.Reader, HttpError>` consumes at most
  `limit` bytes into a single-use reader for composable stream processing.
- `response.read_text(limit) returns result<string, HttpError>` consumes and
  strictly decodes UTF-8.
- `response.read_json(limit) returns result<Json, HttpError>` consumes and parses
  JSON explicitly.
- `response.save(path) returns result<void, HttpError>` consumes and saves the
  remaining body bytes.

For a server, `HttpRequest.read(stream)` parses one HTTP/1.x request into the
same typed request handle. Build a response with `HttpResponse.new()` and
assign its fields, or use `HttpResponse.from_config`, then call
`response.write(stream)`; request and response bodies remain ordinary
`bytes`, duplicate headers are preserved, and conflicting `Content-Length`
headers are rejected. HTTP/1.1 requests require exactly one non-empty `Host`
header; duplicate `Host` fields are rejected for all supported HTTP/1.x
requests. Parsed header names and values are validated before handlers see
them; the `Host` field is also checked as a URI authority (including
bracketed IPv6 and numeric ports). Chunked request bodies are decoded under the same
16 MiB limit; ambiguous `Transfer-Encoding`/`Content-Length` framing is
rejected, and chunked trailer fields are syntax-validated, bounded by the
configured header budget, and cannot contain `Content-Length` or
`Transfer-Encoding`. Response writing uses a fixed `Content-Length` for ordinary
responses and closes the connection, so caller-supplied `Transfer-Encoding` is
rejected. A caller-supplied `Connection` header must include `close` and must
not advertise `keep-alive`; use the writer's default when no connection header
is needed. `1xx`, `204`, and `304`
responses cannot carry content or a
`Content-Length`, and `205` responses require a zero-length body with
`Content-Length: 0`. When `HttpServer.serve_once` handles a `HEAD` request, the
handler may build the same representation response as for `GET`; the writer
preserves that representation length in `Content-Length` and omits the wire
body. Header fields crossing the client or server transport boundary are
bounded to 128 fields and 64 KiB total; oversized outgoing request headers,
remote response headers, and constructed response headers fail with an
`HttpError` before transport setup, response storage, or response output.

`HttpServerConfig.new()` creates a server configuration with safe defaults.
Its `max_header_bytes`, `max_body_bytes`, `max_headers`, `read_timeout_ms`, and
`access_log` fields can be adjusted directly. `access_log` defaults to `false`;
when enabled, each completed request writes a compact method/path/status log to
stderr without including headers or body contents. Control characters in the
request ID, method, and path are escaped before logging so a request cannot
forge additional log lines. Responses automatically
include `X-Request-ID` when one is available. Pass the config to
`HttpServer.serve_once(listener, config, handler)` to accept one connection,
parse one typed request, invoke a synchronous handler returning
`result<HttpResponse, HttpError>`, write the response, and close that
connection. The handler is validated before the server accepts a connection;
an absent or malformed callback therefore fails immediately instead of waiting
for a peer.
A handler error is rendered as a bounded plain-text response,
using its valid status or `500`; the listener remains open for the caller to
repeat the operation. Invalid limits return a typed `HttpError`;
`read_timeout_ms = 0` disables the read timeout.
All responses, including synthesized handler-error responses, are rejected
before writing when their buffered body exceeds 16 MiB.

The header limit applies only to the request's header block. If a single TCP
read also contains the beginning of the body, those body bytes do not consume
the header budget; the body is checked separately against `max_body_bytes`.

### `HttpRouter` and middleware

`HttpRouter.new()` creates an empty synchronous router. Add exact
method/path routes with `router.route(method, path, handler)`. Exact routes
outrank parameter routes, and more-specific parameter routes outrank less-
specific ones. Registration order resolves remaining ties. A missing route
returns a `404` `HttpError`.

Middleware is added with `router.middleware(callback)`. The callback receives
the request and an `HttpNext`; calling `next.handle(request)` continues to the
next middleware or the matching route. Middleware is run in registration
order, and may return a response directly (for example, to reject a request)
or inspect/modify the response returned by the next layer.

Routers also provide bounded, synchronous authentication middleware:
`router.basic_auth(username, password)` requires an RFC 7617 Basic
Authorization header, while `router.bearer_auth(token)` requires an exact RFC
6750 Bearer token. Both return `result<void, HttpError>`, add one middleware
layer at the point they are called, and continue to the next layer only when
credentials match. Failed authentication returns status 401 with the matching
WWW-Authenticate challenge and the generic unauthorized body. Credentials are
compared without logging their values; malformed headers and invalid configured
secrets are rejected.

OAuth/OIDC clients use `OAuthClient`. The client is a synchronous public-client
boundary. It requires an HTTPS issuer, a secure redirect URI, and explicit
scopes. `discover()` fetches the provider metadata and validates the issuer and
all advertised endpoints. `authorization_url(state, code_verifier, nonce)`
builds an authorization-code URL with S256 PKCE and an OIDC nonce. The token,
refresh, revocation, and introspection methods send bounded form requests and
return typed HTTP errors. A client secret is not accepted by this API.

`OAuthSession.from_token_response(response)` takes ownership of a bounded token
response. Its access, refresh, ID-token, expiry, refresh, introspection,
revocation, and `close()` methods keep token lifecycle explicit without
creating a browser session.

```mux
import std.net

func start_login() returns result<string, HttpError> {
    auto client = use net.OAuthClient.from_config(
        "https://issuer.example",
        "mux-web",
        "https://app.example/oauth/callback",
        "openid profile"
    )
    use client.discover()
    return client.authorization_url(
        "state-from-session",
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~abc",
        "nonce-from-session"
    )
}
```

The router also exposes a separate bearer-verification boundary through
`router.oauth_oidc(issuer, audience, jwks_url)`. It checks that the issuer and
JWKS URL are absolute HTTPS URLs without user info, query, or fragment data.
It checks that the audience is non-empty and contains no whitespace or control
characters. The middleware verifies RS256 JWTs against the configured JWKS
endpoint. It checks issuer, audience, expiry, optional not-before time, key id,
and signature. JWKS responses are bounded and cached for five minutes. Missing,
malformed, expired, or invalid tokens return `401`; a JWKS transport or parsing
failure returns a typed `HttpError` with status `503`.

```mux
import std.net

func main() returns void {
    auto router = net.HttpRouter.new()
    auto middleware = router.middleware(func(HttpRequest request, HttpNext next) returns result<HttpResponse, HttpError> {
        auto response_result = next.handle(request)
        if response_result.is_err() {
            return err(response_result.error())
        }
        auto response = response_result.value()
        response.headers = net.Headers.new()
        auto header_result = response.headers.set("X-Mux", "router")
        if header_result.is_err() {
            return err(header_result.error())
        }
        return ok(response)
    })
    if middleware.is_err() {
        return
    }
    auto route = router.route("GET", "/hello", func(HttpRequest request) returns result<HttpResponse, HttpError> {
        auto response = net.HttpResponse.new()
        response.body = b"hello"
        return ok(response)
    })
    if route.is_err() {
        return
    }

    // Adapt the router to the existing typed server handler contract.
    auto listener_result = net.TcpListener.bind("127.0.0.1:8080")
    if listener_result.is_err() {
        return
    }
    auto listener = listener_result.value()
    auto config = net.HttpServerConfig.new()
    auto served = net.HttpServer.serve(listener, config, func(HttpRequest request) returns result<HttpResponse, HttpError> {
        return router.handle(request)
    }, 1)
    return
}
```

Routes may capture one decoded segment with `{name}` or the remaining decoded
segments with `{...name}`. The catch-all must be the final segment. Matching
splits the request path before percent-decoding, so an encoded slash stays in
one capture. Queries are ignored. Exact literals outrank parameters, and
parameters outrank catch-alls. Duplicate capture names and ambiguous patterns
are rejected when the route is registered. Read a capture with
`request.path_param("name")`.

`HttpServerConfig` keeps CORS disabled unless `cors_origins` is set. It also
supports an explicit `static_root` for bounded GET and HEAD file serving, with
path traversal and symlink escapes rejected. `worker_count` defaults to one
and accepts values from 1 through 256. A larger value uses a bounded queue,
joins workers before returning, and keeps each socket in a connection actor.
Workers receive bounded owned request snapshots and return bounded response
snapshots. Handler captures use the same sendability check as `WorkerPool`, and
each worker receives its own capture snapshot. Resource handles in captures are
rejected. A value of one keeps deterministic request order.
`heartbeat_interval_ms` defaults to 15 seconds. SSE actors send a comment
heartbeat and WebSocket actors send a ping frame at that interval. Set it to
zero to disable server-owned heartbeats.
The private client actor negotiates HTTP/2 through TLS ALPN and falls back to
HTTP/1.1; the public request API remains synchronous and buffered.
For a deterministic synchronous lifecycle, `HttpServer.serve(listener, config,
handler, max_requests)` repeats the same operation for a bounded request count
and then returns; `max_requests` must be between 1 and 1,000,000.
For externally controlled shutdown, `HttpServer.serve_until_cancelled(listener,
config, handler, cancellation)` polls a `CancellationToken`, stops admitting
new connections after cancellation, drains queued worker jobs, and returns.
With `worker_count = 1`, the handler runs on the calling thread and may retain
state; larger worker pools give each worker a private snapshot of sendable
captures, so mutable state is not shared between handlers.

### Server-Sent Events

`SseEvent` frames one event according to the SSE wire format. It is a normal
typed value: `SseEvent.new()` starts with empty fields, while
`SseEvent.from_config(event, id, retry_ms, data)` is the explicit constructor.
Assign `event`, `id`, `retry_ms`, and `data` directly, then call `encode()` to
obtain bounded `bytes` for an ordinary `HttpResponse.body`. Empty `event` and
`id` fields are omitted; `retry_ms = 0` omits the retry field. CR/LF is rejected
in `event` and `id`, and newline-separated data is emitted as one `data:` line
per value.

```mux
import std.net

func make_event() returns result<bytes, HttpError> {
    auto event = net.SseEvent.new()
    event.event = "message"
    event.id = "42"
    event.data = "hello\nworld"
    return event.encode()
}
```

For a connected `TcpStream`, `SseStream.from_tcp(stream)` owns a bounded
long-lived writer. Call `send(event)` and `flush()` as needed; `close()`
releases the stream. Server-created streams receive comment heartbeats from the
runtime. The handle does not provide a client event iterator or automatic
retry policy.

### WebSocket handshake and frames

`std.net.websocket` provides explicit RFC 6455 handshake values and a bounded
single-frame codec. `WebSocketHandshake.request_key()` creates a random
client key; assign that key to the `Sec-WebSocket-Key` request header and use
`WebSocketHandshake.from_config(key, protocol)` on the server to produce the
`Sec-WebSocket-Accept` value and the HTTP 101 response headers. No HTTP request
is hidden by these helpers.

`WebSocketFrame.new()` starts as a final text frame with an empty payload.
Assign `fin`, `opcode`, `payload`, and `masked` directly, then call `encode()`;
`WebSocketFrame.decode(bytes)` reverses the operation and validates control
frame limits, canonical lengths, reserved bits, and final text-frame UTF-8.
Binary frames use opcode `2`, continuation `0`, close `8`, ping `9`, and pong
`10`. Payloads are bounded to 16 MiB. Masking is explicit: client frames
should set `masked = true`, while server frames normally leave it false.

Use `WebSocketFrame.reassemble(fragments)` to combine one bounded fragmented
message into a final frame. The list must begin with a non-final text or binary
frame and continue with continuation frames until the final one. Control
frames may be interleaved and are validated but are not included in the
message payload. The total message payload is bounded to 16 MiB, all frames
must use the same masking state, and a text message's UTF-8 is validated after
the fragments are joined.

```mux
import std.net.websocket

func encode_message() returns result<bytes, HttpError> {
    auto frame = websocket.WebSocketFrame.new()
    frame.opcode = 1
    frame.payload = b"hello"
    frame.masked = true
    return frame.encode()
}
```

For a connected `TcpStream`, `WebSocketSession.from_tcp(stream)` owns the
connection. `receive()` reads and reassembles data messages, answers ping
frames, and consumes pong frames. `send(frame)` writes a frame, and `close()`
sends a close frame and releases the connection. The runtime handles
fragmentation, ping/pong, and the close reply; application code still decides
when to read and what frames to send.

## Current limitations

See [hosted acceptance](../hosted-acceptance) for the CI jobs and exact tests
behind these limits.

- HTTPS client requests try HTTP/3 when the `http3` feature is enabled, then
  fall back to HTTP/2 and HTTP/1.1 when QUIC is unavailable. The native
  `Http3ServerTransport` handles one bounded request per blocking call; a
  long-lived server connection actor remains separate work.
- The server API handles HTTP/1.x connections. It does not automatically
  upgrade a routed request into an SSE or WebSocket session. Create
  `SseStream` or `WebSocketSession` from an already connected `TcpStream`.
- OAuth/OIDC registration verifies RS256 JWTs against a bounded, five-minute
  JWKS cache. It returns 401 for invalid credentials and a typed 503 for JWKS
  transport or parsing failures. Discovery and authorization-code flows are
  not part of this synchronous middleware API.
- Live PostgreSQL, MySQL, and SQL Server checks run in the runtime repository's
  Linux integration job. SQL Server uses an explicit certificate-verification
  opt-out for its disposable test service; production connections verify TLS
  by default. See [SQL provider checks](./sql.md#live-provider-checks) and the
  [hosted acceptance guide](../hosted-acceptance).

## Quick HTTP example

```mux
import std.net

func main() returns void {
    string target = "https://httpbin.org/post"
    auto request = net.HttpRequest.new()

    request.method = "POST"
    request.url = target
    Headers headers = net.Headers.new()
    auto header_result = headers.set("Content-Type", "text/plain")
    if header_result.is_err() {
        print("header error: " + header_result.error().message())
        return
    }
    request.headers = headers
    request.body = b"hello"

    auto response_result = request.send()
    if response_result.is_err() {
        print("http error: " + response_result.error().message())
        return
    }
    print(response_result.value().status.to_string())
    return
}
```

Binary request bodies use the `body` field exactly like text or JSON payloads
after the caller has encoded them. Response decoding is explicit:
consume bytes for binary data, text for strict UTF-8, or JSON after validating
the response media type in the application.

## Quick UDP example

```mux
import std.net

func udp_round_trip() returns result<int, NetError> {
    auto sock = use net.UdpSocket.bind("127.0.0.1:0")
    auto local = use sock.local_addr()
    auto data = b"test"
    use sock.send_to(data, local)
    auto datagram = use sock.recv_from(16)
    auto address = use datagram.address()
    assert(address == local, "address mismatch")
    auto payload = use datagram.bytes()
    assert(payload[0] == data[0], "data mismatch")
    auto truncated = use datagram.truncated()
    assert(!truncated, "datagram was truncated")
    sock.close()
    return ok(0)
}

func main() returns void {
    auto result = udp_round_trip()
    if result.is_err() {
        print(result.error().message())
        return
    }
    return
}
```
