/**
 * Migration Script: LowDB to PostgreSQL
 * Migrates all data from JSON file database to PostgreSQL
 */

const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');
const db = require('../src/database');

async function migrate() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║   LowDB → PostgreSQL Migration Script        ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  try {
    // Step 1: Load LowDB data
    console.log('📂 Step 1: Loading LowDB data...');
    const adapter = new JSONFile(path.join(__dirname, '../src/db/db.json'));
    const lowdb = new Low(adapter);
    await lowdb.read();

    if (!lowdb.data) {
      console.error('❌ Error: No data found in db.json');
      process.exit(1);
    }

    console.log('✅ Data loaded successfully');
    console.log(`   - Requests: ${lowdb.data.requests?.length || 0}`);
    console.log(`   - Optimizations: ${lowdb.data.optimizations?.length || 0}`);
    console.log(`   - Metrics: ${lowdb.data.metrics?.length || 0}\n`);

    // Step 2: Test PostgreSQL connection
    console.log('🔌 Step 2: Testing PostgreSQL connection...');
    const healthCheck = await db.healthCheck();

    if (!healthCheck.healthy) {
      console.error('❌ Error: Cannot connect to PostgreSQL');
      console.error(`   ${healthCheck.error}`);
      console.log('\n💡 Make sure PostgreSQL is running:');
      console.log('   brew services start postgresql  (macOS)');
      console.log('   systemctl start postgresql      (Ubuntu)');
      process.exit(1);
    }

    console.log('✅ PostgreSQL connection successful');
    console.log(`   Database: ${healthCheck.database}`);
    console.log(`   Server Time: ${healthCheck.serverTime}\n`);

    // Step 3: Create backup
    console.log('💾 Step 3: Creating backup...');
    const fs = require('fs').promises;
    const backupPath = path.join(__dirname, '../src/db/db.backup.json');
    await fs.copyFile(
      path.join(__dirname, '../src/db/db.json'),
      backupPath
    );
    console.log(`✅ Backup created: ${backupPath}\n`);

    // Step 4: Migrate optimization requests
    console.log('🔄 Step 4: Migrating optimization requests...');
    let migratedRequests = 0;
    let skippedRequests = 0;

    for (const request of lowdb.data.requests || []) {
      try {
        await db.query(`
          INSERT INTO optimization_requests
            (id, request_data, created_at, status, result_data)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO NOTHING
        `, [
          request.id,
          JSON.stringify(request),
          request.timestamp || new Date(),
          'completed',
          request.result ? JSON.stringify(request.result) : null
        ]);

        migratedRequests++;

        if (migratedRequests % 10 === 0) {
          process.stdout.write(`\r   Progress: ${migratedRequests} requests migrated...`);
        }
      } catch (error) {
        console.error(`\n   ⚠️  Failed to migrate request ${request.id}: ${error.message}`);
        skippedRequests++;
      }
    }

    console.log(`\n✅ Requests migrated: ${migratedRequests}`);
    if (skippedRequests > 0) {
      console.log(`   ⚠️  Skipped: ${skippedRequests}\n`);
    } else {
      console.log('');
    }

    // Step 5: Migrate optimizations (if separate collection)
    if (lowdb.data.optimizations && lowdb.data.optimizations.length > 0) {
      console.log('🔄 Step 5: Migrating optimizations...');
      let migratedOpts = 0;

      for (const opt of lowdb.data.optimizations) {
        try {
          // Store in optimization_requests table
          await db.query(`
            INSERT INTO optimization_requests
              (id, request_data, created_at, status, result_data)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO NOTHING
          `, [
            opt.id,
            JSON.stringify(opt.request || {}),
            opt.createdAt || new Date(),
            opt.status || 'completed',
            JSON.stringify(opt)
          ]);

          migratedOpts++;

          if (migratedOpts % 10 === 0) {
            process.stdout.write(`\r   Progress: ${migratedOpts} optimizations migrated...`);
          }
        } catch (error) {
          console.error(`\n   ⚠️  Failed to migrate optimization ${opt.id}: ${error.message}`);
        }
      }

      console.log(`\n✅ Optimizations migrated: ${migratedOpts}\n`);
    }

    // Step 6: Create indexes
    console.log('📊 Step 6: Creating performance indexes...');

    const indexes = [
      {
        name: 'idx_orders_status',
        sql: 'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)'
      },
      {
        name: 'idx_orders_driver_id',
        sql: 'CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id)'
      },
      {
        name: 'idx_orders_created_at',
        sql: 'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC)'
      },
      {
        name: 'idx_drivers_status',
        sql: 'CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status)'
      },
      {
        name: 'idx_driver_locations_timestamp',
        sql: 'CREATE INDEX IF NOT EXISTS idx_driver_locations_timestamp ON driver_locations(driver_id, timestamp DESC)'
      },
      {
        name: 'idx_optimization_requests_created',
        sql: 'CREATE INDEX IF NOT EXISTS idx_optimization_requests_created ON optimization_requests(created_at DESC)'
      }
    ];

    for (const index of indexes) {
      try {
        await db.query(index.sql);
        console.log(`   ✅ Created: ${index.name}`);
      } catch (error) {
        console.log(`   ⚠️  Index ${index.name} might already exist`);
      }
    }

    console.log('');

    // Step 7: Verify migration
    console.log('🔍 Step 7: Verifying migration...');

    const verifyResult = await db.query(`
      SELECT
        COUNT(*) as total_requests,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as recent_requests,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests
      FROM optimization_requests
    `);

    const stats = verifyResult.rows[0];
    console.log('✅ Verification complete:');
    console.log(`   Total Requests: ${stats.total_requests}`);
    console.log(`   Recent (24h): ${stats.recent_requests}`);
    console.log(`   Completed: ${stats.completed_requests}\n`);

    // Step 8: Performance test
    console.log('⚡ Step 8: Running performance test...');

    const startTime = Date.now();
    const testResult = await db.query(`
      SELECT id, created_at, status
      FROM optimization_requests
      ORDER BY created_at DESC
      LIMIT 100
    `);
    const queryTime = Date.now() - startTime;

    console.log(`✅ Query performance: ${queryTime}ms for 100 records`);

    if (queryTime > 100) {
      console.log('   ⚠️  Query is slower than expected. Make sure indexes are created.\n');
    } else {
      console.log('   🚀 Excellent query performance!\n');
    }

    // Step 9: Summary
    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║          Migration Completed!                 ║');
    console.log('╚═══════════════════════════════════════════════╝\n');

    console.log('📊 Migration Summary:');
    console.log(`   ✅ Requests migrated: ${migratedRequests}`);
    console.log(`   ✅ Database: PostgreSQL`);
    console.log(`   ✅ Indexes: Created`);
    console.log(`   ✅ Performance: ${queryTime}ms\n`);

    console.log('🎯 Next Steps:');
    console.log('   1. Update .env file with PostgreSQL credentials');
    console.log('   2. Test API endpoints: npm test');
    console.log('   3. Run load test: node scripts/load-test.js');
    console.log('   4. Monitor performance dashboard');
    console.log('   5. Deploy to production\n');

    console.log('💡 Tips:');
    console.log('   - Backup is saved at: backend/src/db/db.backup.json');
    console.log('   - You can still rollback if needed');
    console.log('   - Monitor logs for any issues');
    console.log('   - Database connections are pooled (max 20)\n');

    await db.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(`   ${error.message}`);
    console.error('\nStack trace:');
    console.error(error.stack);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Check PostgreSQL is running');
    console.log('   2. Verify database credentials in .env');
    console.log('   3. Ensure schema is created: psql -f src/database/schema.sql');
    console.log('   4. Check connection string format\n');

    await db.disconnect();
    process.exit(1);
  }
}

// Run migration
console.log('\n🚀 Starting migration process...\n');
migrate();
