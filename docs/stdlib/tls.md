---
title: TLS
---

# `std.net.tls`

`TlsStream.connect(server_name, address)` opens a verified synchronous TLS
client stream using the bundled public root set. Reads and writes are ordinary
`bytes`; `flush` and `shutdown` are explicit operations.

Connection, handshake, configuration, flush, shutdown, and inspection
operations return `TlsError`; its `kind` is the typed `tls.TlsErrorKind` enum
(`Invalid`, `Io`, `Timeout`, `Handshake`, `Certificate`, `Unsupported`, or
`Protocol`) and `detail` remains textual. Compare enum variants directly and
use `message()`/`to_string()` for display. Stream `read` and `write` operations
use the common `IoError` contract from `std.io`.

Certificate verification is enabled by default. Invalid DNS names, transport
failures, handshake failures, and I/O failures are returned as typed errors;
there is no implicit verification bypass.

For private PKI, `TlsStream.connect_with_roots(server_name, address, roots)`
accepts a non-empty `list<bytes>` of DER-encoded root certificates. Supplying
roots replaces the bundled public roots for that connection; malformed or
empty certificates are reported before the handshake.

Mutual TLS uses `TlsStream.connect_with_client_cert(server_name, address,
roots, certificates, private_key)`. The root list and client certificate chain
are non-empty `list<bytes>` values; the private key is DER bytes. The client
certificate and key are validated before a stream is returned.

Use `TlsStream.connect_with_client_cert_config` with the same certificate
arguments plus a `TlsConfig` when a mutual-TLS client also needs explicit
protocol, cipher-suite, or ALPN policy.

Servers can wrap an accepted TCP stream with
`TlsStream.accept(stream, certificates, private_key)`. Certificates are a
non-empty `list<bytes>` of DER certificates (leaf first, followed by its
chain), and `private_key` is PKCS#8 DER bytes. The handshake remains
synchronous and certificate/key configuration errors are returned before the
stream is created.

After a handshake has completed, negotiated parameters can be inspected with
`peer_certificates()`, `protocol_version()`, `cipher_suite()`, and
`alpn_protocol()`. The first returns the peer's DER chain; the latter three
return the negotiated version/name or ALPN bytes. These methods return an
explicit error until negotiation has completed (or when the peer selected no
ALPN protocol).

## Policy configuration

`TlsConfig.new()` starts with the verified defaults (TLS 1.2 through TLS 1.3,
the provider's safe cipher suites, and no ALPN list). Configure it before
passing it to `TlsStream.connect_with_config` or
`TlsStream.accept_with_config`:

```mux
import std.net.tls

func configure_tls() returns result<void, TlsError> {
    auto config = use tls.TlsConfig.new()
    use config.set_protocols("TLS1.2", "TLS1.3")
    return config.set_alpn_protocols([b"h2", b"http/1.1"])
}

func main() returns void {
    auto result = configure_tls()
    if result.is_err() {
        print(result.error().message())
    }
    return
}
```

`set_cipher_suites` accepts rustls suite names such as
`"TLS13_AES_256_GCM_SHA384"`; an empty or unsupported selection is rejected
before a connection is opened. `set_alpn_protocols` takes non-empty byte
protocol names up to 255 bytes each. Policy changes affect later handshakes;
existing streams are unchanged.
