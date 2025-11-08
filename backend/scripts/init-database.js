/**
 * Database Initialization Script
 *
 * Initializes the barq_logistics PostgreSQL database with all required tables.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_CONFIG = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'barq_logistics',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
};

async function initDatabase() {
  const pool = new Pool(DB_CONFIG);
  
  try {
    console.log('🔄 Initializing database...');
    
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Connected to database');
    
    // Try to install PostGIS
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS postgis');
      console.log('✅ PostGIS extension ready');
    } catch (error) {
      console.log('⚠️  PostGIS not available (optional)');
    }
    
    // Execute main schema
    const schemaPath = path.join(__dirname, '../src/database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(sql);
      console.log('✅ Main schema created');
    }
    
    console.log('\n✅ Database initialized successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  initDatabase().catch(console.error);
}

module.exports = initDatabase;
