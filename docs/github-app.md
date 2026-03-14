# GitHub App setup (RepoSentinel)

RepoSentinel can ingest GitHub events and automatically enqueue scans when a lockfile changes.

## Create a GitHub App

In GitHub:

- Create a GitHub App (organization-owned is fine)
- **Webhook URL**: `http(s)://<YOUR_API_HOST>/github/webhook`
- **Webhook secret**: generate a random string (you’ll set it as `GITHUB_WEBHOOK_SECRET`)
- Subscribe to events:
  - **Pull request**
  - **Push**
- Repository permissions:
  - **Contents**: Read-only
  - **Pull requests**: Read-only
  - **Issues**: Read & write (required to post PR comments)

Install the App on a repository (or “All repositories”) so it can receive events.

## API configuration

Set these env vars for `apps/api`:

- `GITHUB_APP_ID`: the App ID
- `GITHUB_PRIVATE_KEY`: the PEM private key contents (if you store it as one line, replace newlines with `\n`)
- `GITHUB_WEBHOOK_SECRET`: the webhook secret you configured in the App settings

## What happens on events

- On `pull_request` (`opened`, `reopened`, `synchronize`), if a lockfile changed, RepoSentinel fetches the lockfile from the PR head SHA and enqueues a scan. After the scan completes, it posts/updates a PR comment with a risk delta (pnpm only for now).
- On `push`, if a lockfile changed, RepoSentinel fetches the lockfile at the pushed SHA and enqueues a scan.

