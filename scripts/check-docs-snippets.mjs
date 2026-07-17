// Compile check for the Mux code in docs/.
//
// Why: the docs deploy from main on every merge, but the playground runs the
// RELEASED compiler pinned in muxlang/mux-website-api (Dockerfile ARG
// MUX_VERSION). Docs that teach unreleased syntax go live while the playground
// still rejects it - that skew shipped once with the `{:}` empty-map literal.
// This check compiles every complete example with the same released compiler
// the playground runs, so the gap fails CI instead of reaching users.
//
// What is checked, per docs file:
//   - <EmbeddedPlayground initialCode={`...`}> blocks: always compiled - this
//     is exactly the code users run against the live playground.
//   - ```mux fences containing a `func main(` definition: compiled as complete
//     programs. Fences without one are illustrative fragments and are skipped.
//   - ```mux fences with a title="name.mux" meta are written into the working
//     directory under that name first, so a later example in the same docs
//     file can `import name`. Keep titles in sync with the import names.
//   - A fence that intentionally does not compile (an error example) opts out
//     with `no-compile` in the meta: ```mux no-compile
//
// The compiler binary comes from $MUX_BIN (default: `mux` on PATH). CI
// installs the release resolved from the playground's Dockerfile pin; see
// .github/workflows/ci.yml. Snippets are compiled only, never run.

import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileP = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DOCS_ROOT = resolve(REPO_ROOT, 'docs');

const MUX_BIN = process.env.MUX_BIN || 'mux';
const COMPILE_TIMEOUT_MS = 60_000;

const MAIN_RE = /\bfunc\s+main\s*\(/;
// Titles may carry a subdirectory (title="operations/basic.mux") so dotted
// imports resolve; path segments are strictly [word.-] so a title can never
// escape the working directory.
const FENCE_TITLE_RE = /\btitle="((?:[\w-]+\/)*[\w-][\w.-]*\.mux)"/;

async function docsFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await docsFiles(path)));
    } else if (['.md', '.mdx'].includes(extname(entry.name))) {
      out.push(path);
    }
  }
  return out;
}

// Extract every compilable block from a docs source, in document order:
// ```mux fences (with meta and 1-based start line) and EmbeddedPlayground
// initialCode template literals (always complete programs).
function muxBlocks(source) {
  const blocks = [];
  const lines = source.split('\n');
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (open) {
      if (/^\s*```\s*$/.test(line)) {
        blocks.push({ ...open, body: open.body.join('\n') });
        open = null;
      } else {
        open.body.push(line);
      }
      continue;
    }
    const m = line.match(/^\s*```mux\b(.*)$/);
    if (m) {
      open = { kind: 'fence', line: i + 1, meta: m[1].trim(), body: [] };
    }
  }

  // `initialCode` need not be the first attribute (e.g. `<EmbeddedPlayground
  // height={400} initialCode={`...`}>`), so match it regardless of position.
  // Skipping such a block would be exactly the silent-omission failure this
  // tool exists to catch.
  for (const m of source.matchAll(/<EmbeddedPlayground\b[\s\S]*?initialCode=\{`([\s\S]*?)`\}/g)) {
    const line = source.slice(0, m.index).split('\n').length;
    // Template literals escape backticks and interpolation starts.
    const body = m[1].replaceAll('\\`', '`').replaceAll('\\${', '${');
    blocks.push({ kind: 'playground', line, meta: '', body });
  }

  return blocks.sort((a, b) => a.line - b.line);
}

async function compile(snippetPath, outPath) {
  try {
    await execFileP(MUX_BIN, ['build', basename(snippetPath), '-o', outPath], {
      timeout: COMPILE_TIMEOUT_MS,
      cwd: dirname(snippetPath),
    });
    return null;
  } catch (err) {
    if (err.killed) return `compile timed out after ${COMPILE_TIMEOUT_MS / 1000}s`;
    return (err.stderr || err.stdout || err.message).trim();
  }
}

// Classify a block into what the checker should do with it: skip it (an
// intentional error example or an illustrative fragment), write it as an
// importable module without compiling, or compile it as a complete program.
function classifyBlock(block) {
  if (/\bno-compile\b/.test(block.meta)) return { action: 'opt-out' };
  const title = block.meta.match(FENCE_TITLE_RE)?.[1];
  const isProgram = block.kind === 'playground' || MAIN_RE.test(block.body);
  if (!title && !isProgram) return { action: 'fragment' };
  return { action: isProgram ? 'compile' : 'module', title };
}

// Compile every complete example in one docs file, writing titled fences as
// importable modules first so a later example on the same page can import them.
// Returns per-file tallies and any compile failures.
async function checkFile(file, workRoot) {
  const rel = relative(REPO_ROOT, file);
  const workDir = join(workRoot, rel.replaceAll('/', '__'));
  await mkdir(workDir, { recursive: true });

  const result = { compiled: 0, fragments: 0, optedOut: 0, failures: [] };
  let n = 0;
  for (const block of muxBlocks(await readFile(file, 'utf8'))) {
    const { action, title } = classifyBlock(block);
    if (action === 'opt-out') {
      result.optedOut++;
      continue;
    }
    if (action === 'fragment') {
      result.fragments++;
      continue;
    }
    const snippetPath = join(workDir, title ?? `snippet_${n}.mux`);
    await mkdir(dirname(snippetPath), { recursive: true });
    await writeFile(snippetPath, block.body + '\n');
    if (action === 'module') continue; // importable definition, not a program
    const error = await compile(snippetPath, join(workDir, `snippet_${n}.out`));
    n++;
    result.compiled++;
    if (error) result.failures.push({ rel, line: block.line, error });
  }
  return result;
}

function reportFailures(failures) {
  console.error(`\nDocs snippet check FAILED (${failures.length} snippet(s)):\n`);
  for (const f of failures) {
    console.error(`--- ${f.rel}:${f.line}\n${f.error}\n`);
  }
  console.error(
    'These examples do not compile with the released compiler the playground runs.\n' +
      'If the docs are ahead of the release, hold this change until the release ships\n' +
      '(see mux-context docs/release-process.md). An intentional error example opts\n' +
      'out with `no-compile` in the fence meta.',
  );
}

async function main() {
  const version = await execFileP(MUX_BIN, ['version'], { timeout: 15_000 });
  console.log(`compiler: ${version.stdout.trim()}`);

  const workRoot = await mkdtemp(join(tmpdir(), 'mux-docs-snippets-'));
  const totals = { compiled: 0, fragments: 0, optedOut: 0, failures: [] };
  try {
    for (const file of (await docsFiles(DOCS_ROOT)).sort()) {
      const r = await checkFile(file, workRoot);
      totals.compiled += r.compiled;
      totals.fragments += r.fragments;
      totals.optedOut += r.optedOut;
      totals.failures.push(...r.failures);
    }
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }

  console.log(
    `compiled ${totals.compiled} complete example(s); skipped ${totals.fragments} fragment(s) and ${totals.optedOut} no-compile fence(s)`,
  );
  if (totals.failures.length) {
    reportFailures(totals.failures);
    process.exit(1);
  }
  console.log('Docs snippet check passed.');
}

try {
  await main();
} catch (err) {
  console.error(`docs snippet check errored: ${err.message}`);
  process.exit(1);
}
