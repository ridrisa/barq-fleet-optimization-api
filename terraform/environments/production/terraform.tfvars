# ================================================================
# BARQ Fleet Management - Production Environment
# ================================================================

project_id   = "barq-fleet-prod"
environment  = "production"
project_name = "barq"
region       = "us-central1"
zone         = "us-central1-a"
app_version  = "1.0.0"

# Networking
vpc_cidr             = "10.10.0.0/16"
subnet_cidr          = "10.10.1.0/24"
enable_nat_gateway   = true
enable_cloud_armor   = true  # Enable DDoS protection

# Database - Production tier with HA
database_version                = "POSTGRES_15"
database_tier                   = "db-n1-standard-2"  # 2 vCPUs, 7.5 GB RAM
database_disk_size              = 100
database_disk_type              = "PD_SSD"
database_name                   = "barq_logistics"
database_user                   = "barq_user"
database_password               = "USE_SECRET_MANAGER"  # Override with actual secret
enable_database_backup          = true
database_backup_retention_days  = 30
enable_database_ha              = true   # High availability
enable_database_read_replicas   = true   # Read replicas
database_replica_count          = 2

# Redis - Standard HA tier for production
redis_memory_size_gb = 5
redis_tier           = "STANDARD_HA"  # High availability
redis_version        = "REDIS_7_0"
redis_enable_auth    = true

# Backend Service - Production resources
backend_container_image = "gcr.io/barq-fleet-prod/backend:1.0.0"
backend_cpu_limit       = "2"
backend_memory_limit    = "1Gi"
backend_min_instances   = 2  # Always-on for production
backend_max_instances   = 20

# CVRP Service - Production resources
cvrp_container_image = "gcr.io/barq-fleet-prod/cvrp-optimizer:1.0.0"
cvrp_cpu_limit       = "2"
cvrp_memory_limit    = "4Gi"
cvrp_min_instances   = 1  # Always-on for production
cvrp_max_instances   = 10

# Frontend Service - Production resources
frontend_container_image = "gcr.io/barq-fleet-prod/frontend:1.0.0"
frontend_cpu_limit       = "1"
frontend_memory_limit    = "512Mi"
frontend_min_instances   = 2  # Always-on for production
frontend_max_instances   = 20

# Load Balancer
enable_cdn  = true
enable_ssl  = true
ssl_domains = ["api.barqfleet.com", "app.barqfleet.com"]
enable_iap  = false  # Enable if using Identity-Aware Proxy

# Monitoring
alert_email              = "ops-alerts@barqfleet.com"
enable_uptime_checks     = true
enable_log_based_alerts  = true
enable_analytics         = true

# Secrets (use Secret Manager IDs - create these first)
openai_api_key_secret_id     = "barq-prod-openai-key"
anthropic_api_key_secret_id  = "barq-prod-anthropic-key"
mapbox_token_secret_id       = "barq-prod-mapbox-token"

# Storage
backup_retention_days = 90
