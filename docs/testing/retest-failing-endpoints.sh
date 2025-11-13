#!/bin/bash
BASE_URL="https://route-opt-backend-426674819922.us-central1.run.app"

echo "Re-testing 9 endpoints that showed 404..."
echo "Waiting between requests to avoid rate limiting..."
echo ""

test() {
  local name="$1"
  local method="$2"
  local path="$3"
  
  printf "%-35s" "$name..."
  sleep 2  # Wait to avoid rate limiting
  
  if [ "$method" = "GET" ]; then
    response=$(timeout 5 curl -s "$BASE_URL$path" 2>/dev/null)
    code=$(timeout 5 curl -s -w "%{http_code}" -o /dev/null "$BASE_URL$path" 2>/dev/null)
  else
    response=$(timeout 5 curl -s -X "$method" "$BASE_URL$path" -H "Content-Type: application/json" -d '{}' 2>/dev/null)
    code=$(timeout 5 curl -s -w "%{http_code}" -o /dev/null -X "$method" "$BASE_URL$path" -H "Content-Type: application/json" -d '{}' 2>/dev/null)
  fi
  
  if [ "$code" = "404" ]; then
    echo "❌ 404 - NOT FOUND"
  elif [ "$code" = "429" ]; then
    echo "✅ $code - WORKING (rate limited)"
  elif [ -n "$code" ] && [ "$code" != "404" ]; then
    echo "✅ $code - WORKING"
  else
    echo "⚠️  TIMEOUT/NO RESPONSE"
  fi
}

echo "=== OPTIMIZATION (3 endpoints) ==="
test "multi-vehicle" "POST" "/api/v1/optimize/multi-vehicle"
test "time-windows" "POST" "/api/v1/optimize/time-windows"
test "stats" "GET" "/api/optimize/stats"

echo ""
echo "=== AGENTS (2 endpoints) ==="
test "status" "GET" "/api/v1/agents/status"
test "trigger" "POST" "/api/v1/agents/trigger"

echo ""
echo "=== AUTONOMOUS (1 endpoint) ==="
test "enable" "POST" "/api/v1/autonomous/enable"

echo ""
echo "=== ANALYTICS (3 endpoints) ==="
test "overview" "GET" "/api/v1/analytics/overview"
test "sla/daily" "GET" "/api/v1/analytics/sla/daily"
test "fleet/utilization" "GET" "/api/v1/analytics/fleet/utilization"

echo ""
echo "Done!"
