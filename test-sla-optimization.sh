#!/bin/bash

# Test SLA-aware Multi-Vehicle Optimization
# This script tests the route optimization with 4-hour SLA constraint

echo "========================================="
echo "Testing SLA-Aware Route Optimization"
echo "========================================="
echo ""

# Test scenario: 3 pickups, 23 deliveries, 5 vehicles
# Expected: System should use multiple vehicles to ensure 4-hour SLA compliance

API_URL="http://localhost:5000/api/v1/optimize"

# Create test data
TEST_DATA='{
  "pickupPoints": [
    {
      "id": "pickup-1",
      "name": "Warehouse A",
      "lat": 24.7136,
      "lng": 46.6753,
      "address": "Riyadh Warehouse A"
    },
    {
      "id": "pickup-2",
      "name": "Warehouse B",
      "lat": 24.7500,
      "lng": 46.7000,
      "address": "Riyadh Warehouse B"
    },
    {
      "id": "pickup-3",
      "name": "Warehouse C",
      "lat": 24.6800,
      "lng": 46.6500,
      "address": "Riyadh Warehouse C"
    }
  ],
  "deliveryPoints": [
    {"id": "del-1", "name": "Customer 1", "lat": 24.7200, "lng": 46.6800},
    {"id": "del-2", "name": "Customer 2", "lat": 24.7300, "lng": 46.6900},
    {"id": "del-3", "name": "Customer 3", "lat": 24.7100, "lng": 46.6700},
    {"id": "del-4", "name": "Customer 4", "lat": 24.7400, "lng": 46.7100},
    {"id": "del-5", "name": "Customer 5", "lat": 24.7000, "lng": 46.6600},
    {"id": "del-6", "name": "Customer 6", "lat": 24.7600, "lng": 46.7200},
    {"id": "del-7", "name": "Customer 7", "lat": 24.6900, "lng": 46.6500},
    {"id": "del-8", "name": "Customer 8", "lat": 24.7700, "lng": 46.7300},
    {"id": "del-9", "name": "Customer 9", "lat": 24.6800, "lng": 46.6400},
    {"id": "del-10", "name": "Customer 10", "lat": 24.7800, "lng": 46.7400},
    {"id": "del-11", "name": "Customer 11", "lat": 24.7250, "lng": 46.6850},
    {"id": "del-12", "name": "Customer 12", "lat": 24.7350, "lng": 46.6950},
    {"id": "del-13", "name": "Customer 13", "lat": 24.7150, "lng": 46.6750},
    {"id": "del-14", "name": "Customer 14", "lat": 24.7450, "lng": 46.7150},
    {"id": "del-15", "name": "Customer 15", "lat": 24.7050, "lng": 46.6650},
    {"id": "del-16", "name": "Customer 16", "lat": 24.7650, "lng": 46.7250},
    {"id": "del-17", "name": "Customer 17", "lat": 24.6950, "lng": 46.6550},
    {"id": "del-18", "name": "Customer 18", "lat": 24.7750, "lng": 46.7350},
    {"id": "del-19", "name": "Customer 19", "lat": 24.6850, "lng": 46.6450},
    {"id": "del-20", "name": "Customer 20", "lat": 24.7850, "lng": 46.7450},
    {"id": "del-21", "name": "Customer 21", "lat": 24.7220, "lng": 46.6820},
    {"id": "del-22", "name": "Customer 22", "lat": 24.7320, "lng": 46.6920},
    {"id": "del-23", "name": "Customer 23", "lat": 24.7120, "lng": 46.6720}
  ],
  "fleet": {
    "vehicles": [
      {"id": "vehicle-1", "type": "van", "capacity": 1000},
      {"id": "vehicle-2", "type": "van", "capacity": 1000},
      {"id": "vehicle-3", "type": "van", "capacity": 1000},
      {"id": "vehicle-4", "type": "van", "capacity": 1000},
      {"id": "vehicle-5", "type": "van", "capacity": 1000}
    ]
  },
  "constraints": {
    "maxDeliveryTime": 240
  },
  "serviceType": "STANDARD"
}'

echo "Sending optimization request..."
echo ""

# Make API call
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$TEST_DATA")

# Check if request was successful
if [ $? -eq 0 ]; then
  echo "✅ Request successful"
  echo ""

  # Extract key metrics
  VEHICLES_USED=$(echo "$RESPONSE" | jq -r '.data.summary.vehiclesUsed // .data.routes | length')
  VEHICLES_IDLE=$(echo "$RESPONSE" | jq -r '.data.summary.vehiclesIdle // 0')
  TOTAL_ROUTES=$(echo "$RESPONSE" | jq -r '.data.summary.total_routes // .data.routes | length')
  LLM_ENABLED=$(echo "$RESPONSE" | jq -r '.data.llmOptimization.enabled // false')
  SLA_COMPLIANCE=$(echo "$RESPONSE" | jq -r '.data.llmOptimization.strategy.sla_compliance // "unknown"')
  MAX_DURATION=$(echo "$RESPONSE" | jq -r '.data.llmOptimization.metrics.max_route_duration_minutes // "unknown"')

  echo "========================================="
  echo "Optimization Results:"
  echo "========================================="
  echo "Total Routes Created: $TOTAL_ROUTES"
  echo "Vehicles Used: $VEHICLES_USED / 5"
  echo "Vehicles Idle: $VEHICLES_IDLE"
  echo "LLM Optimization: $LLM_ENABLED"
  echo "SLA Compliance Status: $SLA_COMPLIANCE"
  echo "Max Route Duration: $MAX_DURATION minutes"
  echo ""

  # Validation
  echo "========================================="
  echo "SLA Compliance Validation:"
  echo "========================================="

  if [ "$MAX_DURATION" != "unknown" ] && [ "$MAX_DURATION" != "null" ]; then
    if [ "$MAX_DURATION" -le 240 ]; then
      echo "✅ PASS: Max route duration ($MAX_DURATION min) is within 4-hour SLA (240 min)"
    else
      echo "❌ FAIL: Max route duration ($MAX_DURATION min) exceeds 4-hour SLA (240 min)"
    fi
  else
    echo "⚠️  WARNING: Could not determine max route duration"
  fi

  if [ "$SLA_COMPLIANCE" = "all_compliant" ]; then
    echo "✅ PASS: All routes marked as SLA compliant"
  elif [ "$SLA_COMPLIANCE" = "at_risk" ]; then
    echo "⚠️  WARNING: Some routes at risk of SLA violation"
  elif [ "$SLA_COMPLIANCE" = "violated" ]; then
    echo "❌ FAIL: SLA violations detected"
  else
    echo "⚠️  WARNING: SLA compliance status unknown"
  fi

  if [ "$VEHICLES_USED" -ge 2 ]; then
    echo "✅ PASS: Using multiple vehicles ($VEHICLES_USED) to meet SLA"
  else
    echo "❌ FAIL: Only using $VEHICLES_USED vehicle(s) - may not meet SLA"
  fi

  echo ""
  echo "========================================="
  echo "Full Response (summary):"
  echo "========================================="
  echo "$RESPONSE" | jq '{
    success: .success,
    llmEnhanced: .llmEnhanced,
    summary: .data.summary,
    llmOptimization: .data.llmOptimization
  }'

else
  echo "❌ Request failed"
  exit 1
fi
