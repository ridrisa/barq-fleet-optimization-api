-- =================================================================
-- Agent System Database Tables Migration
-- =================================================================
-- Purpose: Create required tables for AI agent system to function
-- Date: 2025-11-13
-- Issue: Agent system not initializing due to missing tables
--
-- This migration creates 4 tables needed by the agent monitoring
-- and automation system:
-- 1. assignment_logs - AI agent assignment decisions
-- 2. escalation_logs - Escalation events and tracking
-- 3. dispatch_alerts - Real-time dispatch alerts
-- 4. optimization_logs - Route optimization history
-- =================================================================

-- Table 1: Assignment Logs
-- Tracks AI agent assignment decisions for orders to drivers
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

-- Indexes for assignment_logs
CREATE INDEX IF NOT EXISTS idx_assignment_logs_order ON assignment_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_driver ON assignment_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_timestamp ON assignment_logs(assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_status ON assignment_logs(status);

-- Comments for assignment_logs
COMMENT ON TABLE assignment_logs IS 'Tracks AI agent assignment decisions for orders';
COMMENT ON COLUMN assignment_logs.assignment_strategy IS 'Strategy used (e.g., nearest, fastest, balanced)';
COMMENT ON COLUMN assignment_logs.confidence_score IS 'Agent confidence in assignment (0.00-1.00)';
COMMENT ON COLUMN assignment_logs.metadata IS 'Additional context and decision factors';

-- =================================================================

-- Table 2: Escalation Logs
-- Tracks escalation events and their resolution
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

-- Indexes for escalation_logs
CREATE INDEX IF NOT EXISTS idx_escalation_logs_type ON escalation_logs(escalation_type);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_order ON escalation_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_driver ON escalation_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_timestamp ON escalation_logs(escalated_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_severity ON escalation_logs(severity);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_resolved ON escalation_logs(resolved_at);

-- Comments for escalation_logs
COMMENT ON TABLE escalation_logs IS 'Tracks escalation events and their resolution';
COMMENT ON COLUMN escalation_logs.escalation_type IS 'Type of escalation (e.g., SLA_RISK, DRIVER_ISSUE)';
COMMENT ON COLUMN escalation_logs.severity IS 'Escalation severity level';
COMMENT ON COLUMN escalation_logs.auto_resolved IS 'Whether resolved automatically by agent';
COMMENT ON COLUMN escalation_logs.escalation_level IS 'Escalation tier (1=Level1, 2=Level2, etc)';

-- =================================================================

-- Table 3: Dispatch Alerts
-- Real-time alerts for dispatch operations
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

-- Indexes for dispatch_alerts
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_order ON dispatch_alerts(order_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_type ON dispatch_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_severity ON dispatch_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_resolved ON dispatch_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_created ON dispatch_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_active ON dispatch_alerts(resolved) WHERE resolved = FALSE;

-- Comments for dispatch_alerts
COMMENT ON TABLE dispatch_alerts IS 'Real-time alerts for dispatch operations';
COMMENT ON COLUMN dispatch_alerts.alert_type IS 'Type of alert (e.g., DELAY, TRAFFIC, DRIVER_UNAVAILABLE)';
COMMENT ON COLUMN dispatch_alerts.acknowledged IS 'Whether alert has been seen by dispatcher';
COMMENT ON COLUMN dispatch_alerts.resolution_action IS 'Action taken to resolve (e.g., REASSIGN, REROUTE)';

-- =================================================================

-- Table 4: Optimization Logs
-- Tracks route optimization operations and results
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

-- Indexes for optimization_logs
CREATE INDEX IF NOT EXISTS idx_optimization_logs_batch ON optimization_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_optimization_logs_type ON optimization_logs(optimization_type);
CREATE INDEX IF NOT EXISTS idx_optimization_logs_timestamp ON optimization_logs(optimized_at DESC);
CREATE INDEX IF NOT EXISTS idx_optimization_logs_success ON optimization_logs(success);

-- Comments for optimization_logs
COMMENT ON TABLE optimization_logs IS 'Tracks route optimization operations and savings';
COMMENT ON COLUMN optimization_logs.batch_id IS 'Batch identifier for grouped optimizations';
COMMENT ON COLUMN optimization_logs.distance_saved_km IS 'Total distance saved by optimization';
COMMENT ON COLUMN optimization_logs.algorithm_used IS 'Optimization algorithm (e.g., CVRP, TSP, GENETIC)';
COMMENT ON COLUMN optimization_logs.computation_time_ms IS 'Time taken to compute optimization';

-- =================================================================

-- Grant permissions (adjust based on your database user)
-- GRANT SELECT, INSERT, UPDATE ON assignment_logs TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON escalation_logs TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON dispatch_alerts TO your_app_user;
-- GRANT SELECT, INSERT ON optimization_logs TO your_app_user;

-- =================================================================

-- Migration Complete
-- These tables are now ready for use by the agent system
-- The agent monitoring dashboard at /admin/agents should work after:
-- 1. Running this migration
-- 2. Restarting the backend service
-- =================================================================

-- Verification queries (run after migration):
-- SELECT COUNT(*) FROM assignment_logs;
-- SELECT COUNT(*) FROM escalation_logs;
-- SELECT COUNT(*) FROM dispatch_alerts;
-- SELECT COUNT(*) FROM optimization_logs;
