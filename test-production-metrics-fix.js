/**
 * Test Production Metrics Fix
 * Verify that pool.connect() now works correctly
 */

const pool = require('./backend/src/services/postgres.service');
const ProductionMetricsService = require('./backend/src/services/production-metrics.service');

async function testProductionMetricsFix() {
  console.log('\n=== Testing Production Metrics pool.connect Fix ===\n');

  try {
    //1. Test pool.connect() method exists
    console.log('1. Testing pool.connect() method...');
    if (typeof pool.connect === 'function') {
      console.log('✅ pool.connect() method exists');
    } else {
      console.log('❌ pool.connect() method NOT found');
      process.exit(1);
    }

    // 2. Test pool.connect() works
    console.log('\n2. Testing pool.connect() execution...');
    await pool.initialize();
    const client = await pool.connect();
    console.log('✅ pool.connect() executed successfully');

    // 3. Test client works
    console.log('\n3. Testing client query...');
    const result = await client.query('SELECT NOW()');
    console.log('✅ Client query successful');
    console.log(`   Current time: ${result.rows[0].now}`);
    client.release();
    console.log('✅ Client released');

    // 4. Test production metrics service
    console.log('\n4. Testing ProductionMetricsService.getOnTimeDeliveryRate()...');
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const endDate = new Date();

    const metrics = await ProductionMetricsService.getOnTimeDeliveryRate(startDate, endDate);
    console.log('✅ Production metrics service works!');
    console.log(`   On-time rate: ${metrics.on_time_rate.toFixed(2)}%`);
    console.log(`   On-time count: ${metrics.on_time_count}`);
    console.log(`   Late count: ${metrics.late_count}`);
    console.log(`   Total deliveries: ${metrics.total_deliveries}`);

    console.log('\n🎉 ALL TESTS PASSED! Production metrics bug is FIXED!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code || 'N/A'}`);
    console.error(`   Stack: ${error.stack}`);
    console.log('');
    process.exit(1);
  } finally {
    await pool.close();
  }
}

// Run the test
testProductionMetricsFix();
