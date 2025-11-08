# ================================================================
# BARQ Fleet Management - Development Environment
# ================================================================

project_id   = "barq-fleet-dev"
environment  = "dev"
project_name = "barq"
region       = "us-central1"
zone         = "us-central1-a"
app_version  = "1.0.0-dev"

# Networking
vpc_cidr             = "10.0.0.0/16"
subnet_cidr          = "10.0.1.0/24"
enable_nat_gateway   = true
enable_cloud_armor   = false

# Database - Development tier
database_version                = "POSTGRES_15"
database_tier                   = "db-f1-micro"
database_disk_size              = 20
database_disk_type              = "PD_SSD"
database_name                   = "barq_logistics_dev"
database_user                   = "barq_user"
database_password               = "CHANGE_ME_IN_PRODUCTION"
enable_database_backup          = true
database_backup_retention_days  = 7
enable_database_ha              = false
enable_database_read_replicas   = false
database_replica_count          = 0

# Redis - Basic tier for dev
redis_memory_size_gb = 1
redis_tier           = "BASIC"
redis_version        = "REDIS_7_0"
redis_enable_auth    = true

# Backend Service - Minimal resources for dev
backend_container_image = "gcr.io/barq-fleet-dev/backend:latest"
backend_cpu_limit       = "1"
backend_memory_limit    = "512Mi"
backend_min_instances   = 0
backend_max_instances   = 3

# CVRP Service - Minimal resources for dev
cvrp_container_image = "gcr.io/barq-fleet-dev/cvrp-optimizer:latest"
cvrp_cpu_limit       = "1"
cvrp_memory_limit    = "1Gi"
cvrp_min_instances   = 0
cvrp_max_instances   = 2

# Frontend Service
frontend_container_image = "gcr.io/barq-fleet-dev/frontend:latest"
frontend_cpu_limit       = "1"
frontend_memory_limit    = "512Mi"
frontend_min_instances   = 0
frontend_max_instances   = 3

# Load Balancer
enable_cdn = false
enable_ssl = false
ssl_domains = []
enable_iap = false

# Monitoring
alert_email              = "dev-alerts@barqfleet.com"
enable_uptime_checks     = true
enable_log_based_alerts  = false
enable_analytics         = false

# Secrets (use Secret Manager IDs)
openai_api_key_secret_id     = "barq-dev-openai-key"
anthropic_api_key_secret_id  = "barq-dev-anthropic-key"
mapbox_token_secret_id       = "barq-dev-mapbox-token"

# Storage
backup_retention_days = 7
