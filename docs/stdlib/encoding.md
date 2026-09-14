# std.encoding - text and byte encodings

`std.encoding` contains deterministic conversions between ordinary text and
byte sequences. Hex, Base32, Base64 (including URL-safe Base64), Base58, and percent
encoding are available. All in-memory decoders validate their alphabet and return
`result<bytes, encoding.EncodingError>` on malformed input.

`EncodingError` implements `Error` and exposes `codec`, typed `kind`, `detail`,
and `offset` fields. `kind` is an `EncodingErrorKind` enum; use
`error.kind_name()` when a stable display label is needed. `offset` is `-1`
when an error is not tied to one input position; otherwise it identifies the
zero-based character or byte offset. Use `error.message()` for a human-readable
description.

## Import

```mux
import std.encoding
```

## Hexadecimal

`hex_encode(bytes)` returns lowercase hexadecimal with exactly two digits
per byte. `hex_decode(string)` accepts upper- or lowercase hexadecimal and
returns `result<bytes, encoding.EncodingError>`. It rejects odd-length input and reports
the byte offset of an invalid pair.

```mux
import std.encoding

func main() returns void {
    bytes input = b"\x00\xff"
    print(encoding.hex_encode(input))

    auto decoded = encoding.hex_decode("00FF2a")
    if decoded.is_err() {
        print(decoded.error().message())
        return
    }
    auto values = decoded.value()
    print(values[2].to_string())
    return
}
```

For machine-readable handling, inspect the structured fields directly:

```mux
auto decoded = encoding.hex_decode("G0")
if decoded.is_err() {
    auto error = decoded.error()
    if error.kind == encoding.EncodingErrorKind.InvalidByte {
        print("the input contains a malformed byte")
    }
    print(error.codec + " " + error.kind_name() + " at " + error.offset.to_string())
}
```

## Streaming hex

`hex_encode_stream(reader, writer)` and `hex_decode_stream(reader, writer)`
process UTF-8 hexadecimal data incrementally in fixed-size chunks. The matching
`base64_encode_stream` and `base64_decode_stream` functions preserve 3-byte and
4-character framing across reads and reject padding followed by more input.
The matching `base32_encode_stream` and `base32_decode_stream` functions do the
same for 5-byte and 8-character RFC 4648 groups. All six functions return
`result<void, encoding.EncodingError>` and flush the writer after the final chunk. The reader's
configured limit remains the input bound, so callers can stream files or
sockets without first materializing the complete payload.

`ascii85_encode_stream` and `ascii85_decode_stream` use the same incremental
contract for 4-byte groups and 5-character groups, including the `z` zero
shorthand and canonical final groups.

`base58_encode_stream` and `base58_decode_stream` use the same bounded
Reader/Writer contract. Base58 has no independent framing, so they consume the
reader to EOF (respecting its configured limit), then emit the canonical result
and flush the writer; callers still avoid an unbounded allocation or a
format-specific file API.

`utf16_encode_stream`/`utf16_decode_stream` and
`utf32_encode_stream`/`utf32_decode_stream` bridge UTF-8 reader input/output
to explicit-endian code units. They retain incomplete UTF-8 sequences,
surrogate pairs, and code units across reads, validate Unicode scalars, and
consume or emit a BOM only at the stream boundary.

The streaming adapters retain the `std.io` Reader/Writer boundary and return
`result<void, encoding.EncodingError>`. I/O failures are reported as
`EncodingError` values with codec `io` and kind `read`, `write`, or `flush`, so
callers can handle in-memory and streaming failures through one typed contract.

## Base64 and Base32

`base64_encode` and `base64_decode` use the standard padded alphabet.
`base64url_encode` and `base64url_decode` use the URL-safe alphabet and omit
padding; the URL-safe decoder rejects `=`, `+`, and `/` rather than accepting
standard Base64 spellings. Decoders reject
non-canonical encodings with non-zero trailing bits. `base32_encode` and
`base32_decode` use RFC 4648's
uppercase alphabet with padding.
Base32 decoding also rejects invalid padding lengths and non-zero trailing bits,
so alternate spellings of the same payload are not silently accepted.

`base58_encode` and `base58_decode` use the Bitcoin alphabet (without
ambiguous `0`, `O`, `I`, or `l` characters and without padding).

`ascii85_encode` and `ascii85_decode` use the compact ASCII85 alphabet without
Adobe `<~`/`~>` delimiters. Four zero bytes use the `z` shorthand. Final groups
may contain two through four characters; malformed characters, one-character
final groups, overflow, and non-canonical groups are rejected.

## Percent encoding

`percent_encode` leaves RFC 3986 unreserved ASCII bytes unchanged and escapes
all other bytes as `%NN`. `percent_decode` accepts those escapes and preserves
every unescaped ASCII byte, including punctuation; it rejects truncated
escapes and non-ASCII unescaped characters. `percent_decode_form` follows the
same rule after converting `+` to a space.

For protocol components, use `percent_encode_path` (preserves `/`),
`percent_encode_query` (preserves query delimiters), or
`percent_encode_form` (maps spaces to `+`). `percent_decode_form` reverses the
form convention and still validates every escape.

## UTF-16 and UTF-32

`utf8_encode` returns the UTF-8 bytes for a string. `utf8_decode` validates
UTF-8 strictly and returns an error for malformed sequences;
`utf8_decode_lossy` replaces malformed sequences with U+FFFD.

`utf16_encode`/`utf16_decode` and `utf32_encode`/`utf32_decode` accept an
explicit endianness flag and an explicit BOM flag. Decoders reject truncated
code units, invalid Unicode scalars, and unpaired UTF-16 surrogates; BOM
consumption is opt-in. They use `bytes` so results can be passed directly
to byte-oriented I/O.
