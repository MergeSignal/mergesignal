# Reading a stored ScanResult (maintainers)

- **API:** `GET /scan/:id` on the API returns the scan row, including `result` (JSON) when status is `done`. Use an org-scoped API key when your deployment requires it.
- **Database:** `SELECT result FROM scans WHERE id = '<uuid>';` — break-glass / local debugging only; respect access controls in production.
- **Runner JSON:** the **MergeSignal Dogfood** workflow still uploads `mergesignal-scan` artifacts on **`push` to `main`** and **`workflow_dispatch`** when you need a file produced entirely inside Actions.
