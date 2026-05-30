# MergeSignal documentation

Documentation is organized by audience. Start with the [README](../README.md) for a quick evaluation path.

## User docs

Adopt, evaluate, and integrate MergeSignal.

| Doc                                                                     | Description                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [README](../README.md)                                                  | Quick start: CLI, GitHub Actions, GitHub App link                   |
| [Getting started](https://mergesignal-web.fly.dev/getting-started)      | Complete onboarding on the web app (replace host when self-hosting) |
| [Architecture](./architecture.md)                                       | High-level components (web, API, worker, engine)                    |
| [GitHub App](./github-app.md)                                           | What the App is and when to use it                                  |
| [GitHub Actions action](../.github/actions/merge-signal-scan/README.md) | CI integration contract                                             |
| [Example workflow](./examples/mergesignal-scan-with-pull-request.yml)   | Copy-paste PR + push workflow                                       |
| [Engine stub](../packages/engine-stub/README.md)                        | OSS vs proprietary engine boundary                                  |
| [@mergesignal/shared](../packages/shared/README.md)                     | Published npm contract package                                      |

## Self-host docs

Deploy and run MergeSignal yourself.

| Doc                                                   | Description                     |
| ----------------------------------------------------- | ------------------------------- |
| [DEPLOYMENT.md](../DEPLOYMENT.md)                     | Stable entry index (start here) |
| [Self-host overview](./self-host/overview.md)         | Decision tree and requirements  |
| [Local development](./self-host/local-development.md) | Docker Compose + API + web      |
| [Fly.io](./self-host/fly.md)                          | Fly deployment                  |
| [AWS / Kubernetes](./self-host/aws-kubernetes.md)     | Advanced Terraform + k8s path   |
| [Terraform](../terraform/README.md)                   | AWS infrastructure              |
| [Kubernetes](../k8s/README.md)                        | K8s manifests                   |

## Maintainer docs

**Not required for product adoption.** Internal release, verification, and debug procedures.

| Doc                                                                               | Description                    |
| --------------------------------------------------------------------------------- | ------------------------------ |
| [engineering/](./engineering/README.md)                                           | Maintainer index               |
| [Releasing](./engineering/releasing.md)                                           | npm and action tag releases    |
| [Fly worker engine ops](./engineering/fly-worker-engine.md)                       | Engine bake, upgrade, rollback |
| [Composite action internals](./engineering/composite-action-internals.md)         | Action implementation notes    |
| [Production engine verification](./engineering/production-engine-verification.md) | Post-deploy checklist          |
| [Post-change e2e](./engineering/post-change-e2e-checklist.md)                     | Dogfood verification           |
| [ScanResult debug](./engineering/scanresult-debug.md)                             | Reading stored scan results    |

## Contributing

[CONTRIBUTING.md](../CONTRIBUTING.md) — development setup and PR process.
