---
title: Command-line interface
---

# `std.cli`

`std.cli` provides a typed parser builder with explicit returned outcomes.
`CliParser.new()` starts with an empty parser; configuration methods mutate the
shared parser handle and return `result<void, CliError>`. `CliError` exposes
portable `kind` and `detail` fields plus `message()`/`to_string()`. `kind` is
the typed `cli.CliErrorKind` enum (`Invalid`, `Parse`, or `Io`); use it for
branching and use `detail` or `message()` for human-readable text.

```mux
import std.cli

func main() returns void {
    auto parser = cli.CliParser.new()
    auto program_result = parser.set_program("backup")
    if program_result.is_err() {
        print(program_result.error().message())
        return
    }
    auto option_result = parser.add_option("output", "o", true, true)
    if option_result.is_err() {
        print(option_result.error().message())
        return
    }
    auto env_result = parser.set_option_env("output", "BACKUP_OUTPUT")
    if env_result.is_err() {
        print(env_result.error().message())
        return
    }
    auto positional_result = parser.add_positional("source", true)
    if positional_result.is_err() {
        print(positional_result.error().message())
        return
    }

    auto parsed = parser.parse_process()
    if parsed.is_err() {
        print(parsed.error().message())
        return
    }
    auto matches = parsed.value()

    auto output_result = matches.get("output")
    if output_result.is_err() {
        print(output_result.error().message())
        return
    }
    auto output = output_result.value()
    if output.is_some() {
        print(output.value())
    }
    return
}
```

`parse(args)` accepts an explicit `list<string>`; `parse_process()` reads the
process arguments after the executable name. Long options support
`--name=value`, short options support `-n value` and bundled flags, and `--`
ends option parsing. Precedence is arguments, then the configured environment
variable, then the declared default. Repeated options are rejected unless
`set_option_multiple(name, true)` is enabled.

Use `set_option_conflicts(name, other)` to reject combinations such as
`--json` and `--plain`, and `set_option_requires(name, other)` to require a
related option whenever the first one is present. Both declarations are
validated while configuring the parser; violations are returned as structured
`CliError` values that can be propagated or displayed with `message()`.

`set_option_alias(name, alias)` adds another long spelling that stores under
the canonical option name and appears in generated help.

`set_option_parser(name, callback)` attaches a synchronous typed parser to an
option. The callback receives each raw value from arguments, the environment,
or the declared default and returns `result<string, string>`. The successful
string is stored in `CliMatches`; an error becomes a parse error:

```mux
auto parser_result = parser.set_option_parser(
    "mode",
    func(string value) returns result<string, string> {
        if value == "fast" {
            return ok("FAST")
        }
        if value == "safe" {
            return ok("SAFE")
        }
        return err("mode must be fast or safe")
    }
)
```

The callback is synchronous and must not retain its argument. Custom parsers
run after normal source precedence is resolved and before parsed matches are
returned.

Use `set_option_group(name, group)` to place an option under a named section in
help and manpage output. Group names are presentation-only and do not change
parsing or precedence.

Nested commands use a child parser returned by `add_subcommand(name, about)`.
Configure that parser with the same option and positional methods as the root:

```mux
auto command_result = parser.add_subcommand("serve", "run the server")
if command_result.is_err() {
        print(command_result.error().message())
    return
}
auto serve = command_result.value()
auto port_result = serve.add_option("port", "p", true, true)
if port_result.is_err() {
        print(port_result.error().message())
    return
}
```

When parsing, the first positional command name selects the child parser. The
returned `CliMatches.subcommand()` identifies it, and
`subcommand_matches()` returns the nested matches when a command was selected.
Both values are optional when parsing root-only arguments.

Response files are opt-in: `parser.set_response_files(true)` enables `@path`
arguments. Their contents use whitespace-separated arguments with single or
double quotes, backslash escapes, and `#` comments. Response files may include
other response files up to eight levels deep; `@@value` passes a literal
`@value`. Files must be valid UTF-8 and are bounded to 16 MiB. Read and syntax
errors are returned from `parse`; expansion is capped at one million arguments.

`CliMatches.has`, `get`, `values`, and `positional` expose parsed values without
printing or exiting. `help()` returns deterministic help text; applications
choose how and where to display it.

For conventional command-line behavior, `parser.parse_or_exit()` reads process
arguments, prints `--help`/`-h` and configured `--version` values to stdout,
and exits successfully. Invalid arguments are printed to stderr and exit with
status 2. This helper is opt-in; `parse_process()` always returns outcomes.

`parser.completion(shell)` returns deterministic completion text for `bash`,
`zsh`, or `fish`. Unsupported shells are returned as parse/configuration
errors; the method never installs files or modifies the process environment.

`parser.manpage()` returns deterministic roff text containing `NAME`,
`SYNOPSIS`, and `OPTIONS` sections. Applications can write it wherever they
publish manual pages; the stdlib does not touch the filesystem.

`CliMatches.get_int`, `get_float`, and `get_bool` convert an option on demand
and return an optional typed value. Invalid text is a returned error rather
than a process exit; boolean values accept `true`/`false`, `1`/`0`, `yes`/`no`,
and `on`/`off`.
