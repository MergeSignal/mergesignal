# Local development (full stack)

Run the web app, API, worker, and databases locally for development or evaluation. For CLI-only scans without Docker, see the [README Quick Start](../../README.md).

**Engine note:** `docker compose` uses the OSS stub engine — not production analysis. See [packages/engine-stub/README.md](../../packages/engine-stub/README.md).

## Prerequisites

- Node.js ≥ 20.19 (see [`.nvmrc`](../../.nvmrc))
- pnpm from root `package.json` `packageManager` via Corepack (`corepack enable && corepack install`)
- Docker (for Postgres, Redis, and worker)

## Steps

1. **Start databases and worker**

   ```bash
   docker compose up -d
   ```

   Starts Postgres, Redis, and the worker container.

2. **Configure the API**

   Copy `apps/api/.env.example` to `apps/api/.env` (defaults match `docker-compose.yml`).

   Create an API key:

   ```bash
   pnpm -C apps/api migrate
   pnpm -C apps/api generate-api-key <owner> "<description>"
   ```

   Store the `ms_…` value once. The `owner` must match the GitHub org or user prefix for your `repoId` values (e.g. `acme` for `acme/my-repo`).

3. **Configure the web app**

   Copy `apps/web/.env.example` to `apps/web/.env.local`.

   For local stacks:
   - `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`
   - OAuth callback: `http://localhost:3000/api/auth/callback/github`
   - Set `MERGESIGNAL_API_KEY`, `MERGESIGNAL_LINKED_GITHUB_OWNER`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`
   - Optional (development only): `MERGESIGNAL_DEV_AUTH_BYPASS=1` to skip OAuth

4. **Run services**

   ```bash
   pnpm -C apps/api dev    # http://localhost:4000
   pnpm -C apps/web dev    # http://localhost:3000
   ```

   Or run the worker locally instead of the compose worker: `pnpm -C apps/worker dev`

## Health checks

- API health: `GET http://localhost:4000/health`
- OpenAPI: `http://localhost:4000/openapi.json`

The web app proxies live scan updates via `GET /api/scan/:id/events` so browsers do not send API keys directly to the API.

## Production deployment

For deploying outside your laptop, see [fly.md](./fly.md) or [aws-kubernetes.md](./aws-kubernetes.md).
