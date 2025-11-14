# Database Schema Version Tracking - Migration Guide

## Problem Summary

**Issue**: Database initialization was failing with the error:
```
[ERROR]: [Database] Transaction failed cannot drop columns from view
[ERROR]: [Database] Failed to initialize schema cannot drop columns from view
```

**Root Cause**:
1. `schema.sql` creates views (`active_orders`, `driver_performance`, `sla_performance`)
2. Migration `001_add_driver_state_tracking.sql` tries to `CREATE OR REPLACE` same views with different columns
3. PostgreSQL cannot replace views when column structure changes (adding/removing columns)
4. Old initialization logic blindly ran schema.sql and all migrations every time
5. Error was caught but masked the underlying issue

## Solution: Schema Version Tracking System

### New Architecture

```
┌─────────────────────────────────────────┐
│  Database Initialization Process        │
└─────────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │ 1. Check if versioning exists │
    └───────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │ 2. Install schema-version.sql │
    │    (if needed)                │
    └───────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │ 3. Check current version      │
    │    get_schema_version()       │
    └───────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │ 4. Install schema.sql         │
    │    (if version < 1)           │
    │    Record as version 1        │
    └───────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │ 5. Run pending migrations     │
    │    Check each migration       │
    │    Skip if already applied    │
    └───────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │ 6. Database ready!            │
    └───────────────────────────────┘
```

### New Files

1. **`schema-version.sql`** - Versioning infrastructure
   - `schema_version` table
   - `schema_migrations` table
   - Helper functions (`get_schema_version()`, `is_migration_applied()`, etc.)
   - Tracking views

2. **`schema-manager.js`** - Intelligent schema initialization
   - Checks if versioning is installed
   - Checks if schema is already initialized
   - Only runs schema.sql once
   - Tracks applied migrations
   - Prevents duplicate execution

3. **`index-new.js`** - Updated database manager
   - Uses SchemaManager instead of blind execution
   - Provides schema info endpoints
   - Better error handling

### Database Tables

#### `schema_version`
Tracks major schema versions (e.g., base schema = version 1)

```sql
CREATE TABLE schema_version (
  id SERIAL PRIMARY KEY,
  version INTEGER NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  installed_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  installed_by VARCHAR(100) DEFAULT CURRENT_USER,
  execution_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  schema_checksum VARCHAR(64)
);
```

#### `schema_migrations`
Tracks individual migration files

```sql
CREATE TABLE schema_migrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  version INTEGER NOT NULL,
  file_path VARCHAR(500),
  file_checksum VARCHAR(64),
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  applied_by VARCHAR(100) DEFAULT CURRENT_USER,
  execution_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  rollback_sql TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);
```

### Helper Functions

```sql
-- Get current schema version
SELECT get_schema_version(); -- Returns 0, 1, 2, etc.

-- Check if migration was applied
SELECT is_migration_applied('001_add_driver_state_tracking'); -- Returns true/false

-- Record new schema version
SELECT record_schema_version(1, 'base-schema', 'Initial schema', 1234, 'checksum');

-- Record migration
SELECT record_migration('001_add_driver_state_tracking', 1, '/path/to/file', 1234, true, NULL, '{}');
```

### Monitoring Views

```sql
-- View schema version history
SELECT * FROM schema_version_history;

-- View migration history
SELECT * FROM migration_history;

-- View database info
SELECT * FROM database_info;
```

## Migration Steps

### Option 1: Automated Migration (Recommended)

1. **Backup your database**:
   ```bash
   pg_dump -U postgres barq_logistics > backup_before_migration.sql
   ```

2. **Replace index.js**:
   ```bash
   cd backend/src/database
   mv index.js index.js.old
   mv index-new.js index.js
   ```

3. **Restart backend**:
   ```bash
   npm run dev
   ```

4. **Verify**:
   - No "cannot drop columns from view" error
   - Check logs for successful initialization
   - Test health endpoint: GET /health

### Option 2: Manual Migration (For Production)

1. **Backup database**:
   ```bash
   pg_dump -U postgres barq_logistics > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Install versioning system**:
   ```bash
   psql -U postgres -d barq_logistics -f backend/src/database/schema-version.sql
   ```

3. **Check current state**:
   ```sql
   SELECT * FROM database_info;
   ```

4. **If schema exists, record it**:
   ```sql
   SELECT record_schema_version(
     1,
     'base-schema',
     'Existing production schema',
     NULL,
     NULL
   );
   ```

5. **Mark applied migrations**:
   ```sql
   -- If migration 001 is already applied
   SELECT record_migration(
     '001_add_driver_state_tracking',
     1,
     NULL,
     NULL,
     true,
     NULL,
     '{}'::jsonb
   );

   -- If migration 002 is already applied
   SELECT record_migration(
     '001_add_service_types',
     1,
     NULL,
     NULL,
     true,
     NULL,
     '{}'::jsonb
   );
   ```

6. **Update code**:
   ```bash
   cd backend/src/database
   mv index.js index.js.old
   mv index-new.js index.js
   ```

7. **Restart application**:
   ```bash
   pm2 restart barq-backend
   ```

### Option 3: Fresh Database Setup

1. **Drop and recreate database**:
   ```bash
   psql -U postgres -c "DROP DATABASE IF EXISTS barq_logistics;"
   psql -U postgres -c "CREATE DATABASE barq_logistics;"
   ```

2. **Update code**:
   ```bash
   cd backend/src/database
   mv index.js index.js.old
   mv index-new.js index.js
   ```

3. **Start application** (it will auto-initialize):
   ```bash
   npm run dev
   ```

## Verification

### Check Schema Version

```sql
-- Get current version
SELECT get_schema_version();

-- View version history
SELECT * FROM schema_version_history;
```

### Check Applied Migrations

```sql
-- List all applied migrations
SELECT migration_name, applied_at, success
FROM schema_migrations
ORDER BY applied_at DESC;

-- Check specific migration
SELECT is_migration_applied('001_add_driver_state_tracking');
```

### Check Database Health

```sql
-- Database info
SELECT * FROM database_info;

-- Expected output:
-- current_version: 1
-- applied_migrations: 2 (or however many you have)
-- failed_migrations: 0
-- database_name: barq_logistics
```

### API Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": {
    "healthy": true,
    "database": "barq_logistics",
    "serverTime": "2025-11-14T...",
    "poolStats": {
      "totalCount": 1,
      "idleCount": 1,
      "waitingCount": 0
    },
    "schema": {
      "healthy": true,
      "schemaVersion": 1,
      "appliedMigrations": 2,
      "failedMigrations": 0
    }
  }
}
```

## Troubleshooting

### Error: "cannot drop columns from view"

**Cause**: Old initialization logic still running
**Fix**: Ensure you've replaced index.js with index-new.js

### Error: "schema_version table does not exist"

**Cause**: Versioning system not installed
**Fix**: Run schema-version.sql manually:
```bash
psql -U postgres -d barq_logistics -f backend/src/database/schema-version.sql
```

### Error: "duplicate key value violates unique constraint"

**Cause**: Trying to record same version/migration twice
**Fix**: Check what's already recorded:
```sql
SELECT * FROM schema_version;
SELECT * FROM schema_migrations;
```

### Fresh Start Needed

If things get messy, start fresh:

```bash
# Backup first!
pg_dump -U postgres barq_logistics > emergency_backup.sql

# Drop database
psql -U postgres -c "DROP DATABASE barq_logistics;"
psql -U postgres -c "CREATE DATABASE barq_logistics;"

# Update code
cd backend/src/database
mv index.js index.js.old
mv index-new.js index.js

# Start app (auto-initializes)
npm run dev
```

## Future Migrations

### Creating New Migrations

1. **Create migration file**:
   ```bash
   # Format: XXX_description.sql
   touch backend/src/database/migrations/003_add_analytics_tables.sql
   ```

2. **Write migration SQL**:
   ```sql
   -- Migration: Add Analytics Tables
   -- Version: 003

   CREATE TABLE IF NOT EXISTS analytics_events (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     event_type VARCHAR(100) NOT NULL,
     ...
   );
   ```

3. **Restart app** - Migration auto-applies
   - SchemaManager detects new file
   - Checks `is_migration_applied('003_add_analytics_tables')`
   - If not applied, runs it
   - Records in `schema_migrations` table

### Manual Migration Application

```bash
psql -U postgres -d barq_logistics -f backend/src/database/migrations/003_add_analytics_tables.sql
```

Then record it:
```sql
SELECT record_migration(
  '003_add_analytics_tables',
  3,
  '/path/to/file',
  1234, -- execution time in ms
  true,
  NULL,
  '{}'::jsonb
);
```

## Benefits

1. **No More Errors**: Idempotent initialization prevents "cannot drop columns" errors
2. **Audit Trail**: Every schema change is tracked with timestamps and execution times
3. **Safe Deployments**: Knows what's already applied, never re-runs
4. **Rollback Support**: Can add rollback SQL to migrations
5. **Health Monitoring**: `/health` endpoint shows schema status
6. **Development Friendly**: Fresh databases auto-initialize correctly
7. **Production Safe**: Existing databases upgrade smoothly

## Schema Version Roadmap

- **Version 0**: Versioning system infrastructure
- **Version 1**: Base schema (schema.sql) - Core tables, views, functions
- **Migration 001**: Driver state tracking (`001_add_driver_state_tracking.sql`)
- **Migration 002**: Service types (`001_add_service_types.sql`)
- **Future**: Version 2 might be a major schema refactor, Version 3 for multi-tenancy, etc.

---

**Questions?** Check the code comments in `schema-manager.js` and `schema-version.sql`
