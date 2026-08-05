import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const sourceExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const infrastructureImports = [
  "@google/genai",
  "bullmq",
  "drizzle-orm",
  "ioredis",
  "mysql2",
  "postgres",
];

/**
 * @param {string} filePath
 * @param {string} sourceText
 */
export function findForbiddenImports(filePath, sourceText) {
  const normalizedPath = filePath.replaceAll("\\", "/");
  const errors = [];

  if (
    sourceText.includes("@google/genai") &&
    normalizedPath !== "packages/ai/src/providers/gemini/client.ts"
  ) {
    errors.push("@google/genai imports are restricted to packages/ai/src/providers/gemini");
  }

  if (sourceText.includes("@aws-sdk") && !normalizedPath.startsWith("packages/object-storage/")) {
    errors.push("AWS SDK imports are restricted to packages/object-storage");
  }

  const downstreamOpportunityDomains = [
    "apps/web/",
    "packages/notifications/",
    "services/notification-delivery/",
    "services/opportunity-ranking/",
    "services/opportunity-scoring/",
    "services/proposal-generation/",
  ];
  if (
    downstreamOpportunityDomains.some((prefix) => normalizedPath.startsWith(prefix)) &&
    (sourceText.includes("@jovia/opportunity-ingestion") ||
      sourceText.includes("apps/worker/src/adapters/scheduler"))
  ) {
    errors.push(
      "Downstream matching and notification domains cannot schedule or import source ingestion",
    );
  }

  if (/drizzle-orm\/mysql|from ["']mysql2["']|from ["'][^"']*tidb/i.test(sourceText)) {
    errors.push("MySQL and TiDB imports are prohibited");
  }

  if (
    normalizedPath.startsWith("apps/web/") &&
    /@jovia\/(database|auth\/adapters)/.test(sourceText)
  ) {
    errors.push("The web application cannot import server infrastructure packages");
  }

  if (normalizedPath.startsWith("services/")) {
    for (const packageName of infrastructureImports) {
      if (
        sourceText.includes(`from "${packageName}"`) ||
        sourceText.includes(`from '${packageName}'`)
      ) {
        errors.push(`Service libraries cannot import infrastructure package ${packageName}`);
      }
    }
  }

  if (
    /manus/i.test(sourceText) &&
    !normalizedPath.endsWith("check-architecture.test.ts") &&
    !normalizedPath.endsWith("check-architecture.mjs")
  ) {
    errors.push("Manus runtime references are prohibited");
  }

  return errors;
}

/** @param {string} workflowText */
export function findMutableActionReferences(workflowText) {
  return [...workflowText.matchAll(/uses:\s+[^\s]+@(v\d+|main|master)\b/g)].map(
    (match) => match[0],
  );
}

function trackedFiles() {
  return execFileSync(
    "git",
    ["-c", `safe.directory=${process.cwd()}`, "ls-files", "-co", "--exclude-standard"],
    {
      encoding: "utf8",
    },
  )
    .split(/\r?\n/u)
    .filter(Boolean);
}

export function checkArchitecture(files = trackedFiles()) {
  const violations = [];

  for (const filePath of files) {
    const normalizedPath = filePath.replaceAll("\\", "/");
    const extensionIndex = normalizedPath.lastIndexOf(".");
    const extension = extensionIndex >= 0 ? normalizedPath.slice(extensionIndex) : "";

    if (
      (normalizedPath.startsWith("apps/") ||
        normalizedPath.startsWith("packages/") ||
        normalizedPath.startsWith("services/")) &&
      sourceExtensions.has(extension)
    ) {
      const sourceText = readFileSync(filePath, "utf8");
      for (const message of findForbiddenImports(normalizedPath, sourceText)) {
        violations.push(`${normalizedPath}: ${message}`);
      }
    }

    if (normalizedPath.startsWith(".github/workflows/") && /\.ya?ml$/u.test(normalizedPath)) {
      const workflowText = readFileSync(filePath, "utf8");
      for (const reference of findMutableActionReferences(workflowText)) {
        violations.push(`${normalizedPath}: mutable GitHub Action reference ${reference}`);
      }
    }
  }

  return violations;
}

function main() {
  const violations = checkArchitecture();
  if (violations.length > 0) {
    process.stderr.write(`${violations.join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("Architecture policy passed.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
