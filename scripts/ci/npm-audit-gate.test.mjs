import assert from "node:assert/strict";
import test from "node:test";

import { classifyAuditReport } from "./npm-audit-gate.mjs";

const bracesAdvisory = {
  name: "braces",
  severity: "high",
  url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
};

test("allows the known braces advisory through high-severity dependency paths", () => {
  const report = {
    vulnerabilities: {
      braces: { severity: "high", via: [bracesAdvisory] },
      micromatch: { severity: "high", via: ["braces"] },
      "@docusaurus/core": { severity: "high", via: ["micromatch"] },
    },
  };

  assert.deepEqual(classifyAuditReport(report), { blocking: [], allowedCount: 3 });
});

test("keeps a different high-severity advisory blocking", () => {
  const report = {
    vulnerabilities: {
      braces: { severity: "high", via: [bracesAdvisory] },
      other: {
        severity: "high",
        via: [{ name: "other", severity: "high", url: "https://example.com/advisory" }],
      },
      critical: {
        severity: "critical",
        via: [{ name: "critical", severity: "critical", url: "https://example.com/critical" }],
      },
    },
  };

  assert.deepEqual(classifyAuditReport(report), {
    blocking: ["other (high)", "critical (critical)"],
    allowedCount: 1,
  });
});

test("fails closed when a transitive advisory cannot be resolved", () => {
  const report = {
    vulnerabilities: {
      "@docusaurus/core": { severity: "high", via: ["missing-package"] },
    },
  };

  assert.deepEqual(classifyAuditReport(report), {
    blocking: ["@docusaurus/core (high)"],
    allowedCount: 0,
  });
});

test("does not fail for moderate findings under the high-severity gate", () => {
  const report = {
    vulnerabilities: {
      moderate: { severity: "moderate", via: [{ name: "moderate", severity: "moderate" }] },
    },
  };

  assert.deepEqual(classifyAuditReport(report), { blocking: [], allowedCount: 0 });
});
