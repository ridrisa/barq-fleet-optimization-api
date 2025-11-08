#!/bin/bash

# BARQ Fleet Analytics - Database Connection Setup
# This script configures the database password for the Analytics Cloud Run service

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  BARQ Fleet Analytics - Database Connection Setup             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Configuration
PROJECT_ID="looker-barqdata-2030"
SERVICE_NAME="barq-fleet-analytics"
REGION="us-central1"
SECRET_NAME="postgres-password"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}This script will:${NC}"
echo "  1. Prompt for your database password"
echo "  2. Store it securely in Google Secret Manager"
echo "  3. Update Cloud Run service with the secret"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with gcloud${NC}"
    echo "Please run: gcloud auth login"
    exit 1
fi

# Set project
echo -e "${YELLOW}Setting project to ${PROJECT_ID}...${NC}"
gcloud config set project ${PROJECT_ID}

# Prompt for database password
echo ""
echo -e "${YELLOW}Please enter your PostgreSQL database password:${NC}"
read -s DB_PASSWORD
echo ""

if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}Error: Password cannot be empty${NC}"
    exit 1
fi

# Check if secret already exists
echo -e "${YELLOW}Checking if secret exists...${NC}"
if gcloud secrets describe ${SECRET_NAME} --project=${PROJECT_ID} &> /dev/null; then
    echo -e "${YELLOW}Secret already exists. Adding new version...${NC}"
    echo -n "${DB_PASSWORD}" | gcloud secrets versions add ${SECRET_NAME} \
        --data-file=- \
        --project=${PROJECT_ID}
else
    echo -e "${YELLOW}Creating new secret...${NC}"
    echo -n "${DB_PASSWORD}" | gcloud secrets create ${SECRET_NAME} \
        --data-file=- \
        --replication-policy="automatic" \
        --project=${PROJECT_ID}
fi

echo -e "${GREEN}✓ Secret stored successfully${NC}"

# Grant Cloud Run service access to the secret
echo ""
echo -e "${YELLOW}Granting Cloud Run access to secret...${NC}"

# Get the service account email
SERVICE_ACCOUNT=$(gcloud run services describe ${SERVICE_NAME} \
    --region=${REGION} \
    --project=${PROJECT_ID} \
    --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || echo "")

if [ -z "$SERVICE_ACCOUNT" ]; then
    # Use default compute service account
    PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')
    SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
fi

echo "Using service account: ${SERVICE_ACCOUNT}"

gcloud secrets add-iam-policy-binding ${SECRET_NAME} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor" \
    --project=${PROJECT_ID}

echo -e "${GREEN}✓ Access granted${NC}"

# Update Cloud Run service
echo ""
echo -e "${YELLOW}Updating Cloud Run service...${NC}"

gcloud run services update ${SERVICE_NAME} \
    --update-secrets=DB_PASSWORD=${SECRET_NAME}:latest \
    --region=${REGION} \
    --project=${PROJECT_ID}

echo -e "${GREEN}✓ Service updated successfully${NC}"

# Test the connection
echo ""
echo -e "${YELLOW}Testing database connection...${NC}"

SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --region=${REGION} \
    --project=${PROJECT_ID} \
    --format='value(status.url)')

sleep 5  # Wait for service to restart

HEALTH_RESPONSE=$(curl -s "${SERVICE_URL}/health")
DB_STATUS=$(echo $HEALTH_RESPONSE | grep -o '"database":"[^"]*"' | cut -d'"' -f4)

echo "Health check response:"
echo $HEALTH_RESPONSE | jq . 2>/dev/null || echo $HEALTH_RESPONSE

if [ "$DB_STATUS" = "connected" ]; then
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    SUCCESS!                                     ║${NC}"
    echo -e "${GREEN}║  Database connection configured successfully                   ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}✓ Analytics service is now using real database data${NC}"
    echo -e "${GREEN}✓ All endpoints are accessible with live data${NC}"
    echo ""
    echo "Service URL: ${SERVICE_URL}"
    echo ""
    echo "Next steps:"
    echo "  1. Update frontend/.env.local with service URL (already done)"
    echo "  2. Run: cd frontend && npm run dev"
    echo "  3. Visit: http://localhost:3000/analytics"
    echo ""
else
    echo ""
    echo -e "${YELLOW}⚠ Warning: Database status is '${DB_STATUS}'${NC}"
    echo ""
    echo "Possible issues:"
    echo "  - Database password might be incorrect"
    echo "  - Database is not accessible from Cloud Run"
    echo "  - Cloud SQL connection string is incorrect"
    echo ""
    echo "Check Cloud Run logs:"
    echo "  gcloud run logs read ${SERVICE_NAME} --region=${REGION}"
    echo ""
fi

echo ""
echo "Configuration complete!"
echo ""
