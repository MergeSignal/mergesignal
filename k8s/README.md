# Kubernetes Manifests for RepoSentinel

This directory contains Kubernetes manifests for deploying RepoSentinel to a production Kubernetes cluster.

## Files

- `namespace.yaml` - Creates the reposentinel namespace
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
- Update `CORS_ORIGINS` with your production domain

**k8s/ingress.yaml:**
- Replace `your-domain.com` with your actual domain
- Replace `api.your-domain.com` with your API subdomain

### 2. Build and Push Docker Images

```bash
# Build images
docker build -t your-registry/reposentinel-api:latest -f apps/api/Dockerfile .
docker build -t your-registry/reposentinel-worker:latest -f apps/worker/Dockerfile .
docker build -t your-registry/reposentinel-web:latest -f apps/web/Dockerfile .

# Push to registry
docker push your-registry/reposentinel-api:latest
docker push your-registry/reposentinel-worker:latest
docker push your-registry/reposentinel-web:latest
```

### 3. Update Image References

Update the image references in the deployment files:
- `api-deployment.yaml`: `image: your-registry/reposentinel-api:latest`
- `worker-deployment.yaml`: `image: your-registry/reposentinel-worker:latest`
- `web-deployment.yaml`: `image: your-registry/reposentinel-web:latest`

### 4. Deploy to Kubernetes

```bash
# Apply manifests in order
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml

# Wait for database to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n reposentinel --timeout=300s

# Deploy application services
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/worker-deployment.yaml
kubectl apply -f k8s/web-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

### 5. Verify Deployment

```bash
# Check pod status
kubectl get pods -n reposentinel

# Check services
kubectl get services -n reposentinel

# Check ingress
kubectl get ingress -n reposentinel

# View logs
kubectl logs -f deployment/api -n reposentinel
kubectl logs -f deployment/worker -n reposentinel
kubectl logs -f deployment/web -n reposentinel
```

## Scaling

### Scale API replicas
```bash
kubectl scale deployment api --replicas=3 -n reposentinel
```

### Scale Worker replicas
```bash
kubectl scale deployment worker --replicas=4 -n reposentinel
```

## Database Migrations

The API service will automatically run migrations on startup when `REPOSENTINEL_AUTO_MIGRATE=1` is set.

To run migrations manually:
```bash
kubectl exec -it deployment/api -n reposentinel -- node apps/api/dist/migrateCli.js
```

## Monitoring

Monitor your deployment:

```bash
# Watch pod status
kubectl get pods -n reposentinel -w

# View resource usage
kubectl top pods -n reposentinel

# Check events
kubectl get events -n reposentinel --sort-by='.lastTimestamp'
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
