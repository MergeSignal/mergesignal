# MergeSignal

MergeSignal helps teams **see and reason about risk in npm dependencies** before it becomes an incident. It turns lockfiles and dependency graphs into **actionable, explainable scores** you can inspect, and supports **upgrade simulation**, **org-level views** (dashboards, alerts, policies, benchmarks), and an optional **GitHub App** that reacts when lockfiles change on PRs or pushes.

This repository lets you run the **public web experience**, **HTTP API**, and **command-line scanner** locally or in your own environment. **Queued scans** need a separate worker process to finish; operators should follow internal or [DEPLOYMENT.md](./DEPLOYMENT.md) documentation. For analysis on your machine without the full stack, use the CLI (see below).

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

1. Start databases: `docker compose up -d`
2. Copy `apps/api/.env.example` to `apps/api/.env` (defaults match the repo’s `docker-compose.yml`).
3. Create an API key: `pnpm -C apps/api migrate` then `pnpm -C apps/api generate-api-key <owner> "<description>"`. Store the `ms_…` value once.
4. Create `apps/web/.env.local` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` and `NEXT_PUBLIC_API_KEY=<your key>`.
5. Run `pnpm -C apps/api dev` and `pnpm -C apps/web dev` in two terminals.

**URLs:** Web — http://localhost:3000 · API — http://localhost:4000 · OpenAPI — http://localhost:4000/openapi.json · Health — `GET /health` (no auth).

To process queued scans end-to-end, run the worker described in [DEPLOYMENT.md](./DEPLOYMENT.md).

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
