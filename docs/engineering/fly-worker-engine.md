# Fly worker engine integration (maintainers)

**MergeSignal org only.** Internal runbook for deploying the hosted Fly worker with the proprietary analysis engine baked into the Docker image. Self-hosters without engine repo access should use the [hosted preview](https://mergesignal-web.fly.dev) or CLI/GitHub Actions paths — see [docs/self-host/fly.md](../self-host/fly.md).

Production scans require the real private engine from `MergeSignal/mergesignal-engine`. The worker does **not** use `MERGESIGNAL_ALLOW_STUB` in production.

## Build pipeline

```
GitHub Actions (fly-deploy) ──build-secret──► Docker engine-builder stage
                                              (clone tag + frozen lockfile build)
                                                    │
                                                    ▼
                                         engine dist + engine-manifest.json
                                                    │
                                                    ▼
                                         lean worker runtime image
                                                    │
                                                    ▼
                              initializeEngine() ABI preflight → queue consumer
```

**Startup ordering (strict):** env validation → engine ABI preflight (timeout-bounded, once per process) → `worker_startup_complete` → queue consumer created → jobs processed.

## Version field glossary (do not conflate)

| Field                    | Meaning                                          | Example                     |
| ------------------------ | ------------------------------------------------ | --------------------------- |
| `engine_release_version` | Semver tag of engine **built into worker image** | `v1.2.3`                    |
| `engine_release_git_sha` | Git commit of engine at image build              | `abc123…`                   |
| `methodology_version`    | Analysis methodology string **emitted per scan** | `mergesignal-engine/v1.2.3` |

## Required GitHub configuration (Fly worker deploy)

| Name                               | Type     | Purpose                                                             |
| ---------------------------------- | -------- | ------------------------------------------------------------------- |
| `MERGESIGNAL_ENGINE_REPO_TOKEN`    | Secret   | Read-only access to private engine repo (BuildKit secret)           |
| `MERGESIGNAL_ENGINE_REF`           | Variable | **Required** semver tag (e.g. `v1.2.3`) — intentional upgrades only |
| `FLY_API_TOKEN_MERGESIGNAL_WORKER` | Secret   | Fly deploy token                                                    |

## Required Fly runtime secrets (worker)

- `DATABASE_URL`, `REDIS_URL` (must match API)

Engine paths are baked in the image (`MERGESIGNAL_ENGINE_IMPL`, `MERGESIGNAL_ENGINE_MANIFEST`). **Do not** set `MERGESIGNAL_ALLOW_STUB` on production worker.

## Intentional engine upgrade process

1. Release and tag `mergesignal-engine` → `vX.Y.Z`
2. Verify engine CI green on that tag
3. Set GitHub repo variable `MERGESIGNAL_ENGINE_REF=vX.Y.Z`
4. Deploy worker (push to `main` or `workflow_dispatch` → **Deploy Fly.io**)
5. Confirm deploy output: `mergesignal-engine vX.Y.Z` + Fly image ref
6. Verify worker logs: `worker_startup_complete` with matching `engineReleaseVersion`
7. Run smoke scan; confirm `scans.engine_release_version = vX.Y.Z`

## Rollback (primary: immutable image)

**Gold standard:** redeploy a previously known-good immutable image — no rebuild.

```bash
fly releases --app mergesignal-worker
fly deploy --app mergesignal-worker --image <registry-ref-from-releases>
```

Verify `worker_startup_complete` logs show the expected engine version. Queued scans resume when a healthy worker starts.

**Last resort:** bump `MERGESIGNAL_ENGINE_REF` to prior tag and redeploy (rebuilds; less reproducible over time).

## Startup latency budget

| Phase                                         | Budget                                                       |
| --------------------------------------------- | ------------------------------------------------------------ |
| Engine module load + ABI probe                | ≤ 30s hard timeout (`MERGESIGNAL_ENGINE_STARTUP_TIMEOUT_MS`) |
| Total cold start to `worker_startup_complete` | ≤ 45s typical                                                |

## Local vs production

| Environment               | Engine source                                                       |
| ------------------------- | ------------------------------------------------------------------- |
| **Production Fly worker** | Private engine baked in Docker image                                |
| **docker-compose**        | OSS stub — not the production image                                 |
| **Trusted CI scan**       | Engine built on runner via `scripts/docker/build-private-engine.sh` |

## Troubleshooting

| Log / symptom                                      | Likely cause                                            |
| -------------------------------------------------- | ------------------------------------------------------- |
| `engine_load_failed` / worker exit loop            | Missing/broken engine in image; check Docker build logs |
| `engine_startup_timeout`                           | Engine ABI probe hung; check engine release             |
| `scan_job_engine_failed`                           | Runtime engine error mid-scan                           |
| Deploy fails: `MERGESIGNAL_ENGINE_REF is required` | Set repo variable before deploy                         |
| Deploy fails: missing build secret                 | Set `MERGESIGNAL_ENGINE_REPO_TOKEN`                     |

**Ops endpoint:** `GET /internal/engine-info` (requires `MERGESIGNAL_INTERNAL_API_KEY`) — recent `engineReleaseVersion` vs `methodologyVersion` from scans.

**Production verification checklist:** [production-engine-verification.md](./production-engine-verification.md)

## Reproducibility checklist

- Frozen lockfiles: `pnpm install --frozen-lockfile` in engine build
- Pinned toolchain: Node 22, pnpm 9.0.0 in Docker stages
- Engine tag pinned via `MERGESIGNAL_ENGINE_REF` (no silent default to `main`)
- Manifest records `engineReleaseGitSha`, `distSha256`, `nodeVersion`, `pnpmVersion`

## Image size thresholds (CI)

- Soft warn: > 350MB
- Hard fail: > 600MB

Trusted CI engine tokens for customer repositories are documented in the [action README](../../.github/actions/merge-signal-scan/README.md), not here.

## MergeSignal org: dogfood and branch protection

Dogfood workflow: [`.github/workflows/mergesignal-scan.yml`](../../.github/workflows/mergesignal-scan.yml) runs **`scan_profile: trusted`** on **`push` to `main`** and **`workflow_dispatch`** only.

Check name example: **`MergeSignal Dogfood / Engine validation`**. Before renaming workflows, update required status checks and rulesets.

**Reading stored ScanResult:** [scanresult-debug.md](./scanresult-debug.md). **Post-merge verification:** [post-change-e2e-checklist.md](./post-change-e2e-checklist.md).

Production workers load the real engine from the baked-in image path (`file:/app/engine/dist/index.js`). `MERGESIGNAL_TRUSTED_ANALYSIS` is primarily for CLI and CI scan paths.
