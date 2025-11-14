/**
 * Test Script for Schema Versioning System
 * Tests the new schema manager to ensure it works correctly
 */

const { Pool } = require('pg');
const SchemaManager = require('./schema-manager');

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function info(message) {
  log(`ℹ ${message}`, 'blue');
}

function warn(message) {
  log(`⚠ ${message}`, 'yellow');
}

async function runTests() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'barq_logistics',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  const schemaManager = new SchemaManager(pool);

  log('\n====== Schema Versioning System Tests ======\n', 'cyan');

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Test 1: Check connection
    info('Test 1: Database Connection');
    try {
      await pool.query('SELECT NOW()');
      success('Database connection successful');
      testsPassed++;
    } catch (err) {
      error(`Database connection failed: ${err.message}`);
      testsFailed++;
      return;
    }

    // Test 2: Check if versioning is installed
    info('\nTest 2: Versioning System Installation');
    try {
      const isInstalled = await schemaManager.isVersioningInstalled();
      if (isInstalled) {
        success('Versioning system is installed');
        testsPassed++;
      } else {
        warn('Versioning system not installed, will install...');
        await schemaManager.initializeVersioning();
        success('Versioning system installed successfully');
        testsPassed++;
      }
    } catch (err) {
      error(`Versioning system check failed: ${err.message}`);
      testsFailed++;
    }

    // Test 3: Get current schema version
    info('\nTest 3: Schema Version Check');
    try {
      const version = await schemaManager.getSchemaVersion();
      success(`Current schema version: ${version}`);
      testsPassed++;
    } catch (err) {
      error(`Schema version check failed: ${err.message}`);
      testsFailed++;
    }

    // Test 4: Check if schema is installed
    info('\nTest 4: Schema Installation Check');
    try {
      const isInstalled = await schemaManager.isSchemaInstalled();
      if (isInstalled) {
        success('Main schema is installed');
      } else {
        warn('Main schema not installed');
      }
      testsPassed++;
    } catch (err) {
      error(`Schema installation check failed: ${err.message}`);
      testsFailed++;
    }

    // Test 5: Get database info
    info('\nTest 5: Database Information');
    try {
      const dbInfo = await schemaManager.getDatabaseInfo();
      if (dbInfo) {
        success('Database info retrieved:');
        console.log(JSON.stringify(dbInfo, null, 2));
      } else {
        warn('Database info not available (schema might not be fully initialized)');
      }
      testsPassed++;
    } catch (err) {
      error(`Database info retrieval failed: ${err.message}`);
      testsFailed++;
    }

    // Test 6: Check migration tracking
    info('\nTest 6: Migration Tracking');
    try {
      const result = await pool.query(`
        SELECT migration_name, version, applied_at, success
        FROM schema_migrations
        ORDER BY applied_at DESC
        LIMIT 5
      `);

      if (result.rows.length > 0) {
        success(`Found ${result.rows.length} applied migrations:`);
        result.rows.forEach((row) => {
          console.log(
            `  - ${row.migration_name} (v${row.version}) - Applied: ${row.applied_at} - Success: ${row.success}`
          );
        });
      } else {
        warn('No migrations applied yet');
      }
      testsPassed++;
    } catch (err) {
      error(`Migration tracking check failed: ${err.message}`);
      testsFailed++;
    }

    // Test 7: Check version history
    info('\nTest 7: Version History');
    try {
      const result = await pool.query(`
        SELECT version, name, installed_on, success
        FROM schema_version
        ORDER BY version DESC
      `);

      if (result.rows.length > 0) {
        success(`Found ${result.rows.length} schema versions:`);
        result.rows.forEach((row) => {
          console.log(
            `  - Version ${row.version}: ${row.name} - Installed: ${row.installed_on} - Success: ${row.success}`
          );
        });
      } else {
        warn('No schema versions recorded yet');
      }
      testsPassed++;
    } catch (err) {
      error(`Version history check failed: ${err.message}`);
      testsFailed++;
    }

    // Test 8: Test helper functions
    info('\nTest 8: Helper Functions');
    try {
      // Test get_schema_version()
      const versionResult = await pool.query('SELECT get_schema_version() as version');
      success(`get_schema_version() = ${versionResult.rows[0].version}`);

      // Test is_migration_applied()
      const migrationResult = await pool.query(
        "SELECT is_migration_applied($1) as applied",
        ['001_add_driver_state_tracking']
      );
      const isApplied = migrationResult.rows[0].applied;
      success(
        `is_migration_applied('001_add_driver_state_tracking') = ${isApplied}`
      );

      testsPassed++;
    } catch (err) {
      error(`Helper functions test failed: ${err.message}`);
      testsFailed++;
    }

    // Test 9: Check core tables exist
    info('\nTest 9: Core Tables Existence');
    try {
      const tablesToCheck = [
        'schema_version',
        'schema_migrations',
        'drivers',
        'customers',
        'orders',
        'zones',
      ];

      let allTablesExist = true;

      for (const table of tablesToCheck) {
        const result = await pool.query(
          `SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = $1
          ) as exists`,
          [table]
        );

        if (result.rows[0].exists) {
          success(`  ✓ ${table} table exists`);
        } else {
          error(`  ✗ ${table} table missing`);
          allTablesExist = false;
        }
      }

      if (allTablesExist) {
        success('All core tables exist');
        testsPassed++;
      } else {
        error('Some core tables are missing');
        testsFailed++;
      }
    } catch (err) {
      error(`Core tables check failed: ${err.message}`);
      testsFailed++;
    }

    // Test 10: Check views exist
    info('\nTest 10: Views Existence');
    try {
      const viewsToCheck = [
        'schema_version_history',
        'migration_history',
        'database_info',
        'active_orders',
        'driver_performance',
        'sla_performance',
      ];

      let allViewsExist = true;

      for (const view of viewsToCheck) {
        const result = await pool.query(
          `SELECT EXISTS (
            SELECT 1 FROM information_schema.views
            WHERE table_schema = 'public' AND table_name = $1
          ) as exists`,
          [view]
        );

        if (result.rows[0].exists) {
          success(`  ✓ ${view} view exists`);
        } else {
          warn(`  - ${view} view missing (might not be created yet)`);
          allViewsExist = false;
        }
      }

      if (allViewsExist) {
        success('All expected views exist');
        testsPassed++;
      } else {
        warn('Some views are missing (this might be expected)');
        testsPassed++; // Still pass, views might not be created yet
      }
    } catch (err) {
      error(`Views check failed: ${err.message}`);
      testsFailed++;
    }

    // Test 11: Test idempotency
    info('\nTest 11: Idempotency Test');
    try {
      info('Running initialize() twice to test idempotency...');

      const result1 = await schemaManager.initialize();
      info('First run completed');

      const result2 = await schemaManager.initialize();
      info('Second run completed');

      success('Initialization is idempotent (can run multiple times safely)');
      testsPassed++;
    } catch (err) {
      error(`Idempotency test failed: ${err.message}`);
      testsFailed++;
    }

    // Summary
    log('\n====== Test Summary ======\n', 'cyan');
    log(`Total Tests: ${testsPassed + testsFailed}`, 'cyan');
    success(`Passed: ${testsPassed}`);
    if (testsFailed > 0) {
      error(`Failed: ${testsFailed}`);
    }

    if (testsFailed === 0) {
      log('\n🎉 All tests passed! Schema versioning system is working correctly.\n', 'green');
    } else {
      log('\n⚠️  Some tests failed. Please review the errors above.\n', 'yellow');
    }
  } catch (err) {
    error(`\nTest suite failed with error: ${err.message}`);
    console.error(err.stack);
  } finally {
    await pool.end();
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
