#!/bin/bash

# Data Migration Script with SSH Tunnel
# Connects to AWS RDS through SSH tunnel and migrates data

set -e

echo "🚀 BARQ Data Migration from AWS RDS"
echo "===================================="
echo ""

# Load environment variables
if [ -f "../.env.migration" ]; then
  export $(cat ../.env.migration | grep -v '^#' | xargs)
  echo "✅ Loaded migration configuration"
else
  echo "❌ Error: .env.migration file not found"
  exit 1
fi

# Check if SSH key exists
SSH_KEY="${SSH_KEY_PATH:-$HOME/.ssh/id_rsa}"
if [ ! -f "$SSH_KEY" ]; then
  echo "⚠️  SSH key not found at $SSH_KEY"
  echo "   Please specify SSH_KEY_PATH in .env.migration"
  read -p "Enter path to SSH key: " SSH_KEY
fi

echo ""
echo "📊 Migration Configuration:"
echo "   Source: $AWS_RDS_HOST"
echo "   Database: $AWS_RDS_DATABASE"
echo "   SSH Tunnel: $SSH_HOST"
echo "   Days to migrate: ${DAYS_TO_MIGRATE:-365}"
echo ""

# Set up SSH tunnel
echo "🔒 Setting up SSH tunnel..."
SSH_TUNNEL_LOCAL_PORT="${SSH_TUNNEL_LOCAL_PORT:-15432}"

# Kill any existing tunnel on this port
lsof -ti:$SSH_TUNNEL_LOCAL_PORT | xargs kill -9 2>/dev/null || true

# Create SSH tunnel in background
ssh -i "$SSH_KEY" \
    -f -N -L $SSH_TUNNEL_LOCAL_PORT:$AWS_RDS_HOST:$AWS_RDS_PORT \
    -o "StrictHostKeyChecking=no" \
    -o "ServerAliveInterval=60" \
    ${SSH_USER:-ec2-user}@$SSH_HOST

if [ $? -eq 0 ]; then
  echo "✅ SSH tunnel established on localhost:$SSH_TUNNEL_LOCAL_PORT"
else
  echo "❌ Failed to establish SSH tunnel"
  exit 1
fi

# Update environment for local connection through tunnel
export AWS_RDS_HOST=localhost
export AWS_RDS_PORT=$SSH_TUNNEL_LOCAL_PORT

echo ""
echo "🔄 Starting data migration..."
echo ""

# Run Node.js migration script
node migrate-production-data.js

MIGRATION_EXIT_CODE=$?

# Clean up SSH tunnel
echo ""
echo "🧹 Cleaning up SSH tunnel..."
lsof -ti:$SSH_TUNNEL_LOCAL_PORT | xargs kill -9 2>/dev/null || true

if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
  echo ""
  echo "✅ Migration completed successfully!"
  echo ""
  exit 0
else
  echo ""
  echo "❌ Migration failed with exit code $MIGRATION_EXIT_CODE"
  echo ""
  exit $MIGRATION_EXIT_CODE
fi
