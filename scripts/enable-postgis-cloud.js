#!/usr/bin/env node
/**
 * Enable PostGIS Extension on Cloud SQL
 * Run this from Cloud Run environment where Cloud SQL connection is available
 */

const { Pool } = require('pg');

const config = {
  host: process.env.DB_HOST || '/cloudsql/looker-barqdata-2030:us-central1:barq-db',
  database: process.env.DB_NAME || 'barq_logistics',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 1,
  connectionTimeoutMillis: 30000,
};

async function enablePostGIS() {
  const pool = new Pool(config);

  try {
    console.log('🔌 Connecting to Cloud SQL...');
    console.log(`   Database: ${config.database}`);
    console.log(`   Host: ${config.host}`);

    // Test connection
    const client = await pool.connect();
    console.log('✅ Connected successfully');

    // Enable PostGIS core extension
    console.log('\n📦 Enabling PostGIS extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
    console.log('✅ PostGIS enabled');

    // Enable PostGIS topology (optional)
    console.log('\n📦 Enabling PostGIS Topology...');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS postgis_topology');
      console.log('✅ PostGIS Topology enabled');
    } catch (error) {
      console.log('⚠️  PostGIS Topology not available:', error.message);
    }

    // Check PostGIS version
    console.log('\n🔍 Checking PostGIS version...');
    const versionResult = await client.query('SELECT PostGIS_Version()');
    console.log('✅ PostGIS Version:', versionResult.rows[0].postgis_version);

    // List all extensions
    console.log('\n📋 Installed extensions:');
    const extResult = await client.query(`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname LIKE 'postgis%'
      ORDER BY extname
    `);
    extResult.rows.forEach(row => {
      console.log(`   - ${row.extname} (v${row.extversion})`);
    });

    client.release();

    console.log('\n✅ PostGIS setup complete!');
    console.log('\n🔄 You may need to restart the application for changes to take effect.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the function
enablePostGIS().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
