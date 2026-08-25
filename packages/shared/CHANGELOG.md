# Changelog

All notable changes to `@mergesignal/shared` are documented in this file.

## 0.16.1

### Fixed

- Gate repository intelligence at the presentation boundary via reach visibility so presentation does not surface intelligence the assessment did not establish for the consumer.
- Align indeterminate presentation headlines with merge-safety semantics, scoping uncertainty to merge safety rather than total analysis failure.
- Limit collection-limited degraded messaging to sealed collection semantics; low confidence alone no longer implies limited collection.
- Correct shared limited-context narrative so low confidence alone does not equate to limited collection.

## 0.16.0

### Added

- `proof_capability_ceiling` sufficiency blocker kind on the Assessment wire, distinguishing governed proof-capability ceilings from missing routable proof (`proof_coverage_insufficient`).
- Closed-enum extension on optional ABI 4 `evidenceSufficiencyVerdict` fields; `ASSESSMENT_ABI` remains `4`. Trusted consumers on older `@mergesignal/shared` versions reject payloads containing the new literal until upgraded.

## 0.15.1

### Fixed

- Align generic indeterminate presentation headlines with **Cannot determine** semantics so abstention does not imply review homework.
- Add canonical indeterminate headline copy and posture vocabulary remediation for shared headline projection.

## 0.15.0

### Added

- Fourth public scan decision value `indeterminate` for honest abstention (`abstain` outcomes).
- `PrRiskWire` discriminated union: scored branch unchanged; `availability: 'indeterminate'` branch has no numeric score.
- Outcome-primary presentation status mapping and scan-surface copy for Cannot determine.

## 0.14.0

### Breaking

- Removed `confirmed_runtime_usage` from the closed `MERGE_CONCERN_KINDS` vocabulary.
- Added `unresolved_runtime_exposure` as the replacement merge concern kind for unresolved runtime upgrade exposure on the Assessment wire.
- `assessmentSchema` and `parseAssessmentOrThrow` reject payloads that still use `confirmed_runtime_usage` in `primaryConcern` or `concerns[].kind`. No compatibility alias or normalization is provided.
