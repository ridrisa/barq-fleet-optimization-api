/**
 * Fleet Manager Database Migration Runner
 * Run: node scripts/run-fleet-migration.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration from environment
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'barq_logistics',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const migrationFile = path.join(__dirname, '../src/database/migrations/003_fleet_manager_persistence.sql');

  console.log('🚀 Running Fleet Manager Database Migration...\n');
  console.log(`📂 Migration file: ${migrationFile}`);
  console.log(`🔌 Database: ${pool.options.database} @ ${pool.options.host}\n`);

  try {
    // Read migration SQL
    const sql = fs.readFileSync(migrationFile, 'utf8');

    // Execute migration
    console.log('⏳ Executing migration...');
    await pool.query(sql);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Tables created:');
    console.log('   • driver_targets');
    console.log('   • driver_performance_history');
    console.log('\n🔍 Verifying tables...');

    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('driver_targets', 'driver_performance_history')
      ORDER BY table_name
    `);

    if (result.rows.length === 2) {
      console.log('✅ All tables verified successfully!');
      result.rows.forEach(row => {
        console.log(`   ✓ ${row.table_name}`);
      });
    } else {
      console.log('⚠️  Warning: Some tables may not have been created');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nDetails:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
runMigration();
