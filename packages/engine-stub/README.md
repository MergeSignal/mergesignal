# @mergesignal/engine-stub

This is a **stub implementation** of the MergeSignal analysis engine. The actual analysis engine is proprietary and located in a private repository.

## Purpose

This package exists to:

1. **Define type contracts** for the public API
2. **Provide type definitions** for integration with the public MergeSignal API
3. **Enable compilation** of the public repository without exposing proprietary analysis logic

## What's Included

- Type definitions for `ScanRequest`, `ScanResult`, `UpgradeSimulationRequest`, `UpgradeSimulationResult`
- Type definitions for code analysis interfaces (stub types only)
- Re-exports of shared types from `@mergesignal/shared`

## What's NOT Included

The following proprietary analysis capabilities are **not** available in this open-source version:

- **Breaking change detection** - Semver analysis, changelog parsing, upgrade impact detection
- **Code usage analysis** - Import scanning, AST parsing, usage mapping
- **Risk scoring** - Security, maintainability, ecosystem, and upgrade impact scoring
- **Dependency graph analysis** - Graph metrics, insights, and health scoring
- **Vulnerability scanning** - OSV integration and vulnerability detection
- **Upgrade simulation** - Impact analysis and delta computation

## Implementation

`analyze` and `simulateUpgrade` return **deterministic mock `ScanResult` data** (tagged with `methodologyVersion: "engine-stub/v2"`) so local development and CI work without the proprietary engine.

In **production**, the worker must load the real engine. The stub is not used on production paths unless `MERGESIGNAL_ALLOW_STUB=1` is set explicitly for demo stacks.

## Getting real analysis

| Path                         | How                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **GitHub Actions (trusted)** | `scan_profile: trusted` + `engine_repo_token` — [action README](../../.github/actions/merge-signal-scan/README.md) |
| **Self-hosted full stack**   | Deploy worker with proprietary engine — [docs/self-host/overview.md](../../docs/self-host/overview.md)             |
| **Hosted preview**           | MergeSignal-operated deployment with real engine                                                                   |

## Architecture

The proprietary analysis engine is used by the worker in production deployments. This stub allows the public API and web UI to compile and run demo scans without access to proprietary implementation details.

See [docs/architecture.md](../../docs/architecture.md) for high-level components.

## License

This stub package is part of the MergeSignal open-source project. The actual analysis engine is proprietary.
