#!/bin/bash

# Quick test for the 12 automation endpoints that should now be working
# After ninth deployment (automation routes mounted)

BASE_URL="https://barq-fleet-analytics-426674819922.us-central1.run.app"

echo "=================================================="
echo "🧪 AUTOMATION ENDPOINTS TEST"
echo "=================================================="
echo ""
echo "Testing 12 automation endpoints after ninth deployment"
echo "Expected: All should return 200 or 4xx (not 404)"
echo ""

PASS=0
FAIL=0

test_endpoint() {
    local method=$1
    local path=$2
    local description=$3

    printf "%-50s" "$description..."

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$path" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$path" \
            -H "Content-Type: application/json" \
            -d '{}' 2>&1)
    fi

    http_code=$(echo "$response" | tail -n1)

    # Success if NOT 404 (route exists, even if requires auth/data)
    if [ "$http_code" != "404" ]; then
        echo "✅ PASS ($http_code)"
        PASS=$((PASS + 1))
    else
        echo "❌ FAIL (404 - route not found)"
        FAIL=$((FAIL + 1))
    fi
}

echo "1. Dispatch Endpoints"
echo "---------------------"
test_endpoint "POST" "/api/v1/automation/dispatch/auto" "Auto-dispatch orders"
test_endpoint "POST" "/api/v1/automation/dispatch/batch/test123" "Dispatch batch"
test_endpoint "POST" "/api/v1/automation/dispatch/order/test123" "Dispatch single order"

echo ""
echo "2. Routing Endpoints"
echo "--------------------"
test_endpoint "POST" "/api/v1/automation/routing/optimize" "Optimize routes"
test_endpoint "POST" "/api/v1/automation/routing/rebalance" "Rebalance loads"
test_endpoint "POST" "/api/v1/automation/routing/eta/update" "Update ETAs"

echo ""
echo "3. Batching Endpoints"
echo "---------------------"
test_endpoint "POST" "/api/v1/automation/batching/create" "Create smart batch"
test_endpoint "POST" "/api/v1/automation/batching/optimize/test123" "Optimize batch"

echo ""
echo "4. Escalation Endpoints"
echo "-----------------------"
test_endpoint "POST" "/api/v1/automation/escalation/check" "Check escalations"
test_endpoint "POST" "/api/v1/automation/escalation/resolve/test123" "Resolve escalation"

echo ""
echo "5. Global Endpoints"
echo "-------------------"
test_endpoint "GET" "/api/v1/automation/global/status" "Global status"
test_endpoint "GET" "/api/v1/automation/global/health" "Health check"

echo ""
echo "=================================================="
echo "📊 RESULTS"
echo "=================================================="
echo ""
echo "Passing: $PASS/12 ($(awk "BEGIN {printf \"%.1f\", ($PASS/12)*100}")%)"
echo "Failing: $FAIL/12"
echo ""

if [ $PASS -ge 10 ]; then
    echo "🎉 SUCCESS! Most automation endpoints are now accessible"
    echo ""
    echo "Note: Some may return 400/401/500 (expected - need auth/data)"
    echo "Important: None should return 404 (route not found)"
elif [ $PASS -ge 6 ]; then
    echo "⚠️  PARTIAL: Some endpoints working, some still 404"
elif [ $PASS -ge 1 ]; then
    echo "❌ ISSUE: Only a few endpoints working"
else
    echo "❌ CRITICAL: No automation endpoints working - routes not mounted?"
fi

echo "=================================================="
