# MergeSignal web app

Next.js application for the MergeSignal dashboard, marketing pages, and getting-started docs.

## Local development

From the repository root:

```bash
pnpm install
docker compose up -d          # Postgres, Redis, worker (stub engine)
pnpm -C apps/api migrate
pnpm -C apps/api dev          # API on http://localhost:4000
pnpm -C apps/web dev          # Web on http://localhost:3000
```

Copy `apps/web/.env.local` from `apps/web/.env.example`. Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` for local stacks. See [docs/self-host/local-development.md](../../docs/self-host/local-development.md) for full setup.

Sign-in uses Auth.js v5. Set `AUTH_DEBUG=true` in development for verbose logging.

## Deployment

Production deploys to Fly.io via [`.github/workflows/fly-deploy.yml`](../../.github/workflows/fly-deploy.yml). See [docs/self-host/fly.md](../../docs/self-host/fly.md).

## More

- [Repository README](../../README.md)
- [Support and feedback](../../SUPPORT.md)
