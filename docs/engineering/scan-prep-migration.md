# @mergesignal/scan-prep migration (PR B — mergesignal-engine)

## Checklist

- [ ] Add `@mergesignal/scan-prep` to `pnpm-workspace.yaml` catalog in `mergesignal-engine`
- [ ] `pnpm update @mergesignal/scan-prep@latest -r`
- [ ] Replace inline prep in `packages/worker/src/worker.ts` with `prepareScanContext`
- [ ] Delete `lockfile-diff.ts`, `github-files.ts`, `github-auth.ts`, `file-cache.ts`
- [ ] Run `scripts/ci/forbid-worker-prep-duplication.sh` from mergesignal repo against engine worker path
- [ ] Verify engine worker tests pass

## Release process

1. Publish `@mergesignal/scan-prep` from `mergesignal` monorepo
2. Bump catalog version in `mergesignal-engine`
3. Deploy public worker + engine worker on compatible versions
