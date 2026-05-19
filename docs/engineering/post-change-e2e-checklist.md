# Post-change checks (MergeSignal org)

Run after merging dogfood workflow / docs updates. Record outcomes in the PR description.

1. **Hosted scan** — open or sync a PR with a lockfile change; confirm a scan completes and **`scans.result`** is populated (API `GET /scan/:id` or DB).
2. **Check Run** — confirm the App Check Run appears and ends in the expected state on that PR.
3. **PR comments** — confirm comment behavior still matches policy (e.g. only when insights warrant it).
4. **Dashboards / API** — spot-check that scan-backed views still load for that repo.
5. **Branch protection** — confirm no required check is stuck waiting for **`MergeSignal Dogfood / Engine validation`** on a normal PR (that workflow must not run on `pull_request` in this repo). Update rulesets if an **old** dogfood check name was required.
6. **Dogfood still runs** — push to `main` (or `workflow_dispatch`) and confirm **MergeSignal Dogfood / Engine validation** runs and optional artifact **`mergesignal-scan`** is produced when trusted scan runs.

**Rollback:** revert the merge commit and restore previous GitHub required-check configuration if merges were blocked.
