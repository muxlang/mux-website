import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const ALLOWED_ADVISORY = {
  packageName: "braces",
  severity: "high",
  url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
};

const severityRank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

export function isExplainedOnlyByAllowedAdvisory(packageName, vulnerabilities, path = new Set()) {
  const vulnerability = vulnerabilities[packageName];
  if (!vulnerability || !Array.isArray(vulnerability.via) || vulnerability.via.length === 0) {
    return false;
  }
  if (path.has(packageName)) return false;

  const nextPath = new Set(path);
  nextPath.add(packageName);

  return vulnerability.via.every((cause) => {
    if (typeof cause === "string") {
      const child = vulnerabilities[cause];
      if (!child) return false;
      if ((severityRank[child.severity] ?? 0) < severityRank.high) return true;
      return isExplainedOnlyByAllowedAdvisory(cause, vulnerabilities, nextPath);
    }

    if (!cause || typeof cause !== "object") return false;
    if ((severityRank[cause.severity] ?? 0) < severityRank.high) return true;

    return (
      cause.name === ALLOWED_ADVISORY.packageName &&
      cause.severity === ALLOWED_ADVISORY.severity &&
      cause.url === ALLOWED_ADVISORY.url
    );
  });
}

export function classifyAuditReport(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    throw new Error("npm audit returned an invalid JSON report");
  }
  if (report.error) {
    throw new Error(`npm audit failed: ${JSON.stringify(report.error)}`);
  }
  if (!report.vulnerabilities || typeof report.vulnerabilities !== "object") {
    throw new Error("npm audit report has no vulnerabilities map");
  }

  const findings = Object.entries(report.vulnerabilities).filter(
    ([, vulnerability]) => (severityRank[vulnerability?.severity] ?? 0) >= severityRank.high,
  );
  const blocking = findings
    .filter(([name]) => !isExplainedOnlyByAllowedAdvisory(name, report.vulnerabilities))
    .map(([name, vulnerability]) => `${name} (${vulnerability.severity})`);

  return { blocking, allowedCount: findings.length - blocking.length };
}

function runAudit() {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["audit", "--json", "--audit-level=high"], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`npm audit exited unexpectedly with status ${result.status}: ${result.stderr}`);
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`npm audit did not return valid JSON: ${error}`);
  }

  const { blocking, allowedCount } = classifyAuditReport(report);
  if (blocking.length > 0) {
    throw new Error(`Unresolved high or critical npm advisories: ${blocking.join(", ")}`);
  }
  if (result.status === 1 && allowedCount === 0) {
    throw new Error("npm audit failed without reporting an allowlisted advisory");
  }

  if (allowedCount > 0) {
    console.warn(
      `Temporarily allowing ${allowedCount} high-severity package paths for ${ALLOWED_ADVISORY.url}. All other high and critical advisories remain blocking.`,
    );
  } else {
    console.log("No high or critical npm advisories found.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    runAudit();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
