# Releasing (GitHub Actions integration)

## Current architecture

Public `@mergesignal/shared` (npmjs.org) is the canonical owner of the public Assessment wire and other shared public contracts. Private `@mergesignal/contracts` (restricted npmjs package, published from mergesignal-engine) is consumed **only by the private engine** — this public repository does **not** install Contracts.

```
@mergesignal/shared  (npmjs.org — public Assessment wire and shared public contracts)
        ↑
@mergesignal/scan-prep   (public npmjs when published)
        ↑
   public mergesignal apps/packages (workspace)

@mergesignal/contracts  (private npmjs — mergesignal-engine only)
        ↑
   private mergesignal-engine workspace
```

Dependency direction:

- `@mergesignal/scan-prep` → `@mergesignal/shared`
- `@mergesignal/contracts` → `@mergesignal/shared`
- private engine → `@mergesignal/contracts` and `@mergesignal/shared`

When a private Contracts release depends on a new Shared version, **publish `@mergesignal/shared` to npmjs first**, then publish the matching `@mergesignal/contracts` version to npmjs (restricted).

| Repo               | Contracts                      | Shared                  | Engine deploy pin               |
| ------------------ | ------------------------------ | ----------------------- | ------------------------------- |
| mergesignal        | **none** (decoupled)           | workspace + npm publish | `MERGESIGNAL_ENGINE_REF=v2.0.0` |
| mergesignal-engine | workspace `packages/contracts` | npm catalog pin         | tag `v2.0.0`                    |

No cross-repo workspace paths, `file:` deps, or sibling checkouts are required for production consumption.

**pnpm toolchain:** single authority in root `package.json` `packageManager`; see [pnpm-version-governance.md](./pnpm-version-governance.md).

---

## Routine release order

Release order follows **dependency direction**: a package must not publish while depending on an unpublished downstream artifact. `@mergesignal/contracts` is **restricted** on npmjs; `@mergesignal/shared` is public on npmjs. Public packages install without npm authentication.

Choose the sequence that matches **which contract domain changed**.

### Shared-owned public wire change

When a public Shared contract changes and private Contracts consumes or re-exports it:

1. **Validate and graduate Shared** — build, test, and pack-artifact checks in mergesignal (`pnpm run check:shared-pack-artifact` and CI gates).
2. **Commit** the reviewed Shared source to `main`.
3. **Tag and publish** the immutable Shared version to npmjs (`shared-vX.Y.Z` → [publish-shared.yml](.github/workflows/publish-shared.yml)).
4. **Verify** the npmjs artifact (publish workflow registry check; optional local `npm view` / `npm pack`).
5. **Update private Contracts** in mergesignal-engine to consume the **published** Shared version (catalog pin, expectations, lockfile).
6. **Graduate and publish** the private Contracts version to npmjs (`contracts-vX.Y.Z` → [publish-contracts.yml](https://github.com/MergeSignal/mergesignal-engine/blob/main/.github/workflows/publish-contracts.yml)).
7. **Update private engine** — bump Shared pins, run `pnpm run validate:shared-consumption`, `pnpm run check:contracts-pack-artifact`, and `pnpm run check:contracts-isolated-install` in mergesignal-engine; publish Contracts when ready.

### Contracts-only private change

When a change affects only private Contracts domains and does **not** require a new Shared version:

1. **Validate and graduate** private Contracts in mergesignal-engine.
2. **Publish** Contracts to npmjs (`contracts-vX.Y.Z`, restricted).
3. **Validate engine** — `pnpm run check:contracts-pack-artifact`, `pnpm run check:contracts-isolated-install`, and engine release checks. No public-repo catalog bump.

### Cross-boundary rules

- Dependency release order follows dependency direction (`scan-prep` → `shared`, `contracts` → `shared`, engine → both).
- **Public Shared changes publish before** private Contracts versions that consume them.
- Do not publish Contracts with a Shared dependency pin that is not yet on npmjs.
- Public users and public packages require no npm authentication for Shared or Scan Preparation.

### Lockfile refresh

**mergesignal** (no private npm authentication required):

```bash
rm -rf node_modules && pnpm install
pnpm build && pnpm test
pnpm run check:no-private-contracts
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
pnpm run check:no-private-contracts
```

### Fresh-clone validation

```bash
# mergesignal — no private registry token
git clone https://github.com/MergeSignal/mergesignal.git /tmp/ms-clone && cd /tmp/ms-clone
pnpm install --frozen-lockfile && pnpm build && pnpm test

# mergesignal-engine — no GH token
git clone https://github.com/MergeSignal/mergesignal-engine.git /tmp/me-clone && cd /tmp/me-clone
pnpm install --frozen-lockfile && pnpm build && pnpm test
```

---

## Private `@mergesignal/contracts` (engine only)

Published from **mergesignal-engine** (`packages/contracts`). **Restricted** visibility on npmjs. This public repository does **not** consume it — use `@mergesignal/shared` for public Assessment wire types. See [mergesignal-engine PUBLISHING.md](https://github.com/MergeSignal/mergesignal-engine/blob/main/packages/contracts/PUBLISHING.md).

---

## `@mergesignal/shared` (npm)

The canonical contract and presentation package lives in `packages/shared` and is published to the **public npm registry** as `@mergesignal/shared`.

### Release candidate `0.13.0` (lockfile evidence contract — not yet published)

**Minor** semver (per § Semver for shared below):

- optional `ScanRequest.lockfileEvidenceStatus`
- new `LockfileEvidenceStatus` type and lockfile/preparation uncertainty helpers
- warning-code union changes (`lockfile_evidence_incomplete`, `lockfile_head_missing`; retirement of `lockfile_diff_empty`)
- intentional shared presentation behavior: informational preparation warnings (e.g. `code_fetch_skipped`) no longer trigger limited-context degradation; verified no-transition Safe suppresses degraded messaging
- **public Assessment wire ownership:** `@mergesignal/shared` is the canonical owner of the public `Assessment` wire, parsers, `ASSESSMENT_ABI`, and presentation accessors; the published package depends only on `zod` (no `@mergesignal/contracts`)

**Graduation sequence:** merge public changes → tag `shared-v0.13.0` → publish → publish private `@mergesignal/contracts` if its Shared dependency changed → engine bumps catalog pins and regenerates lockfile → remove any local `link:` validation override → run `pnpm run validate:shared-consumption`.

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

The package is often **already on npm** — `npm publish` completed, but post-publish `npm view` queried the wrong registry. Ensure scoped `npm view` targets `https://registry.npmjs.org/` (see `scripts/ci/verify-shared-on-npmjs.sh`).

1. Confirm: `npm view @mergesignal/shared@X.Y.Z version --registry https://registry.npmjs.org/`
2. Recovery: Actions → **Publish @mergesignal/shared** → **Run workflow** → enable **notify_only** (resends engine dispatch without republishing).

- Re-run: Actions → **Publish @mergesignal/shared** → **Run workflow**, or re-push `shared-v*`.
- Verify: `npm view @mergesignal/shared@X.Y.Z`
- Pack check: `npm pack @mergesignal/shared@X.Y.Z --dry-run` — tarball should list `dist/` only

**Coordinated two-repo release**

Follow [Routine release order](#routine-release-order) above:

- **Shared-owned wire change** — publish `@mergesignal/shared` to npmjs first, then publish `@mergesignal/contracts` to npmjs (restricted) when it must consume the new Shared version, then bump pins and validate on both repos.
- **Contracts-only private change** — publish `@mergesignal/contracts` from mergesignal-engine to npmjs, then bump engine consumers that need the new Contracts version.

On Shared publish success, [publish-shared.yml](.github/workflows/publish-shared.yml) sends `shared-package-released` to mergesignal-engine (see [Engine notification](#engine-notification-after-shared-publish)). Set `MERGESIGNAL_ENGINE_REF` on mergesignal after the engine release tag. Run fresh-clone validation on both repos (see top of this doc).

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

## Publishing `@mergesignal/scan-prep` (public)

**Status:** graduation framework implemented; **first npmjs publication (`0.1.0`) pending manual interactive publish**.

| Item                        | Authority                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Source                      | `mergesignal/packages/scan-prep`                                                                                    |
| Registry                    | `registry.npmjs.org` (public)                                                                                       |
| First publication (`0.1.0`) | Manual interactive `npm login` + 2FA — **no GitHub secret, no npm write token**                                     |
| Permanent publication       | GitHub Trusted Publishing / OIDC via [publish-scan-prep.yml](../.github/workflows/publish-scan-prep.yml) (`0.1.1+`) |
| Published verification      | [verify-scan-prep-registry.yml](../.github/workflows/verify-scan-prep-registry.yml)                                 |
| API contract                | [scan-prep-api.md](./scan-prep-api.md)                                                                              |

### Authentication model

| Package / operation                          | Authentication                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| `@mergesignal/shared` CI publish             | Existing GitHub secret **`NPM_TOKEN`** — unchanged by Scan Preparation work |
| `@mergesignal/scan-prep@0.1.0` first publish | Maintainer interactive `npm login` + 2FA on npmjs — **no secret**           |
| `@mergesignal/scan-prep@0.1.1+` CI publish   | GitHub OIDC (Trusted Publishing) — **no npm write token**                   |
| Public package install / registry verify     | **No authentication**                                                       |
| `@mergesignal/contracts` (private engine)    | GitHub OIDC publish; `NPM_READ_TOKEN` read verification only — unrelated    |

Do **not** use Shared’s `NPM_TOKEN` for Scan Preparation. There is no Scan Preparation bootstrap GitHub secret and no bootstrap token to revoke.

### Two release groups (atomic commits)

**Release Group A — manual `0.1.0` baseline** (commit and tag first; **exclude** the OIDC publish workflow):

- `packages/scan-prep/**` (implementation, export surface, tests)
- `scripts/ci/check-scan-prep-*.ts`, `scripts/ci/pack-scan-prep-release-candidate.ts`, `scripts/ci/lib/scan-prep-pack-artifact.ts`, `scripts/ci/lib/scan-prep-isolated-install.ts`
- `.github/workflows/verify-scan-prep-registry.yml`
- `.github/workflows/ci.yml` (candidate validation gates)
- `package.json` scripts, `pnpm-lock.yaml`
- `docs/engineering/releasing.md`, `scan-prep-api.md`, `scan-prep-version-selection-checklist.md`, `packages/scan-prep/README.md`

**Must not be in Group A:** `.github/workflows/publish-scan-prep.yml` — pushing tag `scan-prep-v0.1.0` while this workflow exists would attempt unconfigured OIDC.

**Release Group B — OIDC proof (`0.1.1+`)** (after `0.1.0` is on npmjs and Trusted Publishing is configured):

- `.github/workflows/publish-scan-prep.yml` (OIDC-only)
- Final OIDC documentation updates in `releasing.md` if needed
- `packages/scan-prep/package.json` version bump to `0.1.1` (separate reviewed commit when authority requires)
- Tag `scan-prep-v0.1.1` to prove OIDC

### Pre-publish validation (local / CI)

These commands validate repository readiness **before** tagging. Each command independently packs a fresh candidate tarball for its own checks. They do **not** produce the artifact used for manual publication.

```bash
pnpm -F @mergesignal/scan-prep build
pnpm -F @mergesignal/scan-prep test
pnpm run check:scan-prep-export-surface
pnpm run check:scan-prep-pack-artifact
pnpm run check:scan-prep-isolated-install
```

### Manual publication candidate (after tag)

The **only** command that creates the tarball later published to npmjs is:

```bash
pnpm run pack:scan-prep-release-candidate -- --output-dir=/tmp/ms-scan-prep-0.1.0
```

Use a **fresh external output directory**. The command rejects an existing target candidate or `.report.json` for the same version in that directory.

This command:

- packs exactly once;
- validates artifact hygiene on that exact tarball;
- performs isolated external-consumer installation on that exact tarball;
- verifies digest stability;
- writes the final report atomically only after both validations pass.

Do **not** rebuild, repack, edit, or rerun `check:scan-prep-pack-artifact` / `check:scan-prep-isolated-install` expecting them to validate the same bytes.

Always use the exact resolved candidate and report paths printed by `pack:scan-prep-release-candidate`. Filesystem canonicalization may normalize paths internally (for example `/tmp/...` to `/private/tmp/...` on macOS). Do not reconstruct, convert, or guess either path.

Before publication, compare the reported `integrity` digest with an independently calculated SHA-512 of the reported candidate file on disk immediately before publication.

### Manual first publication (`@mergesignal/scan-prep@0.1.0`)

After independent review, executable validation, and final graduation review:

1. Commit and push **Release Group A** only.
2. Verify public CI is green.
3. Create annotated tag on the Group A commit:

   ```bash
   git tag -a scan-prep-v0.1.0 -m "Publish @mergesignal/scan-prep@0.1.0"
   ```

4. Push the tag **only** when the tagged commit does not contain `publish-scan-prep.yml`.
5. Check out the exact tagged commit in a clean working tree.
6. Run `pnpm install --frozen-lockfile`.
7. Build and test Scan Preparation.
8. Produce the canonical release candidate (packs once, then validates artifact hygiene and isolated external-consumer install against that exact tarball):

   ```bash
   pnpm run pack:scan-prep-release-candidate -- --output-dir=/tmp/ms-scan-prep-0.1.0
   ```

   Use a fresh external output directory. The command fails if a prior target candidate or `.report.json` already exists in that directory.

   Record the reported `candidate` path, `report` path, `integrity`, `artifactValidation`, `isolatedInstall`, and report JSON. Always use the exact resolved `candidate` and `report` paths printed by the command; do not reconstruct, convert, or guess them.

9. Compare the candidate digest immediately before publication when practical. Independently calculate SHA-512 for the reported candidate file and confirm it matches the reported `integrity`.

10. Confirm npm identity interactively (`npm whoami` after `npm login` on registry.npmjs.org).
11. Publish the **exact** validated candidate tarball (do not rebuild, repack, edit, or pass through tooling that changes bytes):

    ```bash
    npm publish "<reported-resolved-candidate-path>" --access public
    ```

12. Complete npm’s interactive 2FA challenge in the terminal. Never place OTPs, passwords, or session tokens in source, scripts, workflows, or logs.
13. Run read-only published verification:

    ```bash
    pnpm run check:scan-prep-published-registry -- --version=0.1.0
    ```

    Or dispatch [verify-scan-prep-registry.yml](../.github/workflows/verify-scan-prep-registry.yml).

### Trusted Publishing configuration (after `0.1.0`)

Configure npm Trusted Publishing for:

| Field             | Value                    |
| ----------------- | ------------------------ |
| npm package       | `@mergesignal/scan-prep` |
| Provider          | GitHub Actions           |
| Organization      | `MergeSignal`            |
| Repository        | `mergesignal`            |
| Workflow filename | `publish-scan-prep.yml`  |
| Allowed operation | `npm publish`            |

`packages/scan-prep/package.json` must keep the public repository URL (`git+https://github.com/MergeSignal/mergesignal.git`, directory `packages/scan-prep`) for npm verification.

Configuration paths:

- npmjs package **Settings → Trusted Publisher**; or
- `npm trust github` when supported by the installed npm CLI (see `npm trust --help`).

### OIDC proof release (`0.1.1`)

1. Confirm `0.1.0` published and externally verified.
2. Configure Trusted Publishing (above).
3. Commit and push **Release Group B** (includes OIDC workflow).
4. Verify public CI.
5. Bump version to `0.1.1` in a reviewed release commit when authority requires.
6. Tag `scan-prep-v0.1.1` and push.
7. Confirm [publish-scan-prep.yml](../.github/workflows/publish-scan-prep.yml) publishes via OIDC with no npm token.
8. Verify `0.1.1` via `check:scan-prep-published-registry` or verify workflow.
9. Confirm no Scan Preparation write secret exists in GitHub or npm.

### Maintainer release (`0.1.1+`)

1. Bump `packages/scan-prep/package.json` version when release authority requires it.
2. Commit reviewed source to `main` (with OIDC workflow present).
3. Tag: `git tag scan-prep-vX.Y.Z` and `git push origin scan-prep-vX.Y.Z`.
4. Workflow validates artifact, publishes from `pnpm pack` tarball with OIDC, then runs unauthenticated post-publish verification.

### Post-publish recovery

If publication succeeds but verification fails, rerun [verify-scan-prep-registry.yml](../.github/workflows/verify-scan-prep-registry.yml) with the published version — read-only, no publish capability.

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
