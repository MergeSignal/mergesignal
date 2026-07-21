# @mergesignal/scan-prep migration (mergesignal-engine)

## Target architecture (not yet implemented)

Approved future direction:

- `@mergesignal/scan-prep` published from `mergesignal` to `registry.npmjs.org`
- Engine consumes exact catalog pin; local `packages/scan-prep/` removed atomically with registry migration
- Artifact-identity doctrine enforced: workspace distributable must be content-identical to approved published artifact for that version
- Manual port between repositories **retired** when registry consumption graduates

**Status:** Target only. All instructions below describe **current operating architecture**. Document lifecycle: [scan-prep-api.md](./scan-prep-api.md) § Document lifecycle.

Public API freeze: [scan-prep-api.md](./scan-prep-api.md). Registry consumption authority (inactive): [PACKAGE_CONSUMPTION_RELEASE_ORDER.md](https://github.com/MergeSignal/mergesignal-engine/blob/main/docs/PACKAGE_CONSUMPTION_RELEASE_ORDER.md).

---

## Status (mergesignal-engine)

- [x] Add `@mergesignal/scan-prep` as a workspace package in `mergesignal-engine`
- [x] Replace inline prep in `packages/worker/src/worker.ts` with `prepareScanContext`
- [x] Delete `lockfile-diff.ts`, `github-files.ts`, `github-auth.ts`, `file-cache.ts` from engine worker
- [x] Engine worker tests pass

`mergesignal-engine` keeps an **in-repo workspace copy** of `packages/scan-prep` (not an npm catalog dependency). CI installs it directly — no rsync from this monorepo.

## This monorepo (mergesignal)

- `packages/scan-prep` remains the canonical package for `apps/worker` (`workspace:^`).
- `@mergesignal/scan-prep` is **not yet published** to npm. Publication and artifact-identity enforcement are planned — see [scan-prep-api.md](./scan-prep-api.md).
- Run `scripts/ci/forbid-worker-prep-duplication.sh` in CI to block duplicated prep modules under worker apps.

## Release / sync

When changing scan-prep behavior:

1. Update and test in `mergesignal/packages/scan-prep`
2. Port the same changes to `mergesignal-engine/packages/scan-prep`
3. Deploy public worker (`apps/worker`) and engine worker on compatible versions
