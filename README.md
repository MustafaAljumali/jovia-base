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
3. `Jovia_Governance_and_Business_Operations.md`
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

Start local infrastructure and apply the forward-only foundation migration:

```powershell
docker compose up -d --wait postgres redis
pnpm db:migrate
pnpm db:check
```

Run `pnpm dev:web`, `pnpm dev:api`, and `pnpm dev:worker` in separate terminals.
The public health contract is `GET http://127.0.0.1:4000/v1/health`.

Batch 2 Opportunity Core documentation begins at
`docs/knowledge-base/opportunity-core-lawful-discovery.md`. Himalayas is a real,
contract-tested connector but is disabled by default; it must not be represented as
connected. Jovia Direct is the enabled first-party publishing source. All other
named external sources remain unimplemented and not connected in this batch. The
review evidence matrix is `docs/delivery/batch-2-opportunity-core-evidence.md`.

See `docs/operations/local-development.md` for the complete procedure and
`docs/security/quality-gates.md` for enforced CI policy. Real credentials never
belong in this repository; Gemini remains disabled until its environment contract
validates an explicit credential and pinned stable model.
