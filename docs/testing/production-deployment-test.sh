#!/bin/bash

# Both production URLs
URL1="https://route-opt-backend-426674819922.us-central1.run.app"
URL2="https://route-opt-backend-sek7q2ajva-uc.a.run.app"

echo "=========================================="
echo "  PRODUCTION DEPLOYMENT TEST"
echo "=========================================="
echo ""
echo "Build: cc925eca (SUCCESS)"
echo "Commit: 8757d69 (automation routes fix)"
echo "Deployed: November 12, 2025 23:56 UTC"
echo ""

test_url() {
  local url=$1
  local name=$2
  
  echo "Testing: $name"
  echo "URL: $url"
  echo ""
  
  # Test core endpoints
  echo "1. API v1 info..."
  code=$(timeout 5 curl -s -w "%{http_code}" -o /dev/null "$url/api/v1" 2>/dev/null)
  [ "$code" = "200" ] && echo "   ✅ $code" || echo "   ❌ $code"
  
  sleep 1
  
  echo "2. Health check..."
  code=$(timeout 5 curl -s -w "%{http_code}" -o /dev/null "$url/api/health" 2>/dev/null)
  [ "$code" = "200" ] && echo "   ✅ $code" || echo "   ❌ $code"
  
  sleep 1
  
  echo "3. Automation status (KEY TEST)..."
  response=$(timeout 5 curl -s "$url/api/v1/automation/status-all" 2>/dev/null)
  code=$(timeout 5 curl -s -w "%{http_code}" -o /dev/null "$url/api/v1/automation/status-all" 2>/dev/null)
  if [ "$code" != "404" ]; then
    echo "   ✅ $code - Automation routes working!"
  else
    echo "   ❌ 404 - Automation routes NOT mounted"
  fi
  
  sleep 1
  
  echo "4. Automation dashboard..."
  code=$(timeout 5 curl -s -w "%{http_code}" -o /dev/null "$url/api/v1/automation/dashboard" 2>/dev/null)
  [ "$code" != "404" ] && echo "   ✅ $code" || echo "   ❌ $code"
  
  sleep 1
  
  echo "5. Production metrics..."
  code=$(timeout 5 curl -s -w "%{http_code}" -o /dev/null "$url/api/v1/production-metrics/on-time-delivery" 2>/dev/null)
  [ "$code" != "404" ] && echo "   ✅ $code" || echo "   ❌ $code"
  
  sleep 1
  
  echo "6. Analytics SLA..."
  code=$(timeout 5 curl -s -w "%{http_code}" -o /dev/null "$url/api/v1/analytics/sla/realtime" 2>/dev/null)
  [ "$code" != "404" ] && echo "   ✅ $code" || echo "   ❌ $code"
  
  echo ""
}

echo "=========================================="
echo "Testing URL #1 (Cloud Run domain)"
echo "=========================================="
echo ""
test_url "$URL1" "route-opt-backend (426674819922)"

echo "=========================================="
echo "Testing URL #2 (Service domain)"
echo "=========================================="
echo ""
test_url "$URL2" "route-opt-backend (sek7q2ajva)"

echo "=========================================="
echo "  DEPLOYMENT VERIFICATION COMPLETE"
echo "=========================================="
echo ""
echo "If all tests show ✅ (not 404), deployment is successful!"
echo ""
