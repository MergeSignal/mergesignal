# Kubernetes Manifests for MergeSignal

This directory contains Kubernetes manifests for deploying MergeSignal to a production Kubernetes cluster.

## Files

- `namespace.yaml` - Creates the mergesignal namespace
- `configmap.yaml` - Application configuration
- `secret.yaml` - Sensitive configuration (DATABASE_URL, REDIS_URL, etc.)
- `postgres.yaml` - PostgreSQL StatefulSet and Service
- `redis.yaml` - Redis Deployment and Service
- `api-deployment.yaml` - API service deployment and service
- `worker-deployment.yaml` - Worker deployment
- `web-deployment.yaml` - Web UI deployment and service
- `ingress.yaml` - Ingress configuration for external access

## Prerequisites

1. A running Kubernetes cluster
2. `kubectl` configured to access your cluster
3. An ingress controller (e.g., nginx-ingress)
4. cert-manager for TLS certificates (optional)
5. A storage class for persistent volumes

## Deployment Steps

### 1. Update Secrets

Before deploying, update the following files with your production values:

**k8s/secret.yaml:**

- `DATABASE_URL` - Production database connection string
- `REDIS_URL` - Production Redis connection string
- GitHub App credentials (if using)

**k8s/postgres.yaml:**

- Update `postgres-credentials` secret with a secure password

**k8s/configmap.yaml:**

- `CORS_ORIGINS` is set for the Fly web app: `https://mergesignal-web.fly.dev` (adjust if you use a custom domain)

**k8s/ingress.yaml:**

- Hosts are set to `mergesignal-web.fly.dev` and `mergesignal-api.fly.dev` to match the public Fly apps (change for self-hosted domains)

### 2. Build and Push Docker Images

```bash
# Build images
docker build -t your-registry/mergesignal-api:latest -f apps/api/Dockerfile .
docker build -t your-registry/mergesignal-worker:latest -f apps/worker/Dockerfile .
docker build -t your-registry/mergesignal-web:latest -f apps/web/Dockerfile .

# Push to registry
docker push your-registry/mergesignal-api:latest
docker push your-registry/mergesignal-worker:latest
docker push your-registry/mergesignal-web:latest
```

### 3. Update Image References

Update the image references in the deployment files:

- `api-deployment.yaml`: `image: your-registry/mergesignal-api:latest`
- `worker-deployment.yaml`: `image: your-registry/mergesignal-worker:latest`
- `web-deployment.yaml`: `image: your-registry/mergesignal-web:latest`

### 4. Deploy to Kubernetes

```bash
# Apply manifests in order
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml

# Wait for database to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n mergesignal --timeout=300s

# Deploy application services
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/worker-deployment.yaml
kubectl apply -f k8s/web-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

### 5. Verify Deployment

```bash
# Check pod status
kubectl get pods -n mergesignal

# Check services
kubectl get services -n mergesignal

# Check ingress
kubectl get ingress -n mergesignal

# View logs
kubectl logs -f deployment/api -n mergesignal
kubectl logs -f deployment/worker -n mergesignal
kubectl logs -f deployment/web -n mergesignal
```

## Scaling

### Scale API replicas

```bash
kubectl scale deployment api --replicas=3 -n mergesignal
```

### Scale Worker replicas

```bash
kubectl scale deployment worker --replicas=4 -n mergesignal
```

## Database Migrations

The API service will automatically run migrations on startup when `MERGESIGNAL_AUTO_MIGRATE=1` is set.

To run migrations manually:

```bash
kubectl exec -it deployment/api -n mergesignal -- node apps/api/dist/migrateCli.js
```

## Monitoring

Monitor your deployment:

```bash
# Watch pod status
kubectl get pods -n mergesignal -w

# View resource usage
kubectl top pods -n mergesignal

# Check events
kubectl get events -n mergesignal --sort-by='.lastTimestamp'
```

## Production Considerations

1. **Database**: Consider using a managed PostgreSQL service (AWS RDS, Google Cloud SQL, Azure Database) instead of running PostgreSQL in the cluster
2. **Redis**: Consider using a managed Redis service (AWS ElastiCache, Google Memorystore, Azure Cache for Redis)
3. **Secrets Management**: Use external secrets management (AWS Secrets Manager, HashiCorp Vault, etc.)
4. **Backups**: Set up automated database backups
5. **Monitoring**: Integrate with your monitoring stack (Prometheus, Grafana, Datadog, etc.)
6. **Logging**: Configure centralized logging (ELK stack, CloudWatch, etc.)
7. **Resource Limits**: Adjust resource requests/limits based on your workload
8. **High Availability**: Increase replica counts for production workloads
9. **Network Policies**: Add NetworkPolicy resources for security
10. **Pod Security**: Add PodSecurityPolicy or Pod Security Standards
