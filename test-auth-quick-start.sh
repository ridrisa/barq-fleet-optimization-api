#!/bin/bash

###############################################################################
# Authentication Test Quick Start Script
#
# This script helps you quickly test the authentication flow
# Usage: ./test-auth-quick-start.sh
###############################################################################

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║         BARQ Authentication Flow - Quick Start Test                  ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if backend server is running
echo -e "${BLUE}[1/4] Checking if backend server is running...${NC}"
if lsof -i :3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend server is running on port 3000${NC}"
    SERVER_RUNNING=true
else
    echo -e "${YELLOW}⚠ Backend server is NOT running${NC}"
    echo ""
    echo -e "${BLUE}Starting backend server...${NC}"

    # Check if we're in the right directory
    if [ -d "backend" ]; then
        cd backend

        # Check if node_modules exists
        if [ ! -d "node_modules" ]; then
            echo -e "${YELLOW}Installing backend dependencies...${NC}"
            npm install
        fi

        # Start server in background
        echo -e "${BLUE}Launching backend server...${NC}"
        npm run dev > ../backend-server.log 2>&1 &
        SERVER_PID=$!
        echo -e "${GREEN}✓ Backend server started (PID: $SERVER_PID)${NC}"

        # Wait for server to be ready
        echo -e "${BLUE}Waiting for server to be ready...${NC}"
        sleep 5

        # Check if server is responding
        for i in {1..10}; do
            if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
                echo -e "${GREEN}✓ Server is ready!${NC}"
                break
            fi
            echo -e "${YELLOW}Waiting... ($i/10)${NC}"
            sleep 2
        done

        cd ..
        SERVER_RUNNING=true
    else
        echo -e "${RED}✗ Cannot find backend directory${NC}"
        echo -e "${YELLOW}Please ensure you're in the project root directory${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}[2/4] Checking test script...${NC}"
if [ -f "test-frontend-auth-flow.js" ]; then
    echo -e "${GREEN}✓ Test script found${NC}"
else
    echo -e "${RED}✗ Test script not found${NC}"
    echo -e "${YELLOW}Please ensure test-frontend-auth-flow.js exists${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}[3/4] Running authentication tests...${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Run the test script
node test-frontend-auth-flow.js

TEST_EXIT_CODE=$?

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Display results
echo -e "${BLUE}[4/4] Test Results Summary${NC}"
echo ""

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ Authentication tests completed successfully!${NC}"
else
    echo -e "${YELLOW}⚠ Some tests may have failed - check output above${NC}"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                         Next Steps                                     ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "1. Review the test output above"
echo "2. Check AUTHENTICATION_GUIDE.md for frontend integration"
echo "3. Check AUTHENTICATION_TEST_REPORT.md for detailed analysis"
echo ""
echo -e "${BLUE}Test Credentials:${NC}"
echo "   Email:    admin@barq.com"
echo "   Password: Admin@123"
echo "   Role:     super_admin"
echo ""
echo -e "${YELLOW}⚠ IMPORTANT: Change default password in production!${NC}"
echo ""

# Manual testing examples
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                    Manual Testing Examples                             ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${BLUE}Test Login:${NC}"
echo 'curl -X POST http://localhost:3000/api/auth/login \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{"email":"admin@barq.com","password":"Admin@123"}'"'"
echo ""
echo -e "${BLUE}Test Protected Endpoint (after login):${NC}"
echo 'TOKEN="<your_token_here>"'
echo 'curl -X GET http://localhost:3000/api/v1/agents/status \'
echo '  -H "Authorization: Bearer $TOKEN"'
echo ""

# Check if we started the server
if [ ! -z "$SERVER_PID" ]; then
    echo ""
    echo -e "${YELLOW}Backend server is running in background (PID: $SERVER_PID)${NC}"
    echo -e "${BLUE}To stop it: kill $SERVER_PID${NC}"
    echo -e "${BLUE}Or check logs: tail -f backend-server.log${NC}"
    echo ""
fi

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                          Documentation                                 ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📚 AUTHENTICATION_GUIDE.md        - Complete API reference & examples"
echo "📊 AUTHENTICATION_TEST_REPORT.md  - Detailed test analysis"
echo "🔧 test-frontend-auth-flow.js     - Automated test script"
echo ""
echo "Thank you for using BARQ Authentication Testing!"
echo ""
