# Kubernetes Manifests for MergeSignal

Kubernetes deployment for self-hosted MergeSignal. **Start here:** [docs/self-host/overview.md](../docs/self-host/overview.md) and [docs/self-host/aws-kubernetes.md](../docs/self-host/aws-kubernetes.md).

## Files

- `namespace.yaml`, `configmap.yaml`, `secret.yaml`
- `postgres.yaml`, `redis.yaml`
- `api-deployment.yaml`, `worker-deployment.yaml`, `web-deployment.yaml`
- `ingress.yaml`

## Prerequisites

- Running Kubernetes cluster (e.g. EKS from [terraform/](../terraform/README.md))
- Ingress controller and TLS (optional cert-manager)
- Docker images in your registry
- **Production worker image with proprietary engine** — OSS stub is for local dev only; see [packages/engine-stub/README.md](../packages/engine-stub/README.md)

## Deploy

1. Update `k8s/secret.yaml` (`DATABASE_URL`, `REDIS_URL`, GitHub App credentials)
2. Update `k8s/configmap.yaml` (`CORS_ORIGINS` — use your web URL, not Fly hostnames unless applicable)
3. Update image references in deployment files
4. Apply manifests in order (see [docs/self-host/aws-kubernetes.md](../docs/self-host/aws-kubernetes.md))

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
# ... postgres, redis, then app deployments and ingress
```

## Migrations

API runs migrations on startup when `MERGESIGNAL_AUTO_MIGRATE=1`. Manual:

```bash
kubectl exec -it deployment/api -n mergesignal -- node apps/api/dist/migrateCli.js
```

## Production notes

Prefer managed PostgreSQL and Redis over in-cluster StatefulSets for production. Use external secrets management. Scale API and worker replicas based on load.

## More

- [Terraform](../terraform/README.md)
- [Self-host overview](../docs/self-host/overview.md)
- [DEPLOYMENT.md](../DEPLOYMENT.md)
