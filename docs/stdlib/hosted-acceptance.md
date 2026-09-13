---
title: Hosted acceptance
---

# Hosted acceptance for the standard library

The standard library is implemented in [mux-runtime](https://github.com/muxlang/mux-runtime).
This repository checks the documentation and playground sources. Runtime CI
owns service-backed database tests and native-host tests. Keeping those jobs in
the runtime repository means they exercise the code that compiled Mux programs
actually link.

## Which job proves what

| Area                                     | Authoritative job                                                                                                                                                                                 | What a green run proves                                                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website and examples                     | [website CI](https://github.com/muxlang/mux-website/blob/main/.github/workflows/ci.yml) and [docs snippets](https://github.com/muxlang/mux-website/blob/main/.github/workflows/docs-snippets.yml) | The site builds, syntax definitions match the canonical matrix, and complete Mux examples compile against the playground compiler.                             |
| PostgreSQL, MySQL, and SQL Server        | [runtime integration](https://github.com/muxlang/mux-runtime/blob/main/.github/workflows/integration.yml)                                                                                         | Linux runtime tests run with all three service containers and the live driver fixtures are required.                                                           |
| Linux, macOS, and Windows                | [runtime platform smoke](https://github.com/muxlang/mux-runtime/blob/main/.github/workflows/platform-smoke.yml)                                                                                   | The runtime workspace checks and tests on each native host.                                                                                                    |
| HTTP/1.1, HTTP/2, HTTP/3, and OAuth/OIDC | Runtime `net_unit` tests and the manually dispatched hosted HTTP acceptance workflow                                                                                                              | Local tests cover protocol state, cancellation, and invalid credentials. The hosted workflow probes configured endpoints and requires the negotiated protocol. |

Website CI does not turn a documentation build into runtime acceptance. A
runtime change needs a green runtime workflow, and a docs change needs the
website checks. For a coordinated PR, the docs-snippet job pins the matching
compiler and runtime branch commits so examples are checked against the same
stdlib surface. When both repositories change together, run both sets of jobs.

## SQL Server acceptance

The runtime integration job starts these containers on Linux:

- PostgreSQL 16 on port 5432
- MySQL 8 on port 3306
- SQL Server 2022 on port 1433

The job sets these variables before running the fixtures:

```text
MUX_TEST_POSTGRES_URL=postgres://mux:pass@localhost:5432/muxdb
MUX_TEST_MYSQL_URL=mysql://root:pass@localhost:3306/muxdb
MUX_TEST_SQLSERVER_URL=sqlserver://sa:<test-password>@localhost:1433/master?trustServerCertificate=true
```

The shared SQL command requires the PostgreSQL and MySQL variables. The
separate SQL Server command requires `MUX_TEST_SQLSERVER_URL`:

```bash
./scripts/ci/run-live-sql.sh
./scripts/ci/run-live-sqlserver.sh
```

Run those commands from the root of a checkout of mux-runtime after the
services pass their health checks. If a required variable is empty, the script
exits with status 2 before Cargo starts. That is a wiring failure, not a test
skip. The SQL Server fixture checks a native TDS connection, a query, leased
result-set behavior, EOF and explicit close, and connection reuse.

The SQL Server service uses a test certificate, so its CI URL explicitly sets
`trustServerCertificate=true`. That option is only for the disposable service.
The provider verifies certificates by default when that option is absent. A
green container run therefore proves driver behavior against SQL Server, but it
does not prove a production certificate chain. A production acceptance job
must provide a CA-backed certificate and omit the opt-out.

The local unit suite still covers malformed SQL Server URLs, URI decoding,
portable placeholders, and connection failures without a database. Those tests
are useful when no service is available, but they do not replace the hosted
fixture.

## macOS and Windows acceptance

The runtime platform workflow uses this matrix:

| Host    | Runner           |
| ------- | ---------------- |
| Linux   | `ubuntu-latest`  |
| macOS   | `macos-14`       |
| Windows | `windows-latest` |

Each leg runs `scripts/ci/platform_smoke.py`. The runner executes these two
commands with a process-tree timeout:

```text
cargo check --locked --all-features --workspace --all-targets
cargo test --locked --all-features --workspace
```

The Python runner builds the argument list directly and stops child processes
when a command times out. This keeps the Windows leg independent of Bash and
PowerShell quoting. The matrix checks the runtime on native hosts; it does not
provide the Linux database containers, so the service-backed SQL tests remain
in the integration job.

To reproduce the platform checks on a native machine:

```bash
python3 scripts/ci/platform_smoke.py
```

On Windows, run the same command with `python` if that is the installed
launcher. The script accepts `--cargo` and `--timeout-seconds` for a local
toolchain or a slower machine.

## HTTP protocol acceptance

The manually dispatched `Hosted HTTP Acceptance` workflow runs
`scripts/ci/run-http-acceptance.sh` against three configured endpoints. Set
these repository secrets before dispatching it:

```text
MUX_HTTP1_URL
MUX_HTTP2_URL
MUX_HTTP3_URL
```

Optional bearer tokens use `MUX_HTTP1_BEARER_TOKEN`,
`MUX_HTTP2_BEARER_TOKEN`, and `MUX_HTTP3_BEARER_TOKEN`. The script requires a
curl build with HTTP/2 and HTTP/3 support, forces each protocol, follows only
HTTPS redirects, bounds the response body, and fails if the peer negotiates a
different version. Missing endpoint secrets fail before curl runs.

## HTTP/3 and QUIC

The runtime's opt-in `http3` feature provides synchronous client and server
transports using Quinn and h3. HTTPS requests try HTTP/3 before the HTTP/2 and
HTTP/1.1 paths. Transport failure falls back to those protocols; protocol and
size failures remain typed. `Http3ServerTransport` accepts DER certificates
and serves one bounded request at a time through a blocking handler callback.
Client deadlines cancel queued requests and drop in-flight h3 streams.

The local CI check covers protocol selection and typed failure mapping:

```bash
cargo test --locked --all-features --test net_unit \
  http3_selection_prefers_quic_and_rejects_unknown_protocols
```

A green result proves local selector and server-configuration behavior. The
hosted endpoint probe proves wire negotiation and a bounded response. A deeper
QUIC fixture should also cover:

1. Use a controlled HTTPS endpoint with UDP connectivity and a certificate
   trusted by the runner.
2. Assert that the peer negotiated `h3`; accepting an HTTP/2 or HTTP/1.1
   fallback must fail the test.
3. Exchange headers and a bounded body, then exercise QPACK decode errors,
   stream reset, flow control, and cancellation.

## OAuth and OIDC verification

The `OAuthClient` public-client API performs HTTPS discovery and authorization
code flow support with S256 PKCE and an OIDC nonce. It returns bounded JSON
documents for token exchange, refresh, introspection, and revocation. It does
not accept client secrets or keep browser sessions. A hosted OAuth fixture
must provide a real issuer and test discovery, state and nonce round trips,
PKCE verification, token refresh, introspection, and revocation.

`router.oauth_oidc(issuer, audience, jwks_url)` validates its configuration
and installs a typed RS256 middleware boundary. It requires HTTPS issuer and
JWKS URLs without user info, query, or fragment data, and it rejects an empty
or malformed audience.

The middleware contract is:

- A missing or malformed Bearer header returns HTTP 401.
- A valid RS256 JWT is checked against the configured JWKS key and claims.
- Invalid credentials return HTTP 401.
- A JWKS fetch or parse failure returns a typed HTTP 503.
- Discovery, PKCE, nonce, refresh, introspection, revocation, and sessions are
  outside this synchronous middleware method. `OAuthClient` owns the client
  calls; the router middleware only verifies bearer tokens.

The focused boundary test covers configuration and invalid-token outcomes:

```bash
cargo test --locked --all-features --test net_unit \
  oauth_oidc_boundary_validates_metadata_and_rejects_unverified_tokens
```

The hosted fixture should run an ephemeral HTTPS issuer and test a valid
signature, wrong issuer and audience, expired tokens, unsupported algorithms,
key rotation, and a JWKS failure. It should assert that no request reaches the
protected handler before verification succeeds.

## Change checklist

When changing one of these contracts:

1. Update the runtime fixture or boundary test that proves the behavior.
2. Update the owning runtime workflow if a service, host, or required variable
   changes.
3. Update the relevant stdlib page and this acceptance page.
4. Run website CI, including syntax parity and docs snippets, for the docs
   changes.

Never make a hosted job pass by treating a missing service variable or an
unsupported protocol as success. The output should say exactly which contract
the job checked.
