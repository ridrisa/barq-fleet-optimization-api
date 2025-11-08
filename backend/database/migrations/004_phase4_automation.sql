-- Phase 4 Automation Tables Migration
-- Creates all tables, views, and functions for automation engines

-- ============================================================================
-- AUTO-DISPATCH ENGINE TABLES
-- ============================================================================

-- Assignment logs for tracking all driver assignments
CREATE TABLE IF NOT EXISTS assignment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    driver_id UUID,
    assignment_type VARCHAR(50) NOT NULL, -- 'AUTO_ASSIGNED', 'FORCE_ASSIGNED', 'MANUAL'
    total_score DECIMAL(10, 2),
    distance_score DECIMAL(10, 2),
    time_score DECIMAL(10, 2),
    load_score DECIMAL(10, 2),
    priority_score DECIMAL(10, 2),
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_assignment_logs_order ON assignment_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_driver ON assignment_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_date ON assignment_logs(assigned_at);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_type ON assignment_logs(assignment_type);

-- Dispatch alerts for unassigned orders
CREATE TABLE IF NOT EXISTS dispatch_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    alert_type VARCHAR(50) NOT NULL, -- 'NO_DRIVERS', 'ALL_BUSY', 'DISTANCE_TOO_FAR'
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    message TEXT NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_order ON dispatch_alerts(order_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_resolved ON dispatch_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_severity ON dispatch_alerts(severity);

-- ============================================================================
-- ROUTE OPTIMIZATION ENGINE TABLES
-- ============================================================================

-- Driver routes tracking
CREATE TABLE IF NOT EXISTS driver_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL,
    route_date DATE NOT NULL,
    total_distance_km DECIMAL(10, 2),
    total_duration_minutes INTEGER,
    total_stops INTEGER,
    completed_stops INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'cancelled'
    optimized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_driver_routes_driver ON driver_routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_routes_date ON driver_routes(route_date);
CREATE INDEX IF NOT EXISTS idx_driver_routes_status ON driver_routes(status);

-- Driver route stops
CREATE TABLE IF NOT EXISTS driver_route_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES driver_routes(id) ON DELETE CASCADE,
    order_id UUID NOT NULL,
    stop_sequence INTEGER NOT NULL,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    estimated_arrival TIMESTAMP,
    actual_arrival TIMESTAMP,
    estimated_departure TIMESTAMP,
    actual_departure TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_stops_route ON driver_route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_order ON driver_route_stops(order_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_sequence ON driver_route_stops(route_id, stop_sequence);

-- Route optimizations log
CREATE TABLE IF NOT EXISTS route_optimizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL,
    route_id UUID REFERENCES driver_routes(id),
    optimization_type VARCHAR(50) NOT NULL, -- 'initial', 'real_time', 'traffic_update'
    distance_saved_km DECIMAL(10, 2) DEFAULT 0,
    time_saved_minutes INTEGER DEFAULT 0,
    stops_reordered INTEGER DEFAULT 0,
    reason TEXT,
    optimized_at TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_route_opt_driver ON route_optimizations(driver_id);
CREATE INDEX IF NOT EXISTS idx_route_opt_date ON route_optimizations(optimized_at);
CREATE INDEX IF NOT EXISTS idx_route_opt_type ON route_optimizations(optimization_type);

-- Traffic incidents
CREATE TABLE IF NOT EXISTS traffic_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    description TEXT,
    affected_radius_meters INTEGER DEFAULT 500,
    reported_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_traffic_incidents_location ON traffic_incidents(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_traffic_incidents_active ON traffic_incidents(active);
CREATE INDEX IF NOT EXISTS idx_traffic_incidents_severity ON traffic_incidents(severity);

-- ============================================================================
-- SMART BATCHING ENGINE TABLES
-- ============================================================================

-- Order batches
CREATE TABLE IF NOT EXISTS order_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number VARCHAR(50) UNIQUE NOT NULL,
    order_count INTEGER NOT NULL DEFAULT 0,
    total_distance_km DECIMAL(10, 2),
    average_delivery_time_minutes INTEGER,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP,
    completed_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_order_batches_status ON order_batches(status);
CREATE INDEX IF NOT EXISTS idx_order_batches_created ON order_batches(created_at);
CREATE INDEX IF NOT EXISTS idx_order_batches_number ON order_batches(batch_number);

-- Batch performance metrics
CREATE TABLE IF NOT EXISTS batch_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES order_batches(id) ON DELETE CASCADE,
    total_orders INTEGER NOT NULL,
    successful_deliveries INTEGER DEFAULT 0,
    failed_deliveries INTEGER DEFAULT 0,
    average_delay_minutes INTEGER,
    efficiency_score DECIMAL(5, 2),
    cost_savings_estimate DECIMAL(10, 2),
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_performance_batch ON batch_performance(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_performance_date ON batch_performance(recorded_at);

-- ============================================================================
-- ESCALATION ENGINE TABLES
-- ============================================================================

-- Escalation logs
CREATE TABLE IF NOT EXISTS escalation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    escalation_type VARCHAR(50) NOT NULL, -- 'SLA_RISK', 'DELAYED', 'FAILED', 'CUSTOMER_COMPLAINT'
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    reason TEXT NOT NULL,
    escalated_to VARCHAR(100), -- Team or person escalated to
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'investigating', 'resolved', 'closed'
    resolution TEXT,
    escalated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_escalation_logs_order ON escalation_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_type ON escalation_logs(escalation_type);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_status ON escalation_logs(status);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_date ON escalation_logs(escalated_at);

-- Order alerts
CREATE TABLE IF NOT EXISTS order_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_order_alerts_order ON order_alerts(order_id);
CREATE INDEX IF NOT EXISTS idx_order_alerts_resolved ON order_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_order_alerts_severity ON order_alerts(severity);

-- Failed deliveries tracking
CREATE TABLE IF NOT EXISTS failed_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    driver_id UUID,
    failure_reason VARCHAR(100) NOT NULL,
    failure_category VARCHAR(50), -- 'customer_unavailable', 'address_issue', 'vehicle_issue', 'other'
    notes TEXT,
    failed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    retry_attempted BOOLEAN DEFAULT FALSE,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_failed_deliveries_order ON failed_deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_failed_deliveries_driver ON failed_deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_failed_deliveries_category ON failed_deliveries(failure_category);
CREATE INDEX IF NOT EXISTS idx_failed_deliveries_date ON failed_deliveries(failed_at);

-- Order recovery attempts
CREATE TABLE IF NOT EXISTS order_recovery_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    failed_delivery_id UUID REFERENCES failed_deliveries(id),
    recovery_strategy VARCHAR(100) NOT NULL, -- 'reassign_driver', 'reschedule', 'contact_customer'
    attempted_by VARCHAR(100), -- 'system', 'agent_name', 'supervisor_name'
    success BOOLEAN DEFAULT FALSE,
    outcome TEXT,
    attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_recovery_attempts_order ON order_recovery_attempts(order_id);
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_failed_delivery ON order_recovery_attempts(failed_delivery_id);
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_success ON order_recovery_attempts(success);

-- ============================================================================
-- PERFORMANCE TRACKING
-- ============================================================================

-- Driver performance metrics
CREATE TABLE IF NOT EXISTS driver_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL,
    date DATE NOT NULL,
    total_deliveries INTEGER DEFAULT 0,
    successful_deliveries INTEGER DEFAULT 0,
    failed_deliveries INTEGER DEFAULT 0,
    average_delivery_time_minutes INTEGER,
    total_distance_km DECIMAL(10, 2),
    on_time_percentage DECIMAL(5, 2),
    efficiency_score DECIMAL(5, 2),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(driver_id, date)
);

CREATE INDEX IF NOT EXISTS idx_driver_performance_driver ON driver_performance(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_performance_date ON driver_performance(date);
CREATE INDEX IF NOT EXISTS idx_driver_performance_score ON driver_performance(efficiency_score);

-- ============================================================================
-- STATISTICS VIEWS
-- ============================================================================

-- Auto-dispatch statistics view
CREATE OR REPLACE VIEW auto_dispatch_stats AS
SELECT
    DATE(assigned_at) as date,
    COUNT(*) as total_assignments,
    COUNT(*) FILTER (WHERE assignment_type = 'AUTO_ASSIGNED') as auto_assigned,
    COUNT(*) FILTER (WHERE assignment_type = 'FORCE_ASSIGNED') as force_assigned,
    COUNT(*) FILTER (WHERE assignment_type = 'MANUAL') as manual_assigned,
    AVG(total_score) as avg_score,
    AVG(distance_score) as avg_distance_score,
    AVG(time_score) as avg_time_score,
    AVG(load_score) as avg_load_score
FROM assignment_logs
GROUP BY DATE(assigned_at)
ORDER BY date DESC;

-- Route optimization statistics view
CREATE OR REPLACE VIEW route_optimization_stats AS
SELECT
    DATE(optimized_at) as date,
    COUNT(*) as total_optimizations,
    SUM(distance_saved_km) as total_distance_saved_km,
    SUM(time_saved_minutes) as total_time_saved_minutes,
    AVG(distance_saved_km) as avg_distance_saved_km,
    AVG(time_saved_minutes) as avg_time_saved_minutes,
    SUM(stops_reordered) as total_stops_reordered
FROM route_optimizations
GROUP BY DATE(optimized_at)
ORDER BY date DESC;

-- Batch performance statistics view
CREATE OR REPLACE VIEW batch_performance_stats AS
SELECT
    DATE(ob.created_at) as date,
    COUNT(ob.id) as total_batches,
    SUM(ob.order_count) as total_orders,
    AVG(ob.order_count) as avg_orders_per_batch,
    AVG(bp.efficiency_score) as avg_efficiency_score,
    SUM(bp.successful_deliveries) as total_successful,
    SUM(bp.failed_deliveries) as total_failed
FROM order_batches ob
LEFT JOIN batch_performance bp ON bp.batch_id = ob.id
GROUP BY DATE(ob.created_at)
ORDER BY date DESC;

-- Escalation statistics view
CREATE OR REPLACE VIEW escalation_stats AS
SELECT
    DATE(escalated_at) as date,
    COUNT(*) as total_escalations,
    COUNT(*) FILTER (WHERE escalation_type = 'SLA_RISK') as sla_risk_count,
    COUNT(*) FILTER (WHERE escalation_type = 'DELAYED') as delayed_count,
    COUNT(*) FILTER (WHERE escalation_type = 'FAILED') as failed_count,
    COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
    COUNT(*) FILTER (WHERE severity = 'high') as high_count,
    COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
    AVG(EXTRACT(EPOCH FROM (resolved_at - escalated_at))/60) as avg_resolution_time_minutes
FROM escalation_logs
GROUP BY DATE(escalated_at)
ORDER BY date DESC;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get active dispatch alerts count
CREATE OR REPLACE FUNCTION get_active_dispatch_alerts_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM dispatch_alerts WHERE resolved = FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to get at-risk orders count
CREATE OR REPLACE FUNCTION get_at_risk_orders_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*)
            FROM escalation_logs
            WHERE status IN ('open', 'investigating')
            AND severity IN ('high', 'critical'));
END;
$$ LANGUAGE plpgsql;

-- Function to auto-complete batches when all orders are delivered
CREATE OR REPLACE FUNCTION auto_complete_batch()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if batch should be marked as completed
    UPDATE order_batches
    SET
        status = 'completed',
        completed_at = NOW()
    WHERE
        id = NEW.batch_id
        AND status = 'processing'
        AND (SELECT COUNT(*) FROM batch_performance WHERE batch_id = NEW.batch_id) > 0;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-complete batches
DROP TRIGGER IF EXISTS trigger_auto_complete_batch ON batch_performance;
CREATE TRIGGER trigger_auto_complete_batch
    AFTER INSERT OR UPDATE ON batch_performance
    FOR EACH ROW
    EXECUTE FUNCTION auto_complete_batch();

-- ============================================================================
-- GRANT PERMISSIONS (if needed)
-- ============================================================================

-- Grant permissions to application user (adjust as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify tables were created
SELECT
    tablename,
    schemaname
FROM pg_tables
WHERE tablename IN (
    'assignment_logs',
    'dispatch_alerts',
    'driver_routes',
    'driver_route_stops',
    'route_optimizations',
    'traffic_incidents',
    'order_batches',
    'batch_performance',
    'escalation_logs',
    'order_alerts',
    'failed_deliveries',
    'order_recovery_attempts',
    'driver_performance'
)
ORDER BY tablename;
