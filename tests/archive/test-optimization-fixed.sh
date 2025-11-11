#!/bin/bash

# Test script to verify the frontend schema fix for optimization API
# This tests that the corrected pickup point schema works end-to-end

echo "=============================================="
echo "Testing Optimization API with Fixed Schema"
echo "=============================================="
echo ""

BACKEND_URL="https://route-opt-backend-426674819922.us-central1.run.app"

echo "1. Testing Backend Health..."
curl -s "${BACKEND_URL}/health" | jq '.'
echo ""

echo "2. Testing Optimization with Correct Pickup Point Schema..."
echo "   (Using corrected format: name, lat, lng, type only)"
echo ""

curl -X POST "${BACKEND_URL}/api/optimize" \
  -H "Content-Type: application/json" \
  -d '{
    "pickupPoints": [
      {
        "name": "Riyadh Main Hub",
        "lat": 24.7136,
        "lng": 46.6753,
        "type": "outlet"
      }
    ],
    "deliveryPoints": [
      {
        "order_id": "ORD001",
        "customer_name": "Ahmed Al-Saud",
        "lat": 24.7240,
        "lng": 46.6800,
        "priority": "HIGH",
        "load_kg": 10,
        "time_window": "09:00-17:00"
      },
      {
        "order_id": "ORD002",
        "customer_name": "Fatima Hassan",
        "lat": 24.7150,
        "lng": 46.6900,
        "priority": "MEDIUM",
        "load_kg": 5,
        "time_window": "10:00-18:00"
      }
    ],
    "fleet": [
      {
        "fleet_id": "VEH001",
        "vehicle_type": "TRUCK",
        "capacity_kg": 1000,
        "current_latitude": 24.7136,
        "current_longitude": 46.6753,
        "outlet_id": 1,
        "status": "AVAILABLE"
      }
    ],
    "businessRules": {
      "maxDriverHours": 8,
      "restPeriodMinutes": 30,
      "maxConsecutiveDriveTime": 4,
      "allowedZones": [],
      "restrictedAreas": []
    },
    "preferences": {
      "sustainabilityScore": 0.5,
      "costScore": 0.5,
      "serviceScore": 0.5
    }
  }' | jq '.'

echo ""
echo "=============================================="
echo "Test Complete"
echo "=============================================="
echo ""
echo "Expected Result:"
echo "  - Status 200 OK (not 400 Bad Request)"
echo "  - Optimized routes with waypoints"
echo "  - Distance and duration calculations"
echo "  - OSRM geometry for map display"
echo ""
