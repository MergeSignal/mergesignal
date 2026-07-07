# Releasing (GitHub Actions integration)

## Current architecture (Phase 2 complete — 2026-06-15)

Both repositories build and test **independently** with registry-resolved dependencies only.

```
@mergesignal/contracts@0.7.0  (GitHub Packages, published from mergesignal-engine)
        ↓
@mergesignal/shared           (npmjs.org, published from mergesignal)
        ↓
mergesignal apps + mergesignal-engine consumers
```

| Repo               | Contracts                          | Shared                  | Engine deploy pin               |
| ------------------ | ---------------------------------- | ----------------------- | ------------------------------- |
| mergesignal        | pnpm catalog → GH Packages tarball | workspace + npm publish | `MERGESIGNAL_ENGINE_REF=v2.0.0` |
| mergesignal-engine | workspace `packages/contracts`     | npm catalog `0.7.0`     | tag `v2.0.0`                    |

No cross-repo workspace paths, `file:` deps, or sibling checkouts are required.

**pnpm toolchain:** single authority in root `package.json` `packageManager`; see [pnpm-version-governance.md](./pnpm-version-governance.md).

---

## Routine release order

When bumping contract or shared versions:

1. **Contracts** (if wire shape changes) — bump `packages/contracts`, tag `contracts-vX.Y.Z` on mergesignal-engine, publish via [publish-contracts.yml](https://github.com/MergeSignal/mergesignal-engine/blob/main/.github/workflows/publish-contracts.yml).
2. **mergesignal catalog** — bump `pnpm-workspace.yaml` `catalog.@mergesignal/contracts` and `scripts/contracts-version-expectations.ts` to the published version; set all consumers to `"catalog:"`; run `pnpm install` (requires `NODE_AUTH_TOKEN` with `read:packages`).
3. **Shared** — bump `packages/shared`, merge to `main`, tag `shared-vX.Y.Z`, publish via [publish-shared.yml](.github/workflows/publish-shared.yml). On success, the publish workflow sends `shared-package-released` to mergesignal-engine (see [Engine notification](#engine-notification-after-shared-publish)).
4. **Engine** — consume the dispatch (or bump manually if the listener is not yet deployed): bump catalog pin in mergesignal-engine `pnpm-workspace.yaml`, refresh lockfile, tag engine release (e.g. `v2.0.1`), set `MERGESIGNAL_ENGINE_REF` on mergesignal.
5. **Validate** — `pnpm check:contracts-catalog` and fresh-clone checks below on both repos.

### Lockfile refresh

**mergesignal** (needs GH Packages auth for contracts):

```bash
export NODE_AUTH_TOKEN=ghp_...   # read:packages
pnpm config set //npm.pkg.github.com/:_authToken "$NODE_AUTH_TOKEN"
rm -rf node_modules && pnpm install
pnpm build && pnpm test
```

**mergesignal-engine** (no GH token for install):

```bash
rm -rf node_modules && pnpm install
pnpm build && pnpm test
pnpm run check:assessment-authority
```

**Verify no cross-repo links:**

```bash
rg 'file:.*mergesignal-engine|mergesignal-engine/packages/contracts' pnpm-workspace.yaml package.json packages apps pnpm-lock.yaml
pnpm check:contracts-catalog
```

### Fresh-clone validation

```bash
# mergesignal — needs NODE_AUTH_TOKEN (read:packages)
git clone https://github.com/MergeSignal/mergesignal.git /tmp/ms-clone && cd /tmp/ms-clone
export NODE_AUTH_TOKEN=ghp_...
pnpm install --frozen-lockfile && pnpm build && pnpm test

# mergesignal-engine — no GH token
git clone https://github.com/MergeSignal/mergesignal-engine.git /tmp/me-clone && cd /tmp/me-clone
pnpm install --frozen-lockfile && pnpm build && pnpm test
```

---

## `@mergesignal/contracts` (GitHub Packages)

Published from **mergesignal-engine** (`packages/contracts`). Public visibility; auth still required for every install (GitHub Packages npm policy).

**Version authority in mergesignal (public repo):** `pnpm-workspace.yaml` `catalog` entry — consumers use `"@mergesignal/contracts": "catalog:"` only. Bump the catalog and `scripts/contracts-version-expectations.ts` together after publishing `contracts-vX.Y.Z`. CI runs `pnpm check:contracts-catalog` to enforce catalog pins, lockfile registry resolution, and installed version alignment.

**mergesignal contributors (local clone)**

1. Root [`.npmrc`](../.npmrc) routes `@mergesignal` to GitHub Packages (no secrets in repo).
2. One-time user auth (classic PAT with `read:packages`):
   ```bash
   pnpm config set //npm.pkg.github.com/:_authToken "$GITHUB_PAT"
   ```
   Or per session: `export NODE_AUTH_TOKEN=ghp_...` before `pnpm install` (CI uses `GITHUB_TOKEN`).

**Docker (worker image)** — pass `gh_packages_token` build secret; see [apps/worker/Dockerfile](../../apps/worker/Dockerfile).

---

## `@mergesignal/shared` (npm)

The canonical contract and presentation package lives in `packages/shared` and is published to the **public npm registry** as `@mergesignal/shared`.

**`0.3.0`+:** strict `repoIntelligence` wire (`REPO_INTELLIGENCE_ABI`), `safeParseRepoIntelligence`, and `applyRepoIntelligenceValidation`. Publish shared before bumping the engine’s exact pin.

**Publish (maintainers)**

1. Bump `version` in `packages/shared/package.json` (semver).
2. Merge to `main`.
3. Tag: `git tag shared-v0.2.3` (prefix must match `shared-v*`).
4. Push the tag: `git push origin shared-v0.2.3`.
5. GitHub Actions workflow [`.github/workflows/publish-shared.yml`](.github/workflows/publish-shared.yml) runs build, tests, `npm publish`, and notifies mergesignal-engine (requires `NPM_TOKEN` with **Bypass 2FA** when org 2FA is on, plus `MERGESIGNAL_ENGINE_DISPATCH_TOKEN` — see [Engine notification](#engine-notification-after-shared-publish)).

**Consumers (e.g. `mergesignal-engine`)** use an **exact** semver pin in `package.json` (e.g. `"@mergesignal/shared": "0.2.3"`, not `^0.2.3`) plus a frozen `pnpm-lock.yaml` — do not copy `packages/shared` source or vendor tarballs.

### Engine notification after shared publish

After a successful `npm publish`, [publish-shared.yml](.github/workflows/publish-shared.yml) verifies the version on the registry and sends a `repository_dispatch` event to mergesignal-engine. The public repo **does not** modify the engine repository — it only publishes release metadata. The engine repo owns how to consume the event (bump pin, open PR, run tests, tag, deploy).

**Event type:** `shared-package-released`

**Payload (`client_payload`):**

| Field        | Type   | Description                                                             |
| ------------ | ------ | ----------------------------------------------------------------------- |
| `package`    | string | Always `@mergesignal/shared`                                            |
| `version`    | string | Published semver (e.g. `0.11.0`)                                        |
| `tag`        | string | Release tag (e.g. `shared-v0.11.0`) or empty for manual / recovery runs |
| `commit_sha` | string | Git commit SHA checked out when the publish workflow ran                |

**Required secret (mergesignal repo):** `MERGESIGNAL_ENGINE_DISPATCH_TOKEN`

Do **not** reuse `MERGESIGNAL_ENGINE_REPO_TOKEN` (read-only engine checkout). Dispatch needs write access on the target repository.

**Create the dispatch token (fine-grained PAT — preferred):**

1. GitHub → Settings → Developer settings → Fine-grained personal access tokens → Generate.
2. Resource owner: `MergeSignal` org.
3. Repository access: **Only** `mergesignal-engine`.
4. Permissions: **Contents → Read and write** (Metadata read-only is included automatically).
5. Store the token in `MergeSignal/mergesignal` → Settings → Secrets and variables → Actions → **`MERGESIGNAL_ENGINE_DISPATCH_TOKEN`**.

**Classic PAT alternative:** `repo` scope on a machine user with access to `mergesignal-engine` (broader than fine-grained — avoid when possible).

**Target repository:** repo variable `MERGESIGNAL_ENGINE_REPOSITORY` (default `MergeSignal/mergesignal-engine` when unset).

**Failure behavior:** If dispatch fails, the publish workflow fails (red). npm publish is not rolled back — treat a failed run as “published but not notified.”

**Recovery:** Actions → **Publish @mergesignal/shared** → **Run workflow** → enable **notify_only**. This skips build/publish, confirms the version from `packages/shared/package.json` exists on npm, and resends the dispatch. The engine consumer should dedupe on `version` if it already processed the release.

**Engine consumer (mergesignal-engine):** Add a workflow on the default branch, for example:

```yaml
on:
  repository_dispatch:
    types: [shared-package-released]
```

Validate `github.event.client_payload` fields, dedupe by `version`, then bump the shared pin and run your release pipeline.

**Prerequisites (first publish / token rotation)**

- npm org **`mergesignal`** with publish access for the token identity (the npm user that owns the token must be allowed to publish `@mergesignal/*`).
- GitHub secret **`NPM_TOKEN`**: **new** granular token (bypass cannot be added to an existing token).

**Create the granular token (npm → Access Tokens → Generate New Token)**

1. Check **Bypass two-factor authentication** (required when the org enforces 2FA; default is unchecked).
2. Under **Packages and scopes** → **Only select packages and scopes** → add scope **`@mergesignal`** (or package `@mergesignal/shared`) with **Read and write**.
3. Do **not** rely on **Organizations → Read and write** alone — [npm docs](https://docs.npmjs.com/creating-and-viewing-access-tokens) state org-level tokens manage org settings/teams, **not** publishing packages.
4. Leave **Allowed IP ranges** empty unless you maintain GitHub Actions egress CIDRs.
5. Copy the token once, then **update** (not just view) the repo secret: GitHub → `MergeSignal/mergesignal` → Settings → Secrets and variables → Actions → **`NPM_TOKEN`** → Update. Confirm “Updated …” is recent before re-running the workflow.
6. Revoke the old token on npm so CI cannot keep using a non-bypass copy by mistake.

**Org-wide 2FA and `EOTP`:** When the org enforces 2FA, `npm publish` in CI fails with:

```text
npm error code EOTP
npm error This operation requires a one-time password from your authenticator.
```

Read/write scope alone is not enough. Enable **Bypass 2FA** when creating the granular token (npm → Access Tokens → Generate New Token → Permissions). `npm whoami` and `npm publish --dry-run` can still succeed; only the real `PUT` publish triggers `EOTP` without bypass.

**First publish (org 2FA):** Recreate `NPM_TOKEN` with **Bypass 2FA** checked, update the GitHub secret, then re-run the workflow. Without it, logs show `npm error code EOTP`.

**Sanity-check the new token locally** (optional, publishes for real if bypass works):

```bash
export NODE_AUTH_TOKEN='npm_…'   # paste the new granular token
cd packages/shared && pnpm build && npm publish --access public
npm view @mergesignal/shared@0.2.3
```

If local publish succeeds but CI still shows `EOTP`, the GitHub **`NPM_TOKEN` secret was not updated** with the new value.

**After first publish:** Optionally add [npm trusted publishing](https://docs.npmjs.com/trusted-publishers) on the package (`publish-shared.yml`, repo `MergeSignal/mergesignal`) to drop the long-lived publish token.

**Publish succeeded but verify step failed (`Expected @mergesignal/shared@X.Y.Z on npm, got: <none>`)**

The package is often **already on npm** — `npm publish` completed, but post-publish `npm view` queried the wrong registry. Root `.npmrc` routes `@mergesignal` to GitHub Packages (for `@mergesignal/contracts`); that project config overrides `NPM_CONFIG_USERCONFIG` for scoped `npm view`, so verify must pass `--@mergesignal:registry=https://registry.npmjs.org/` (see `scripts/ci/verify-shared-on-npmjs.sh`).

1. Confirm: `npm view @mergesignal/shared@X.Y.Z version --registry https://registry.npmjs.org/`
2. Recovery: Actions → **Publish @mergesignal/shared** → **Run workflow** → enable **notify_only** (resends engine dispatch without republishing).

- Re-run: Actions → **Publish @mergesignal/shared** → **Run workflow**, or re-push `shared-v*`.
- Verify: `npm view @mergesignal/shared@X.Y.Z`
- Pack check: `npm pack @mergesignal/shared@X.Y.Z --dry-run` — tarball should list `dist/` only

**Two-repo release order**

1. Publish `@mergesignal/contracts@X.Y.Z` from mergesignal-engine (`contracts-vX.Y.Z`); confirm GitHub Packages visibility + Actions access.
2. Bump shared in mergesignal if needed; tag `shared-vX.Y.Z` and push; confirm [publish workflow](.github/workflows/publish-shared.yml) succeeds (publish + engine dispatch).
3. In `mergesignal-engine`: respond to `shared-package-released` or bump catalog pin manually, refresh lockfile, tag engine release, set `MERGESIGNAL_ENGINE_REF` on mergesignal.
4. Run fresh-clone validation on both repos (see top of this doc).

**Rollback**

| Situation            | Action                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------- |
| Bad shared release   | Publish a patch from mergesignal; bump engine to the fixed exact version.                   |
| Revert engine        | Restore previous exact pin in `package.json` and the prior `pnpm-lock.yaml` hunk; redeploy. |
| Public monorepo apps | Redeploy prior git SHA (shared resolves from npm).                                          |

Published npm versions are immutable; do not rely on `npm unpublish`.

**After publish (quick checks)**

- `npm view @mergesignal/shared@X.Y.Z`
- `npm pack @mergesignal/shared@X.Y.Z` — tarball should contain `dist/` only
- Publish workflow log shows **Engine dispatch sent successfully**
- Engine: `pnpm why @mergesignal/shared` resolves from `registry.npmjs.org`, not `file:`

**Semver for shared**

- **Patch** — copy tweaks, non-breaking validation relaxations, presentation-only text.
- **Minor** — backward-compatible new optional fields on `ScanRequest` / `ScanResult` / insights.
- **Major** — tighten trusted validation, remove/rename wire fields, bump `SCAN_RESULT_ABI` or `ENGINE_OUTPUT_SCAN_ABI`.

---

The composite action lives at `.github/actions/merge-signal-scan/`.

## Using `@main` (always latest)

Many teams use:

```yaml
uses: MergeSignal/mergesignal/.github/actions/merge-signal-scan@main
```

That always resolves to the **latest** action definition on the default branch. Prefer this when you want new summary tweaks and fixes as soon as they land; accept that behavior can change without a tag bump.

## Optional: pin a tag

When you want **fixed** behavior for CI reproducibility, pin a version tag:

```yaml
uses: MergeSignal/mergesignal/.github/actions/merge-signal-scan@vX.Y.Z
```

## Tagging (maintainers)

1. Merge changes to `main` (including `action.yml`, `scripts/ci/render-mergesignal-step-summary.mjs`, and any CLI behavior the action relies on).
2. Create an annotated tag on the commit you want customers to use, e.g. `v0.2.0`.
3. Push the tag: `git push origin v0.2.0`.
4. Optionally update **Getting started** / **README** examples to reference the new tag when you want docs to default to that release.

**Semver guidance**

- **Patch** - Summary text tweaks, bug fixes, faster installs, no input or JSON contract change.
- **Minor** - New optional inputs, backward-compatible summary additions.
- **Major** - Remove/rename inputs, or breaking changes to fields consumed by `render-mergesignal-step-summary.mjs` from `mergesignal-scan.json`. **ScanResult** `decision.recommendation` must use only canonical merge posture strings (`safe`, `needs_review`, `risky`); alternate engine tokens are rejected by `@mergesignal/shared` schema (bump `SCAN_RESULT_ABI` when validation tightens).

**Note (trusted engine integration):** Trusted scans use **`engine_repo_token`** (this repository’s dogfood workflow expects the secret **`MERGESIGNAL_ENGINE_REPO_TOKEN`**) plus optional **`engine_repository`**, **`engine_ref`**, and **`engine_impl_file`** as documented in the composite README. Treat incompatible changes to those inputs as **major** when pinning tags.

## Smoke test before tagging

From another **public** repository (or a throwaway fork), add the minimal workflow from `.github/actions/merge-signal-scan/README.md`, open a PR, and confirm the **Actions** summary appears. This repository’s [`.github/workflows/mergesignal-scan.yml`](.github/workflows/mergesignal-scan.yml) exercises the same action on **`push` to `main`** and **`workflow_dispatch`** (check name **`MergeSignal Dogfood / Engine validation`**). For a **pull_request** template (other repos), see [docs/examples/mergesignal-scan-with-pull-request.yml](docs/examples/mergesignal-scan-with-pull-request.yml). After changing workflow or job display names, update required checks in GitHub if you use them as merge gates.
