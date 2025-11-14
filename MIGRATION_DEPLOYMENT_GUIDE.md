# Automation Tables Migration - Deployment Guide

## Quick Start

### 1. Run the Migration

```bash
# Navigate to backend directory
cd /Users/ramiz_new/Desktop/AI-Route-Optimization-API

# Run the migration using the migration runner
node backend/src/database/migrations/run-migrations.js

# Or manually with psql (if you prefer direct execution)
psql -h localhost -U postgres -d barq_db \
  -f backend/src/database/migrations/002_create_automation_tables.sql
```

### 2. Verify Migration Success

```bash
# Check that all tables were created
psql -h localhost -U postgres -d barq_db << 'EOF'
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'assignment_logs',
  'route_optimizations',
  'traffic_incidents',
  'order_batches',
  'escalation_logs',
  'dispatch_alerts'
);
EOF

# Expected output: 6 tables (in any order)
# assignment_logs
# route_optimizations
# traffic_incidents
# order_batches
# escalation_logs
# dispatch_alerts
```

### 3. Verify Views

```bash
psql -h localhost -U postgres -d barq_db << 'EOF'
SELECT viewname FROM pg_views
WHERE schemaname = 'public'
AND viewname IN (
  'auto_dispatch_stats',
  'route_optimization_stats',
  'batch_performance_stats',
  'escalation_stats'
);
EOF

# Expected output: 4 views
# auto_dispatch_stats
# route_optimization_stats
# batch_performance_stats
# escalation_stats
```

### 4. Verify Enums

```bash
psql -h localhost -U postgres -d barq_db << 'EOF'
SELECT t.typname as enum_type, e.enumlabel as value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN (
  'assignment_type',
  'escalation_type',
  'alert_type',
  'severity_level',
  'traffic_severity',
  'batch_status'
)
ORDER BY t.typname, e.enumsortorder;
EOF

# Expected output: All enum values for each type
```

### 5. Test Connectivity

```bash
# Test a simple query on each table
psql -h localhost -U postgres -d barq_db << 'EOF'
SELECT COUNT(*) as assignment_logs_count FROM assignment_logs;
SELECT COUNT(*) as route_opts_count FROM route_optimizations;
SELECT COUNT(*) as traffic_count FROM traffic_incidents;
SELECT COUNT(*) as batches_count FROM order_batches;
SELECT COUNT(*) as escalations_count FROM escalation_logs;
SELECT COUNT(*) as alerts_count FROM dispatch_alerts;
EOF

# Expected output: 0 rows in each table (initially empty)
```

### 6. Restart Backend Service

```bash
# If using Docker
docker restart barq-backend

# Or if running locally
# Kill the existing process and restart
npm start

# Verify automation endpoints work
curl -X GET http://localhost:3000/api/v1/automation/status-all \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Migration File Details

**File:** `/backend/src/database/migrations/002_create_automation_tables.sql`
**Size:** 426 lines
**Execution Time:** ~500-1000ms (typically)

### File Contents Summary

1. Lines 1-10: Header and uuid-ossp extension
2. Lines 12-54: Enum definitions (6 total)
3. Lines 56-101: assignment_logs table + indexes
4. Lines 103-158: route_optimizations table + indexes
5. Lines 160-202: traffic_incidents table + indexes
6. Lines 204-248: order_batches table + indexes
7. Lines 250-295: escalation_logs table + indexes
8. Lines 297-328: dispatch_alerts table + indexes
9. Lines 330-387: Statistical views (4 total)
10. Lines 389-426: Update triggers

---

## Troubleshooting Guide

### Issue 1: "Extension 'uuid-ossp' does not exist"

**Error:**
```
ERROR: extension "uuid-ossp" does not exist
```

**Solution:**
```bash
# Enable the extension before running migration
psql -h localhost -U postgres -d barq_db -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# Then run the migration
node backend/src/database/migrations/run-migrations.js
```

---

### Issue 2: "Enum type already exists"

**Error:**
```
ERROR: type "assignment_type" already exists
```

**Solution:**
This is NOT an error! The migration uses `DO ... EXCEPTION WHEN duplicate_object` to handle this gracefully. This means the enum was already created (likely from a previous attempt). Just verify the existing enum values match:

```bash
psql -h localhost -U postgres -d barq_db << 'EOF'
SELECT enumlabel FROM pg_enum
WHERE enumtypid = 'assignment_type'::regtype;
EOF
```

Expected values: AUTO_ASSIGNED, FORCE_ASSIGNED, MANUAL

---

### Issue 3: "Permission denied for schema public"

**Error:**
```
ERROR: permission denied for schema public
```

**Solution:**
```bash
# Grant permissions to your database user
psql -h localhost -U postgres -d barq_db << 'EOF'
GRANT ALL PRIVILEGES ON SCHEMA public TO your_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
EOF
```

---

### Issue 4: "Relation 'xyz_logs' does not exist"

**Error:**
```
ERROR: relation "assignment_logs" does not exist
```

**Solution:**
The migration didn't run successfully. Check:

```bash
# Verify the migration file exists
ls -la backend/src/database/migrations/002_create_automation_tables.sql

# Check PostgreSQL logs for errors
# If using Docker: docker logs barq-postgres

# Verify you're connecting to the correct database
psql -h localhost -U postgres -d barq_db -c "SELECT current_database();"

# Re-run the migration with error output
node backend/src/database/migrations/run-migrations.js 2>&1 | tee migration.log
```

---

### Issue 5: Views showing as unavailable

**Error:**
```
ERROR: view "auto_dispatch_stats" does not exist
```

**Solution:**
Views depend on tables existing first. If tables exist but views don't:

```bash
# Run just the view creation part
psql -h localhost -U postgres -d barq_db << 'EOF'
CREATE OR REPLACE VIEW auto_dispatch_stats AS
SELECT
  DATE(assigned_at) as date,
  COUNT(*) as total_assignments,
  -- ... rest of view definition
FROM assignment_logs
GROUP BY DATE(assigned_at)
ORDER BY date DESC;
EOF
```

Or re-run the complete migration.

---

### Issue 6: API endpoints returning 503 "Service Unavailable"

**Error:**
```
HTTP 503: Engine not initialized or Automation tables missing
```

**Solution:**

1. Verify all tables exist:
   ```bash
   psql -h localhost -U postgres -d barq_db -c "\dt public.assignment_logs"
   ```

2. Check backend logs for specific error:
   ```bash
   # If using Docker
   docker logs barq-backend | tail -50 | grep -i "automation\|assignment\|escalation"

   # Or check local logs
   tail -50 logs/backend.log
   ```

3. Verify database connection from backend:
   ```bash
   node backend/src/database/migrations/run-migrations.js --verify
   ```

4. Restart backend service:
   ```bash
   npm restart
   ```

---

### Issue 7: Slow query performance

**Symptom:** Stats endpoints taking 5+ seconds to respond

**Solution:**
Verify indexes were created:

```bash
psql -h localhost -U postgres -d barq_db << 'EOF'
-- Check indexes on assignment_logs
SELECT indexname FROM pg_indexes
WHERE tablename = 'assignment_logs'
ORDER BY indexname;

-- Should show approximately 5 indexes for each table
EOF
```

If indexes are missing, recreate them:

```sql
CREATE INDEX idx_assignment_logs_assigned_at ON assignment_logs(assigned_at DESC);
CREATE INDEX idx_assignment_logs_date ON assignment_logs(DATE(assigned_at));
-- ... etc for other tables
```

---

### Issue 8: "Trigger already exists" error

**Error:**
```
ERROR: trigger "update_assignment_logs_updated_at" already exists
```

**Solution:**
This is normal during re-runs. The migration uses `DROP TRIGGER IF EXISTS` to handle this. This means:

1. Previous migration attempt partially completed, OR
2. Tables were manually created

Both are fine - just verify the trigger function exists:

```bash
psql -h localhost -U postgres -d barq_db << 'EOF'
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'update_automation_updated_at';
EOF
```

Expected output: `update_automation_updated_at`

---

## Production Deployment Checklist

Before deploying to production, verify:

- [ ] Migration file is in correct location: `/backend/src/database/migrations/002_create_automation_tables.sql`
- [ ] Database backup exists: `pg_dump barq_db > barq_db_backup.sql`
- [ ] All 6 tables created successfully
- [ ] All 4 views created successfully
- [ ] All 6 enums created successfully
- [ ] All 30+ indexes created
- [ ] Sample query works: `SELECT * FROM auto_dispatch_stats LIMIT 1`
- [ ] Backend connects to database without errors
- [ ] All 11 automation endpoints return data (not 503)
- [ ] No ERROR messages in PostgreSQL logs
- [ ] Monitoring/alerting configured for automation tables

---

## Performance Baseline

After successful migration, these queries should execute in <100ms:

```bash
psql -h localhost -U postgres -d barq_db << 'EOF'
-- Should return < 100ms
EXPLAIN ANALYZE SELECT * FROM auto_dispatch_stats
WHERE date >= CURRENT_DATE - INTERVAL '7 days';

-- Should return < 100ms
EXPLAIN ANALYZE SELECT COUNT(*) FROM assignment_logs
WHERE DATE(assigned_at) = CURRENT_DATE;

-- Should return < 100ms
EXPLAIN ANALYZE SELECT * FROM traffic_incidents
WHERE active = true AND severity IN ('HIGH', 'SEVERE');

-- Should return < 100ms
EXPLAIN ANALYZE SELECT * FROM escalation_logs
WHERE status = 'open' AND severity IN ('high', 'critical');
EOF
```

If any query takes longer, verify:
1. Indexes exist (see Issue 7)
2. Table statistics are updated: `ANALYZE;`
3. No missing or bloated indexes

---

## Rollback Procedure

If needed, to remove all automation tables (NOT recommended in production):

```bash
psql -h localhost -U postgres -d barq_db << 'EOF'
-- Drop views first
DROP VIEW IF EXISTS escalation_stats;
DROP VIEW IF EXISTS batch_performance_stats;
DROP VIEW IF EXISTS route_optimization_stats;
DROP VIEW IF EXISTS auto_dispatch_stats;

-- Drop tables
DROP TABLE IF EXISTS dispatch_alerts;
DROP TABLE IF EXISTS escalation_logs;
DROP TABLE IF EXISTS order_batches;
DROP TABLE IF EXISTS traffic_incidents;
DROP TABLE IF EXISTS route_optimizations;
DROP TABLE IF EXISTS assignment_logs;

-- Drop enums
DROP TYPE IF EXISTS batch_status;
DROP TYPE IF EXISTS traffic_severity;
DROP TYPE IF EXISTS severity_level;
DROP TYPE IF EXISTS alert_type;
DROP TYPE IF EXISTS escalation_type;
DROP TYPE IF EXISTS assignment_type;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_automation_updated_at();
EOF
```

**WARNING:** Only do this if you're certain you want to remove all automation data!

---

## Monitoring & Health Checks

### Automated Health Check Query

```sql
-- Check all automation tables are healthy
SELECT
  'assignment_logs'::text as table_name,
  COUNT(*) as row_count,
  NOW() - MAX(created_at) as latest_age
FROM assignment_logs
UNION ALL
SELECT 'route_optimizations', COUNT(*), NOW() - MAX(created_at) FROM route_optimizations
UNION ALL
SELECT 'traffic_incidents', COUNT(*), NOW() - MAX(reported_at) FROM traffic_incidents
UNION ALL
SELECT 'order_batches', COUNT(*), NOW() - MAX(created_at) FROM order_batches
UNION ALL
SELECT 'escalation_logs', COUNT(*), NOW() - MAX(created_at) FROM escalation_logs
UNION ALL
SELECT 'dispatch_alerts', COUNT(*), NOW() - MAX(created_at) FROM dispatch_alerts;
```

### Daily Stats Query

```sql
-- Generate daily health report
SELECT
  'Auto-Dispatch' as engine,
  COUNT(*) as daily_records,
  AVG(total_score) as avg_score
FROM assignment_logs
WHERE DATE(assigned_at) = CURRENT_DATE
UNION ALL
SELECT 'Route Optimization', COUNT(*), AVG(improvement_percentage)
FROM route_optimizations
WHERE DATE(optimized_at) = CURRENT_DATE
UNION ALL
SELECT 'Smart Batching', COUNT(*), AVG(delivery_success_rate)
FROM order_batches
WHERE DATE(created_at) = CURRENT_DATE
UNION ALL
SELECT 'Escalation', COUNT(*), NULL
FROM escalation_logs
WHERE DATE(created_at) = CURRENT_DATE;
```

---

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review the PostgreSQL logs: `SELECT * FROM pg_stat_statements;`
3. Verify migration file integrity: `md5sum backend/src/database/migrations/002_create_automation_tables.sql`
4. Contact database administrator with migration.log output

---

## References

- Schema documentation: `/AUTOMATION_SCHEMA_GUIDE.md`
- Endpoint coverage: `/AUTOMATION_ENDPOINTS_COVERAGE.md`
- Migration file: `/backend/src/database/migrations/002_create_automation_tables.sql`
- Routes file: `/backend/src/routes/automation.routes.js`

