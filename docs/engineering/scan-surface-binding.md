# Scan surface binding

Production invariant: one PR event → one `scans.id` → one persisted `ScanResult` → GitHub Check Run + dashboard card + details page.

## Worker (`apps/worker`)

1. `prepareScanContext` → `analyze` → validate → `persistSuccess(scanId)`
2. When `MERGESIGNAL_PUBLISH_GITHUB_SURFACES=1` and job has `github` context: `publishGitHubCheckRun` (same in-memory result, same `scanId`)
3. Success → `github_surfaces_published_at = NOW()`; failure → `github_surfaces_publish_error`, job still completes

Check Run markdown is built via `@mergesignal/shared` `buildGitHubCheckRunOutput` (Assessment bundle → `presentGitHubCheckRun` → `renderGitHubCheckRunMarkdown`).

## Dashboard API (`GET /repo/:owner/:repo/pull-request-scans`)

Query `prHeads=42:abc123,43:def456` binds open PR head SHAs. Per `(prNumber, headSha)` resolution priority:

1. `queued` / `running` for head → `scanning` (pipeline card)
2. `failed` for head → `analysis_failed`
3. `done` + `github_surfaces_published_at` + head → `ready` (Assessment card)
4. `done` + `result` + no `github_surfaces_published_at` + head → `surfaces_incomplete` (pipeline card only; details still load `/scan/{id}`)
5. Surfaced scan for older head → `stale`
6. Otherwise omitted (`not_scanned` in web view model)

`aggregates.byDecision` counts only `presentationState === ready` rows.

## Schema

Migration `017_github_surfaces_published.sql`: `github_surfaces_published_at`, `github_surfaces_publish_error`.

## Rollback

1. Redeploy last OSS worker image on `mergesignal-worker`
2. Set `MERGESIGNAL_PUBLISH_GITHUB_SURFACES=0` (persist without publish)
3. Never deploy `mergesignal-engine` to production `mergesignal-worker`
