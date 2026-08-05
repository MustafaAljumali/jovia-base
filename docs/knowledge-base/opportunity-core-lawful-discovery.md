---
document: Opportunity Core Knowledge Base
version: 1.0.0
status: Implemented
authority: Product Owner Approved Batch 2 Specification
ai_context: Always Read for Opportunity Features
read_before:
  - docs/superpowers/specs/2026-08-05-opportunity-core-lawful-discovery-design.md
read_after:
  - docs/architecture/opportunity-core-lawful-discovery.md
owner: Opportunity Intelligence Domain
last_revised: 2026-08-05
last_verified: 2026-08-05
---

# Opportunity Core and Lawful Discovery

Batch 2 implements executable source governance, a real Himalayas API connector,
Jovia Direct publishing, normalization, deterministic deduplication, provenance,
lifecycle, outbox delivery, versioned APIs, policy-driven workers, durable raw
storage, and operational evidence.

Runtime truth is explicit:

- **Himalayas:** real connector implemented and contract-tested; disabled by
  default; not represented as connected.
- **Jovia Direct:** enabled first-party publishing through the shared pipeline.
- **All other named sources:** not connected and not implemented in Batch 2.
- **Semantic matching, AI scoring, AI memory, recommendation, and notification
  personalization:** future consumers of the stable canonical/event foundation,
  not claims of this batch.

The authoritative source reviews are under `docs/legal/sources/`. Operational and
security procedures are in `docs/operations/opportunity-discovery-runbook.md` and
`docs/security/opportunity-ingestion-threat-model.md`.
