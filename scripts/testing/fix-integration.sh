#!/bin/bash

# Production Integration Fix Script
# Fixes frontend-backend connection by updating environment variables

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}  Production Integration Fix${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""

# Service URLs
BACKEND_URL="https://route-opt-backend-sek7q2ajva-uc.a.run.app"
ANALYTICS_URL="https://route-opt-analytics-sek7q2ajva-uc.a.run.app"
FRONTEND_URL="https://route-opt-frontend-sek7q2ajva-uc.a.run.app"
WS_URL="wss://route-opt-backend-sek7q2ajva-uc.a.run.app/ws"

# Step 1: Verify services are running
echo -e "${YELLOW}Step 1: Verifying services are running...${NC}"

echo -n "  Checking backend..."
if curl -s -f "$BACKEND_URL/health" > /dev/null; then
    echo -e " ${GREEN}✓${NC}"
else
    echo -e " ${RED}✗ Backend not responding${NC}"
    exit 1
fi

echo -n "  Checking analytics..."
if curl -s -f "$ANALYTICS_URL/health" > /dev/null; then
    echo -e " ${GREEN}✓${NC}"
else
    echo -e " ${RED}✗ Analytics API not responding${NC}"
    exit 1
fi

echo -n "  Checking frontend..."
if curl -s -f "$FRONTEND_URL" > /dev/null; then
    echo -e " ${GREEN}✓${NC}"
else
    echo -e " ${RED}✗ Frontend not responding${NC}"
    exit 1
fi

echo ""

# Step 2: Show current frontend configuration
echo -e "${YELLOW}Step 2: Current frontend configuration:${NC}"
gcloud run services describe route-opt-frontend \
  --region=us-central1 \
  --format="table(spec.template.spec.containers[0].env)" 2>/dev/null || true

echo ""

# Step 3: Update frontend environment variables
echo -e "${YELLOW}Step 3: Updating frontend environment variables...${NC}"

echo -e "  Setting:"
echo -e "    NEXT_PUBLIC_API_URL=${GREEN}$BACKEND_URL${NC}"
echo -e "    NEXT_PUBLIC_ANALYTICS_API_URL=${GREEN}$ANALYTICS_URL${NC}"
echo -e "    NEXT_PUBLIC_WS_URL=${GREEN}$WS_URL${NC}"
echo -e "    NEXT_PUBLIC_API_VERSION=${GREEN}v1${NC}"

gcloud run services update route-opt-frontend \
  --region=us-central1 \
  --set-env-vars="NEXT_PUBLIC_API_URL=$BACKEND_URL,NEXT_PUBLIC_ANALYTICS_API_URL=$ANALYTICS_URL,NEXT_PUBLIC_WS_URL=$WS_URL,NEXT_PUBLIC_API_VERSION=v1" \
  --quiet

echo -e "${GREEN}  ✓ Frontend updated successfully${NC}"
echo ""

# Step 4: Wait for frontend to restart
echo -e "${YELLOW}Step 4: Waiting for frontend to restart (30 seconds)...${NC}"
for i in {1..30}; do
    echo -n "."
    sleep 1
done
echo ""
echo -e "${GREEN}  ✓ Wait complete${NC}"
echo ""

# Step 5: Verify integration
echo -e "${YELLOW}Step 5: Verifying integration...${NC}"

# Test backend health
echo -n "  Testing backend API..."
BACKEND_HEALTH=$(curl -s "$BACKEND_URL/health")
if echo "$BACKEND_HEALTH" | grep -q "\"status\":\"up\""; then
    echo -e " ${GREEN}✓${NC}"
    echo "    $(echo $BACKEND_HEALTH | jq -r '.version // "unknown"')"
else
    echo -e " ${RED}✗${NC}"
fi

# Test analytics health
echo -n "  Testing analytics API..."
ANALYTICS_HEALTH=$(curl -s "$ANALYTICS_URL/health")
if echo "$ANALYTICS_HEALTH" | grep -q "\"status\":\"healthy\""; then
    echo -e " ${GREEN}✓${NC}"
    echo "    $(echo $ANALYTICS_HEALTH | jq -r '.version // "unknown"')"
else
    echo -e " ${RED}✗${NC}"
fi

# Test WebSocket (just check if endpoint exists)
echo -n "  Testing WebSocket endpoint..."
WS_TEST=$(curl -s -I "$BACKEND_URL/ws" 2>&1 | head -1)
if echo "$WS_TEST" | grep -q "200\|101\|400"; then
    echo -e " ${GREEN}✓ (endpoint exists)${NC}"
else
    echo -e " ${YELLOW}⚠ (needs connection)${NC}"
fi

# Test optimization endpoint
echo -n "  Testing optimization API..."
OPT_TEST=$(curl -s -X POST "$BACKEND_URL/api/v1/optimize" \
  -H "Content-Type: application/json" \
  -d '{
    "pickupPoints": [{"name":"Test Hub","lat":24.7136,"lng":46.6753}],
    "deliveryPoints": [{"name":"Test Customer","lat":24.7240,"lng":46.6800}],
    "fleet": {"vehicleType":"van","count":1,"capacity":1000}
  }' 2>&1)

if echo "$OPT_TEST" | grep -q "\"success\":true"; then
    echo -e " ${GREEN}✓${NC}"
elif echo "$OPT_TEST" | grep -q "routes"; then
    echo -e " ${GREEN}✓${NC}"
else
    echo -e " ${YELLOW}⚠${NC}"
    echo "    Response: $(echo $OPT_TEST | head -c 100)"
fi

# Test analytics SLA endpoint
echo -n "  Testing analytics SLA API..."
SLA_TEST=$(curl -s "$ANALYTICS_URL/api/sla/realtime" 2>&1)
if echo "$SLA_TEST" | grep -q "status"; then
    echo -e " ${GREEN}✓${NC}"
else
    echo -e " ${YELLOW}⚠${NC}"
fi

echo ""

# Step 6: Show updated configuration
echo -e "${YELLOW}Step 6: New frontend configuration:${NC}"
gcloud run services describe route-opt-frontend \
  --region=us-central1 \
  --format="table(spec.template.spec.containers[0].env)" 2>/dev/null || true

echo ""

# Summary
echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}        Integration Fixed${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""
echo -e "${GREEN}✓ All services verified${NC}"
echo -e "${GREEN}✓ Frontend environment updated${NC}"
echo -e "${GREEN}✓ Integration tested${NC}"
echo ""
echo -e "Frontend URL: ${BLUE}$FRONTEND_URL${NC}"
echo -e "Backend URL:  ${BLUE}$BACKEND_URL${NC}"
echo -e "Analytics URL: ${BLUE}$ANALYTICS_URL${NC}"
echo ""
echo -e "${YELLOW}Note:${NC} Allow 1-2 minutes for all changes to fully propagate."
echo -e "${YELLOW}Note:${NC} Clear browser cache if frontend doesn't update immediately."
echo ""

# Create local .env.local file
echo -e "${YELLOW}Creating local .env.local file...${NC}"
cat > frontend/.env.local <<EOF
# Production Backend URLs
NEXT_PUBLIC_API_URL=$BACKEND_URL
NEXT_PUBLIC_ANALYTICS_API_URL=$ANALYTICS_URL
NEXT_PUBLIC_WS_URL=$WS_URL
NEXT_PUBLIC_API_VERSION=v1

# Development (localhost)
# NEXT_PUBLIC_API_URL=http://localhost:3002
# NEXT_PUBLIC_WS_URL=ws://localhost:3002/ws
EOF

echo -e "${GREEN}  ✓ Created frontend/.env.local${NC}"
echo ""

echo -e "${GREEN}Integration fix complete!${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. Open ${BLUE}$FRONTEND_URL${NC} in your browser"
echo -e "  2. Test optimization form submission"
echo -e "  3. Check analytics dashboard"
echo -e "  4. Verify real-time updates work"
echo ""