import { describe, expect, it } from "vitest";

import { classifyAuditReport } from "./npm-audit-gate.mjs";

const bracesAdvisory = {
  name: "braces",
  severity: "high",
  url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
};

describe("root website npm audit exception", () => {
  it("allows the known braces advisory through high-severity dependency paths", () => {
    const report = {
      vulnerabilities: {
        braces: { severity: "high", via: [bracesAdvisory] },
        micromatch: { severity: "high", via: ["braces"] },
        "@docusaurus/core": { severity: "high", via: ["micromatch"] },
      },
    };

    expect(classifyAuditReport(report)).toEqual({ blocking: [], allowedCount: 3 });
  });

  it("keeps different high and critical advisories blocking", () => {
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

    expect(classifyAuditReport(report)).toEqual({
      blocking: ["other (high)", "critical (critical)"],
      allowedCount: 1,
    });
  });

  it("fails closed when a transitive advisory cannot be resolved", () => {
    const report = {
      vulnerabilities: {
        "@docusaurus/core": { severity: "high", via: ["missing-package"] },
      },
    };

    expect(classifyAuditReport(report)).toEqual({
      blocking: ["@docusaurus/core (high)"],
      allowedCount: 0,
    });
  });

  it("does not fail for moderate findings under the high-severity gate", () => {
    const report = {
      vulnerabilities: {
        moderate: { severity: "moderate", via: [{ name: "moderate", severity: "moderate" }] },
      },
    };

    expect(classifyAuditReport(report)).toEqual({ blocking: [], allowedCount: 0 });
  });
});
