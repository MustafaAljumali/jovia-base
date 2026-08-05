# Documentation Authority and Status

## Controlling authority

1. `Jovia_Engineering_Constitution_v2.0.md` is the supreme engineering authority.
2. `Jovia_Strategic_Product_Vision.md` and
   `Jovia_Governance_and_Business_Operations.md` are approved controlling input.
3. Accepted ADRs govern their documented scope. ADR-0001 is the accepted
   foundational monorepo decision approved by the Product Owner on 2026-08-04.
4. `Jovia_Technical_Research_and_Integration_Blueprint.docx` is the approved
   integration and database research baseline.
5. The combined Knowledge Base constitution identifies itself as Draft and cannot
   override an approved source above it.

The root documents are frozen evidence. This batch adds navigation and status
metadata without renaming or deleting them.

## Duplicates and naming anomalies

SHA-256 comparison found two exact duplicate pairs:

- `Jovia_AI_Continuous_Opportunity_Discovery_Engine.md` and
  `Jovia_AI_Continuous_Opportunity_Discovery_Engine (1).md`.
- `Jovia_Autonomous_Opportunity_Intelligence_AOI_V3 (1).md` and
  `Opportunity_Discovery_and_Notification_Engine.md.md`.

The foundational ADR-approved correction renamed
`Jovia_Governance_and_Business_Operations.md.md` to
`Jovia_Governance_and_Business_Operations.md` and updated every reference in the
same Batch 2 documentation commit. The remaining
`Opportunity_Discovery_and_Notification_Engine.md.md` filename is recorded as an
inventory anomaly and is not silently renamed.

`Jovia-KnowledgeBase_combined.md` and `bibcit-export-2026-07-27.md` are not byte
duplicates but overlap heavily: normalized unique non-empty lines have 23,070
lines in common; Jaccard overlap is 87.84%, covering 97.40% of the combined
Knowledge Base and 89.95% of the export. Neither is treated as a higher-authority
substitute for controlling documents.

## Structure status

Before this delivery the official repository contained authoritative root
documents but no populated ADR, architecture, API, database, operations, security,
service, or migration navigation structure. The new `docs/*` sections are additive
and link implementation evidence. The monorepo contains bounded service packages;
future service-specific documentation remains intentionally absent until those
services gain executable behavior beyond the first ports.

## Normalization recommendations

- Add front matter to authoritative documents only through a separately reviewed
  documentation change.
- Introduce a canonical document registry containing authority status owner and
  supersession links.
- Preserve duplicates until references are mapped; then deprecate with redirects
  rather than destructive renames.
- Split the combined Knowledge Base into navigable bounded-context pages without
  changing the frozen source export.
