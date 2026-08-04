import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";

const textExtensions = new Set([
  ".cjs",
  ".env",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".ps1",
  ".sh",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const privateKeyHeader = ["-----BEGIN", "(?:RSA |EC |DSA )?PRIVATE KEY-----"].join(" ");
const openSshPrivateKeyHeader = ["-----BEGIN", "OPENSSH PRIVATE KEY-----"].join(" ");

const secretPatterns = [
  { label: "OpenSSH private key material", pattern: new RegExp(openSshPrivateKeyHeader, "u") },
  { label: "PEM private key material", pattern: new RegExp(privateKeyHeader, "u") },
  { label: "GitHub classic access token", pattern: /\bgh[opurs]_[A-Za-z0-9]{36,255}\b/u },
  { label: "GitHub fine-grained access token", pattern: /\bgithub_pat_[A-Za-z0-9_]{40,255}\b/u },
  { label: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/u },
  { label: "AWS access key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u },
];

/** @param {string} sourceText */
export function scanSecretText(sourceText) {
  return secretPatterns.filter(({ pattern }) => pattern.test(sourceText)).map(({ label }) => label);
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

export function checkSecrets(files = trackedFiles()) {
  const violations = [];

  for (const filePath of files) {
    const normalizedPath = filePath.replaceAll("\\", "/");
    if (/\/(?:\.env|id_(?:rsa|dsa|ecdsa|ed25519))(?:\.|$)/u.test(`/${normalizedPath}`)) {
      if (!normalizedPath.endsWith(".env.example")) {
        violations.push(`${normalizedPath}: secret-bearing filename cannot be committed`);
      }
    }

    const extension = normalizedPath.endsWith(".env.example") ? ".env" : extname(normalizedPath);
    if (!textExtensions.has(extension)) {
      continue;
    }

    let sourceText;
    try {
      sourceText = readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    for (const label of scanSecretText(sourceText)) {
      violations.push(`${normalizedPath}: ${label}`);
    }
  }

  return violations;
}

function main() {
  const violations = checkSecrets();
  if (violations.length > 0) {
    process.stderr.write(`${violations.join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("Secret policy passed.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
