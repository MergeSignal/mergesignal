# Presentation Foundation

Permanent architecture for the shared Presentation layer in `packages/shared/src/presentation/`. Surfaces (dashboard, scan detail, check run, PR comment, CLI) are refined in separate phases; this document defines the foundation they share.

See also [presentation-ownership.md](./presentation-ownership.md) for assessment authority, verification channels, and CI guardrails.

## Public contract rule

> **Presentation Foundation consumes the engine's public contract exactly as published.**
>
> It may normalize, organize, and format information, but it must **never** require internal engine knowledge or depend on implementation details outside the public `ScanResult` contract.

### What this means

| Allowed                                                                            | Forbidden                                                                                                        |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Read fields on persisted `ScanResult` JSON validated by `@mergesignal/contracts`   | Read engine-internal assessment fields (`concerns`, `changeClasses`, `insightEmissionFloor`, etc.) in presenters |
| Normalize copy (trim, typography, template fill)                                   | Re-derive merge posture, concern, or verification channel from wire shape heuristics                             |
| Organize public fields into `AssessmentPresentationFields` and `NarrativeChannels` | Infer channel from presence of `artifactGrounded` instead of `verificationIntensity`                             |
| Format scores and bands from public `prRisk` / `layerScores` wire                  | Treat proprietary engine behavior as a dependency                                                                |
| Derive layout facts from public `repoIntelligence` via `safeParseRepoIntelligence` | Use `facts.reviewerGuidance` (insights/findings synthesis) as presentation authority                             |

The authoritative published shapes are:

- `ScanResult` — [`packages/shared/src/types.ts`](../../packages/shared/src/types.ts) and `scanResultSchema`
- `Assessment` — `@mergesignal/contracts` (`assessmentSchema`, `parseAssessmentOrThrow`)
- Fresh engine boundary — `engineOutputScanResultSchema` (strict `analyze()` output)

Presentation code must not assume engine version quirks beyond what the public schemas accept.

## Foundation philosophy

> **The Presentation Foundation exists to expose engine decisions consistently.**
>
> It does **not** exist to create a second communication model.

It must never become another Assessment, another Expression, another reasoning layer, or another workflow engine.

## Permanent pipeline

```
ScanResult (public wire)
    → buildScanPresentationBundle()
        → projectAssessmentFields()     # cross-surface invariants
        → buildNarrativeChannels()      # deduped narrative content
    → Surface presenter                 # layout, caps, channel-specific shape
    → Renderer                          # markdown, JSON, React
```

```
Assessment → Projection → Interpretation → Rendering   ❌
```

Merge-risk interpretation belongs to the engine. Layout interpretation (density, caps, section shape) belongs to surface presenters.

## Two-output model (do not replace)

No intermediate workflow IR between composition and presenters.

1. **`AssessmentPresentationFields`** — invariant assessment/expression fields projected identically on every surface DTO
2. **`NarrativeChannels`** — deduped headline, insights, scope, evidence, verification (`buildNarrativeChannels`)

Entry point: `buildScanPresentationBundle()` in `packages/shared/src/presentation/orchestration/`.

## Public expression fields (ABI 3)

Projected through `projectAssessmentFields` / `assessmentProjection.ts` only — never read ad hoc from `bundle.assessment` in presenters:

| Field                                         | Role                                                            |
| --------------------------------------------- | --------------------------------------------------------------- |
| `assessment.reasoning`                        | Canonical "why" prose                                           |
| `assessment.confidenceRationale`              | Confidence explanation (optional)                               |
| `assessment.reviewFocalPoint.electionSummary` | Focal-election narrative (optional)                             |
| `assessment.verificationScope.guidance`       | Verification action prose (optional; focus tokens are fallback) |

Reviewer-facing explanation must appear on these public expression fields, not only on internal `assessment.concerns`.

## Non-authoritative derivations

`deriveScanNarrative()` builds `ScanNarrativeFacts` for evidence layout (paths, blast radius, `riskSignals`). Facts support formatting; they do **not** override assessment posture or expression prose.

`facts.reviewerGuidance` (from legacy `insights` / `findings` / `recommendations`) is **not** presentation authority. Expression + assessment fields supersede it for shared surfaces.

## Guardrails

- `surfaceParity.test.ts` — invariant fields match across dashboard, detail, check run, PR comment
- `verificationChannelParity.test.ts` — verification channel provenance
- `abi3Expression.test.ts` — expression field projection
- `dashboardCardGolden.json` — persona goldens

## Related

- [presentation-ownership.md](./presentation-ownership.md)
- [scanresult-debug.md](./scanresult-debug.md)
- [architecture.md](../architecture.md)
