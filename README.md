# MergeSignal

MergeSignal helps teams **see and reason about risk in npm dependencies** before it becomes an incident. It turns lockfiles and dependency graphs into **actionable, explainable scores** you can inspect, and supports **upgrade simulation**, **org-level views** (dashboards, alerts, policies, benchmarks), and an optional **GitHub App** that reacts when lockfiles change on PRs or pushes.

**Documentation (users):** the canonical guide (CLI quick start, GitHub Actions, GitHub App) lives on the web app-for the public Fly deployment see **[mergesignal-web.fly.dev/getting-started](https://mergesignal-web.fly.dev/getting-started)** (use your own origin when self-hosting).

---

## Install from GitHub

### Prerequisites

- **Node.js** ≥ 20.19 - pinned **22.15.1** in [`.nvmrc`](./.nvmrc), [`.node-version`](./.node-version), and Volta in `package.json`. Install [Volta](https://volta.sh/) (recommended) or [fnm](https://github.com/Schniz/fnm) with `eval "$(fnm env --use-on-cd)"` in your shell so the correct Node is selected automatically; plain **nvm** does not read `.nvmrc` on `cd` unless you add a hook.
- **pnpm** 9.x (see root `packageManager` in `package.json`)
- **Docker** - only if you run the API and databases locally

### Clone and install

```bash
git clone https://github.com/MergeSignal/mergesignal.git
cd mergesignal
# nvm only (no Volta/fnm hook): nvm install && nvm use
pnpm install
```

### Command-line scanner (no Docker)

Run the scan from **your** project directory (the folder that contains your lockfile).

If MergeSignal is cloned elsewhere, use `pnpm`’s `--dir` flag so the CLI runs from the MergeSignal install while using your current directory for the lockfile:

```bash
cd /path/to/your-project
pnpm --dir /path/to/mergesignal ms scan
```

If you are working **inside** the cloned `mergesignal` repository, from the repo root after `pnpm install`:

```bash
pnpm ms scan
```

Common options: `--json`, `--out mergesignal-result.json`, `--lockfile pnpm-lock.yaml`, `--fail-above <score>`.

---

## Web app and API locally

This repository lets you run the **public web experience**, **HTTP API**, **BullMQ worker**, and **command-line scanner** locally or in your own environment. The in-repo worker (`apps/worker`) consumes the same queue the API enqueues; you can also run a proprietary worker from **mergesignal-engine** by swapping the container image and `MERGESIGNAL_ENGINE_IMPL`. See [DEPLOYMENT.md](./DEPLOYMENT.md). For analysis on your machine without the full stack, use the CLI (**[Install from GitHub](#install-from-github)** above).

1. Start databases and worker: `docker compose up -d` (starts Postgres, Redis, and `worker`).
2. Copy `apps/api/.env.example` to `apps/api/.env` (defaults match the repo’s `docker-compose.yml`).
3. Create an API key: `pnpm -C apps/api migrate` then `pnpm -C apps/api generate-api-key <owner> "<description>"`. Store the `ms_…` value once. The `owner` string must match the GitHub org or user that prefixes your `repoId` values (e.g. `acme` for `acme/my-repo`).
4. Create `apps/web/.env.local` (see `apps/web/.env.example`). For **local** stacks use `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` and OAuth callback `http://localhost:3000/api/auth/callback/github`. For the **Fly.io** deployment, use `NEXT_PUBLIC_API_BASE_URL=https://mergesignal-api.fly.dev` and callback `https://mergesignal-web.fly.dev/api/auth/callback/github`. Always set **`MERGESIGNAL_API_KEY`**, **`MERGESIGNAL_LINKED_GITHUB_OWNER`**, **`AUTH_SECRET`**, and **`AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`**. For local iteration without OAuth, set `MERGESIGNAL_DEV_AUTH_BYPASS=1` in `apps/web/.env.local` (development only).
5. Run `pnpm -C apps/api dev` and `pnpm -C apps/web dev` in two terminals (or run the worker locally with `pnpm -C apps/worker dev` instead of the compose worker).

**Deployed (Fly.io):** Web - [https://mergesignal-web.fly.dev/](https://mergesignal-web.fly.dev/) · API - [https://mergesignal-api.fly.dev](https://mergesignal-api.fly.dev) · OpenAPI - [https://mergesignal-api.fly.dev/openapi.json](https://mergesignal-api.fly.dev/openapi.json) · Health - `GET https://mergesignal-api.fly.dev/health` (no auth).

The web app proxies **SSE** live scan updates via `GET /api/scan/:id/events` so browsers never send `Authorization` to the API directly.

---

## CI on GitHub Actions

MergeSignal can run on **GitHub Actions** and write a risk summary to each workflow run’s **Summary**-no MergeSignal server required for that path.

**Trusted vs demo scans:** The composite action supports `scan_profile: trusted` (real engine via `pnpm add` + `MERGESIGNAL_TRUSTED_ANALYSIS`) or `development` (OSS stub with a clearly labeled demo summary). Fork PRs should **skip** the MergeSignal job when secrets are unavailable—do not silently fall back to `trusted` without credentials. See the [action README](./.github/actions/merge-signal-scan/README.md#trusted-vs-development-scan-profile). Operator setup for secrets and variables is summarized in [DEPLOYMENT.md](./DEPLOYMENT.md#github-actions-merge-signal-scan).

**Full guide (recommended workflow, optional `fail_above` gate, first-run notes):** use the canonical page on your web deployment, e.g. **[mergesignal-web.fly.dev/getting-started#github-actions](https://mergesignal-web.fly.dev/getting-started#github-actions)** (replace the host with yours if self-hosted).

**Contract and versioning:** input/output details and release pins are in [.github/actions/merge-signal-scan/README.md](./.github/actions/merge-signal-scan/README.md) and [RELEASING.md](./RELEASING.md). This repository’s [`.github/workflows/mergesignal-scan.yml`](./.github/workflows/mergesignal-scan.yml) dogfoods the action as **`MergeSignal / Analysis`** (workflow `name: MergeSignal`, job `analysis`). After renaming workflows or jobs, update **required checks** in GitHub branch protection and any rulesets so merges are not blocked on stale check names.

---

## Troubleshooting

- **`pnpm ms scan` not found** - The `ms` script is defined on the MergeSignal repo root. Use `pnpm --dir /path/to/mergesignal ms scan` from your project, or `cd` into the clone and run `pnpm ms scan` there.
- **No lockfile** - Run from the package root that contains `pnpm-lock.yaml` or `package-lock.json`, or pass `--lockfile` with a path. Yarn lockfiles are supported when passed explicitly.
- **Node version** - Use Node ≥ 20.19 (see `.nvmrc`). With plain nvm, run `nvm install && nvm use` before `pnpm install` if your shell does not auto-read `.nvmrc`.
- **GitHub Actions** - Use the [official action README](./.github/actions/merge-signal-scan/README.md). The dogfood workflow uploads the scan JSON artifact from the runner temp path used by the action.

For the full stack (Docker, Postgres, Redis, API, web, worker), environment variables, and deployment, see **Web app and API locally** above and [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Optional: GitHub App

**Canonical guide:** [mergesignal-web.fly.dev/getting-started#github-app](https://mergesignal-web.fly.dev/getting-started#github-app) (use your own web host if self-hosted). That page lists **repository permissions** (when to add **Checks** for PR **Check Runs**, and **Review request** after permission changes). This repository still contains a short [pointer file](./docs/github-app.md) for legacy links.

---

## Legal and trust

MergeSignal software in this repository is licensed under **[Apache License 2.0](./LICENSE)**; see also [NOTICE](./NOTICE).

**Data and responsibility:** We publish clear rules for **what we collect, what we do not do with your content, and what remains your responsibility**-including that automated risk output is **informational** and must be validated for your context. The canonical legal pages ship with the **web app** (same routes on your deployment, e.g. the public Fly build: **[Privacy Policy](https://mergesignal-web.fly.dev/privacy)** (Customer Content restrictions), **[Terms of Service](https://mergesignal-web.fly.dev/terms)**, **[API Terms](https://mergesignal-web.fly.dev/api-terms)**, and **[Contact](https://mergesignal-web.fly.dev/contact)**). **These documents are not legal advice for your company**; consult counsel where you need certainty for regulated or high-risk use.

---

## Further reading

- **[Getting started](https://mergesignal-web.fly.dev/getting-started)** (user guide on the web app: CLI, GitHub Actions, GitHub App)-replace the host with your deployment when self-hosting.
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - operations and infrastructure for running the stack yourself.

Results are designed to stay interpretable (scores, reasons, and supporting detail where the product exposes them); treat methodology as guidance, not a guarantee.
