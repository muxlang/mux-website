# URL

`std.net.url` provides validated RFC 3986 URLs for HTTP and other network
operations. A `Url` is an opaque value; component changes return a new validated
URL instead of accepting unchecked string concatenation.

## Import

```mux
import std.net.url
```

## `Url`

| Method                                                                                                                                                                             | Result                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `Url.parse(string)`                                                                                                                                                                | `result<Url, UrlError>`       |
| `Url.from_file(string)`                                                                                                                                                            | `result<Url, UrlError>`       |
| `to_string()`, `scheme()`, `username()`, `path()`, `origin()`, `redacted()`                                                                                                        | `string`                      |
| `password()`, `host()`, `query()`, `fragment()`                                                                                                                                    | `optional<string>`            |
| `host_ascii()`, `host_unicode()`                                                                                                                                                   | `result<string, UrlError>`    |
| `port()`                                                                                                                                                                           | `optional<int>`               |
| `join(string)`                                                                                                                                                                     | `result<Url, UrlError>`       |
| `with_path(string)`, `with_query(string)`, `with_fragment(string)`, `with_host(string)`, `with_port(int)`, `with_scheme(string)`, `with_username(string)`, `with_password(string)` | `result<Url, UrlError>`       |
| `query_pairs()`                                                                                                                                                                    | `list<tuple<string, string>>` |
| `with_query_pairs(list<tuple<string, string>>)`                                                                                                                                    | `result<Url, UrlError>`       |
| `to_file_path()`                                                                                                                                                                   | `result<string, UrlError>`    |
| `is_http()`, `is_https()`                                                                                                                                                          | `bool`                        |

`host_ascii()` and `host_unicode()` provide explicit IDNA conversion while
leaving IP literals unchanged. Query pairs preserve duplicate keys and their order. `redacted()` replaces a
password before rendering the URL. Parsing performs URL validation and applies
only the normalization required by the URL parser.

`UrlError` implements `Error`. Its `kind` is the typed `url.UrlErrorKind` enum
with `Invalid`, `Unsupported`, and `Parse` variants; `detail` contains the
stable message and `url` contains URL context when available. Compare or match
the enum directly, and use `message()` or `to_string()` when displaying it.

## Example

```mux title="url_example.mux"
import std.net.url

func run_url() returns result<int, UrlError> {
    auto value = use url.Url.parse("https://user:secret@example.com/search?a=1&a=2")
    print(value.redacted())
    print(value.query_pairs().size().to_string())

    auto with_port = use value.with_port(9443)
    print(with_port.to_string())

    auto next = use value.join("../next")
    print(next.to_string())
    return ok(1)
}

func main() returns void {
    auto result = run_url()
    if result.is_err() {
        print(result.error().message())
    }
    return
}
```
