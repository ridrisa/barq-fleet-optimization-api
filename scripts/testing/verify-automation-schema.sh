#!/bin/bash

# Automation Schema Verification Script
# Purpose: Verify that all automation tables have the required schema after applying migrations

echo ""
echo "🔍 Automation Schema Verification"
echo "=================================="
echo ""

DB_URL="postgresql://postgres:postgres@localhost:5432/barq_logistics"

# Function to check if a column exists in a table
check_column() {
  local table=$1
  local column=$2

  result=$(psql "$DB_URL" -t -c "
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name='$table' AND column_name='$column'
  " 2>&1)

  if echo "$result" | grep -q "$column"; then
    echo "  ✅ $column exists"
    return 0
  else
    echo "  ❌ $column MISSING"
    return 1
  fi
}

# Function to check if a trigger exists
check_trigger() {
  local table=$1
  local trigger=$2

  result=$(psql "$DB_URL" -t -c "
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_table='$table' AND trigger_name='$trigger'
  " 2>&1)

  if echo "$result" | grep -q "$trigger"; then
    echo "  ✅ Trigger: $trigger exists"
    return 0
  else
    echo "  ❌ Trigger: $trigger MISSING"
    return 1
  fi
}

# Function to check if an index exists
check_index() {
  local table=$1
  local index=$2

  result=$(psql "$DB_URL" -t -c "
    SELECT indexname
    FROM pg_indexes
    WHERE tablename='$table' AND indexname='$index'
  " 2>&1)

  if echo "$result" | grep -q "$index"; then
    echo "  ✅ Index: $index exists"
    return 0
  else
    echo "  ❌ Index: $index MISSING"
    return 1
  fi
}

# Check all automation tables
tables=("assignment_logs" "route_optimizations" "order_batches" "escalation_logs" "dispatch_alerts" "traffic_incidents")
failed=0

for table in "${tables[@]}"; do
  echo "📊 Checking $table..."

  # Check if table exists
  if ! psql "$DB_URL" -t -c "\d $table" > /dev/null 2>&1; then
    echo "  ❌ Table does not exist!"
    failed=$((failed + 1))
    echo ""
    continue
  fi

  # Check for created_at column
  check_column "$table" "created_at"

  # Check specific tables that should have updated_at
  if [[ "$table" == "route_optimizations" ]] || [[ "$table" == "traffic_incidents" ]] || [[ "$table" == "assignment_logs" ]] || [[ "$table" == "escalation_logs" ]]; then
    check_column "$table" "updated_at"
  fi

  echo ""
done

echo "=================================="

# Check triggers
echo ""
echo "🔧 Checking Triggers..."
check_trigger "route_optimizations" "update_route_optimizations_updated_at_trigger"
check_trigger "traffic_incidents" "update_traffic_incidents_updated_at_trigger"

echo ""
echo "=================================="

# Check indexes
echo ""
echo "📇 Checking Indexes..."
check_index "route_optimizations" "idx_route_optimizations_created_at"
check_index "traffic_incidents" "idx_traffic_incidents_created_at"

echo ""
echo "=================================="

# Summary
echo ""
if [ $failed -eq 0 ]; then
  echo "✅ All automation tables have correct schema!"
  echo ""
  echo "Next steps:"
  echo "  1. Start the backend server: cd backend && npm start"
  echo "  2. Test the dashboard: node test-automation-dashboard.js"
  exit 0
else
  echo "❌ Schema verification failed for $failed table(s)"
  echo ""
  echo "Fix by running:"
  echo "  psql $DB_URL -f backend/src/database/migrations/003_add_created_at_to_route_optimizations.sql"
  echo "  psql $DB_URL -f backend/src/database/migrations/004_add_created_updated_at_to_traffic_incidents.sql"
  exit 1
fi
