# Schema Versioning - Quick Reference

## TL;DR - Fix the Error

```bash
# 1. Backup
pg_dump -U postgres barq_logistics > backup.sql

# 2. Replace index.js
cd backend/src/database
mv index.js index.js.old
mv index-new.js index.js

# 3. Restart
npm run dev

# 4. Verify
curl http://localhost:3000/health | jq .database.schema
```

**Expected**: No more "cannot drop columns from view" error ✅

---

## Quick Commands

### Check Schema Version
```bash
psql -U postgres -d barq_logistics -c "SELECT get_schema_version();"
```

### Check Applied Migrations
```bash
psql -U postgres -d barq_logistics -c "SELECT migration_name, applied_at FROM schema_migrations ORDER BY applied_at;"
```

### View Database Info
```bash
psql -U postgres -d barq_logistics -c "SELECT * FROM database_info;"
```

### Run Tests
```bash
node backend/src/database/test-schema-versioning.js
```

---

## SQL Quick Reference

```sql
-- Current schema version
SELECT get_schema_version();

-- Check if migration was applied
SELECT is_migration_applied('001_add_driver_state_tracking');

-- View all migrations
SELECT * FROM migration_history;

-- View version history
SELECT * FROM schema_version_history;

-- Database status
SELECT * FROM database_info;

-- Manually record version
SELECT record_schema_version(1, 'base-schema', 'Description', 1234, 'checksum');

-- Manually record migration
SELECT record_migration('migration_name', 1, '/path', 1234, true, NULL, '{}');
```

---

## API Endpoints

### Health Check (includes schema info)
```bash
curl http://localhost:3000/health
```

**Response**:
```json
{
  "database": {
    "schema": {
      "healthy": true,
      "schemaVersion": 1,
      "appliedMigrations": 2,
      "failedMigrations": 0
    }
  }
}
```

---

## Creating New Migrations

### Step 1: Create File
```bash
touch backend/src/database/migrations/003_add_analytics_tables.sql
```

### Step 2: Write Migration
```sql
-- Migration: Add Analytics Tables
-- Version: 003

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
```

### Step 3: Restart App (auto-applies)
```bash
npm run dev
```

**That's it!** The SchemaManager will:
1. Detect new migration file
2. Check if already applied (no)
3. Run it in a transaction
4. Record in `schema_migrations` table

---

## Rollback (Manual)

```bash
# 1. Restore from backup
psql -U postgres -d barq_logistics < backup_20251114.sql

# 2. Remove migration record
psql -U postgres -d barq_logistics -c \
  "DELETE FROM schema_migrations WHERE migration_name = '003_add_analytics_tables';"
```

---

## Troubleshooting

### Error: "schema_version table does not exist"

**Fix**:
```bash
psql -U postgres -d barq_logistics -f backend/src/database/schema-version.sql
```

### Error: "cannot drop columns from view"

**Fix**: You're still using old `index.js`, replace with `index-new.js`

### Error: "duplicate key value"

**Check what's recorded**:
```sql
SELECT * FROM schema_version;
SELECT * FROM schema_migrations;
```

### Migration Failed

**Check error**:
```sql
SELECT migration_name, error_message
FROM schema_migrations
WHERE success = false;
```

---

## File Locations

```
backend/src/database/
├── schema-version.sql         # Versioning system (run once)
├── schema.sql                 # Base schema (version 1)
├── schema-manager.js          # Intelligent initialization
├── index.js                   # Old database manager (backup)
├── index-new.js               # New database manager (use this)
├── migrations/
│   ├── 001_add_driver_state_tracking.sql
│   ├── 001_add_service_types.sql
│   └── 003_your_new_migration.sql
├── MIGRATION_GUIDE.md         # Full documentation
├── IMPLEMENTATION_SUMMARY.md  # Technical details
└── test-schema-versioning.js  # Automated tests
```

---

## Status Checks

### Is Everything Working?

```bash
# 1. Check logs (no errors)
npm run dev

# 2. Run tests (all pass)
node backend/src/database/test-schema-versioning.js

# 3. Check health
curl http://localhost:3000/health | jq .database.schema

# 4. Check database
psql -U postgres -d barq_logistics -c "SELECT * FROM database_info;"
```

**All green?** ✅ You're good to go!

---

## Emergency Procedures

### Fresh Start (Development Only)

```bash
# WARNING: Deletes all data!
psql -U postgres -c "DROP DATABASE barq_logistics;"
psql -U postgres -c "CREATE DATABASE barq_logistics;"
npm run dev
```

### Rollback to Backup

```bash
psql -U postgres -c "DROP DATABASE barq_logistics;"
psql -U postgres -c "CREATE DATABASE barq_logistics;"
psql -U postgres -d barq_logistics < backup_20251114.sql
```

---

## Cheat Sheet

| What                     | Command                                                       |
| ------------------------ | ------------------------------------------------------------- |
| Get version              | `SELECT get_schema_version();`                                |
| Check migration          | `SELECT is_migration_applied('migration_name');`              |
| View migrations          | `SELECT * FROM migration_history;`                            |
| Database info            | `SELECT * FROM database_info;`                                |
| Health check             | `curl http://localhost:3000/health`                           |
| Run tests                | `node backend/src/database/test-schema-versioning.js`         |
| Create migration         | `touch migrations/00X_description.sql`                        |
| Apply migration          | `npm run dev` (auto-applies)                                  |
| Fresh start              | `DROP DATABASE + npm run dev`                                 |
| Backup                   | `pg_dump barq_logistics > backup.sql`                         |

---

## Need Help?

1. **Full docs**: Read `MIGRATION_GUIDE.md`
2. **Technical details**: Read `IMPLEMENTATION_SUMMARY.md`
3. **Test**: Run `test-schema-versioning.js`
4. **Ask**: Database Architect team
