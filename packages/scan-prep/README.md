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

`@mergesignal/scan-prep` is **not yet published** to npmjs. Graduation validation is implemented in this repository.

### CI and pre-tag validation

These commands may independently pack candidates to validate repository readiness before the release tag:

- `pnpm run check:scan-prep-pack-artifact`
- `pnpm run check:scan-prep-isolated-install`
- `pnpm run check:scan-prep-export-surface`
- `pnpm run check:scan-prep-authority`

They do **not** produce the tarball used for manual publication.

### Manual publication candidate

The only command used to create the artifact later published is:

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

Read-only published verification: `pnpm run check:scan-prep-published-registry` or `.github/workflows/verify-scan-prep-registry.yml`

**First publication (`0.1.0`):** manual interactive `npm login` + 2FA on registry.npmjs.org. Publish the exact validated candidate tarball from `pack:scan-prep-release-candidate`. **No GitHub secret. No npm write token.**

**Permanent publication (`0.1.1+`):** GitHub Trusted Publishing / OIDC via `.github/workflows/publish-scan-prep.yml` (Release Group B — add only after `0.1.0` exists and Trusted Publishing is configured).

Shared’s existing `NPM_TOKEN` is for `@mergesignal/shared` only — do not use it for Scan Preparation.

Public consumer installation requires **no npm authentication**. See [releasing.md](../../docs/engineering/releasing.md).

Permanent contract authority: [docs/engineering/scan-prep-api.md](../../docs/engineering/scan-prep-api.md).
