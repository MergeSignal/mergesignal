# MergeSignal architecture

MergeSignal analyzes dependency upgrades and provides reviewer guidance before merge. This page describes the major components at a high level — not deployment or internal implementation details.

## Components

| Component           | Role                                                          |
| ------------------- | ------------------------------------------------------------- |
| **Web application** | Dashboards, OAuth sign-in, scan history, getting-started docs |
| **API**             | Scan requests, GitHub webhooks, org and repo data             |
| **Worker**          | Runs analysis jobs and persists results                       |
| **Analysis engine** | Dependency upgrade analysis (see OSS boundary below)          |

## Where analysis runs

| Integration                         | Where analysis executes                                      |
| ----------------------------------- | ------------------------------------------------------------ |
| **CLI** (`pnpm ms scan`)            | On your machine                                              |
| **GitHub Actions**                  | On the workflow runner                                       |
| **Full stack** (App + API + worker) | Worker runs the engine; results stored for the web dashboard |

## Hosted vs self-hosted

**Hosted:** MergeSignal operates a preview deployment (e.g. Fly.io). Sign in with GitHub and optionally install the GitHub App.

**Self-hosted:** You deploy web, API, worker, database, and the proprietary analysis engine in your environment. See [DEPLOYMENT.md](../DEPLOYMENT.md).

## OSS vs proprietary engine

The public repository ships an **OSS stub engine** for local development and demo CI. **Production analysis** uses a proprietary engine — see [packages/engine-stub/README.md](../packages/engine-stub/README.md).

## Presentation layer

All user-facing surfaces read `ScanResult.assessment` as the sole authority for merge posture and presentation policy. The shared package builds a `ScanPresentationBundle` and presenters project fields to DTOs without re-interpreting scores or repo intelligence for posture.

See [presentation-ownership.md](./engineering/presentation-ownership.md) for assessment authority and CI guardrails.

## Diagram

```
┌─────────────┐     ┌─────────────┐
│  Web app    │────▶│     API     │
└─────────────┘     └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐     ┌──────────────────┐
                    │   Worker    │────▶│ Analysis engine  │
                    └─────────────┘     └──────────────────┘
```

For deployment paths and requirements, see [docs/self-host/overview.md](./self-host/overview.md).
