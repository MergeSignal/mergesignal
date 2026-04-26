# MergeSignal

MergeSignal helps teams **see and reason about risk in npm dependencies** before it becomes an incident. It turns lockfiles and dependency graphs into **actionable, explainable scores** you can inspect, and supports **upgrade simulation**, **org-level views** (dashboards, alerts, policies, benchmarks), and an optional **GitHub App** that reacts when lockfiles change on PRs or pushes.

This repository lets you run the **public web experience**, **HTTP API**, **BullMQ worker**, and **command-line scanner** locally or in your own environment. The in-repo worker (`apps/worker`) consumes the same queue the API enqueues; you can also run a proprietary worker from **mergesignal-engine** by swapping the container image and `MERGESIGNAL_ENGINE_IMPL`. See [DEPLOYMENT.md](./DEPLOYMENT.md). For analysis on your machine without the full stack, use the CLI (see below).

---

## Install from GitHub

### Prerequisites

- **Node.js** ≥ 20.19 (this repo pins a 22.x release in [`.nvmrc`](./.nvmrc))
- **pnpm** 9.x (see root `packageManager` in `package.json`)
- **Docker** — only if you run the API and databases locally

### Clone and install

```bash
git clone https://github.com/MergeSignal/mergesignal.git
cd mergesignal
nvm use   # optional; uses .nvmrc
pnpm install
```

### Command-line scanner (no Docker)

From the repo root, in any project that has a lockfile:

```bash
pnpm ms scan
```

Common options: `--json`, `--out mergesignal-result.json`, `--lockfile pnpm-lock.yaml`, `--fail-above <score>`.

---

## Web app and API locally

1. Start databases and worker: `docker compose up -d` (starts Postgres, Redis, and `worker`).
2. Copy `apps/api/.env.example` to `apps/api/.env` (defaults match the repo’s `docker-compose.yml`).
3. Create an API key: `pnpm -C apps/api migrate` then `pnpm -C apps/api generate-api-key <owner> "<description>"`. Store the `ms_…` value once. The `owner` string must match the GitHub org or user that prefixes your `repoId` values (e.g. `acme` for `acme/my-repo`).
4. Create `apps/web/.env.local` (see `apps/web/.env.example`). For **local** stacks use `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` and OAuth callback `http://localhost:3000/api/auth/callback/github`. For the **Fly.io** deployment, use `NEXT_PUBLIC_API_BASE_URL=https://mergesignal-api.fly.dev` and callback `https://mergesignal-web.fly.dev/api/auth/callback/github`. Always set **`MERGESIGNAL_API_KEY`**, **`MERGESIGNAL_LINKED_GITHUB_OWNER`**, **`AUTH_SECRET`**, and **`AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`**. For local iteration without OAuth, set `MERGESIGNAL_DEV_AUTH_BYPASS=1` in `apps/web/.env.local` (development only).
5. Run `pnpm -C apps/api dev` and `pnpm -C apps/web dev` in two terminals (or run the worker locally with `pnpm -C apps/worker dev` instead of the compose worker).

**Deployed (Fly.io):** Web — [https://mergesignal-web.fly.dev/](https://mergesignal-web.fly.dev/) · API — [https://mergesignal-api.fly.dev](https://mergesignal-api.fly.dev) · OpenAPI — [https://mergesignal-api.fly.dev/openapi.json](https://mergesignal-api.fly.dev/openapi.json) · Health — `GET https://mergesignal-api.fly.dev/health` (no auth).

**Local:** Web — http://localhost:3000 · API — http://localhost:4000 · OpenAPI — http://localhost:4000/openapi.json · Health — `GET /health` (no auth).

The web app proxies **SSE** live scan updates via `GET /api/scan/:id/events` so browsers never send `Authorization` to the API directly.

---

## CI on GitHub Actions

[`.github/workflows/mergesignal-scan.yml`](./.github/workflows/mergesignal-scan.yml) runs a scan on pull requests and pushes to `main`, adds a job summary, and uploads `mergesignal-scan.json`.

---

## Optional: GitHub App

See [`docs/github-app.md`](./docs/github-app.md).

---

## Legal and trust

MergeSignal software in this repository is licensed under **[Apache License 2.0](./LICENSE)**; see also [NOTICE](./NOTICE).

**Data and responsibility:** We publish clear rules for **what we collect, what we do not do with your content, and what remains your responsibility**—including that automated risk output is **informational** and must be validated for your context. Read **[Privacy Policy](./PRIVACY.md)** (Customer Content restrictions), **[Terms of Service](./TERMS.md)**, **[API Terms](./API-TERMS.md)**, and **[Contact](./CONTACT.md)**. **These documents are not legal advice for your company**; consult counsel where you need certainty for regulated or high-risk use.

---

## Further reading

Operations and infrastructure: [DEPLOYMENT.md](./DEPLOYMENT.md). Results are designed to stay interpretable (scores, reasons, and supporting detail where the product exposes them); treat methodology as guidance, not a guarantee.
