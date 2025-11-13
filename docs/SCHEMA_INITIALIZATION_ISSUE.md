# 🔴 Critical Issue: Schema Initialization Failure

**Date**: 2025-11-12 10:26 UTC
**Severity**: BLOCKER
**Status**: 🔴 IDENTIFIED - Needs Fix

---

## 📊 Current Situation

### What's Working ✅
- DATABASE_MODE=postgres IS set in Cloud Run
- PostgreSQL connection succeeds
- Pool is created successfully
- Logs show: "Connected successfully"

### What's Failing ❌
- Schema initialization fails
- Error: "cannot drop columns from view"
- PostgreSQL pool becomes unusable
- All 31 database-dependent endpoints return 500

---

## 🔍 Root Cause Analysis

### The Error Chain

1. **app.js:535** - Calls `postgresService.initialize()`
2. **postgres.service.js:59** - Creates Pool ✅
3. **postgres.service.js:78** - Connects to database ✅
4. **Schema initialization** - Tries to modify database schema
5. **ERROR**: "Transaction failed cannot drop columns from view"
6. **postgres.service.js:94** - Throws error
7. **app.js:537** - Catches error, logs warning, continues
8. **Problem**: Pool exists but is unusable

### Log Evidence
```
2025-11-12 10:08:49 [INFO]: [Database] Connected successfully
2025-11-12 10:08:49 [ERROR]: [Database] Transaction failed cannot drop columns from view
2025-11-12 10:08:49 [ERROR]: [Database] Failed to initialize schema cannot drop columns from view
```

### Why Analytics Endpoints Fail
```javascript
// In analytics.routes.js
const result = await postgresService.query(sqlQuery);
// ERROR: Cannot read properties of null (reading 'query')
```

---

## 🎯 The Real Problem

**The database service IS NOT using the PostgreSQL service!**

Looking at the logs and code flow:
1. `postgresService.initialize()` is called (for automation engines)
2. It fails but is caught in try-catch
3. **Analytics routes are likely using a DIFFERENT database service**
4. That service was never initialized with DATABASE_MODE

---

## 🔧 Solution Approach

### Option 1: Skip Schema Initialization in Production (Quick Fix)
Add environment variable to skip automatic schema setup:
```javascript
// In postgres.service.js initialize()
if (process.env.SKIP_SCHEMA_INIT === 'true') {
  logger.info('Skipping schema initialization (SKIP_SCHEMA_INIT=true)');
  return; // Skip schema setup, just return with pool
}
```

### Option 2: Fix Schema Migration (Proper Fix)
Investigate and fix the "cannot drop columns from view" error in schema migrations.

### Option 3: Make PostgreSQL Service More Resilient
```javascript
// Don't throw error if connection succeeds but schema fails
try {
  await this.initializeSchema();
} catch (schemaError) {
  logger.warn('Schema initialization failed, but connection is working', {
    error: schemaError.message
  });
  // Continue with just the connection pool
}
```

---

## 🚨 Immediate Action Plan

1. **Check where analytics routes get their database connection**
   - They might be using `database.service.js` instead of `postgres.service.js`
   - Need to verify DATABASE_MODE is checked in the right place

2. **Add SKIP_SCHEMA_INIT environment variable**
   - Quick fix to get endpoints working
   - Skip problematic schema migrations

3. **Investigate the view drop error**
   - Find which migration is trying to drop columns from a view
   - Fix or remove that migration

---

## 📝 Files Involved

### Key Files to Check
1. `backend/src/services/postgres.service.js` - PostgreSQL pool initialization
2. `backend/src/services/database.service.js` - Database abstraction layer
3. `backend/src/routes/v1/analytics.routes.js` - Uses database for queries
4. `backend/src/app.js` - Application initialization (line 535)

### Initialization Flow
```
app.js:535 → postgresService.initialize()
  ↓
postgres.service.js:33-96 → Initialize pool + schema
  ↓
[ERROR] Schema init fails
  ↓
app.js:537 → catch error, log warning
  ↓
[BUG] Analytics routes use different/uninitialized service?
```

---

## 🔬 Next Debugging Steps

### 1. Check Database Service Usage
```bash
grep -r "database\.query\|databaseService" backend/src/routes/v1/analytics.routes.js
```

### 2. Find Schema Initialization Code
```bash
grep -r "drop.*view\|DROP.*VIEW" backend/src/services/
grep -r "initializeSchema" backend/src/
```

### 3. Check Both Database Services
```bash
diff backend/src/services/postgres.service.js backend/src/services/database.service.js
```

---

## 💡 Hypothesis

**There are TWO database services:**
1. `postgres.service.js` - For automation engines (initialized with try-catch)
2. `database.service.js` - For analytics/routes (NOT initialized or wrong mode)

The analytics routes are using the WRONG service, which doesn't have DATABASE_MODE configured.

---

## ⚡ Quick Fix to Deploy

Add to cloudbuild.yaml:
```yaml
SKIP_SCHEMA_INIT=true
```

Then modify postgres.service.js to respect this flag and skip schema initialization.

---

**Status**: 🔴 **INVESTIGATION NEEDED**
**Priority**: P0 - CRITICAL
**Impact**: 31 endpoints (55% of API)

---

🤖 Generated with Claude Code
📅 2025-11-12 10:26 UTC
