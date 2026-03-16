# Terraform Infrastructure for RepoSentinel

This directory contains Terraform configuration for deploying RepoSentinel infrastructure on AWS.

## Architecture

The Terraform configuration creates:

- **VPC** with public and private subnets across multiple availability zones
- **EKS Cluster** for running Kubernetes workloads
- **RDS PostgreSQL** managed database
- **ElastiCache Redis** for job queue
- **ECR Repositories** for Docker images
- **Security Groups** with least-privilege access
- **NAT Gateways** for private subnet internet access

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Terraform >= 1.0 installed
3. kubectl installed for EKS management

## Setup

### 1. Create a `terraform.tfvars` file

```hcl
aws_region     = "us-east-1"
environment    = "production"
project_name   = "reposentinel"

# Database credentials (use strong passwords!)
db_username = "reposentinel"
db_password = "CHANGE_ME_STRONG_PASSWORD"

# EKS configuration
eks_desired_size = 2
eks_min_size     = 1
eks_max_size     = 4

# Domain (optional, for ingress)
domain_name = "your-domain.com"
```

**Important**: Never commit `terraform.tfvars` to version control if it contains sensitive data!

### 2. Initialize Terraform

```bash
cd terraform
terraform init
```

### 3. Review the Plan

```bash
terraform plan
```

Review the resources that will be created.

### 4. Apply the Configuration

```bash
terraform apply
```

Type `yes` to confirm and create the infrastructure.

## Post-Deployment

### Configure kubectl

After the EKS cluster is created, configure kubectl:

```bash
aws eks update-kubeconfig --region us-east-1 --name reposentinel
```

Verify access:

```bash
kubectl get nodes
```

### Get Database Connection Details

```bash
terraform output rds_endpoint
terraform output rds_database_name
```

### Get Redis Connection Details

```bash
terraform output redis_endpoint
terraform output redis_port
```

### Get ECR Repository URLs

```bash
terraform output ecr_repository_api
terraform output ecr_repository_worker
terraform output ecr_repository_web
```

### Update Kubernetes Secrets

Update `k8s/secret.yaml` with the actual values from Terraform outputs:

```yaml
DATABASE_URL: "postgresql://reposentinel:PASSWORD@RDS_ENDPOINT/reposentinel?schema=public"
REDIS_URL: "redis://REDIS_ENDPOINT:6379"
```

## Deployment Workflow

1. **Build and push Docker images to ECR:**

```bash
# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $(terraform output -raw ecr_repository_api | cut -d'/' -f1)

# Build and push
docker build -t $(terraform output -raw ecr_repository_api):latest -f apps/api/Dockerfile .
docker push $(terraform output -raw ecr_repository_api):latest

docker build -t $(terraform output -raw ecr_repository_worker):latest -f apps/worker/Dockerfile .
docker push $(terraform output -raw ecr_repository_worker):latest

docker build -t $(terraform output -raw ecr_repository_web):latest -f apps/web/Dockerfile .
docker push $(terraform output -raw ecr_repository_web):latest
```

2. **Update Kubernetes manifests** with ECR image URLs

3. **Deploy to EKS:**

```bash
kubectl apply -f ../k8s/
```

## Cost Considerations

The default configuration includes:

- EKS cluster (control plane): ~$73/month
- EC2 instances (t3.medium x2): ~$60/month
- RDS PostgreSQL (db.t3.micro): ~$15/month
- ElastiCache Redis (cache.t3.micro): ~$12/month
- NAT Gateways (x2): ~$65/month
- Data transfer and storage: Variable

**Total estimated cost: ~$225-250/month**

To reduce costs:
- Use smaller instance types
- Reduce EKS node count
- Use single availability zone (not recommended for production)
- Use single NAT Gateway

## Scaling

### Scale EKS Node Group

```bash
terraform apply -var="eks_desired_size=3" -var="eks_max_size=6"
```

### Scale Database

```bash
terraform apply -var="db_instance_class=db.t3.small"
```

## Backup and Disaster Recovery

- **RDS**: Automated backups enabled with 7-day retention
- **State**: Use S3 backend with versioning for Terraform state
- **Secrets**: Use AWS Secrets Manager for production credentials

## Security Best Practices

1. **Enable S3 backend** for Terraform state with encryption and locking
2. **Use AWS Secrets Manager** for database passwords and sensitive values
3. **Enable VPC Flow Logs** for network monitoring
4. **Configure CloudWatch** for monitoring and alerting
5. **Enable AWS GuardDuty** for threat detection
6. **Use IAM roles** for service accounts (IRSA) in EKS
7. **Enable pod security policies** in Kubernetes
8. **Regularly rotate** database and Redis credentials

## Monitoring

Add CloudWatch monitoring:

```hcl
# Add to rds.tf
enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
monitoring_interval = 60
monitoring_role_arn = aws_iam_role.rds_monitoring.arn
```

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Warning**: This will delete all resources including databases. Make sure you have backups!

## Troubleshooting

### EKS Cluster Not Accessible

```bash
aws eks update-kubeconfig --region us-east-1 --name reposentinel
```

### RDS Connection Issues

Check security groups:

```bash
aws ec2 describe-security-groups --group-ids $(terraform output -raw rds_security_group_id)
```

### ECR Authentication Issues

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com
```

## Alternative Cloud Providers

For other cloud providers, see:

- **Google Cloud Platform**: `terraform-gcp/` (to be created)
- **Azure**: `terraform-azure/` (to be created)
- **DigitalOcean Kubernetes**: Simpler and more cost-effective for smaller deployments

## Production Checklist

- [ ] Enable S3 backend for Terraform state
- [ ] Configure AWS Secrets Manager
- [ ] Set up CloudWatch monitoring and alarms
- [ ] Enable VPC Flow Logs
- [ ] Configure automated backups
- [ ] Set up AWS WAF for API protection
- [ ] Enable GuardDuty
- [ ] Configure IAM roles for service accounts (IRSA)
- [ ] Set up CI/CD pipeline
- [ ] Document runbook for incident response
- [ ] Configure autoscaling policies
- [ ] Set up log aggregation (CloudWatch Logs Insights or ELK)
