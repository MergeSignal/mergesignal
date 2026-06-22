# pnpm version governance

This repository has exactly **one** pnpm version authority.

## Authority

| Role            | Location                                               |
| --------------- | ------------------------------------------------------ |
| **Authority**   | [`package.json`](../package.json) → `packageManager`   |
| **Derivation**  | `corepack install` (reads `packageManager` at runtime) |
| **Enforcement** | `pnpm check:pnpm-governance` (CI + local)              |

Example authority shape (includes Corepack integrity hash):

```json
"packageManager": "pnpm@9.15.9+sha512.68046141893c66fad01c079231128e9afb89ef87e2691d69e4d40eee228988295fd4682181bae55b58418c3a253bde65a505ec7c5f9403ece5cc3cd37dcf2531"
```

No other file may pin a pnpm semver. No `corepack prepare pnpm@…`. No `pnpm/action-setup` with a `version:` pin.

## Derived consumers

These paths **derive** pnpm from the authority via `corepack install` after `package.json` is available:

| Surface                                  | Mechanism                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Local dev / CI                           | `corepack enable && corepack install`                                                                                                 |
| `apps/api/Dockerfile`                    | Copy root `package.json` → `corepack install`                                                                                         |
| `apps/web/Dockerfile`                    | Copy root `package.json` → `corepack install`                                                                                         |
| `apps/worker/Dockerfile`                 | Copy root `package.json` → `corepack install`                                                                                         |
| `scripts/docker/build-private-engine.sh` | After cloning **mergesignal-engine**, `corepack install` reads **engine** `package.json` (engine is authority for that build context) |

## Update procedure

1. Choose target pnpm version (keep aligned with [mergesignal-engine](https://github.com/MergeSignal/mergesignal-engine) `packageManager`).
2. Update **only** root `package.json` `packageManager`:
   ```bash
   corepack use pnpm@X.Y.Z
   ```
   This writes the version and integrity hash.
3. Regenerate lockfile:
   ```bash
   pnpm install
   ```
4. Validate:
   ```bash
   pnpm check:pnpm-governance
   pnpm build && pnpm test
   ```

Do not edit Dockerfiles, shell scripts, or workflows to bump pnpm manually.

## Release / CI expectations

- **CI** ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)): runs `pnpm check:pnpm-governance` on every PR/push.
- **Publish shared** ([`.github/workflows/publish-shared.yml`](../../.github/workflows/publish-shared.yml)): uses `corepack install`, not `pnpm/action-setup`.
- **Fresh clone**: `corepack enable && corepack install && pnpm install --frozen-lockfile`.

## Cross-repo alignment

`mergesignal-engine` maintains its own `packageManager` authority. Public and engine repos should bump pnpm together when upgrading the toolchain. `build-private-engine.sh` clones engine and uses **engine's** `packageManager` — not mergesignal's.

## Why `catalog:` required pnpm ≥ 9.5

The contracts catalog (`catalog:` protocol in `pnpm-workspace.yaml`) requires pnpm **9.5.0+**. Authority is pinned to **9.15.9** to match mergesignal-engine.

## Related

- [releasing.md](./releasing.md) — contracts catalog and package release order
- [presentation-ownership.md](./presentation-ownership.md) — assessment projection ownership
