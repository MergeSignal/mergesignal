# Deploying and self-hosting MergeSignal

Most users start with the [README quick start](README.md#quick-start), [GitHub Actions](.github/actions/merge-signal-scan/README.md), or the [hosted GitHub App](docs/github-app.md). Self-hosting is optional.

## What do I need to deploy?

See the decision tree: [docs/self-host/overview.md](docs/self-host/overview.md)

| Goal                         | Doc                                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Local scan only              | [README quick start](README.md#quick-start)                                                                            |
| CI on GitHub Actions         | [Action README](.github/actions/merge-signal-scan/README.md)                                                           |
| Full stack (dashboard + App) | [docs/self-host/fly.md](docs/self-host/fly.md)<br>[docs/self-host/aws-kubernetes.md](docs/self-host/aws-kubernetes.md) |
| Local dev of full stack      | [docs/self-host/local-development.md](docs/self-host/local-development.md)                                             |

## Detailed guides

- [Self-host overview](docs/self-host/overview.md)
- [Local development](docs/self-host/local-development.md)
- [Fly.io](docs/self-host/fly.md)
- [AWS / Kubernetes](docs/self-host/aws-kubernetes.md)
- [Documentation index](docs/README.md)

## Additional references

- High-level components: [docs/architecture.md](docs/architecture.md)
- Production-grade dependency analysis requires the proprietary MergeSignal engine. See [packages/engine-stub/README.md](packages/engine-stub/README.md) for details about the OSS boundary.
- Support and feedback: [SUPPORT.md](SUPPORT.md)
