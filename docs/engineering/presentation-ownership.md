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

- `assessment.reviewFocalPoint`, `reachScope`, `verificationScope` — identity, reach, and verification ownership (ABI 2)
- `assessment.posture`, `confidence`, `primaryConcern`, `factors`
- `assessment.presentation`: `narrativeIntensity`, `reachVisibility`, `verificationIntensity`, `reportMode`

**Parsed on wire but not exposed to presenters:**

- `assessment.concerns`, `changeClasses`
- `assessment.presentation.insightEmissionFloor` (engine emission policy)

`AssessmentPresentationPublic` in `@mergesignal/shared` is a narrow `Pick` of the wire shape. Presenters must not import engine-internal fields.

## Dual-channel verification ownership

Verification guidance is split into two assessment-owned channels under `verificationScope`:

| Channel  | Wire fields                                                                 | Engine authority              | Example labels                     |
| -------- | --------------------------------------------------------------------------- | ----------------------------- | ---------------------------------- |
| Runtime  | `verificationScope.packages`, `verificationScope.focus`                     | Runtime upgrade guidance      | `routes`, `middleware`, `handlers` |
| Artifact | `verificationScope.artifactGrounded` (`packages`, `focus`, `artifactPaths`) | Build/config/tooling guidance | `typecheck`, `format`, `ci`        |

`artifactPaths` is engine-owned evidence linkage — not projected into verification action label strings.

### `verificationIntensity` is the presentation channel selector

This is an **intentional ownership decision**, not a shared implementation detail. Shared must not infer which channel to project from wire shape (e.g. presence of `artifactGrounded`).

| `verificationIntensity` | Channel projected | Source read by shared                       |
| ----------------------- | ----------------- | ------------------------------------------- |
| `"none"`                | none              | (no verification actions)                   |
| `"advisory"`            | artifact          | `verificationScope.artifactGrounded` only   |
| `"required"`            | runtime           | `verificationScope.packages` / `focus` only |

**Invariant:** Shared projects exactly one channel per scan, selected solely by `verificationIntensity`. Never merge channels. Never fall back across channels (e.g. advisory must not read `verificationScope.focus`).

Projected surfaces expose `verificationChannel` (`"runtime"` \| `"artifact"` \| `"none"`) alongside `verificationFocus` for provenance parity.

## Pipeline rule

```
Assessment → Projection → Rendering   ✅
Assessment → Transformation → Interpretation → Rendering   ❌
```

If a projection disagrees with assessment, **assessment wins**. Fix or bypass the projection; do not weaken assessment authority in the public repo.

## Historical scans

**Current (no external users):** Fresh engine output requires ABI-2 `assessment` validated by `@mergesignal/contracts`. Rows without a valid assessment get **degraded presentation** (failed dashboard card, empty scan detail, empty PR comment) — not silent coercion.

**Post–Phase 2 behavior:**

- **Persisted JSON** — `scanResultSchema` does not validate `assessment` shape on DB read; raw JSON remains available.
- **Presentation** — `buildScanPresentationBundle` calls `parseAssessmentOrThrow` from `@mergesignal/contracts`. Invalid or ABI-1 assessments fail parse → bundle is `null` → existing degraded UI paths apply. **No ABI-1 → ABI-2 upgrade.**
- **Fresh engine boundary** — `engineOutputScanResultSchema` requires strict ABI-2 assessment; ABI-1 engine output is rejected at the worker.
- **Remedy** — re-scan with current engine to restore full presentation surfaces.

**Future compatibility (design note — not implemented):**

1. **Presentation snapshot** — optional persisted DTO at scan completion; historical reads serve the snapshot without re-derivation.
2. **Degraded legacy banner** — explicit “legacy scan” banner with read-only fields; no silent score-based fallbacks.

## Guardrails

- `surfaceParity.test.ts` — PR validation personas must project identical posture, primary concern, reasoning, verification focus, verification channel, reach visibility, and narrative intensity across dashboard, detail, check run, and PR comment.
- `verificationChannelParity.test.ts` — provenance parity for `verificationChannel` and `verificationFocus` across surfaces.
- `assessmentProjection.verificationChannel.test.ts` — channel routing unit tests (runtime vs artifact vs conflict fixtures).
- `dashboardCardGolden.json` — golden dashboard cards for fixture personas.

## Related

- [scanresult-debug.md](./scanresult-debug.md) — reading stored `ScanResult`
- [architecture.md](../architecture.md) — component overview
