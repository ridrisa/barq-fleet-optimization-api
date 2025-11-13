/**
 * Setup Agent System Tables
 *
 * This script creates the required database tables for the agent system.
 * Run this before starting the backend with agents enabled.
 *
 * Usage:
 *   POSTGRES_HOST=34.65.15.192 POSTGRES_PASSWORD=password node backend/scripts/setup-agent-tables.js
 */

const { Pool } = require('pg');

// Database configuration from environment
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'barq_logistics',
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const SQL_CREATE_TABLES = `
-- Table 1: Assignment Logs
CREATE TABLE IF NOT EXISTS assignment_logs (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(255) NOT NULL,
  driver_id VARCHAR(255),
  assignment_strategy VARCHAR(100),
  distance_km DECIMAL(10,2),
  estimated_time_minutes INTEGER,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50),
  confidence_score DECIMAL(3,2),
  alternative_count INTEGER DEFAULT 0,
  metadata JSONB,
  created_by VARCHAR(100) DEFAULT 'AGENT_SYSTEM'
);

CREATE INDEX IF NOT EXISTS idx_assignment_logs_order ON assignment_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_driver ON assignment_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_timestamp ON assignment_logs(assigned_at DESC);

-- Table 2: Escalation Logs
CREATE TABLE IF NOT EXISTS escalation_logs (
  id SERIAL PRIMARY KEY,
  escalation_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  order_id VARCHAR(255),
  driver_id VARCHAR(255),
  reason TEXT,
  escalated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  resolution_notes TEXT,
  auto_resolved BOOLEAN DEFAULT FALSE,
  escalation_level INTEGER DEFAULT 1,
  metadata JSONB,
  created_by VARCHAR(100) DEFAULT 'AGENT_SYSTEM'
);

CREATE INDEX IF NOT EXISTS idx_escalation_logs_type ON escalation_logs(escalation_type);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_order ON escalation_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_timestamp ON escalation_logs(escalated_at DESC);

-- Table 3: Dispatch Alerts
CREATE TABLE IF NOT EXISTS dispatch_alerts (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(255) NOT NULL,
  alert_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  message TEXT NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  resolution_action VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMP,
  acknowledged_by VARCHAR(255),
  metadata JSONB,
  created_by VARCHAR(100) DEFAULT 'AGENT_SYSTEM'
);

CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_order ON dispatch_alerts(order_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_type ON dispatch_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_resolved ON dispatch_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_created ON dispatch_alerts(created_at DESC);

-- Table 4: Optimization Logs
CREATE TABLE IF NOT EXISTS optimization_logs (
  id SERIAL PRIMARY KEY,
  batch_id VARCHAR(255),
  optimization_type VARCHAR(100),
  orders_count INTEGER,
  distance_before_km DECIMAL(10,2),
  distance_after_km DECIMAL(10,2),
  distance_saved_km DECIMAL(10,2),
  time_before_minutes INTEGER,
  time_after_minutes INTEGER,
  time_saved_minutes INTEGER,
  cost_before DECIMAL(10,2),
  cost_after DECIMAL(10,2),
  cost_saved DECIMAL(10,2),
  algorithm_used VARCHAR(100),
  computation_time_ms INTEGER,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  optimized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB,
  created_by VARCHAR(100) DEFAULT 'AGENT_SYSTEM'
);

CREATE INDEX IF NOT EXISTS idx_optimization_logs_batch ON optimization_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_optimization_logs_timestamp ON optimization_logs(optimized_at DESC);
`;

async function setupTables() {
  const client = await pool.connect();

  try {
    console.log('🔗 Connected to database');
    console.log(`📍 Host: ${process.env.POSTGRES_HOST || 'localhost'}`);
    console.log(`🗄️  Database: ${process.env.POSTGRES_DB || 'barq_logistics'}\n`);

    console.log('📋 Creating agent system tables...\n');

    await client.query(SQL_CREATE_TABLES);

    console.log('✅ Tables created successfully!\n');

    // Verify tables
    console.log('🔍 Verifying tables...');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('assignment_logs', 'escalation_logs', 'dispatch_alerts', 'optimization_logs')
      ORDER BY table_name
    `);

    console.log('\n📊 Created tables:');
    result.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.table_name}`);
    });

    // Check row counts
    console.log('\n📈 Table statistics:');
    for (const table of ['assignment_logs', 'escalation_logs', 'dispatch_alerts', 'optimization_logs']) {
      const countResult = await client.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`   ${table}: ${countResult.rows[0].count} rows`);
    }

    console.log('\n✅ Agent system tables setup complete!');
    console.log('ℹ️  Restart the backend service to initialize the agent system\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up tables:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the setup
setupTables().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
