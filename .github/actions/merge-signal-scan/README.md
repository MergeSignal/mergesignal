# merge-signal-scan (composite action)

Official **GitHub Actions** integration for MergeSignal. Add one step to your workflow: MergeSignal **scans dependency changes on every run** and adds a **clear, actionable risk summary** to the workflow run (scores, recommendations, and layer breakdown in the **Summary** tab).

This is a **black-box** integration from a repository owner’s perspective: you reference the action; you do not configure how MergeSignal is built or installed inside the runner.

**Versioning:** The examples below use `@main` so you always run the latest published action from the default branch. Optional release tags are described in [RELEASING.md](../../RELEASING.md) if you prefer a fixed version.

## Trusted vs development scan profile

The action input **`scan_profile`** controls whether the run must use a **real analysis engine** or may use the **OSS stub** (demo output).

| Value                       | Engine                                                                                                                                                                                                                    | When to use                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`trusted`**               | Requires a resolvable `MERGESIGNAL_ENGINE_IMPL` (private npm package or other installable module). Sets `MERGESIGNAL_TRUSTED_ANALYSIS=1` and `MERGESIGNAL_ENGINE_STRICT=1` on scan steps. Stub output is **not** allowed. | Production-style CI where summaries should represent real MergeSignal analysis. Supply **`npm_token`** (from a workflow secret) and **`engine_package`**. |
| **`development`** (default) | OSS stub when no private engine is configured. Summary uses a **demo** title and banner so logs cannot be mistaken for trusted analysis.                                                                                  | Forks, public demos, or repos without access to the proprietary engine package.                                                                           |

**Forks and pull requests from forks:** Workflows triggered by `pull_request` do not receive repository secrets on forks. Use **`development`** (or skip the job when secrets are empty) so you never imply a trusted scan without credentials. This repository’s dogfood workflow [`.github/workflows/mergesignal-scan.yml`](../../workflows/mergesignal-scan.yml) picks **`trusted`** only when `secrets.MERGESIGNAL_NPM_TOKEN` is set; otherwise it runs **`development`**.

**Security — registry token:** Pass the registry token only via **`with.npm_token`** using a secret expression (for example `npm_token: ${{ secrets.MERGESIGNAL_NPM_TOKEN }}`). Do not echo tokens, full `.npmrc` contents, or raw `MERGESIGNAL_ENGINE_IMPL` values in logs. The composite appends auth lines to `_ms_rt/.npmrc` inside the internal checkout; it does not print them.

### Trusted profile: required inputs

When `scan_profile: trusted`:

1. **`npm_token`** — non-empty registry auth token (`NODE_AUTH_TOKEN` pattern for npm/GitHub Packages), passed from workflow secrets via `with`.
2. **`engine_package`** — argument to `pnpm add` (for example `@your-scope/mergesignal-engine@1.2.3`). Pin a version for reproducibility.
3. **`npm_registry_url`** (optional) — registry base URL for `.npmrc` (default `https://registry.npmjs.org`).
4. **`engine_impl_module`** (optional) — value for `MERGESIGNAL_ENGINE_IMPL` if it differs from the package name (for example a subpath export). If empty, a trailing `@version` on `engine_package` is stripped when the package is scoped (`@scope/pkg@1.0.0` → `@scope/pkg`).

Scan failures append a short **failure** summary (no scorecard) via `scripts/ci/render-mergesignal-failure-summary.mjs`, using copy from `scripts/ci/scan-surface-copy.generated.json` built with `@mergesignal/shared`.

### Example: trusted scan with private engine

```yaml
permissions:
  contents: read

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: MergeSignal/mergesignal/.github/actions/merge-signal-scan@main
        with:
          scan_profile: trusted
          npm_registry_url: https://registry.npmjs.org
          engine_package: ${{ secrets.MERGESIGNAL_ENGINE_PACKAGE }}
          npm_token: ${{ secrets.MERGESIGNAL_NPM_TOKEN }}
```

Use **repository variables** for non-secret defaults (for example `vars.MERGESIGNAL_NPM_REGISTRY_URL`, `vars.MERGESIGNAL_ENGINE_IMPL_MODULE`) and **secrets** for tokens and private package specs if you prefer not to expose the package name in logs (still avoid printing secret values).

## What you get

- **Problem addressed:** dependency and lockfile changes can introduce security, maintenance, and upgrade risk that is easy to miss in review.
- **Immediately after adding the action:** each matching workflow run includes a **job summary** in GitHub Actions with an overall score, top recommendations, and an expandable risk breakdown-no separate MergeSignal server required.

## Recommended workflow

```yaml
name: MergeSignal Scan
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: MergeSignal/mergesignal/.github/actions/merge-signal-scan@main
        # Optional gate (see “fail_above” below)
        # with:
        #   fail_above: "40"
```

Open the workflow run in GitHub and read the **Summary** section for the scan output.

## Input: `fail_above` (optional)

| Input        | Required | Description                                                                                                                                                                                                                                        |
| ------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fail_above` | No       | Numeric string `0`-`100`. When set, the job **fails** if the scan’s `totalScore` is **strictly greater** than this value (same rule as the MergeSignal CLI `--fail-above`). When empty or omitted, the job **never** fails because of score alone. |

### Deterministic behavior when `fail_above` is set

1. MergeSignal runs a full scan and writes results used for the summary.
2. The **workflow summary** is **always** written **before** the gate runs, so you still get the rich summary when the gate fails.
3. The **Verify score threshold** step runs last. If the score is above the threshold, that step **fails** and the **whole job** is marked **failed**.
4. **Pull request checks:** the workflow appears as a **failed check** on the PR (red X) with the failed step name (e.g. “Verify score threshold”).
5. **Workflow logs:** the log for the failing step shows the non-zero exit from the scan command; earlier steps remain **green**, including **Add scan summary to workflow**.

If `fail_above` is **not** set, step 3 is skipped and the job succeeds as long as earlier steps succeed.

## CI time (v1)

The first run on a clean cache may take **several minutes** while the runner prepares MergeSignal and runs the scan. That is **expected for v1**; a future **Phase 2** will publish the CLI to npm and switch this action to a lighter path (for example `npx`) so typical runs get faster without changing your workflow shape.

## What we guarantee (public contract)

- A scan runs against the **root of your default checkout** (where your package lockfile is expected).
- A **GitHub Actions job summary** is produced for every successful scan step, using one shared renderer shipped with this action.
- Optional **`fail_above`** enforces a **hard fail** on the job when configured, as described above.

Breaking changes to that contract follow **semver** on whatever ref you pin (`@main` follows the latest default branch; tags follow [RELEASING.md](../../RELEASING.md)).

## Permissions

`contents: read` on the caller workflow is enough for a **public** `MergeSignal/mergesignal` reference. Private mirrors need credentials that can read that repository.

## Troubleshooting

- **`trusted` fails immediately on “requires inputs.npm_token”** — Set `with.npm_token` from a workflow secret, or switch to `scan_profile: development` when no token is available (e.g. fork PRs).
- **`trusted` fails on engine load** — Confirm `engine_package` installs on the runner registry and that `engine_impl_module` (if set) matches the module Node can `import()`. Check workflow logs; do not rely on stub behavior in trusted mode.
- **Demo banner in Summary** — You are on **`development`** profile or stub methodology; expected for OSS demos.

## Advanced

For a **full** workflow you can fork (artifacts, caching, matrices), see [mergesignal-scan.yml](https://github.com/MergeSignal/mergesignal/blob/main/.github/workflows/mergesignal-scan.yml) in this repo.

**Lockfile not at the repository root:** set `defaults.run.working-directory` on the job (or the checkout step’s path) so the default working directory for the scan is the package that contains your lockfile, or wait for a future action input for working directory.

---

## Notes for MergeSignal maintainers (implementation)

The composite uses an internal checkout path and a standard Node/pnpm build to produce the CLI; that layout may change in Phase 2 when switching to a published binary. **Do not** document internal directory names or build commands in user-facing pages (Getting started, README “Recommended”); keep them here or in code only.

The job summary is generated by `scripts/ci/render-mergesignal-step-summary.mjs` in the MergeSignal tree. Scan JSON for the summary is written under the runner temp directory so the **caller’s repository working tree is not modified** by the scan output file. Pipeline copy for CI scripts is generated at `@mergesignal/shared` build time into `scripts/ci/scan-surface-copy.generated.json`; keep TS and JSON in sync (see `packages/shared` tests).
