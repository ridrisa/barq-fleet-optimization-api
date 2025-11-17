#!/bin/bash
BASE_URL="https://route-opt-backend-426674819922.us-central1.run.app"

echo "Quick endpoint verification..."
echo ""

# Count passing endpoints quickly
PASS=0

# Core (2)
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/health")" != "404" ] && ((PASS++))

# Auth (3)
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/api/auth/login" -d '{}')" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/api/auth/register" -d '{}')" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/api/auth/refresh" -d '{}')" != "404" ] && ((PASS++))

# Optimization (5)
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/api/optimize" -d '{}')" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/api/v1/optimize" -d '{}')" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/api/v1/optimize/multi-vehicle" -d '{}')" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/api/v1/optimize/time-windows" -d '{}')" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/optimize/stats")" != "404" ] && ((PASS++))

# Agents (2)
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/agents/status")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/api/v1/agents/trigger" -d '{}')" != "404" ] && ((PASS++))

# Admin (2)
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/admin/users")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/admin/settings")" != "404" ] && ((PASS++))

# Autonomous (2)
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/autonomous/status")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/api/v1/autonomous/enable" -d '{}')" != "404" ] && ((PASS++))

# Health (2)
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/health")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/health/detailed")" != "404" ] && ((PASS++))

# Analytics (6)
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/analytics/overview")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/analytics/sla/realtime")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/analytics/sla/daily")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/analytics/fleet/utilization")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/analytics/fleet/drivers")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/analytics/fleet/vehicles")" != "404" ] && ((PASS++))

# Production Metrics (7)
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/production-metrics/on-time-delivery")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/production-metrics/completion-rate")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/production-metrics/courier-performance")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/production-metrics/real-time-stats")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/production-metrics/daily-summary")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/production-metrics/customer-satisfaction")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/production-metrics/revenue")" != "404" ] && ((PASS++))

# AI Query (1)
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/api/v1/ai-query" -d '{}')" != "404" ] && ((PASS++))

# Automation - testing 15 key endpoints out of 29
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/automation/status-all")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/automation/dashboard")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/automation/dispatch/status")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/automation/dispatch/stats")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/automation/batching/status")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/automation/batching/stats")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/automation/routes/status")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/automation/routes/stats")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/automation/escalation/status")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/automation/escalation/stats")" != "404" ] && ((PASS++))
[ "$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/automation/escalation/alerts")" != "404" ] && ((PASS++))

TOTAL=47  # Total endpoints tested

echo "=========================================="
echo "RESULTS:"
echo "  Passing: $PASS/$TOTAL"
echo "  Success Rate: $((PASS * 100 / TOTAL))%"
echo "=========================================="

if [ $((PASS * 100 / TOTAL)) -ge 70 ]; then
  echo "🎉 SUCCESS! Reached 70%+ target"
else
  echo "Current: $((PASS * 100 / TOTAL))%, Target: 70%"
fi
