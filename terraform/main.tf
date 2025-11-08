# ================================================================
# BARQ Fleet Management - Main Terraform Configuration
# ================================================================
# This is the root module that orchestrates all infrastructure components
#
# Usage:
#   terraform init
#   terraform plan -var-file="environments/dev/terraform.tfvars"
#   terraform apply -var-file="environments/dev/terraform.tfvars"
#
# ================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Backend configuration for state storage
  # Uncomment and configure for production use
  # backend "gcs" {
  #   bucket = "barq-terraform-state"
  #   prefix = "terraform/state"
  # }
}

# ================================================================
# Provider Configuration
# ================================================================

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# ================================================================
# Local Variables
# ================================================================

locals {
  common_labels = {
    project     = "barq-fleet-management"
    environment = var.environment
    managed_by  = "terraform"
    team        = "engineering"
  }

  resource_prefix = "${var.project_name}-${var.environment}"
}

# ================================================================
# Networking Module
# ================================================================

module "networking" {
  source = "./modules/networking"

  project_id      = var.project_id
  region          = var.region
  resource_prefix = local.resource_prefix
  environment     = var.environment
  labels          = local.common_labels

  vpc_cidr            = var.vpc_cidr
  subnet_cidr         = var.subnet_cidr
  enable_nat_gateway  = var.enable_nat_gateway
  enable_cloud_armor  = var.enable_cloud_armor
}

# ================================================================
# Database Module (Cloud SQL PostgreSQL)
# ================================================================

module "database" {
  source = "./modules/database"

  project_id      = var.project_id
  region          = var.region
  resource_prefix = local.resource_prefix
  environment     = var.environment
  labels          = local.common_labels

  network_id = module.networking.network_id

  # Database configuration
  database_version        = var.database_version
  database_tier           = var.database_tier
  database_disk_size      = var.database_disk_size
  database_disk_type      = var.database_disk_type
  enable_backup           = var.enable_database_backup
  backup_retention_days   = var.database_backup_retention_days
  enable_high_availability = var.enable_database_ha
  enable_read_replicas    = var.enable_database_read_replicas
  replica_count           = var.database_replica_count

  # Database credentials
  database_name     = var.database_name
  database_user     = var.database_user
  database_password = var.database_password
}

# ================================================================
# Redis Module (Memorystore)
# ================================================================

module "redis" {
  source = "./modules/redis"

  project_id      = var.project_id
  region          = var.region
  resource_prefix = local.resource_prefix
  environment     = var.environment
  labels          = local.common_labels

  network_id = module.networking.network_id

  redis_memory_size_gb = var.redis_memory_size_gb
  redis_tier           = var.redis_tier
  redis_version        = var.redis_version
  enable_auth          = var.redis_enable_auth
}

# ================================================================
# Cloud Run Services
# ================================================================

# Backend API Service
module "backend_service" {
  source = "./modules/cloud_run"

  project_id      = var.project_id
  region          = var.region
  resource_prefix = local.resource_prefix
  service_name    = "backend-api"
  environment     = var.environment
  labels          = local.common_labels

  container_image = var.backend_container_image
  container_port  = 3003

  # Resource allocation
  cpu_limit    = var.backend_cpu_limit
  memory_limit = var.backend_memory_limit
  min_instances = var.backend_min_instances
  max_instances = var.backend_max_instances

  # Environment variables
  environment_variables = {
    NODE_ENV                = var.environment
    PORT                    = "3003"
    DATABASE_MODE           = "postgres"
    POSTGRES_HOST           = module.database.instance_connection_name
    POSTGRES_DB             = var.database_name
    POSTGRES_USER           = var.database_user
    POSTGRES_SSL            = "true"
    REDIS_HOST              = module.redis.instance_host
    REDIS_PORT              = module.redis.instance_port
    CVRP_SERVICE_URL        = "http://cvrp-optimizer:5001"
    ENABLE_READ_REPLICAS    = var.enable_database_read_replicas ? "true" : "false"
  }

  # Secret environment variables
  secret_environment_variables = {
    POSTGRES_PASSWORD       = module.database.database_password_secret
    JWT_SECRET              = google_secret_manager_secret_version.jwt_secret.id
    JWT_REFRESH_SECRET      = google_secret_manager_secret_version.jwt_refresh_secret.id
    OPENAI_API_KEY          = var.openai_api_key_secret_id
    ANTHROPIC_API_KEY       = var.anthropic_api_key_secret_id
  }

  vpc_connector_id = module.networking.vpc_connector_id

  depends_on = [
    module.database,
    module.redis
  ]
}

# CVRP Optimizer Service
module "cvrp_service" {
  source = "./modules/cloud_run"

  project_id      = var.project_id
  region          = var.region
  resource_prefix = local.resource_prefix
  service_name    = "cvrp-optimizer"
  environment     = var.environment
  labels          = local.common_labels

  container_image = var.cvrp_container_image
  container_port  = 5001

  # Resource allocation (higher for optimization tasks)
  cpu_limit    = var.cvrp_cpu_limit
  memory_limit = var.cvrp_memory_limit
  min_instances = var.cvrp_min_instances
  max_instances = var.cvrp_max_instances

  # Environment variables
  environment_variables = {
    PORT                = "5001"
    FLASK_ENV           = "production"
    LOG_LEVEL           = "INFO"
    DEFAULT_TIME_LIMIT  = "5"
    MAX_TIME_LIMIT      = "30"
  }

  secret_environment_variables = {}

  vpc_connector_id = module.networking.vpc_connector_id
}

# Frontend Service
module "frontend_service" {
  source = "./modules/cloud_run"

  project_id      = var.project_id
  region          = var.region
  resource_prefix = local.resource_prefix
  service_name    = "frontend"
  environment     = var.environment
  labels          = local.common_labels

  container_image = var.frontend_container_image
  container_port  = 3001

  # Resource allocation
  cpu_limit    = var.frontend_cpu_limit
  memory_limit = var.frontend_memory_limit
  min_instances = var.frontend_min_instances
  max_instances = var.frontend_max_instances

  # Environment variables
  environment_variables = {
    NODE_ENV                         = "production"
    NEXT_PUBLIC_API_URL              = module.backend_service.service_url
    NEXT_PUBLIC_APP_NAME             = "BARQ Fleet Management"
    NEXT_PUBLIC_APP_VERSION          = var.app_version
    NEXT_PUBLIC_ENABLE_ANALYTICS     = var.enable_analytics ? "true" : "false"
  }

  secret_environment_variables = {
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = var.mapbox_token_secret_id
  }

  vpc_connector_id = null  # Frontend doesn't need VPC access
}

# ================================================================
# Load Balancer
# ================================================================

module "load_balancer" {
  source = "./modules/load_balancer"

  project_id      = var.project_id
  resource_prefix = local.resource_prefix
  environment     = var.environment
  labels          = local.common_labels

  backend_service_neg  = module.backend_service.neg_id
  frontend_service_neg = module.frontend_service.neg_id

  enable_cdn       = var.enable_cdn
  enable_ssl       = var.enable_ssl
  ssl_domains      = var.ssl_domains
  enable_iap       = var.enable_iap
}

# ================================================================
# Monitoring & Logging
# ================================================================

module "monitoring" {
  source = "./modules/monitoring"

  project_id      = var.project_id
  resource_prefix = local.resource_prefix
  environment     = var.environment
  labels          = local.common_labels

  # Services to monitor
  backend_service_name  = module.backend_service.service_name
  cvrp_service_name     = module.cvrp_service.service_name
  frontend_service_name = module.frontend_service.service_name
  database_instance_id  = module.database.instance_id
  redis_instance_id     = module.redis.instance_id

  # Alert configuration
  alert_email           = var.alert_email
  enable_uptime_checks  = var.enable_uptime_checks
  enable_log_based_alerts = var.enable_log_based_alerts
}

# ================================================================
# Secret Manager
# ================================================================

# JWT Secret
resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

resource "google_secret_manager_secret" "jwt_secret" {
  project   = var.project_id
  secret_id = "${local.resource_prefix}-jwt-secret"

  labels = local.common_labels

  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = random_password.jwt_secret.result
}

# JWT Refresh Secret
resource "random_password" "jwt_refresh_secret" {
  length  = 64
  special = true
}

resource "google_secret_manager_secret" "jwt_refresh_secret" {
  project   = var.project_id
  secret_id = "${local.resource_prefix}-jwt-refresh-secret"

  labels = local.common_labels

  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret_version" "jwt_refresh_secret" {
  secret      = google_secret_manager_secret.jwt_refresh_secret.id
  secret_data = random_password.jwt_refresh_secret.result
}

# ================================================================
# Cloud Storage (for backups, logs, etc.)
# ================================================================

resource "google_storage_bucket" "backups" {
  project       = var.project_id
  name          = "${local.resource_prefix}-backups"
  location      = var.region
  force_destroy = var.environment != "production"

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = var.backup_retention_days
    }
    action {
      type = "Delete"
    }
  }

  labels = local.common_labels
}

resource "google_storage_bucket" "logs" {
  project       = var.project_id
  name          = "${local.resource_prefix}-logs"
  location      = var.region
  force_destroy = var.environment != "production"

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 90  # Keep logs for 90 days
    }
    action {
      type = "Delete"
    }
  }

  labels = local.common_labels
}

# ================================================================
# IAM Configuration
# ================================================================

# Service account for Cloud Run services
resource "google_service_account" "cloud_run" {
  project      = var.project_id
  account_id   = "${local.resource_prefix}-cloud-run-sa"
  display_name = "Cloud Run Service Account for ${var.environment}"
}

# Grant necessary permissions
resource "google_project_iam_member" "cloud_run_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_project_iam_member" "cloud_run_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_project_iam_member" "cloud_run_storage_admin" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# ================================================================
# Outputs
# ================================================================

output "backend_url" {
  description = "Backend API URL"
  value       = module.backend_service.service_url
}

output "frontend_url" {
  description = "Frontend URL"
  value       = module.frontend_service.service_url
}

output "cvrp_url" {
  description = "CVRP Optimizer URL"
  value       = module.cvrp_service.service_url
}

output "load_balancer_ip" {
  description = "Load Balancer IP Address"
  value       = module.load_balancer.ip_address
}

output "database_connection_name" {
  description = "Cloud SQL Connection Name"
  value       = module.database.instance_connection_name
}

output "redis_host" {
  description = "Redis Instance Host"
  value       = module.redis.instance_host
}

output "backups_bucket" {
  description = "Backups Storage Bucket"
  value       = google_storage_bucket.backups.name
}

output "service_account_email" {
  description = "Cloud Run Service Account Email"
  value       = google_service_account.cloud_run.email
}
