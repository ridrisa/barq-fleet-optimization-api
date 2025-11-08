-- ==================================================
-- COMPLETE DATABASE SCHEMA FOR AUTOMATION FEATURES
-- AI Route Optimization System
-- ==================================================

-- 1. Fix service_type enum to include EXPRESS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'EXPRESS'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'service_type')
    ) THEN
        ALTER TYPE service_type ADD VALUE 'EXPRESS';
    END IF;
END$$;

-- 2. Assignment logs table (Auto-Dispatch Tracking)
CREATE TABLE IF NOT EXISTS assignment_logs (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id),
    driver_id BIGINT REFERENCES drivers(id),
    assigned_at TIMESTAMP DEFAULT NOW(),
    assignment_type VARCHAR(50), -- 'AUTO_ASSIGNED', 'FORCE_ASSIGNED', 'MANUAL'
    total_score DECIMAL(5,2),
    distance_score DECIMAL(5,2),
    time_score DECIMAL(5,2),
    load_score DECIMAL(5,2),
    priority_score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_logs_assigned_at ON assignment_logs(assigned_at);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_order_id ON assignment_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_driver_id ON assignment_logs(driver_id);

-- 3. Route optimizations table (Route Optimizer Tracking)
CREATE TABLE IF NOT EXISTS route_optimizations (
    id BIGSERIAL PRIMARY KEY,
    driver_id BIGINT REFERENCES drivers(id),
    optimized_at TIMESTAMP DEFAULT NOW(),
    distance_saved_km DECIMAL(10,2),
    time_saved_minutes INTEGER,
    stops_reordered INTEGER,
    old_route_distance DECIMAL(10,2),
    new_route_distance DECIMAL(10,2),
    improvement_percentage DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_optimizations_optimized_at ON route_optimizations(optimized_at);
CREATE INDEX IF NOT EXISTS idx_route_optimizations_driver_id ON route_optimizations(driver_id);

-- 4. Order batches table (Smart Batching Tracking)
CREATE TABLE IF NOT EXISTS order_batches (
    id BIGSERIAL PRIMARY KEY,
    batch_id VARCHAR(100) UNIQUE,
    order_count INTEGER,
    driver_id BIGINT REFERENCES drivers(id),
    status VARCHAR(50), -- 'created', 'assigned', 'completed'
    created_at TIMESTAMP DEFAULT NOW(),
    assigned_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_batches_created_at ON order_batches(created_at);
CREATE INDEX IF NOT EXISTS idx_order_batches_status ON order_batches(status);
CREATE INDEX IF NOT EXISTS idx_order_batches_driver_id ON order_batches(driver_id);

-- 5. Escalation logs table (Escalation Tracking)
CREATE TABLE IF NOT EXISTS escalation_logs (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id),
    escalation_type VARCHAR(50), -- 'SLA_RISK', 'DELAYED', 'FAILED_DELIVERY'
    severity VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    status VARCHAR(50), -- 'open', 'investigating', 'resolved'
    escalated_to VARCHAR(100),
    resolution TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_escalation_logs_created_at ON escalation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_status ON escalation_logs(status);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_severity ON escalation_logs(severity);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_order_id ON escalation_logs(order_id);

-- 6. Dispatch alerts table (Alert Management)
CREATE TABLE IF NOT EXISTS dispatch_alerts (
    id BIGSERIAL PRIMARY KEY,
    alert_type VARCHAR(50), -- 'NO_DRIVERS_AVAILABLE', 'HIGH_DEMAND', 'SLA_BREACH_IMMINENT'
    severity VARCHAR(20), -- 'info', 'warning', 'critical'
    message TEXT,
    metadata JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_resolved ON dispatch_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_created_at ON dispatch_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_severity ON dispatch_alerts(severity);

-- 7. Auto-dispatch statistics table (Daily Aggregates)
CREATE TABLE IF NOT EXISTS auto_dispatch_stats (
    id BIGSERIAL PRIMARY KEY,
    date DATE UNIQUE,
    total_assignments INTEGER DEFAULT 0,
    auto_assigned INTEGER DEFAULT 0,
    force_assigned INTEGER DEFAULT 0,
    avg_assignment_score DECIMAL(5,2),
    avg_response_time_seconds DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_dispatch_stats_date ON auto_dispatch_stats(date);

-- 8. Route optimization statistics table (Daily Aggregates)
CREATE TABLE IF NOT EXISTS route_optimization_stats (
    id BIGSERIAL PRIMARY KEY,
    date DATE UNIQUE,
    total_optimizations INTEGER DEFAULT 0,
    total_distance_saved_km DECIMAL(10,2),
    total_time_saved_minutes INTEGER,
    avg_improvement_percentage DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_optimization_stats_date ON route_optimization_stats(date);

-- 9. Traffic incidents table (Optional - for route optimization)
CREATE TABLE IF NOT EXISTS traffic_incidents (
    id BIGSERIAL PRIMARY KEY,
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    severity VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    description TEXT,
    affected_radius_meters INTEGER DEFAULT 500,
    active BOOLEAN DEFAULT TRUE,
    reported_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_traffic_incidents_active ON traffic_incidents(active);
CREATE INDEX IF NOT EXISTS idx_traffic_incidents_location ON traffic_incidents(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_traffic_incidents_reported_at ON traffic_incidents(reported_at);

-- Verification query
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name IN (
          'assignment_logs',
          'route_optimizations',
          'order_batches',
          'escalation_logs',
          'dispatch_alerts',
          'auto_dispatch_stats',
          'route_optimization_stats',
          'traffic_incidents'
      );

    RAISE NOTICE 'Created % automation tables', table_count;
END$$;

-- Display all tables
SELECT
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND columns.table_name = tables.table_name) as column_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
