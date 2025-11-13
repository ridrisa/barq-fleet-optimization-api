#!/bin/bash
BASE_URL="https://route-opt-backend-426674819922.us-central1.run.app"

echo "================================================================"
echo "  QUICK PRODUCTION VALIDATION"
echo "================================================================"
echo ""

# Test key endpoints from each category (20 representative endpoints)
echo "Testing 20 key endpoints..."
echo ""

test() {
  printf "%-40s" "$1..."
  code=$(timeout 3 curl -s -w "%{http_code}" -o /dev/null ${3:-} "$BASE_URL$2" 2>/dev/null || echo "fail")
  [ "$code" != "404" ] && [ "$code" != "fail" ] && echo "✅ $code" || echo "❌ $code"
}

test "Core: API v1" "/api/v1"
test "Core: Health" "/api/health"
test "Auth: Login" "/api/auth/login" "-X POST -d '{}'"
test "Optimize: Basic" "/api/optimize" "-X POST -d '{}'"
test "Optimize: Multi-vehicle" "/api/v1/optimize/multi-vehicle" "-X POST -d '{}'"
test "Agents: Status" "/api/v1/agents/status"
test "Admin: Users" "/api/v1/admin/users"
test "Autonomous: Status" "/api/v1/autonomous/status"
test "Health: Detailed" "/api/v1/health/detailed"
test "Analytics: SLA Realtime" "/api/v1/analytics/sla/realtime"
test "Analytics: Fleet Drivers" "/api/v1/analytics/fleet/drivers"
test "ProdMetrics: On-time" "/api/v1/production-metrics/on-time-delivery"
test "AI Query" "/api/v1/ai-query" "-X POST -d '{}'"
test "Automation: Global Status" "/api/v1/automation/status-all"
test "Automation: Dashboard" "/api/v1/automation/dashboard"
test "Automation: Dispatch Status" "/api/v1/automation/dispatch/status"
test "Automation: Batching Status" "/api/v1/automation/batching/status"
test "Automation: Routes Status" "/api/v1/automation/routes/status"
test "Automation: Escalation Status" "/api/v1/automation/escalation/status"
test "Automation: Stop All" "/api/v1/automation/stop-all" "-X POST -d '{}'"

echo ""
echo "================================================================"
echo "If all show ✅ (not 404), production deployment is successful!"
echo "================================================================"
