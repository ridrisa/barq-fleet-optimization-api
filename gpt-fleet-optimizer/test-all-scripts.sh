#!/bin/bash
# Test all analytics scripts with BarqFleet production database

export DB_NAME=barqfleet_db
export DB_HOST=barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com
export DB_USER=ventgres
export DB_PASSWORD='Jk56tt4HkzePFfa3ht'
export DB_PORT=5432

echo "========================================="
echo "Testing Analytics Scripts with Production DB"
echo "========================================="

echo ""
echo "1. Testing demand_forecaster.py..."
timeout 30 python3 demand_forecaster.py --forecast_type daily --horizon 7 --output json | tail -50

echo ""
echo "2. Testing sla_analytics.py..."
timeout 30 python3 sla_analytics.py --analysis_type compliance --date_range 7 --output json | tail -50

echo ""
echo "3. Testing fleet_performance.py..."
timeout 30 python3 fleet_performance.py --analysis_type courier --period monthly --output json | tail -50

echo ""
echo "========================================="
echo "All tests complete!"
echo "========================================="
