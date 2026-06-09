# Presentation ownership

MergeSignal surfaces (dashboard, scan detail, GitHub check run, PR comment, CLI, Actions summary) are **projections** of engine output. The public repository does not re-evaluate merge risk.

## Authority chain

```
Assessment → Decision → Narrative → Reach → Verification → Surfaces
```

| Layer                           | Role                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `ScanResult.assessment`         | Sole authority for posture, confidence, primary concern, factors, and presentation policy |
| `ScanResult.decision`           | Reasoning bullets and recommendation alignment (render only)                              |
| `ScanResult.repoIntelligence`   | Evidence layout — usage paths, verification focus, blast radius                           |
| `buildScanPresentationBundle()` | Attaches assessment, public presentation pick, thin profile, narrative facts              |
| Presenters                      | Format, truncate, order, group, style — **no inference**                                  |

## Public vs internal assessment fields

**Consumed by presenters (public contract):**

- `assessment.posture`, `confidence`, `primaryConcern`, `factors`
- `assessment.presentation`: `narrativeIntensity`, `reachVisibility`, `verificationIntensity`, `reportMode`

**Parsed on wire but not exposed to presenters:**

- `assessment.concerns`, `changeClasses`
- `assessment.presentation.insightEmissionFloor` (engine emission policy)

`AssessmentPresentationPublic` in `@mergesignal/shared` is a narrow `Pick` of the wire shape. Presenters must not import engine-internal fields.

## Pipeline rule

```
Assessment → Projection → Rendering   ✅
Assessment → Transformation → Interpretation → Rendering   ❌
```

If a projection disagrees with assessment, **assessment wins**. Fix or bypass the projection; do not weaken assessment authority in the public repo.

## Historical scans

**Current (no external users):** Fresh engine output requires `assessment`. Rows without it fail presentation or require re-scan.

**Future compatibility (design note — not implemented):**

1. **Presentation snapshot** — optional persisted DTO at scan completion; historical reads serve the snapshot without re-derivation.
2. **Assessment version migration** — lazy-upgrade stored JSON when the assessment ABI bumps; never re-run full analysis for display-only reads.
3. **Degraded legacy mode** — pre-assessment scans show an explicit “legacy scan” banner with best-effort read-only fields; no silent score-based fallbacks.

## Guardrails

- `surfaceParity.test.ts` — PR validation personas must project identical posture, primary concern, reasoning, verification focus, reach visibility, and narrative intensity across dashboard, detail, check run, and PR comment.
- `dashboardCardGolden.json` — golden dashboard cards for fixture personas.

## Related

- [scanresult-debug.md](./scanresult-debug.md) — reading stored `ScanResult`
- [architecture.md](../architecture.md) — component overview
