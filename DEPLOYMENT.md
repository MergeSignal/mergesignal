# Production Deployment Guide

This guide covers deploying RepoSentinel to production using Docker, Kubernetes, and AWS infrastructure.

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

RepoSentinel is deployed as a microservices architecture on Kubernetes, with the following components:

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
project_name   = "reposentinel"
db_username    = "reposentinel"
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
aws eks update-kubeconfig --region us-east-1 --name reposentinel

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
  DATABASE_URL: "postgresql://reposentinel:PASSWORD@RDS_ENDPOINT/reposentinel?schema=public"
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
  CORS_ORIGINS: "https://your-domain.com"
  # ... other configs
```

### Step 4: Update Deployment Image References

Edit deployment files to use your ECR URLs:

`k8s/api-deployment.yaml`:
```yaml
image: YOUR_ECR_REGISTRY/reposentinel/api:latest
```

`k8s/worker-deployment.yaml`:
```yaml
image: YOUR_ECR_REGISTRY/reposentinel/worker:latest
```

`k8s/web-deployment.yaml`:
```yaml
image: YOUR_ECR_REGISTRY/reposentinel/web:latest
```

### Step 5: Update Ingress Configuration

Edit `k8s/ingress.yaml`:

```yaml
spec:
  tls:
  - hosts:
    - your-domain.com
    - api.your-domain.com
  rules:
  - host: your-domain.com
    # ...
  - host: api.your-domain.com
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
kubectl wait --for=condition=ready pod -l app=postgres -n reposentinel --timeout=300s

# Deploy applications
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/worker-deployment.yaml
kubectl apply -f k8s/web-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

### Step 7: Verify Deployment

```bash
# Check pod status
kubectl get pods -n reposentinel

# Check services
kubectl get services -n reposentinel

# Check ingress
kubectl get ingress -n reposentinel

# View logs
kubectl logs -f deployment/api -n reposentinel
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
          "token.actions.githubusercontent.com:sub": "repo:your-org/reposentinel:ref:refs/heads/main"
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

### Secrets Management Best Practices

For production, consider using:

- **AWS Secrets Manager**: Store sensitive values in AWS Secrets Manager
- **External Secrets Operator**: Sync secrets from AWS to Kubernetes
- **Sealed Secrets**: Encrypt secrets in Git

Example with AWS Secrets Manager:

```bash
# Store database password
aws secretsmanager create-secret \
  --name reposentinel/db-password \
  --secret-string "YOUR_STRONG_PASSWORD"

# Reference in Kubernetes using External Secrets
```

## Monitoring and Logging

### Recommended Tools

1. **Prometheus + Grafana**: Metrics and dashboards
2. **CloudWatch**: AWS-native monitoring
3. **ELK Stack or CloudWatch Logs**: Centralized logging
4. **Sentry**: Error tracking

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
  --db-instance-identifier reposentinel-postgres \
  --db-snapshot-identifier reposentinel-manual-backup-$(date +%Y%m%d)
```

**Restore from snapshot**:
```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier reposentinel-postgres-restored \
  --db-snapshot-identifier reposentinel-manual-backup-20260316
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
kubectl describe pod POD_NAME -n reposentinel
kubectl logs POD_NAME -n reposentinel
```

Common causes:
- Image pull errors (check ECR permissions)
- Configuration errors (check ConfigMap/Secrets)
- Resource limits (check node resources)

#### Database Connection Issues

```bash
# Test database connectivity from a pod
kubectl run -it --rm debug --image=postgres:16 --restart=Never -n reposentinel -- \
  psql postgresql://reposentinel:PASSWORD@postgres-service:5432/reposentinel
```

Common causes:
- Incorrect DATABASE_URL in secrets
- Security group rules blocking traffic
- Database not ready yet

#### Worker Not Processing Jobs

```bash
# Check worker logs
kubectl logs -f deployment/worker -n reposentinel

# Check Redis connectivity
kubectl run -it --rm redis-test --image=redis:7 --restart=Never -n reposentinel -- \
  redis-cli -h redis-service ping
```

Common causes:
- Redis connection issues
- Worker crashes (check logs)
- Queue configuration mismatch

#### Ingress Not Working

```bash
# Check ingress status
kubectl describe ingress reposentinel-ingress -n reposentinel

# Check ingress controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
```

Common causes:
- DNS not pointing to load balancer
- TLS certificate issues
- Ingress controller not installed

### Getting Help

1. Check pod logs: `kubectl logs POD_NAME -n reposentinel`
2. Check events: `kubectl get events -n reposentinel --sort-by='.lastTimestamp'`
3. Check resource usage: `kubectl top pods -n reposentinel`
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
kubectl set image deployment/api api=$ECR_API:v1.1.0 -n reposentinel

# Watch rollout
kubectl rollout status deployment/api -n reposentinel
```

### Scaling

```bash
# Scale deployments
kubectl scale deployment api --replicas=3 -n reposentinel
kubectl scale deployment worker --replicas=4 -n reposentinel

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
