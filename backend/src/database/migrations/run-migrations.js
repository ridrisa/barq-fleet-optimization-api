/**
 * Database Migration Runner
 * Executes SQL migration files in order
 *
 * Usage:
 *   node run-migrations.js                  # Run all pending migrations
 *   node run-migrations.js 001              # Run specific migration
 *   node run-migrations.js --rollback       # Rollback last migration (if supported)
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'barq_logistics',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

const pool = new Pool(dbConfig);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Create migrations tracking table
 */
async function createMigrationsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      execution_time_ms INTEGER,
      success BOOLEAN DEFAULT true,
      error_message TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_schema_migrations_name
      ON schema_migrations(migration_name);
  `;

  try {
    await pool.query(query);
    log('✓ Migrations table ready', 'green');
  } catch (error) {
    log(`✗ Failed to create migrations table: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * Get list of executed migrations
 */
async function getExecutedMigrations() {
  try {
    const result = await pool.query(
      'SELECT migration_name FROM schema_migrations WHERE success = true ORDER BY id'
    );
    return result.rows.map((row) => row.migration_name);
  } catch (error) {
    // Table might not exist yet
    return [];
  }
}

/**
 * Get list of migration files
 */
async function getMigrationFiles() {
  const migrationsDir = __dirname;
  const files = await fs.readdir(migrationsDir);

  return files.filter((file) => file.endsWith('.sql') && file !== 'rollback.sql').sort();
}

/**
 * Execute a migration file
 */
async function executeMigration(filename) {
  const startTime = Date.now();
  const filePath = path.join(__dirname, filename);

  try {
    log(`\n→ Running migration: ${filename}`, 'blue');

    // Read migration file
    const sql = await fs.readFile(filePath, 'utf8');

    // Execute in transaction
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Execute migration SQL
      await client.query(sql);

      const executionTime = Date.now() - startTime;

      // Record migration
      await client.query(
        `INSERT INTO schema_migrations (migration_name, execution_time_ms, success)
         VALUES ($1, $2, true)`,
        [filename, executionTime]
      );

      await client.query('COMMIT');

      log(`✓ Migration completed in ${executionTime}ms`, 'green');
      return { success: true, executionTime };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    const executionTime = Date.now() - startTime;

    log(`✗ Migration failed: ${error.message}`, 'red');

    // Record failed migration
    try {
      await pool.query(
        `INSERT INTO schema_migrations (migration_name, execution_time_ms, success, error_message)
         VALUES ($1, $2, false, $3)`,
        [filename, executionTime, error.message]
      );
    } catch (recordError) {
      log(`  Warning: Could not record failed migration: ${recordError.message}`, 'yellow');
    }

    throw error;
  }
}

/**
 * Run all pending migrations
 */
async function runMigrations(specificMigration = null) {
  try {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'gray');
    log('Database Migration Runner', 'blue');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'gray');

    // Test database connection
    log('→ Testing database connection...', 'blue');
    await pool.query('SELECT NOW()');
    log('✓ Database connected', 'green');

    // Create migrations table
    await createMigrationsTable();

    // Get executed and pending migrations
    const executedMigrations = await getExecutedMigrations();
    const allMigrations = await getMigrationFiles();

    log(`\n→ Found ${allMigrations.length} migration file(s)`, 'blue');
    log(`→ Already executed: ${executedMigrations.length}`, 'blue');

    // Determine which migrations to run
    let migrationsToRun;

    if (specificMigration) {
      const migrationFile = allMigrations.find((m) => m.startsWith(specificMigration));

      if (!migrationFile) {
        throw new Error(`Migration not found: ${specificMigration}`);
      }

      if (executedMigrations.includes(migrationFile)) {
        log(`\n⚠ Migration already executed: ${migrationFile}`, 'yellow');
        log('  Use --force to re-run (not implemented)', 'gray');
        return;
      }

      migrationsToRun = [migrationFile];
    } else {
      migrationsToRun = allMigrations.filter((m) => !executedMigrations.includes(m));
    }

    if (migrationsToRun.length === 0) {
      log('\n✓ All migrations up to date!', 'green');
      return;
    }

    log(`\n→ Running ${migrationsToRun.length} pending migration(s)...`, 'blue');

    // Execute migrations
    let successCount = 0;
    let failureCount = 0;

    for (const migration of migrationsToRun) {
      try {
        await executeMigration(migration);
        successCount++;
      } catch (error) {
        failureCount++;
        log(`\n  Error details: ${error.stack}`, 'red');
        log('\n  Migration aborted. Fix errors and try again.', 'red');
        break; // Stop on first error
      }
    }

    // Summary
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'gray');
    log('Migration Summary', 'blue');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'gray');
    log(`✓ Successful: ${successCount}`, 'green');
    if (failureCount > 0) {
      log(`✗ Failed: ${failureCount}`, 'red');
    }
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'gray');

    if (failureCount === 0) {
      log('✓ All migrations completed successfully!', 'green');
    }
  } catch (error) {
    log(`\n✗ Migration process failed: ${error.message}`, 'red');
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Show migration status
 */
async function showStatus() {
  try {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'gray');
    log('Migration Status', 'blue');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'gray');

    const executedMigrations = await getExecutedMigrations();
    const allMigrations = await getMigrationFiles();

    log(`Total migrations: ${allMigrations.length}`, 'blue');
    log(`Executed: ${executedMigrations.length}`, 'green');
    log(`Pending: ${allMigrations.length - executedMigrations.length}\n`, 'yellow');

    if (executedMigrations.length > 0) {
      log('Executed migrations:', 'green');
      executedMigrations.forEach((m) => {
        log(`  ✓ ${m}`, 'green');
      });
      log('');
    }

    const pending = allMigrations.filter((m) => !executedMigrations.includes(m));

    if (pending.length > 0) {
      log('Pending migrations:', 'yellow');
      pending.forEach((m) => {
        log(`  → ${m}`, 'yellow');
      });
      log('');
    }

    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'gray');
  } catch (error) {
    log(`✗ Failed to get status: ${error.message}`, 'red');
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === '--status' || command === '-s') {
      await showStatus();
    } else if (command === '--help' || command === '-h') {
      log('\nDatabase Migration Runner', 'blue');
      log('\nUsage:', 'gray');
      log('  node run-migrations.js              Run all pending migrations', 'gray');
      log('  node run-migrations.js 001          Run specific migration', 'gray');
      log('  node run-migrations.js --status     Show migration status', 'gray');
      log('  node run-migrations.js --help       Show this help\n', 'gray');
    } else {
      await runMigrations(command);
    }

    process.exit(0);
  } catch (error) {
    console.error('\nFatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { runMigrations, showStatus };
