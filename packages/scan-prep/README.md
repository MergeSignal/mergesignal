# @mergesignal/scan-prep

Single source of truth for **scan job preparation** before the analysis engine runs.

## Responsibilities

- Lockfile diff → `changedPackages`, `lockfilePackageDelta`
- GitHub source corpus fetch (when `repoSource` + changed packages)
- `prepareScanContext(job)` → `{ scanRequest, codeAnalysis?, warnings, preparationSummary }`

## Workers must NOT

Reimplement `lockfile-diff`, `github-files`, `github-auth`, or `file-cache` under `apps/worker` or `mergesignal-engine/packages/worker`. Import `prepareScanContext` from this package only.

CI enforces this via `scripts/ci/forbid-worker-prep-duplication.sh`.

`mergesignal-engine` also maintains an in-repo workspace copy at `packages/scan-prep` — keep behavior in sync when changing this package. See [scan-prep-migration.md](../../docs/engineering/scan-prep-migration.md).

## Environment

| Variable                     | Purpose                                      |
| ---------------------------- | -------------------------------------------- |
| `GITHUB_APP_ID`              | GitHub App id for installation tokens        |
| `GITHUB_PRIVATE_KEY`         | PEM for App auth                             |
| `CODE_ANALYSIS_TIMEOUT_MS`   | File fetch timeout (default 30000)           |
| `CODE_ANALYSIS_CACHE_TTL_MS` | In-memory corpus cache TTL (default 3600000) |

## Publication

`@mergesignal/scan-prep` is **not yet published** to npm. Publication, registry consumption, and artifact-identity enforcement are **target (not yet implemented)**.

Permanent public contract authority: [docs/engineering/scan-prep-api.md](../../docs/engineering/scan-prep-api.md). Current dual-repo sync procedure: [docs/engineering/scan-prep-migration.md](../../docs/engineering/scan-prep-migration.md).
