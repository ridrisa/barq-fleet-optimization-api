/**
 * Quick script to check actual database schema
 */

const barqProductionDB = require('./src/services/barq-production-db.service');

async function checkSchema() {
  try {
    console.log('Checking actual database schema...\n');

    // Check hubs table columns
    const hubsColumns = await barqProductionDB.pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'hubs'
      ORDER BY ordinal_position
    `);

    console.log('=== HUBS TABLE COLUMNS ===');
    hubsColumns.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

    // Check couriers table columns
    const couriersColumns = await barqProductionDB.pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'couriers'
      ORDER BY ordinal_position
    `);

    console.log('\n=== COURIERS TABLE COLUMNS ===');
    couriersColumns.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

    // Check orders table columns
    const ordersColumns = await barqProductionDB.pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'orders'
      LIMIT 30
    `);

    console.log('\n=== ORDERS TABLE COLUMNS (First 30) ===');
    ordersColumns.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSchema();
