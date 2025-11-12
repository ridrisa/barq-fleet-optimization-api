#!/bin/bash

# Run SQL migration against Cloud SQL database
# Usage: ./run-migration.sh <path-to-sql-file>

set -e

if [ -z "$1" ]; then
    echo "❌ Error: No SQL file specified"
    echo "Usage: $0 <path-to-sql-file>"
    echo ""
    echo "Examples:"
    echo "  $0 backend/migrations/add-performance-indexes.sql"
    echo "  $0 backend/database/migrations/001_create_users_table.sql"
    exit 1
fi

SQL_FILE="$1"

if [ ! -f "$SQL_FILE" ]; then
    echo "❌ Error: SQL file not found: $SQL_FILE"
    exit 1
fi

echo "🗄️  Running migration: $(basename "$SQL_FILE")"
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
echo "🚀 Starting Cloud SQL Proxy..."
./cloud-sql-proxy looker-barqdata-2030:us-central1:barq-db --port 5433 > /dev/null 2>&1 &
PROXY_PID=$!

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Stopping proxy..."
    kill $PROXY_PID 2>/dev/null || true
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Wait for proxy to be ready
sleep 3

# Prompt for password
echo "🔐 Enter postgres password:"
read -s DB_PASSWORD

echo ""
echo "📝 Executing migration..."
echo ""

# Run the migration
PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -p 5433 -U postgres -d barq_logistics -f "$SQL_FILE"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
else
    echo ""
    echo "❌ Migration failed with exit code: $EXIT_CODE"
    exit $EXIT_CODE
fi
