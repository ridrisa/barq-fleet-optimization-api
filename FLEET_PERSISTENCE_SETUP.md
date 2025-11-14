# Fleet Manager Database Persistence Setup

## 🎯 Purpose
Add permanent PostgreSQL storage for driver targets and performance history.

**Without this:** All driver targets lost on every deployment/restart
**With this:** Driver data persists indefinitely with historical tracking

---

## 📋 Quick Start

### Option 1: Run via Cloud Run (Recommended)

```bash
# Connect to Cloud Run instance
gcloud run services describe route-opt-backend --region=us-central1 --format="value(status.url)"

# Use Cloud Run Jobs or gcloud run jobs execute
gcloud run jobs create fleet-migration \
  --image=gcr.io/barq-fleet-optimization-426674819922/route-opt-backend:latest \
  --region=us-central1 \
  --set-secrets=DB_HOST=POSTGRES_HOST:latest,DB_NAME=POSTGRES_DB:latest,DB_USER=POSTGRES_USER:latest,DB_PASSWORD=POSTGRES_PASSWORD:latest \
  --command="node" \
  --args="scripts/run-fleet-migration.js"

gcloud run jobs execute fleet-migration --region=us-central1
```

### Option 2: Run Locally with Cloud SQL Proxy

```bash
# Install Cloud SQL Proxy
# https://cloud.google.com/sql/docs/postgres/connect-instance-auth-proxy

# Start proxy
./cloud-sql-proxy barq-fleet-optimization-426674819922:us-central1:barq-db

# In another terminal, run migration
cd backend
DB_HOST=localhost \
DB_PORT=5432 \
DB_NAME=barq_logistics \
DB_USER=postgres \
DB_PASSWORD=BARQFleet2025SecurePass! \
node scripts/run-fleet-migration.js
```

### Option 3: Upload and Import via Cloud SQL

```bash
# Upload migration to Cloud Storage
gsutil cp backend/src/database/migrations/003_fleet_manager_persistence.sql \
  gs://barq-fleet-optimization-426674819922-migrations/

# Import to Cloud SQL
gcloud sql import sql barq-db \
  gs://barq-fleet-optimization-426674819922-migrations/003_fleet_manager_persistence.sql \
  --database=barq_logistics
```

---

## ✅ Verification

After running migration, verify tables exist:

```sql
-- Check tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('driver_targets', 'driver_performance_history');

-- Should return:
--  table_name
-- driver_targets
-- driver_performance_history

-- Check driver_targets structure
\d driver_targets

-- Test insert
INSERT INTO driver_targets (driver_id, target_deliveries, target_revenue)
VALUES ('TEST_DRIVER_001', 50, 5000.00);

SELECT * FROM driver_targets WHERE driver_id = 'TEST_DRIVER_001';

-- Clean up test
DELETE FROM driver_targets WHERE driver_id = 'TEST_DRIVER_001';
```

---

## 📊 Tables Created

### `driver_targets`
Stores current driver targets and real-time progress

| Column | Type | Description |
|--------|------|-------------|
| driver_id | VARCHAR(100) | Primary key, unique driver identifier |
| target_deliveries | INTEGER | Daily delivery target |
| target_revenue | DECIMAL(10,2) | Daily revenue target |
| current_deliveries | INTEGER | Current deliveries count |
| current_revenue | DECIMAL(10,2) | Current revenue generated |
| status | VARCHAR(20) | available, busy, break, offline |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Auto-updated on change |

**Indexes:**
- `idx_driver_targets_status` - Fast status lookups
- `idx_driver_targets_updated_at` - Recent updates

### `driver_performance_history`
Historical daily performance records

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Auto-incrementing primary key |
| driver_id | VARCHAR(100) | Driver identifier |
| date | DATE | Performance date |
| deliveries_completed | INTEGER | Actual deliveries |
| revenue_generated | DECIMAL(10,2) | Actual revenue |
| target_deliveries | INTEGER | Day's target deliveries |
| target_revenue | DECIMAL(10,2) | Day's target revenue |
| target_achieved | BOOLEAN | Met target? |
| achievement_percentage | DECIMAL(5,2) | Performance % |
| created_at | TIMESTAMP | Record creation |

**Indexes:**
- `idx_performance_driver_date` - Driver history queries
- `idx_performance_date` - Date range queries
- `idx_performance_achieved` - Achievement analytics

**Unique Constraint:** `(driver_id, date)` - One record per driver per day

---

## 🔄 Next Steps After Migration

### 1. Update Dynamic Fleet Manager Service
Currently uses in-memory Map, needs to use database:

```javascript
// backend/src/services/dynamic-fleet-manager.service.js

// CURRENT (in-memory):
this.driverTargets = new Map();

// CHANGE TO (database):
async getDriverTargets() {
  const result = await pool.query('SELECT * FROM driver_targets');
  return result.rows;
}

async setDriverTarget(driverId, targetDeliveries, targetRevenue) {
  await pool.query(`
    INSERT INTO driver_targets (driver_id, target_deliveries, target_revenue)
    VALUES ($1, $2, $3)
    ON CONFLICT (driver_id)
    DO UPDATE SET
      target_deliveries = $2,
      target_revenue = $3,
      updated_at = CURRENT_TIMESTAMP
  `, [driverId, targetDeliveries, targetRevenue]);
}
```

### 2. Add Daily Snapshot Function
Capture daily performance at midnight:

```javascript
// Run daily at 23:59
async function snapshotDailyPerformance() {
  await pool.query(`
    INSERT INTO driver_performance_history
      (driver_id, date, deliveries_completed, revenue_generated,
       target_deliveries, target_revenue, target_achieved, achievement_percentage)
    SELECT
      driver_id,
      CURRENT_DATE,
      current_deliveries,
      current_revenue,
      target_deliveries,
      target_revenue,
      (current_deliveries >= target_deliveries AND current_revenue >= target_revenue),
      calculate_achievement_percentage(current_deliveries, target_deliveries,
                                      current_revenue, target_revenue)
    FROM driver_targets
    ON CONFLICT (driver_id, date)
    DO UPDATE SET
      deliveries_completed = EXCLUDED.deliveries_completed,
      revenue_generated = EXCLUDED.revenue_generated
  `);
}
```

### 3. Add Performance Analytics Queries

```sql
-- Top performing drivers this week
SELECT
  driver_id,
  COUNT(*) as days_worked,
  SUM(deliveries_completed) as total_deliveries,
  SUM(revenue_generated) as total_revenue,
  AVG(achievement_percentage) as avg_achievement
FROM driver_performance_history
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY driver_id
ORDER BY avg_achievement DESC
LIMIT 10;

-- Drivers consistently missing targets
SELECT
  driver_id,
  COUNT(*) FILTER (WHERE target_achieved = false) as missed_days,
  AVG(achievement_percentage) as avg_performance
FROM driver_performance_history
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY driver_id
HAVING COUNT(*) FILTER (WHERE target_achieved = false) > 5
ORDER BY avg_performance ASC;
```

---

## ⚡ Performance Considerations

- **Indexes** are optimized for common query patterns
- **Triggers** auto-update timestamps
- **Unique constraints** prevent duplicate records
- **DECIMAL precision** ensures accurate currency calculations

**Estimated Performance:**
- Single driver lookup: < 1ms
- 100 drivers status: < 5ms
- 30-day history query: < 50ms
- Daily snapshot insert: < 100ms

---

## 🔒 Security

- ✅ Tables created with `IF NOT EXISTS` (safe to re-run)
- ✅ No sensitive data stored (just metrics)
- ✅ Standard PostgreSQL permissions apply
- ⚠️ Grant appropriate role permissions in production

---

## 🚨 Troubleshooting

### Migration fails with "relation already exists"
```sql
-- This is safe - tables already created
-- Migration uses IF NOT EXISTS
```

### Can't connect to database
- Ensure Cloud SQL instance is running
- Check firewall rules/authorized networks
- Use Cloud SQL Proxy for local access
- Verify credentials in secrets

### Driver targets not persisting
- Check service is using database queries (not Map)
- Verify database connection pool initialized
- Check application logs for SQL errors

---

**Status:** Migration file created, ready to run
**Risk:** LOW - Uses IF NOT EXISTS, safe to re-run
**Time to run:** < 1 minute
**Estimated impact:** 2-5ms added latency per request (database vs memory)

**Created:** 2025-11-14
**Migration:** 003_fleet_manager_persistence.sql
**Runner:** scripts/run-fleet-migration.js
