# GitHub App setup (MergeSignal)

**User-facing documentation for the GitHub App lives on the website** (same paths on your deployment). For example, if you use the public Fly web app: **https://mergesignal-web.fly.dev/getting-started#github-app**

This file remains in the repository for discoverability and deep links from older references. For local development of the API and web app (Docker, env files, migrations), see the [README](./README.md) (“Web app and API locally”) and [DEPLOYMENT.md](./DEPLOYMENT.md).

## Permissions checklist (summary)

Match scopes to what you want on GitHub; the full **Setup** list is on [Getting started → GitHub App](https://mergesignal-web.fly.dev/getting-started#github-app) (replace the host when self-hosted).

- **Contents**: Read-only (read lockfiles).
- **Pull requests**: Read-only for webhook scans; Read & write only if MergeSignal should write on the PR (for example comments).
- **Checks**: Read & write when scan status should appear on the PR **Checks** tab (GitHub Check Runs); omit or read-only if you only use MergeSignal’s UI/API.
- **Issues**: Read & write only when enabled features require it.

After you **change** permissions on the App, each org or account installation must complete **Review request** under **Configure** for the installed app; otherwise new API calls stay on the old scopes (for example the Checks API can return “Resource not accessible by integration”).
