-- =====================================================
-- Performance Optimization Indexes
-- Add indexes to improve query performance for analytics and production metrics endpoints
-- Target: Fix 11 timeout endpoints
-- =====================================================

-- =====================================================
-- ORDERS TABLE INDEXES
-- =====================================================

-- Index for time-based queries (created_at, updated_at)
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at DESC);

-- Index for status-based queries
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Index for SLA queries
CREATE INDEX IF NOT EXISTS idx_orders_sla_deadline ON orders(sla_deadline);
CREATE INDEX IF NOT EXISTS idx_orders_sla_status ON orders(status, sla_deadline) WHERE status IN ('pending', 'assigned', 'picked_up', 'in_transit');

-- Index for service type analytics
CREATE INDEX IF NOT EXISTS idx_orders_service_type ON orders(service_type);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_service_type_status ON orders(service_type, status);

-- Index for driver-related queries
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id) WHERE driver_id IS NOT NULL;

-- Index for hub-related queries (if hub_id column exists)
-- CREATE INDEX IF NOT EXISTS idx_orders_hub_id ON orders(hub_id) WHERE hub_id IS NOT NULL;

-- =====================================================
-- DELIVERIES TABLE INDEXES (if exists)
-- =====================================================

-- Index for delivery status
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivered_at ON deliveries(delivered_at DESC) WHERE delivered_at IS NOT NULL;

-- Index for SLA compliance
CREATE INDEX IF NOT EXISTS idx_deliveries_sla_status ON deliveries(sla_status);

-- Index for order relationship
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON deliveries(order_id);

-- Index for courier relationship
CREATE INDEX IF NOT EXISTS idx_deliveries_courier_id ON deliveries(courier_id) WHERE courier_id IS NOT NULL;

-- =====================================================
-- OPTIMIZATION_REQUESTS TABLE INDEXES
-- =====================================================

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_optimization_requests_status ON optimization_requests(status);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_optimization_requests_timestamp ON optimization_requests(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_optimization_requests_created_at ON optimization_requests(created_at DESC);

-- Index for request lookup
CREATE INDEX IF NOT EXISTS idx_optimization_requests_request_id ON optimization_requests(request_id);

-- =====================================================
-- OPTIMIZATION_RESULTS TABLE INDEXES
-- =====================================================

-- Index for request relationship
CREATE INDEX IF NOT EXISTS idx_optimization_results_request_id ON optimization_results(request_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_optimization_results_timestamp ON optimization_results(timestamp DESC);

-- Index for success/failure analysis
CREATE INDEX IF NOT EXISTS idx_optimization_results_success ON optimization_results(success);

-- =====================================================
-- AGENTS TABLE INDEXES
-- =====================================================

-- Index for agent name lookup
CREATE INDEX IF NOT EXISTS idx_agents_agent_name ON agents(agent_name);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

-- Index for active agents
CREATE INDEX IF NOT EXISTS idx_agents_is_active ON agents(is_active) WHERE is_active = true;

-- =====================================================
-- AGENT_ACTIVITIES TABLE INDEXES
-- =====================================================

-- Index for agent relationship
CREATE INDEX IF NOT EXISTS idx_agent_activities_agent_name ON agent_activities(agent_name);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_agent_activities_started_at ON agent_activities(started_at DESC);

-- Index for success/failure analysis
CREATE INDEX IF NOT EXISTS idx_agent_activities_success ON agent_activities(success);

-- Index for order/driver/request relationships
CREATE INDEX IF NOT EXISTS idx_agent_activities_order_id ON agent_activities(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_activities_driver_id ON agent_activities(driver_id) WHERE driver_id IS NOT NULL;

-- =====================================================
-- SYSTEM_METRICS TABLE INDEXES
-- =====================================================

-- Index for date queries
CREATE INDEX IF NOT EXISTS idx_system_metrics_date ON system_metrics(date DESC);

-- Index for metric type
CREATE INDEX IF NOT EXISTS idx_system_metrics_metric_type ON system_metrics(metric_type);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_system_metrics_date_type ON system_metrics(date DESC, metric_type);

-- =====================================================
-- AUTONOMOUS_ACTIONS TABLE INDEXES
-- =====================================================

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_autonomous_actions_status ON autonomous_actions(status);

-- Index for approval queries
CREATE INDEX IF NOT EXISTS idx_autonomous_actions_requires_approval ON autonomous_actions(requires_approval) WHERE requires_approval = true;

-- Index for agent relationship
CREATE INDEX IF NOT EXISTS idx_autonomous_actions_agent_name ON autonomous_actions(agent_name) WHERE agent_name IS NOT NULL;

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_autonomous_actions_created_at ON autonomous_actions(created_at DESC);

-- =====================================================
-- VERIFY INDEXES
-- =====================================================

-- Show all indexes created (uncomment to run)
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY tablename, indexname;
