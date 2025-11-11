#!/bin/bash

# Comprehensive Module Testing Script for BARQ Fleet API
# Tests all modules and provides detailed status report

BASE_URL="https://route-opt-backend-426674819922.us-central1.run.app"

echo "=========================================="
echo "BARQ Fleet API - Module Verification"
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Base URL: $BASE_URL"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL=0
PASSED=0
FAILED=0

test_module() {
    local module_name=$1
    local endpoint=$2
    local expected_status=$3

    TOTAL=$((TOTAL + 1))

    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$status_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} $module_name (HTTP $status_code)"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} $module_name (HTTP $status_code, expected $expected_status)"
        echo "  Response: $(echo $body | head -c 100)..."
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# 1. CORE SYSTEM MODULES
echo "=========================================="
echo "1. CORE SYSTEM MODULES"
echo "=========================================="
test_module "Health Check" "/health" 200
test_module "Detailed Health" "/api/v1/health/detailed" 200
test_module "Readiness Probe" "/api/v1/health/ready" 200
test_module "Liveness Probe" "/api/v1/health/live" 200
echo ""

# 2. DATABASE MODULE
echo "=========================================="
echo "2. DATABASE MODULE"
echo "=========================================="
response=$(curl -s "$BASE_URL/api/v1/health/detailed")
db_status=$(echo $response | grep -o '"database":{[^}]*}' | grep -o '"healthy":[^,}]*' | cut -d':' -f2)
if [ "$db_status" = "true" ]; then
    echo -e "${GREEN}✓ PASS${NC} Database Connection"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} Database Connection"
    FAILED=$((FAILED + 1))
fi
TOTAL=$((TOTAL + 1))
echo ""

# 3. AGENT MODULES
echo "=========================================="
echo "3. AGENT MODULES (14 agents)"
echo "=========================================="
agents_response=$(curl -s "$BASE_URL/api/v1/agents/status")
agents_healthy=$(echo $agents_response | grep -o '"healthy":[0-9]*' | cut -d':' -f2)
agents_unhealthy=$(echo $agents_response | grep -o '"unhealthy":[0-9]*' | cut -d':' -f2)

if [ ! -z "$agents_healthy" ] && [ "$agents_healthy" -ge 12 ]; then
    echo -e "${GREEN}✓ PASS${NC} Agent System ($agents_healthy/14 healthy)"
    PASSED=$((PASSED + 1))
else
    echo -e "${YELLOW}⚠ WARN${NC} Agent System ($agents_healthy/14 healthy, $agents_unhealthy unhealthy)"
    FAILED=$((FAILED + 1))
fi
TOTAL=$((TOTAL + 1))
echo ""

# 4. ANALYTICS MODULE
echo "=========================================="
echo "4. ANALYTICS MODULE"
echo "=========================================="
test_module "SLA Realtime" "/api/v1/analytics/sla/realtime" 200
test_module "SLA Compliance" "/api/v1/analytics/sla/compliance?days=7" 200
test_module "SLA Trend" "/api/v1/analytics/sla/trend?days=7" 200
test_module "Fleet Performance" "/api/v1/analytics/fleet-performance" 200
test_module "Dashboard Summary" "/api/v1/analytics/dashboard/summary" 200
echo ""

# 5. PRODUCTION METRICS MODULE
echo "=========================================="
echo "5. PRODUCTION METRICS MODULE"
echo "=========================================="
test_module "On-Time Delivery" "/api/v1/production-metrics/on-time-delivery" 200
test_module "Completion Rate" "/api/v1/production-metrics/completion-rate" 200
test_module "Cancellation Rate" "/api/v1/production-metrics/cancellation-rate" 200
test_module "Courier Performance" "/api/v1/production-metrics/courier-performance" 200
echo ""

# 6. AUTOMATION MODULES
echo "=========================================="
echo "6. AUTOMATION MODULES (8 engines)"
echo "=========================================="
test_module "Dispatch Status" "/api/v1/automation/dispatch/status" 200
test_module "Batching Status" "/api/v1/automation/batching/status" 200
test_module "Escalation Status" "/api/v1/automation/escalation/status" 200
test_module "Recovery Status" "/api/v1/automation/recovery/status" 200
test_module "Rebalancing Status" "/api/v1/automation/rebalancing/status" 200
test_module "Forecasting Status" "/api/v1/automation/forecasting/status" 200
test_module "Communication Status" "/api/v1/automation/communication/status" 200
test_module "Monitoring Status" "/api/v1/automation/monitoring/status" 200
echo ""

# 7. WEBSOCKET MODULE
echo "=========================================="
echo "7. WEBSOCKET MODULE"
echo "=========================================="
ws_status=$(echo $response | grep -o '"websocket":{[^}]*}' | grep -o '"healthy":[^,}]*' | cut -d':' -f2)
if [ "$ws_status" = "true" ]; then
    echo -e "${GREEN}✓ PASS${NC} WebSocket Server"
    PASSED=$((PASSED + 1))
else
    echo -e "${YELLOW}⚠ WARN${NC} WebSocket Server (may not be critical)"
    FAILED=$((FAILED + 1))
fi
TOTAL=$((TOTAL + 1))
echo ""

# SUMMARY
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo "Total Modules Tested: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}ALL MODULES WORKING! ✓${NC}"
    exit 0
else
    pass_rate=$((PASSED * 100 / TOTAL))
    if [ $pass_rate -ge 80 ]; then
        echo -e "${YELLOW}MOSTLY WORKING ($pass_rate% pass rate) ⚠${NC}"
        exit 0
    else
        echo -e "${RED}CRITICAL FAILURES ($pass_rate% pass rate) ✗${NC}"
        exit 1
    fi
fi
