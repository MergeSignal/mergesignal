# Terraform Infrastructure for MergeSignal

AWS infrastructure for self-hosting MergeSignal on EKS. **Start with the decision tree:** [docs/self-host/overview.md](../docs/self-host/overview.md).

This directory provisions:

- **VPC** with public and private subnets
- **EKS cluster** for Kubernetes workloads
- **RDS PostgreSQL** and **ElastiCache Redis**
- **ECR repositories** for Docker images

## Quick start

1. Copy and edit `terraform.tfvars` from `terraform.tfvars.example`
2. `terraform init && terraform plan && terraform apply`
3. Configure kubectl: `aws eks update-kubeconfig --region <region> --name mergesignal`
4. Build and push images to ECR; deploy with [k8s/](../k8s/README.md)

See [docs/self-host/aws-kubernetes.md](../docs/self-host/aws-kubernetes.md) for the full path.

## Outputs

```bash
terraform output rds_endpoint
terraform output redis_endpoint
terraform output ecr_repository_api
terraform output ecr_repository_worker
terraform output ecr_repository_web
```

Update `k8s/secret.yaml` with database and Redis URLs from these outputs.

## Cost estimate

Default configuration is roughly **$225–250/month** (EKS control plane, two t3.medium nodes, db.t3.micro RDS, cache.t3.micro Redis, NAT gateways). Reduce node count or use a single NAT for non-production.

## Cleanup

```bash
terraform destroy
```

**Warning:** destroys all resources including databases. Back up first.

## More

- [Kubernetes manifests](../k8s/README.md)
- [Self-host overview](../docs/self-host/overview.md)
- [DEPLOYMENT.md](../DEPLOYMENT.md)
