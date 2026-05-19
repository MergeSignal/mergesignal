# Surfaces (maintainers)

Short reference for **this repository** and hosted product development—not end-user onboarding.

| Surface                                                                                      | Role                                                                                                                                     |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub Check Run** (App installation)                                                      | Authoritative **PR UX** for hosted installs.                                                                                             |
| **`scans.result` in Postgres**                                                               | **Canonical `ScanResult`** for dashboards, API, and investigations.                                                                      |
| **[`.github/workflows/mergesignal-scan.yml`](../../.github/workflows/mergesignal-scan.yml)** | **Internal dogfood** only (`push` to `main`, `workflow_dispatch`)—trusted composite + engine on the runner; not the hosted PR narrative. |
| **[Composite action](../../.github/actions/merge-signal-scan/)**                             | **Actions-only CI** for other repositories; see Getting started and the action README.                                                   |

See [scanresult-debug.md](./scanresult-debug.md) for reading raw JSON and [post-change-e2e-checklist.md](./post-change-e2e-checklist.md) after workflow changes.
