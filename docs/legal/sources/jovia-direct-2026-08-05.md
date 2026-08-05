---
document: Jovia Direct Source Review
version: 1.0.0
status: Approved
authority: Product Owner Approved Source Policy Evidence
ai_context: Read Before First-Party Opportunity Publishing Work
read_before:
  - docs/superpowers/specs/2026-08-05-opportunity-core-lawful-discovery-design.md
read_after:
  - docs/api/opportunities-v1.md
owner: Jovia Opportunity Intelligence Domain
source_code: jovia-direct
policy_version: 1
publishing_terms_version: 2026-08-05
approved_by: Product Owner
approved_at: 2026-08-05T00:00:00.000Z
verified_at: 2026-08-05T00:00:00.000Z
valid_until: 2027-08-05T23:59:59.999Z
terms_snapshot_sha256: a3f523319e05d424490e88dc646809a7039c43fa56919b4e0f5c2d24f189fd31
last_revised: 2026-08-05
last_verified: 2026-08-05
---

# Jovia Direct Source Review

## Decision

`jovia-direct` is an approved first-party source using `manual_submission`. It
makes no external source request. A publishing command must come from an
authenticated actor with `opportunity:publish`, active membership in the submitted
publisher organization, and an attestation to publishing-terms version
`2026-08-05`. Missing or mismatched attestation fails closed.

## Executable policy

| Field | Approved value |
| --- | --- |
| Scope and mechanism | `first_party`, `manual_submission` |
| Legal posture | `approved` |
| Attribution | Jovia text attribution and original application link |
| Redistribution | `first_party_only` for authorized publisher content |
| External polling | Not permitted |
| Raw payload retention | 90 days |
| Inactive metadata retention | 90 days |
| Publisher deletion | Immediate tombstone; audit evidence retained |
| Content changes | Sanitization and canonical normalization |

## Approved policy evidence

The digest in the metadata is SHA-256 over the UTF-8 bytes between the following
markers, using LF line endings and including the terminal LF.

<!-- evidence-start -->
Authority: docs/superpowers/specs/2026-08-05-opportunity-core-lawful-discovery-design.md
Publishing URL: https://jovia.dev/legal/opportunity-publishing
Reviewed interpretation: Jovia accepts first-party manual opportunity submissions only from authenticated members of the publisher organization who attest the approved publishing-terms version; first-party content may be attributed to Jovia and served inside Jovia through the governed opportunity lifecycle.
<!-- evidence-end -->

This engineering review records the Product Owner's approved platform rule. It
does not create or replace user-facing legal agreement text. A commercial launch
must present the referenced publishing terms and retain the publisher's accepted
version and timestamp.
