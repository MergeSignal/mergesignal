# Composite action internals (maintainers)

Implementation notes for `.github/actions/merge-signal-scan/`. **User-facing integration docs stay in the [action README](../../.github/actions/merge-signal-scan/README.md)** — do not duplicate internal paths in README or getting-started.

## Checkout layout

The composite uses an internal checkout path `_ms_rt` and a standard Node/pnpm build to produce the CLI. That layout may change if the composite switches to a lighter prebuilt CLI delivery.

The private engine is checked out to **`_ms_engine`** next to `_ms_rt` under `GITHUB_WORKSPACE`, built in place, and loaded via **`MERGESIGNAL_ENGINE_IMPL=file:…`** (see `packages/engine` dynamic `import()`).

## Summary and audit scripts

- Job summary: `scripts/ci/render-mergesignal-step-summary.mjs`
- Failure summary: `scripts/ci/render-mergesignal-failure-summary.mjs`
- Trusted audit: `scripts/ci/audit-trusted-actions-output.mjs`

Scan JSON for the summary is written under the runner temp directory so the **caller's repository working tree is not modified**.

Pipeline copy is generated at `@mergesignal/shared` build time into `scripts/ci/scan-surface-copy.generated.json`; keep TS and JSON in sync (see `packages/shared` tests).

Trusted validation lives in `@mergesignal/shared` (`trustedScanGuards.ts`).

## Branch protection when renaming workflows

The GitHub check name is **`Workflow display name / Job name`** (when the job sets `name:`) **or** `Workflow display name / job id`. When you change the workflow `name:` or job `name:`, update **required status checks** in branch protection and any **rulesets** / **merge queue** settings in the same change. Remove obsolete entries after they no longer exist.

## Releases

Action tagging and semver: [releasing.md](./releasing.md).
