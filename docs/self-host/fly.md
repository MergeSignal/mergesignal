# Self-host on Fly.io

Fly.io is the deployment path used for the MergeSignal **hosted preview**. The manifests and workflow in this repository describe how that stack is built.

**Most users:** use the [hosted preview](https://mergesignal-web.fly.dev) or [CLI / GitHub Actions](../../README.md) — you do not need to self-host.

**Full-stack self-host with production analysis** requires read access to the private `mergesignal-engine` repository (granted by MergeSignal, not included in the OSS repo). Without that access, you can still deploy web and API for evaluation, but worker scans will use the OSS stub only. See [packages/engine-stub/README.md](../../packages/engine-stub/README.md).

## Components

Deploy three Fly apps (configs in `apps/web/fly.toml`, `apps/api/fly.toml`, `apps/worker/fly.toml`):

| App    | Dockerfile               |
| ------ | ------------------------ |
| Web    | `apps/web/Dockerfile`    |
| API    | `apps/api/Dockerfile`    |
| Worker | `apps/worker/Dockerfile` |

You also need managed or attached **PostgreSQL** and **Redis** (or compatible job queue store) reachable from API and worker.

## Configuration

Replace example hostnames with your Fly app URLs (public preview uses `mergesignal-web.fly.dev` and `mergesignal-api.fly.dev`):

1. Web: `NEXT_PUBLIC_API_BASE_URL` → your API URL
2. API: `CORS_ORIGINS` → your web URL
3. GitHub App webhook → `https://<your-api>/github/webhook`
4. GitHub OAuth callback → `https://<your-web>/api/auth/callback/github`
5. Web secrets: `MERGESIGNAL_API_KEY`, `MERGESIGNAL_LINKED_GITHUB_OWNER`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`
6. API and worker: `DATABASE_URL`, `REDIS_URL`

GitHub App permissions: see [getting-started → GitHub App](https://mergesignal-web.fly.dev/getting-started#github-app) (replace host when self-hosting).

## Deploy

Example manual deploy (from repo root):

```bash
flyctl deploy . --config apps/web/fly.toml --dockerfile apps/web/Dockerfile
flyctl deploy . --config apps/api/fly.toml --dockerfile apps/api/Dockerfile
```

**Worker** (MergeSignal org / teams with engine repo access) bakes the private engine at build time:

- GitHub secret `MERGESIGNAL_ENGINE_REPO_TOKEN` (read access to `MergeSignal/mergesignal-engine`)
- GitHub variable `MERGESIGNAL_ENGINE_REF` (semver tag, e.g. `v1.2.3`)

```bash
flyctl deploy . \
  --config apps/worker/fly.toml \
  --dockerfile apps/worker/Dockerfile \
  --build-secret engine_repo_token="$MERGESIGNAL_ENGINE_REPO_TOKEN" \
  --build-arg MERGESIGNAL_ENGINE_REF="v1.2.3"
```

The repository's [`.github/workflows/fly-deploy.yml`](../../.github/workflows/fly-deploy.yml) automates deploys for the **MergeSignal** hosted stack on push to `main`.

## Engine requirement

Production worker images embed the proprietary engine at Docker build time. Local `docker compose` uses the OSS stub — do not use the compose worker image for production analysis.

## More

- [Self-host overview](./overview.md)
- [Architecture](../architecture.md)
- [DEPLOYMENT.md](../../DEPLOYMENT.md)
