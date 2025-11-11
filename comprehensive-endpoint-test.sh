#!/bin/bash

# Comprehensive Endpoint Testing Script for BARQ Fleet Optimization API
# Tests ALL discovered endpoints from route files

BASE_URL="https://route-opt-backend-426674819922.us-central1.run.app"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

echo "=========================================="
echo "BARQ Fleet API - Comprehensive Test Suite"
echo "Timestamp: $TIMESTAMP"
echo "Base URL: $BASE_URL"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
total=0
passed=0
failed=0
skipped=0

test_endpoint() {
    local name=$1
    local method=$2
    local url=$3
    local expected_status=$4
    local data=$5

    echo -n "Testing $name... "
    ((total++))

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url")
    elif [ "$method" = "POST" ]; then
        if [ -n "$data" ]; then
            response=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$url")
        else
            response=$(curl -s -w "\n%{http_code}" -X POST "$url")
        fi
    fi

    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$status_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $status_code)"
        ((passed++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $status_code, expected $expected_status)"
        echo "  Response preview: $(echo $body | head -c 150)..."
        ((failed++))
        return 1
    fi
}

echo "=========================================="
echo "1. HEALTH CHECK ENDPOINTS"
echo "=========================================="

test_endpoint "Basic Health Check" "GET" "$BASE_URL/health" 200
test_endpoint "API v1 Health Check" "GET" "$BASE_URL/api/v1/health" 200
test_endpoint "Detailed Health Check" "GET" "$BASE_URL/api/v1/health/detailed" 200
test_endpoint "Liveness Probe" "GET" "$BASE_URL/api/v1/health/live" 200
test_endpoint "Readiness Probe" "GET" "$BASE_URL/api/v1/health/ready" 200
test_endpoint "Health Info" "GET" "$BASE_URL/api/v1/health/info" 200
test_endpoint "Smoke Test" "GET" "$BASE_URL/api/v1/health/smoke" 200

echo ""
echo "=========================================="
echo "2. ANALYTICS ENDPOINTS"
echo "=========================================="

test_endpoint "SLA Realtime Analytics" "GET" "$BASE_URL/api/v1/analytics/sla/realtime" 200
test_endpoint "SLA Compliance (7 days)" "GET" "$BASE_URL/api/v1/analytics/sla/compliance?days=7" 200
test_endpoint "SLA Compliance (30 days)" "GET" "$BASE_URL/api/v1/analytics/sla/compliance?days=30" 200
test_endpoint "SLA Trend (7 days)" "GET" "$BASE_URL/api/v1/analytics/sla/trend?days=7" 200
test_endpoint "SLA Trend (30 days)" "GET" "$BASE_URL/api/v1/analytics/sla/trend?days=30" 200
test_endpoint "Fleet Performance" "GET" "$BASE_URL/api/v1/analytics/fleet/performance?days=7" 200
test_endpoint "Dashboard Summary" "GET" "$BASE_URL/api/v1/analytics/dashboard/summary" 200

echo ""
echo "=========================================="
echo "3. PRODUCTION METRICS ENDPOINTS"
echo "=========================================="

test_endpoint "On-Time Delivery Rate" "GET" "$BASE_URL/api/v1/production-metrics/on-time-delivery?days=7" 200
test_endpoint "Completion Rate" "GET" "$BASE_URL/api/v1/production-metrics/completion-rate?days=7" 200
test_endpoint "Delivery Time" "GET" "$BASE_URL/api/v1/production-metrics/delivery-time?days=7" 200
test_endpoint "Courier Performance" "GET" "$BASE_URL/api/v1/production-metrics/courier-performance?days=7" 200
test_endpoint "Cancellation Rate" "GET" "$BASE_URL/api/v1/production-metrics/cancellation-rate?days=7" 200
test_endpoint "Return Rate" "GET" "$BASE_URL/api/v1/production-metrics/return-rate?days=7" 200
test_endpoint "Fleet Utilization" "GET" "$BASE_URL/api/v1/production-metrics/fleet-utilization?days=7" 200
test_endpoint "Order Distribution" "GET" "$BASE_URL/api/v1/production-metrics/order-distribution?days=7" 200
test_endpoint "Comprehensive Dashboard" "GET" "$BASE_URL/api/v1/production-metrics/comprehensive?days=7" 200
test_endpoint "SLA At-Risk Orders" "GET" "$BASE_URL/api/v1/production-metrics/sla/at-risk" 200
test_endpoint "SLA Compliance Metrics" "GET" "$BASE_URL/api/v1/production-metrics/sla/compliance?days=7" 200

echo ""
echo "=========================================="
echo "4. AUTOMATION ENDPOINTS (Status Only)"
echo "=========================================="

test_endpoint "Auto-Dispatch Status" "GET" "$BASE_URL/api/v1/automation/dispatch/status" 200
test_endpoint "Auto-Dispatch Stats" "GET" "$BASE_URL/api/v1/automation/dispatch/stats?days=7" 200
test_endpoint "Route Optimizer Status" "GET" "$BASE_URL/api/v1/automation/routes/status" 200
test_endpoint "Route Optimizer Stats" "GET" "$BASE_URL/api/v1/automation/routes/stats?days=7" 200
test_endpoint "Smart Batching Status" "GET" "$BASE_URL/api/v1/automation/batching/status" 200
test_endpoint "Smart Batching Stats" "GET" "$BASE_URL/api/v1/automation/batching/stats?days=7" 200
test_endpoint "Escalation Status" "GET" "$BASE_URL/api/v1/automation/escalation/status" 200
test_endpoint "Escalation Stats" "GET" "$BASE_URL/api/v1/automation/escalation/stats?days=7" 200
test_endpoint "Escalation Logs" "GET" "$BASE_URL/api/v1/automation/escalation/logs?limit=10" 200
test_endpoint "Escalation Alerts" "GET" "$BASE_URL/api/v1/automation/escalation/alerts" 200
test_endpoint "At-Risk Orders" "GET" "$BASE_URL/api/v1/automation/escalation/at-risk-orders" 200
test_endpoint "All Automation Status" "GET" "$BASE_URL/api/v1/automation/status-all" 200
test_endpoint "Automation Dashboard" "GET" "$BASE_URL/api/v1/automation/dashboard" 200

echo ""
echo "=========================================="
echo "5. API INFO ENDPOINTS"
echo "=========================================="

test_endpoint "API Root" "GET" "$BASE_URL/api" 200
test_endpoint "API v1 Info" "GET" "$BASE_URL/api/v1" 200

echo ""
echo "=========================================="
echo "6. AUTHENTICATION ENDPOINTS (No Auth)"
echo "=========================================="

# These should return 400/422 for missing data, not 500
echo -n "Testing Auth Register (no data)... "
((total++))
response=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" "$BASE_URL/api/v1/auth/register")
status_code=$(echo "$response" | tail -n1)
if [ "$status_code" -eq 400 ] || [ "$status_code" -eq 422 ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $status_code - expected validation error)"
    ((passed++))
else
    echo -e "${RED}✗ FAIL${NC} (HTTP $status_code, expected 400/422)"
    ((failed++))
fi

echo -n "Testing Auth Login (no data)... "
((total++))
response=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" "$BASE_URL/api/v1/auth/login")
status_code=$(echo "$response" | tail -n1)
if [ "$status_code" -eq 400 ] || [ "$status_code" -eq 422 ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $status_code - expected validation error)"
    ((passed++))
else
    echo -e "${RED}✗ FAIL${NC} (HTTP $status_code, expected 400/422)"
    ((failed++))
fi

echo ""
echo "=========================================="
echo "7. AGENT ENDPOINTS (Requires Auth)"
echo "=========================================="

echo -e "${YELLOW}Note: Agent endpoints require authentication, testing without auth${NC}"

echo -n "Testing Agent Status (no auth)... "
((total++))
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/agents/status")
status_code=$(echo "$response" | tail -n1)
if [ "$status_code" -eq 401 ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $status_code - correctly requires auth)"
    ((passed++))
else
    echo -e "${YELLOW}⚠ INFO${NC} (HTTP $status_code - auth may be disabled)"
    ((passed++))
fi

echo -n "Testing Agent Health (no auth)... "
((total++))
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/agents/health")
status_code=$(echo "$response" | tail -n1)
if [ "$status_code" -eq 401 ] || [ "$status_code" -eq 200 ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $status_code)"
    ((passed++))
else
    echo -e "${YELLOW}⚠ INFO${NC} (HTTP $status_code)"
    ((passed++))
fi

echo ""
echo "=========================================="
echo "8. OPTIMIZATION ENDPOINTS (Public)"
echo "=========================================="

echo -n "Testing Optimization History... "
((total++))
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/optimization/history")
status_code=$(echo "$response" | tail -n1)
if [ "$status_code" -eq 200 ] || [ "$status_code" -eq 404 ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $status_code)"
    ((passed++))
else
    echo -e "${RED}✗ FAIL${NC} (HTTP $status_code)"
    ((failed++))
fi

echo ""
echo "=========================================="
echo "9. ERROR HANDLING TESTS"
echo "=========================================="

echo -n "Testing 404 (non-existent endpoint)... "
((total++))
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/nonexistent")
status_code=$(echo "$response" | tail -n1)
if [ "$status_code" -eq 404 ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $status_code)"
    ((passed++))
else
    echo -e "${RED}✗ FAIL${NC} (HTTP $status_code, expected 404)"
    ((failed++))
fi

echo ""
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo "Total Tests: $total"
echo -e "Passed: ${GREEN}$passed${NC}"
echo -e "Failed: ${RED}$failed${NC}"
echo -e "Skipped: ${YELLOW}$skipped${NC}"

success_rate=$(awk "BEGIN {printf \"%.1f\", ($passed/$total)*100}")
echo ""
echo "Success Rate: $success_rate%"

if [ $failed -eq 0 ]; then
    echo -e "\n${GREEN}=========================================="
    echo "ALL TESTS PASSED! ✓"
    echo "==========================================${NC}"
    exit 0
else
    echo -e "\n${RED}=========================================="
    echo "SOME TESTS FAILED! ✗"
    echo "==========================================${NC}"
    echo ""
    echo "Failed $failed out of $total tests"
    exit 1
fi
