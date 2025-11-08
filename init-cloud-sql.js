#!/usr/bin/env node

/**
 * Cloud SQL Database Initialization Script
 * Initializes the Cloud SQL database with the required schema
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_CONFIG = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'barq_logistics',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'BARQFleet2025SecurePass!',
};

console.log('🔄 Connecting to Cloud SQL database...');
console.log(`   Host: ${DB_CONFIG.host}`);
console.log(`   Database: ${DB_CONFIG.database}`);
console.log(`   User: ${DB_CONFIG.user}`);

async function initDatabase() {
  const pool = new Pool(DB_CONFIG);

  try {
    // Test connection
    console.log('\n📡 Testing database connection...');
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log(`✅ Connected successfully!`);
    console.log(`   Time: ${result.rows[0].current_time}`);
    console.log(`   PostgreSQL: ${result.rows[0].pg_version.split(',')[0]}`);

    // Check if tables already exist
    console.log('\n🔍 Checking existing tables...');
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    if (tablesResult.rows.length > 0) {
      console.log(`⚠️  Found ${tablesResult.rows.length} existing tables:`);
      tablesResult.rows.forEach(row => console.log(`   - ${row.table_name}`));
      console.log('\n❓ Tables already exist. Proceeding with schema update...');
    } else {
      console.log('✅ No tables found. Creating fresh schema...');
    }

    // Try to install UUID extension
    console.log('\n📦 Installing required extensions...');
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      console.log('✅ uuid-ossp extension ready');
    } catch (error) {
      console.log(`⚠️  uuid-ossp extension: ${error.message}`);
    }

    // Try to install PostGIS (optional)
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS postgis');
      console.log('✅ PostGIS extension ready');
    } catch (error) {
      console.log('⚠️  PostGIS not available (optional)');
    }

    // Execute main schema
    console.log('\n📝 Executing schema SQL...');
    const schemaPath = path.join(__dirname, 'backend/src/database/schema.sql');

    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }

    const sql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Schema executed successfully');

    // Verify tables were created
    console.log('\n🔍 Verifying created tables...');
    const finalTablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`✅ Found ${finalTablesResult.rows.length} tables:`);
    finalTablesResult.rows.forEach(row => console.log(`   ✓ ${row.table_name}`));

    // Check critical tables
    const criticalTables = ['orders', 'drivers', 'customers'];
    console.log('\n🎯 Checking critical tables for analytics...');
    for (const table of criticalTables) {
      const exists = finalTablesResult.rows.some(row => row.table_name === table);
      if (exists) {
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   ✅ ${table}: ${countResult.rows[0].count} rows`);
      } else {
        console.log(`   ❌ ${table}: NOT FOUND`);
      }
    }

    console.log('\n🎉 Database initialization completed successfully!');
    console.log('✅ Analytics service should now be able to query the database');

  } catch (error) {
    console.error('\n❌ Error during initialization:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    await pool.end();
    console.log('\n👋 Database connection closed');
  }
}

if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log('\n✅ All done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Initialization failed:', error.message);
      process.exit(1);
    });
}

module.exports = initDatabase;
