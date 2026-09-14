---
title: Crypto
---

# `std.crypto`

`std.crypto` exposes bytes-only hashing, HMAC, secure random generation,
and authenticated encryption. It does not accept strings as implicit byte
containers, and it does not provide password hashing, signatures, or key
exchange.

Fallible operations return `CryptoError`, with read-only `kind` and `detail`
fields plus `message()` and `to_string()`. `kind` is the typed
`crypto.CryptoErrorKind` enum (`Invalid`, `Unsupported`, `Authentication`, or
`Io`); it is not a string that callers need to parse.

| Function                                        | Signature                                                   | Description                                                         |
| ----------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| `crypto.sha256(data)`                           | `bytes -> bytes`                                            | SHA-256 digest.                                                     |
| `crypto.sha512(data)`                           | `bytes -> bytes`                                            | SHA-512 digest.                                                     |
| `crypto.sha3_256(data)` / `sha3_512`            | `bytes -> bytes`                                            | SHA-3 digest.                                                       |
| `crypto.blake3(data)`                           | `bytes -> bytes`                                            | BLAKE3 digest.                                                      |
| `crypto.hmac_sha256(key, data)` / `hmac_sha512` | `bytes, bytes -> result<bytes, CryptoError>`                | Keyed message authentication.                                       |
| `crypto.random_bytes(length)`                   | `int -> result<bytes, CryptoError>`                         | Secure random bytes, bounded to 16 MiB.                             |
| `crypto.random_token(length)`                   | `int -> result<string, CryptoError>`                        | URL-safe, unpadded token from the requested number of random bytes. |
| `crypto.generate_key()`                         | `() -> result<bytes, CryptoError>`                          | Generate a 32-byte AEAD key.                                        |
| `crypto.seal_aes256_gcm(key, data, aad)`        | `bytes, bytes, bytes -> result<bytes, CryptoError>`         | Seal data with AES-256-GCM.                                         |
| `crypto.seal_chacha20_poly1305(key, data, aad)` | `bytes, bytes, bytes -> result<bytes, CryptoError>`         | Seal data with ChaCha20-Poly1305.                                   |
| `crypto.open(key, sealed, aad)`                 | `bytes, bytes, bytes -> result<bytes, CryptoError>`         | Authenticate and open either self-describing sealed format.         |
| `crypto.seal_file(key, input, output, aad)`     | `bytes, string, string, bytes -> result<void, CryptoError>` | Stream-encrypt a file in authenticated 1 MiB records.               |
| `crypto.open_file(key, input, output, aad)`     | `bytes, string, string, bytes -> result<void, CryptoError>` | Authenticate and stream-decrypt an encrypted file.                  |

Keys must be exactly 32 bytes. The sealed format includes a magic header,
version, algorithm identifier, random nonce, ciphertext, and authentication
tag. Associated data is authenticated but is not encrypted.

File operations require different input and output files. The runtime resolves
existing paths (including symlinks) and compares native file identities (so
hard-link aliases are covered) before opening the destination. An in-place
request fails without truncating the input. Each operation writes beside the
destination in a private temporary file and atomically publishes it only after
all records have been authenticated and flushed. Therefore an authentication,
read, or write failure leaves an existing destination unchanged and does not
leave partial plaintext or ciphertext at the requested output path. The
temporary file must be on the same filesystem as the destination, as required
for atomic replacement.

Encrypted files use format version 2. Each record authenticates the header,
a random file identity, its position, and its length. A required authenticated
final record detects missing trailing records, including in empty files.
Records copied from another encrypted file fail authentication. Version 1
files are rejected. Unix temporary outputs use mode 0600; Windows outputs
inherit the destination directory's access controls.

```mux
import std.crypto

func round_trip() returns result<int, CryptoError> {
    auto data = b"hello"
    print(crypto.sha256(data).size().to_string())

    auto key = use crypto.generate_key()
    auto sealed = use crypto.seal_aes256_gcm(key, data, b"context")
    auto plain = use crypto.open(key, sealed, b"context")
    print((plain == data).to_string())
    return ok(0)
}

func main() returns void {
    auto result = round_trip()
    if result.is_err() {
        print(result.error().message())
        return
    }
    return
}
```
