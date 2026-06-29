# Presentation ownership

MergeSignal surfaces (dashboard, scan detail, GitHub check run, PR comment, CLI) are **projections** of engine output. The public repository does not re-evaluate merge risk.

## Authority

`ScanResult.assessment` is the sole authority for merge posture, confidence, primary concern, and presentation policy. `buildScanPresentationBundle()` in `@mergesignal/shared` builds shared presentation output from a scan result. Presenters format and layout that output — they do not infer posture, reach, or verification policy from scores or wire-shape heuristics.

If presentation output disagrees with assessment, assessment wins.

## Public contract

Presentation code uses only the published `ScanResult` and `Assessment` shapes from `@mergesignal/contracts` and `@mergesignal/shared`. It may normalize and format published fields. It must not depend on engine-internal assessment fields or re-derive merge decisions in presenters.

Reviewer-facing explanation belongs on public assessment expression fields, not on internal engine fields such as `concerns` or `changeClasses`.

## Verification

Verification guidance is owned by assessment. Shared code selects one verification channel per scan from `assessment.presentation.verificationIntensity` — not from heuristics over the wire shape.

## Historical scans

Scans stored without a valid `assessment` receive degraded presentation (failed dashboard card, empty scan detail, empty PR comment). Re-scan with the current engine to restore full surfaces.

## Related

- [scanresult-debug.md](./scanresult-debug.md) — reading stored `ScanResult`
- [architecture.md](../architecture.md) — component overview
