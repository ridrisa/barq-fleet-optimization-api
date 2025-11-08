# ================================================================
# BARQ Fleet Management - Terraform Variables
# ================================================================

# ================================================================
# Project Configuration
# ================================================================

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "barq"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone"
  type        = string
  default     = "us-central1-a"
}

variable "app_version" {
  description = "Application version"
  type        = string
  default     = "1.0.0"
}

# ================================================================
# Networking
# ================================================================

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_cidr" {
  description = "Subnet CIDR block"
  type        = string
  default     = "10.0.1.0/24"
}

variable "enable_nat_gateway" {
  description = "Enable Cloud NAT for private instances"
  type        = bool
  default     = true
}

variable "enable_cloud_armor" {
  description = "Enable Cloud Armor for DDoS protection"
  type        = bool
  default     = false
}

# ================================================================
# Database Configuration
# ================================================================

variable "database_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "POSTGRES_15"
}

variable "database_tier" {
  description = "Cloud SQL machine type"
  type        = string
  default     = "db-f1-micro"  # dev: db-f1-micro, prod: db-n1-standard-2
}

variable "database_disk_size" {
  description = "Database disk size in GB"
  type        = number
  default     = 20
}

variable "database_disk_type" {
  description = "Database disk type (PD_SSD or PD_HDD)"
  type        = string
  default     = "PD_SSD"
}

variable "database_name" {
  description = "Database name"
  type        = string
  default     = "barq_logistics"
}

variable "database_user" {
  description = "Database user"
  type        = string
  default     = "barq_user"
}

variable "database_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "enable_database_backup" {
  description = "Enable automated database backups"
  type        = bool
  default     = true
}

variable "database_backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

variable "enable_database_ha" {
  description = "Enable high availability for database"
  type        = bool
  default     = false
}

variable "enable_database_read_replicas" {
  description = "Enable read replicas for database"
  type        = bool
  default     = false
}

variable "database_replica_count" {
  description = "Number of read replicas"
  type        = number
  default     = 2
}

# ================================================================
# Redis Configuration
# ================================================================

variable "redis_memory_size_gb" {
  description = "Redis memory size in GB"
  type        = number
  default     = 1
}

variable "redis_tier" {
  description = "Redis tier (BASIC or STANDARD_HA)"
  type        = string
  default     = "BASIC"
}

variable "redis_version" {
  description = "Redis version"
  type        = string
  default     = "REDIS_7_0"
}

variable "redis_enable_auth" {
  description = "Enable Redis AUTH"
  type        = bool
  default     = true
}

# ================================================================
# Backend Service Configuration
# ================================================================

variable "backend_container_image" {
  description = "Backend container image"
  type        = string
}

variable "backend_cpu_limit" {
  description = "Backend CPU limit"
  type        = string
  default     = "1"
}

variable "backend_memory_limit" {
  description = "Backend memory limit"
  type        = string
  default     = "512Mi"
}

variable "backend_min_instances" {
  description = "Minimum number of backend instances"
  type        = number
  default     = 0
}

variable "backend_max_instances" {
  description = "Maximum number of backend instances"
  type        = number
  default     = 10
}

# ================================================================
# CVRP Service Configuration
# ================================================================

variable "cvrp_container_image" {
  description = "CVRP optimizer container image"
  type        = string
}

variable "cvrp_cpu_limit" {
  description = "CVRP CPU limit"
  type        = string
  default     = "2"
}

variable "cvrp_memory_limit" {
  description = "CVRP memory limit"
  type        = string
  default     = "2Gi"
}

variable "cvrp_min_instances" {
  description = "Minimum number of CVRP instances"
  type        = number
  default     = 0
}

variable "cvrp_max_instances" {
  description = "Maximum number of CVRP instances"
  type        = number
  default     = 5
}

# ================================================================
# Frontend Service Configuration
# ================================================================

variable "frontend_container_image" {
  description = "Frontend container image"
  type        = string
}

variable "frontend_cpu_limit" {
  description = "Frontend CPU limit"
  type        = string
  default     = "1"
}

variable "frontend_memory_limit" {
  description = "Frontend memory limit"
  type        = string
  default     = "512Mi"
}

variable "frontend_min_instances" {
  description = "Minimum number of frontend instances"
  type        = number
  default     = 0
}

variable "frontend_max_instances" {
  description = "Maximum number of frontend instances"
  type        = number
  default     = 10
}

# ================================================================
# Load Balancer Configuration
# ================================================================

variable "enable_cdn" {
  description = "Enable Cloud CDN"
  type        = bool
  default     = false
}

variable "enable_ssl" {
  description = "Enable SSL/TLS"
  type        = bool
  default     = false
}

variable "ssl_domains" {
  description = "Domains for SSL certificate"
  type        = list(string)
  default     = []
}

variable "enable_iap" {
  description = "Enable Identity-Aware Proxy"
  type        = bool
  default     = false
}

# ================================================================
# Monitoring & Alerting
# ================================================================

variable "alert_email" {
  description = "Email for alerts"
  type        = string
}

variable "enable_uptime_checks" {
  description = "Enable uptime checks"
  type        = bool
  default     = true
}

variable "enable_log_based_alerts" {
  description = "Enable log-based alerts"
  type        = bool
  default     = true
}

variable "enable_analytics" {
  description = "Enable analytics"
  type        = bool
  default     = false
}

# ================================================================
# Secrets
# ================================================================

variable "openai_api_key_secret_id" {
  description = "Secret Manager ID for OpenAI API key"
  type        = string
  default     = ""
}

variable "anthropic_api_key_secret_id" {
  description = "Secret Manager ID for Anthropic API key"
  type        = string
  default     = ""
}

variable "mapbox_token_secret_id" {
  description = "Secret Manager ID for Mapbox token"
  type        = string
  default     = ""
}

# ================================================================
# Storage
# ================================================================

variable "backup_retention_days" {
  description = "Number of days to retain backups in Cloud Storage"
  type        = number
  default     = 30
}
