# Database Migrations

## Quick Start

```bash
# Run all pending migrations
node run-migrations.js

# Check status
node run-migrations.js --status

# Run specific migration
node run-migrations.js 001
```

## Setup

### 1. Configure Database Connection

Set environment variables:

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=barq_logistics
export DB_USER=postgres
export DB_PASSWORD=your_password
```

Or create `.env` file in backend root:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=barq_logistics
DB_USER=postgres
DB_PASSWORD=your_password
```

### 2. Ensure PostgreSQL Extensions

The system requires:
- `uuid-ossp` - UUID generation
- `postgis` - Geographic data support

These are installed automatically by the schema.

### 3. Run Migrations

```bash
cd backend/src/database/migrations
node run-migrations.js
```

## Available Migrations

### 001_add_driver_state_tracking.sql

**Purpose:** Adds comprehensive driver state tracking system

**Changes:**
- New `operational_state` enum (OFFLINE, AVAILABLE, BUSY, RETURNING, ON_BREAK)
- 20+ new columns in `drivers` table
- New `driver_state_transitions` table
- 8 new indexes for performance
- 5 new database functions
- 3 new views
- Automatic state transition logging
- Daily metrics reset function

**Estimated Time:** 2-5 seconds on empty database

**Dependencies:** Requires base `schema.sql` to be loaded

## Migration Runner Features

### Status Checking

```bash
node run-migrations.js --status
```

Shows:
- Total migrations available
- Executed migrations
- Pending migrations

### Transaction Safety

All migrations run in transactions:
- Success = changes committed
- Failure = automatic rollback
- Database remains consistent

### Execution Logging

Migrations are tracked in `schema_migrations` table:

```sql
SELECT * FROM schema_migrations ORDER BY executed_at DESC;
```

Columns:
- `migration_name` - File name
- `executed_at` - Timestamp
- `execution_time_ms` - Duration
- `success` - Status
- `error_message` - If failed

### Error Handling

If migration fails:
1. Transaction is rolled back
2. Error is logged to `schema_migrations`
3. Process stops (won't continue to next migration)
4. Fix error and re-run

## Creating New Migrations

### Naming Convention

```
NNN_description.sql
```

Examples:
- `001_add_driver_state_tracking.sql`
- `002_add_customer_preferences.sql`
- `003_create_analytics_tables.sql`

**Rules:**
- Start with 3-digit number (001, 002, etc.)
- Use underscores for spaces
- Be descriptive but concise
- Use `.sql` extension

### Migration Template

```sql
-- Migration: [Title]
-- Version: NNN
-- Description: [What this migration does]

-- ============================================
-- 1. CREATE/ALTER TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- columns...
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_new_table_field
  ON new_table(field);

-- ============================================
-- 3. CREATE FUNCTIONS/TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION function_name()
RETURNS trigger AS $$
BEGIN
  -- logic...
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. GRANT PERMISSIONS
-- ============================================

GRANT ALL PRIVILEGES ON new_table TO postgres;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

COMMENT ON TABLE new_table IS 'Purpose of this table';
```

### Best Practices

**1. Idempotency**
Always use:
- `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- `CREATE OR REPLACE FUNCTION`
- `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END $$;`

**2. Safety**
- Never `DROP` in production migrations
- Use `ALTER TABLE ADD COLUMN IF NOT EXISTS` (PostgreSQL 9.6+)
- Add constraints carefully (check for existing data)
- Use default values for new NOT NULL columns

**3. Performance**
- Create indexes CONCURRENTLY when possible
- Avoid table rewrites on large tables
- Batch large data updates
- Consider maintenance windows

**4. Documentation**
- Add comments explaining why
- Document breaking changes
- Note dependencies
- Provide rollback plan if possible

## Rollback Strategy

### Manual Rollback

Since SQL migrations don't have automatic rollback:

1. Create inverse migration
2. Name it with next number
3. Undo changes from previous migration

Example:
```
002_rollback_driver_state_tracking.sql
```

### Backup Before Migration

Always backup before running migrations:

```bash
pg_dump -U postgres barq_logistics > backup_$(date +%Y%m%d_%H%M%S).sql
```

Restore if needed:
```bash
psql -U postgres barq_logistics < backup_20250115_143000.sql
```

## Troubleshooting

### Migration Won't Run

**Problem:** Migration already executed

```bash
# Check status
node run-migrations.js --status

# If incorrectly marked as executed, remove from tracking
psql -U postgres barq_logistics
DELETE FROM schema_migrations WHERE migration_name = '001_add_driver_state_tracking.sql';
```

**Problem:** Database connection failed

```bash
# Test connection
psql -U postgres -h localhost -d barq_logistics

# Check environment variables
echo $DB_HOST
echo $DB_NAME
```

**Problem:** Permission denied

```sql
-- Grant permissions to your user
GRANT ALL PRIVILEGES ON DATABASE barq_logistics TO your_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
```

### Migration Failed Mid-Execution

**What Happened:**
Transaction was rolled back automatically. Database is in consistent state.

**What To Do:**
1. Read error message carefully
2. Fix SQL syntax or logic error
3. Re-run migration runner

**Example Error:**

```
✗ Migration failed: column "operational_state" already exists
```

**Solution:**
Change from:
```sql
ALTER TABLE drivers ADD COLUMN operational_state ...
```

To:
```sql
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS operational_state ...
```

## Testing Migrations

### On Development Database

```bash
# 1. Backup current state
pg_dump barq_logistics > backup.sql

# 2. Run migration
node run-migrations.js

# 3. Test application
npm test

# 4. If issues, restore
dropdb barq_logistics
createdb barq_logistics
psql barq_logistics < backup.sql
```

### On Staging Database

```bash
# 1. Deploy to staging
git push staging main

# 2. Run migrations
ssh staging "cd /app && node backend/src/database/migrations/run-migrations.js"

# 3. Monitor logs
ssh staging "tail -f /var/log/app/migrations.log"

# 4. Run smoke tests
npm run test:staging
```

## Production Deployment

### Pre-Flight Checklist

- [ ] Migration tested on development
- [ ] Migration tested on staging
- [ ] Database backed up
- [ ] Maintenance window scheduled (if needed)
- [ ] Rollback plan prepared
- [ ] Team notified

### Deployment Steps

```bash
# 1. Backup production database
pg_dump -h production-db.example.com -U postgres barq_logistics > \
  backup_prod_$(date +%Y%m%d_%H%M%S).sql

# 2. Run migration
ssh production "cd /app && \
  DB_HOST=production-db.example.com \
  node backend/src/database/migrations/run-migrations.js"

# 3. Verify success
ssh production "cd /app && \
  node backend/src/database/migrations/run-migrations.js --status"

# 4. Monitor application
# Check logs, metrics, error rates
```

### Post-Deployment

- Monitor application logs for errors
- Check performance metrics
- Verify key features working
- Monitor database performance
- Keep backup for 7 days

## Advanced Usage

### Running Migrations in CI/CD

```yaml
# .github/workflows/deploy.yml
- name: Run Database Migrations
  run: |
    cd backend/src/database/migrations
    node run-migrations.js
  env:
    DB_HOST: ${{ secrets.DB_HOST }}
    DB_NAME: ${{ secrets.DB_NAME }}
    DB_USER: ${{ secrets.DB_USER }}
    DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
```

### Programmatic Usage

```javascript
const { runMigrations, showStatus } = require('./run-migrations');

// Run migrations
try {
  await runMigrations();
  console.log('Migrations completed');
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
}

// Check status
const status = await showStatus();
```

## FAQ

**Q: Can I edit a migration after it's been run?**
A: No. Create a new migration with the changes. Migrations should be immutable.

**Q: What if migration takes too long?**
A: For large data migrations, consider:
- Batching updates
- Using separate data migration scripts
- Running during maintenance window

**Q: How do I handle data migrations?**
A: Create SQL migration that:
1. Alters schema
2. Migrates data in batches
3. Adds constraints after data migration

**Q: Can migrations run concurrently?**
A: No. Migration runner runs one at a time to ensure consistency.

**Q: What if I need to rollback?**
A: Create a new migration that undoes the changes. Don't modify existing migrations.

## Support

- Documentation: `../DRIVER_STATE_SYSTEM.md`
- Issues: Contact database team
- Emergencies: Follow incident response protocol

## References

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [Database Migration Best Practices](https://www.postgresql.org/docs/current/ddl.html)
