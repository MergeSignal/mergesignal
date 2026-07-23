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

**`./lockfile`:** `prepareLockfileContext`, `hasVerifiedLockfileIngress`, `hasVerifiedEmptyLockfileIngress`, `detectChangedPackages`, `detectLockfilePackageDelta`, `resolvePnpmPackageTransitionCollapse`, and related lockfile types.

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

`@mergesignal/scan-prep@0.1.0` is **published and registry-verified** on npmjs (manual bootstrap). `@mergesignal/scan-prep@0.1.4` is the **OIDC Trusted Publishing proof release** — published and registry-verified via [publish-scan-prep.yml](../../.github/workflows/publish-scan-prep.yml) with no stored npm write token. Tag `scan-prep-v0.1.0` is immutable — do not republish `0.1.0` or move the tag. Private-engine registry consumption is a separate operation.

### CI and pre-tag validation

These commands may independently pack candidates to validate repository readiness before the release tag:

- `pnpm run check:scan-prep-pack-artifact`
- `pnpm run check:scan-prep-isolated-install`
- `pnpm run check:scan-prep-export-surface`
- `pnpm run check:scan-prep-authority`

They do **not** produce the governed release candidate used for publication.

### Governed release candidate

The only command that creates the tarball published to npmjs is:

```bash
pnpm run pack:scan-prep-release-candidate -- --output-dir=<fresh-external-directory>
```

This command packs once, validates that exact candidate, runs isolated external-consumer installation on those exact bytes, verifies digest stability, and writes the final report only on success.

Use a fresh external output directory. The command rejects an existing target candidate or report for the same version.

Always use the exact resolved candidate and report paths printed by `pack:scan-prep-release-candidate`. Filesystem canonicalization may normalize paths internally (for example `/tmp/...` to `/private/tmp/...` on macOS). Do not reconstruct, convert, or guess either path.

Before publication, compare the reported `integrity` digest with an independently calculated SHA-512 of the reported candidate file immediately before publication.

```bash
npm publish "<reported-resolved-candidate-path>" --access public
```

Do not rebuild, repack, or rerun a validator that creates another tarball.

Public registry verification (mandatory after publication): `pnpm run check:scan-prep-published-registry` or [verify-scan-prep-registry.yml](../../.github/workflows/verify-scan-prep-registry.yml). If publication succeeds but verification fails, rerun the read-only workflow — never republish the same version.

**Bootstrap public publication (`0.1.0`):** completed manually with interactive `npm login` + 2FA on registry.npmjs.org. **No GitHub secret. No npm write token.**

**Permanent publication (`0.1.1+`):** GitHub Trusted Publishing / OIDC via `.github/workflows/publish-scan-prep.yml` — publishes the governed release candidate with **no stored npm write token**. OIDC proof completed at `@mergesignal/scan-prep@0.1.4` (`scan-prep-v0.1.4`).

Shared’s existing `NPM_TOKEN` is for `@mergesignal/shared` only — do not use it for Scan Preparation.

Public consumer installation requires **no npm authentication**. Maintainer procedures: [releasing.md](../../docs/engineering/releasing.md).

Permanent contract authority: [docs/engineering/scan-prep-api.md](../../docs/engineering/scan-prep-api.md).
