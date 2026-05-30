# GitHub App (MergeSignal)

The MergeSignal **GitHub App** connects your repositories to MergeSignal for automated scans on lockfile changes, repo dashboards, and optional GitHub-native features (Check Runs, PR comments).

## When to choose the GitHub App

| Approach           | Best for                                                                           |
| ------------------ | ---------------------------------------------------------------------------------- |
| **CLI**            | Local pre-PR scans; no server setup                                                |
| **GitHub Actions** | CI workflow summaries on every qualifying PR; no MergeSignal server                |
| **GitHub App**     | Persistent scans, repo dashboard, Check Runs, and PR integration via webhook + API |

Use the App when you want MergeSignal to **watch repositories continuously** and surface results in the MergeSignal web dashboard and on GitHub — not just in a single CI job.

## Full setup

Detailed installation, permissions, and configuration: **[Getting started → GitHub App](https://mergesignal-web.fly.dev/getting-started#github-app)** on the web app (replace the host when self-hosting).

Permission scopes and the **Review request** step after permission changes are documented on that page.

## Self-hosting

If you run your own MergeSignal stack, point the App webhook and OAuth settings at your deployment. See [DEPLOYMENT.md](../DEPLOYMENT.md) and [docs/self-host/fly.md](./self-host/fly.md).
