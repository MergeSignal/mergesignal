# merge-signal-scan (composite action)

Official **GitHub Actions** integration for MergeSignal. Add one step to your workflow: MergeSignal analyzes dependency upgrades on every run and adds a compact, reviewer-oriented summary to the workflow run (**affected flows**, reviewer guidance, and upgrade findings in the **Summary** tab).

This is a **black-box** integration from a repository owner’s perspective: you reference the action; you do not configure how MergeSignal is built or installed inside the runner.

**Versioning:** The examples below use `@main` so you always run the latest published action from the default branch. To pin fixed behavior, use `@vX.Y.Z` (for example `MergeSignal/mergesignal/.github/actions/merge-signal-scan@v0.2.0`). Breaking changes to inputs or summary contract follow semver on tagged releases.

## Trusted vs development scan profile

The action input **`scan_profile`** controls whether the run must use a **real analysis engine** or may use the **OSS stub** (demo output).

| Value                       | Engine                                                                                                                                                                                                                                                                                                  | When to use                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`trusted`**               | Checks out the **private engine GitHub repository** (default `MergeSignal/mergesignal-engine`), installs and builds it on the runner, sets `MERGESIGNAL_ENGINE_IMPL` to a **`file:`** URL, and sets `MERGESIGNAL_TRUSTED_ANALYSIS=1` and `MERGESIGNAL_ENGINE_STRICT=1`. Stub output is **not** allowed. | Production-style CI where summaries should represent real MergeSignal analysis. Supply **`engine_repo_token`** (secret: read access to the engine repo only). |
| **`development`** (default) | OSS stub when no private engine is configured. Summary uses a **demo** title and banner so logs cannot be mistaken for trusted analysis.                                                                                                                                                                | Public demos, example workflows, or repos that intentionally show OSS-only output (never use for production merge gates).                                     |

Optional: set **`MERGESIGNAL_TRUSTED_METHODOLOGY_PREFIX`** in the environment (for example in a maintainer workflow) so trusted scans only accept methodology versions with that prefix—useful for dogfood engines; omit in customer workflows unless you enforce a stable prefix.

**Fork pull requests (product policy):** Workflows that run on `pull_request` from a **fork** do not receive your repository’s secrets. **Do not** run `scan_profile: trusted` on fork PRs unless you use a separate, audited pattern (for example `pull_request_target`, which has security tradeoffs). The usual approach is to **skip** the MergeSignal job when `github.event.pull_request.head.repo.full_name != github.repository`, so fork PRs show **no** MergeSignal check instead of a stub or fake “trusted” signal. **Dependabot** pull requests likewise do not receive normal repository Actions secrets; skip the trusted job when `github.actor == 'dependabot[bot]'` (or add the token under **Dependabot secrets** if you intentionally want trusted scans on those PRs). The **MergeSignal `mergesignal` repository** runs an internal dogfood workflow ([`.github/workflows/mergesignal-scan.yml`](../../workflows/mergesignal-scan.yml)) on **`push` to `main`** and **`workflow_dispatch`** with **`scan_profile: trusted`** (not on pull requests). For a PR-triggered YAML template you can copy into your own repo, see [docs/examples/mergesignal-scan-with-pull-request.yml](../../../docs/examples/mergesignal-scan-with-pull-request.yml).

After a successful trusted scan, the composite runs a short **audit** (`scripts/ci/audit-trusted-actions-output.mjs`) that rejects `engine-stub` methodology and known demo strings in the step summary—see `@mergesignal/shared` `auditTrustedActionsOutput` / `trustedScanGuards`.

**Security — engine repo token:** Pass the token only via **`with.engine_repo_token`** using a secret expression (for example `engine_repo_token: ${{ secrets.MERGESIGNAL_ENGINE_REPO_TOKEN }}`). Do not echo tokens, print `.git/config` from the engine checkout, or log raw credential material. The composite uses `actions/checkout` with **`persist-credentials: false`** for the engine repository so the token is not left in local git config for later steps.

### Trusted profile: required inputs

When `scan_profile: trusted`:

1. **`engine_repo_token`** — non-empty GitHub token (PAT or GitHub App installation token) with **contents: read** (or equivalent) on the private engine repository only. Pass from workflow secrets via `with`.
2. **`engine_repository`** (optional) — `owner/name` of the engine repository (default `MergeSignal/mergesignal-engine`).
3. **`engine_ref`** (optional) — branch, tag, or SHA to checkout (default `main`).
4. **`engine_impl_file`** (optional) — path relative to the engine repo root to the built ESM entry that exports `analyze` and `simulateUpgrade` (default `packages/analysis-engine/dist/index.js` for `MergeSignal/mergesignal-engine`). The engine repo must contain **`pnpm-lock.yaml`** or **`package-lock.json`** and a **`build`** script that produces this file.

Scan failures append a short **failure** summary (no scorecard) via `scripts/ci/render-mergesignal-failure-summary.mjs`, using copy from `scripts/ci/scan-surface-copy.generated.json` built with `@mergesignal/shared`.

### Example: trusted scan with private engine (GitHub checkout)

```yaml
permissions:
  contents: read

jobs:
  analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: MergeSignal/mergesignal/.github/actions/merge-signal-scan@main
        with:
          scan_profile: trusted
          engine_repo_token: ${{ secrets.MERGESIGNAL_ENGINE_REPO_TOKEN }}
          engine_repository: MergeSignal/mergesignal-engine
          engine_ref: main
          engine_impl_file: packages/analysis-engine/dist/index.js
```

Use **repository variables** for non-secret overrides (`vars.MERGESIGNAL_ENGINE_REPOSITORY`, `vars.MERGESIGNAL_ENGINE_REF`, `vars.MERGESIGNAL_ENGINE_IMPL_FILE`) and **secrets** only for `MERGESIGNAL_ENGINE_REPO_TOKEN`. Avoid printing any secret value in logs.

## What you get

- **Problem addressed:** dependency and lockfile changes can introduce security, maintenance, and upgrade risk that is easy to miss in review.
- **Immediately after adding the action:** each matching workflow run includes a **job summary** in GitHub Actions with **merge posture**, a compact **risk index** (0 = lowest merge risk, 100 = highest), prioritized **reviewer guidance** (PR insights and recommendations), and **expandable** score and dependency-graph context—no separate MergeSignal server required.

## Recommended workflow

```yaml
name: MergeSignal
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  analysis:
    if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: MergeSignal/mergesignal/.github/actions/merge-signal-scan@main
        with:
          scan_profile: trusted
          engine_repo_token: ${{ secrets.MERGESIGNAL_ENGINE_REPO_TOKEN }}
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
5. **Trusted audit:** when `scan_profile: trusted`, **Audit trusted Actions output** may fail after the summary if methodology or summary text violates trusted rules.
6. **Workflow logs:** the log for the failing step shows the non-zero exit from the scan command; earlier steps remain **green**, including **Add scan summary to workflow**.

If `fail_above` is **not** set, the **Verify score threshold** step is skipped and the job succeeds as long as earlier steps succeed.

## CI time (v1)

The first run on a clean cache may take **several minutes** while the runner checks out MergeSignal, checks out and builds the private engine (when `trusted`), and runs the scan. A future **Phase 2** may shorten the MergeSignal toolchain checkout (for example via a prebuilt CLI artifact) without changing your workflow shape for the scan itself.

## What we guarantee (public contract)

- A scan runs against the **root of your default checkout** (where your package lockfile is expected).
- A **GitHub Actions job summary** is produced for every successful scan step, using one shared renderer shipped with this action.
- Optional **`fail_above`** enforces a **hard fail** on the job when configured, as described above.

Breaking changes to that contract follow **semver** on whatever ref you pin (`@main` follows the latest default branch; tagged releases use `@vX.Y.Z`).

## Permissions

`contents: read` on the caller workflow is enough for a **public** `MergeSignal/mergesignal` reference. Private mirrors need credentials that can read that repository. **Trusted** scans additionally require a token that can read your private **engine** repository; that token is separate from `GITHUB_TOKEN` for the OSS MergeSignal repo.

## Troubleshooting

- **`trusted` fails immediately on “requires inputs.engine_repo_token”** — Set `with.engine_repo_token` from a workflow secret. On fork PRs, **skip** the MergeSignal job instead of switching to `development` if you do not want OSS demo output on pull requests.
- **`trusted` fails on engine checkout or build** — Confirm the token can read `engine_repository` at `engine_ref`, that the repo has a supported lockfile and `build` script, and that `engine_impl_file` exists after build. Check workflow logs; do not rely on stub behavior in trusted mode.
- **Demo banner in Summary** — You are on **`development`** profile or stub methodology; expected for OSS demos.

## Advanced

For a **full** workflow you can copy (including `pull_request`, artifact upload), see [mergesignal-scan-with-pull-request.yml](https://github.com/MergeSignal/mergesignal/blob/main/docs/examples/mergesignal-scan-with-pull-request.yml). The **MergeSignal `mergesignal`** dogfood workflow ([mergesignal-scan.yml](https://github.com/MergeSignal/mergesignal/blob/main/.github/workflows/mergesignal-scan.yml)) runs on **`push` to `main`** and **`workflow_dispatch`** only.

**Lockfile not at the repository root:** set `defaults.run.working-directory` on the job (or the checkout step’s path) so the default working directory for the scan is the package that contains your lockfile, or wait for a future action input for working directory.
