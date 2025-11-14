-- Migration: Create Automation Tables for Phase 4
-- This migration creates all necessary tables and views for the automation engine:
-- - Auto-Dispatch Engine tracking
-- - Dynamic Route Optimization results
-- - Smart Batching Engine
-- - Autonomous Escalation Engine
-- - Supporting tables for traffic incidents and alerts

-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS FOR AUTOMATION
-- ============================================

-- Assignment type enum
DO $$ BEGIN
    CREATE TYPE assignment_type AS ENUM ('AUTO_ASSIGNED', 'FORCE_ASSIGNED', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Escalation type enum
DO $$ BEGIN
    CREATE TYPE escalation_type AS ENUM ('SLA_RISK', 'STUCK_ORDER', 'UNRESPONSIVE_DRIVER', 'FAILED_DELIVERY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Alert type enum
DO $$ BEGIN
    CREATE TYPE alert_type AS ENUM ('DISPATCH_FAILED', 'OPTIMIZATION_NEEDED', 'SLA_BREACH', 'DRIVER_UNRESPONSIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Severity enum
DO $$ BEGIN
    CREATE TYPE severity_level AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Traffic incident severity enum
DO $$ BEGIN
    CREATE TYPE traffic_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'SEVERE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Batch status enum
DO $$ BEGIN
    CREATE TYPE batch_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- ASSIGNMENT_LOGS TABLE
-- ============================================
-- Tracks driver assignment history and scoring for the Auto-Dispatch Engine
CREATE TABLE IF NOT EXISTS assignment_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL,
  driver_id UUID NOT NULL,

  -- Assignment type and method
  assignment_type assignment_type NOT NULL,
  assignment_method VARCHAR(100),

  -- Scoring breakdown
  total_score DECIMAL(10, 4),
  distance_score DECIMAL(10, 4),      -- Score based on proximity
  time_score DECIMAL(10, 4),          -- Score based on availability
  load_score DECIMAL(10, 4),          -- Score based on current load
  priority_score DECIMAL(10, 4),      -- Score based on order priority

  -- Assignment details
  assignment_reason TEXT,
  alternative_drivers INTEGER,        -- Number of alternative drivers considered

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for assignment_logs
CREATE INDEX IF NOT EXISTS idx_assignment_logs_order_id ON assignment_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_driver_id ON assignment_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_assigned_at ON assignment_logs(assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_assignment_type ON assignment_logs(assignment_type);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_date ON assignment_logs(DATE(assigned_at));

-- ============================================
-- ROUTE_OPTIMIZATIONS TABLE
-- ============================================
-- Stores optimization results from the Dynamic Route Optimizer
CREATE TABLE IF NOT EXISTS route_optimizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL,

  -- Route information
  route_id VARCHAR(100),
  order_ids UUID[] NOT NULL,
  stop_count INTEGER,

  -- Optimization metrics
  distance_saved_km DECIMAL(10, 2),
  time_saved_minutes INTEGER,
  stops_reordered INTEGER,
  improvement_percentage DECIMAL(5, 2),

  -- Route details
  original_sequence INTEGER[],
  optimized_sequence INTEGER[],
  original_distance DECIMAL(10, 2),
  optimized_distance DECIMAL(10, 2),
  original_time_minutes INTEGER,
  optimized_time_minutes INTEGER,

  -- Algorithm information
  algorithm_used VARCHAR(100),
  optimization_notes TEXT,

  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  optimized_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  executed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for route_optimizations
CREATE INDEX IF NOT EXISTS idx_route_opt_driver_id ON route_optimizations(driver_id);
CREATE INDEX IF NOT EXISTS idx_route_opt_optimized_at ON route_optimizations(optimized_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_opt_status ON route_optimizations(status);
CREATE INDEX IF NOT EXISTS idx_route_opt_date ON route_optimizations(DATE(optimized_at));

-- ============================================
-- TRAFFIC_INCIDENTS TABLE
-- ============================================
-- Tracks real-time traffic incidents to trigger rerouting
CREATE TABLE IF NOT EXISTS traffic_incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Location information
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  affected_radius_meters INTEGER DEFAULT 500,

  -- Incident details
  severity traffic_severity NOT NULL,
  description TEXT,
  incident_type VARCHAR(100),

  -- Status
  active BOOLEAN DEFAULT true,

  -- Impact tracking
  affected_routes INTEGER DEFAULT 0,
  affected_orders UUID[] DEFAULT ARRAY[]::UUID[],

  -- Timestamps
  reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for traffic_incidents
CREATE INDEX IF NOT EXISTS idx_traffic_incidents_severity ON traffic_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_traffic_incidents_active ON traffic_incidents(active);
CREATE INDEX IF NOT EXISTS idx_traffic_incidents_location ON traffic_incidents(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_traffic_incidents_reported_at ON traffic_incidents(reported_at DESC);

-- ============================================
-- ORDER_BATCHES TABLE
-- ============================================
-- Tracks batch processing results from the Smart Batching Engine
CREATE TABLE IF NOT EXISTS order_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_number VARCHAR(100) UNIQUE NOT NULL,
  driver_id UUID,

  -- Batch composition
  order_ids UUID[] NOT NULL,
  order_count INTEGER NOT NULL,

  -- Batch metrics
  total_distance_km DECIMAL(10, 2),
  estimated_delivery_time_minutes INTEGER,
  total_weight_kg DECIMAL(10, 2),
  total_value DECIMAL(15, 2),

  -- Batch constraints
  delivery_zone VARCHAR(100),
  service_type VARCHAR(50),

  -- Status tracking
  status batch_status DEFAULT 'pending',
  dispatched_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Batch performance
  stops_completed INTEGER DEFAULT 0,
  delivery_success_rate DECIMAL(5, 2),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for order_batches
CREATE INDEX IF NOT EXISTS idx_order_batches_driver_id ON order_batches(driver_id);
CREATE INDEX IF NOT EXISTS idx_order_batches_status ON order_batches(status);
CREATE INDEX IF NOT EXISTS idx_order_batches_created_at ON order_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_batches_batch_number ON order_batches(batch_number);
CREATE INDEX IF NOT EXISTS idx_order_batches_date ON order_batches(DATE(created_at));

-- ============================================
-- ESCALATION_LOGS TABLE
-- ============================================
-- Tracks SLA breaches and escalations from the Autonomous Escalation Engine
CREATE TABLE IF NOT EXISTS escalation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL,
  driver_id UUID,

  -- Escalation classification
  escalation_type escalation_type NOT NULL,
  severity severity_level NOT NULL,

  -- Escalation details
  reason TEXT NOT NULL,
  description TEXT,
  escalated_to VARCHAR(255),

  -- Resolution tracking
  status VARCHAR(50) DEFAULT 'open',
  resolution TEXT,
  resolved_by VARCHAR(255),

  -- SLA information
  sla_target_minutes INTEGER,
  minutes_to_breach INTEGER,
  current_delay_minutes INTEGER,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  escalated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for escalation_logs
CREATE INDEX IF NOT EXISTS idx_escalation_logs_order_id ON escalation_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_driver_id ON escalation_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_escalation_type ON escalation_logs(escalation_type);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_severity ON escalation_logs(severity);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_status ON escalation_logs(status);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_created_at ON escalation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_date ON escalation_logs(DATE(created_at));

-- ============================================
-- DISPATCH_ALERTS TABLE
-- ============================================
-- Tracks dispatch alerts requiring human intervention
CREATE TABLE IF NOT EXISTS dispatch_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL,

  -- Alert classification
  alert_type alert_type NOT NULL,
  severity severity_level NOT NULL,

  -- Alert message and metadata
  message TEXT NOT NULL,
  description TEXT,

  -- Resolution status
  resolved BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'open',
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for dispatch_alerts
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_order_id ON dispatch_alerts(order_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_alert_type ON dispatch_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_severity ON dispatch_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_resolved ON dispatch_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_status ON dispatch_alerts(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_created_at ON dispatch_alerts(created_at DESC);

-- ============================================
-- STATISTICAL VIEWS
-- ============================================

-- AUTO_DISPATCH_STATS VIEW
-- Daily statistics for auto-dispatch engine performance
CREATE OR REPLACE VIEW auto_dispatch_stats AS
SELECT
  DATE(assigned_at) as date,
  COUNT(*) as total_assignments,
  COUNT(*) FILTER (WHERE assignment_type = 'AUTO_ASSIGNED') as auto_assigned,
  COUNT(*) FILTER (WHERE assignment_type = 'FORCE_ASSIGNED') as force_assigned,
  COUNT(*) FILTER (WHERE assignment_type = 'MANUAL') as manual_assignments,
  AVG(total_score) as avg_total_score,
  AVG(distance_score) as avg_distance_score,
  AVG(time_score) as avg_time_score,
  AVG(load_score) as avg_load_score,
  AVG(priority_score) as avg_priority_score,
  MIN(total_score) as min_score,
  MAX(total_score) as max_score
FROM assignment_logs
GROUP BY DATE(assigned_at)
ORDER BY date DESC;

-- ROUTE_OPTIMIZATION_STATS VIEW
-- Daily statistics for route optimization engine performance
CREATE OR REPLACE VIEW route_optimization_stats AS
SELECT
  DATE(optimized_at) as date,
  COUNT(*) as total_optimizations,
  SUM(distance_saved_km) as total_distance_saved_km,
  SUM(time_saved_minutes) as total_time_saved_minutes,
  AVG(distance_saved_km) as avg_distance_saved_km,
  AVG(time_saved_minutes) as avg_time_saved_minutes,
  SUM(stops_reordered) as total_stops_reordered,
  AVG(improvement_percentage) as avg_improvement_percentage,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_optimizations,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_optimizations
FROM route_optimizations
GROUP BY DATE(optimized_at)
ORDER BY date DESC;

-- BATCH_PERFORMANCE_STATS VIEW
-- Daily statistics for smart batching engine performance
CREATE OR REPLACE VIEW batch_performance_stats AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_batches,
  SUM(order_count) as total_orders_batched,
  AVG(order_count) as avg_orders_per_batch,
  MIN(order_count) as min_orders_per_batch,
  MAX(order_count) as max_orders_per_batch,
  SUM(total_distance_km) as total_distance_km,
  AVG(total_distance_km) as avg_distance_per_batch,
  SUM(total_value) as total_value,
  AVG(delivery_success_rate) as avg_success_rate,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_batches,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_batches
FROM order_batches
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ESCALATION_STATS VIEW
-- Daily statistics for autonomous escalation engine performance
CREATE OR REPLACE VIEW escalation_stats AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_escalations,
  COUNT(*) FILTER (WHERE escalation_type = 'SLA_RISK') as sla_risk_escalations,
  COUNT(*) FILTER (WHERE escalation_type = 'STUCK_ORDER') as stuck_order_escalations,
  COUNT(*) FILTER (WHERE escalation_type = 'UNRESPONSIVE_DRIVER') as unresponsive_driver_escalations,
  COUNT(*) FILTER (WHERE escalation_type = 'FAILED_DELIVERY') as failed_delivery_escalations,
  COUNT(*) FILTER (WHERE severity = 'critical') as critical_escalations,
  COUNT(*) FILTER (WHERE severity = 'high') as high_escalations,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved_escalations,
  COUNT(*) FILTER (WHERE status = 'open') as open_escalations,
  AVG(current_delay_minutes) as avg_delay_minutes
FROM escalation_logs
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================
-- UPDATE TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_automation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_assignment_logs_updated_at ON assignment_logs;
CREATE TRIGGER update_assignment_logs_updated_at BEFORE UPDATE ON assignment_logs
  FOR EACH ROW EXECUTE FUNCTION update_automation_updated_at();

DROP TRIGGER IF EXISTS update_route_optimizations_updated_at ON route_optimizations;
CREATE TRIGGER update_route_optimizations_updated_at BEFORE UPDATE ON route_optimizations
  FOR EACH ROW EXECUTE FUNCTION update_automation_updated_at();

DROP TRIGGER IF EXISTS update_traffic_incidents_updated_at ON traffic_incidents;
CREATE TRIGGER update_traffic_incidents_updated_at BEFORE UPDATE ON traffic_incidents
  FOR EACH ROW EXECUTE FUNCTION update_automation_updated_at();

DROP TRIGGER IF EXISTS update_order_batches_updated_at ON order_batches;
CREATE TRIGGER update_order_batches_updated_at BEFORE UPDATE ON order_batches
  FOR EACH ROW EXECUTE FUNCTION update_automation_updated_at();

DROP TRIGGER IF EXISTS update_escalation_logs_updated_at ON escalation_logs;
CREATE TRIGGER update_escalation_logs_updated_at BEFORE UPDATE ON escalation_logs
  FOR EACH ROW EXECUTE FUNCTION update_automation_updated_at();

DROP TRIGGER IF EXISTS update_dispatch_alerts_updated_at ON dispatch_alerts;
CREATE TRIGGER update_dispatch_alerts_updated_at BEFORE UPDATE ON dispatch_alerts
  FOR EACH ROW EXECUTE FUNCTION update_automation_updated_at();
