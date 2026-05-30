# MergeSignal

MergeSignal analyzes dependency upgrades, identifies affected application flows, and provides reviewer guidance before merge.

**Example upgrade review:**

```
Upgrade requires review

This upgrade affects auth middleware ordering in protected routes.

Where it shows up
- apps/api/src/middleware/auth.ts - auth guard depends on middleware order
- apps/api/src/routes/account.ts - protected handlers assume validation ran first

What to do
- Verify validation middleware still runs before handlers
- Re-run protected-route tests and confirm 401/403 behavior

```

## Architecture

MergeSignal consists of a **web application**, **API**, **worker**, and **analysis engine**. You can use CLI or GitHub Actions without running the full stack; the hosted GitHub App and self-hosted deployments use all four components. The open-source repository includes a demo engine; production analysis uses the proprietary engine — see [docs/architecture.md](./docs/architecture.md) and [packages/engine-stub/README.md](./packages/engine-stub/README.md).

## Quick start

### CLI

```bash
git clone https://github.com/MergeSignal/mergesignal.git
cd mergesignal
pnpm install
pnpm ms scan
```

Run from your project directory (where your lockfile lives). If MergeSignal is cloned elsewhere: `pnpm --dir /path/to/mergesignal ms scan`. Options: `--json`, `--out`, `--lockfile`, `--fail-above <score>`.

### GitHub Actions

Add a workflow step to write upgrade findings to each run's **Summary** — no MergeSignal server required:

```yaml
permissions:
  contents: read

jobs:
  analysis:
    if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: MergeSignal/mergesignal/.github/actions/merge-signal-scan@main
        with:
          scan_profile: trusted
          engine_repo_token: ${{ secrets.MERGESIGNAL_ENGINE_REPO_TOKEN }}
```

Use `scan_profile: development` for OSS demo output only. Full contract, inputs, and troubleshooting: [.github/actions/merge-signal-scan/README.md](./.github/actions/merge-signal-scan/README.md). Optional version pins: use `@vX.Y.Z` tags on the action ref (see action README).

### GitHub App

For persistent scans, repo dashboards, and GitHub-native integration (Check Runs, PR comments), install the MergeSignal GitHub App. Summary: [docs/github-app.md](./docs/github-app.md). Full setup: [getting-started → GitHub App](https://mergesignal-web.fly.dev/getting-started#github-app) (replace the host when self-hosting).

## Full onboarding

Detailed setup, dashboard walkthrough, troubleshooting, and best practices: **[mergesignal-web.fly.dev/getting-started](https://mergesignal-web.fly.dev/getting-started)** (replace the host when self-hosting).

Contributors: [CONTRIBUTING.md](./CONTRIBUTING.md).

## Self-hosting

Optional — most users start with CLI, GitHub Actions, or the hosted App. To run the full stack yourself: [DEPLOYMENT.md](./DEPLOYMENT.md).

## Documentation

- [Documentation index](./docs/README.md) — user, self-host, and maintainer docs
- [Architecture overview](./docs/architecture.md)
- [GitHub Actions integration](./.github/actions/merge-signal-scan/README.md)
- [Example workflow (PR + push)](./docs/examples/mergesignal-scan-with-pull-request.yml)

## Legal and trust

MergeSignal software in this repository is licensed under **[Apache License 2.0](./LICENSE)**; see also [NOTICE](./NOTICE).

**Data and responsibility:** Automated upgrade impact findings are **informational** and must be validated for your context. Legal pages ship with the web app (e.g. public Fly build: [Privacy](https://mergesignal-web.fly.dev/privacy), [Terms](https://mergesignal-web.fly.dev/terms), [API Terms](https://mergesignal-web.fly.dev/api-terms), [Contact](https://mergesignal-web.fly.dev/contact)). **These documents are not legal advice for your company.**
