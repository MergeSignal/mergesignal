# Changelog

All notable changes to `@mergesignal/shared` are documented in this file.

## 0.14.0

### Breaking

- Removed `confirmed_runtime_usage` from the closed `MERGE_CONCERN_KINDS` vocabulary.
- Added `unresolved_runtime_exposure` as the replacement merge concern kind for unresolved runtime upgrade exposure on the Assessment wire.
- `assessmentSchema` and `parseAssessmentOrThrow` reject payloads that still use `confirmed_runtime_usage` in `primaryConcern` or `concerns[].kind`. No compatibility alias or normalization is provided.
