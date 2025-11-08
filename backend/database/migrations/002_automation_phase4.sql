/**
 * Phase 4: Automation & Autonomous Operations
 * Database Schema Migration
 *
 * Tables for:
 * - Auto-Dispatch Engine
 * - Dynamic Route Optimization
 * - Smart Batching
 * - Autonomous Escalation
 */

-- ============================================================================
-- AUTO-DISPATCH TABLES
-- ============================================================================

-- Assignment logs for tracking auto-dispatch decisions
CREATE TABLE IF NOT EXISTS assignment_logs (
  id BIGSERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  assignment_type VARCHAR(50) NOT NULL, -- 'AUTO_ASSIGNED', 'FORCE_ASSIGNED', 'MANUAL'
  proximity_score DECIMAL(5, 2),
  performance_score DECIMAL(5, 2),
  capacity_score DECIMAL(5, 2),
  zone_score DECIMAL(5, 2),
  total_score DECIMAL(5, 2),
  reasoning TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT check_assignment_type CHECK (assignment_type IN (
    'AUTO_ASSIGNED',
    'FORCE_ASSIGNED',
    'MANUAL',
    'BATCH_ASSIGNED'
  ))
);

CREATE INDEX idx_assignment_logs_order ON assignment_logs(order_id);
CREATE INDEX idx_assignment_logs_driver ON assignment_logs(driver_id);
CREATE INDEX idx_assignment_logs_time ON assignment_logs(assigned_at);
CREATE INDEX idx_assignment_logs_type ON assignment_logs(assignment_type);

-- Driver performance aggregation (updated daily)
CREATE TABLE IF NOT EXISTS driver_performance (
  id BIGSERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Delivery metrics
  total_deliveries INTEGER NOT NULL DEFAULT 0,
  on_time_deliveries INTEGER NOT NULL DEFAULT 0,
  late_deliveries INTEGER NOT NULL DEFAULT 0,
  failed_deliveries INTEGER NOT NULL DEFAULT 0,

  -- Time metrics
  total_active_hours DECIMAL(5, 2) DEFAULT 0,
  avg_delivery_time_minutes DECIMAL(6, 2),

  -- Financial metrics
  total_earnings DECIMAL(10, 2) DEFAULT 0,
  cod_collected DECIMAL(10, 2) DEFAULT 0,

  -- Performance metrics
  sla_compliance_rate DECIMAL(5, 2),
  average_rating DECIMAL(3, 2),
  total_distance_km DECIMAL(8, 2) DEFAULT 0,
  deliveries_per_hour DECIMAL(5, 2),

  -- Updated timestamp
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(driver_id, date)
);

CREATE INDEX idx_driver_performance_driver ON driver_performance(driver_id);
CREATE INDEX idx_driver_performance_date ON driver_performance(date);

-- ============================================================================
-- DYNAMIC ROUTE OPTIMIZATION TABLES
-- ============================================================================

-- Driver routes (current and historical)
CREATE TABLE IF NOT EXISTS driver_routes (
  id BIGSERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  batch_id INTEGER REFERENCES order_batches(id) ON DELETE SET NULL,

  total_distance_km DECIMAL(8, 2) NOT NULL,
  total_duration_minutes INTEGER NOT NULL,
  route_sequence JSONB, -- Array of stop objects
  polyline TEXT, -- Encoded polyline for map display

  is_active BOOLEAN DEFAULT true,
  optimized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ
);

CREATE INDEX idx_driver_routes_driver ON driver_routes(driver_id);
CREATE INDEX idx_driver_routes_batch ON driver_routes(batch_id);
CREATE INDEX idx_driver_routes_active ON driver_routes(driver_id, is_active) WHERE is_active = true;
CREATE INDEX idx_driver_routes_time ON driver_routes(optimized_at);

-- Individual stops in route
CREATE TABLE IF NOT EXISTS driver_route_stops (
  id BIGSERIAL PRIMARY KEY,
  route_id INTEGER NOT NULL REFERENCES driver_routes(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  sequence_position INTEGER NOT NULL,
  stop_type VARCHAR(20) NOT NULL, -- 'PICKUP', 'DELIVERY'
  estimated_arrival TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,

  status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'ARRIVED', 'COMPLETED', 'SKIPPED'

  UNIQUE(route_id, order_id, stop_type),

  CONSTRAINT check_stop_type CHECK (stop_type IN ('PICKUP', 'DELIVERY')),
  CONSTRAINT check_stop_status CHECK (status IN ('PENDING', 'ARRIVED', 'COMPLETED', 'SKIPPED'))
);

CREATE INDEX idx_route_stops_route ON driver_route_stops(route_id);
CREATE INDEX idx_route_stops_order ON driver_route_stops(order_id);
CREATE INDEX idx_route_stops_sequence ON driver_route_stops(route_id, sequence_position);

-- Route optimization history/logs
CREATE TABLE IF NOT EXISTS route_optimizations (
  id BIGSERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  old_route_id INTEGER REFERENCES driver_routes(id) ON DELETE SET NULL,

  old_distance_km DECIMAL(8, 2),
  old_duration_minutes INTEGER,
  new_distance_km DECIMAL(8, 2),
  new_duration_minutes INTEGER,

  time_saved_minutes DECIMAL(6, 2),
  distance_saved_km DECIMAL(6, 2),
  improvement_percentage DECIMAL(5, 2),

  optimization_reason VARCHAR(100), -- 'SCHEDULED', 'TRAFFIC_INCIDENT', 'NEW_ORDER', 'MANUAL'

  optimized_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_route_optimizations_driver ON route_optimizations(driver_id);
CREATE INDEX idx_route_optimizations_time ON route_optimizations(optimized_at);

-- Traffic incidents (for rerouting)
CREATE TABLE IF NOT EXISTS traffic_incidents (
  id BIGSERIAL PRIMARY KEY,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS
    (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,

  severity VARCHAR(20) NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'SEVERE'
  type VARCHAR(50) NOT NULL, -- 'ACCIDENT', 'CONSTRUCTION', 'CONGESTION', 'WEATHER'
  description TEXT,
  radius_meters INTEGER DEFAULT 1000,

  status VARCHAR(20) DEFAULT 'ACTIVE', -- 'ACTIVE', 'RESOLVED'

  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,

  CONSTRAINT check_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'SEVERE')),
  CONSTRAINT check_traffic_status CHECK (status IN ('ACTIVE', 'RESOLVED', 'EXPIRED'))
);

CREATE INDEX idx_traffic_incidents_location ON traffic_incidents USING GIST (location);
CREATE INDEX idx_traffic_incidents_status ON traffic_incidents(status);
CREATE INDEX idx_traffic_incidents_time ON traffic_incidents(reported_at);

-- ============================================================================
-- SMART BATCHING TABLES
-- ============================================================================

-- Order batches
CREATE TABLE IF NOT EXISTS order_batches (
  id BIGSERIAL PRIMARY KEY,
  batch_number VARCHAR(50) UNIQUE NOT NULL,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,

  order_count INTEGER NOT NULL,
  service_type VARCHAR(50) NOT NULL,

  status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  CONSTRAINT check_batch_status CHECK (status IN (
    'PENDING',
    'ASSIGNED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
  ))
);

CREATE INDEX idx_order_batches_driver ON order_batches(driver_id);
CREATE INDEX idx_order_batches_status ON order_batches(status);
CREATE INDEX idx_order_batches_time ON order_batches(created_at);

-- Batch performance metrics (for analytics)
CREATE TABLE IF NOT EXISTS batch_performance (
  id BIGSERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES order_batches(id) ON DELETE CASCADE,

  orders_in_batch INTEGER NOT NULL,
  orders_completed INTEGER DEFAULT 0,
  orders_failed INTEGER DEFAULT 0,
  completion_rate DECIMAL(5, 2),

  total_distance_km DECIMAL(8, 2),
  total_duration_minutes INTEGER,
  time_saved_percentage DECIMAL(5, 2),
  distance_saved_km DECIMAL(6, 2),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batch_performance_batch ON batch_performance(batch_id);
CREATE INDEX idx_batch_performance_time ON batch_performance(created_at);

-- ============================================================================
-- AUTONOMOUS ESCALATION TABLES
-- ============================================================================

-- Escalation logs (all automated escalations)
CREATE TABLE IF NOT EXISTS escalation_logs (
  id BIGSERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  escalation_type VARCHAR(50) NOT NULL, -- 'SLA_RISK_CRITICAL', 'AUTO_REASSIGN', 'DRIVER_UNRESPONSIVE', etc.
  action_taken VARCHAR(100),
  reasoning TEXT,
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_escalation_logs_order ON escalation_logs(order_id);
CREATE INDEX idx_escalation_logs_type ON escalation_logs(escalation_type);
CREATE INDEX idx_escalation_logs_time ON escalation_logs(created_at);

-- Order alerts (for real-time monitoring)
CREATE TABLE IF NOT EXISTS order_alerts (
  id BIGSERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  alert_type VARCHAR(50) NOT NULL, -- 'SLA_RISK', 'STUCK_ORDER', 'DELIVERY_FAILED', etc.
  severity VARCHAR(20) NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  message TEXT NOT NULL,

  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,

  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT check_alert_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

CREATE INDEX idx_order_alerts_order ON order_alerts(order_id);
CREATE INDEX idx_order_alerts_type ON order_alerts(alert_type);
CREATE INDEX idx_order_alerts_severity ON order_alerts(severity);
CREATE INDEX idx_order_alerts_unresolved ON order_alerts(resolved) WHERE resolved = false;
CREATE INDEX idx_order_alerts_time ON order_alerts(created_at);

-- Dispatch alerts (for human intervention)
CREATE TABLE IF NOT EXISTS dispatch_alerts (
  id BIGSERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,

  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,

  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,

  CONSTRAINT check_dispatch_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT check_dispatch_status CHECK (status IN ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'))
);

CREATE INDEX idx_dispatch_alerts_order ON dispatch_alerts(order_id);
CREATE INDEX idx_dispatch_alerts_driver ON dispatch_alerts(driver_id);
CREATE INDEX idx_dispatch_alerts_severity ON dispatch_alerts(severity);
CREATE INDEX idx_dispatch_alerts_status ON dispatch_alerts(status);
CREATE INDEX idx_dispatch_alerts_pending ON dispatch_alerts(status) WHERE status = 'PENDING';
CREATE INDEX idx_dispatch_alerts_time ON dispatch_alerts(created_at);

-- Failed deliveries (expanded)
CREATE TABLE IF NOT EXISTS failed_deliveries (
  id BIGSERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,

  attempt_number INTEGER NOT NULL DEFAULT 1,
  reason VARCHAR(100) NOT NULL,
  reason_category VARCHAR(50) CHECK (reason_category IN (
    'customer_unavailable',
    'wrong_address',
    'refused_delivery',
    'access_issue',
    'damaged_package',
    'other'
  )),

  photo_url TEXT,
  notes TEXT,
  location GEOGRAPHY(POINT, 4326),

  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_attempt_scheduled_at TIMESTAMPTZ
);

CREATE INDEX idx_failed_deliveries_order ON failed_deliveries(order_id);
CREATE INDEX idx_failed_deliveries_driver ON failed_deliveries(driver_id);
CREATE INDEX idx_failed_deliveries_time ON failed_deliveries(attempted_at);
CREATE INDEX idx_failed_deliveries_category ON failed_deliveries(reason_category);

-- Order recovery attempts
CREATE TABLE IF NOT EXISTS order_recovery_attempts (
  id BIGSERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  recovery_action VARCHAR(50) NOT NULL, -- 'RETRY_IMMEDIATELY', 'SCHEDULE_RETRY', 'CONTACT_CUSTOMER', etc.
  reasoning TEXT,
  result VARCHAR(20), -- 'SUCCESS', 'FAILED', 'PENDING'

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_recovery_attempts_order ON order_recovery_attempts(order_id);
CREATE INDEX idx_recovery_attempts_time ON order_recovery_attempts(created_at);

-- ============================================================================
-- AUTOMATION STATISTICS VIEWS
-- ============================================================================

-- Auto-Dispatch Performance View
CREATE OR REPLACE VIEW auto_dispatch_stats AS
SELECT
  DATE(assigned_at) AS date,
  COUNT(*) AS total_assignments,
  COUNT(*) FILTER (WHERE assignment_type = 'AUTO_ASSIGNED') AS auto_assigned,
  COUNT(*) FILTER (WHERE assignment_type = 'FORCE_ASSIGNED') AS force_assigned,
  AVG(total_score) AS avg_assignment_score,
  AVG(EXTRACT(EPOCH FROM (al.assigned_at - o.created_at))) AS avg_time_to_assign_seconds
FROM assignment_logs al
JOIN orders o ON o.id = al.order_id
GROUP BY DATE(assigned_at);

-- Route Optimization Stats View
CREATE OR REPLACE VIEW route_optimization_stats AS
SELECT
  DATE(optimized_at) AS date,
  COUNT(*) AS total_optimizations,
  AVG(time_saved_minutes) AS avg_time_saved,
  SUM(time_saved_minutes) AS total_time_saved,
  AVG(distance_saved_km) AS avg_distance_saved,
  SUM(distance_saved_km) AS total_distance_saved,
  AVG(improvement_percentage) AS avg_improvement_pct
FROM route_optimizations
GROUP BY DATE(optimized_at);

-- Batching Performance View
CREATE OR REPLACE VIEW batching_stats AS
SELECT
  DATE(ob.created_at) AS date,
  COUNT(*) AS total_batches,
  AVG(ob.order_count) AS avg_orders_per_batch,
  SUM(ob.order_count) AS total_orders_batched,
  COUNT(*) FILTER (WHERE ob.status = 'COMPLETED') AS completed_batches,
  AVG(bp.time_saved_percentage) AS avg_time_saved_pct,
  SUM(bp.distance_saved_km) AS total_distance_saved
FROM order_batches ob
LEFT JOIN batch_performance bp ON bp.batch_id = ob.id
GROUP BY DATE(ob.created_at);

-- Escalation Stats View
CREATE OR REPLACE VIEW escalation_stats AS
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS total_escalations,
  COUNT(*) FILTER (WHERE escalation_type LIKE '%CRITICAL%') AS critical_escalations,
  COUNT(*) FILTER (WHERE escalation_type LIKE '%AUTO_REASSIGN%') AS auto_reassignments,
  COUNT(*) FILTER (WHERE escalation_type = 'AUTO_REASSIGN_STUCK') AS stuck_recoveries,
  COUNT(DISTINCT order_id) AS unique_orders_escalated
FROM escalation_logs
GROUP BY DATE(created_at);

-- ============================================================================
-- FUNCTIONS FOR AUTOMATION
-- ============================================================================

-- Function to calculate driver utilization
CREATE OR REPLACE FUNCTION calculate_driver_utilization(
  p_driver_id INTEGER,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_total_shift_hours DECIMAL(5,2);
  v_active_hours DECIMAL(5,2);
BEGIN
  -- Get shift duration
  SELECT EXTRACT(EPOCH FROM (shift_end - shift_start)) / 3600
  INTO v_total_shift_hours
  FROM drivers
  WHERE id = p_driver_id;

  -- Get active hours from orders
  SELECT COALESCE(SUM(
    EXTRACT(EPOCH FROM (delivered_at - assigned_at)) / 3600
  ), 0)
  INTO v_active_hours
  FROM orders
  WHERE driver_id = p_driver_id
    AND DATE(assigned_at) = p_date
    AND status = 'DELIVERED';

  IF v_total_shift_hours > 0 THEN
    RETURN (v_active_hours / v_total_shift_hours * 100);
  ELSE
    RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update driver performance daily
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
    avg_delivery_time_minutes,
    total_earnings,
    cod_collected,
    sla_compliance_rate,
    average_rating,
    total_distance_km
  )
  SELECT
    d.id,
    CURRENT_DATE - 1, -- Yesterday
    COALESCE(COUNT(o.id), 0),
    COUNT(o.id) FILTER (WHERE o.delivered_at <= o.sla_deadline),
    COUNT(o.id) FILTER (WHERE o.delivered_at > o.sla_deadline),
    COUNT(o.id) FILTER (WHERE o.status = 'FAILED_DELIVERY'),
    AVG(EXTRACT(EPOCH FROM (o.delivered_at - o.assigned_at)) / 60),
    SUM(o.delivery_fee),
    SUM(o.cod_amount) FILTER (WHERE o.payment_method = 'COD'),
    (COUNT(o.id) FILTER (WHERE o.delivered_at <= o.sla_deadline) * 100.0 / NULLIF(COUNT(o.id), 0)),
    AVG(r.rating),
    SUM(
      ST_Distance(
        ST_MakePoint(o.pickup_longitude, o.pickup_latitude)::geography,
        ST_MakePoint(o.dropoff_longitude, o.dropoff_latitude)::geography
      ) / 1000
    )
  FROM drivers d
  LEFT JOIN orders o ON o.driver_id = d.id
    AND DATE(o.delivered_at) = CURRENT_DATE - 1
  LEFT JOIN ratings r ON r.order_id = o.id
  WHERE d.is_active = true
  GROUP BY d.id
  ON CONFLICT (driver_id, date)
  DO UPDATE SET
    total_deliveries = EXCLUDED.total_deliveries,
    on_time_deliveries = EXCLUDED.on_time_deliveries,
    late_deliveries = EXCLUDED.late_deliveries,
    failed_deliveries = EXCLUDED.failed_deliveries,
    avg_delivery_time_minutes = EXCLUDED.avg_delivery_time_minutes,
    total_earnings = EXCLUDED.total_earnings,
    cod_collected = EXCLUDED.cod_collected,
    sla_compliance_rate = EXCLUDED.sla_compliance_rate,
    average_rating = EXCLUDED.average_rating,
    total_distance_km = EXCLUDED.total_distance_km,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update order batch status when all orders complete
CREATE OR REPLACE FUNCTION update_batch_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if all orders in batch are delivered
  UPDATE order_batches
  SET status = 'COMPLETED',
      completed_at = NOW()
  WHERE id = NEW.batch_id
    AND status != 'COMPLETED'
    AND NOT EXISTS (
      SELECT 1
      FROM orders o
      WHERE o.batch_id = NEW.batch_id
        AND o.status NOT IN ('DELIVERED', 'CANCELLED')
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_batch_status
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.batch_id IS NOT NULL AND NEW.status = 'DELIVERED')
  EXECUTE FUNCTION update_batch_status();

-- ============================================================================
-- GRANTS (adjust based on your user roles)
-- ============================================================================

-- Grant permissions to application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Record migration
INSERT INTO schema_migrations (version, description, applied_at)
VALUES (
  '002',
  'Phase 4: Automation & Autonomous Operations - Auto-Dispatch, Dynamic Routing, Smart Batching, Autonomous Escalation',
  NOW()
)
ON CONFLICT (version) DO NOTHING;
