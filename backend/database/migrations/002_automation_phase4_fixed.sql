-- Phase 4 Automation Migration (Fixed for UUID schema without PostGIS)
-- This migration creates tables for:
-- 1. Auto-Dispatch Engine
-- 2. Dynamic Route Optimizer
-- 3. Smart Batching Engine
-- 4. Autonomous Escalation Engine

-- =============================================================================
-- AUTO-DISPATCH ENGINE TABLES
-- =============================================================================

-- Assignment logs (tracking auto-dispatch decisions)
CREATE TABLE IF NOT EXISTS assignment_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  assignment_type VARCHAR(50) NOT NULL, -- 'AUTO_ASSIGNED', 'FORCE_ASSIGNED', 'MANUAL'
  proximity_score DECIMAL(5, 2),
  performance_score DECIMAL(5, 2),
  capacity_score DECIMAL(5, 2),
  zone_score DECIMAL(5, 2),
  total_score DECIMAL(5, 2),
  reasoning TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_logs_order_id ON assignment_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_driver_id ON assignment_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_assigned_at ON assignment_logs(assigned_at);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_assignment_type ON assignment_logs(assignment_type);

-- Driver performance metrics (aggregated daily)
-- Drop and recreate to ensure correct structure
DROP TABLE IF EXISTS driver_performance CASCADE;

CREATE TABLE driver_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_deliveries INTEGER NOT NULL DEFAULT 0,
  on_time_deliveries INTEGER NOT NULL DEFAULT 0,
  late_deliveries INTEGER NOT NULL DEFAULT 0,
  failed_deliveries INTEGER NOT NULL DEFAULT 0,
  sla_compliance_rate DECIMAL(5, 2),
  average_rating DECIMAL(3, 2),
  total_distance_km DECIMAL(10, 2),
  total_time_minutes INTEGER,
  deliveries_in_zone INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(driver_id, date)
);

CREATE INDEX IF NOT EXISTS idx_driver_performance_driver_id ON driver_performance(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_performance_date ON driver_performance(date);

-- =============================================================================
-- DYNAMIC ROUTE OPTIMIZATION TABLES
-- =============================================================================

-- Driver routes (current and historical)
CREATE TABLE IF NOT EXISTS driver_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES order_batches(id) ON DELETE SET NULL,
  total_distance_km DECIMAL(8, 2) NOT NULL,
  total_duration_minutes INTEGER NOT NULL,
  route_sequence JSONB, -- Array of stop IDs in order
  polyline TEXT,
  is_active BOOLEAN DEFAULT true,
  optimized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_routes_driver_id ON driver_routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_routes_batch_id ON driver_routes(batch_id);
CREATE INDEX IF NOT EXISTS idx_driver_routes_is_active ON driver_routes(is_active);
CREATE INDEX IF NOT EXISTS idx_driver_routes_optimized_at ON driver_routes(optimized_at);

-- Driver route stops (individual stops in sequence)
CREATE TABLE IF NOT EXISTS driver_route_stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID NOT NULL REFERENCES driver_routes(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sequence_position INTEGER NOT NULL,
  stop_type VARCHAR(20) NOT NULL CHECK (stop_type IN ('PICKUP', 'DELIVERY')),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  estimated_arrival TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_route_stops_route_id ON driver_route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_driver_route_stops_order_id ON driver_route_stops(order_id);
CREATE INDEX IF NOT EXISTS idx_driver_route_stops_sequence ON driver_route_stops(sequence_position);

-- Route optimizations log
-- Drop and recreate to fix schema
DROP TABLE IF EXISTS route_optimizations CASCADE;

CREATE TABLE route_optimizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  old_route_id UUID REFERENCES driver_routes(id) ON DELETE SET NULL,
  new_route_id UUID REFERENCES driver_routes(id) ON DELETE SET NULL,
  distance_saved_km DECIMAL(8, 2),
  time_saved_minutes INTEGER,
  improvement_percentage DECIMAL(5, 2),
  reason VARCHAR(100), -- 'PERIODIC_CHECK', 'TRAFFIC_INCIDENT', 'MANUAL_TRIGGER'
  optimized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_optimizations_driver_id ON route_optimizations(driver_id);
CREATE INDEX IF NOT EXISTS idx_route_optimizations_optimized_at ON route_optimizations(optimized_at);

-- Traffic incidents (without PostGIS - using simple lat/long)
CREATE TABLE IF NOT EXISTS traffic_incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  type VARCHAR(50) NOT NULL, -- 'ACCIDENT', 'CONSTRUCTION', 'CONGESTION', 'ROAD_CLOSURE'
  description TEXT,
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESOLVED')),
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traffic_incidents_status ON traffic_incidents(status);
CREATE INDEX IF NOT EXISTS idx_traffic_incidents_reported_at ON traffic_incidents(reported_at);
CREATE INDEX IF NOT EXISTS idx_traffic_incidents_lat_lng ON traffic_incidents(latitude, longitude);

-- =============================================================================
-- SMART BATCHING ENGINE TABLES
-- =============================================================================

-- Order batches
CREATE TABLE IF NOT EXISTS order_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_number VARCHAR(50) UNIQUE NOT NULL,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  order_count INTEGER NOT NULL,
  service_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_order_batches_driver_id ON order_batches(driver_id);
CREATE INDEX IF NOT EXISTS idx_order_batches_status ON order_batches(status);
CREATE INDEX IF NOT EXISTS idx_order_batches_created_at ON order_batches(created_at);

-- Batch performance metrics
CREATE TABLE IF NOT EXISTS batch_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES order_batches(id) ON DELETE CASCADE,
  total_distance_km DECIMAL(8, 2),
  total_duration_minutes INTEGER,
  orders_delivered INTEGER DEFAULT 0,
  orders_failed INTEGER DEFAULT 0,
  efficiency_score DECIMAL(5, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_performance_batch_id ON batch_performance(batch_id);

-- =============================================================================
-- AUTONOMOUS ESCALATION ENGINE TABLES
-- =============================================================================

-- Escalation logs
CREATE TABLE IF NOT EXISTS escalation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  escalation_type VARCHAR(50) NOT NULL, -- 'SLA_RISK', 'STUCK_ORDER', 'UNRESPONSIVE_DRIVER', 'FAILED_DELIVERY'
  action_taken VARCHAR(100), -- 'REASSIGN_FASTER_DRIVER', 'ESCALATE_TO_DISPATCH', 'CONTACT_CUSTOMER', etc.
  reasoning TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalation_logs_order_id ON escalation_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_escalation_type ON escalation_logs(escalation_type);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_created_at ON escalation_logs(created_at);

-- Order alerts (real-time monitoring)
CREATE TABLE IF NOT EXISTS order_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_order_alerts_order_id ON order_alerts(order_id);
CREATE INDEX IF NOT EXISTS idx_order_alerts_status ON order_alerts(status);
CREATE INDEX IF NOT EXISTS idx_order_alerts_severity ON order_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_order_alerts_created_at ON order_alerts(created_at);

-- Dispatch alerts (require human intervention)
CREATE TABLE IF NOT EXISTS dispatch_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACKNOWLEDGED', 'RESOLVED')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_order_id ON dispatch_alerts(order_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_driver_id ON dispatch_alerts(driver_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_status ON dispatch_alerts(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_severity ON dispatch_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_created_at ON dispatch_alerts(created_at);

-- Failed deliveries (extended tracking)
CREATE TABLE IF NOT EXISTS failed_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  failure_reason VARCHAR(100) NOT NULL,
  failure_details TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  attempt_number INTEGER DEFAULT 1,
  photo_urls JSONB, -- Array of photo URLs
  signature_url TEXT,
  customer_feedback TEXT,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failed_deliveries_order_id ON failed_deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_failed_deliveries_driver_id ON failed_deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_failed_deliveries_failed_at ON failed_deliveries(failed_at);

-- Order recovery attempts
CREATE TABLE IF NOT EXISTS order_recovery_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  recovery_action VARCHAR(100) NOT NULL,
  reasoning TEXT,
  metadata JSONB,
  status VARCHAR(20) DEFAULT 'PENDING',
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_recovery_attempts_order_id ON order_recovery_attempts(order_id);
CREATE INDEX IF NOT EXISTS idx_order_recovery_attempts_status ON order_recovery_attempts(status);

-- =============================================================================
-- STATISTICS VIEWS
-- =============================================================================

-- Auto-dispatch statistics
CREATE OR REPLACE VIEW auto_dispatch_stats AS
SELECT
  DATE(assigned_at) AS date,
  COUNT(*) AS total_assignments,
  COUNT(*) FILTER (WHERE assignment_type = 'AUTO_ASSIGNED') AS auto_assigned,
  COUNT(*) FILTER (WHERE assignment_type = 'FORCE_ASSIGNED') AS force_assigned,
  COUNT(*) FILTER (WHERE assignment_type = 'MANUAL') AS manual_assigned,
  AVG(total_score) AS avg_assignment_score,
  AVG(proximity_score) AS avg_proximity_score,
  AVG(performance_score) AS avg_performance_score
FROM assignment_logs
GROUP BY DATE(assigned_at);

-- Route optimization statistics
CREATE OR REPLACE VIEW route_optimization_stats AS
SELECT
  DATE(optimized_at) AS date,
  COUNT(*) AS total_optimizations,
  SUM(distance_saved_km) AS total_distance_saved_km,
  SUM(time_saved_minutes) AS total_time_saved_minutes,
  AVG(improvement_percentage) AS avg_improvement_percentage
FROM route_optimizations
GROUP BY DATE(optimized_at);

-- Batching statistics
CREATE OR REPLACE VIEW batching_stats AS
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS total_batches,
  SUM(order_count) AS total_orders_batched,
  AVG(order_count) AS avg_orders_per_batch,
  COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_batches,
  COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_batches
FROM order_batches
GROUP BY DATE(created_at);

-- Escalation statistics
CREATE OR REPLACE VIEW escalation_stats AS
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS total_escalations,
  COUNT(*) FILTER (WHERE escalation_type = 'SLA_RISK') AS sla_risk_escalations,
  COUNT(*) FILTER (WHERE escalation_type = 'STUCK_ORDER') AS stuck_order_escalations,
  COUNT(*) FILTER (WHERE escalation_type = 'UNRESPONSIVE_DRIVER') AS unresponsive_driver_escalations,
  COUNT(*) FILTER (WHERE escalation_type = 'FAILED_DELIVERY') AS failed_delivery_escalations
FROM escalation_logs
GROUP BY DATE(created_at);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Calculate driver utilization
CREATE OR REPLACE FUNCTION calculate_driver_utilization(
  p_driver_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_total_minutes INTEGER;
  v_delivery_minutes INTEGER;
  v_utilization DECIMAL(5,2);
BEGIN
  -- Get total working minutes (assume 8 hour shift = 480 minutes)
  v_total_minutes := 480;

  -- Get actual delivery minutes
  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (delivered_at - picked_up_at)) / 60), 0)
  INTO v_delivery_minutes
  FROM orders
  WHERE driver_id = p_driver_id
    AND DATE(delivered_at) = p_date
    AND status = 'DELIVERED';

  -- Calculate utilization percentage
  IF v_total_minutes > 0 THEN
    v_utilization := (v_delivery_minutes::DECIMAL / v_total_minutes) * 100;
  ELSE
    v_utilization := 0;
  END IF;

  RETURN v_utilization;
END;
$$ LANGUAGE plpgsql;

-- Update driver performance (daily aggregation)
CREATE OR REPLACE FUNCTION update_driver_performance()
RETURNS void AS $$
BEGIN
  INSERT INTO driver_performance (
    driver_id,
    date,
    total_deliveries,
    on_time_deliveries,
    late_deliveries,
    failed_deliveries,
    sla_compliance_rate,
    total_distance_km,
    total_time_minutes
  )
  SELECT
    d.id AS driver_id,
    CURRENT_DATE - 1 AS date,
    COUNT(o.id) AS total_deliveries,
    COUNT(o.id) FILTER (WHERE o.sla_breached = false AND o.status = 'DELIVERED') AS on_time_deliveries,
    COUNT(o.id) FILTER (WHERE o.sla_breached = true AND o.status = 'DELIVERED') AS late_deliveries,
    COUNT(o.id) FILTER (WHERE o.status = 'FAILED') AS failed_deliveries,
    (COUNT(o.id) FILTER (WHERE o.sla_breached = false AND o.status = 'DELIVERED')::DECIMAL /
     NULLIF(COUNT(o.id), 0) * 100) AS sla_compliance_rate,
    SUM(o.actual_distance) AS total_distance_km,
    SUM(EXTRACT(EPOCH FROM (o.delivered_at - o.picked_up_at)) / 60) AS total_time_minutes
  FROM drivers d
  LEFT JOIN orders o ON o.driver_id = d.id AND DATE(o.delivered_at) = CURRENT_DATE - 1
  GROUP BY d.id
  ON CONFLICT (driver_id, date) DO UPDATE SET
    total_deliveries = EXCLUDED.total_deliveries,
    on_time_deliveries = EXCLUDED.on_time_deliveries,
    late_deliveries = EXCLUDED.late_deliveries,
    failed_deliveries = EXCLUDED.failed_deliveries,
    sla_compliance_rate = EXCLUDED.sla_compliance_rate,
    total_distance_km = EXCLUDED.total_distance_km,
    total_time_minutes = EXCLUDED.total_time_minutes,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Helper function for distance calculation (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 DECIMAL,
  lon1 DECIMAL,
  lat2 DECIMAL,
  lon2 DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  R DECIMAL := 6371; -- Earth's radius in kilometers
  dLat DECIMAL;
  dLon DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  dLat := RADIANS(lat2 - lat1);
  dLon := RADIANS(lon2 - lon1);

  a := SIN(dLat/2) * SIN(dLat/2) +
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
       SIN(dLon/2) * SIN(dLon/2);

  c := 2 * ATAN2(SQRT(a), SQRT(1-a));

  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-complete batches when all orders are delivered
CREATE OR REPLACE FUNCTION auto_complete_batch()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if order belongs to a batch
  IF NEW.status = 'DELIVERED' THEN
    -- Update batch status to COMPLETED if all orders in batch are delivered
    UPDATE order_batches ob
    SET status = 'COMPLETED',
        completed_at = NOW()
    WHERE ob.id = (
      SELECT o2.batch_id
      FROM orders o2
      WHERE o2.id = NEW.id AND o2.batch_id IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM orders o3
      WHERE o3.batch_id = ob.id
        AND o3.status NOT IN ('DELIVERED', 'CANCELLED')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_complete_batch ON orders;
CREATE TRIGGER trigger_auto_complete_batch
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_complete_batch();

-- =============================================================================
-- SCHEMA VERSION TRACKING
-- =============================================================================

-- Create schema_migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(50) PRIMARY KEY,
  description TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Record this migration
INSERT INTO schema_migrations (version, description)
VALUES ('002', 'Phase 4 Automation - Auto-Dispatch, Route Optimization, Smart Batching, Autonomous Escalation')
ON CONFLICT (version) DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Phase 4 Automation migration completed successfully!';
  RAISE NOTICE 'Created 13 tables, 4 views, 3 functions, and 1 trigger';
END $$;
