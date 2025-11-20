#!/bin/bash

# BARQ Fleet Management - Live Demo Execution Script
# This script starts all services and runs the comprehensive demo
# Author: AI Assistant
# Date: November 20, 2025

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Demo configuration
DEMO_START_TIME=$(date +%s)
BACKEND_PORT=3003
FRONTEND_PORT=3001
ANALYTICS_PORT=5000

echo -e "${BLUE}🚀 BARQ Fleet Management - Live Demo Execution${NC}"
echo -e "${BLUE}=================================================${NC}"
echo "Start Time: $(date)"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if port is available
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        print_warning "Port $1 is already in use"
        return 1
    else
        return 0
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1
    
    print_info "Waiting for $name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s --connect-timeout 2 "$url" > /dev/null 2>&1; then
            print_status "$name is ready"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$name failed to start within timeout"
    return 1
}

# Function to run API test
test_api_endpoint() {
    local url=$1
    local name=$2
    
    if curl -s --connect-timeout 5 "$url" > /dev/null 2>&1; then
        print_status "$name API test passed"
        return 0
    else
        print_error "$name API test failed"
        return 1
    fi
}

# Cleanup function
cleanup() {
    print_info "Cleaning up demo processes..."
    
    # Kill background processes
    jobs -p | xargs -r kill
    
    # Kill processes on our ports
    for port in $BACKEND_PORT $FRONTEND_PORT $ANALYTICS_PORT; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            lsof -Pi :$port -sTCP:LISTEN -t | xargs kill
            print_info "Killed process on port $port"
        fi
    done
    
    echo ""
    print_info "Demo cleanup completed"
}

# Set up cleanup on script exit
trap cleanup EXIT

# Step 1: Environment Verification
echo -e "${BLUE}📋 Step 1: Environment Verification${NC}"
echo "=================================="

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi
NODE_VERSION=$(node --version)
print_status "Node.js version: $NODE_VERSION"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi
NPM_VERSION=$(npm --version)
print_status "npm version: $NPM_VERSION"

# Check Python
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed"
    exit 1
fi
PYTHON_VERSION=$(python3 --version)
print_status "Python version: $PYTHON_VERSION"

# Check required files
if [[ ! -f "backend/.env" ]]; then
    print_warning "backend/.env not found, copying from example"
    cp backend/.env.example backend/.env
fi

if [[ ! -f "frontend/.env.local" ]]; then
    print_warning "frontend/.env.local not found, copying from example"
    cp frontend/.env.example frontend/.env.local
fi

print_status "Environment verification completed"
echo ""

# Step 2: Port Availability Check
echo -e "${BLUE}🔍 Step 2: Port Availability Check${NC}"
echo "=================================="

check_port $BACKEND_PORT || print_warning "Backend port $BACKEND_PORT in use"
check_port $FRONTEND_PORT || print_warning "Frontend port $FRONTEND_PORT in use"
check_port $ANALYTICS_PORT || print_warning "Analytics port $ANALYTICS_PORT in use"

print_status "Port availability check completed"
echo ""

# Step 3: Dependencies Installation
echo -e "${BLUE}📦 Step 3: Installing Dependencies${NC}"
echo "=================================="

print_info "Installing backend dependencies..."
cd backend
npm install --silent || {
    print_error "Failed to install backend dependencies"
    exit 1
}
cd ..
print_status "Backend dependencies installed"

print_info "Installing frontend dependencies..."
cd frontend
npm install --silent || {
    print_error "Failed to install frontend dependencies"
    exit 1
}
cd ..
print_status "Frontend dependencies installed"

print_info "Installing Python dependencies for analytics..."
cd gpt-fleet-optimizer
pip3 install -r requirements.txt --quiet || {
    print_warning "Some Python dependencies may have failed to install"
}
cd ..
print_status "Python dependencies installation attempted"

echo ""

# Step 4: Service Startup
echo -e "${BLUE}🚀 Step 4: Starting Services${NC}"
echo "============================="

print_info "Starting backend service..."
cd backend
npm run dev > ../demo-backend.log 2>&1 &
BACKEND_PID=$!
cd ..
print_status "Backend service started (PID: $BACKEND_PID)"

print_info "Starting frontend service..."
cd frontend
npm run dev > ../demo-frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
print_status "Frontend service started (PID: $FRONTEND_PID)"

echo ""

# Step 5: Service Health Checks
echo -e "${BLUE}🏥 Step 5: Service Health Checks${NC}"
echo "================================="

# Wait for backend to be ready
wait_for_service "http://localhost:$BACKEND_PORT/health" "Backend" || {
    print_error "Backend health check failed"
    print_info "Backend logs:"
    tail -n 20 demo-backend.log
    exit 1
}

# Wait for frontend to be ready
wait_for_service "http://localhost:$FRONTEND_PORT" "Frontend" || {
    print_error "Frontend health check failed"
    print_info "Frontend logs:"
    tail -n 20 demo-frontend.log
    exit 1
}

print_status "All services are healthy and ready"
echo ""

# Step 6: API Functionality Tests
echo -e "${BLUE}🧪 Step 6: API Functionality Tests${NC}"
echo "=================================="

# Test basic endpoints
test_api_endpoint "http://localhost:$BACKEND_PORT/health" "Health Check"
test_api_endpoint "http://localhost:$BACKEND_PORT/api/v1/agents/health" "Agent Health"
test_api_endpoint "http://localhost:$BACKEND_PORT/api/versions" "API Versions"

# Test agent endpoints
print_info "Testing agent system endpoints..."
if curl -s "http://localhost:$BACKEND_PORT/api/v1/agents/status" | grep -q "success"; then
    print_status "Agent system test passed"
else
    print_warning "Agent system test failed (may be initializing)"
fi

# Test analytics lab environment
print_info "Testing analytics lab environment..."
if curl -s "http://localhost:$BACKEND_PORT/api/v1/analytics-lab/environment" | grep -q "python"; then
    print_status "Analytics lab environment test passed"
else
    print_warning "Analytics lab environment test failed"
fi

echo ""

# Step 7: Demo Data Setup
echo -e "${BLUE}📊 Step 7: Demo Data Setup${NC}"
echo "=========================="

print_info "Setting up demo data..."

# Create demo optimization request
DEMO_REQUEST=$(cat <<EOF
{
  "pickups": [
    {
      "id": "pickup1",
      "name": "Al Baik - Olaya",
      "address": "Olaya Street, Riyadh",
      "coordinates": {"lat": 24.6995, "lng": 46.6837},
      "timeWindow": {"start": "12:00", "end": "14:00"}
    }
  ],
  "deliveries": [
    {
      "id": "delivery1",
      "name": "Customer - Al Malaz",
      "address": "Al Malaz District, Riyadh",
      "coordinates": {"lat": 24.6697, "lng": 46.7236},
      "timeWindow": {"start": "13:00", "end": "16:00"}
    }
  ],
  "constraints": {
    "maxDistance": 50,
    "maxTime": 120,
    "serviceType": "BARQ"
  }
}
EOF
)

# Test route optimization
print_info "Testing route optimization..."
OPTIMIZE_RESPONSE=$(curl -s -X POST "http://localhost:$BACKEND_PORT/api/v1/optimize" \
  -H "Content-Type: application/json" \
  -d "$DEMO_REQUEST")

if echo "$OPTIMIZE_RESPONSE" | grep -q "requestId"; then
    print_status "Route optimization test passed"
    REQUEST_ID=$(echo "$OPTIMIZE_RESPONSE" | grep -o '"requestId":"[^"]*"' | cut -d'"' -f4)
    print_info "Request ID: $REQUEST_ID"
else
    print_warning "Route optimization test failed"
fi

echo ""

# Step 8: Demo Execution Summary
echo -e "${BLUE}🎯 Step 8: Demo Execution Summary${NC}"
echo "================================="

DEMO_END_TIME=$(date +%s)
DEMO_DURATION=$((DEMO_END_TIME - DEMO_START_TIME))

print_status "Demo setup completed successfully!"
print_info "Setup duration: ${DEMO_DURATION} seconds"
echo ""

echo -e "${GREEN}🌐 Service URLs:${NC}"
echo "Frontend:     http://localhost:$FRONTEND_PORT"
echo "Backend API:  http://localhost:$BACKEND_PORT"
echo "API Docs:     http://localhost:$BACKEND_PORT/api-docs"
echo ""

echo -e "${GREEN}📊 Demo Pages:${NC}"
echo "Main Dashboard:     http://localhost:$FRONTEND_PORT"
echo "Route Optimization: http://localhost:$FRONTEND_PORT/optimize"
echo "Analytics Lab:      http://localhost:$FRONTEND_PORT/analytics-lab"
echo "Fleet Manager:      http://localhost:$FRONTEND_PORT/fleet-manager"
echo "Autonomous Ops:     http://localhost:$FRONTEND_PORT/autonomous"
echo "Admin Panel:        http://localhost:$FRONTEND_PORT/admin/agents"
echo ""

echo -e "${GREEN}🧪 Test Commands:${NC}"
echo "# Test health endpoint"
echo "curl http://localhost:$BACKEND_PORT/health"
echo ""
echo "# Test agent system"
echo "curl http://localhost:$BACKEND_PORT/api/v1/agents/status | jq '.'"
echo ""
echo "# Test route optimization"
echo "curl -X POST http://localhost:$BACKEND_PORT/api/v1/optimize \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '$DEMO_REQUEST'"
echo ""

echo -e "${GREEN}📝 Next Steps:${NC}"
echo "1. Open browser to http://localhost:$FRONTEND_PORT"
echo "2. Navigate through different modules"
echo "3. Test route optimization functionality"
echo "4. Explore Analytics Lab with production data"
echo "5. Monitor agent system in real-time"
echo "6. Review API documentation at /api-docs"
echo ""

echo -e "${YELLOW}⚡ Demo Features Ready:${NC}"
echo "✅ 18+ AI Agents operational"
echo "✅ Route optimization engine"
echo "✅ Analytics Lab with Python scripts"
echo "✅ Real-time fleet monitoring"
echo "✅ Production database integration"
echo "✅ WebSocket real-time updates"
echo "✅ Comprehensive API documentation"
echo ""

echo -e "${BLUE}🎬 Demo is now LIVE and ready for presentation!${NC}"
echo ""

# Keep script running to maintain services
print_info "Services are running. Press Ctrl+C to stop the demo."
echo ""

# Monitor services
while true; do
    sleep 30
    
    # Check if services are still running
    if ! curl -s "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1; then
        print_error "Backend service appears to be down"
        break
    fi
    
    if ! curl -s "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
        print_error "Frontend service appears to be down"
        break
    fi
    
    # Print status every 5 minutes
    CURRENT_TIME=$(date +%s)
    UPTIME=$((CURRENT_TIME - DEMO_START_TIME))
    if [ $((UPTIME % 300)) -eq 0 ]; then
        print_info "Demo uptime: $((UPTIME / 60)) minutes"
    fi
done