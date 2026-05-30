# @mergesignal/shared

Published npm package containing the MergeSignal **scan contract**, presentation policy, and trusted-output validation.

```bash
npm install @mergesignal/shared
```

**Current version:** see [package.json](./package.json). Pin exact semver in downstream consumers (especially the proprietary analysis engine).

## What it provides

- **Types and schemas** for `ScanRequest`, `ScanResult`, upgrade simulation, and related wire formats
- **Validation** for scan results and trusted CI output guards
- **Presentation copy** helpers used by the web app and CI summary renderers

## Usage

```typescript
import {} from /* types, validators, copy */ "@mergesignal/shared";
```

See `dist/index.d.ts` after install for the full export surface.

## OSS monorepo vs npm

Inside this repository, apps use the workspace package via `pnpm`. External consumers (e.g. `mergesignal-engine`) install from the **public npm registry** with an exact version pin.

## License

MIT — see [LICENSE](../../LICENSE) for the monorepo; npm package license field in `package.json`.

## More

- [Engine stub](../engine-stub/README.md) — OSS boundary
- [GitHub Actions integration](../../.github/actions/merge-signal-scan/README.md)
- Maintainer release process: [docs/engineering/releasing.md](../../docs/engineering/releasing.md)
