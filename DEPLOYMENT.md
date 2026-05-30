# Self-hosting MergeSignal

Most users start with the [README Quick Start](../README.md), [GitHub Actions](../.github/actions/merge-signal-scan/README.md), or the hosted GitHub App. Self-hosting is optional.

## What do I need to deploy?

See the decision tree: [docs/self-host/overview.md](docs/self-host/overview.md)

| Goal                         | Doc                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| Local scan only              | [README](../README.md)                                                                               |
| CI on GitHub Actions         | [Action README](../.github/actions/merge-signal-scan/README.md)                                      |
| Full stack (dashboard + App) | [docs/self-host/fly.md](docs/self-host/fly.md) or [aws-kubernetes](docs/self-host/aws-kubernetes.md) |
| Local dev of full stack      | [docs/self-host/local-development.md](docs/self-host/local-development.md)                           |

## Architecture

High-level components: [docs/architecture.md](docs/architecture.md)

## Detailed guides

- [Self-host overview](docs/self-host/overview.md)
- [Local development](docs/self-host/local-development.md)
- [Fly.io](docs/self-host/fly.md)
- [AWS / Kubernetes](docs/self-host/aws-kubernetes.md)
- [Documentation index](docs/README.md)

Production analysis requires the proprietary engine — see [packages/engine-stub/README.md](packages/engine-stub/README.md).
