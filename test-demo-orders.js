const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || '34.65.15.192',
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'BARQFleet2025SecurePass!',
  database: process.env.POSTGRES_DB || 'barq_logistics',
  ssl: false,
});

async function checkDemoOrders() {
  try {
    console.log('Connecting to database...\n');

    // Check total orders
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM orders');
    console.log(`Total orders in database: ${totalResult.rows[0].total}`);

    // Check recent orders (last 5 minutes)
    const recentResult = await pool.query(
      "SELECT COUNT(*) as recent FROM orders WHERE created_at > NOW() - INTERVAL '5 minutes'"
    );
    console.log(`Orders in last 5 minutes: ${recentResult.rows[0].recent}`);

    // Get sample of most recent orders
    const sampleResult = await pool.query(
      "SELECT id, service_type, status, created_at FROM orders ORDER BY created_at DESC LIMIT 5"
    );

    console.log('\nMost recent orders:');
    if (sampleResult.rows.length === 0) {
      console.log('  (No orders found)');
    } else {
      sampleResult.rows.forEach((order, idx) => {
        console.log(`  ${idx + 1}. ID: ${order.id}, Type: ${order.service_type}, Status: ${order.status}, Created: ${order.created_at}`);
      });
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkDemoOrders();
