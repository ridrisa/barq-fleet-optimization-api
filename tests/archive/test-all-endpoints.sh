#!/bin/bash

# Comprehensive Endpoint Testing Script
# Tests all critical endpoints from the error report

BASE_URL="https://route-opt-backend-426674819922.us-central1.run.app"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

echo "=================================="
echo "BARQ Fleet API Endpoint Test"
echo "Timestamp: $TIMESTAMP"
echo "=================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=$3

    echo -n "Testing $name... "
    response=$(curl -s -w "\n%{http_code}" "$url")
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$status_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $status_code)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $status_code, expected $expected_status)"
        echo "  Response: $(echo $body | head -c 100)..."
        return 1
    fi
}

# Track results
total=0
passed=0
failed=0

echo "=================================="
echo "1. HEALTH CHECK ENDPOINTS"
echo "=================================="

# Basic health
test_endpoint "Basic Health Check" "$BASE_URL/health" 200
((total++)); [ $? -eq 0 ] && ((passed++)) || ((failed++))

# Detailed health
test_endpoint "Detailed Health Check" "$BASE_URL/api/v1/health/detailed" 200
((total++)); [ $? -eq 0 ] && ((passed++)) || ((failed++))

# Readiness probe
test_endpoint "Readiness Probe" "$BASE_URL/api/v1/health/ready" 200
((total++)); [ $? -eq 0 ] && ((passed++)) || ((failed++))

# Live probe
test_endpoint "Liveness Probe" "$BASE_URL/api/v1/health/live" 200
((total++)); [ $? -eq 0 ] && ((passed++)) || ((failed++))

echo ""
echo "=================================="
echo "2. ANALYTICS ENDPOINTS"
echo "=================================="

# SLA Realtime
test_endpoint "SLA Realtime Analytics" "$BASE_URL/api/v1/analytics/sla/realtime" 200
((total++)); [ $? -eq 0 ] && ((passed++)) || ((failed++))

echo ""
echo "=================================="
echo "3. API INFO ENDPOINTS"
echo "=================================="

# API root
test_endpoint "API Root" "$BASE_URL/api" 200
((total++)); [ $? -eq 0 ] && ((passed++)) || ((failed++))

# API v1 info
test_endpoint "API v1 Info" "$BASE_URL/api/v1" 200
((total++)); [ $? -eq 0 ] && ((passed++)) || ((failed++))

echo ""
echo "=================================="
echo "TEST SUMMARY"
echo "=================================="
echo "Total Tests: $total"
echo -e "Passed: ${GREEN}$passed${NC}"
echo -e "Failed: ${RED}$failed${NC}"

if [ $failed -eq 0 ]; then
    echo -e "\n${GREEN}ALL TESTS PASSED! ✓${NC}"
    exit 0
else
    echo -e "\n${RED}SOME TESTS FAILED! ✗${NC}"
    exit 1
fi
