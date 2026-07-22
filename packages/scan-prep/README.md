# @mergesignal/scan-prep

Canonical public Scan Preparation package — lockfile ingress authority and public-safe scan job preparation before intelligence domains run.

## Responsibilities

| Surface                                          | Responsibility                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Root (`@mergesignal/scan-prep`)                  | `prepareScanContext(job)` for the public worker ingress contract                       |
| `./lockfile` (`@mergesignal/scan-prep/lockfile`) | Lockfile transition context, changed-package discovery, pnpm importer collapse helpers |

Public-safe preparation includes:

- deterministic lockfile diff and changed-package discovery;
- optional GitHub source corpus fetch **inside** `prepareScanContext` (not exported);
- explicit preparation warnings when inputs are missing or incomplete.

## Explicit exclusions

The published package must **not** contain:

- Worker Evidence Collection orchestration or tiered repository acquisition;
- collection-plan execution, private tree/blob batching, or tier-three corpus collection;
- Assessment Decision or merge-recommendation logic;
- Package Intelligence registry or tarball behavior.

Permanent contract authority: [docs/engineering/scan-prep-api.md](../../docs/engineering/scan-prep-api.md).

## Approved exports

**Root:** `prepareScanContext`, `PrepareScanContextResult`, `ScanPreparationSummary`

**`./lockfile`:** `prepareLockfileContext`, `LockfileContextResult`, `detectChangedPackages`, `detectLockfilePackageDelta`, `resolvePnpmPackageTransitionCollapse`, `collectPnpmImporterTransitionFacts`, `collapsePnpmImporterTransitions`, `packageJsonManifestPathsFromChangedFiles`, `normalizePnpmResolvedVersion`, `importerManifestPath`, `isPnpmLockfileDiffEmpty`, and related lockfile types.

Low-level GitHub authentication, corpus cache controls, and raw fetch helpers are internal implementation details.

## Workers must NOT

Reimplement lockfile diff or GitHub corpus preparation under `apps/worker`. Import `prepareScanContext` from this package only.

CI enforces duplication guards via `scripts/ci/forbid-worker-prep-duplication.sh` and export-surface checks.

`mergesignal-engine` maintains a separate workspace copy for private engine deployment until registry consumption graduates. Port lockfile authority changes here first; see [scan-prep-migration.md](../../docs/engineering/scan-prep-migration.md).

## Environment

| Variable                     | Purpose                                      |
| ---------------------------- | -------------------------------------------- |
| `GITHUB_APP_ID`              | GitHub App id for installation tokens        |
| `GITHUB_PRIVATE_KEY`         | PEM for App auth                             |
| `CODE_ANALYSIS_TIMEOUT_MS`   | File fetch timeout (default 30000)           |
| `CODE_ANALYSIS_CACHE_TTL_MS` | In-memory corpus cache TTL (default 3600000) |

## Publication

`@mergesignal/scan-prep` is **not yet published** to npm. The canonical public core is implemented in this repository; publication, registry consumption, and artifact-identity enforcement remain later governed work.

Pre-publication checklist: [docs/engineering/scan-prep-version-selection-checklist.md](../../docs/engineering/scan-prep-version-selection-checklist.md).
