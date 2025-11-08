# Production Data Migration Guide

## Overview

This directory contains scripts to migrate production data from AWS RDS (`barqfleet_db`) to local PostgreSQL (`barq_logistics`).

## Migration Scripts

### 1. `migrate-production-data.js`
**Purpose**: Migrates core tables (drivers, orders, customers)
**Status**: ✅ Currently running (74% complete - 378K/513K orders)
**Tables**: `drivers`, `orders`, `customers`

### 2. `migrate-hubs-shipments.js` ⭐ NEW
**Purpose**: Migrates hubs and shipments data + links orders to shipments/hubs
**Status**: ⏳ Ready to run (waiting for orders migration to complete)
**Tables**: `hubs`, `shipments`
**Actions**:
- Migrates all hubs (21K records)
- Updates driver hub assignments
- Migrates all shipments (1.1M records)
- Links orders to shipments and hubs via foreign keys

## Migration Sequence

**IMPORTANT**: Run migrations in this order:

```bash
# Step 1: Migrate drivers, orders, customers (CURRENTLY RUNNING)
cd /Users/ramiz_new/Desktop/AI-Route-Optimization-API/backend/scripts

AWS_RDS_HOST="barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com" \
AWS_RDS_PORT="5432" \
AWS_RDS_DATABASE="barqfleet_db" \
AWS_RDS_USER="ventgres" \
AWS_RDS_PASSWORD="Jk56tt4HkzePFfa3ht" \
AWS_RDS_SSL="true" \
DAYS_TO_MIGRATE="365" \
MIGRATION_BATCH_SIZE="1000" \
POSTGRES_HOST="localhost" \
POSTGRES_PORT="5432" \
POSTGRES_DB="barq_logistics" \
POSTGRES_USER="postgres" \
POSTGRES_PASSWORD="postgres" \
node migrate-production-data.js

# Step 2: Migrate hubs and shipments (RUN AFTER STEP 1 COMPLETES)
AWS_RDS_HOST="barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com" \
AWS_RDS_PORT="5432" \
AWS_RDS_DATABASE="barqfleet_db" \
AWS_RDS_USER="ventgres" \
AWS_RDS_PASSWORD="Jk56tt4HkzePFfa3ht" \
AWS_RDS_SSL="true" \
MIGRATION_BATCH_SIZE="1000" \
POSTGRES_HOST="localhost" \
POSTGRES_PORT="5432" \
POSTGRES_DB="barq_logistics" \
POSTGRES_USER="postgres" \
POSTGRES_PASSWORD="postgres" \
node migrate-hubs-shipments.js
```

## Data Hierarchy

```
Hub (21K records)
  ↓ (pickup location)
Shipment (1.1M records)
  ↓ (batch of orders)
Order (513K records)

Shipment → assigned to → Driver/Courier (1.4K records)
Driver → assigned to → Hub
```

## Schema Files

- **`schema-no-postgis.sql`**: Main database schema (drivers, orders, customers)
- **`add-shipments-hubs.sql`**: Shipments and hubs tables with foreign keys

## Current Migration Status

| Table | Migrated | Total | Progress | Status |
|-------|----------|-------|----------|--------|
| **Drivers** | 1,459 | 1,459 | 100% | ✅ Complete |
| **Orders** | 378,000+ | 513,673 | 74% | 🚀 Running |
| **Customers** | ~350K | ~500K | 70% | 🚀 Running |
| **Hubs** | 0 | 21,312 | 0% | ⏳ Pending |
| **Shipments** | 0 | 1,132,096 | 0% | ⏳ Pending |

**Last Updated**: November 6, 2025

## Environment Variables

Required environment variables for migration:

### Source Database (AWS RDS)
```bash
AWS_RDS_HOST="barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com"
AWS_RDS_PORT="5432"
AWS_RDS_DATABASE="barqfleet_db"
AWS_RDS_USER="ventgres"
AWS_RDS_PASSWORD="Jk56tt4HkzePFfa3ht"
AWS_RDS_SSL="true"
```

### Target Database (Local PostgreSQL)
```bash
POSTGRES_HOST="localhost"
POSTGRES_PORT="5432"
POSTGRES_DB="barq_logistics"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="postgres"
```

### Migration Settings
```bash
DAYS_TO_MIGRATE="365"          # Days of historical data to migrate
MIGRATION_BATCH_SIZE="1000"    # Records per batch
```

## Features

### `migrate-hubs-shipments.js` Script

1. **Hub Migration**
   - Migrates all hub data with operating hours, dispatch settings, and location details
   - Preserves hub configuration (bundle limits, dispatch radius, etc.)

2. **Driver Hub Assignment**
   - Updates drivers with their assigned hub
   - Uses courier ID mapping from first migration

3. **Shipment Migration**
   - Migrates all shipments with tracking numbers
   - Maps courier_id to driver UUIDs
   - Preserves shipment status, rewards, and route metrics

4. **Order Linking**
   - Links orders to shipments via `shipment_id` foreign key
   - Links orders to hubs via `hub_id` foreign key
   - Processes updates in batches for performance

5. **ID Mapping**
   - Maintains source-to-target ID mappings for hubs and shipments
   - Ensures foreign key relationships are preserved

## Monitoring Migration Progress

### Check Orders Migration Progress
```bash
psql -h localhost -p 5432 -U postgres -d barq_logistics -c "SELECT COUNT(*) FROM orders;"
```

### Check if Orders Migration is Complete
```bash
# Check if migration script is still running
ps aux | grep migrate-production-data.js
```

### Verify Schema Before Running Hubs/Shipments Migration
```bash
psql -h localhost -p 5432 -U postgres -d barq_logistics -c "\d hubs"
psql -h localhost -p 5432 -U postgres -d barq_logistics -c "\d shipments"
```

## Expected Timeline

- **Orders Migration** (Step 1): ~50 minutes (CURRENTLY RUNNING)
- **Hubs Migration**: ~2-3 minutes (21K records)
- **Shipments Migration**: ~120 minutes (1.1M records)
- **Order Linking**: ~10 minutes

**Total**: ~3 hours

## Error Handling

Both scripts:
- Log errors without stopping migration
- Continue processing on non-critical errors
- Provide summary of errors at completion
- Track failed records for manual review

Common errors:
- Null coordinate violations (orders with missing location data)
- Duplicate tracking numbers (handled with ON CONFLICT)
- Foreign key mismatches (logged but skipped)

## Validation Queries

After migration completes, run these queries to validate:

```sql
-- Count records
SELECT 'drivers' as table_name, COUNT(*) FROM drivers
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'hubs', COUNT(*) FROM hubs
UNION ALL SELECT 'shipments', COUNT(*) FROM shipments;

-- Check order linkages
SELECT
  COUNT(*) as total_orders,
  COUNT(CASE WHEN shipment_id IS NOT NULL THEN 1 END) as with_shipment,
  COUNT(CASE WHEN hub_id IS NOT NULL THEN 1 END) as with_hub
FROM orders;

-- Verify shipment assignments
SELECT
  shipment_status,
  COUNT(*) as count
FROM shipments
GROUP BY shipment_status
ORDER BY shipment_status;

-- Check hub performance
SELECT * FROM hub_performance LIMIT 10;

-- Check shipment summary
SELECT * FROM shipment_summary LIMIT 10;
```

## Troubleshooting

### Migration Stuck?
```bash
# Check database connections
psql -h localhost -p 5432 -U postgres -d barq_logistics -c "SELECT * FROM pg_stat_activity WHERE datname = 'barq_logistics';"
```

### Out of Memory?
- Reduce `MIGRATION_BATCH_SIZE` from 1000 to 500 or 250
- Close other applications
- Increase PostgreSQL memory settings

### Connection Timeout?
- Check network connectivity to AWS RDS
- Verify credentials
- Ensure SSL is configured correctly

## Files Created

1. **`/backend/scripts/migrate-production-data.js`**
   - Main migration script (drivers, orders, customers)

2. **`/backend/scripts/migrate-hubs-shipments.js`** ⭐ NEW
   - Hubs and shipments migration script

3. **`/backend/src/database/schema-no-postgis.sql`**
   - Main database schema

4. **`/backend/src/database/add-shipments-hubs.sql`**
   - Shipments and hubs schema extension

## Next Steps

1. ⏳ **Wait for orders migration to complete** (~26% remaining)
2. ▶️ **Run `migrate-hubs-shipments.js`** to migrate hubs and shipments
3. ✅ **Validate data** using validation queries above
4. 🚀 **Update API** to use PostgreSQL instead of JSON files

## Support

For issues or questions, check:
- Migration logs in console output
- Database error logs: `tail -f /usr/local/var/log/postgresql@14.log`
- API documentation: `/API_POSTGRESQL_MAPPING.md`
