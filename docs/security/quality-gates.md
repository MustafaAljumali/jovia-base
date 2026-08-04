# Security and Quality Gates

Every change must pass `pnpm check`. The command enforces formatting, zero-warning
linting, strict TypeScript, unit coverage thresholds, production builds,
architecture boundaries, tracked-file secret patterns, and a high-severity package
audit. CI additionally fails dependency review at moderate severity, scans complete
Git history with Gitleaks, runs CodeQL, and executes PostgreSQL/Redis integration
tests.

GitHub Actions are pinned to reviewed 40-character commit SHAs. Container images
are pinned to manifest digests. Dependency versions are exact, the lockfile is
frozen in CI, package lifecycle scripts are deny-by-default, and explicit build
allowances live in `pnpm-workspace.yaml`.

## Handling findings

Never suppress or lower a gate merely to merge. Record the package/path, advisory
or rule, exploitability, chosen remediation, owner, and review date. A temporary
exception requires Product Owner and security approval, an expiry date, and a
compensating control. Secrets found in history must be revoked before history is
cleaned; deleting a file is not credential rotation.

All commits and release tags in this repository are required to use SSH signing.
The development key fingerprint and setup procedure are documented separately;
private material and passphrases remain outside the repository.
