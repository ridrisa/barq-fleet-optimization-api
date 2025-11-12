#!/bin/bash

# Cloud SQL Database Connection Script
# Project: looker-barqdata-2030
# Instance: barq-db
# Database: barq_logistics

set -e

echo "🔌 Connecting to Cloud SQL PostgreSQL..."
echo "Instance: barq-db"
echo "Database: barq_logistics"
echo ""

# Check if cloud-sql-proxy exists
if [ ! -f "./cloud-sql-proxy" ]; then
    echo "📥 Downloading Cloud SQL Proxy..."
    curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.13.0/cloud-sql-proxy.darwin.arm64
    chmod +x cloud-sql-proxy
    echo "✅ Cloud SQL Proxy downloaded"
fi

# Start proxy in background
echo "🚀 Starting Cloud SQL Proxy on port 5433..."
./cloud-sql-proxy looker-barqdata-2030:us-central1:barq-db --port 5433 &
PROXY_PID=$!

# Wait for proxy to be ready
sleep 3

echo "✅ Proxy started (PID: $PROXY_PID)"
echo ""
echo "📊 To connect, use:"
echo "  psql -h 127.0.0.1 -p 5433 -U postgres -d barq_logistics"
echo ""
echo "🛑 To stop proxy, run:"
echo "  kill $PROXY_PID"
echo ""
echo "Press Ctrl+C to stop the proxy and exit..."

# Keep script running and handle Ctrl+C
trap "echo ''; echo '🛑 Stopping proxy...'; kill $PROXY_PID; exit 0" INT TERM

# Wait for proxy process
wait $PROXY_PID
