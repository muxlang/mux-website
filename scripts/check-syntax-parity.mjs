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
// This is a PARITY CHECK ONLY, not a generator. It fails if either website copy
// is MISSING a canonical keyword or type (the drift we care about), or if it
// carries an unexpected website-only token that is not on the documented
// allowlist below. Generating the files from canonical is a follow-up.
//
// Canonical source resolution (first match wins):
//   1. CLI argument: node check-syntax-parity.mjs <path-or-url>
//   2. env MUX_SYNTAX_MATRIX (a local file path)
//   3. fetch the published spec from CANONICAL_URL (default; used in CI)

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const CANONICAL_URL =
  'https://raw.githubusercontent.com/muxlang/mux-syntax-highlighting/main/shared/syntax-matrix.json';

// Tokens the website intentionally treats as keywords/types even though the
// canonical spec does not list them as such. Keep this list small and justified.
//
// ok / err / some: enum variant identifiers. The canonical matrix explicitly
//   notes "some/ok/err are enum variant identifiers, not keywords", but the
//   playground editor highlights them as keywords for readability.
// ref: a reference marker highlighted as a keyword in the playground; canonical
//   models references via the '&' (Ref) operator symbol, not a word keyword.
const ALLOWED_EXTRA = {
  'monaco:keywords': new Set(['ok', 'err', 'some', 'ref']),
  'monaco:types': new Set(),
  'shiki:keywords': new Set(),
  'shiki:types': new Set(),
};

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

async function loadCanonical() {
  const source = process.argv[2] || process.env.MUX_SYNTAX_MATRIX;
  if (source && !/^https?:\/\//.test(source)) {
    const raw = await readFile(resolve(source), 'utf8');
    return { matrix: JSON.parse(raw), from: source };
  }
  const url = source || CANONICAL_URL;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`failed to fetch canonical spec: ${res.status} ${res.statusText} (${url})`);
  }
  return { matrix: await res.json(), from: url };
}

// Canonical keyword set: union of every categorized keyword list. The matrix
// also has a "reserved" convenience array (a subset) and a "note" string; the
// union is robust to both (reserved adds nothing new; note is skipped as a
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
  const re = new RegExp(`\\n\\s*${name}:\\s*\\[([\\s\\S]*?)\\]`);
  const m = src.match(re);
  if (!m) throw new Error(`could not find "${name}" array in muxLanguage.ts`);
  const set = new Set();
  for (const lit of m[1].matchAll(/'([^']+)'/g)) set.add(lit[1]);
  return set;
}

// Extract word alternatives from a regex alternation like `\b(?:a|b|c)\b` or
// `(a|b|c)`. Non-word alternatives (e.g. a `[A-Z][a-zA-Z0-9_]*` catch-all) are
// dropped: we only compare literal keyword/type words.
function wordsFromRegex(pattern) {
  const words = new Set();
  const cleaned = pattern.replace(/\\b/g, '');
  for (const group of cleaned.matchAll(/\((?:\?:)?([^()]*)\)/g)) {
    for (const alt of group[1].split('|')) {
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
    if (p.name?.startsWith('keyword.') || p.name === 'constant.language') {
      for (const w of wordsFromRegex(p.match)) set.add(w);
    }
  }
  return set;
}

function shikiTypes(grammar) {
  const set = new Set();
  const patterns = grammar.repository?.types?.patterns ?? [];
  for (const p of patterns) {
    if (p.name === 'storage.type' && p.match) {
      for (const w of wordsFromRegex(p.match)) set.add(w);
    }
  }
  return set;
}

function sorted(set) {
  return [...set].sort();
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
  if (missing.length) lines.push(`    missing from website (present in canonical): ${missing.join(', ')}`);
  if (extra.length) {
    lines.push(`    unexpected website-only tokens (not canonical, not allowlisted): ${extra.join(', ')}`);
    lines.push('    -> add them to canonical syntax-matrix.json, or to ALLOWED_EXTRA with a reason.');
  }
  errors.push(lines.join('\n'));
}

async function main() {
  const { matrix, from } = await loadCanonical();
  console.log(`canonical: ${from}`);

  const canonKeywords = canonicalKeywords(matrix);
  const canonTypes = canonicalTypes(matrix);

  const monacoSrc = await readFile(resolve(REPO_ROOT, 'src/monaco/muxLanguage.ts'), 'utf8');
  const shikiGrammar = JSON.parse(await readFile(resolve(REPO_ROOT, 'src/shiki/mux.json'), 'utf8'));

  const errors = [];
  compare('monaco:keywords', canonKeywords, monacoArray(monacoSrc, 'keywords'), errors);
  compare('monaco:types', canonTypes, monacoArray(monacoSrc, 'typeKeywords'), errors);
  compare('shiki:keywords', canonKeywords, shikiKeywords(shikiGrammar), errors);
  compare('shiki:types', canonTypes, shikiTypes(shikiGrammar), errors);

  if (errors.length) {
    console.error('\nSyntax parity check FAILED:\n');
    console.error(errors.join('\n\n'));
    console.error('\nThe website copies have drifted from canonical syntax-matrix.json.');
    process.exit(1);
  }
  console.log('\nSyntax parity check passed: Monaco and Shiki are in sync with canonical.');
}

main().catch((err) => {
  console.error(`syntax parity check errored: ${err.message}`);
  process.exit(1);
});
