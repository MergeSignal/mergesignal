# Reading a stored ScanResult (maintainers)

Presentation DTOs are the default API and UI contract. Raw engine output is opt-in for debugging.

## Default scan responses

- **`GET /scan/:id`** returns `detailPresentation` (structured scan detail UI). Raw `ScanResult` is **not** included by default.
- **`GET /repo/:owner/:repo/pull-request-scans`** returns `cardPresentation` per PR for dashboard cards.
- **SSE `GET /scan/:id/events`** emits `detailPresentation` (and `cardPresentation`) on terminal status events — not raw `result`.

## Raw ScanResult (debug / break-glass)

- **API:** `GET /scan/:id?include=rawResult` adds `result` (JSON) when the scan is complete. Use an org-scoped API key when your deployment requires it.
- **Web debug panel:** open a scan with `?debug=1` when `MS_ALLOW_SCAN_DEBUG=1` is set server-side. The panel fetches `?include=rawResult` client-side.
- **Database:** `SELECT result FROM scans WHERE id = '<uuid>';` — break-glass / local debugging only; respect access controls in production.
- **Runner JSON:** the **MergeSignal Dogfood** workflow still uploads `mergesignal-scan` artifacts on **`push` to `main`** and **`workflow_dispatch`** when you need a file produced entirely inside Actions.

## Presentation orchestration

All surfaces derive from `buildScanPresentationBundle()` in `@mergesignal/shared`. The bundle requires `result.assessment` on fresh engine output. Presenters consume `{ assessment, presentation, profile, facts, result }` and project assessment fields — they must not infer posture, reach, or verification policy from scores.

Authority and field classification: [presentation-ownership.md](./presentation-ownership.md).

## Assessment on the wire

Fresh engine `ScanResult` JSON includes top-level `assessment` (posture, confidence, primary concern, factors, presentation policy) and projections such as `decision.reasoning`. Historical rows may lack `assessment`; the UI treats those as incomplete until re-scanned (see [Historical scans](./presentation-ownership.md#historical-scans)).
