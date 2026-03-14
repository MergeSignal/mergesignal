## RepoSentinel

RepoSentinel is a dependency risk intelligence platform designed to produce **actionable, explainable risk scores** for repositories.

This repository is an **early, working end-to-end system** (web + API + worker + Postgres + Redis) with a pluggable analysis engine. The platform calls `@reposentinel/engine` (a stable facade) which loads `@reposentinel/engine-stub` by default and can be swapped for a proprietary engine without changing the surrounding platform (see `REPOSENTINEL_ENGINE_IMPL`).

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
```

### Run dev servers (recommended)

```bash
pnpm -C apps/api dev
pnpm -C apps/worker dev
pnpm -C apps/web dev
```

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

## API usage (smoke test)

Create a scan:

```bash
curl -sS -X POST "http://localhost:4000/scan" \
  -H "Content-Type: application/json" \
  -d '{"repoId":"demo/repo","dependencyGraph":{}}'
```

Then fetch status:

```bash
curl -sS "http://localhost:4000/scan/<scanId>"
```

Stream events (SSE):

```bash
curl -iN --http1.1 "http://localhost:4000/scan/<scanId>/events"
```

---

## Architecture

### Components

- **`apps/web`**: Next.js UI (App Router)
- **`apps/api`**: Fastify API, CORS, SSE, webhooks, quotas/caps
- **`apps/worker`**: BullMQ worker that runs analysis and persists results
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

## Roadmap / disclaimer

This is an early product build. Expect APIs and the scoring methodology to evolve. The engine output is designed to remain **explainable** and **forward-compatible** through shared contracts in `packages/shared`.

Explainability is exposed in scan results via:

- `signals[]`: the raw set of risk signals (each with `scoreImpact` and optional `evidence`)
- `contributions[]`: per-signal contribution list for simple UIs
- `explain.reasons[]`: a short “Why this is risky” list derived from the highest-impact signals
- `graphInsights`: dependency graph intelligence (deepest packages, hotspots, and vulnerable transitive packages with “via” paths when lockfile parsing is available)
