import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

let repoRoot = resolve(process.cwd());
while (!existsSync(join(repoRoot, "scripts/check-syntax-parity.mjs"))) {
  const parent = dirname(repoRoot);
  if (parent === repoRoot) throw new Error("could not find website checkout");
  repoRoot = parent;
}
const script = join(repoRoot, "scripts/check-syntax-parity.mjs");

function run(source) {
  const result = spawnSync(process.execPath, [script, source], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status === 0) {
    throw new Error("syntax parity unexpectedly succeeded");
  }
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

describe("canonical syntax source errors", () => {
  it("explains how to repair a missing local source", () => {
    const directory = mkdtempSync(join(repoRoot, "scripts/.syntax-parity-test-"));
    try {
      const source = relative(repoRoot, join(directory, "missing.json"));
      const output = run(source);
      expect(output).toContain("Unable to load the canonical syntax matrix.");
      expect(output).toContain("could not read");
      expect(output).toContain("exists and is readable");
      expect(output).toContain("shared/syntax-matrix.json");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects valid JSON that is not the canonical matrix shape", () => {
    const directory = mkdtempSync(join(repoRoot, "scripts/.syntax-parity-test-"));
    try {
      const sourcePath = join(directory, "wrong-shape.json");
      writeFileSync(sourcePath, JSON.stringify({ generated: true }));
      const output = run(relative(repoRoot, sourcePath));
      expect(output).toContain("the JSON object has no keywords map");
      expect(output).toContain("generated grammar or HTML response");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
