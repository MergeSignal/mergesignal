# Contributing to MergeSignal

Thank you for your interest in MergeSignal. This repository is public under Apache 2.0.

MergeSignal is maintained with a clear product direction. Contributions are welcome, but significant product or architectural changes should be discussed before implementation.

## What we welcome

Contributions that are especially helpful:

- Bug reports
- Documentation improvements
- Small, targeted fixes
- Build, tooling, and developer-experience improvements
- Clearly scoped enhancements that align with the existing product direction

**Before starting larger work:** discuss major feature proposals with maintainers first. Product direction, UX, design system decisions, scoring methodology, and architecture remain maintainer-driven — please do not implement large changes without alignment.

## Development setup

**Prerequisites:** Node.js ≥ 20.19 (see [`.nvmrc`](./.nvmrc)), pnpm 9.x (see root `packageManager`).

```bash
git clone https://github.com/MergeSignal/mergesignal.git
cd mergesignal
pnpm install
```

Run the full local check suite before opening a PR:

```bash
pnpm precommit
```

This runs build, typecheck, lint, and tests across the monorepo.

## Making a change

1. Create a branch from `main`.
2. Make focused changes with tests where behavior changes.
3. Run `pnpm precommit` locally.
4. Open a pull request with a clear description of what changed and why.

## CI

Pull requests and pushes to `main` run [`.github/workflows/ci.yml`](./.github/workflows/ci.yml): install, build, typecheck, lint, and test.

## Where to learn more

- **Quick start (CLI, GitHub Actions):** [README.md](./README.md)
- **Complete onboarding:** [getting-started](https://mergesignal-web.fly.dev/getting-started) on the web app (replace the host when self-hosting)
- **High-level architecture:** [docs/architecture.md](./docs/architecture.md)
- **Documentation index:** [docs/README.md](./docs/README.md)
- **OSS vs proprietary engine:** [packages/engine-stub/README.md](./packages/engine-stub/README.md)
- **Self-hosting:** [DEPLOYMENT.md](./DEPLOYMENT.md)

## Questions

Open a GitHub issue or use [Contact](https://mergesignal-web.fly.dev/contact) on the hosted web app.
