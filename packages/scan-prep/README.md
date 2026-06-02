# @mergesignal/scan-prep

Single source of truth for **scan job preparation** before the analysis engine runs.

## Responsibilities

- Lockfile diff → `changedPackages`, `lockfilePackageDelta`
- GitHub source corpus fetch (when `repoSource` + changed packages)
- `prepareScanContext(job)` → `{ scanRequest, codeAnalysis?, warnings, preparationSummary }`

## Workers must NOT

Reimplement `lockfile-diff`, `github-files`, `github-auth`, or `file-cache` under `apps/worker` or `mergesignal-engine/packages/worker`. Import `prepareScanContext` from this package only.

CI enforces this via `scripts/ci/forbid-worker-prep-duplication.sh`.

## Environment

| Variable                     | Purpose                                      |
| ---------------------------- | -------------------------------------------- |
| `GITHUB_APP_ID`              | GitHub App id for installation tokens        |
| `GITHUB_PRIVATE_KEY`         | PEM for App auth                             |
| `CODE_ANALYSIS_TIMEOUT_MS`   | File fetch timeout (default 30000)           |
| `CODE_ANALYSIS_CACHE_TTL_MS` | In-memory corpus cache TTL (default 3600000) |

## Release

Publish from the `mergesignal` monorepo (same pipeline as `@mergesignal/shared`). Bump the catalog entry in `mergesignal-engine` when releasing.
