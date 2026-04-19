## MergeSignal

MergeSignal is a dependency risk intelligence platform designed to produce **actionable, explainable risk scores** for repositories.

This repository is an **early, working end-to-end system** (web + API + worker + Postgres + Redis) with a pluggable analysis engine. The platform calls `@mergesignal/engine` (a stable facade) which loads `@mergesignal/engine-stub` by default and can be swapped for a proprietary engine without changing the surrounding platform (see `MERGESIGNAL_ENGINE_IMPL`).

**Note**: This public repository contains the platform components (API, web, CLI) and an open-source reference engine implementation. The production worker and proprietary analysis engine are maintained in a private package: `@mergesignal/engine-private`.

---

## ⚠️ Important Legal & Disclaimer

### License

MergeSignal is licensed under **Apache License 2.0** (see [LICENSE](./LICENSE)).

### "AS IS" Disclaimer

**THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.**

🔴 **Critical: You MUST understand these limitations before using MergeSignal:**

- **NOT a substitute for security audits**: MergeSignal is an informational tool, not a comprehensive security solution
- **Validate all outputs**: You are solely responsible for validating all recommendations, risk scores, and analysis before acting on them
- **No security guarantees**: Do not rely on this as your sole security control or assume it will detect all vulnerabilities
- **Algorithmic limitations**: Risk scores are generated algorithmically and may not reflect current threat landscapes
- **Data accuracy**: Third-party data sources (OSV, npm, GitHub) may be incomplete, outdated, or inaccurate
- **Your responsibility**: Always perform your own security assessments and follow industry best practices

### Legal Documents

Before using MergeSignal, please review:

- **[Terms of Service](./TERMS.md)** - Usage rules, liability disclaimers, termination rights
- **[Privacy Policy](./PRIVACY.md)** - Data collection, usage, and GDPR/CCPA compliance
- **[API Terms](./API-TERMS.md)** - API usage limits, rate limits, access revocation rights
- **[Contact Information](./CONTACT.md)** - Legal inquiries, support, security issues

### License Coverage (Private Repository)

If you operate a private fork or proprietary version:

- Ensure the Apache 2.0 LICENSE file is copied to any private repositories
- Comply with all Apache 2.0 attribution requirements
- Update legal documents to reflect your deployment

---

### Demo (local)

- **Web UI**: `http://localhost:3000`
- **API**: `http://localhost:4000`

### What you can do today

- **Run scans asynchronously** via API (`POST /scan` → worker processes → results persisted in Postgres)
- **Watch scan progress live** via SSE (`GET /scan/:id/events`)
- **See results in a simple UI** (`/scan/:id`)
- **Local CLI scan** (run analysis before committing): `pnpm rs scan`
- **Upgrade impact simulation** (`POST /simulate/upgrade`)
- **Org views**: dashboard, alerts, policies, benchmarks
- **GitHub App ingestion** (optional): enqueue scans on PR / push lockfile changes
- **Tier-based cost caps** (free/paid gating for expensive actions)

---

## Quickstart (local)

### Requirements

- **Node**: use `.nvmrc` (recommended: Node 22)
- **pnpm**: workspace package manager
- **Docker**: for Postgres + Redis

### Install

From the repo root:

```bash
nvm use
pnpm install
docker compose up -d
```

### Configure environment

API:

```bash
cp apps/api/.env.example apps/api/.env
```

Web (create `apps/web/.env.local`):

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_API_KEY=
```

**Note**: The web app requires an API key to access authenticated endpoints. Generate one using the instructions in the [API Authentication](#api-authentication) section below and add it to `NEXT_PUBLIC_API_KEY`.

### Run dev servers (recommended)

```bash
pnpm -C apps/api dev
pnpm -C apps/web dev
```

**Note**: The worker is now part of a private package (`@mergesignal/engine-private`). For production deployment, see the deployment documentation.

---

## CLI (local analysis)

Run from any repo directory:

```bash
pnpm ms scan
```

Useful flags:

```bash
pnpm ms scan --json
pnpm ms scan --out mergesignal-result.json
pnpm ms scan --lockfile pnpm-lock.yaml
pnpm ms scan --fail-above 20
```

Notes:

- The CLI currently runs **locally** (no `scanId`).
- Remote mode (submit to API + stream SSE) can be added later as an opt-in.

---

## CI/CD (GitHub Actions)

This repo includes a CI workflow that runs a local MergeSignal scan on pull requests and pushes to `main`:

- Workflow: `.github/workflows/mergesignal-scan.yml`
- Outputs:
  - GitHub Actions **job summary** (score + top recommendations)
  - Uploaded artifact: `mergesignal-scan.json`

---

## API Authentication

The API requires org-scoped API keys for all non-public endpoints. Generate a key for your organization:

```bash
cd apps/api
pnpm migrate  # Ensure api_keys table exists
pnpm generate-api-key <owner> "<description>"
```

Example:

```bash
pnpm generate-api-key acme "Production API key for Acme Corp"
```

This will output a key like `ms_abc123...`. Save it securely - it won't be shown again.

Use the key in the `Authorization` header:

```bash
Authorization: Bearer ms_abc123...
```

**Note**: The legacy `MERGESIGNAL_API_KEY` environment variable is no longer supported for security reasons (enforces multi-tenant isolation).

---

## API usage (smoke test)

Create a scan (requires authentication):

```bash
curl -sS -X POST "http://localhost:4000/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ms_your_api_key_here" \
  -d '{"repoId":"demo/repo","dependencyGraph":{}}'
```

Then fetch status:

```bash
curl -sS "http://localhost:4000/scan/<scanId>" \
  -H "Authorization: Bearer ms_your_api_key_here"
```

Stream events (SSE):

```bash
curl -iN --http1.1 "http://localhost:4000/scan/<scanId>/events" \
  -H "Authorization: Bearer ms_your_api_key_here"
```

Public endpoints (no auth required):

```bash
curl -sS "http://localhost:4000/health"
curl -sS "http://localhost:4000/openapi.json"
```

---

## Architecture

### Components

- **`apps/web`**: Next.js UI (App Router)
- **`apps/api`**: Fastify API, CORS, SSE, webhooks, quotas/caps
- **Worker**: BullMQ worker (private package: `@mergesignal/engine-private`)
- **Postgres**: scan persistence + derived views (alerts, policies, benchmarks)
- **Redis**: job queue (BullMQ)
- **`packages/shared`**: TypeScript contracts
- **`packages/engine`**: stable engine facade (loads stub or proprietary engine)
- **`packages/engine-stub`**: open analysis engine stub (`analyze`, `simulateUpgrade`)

### Flow

1. Client calls `POST /scan`
2. API inserts scan row (`queued`) + enqueues a BullMQ job
3. Worker transitions scan to `running`, runs engine analysis, persists `result` and score summary columns
4. UI watches `GET /scan/:id/events` (SSE) for live updates

---

## Endpoints (high level)

### Scans

- `POST /scan`
- `GET /scan/:id`
- `GET /scan/:id/events` (SSE)
- `GET /scans?repoId=...`

### Simulation

- `POST /simulate/upgrade`

### Org views

- `GET /org/:owner/dashboard`
- `GET /org/:owner/alerts`
- `GET /org/:owner/policies`
- `GET /org/:owner/policy/violations`

### Benchmarking

- `GET /benchmark/global`
- `GET /benchmark/org/:owner`
- `GET /benchmark/repo?repoId=...`

### GitHub App (optional)

- `POST /github/webhook`

See setup doc: `docs/github-app.md`.

When configured and installed, MergeSignal will **analyze PR lockfile changes** and post/refresh a PR comment containing:

- dependency delta summary (direct + lockfile packages)
- risk score delta and top signal deltas
- "Why this is risky" reasons derived from explainable signals

**Important**: To enable PR comments, set `FREE_PR_COMMENTS_ENABLED=1` in your worker environment configuration. Without this setting, scans will complete successfully but PR comments will not be posted.

Supported lockfiles:

- `pnpm-lock.yaml` (best supported; PR base vs head comparisons, graph intelligence)
- `package-lock.json` (supported)
- `yarn.lock` (supported; direct dependency list may be unavailable from lockfile alone)

---

## Migrations (local)

The API can auto-apply SQL migrations on startup.

- **Enabled by default**: `MERGESIGNAL_AUTO_MIGRATE=1`
- **Disable**: set `MERGESIGNAL_AUTO_MIGRATE=0`

Manual migration command:

```bash
pnpm -C apps/api migrate
```

---

## Configuration notes

### CORS

API reads `CORS_ORIGINS` (comma-separated) from `apps/api/.env`:

```bash
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### Engine (proprietary swap)

The platform calls `@mergesignal/engine`, which loads a concrete engine implementation at runtime:

- **Default**: uses `@mergesignal/engine-stub`
- **Override**: set `MERGESIGNAL_ENGINE_IMPL` to a module specifier (for example a private package) that exports `analyze` and `simulateUpgrade`
- **Strict mode**: set `MERGESIGNAL_ENGINE_STRICT=1` to fail startup if the proprietary engine cannot be loaded

### Risk engine enrichment (optional network signals)

The local engine can optionally call public APIs to enrich risk signals. These are **capped** and **cached** by default.

- **OSV vulnerabilities (CVEs/advisories)**:
  - Enable: `MERGESIGNAL_ENABLE_OSV=1` (default)
  - Tunables: `MERGESIGNAL_OSV_MAX_PACKAGES`, `MERGESIGNAL_OSV_TIMEOUT_MS`, `MERGESIGNAL_OSV_CACHE_TTL_MS`
- **npm adoption (downloads)**:
  - Enable: `MERGESIGNAL_ENABLE_ADOPTION=1` (default)
  - Tunables: `MERGESIGNAL_ADOPTION_MAX_PACKAGES`, `MERGESIGNAL_ADOPTION_TIMEOUT_MS`, `MERGESIGNAL_ADOPTION_CACHE_TTL_MS`,
    `MERGESIGNAL_ADOPTION_LOW_DOWNLOADS`, `MERGESIGNAL_ADOPTION_VERY_LOW_DOWNLOADS`
- **GitHub repo signals (maintainer activity / open issues)**:
  - Disabled by default (requires token): `MERGESIGNAL_ENABLE_GITHUB_SIGNALS=1`
  - Provide a token: `MERGESIGNAL_GITHUB_TOKEN` (or `GITHUB_TOKEN`)
  - Tunables: `MERGESIGNAL_GITHUB_MAX_REPOS`, `MERGESIGNAL_GITHUB_TIMEOUT_MS`, `MERGESIGNAL_GITHUB_CACHE_TTL_MS`,
    `MERGESIGNAL_GITHUB_STALE_PUSH_DAYS`

### Tier caps (cost control)

MergeSignal supports a basic free/paid tier model for expensive operations.

Environment variables include:

- `MERGESIGNAL_DEFAULT_TIER` (`free` | `paid`)
- `MERGESIGNAL_OWNER_TIERS` (e.g. `acme=paid,other=free`)
- `FREE_*` and `PAID_*` limits for scans / PR comments / alerts
- Scan quotas: `FREE_SCANS_PER_OWNER_PER_DAY` (manual / non-GitHub) and `FREE_GITHUB_SCANS_PER_OWNER_PER_DAY` (GitHub-sourced), enforced per repo owner on a rolling 24h window in the API

---

## Production Deployment

The worker component is distributed as a private npm package via GitHub Packages.

### Setting up GitHub Packages Access

1. Create a `.npmrc` file in your project root (already included):

```
@mergesignal:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

2. Set the `GITHUB_TOKEN` environment variable with a Personal Access Token that has `read:packages` permission.

3. Install dependencies:

```bash
pnpm install
```

### Deploying the Worker

The worker is available as `@mergesignal/engine-private`. To run it in production:

```bash
# Install dependencies (with GITHUB_TOKEN set)
pnpm add @mergesignal/engine-private

# Set up environment variables (DATABASE_URL, REDIS_URL, etc.)
# Run the worker
node node_modules/@mergesignal/engine-private/dist/worker.js
```

For containerized deployments, see the deployment documentation in `DEPLOYMENT.md`.

---

## Roadmap / disclaimer

This is an early product build. Expect APIs and the scoring methodology to evolve. The engine output is designed to remain **explainable** and **forward-compatible** through shared contracts in `packages/shared`.

Explainability is exposed in scan results via:

- `signals[]`: the raw set of risk signals (each with `scoreImpact` and optional `evidence`)
- `contributions[]`: per-signal contribution list for simple UIs
- `explain.reasons[]`: a short "Why this is risky" list derived from the highest-impact signals
- `graphInsights`: dependency graph intelligence (deepest packages, hotspots, and vulnerable transitive packages with "via" paths when lockfile parsing is available)
