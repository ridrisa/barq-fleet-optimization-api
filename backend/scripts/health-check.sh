#!/bin/bash

# Health Check Script for AI Route Optimization System
# Checks database, API, agents, and WebSocket server

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:3003}"
WS_URL="${WS_URL:-http://localhost:8081}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-barq_logistics}"

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║      System Health Check                      ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# Track overall health
OVERALL_HEALTHY=true

# 1. Check PostgreSQL Database
echo "🗄️  Checking PostgreSQL Database..."
if command -v pg_isready &> /dev/null; then
  if pg_isready -h "$DB_HOST" -p "$DB_PORT" &> /dev/null; then
    echo -e "   ${GREEN}✅ PostgreSQL is running${NC}"

    # Check if database exists
    if psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
      echo -e "   ${GREEN}✅ Database '$DB_NAME' exists${NC}"

      # Check table count
      TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')

      if [ -n "$TABLE_COUNT" ] && [ "$TABLE_COUNT" -gt 0 ]; then
        echo -e "   ${GREEN}✅ Database has $TABLE_COUNT tables${NC}"
      else
        echo -e "   ${YELLOW}⚠️  Database has no tables (schema not created?)${NC}"
        OVERALL_HEALTHY=false
      fi
    else
      echo -e "   ${RED}❌ Database '$DB_NAME' not found${NC}"
      OVERALL_HEALTHY=false
    fi
  else
    echo -e "   ${RED}❌ PostgreSQL is not responding${NC}"
    echo -e "   ${YELLOW}💡 Start PostgreSQL: brew services start postgresql${NC}"
    OVERALL_HEALTHY=false
  fi
else
  echo -e "   ${YELLOW}⚠️  pg_isready not found (PostgreSQL not installed?)${NC}"

  # Try to connect using Node.js
  if command -v node &> /dev/null; then
    echo "   Trying alternative connection check..."
    # This would require a small Node.js script
  fi

  OVERALL_HEALTHY=false
fi
echo ""

# 2. Check API Server
echo "🌐 Checking API Server..."
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" 2>/dev/null)

if [ "$API_RESPONSE" = "200" ]; then
  echo -e "   ${GREEN}✅ API Server is responding${NC}"

  # Get detailed health info
  API_HEALTH=$(curl -s "$API_URL/health" 2>/dev/null)

  if [ -n "$API_HEALTH" ]; then
    VERSION=$(echo "$API_HEALTH" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
    UPTIME=$(echo "$API_HEALTH" | grep -o '"uptime":[0-9.]*' | cut -d':' -f2)

    if [ -n "$VERSION" ]; then
      echo -e "   ${GREEN}✅ Version: $VERSION${NC}"
    fi

    if [ -n "$UPTIME" ]; then
      UPTIME_MINS=$(echo "scale=1; $UPTIME / 60" | bc 2>/dev/null)
      echo -e "   ${GREEN}✅ Uptime: ${UPTIME_MINS}m${NC}"
    fi
  fi
else
  echo -e "   ${RED}❌ API Server is not responding (HTTP $API_RESPONSE)${NC}"
  echo -e "   ${YELLOW}💡 Start API: cd backend && npm start${NC}"
  OVERALL_HEALTHY=false
fi
echo ""

# 3. Check Agent System
echo "🤖 Checking Agent System..."
AGENT_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/agents/status" 2>/dev/null)

if [ "$AGENT_RESPONSE" = "200" ]; then
  AGENT_STATUS=$(curl -s "$API_URL/api/agents/status" 2>/dev/null)

  if echo "$AGENT_STATUS" | grep -q '"isRunning":true'; then
    echo -e "   ${GREEN}✅ Agent system is running${NC}"

    # Count agents
    AGENT_COUNT=$(echo "$AGENT_STATUS" | grep -o '"registered":true' | wc -l | tr -d ' ')
    if [ -n "$AGENT_COUNT" ] && [ "$AGENT_COUNT" -gt 0 ]; then
      echo -e "   ${GREEN}✅ $AGENT_COUNT agents registered${NC}"
    fi
  else
    echo -e "   ${YELLOW}⚠️  Agent system is not running${NC}"
    echo -e "   ${YELLOW}💡 Agents will start automatically with API${NC}"
  fi
else
  echo -e "   ${YELLOW}⚠️  Cannot check agent status${NC}"
fi
echo ""

# 4. Check WebSocket Server
echo "🔌 Checking WebSocket Server..."
WS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$WS_URL/health" 2>/dev/null)

if [ "$WS_RESPONSE" = "200" ]; then
  echo -e "   ${GREEN}✅ WebSocket server is running${NC}"

  WS_HEALTH=$(curl -s "$WS_URL/health" 2>/dev/null)
  CLIENT_COUNT=$(echo "$WS_HEALTH" | grep -o '"clients":[0-9]*' | cut -d':' -f2)

  if [ -n "$CLIENT_COUNT" ]; then
    echo -e "   ${GREEN}✅ Connected clients: $CLIENT_COUNT${NC}"
  fi
else
  echo -e "   ${YELLOW}⚠️  WebSocket server is not responding${NC}"
  echo -e "   ${YELLOW}💡 This is optional for API operation${NC}"
fi
echo ""

# 5. Check System Resources
echo "💻 Checking System Resources..."

# Memory
if command -v free &> /dev/null; then
  MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100)}')

  if [ "$MEMORY_USAGE" -lt 80 ]; then
    echo -e "   ${GREEN}✅ Memory usage: ${MEMORY_USAGE}%${NC}"
  else
    echo -e "   ${YELLOW}⚠️  Memory usage: ${MEMORY_USAGE}% (high)${NC}"
  fi
elif command -v vm_stat &> /dev/null; then
  # macOS
  echo -e "   ${GREEN}ℹ️  Memory check (macOS detected)${NC}"
fi

# CPU
if command -v top &> /dev/null; then
  if command -v bc &> /dev/null; then
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}' 2>/dev/null)

    if [ -n "$CPU_USAGE" ]; then
      CPU_INT=$(echo "$CPU_USAGE" | cut -d'.' -f1)

      if [ "$CPU_INT" -lt 70 ]; then
        echo -e "   ${GREEN}✅ CPU usage: ${CPU_INT}%${NC}"
      else
        echo -e "   ${YELLOW}⚠️  CPU usage: ${CPU_INT}% (high)${NC}"
      fi
    fi
  fi
fi

# Disk
if command -v df &> /dev/null; then
  DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

  if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "   ${GREEN}✅ Disk usage: ${DISK_USAGE}%${NC}"
  else
    echo -e "   ${YELLOW}⚠️  Disk usage: ${DISK_USAGE}% (high)${NC}"
  fi
fi

echo ""

# 6. Check Node.js processes
echo "🔍 Checking Node.js Processes..."
NODE_PROCESSES=$(ps aux | grep -i "node" | grep -v "grep" | wc -l | tr -d ' ')

if [ "$NODE_PROCESSES" -gt 0 ]; then
  echo -e "   ${GREEN}✅ $NODE_PROCESSES Node.js process(es) running${NC}"
else
  echo -e "   ${RED}❌ No Node.js processes found${NC}"
  OVERALL_HEALTHY=false
fi
echo ""

# Final Summary
echo "╔═══════════════════════════════════════════════╗"
echo "║           Health Check Summary                ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

if [ "$OVERALL_HEALTHY" = true ]; then
  echo -e "${GREEN}✅ System Status: HEALTHY${NC}"
  echo ""
  echo "All critical components are functioning normally."
  echo ""
  exit 0
else
  echo -e "${RED}❌ System Status: UNHEALTHY${NC}"
  echo ""
  echo "Some components need attention. Review the issues above."
  echo ""
  echo "💡 Quick troubleshooting:"
  echo "   1. Start PostgreSQL: brew services start postgresql"
  echo "   2. Create database: createdb barq_logistics"
  echo "   3. Run schema: psql -d barq_logistics -f src/database/schema.sql"
  echo "   4. Start API: cd backend && npm start"
  echo "   5. Check logs: tail -f backend/logs/app.log"
  echo ""
  exit 1
fi
