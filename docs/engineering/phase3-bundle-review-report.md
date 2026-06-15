# Phase 3 Bundle Review Report

Sprint 2 complete. **Implementation stopped per plan** — awaiting explicit approval before P3-R5 or further work.

## Summary

Phase 3 enriched `ScanNarrativeFacts` with diagnostics, proof-chain linkage on `affectedAreas`, and centralized `riskSignals` exposure classification. No presentation surfaces were modified. All 182 shared package tests pass, including 12 new golden bundle tests.

**Primary success metric:** linkage density and diagnostic objectivity — not field count.

---

## 1. Ownership table

| Field                               | Source wire field                                                       | Derivation                                                                         | Future consumer                   | Gap closed                             |
| ----------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------- |
| `availability.preparationWarnings`  | `analysisPreparation.warnings`                                          | Verbatim copy                                                                      | Scan Details, PR Comment, CLI     | Corpus degradation diagnostics         |
| `availability.corpusGateReason`     | `codeIntelligenceAvailable`, `repoIntelligenceValidation`, parse status | Objective enum                                                                     | All surfaces (limited-context UX) | Why tier-1 proof is unavailable        |
| `confidence.assessment`             | `assessment.confidence`                                                 | Verbatim projection                                                                | Scan Details, Dashboard           | Assessment confidence without re-parse |
| `confidence.decision`               | `decision.confidence`                                                   | Verbatim (existing)                                                                | Scan Details                      | Decision wire confidence               |
| `confidence.limitedContext`         | gate + warnings + assessment                                            | Boolean: `corpusGateReason !== "ok"` OR warnings present OR `assessment === "low"` | Scan Details, PR Comment          | Objective limited-context flag         |
| `affectedAreas[].packages`          | `packageUsage.areas`, `applicationAreas`                                | Match rules in `affectedAreaLinkage.ts`                                            | Scan Details Evidence             | package ↔ area chain                   |
| `affectedAreas[].findingIds`        | `findings[].id`                                                         | `finding.packageName ∈ packages`                                                   | Scan Details Evidence             | package ↔ finding chain                |
| `affectedAreas[].paths`             | `packageUsage` paths/files                                              | Union for linked packages                                                          | Scan Details, Check Run           | package ↔ evidence paths               |
| `affectedAreas[].evidenceStrength`  | `changedPackageSemantics.evidenceStrength`                              | Max strength for linked packages                                                   | Scan Details                      | Evidence quality per area              |
| `affectedAreas[].hotspotPackages`   | `hotspots[].packageName`                                                | Intersect with linked packages                                                     | Scan Details                      | package ↔ hotspot chain                |
| `affectedAreas[].verificationFocus` | `changedPackageSemantics.verificationFocus`                             | Union for linked packages                                                          | Scan Details, PR Comment          | package ↔ verification chain           |
| `riskSignals`                       | `totalScore`, `layerScores`                                             | `deriveRiskSignals()`                                                              | Dashboard, Scan Details, CLI      | Single exposure classification owner   |
| `riskIndex` (deprecated)            | `riskSignals.riskIndex`                                                 | Compat alias                                                                       | Frozen `presentDashboardCard`     | Backward compat for frozen surfaces    |

---

## 2. Exposure ownership inventory

| Code                                                          | Role                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| `deriveRiskSignals` (`riskSignals.ts`)                        | **Canonical owner**                                               |
| `deriveCardExposureCategory` (`formatCardExposureDisplay.ts`) | Threshold implementation — called by `deriveRiskSignals`          |
| `deriveCardExposureDisplay` / `exposureAriaFragment`          | **Frozen consumers** (technical debt)                             |
| `presentDashboardCard`                                        | **Frozen consumer** — reads `facts.riskIndex` only                |
| `scan-details-adapter.ts` `toOverallBand`                     | **Frozen** — surface-specific 3-bucket remap (Scan Details phase) |

**Rule for future phases:** surfaces must read `facts.riskSignals.exposure` / layer exposures — no independent band derivation.

---

## 3. Persona coverage

| Persona          | corpusGateReason       | limitedContext | Linkages populated                                                      | riskSignals                                 |
| ---------------- | ---------------------- | -------------- | ----------------------------------------------------------------------- | ------------------------------------------- |
| fastify-runtime  | `ok`                   | false          | packages, findings, paths, hotspots, verification on `api`/`auth` areas | riskIndex 55, exposure `moderate`, 4 layers |
| typescript-patch | `ok`                   | false          | tooling area seeds; semantics linkage                                   | riskIndex 18, exposure `minimal`            |
| mixed-ts-fastify | `ok`                   | false          | multi-package usage linkage                                             | riskIndex 55                                |
| prettier         | `ok`                   | false          | build-tool paths (files)                                                | riskIndex 18                                |
| bullmq           | `ok`                   | false          | runtime areas + verification                                            | riskIndex 48                                |
| eslint           | `ok`                   | false          | lint tooling linkage                                                    | riskIndex 18                                |
| vitest           | `ok`                   | false          | test tooling linkage                                                    | riskIndex 18                                |
| limited-context  | `no_code_intelligence` | true           | graph_fallback area seeds; weak package linkage                         | riskIndex 40                                |

---

## 4. Remaining gaps

### Wire evidence not fully represented in facts

| Wire data                              | Status                                                               | Future phase                                            |
| -------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| `findings[].evidence` structured hints | Not linked into `affectedAreas` paths                                | Scan Details — if engine emits structured evidence refs |
| `explain.reasons` score impacts        | Used only for graph_fallback area seeds via `selectTopAffectedAreas` | Optional: link explain reasons to areas by layer        |
| `recommendations[].packages`           | Available via `reviewerGuidance` only                                | Scan Details operational impact projection              |
| `insights[].affectedFiles`             | In `reviewerGuidance`                                                | Already available — surface phase composes              |

### Proof gaps discovered

- **Fallback areas** (from `selectTopAffectedAreas`) have weak package linkage when no `packageUsage` exists — expected for graph-only scans.
- **Auth area id vs "Auth middleware" usage label** — linked via `applicationAreas` id membership rule (all packages link to RI application areas).

### P3-B3 reconfirmation

**Still removed.** `reviewerGuidance` + `packageUsage` + `changedPackageSemantics` satisfy operational impact needs without `operationalImpactFacts`.

### Candidates for future phases

| Phase               | Work                                                                            |
| ------------------- | ------------------------------------------------------------------------------- |
| Scan Details        | Project enriched `affectedAreas` + `riskSignals` into `ScanDetailsPresentation` |
| Dashboard           | Consume `facts.riskSignals` instead of raw `riskIndex`                          |
| P3-R5 (deferred)    | Dogfood gates on proof quality JSON                                             |
| P3-R2–R4 (deferred) | Release guard CI                                                                |

---

## 5. P3-R5 recommendation

**Defer until after surface phase planning.** Bundle golden tests now protect the proof model. Dogfood gates would add runtime validation of engine output feeding the bundle — valuable but not blocking surface work.

---

## 6. Files changed

| File                                                              | Change                                                                                         |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `packages/shared/src/scanNarrativeFacts.ts`                       | Types: `AffectedAreaFact`, `CorpusGateReason`, enriched availability/confidence, `riskSignals` |
| `packages/shared/src/deriveScanNarrative.ts`                      | P3-B2 diagnostics + P3-B1 linkage + riskSignals                                                |
| `packages/shared/src/affectedAreaLinkage.ts`                      | **New** — proof chain enrichment                                                               |
| `packages/shared/src/riskSignals.ts`                              | **New** — canonical exposure owner                                                             |
| `packages/shared/src/formatCardExposureDisplay.ts`                | `deriveCardExposureCategory` export                                                            |
| `packages/shared/src/scanPresentationBundle.golden.test.ts`       | **New** — golden proof model tests                                                             |
| `packages/shared/src/deriveScanNarrative.test.ts`                 | Diagnostics + linkage unit tests                                                               |
| `packages/shared/src/formatCardExposureDisplay.test.ts`           | Category tests                                                                                 |
| `packages/shared/src/presentation/fixtures/scanResultFixtures.ts` | Test fixture data only                                                                         |

**Not modified:** any `presentation/presenters/*`, `apps/web/app/scan/*`, adapters.

---

## 7. Test results

```
packages/shared: 182 tests passed (26 files)
```

Golden tests assert structure, linkage IDs, diagnostic codes, and exposure categories — not wording or presenter output.
