# Production engine integration verification

Run after deploying the worker with a real private engine (Phase 8). Record outcomes in the deployment PR or release notes.

## Pre-deploy

- [ ] `MERGESIGNAL_ENGINE_REF` repo variable set to intended semver tag
- [ ] `MERGESIGNAL_ENGINE_REPO_TOKEN` secret present
- [ ] Engine tag exists and CI is green on `mergesignal-engine`

## Deploy

- [ ] **Deploy Fly.io** workflow succeeds for `deploy-worker`
- [ ] Deploy log shows `Deploying worker with mergesignal-engine vX.Y.Z`
- [ ] Deploy notice includes Fly image ref for rollback

## Startup validation

- [ ] Fly logs contain `engine_load_start` → `engine_load_success` → `worker_startup_complete` → `worker_queue_consumer_started` **in order**
- [ ] `worker_startup_complete` includes `engineReleaseVersion`, `engineReleaseGitSha`, `bootDurationMs`, `abiValidationDurationMs`
- [ ] Worker does **not** log `scan_job_start` before `worker_startup_complete`
- [ ] Missing engine image causes exit 1 (verified in CI via fixture build tests)

## Scan execution

- [ ] Trigger scan (PR lockfile change or manual enqueue)
- [ ] Scan completes: `scan_job_done` with real `methodologyVersion` (not `engine-stub/*`)
- [ ] DB row: `status=done`, `result` populated
- [ ] DB row: `engine_release_version` and `methodology_version` both set and distinct
- [ ] DB row: `engine_release_git_sha` set

## API / dashboard

- [ ] `GET /scan/:id` returns posture summary
- [ ] Dashboard cards render `safe` / `needs_review` / `risky` with correct colors
- [ ] "Waiting for results…" only for genuinely running scans

## Observability

- [ ] `GET /internal/engine-info` (with internal key) lists recent engine releases
- [ ] No sustained `scan_job_engine_failed` after deploy

## Rollback drill

- [ ] `fly releases --app mergesignal-worker` lists prior release
- [ ] `fly deploy --image <prior-ref>` restores healthy worker without rebuild
- [ ] Startup logs confirm prior `engineReleaseVersion`
- [ ] Queued scans process after rollback

## CI (automatic on PR/main)

- [ ] `verify-worker-runtime-image` job passes (fixture engine, cleanliness + ABI smoke)
- [ ] Image size within thresholds (warn >350MB, fail >600MB)

## Remaining follow-ups

- API `simulate-upgrade` still uses OSS engine loader unless API image gets same engine bake (optional follow-on)
- Apply SQL migration `016_engine_release_version.sql` on production database before expecting new columns
