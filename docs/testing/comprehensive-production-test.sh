#!/bin/bash

# Comprehensive Production Endpoint Test Suite
# Tests all endpoints and reports failures

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# URLs
BACKEND_URL="https://route-opt-backend-sek7q2ajva-uc.a.run.app"
ANALYTICS_URL="https://route-opt-analytics-sek7q2ajva-uc.a.run.app"
FRONTEND_URL="https://route-opt-frontend-sek7q2ajva-uc.a.run.app"

PASSED=0
FAILED=0
FAILURES=()

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Production Endpoint Test Suite       ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo ""

# Helper function to test endpoint
test_endpoint() {
  local name="$1"
  local url="$2"
  local expected="$3"
  local method="${4:-GET}"

  echo -ne "Testing ${name}... "

  if [ "$method" = "GET" ]; then
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
  else
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$url" -H "Content-Type: application/json" -d '{}' 2>/dev/null)
  fi

  if [ "$RESPONSE" = "$expected" ]; then
    echo -e "${GREEN}✅ PASS${NC} (HTTP $RESPONSE)"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC} (HTTP $RESPONSE, expected $expected)"
    ((FAILED++))
    FAILURES+=("$name|$url|$RESPONSE|$expected")
  fi
}

# Test endpoint with JSON validation
test_json_endpoint() {
  local name="$1"
  local url="$2"
  local check="$3"

  echo -ne "Testing ${name}... "

  RESPONSE=$(curl -s "$url" 2>/dev/null)

  if echo "$RESPONSE" | grep -q "$check"; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC} (Missing: $check)"
    ((FAILED++))
    FAILURES+=("$name|$url|Missing JSON key: $check")
  fi
}

echo -e "${YELLOW}━━━ Frontend Tests ━━━${NC}"
test_endpoint "Frontend Home" "$FRONTEND_URL" "200"
test_endpoint "Frontend 404 Check" "$FRONTEND_URL/nonexistent" "404"

echo ""
echo -e "${YELLOW}━━━ Backend Core Tests ━━━${NC}"
test_endpoint "Backend Root" "$BACKEND_URL/" "200"
test_endpoint "Backend Health" "$BACKEND_URL/api/health" "200"
test_endpoint "Backend Version" "$BACKEND_URL/api/version" "200"

echo ""
echo -e "${YELLOW}━━━ Optimization API Tests ━━━${NC}"
test_json_endpoint "Optimization Endpoint" "$BACKEND_URL/api/optimize" "success"
test_endpoint "Optimize POST" "$BACKEND_URL/api/optimize" "200" "POST"

echo ""
echo -e "${YELLOW}━━━ Analytics API Tests ━━━${NC}"
test_endpoint "Analytics Root" "$ANALYTICS_URL/" "200"
test_endpoint "Analytics Health" "$ANALYTICS_URL/api/health" "200"
test_endpoint "Analytics SLA Realtime" "$ANALYTICS_URL/api/sla/realtime" "200"
test_endpoint "Analytics Metrics" "$ANALYTICS_URL/api/metrics" "200"

echo ""
echo -e "${YELLOW}━━━ Database Tests ━━━${NC}"
test_endpoint "Database Status" "$BACKEND_URL/api/db/status" "200"

echo ""
echo -e "${YELLOW}━━━ Route Tests ━━━${NC}"
test_endpoint "Routes List" "$BACKEND_URL/api/routes" "200"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Test Summary                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}═══ Failed Tests ═══${NC}"
  for failure in "${FAILURES[@]}"; do
    IFS='|' read -r name url response expected <<< "$failure"
    echo -e "${RED}✗${NC} $name"
    echo -e "  URL: $url"
    echo -e "  Got: $response | Expected: $expected"
    echo ""
  done

  echo -e "${YELLOW}═══ Suggested Fixes ═══${NC}"
  echo "1. Add missing health endpoints to backend"
  echo "2. Check analytics service deployment"
  echo "3. Verify route handlers are registered"
  echo ""
  exit 1
else
  echo -e "${GREEN}🎉 All tests passed!${NC}"
  exit 0
fi
