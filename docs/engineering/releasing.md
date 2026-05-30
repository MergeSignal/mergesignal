# Releasing (GitHub Actions integration)

## `@mergesignal/shared` (npm)

The canonical contract and presentation package lives in `packages/shared` and is published to the **public npm registry** as `@mergesignal/shared`.

**Publish (maintainers)**

1. Bump `version` in `packages/shared/package.json` (semver).
2. Merge to `main`.
3. Tag: `git tag shared-v0.2.3` (prefix must match `shared-v*`).
4. Push the tag: `git push origin shared-v0.2.3`.
5. GitHub Actions workflow [`.github/workflows/publish-shared.yml`](.github/workflows/publish-shared.yml) runs build, tests, and `npm publish` (requires `NPM_TOKEN` with **Bypass 2FA** when org 2FA is on).

**Consumers (e.g. `mergesignal-engine`)** use an **exact** semver pin in `package.json` (e.g. `"@mergesignal/shared": "0.2.3"`, not `^0.2.3`) plus a frozen `pnpm-lock.yaml` — do not copy `packages/shared` source or vendor tarballs.

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

- Re-run: Actions → **Publish @mergesignal/shared** → **Run workflow**, or re-push `shared-v*`.
- Verify: `npm view @mergesignal/shared@X.Y.Z`
- Pack check: `npm pack @mergesignal/shared@X.Y.Z --dry-run` — tarball should list `dist/` only

**Two-repo release order**

1. Merge shared changes on `main`, bump `packages/shared/package.json`.
2. Tag `shared-vX.Y.Z` and push; confirm [publish workflow](.github/workflows/publish-shared.yml) succeeds.
3. `npm view @mergesignal/shared@X.Y.Z`
4. In `mergesignal-engine`: exact pin `"@mergesignal/shared": "X.Y.Z"`, `pnpm install`, remove any `vendor/*.tgz`, merge when CI is green.
5. Deploy engine/worker images if applicable.

**Rollback**

| Situation            | Action                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------- |
| Bad shared release   | Publish a patch from mergesignal; bump engine to the fixed exact version.                   |
| Revert engine        | Restore previous exact pin in `package.json` and the prior `pnpm-lock.yaml` hunk; redeploy. |
| Public monorepo apps | Redeploy prior git SHA (shared is workspace-linked, not npm).                               |

Published npm versions are immutable; do not rely on `npm unpublish`.

**After publish (quick checks)**

- `npm view @mergesignal/shared@X.Y.Z`
- `npm pack @mergesignal/shared@X.Y.Z` — tarball should contain `dist/` only
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
