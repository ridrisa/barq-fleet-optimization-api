# BARQ Fleet Management - Terraform Infrastructure as Code

## Overview

This directory contains Terraform configurations for deploying the BARQ Fleet Management system on Google Cloud Platform (GCP). Infrastructure is managed as code for consistency, repeatability, and version control.

---

## 📁 Directory Structure

```
terraform/
├── main.tf                    # Root module - orchestrates all infrastructure
├── variables.tf               # Variable definitions
├── outputs.tf                 # Output values
├── modules/                   # Reusable Terraform modules
│   ├── networking/            # VPC, subnets, NAT gateway
│   ├── database/              # Cloud SQL PostgreSQL
│   ├── redis/                 # Memorystore Redis
│   ├── cloud_run/             # Cloud Run services
│   ├── load_balancer/         # Global load balancer
│   └── monitoring/            # Cloud Monitoring & Logging
└── environments/              # Environment-specific configurations
    ├── dev/
    │   └── terraform.tfvars
    ├── staging/
    │   └── terraform.tfvars
    └── production/
        └── terraform.tfvars
```

---

## 🏗️ Infrastructure Components

### 1. **Networking** (VPC, Subnets, NAT)
- Custom VPC network
- Private subnet for backend services
- Cloud NAT for outbound internet access
- VPC Connector for Cloud Run
- Cloud Armor (optional - production)

### 2. **Database** (Cloud SQL PostgreSQL)
- PostgreSQL 15
- Automated backups with configurable retention
- High availability (production)
- Read replicas (production)
- Private IP connectivity

### 3. **Cache** (Memorystore Redis)
- Redis 7.0
- Basic tier (dev) or Standard HA (production)
- VPC peering
- AUTH enabled

### 4. **Compute** (Cloud Run)
- **Backend API** - Node.js/Express
- **CVRP Optimizer** - Python/Flask with OR-Tools
- **Frontend** - Next.js
- Auto-scaling based on load
- VPC connectivity for database access

### 5. **Load Balancer** (Global HTTPS)
- Global HTTP(S) load balancer
- SSL/TLS termination
- Cloud CDN (optional)
- Backend service routing

### 6. **Storage** (Cloud Storage)
- Backups bucket with lifecycle rules
- Logs bucket with 90-day retention

### 7. **Monitoring** (Cloud Monitoring)
- Uptime checks
- Log-based alerts
- Performance metrics
- Custom dashboards

### 8. **Secrets** (Secret Manager)
- JWT secrets (auto-generated)
- Database passwords
- API keys (OpenAI, Anthropic, Mapbox)

---

## 🚀 Quick Start

### Prerequisites

1. **Install Terraform**:
```bash
# macOS
brew install terraform

# Or download from https://www.terraform.io/downloads
terraform --version  # Should be >= 1.5.0
```

2. **Install Google Cloud SDK**:
```bash
# macOS
brew install --cask google-cloud-sdk

# Or download from https://cloud.google.com/sdk/docs/install
gcloud --version
```

3. **Authenticate with GCP**:
```bash
gcloud auth login
gcloud auth application-default login
```

4. **Set GCP Project**:
```bash
gcloud config set project barq-fleet-dev
```

5. **Enable Required APIs**:
```bash
gcloud services enable compute.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable redis.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com
gcloud services enable servicenetworking.googleapis.com
```

### Deployment Steps

#### 1. Initialize Terraform

```bash
cd terraform
terraform init
```

#### 2. Plan Infrastructure (Development)

```bash
terraform plan -var-file="environments/dev/terraform.tfvars"
```

#### 3. Apply Infrastructure

```bash
terraform apply -var-file="environments/dev/terraform.tfvars"
```

Type `yes` when prompted to confirm.

#### 4. View Outputs

```bash
terraform output
```

---

## 🌍 Environment Management

### Development

```bash
terraform plan -var-file="environments/dev/terraform.tfvars"
terraform apply -var-file="environments/dev/terraform.tfvars"
```

**Characteristics**:
- Minimal resources (cost-effective)
- No high availability
- No read replicas
- Auto-scaling from 0

### Staging

```bash
terraform plan -var-file="environments/staging/terraform.tfvars"
terraform apply -var-file="environments/staging/terraform.tfvars"
```

**Characteristics**:
- Production-like configuration
- Testing environment
- Moderate resources

### Production

```bash
terraform plan -var-file="environments/production/terraform.tfvars"
terraform apply -var-file="environments/production/terraform.tfvars"
```

**Characteristics**:
- High availability
- Read replicas
- Always-on instances (min_instances > 0)
- Cloud Armor DDoS protection
- Cloud CDN enabled
- Comprehensive monitoring

---

## 🔐 Secrets Management

### Create Secrets in Secret Manager

```bash
# Create secrets first (before running Terraform)
echo -n "your-openai-api-key" | gcloud secrets create barq-dev-openai-key --data-file=-
echo -n "your-anthropic-api-key" | gcloud secrets create barq-dev-anthropic-key --data-file=-
echo -n "your-mapbox-token" | gcloud secrets create barq-dev-mapbox-token --data-file=-
```

### Database Password

Update in tfvars or set via environment variable:
```bash
export TF_VAR_database_password="your-secure-password-here"
```

---

## 📊 State Management

### Local State (Development)

By default, Terraform stores state locally in `terraform.tfstate`.

### Remote State (Production)

For production, use Google Cloud Storage backend:

1. **Create State Bucket**:
```bash
gsutil mb gs://barq-terraform-state
gsutil versioning set on gs://barq-terraform-state
```

2. **Update Backend Configuration** in `main.tf`:
```hcl
terraform {
  backend "gcs" {
    bucket = "barq-terraform-state"
    prefix = "terraform/state/production"
  }
}
```

3. **Initialize with Backend**:
```bash
terraform init -migrate-state
```

---

## 🔄 Common Operations

### Update Infrastructure

```bash
# Make changes to .tf files or tfvars
terraform plan -var-file="environments/dev/terraform.tfvars"
terraform apply -var-file="environments/dev/terraform.tfvars"
```

### Destroy Infrastructure

```bash
# ⚠️ CAUTION: This will delete ALL resources
terraform destroy -var-file="environments/dev/terraform.tfvars"
```

### View Current State

```bash
terraform show
```

### List Resources

```bash
terraform state list
```

### Inspect Resource

```bash
terraform state show module.database.google_sql_database_instance.main
```

### Format Code

```bash
terraform fmt -recursive
```

### Validate Configuration

```bash
terraform validate
```

---

## 🏗️ Module Development

### Creating a New Module

1. Create module directory: `modules/my_module/`
2. Add files:
   - `main.tf` - Resource definitions
   - `variables.tf` - Input variables
   - `outputs.tf` - Output values
   - `README.md` - Module documentation

3. Use in root module:
```hcl
module "my_module" {
  source = "./modules/my_module"

  project_id = var.project_id
  # ... other variables
}
```

### Module Best Practices

- **Single Responsibility**: One module per logical component
- **Reusability**: Make modules environment-agnostic
- **Documentation**: Document all variables and outputs
- **Validation**: Add variable validation rules
- **Examples**: Include usage examples

---

## 🧪 Testing

### Plan without Apply

```bash
terraform plan -var-file="environments/dev/terraform.tfvars" -out=tfplan
```

### Test with Smaller Scope

```bash
terraform plan -target=module.networking
terraform apply -target=module.networking
```

### Verify Resources

```bash
# Check Cloud Run services
gcloud run services list --region us-central1

# Check Cloud SQL instances
gcloud sql instances list

# Check Redis instances
gcloud redis instances list --region us-central1
```

---

## 📈 Cost Management

### Estimate Costs

Use [GCP Pricing Calculator](https://cloud.google.com/products/calculator)

### Development Environment (~$50-100/month)
- Cloud Run: $10-20 (with auto-scaling to 0)
- Cloud SQL (f1-micro): $15-25
- Redis (Basic, 1GB): $15-20
- Networking: $5-10
- Storage: $5-10

### Production Environment (~$300-500/month)
- Cloud Run: $100-150 (always-on instances)
- Cloud SQL (HA + replicas): $150-200
- Redis (Standard HA): $50-70
- Load Balancer: $20-30
- Networking: $10-20
- Storage/Backups: $10-20

### Cost Optimization Tips

1. **Auto-scaling**: Set `min_instances = 0` for dev
2. **Right-sizing**: Use smaller machine types for dev
3. **Scheduled Shutdown**: Stop dev resources after hours
4. **Lifecycle Policies**: Auto-delete old backups/logs
5. **Reserved Instances**: Commit for production (1-3 year terms)

---

## 🔍 Troubleshooting

### Common Issues

**Issue**: "API not enabled"
```bash
# Enable required API
gcloud services enable <api-name>.googleapis.com
```

**Issue**: "Quota exceeded"
```bash
# Check quotas
gcloud compute project-info describe --project=barq-fleet-dev

# Request quota increase in GCP Console
```

**Issue**: "Permission denied"
```bash
# Check IAM permissions
gcloud projects get-iam-policy barq-fleet-dev

# Grant required role
gcloud projects add-iam-policy-binding barq-fleet-dev \
  --member="user:your-email@example.com" \
  --role="roles/editor"
```

**Issue**: "Resource already exists"
```bash
# Import existing resource
terraform import module.database.google_sql_database_instance.main project-id/instance-name
```

**Issue**: "State lock"
```bash
# Force unlock (use with caution)
terraform force-unlock <lock-id>
```

---

## 🛡️ Security Best Practices

1. **Never commit secrets** to version control
2. **Use Secret Manager** for all sensitive data
3. **Enable VPC Service Controls** for production
4. **Use private IPs** for database connectivity
5. **Enable Cloud Armor** for DDoS protection
6. **Implement least privilege IAM**
7. **Enable audit logging**
8. **Rotate secrets regularly**
9. **Use SSL/TLS** for all connections
10. **Enable binary authorization** for containers

---

## 📚 Additional Resources

- [Terraform GCP Provider Docs](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [GCP Best Practices](https://cloud.google.com/architecture/framework)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL Best Practices](https://cloud.google.com/sql/docs/postgres/best-practices)
- [Terraform Best Practices](https://www.terraform.io/docs/cloud/guides/recommended-practices/index.html)

---

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/my-infrastructure-change`
2. Make changes to Terraform files
3. Run `terraform fmt` and `terraform validate`
4. Test in dev environment
5. Submit pull request with plan output
6. Apply after approval

---

## 📞 Support

For infrastructure issues:
- **Email**: infra-team@barqfleet.com
- **Slack**: #infrastructure
- **On-call**: PagerDuty rotation

---

**Last Updated**: 2025-01-07
**Terraform Version**: >= 1.5.0
**GCP Provider Version**: ~> 5.0
