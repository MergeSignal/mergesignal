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

## Missing bundle contracts

The following deterministic developer intelligence is **not yet in the Presentation Bundle**. The public application has removed all local derivations of these. They are documented here as pending engine work. The UI surfaces that previously derived them now omit those display elements entirely until the engine authors the corresponding bundle fields.

### Recommendation richness

`ScanDetailsPresentation.recommendations.items` currently carries `{rank, title, priority, rationale?}`. The following guidance fields previously synthesized locally in the adapter have no bundle equivalent:

- `whyNow` — contextual urgency explanation
- `signals` — supporting evidence items for each recommendation
- `expectedBenefit` — expected outcome of following the recommendation
- `affectedPackages` — packages that the recommendation applies to

The recommendation detail pane now renders only `rationale`. The engine should author these fields and add them to the `ScanDetailsPresentation` contract when the pipeline is ready.

### Scan metadata flags

`ScanDetailsPresentation.metadata` carries `{scanId, generatedAt?, methodologyVersion?, changedPackagesSummary?}`. The following flags previously derived by the engine stub and forwarded via the legacy adapter have no current bundle equivalent:

- `codeAnalysisTimedOut` — whether the code analysis phase hit a timeout
- `codeIntelligenceAvailable` — whether code-level usage intelligence was produced

The metadata footer previously rendered a message when these were true. These messages are now absent. The engine should author these flags on `ScanDetailsPresentation.metadata` when they are production-reliable.

### Scan-detail contextual display labels

The following contextual labels for the Signal Summary panel were previously derived locally (or leaked as raw enum values) with no bundle-authored equivalent:

- Runtime surface label (e.g. "HTTP framework") — derived from engine internals
- Blast radius label — derived from engine internals
- Reachability label — previously leaked the raw `reachVisibility` enum value (`"hidden"/"contextual"/"prominent"`) directly to the UI; removed

The `ScanDetailsPresentation.hero.subheadline` and `usage.summary` fields cover the current authored context. The engine should add explicit display-ready labels for reach and blast radius when that information is production-stable.

### Repo-health score band

The org dashboard (`/org/[owner]`) and benchmark page display `repositoryHealthScore` with a local banding function (`>60` → high, `>30` → medium, `<= 30` → good). These surfaces consume raw score numbers from the org API endpoint, which is outside the scan Presentation Bundle scope.

The engine should author a repo-health presentation DTO (or extend `DashboardCardPresentation`) with an explicit band label when the repo-health surface is promoted to a first-class Presentation Bundle concern.

## Related

- [scanresult-debug.md](./scanresult-debug.md) — reading stored `ScanResult`
- [architecture.md](../architecture.md) — component overview
