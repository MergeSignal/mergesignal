# Hosted PR intelligence evaluation — jsonwebtoken (auth surface)

**Branch:** `eval/pr-intelligence-jwt-advisory`  
**Purpose:** End-to-end validation of hosted MergeSignal PR intelligence for **security/auth** dependencies with **runtime usage** and **advisory-backed** narratives — **not** to ship vulnerable auth code to `main`.

## Why this package and version

- **Direct dependency:** `jsonwebtoken@8.5.1` pinned on `@mergesignal/api` (see `apps/api/package.json`).
- **Known advisory history:** jsonwebtoken **&lt;9.0.0** has published CVEs around token verification and key handling (e.g. CVE-2022-23529, CVE-2022-23540, CVE-2022-23541). **8.5.1** is intentionally in that range.
- **Runtime relevance:**
  - `apps/api/src/evalServiceJwt.ts` — sign/verify helpers for internal service Bearer tokens.
  - `apps/api/src/http/auth.ts` — when `MERGESIGNAL_SERVICE_JWT_SECRET` is set, accepts verified JWT Bearer tokens after org API key lookup (real request auth path).
  - `apps/api/src/server.ts` — cold-start self-check so `jsonwebtoken` is loaded from the API entrypoint.
- **Controlled revert:** Delete the branch or revert; no fabricated findings or mock engine.

## What we expect MergeSignal to surface

Themes that **should** be in scope (exact wording varies by engine version):

- **Known vulnerable jsonwebtoken** on the **API** with **verify/sign** on the **authentication** path.
- **Upgrade guidance** toward **≥9.0.0** (or latest patched 9.x) as the fix boundary.
- **Higher signal than graph-only churn** because the package is **direct**, **security-adjacent**, and **imported from auth + server startup**.

## PR surface expectations (hosted)

- **Check Run:** Non-baseline summary when PR-specific insights exist (`baseline: false` on full scans); calm copy from `@mergesignal/shared` `prCheckRunPresentation`.
- **PR comment:** When hosted policy says insights are material (auth + advisory + usage).
- **Lockfile:** `pnpm-lock.yaml` must change so the GitHub App webhook enqueues a scan.

## After evaluation

1. Close the PR; **do not** merge to `main` without upgrading jsonwebtoken and removing eval modules.
2. Follow-up: bump to **jsonwebtoken@^9.0.0**, delete `evalServiceJwt.ts`, and revert auth/server hooks if the JWT path is not productized.

<!-- CI retrigger -->
