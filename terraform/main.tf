terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # Recommended: Use remote backend for production
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "reposentinel/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-state-lock"
  # }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "RepoSentinel"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
