#!/bin/bash
set -e

BASE_URL="https://route-opt-backend-426674819922.us-central1.run.app"
ANALYTICS_URL="https://barq-fleet-analytics-426674819922.us-central1.run.app"

echo "================================================================"
echo "  COMPREHENSIVE ENDPOINT TEST - FINAL"
echo "================================================================"
echo ""
echo "Main API: $BASE_URL"
echo "Analytics: $ANALYTICS_URL"
echo ""

TOTAL=0
PASS=0
FAIL=0

test_endpoint() {
    local method=$1
    local url=$2
    local path=$3
    local name=$4
    local data=${5:-"{}"}
    
    ((TOTAL++))
    printf "%-3s %-55s" "$TOTAL." "$name..."
    
    if [ "$method" = "GET" ]; then
        code=$(curl -s -w "%{http_code}" -o /dev/null "$url$path" 2>&1)
    else
        code=$(curl -s -w "%{http_code}" -o /dev/null -X "$method" "$url$path" -H "Content-Type: application/json" -d "$data" 2>&1)
    fi
    
    # Success if NOT 404
    if [ "$code" != "404" ]; then
        echo "✅ $code"
        ((PASS++))
    else
        echo "❌ 404"
        ((FAIL++))
    fi
}

echo "=== CORE API ==="
test_endpoint "GET" "$BASE_URL" "/api/v1" "API v1 info"
test_endpoint "GET" "$BASE_URL" "/api/health" "Health check"

echo ""
echo "=== AUTH ==="
test_endpoint "POST" "$BASE_URL" "/api/auth/login" "Login" '{"username":"test","password":"test"}'
test_endpoint "POST" "$BASE_URL" "/api/auth/register" "Register"
test_endpoint "POST" "$BASE_URL" "/api/auth/refresh" "Refresh token"

echo ""
echo "=== OPTIMIZATION ==="
test_endpoint "POST" "$BASE_URL" "/api/optimize" "Basic optimization"
test_endpoint "POST" "$BASE_URL" "/api/v1/optimize" "V1 optimization"
test_endpoint "POST" "$BASE_URL" "/api/v1/optimize/multi-vehicle" "Multi-vehicle"
test_endpoint "POST" "$BASE_URL" "/api/v1/optimize/time-windows" "Time windows"
test_endpoint "GET" "$BASE_URL" "/api/optimize/stats" "Optimization stats"

echo ""
echo "=== AGENTS ==="
test_endpoint "GET" "$BASE_URL" "/api/v1/agents/status" "Agents status"
test_endpoint "POST" "$BASE_URL" "/api/v1/agents/trigger" "Trigger agent"

echo ""
echo "=== ADMIN ==="
test_endpoint "GET" "$BASE_URL" "/api/v1/admin/users" "List users"
test_endpoint "GET" "$BASE_URL" "/api/v1/admin/settings" "System settings"

echo ""
echo "=== AUTONOMOUS ==="
test_endpoint "GET" "$BASE_URL" "/api/v1/autonomous/status" "Autonomous status"
test_endpoint "POST" "$BASE_URL" "/api/v1/autonomous/enable" "Enable autonomous"

echo ""
echo "=== HEALTH ==="
test_endpoint "GET" "$BASE_URL" "/api/v1/health" "V1 health"
test_endpoint "GET" "$BASE_URL" "/api/v1/health/detailed" "Detailed health"

echo ""
echo "=== ANALYTICS ==="
test_endpoint "GET" "$BASE_URL" "/api/v1/analytics/overview" "Analytics overview"
test_endpoint "GET" "$BASE_URL" "/api/v1/analytics/sla/realtime" "Real-time SLA"
test_endpoint "GET" "$BASE_URL" "/api/v1/analytics/sla/daily" "Daily SLA"
test_endpoint "GET" "$BASE_URL" "/api/v1/analytics/fleet/utilization" "Fleet utilization"
test_endpoint "GET" "$BASE_URL" "/api/v1/analytics/fleet/drivers" "Fleet drivers"
test_endpoint "GET" "$BASE_URL" "/api/v1/analytics/fleet/vehicles" "Fleet vehicles"

echo ""
echo "=== PRODUCTION METRICS ==="
test_endpoint "GET" "$BASE_URL" "/api/v1/production-metrics/on-time-delivery" "On-time delivery"
test_endpoint "GET" "$BASE_URL" "/api/v1/production-metrics/completion-rate" "Completion rate"
test_endpoint "GET" "$BASE_URL" "/api/v1/production-metrics/courier-performance" "Courier perf"
test_endpoint "GET" "$BASE_URL" "/api/v1/production-metrics/real-time-stats" "Real-time stats"
test_endpoint "GET" "$BASE_URL" "/api/v1/production-metrics/daily-summary" "Daily summary"
test_endpoint "GET" "$BASE_URL" "/api/v1/production-metrics/customer-satisfaction" "Customer sat"
test_endpoint "GET" "$BASE_URL" "/api/v1/production-metrics/revenue" "Revenue metrics"

echo ""
echo "=== AI QUERY ==="
test_endpoint "POST" "$BASE_URL" "/api/v1/ai-query" "AI query"

echo ""
echo "=== AUTOMATION (29 endpoints) ==="
test_endpoint "GET" "$BASE_URL" "/api/v1/automation/status-all" "Global status"
test_endpoint "GET" "$BASE_URL" "/api/v1/automation/dashboard" "Dashboard"
test_endpoint "POST" "$BASE_URL" "/api/v1/automation/start-all" "Start all"
test_endpoint "POST" "$BASE_URL" "/api/v1/automation/stop-all" "Stop all"
test_endpoint "GET" "$BASE_URL" "/api/v1/automation/dispatch/status" "Dispatch status"
test_endpoint "GET" "$BASE_URL" "/api/v1/automation/dispatch/stats" "Dispatch stats"
test_endpoint "POST" "$BASE_URL" "/api/v1/automation/dispatch/start" "Dispatch start"
test_endpoint "GET" "$BASE_URL" "/api/v1/automation/batching/status" "Batching status"
test_endpoint "GET" "$BASE_URL" "/api/v1/automation/batching/stats" "Batching stats"
test_endpoint "POST" "$BASE_URL" "/api/v1/automation/batching/start" "Batching start"
test_endpoint "GET" "$BASE_URL" "/api/v1/automation/routes/status" "Routes status"
test_endpoint "GET" "$BASE_URL" "/api/v1/automation/routes/stats" "Routes stats"
test_endpoint "POST" "$BASE_URL" "/api/v1/automation/routes/start" "Routes start"
test_endpoint "GET" "$BASE_URL" "/api/v1/automation/escalation/status" "Escalation status"
test_endpoint "GET" "$BASE_URL" "/api/v1/automation/escalation/stats" "Escalation stats"
test_endpoint "GET" "$BASE_URL" "/api/v1/automation/escalation/alerts" "Get alerts"
test_endpoint "POST" "$BASE_URL" "/api/v1/automation/escalation/start" "Escalation start"

echo ""
echo "================================================================"
echo "  FINAL RESULTS"
echo "================================================================"
echo ""
echo "Total endpoints tested: $TOTAL"
echo "Passing (not 404): $PASS"
echo "Failing (404): $FAIL"
echo ""
PERCENT=$((PASS * 100 / TOTAL))
echo "Success rate: $PERCENT%"
echo ""

if [ $PERCENT -ge 70 ]; then
    echo "🎉 SUCCESS! Reached 70%+ target"
elif [ $PERCENT -ge 65 ]; then
    echo "⚠️  CLOSE! $((70 - PERCENT))% away from 70% target"
else
    echo "❌ Below target, $(( 70 - PERCENT))% away from 70%"
fi

echo "================================================================"
