#!/bin/bash
BASE_URL="https://route-opt-backend-426674819922.us-central1.run.app"

echo "Checking each endpoint individually..."
echo ""

check() {
  local name="$1"
  local method="$2"
  local path="$3"
  
  if [ "$method" = "GET" ]; then
    code=$(timeout 3 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL$path" 2>/dev/null)
  else
    code=$(timeout 3 curl -s -w "%{http_code}" -o /dev/null -X "$method" "$BASE_URL$path" -H "Content-Type: application/json" -d '{}' 2>/dev/null)
  fi
  
  if [ "$code" != "404" ] && [ -n "$code" ]; then
    echo "✅ $code - $name"
  else
    echo "❌ 404 - $name"
  fi
}

echo "=== CORE ==="
check "API v1" "GET" "/api/v1"
check "Health" "GET" "/api/health"

echo ""
echo "=== AUTH ==="
check "Login" "POST" "/api/auth/login"
check "Register" "POST" "/api/auth/register"
check "Refresh" "POST" "/api/auth/refresh"

echo ""
echo "=== OPTIMIZATION ==="
check "Basic optimize" "POST" "/api/optimize"
check "V1 optimize" "POST" "/api/v1/optimize"
check "Multi-vehicle" "POST" "/api/v1/optimize/multi-vehicle"
check "Time windows" "POST" "/api/v1/optimize/time-windows"
check "Stats" "GET" "/api/optimize/stats"

echo ""
echo "=== AGENTS ==="
check "Status" "GET" "/api/v1/agents/status"
check "Trigger" "POST" "/api/v1/agents/trigger"

echo ""
echo "=== ADMIN ==="
check "Users" "GET" "/api/v1/admin/users"
check "Settings" "GET" "/api/v1/admin/settings"

echo ""
echo "=== AUTONOMOUS ==="
check "Status" "GET" "/api/v1/autonomous/status"
check "Enable" "POST" "/api/v1/autonomous/enable"

echo ""
echo "=== HEALTH ==="
check "V1 health" "GET" "/api/v1/health"
check "Detailed" "GET" "/api/v1/health/detailed"

echo ""
echo "=== ANALYTICS ==="
check "Overview" "GET" "/api/v1/analytics/overview"
check "SLA realtime" "GET" "/api/v1/analytics/sla/realtime"
check "SLA daily" "GET" "/api/v1/analytics/sla/daily"
check "Fleet utilization" "GET" "/api/v1/analytics/fleet/utilization"
check "Fleet drivers" "GET" "/api/v1/analytics/fleet/drivers"
check "Fleet vehicles" "GET" "/api/v1/analytics/fleet/vehicles"

echo ""
echo "=== PRODUCTION METRICS ==="
check "On-time delivery" "GET" "/api/v1/production-metrics/on-time-delivery"
check "Completion rate" "GET" "/api/v1/production-metrics/completion-rate"
check "Courier perf" "GET" "/api/v1/production-metrics/courier-performance"
check "Real-time stats" "GET" "/api/v1/production-metrics/real-time-stats"
check "Daily summary" "GET" "/api/v1/production-metrics/daily-summary"
check "Customer sat" "GET" "/api/v1/production-metrics/customer-satisfaction"
check "Revenue" "GET" "/api/v1/production-metrics/revenue"

echo ""
echo "=== AI QUERY ==="
check "AI query" "POST" "/api/v1/ai-query"
