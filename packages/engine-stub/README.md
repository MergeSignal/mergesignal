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

All functions in this package throw errors when called:

```typescript
export async function analyze(req: ScanRequest): Promise<ScanResult> {
  throw new Error(
    "Analysis engine not available in open-source version. This is a stub implementation."
  );
}
```

## Architecture

The actual analysis engine is located in the private `mergesignal-engine` repository and is used by:

- The BullMQ worker that processes scan jobs
- Internal analysis tools and services

This stub package allows the public API and web UI to reference the types without having access to the proprietary implementation.

## License

This stub package is part of the MergeSignal open-source project. The actual analysis engine is proprietary.
