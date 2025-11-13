#!/bin/bash
BASE_URL="https://route-opt-backend-426674819922.us-central1.run.app"
echo "Testing ACTUAL automation endpoints..."
echo ""

PASS=0
FAIL=0

test_get() {
    local path=$1
    local name=$2
    printf "%-60s" "$name..."
    code=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/automation$path")
    if [ "$code" != "404" ]; then
        echo "✅ PASS ($code)"
        ((PASS++))
    else
        echo "❌ FAIL (404)"
        ((FAIL++))
    fi
}

test_post() {
    local path=$1
    local name=$2
    printf "%-60s" "$name..."
    code=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/api/v1/automation$path" -H "Content-Type: application/json" -d '{}')
    if [ "$code" != "404" ]; then
        echo "✅ PASS ($code)"
        ((PASS++))
    else
        echo "❌ FAIL (404)"
        ((FAIL++))
    fi
}

# Dispatch
test_get "/dispatch/status" "Dispatch status"
test_get "/dispatch/stats" "Dispatch stats"
test_post "/dispatch/start" "Dispatch start"
test_post "/dispatch/stop" "Dispatch stop"
test_post "/dispatch/assign/test123" "Dispatch assign order"

# Batching
test_get "/batching/status" "Batching status"
test_get "/batching/stats" "Batching stats"
test_get "/batching/batch/test123" "Get batch details"
test_post "/batching/start" "Batching start"
test_post "/batching/stop" "Batching stop"
test_post "/batching/process" "Process batch"

# Routes
test_get "/routes/status" "Routes status"
test_get "/routes/stats" "Routes stats"
test_post "/routes/start" "Routes start"
test_post "/routes/stop" "Routes stop"
test_post "/routes/optimize/test123" "Optimize driver route"
test_post "/routes/traffic-incident" "Handle traffic incident"

# Escalation
test_get "/escalation/status" "Escalation status"
test_get "/escalation/stats" "Escalation stats"
test_get "/escalation/alerts" "Get alerts"
test_get "/escalation/at-risk-orders" "Get at-risk orders"
test_get "/escalation/logs" "Escalation logs"
test_post "/escalation/start" "Escalation start"
test_post "/escalation/stop" "Escalation stop"
test_post "/escalation/alerts/test123/resolve" "Resolve alert"

# Global
test_get "/status-all" "Global status"
test_get "/dashboard" "Automation dashboard"
test_post "/start-all" "Start all engines"
test_post "/stop-all" "Stop all engines"

echo ""
echo "=========================================="
echo "RESULTS: $PASS passing, $FAIL failing"
echo "Success rate: $((PASS * 100 / (PASS + FAIL)))%"
echo "=========================================="
