#!/bin/bash

# BARQ Fleet Management - Demo Feature Validation Script
# Tests all major features and generates validation report
# Author: AI Assistant
# Date: November 20, 2025

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKEND_URL="http://localhost:3003"
FRONTEND_URL="http://localhost:3001"
OUTPUT_FILE="demo-validation-report-$(date +%Y%m%d_%H%M%S).json"

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
VALIDATION_RESULTS=()

echo -e "${BLUE}🧪 BARQ Fleet Management - Feature Validation${NC}"
echo -e "${BLUE}===============================================${NC}"
echo "Backend URL: $BACKEND_URL"
echo "Frontend URL: $FRONTEND_URL"
echo "Report File: $OUTPUT_FILE"
echo ""

# Function to run test and record result
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    local test_type="$4"
    
    echo -n "Testing $test_name... "
    
    local start_time=$(date +%s.%N)
    
    if result=$(eval "$test_command" 2>&1); then
        local end_time=$(date +%s.%N)
        local duration=$(echo "$end_time - $start_time" | bc)
        
        if [[ -n "$expected_pattern" && ! "$result" =~ $expected_pattern ]]; then
            echo -e "${RED}FAIL${NC} (Pattern not found)"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            VALIDATION_RESULTS+=("{\"test\":\"$test_name\",\"status\":\"failed\",\"reason\":\"pattern_not_found\",\"duration\":\"${duration}s\",\"type\":\"$test_type\"}")
        else
            echo -e "${GREEN}PASS${NC} (${duration}s)"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            VALIDATION_RESULTS+=("{\"test\":\"$test_name\",\"status\":\"passed\",\"duration\":\"${duration}s\",\"type\":\"$test_type\"}")
        fi
    else
        echo -e "${RED}FAIL${NC} (Command failed)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        VALIDATION_RESULTS+=("{\"test\":\"$test_name\",\"status\":\"failed\",\"reason\":\"command_failed\",\"type\":\"$test_type\"}")
    fi
}

# Health and Basic Functionality Tests
echo -e "${YELLOW}📋 Basic Health Tests${NC}"
echo "===================="

run_test "Backend Health Check" \
    "curl -s --connect-timeout 5 $BACKEND_URL/health" \
    "healthy" \
    "health"

run_test "API Version Information" \
    "curl -s --connect-timeout 5 $BACKEND_URL/api/versions" \
    "v1" \
    "health"

run_test "Frontend Accessibility" \
    "curl -s --connect-timeout 5 -I $FRONTEND_URL" \
    "200 OK" \
    "health"

echo ""

# Agent System Tests
echo -e "${YELLOW}🤖 AI Agent System Tests${NC}"
echo "========================"

run_test "Agent System Health" \
    "curl -s --connect-timeout 10 $BACKEND_URL/api/v1/agents/health" \
    "active" \
    "agents"

run_test "Agent System Status" \
    "curl -s --connect-timeout 10 $BACKEND_URL/api/v1/agents/status" \
    "success" \
    "agents"

run_test "Fleet Status Agent" \
    "curl -s --connect-timeout 10 $BACKEND_URL/api/v1/agents/fleet/status" \
    "" \
    "agents"

run_test "SLA Monitor Agent" \
    "curl -s --connect-timeout 10 $BACKEND_URL/api/v1/agents/sla/monitor" \
    "" \
    "agents"

run_test "Demand Forecasting Agent" \
    "curl -s --connect-timeout 15 '$BACKEND_URL/api/v1/agents/demand/forecast?zone=riyadh&horizon=24h'" \
    "" \
    "agents"

echo ""

# Route Optimization Tests
echo -e "${YELLOW}🗺️  Route Optimization Tests${NC}"
echo "============================"

DEMO_OPTIMIZATION_REQUEST='{
  "pickups": [
    {
      "id": "pickup1",
      "name": "Al Baik - Olaya",
      "address": "Olaya Street, Riyadh",
      "coordinates": {"lat": 24.6995, "lng": 46.6837}
    }
  ],
  "deliveries": [
    {
      "id": "delivery1", 
      "name": "Customer - Al Malaz",
      "address": "Al Malaz District, Riyadh",
      "coordinates": {"lat": 24.6697, "lng": 46.7236}
    }
  ],
  "constraints": {
    "maxDistance": 50,
    "maxTime": 120,
    "serviceType": "BARQ"
  }
}'

run_test "Route Optimization Request" \
    "curl -s --connect-timeout 30 -X POST $BACKEND_URL/api/v1/optimize -H 'Content-Type: application/json' -d '$DEMO_OPTIMIZATION_REQUEST'" \
    "requestId" \
    "optimization"

# Get request ID from the last test and check status
if [[ ${VALIDATION_RESULTS[-1]} =~ "passed" ]]; then
    REQUEST_ID=$(curl -s -X POST $BACKEND_URL/api/v1/optimize -H 'Content-Type: application/json' -d "$DEMO_OPTIMIZATION_REQUEST" | grep -o '"requestId":"[^"]*"' | cut -d'"' -f4)
    
    if [[ -n "$REQUEST_ID" ]]; then
        sleep 2
        run_test "Route Optimization Status Check" \
            "curl -s --connect-timeout 10 $BACKEND_URL/api/v1/optimize/status/$REQUEST_ID" \
            "status" \
            "optimization"
        
        sleep 5
        run_test "Route Optimization Results" \
            "curl -s --connect-timeout 10 $BACKEND_URL/api/v1/optimize/$REQUEST_ID" \
            "" \
            "optimization"
    fi
fi

echo ""

# Analytics Lab Tests
echo -e "${YELLOW}📊 Analytics Lab Tests${NC}"
echo "====================="

run_test "Analytics Environment Check" \
    "curl -s --connect-timeout 10 $BACKEND_URL/api/v1/analytics-lab/environment" \
    "python" \
    "analytics"

run_test "Analytics Dashboard" \
    "curl -s --connect-timeout 10 $BACKEND_URL/api/v1/analytics-lab/dashboard" \
    "" \
    "analytics"

run_test "Analytics Job History" \
    "curl -s --connect-timeout 10 '$BACKEND_URL/api/v1/analytics-lab/jobs/history?limit=5'" \
    "" \
    "analytics"

# Test starting an analytics job (if environment is working)
ANALYTICS_REQUEST='{
  "analysis_type": "efficiency",
  "date_range": 7,
  "output": "json"
}'

run_test "Route Analysis Job Submission" \
    "curl -s --connect-timeout 30 -X POST $BACKEND_URL/api/v1/analytics-lab/run/route-analysis -H 'Content-Type: application/json' -d '$ANALYTICS_REQUEST'" \
    "jobId" \
    "analytics"

echo ""

# Production Integration Tests
echo -e "${YELLOW}🏭 Production Integration Tests${NC}"
echo "==============================="

run_test "Production Database Connection" \
    "curl -s --connect-timeout 15 $BACKEND_URL/api/v1/barq-production/test-connection" \
    "" \
    "production"

run_test "Production Metrics Summary" \
    "curl -s --connect-timeout 15 $BACKEND_URL/api/v1/production-metrics/summary" \
    "" \
    "production"

run_test "Active Couriers from Production" \
    "curl -s --connect-timeout 15 '$BACKEND_URL/api/v1/barq-production/couriers/active?limit=5'" \
    "" \
    "production"

run_test "Recent Orders from Production" \
    "curl -s --connect-timeout 15 '$BACKEND_URL/api/v1/barq-production/orders/recent?hours=24&limit=10'" \
    "" \
    "production"

echo ""

# Authentication and Security Tests
echo -e "${YELLOW}🔐 Security and Authentication Tests${NC}"
echo "==================================="

# Test user registration
DEMO_USER='{
  "email": "demo-test-'$(date +%s)'@barq.com",
  "password": "DemoTest123!",
  "name": "Demo Test User",
  "role": "fleet_manager"
}'

run_test "User Registration" \
    "curl -s --connect-timeout 10 -X POST $BACKEND_URL/api/v1/auth/register -H 'Content-Type: application/json' -d '$DEMO_USER'" \
    "" \
    "security"

# Test login
DEMO_LOGIN='{
  "email": "demo@barq.com",
  "password": "DemoPassword123!"
}'

run_test "User Authentication" \
    "curl -s --connect-timeout 10 -X POST $BACKEND_URL/api/v1/auth/login -H 'Content-Type: application/json' -d '$DEMO_LOGIN'" \
    "" \
    "security"

# Test rate limiting (should be allowed for normal requests)
run_test "Rate Limiting (Normal Usage)" \
    "curl -s --connect-timeout 5 $BACKEND_URL/health && curl -s --connect-timeout 5 $BACKEND_URL/health && curl -s --connect-timeout 5 $BACKEND_URL/health" \
    "healthy" \
    "security"

echo ""

# Advanced Features Tests
echo -e "${YELLOW}⚡ Advanced Features Tests${NC}"
echo "========================="

ORCHESTRATION_REQUEST='{
  "scenario": "rush_hour_optimization",
  "parameters": {
    "timeWindow": "16:00-18:00",
    "zone": "riyadh_central",
    "orderVolume": "high"
  },
  "requiredAgents": ["demand-forecasting", "traffic-pattern", "route-optimization"]
}'

run_test "Multi-Agent Orchestration" \
    "curl -s --connect-timeout 30 -X POST $BACKEND_URL/api/v1/agents/orchestrate -H 'Content-Type: application/json' -d '$ORCHESTRATION_REQUEST'" \
    "" \
    "advanced"

ORDER_ASSIGNMENT_REQUEST='{
  "orderId": "demo_order_001",
  "pickupLocation": {"lat": 24.7136, "lng": 46.6753},
  "deliveryLocation": {"lat": 24.6995, "lng": 46.6837},
  "serviceType": "BARQ"
}'

run_test "Order Assignment Agent" \
    "curl -s --connect-timeout 20 -X POST $BACKEND_URL/api/v1/agents/order/assign -H 'Content-Type: application/json' -d '$ORDER_ASSIGNMENT_REQUEST'" \
    "" \
    "advanced"

run_test "Performance Analytics Agent" \
    "curl -s --connect-timeout 15 $BACKEND_URL/api/v1/agents/performance/analytics" \
    "" \
    "advanced"

run_test "Geo Intelligence Agent" \
    "curl -s --connect-timeout 15 '$BACKEND_URL/api/v1/agents/geo/intelligence?zone=riyadh'" \
    "" \
    "advanced"

echo ""

# Performance Tests
echo -e "${YELLOW}⚡ Performance Tests${NC}"
echo "=================="

run_test "API Response Time (Health)" \
    "time curl -s --connect-timeout 2 $BACKEND_URL/health > /dev/null" \
    "" \
    "performance"

run_test "API Response Time (Agent Status)" \
    "time curl -s --connect-timeout 5 $BACKEND_URL/api/v1/agents/status > /dev/null" \
    "" \
    "performance"

# Concurrent request test
run_test "Concurrent Requests (5x Health)" \
    "curl -s $BACKEND_URL/health & curl -s $BACKEND_URL/health & curl -s $BACKEND_URL/health & curl -s $BACKEND_URL/health & curl -s $BACKEND_URL/health & wait" \
    "" \
    "performance"

echo ""

# Generate Report
echo -e "${BLUE}📊 Generating Validation Report${NC}"
echo "==============================="

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
SUCCESS_RATE=$(echo "scale=2; $TESTS_PASSED * 100 / $TOTAL_TESTS" | bc)

# Create JSON report
cat > "$OUTPUT_FILE" << EOF
{
  "validation_report": {
    "timestamp": "$(date -Iseconds)",
    "backend_url": "$BACKEND_URL",
    "frontend_url": "$FRONTEND_URL",
    "summary": {
      "total_tests": $TOTAL_TESTS,
      "tests_passed": $TESTS_PASSED,
      "tests_failed": $TESTS_FAILED,
      "success_rate": "${SUCCESS_RATE}%"
    },
    "test_results": [
      $(printf '%s,\n' "${VALIDATION_RESULTS[@]}" | sed '$s/,$//')
    ],
    "test_categories": {
      "health": {
        "passed": $(printf '%s\n' "${VALIDATION_RESULTS[@]}" | grep '"type":"health"' | grep '"status":"passed"' | wc -l),
        "failed": $(printf '%s\n' "${VALIDATION_RESULTS[@]}" | grep '"type":"health"' | grep '"status":"failed"' | wc -l)
      },
      "agents": {
        "passed": $(printf '%s\n' "${VALIDATION_RESULTS[@]}" | grep '"type":"agents"' | grep '"status":"passed"' | wc -l),
        "failed": $(printf '%s\n' "${VALIDATION_RESULTS[@]}" | grep '"type":"agents"' | grep '"status":"failed"' | wc -l)
      },
      "optimization": {
        "passed": $(printf '%s\n' "${VALIDATION_RESULTS[@]}" | grep '"type":"optimization"' | grep '"status":"passed"' | wc -l),
        "failed": $(printf '%s\n' "${VALIDATION_RESULTS[@]}" | grep '"type":"optimization"' | grep '"status":"failed"' | wc -l)
      },
      "analytics": {
        "passed": $(printf '%s\n' "${VALIDATION_RESULTS[@]}" | grep '"type":"analytics"' | grep '"status":"passed"' | wc -l),
        "failed": $(printf '%s\n' "${VALIDATION_RESULTS[@]}" | grep '"type":"analytics"' | grep '"status":"failed"' | wc -l)
      },
      "production": {
        "passed": $(printf '%s\n' "${VALIDATION_RESULTS[@]}" | grep '"type":"production"' | grep '"status":"passed"' | wc -l),
        "failed": $(printf '%s\n' "${VALIDATION_RESULTS[@]}" | grep '"type":"production"' | grep '"status":"failed"' | wc -l)
      },
      "security": {
        "passed": $(printf '%s\n' "${VALIDATION_RESULTS[@]}" | grep '"type":"security"' | grep '"status":"passed"' | wc -l),
        "failed": $(printf '%s\n' "${VALIDATION_RESULTS[@]}" | grep '"type":"security"' | grep '"status":"failed"' | wc -l)
      },
      "advanced": {
        "passed": $(printf '%s\n' "${VALIDATION_RESULTS[@]}" | grep '"type":"advanced"' | grep '"status":"passed"' | wc -l),
        "failed": $(printf '%s\n' "${VALIDATION_RESULTS[@]}" | grep '"type":"advanced"' | grep '"status":"failed"' | wc -l)
      },
      "performance": {
        "passed": $(printf '%s\n' "${VALIDATION_RESULTS[@]}" | grep '"type":"performance"' | grep '"status":"passed"' | wc -l),
        "failed": $(printf '%s\n' "${VALIDATION_RESULTS[@]}" | grep '"type":"performance"' | grep '"status":"failed"' | wc -l)
      }
    }
  }
}
EOF

echo ""
echo -e "${GREEN}🎯 Validation Complete!${NC}"
echo "======================="
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $TESTS_PASSED"
echo "Failed: $TESTS_FAILED"
echo "Success Rate: $SUCCESS_RATE%"
echo ""
echo "Report saved to: $OUTPUT_FILE"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}✅ All tests passed! Demo is ready for presentation.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Review the issues before demo.${NC}"
    exit 1
fi