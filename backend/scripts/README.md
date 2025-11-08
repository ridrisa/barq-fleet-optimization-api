# Database Migration Scripts

Quick reference for PostgreSQL migration scripts.

## Scripts Overview

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `init-database.js` | Initialize PostgreSQL database and schema | First time setup |
| `backup-lowdb.js` | Backup LowDB data before migration | Before migration |
| `migrate-data.js` | Migrate data from LowDB to PostgreSQL | After init and backup |
| `test-concurrent-writes.js` | Test database for race conditions | After migration |

## Quick Start

### 1. Initialize Database
```bash
node scripts/init-database.js
```
**What it does:**
- Creates `barq_logistics` database
- Executes schema-enhanced.sql
- Creates 15 tables, 3 views, 50+ indexes
- Verifies setup

**Prerequisites:**
- PostgreSQL 15+ installed and running
- Environment variables configured in .env

---

### 2. Backup Existing Data
```bash
node scripts/backup-lowdb.js
```
**What it does:**
- Creates timestamped backup of db.json
- Saves to `backend/backups/` directory
- Verifies backup integrity
- Shows data summary

**Output:**
```
db_backup_2025-11-05_14-30-00.json
```

---

### 3. Migrate Data
```bash
node scripts/migrate-data.js
```
**What it does:**
- Reads data from db.json
- Transforms to PostgreSQL format
- Inserts into database
- Reports statistics

**Expected output:**
```
✓ Migrated 1500 optimization requests
✓ Migrated 1500 optimization results
✓ Migrated 30 metrics
```

---

### 4. Test Concurrent Writes
```bash
node scripts/test-concurrent-writes.js
```
**What it does:**
- Tests concurrent request creation (50)
- Tests concurrent optimizations (50)
- Tests concurrent updates (100)
- Tests read performance (200)
- Tests mixed operations (100)

**Expected result:**
```
✓ All tests passed! Database is production-ready.
```

---

## Environment Variables

Required in `.env`:

```bash
# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=barq_logistics
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password

# Database Mode
DATABASE_MODE=postgres
```

---

## Complete Migration Flow

```bash
# Step 1: Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# Step 2: Initialize database
node scripts/init-database.js

# Step 3: Backup existing data
node scripts/backup-lowdb.js

# Step 4: Migrate data
node scripts/migrate-data.js

# Step 5: Test concurrent writes
node scripts/test-concurrent-writes.js

# Step 6: Start application
npm start
```

---

## Troubleshooting

### Error: Connection refused
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Start PostgreSQL
brew services start postgresql@15  # macOS
sudo systemctl start postgresql    # Linux
```

### Error: Database already exists
This is OK! The script will use the existing database.

### Error: Permission denied
Check your PostgreSQL user has sufficient privileges:
```sql
GRANT ALL PRIVILEGES ON DATABASE barq_logistics TO your_user;
```

### Migration errors
Check logs for details. Common issues:
- Missing parent records (foreign key violations)
- Duplicate IDs (should be rare with UUIDs)
- Invalid data formats (script handles transformation)

---

## Rollback

If migration fails or issues arise:

```bash
# 1. Stop application
# 2. Set DATABASE_MODE=lowdb in .env
# 3. Restore from backup if needed:
cp backups/db_backup_[timestamp].json src/db/db.json
# 4. Restart application
```

---

## Script Flags and Options

### init-database.js
```bash
# No flags - runs with defaults from .env
node scripts/init-database.js
```

### backup-lowdb.js
```bash
# No flags - creates timestamped backup
node scripts/backup-lowdb.js
```

### migrate-data.js
```bash
# No flags - migrates all data
node scripts/migrate-data.js
```

### test-concurrent-writes.js
```bash
# No flags - runs all 5 tests
node scripts/test-concurrent-writes.js
```

---

## File Locations

```
backend/
├── scripts/
│   ├── init-database.js        # Database initialization
│   ├── migrate-data.js         # Data migration
│   ├── backup-lowdb.js         # Backup script
│   ├── test-concurrent-writes.js  # Concurrency tests
│   └── README.md               # This file
├── src/
│   ├── database/
│   │   └── schema-enhanced.sql # PostgreSQL schema
│   └── services/
│       ├── postgres.service.js # PostgreSQL service
│       └── database.service.js # Dual-mode service
├── backups/                    # Created by backup script
│   └── db_backup_*.json
└── .env.example                # Environment template
```

---

## Additional Resources

- **Full Migration Guide:** `../DATABASE_MIGRATION_GUIDE.md`
- **Summary Report:** `../MIGRATION_SUMMARY_REPORT.md`
- **Schema Documentation:** `../src/database/schema-enhanced.sql`

---

## Support

For issues:
1. Check script output for error messages
2. Review logs in `logs/app.log`
3. Consult troubleshooting section above
4. Check PostgreSQL logs

---

**Last Updated:** November 5, 2025
**Version:** 1.0
