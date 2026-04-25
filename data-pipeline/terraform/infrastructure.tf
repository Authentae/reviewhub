# Terraform Infrastructure for ReviewHub Data Pipeline
# Multi-cloud support with AWS, GCP, and Azure providers

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }

  backend "s3" {
    bucket = "reviewhub-terraform-state"
    key    = "data-pipeline/terraform.tfstate"
    region = "us-east-1"
  }
}

# Variables
variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "reviewhub-pipeline"
}

variable "cloud_provider" {
  description = "Primary cloud provider (aws, gcp, azure)"
  type        = string
  default     = "aws"
}

variable "enable_multi_cloud" {
  description = "Enable multi-cloud deployment"
  type        = bool
  default     = false
}

variable "kafka_cluster_size" {
  description = "Kafka cluster size"
  type        = number
  default     = 3
}

variable "kubernetes_node_count" {
  description = "Kubernetes node count"
  type        = number
  default     = 5
}

variable "data_retention_days" {
  description = "Data retention period in days"
  type        = number
  default     = 90
}

# Locals
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Owner       = "data-engineering"
  }

  name_prefix = "${var.project_name}-${var.environment}"
}

# Data sources
data "aws_availability_zones" "available" {
  count = var.cloud_provider == "aws" ? 1 : 0
  state = "available"
}

data "aws_caller_identity" "current" {
  count = var.cloud_provider == "aws" ? 1 : 0
}

#===============================
# AWS Infrastructure
#===============================

# AWS Provider
provider "aws" {
  region = "us-east-1"
}

# VPC
resource "aws_vpc" "main" {
  count                = var.cloud_provider == "aws" ? 1 : 0
  cidr_block          = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc"
  })
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  count  = var.cloud_provider == "aws" ? 1 : 0
  vpc_id = aws_vpc.main[0].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-igw"
  })
}

# Subnets
resource "aws_subnet" "public" {
  count                   = var.cloud_provider == "aws" ? 3 : 0
  vpc_id                  = aws_vpc.main[0].id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available[0].names[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-${count.index + 1}"
    Type = "public"
  })
}

resource "aws_subnet" "private" {
  count             = var.cloud_provider == "aws" ? 3 : 0
  vpc_id            = aws_vpc.main[0].id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available[0].names[count.index]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-${count.index + 1}"
    Type = "private"
  })
}

# NAT Gateways
resource "aws_eip" "nat" {
  count  = var.cloud_provider == "aws" ? 3 : 0
  domain = "vpc"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nat-eip-${count.index + 1}"
  })
}

resource "aws_nat_gateway" "main" {
  count         = var.cloud_provider == "aws" ? 3 : 0
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nat-${count.index + 1}"
  })

  depends_on = [aws_internet_gateway.main]
}

# Route Tables
resource "aws_route_table" "public" {
  count  = var.cloud_provider == "aws" ? 1 : 0
  vpc_id = aws_vpc.main[0].id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main[0].id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-rt"
  })
}

resource "aws_route_table" "private" {
  count  = var.cloud_provider == "aws" ? 3 : 0
  vpc_id = aws_vpc.main[0].id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-rt-${count.index + 1}"
  })
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count          = var.cloud_provider == "aws" ? 3 : 0
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public[0].id
}

resource "aws_route_table_association" "private" {
  count          = var.cloud_provider == "aws" ? 3 : 0
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# Security Groups
resource "aws_security_group" "eks_cluster" {
  count       = var.cloud_provider == "aws" ? 1 : 0
  name        = "${local.name_prefix}-eks-cluster-sg"
  description = "Security group for EKS cluster"
  vpc_id      = aws_vpc.main[0].id

  ingress {
    from_port = 443
    to_port   = 443
    protocol  = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-eks-cluster-sg"
  })
}

resource "aws_security_group" "kafka" {
  count       = var.cloud_provider == "aws" ? 1 : 0
  name        = "${local.name_prefix}-kafka-sg"
  description = "Security group for Kafka cluster"
  vpc_id      = aws_vpc.main[0].id

  # Kafka broker communication
  ingress {
    from_port   = 9092
    to_port     = 9092
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  # Zookeeper
  ingress {
    from_port   = 2181
    to_port     = 2181
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  # Kafka Connect
  ingress {
    from_port   = 8083
    to_port     = 8083
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-kafka-sg"
  })
}

# EKS Cluster
resource "aws_eks_cluster" "main" {
  count    = var.cloud_provider == "aws" ? 1 : 0
  name     = "${local.name_prefix}-eks"
  role_arn = aws_iam_role.eks_cluster[0].arn
  version  = "1.28"

  vpc_config {
    subnet_ids              = concat(aws_subnet.private[*].id, aws_subnet.public[*].id)
    endpoint_private_access = true
    endpoint_public_access  = true
    security_group_ids      = [aws_security_group.eks_cluster[0].id]
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  encryption_config {
    provider {
      key_arn = aws_kms_key.eks[0].arn
    }
    resources = ["secrets"]
  }

  tags = local.common_tags

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
    aws_iam_role_policy_attachment.eks_vpc_resource_controller,
  ]
}

# EKS Node Group
resource "aws_eks_node_group" "main" {
  count           = var.cloud_provider == "aws" ? 1 : 0
  cluster_name    = aws_eks_cluster.main[0].name
  node_group_name = "${local.name_prefix}-nodes"
  node_role_arn   = aws_iam_role.eks_node_group[0].arn
  subnet_ids      = aws_subnet.private[*].id

  instance_types = ["m6i.xlarge"]
  disk_size      = 100

  scaling_config {
    desired_size = var.kubernetes_node_count
    max_size     = var.kubernetes_node_count * 2
    min_size     = 2
  }

  update_config {
    max_unavailable_percentage = 25
  }

  launch_template {
    id      = aws_launch_template.eks_node_group[0].id
    version = aws_launch_template.eks_node_group[0].latest_version
  }

  tags = local.common_tags

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_container_registry_policy,
  ]
}

# Launch Template for EKS Node Group
resource "aws_launch_template" "eks_node_group" {
  count                   = var.cloud_provider == "aws" ? 1 : 0
  name                    = "${local.name_prefix}-eks-node-template"
  description             = "Launch template for EKS node group"
  update_default_version  = true

  vpc_security_group_ids = [aws_security_group.eks_cluster[0].id]

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = 100
      volume_type           = "gp3"
      iops                  = 3000
      throughput            = 125
      encrypted             = true
      delete_on_termination = true
    }
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  monitoring {
    enabled = true
  }

  tag_specifications {
    resource_type = "instance"
    tags = merge(local.common_tags, {
      Name = "${local.name_prefix}-eks-node"
    })
  }
}

# MSK (Managed Streaming for Kafka)
resource "aws_msk_cluster" "main" {
  count                  = var.cloud_provider == "aws" ? 1 : 0
  cluster_name           = "${local.name_prefix}-kafka"
  kafka_version          = "3.5.1"
  number_of_broker_nodes = var.kafka_cluster_size

  broker_node_group_info {
    instance_type   = "kafka.m5.xlarge"
    client_subnets  = aws_subnet.private[*].id
    security_groups = [aws_security_group.kafka[0].id]

    storage_info {
      ebs_storage_info {
        volume_size = 1000
        provisioned_throughput {
          enabled           = true
          volume_throughput = 250
        }
      }
    }
  }

  encryption_info {
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
    encryption_at_rest_kms_key_id = aws_kms_key.msk[0].arn
  }

  configuration_info {
    arn      = aws_msk_configuration.main[0].arn
    revision = aws_msk_configuration.main[0].latest_revision
  }

  logging_info {
    broker_logs {
      cloudwatch_logs {
        enabled   = true
        log_group = aws_cloudwatch_log_group.msk[0].name
      }
    }
  }

  tags = local.common_tags
}

# MSK Configuration
resource "aws_msk_configuration" "main" {
  count          = var.cloud_provider == "aws" ? 1 : 0
  kafka_versions = ["3.5.1"]
  name           = "${local.name_prefix}-kafka-config"

  server_properties = <<PROPERTIES
auto.create.topics.enable=false
default.replication.factor=3
min.insync.replicas=2
num.partitions=12
offsets.topic.replication.factor=3
transaction.state.log.min.isr=2
transaction.state.log.replication.factor=3
log.retention.hours=168
log.segment.bytes=1073741824
log.retention.check.interval.ms=300000
compression.type=gzip
PROPERTIES
}

# S3 Buckets for Data Lake
resource "aws_s3_bucket" "data_lake" {
  count  = var.cloud_provider == "aws" ? 1 : 0
  bucket = "${local.name_prefix}-data-lake"

  tags = local.common_tags
}

resource "aws_s3_bucket_versioning" "data_lake" {
  count  = var.cloud_provider == "aws" ? 1 : 0
  bucket = aws_s3_bucket.data_lake[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_encryption" "data_lake" {
  count  = var.cloud_provider == "aws" ? 1 : 0
  bucket = aws_s3_bucket.data_lake[0].id

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        kms_master_key_id = aws_kms_key.s3[0].arn
        sse_algorithm     = "aws:kms"
      }
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "data_lake" {
  count  = var.cloud_provider == "aws" ? 1 : 0
  bucket = aws_s3_bucket.data_lake[0].id

  rule {
    id     = "lifecycle"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    expiration {
      days = var.data_retention_days * 365  # Convert years to days
    }
  }
}

# RDS for metadata and monitoring
resource "aws_db_instance" "metadata" {
  count                  = var.cloud_provider == "aws" ? 1 : 0
  identifier             = "${local.name_prefix}-metadata"
  engine                 = "postgres"
  engine_version         = "15.4"
  instance_class         = "db.t3.medium"
  allocated_storage      = 100
  max_allocated_storage  = 1000
  storage_encrypted      = true
  kms_key_id            = aws_kms_key.rds[0].arn

  db_name  = "pipeline_metadata"
  username = "admin"
  password = random_password.db_password.result

  vpc_security_group_ids = [aws_security_group.rds[0].id]
  db_subnet_group_name   = aws_db_subnet_group.main[0].name

  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  skip_final_snapshot = false
  final_snapshot_identifier = "${local.name_prefix}-metadata-final-snapshot"

  tags = local.common_tags
}

resource "aws_db_subnet_group" "main" {
  count      = var.cloud_provider == "aws" ? 1 : 0
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-subnet-group"
  })
}

resource "aws_security_group" "rds" {
  count       = var.cloud_provider == "aws" ? 1 : 0
  name        = "${local.name_prefix}-rds-sg"
  description = "Security group for RDS instance"
  vpc_id      = aws_vpc.main[0].id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-sg"
  })
}

# ElastiCache for caching
resource "aws_elasticache_subnet_group" "main" {
  count      = var.cloud_provider == "aws" ? 1 : 0
  name       = "${local.name_prefix}-cache-subnet-group"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "main" {
  count                      = var.cloud_provider == "aws" ? 1 : 0
  replication_group_id       = "${local.name_prefix}-cache"
  description                = "Redis cluster for pipeline caching"

  port               = 6379
  parameter_group_name = "default.redis7"
  node_type          = "cache.r7g.large"
  num_cache_clusters = 2

  subnet_group_name  = aws_elasticache_subnet_group.main[0].name
  security_group_ids = [aws_security_group.elasticache[0].id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth_token.result

  tags = local.common_tags
}

resource "aws_security_group" "elasticache" {
  count       = var.cloud_provider == "aws" ? 1 : 0
  name        = "${local.name_prefix}-elasticache-sg"
  description = "Security group for ElastiCache"
  vpc_id      = aws_vpc.main[0].id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-elasticache-sg"
  })
}

# IAM Roles and Policies
resource "aws_iam_role" "eks_cluster" {
  count = var.cloud_provider == "aws" ? 1 : 0
  name  = "${local.name_prefix}-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  count      = var.cloud_provider == "aws" ? 1 : 0
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster[0].name
}

resource "aws_iam_role_policy_attachment" "eks_vpc_resource_controller" {
  count      = var.cloud_provider == "aws" ? 1 : 0
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController"
  role       = aws_iam_role.eks_cluster[0].name
}

resource "aws_iam_role" "eks_node_group" {
  count = var.cloud_provider == "aws" ? 1 : 0
  name  = "${local.name_prefix}-eks-node-group-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "eks_worker_node_policy" {
  count      = var.cloud_provider == "aws" ? 1 : 0
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_node_group[0].name
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  count      = var.cloud_provider == "aws" ? 1 : 0
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_node_group[0].name
}

resource "aws_iam_role_policy_attachment" "eks_container_registry_policy" {
  count      = var.cloud_provider == "aws" ? 1 : 0
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_node_group[0].name
}

# KMS Keys
resource "aws_kms_key" "eks" {
  count       = var.cloud_provider == "aws" ? 1 : 0
  description = "KMS key for EKS cluster encryption"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-eks-kms"
  })
}

resource "aws_kms_key" "msk" {
  count       = var.cloud_provider == "aws" ? 1 : 0
  description = "KMS key for MSK cluster encryption"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-msk-kms"
  })
}

resource "aws_kms_key" "s3" {
  count       = var.cloud_provider == "aws" ? 1 : 0
  description = "KMS key for S3 bucket encryption"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-s3-kms"
  })
}

resource "aws_kms_key" "rds" {
  count       = var.cloud_provider == "aws" ? 1 : 0
  description = "KMS key for RDS encryption"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-kms"
  })
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "msk" {
  count             = var.cloud_provider == "aws" ? 1 : 0
  name              = "/aws/msk/${local.name_prefix}-kafka"
  retention_in_days = 30

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "eks" {
  count             = var.cloud_provider == "aws" ? 1 : 0
  name              = "/aws/eks/${local.name_prefix}-eks/cluster"
  retention_in_days = 7

  tags = local.common_tags
}

# Random passwords
resource "random_password" "db_password" {
  length  = 16
  special = true
}

resource "random_password" "redis_auth_token" {
  length  = 32
  special = false
}

# Store passwords in AWS Secrets Manager
resource "aws_secretsmanager_secret" "db_password" {
  count       = var.cloud_provider == "aws" ? 1 : 0
  name        = "${local.name_prefix}-db-password"
  description = "Database password for pipeline metadata"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "db_password" {
  count     = var.cloud_provider == "aws" ? 1 : 0
  secret_id = aws_secretsmanager_secret.db_password[0].id
  secret_string = jsonencode({
    username = "admin"
    password = random_password.db_password.result
    host     = aws_db_instance.metadata[0].endpoint
    dbname   = aws_db_instance.metadata[0].db_name
  })
}

#===============================
# Outputs
#===============================

output "vpc_id" {
  description = "VPC ID"
  value       = var.cloud_provider == "aws" ? aws_vpc.main[0].id : null
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = var.cloud_provider == "aws" ? aws_eks_cluster.main[0].name : null
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = var.cloud_provider == "aws" ? aws_eks_cluster.main[0].endpoint : null
}

output "msk_cluster_arn" {
  description = "MSK cluster ARN"
  value       = var.cloud_provider == "aws" ? aws_msk_cluster.main[0].arn : null
}

output "msk_bootstrap_brokers" {
  description = "MSK bootstrap brokers"
  value       = var.cloud_provider == "aws" ? aws_msk_cluster.main[0].bootstrap_brokers_tls : null
}

output "s3_data_lake_bucket" {
  description = "S3 data lake bucket name"
  value       = var.cloud_provider == "aws" ? aws_s3_bucket.data_lake[0].bucket : null
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = var.cloud_provider == "aws" ? aws_db_instance.metadata[0].endpoint : null
}

output "elasticache_endpoint" {
  description = "ElastiCache endpoint"
  value       = var.cloud_provider == "aws" ? aws_elasticache_replication_group.main[0].primary_endpoint_address : null
}

#===============================
# Multi-Cloud Extensions (GCP)
#===============================

provider "google" {
  project = "reviewhub-pipeline"
  region  = "us-central1"
}

# GKE Cluster (when using GCP)
resource "google_container_cluster" "primary" {
  count    = var.cloud_provider == "gcp" ? 1 : 0
  name     = "${local.name_prefix}-gke"
  location = "us-central1"

  # We can't create a cluster with no node pool defined, but we want to only use
  # separately managed node pools. So we create the smallest possible default
  # node pool and immediately delete it.
  remove_default_node_pool = true
  initial_node_count       = 1

  network    = google_compute_network.vpc[0].name
  subnetwork = google_compute_subnetwork.private[0].name

  ip_allocation_policy {
    cluster_secondary_range_name  = "k8s-pod-range"
    services_secondary_range_name = "k8s-service-range"
  }

  workload_identity_config {
    workload_pool = "${var.project_name}.svc.id.goog"
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.32/28"
  }
}

resource "google_container_node_pool" "primary_nodes" {
  count    = var.cloud_provider == "gcp" ? 1 : 0
  name     = "${local.name_prefix}-node-pool"
  location = "us-central1"
  cluster  = google_container_cluster.primary[0].name

  node_count = var.kubernetes_node_count

  node_config {
    preemptible  = false
    machine_type = "e2-medium"

    service_account = google_service_account.kubernetes[0].email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]
  }

  autoscaling {
    min_node_count = 2
    max_node_count = var.kubernetes_node_count * 2
  }
}

#===============================
# Kubernetes Provider Setup
#===============================

# Configure Kubernetes provider
data "aws_eks_cluster_auth" "main" {
  count = var.cloud_provider == "aws" ? 1 : 0
  name  = aws_eks_cluster.main[0].name
}

provider "kubernetes" {
  host                   = var.cloud_provider == "aws" ? aws_eks_cluster.main[0].endpoint : ""
  cluster_ca_certificate = var.cloud_provider == "aws" ? base64decode(aws_eks_cluster.main[0].certificate_authority[0].data) : ""
  token                  = var.cloud_provider == "aws" ? data.aws_eks_cluster_auth.main[0].token : ""
}

provider "helm" {
  kubernetes {
    host                   = var.cloud_provider == "aws" ? aws_eks_cluster.main[0].endpoint : ""
    cluster_ca_certificate = var.cloud_provider == "aws" ? base64decode(aws_eks_cluster.main[0].certificate_authority[0].data) : ""
    token                  = var.cloud_provider == "aws" ? data.aws_eks_cluster_auth.main[0].token : ""
  }
}