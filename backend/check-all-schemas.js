/**
 * Check all relevant table schemas
 */

const barqProductionDB = require('./src/services/barqfleet-production.service');

async function checkAllSchemas() {
  try {
    console.log('Checking database schemas...\n');

    // Check merchants table
    console.log('=== MERCHANTS TABLE ===');
    const merchantsColumns = await barqProductionDB.pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'merchants'
      ORDER BY ordinal_position
    `);
    merchantsColumns.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

    // Check shipments table in detail
    console.log('\n=== SHIPMENTS TABLE (detailed) ===');
    const shipmentsColumns = await barqProductionDB.pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'shipments'
      ORDER BY ordinal_position
    `);
    shipmentsColumns.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkAllSchemas();
