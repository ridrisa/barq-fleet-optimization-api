/**
 * Verification Script: Check Demo Orders in Database
 */

const db = require('./src/database');

async function verifyOrdersInDatabase() {
  console.log('\n=== Verifying Demo Orders in Database ===\n');

  try {
    await db.connect();

    // Count total orders
    const countResult = await db.query('SELECT COUNT(*) as total FROM orders');
    console.log(`Total orders in database: ${countResult.rows[0].total}`);

    // Get recent orders
    const recentOrders = await db.query(`
      SELECT
        id,
        order_number,
        service_type,
        status,
        estimated_distance,
        pickup_address->>'city' as pickup_city,
        pickup_address->>'street' as pickup_street,
        dropoff_address->>'city' as dropoff_city,
        dropoff_address->>'street' as dropoff_street,
        package_details->>'description' as package_description,
        delivery_fee,
        total_amount,
        created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log(`\nRecent ${recentOrders.rows.length} orders:`);
    console.log('─'.repeat(120));

    recentOrders.rows.forEach((order, idx) => {
      console.log(`\n${idx + 1}. Order: ${order.order_number}`);
      console.log(`   ID: ${order.id}`);
      console.log(`   Service: ${order.service_type} | Status: ${order.status}`);
      console.log(`   Distance: ${order.estimated_distance} km`);
      console.log(`   Pickup: ${order.pickup_street} (${order.pickup_city})`);
      console.log(`   Dropoff: ${order.dropoff_street} (${order.dropoff_city})`);
      console.log(`   Package: ${order.package_description}`);
      console.log(`   Fee: SAR ${order.delivery_fee} | Total: SAR ${order.total_amount}`);
      console.log(`   Created: ${order.created_at}`);
    });

    console.log('\n' + '─'.repeat(120));

    // Test JSONB functionality
    console.log('\n=== Testing JSONB Query Functionality ===\n');

    const jsonbTest = await db.query(`
      SELECT
        COUNT(*) as riyadh_orders
      FROM orders
      WHERE pickup_address->>'city' = 'Riyadh'
    `);

    console.log(`Orders with pickup in Riyadh: ${jsonbTest.rows[0].riyadh_orders}`);

    // Check for any orders with NULL estimated_distance
    const nullDistanceCheck = await db.query(`
      SELECT COUNT(*) as null_distance_count
      FROM orders
      WHERE estimated_distance IS NULL
    `);

    console.log(`Orders with NULL estimated_distance: ${nullDistanceCheck.rows[0].null_distance_count}`);

    console.log('\n✅ Database verification complete!\n');

    await db.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

verifyOrdersInDatabase();
