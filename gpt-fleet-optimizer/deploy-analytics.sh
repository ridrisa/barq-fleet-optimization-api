#!/bin/bash

# BARQ Fleet Analytics - GCP Deployment Script
# Deploys Python analytics service to Cloud Run

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}BARQ Fleet Analytics Deployment${NC}"
echo -e "${BLUE}=====================================${NC}"

# Configuration
PROJECT_ID="looker-barqdata-2030"
REGION="us-central1"
SERVICE_NAME="barq-fleet-analytics"
IMAGE_NAME="fleet-analytics"

# Cloud SQL configuration
CLOUD_SQL_INSTANCE="looker-barqdata-2030:us-central1:ai-route-optimization-db"
DB_NAME="barq_logistics"
DB_USER="postgres"

echo -e "\n${GREEN}1. Setting up GCP project...${NC}"
gcloud config set project $PROJECT_ID

echo -e "\n${GREEN}2. Enabling required APIs...${NC}"
gcloud services enable run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    sqladmin.googleapis.com

echo -e "\n${GREEN}3. Building Docker image...${NC}"
docker build -t $IMAGE_NAME:latest -f Dockerfile .

echo -e "\n${GREEN}4. Tagging image for Artifact Registry...${NC}"
docker tag $IMAGE_NAME:latest \
    ${REGION}-docker.pkg.dev/${PROJECT_ID}/barq-services/${IMAGE_NAME}:latest

echo -e "\n${GREEN}5. Pushing image to Artifact Registry...${NC}"
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/barq-services/${IMAGE_NAME}:latest

echo -e "\n${GREEN}6. Deploying to Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
    --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/barq-services/${IMAGE_NAME}:latest \
    --region=$REGION \
    --platform=managed \
    --allow-unauthenticated \
    --port=8080 \
    --memory=1Gi \
    --cpu=2 \
    --timeout=300 \
    --min-instances=0 \
    --max-instances=10 \
    --set-env-vars="DB_HOST=/cloudsql/${CLOUD_SQL_INSTANCE},DB_PORT=5432,DB_NAME=${DB_NAME},DB_USER=${DB_USER}" \
    --set-cloudsql-instances=${CLOUD_SQL_INSTANCE}

echo -e "\n${GREEN}7. Getting service URL...${NC}"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --region=$REGION \
    --format='value(status.url)')

echo -e "\n${BLUE}=====================================${NC}"
echo -e "${GREEN}✓ Deployment successful!${NC}"
echo -e "${BLUE}=====================================${NC}"
echo -e "\nService URL: ${GREEN}${SERVICE_URL}${NC}"
echo -e "\nEndpoints:"
echo -e "  - Health Check: ${SERVICE_URL}/health"
echo -e "  - API Docs: ${SERVICE_URL}/api/docs"
echo -e "  - SLA Analytics: ${SERVICE_URL}/api/sla/*"
echo -e "  - Route Analytics: ${SERVICE_URL}/api/routes/*"
echo -e "  - Fleet Performance: ${SERVICE_URL}/api/fleet/*"
echo -e "  - Demand Forecasting: ${SERVICE_URL}/api/demand/*"
echo -e "\n${BLUE}=====================================${NC}"

# Test the deployment
echo -e "\n${GREEN}8. Testing deployment...${NC}"
curl -s "${SERVICE_URL}/health" | jq '.'

echo -e "\n${GREEN}✓ Deployment complete!${NC}"
