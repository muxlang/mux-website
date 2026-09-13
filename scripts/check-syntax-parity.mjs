// Parity check: verify the website's hand-maintained Mux language definitions
// stay in sync with the canonical syntax spec.
//
// The website keeps two copies of the Mux keyword/type sets:
//   - src/monaco/muxLanguage.ts  (playground editor: keywords/typeKeywords arrays)
//   - src/shiki/mux.json         (docs code blocks: regex alternations)
//
// The source of truth is shared/syntax-matrix.json in
// muxlang/mux-syntax-highlighting. Neither website copy references it, so they
// silently drift when the spec changes (e.g. a new keyword landing).
//
// This is a parity check, not a generator. The website copies are deliberately
// committed because Docusaurus and the playground consume their native
// formats. It fails if either copy is MISSING a canonical keyword or type, or
// carries an unexpected website-only token that is not on the documented
// allowlist below. A syntax change is incomplete until this gate passes; the
// canonical repository remains the only place where the token set is edited.
//
// Canonical source resolution (first match wins):
//   1. CLI argument: node check-syntax-parity.mjs <path-or-url>
//   2. env MUX_SYNTAX_MATRIX (a local file path)
//   3. fetch the published spec from CANONICAL_URL (default; used in CI)

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, sep } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const CANONICAL_URL =
  "https://raw.githubusercontent.com/muxlang/mux-syntax-highlighting/main/shared/syntax-matrix.json";

// Tokens the website intentionally treats as keywords/types even though the
// canonical spec does not list them as such. Keep this list small and justified.
//
// ok / err / some: enum variant identifiers. The canonical matrix explicitly
//   notes "some/ok/err are enum variant identifiers, not keywords", but the
//   playground editor highlights them as keywords for readability.
// ref: a reference marker highlighted as a keyword in the playground; canonical
//   models references via the '&' (Ref) operator symbol, not a word keyword.
const ALLOWED_EXTRA = {
  "monaco:keywords": new Set(["ok", "err", "some", "ref"]),
  "monaco:types": new Set(),
  "shiki:keywords": new Set(),
  "shiki:types": new Set(),
};

const IDENT = /^[a-zA-Z_]\w*$/;

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

function canonicalFailure(source, reason, actions) {
  return new Error(
    [
      "Unable to load the canonical syntax matrix.",
      `Selected source: ${source}`,
      `Reason: ${reason}`,
      "Next steps:",
      ...actions.map((action) => `  - ${action}`),
    ].join("\n"),
  );
}

function validateCanonicalMatrix(matrix, source) {
  if (matrix === null || typeof matrix !== "object" || Array.isArray(matrix)) {
    throw canonicalFailure(source, "the JSON root is not an object", [
      "Check that the source is shared/syntax-matrix.json from mux-syntax-highlighting.",
    ]);
  }
  if (
    matrix.keywords === null ||
    typeof matrix.keywords !== "object" ||
    Array.isArray(matrix.keywords)
  ) {
    throw canonicalFailure(source, "the JSON object has no keywords map", [
      "Use the canonical shared/syntax-matrix.json file instead of a generated grammar or HTML response.",
    ]);
  }
  if (!matrix.types || !Array.isArray(matrix.types.builtin)) {
    throw canonicalFailure(source, "the JSON object has no types.builtin array", [
      "Use the canonical shared/syntax-matrix.json file instead of a generated grammar or HTML response.",
    ]);
  }
  const invalidKeywordList = Object.entries(matrix.keywords).find(
    ([name, value]) =>
      name !== "note" &&
      (!Array.isArray(value) || value.some((token) => typeof token !== "string")),
  );
  if (invalidKeywordList) {
    throw canonicalFailure(
      source,
      `keyword category "${invalidKeywordList[0]}" is not a string array`,
      ["Check out the canonical syntax repository at the revision used by this check."],
    );
  }
  if (matrix.types.builtin.some((token) => typeof token !== "string")) {
    throw canonicalFailure(source, "types.builtin contains a non-string token", [
      "Check out the canonical syntax repository at the revision used by this check.",
    ]);
  }
}

async function loadCanonical() {
  const source = process.argv[2] || process.env.MUX_SYNTAX_MATRIX;
  const sourceLabel = process.argv[2]
    ? `CLI argument ${JSON.stringify(process.argv[2])}`
    : process.env.MUX_SYNTAX_MATRIX
      ? `MUX_SYNTAX_MATRIX=${JSON.stringify(process.env.MUX_SYNTAX_MATRIX)}`
      : `default URL ${CANONICAL_URL}`;
  if (source && !/^https?:\/\//.test(source)) {
    // A local override path is a maintainer convenience for offline testing.
    // Validate the canonicalized path stays inside the repo so a stray or
    // traversal path can never read arbitrary files off disk.
    const resolved = resolve(REPO_ROOT, source);
    if (resolved !== REPO_ROOT && !resolved.startsWith(REPO_ROOT + sep)) {
      throw canonicalFailure(sourceLabel, `local path is outside the website checkout: ${source}`, [
        "Pass a canonical JSON file under this website checkout, or remove the local override to use the published URL.",
      ]);
    }
    let raw;
    try {
      raw = await readFile(resolved, "utf8");
    } catch (error) {
      throw canonicalFailure(sourceLabel, `could not read ${resolved}: ${errorText(error)}`, [
        `Check that ${resolved} exists and is readable.`,
        "Pass the canonical shared/syntax-matrix.json file, not a generated grammar or a directory.",
      ]);
    }
    let matrix;
    try {
      matrix = JSON.parse(raw);
    } catch (error) {
      throw canonicalFailure(sourceLabel, `invalid JSON in ${resolved}: ${errorText(error)}`, [
        "Replace the local file with an unmodified shared/syntax-matrix.json file.",
      ]);
    }
    validateCanonicalMatrix(matrix, sourceLabel);
    return { matrix, from: resolved };
  }
  const url = source || CANONICAL_URL;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    throw canonicalFailure(sourceLabel, `HTTPS request failed: ${errorText(error)}`, [
      `Check outbound HTTPS access to ${url} and rerun the command.`,
      "For an offline check, pass a canonical JSON file under this website checkout with MUX_SYNTAX_MATRIX or the CLI argument.",
    ]);
  }
  if (!res.ok) {
    throw canonicalFailure(sourceLabel, `HTTPS returned ${res.status} ${res.statusText}`, [
      `Check that ${url} is reachable and still points to the canonical syntax repository.`,
      "For an offline check, pass a canonical JSON file under this website checkout with MUX_SYNTAX_MATRIX or the CLI argument.",
    ]);
  }
  let matrix;
  try {
    matrix = await res.json();
  } catch (error) {
    throw canonicalFailure(
      sourceLabel,
      `the HTTPS response was not valid JSON: ${errorText(error)}`,
      [
        `Check that ${url} returns raw JSON rather than an HTML error page.`,
        "For an offline check, pass a canonical JSON file under this website checkout with MUX_SYNTAX_MATRIX or the CLI argument.",
      ],
    );
  }
  validateCanonicalMatrix(matrix, sourceLabel);
  return { matrix, from: url };
}

// Canonical keyword set: union of every categorized keyword list. The matrix
// also has a "reserved" convenience array (a subset) and a "note" string; the
// union handles both (reserved adds nothing new; note is skipped as a
// non-array).
function canonicalKeywords(matrix) {
  const out = new Set();
  for (const value of Object.values(matrix.keywords ?? {})) {
    if (Array.isArray(value)) {
      for (const kw of value) out.add(kw);
    }
  }
  return out;
}

function canonicalTypes(matrix) {
  return new Set(matrix.types?.builtin ?? []);
}

// Extract the string literals inside a named array in the Monaco TS source,
// e.g. `keywords: [ 'auto', 'func', ... ]`. Anchored on a newline + indentation
// so `keywords` does not also match `typeKeywords`/`builtinTypes`.
function monacoArray(src, name) {
  const re = new RegExp(String.raw`\n\s*${name}:\s*\[([\s\S]*?)\]`);
  const m = src.match(re);
  if (!m) throw new Error(`could not find "${name}" array in muxLanguage.ts`);
  const set = new Set();
  // Match single- or double-quoted string literals so a future reformat of
  // muxLanguage.ts to double quotes does not silently empty the set.
  for (const lit of m[1].matchAll(/['"]([^'"]+)['"]/g)) set.add(lit[1]);
  return set;
}

// Extract word alternatives from a regex alternation like `\b(?:a|b|c)\b` or
// `(a|b|c)`. Non-word alternatives (e.g. a `[A-Z][a-zA-Z0-9_]*` catch-all) are
// dropped: we only compare literal keyword/type words.
function wordsFromRegex(pattern) {
  const words = new Set();
  const cleaned = pattern.replaceAll(String.raw`\b`, "");
  for (const group of cleaned.matchAll(/\((?:\?:)?([^()]*)\)/g)) {
    for (const alt of group[1].split("|")) {
      const token = alt.trim();
      if (IDENT.test(token)) words.add(token);
    }
  }
  return words;
}

function shikiKeywords(grammar) {
  const set = new Set();
  const patterns = grammar.repository?.keywords?.patterns ?? [];
  for (const p of patterns) {
    if (!p.match) continue;
    // Collect keyword-scoped and language-constant patterns; the lone
    // `storage.type` -> `\bauto\b` entry is redundant (auto is already a
    // declaration keyword) and skipped to avoid noise.
    if (p.name?.startsWith("keyword.") || p.name === "constant.language") {
      for (const w of wordsFromRegex(p.match)) set.add(w);
    }
  }
  return set;
}

function shikiTypes(grammar) {
  const set = new Set();
  const patterns = grammar.repository?.types?.patterns ?? [];
  for (const p of patterns) {
    if (p.name === "storage.type" && p.match) {
      for (const w of wordsFromRegex(p.match)) set.add(w);
    }
  }
  return set;
}

function sorted(set) {
  return [...set].sort((a, b) => a.localeCompare(b));
}

// Compare one website set against canonical. Missing canonical tokens always
// fail. Extra tokens fail unless on the documented allowlist for that set.
function compare(label, canonical, actual, errors) {
  const missing = sorted(canonical).filter((t) => !actual.has(t));
  const allowed = ALLOWED_EXTRA[label] ?? new Set();
  const extra = sorted(actual).filter((t) => !canonical.has(t) && !allowed.has(t));

  if (missing.length === 0 && extra.length === 0) {
    console.log(`  ok  ${label} (${actual.size} tokens, in sync with canonical)`);
    return;
  }
  const lines = [`FAIL ${label}`];
  if (missing.length)
    lines.push(`    missing from website (present in canonical): ${missing.join(", ")}`);
  if (extra.length) {
    lines.push(
      `    unexpected website-only tokens (not canonical, not allowlisted): ${extra.join(", ")}`,
      "    -> add them to canonical syntax-matrix.json, or to ALLOWED_EXTRA with a reason.",
    );
  }
  errors.push(lines.join("\n"));
}

async function main() {
  const { matrix, from } = await loadCanonical();
  console.log(`canonical: ${from}`);

  const canonKeywords = canonicalKeywords(matrix);
  const canonTypes = canonicalTypes(matrix);

  const monacoSrc = await readFile(resolve(REPO_ROOT, "src/monaco/muxLanguage.ts"), "utf8");
  const shikiGrammar = JSON.parse(await readFile(resolve(REPO_ROOT, "src/shiki/mux.json"), "utf8"));

  const errors = [];
  compare("monaco:keywords", canonKeywords, monacoArray(monacoSrc, "keywords"), errors);
  compare("monaco:types", canonTypes, monacoArray(monacoSrc, "typeKeywords"), errors);
  compare("shiki:keywords", canonKeywords, shikiKeywords(shikiGrammar), errors);
  compare("shiki:types", canonTypes, shikiTypes(shikiGrammar), errors);

  if (errors.length) {
    throw new Error(
      `Syntax parity check FAILED:\n\n${errors.join("\n\n")}\n\nThe website copies have drifted from canonical syntax-matrix.json.`,
    );
  }
  console.log("\nSyntax parity check passed: Monaco and Shiki are in sync with canonical.");
}

try {
  await main();
} catch (err) {
  throw new Error(`syntax parity check failed:\n${errorText(err)}`, { cause: err });
}
