import { execFileSync } from "node:child_process";

const supported = /^(src|scripts|workers|tools)\/.*\.(?:ts|tsx|js|jsx|mjs|css)$/;

function gitFiles(args) {
  try {
    return execFileSync("/usr/bin/git", ["diff", "--name-only", "--diff-filter=ACMR", ...args], {
      encoding: "utf8",
      env: { ...process.env, PATH: "/usr/bin:/bin" },
    })
      .split("\n")
      .map((file) => file.trim())
      .filter(Boolean);
  } catch (error) {
    console.error("Unable to determine changed files for the format check.");
    process.exit(error.status ?? 1);
  }
}

const baseRef = process.env.GITHUB_BASE_REF;
const formatFiles = baseRef
  ? gitFiles([`origin/${baseRef}...HEAD`]).filter((file) => supported.test(file))
  : [...new Set([...gitFiles([]), ...gitFiles(["--cached"])])].filter((file) =>
      supported.test(file),
    );

if (formatFiles.length === 0) {
  console.log("No changed source files require formatting.");
  process.exit(0);
}

const prettier = new URL("../node_modules/prettier/bin/prettier.cjs", import.meta.url);
execFileSync(process.execPath, [prettier, "--check", ...formatFiles], {
  stdio: "inherit",
  env: { ...process.env, PATH: "/usr/bin:/bin" },
});
