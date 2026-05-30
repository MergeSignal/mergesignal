# Self-hosting overview

Choose a path based on what you need. Most users do not need the full stack — see [README Quick Start](../../README.md) for CLI and [GitHub Actions](../../.github/actions/merge-signal-scan/README.md) for CI summaries.

Architecture at a glance: [docs/architecture.md](../architecture.md).

## Decision tree

| Your goal                              | What to deploy                         | Guide                                                              |
| -------------------------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| Scan locally before opening a PR       | CLI only (no server)                   | [README](../../README.md)                                          |
| CI summaries on upgrade PRs            | GitHub Actions composite               | [Action README](../../.github/actions/merge-signal-scan/README.md) |
| Repo dashboard + GitHub App            | Web + API + worker + database + engine | [fly.md](./fly.md) or [aws-kubernetes.md](./aws-kubernetes.md)     |
| Develop or demo the full stack locally | Docker Compose + API + web             | [local-development.md](./local-development.md)                     |

## What each path requires

### CLI only

- Node.js ≥ 20.19, pnpm
- No Docker, database, or MergeSignal server

### GitHub Actions

- Workflow referencing the composite action
- For production-style analysis: `engine_repo_token` secret with read access to the private engine repo (trusted profile)
- See [Action README](../../.github/actions/merge-signal-scan/README.md)

### Full stack (self-hosted)

Deploy these components:

| Component                   | Purpose                                 |
| --------------------------- | --------------------------------------- |
| **Web**                     | Dashboard and OAuth                     |
| **API**                     | HTTP API and GitHub webhooks            |
| **Worker**                  | Runs analysis jobs                      |
| **PostgreSQL**              | Persistent scan data                    |
| **Job queue backing store** | Connects API and worker                 |
| **Analysis engine**         | Proprietary engine for production scans |

The OSS repository includes a **stub engine** for local/docker-compose development. Production analysis requires the proprietary engine, which is **not** in this repo — contact MergeSignal for engine access if you need a self-hosted production stack. See [packages/engine-stub/README.md](../../packages/engine-stub/README.md).

## Hosted vs self-hosted

**Hosted preview:** MergeSignal operates web and API on Fly.io (e.g. `mergesignal-web.fly.dev`). Sign in with GitHub; optionally install the GitHub App.

**Self-hosted:** You control infrastructure, domains, secrets, and engine versions. Replace Fly hostnames in OAuth, webhooks, and CORS when using your own domains.

## AWS / Kubernetes (advanced)

The repository includes Terraform and Kubernetes manifests as a **reference path** for AWS/EKS deployments. See [aws-kubernetes.md](./aws-kubernetes.md). This path requires more setup than Fly.io and is intended for teams with existing Kubernetes operations.

## Next steps

- [Local development](./local-development.md)
- [Fly.io deployment](./fly.md)
- [AWS / Kubernetes](./aws-kubernetes.md)
- [DEPLOYMENT.md](../../DEPLOYMENT.md) — stable entry index
