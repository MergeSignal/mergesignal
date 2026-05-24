# Production Deployment Guide

This guide covers deploying MergeSignal to production using Docker, Kubernetes, and AWS infrastructure.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Infrastructure Setup](#infrastructure-setup)
- [Application Deployment](#application-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Configuration Management](#configuration-management)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup and Disaster Recovery](#backup-and-disaster-recovery)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

## Overview

MergeSignal is deployed as a microservices architecture on Kubernetes, with the following components:

- **API Service**: Fastify API server handling HTTP requests
- **Worker Service**: BullMQ worker processing scan jobs
- **Web Service**: Next.js web UI
- **PostgreSQL**: Relational database for persistent storage
- **Redis**: Job queue and caching

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Internet                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Ingress Controller (NGINX)                  │
│               (SSL/TLS Termination)                      │
└─────┬──────────────────────────────────┬────────────────┘
      │                                   │
      ▼                                   ▼
┌─────────────┐                    ┌─────────────┐
│  Web Service │                   │  API Service │
│   (Next.js)  │◄──────────────────│  (Fastify)   │
└─────────────┘                    └──────┬───────┘
                                          │
                                          ▼
                                   ┌─────────────┐
                                   │   Redis     │
                                   │  (BullMQ)   │
                                   └──────┬───────┘
                                          │
                                          ▼
                                   ┌─────────────┐
                                   │   Worker    │
                                   │  (BullMQ)   │
                                   └──────┬───────┘
                                          │
                                          ▼
                                   ┌─────────────┐
                                   │ PostgreSQL  │
                                   │  Database   │
                                   └─────────────┘
```

## Prerequisites

### Local Tools

- Docker (20.10+)
- kubectl (1.28+)
- Terraform (1.0+)
- AWS CLI (2.0+)
- Node.js (22+) - for local builds
- pnpm (9.0+)

### AWS Account

- AWS account with appropriate permissions
- IAM user or role with EKS, RDS, ECR, VPC, and EC2 permissions
- Route53 hosted zone for your domain (optional)

### Required Secrets

Before deployment, gather:

- Database password (strong, generated)
- GitHub App credentials (if using GitHub integration)
- API keys for external services

## Infrastructure Setup

### Step 1: Initialize Terraform

```bash
cd terraform

# Create terraform.tfvars from example
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your values
vim terraform.tfvars
```

Required variables in `terraform.tfvars`:

```hcl
aws_region     = "us-east-1"
environment    = "production"
project_name   = "mergesignal"
db_username    = "mergesignal"
db_password    = "STRONG_PASSWORD_HERE"
```

### Step 2: Apply Terraform Configuration

```bash
# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply (creates all AWS resources)
terraform apply
```

This creates:

- VPC with public/private subnets
- EKS cluster
- RDS PostgreSQL instance
- ElastiCache Redis cluster
- ECR repositories
- Security groups and IAM roles

**Estimated time**: 15-20 minutes

### Step 3: Configure kubectl

```bash
aws eks update-kubeconfig --region us-east-1 --name mergesignal

# Verify connection
kubectl get nodes
```

## Application Deployment

### Step 1: Build and Push Docker Images

Get ECR repository URLs:

```bash
cd terraform
export ECR_API=$(terraform output -raw ecr_repository_api)
export ECR_WORKER=$(terraform output -raw ecr_repository_worker)
export ECR_WEB=$(terraform output -raw ecr_repository_web)
```

Authenticate Docker to ECR:

```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  $(echo $ECR_API | cut -d'/' -f1)
```

Build and push images:

```bash
cd ..

# Build and push API
docker build -t $ECR_API:latest -f apps/api/Dockerfile .
docker push $ECR_API:latest

# Build and push Worker
docker build -t $ECR_WORKER:latest -f apps/worker/Dockerfile .
docker push $ECR_WORKER:latest

# Build and push Web
docker build -t $ECR_WEB:latest -f apps/web/Dockerfile .
docker push $ECR_WEB:latest
```

### Step 2: Update Kubernetes Secrets

Update `k8s/secret.yaml` with production values:

```yaml
stringData:
  DATABASE_URL: "postgresql://mergesignal:PASSWORD@RDS_ENDPOINT/mergesignal?schema=public"
  REDIS_URL: "redis://REDIS_ENDPOINT:6379"
```

Get RDS and Redis endpoints:

```bash
cd terraform
terraform output rds_endpoint
terraform output redis_endpoint
```

### Step 3: Update Kubernetes ConfigMap

Edit `k8s/configmap.yaml`:

```yaml
data:
  CORS_ORIGINS: "https://mergesignal-web.fly.dev"
  # ... other configs
```

### Step 4: Update Deployment Image References

Edit deployment files to use your ECR URLs:

`k8s/api-deployment.yaml`:

```yaml
image: YOUR_ECR_REGISTRY/mergesignal/api:latest
```

`k8s/worker-deployment.yaml`:

```yaml
image: YOUR_ECR_REGISTRY/mergesignal/worker:latest
```

`k8s/web-deployment.yaml`:

```yaml
image: YOUR_ECR_REGISTRY/mergesignal/web:latest
```

### Step 5: Update Ingress Configuration

Edit `k8s/ingress.yaml`:

```yaml
spec:
  tls:
    - hosts:
        - mergesignal-web.fly.dev
        - mergesignal-api.fly.dev
  rules:
    - host: mergesignal-web.fly.dev
      # ...
    - host: mergesignal-api.fly.dev
      # ...
```

### Step 6: Deploy to Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml

# Wait for database to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n mergesignal --timeout=300s

# Deploy applications
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/worker-deployment.yaml
kubectl apply -f k8s/web-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

### Step 7: Verify Deployment

```bash
# Check pod status
kubectl get pods -n mergesignal

# Check services
kubectl get services -n mergesignal

# Check ingress
kubectl get ingress -n mergesignal

# View logs
kubectl logs -f deployment/api -n mergesignal
```

## CI/CD Pipeline

### GitHub Actions Setup

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that:

1. Builds and tests the application
2. Builds Docker images
3. Pushes images to ECR
4. Deploys to staging (on push to main)
5. Deploys to production (on tag push or manual trigger)

### Required GitHub Secrets

Add these secrets to your GitHub repository:

- `AWS_ROLE_ARN`: IAM role ARN for GitHub Actions (use OIDC)
- `AWS_ACCOUNT_ID`: Your AWS account ID

### Setting up AWS OIDC for GitHub Actions

1. Create IAM OIDC provider for GitHub:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

2. Create IAM role with trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:your-org/mergesignal:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

3. Attach policies to the role:
   - ECR push/pull access
   - EKS cluster access
   - Kubernetes deployment permissions

### Deployment Workflow

**Staging Deployment** (automatic on push to main):

```bash
git push origin main
```

**Production Deployment** (manual or tag-based):

```bash
# Create and push a tag
git tag v1.0.0
git push origin v1.0.0
```

Or use GitHub Actions UI to trigger manually.

## Configuration Management

### Environment Variables

Production configuration is managed through:

1. **Kubernetes ConfigMap** (`k8s/configmap.yaml`): Non-sensitive config
2. **Kubernetes Secrets** (`k8s/secret.yaml`): Sensitive credentials
3. **Environment-specific overrides**: Use different files for staging/production

### Public URLs (Fly.io)

Current preview deployment:

- **Web:** `https://mergesignal-web.fly.dev/`
- **API:** `https://mergesignal-api.fly.dev`

1. Set the web app `NEXT_PUBLIC_API_BASE_URL` to `https://mergesignal-api.fly.dev`.
2. Set API `CORS_ORIGINS` to `https://mergesignal-web.fly.dev` (comma-separated if you add more origins later).
3. Update the **GitHub App** webhook to `https://mergesignal-api.fly.dev/github/webhook` and the **GitHub OAuth** callback to `https://mergesignal-web.fly.dev/api/auth/callback/github`. Align **repository permissions** with how you use GitHub (see the web app **Getting started → GitHub App**), including **Checks → Read & write** when scan status should appear as **Check Runs** on pull requests. After any permission increase, complete **Review request** on each installation in GitHub.
4. Configure web secrets: `MERGESIGNAL_API_KEY`, `MERGESIGNAL_LINKED_GITHUB_OWNER`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` (Fly: `fly secrets set`, Kubernetes: `k8s/secret.yaml`).

When you move to a custom domain later, replace these hostnames in DNS, `CORS_ORIGINS`, GitHub App, and OAuth settings.

The production **worker** image is built from [`apps/worker/Dockerfile`](apps/worker/Dockerfile). The private analysis engine is **baked into the image at build time** (lean runtime: engine `dist/` + `engine-manifest.json` only). See [Worker engine integration](#worker-engine-integration) below.

### Worker engine integration

Production scans require the real private engine from `MergeSignal/mergesignal-engine`. The worker does **not** use `MERGESIGNAL_ALLOW_STUB` in production.

#### Architecture

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
                              initializeEngine() ABI preflight → BullMQ consumer
```

**Startup ordering (strict):** env validation → engine ABI preflight (timeout-bounded, once per process) → `worker_startup_complete` → BullMQ `Worker` created → queue consumption begins.

#### Version field glossary (do not conflate)

| Field                    | Meaning                                          | Example                     |
| ------------------------ | ------------------------------------------------ | --------------------------- |
| `engine_release_version` | Semver tag of engine **built into worker image** | `v1.2.3`                    |
| `engine_release_git_sha` | Git commit of engine at image build              | `abc123…`                   |
| `methodology_version`    | Analysis methodology string **emitted per scan** | `mergesignal-engine/v1.2.3` |

#### Required GitHub configuration (Fly worker deploy)

| Name                               | Type     | Purpose                                                             |
| ---------------------------------- | -------- | ------------------------------------------------------------------- |
| `MERGESIGNAL_ENGINE_REPO_TOKEN`    | Secret   | Read-only access to private engine repo (BuildKit secret)           |
| `MERGESIGNAL_ENGINE_REF`           | Variable | **Required** semver tag (e.g. `v1.2.3`) — intentional upgrades only |
| `FLY_API_TOKEN_MERGESIGNAL_WORKER` | Secret   | Fly deploy token                                                    |

#### Required Fly runtime secrets (worker)

- `DATABASE_URL`, `REDIS_URL` (must match API)

Engine paths are baked in the image (`MERGESIGNAL_ENGINE_IMPL`, `MERGESIGNAL_ENGINE_MANIFEST`). **Do not** set `MERGESIGNAL_ALLOW_STUB` on production worker.

#### Intentional engine upgrade process

1. Release and tag `mergesignal-engine` → `vX.Y.Z`
2. Verify engine CI green on that tag
3. Set GitHub repo variable `MERGESIGNAL_ENGINE_REF=vX.Y.Z`
4. Deploy worker (push to `main` or `workflow_dispatch` → **Deploy Fly.io**)
5. Confirm deploy output: `mergesignal-engine vX.Y.Z` + Fly image ref
6. Verify worker logs: `worker_startup_complete` with matching `engineReleaseVersion`
7. Run smoke scan; confirm `scans.engine_release_version = vX.Y.Z`

#### Rollback (primary: immutable image)

**Gold standard:** redeploy a previously known-good immutable image — no rebuild.

```bash
fly releases --app mergesignal-worker
fly deploy --app mergesignal-worker --image <registry-ref-from-releases>
```

Verify `worker_startup_complete` logs show the expected engine version. Queued scans resume when a healthy worker starts.

**Last resort:** bump `MERGESIGNAL_ENGINE_REF` to prior tag and redeploy (rebuilds; less reproducible over time).

#### Startup latency budget

| Phase                                         | Budget                                                       |
| --------------------------------------------- | ------------------------------------------------------------ |
| Engine module load + ABI probe                | ≤ 30s hard timeout (`MERGESIGNAL_ENGINE_STARTUP_TIMEOUT_MS`) |
| Total cold start to `worker_startup_complete` | ≤ 45s typical                                                |

#### Local vs production

| Environment               | Engine source                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Production Fly worker** | Private engine baked in Docker image                                                                          |
| **docker-compose**        | OSS stub (empty `MERGESIGNAL_ENGINE_IMPL`, non-production) — not the production image                         |
| **Trusted CI scan**       | Engine built on runner via [`scripts/docker/build-private-engine.sh`](scripts/docker/build-private-engine.sh) |

#### Troubleshooting

| Log / symptom                                      | Likely cause                                            |
| -------------------------------------------------- | ------------------------------------------------------- |
| `engine_load_failed` / worker exit loop            | Missing/broken engine in image; check Docker build logs |
| `engine_startup_timeout`                           | Engine ABI probe hung; check engine release             |
| `scan_job_engine_failed`                           | Runtime engine error mid-scan                           |
| Deploy fails: `MERGESIGNAL_ENGINE_REF is required` | Set repo variable before deploy                         |
| Deploy fails: missing build secret                 | Set `MERGESIGNAL_ENGINE_REPO_TOKEN`                     |

**Ops endpoint:** `GET /internal/engine-info` (requires `MERGESIGNAL_INTERNAL_API_KEY`) — recent `engineReleaseVersion` vs `methodologyVersion` from scans.

**Production verification checklist:** [docs/engineering/production-engine-verification.md](./docs/engineering/production-engine-verification.md)

#### Reproducibility checklist

- Frozen lockfiles: `pnpm install --frozen-lockfile` in engine build
- Pinned toolchain: Node 22, pnpm 9.0.0 in Docker stages
- Engine tag pinned via `MERGESIGNAL_ENGINE_REF` (no silent default to `main`)
- Manifest records `engineReleaseGitSha`, `distSha256`, `nodeVersion`, `pnpmVersion`

#### Image size thresholds (CI)

- Soft warn: > 350MB
- Hard fail: > 600MB

### GitHub Actions merge-signal-scan

For workflows that should **not** silently use the OSS stub, use the composite action with **`scan_profile: trusted`**. That checks out the private engine repository on the runner, installs and builds it, sets **`MERGESIGNAL_ENGINE_IMPL`** to a **`file:`** URL pointing at the built entry file, and sets `MERGESIGNAL_TRUSTED_ANALYSIS=1` with `MERGESIGNAL_ENGINE_STRICT=1` on scan steps.

**Recommended repository secret:**

- **`MERGESIGNAL_ENGINE_REPO_TOKEN`** — GitHub PAT or GitHub App token with **read** access to the private engine repository only (typically `MergeSignal/mergesignal-engine`). Pass it as `with.engine_repo_token: ${{ secrets.MERGESIGNAL_ENGINE_REPO_TOKEN }}`. Never print this value, embed it in logs, or commit it to the repository.

**Optional repository variables (non-secret overrides):**

- **`MERGESIGNAL_ENGINE_REPOSITORY`** — `owner/name` of the engine repo (default `MergeSignal/mergesignal-engine` in the dogfood workflow).
- **`MERGESIGNAL_ENGINE_REF`** — semver tag for trusted CI checkout (dogfood) and **required** for production worker deploy (repo variable).
- **`MERGESIGNAL_ENGINE_IMPL_FILE`** — path relative to the engine repo root to the built ESM file that exports `analyze` and `simulateUpgrade` (dogfood default `packages/analysis-engine/dist/index.js` for `MergeSignal/mergesignal-engine`). The engine repo must include `pnpm-lock.yaml` or `package-lock.json` and a `build` script that produces this file.
- **Scan JSON contract:** `ScanResult.decision.recommendation` must be one of `safe`, `needs_review`, or `risky` (lowercase). The analysis engine should emit this canonical vocabulary only; `@mergesignal/shared` validators reject other tokens.

**Engine repository contract:** The checkout must contain a standard Node project with `pnpm install --frozen-lockfile` + `pnpm run build`, or `npm ci` + `npm run build`, producing the file at `engine_impl_file`. This matches a private **mergesignal-engine** source checkout.

**Fork behavior (Actions-only repositories):** On `pull_request` from forks, GitHub does not expose your org secrets. **Skip** the MergeSignal job when `github.event.pull_request.head.repo.full_name != github.repository` so fork PRs do not show a fake trusted scan or OSS stub as production signal. **Dependabot** pull requests do not receive normal repository Actions secrets either; skip when `github.actor == 'dependabot[bot]'` or supply the token under **Dependabot secrets** if you need trusted scans there. A copy-paste workflow with `pull_request` is in [docs/examples/mergesignal-scan-with-pull-request.yml](./docs/examples/mergesignal-scan-with-pull-request.yml).

**MergeSignal `mergesignal` repo dogfood:** [`.github/workflows/mergesignal-scan.yml`](./.github/workflows/mergesignal-scan.yml) runs **`scan_profile: trusted`** on **`push` to `main`** and **`workflow_dispatch`** only (not on pull requests). Missing `MERGESIGNAL_ENGINE_REPO_TOKEN` fails the workflow on `MergeSignal/mergesignal`.

### MergeSignal maintainers: branch protection and ScanResult

**Branch protection / rulesets:** The dogfood workflow check name is derived from workflow `name:` and job `name:` (for example **`MergeSignal Dogfood / Engine validation`**). Before merging workflow renames or trigger changes, inventory **required status checks**, **rulesets**, and **merge queue** on the default branch; remove or update entries that pointed at an **obsolete** check so merges are not blocked.

**Reading stored `ScanResult`:** [docs/engineering/scanresult-debug.md](./docs/engineering/scanresult-debug.md). **Post-merge verification list:** [docs/engineering/post-change-e2e-checklist.md](./docs/engineering/post-change-e2e-checklist.md).

**API / worker note:** Production workers load the real engine from the baked-in image path (`file:/app/engine/dist/index.js`). `MERGESIGNAL_TRUSTED_ANALYSIS` is primarily for CLI and CI scan paths; see [Worker engine integration](#worker-engine-integration).

### Secrets Management Best Practices

For production, consider using:

- **AWS Secrets Manager**: Store sensitive values in AWS Secrets Manager
- **External Secrets Operator**: Sync secrets from AWS to Kubernetes
- **Sealed Secrets**: Encrypt secrets in Git

Example with AWS Secrets Manager:

```bash
# Store database password
aws secretsmanager create-secret \
  --name mergesignal/db-password \
  --secret-string "YOUR_STRONG_PASSWORD"

# Reference in Kubernetes using External Secrets
```

## Monitoring and Logging

### Recommended Tools

1. **Prometheus + Grafana**: Metrics and dashboards
2. **CloudWatch**: AWS-native monitoring
3. **ELK Stack or CloudWatch Logs**: Centralized logging
4. **Sentry**: Error tracking - set optional `SENTRY_DSN` and `SENTRY_TRACES_SAMPLE_RATE` on the API (`apps/api`), web server (`apps/web` `instrumentation.ts`), and worker (`apps/worker`).

### Setting up CloudWatch Container Insights

```bash
# Install CloudWatch agent
kubectl apply -f https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/quickstart/cwagent-fluentd-quickstart.yaml
```

### Application Metrics

The API exposes a `/health` endpoint for health checks. Consider adding:

- `/metrics` endpoint for Prometheus
- Structured logging (JSON format)
- Request tracing (OpenTelemetry)

## Backup and Disaster Recovery

### Database Backups

RDS automated backups are enabled by default (7-day retention).

**Manual backup**:

```bash
aws rds create-db-snapshot \
  --db-instance-identifier mergesignal-postgres \
  --db-snapshot-identifier mergesignal-manual-backup-$(date +%Y%m%d)
```

**Restore from snapshot**:

```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier mergesignal-postgres-restored \
  --db-snapshot-identifier mergesignal-manual-backup-20260316
```

### Application State

- **Redis**: Ephemeral data (job queue) - no backup needed
- **PostgreSQL**: All persistent data - backup required

### Disaster Recovery Plan

1. **Database**: Restore from RDS snapshot
2. **Infrastructure**: Re-apply Terraform configuration
3. **Application**: Re-deploy from container registry
4. **DNS**: Update Route53 records if needed

**RTO (Recovery Time Objective)**: ~30 minutes
**RPO (Recovery Point Objective)**: ~5 minutes (RDS automated backups)

## Security Considerations

### Network Security

- All application services run in private subnets
- Only ingress controller is publicly accessible
- Security groups restrict traffic between services
- VPC endpoints for AWS services (optional)

### Application Security

- API requires authentication for all non-public endpoints
- Use HTTPS everywhere (TLS termination at ingress)
- Regularly update dependencies
- Enable pod security policies

### Secrets Management

- Never commit secrets to Git
- Rotate credentials regularly
- Use AWS IAM roles for service accounts (IRSA)
- Enable encryption at rest (RDS, Redis, ECR)

### Compliance

- Enable CloudTrail for audit logging
- Configure VPC Flow Logs
- Set up GuardDuty for threat detection
- Regular security assessments

## Troubleshooting

### Common Issues

#### Pods Not Starting

```bash
kubectl describe pod POD_NAME -n mergesignal
kubectl logs POD_NAME -n mergesignal
```

Common causes:

- Image pull errors (check ECR permissions)
- Configuration errors (check ConfigMap/Secrets)
- Resource limits (check node resources)

#### Database Connection Issues

```bash
# Test database connectivity from a pod
kubectl run -it --rm debug --image=postgres:16 --restart=Never -n mergesignal -- \
  psql postgresql://mergesignal:PASSWORD@postgres-service:5432/mergesignal
```

Common causes:

- Incorrect DATABASE_URL in secrets
- Security group rules blocking traffic
- Database not ready yet

#### Worker Not Processing Jobs

```bash
# Check worker logs
kubectl logs -f deployment/worker -n mergesignal

# Check Redis connectivity
kubectl run -it --rm redis-test --image=redis:7 --restart=Never -n mergesignal -- \
  redis-cli -h redis-service ping
```

Common causes:

- Redis connection issues
- Worker crashes (check logs)
- Queue configuration mismatch

#### Ingress Not Working

```bash
# Check ingress status
kubectl describe ingress mergesignal-ingress -n mergesignal

# Check ingress controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
```

Common causes:

- DNS not pointing to load balancer
- TLS certificate issues
- Ingress controller not installed

### Getting Help

1. Check pod logs: `kubectl logs POD_NAME -n mergesignal`
2. Check events: `kubectl get events -n mergesignal --sort-by='.lastTimestamp'`
3. Check resource usage: `kubectl top pods -n mergesignal`
4. Review application logs in CloudWatch
5. Contact DevOps team or open an issue

## Cost Optimization

### Current Cost Estimate

- EKS cluster: ~$73/month
- EC2 nodes (t3.medium x2): ~$60/month
- RDS (db.t3.micro): ~$15/month
- ElastiCache (cache.t3.micro): ~$12/month
- NAT Gateway (x2): ~$65/month
- **Total**: ~$225-250/month

### Optimization Strategies

1. **Use Spot Instances** for EKS nodes (50-70% savings)
2. **Right-size instances** based on actual usage
3. **Use Fargate** for worker pods (pay per use)
4. **Single NAT Gateway** (non-HA) for dev/staging
5. **Reserved Instances** for predictable workloads (40-60% savings)
6. **Aurora Serverless** instead of RDS for variable loads

## Maintenance

### Regular Tasks

- **Weekly**: Review CloudWatch metrics and logs
- **Monthly**: Check for security updates, rotate credentials
- **Quarterly**: Review and optimize costs, update dependencies
- **Yearly**: Disaster recovery drill, security audit

### Updating the Application

```bash
# Build new images
docker build -t $ECR_API:v1.1.0 -f apps/api/Dockerfile .
docker push $ECR_API:v1.1.0

# Update deployment
kubectl set image deployment/api api=$ECR_API:v1.1.0 -n mergesignal

# Watch rollout
kubectl rollout status deployment/api -n mergesignal
```

### Scaling

```bash
# Scale deployments
kubectl scale deployment api --replicas=3 -n mergesignal
kubectl scale deployment worker --replicas=4 -n mergesignal

# Scale EKS nodes (via Terraform)
terraform apply -var="eks_desired_size=3"
```

## Next Steps

- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure CloudWatch alarms
- [ ] Implement automated backups
- [ ] Set up log aggregation
- [ ] Configure autoscaling policies
- [ ] Document runbook for incidents
- [ ] Set up staging environment
- [ ] Implement blue-green deployments
- [ ] Add performance testing
- [ ] Create disaster recovery plan document

## Additional Resources

- [Kubernetes Documentation](k8s/README.md)
- [Terraform Documentation](terraform/README.md)
- [AWS EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

### Web sign-in flow (Auth.js v5)

Browser sign-in uses the wrapper route with relative redirectTo. Set AUTH_DEBUG in development.
