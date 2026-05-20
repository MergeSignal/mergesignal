# Releasing (GitHub Actions integration)

## `@mergesignal/shared` (npm)

The canonical contract and presentation package lives in `packages/shared` and is published to the **public npm registry** as `@mergesignal/shared`.

**Publish (maintainers)**

1. Bump `version` in `packages/shared/package.json` (semver).
2. Merge to `main`.
3. Tag: `git tag shared-v0.2.0` (prefix must match `shared-v*`).
4. Push the tag: `git push origin shared-v0.2.0`.
5. GitHub Actions workflow [`.github/workflows/publish-shared.yml`](.github/workflows/publish-shared.yml) runs build, tests, and `pnpm publish` (requires `NPM_TOKEN` secret).

**Consumers (e.g. `mergesignal-engine`)** pin the published version in `package.json` / lockfile — do not copy `packages/shared` source.

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
