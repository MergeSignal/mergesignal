# Maintainer documentation

**Maintainer documentation — not required for product adoption.**

These documents support MergeSignal maintainers and operators: releases, production verification, engine deploys, and debugging.

## Index

| Document                                                                 | Purpose                                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| [releasing.md](./releasing.md)                                           | Publish `@mergesignal/shared` and tag the GitHub Actions composite |
| [fly-worker-engine.md](./fly-worker-engine.md)                           | Worker engine bake, upgrade, rollback, internal ops                |
| [composite-action-internals.md](./composite-action-internals.md)         | Composite action implementation details                            |
| [production-engine-verification.md](./production-engine-verification.md) | Post-deploy worker/engine checklist                                |
| [post-change-e2e-checklist.md](./post-change-e2e-checklist.md)           | Dogfood workflow verification                                      |
| [scanresult-debug.md](./scanresult-debug.md)                             | Reading stored ScanResult                                          |
| [presentation-foundation.md](./presentation-foundation.md)               | Presentation Foundation architecture and public contract rule      |
| [presentation-ownership.md](./presentation-ownership.md)                 | Assessment authority and surface projection rules                  |
| [pnpm-version-governance.md](./pnpm-version-governance.md)               | Single pnpm version authority and enforcement                      |

User and self-host documentation: [docs/README.md](../README.md).
