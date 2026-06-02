# Engine validation — runtime dependency upgrades (Wave 1 / Wave 2)

**Branch:** `eval/engine-validation-deps`  
**Purpose:** Realistic lockfile PR to exercise hosted MergeSignal PR intelligence (reachability, blast radius, recommendations, scoring). **Do not merge** without review — eval only.

## Selected packages

| Package     | Current       | Target        | Apps               | Runtime reach                                                                                |
| ----------- | ------------- | ------------- | ------------------ | -------------------------------------------------------------------------------------------- |
| `fastify`   | 5.7.4         | 5.8.5         | `@mergesignal/api` | **High** — HTTP server, routing, auth, webhooks, scan/org/benchmark routes (~30 modules)     |
| `next-auth` | 5.0.0-beta.30 | 5.0.0-beta.31 | `web`              | **High** — GitHub OAuth, JWT/session callbacks, middleware, repo/org guards, sign-in routes  |
| `bullmq`    | 5.70.1        | 5.78.0        | `api`, `worker`    | **Medium–high** — scan job queue (API enqueue + worker consumer), cross-service blast radius |

## Estimated application areas

- **API / routing:** `apps/api/src/app.ts`, `routes/*`, `http/*` (Fastify plugins, rate limit, CORS, raw body, problem responses).
- **Authentication (web):** `apps/web/auth.ts`, `middleware.ts`, `lib/org-guard.ts`, `lib/repo-guard.ts`, `app/api/auth/*`, `ClientSessionProvider`.
- **Scan pipeline:** `apps/api/src/queue.ts`, `apps/worker/src/main.ts`, `apps/worker/src/runScanJob.ts`.

## Expected blast radius

- **Wave 1 (direct):** All direct import sites above; lockfile transitive updates for Fastify ecosystem and BullMQ Redis workers.
- **Wave 2 (indirect):** Scan request/result flow (queue → worker → API persistence), protected `/app` and `/scan` paths (session from Auth.js), GitHub webhook → scan enqueue path.

## Expected MergeSignal themes

- Framework/server upgrade (`fastify` minor) on primary API surface.
- Auth/session library bump (`next-auth` beta) on OAuth and guarded routes.
- Job-queue upgrade (`bullmq`) spanning API + worker with operational impact copy.

## After evaluation

Close the PR without merging, or revert the branch.
