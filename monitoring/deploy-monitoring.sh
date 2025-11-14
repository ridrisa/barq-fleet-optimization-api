#!/bin/bash

# Deploy Cloud Monitoring Dashboard and Alerts
# Usage: ./deploy-monitoring.sh [project-id]

set -e

PROJECT_ID="${1:-barq-fleet-optimization}"
REGION="us-central1"
SERVICE_NAME="route-opt-backend"

echo "🔧 Deploying BARQ Fleet Manager Monitoring..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo ""

# Check if gcloud is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Error: Not authenticated with gcloud"
    echo "Run: gcloud auth login"
    exit 1
fi

# Set the project
gcloud config set project "$PROJECT_ID"

echo "📊 Creating Cloud Monitoring Dashboard..."

# Create the dashboard
DASHBOARD_FILE="cloud-monitoring-dashboard.json"

if [ ! -f "$DASHBOARD_FILE" ]; then
    echo "❌ Error: Dashboard file not found: $DASHBOARD_FILE"
    exit 1
fi

# Create dashboard using gcloud
gcloud monitoring dashboards create --config-from-file="$DASHBOARD_FILE" || {
    echo "⚠️  Dashboard might already exist. Updating instead..."
    # Get dashboard ID and update
    DASHBOARD_ID=$(gcloud monitoring dashboards list --filter="displayName:'BARQ Fleet Manager - Production Dashboard'" --format="value(name)" | head -1)
    if [ -n "$DASHBOARD_ID" ]; then
        gcloud monitoring dashboards update "$DASHBOARD_ID" --config-from-file="$DASHBOARD_FILE"
        echo "✅ Dashboard updated: $DASHBOARD_ID"
    else
        echo "❌ Failed to create or update dashboard"
        exit 1
    fi
}

echo ""
echo "🔔 Creating Alert Policies..."

# Note: Alert policies need to be created individually
# You can use gcloud alpha monitoring policies create for each policy

cat << 'EOF'

⚠️  Alert Policy Creation:

Alert policies in alert-policies.yaml need to be created individually.

To create alerts, use the Cloud Console:
1. Go to: https://console.cloud.google.com/monitoring/alerting
2. Click "Create Policy"
3. Use the configurations from alert-policies.yaml

Or use gcloud CLI (requires alpha component):

    gcloud alpha monitoring policies create --policy-from-file=alert-policies.yaml

Recommended alerts to set up:
1. High Error Rate (5xx > 1%)
2. High Response Latency (P95 > 1s)
3. High CPU Utilization (> 80%)
4. High Memory Utilization (> 90%)
5. Database Connection Spike (> 80 connections)
6. No Traffic (Service Down)

EOF

echo ""
echo "✅ Monitoring setup complete!"
echo ""
echo "📊 View Dashboard:"
echo "   https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"
echo ""
echo "🔔 Set up Alerts:"
echo "   https://console.cloud.google.com/monitoring/alerting?project=$PROJECT_ID"
echo ""
echo "📈 View Metrics Explorer:"
echo "   https://console.cloud.google.com/monitoring/metrics-explorer?project=$PROJECT_ID"
echo ""

# Optional: Enable Cloud Monitoring API if not already enabled
echo "🔌 Ensuring Cloud Monitoring API is enabled..."
gcloud services enable monitoring.googleapis.com --project="$PROJECT_ID"

echo ""
echo "🎉 All done! Monitor your fleet at the links above."
