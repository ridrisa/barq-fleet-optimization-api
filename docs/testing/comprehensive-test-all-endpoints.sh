#!/bin/bash

################################################################################
# Comprehensive API Endpoint Test Script
# Tests ALL 56+ endpoints across all categories
# Saves results to ninth-deployment-test-results.txt
################################################################################

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# API Base URL (defaults to localhost:3003 if not set)
# Usage: API_URL=https://your-deployment-url.com ./comprehensive-test-all-endpoints.sh
API_URL="${API_URL:-http://localhost:3003}"

# Result tracking
TOTAL_ENDPOINTS=0
PASSED_ENDPOINTS=0
FAILED_ENDPOINTS=0
declare -a FAILED_DETAILS

# Output file
OUTPUT_FILE="ninth-deployment-test-results.txt"

# Function to print section header
print_header() {
    echo ""
    echo -e "${CYAN}================================================================${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}================================================================${NC}"

    # Also write to file
    echo "" >> "$OUTPUT_FILE"
    echo "================================================================" >> "$OUTPUT_FILE"
    echo "  $1" >> "$OUTPUT_FILE"
    echo "================================================================" >> "$OUTPUT_FILE"
}

# Function to test endpoint
test_endpoint() {
    local METHOD=$1
    local ENDPOINT=$2
    local DESCRIPTION=$3
    local EXPECTED_STATUS=${4:-200}
    local PAYLOAD=${5:-""}

    TOTAL_ENDPOINTS=$((TOTAL_ENDPOINTS + 1))

    # Make request
    if [ "$METHOD" = "GET" ]; then
        RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL$ENDPOINT" 2>&1)
    elif [ "$METHOD" = "POST" ] || [ "$METHOD" = "PUT" ] || [ "$METHOD" = "PATCH" ] || [ "$METHOD" = "DELETE" ]; then
        if [ -n "$PAYLOAD" ]; then
            RESPONSE=$(curl -s -w "\n%{http_code}" -X $METHOD "$API_URL$ENDPOINT" \
                -H "Content-Type: application/json" \
                -d "$PAYLOAD" 2>&1)
        else
            RESPONSE=$(curl -s -w "\n%{http_code}" -X $METHOD "$API_URL$ENDPOINT" 2>&1)
        fi
    fi

    # Extract status code and body
    STATUS_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    # Check if status code matches expected
    if [ "$STATUS_CODE" = "$EXPECTED_STATUS" ]; then
        echo -e "  ${GREEN}✓${NC} $METHOD $ENDPOINT - $DESCRIPTION (Status: $STATUS_CODE)"
        echo "  ✓ $METHOD $ENDPOINT - $DESCRIPTION (Status: $STATUS_CODE)" >> "$OUTPUT_FILE"
        PASSED_ENDPOINTS=$((PASSED_ENDPOINTS + 1))
    else
        echo -e "  ${RED}✗${NC} $METHOD $ENDPOINT - $DESCRIPTION (Expected: $EXPECTED_STATUS, Got: $STATUS_CODE)"
        echo "  ✗ $METHOD $ENDPOINT - $DESCRIPTION (Expected: $EXPECTED_STATUS, Got: $STATUS_CODE)" >> "$OUTPUT_FILE"
        FAILED_ENDPOINTS=$((FAILED_ENDPOINTS + 1))

        # Extract error message
        ERROR_MSG=$(echo "$BODY" | jq -r '.error // .message // "No error message"' 2>/dev/null || echo "Unable to parse error")
        FAILED_DETAILS+=("$METHOD $ENDPOINT|Expected: $EXPECTED_STATUS, Got: $STATUS_CODE|$ERROR_MSG")
    fi
}

# Start output file
{
    echo "=========================================="
    echo "  COMPREHENSIVE API ENDPOINT TEST"
    echo "  Date: $(date)"
    echo "  API URL: $API_URL"
    echo "=========================================="
    echo ""
} > "$OUTPUT_FILE"

# Function to append to output
log_output() {
    echo -e "$1"
    echo -e "$1" >> "$OUTPUT_FILE"
}

################################################################################
# START TESTING
################################################################################

print_header "1. CORE API ENDPOINTS"

test_endpoint "GET" "/" "Root API Information" 200
test_endpoint "GET" "/health" "Health Check" 200
test_endpoint "GET" "/api/health" "API Health Check" 200
test_endpoint "GET" "/api/version" "API Version Information" 200
test_endpoint "GET" "/api" "API Information" 200
test_endpoint "GET" "/api/versions" "API Versions List" 200

################################################################################
print_header "2. API V1 ENDPOINTS"

test_endpoint "GET" "/api/v1" "V1 API Information" 200

################################################################################
print_header "3. HEALTH ENDPOINTS (14 endpoints"

test_endpoint "GET" "/api/v1/health" "V1 Health Check" 200
test_endpoint "GET" "/api/v1/health/live" "Liveness Probe" 200
test_endpoint "GET" "/api/v1/health/ready" "Readiness Probe" 200
test_endpoint "GET" "/api/v1/health/startup" "Startup Probe" 200
test_endpoint "GET" "/api/v1/health/detailed" "Detailed Health Status" 200
test_endpoint "GET" "/api/v1/health/info" "System Information" 200
test_endpoint "GET" "/api/v1/health/metrics" "Health Metrics" 200
test_endpoint "GET" "/api/v1/health/agents" "Agent Health Status" 200
test_endpoint "GET" "/api/v1/health/database" "Database Health" 200
test_endpoint "POST" "/api/v1/health/database/test" "Test Database Connection" 200
test_endpoint "GET" "/api/v1/health/cache" "Cache Health Status" 200
test_endpoint "POST" "/api/v1/health/cache/flush" "Flush Cache" 200
test_endpoint "GET" "/api/v1/health/dependencies" "External Dependencies Health" 200
test_endpoint "GET" "/api/v1/health/logs" "Recent System Logs" 200
test_endpoint "POST" "/api/v1/health/logs/clear" "Clear System Logs" 200

################################################################################
print_header "4. AUTH ENDPOINTS (6 endpoints"

test_endpoint "POST" "/api/v1/auth/register" "User Registration" 400 '{"email":"test@example.com"}'
test_endpoint "POST" "/api/v1/auth/login" "User Login" 400 '{"email":"test@example.com","password":"test123"}'
test_endpoint "POST" "/api/v1/auth/refresh" "Refresh Token" 401
test_endpoint "POST" "/api/v1/auth/logout" "User Logout" 200
test_endpoint "GET" "/api/v1/auth/me" "Get User Profile" 401
test_endpoint "POST" "/api/v1/auth/forgot-password" "Forgot Password" 400

################################################################################
print_header "5. OPTIMIZATION ENDPOINTS (5 endpoints"

test_endpoint "POST" "/api/v1/optimize" "Create Route Optimization" 400
test_endpoint "GET" "/api/v1/optimize/results" "Get Optimization Results" 200
test_endpoint "GET" "/api/v1/optimize/history" "Get Optimization History" 200
test_endpoint "DELETE" "/api/v1/optimize/cache" "Clear Optimization Cache" 200
test_endpoint "GET" "/api/v1/optimize/stats" "Get Optimization Statistics" 200

################################################################################
print_header "6. AGENT ENDPOINTS (16 endpoints"

test_endpoint "GET" "/api/v1/agents" "List All Agents" 401
test_endpoint "GET" "/api/v1/agents/health" "Agent Health Status" 401
test_endpoint "GET" "/api/v1/agents/status" "Agent Status Overview" 401
test_endpoint "GET" "/api/v1/agents/metrics" "Agent Metrics" 401
test_endpoint "POST" "/api/v1/agents/task" "Execute Agent Task" 401
test_endpoint "POST" "/api/v1/agents/collaboration" "Multi-Agent Collaboration" 401
test_endpoint "GET" "/api/v1/agents/notifications" "Get Agent Notifications" 401
test_endpoint "GET" "/api/v1/agents/events" "Get Agent Events" 401
test_endpoint "GET" "/api/v1/agents/audit-logs" "Get Agent Audit Logs" 401
test_endpoint "GET" "/api/v1/agents/performance" "Get Agent Performance" 401
test_endpoint "POST" "/api/v1/agents/route-planning/optimize" "Route Planning Optimization" 401
test_endpoint "POST" "/api/v1/agents/fleet-monitor/analyze" "Fleet Monitoring Analysis" 401
test_endpoint "POST" "/api/v1/agents/cost-optimizer/analyze" "Cost Optimization Analysis" 401
test_endpoint "POST" "/api/v1/agents/predictive-maintenance/predict" "Predictive Maintenance" 401
test_endpoint "POST" "/api/v1/agents/initialize" "Initialize Agent System" 401
test_endpoint "POST" "/api/v1/agents/shutdown" "Shutdown Agent System" 401

################################################################################
print_header "7. ADMIN ENDPOINTS (8 endpoints"

test_endpoint "GET" "/api/v1/admin/config" "Get System Configuration" 401
test_endpoint "GET" "/api/v1/admin/metrics" "Get System Metrics" 401
test_endpoint "GET" "/api/v1/admin/logs" "Get System Logs" 401
test_endpoint "GET" "/api/v1/admin/users" "List Users" 401
test_endpoint "GET" "/api/v1/admin/agents/status" "Get Agent Status (Admin)" 200
test_endpoint "GET" "/api/v1/admin/agents/performance" "Get Agent Performance (Admin)" 401
test_endpoint "POST" "/api/v1/admin/agents/restart" "Restart Agents" 401
test_endpoint "GET" "/api/v1/admin/cache/stats" "Get Cache Statistics" 401

################################################################################
print_header "8. AUTONOMOUS ENDPOINTS (17 endpoints"

test_endpoint "GET" "/api/v1/autonomous/status" "Get Autonomous Status" 200
test_endpoint "GET" "/api/v1/autonomous/orchestrator" "Get Orchestrator Status" 200
test_endpoint "GET" "/api/v1/autonomous/cycle-history" "Get Cycle History" 200
test_endpoint "POST" "/api/v1/autonomous/start" "Start Autonomous Operations" 200
test_endpoint "POST" "/api/v1/autonomous/stop" "Stop Autonomous Operations" 200
test_endpoint "GET" "/api/v1/autonomous/schedule" "Get Autonomous Schedule" 200
test_endpoint "GET" "/api/v1/autonomous/insights" "Get Autonomous Insights" 200
test_endpoint "GET" "/api/v1/autonomous/metrics" "Get Autonomous Metrics" 200
test_endpoint "POST" "/api/v1/autonomous/trigger" "Manual Trigger Autonomous Cycle" 200
test_endpoint "POST" "/api/v1/autonomous/action/:actionId/approve" "Approve Autonomous Action" 404
test_endpoint "POST" "/api/v1/autonomous/action/:actionId/reject" "Reject Autonomous Action" 404
test_endpoint "GET" "/api/v1/autonomous/pending-actions" "Get Pending Actions" 200
test_endpoint "GET" "/api/v1/autonomous/action-history" "Get Action History" 200
test_endpoint "GET" "/api/v1/autonomous/learning" "Get Learning Data" 200
test_endpoint "GET" "/api/v1/autonomous/recommendations" "Get Recommendations" 200
test_endpoint "POST" "/api/v1/autonomous/escalate" "Escalate Issue" 400
test_endpoint "POST" "/api/v1/autonomous/resolve" "Resolve Issue" 400
test_endpoint "GET" "/api/v1/autonomous/health" "Get Autonomous Health" 200

################################################################################
print_header "9. ANALYTICS ENDPOINTS (9 endpoints"

test_endpoint "GET" "/api/v1/analytics/sla/realtime" "Real-time SLA Analytics" 200
test_endpoint "GET" "/api/v1/analytics/sla/compliance" "SLA Compliance Analytics" 200
test_endpoint "GET" "/api/v1/analytics/sla/trend" "SLA Trend Analytics" 200
test_endpoint "GET" "/api/v1/analytics/fleet/performance" "Fleet Performance Analytics" 200
test_endpoint "GET" "/api/v1/analytics/dashboard/summary" "Dashboard Summary" 200
test_endpoint "GET" "/api/v1/analytics/fleet/drivers" "Driver Analytics" 200
test_endpoint "GET" "/api/v1/analytics/fleet/drivers/123" "Specific Driver Analytics" 404
test_endpoint "GET" "/api/v1/analytics/fleet/vehicles" "Vehicle Analytics" 200
test_endpoint "GET" "/api/v1/analytics/routes/efficiency" "Route Efficiency Analytics" 200

################################################################################
print_header "10. PRODUCTION METRICS ENDPOINTS (11 endpoints"

test_endpoint "GET" "/api/v1/production-metrics/on-time-delivery" "On-Time Delivery Metrics" 200
test_endpoint "GET" "/api/v1/production-metrics/completion-rate" "Completion Rate Metrics" 200
test_endpoint "GET" "/api/v1/production-metrics/delivery-time" "Delivery Time Metrics" 200
test_endpoint "GET" "/api/v1/production-metrics/courier-performance" "Courier Performance Metrics" 200
test_endpoint "GET" "/api/v1/production-metrics/cancellation-rate" "Cancellation Rate Metrics" 200
test_endpoint "GET" "/api/v1/production-metrics/return-rate" "Return Rate Metrics" 200
test_endpoint "GET" "/api/v1/production-metrics/fleet-utilization" "Fleet Utilization Metrics" 200
test_endpoint "GET" "/api/v1/production-metrics/order-distribution" "Order Distribution Metrics" 200
test_endpoint "GET" "/api/v1/production-metrics/comprehensive" "Comprehensive Metrics" 200
test_endpoint "GET" "/api/v1/production-metrics/sla/at-risk" "SLA At-Risk Orders" 200
test_endpoint "GET" "/api/v1/production-metrics/sla/compliance" "SLA Compliance Metrics" 200

################################################################################
print_header "11. AI QUERY ENDPOINTS (6 endpoints"

test_endpoint "GET" "/api/v1/ai-query/catalog" "Get Query Catalog" 200
test_endpoint "GET" "/api/v1/ai-query/categories" "Get Query Categories" 200
test_endpoint "POST" "/api/v1/ai-query/execute" "Execute AI Query" 400
test_endpoint "POST" "/api/v1/ai-query/execute-batch" "Execute Batch Queries" 400
test_endpoint "POST" "/api/v1/ai-query/ask" "Ask AI Natural Language" 400
test_endpoint "GET" "/api/v1/ai-query/query/fleet-status" "Get Specific Query" 404

################################################################################
print_header "12. AUTOMATION ENDPOINTS (29 endpoints"

# Dispatch Automation
test_endpoint "POST" "/api/v1/automation/dispatch/start" "Start Dispatch Automation" 200
test_endpoint "POST" "/api/v1/automation/dispatch/stop" "Stop Dispatch Automation" 200
test_endpoint "GET" "/api/v1/automation/dispatch/status" "Get Dispatch Status" 200
test_endpoint "GET" "/api/v1/automation/dispatch/stats" "Get Dispatch Stats" 200
test_endpoint "POST" "/api/v1/automation/dispatch/assign/order123" "Assign Order to Courier" 404

# Route Automation
test_endpoint "POST" "/api/v1/automation/routes/start" "Start Route Automation" 200
test_endpoint "POST" "/api/v1/automation/routes/stop" "Stop Route Automation" 200
test_endpoint "GET" "/api/v1/automation/routes/status" "Get Route Status" 200
test_endpoint "GET" "/api/v1/automation/routes/stats" "Get Route Stats" 200
test_endpoint "POST" "/api/v1/automation/routes/optimize/driver123" "Optimize Driver Route" 404
test_endpoint "POST" "/api/v1/automation/routes/traffic-incident" "Handle Traffic Incident" 400

# Batching Automation
test_endpoint "POST" "/api/v1/automation/batching/start" "Start Batching Automation" 200
test_endpoint "POST" "/api/v1/automation/batching/stop" "Stop Batching Automation" 200
test_endpoint "GET" "/api/v1/automation/batching/status" "Get Batching Status" 200
test_endpoint "GET" "/api/v1/automation/batching/stats" "Get Batching Stats" 200
test_endpoint "POST" "/api/v1/automation/batching/process" "Process Batch" 400
test_endpoint "GET" "/api/v1/automation/batching/batch/batch123" "Get Batch Details" 404

# Escalation Automation
test_endpoint "POST" "/api/v1/automation/escalation/start" "Start Escalation Automation" 200
test_endpoint "POST" "/api/v1/automation/escalation/stop" "Stop Escalation Automation" 200
test_endpoint "GET" "/api/v1/automation/escalation/status" "Get Escalation Status" 200
test_endpoint "GET" "/api/v1/automation/escalation/stats" "Get Escalation Stats" 200
test_endpoint "GET" "/api/v1/automation/escalation/logs" "Get Escalation Logs" 200
test_endpoint "GET" "/api/v1/automation/escalation/alerts" "Get Escalation Alerts" 200
test_endpoint "POST" "/api/v1/automation/escalation/alerts/alert123/resolve" "Resolve Alert" 404
test_endpoint "GET" "/api/v1/automation/escalation/at-risk-orders" "Get At-Risk Orders" 200

# Global Automation
test_endpoint "POST" "/api/v1/automation/start-all" "Start All Automation Engines" 200
test_endpoint "POST" "/api/v1/automation/stop-all" "Stop All Automation Engines" 200
test_endpoint "GET" "/api/v1/automation/status-all" "Get All Engine Status" 200
test_endpoint "GET" "/api/v1/automation/dashboard" "Get Automation Dashboard" 200

################################################################################
# SUMMARY
################################################################################

log_output ""
print_header "TEST SUMMARY"
log_output ""
log_output "Total Endpoints Tested: $TOTAL_ENDPOINTS"
log_output "Passed: ${GREEN}✓ $PASSED_ENDPOINTS${NC}"
log_output "Failed: ${RED}✗ $FAILED_ENDPOINTS${NC}"

# Calculate success rate
SUCCESS_RATE=$(awk "BEGIN {printf \"%.2f\", ($PASSED_ENDPOINTS / $TOTAL_ENDPOINTS) * 100}")
log_output "Success Rate: $SUCCESS_RATE%"

# Category breakdown
log_output ""
log_output "CATEGORY BREAKDOWN:"
log_output "  Core API: 6 endpoints"
log_output "  Health: 14 endpoints"
log_output "  Auth: 6 endpoints"
log_output "  Optimization: 5 endpoints"
log_output "  Agents: 16 endpoints"
log_output "  Admin: 8 endpoints"
log_output "  Autonomous: 17 endpoints"
log_output "  Analytics: 9 endpoints"
log_output "  Production Metrics: 11 endpoints"
log_output "  AI Query: 6 endpoints"
log_output "  Automation: 29 endpoints"
log_output ""

# Failed endpoints details
if [ $FAILED_ENDPOINTS -gt 0 ]; then
    log_output ""
    print_header "FAILED ENDPOINTS DETAILS"
    log_output ""

    for detail in "${FAILED_DETAILS[@]}"; do
        IFS='|' read -r endpoint status error <<< "$detail"
        log_output "${RED}✗${NC} $endpoint"
        log_output "   Status: $status"
        log_output "   Error: $error"
        log_output ""
    done
fi

log_output ""
log_output "Full results saved to: $OUTPUT_FILE"
log_output ""

# Exit with appropriate code
if [ $FAILED_ENDPOINTS -eq 0 ]; then
    log_output "${GREEN}All tests passed!${NC}"
    exit 0
else
    log_output "${YELLOW}Some tests failed. Please review the details above.${NC}"
    exit 1
fi
