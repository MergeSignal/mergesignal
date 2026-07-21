# Scan Preparation — Public API Authority

**Package:** `@mergesignal/scan-prep`  
**Owning repository:** `MergeSignal/mergesignal`  
**Architectural owner:** Scan Preparation (public ingress domain)  
**Implementation status:** API freeze recorded; publication, registry consumption, and artifact-identity enforcement are **not yet implemented**.

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

| Responsibility                                                             | Owner                                                                                    |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Canonical `@mergesignal/scan-prep` source                                  | `mergesignal/packages/scan-prep`                                                         |
| Public worker consumption (today)                                          | `mergesignal/apps/worker` via `workspace:^`                                              |
| Published npm artifact (target)                                            | `registry.npmjs.org` — **not yet published**                                             |
| Private GitHub acquisition, tiered collection, installation-token handling | `mergesignal-engine` (Evidence Collection) — **private, engine-owned**                   |
| Engine Scan Preparation copy (today)                                       | `mergesignal-engine/packages/scan-prep` — **local workspace copy; manual port required** |

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

| Symbol                     | Role                                 |
| -------------------------- | ------------------------------------ |
| `prepareScanContext`       | Production public worker contract    |
| `PrepareScanContextResult` | Result type                          |
| `ScanPreparationSummary`   | Preparation metadata / observability |

**Note:** Today's workspace `package.json` exports additional symbols. The table above is the **approved published surface** at freeze. Convergence to this surface occurs in later implementation work; this document records the freeze authority only.

---

## Approved `./lockfile` exports (`@mergesignal/scan-prep/lockfile`)

| Symbol                                     | Role                           |
| ------------------------------------------ | ------------------------------ |
| `prepareLockfileContext`                   | Engine worker lockfile ingress |
| `LockfileContextResult`                    | Result type                    |
| `detectChangedPackages`                    | Changed-package authority      |
| `detectLockfilePackageDelta`               | Lockfile delta authority       |
| `resolvePnpmPackageTransitionCollapse`     | Upgrade Episode Scope collapse |
| `collectPnpmImporterTransitionFacts`       | Transition facts               |
| `collapsePnpmImporterTransitions`          | Collapse helper                |
| `packageJsonManifestPathsFromChangedFiles` | Manifest path derivation       |
| `normalizePnpmResolvedVersion`             | Peer-context normalization     |
| `importerManifestPath`                     | Importer mapping               |
| `isPnpmLockfileDiffEmpty`                  | Empty-delta detection          |
| `LockfileDiffOptions`                      | Options type                   |
| `PnpmImporterTransitionFact`               | Fact type                      |
| `PnpmPackageTransitionCollapse`            | Collapse union type            |
| `CollapsedPackageTransition`               | Collapsed transition type      |
| `ImporterTransitionChangeKind`             | Change kind type               |

**Note:** The `./lockfile` subpath is **approved but not yet published**. Engine continues to import from its local workspace copy today.

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

Privacy review is required before first publication. Published tarball inspection must enforce architectural invariants at publication time: no private implementation in distributable paths, approved exports only, and registry-compatible dependency declarations (no `workspace:`, `catalog:`, `file:`, or `link:` protocols). Flexible benign npm metadata may evolve without governance updates. Enforcement is **not yet implemented**.

---

## Evidence honesty

Scan Preparation must preserve evidence honesty:

- Missing or incomplete lockfile or corpus inputs produce **explicit uncertainty or abstention**, not silent “no change” or false completeness.
- Fetch and classification failures surface as preparation uncertainties consumable downstream.
- Preparation must not fabricate changed-package lists or lockfile deltas.

This aligns with [ENGINEERING-DOCTRINE](https://github.com/MergeSignal/mergesignal-engine/blob/main/docs/engine/ENGINEERING-DOCTRINE.md) epistemic requirements. Downstream Assessment Decision remains the sole merge-decision authority.

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
| [scan-prep-version-selection-checklist.md](./scan-prep-version-selection-checklist.md)                                                                 | Temporary            | First `@mergesignal/scan-prep` npm publish completed                                      | `releasing.md` scan-prep section                                                                                                                                               |
| [scan-prep-architecture-approval-checklist.md](./scan-prep-architecture-approval-checklist.md)                                                         | Temporary            | Architecture and privacy sign-off recorded                                                | Sign-off in merge record; remove this file                                                                                                                                     |
| [PACKAGE_CONSUMPTION_RELEASE_ORDER.md](https://github.com/MergeSignal/mergesignal-engine/blob/main/docs/PACKAGE_CONSUMPTION_RELEASE_ORDER.md)          | Skeleton → permanent | `IMPLEMENTATION_STATUS: active` after engine atomic migration                             | Operational consumption authority                                                                                                                                              |
| [SHARED_PACKAGE_RELEASE_ORDER.md](https://github.com/MergeSignal/mergesignal-engine/blob/main/docs/SHARED_PACKAGE_RELEASE_ORDER.md) transition pointer | Temporary            | Generalized consumption doc becomes `active`                                              | [PACKAGE_CONSUMPTION_RELEASE_ORDER.md](https://github.com/MergeSignal/mergesignal-engine/blob/main/docs/PACKAGE_CONSUMPTION_RELEASE_ORDER.md)                                  |

---

## Related authorities

| Document                                                                                                                                             | Role                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [scan-prep-migration.md](./scan-prep-migration.md)                                                                                                   | **Current** dual-repo operating model and manual port instructions |
| [scan-prep-version-selection-checklist.md](./scan-prep-version-selection-checklist.md)                                                               | Pre-publication checklist (authority artifact)                     |
| [scan-prep-architecture-approval-checklist.md](./scan-prep-architecture-approval-checklist.md)                                                       | Architecture and privacy sign-off gate                             |
| [releasing.md](./releasing.md)                                                                                                                       | Shared and contracts release order (operational today)             |
| [mergesignal-engine Evidence Collection](https://github.com/MergeSignal/mergesignal-engine/blob/main/docs/engine/composition/evidence-collection.md) | Private acquisition ownership                                      |
| [PACKAGE_CONSUMPTION_RELEASE_ORDER.md](https://github.com/MergeSignal/mergesignal-engine/blob/main/docs/PACKAGE_CONSUMPTION_RELEASE_ORDER.md)        | Target registry consumption model — **not yet active**             |

---

## Implementation status summary

| Item                                             | Status                                                      |
| ------------------------------------------------ | ----------------------------------------------------------- |
| Public API freeze (this document)                | **Recorded**                                                |
| `./lockfile` subpath in published `package.json` | **Not yet implemented**                                     |
| npm publication of `@mergesignal/scan-prep`      | **Not yet implemented**                                     |
| Artifact-identity enforcement                    | **`NOT_YET_ENFORCED`**                                      |
| Engine registry consumption                      | **Not yet active** — engine uses local `packages/scan-prep` |
| Private collection relocation to worker boundary | **Target (not yet implemented)**                            |
