#!/bin/bash

echo "=========================================="
echo "  INVESTIGATING 9 FAILING ENDPOINTS"
echo "=========================================="
echo ""

echo "1. Checking if routes exist in code..."
echo "======================================="
echo ""

echo "Optimization routes:"
grep -n "multi-vehicle\|time-windows\|/stats" backend/src/routes/v1/optimization.routes.js | head -5 || echo "Not found in optimization.routes.js"

echo ""
echo "Agents routes:"
grep -n "agents/status\|agents/trigger" backend/src/routes/v1/agents.routes.js | head -5 || echo "Not found in agents.routes.js"

echo ""
echo "Autonomous routes:"
grep -n "autonomous/enable" backend/src/routes/v1/autonomous.routes.js | head -5 || echo "Not found in autonomous.routes.js"

echo ""
echo "Analytics routes:"
grep -n "overview\|sla/daily\|fleet/utilization" backend/src/routes/v1/analytics.routes.js | head -5 || echo "Not found in analytics.routes.js"

echo ""
echo "2. Checking optimization.routes.js structure:"
echo "============================================="
head -30 backend/src/routes/v1/optimization.routes.js | grep -E "router\.|const |module"

echo ""
echo "3. Testing /api/optimize vs /api/v1/optimize:"
echo "============================================="
curl -s -w "%{http_code}" -o /dev/null -X POST https://route-opt-backend-426674819922.us-central1.run.app/api/optimize -d '{}' 2>/dev/null
curl -s -w "%{http_code}" -o /dev/null -X POST https://route-opt-backend-426674819922.us-central1.run.app/api/v1/optimize -d '{}' 2>/dev/null
