# AWS / Kubernetes (advanced)

This path is a **reference architecture** for teams that want MergeSignal on AWS EKS with Terraform-provisioned infrastructure. It requires more operational overhead than [Fly.io](./fly.md).

## When to use this path

- You already run production workloads on Kubernetes
- You need AWS-native RDS, ElastiCache, and ECR
- You have staff to operate EKS, ingress, and secrets management

## What's in the repository

| Path                             | Contents                                                            |
| -------------------------------- | ------------------------------------------------------------------- |
| [`terraform/`](../../terraform/) | VPC, EKS, RDS PostgreSQL, ElastiCache Redis, ECR                    |
| [`k8s/`](../../k8s/)             | Kubernetes manifests for API, worker, web, Postgres, Redis, ingress |

## High-level steps

1. Provision infrastructure with Terraform — see [terraform/README.md](../../terraform/README.md)
2. Build and push Docker images to ECR
3. Update `k8s/secret.yaml` and `k8s/configmap.yaml` with your endpoints and domains
4. Apply Kubernetes manifests — see [k8s/README.md](../../k8s/README.md)

## Engine requirement

Production scans require the proprietary analysis engine in the **worker** image. The OSS stub is for local development only. Plan engine access and worker image build before going to production — see [packages/engine-stub/README.md](../../packages/engine-stub/README.md).

## Status

Terraform modules for GCP and Azure are not included. Treat this path as advanced/self-supported unless MergeSignal documents otherwise.

## More

- [Self-host overview](./overview.md)
- [Fly.io](./fly.md) — simpler path for most self-hosters
- [DEPLOYMENT.md](../../DEPLOYMENT.md)
