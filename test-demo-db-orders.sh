#!/bin/bash

# Test Demo Database Order Creation
# This script tests if the demo system creates actual orders in the database

PROD_URL="https://route-opt-backend-sek7q2ajva-uc.a.run.app"
DB_HOST="34.65.15.192"
DB_PORT="5432"
DB_NAME="barq_logistics"
DB_USER="postgres"
DB_PASS="BARQFleet2025SecurePass!"

echo "================================================"
echo "Testing Demo Database Order Creation"
echo "================================================"
echo ""

# Step 1: Reset demo
echo "1. Resetting demo..."
curl -X POST "$PROD_URL/api/demo/reset" -s | grep -o '"success":[^,}]*'
echo ""
echo ""

# Step 2: Check current order count in database
echo "2. Checking current order count in database..."
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -c "SELECT COUNT(*) as total_orders FROM orders;" -t | xargs
echo ""

# Step 3: Get timestamp for comparison
echo "3. Recording current timestamp..."
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S")
echo "Start time: $TIMESTAMP"
echo ""

# Step 4: Start demo with 10 orders per minute for 60 seconds
echo "4. Starting demo (10 orders/min for 60 seconds)..."
START_RESPONSE=$(curl -X POST "$PROD_URL/api/demo/start" \
  -H "Content-Type: application/json" \
  -d '{"ordersPerMinute": 10, "duration": 60}' \
  -s)
echo "$START_RESPONSE" | grep -o '"success":[^,]*\|"message":"[^"]*"'
echo ""
echo ""

# Step 5: Wait for orders to be created
echo "5. Waiting 10 seconds for orders to be generated..."
sleep 10
echo ""

# Step 6: Check demo status
echo "6. Checking demo status..."
curl -X GET "$PROD_URL/api/demo/status" -s | \
  grep -o '"totalOrders":[0-9]*\|"isRunning":[^,]*' | head -3
echo ""
echo ""

# Step 7: Check database for new orders
echo "7. Checking database for new orders created during demo..."
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -c "SELECT COUNT(*) as new_orders FROM orders WHERE created_at >= '$TIMESTAMP'::timestamp;" -t | xargs
echo ""
echo ""

# Step 8: Show sample of recent demo orders
echo "8. Sample of most recent demo orders:"
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -c "SELECT order_number, service_type, status, created_at
      FROM orders
      WHERE created_at >= '$TIMESTAMP'::timestamp
      ORDER BY created_at DESC
      LIMIT 5;" 2>&1 | head -15
echo ""

# Step 9: Stop demo
echo "9. Stopping demo..."
curl -X POST "$PROD_URL/api/demo/stop" -s | grep -o '"success":[^,}]*'
echo ""
echo ""

echo "================================================"
echo "Test Complete!"
echo "================================================"
echo ""
echo "Summary:"
echo "- If new_orders > 0, then demo IS creating database orders ✅"
echo "- If new_orders = 0, then demo is NOT creating database orders ❌"
