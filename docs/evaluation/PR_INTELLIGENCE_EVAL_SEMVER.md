# Hosted PR intelligence evaluation — semver (CVE-2022-25883)

**Branch:** `eval/pr-intelligence-semver-redos`  
**Purpose:** End-to-end validation of hosted MergeSignal PR intelligence after the Actions/dogfood PR surface cleanup — **not** to ship vulnerable code to `main`.

## Why this package and version

- **Direct dependency:** `semver@7.5.1` pinned on `@mergesignal/api` (see `apps/api/package.json`).
- **Known advisory:** [CVE-2022-25883](https://www.cve.org/CVERecord?id=CVE-2022-25883) — **ReDoS** in `semver` **7.0.0–7.5.1**; fixed in **7.5.2**. Widely indexed in npm/OSV ecosystems.
- **Runtime relevance:** `apps/api/src/evalSemverUsage.ts` imports `semver` and calls `coerce` / `satisfies` on the Node version string. `apps/api/src/server.ts` invokes it at cold start so the dependency is **reachable from the API entrypoint**, not a dead install.
- **Controlled revert:** Delete the branch or revert the single commit; no mock engine or fabricated findings.

## What we expect MergeSignal to surface

Themes that **should** be in scope for a capable engine + advisory layer (exact wording varies by engine version):

- **Known vulnerable semver** on a **server** package with **parse/satisfies** usage (ReDoS / supply-chain maintenance signal).
- **Upgrade path** to `semver@>=7.5.2` (or latest 7.x) as the minimal fix boundary.
- **Confidence** higher than a generic transitive blip because the package is **direct**, **version-pinned to a CVE range**, and **imported from application code** used at startup.

## PR surface expectations (hosted)

- **Single authoritative PR UX:** GitHub App **Check Run** (not the internal dogfood Actions workflow on PR).
- **PR comments:** Should appear when the hosted policy says insights are **material** enough to comment; silence is acceptable only if the product explicitly suppresses low-signal cases.
- **Lockfile:** `pnpm-lock.yaml` changes must appear in the PR so the GitHub webhook path sees a lockfile diff.

## After evaluation

1. Close or merge as appropriate; **do not** merge to `main` unless upgrading to `semver@^7.5.2` (or removing the eval module) first.
2. Open a follow-up PR that bumps `semver` to **≥7.5.2** and deletes `evalSemverUsage.ts` + the `server.ts` hook if this scenario should not persist.

<!-- noop: re-sync PR to re-run hosted Check Run -->
