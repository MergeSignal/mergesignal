# @mergesignal/scan-prep migration (mergesignal-engine)

## Status (mergesignal-engine)

- [x] Add `@mergesignal/scan-prep` as a workspace package in `mergesignal-engine`
- [x] Replace inline prep in `packages/worker/src/worker.ts` with `prepareScanContext`
- [x] Delete `lockfile-diff.ts`, `github-files.ts`, `github-auth.ts`, `file-cache.ts` from engine worker
- [x] Engine worker tests pass

`mergesignal-engine` keeps an **in-repo workspace copy** of `packages/scan-prep` (not an npm catalog dependency). CI installs it directly — no rsync from this monorepo.

## This monorepo (mergesignal)

- `packages/scan-prep` remains the canonical package for `apps/worker` (`workspace:^`).
- `@mergesignal/scan-prep` may still be published to npm for external consumers; keep versions aligned when changing prep behavior.
- Run `scripts/ci/forbid-worker-prep-duplication.sh` in CI to block duplicated prep modules under worker apps.

## Release / sync

When changing scan-prep behavior:

1. Update and test in `mergesignal/packages/scan-prep`
2. Port the same changes to `mergesignal-engine/packages/scan-prep`
3. Deploy public worker (`apps/worker`) and engine worker on compatible versions
