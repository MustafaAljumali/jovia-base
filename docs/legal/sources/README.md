---
document: Lawful Opportunity Source Reviews
version: 1.0.0
status: Approved
authority: Opportunity Core Delivery Evidence
ai_context: Read Before Enabling or Modifying an Opportunity Source
read_before:
  - docs/superpowers/specs/2026-08-05-opportunity-core-lawful-discovery-design.md
read_after:
  - docs/operations/opportunity-discovery-runbook.md
owner: Jovia Opportunity Intelligence Domain
last_revised: 2026-08-05
last_verified: 2026-08-05
---

# Lawful Opportunity Source Reviews

Every source requires a versioned review record and matching immutable database
policy before it can run. A record is evidence for the executable policy; it is
not a runtime enable switch and it does not override the source's official terms.

| Source | Mechanism | Review | Runtime representation |
| --- | --- | --- | --- |
| Himalayas | Official public API | [2026-08-05](himalayas-2026-08-05.md) | Real connector, disabled by default |
| Jovia Direct | First-party manual submission | [2026-08-05](jovia-direct-2026-08-05.md) | First-party publishing source |

Unsupported, unreviewed, simulated, disabled, quarantined, or expired sources
must retain that exact status. They must not be described as connected.
