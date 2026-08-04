---
document: Himalayas Source Review
version: 1.0.0
status: Approved
authority: Product Owner Approved Source Policy Evidence
ai_context: Read Before Himalayas Connector or Policy Work
read_before:
  - docs/superpowers/specs/2026-08-05-opportunity-core-lawful-discovery-design.md
read_after:
  - docs/operations/opportunity-discovery-runbook.md
owner: integrations
source_code: himalayas
policy_version: 1
approved_by: Product Owner
approved_at: 2026-08-05T00:00:00.000Z
verified_at: 2026-08-05T00:00:00.000Z
valid_until: 2026-11-03T23:59:59.999Z
terms_snapshot_sha256: 5109851959bee07b0e8c8e26722194f3fef1dd68ff8bd4d689125961127a21c8
last_revised: 2026-08-05
last_verified: 2026-08-05
---

# Himalayas Source Review

## Decision

Himalayas is approved as Jovia's first real external opportunity connector using
its official public browse API. The connector exists as a real implementation but
remains `enabled=false` until an operator deliberately enables the approved
policy. No test or documentation may describe a fake transport as a live call.

## Executable policy

| Field | Approved value |
| --- | --- |
| Mechanism and posture | `official_api`, `approved` |
| Endpoint | `GET https://himalayas.app/jobs/api?offset=<n>&limit=20` |
| Authentication | None documented |
| Polling floor | 86,400 seconds |
| Page concurrency | 1 |
| Page spacing | 1,000 milliseconds |
| HTTP 429 | Honor `Retry-After`; documented default 60 seconds |
| Attribution | Visible “Data sourced from Himalayas” and link to Himalayas |
| Original link | Exact source-supplied `applicationLink` |
| Logo | Text-only policy; no public company logo field |
| Redistribution | Prohibited outside Jovia's end-user experience and never to other aggregators |
| Serving TTL | 24 hours |
| Inactive/raw retention | 90 days |
| Content changes | Sanitization and canonical normalization only; no translation in this batch |

## Approved policy evidence

The digest in the metadata is SHA-256 over the UTF-8 bytes between the following
markers, using LF line endings and including the terminal LF.

<!-- evidence-start -->
API reference: https://himalayas.app/docs/remote-jobs-api
OpenAPI: https://himalayas.app/docs/openapi.json
Data dictionary: https://himalayas.app/docs/data-dictionary
Reviewed interpretation: The public API requires no authentication, limits browse pages to 20 records, refreshes its dataset every 24 hours, requires visible Himalayas attribution and original application links, instructs clients to retry HTTP 429 after 60 seconds, and prohibits submitting Himalayas listings to other job aggregators.
<!-- evidence-end -->

This record paraphrases operative rules and does not reproduce an external terms
page. A new policy version and Product Owner approval are required after the
validity date or if official documentation changes.
