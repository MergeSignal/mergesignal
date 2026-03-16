## RepoSentinel

RepoSentinel is a dependency risk intelligence platform designed to produce **actionable, explainable risk scores** for repositories.

This repository is an **early, working end-to-end system** (web + API + worker + Postgres + Redis) with a pluggable analysis engine. The platform calls `@reposentinel/engine` (a stable facade) which loads `@reposentinel/engine-stub` by default and can be swapped for a proprietary engine without changing the surrounding platform (see `REPOSENTINEL_ENGINE_IMPL`).

**Note**: This public repository contains the platform components (API, web, CLI) and an open-source reference engine implementation. The production worker and proprietary analysis engine are maintained in a private package: `@reposentinel/engine-private`.

### License and disclaimer

RepoSentinel is licensed under **Apache-2.0** (see `LICENSE`).

This software is provided **“as is”**, without warranty of any kind. You are responsible for validating outputs before acting on them.
No security guarantees are provided; do not rely on this as your sole security control.

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

**Note**: The worker is now part of a private package (`@reposentinel/engine-private`). For production deployment, see the deployment documentation.

---

## CLI (local analysis)

Run from any repo directory:

```bash
pnpm rs scan
```

Useful flags:

```bash
pnpm rs scan --json
pnpm rs scan --out reposentinel-result.json
pnpm rs scan --lockfile pnpm-lock.yaml
pnpm rs scan --fail-above 20
```

Notes:

- The CLI currently runs **locally** (no `scanId`).
- Remote mode (submit to API + stream SSE) can be added later as an opt-in.

---

## CI/CD (GitHub Actions)

This repo includes a CI workflow that runs a local RepoSentinel scan on pull requests and pushes to `main`:

- Workflow: `.github/workflows/reposentinel-scan.yml`
- Outputs:
  - GitHub Actions **job summary** (score + top recommendations)
  - Uploaded artifact: `reposentinel-scan.json`

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

This will output a key like `rs_abc123...`. Save it securely - it won't be shown again.

Use the key in the `Authorization` header:

```bash
Authorization: Bearer rs_abc123...
```

**Note**: The legacy `REPOSENTINEL_API_KEY` environment variable is no longer supported for security reasons (enforces multi-tenant isolation).

---

## API usage (smoke test)

Create a scan (requires authentication):

```bash
curl -sS -X POST "http://localhost:4000/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer rs_your_api_key_here" \
  -d '{"repoId":"demo/repo","dependencyGraph":{}}'
```

Then fetch status:

```bash
curl -sS "http://localhost:4000/scan/<scanId>" \
  -H "Authorization: Bearer rs_your_api_key_here"
```

Stream events (SSE):

```bash
curl -iN --http1.1 "http://localhost:4000/scan/<scanId>/events" \
  -H "Authorization: Bearer rs_your_api_key_here"
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
- **Worker**: BullMQ worker (private package: `@reposentinel/engine-private`)
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

When configured and installed, RepoSentinel will **analyze PR lockfile changes** and post/refresh a PR comment containing:

- dependency delta summary (direct + lockfile packages)
- risk score delta and top signal deltas
- “Why this is risky” reasons derived from explainable signals


**Important**: To enable PR comments, set `FREE_PR_COMMENTS_ENABLED=1` in your worker environment configuration. Without this setting, scans will complete successfully but PR comments will not be posted.

Supported lockfiles:

- `pnpm-lock.yaml` (best supported; PR base vs head comparisons, graph intelligence)
- `package-lock.json` (supported)
- `yarn.lock` (supported; direct dependency list may be unavailable from lockfile alone)

---

## Migrations (local)

The API can auto-apply SQL migrations on startup.

- **Enabled by default**: `REPOSENTINEL_AUTO_MIGRATE=1`
- **Disable**: set `REPOSENTINEL_AUTO_MIGRATE=0`

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

The platform calls `@reposentinel/engine`, which loads a concrete engine implementation at runtime:

- **Default**: uses `@reposentinel/engine-stub`
- **Override**: set `REPOSENTINEL_ENGINE_IMPL` to a module specifier (for example a private package) that exports `analyze` and `simulateUpgrade`
- **Strict mode**: set `REPOSENTINEL_ENGINE_STRICT=1` to fail startup if the proprietary engine cannot be loaded

### Risk engine enrichment (optional network signals)

The local engine can optionally call public APIs to enrich risk signals. These are **capped** and **cached** by default.

- **OSV vulnerabilities (CVEs/advisories)**:
  - Enable: `REPOSENTINEL_ENABLE_OSV=1` (default)
  - Tunables: `REPOSENTINEL_OSV_MAX_PACKAGES`, `REPOSENTINEL_OSV_TIMEOUT_MS`, `REPOSENTINEL_OSV_CACHE_TTL_MS`
- **npm adoption (downloads)**:
  - Enable: `REPOSENTINEL_ENABLE_ADOPTION=1` (default)
  - Tunables: `REPOSENTINEL_ADOPTION_MAX_PACKAGES`, `REPOSENTINEL_ADOPTION_TIMEOUT_MS`, `REPOSENTINEL_ADOPTION_CACHE_TTL_MS`,
    `REPOSENTINEL_ADOPTION_LOW_DOWNLOADS`, `REPOSENTINEL_ADOPTION_VERY_LOW_DOWNLOADS`
- **GitHub repo signals (maintainer activity / open issues)**:
  - Disabled by default (requires token): `REPOSENTINEL_ENABLE_GITHUB_SIGNALS=1`
  - Provide a token: `REPOSENTINEL_GITHUB_TOKEN` (or `GITHUB_TOKEN`)
  - Tunables: `REPOSENTINEL_GITHUB_MAX_REPOS`, `REPOSENTINEL_GITHUB_TIMEOUT_MS`, `REPOSENTINEL_GITHUB_CACHE_TTL_MS`,
    `REPOSENTINEL_GITHUB_STALE_PUSH_DAYS`

### Tier caps (cost control)

RepoSentinel supports a basic free/paid tier model for expensive operations.

Environment variables include:

- `REPOSENTINEL_DEFAULT_TIER` (`free` | `paid`)
- `REPOSENTINEL_OWNER_TIERS` (e.g. `acme=paid,other=free`)
- `FREE_*` and `PAID_*` limits for scans / PR comments / alerts

---

## Production Deployment

The worker component is distributed as a private npm package via GitHub Packages.

### Setting up GitHub Packages Access

1. Create a `.npmrc` file in your project root (already included):

```
@reposentinel:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

2. Set the `GITHUB_TOKEN` environment variable with a Personal Access Token that has `read:packages` permission.

3. Install dependencies:

```bash
pnpm install
```

### Deploying the Worker

The worker is available as `@reposentinel/engine-private`. To run it in production:

```bash
# Install dependencies (with GITHUB_TOKEN set)
pnpm add @reposentinel/engine-private

# Set up environment variables (DATABASE_URL, REDIS_URL, etc.)
# Run the worker
node node_modules/@reposentinel/engine-private/dist/worker.js
```

For containerized deployments, see the deployment documentation in `DEPLOYMENT.md`.

---

## Roadmap / disclaimer

This is an early product build. Expect APIs and the scoring methodology to evolve. The engine output is designed to remain **explainable** and **forward-compatible** through shared contracts in `packages/shared`.

Explainability is exposed in scan results via:

- `signals[]`: the raw set of risk signals (each with `scoreImpact` and optional `evidence`)
- `contributions[]`: per-signal contribution list for simple UIs
- `explain.reasons[]`: a short “Why this is risky” list derived from the highest-impact signals
- `graphInsights`: dependency graph intelligence (deepest packages, hotspots, and vulnerable transitive packages with “via” paths when lockfile parsing is available)
