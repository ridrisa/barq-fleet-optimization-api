/**
 * Fix Production Database Enum Values
 * Adds EXPRESS and STANDARD to service_type enum
 */

const { Client } = require('pg');

async function fixEnumValues() {
  console.log('🔧 Connecting to production database...');

  const client = new Client({
    host: '136.116.6.7',
    port: 5432,
    database: 'barq_logistics',
    user: 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'BARQFleet2025SecurePass!',
    ssl: false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check current enum values
    console.log('\n📊 Current service_type enum values:');
    const currentValues = await client.query(`
      SELECT enumlabel
      FROM pg_enum
      WHERE enumtypid = 'service_type'::regtype
      ORDER BY enumsortorder;
    `);
    currentValues.rows.forEach(row => console.log(`  - ${row.enumlabel}`));

    // Add EXPRESS if not exists
    console.log('\n➕ Adding EXPRESS...');
    const expressCheck = await client.query(`
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'EXPRESS'
      AND enumtypid = 'service_type'::regtype;
    `);

    if (expressCheck.rows.length === 0) {
      await client.query(`ALTER TYPE service_type ADD VALUE 'EXPRESS';`);
      console.log('✅ Added EXPRESS');
    } else {
      console.log('ℹ️  EXPRESS already exists');
    }

    // Add STANDARD if not exists
    console.log('\n➕ Adding STANDARD...');
    const standardCheck = await client.query(`
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'STANDARD'
      AND enumtypid = 'service_type'::regtype;
    `);

    if (standardCheck.rows.length === 0) {
      await client.query(`ALTER TYPE service_type ADD VALUE 'STANDARD';`);
      console.log('✅ Added STANDARD');
    } else {
      console.log('ℹ️  STANDARD already exists');
    }

    // Verify final state
    console.log('\n✅ Final service_type enum values:');
    const finalValues = await client.query(`
      SELECT enumlabel
      FROM pg_enum
      WHERE enumtypid = 'service_type'::regtype
      ORDER BY enumsortorder;
    `);
    finalValues.rows.forEach(row => console.log(`  - ${row.enumlabel}`));

    console.log('\n🎉 Enum fix completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the fix
fixEnumValues();
