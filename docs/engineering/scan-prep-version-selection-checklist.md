# Scan Preparation — Version Selection Checklist

**Authority artifact for first publication.** Complete this checklist before the first `@mergesignal/scan-prep` npm publish. This document does not authorize publishing by itself.

**Implementation status:** Checklist recorded; **no version has been selected or published** as part of this authority freeze. Retire after first publish — see [scan-prep-api.md](./scan-prep-api.md) § Document lifecycle.

---

## Checklist

Record evidence for each item before first publication. Do not publish, pack, tag, or bump versions until all required items pass review.

| #   | Check                                             | Evidence required                                                                                                                                   | Status  |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | **npm name availability**                         | `npm view @mergesignal/scan-prep versions --registry https://registry.npmjs.org/` — confirm unpublished or document existing versions               | Pending |
| 2   | **Workspace version recorded**                    | Record `mergesignal/packages/scan-prep/package.json` `version` at selection time                                                                    | Pending |
| 3   | **Registry publish permissions**                  | Confirm `@mergesignal/*` npm org publish rights (same identity as `@mergesignal/shared`)                                                            | Pending |
| 4   | **API stability class**                           | First public release of reconciled lockfile ingress + public `prepareScanContext` — document as initial published baseline                          | Pending |
| 5   | **Semver decision**                               | Choose exact initial version (`0.1.0` or bump) at API-minimization review — not preselected here                                                    | Pending |
| 6   | **Export surface confirmation**                   | Published `exports` match [scan-prep-api.md](./scan-prep-api.md) root + `./lockfile` tables                                                         | Pending |
| 7   | **Rejected exports absent**                       | No rejected symbols in published `exports` or distributable `dist/`                                                                                 | Pending |
| 8   | **Published `@mergesignal/shared` compatibility** | Exact `@mergesignal/shared` `0.13.0` in source and packed `dependencies`; isolated install resolves Shared from public npmjs without authentication | Pending |
| 9   | **Workspace dependency transformation**           | Inspect **packed** `package.json` inside `.tgz` — no `workspace:`, `catalog:`, `file:`, or `link:` in runtime `dependencies`                        | Pending |
| 10  | **Privacy review**                                | Tarball dry-run passes architectural invariants; no private implementation in distributable artifact                                                | Pending |
| 11  | **Release tag naming**                            | Tag pattern `scan-prep-vX.Y.Z` matches `package.json` version                                                                                       | Pending |
| 12  | **Artifact-identity readiness**                   | Normalized content-comparison pipeline operational; enforcement configured before public worker deploy depends on publish                           | Pending |
| 13  | **Distributable path change review**              | If `package.json`, `tsconfig.json`, or non-test `src/**` changed since last publish, version bump required                                          | Pending |
| 14  | **Version-bump reasoning documented**             | Record why chosen semver reflects API / distributable changes                                                                                       | Pending |
| 15  | **Engine consumption coordination**               | Engine publication consumption PR planned atomically with duplicate removal — not active until registry publish completes                           | Pending |

---

## Packed-artifact scope (version-bump determination)

**Affects distributable artifact** (requires version bump when changed before publish):

- `packages/scan-prep/package.json`
- `packages/scan-prep/tsconfig.json`
- `packages/scan-prep/src/**` except `**/*.test.ts`, `**/__tests__/**`, `**/__fixtures__/**`

**Does not affect distributable artifact** (no version bump required):

- `README.md`, `docs/engineering/**`, migration docs, workflows (must not alter pack output)
- Test-only source excluded from `tsc` emit

---

## Post-selection record

When completed, record here (do not fill during API freeze):

| Field                     | Value                       |
| ------------------------- | --------------------------- |
| Selected version          | _TBD at publication review_ |
| Selection date            | _TBD_                       |
| API-minimization sign-off | _TBD_                       |
| Privacy sign-off          | _TBD_                       |
| Architecture sign-off     | _TBD_                       |
