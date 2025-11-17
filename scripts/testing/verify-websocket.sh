#!/bin/bash

# WebSocket Verification Script for BARQ Fleet Optimization API
# Checks if WebSocket server is properly configured and operational

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Base URL
BASE_URL="${BASE_URL:-https://route-opt-backend-426674819922.us-central1.run.app}"
WS_URL="${WS_URL:-wss://route-opt-backend-426674819922.us-central1.run.app/ws}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}WebSocket Verification Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check HTTP endpoint
check_http() {
    local endpoint=$1
    local description=$2

    echo -e "${YELLOW}Checking:${NC} $description"
    echo -e "${BLUE}Endpoint:${NC} $endpoint"

    response=$(curl -s "$endpoint")
    status=$?

    if [ $status -eq 0 ]; then
        echo -e "${GREEN}✓ SUCCESS${NC}"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "Error: Could not reach endpoint"
        return 1
    fi

    echo ""
}

# Function to check WebSocket status in health response
check_websocket_status() {
    echo -e "${YELLOW}Checking:${NC} WebSocket Status in Health Response"

    response=$(curl -s "$BASE_URL/health")
    ws_enabled=$(echo "$response" | jq -r '.websocket.enabled' 2>/dev/null)
    ws_endpoint=$(echo "$response" | jq -r '.websocket.endpoint' 2>/dev/null)
    ws_clients=$(echo "$response" | jq -r '.websocket.clients' 2>/dev/null)

    if [ "$ws_enabled" = "true" ]; then
        echo -e "${GREEN}✓ WebSocket Enabled${NC}"
        echo -e "  Endpoint: $ws_endpoint"
        echo -e "  Connected Clients: $ws_clients"
    else
        echo -e "${RED}✗ WebSocket NOT Enabled${NC}"
        return 1
    fi

    echo ""
}

# Function to check detailed health
check_detailed_health() {
    echo -e "${YELLOW}Checking:${NC} Detailed Health Status"

    response=$(curl -s "$BASE_URL/health/detailed")
    ws_healthy=$(echo "$response" | jq -r '.checks.websocket.healthy' 2>/dev/null)
    ws_message=$(echo "$response" | jq -r '.checks.websocket.message' 2>/dev/null)

    if [ "$ws_healthy" = "true" ]; then
        echo -e "${GREEN}✓ WebSocket Health Check Passing${NC}"
        echo -e "  Message: $ws_message"
    else
        echo -e "${RED}✗ WebSocket Health Check Failing${NC}"
        ws_error=$(echo "$response" | jq -r '.checks.websocket.error' 2>/dev/null)
        echo -e "  Error: $ws_error"
        return 1
    fi

    echo ""
}

# Function to check Cloud Run service
check_cloud_run() {
    echo -e "${YELLOW}Checking:${NC} Cloud Run Service Configuration"

    if command -v gcloud &> /dev/null; then
        service_info=$(gcloud run services describe route-opt-backend \
            --region=us-central1 \
            --format="json" 2>/dev/null)

        if [ $? -eq 0 ]; then
            port=$(echo "$service_info" | jq -r '.spec.template.spec.containers[0].ports[0].containerPort' 2>/dev/null)
            timeout=$(echo "$service_info" | jq -r '.spec.template.spec.timeoutSeconds' 2>/dev/null)

            echo -e "${GREEN}✓ Cloud Run Service Found${NC}"
            echo -e "  Container Port: $port"
            echo -e "  Timeout: ${timeout}s"

            if [ "$port" = "8080" ]; then
                echo -e "  ${GREEN}✓ Port is correct (8080)${NC}"
            else
                echo -e "  ${RED}✗ Port should be 8080, currently: $port${NC}"
            fi

            if [ "$timeout" = "3600" ]; then
                echo -e "  ${GREEN}✓ Timeout is correct (3600s for WebSocket)${NC}"
            else
                echo -e "  ${YELLOW}⚠ Timeout is $timeout (recommended: 3600s for WebSocket)${NC}"
            fi
        else
            echo -e "${YELLOW}⚠ Could not fetch Cloud Run service info${NC}"
            echo -e "  (gcloud authentication may be required)"
        fi
    else
        echo -e "${YELLOW}⚠ gcloud CLI not installed${NC}"
        echo -e "  (skipping Cloud Run configuration check)"
    fi

    echo ""
}

# Function to test WebSocket connection
test_websocket_connection() {
    echo -e "${YELLOW}Testing:${NC} WebSocket Connection"

    if command -v wscat &> /dev/null; then
        echo -e "${BLUE}Attempting to connect to:${NC} $WS_URL"

        # Try to connect (timeout after 5 seconds)
        timeout 5s wscat -c "$WS_URL" <<EOF 2>&1 | head -n 5
{"type":"ping"}
EOF

        if [ $? -eq 0 ] || [ $? -eq 124 ]; then
            echo -e "${GREEN}✓ WebSocket Connection Successful${NC}"
        else
            echo -e "${RED}✗ WebSocket Connection Failed${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ wscat not installed${NC}"
        echo -e "  Install with: npm install -g wscat"
        echo -e "  Manual test: wscat -c $WS_URL"
    fi

    echo ""
}

# Main execution
main() {
    echo -e "${BLUE}Base URL:${NC} $BASE_URL"
    echo -e "${BLUE}WebSocket URL:${NC} $WS_URL"
    echo ""

    # Run all checks
    check_http "$BASE_URL/health" "Basic Health Check" || true
    check_websocket_status || true
    check_detailed_health || true
    check_cloud_run || true
    test_websocket_connection || true

    # Summary
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Verification Complete${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo -e "1. Check Cloud Build status:"
    echo -e "   gcloud builds list --limit=1"
    echo ""
    echo -e "2. View Cloud Run logs:"
    echo -e "   gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=route-opt-backend' --limit=50"
    echo ""
    echo -e "3. Test WebSocket manually:"
    echo -e "   wscat -c $WS_URL"
    echo ""
    echo -e "4. View full documentation:"
    echo -e "   cat WEBSOCKET_CONFIGURATION.md"
}

# Check for required tools
echo -e "${YELLOW}Checking required tools...${NC}"
if ! command -v curl &> /dev/null; then
    echo -e "${RED}✗ curl is not installed${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠ jq is not installed (recommended for better output)${NC}"
    echo -e "  Install with: brew install jq"
fi

echo ""

# Run main function
main
