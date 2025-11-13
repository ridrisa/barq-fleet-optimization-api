#!/bin/bash

# Test script for eighth deployment
# Expected: 11 production metrics endpoints fixed
# Target: 46.4% → 66%+ success rate (26/56 → 37+/56 passing)

echo "=================================================="
echo "🧪 EIGHTH DEPLOYMENT - ENDPOINT TESTING"
echo "=================================================="
echo ""
echo "Deployment: Logger import fixes (7 files)"
echo "Expected: 11 production metrics endpoints fixed"
echo "Previous: 26/56 passing (46.4%)"
echo "Target: 37+/56 passing (66%+)"
echo ""
echo "Testing in 3 seconds..."
sleep 3

BASE_URL="https://barq-fleet-analytics-426674819922.us-central1.run.app"
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

# Helper function to test endpoint
test_endpoint() {
    local method=$1
    local path=$2
    local data=$3
    local description=$4

    TOTAL_COUNT=$((TOTAL_COUNT + 1))

    printf "\n%-60s" "$description..."

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$path" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$path" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    fi

    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo "✅ PASS ($http_code)"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo "❌ FAIL ($http_code)"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

echo "=================================================="
echo "🎯 PRIORITY: Production Metrics (11 endpoints)"
echo "   These should ALL be FIXED by logger import fix"
echo "=================================================="

test_endpoint "GET" "/api/v1/production-metrics/on-time-delivery" "" "On-time delivery rate"
test_endpoint "GET" "/api/v1/production-metrics/completion-rate" "" "Order completion rate"
test_endpoint "GET" "/api/v1/production-metrics/courier-performance" "" "Courier performance metrics"
test_endpoint "GET" "/api/v1/production-metrics/real-time-stats" "" "Real-time statistics"
test_endpoint "GET" "/api/v1/production-metrics/daily-summary" "" "Daily summary"
test_endpoint "GET" "/api/v1/production-metrics/weekly-summary" "" "Weekly summary"
test_endpoint "GET" "/api/v1/production-metrics/monthly-summary" "" "Monthly summary"
test_endpoint "GET" "/api/v1/production-metrics/customer-satisfaction" "" "Customer satisfaction"
test_endpoint "GET" "/api/v1/production-metrics/order-volume" "" "Order volume"
test_endpoint "GET" "/api/v1/production-metrics/revenue" "" "Revenue metrics"
test_endpoint "GET" "/api/v1/production-metrics/fleet-utilization" "" "Fleet utilization"

echo ""
echo "=================================================="
echo "📊 EIGHTH DEPLOYMENT RESULTS"
echo "=================================================="
echo ""
echo "Production Metrics Fixed: $PASS_COUNT/11"
echo "Total Passing: $PASS_COUNT/$TOTAL_COUNT"
echo "Success Rate: $(awk "BEGIN {printf \"%.1f\", ($PASS_COUNT/$TOTAL_COUNT)*100}")%"
echo ""

if [ $PASS_COUNT -eq 11 ]; then
    echo "🎉 PERFECT! All 11 production metrics endpoints fixed!"
    echo ""
    echo "Next: Test all 56 endpoints to verify 66%+ success rate"
elif [ $PASS_COUNT -ge 8 ]; then
    echo "✅ GOOD! Most endpoints fixed ($PASS_COUNT/11)"
    echo ""
    echo "Issues remaining: $((11 - PASS_COUNT)) endpoints still failing"
elif [ $PASS_COUNT -ge 5 ]; then
    echo "⚠️  PARTIAL: Some endpoints fixed ($PASS_COUNT/11)"
    echo ""
    echo "Issues remaining: $((11 - PASS_COUNT)) endpoints need investigation"
else
    echo "❌ CRITICAL: Logger fix didn't work as expected ($PASS_COUNT/11)"
    echo ""
    echo "Investigation needed for $((11 - PASS_COUNT)) failing endpoints"
fi

echo "=================================================="
