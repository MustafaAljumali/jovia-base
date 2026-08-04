---
document: Jovia Repository Guide
version: 1.0.0
status: Approved
authority: Repository Operations Guide
ai_context: Always Read
read_before:
  - Jovia_Engineering_Constitution_v2.0.md
  - docs/adr/ADR-0001-production-monorepo-foundation.md
read_after: []
owner: Jovia Core Team
last_revised: 2026-08-04
last_verified: 2026-08-04
---

# Jovia

Jovia is an AI operating system for freelancers. This repository is the official
source of truth for its product documentation and production implementation.

## Governing Documents

Read these before changing code or architecture:

1. `Jovia_Engineering_Constitution_v2.0.md`
2. `Jovia_Strategic_Product_Vision.md`
3. `Jovia_Governance_and_Business_Operations.md.md`
4. Accepted files under `docs/adr/`
5. `Jovia_Technical_Research_and_Integration_Blueprint.docx`

Drafts, duplicated exports, and empty knowledge-base structures do not override
approved documents.

## Repository Direction

- `apps/web`: React client.
- `apps/api`: modular-monolith HTTP composition root.
- `apps/worker`: background-worker composition root.
- `packages/*`: provider-neutral platform capabilities.
- `services/*`: bounded application workflow libraries, not initial microservices.
- `docs/*`: architecture, API, database, security, operations, and migration evidence.

## Toolchain

- Node.js 24.14.0
- pnpm 11.20.0
- TypeScript 6.0.3

Install and verify:

```powershell
pnpm install --frozen-lockfile
pnpm check
```

Local infrastructure and detailed procedures are added as part of the first
foundation delivery. Real credentials never belong in this repository.
