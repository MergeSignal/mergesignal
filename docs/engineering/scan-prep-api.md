# Scan Preparation — Public API Authority

**Package:** `@mergesignal/scan-prep`  
**Owning repository:** `MergeSignal/mergesignal`  
**Architectural owner:** Scan Preparation (public ingress domain)  
**Implementation status:** Public API freeze recorded. The public-package graduation and first-publication framework is **implemented and validated**. `@mergesignal/scan-prep@0.1.0` is **published and registry-verified** on npmjs (manual bootstrap). `@mergesignal/scan-prep@0.1.4` is the **OIDC Trusted Publishing proof release** — published and registry-verified via [publish-scan-prep.yml](../.github/workflows/publish-scan-prep.yml) with no stored npm write token. Tag `scan-prep-v0.1.0` is immutable — do not move or republish `0.1.0`. Engine registry consumption and private mirror removal remain deferred separate operations.

This document is the permanent public contract authority for `@mergesignal/scan-prep`. It does not describe private engine acquisition internals beyond the minimum ownership boundary required to establish privacy separation.

Pipeline topology authority remains [mergesignal-engine `PIPELINE.md`](https://github.com/MergeSignal/mergesignal-engine/blob/main/docs/engine/PIPELINE.md). Assessment Decision remains the sole merge-decision authority.

---

## Mission

Scan Preparation prepares **public-safe ingress evidence** before intelligence domains run:

- lockfile context and changed-package discovery for upgrade-episode scope;
- GitHub source corpus preparation for the public worker `prepareScanContext` contract;
- explicit uncertainties when preparation cannot complete — never false completeness.

Scan Preparation **produces prepared evidence and uncertainties**. It does **not**:

- clear merges or issue merge recommendations;
- prove breakage independently;
- adjudicate assessment outcomes;
- bypass the single `analyze()` ingress;
- create alternate pipeline entry points or hidden controls.

---

## Ownership

| Responsibility                                                             | Owner                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical `@mergesignal/scan-prep` source                                  | `mergesignal/packages/scan-prep`                                                                                                                                                                                                                                                            |
| Public worker consumption (today)                                          | `mergesignal/apps/worker` via `workspace:^`                                                                                                                                                                                                                                                 |
| Published npm artifact                                                     | `registry.npmjs.org` — current release version is owned by [`packages/scan-prep/package.json`](../../packages/scan-prep/package.json); bootstrap `@0.1.0` immutable; future versions via permanent Trusted Publishing ([publish-scan-prep.yml](../.github/workflows/publish-scan-prep.yml)) |
| Private GitHub acquisition, tiered collection, installation-token handling | `mergesignal-engine` (Evidence Collection) — **private, engine-owned**                                                                                                                                                                                                                      |
| Engine Scan Preparation copy (today)                                       | `mergesignal-engine/packages/scan-prep` — **local workspace copy; manual port required**                                                                                                                                                                                                    |

**Dependency direction:**

- Public package may depend on published `@mergesignal/shared` and public GitHub client libraries.
- Public package must not depend on engine-private packages (`evidence-planner`, `analysis-engine`, worker collection modules).
- Engine intelligence domains consume published or workspace Scan Preparation APIs; they must not re-implement lockfile ingress authority in ad hoc modules.

---

## Allowed responsibilities

- Lockfile diff and changed-package discovery (public-safe subset).
- `prepareScanContext` for the public worker ingress contract.
- GitHub corpus fetch **as an internal implementation detail** of `prepareScanContext` (not exported).
- Emit preparation summaries and explicit fetch/classification uncertainties.
- Governed `./lockfile` subpath for lockfile ingress symbols required by engine Upgrade Episode Scope (target export surface).

---

## Forbidden responsibilities

- Private tiered repository acquisition (tree listing, blob batching, collection-plan execution).
- Evidence planner integration or collection-budget orchestration.
- Repository credential exposure beyond internal token use inside preparation.
- Merge-decision, sufficiency verdict, or assessment outcome logic.
- Engine-private heuristics, acquisition strategy, or restricted collection behavior in the published package.
- Alternate public pipeline entry points that bypass `prepareScanContext` / governed lockfile exports.

---

## Approved root exports (`@mergesignal/scan-prep`)

| Symbol                     | Role                                                                |
| -------------------------- | ------------------------------------------------------------------- |
| `prepareScanContext`       | Production public worker contract                                   |
| `PrepareScanContextResult` | Result type                                                         |
| `ScanPreparationSummary`   | Normalized preparation / acquisition observability (multi-producer) |

See [ScanPreparationSummary](#scanpreparationsummary-multi-producer-observability) for cross-producer accounting semantics. The public worker’s `prepareScanContext` is one governed producer; other acquisition implementations may populate the same summary shape using their own observation surface without duplicating `prepareScanContext`’s GitHub corpus algorithm.

The workspace root entry (`@mergesignal/scan-prep`) exports **only** the symbols in the table above. Lockfile ingress symbols are available exclusively from `@mergesignal/scan-prep/lockfile`. Authentication, corpus cache controls, and raw GitHub fetch helpers remain internal implementation details.

---

## ScanPreparationSummary (multi-producer observability)

`ScanPreparationSummary` is a **normalized preparation and acquisition observability contract**. More than one governed producer may emit it. The summary reports what a producer measured during preparation; it is **not** a second analysis-corpus authority and does **not** affect Assessment Decision or merge posture by itself.

**Roles:**

- **Repository-evidence policy** (`@mergesignal/scan-prep/repository-evidence`) is provider-neutral: eligibility, ranking, caps, and change-request filtering.
- **Acquisition / orchestration** supplies the producer’s governed **repository observation path set** (complete tree, bounded subset, dependency-targeted set, or other partial observation under a governed implementation).
- **Producers** apply policy over that observation set, perform fetch/materialization, and populate `ScanPreparationSummary` honestly.

Do not treat `prepareScanContext`’s GitHub recursive corpus path as the only valid producer. A full recursive tree pass is not required to populate the summary.

### Observation scope

Repository-evidence accounting is evaluated over the producer’s **declared repository observation path set**—the paths that producer actually considered for repository-evidence policy on that pass.

That observation may be:

- complete (for example a full repository tree listing);
- bounded (for example tiered or budget-limited acquisition);
- dependency-targeted (for example paths supplied before policy runs);
- otherwise partial under a governed acquisition implementation.

**Partial observation must not be described as full-repository coverage.** Bounded or partial observation stays visible through eligible / selected / cap-truncated / skip / fetched counts. Producers must not mix counters from unrelated observation sets.

### Repository-evidence counts

Relative to the producer’s observation path set, after applying public repository-evidence policy:

| Field                                          | Meaning                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `repositoryEvidenceEligibleCandidateCount`     | Unique paths eligible after policy (and dedupe where the producer applies it), **before** the governed cap. |
| `repositoryEvidenceSelectedCandidateCount`     | Paths selected for content acquisition after the governed cap.                                              |
| `repositoryEvidenceCapTruncatedCandidateCount` | Eligible paths not selected because of `REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES`.                           |

**Cross-producer invariants** (within that observation scope):

```text
eligible >= selected
capTruncated = eligible - selected
```

These counts describe policy outcomes on the producer’s observation set—not universal repository totals.

### Skip accounting

| Field                          | Meaning                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `sourceFilesSkippedOversized`  | Repository-evidence paths the producer **attempted** for content acquisition but skipped due to `REPOSITORY_EVIDENCE_MAX_FILE_BYTES`. |
| `sourceFilesSkippedFetchError` | Repository-evidence paths the producer **attempted** but skipped due to fetch/read failure.                                           |
| `sourceFilesSkipped`           | Aggregate skip count exposed on the summary wire.                                                                                     |

**Cross-producer invariant:**

```text
sourceFilesSkipped = sourceFilesSkippedOversized + sourceFilesSkippedFetchError
```

Skip fields are **measured outcomes** for repository-evidence paths the producer actually tried to acquire—not policy-ineligible paths, not cap-truncated paths unless the producer also attempted them, and not fabricated placeholders.

**Evidence honesty:**

- Do not coerce unknown or unmeasured skip categories to zero when the producer lacks evidence for them.
- Measured zero remains valid when the producer genuinely observed no skips in that category.
- When corpus fetch or repository-evidence acquisition does not run for a producer pass, related counts may legitimately be zero for that pass.

### `sourceFilesFetched`

`sourceFilesFetched` is the count of paths the producer **successfully materialized** into its analysis / source corpus for that preparation pass.

- For **`prepareScanContext`**, the corpus corresponds to UTF-8 content fetched for cap-selected repository-evidence paths (cache hits included in the fetched set).
- For **other governed acquisition producers**, the analysis corpus may include paths **outside** the repository-evidence selected subset (for example planner- or tier-assembled sources). In that case `sourceFilesFetched` reflects materialized corpus size, not “selected RE paths only.”

**Not universal contract laws** (they hold only when the producer’s acquisition algorithm uses the **same path set** for RE selection, skip attempts, and corpus materialization—as `prepareScanContext` does):

```text
selected >= sourceFilesFetched
sourceFilesFetched + sourceFilesSkipped <= selected
```

Do not require these inequalities across producers whose materialized corpus is not limited to cap-selected repository-evidence paths.

### `prepareScanContext`-specific behavior

When the public worker runs `prepareScanContext` with GitHub corpus fetch:

- Observation is typically a full tree listing (subject to provider enumeration), then repository-evidence policy.
- `sourceFilesSkipped` counts cap-selected paths that failed size policy or content fetch—not cap truncation and not policy-ineligible paths.
- The `prepareScanContext` implementation enforces the tighter coupling between selected, fetched, and skipped counts for that algorithm.

Other producers use the same **field names** and **cross-producer invariants** above; additional coupling is **producer-specific**, not package-wide law.

---

## Approved `./lockfile` exports (`@mergesignal/scan-prep/lockfile`)

| Symbol                                     | Role                                              |
| ------------------------------------------ | ------------------------------------------------- |
| `hasVerifiedLockfileIngress`               | Canonical verified lockfile ingress predicate     |
| `hasVerifiedEmptyLockfileIngress`          | Verified-empty ingress predicate                  |
| `prepareLockfileContext`                   | Engine worker lockfile ingress                    |
| `LockfileContextResult`                    | Result type                                       |
| `LockfileEvidenceStatus`                   | Wire evidence status (from `@mergesignal/shared`) |
| `detectChangedPackages`                    | Changed-package authority                         |
| `detectLockfilePackageDelta`               | Lockfile delta authority                          |
| `resolvePnpmPackageTransitionCollapse`     | Upgrade Episode Scope collapse                    |
| `collectPnpmImporterTransitionFacts`       | Transition facts                                  |
| `collapsePnpmImporterTransitions`          | Collapse helper                                   |
| `packageJsonManifestPathsFromChangedFiles` | Manifest path derivation                          |
| `normalizePnpmResolvedVersion`             | Peer-context normalization                        |
| `importerManifestPath`                     | Importer mapping                                  |
| `isPnpmLockfileDiffEmpty`                  | Empty-delta detection                             |
| `LockfileDiffOptions`                      | Options type                                      |
| `PnpmImporterTransitionFact`               | Fact type                                         |
| `PnpmPackageTransitionCollapse`            | Collapse union type                               |
| `CollapsedPackageTransition`               | Collapsed transition type                         |
| `ImporterTransitionChangeKind`             | Change kind type                                  |

**Note:** The `./lockfile` subpath is configured in `packages/scan-prep/package.json`. Engine continues to import from its local workspace copy until registry consumption graduates.

---

## Approved `./repository-evidence` exports (`@mergesignal/scan-prep/repository-evidence`)

Provider-neutral repository source-evidence selection policy (pure predicates and bounds). Used by public GitHub corpus preparation and future local acquisition; not storage, upload, or merge-decision logic.

### Policy ownership and roles

- **Full-tree corpus** (`isRepositoryEvidencePathEligible`, `prioritizeRepositoryEvidencePaths`): selects ranked, capped source paths from a complete repository tree for code-analysis evidence collection.
- **Change-request paths** (`isChangeRequestChangedSourcePathEligible`, `filterChangeRequestChangedSourcePaths`): filters PR/webhook changed-file lists to implementable source paths. Does not rank or cap; the host already bounded the list.

Evidence selection chooses **which source files may be collected** for dependency-consumption analysis. It does **not** adjudicate merge compatibility, safety, or Assessment Decision outcomes.

### Canonical path input contract

Acquisition adapters (GitHub tree listing, webhook changed-files, future local/git enumeration) must supply **canonical repository-relative paths** as opaque repository identity strings:

- non-empty;
- no leading `./`;
- no leading `/`;
- not drive-letter / filesystem-root forms (for example `C:`).

The policy validates representation shape only. It does **not** trim, rewrite separators, or otherwise change path identity. Literal backslash or whitespace inside a path may be legitimate repository identity where Git permits it; local acquisition adapters normalize platform filesystem separators **before** this boundary. The policy is **not** a filesystem traversal or path-safety boundary.

Non-canonical path strings are ineligible for corpus selection and change-request filtering.

### Governed source extensions (full-tree corpus)

One frozen extension set — **`REPOSITORY_EVIDENCE_SOURCE_EXTENSIONS`**. Callers must not override eligibility extensions.

Supported terminal extensions: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts`. Matching is by exact terminal extension (for example `.js` does not match `.json` or `.js.map`). `.mts` and `.cts` are TypeScript implementation sources for evidence priority as well as eligibility.

**Current supported corpus scope** excludes declaration-only `.d.ts` files. That is a supported-scope boundary for repository evidence collection—not a claim that declaration contents could never be useful if supplied elsewhere.

### Intentional full-tree vs change-request differences

| Concern                          | Full-tree corpus                                       | Change-request filter                                  |
| -------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| Scope                            | Governed extensions + directory segment exclusions     | Same governed extensions + PR-specific path ignores    |
| `.d.ts`                          | Excluded in current supported scope                    | Excluded via `/\.d\.ts$/`                              |
| Test paths                       | Directory markers (`tests/`, `spec/`, `__tests__/`, …) | Filename/segment patterns (`.test.`, `.spec.`, …)      |
| `public/`, `assets/`, build dirs | Excluded via segment markers                           | Not excluded unless path matches a test/ignore pattern |
| Ranking / cap                    | Priority, exact-path dedupe, path tie-break, then cap  | No ranking or cap                                      |

### Acquisition bounds

`REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES` is a **fixed acquisition ceiling** on how many eligible repository paths may proceed to content retrieval after deterministic selection. `REPOSITORY_EVIDENCE_MAX_FILE_BYTES` (**500 KB** per file, UTF-8) bounds per-file content acquisition. Callers cannot override these through `prioritizeRepositoryEvidencePaths` or public fetch options.

Repository-evidence selection applies provider-neutral eligibility, exact-path dedupe, deterministic ranking, and the governed cap. It is a **bounded baseline selector**, not a claim of full repository coverage. Acquisition or orchestration **may supply a dependency-relevant candidate path set before** this policy runs; the policy validates and bounds that set—it does not rewrite path identity.

Partial repository observation must remain visible through preparation accounting (eligible vs selected vs fetched vs cap-truncated vs size/fetch skips). Repository-evidence selection does **not** adjudicate Assessment outcomes or merge posture.

### Deterministic bounded selection

Pipeline: **canonical paths → eligibility → exact-path dedupe → evidence priority (desc) → UTF-16 path tie-break → cap**.

Equivalent eligible path sets produce the same capped result regardless of provider enumeration order.

### Exported policy collections

`REPOSITORY_EVIDENCE_SOURCE_EXTENSIONS` and `REPOSITORY_EVIDENCE_EXCLUDED_PATH_MARKERS` are runtime-frozen; consumers must not mutate them.

| Symbol                                      | Role                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `REPOSITORY_EVIDENCE_MAX_FILE_BYTES`        | Per-file UTF-8 byte bound for source evidence                               |
| `REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES`   | Maximum repository paths considered per collection pass                     |
| `REPOSITORY_EVIDENCE_SOURCE_EXTENSIONS`     | Governed terminal source extensions for full-tree corpus                    |
| `REPOSITORY_EVIDENCE_EXCLUDED_PATH_MARKERS` | Path segment markers excluded from evidence (vendor/build/test)             |
| `isRepositoryEvidencePathExcluded`          | Exclusion predicate for evidence paths                                      |
| `isRepositoryEvidencePathEligible`          | Full-tree corpus eligibility (extensions + exclusions)                      |
| `prioritizeRepositoryEvidencePaths`         | Dedupe, rank, and apply fixed `REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES` cap |
| `isChangeRequestChangedSourcePathEligible`  | PR changed-path source relevance (distinct from full-tree corpus)           |
| `filterChangeRequestChangedSourcePaths`     | Filter PR changed paths to relevant source files                            |

The workspace root entry (`@mergesignal/scan-prep`) does **not** re-export repository-evidence symbols. Consumers import `@mergesignal/scan-prep/repository-evidence` explicitly.

---

## Rejected exports

The following categories are **explicitly rejected** from the published package:

| Category                             | Examples                                                                                                | Reason                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Private acquisition                  | `fetchTier3Corpus`, `listRepoTree`, `fetchBlobs`, `executeCollectionPlan`, `CollectionAccumulator`      | Engine-private collection orchestration                           |
| Credential / low-level GitHub access | `getInstallationToken`, `clearTokenCache`, `fetchGitHubFiles`, `classifyFetchError`, file-cache helpers | Implementation detail; must not become public integration surface |
| Test utilities                       | `__resetFileCacheForTests`                                                                              | Test-only; not distributable API                                  |
| Engine-only scan options             | `PrepareScanContextOptions`, mandatory `maxTotalFiles`                                                  | Engine orchestration contract; not public ingress                 |
| Cache management on root             | `clearCache`, `cleanupExpiredEntries`                                                                   | No proven external consumer                                       |
| Ungoverned subpaths                  | Wildcard `./*` exports                                                                                  | Prevents unreviewed surface expansion                             |
| Pipeline / decision authority        | Any symbol that clears merges, adjudicates outcomes, or bypasses evidence honesty                       | Violates Assessment Decision boundary                             |
| Internal builders / registries       | Unnecessary implementation helpers exposed for convenience                                              | API minimization                                                  |

---

## Public / private boundary

**Public (may appear in package, docs, tests, fixtures, tarball, CI logs):**

- Lockfile ingress contracts and public-safe GitHub corpus preparation for `prepareScanContext`.
- Published export tables in this document.

**Private (engine-only — must not appear in published artifact):**

- Tiered collection, tree/blob acquisition, collection-plan execution.
- Installation-token caching policy beyond opaque internal use.
- Evidence planner coupling and collection-budget behavior.
- Engine-private module names, heuristics, and restricted acquisition strategy.

Privacy review was required before the `0.1.0` bootstrap publication. Published tarball inspection enforces architectural invariants at publication time via `check:scan-prep-pack-artifact` and `check:scan-prep-isolated-install`: no private implementation in distributable paths, approved exports only, and registry-compatible dependency declarations (no `workspace:`, `catalog:`, `file:`, or `link:` protocols in the packed manifest). Published registry parity verification for `0.1.0` is complete (`check:scan-prep-published-registry`).

---

## Evidence honesty

Scan Preparation must preserve evidence honesty:

- Missing or incomplete lockfile or corpus inputs produce **explicit uncertainty or abstention**, not silent “no change” or false completeness.
- A **verified complete** lockfile comparison with zero dependency transitions is represented by `lockfileEvidenceStatus: { kind: 'verified', delta: 'empty' }` — not a preparation warning.
- `lockfile_diff_empty` is retired; use structured evidence status instead.
- Fetch and classification failures surface as preparation uncertainties consumable downstream.
- Preparation must not fabricate changed-package lists or lockfile deltas.

This aligns with [ENGINEERING-DOCTRINE](https://github.com/MergeSignal/mergesignal-engine/blob/main/docs/engine/ENGINEERING-DOCTRINE.md) epistemic requirements. Downstream Assessment Decision remains the sole merge-decision authority.

### pnpm importer-direct evidence channel

When both base and head lockfiles contain an `importers:` section, Scan Preparation evaluates completeness on the **importer channel** and derives the PR-facing delta from **importer-direct dependency transitions** only. This matches Upgrade Episode Scope authority: direct dependency upgrades appear in importer sections; the `packages:` section may change due to transitive resolution churn without a direct upgrade episode.

| Situation                                             | Evidence status       | Upgrade episode                |
| ----------------------------------------------------- | --------------------- | ------------------------------ |
| Importer-direct transitions present                   | `verified.changed`    | eligible when ingress verifies |
| Importer-direct delta empty, packages section differs | `verified.empty`      | none                           |
| Importers absent on either side                       | packages channel used | per packages delta             |

`verified.empty` in the importer-channel case means **no direct dependency transition was verified**, not that the entire repository is unchanged. It does not certify universal repository equivalence. Transitive or resolution-only churn remains visible in the lockfile but is outside the canonical upgrade-episode evidence channel.

---

## Artifact-identity doctrine

**Permanent architectural invariant:**

> **The distributable package produced from the current workspace must be content-identical to the approved published artifact for that version.**

The public worker must never run Scan Preparation behavior that does not correspond to an approved published package at the declared version. Version, tag, or npm `latest` alignment alone is insufficient to prove this invariant. npm `dist.integrity` and publish provenance attest the bytes stored on the registry; they do not by themselves prove that workspace source at deploy time is content-identical to the approved artifact for that version.

### Current planned enforcement mechanism

**Status: `NOT_YET_ENFORCED`**

Planned enforcement uses **normalized package-content comparison** (workspace `pnpm pack` manifest vs registry pack manifest at the same version). The mechanism may evolve; the doctrine does not.

Planned properties when enforced:

- CI and deploy gates fail closed on content mismatch even when semver matches npm.
- Packed-artifact path scope determines when a version bump is required.
- Publish pipeline uses the same inspected tarball for test-install and `npm publish`.

See [scan-prep-version-selection-checklist.md](./scan-prep-version-selection-checklist.md) for first-publication prerequisites.

---

## Document lifecycle

This section is the lifecycle authority for Scan Preparation documentation. Temporary artifacts must not survive graduation without explicit conversion or removal.

| Document                                                                                                                                               | Classification       | Disposition trigger                                                                       | Permanent replacement                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [scan-prep-api.md](./scan-prep-api.md) (this document)                                                                                                 | Permanent            | —                                                                                         | —                                                                                                                                                                              |
| [scan-prep-migration.md](./scan-prep-migration.md)                                                                                                     | Temporary            | Engine registry consumption complete and `mergesignal-engine/packages/scan-prep/` removed | [PACKAGE_CONSUMPTION_RELEASE_ORDER.md](https://github.com/MergeSignal/mergesignal-engine/blob/main/docs/PACKAGE_CONSUMPTION_RELEASE_ORDER.md) + [releasing.md](./releasing.md) |
| [scan-prep-version-selection-checklist.md](./scan-prep-version-selection-checklist.md)                                                                 | Temporary            | First `@mergesignal/scan-prep` npm publish completed (**trigger satisfied** for `0.1.0`)  | `releasing.md` scan-prep section                                                                                                                                               |
| [PACKAGE_CONSUMPTION_RELEASE_ORDER.md](https://github.com/MergeSignal/mergesignal-engine/blob/main/docs/PACKAGE_CONSUMPTION_RELEASE_ORDER.md)          | Skeleton → permanent | `IMPLEMENTATION_STATUS: active` after engine atomic migration                             | Operational consumption authority                                                                                                                                              |
| [SHARED_PACKAGE_RELEASE_ORDER.md](https://github.com/MergeSignal/mergesignal-engine/blob/main/docs/SHARED_PACKAGE_RELEASE_ORDER.md) transition pointer | Temporary            | Generalized consumption doc becomes `active`                                              | [PACKAGE_CONSUMPTION_RELEASE_ORDER.md](https://github.com/MergeSignal/mergesignal-engine/blob/main/docs/PACKAGE_CONSUMPTION_RELEASE_ORDER.md)                                  |

---

## Related authorities

| Document                                                                                                                                             | Role                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [scan-prep-migration.md](./scan-prep-migration.md)                                                                                                   | **Current** dual-repo operating model and manual port instructions |
| [scan-prep-version-selection-checklist.md](./scan-prep-version-selection-checklist.md)                                                               | Pre-publication checklist (authority artifact)                     |
| [releasing.md](./releasing.md)                                                                                                                       | Shared and contracts release order (operational today)             |
| [mergesignal-engine Evidence Collection](https://github.com/MergeSignal/mergesignal-engine/blob/main/docs/engine/composition/evidence-collection.md) | Private acquisition ownership                                      |
| [PACKAGE_CONSUMPTION_RELEASE_ORDER.md](https://github.com/MergeSignal/mergesignal-engine/blob/main/docs/PACKAGE_CONSUMPTION_RELEASE_ORDER.md)        | Target registry consumption model — **not yet active**             |

---

## Implementation status summary

| Item                                             | Status                                                                                                                                                                                                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public API freeze (this document)                | **Recorded**                                                                                                                                                                                                                                                    |
| `./lockfile` subpath in published `package.json` | **Published in `0.1.0`** on npmjs (included in the published package)                                                                                                                                                                                           |
| npm publication of `@mergesignal/scan-prep`      | **`0.1.0` bootstrap complete** — manual publish; **`0.1.4` OIDC proof complete** — published and registry-verified via Trusted Publishing; do not republish accepted versions or move immutable tags                                                            |
| Artifact-identity enforcement                    | **Validated for `0.1.0` and `0.1.4`** — candidate pack, isolated install, and published-registry parity checks complete; normalized workspace-vs-registry comparison per [Artifact-identity doctrine](#artifact-identity-doctrine) remains **not yet enforced** |
| npm Trusted Publishing (OIDC)                    | **Proven at `0.1.4`** — configured on npmjs; tag-triggered publication via `publish-scan-prep.yml` with no stored npm write token                                                                                                                               |
| Engine registry consumption                      | **Not yet active** — engine uses local `packages/scan-prep` (separate operation)                                                                                                                                                                                |
| Private collection relocation to worker boundary | **Implemented in engine** (not in this package)                                                                                                                                                                                                                 |
