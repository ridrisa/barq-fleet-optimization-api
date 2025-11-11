#!/bin/bash

echo "🧪 Testing BARQ Production Endpoints"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Backend URL
BACKEND_URL="https://route-opt-backend-sek7q2ajva-uc.a.run.app"
ANALYTICS_URL="https://route-opt-analytics-sek7q2ajva-uc.a.run.app"
FRONTEND_URL="https://route-opt-frontend-sek7q2ajva-uc.a.run.app"

echo -e "${BLUE}1. Testing Backend Root${NC}"
curl -s "$BACKEND_URL/" | head -3
echo ""
echo ""

echo -e "${BLUE}2. Testing Optimization Endpoint${NC}"
RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/optimize" \
  -H "Content-Type: application/json" \
  -d '{
    "pickupPoints": [
      {"name": "Hub", "address": "Riyadh Hub", "lat": 24.7136, "lng": 46.6753, "priority": 5}
    ],
    "deliveryPoints": [
      {"name": "Customer 1", "address": "Delivery 1", "lat": 24.7240, "lng": 46.6800, "priority": 8},
      {"name": "Customer 2", "address": "Delivery 2", "lat": 24.7350, "lng": 46.6900, "priority": 7}
    ],
    "fleet": {
      "vehicleType": "car",
      "count": 1,
      "capacity": 1000
    },
    "options": {
      "optimizationMode": "balanced"
    }
  }')

if echo "$RESPONSE" | grep -q "routes"; then
  echo -e "${GREEN}✅ Optimization endpoint working${NC}"
  echo "$RESPONSE" | head -10
else
  echo -e "${RED}❌ Optimization failed${NC}"
  echo "$RESPONSE" | head -10
fi
echo ""
echo ""

echo -e "${BLUE}3. Testing Analytics Endpoint${NC}"
curl -s "$ANALYTICS_URL/api/sla/realtime" | head -10
echo ""
echo ""

echo -e "${BLUE}4. Testing Frontend${NC}"
curl -s -I "$FRONTEND_URL" | grep -E "(HTTP|x-nextjs|x-powered-by)"
echo ""
echo ""

echo -e "${BLUE}5. Testing Available Routes${NC}"
echo "Testing: $BACKEND_URL/api/routes"
curl -s "$BACKEND_URL/api/routes" | head -10
echo ""
echo ""

echo -e "${BLUE}6. Testing Database Connection${NC}"
echo "Testing: $BACKEND_URL/api/db/status"
curl -s "$BACKEND_URL/api/db/status" | head -10
echo ""
echo ""

echo "========================================"
echo -e "${YELLOW}Test Complete${NC}"
