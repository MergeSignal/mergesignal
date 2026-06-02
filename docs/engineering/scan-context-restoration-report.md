# Scan context restoration — verification report

## Summary

Production worker (`apps/worker`) now calls `prepareScanContext` from `@mergesignal/scan-prep` before `analyze(scanRequest, codeAnalysis)`, restoring lockfile deltas and optional source corpus for PR scans.

## Before (production path)

- `analyze(scanQueueJobToScanRequest(job))` — single argument
- No `changedPackages` / `lockfilePackageDelta` on `ScanRequest`
- No `codeAnalysis` second argument
- Stored `ScanResult` lacked `repoIntelligence` for PR scans

## After (this change)

- `prepareScanContext(job)` → enriched `ScanRequest` + optional `codeAnalysis`
- Structured `scan_context_prepared` / `scan_context_warning` logs
- Persisted `analysisPreparation` on `ScanResult` when corpus unavailable
- Engine ABI Probe B requires `analyze(req, codeAnalysis)` support at startup

## Fixture scenarios (automated)

| Scenario                    | Lockfile delta                | Corpus in tests                         | Assertions                               |
| --------------------------- | ----------------------------- | --------------------------------------- | ---------------------------------------- |
| Authentication upgrade      | `jsonwebtoken` / auth package | Mocked in e2e via `engine-test-fixture` | `repoIntelligence` when corpus passed    |
| Runtime framework (`react`) | `updated: [react]`            | Golden + contract tests                 | `changedPackages`, delta                 |
| Build-only (`typescript`)   | See `scan-prep` e2e           | Fixture lockfiles                       | No exaggerated runtime findings (engine) |
| Test-only (`vitest`)        | See `scan-prep` e2e           | Fixture lockfiles                       | Classification via engine                |
| Utility (`lodash`)          | Multi-package diff tests      | lockfile-diff.test.ts                   | added/removed/updated                    |

## Post-deploy checklist (§4.7)

Run on a real PR after worker deploy:

1. [ ] `worker_startup_complete` — ABI Probe B passed, `supportsCodeAnalysisArgument`
2. [ ] PR scan with lockfile change completes
3. [ ] Logs: `changedPackageCount > 0`
4. [ ] Logs: `codeAnalysisEnabled: true` (when GitHub App secrets set)
5. [ ] DB `scans.result` contains `repoIntelligence` (corpus-enabled PR)
6. [ ] DB `analysisPreparation.codeIntelligenceAvailable` matches logs
7. [ ] Findings include enriched `evidence` where applicable
8. [ ] No unexpected `lockfile_diff_*` / `code_fetch_*` warnings
       9–10. Check Run alignment — **follow-up initiative** (out of scope)

## PR B (mergesignal-engine)

Engine worker must adopt `@mergesignal/scan-prep` and delete local prep modules. See `docs/engineering/scan-prep-migration.md`.
