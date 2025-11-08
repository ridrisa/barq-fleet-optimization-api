-- Enhanced Database Schema for BARQ Logistics System
-- Production-ready PostgreSQL schema with full support for AI Fleet Management
-- Includes: Users, Agents, Autonomous Actions, Optimization Requests, and Metrics

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- For geographic data
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search optimization

-- ============================================
-- ENUMS
-- ============================================

-- Service type enum
CREATE TYPE service_type AS ENUM ('BARQ', 'BULLET');

-- Order status enum
CREATE TYPE order_status AS ENUM (
  'pending',
  'assigned',
  'picked_up',
  'in_transit',
  'delivered',
  'failed',
  'cancelled'
);

-- Driver/Vehicle status enum
CREATE TYPE driver_status AS ENUM (
  'AVAILABLE',
  'BUSY',
  'OFFLINE',
  'ON_BREAK'
);

-- Vehicle type enum
CREATE TYPE vehicle_type AS ENUM (
  'MOTORCYCLE',
  'CAR',
  'VAN',
  'TRUCK',
  'BICYCLE'
);

-- Alert level enum
CREATE TYPE alert_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- User role enum
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'operator', 'viewer', 'driver');

-- Request status enum
CREATE TYPE request_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

-- Agent status enum
CREATE TYPE agent_status AS ENUM ('idle', 'active', 'paused', 'error');

-- Priority enum
CREATE TYPE priority_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role DEFAULT 'viewer',

  -- Profile
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),

  -- Permissions (JSON array of permission strings)
  permissions JSONB DEFAULT '[]',

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  last_login_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- ============================================
-- OPTIMIZATION REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS optimization_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id VARCHAR(100) UNIQUE NOT NULL,
  status request_status DEFAULT 'pending',

  -- Request data
  pickup_points JSONB NOT NULL, -- Array of pickup point objects
  delivery_points JSONB NOT NULL, -- Array of delivery point objects
  fleet JSONB NOT NULL, -- Array of vehicle objects
  business_rules JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}',

  -- Timing
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Results
  result_data JSONB,
  error_message TEXT,

  -- Metadata
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for optimization_requests
CREATE INDEX idx_opt_requests_status ON optimization_requests(status);
CREATE INDEX idx_opt_requests_timestamp ON optimization_requests(timestamp DESC);
CREATE INDEX idx_opt_requests_request_id ON optimization_requests(request_id);
CREATE INDEX idx_opt_requests_created_by ON optimization_requests(created_by);

-- ============================================
-- OPTIMIZATION RESULTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS optimization_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID REFERENCES optimization_requests(id) ON DELETE CASCADE,
  optimization_id VARCHAR(100) UNIQUE NOT NULL,

  -- Results
  success BOOLEAN DEFAULT false,
  routes JSONB NOT NULL, -- Array of route objects

  -- Metrics
  total_distance DECIMAL(10, 2),
  total_duration INTEGER, -- in minutes
  total_cost DECIMAL(10, 2),
  fuel_consumption DECIMAL(10, 2),
  co2_emissions DECIMAL(10, 2),

  -- Performance
  computation_time INTEGER, -- milliseconds
  algorithm_used VARCHAR(100),

  -- Timing
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- Indexes for optimization_results
CREATE INDEX idx_opt_results_request_id ON optimization_results(request_id);
CREATE INDEX idx_opt_results_success ON optimization_results(success);
CREATE INDEX idx_opt_results_timestamp ON optimization_results(timestamp DESC);

-- ============================================
-- METRICS TABLE (Daily/Hourly Statistics)
-- ============================================
CREATE TABLE IF NOT EXISTS system_metrics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  metric_type VARCHAR(50) NOT NULL, -- 'daily', 'hourly', 'realtime'

  -- Core metrics
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,

  -- Performance metrics
  avg_response_time DECIMAL(10, 2),
  avg_route_distance DECIMAL(10, 2),
  avg_route_duration INTEGER,
  total_distance_optimized DECIMAL(10, 2),
  total_fuel_saved DECIMAL(10, 2),
  total_co2_reduced DECIMAL(10, 2),

  -- Service metrics
  sla_compliance_rate DECIMAL(5, 2),
  customer_satisfaction DECIMAL(3, 2),

  -- Financial metrics
  total_revenue DECIMAL(10, 2),
  total_cost DECIMAL(10, 2),

  -- Additional data
  hourly_breakdown JSONB,
  regional_breakdown JSONB,

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Unique constraint on date and type
  UNIQUE(date, metric_type)
);

-- Indexes for system_metrics
CREATE INDEX idx_metrics_date ON system_metrics(date DESC);
CREATE INDEX idx_metrics_type ON system_metrics(metric_type);

-- ============================================
-- AGENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name VARCHAR(100) UNIQUE NOT NULL,
  agent_type VARCHAR(100) NOT NULL, -- 'route_optimization', 'sla_monitor', etc.
  status agent_status DEFAULT 'idle',

  -- Configuration
  config JSONB DEFAULT '{}',
  capabilities JSONB DEFAULT '[]',

  -- Performance
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  avg_execution_time INTEGER, -- milliseconds

  -- Status tracking
  last_execution_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for agents
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_type ON agents(agent_type);
CREATE INDEX idx_agents_active ON agents(is_active);

-- ============================================
-- AGENT ACTIVITIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agent_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  agent_name VARCHAR(100) NOT NULL,
  activity_type VARCHAR(100) NOT NULL,

  -- Activity details
  input_data JSONB,
  output_data JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  -- Performance
  execution_time_ms INTEGER,
  tokens_used INTEGER,

  -- Context
  order_id UUID,
  driver_id UUID,
  request_id UUID,

  -- Timestamp
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for agent_activities
CREATE INDEX idx_agent_activities_agent_id ON agent_activities(agent_id);
CREATE INDEX idx_agent_activities_agent_name ON agent_activities(agent_name);
CREATE INDEX idx_agent_activities_type ON agent_activities(activity_type);
CREATE INDEX idx_agent_activities_started ON agent_activities(started_at DESC);
CREATE INDEX idx_agent_activities_success ON agent_activities(success);

-- ============================================
-- AUTONOMOUS ACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS autonomous_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type VARCHAR(100) NOT NULL,
  action_name VARCHAR(255) NOT NULL,

  -- Execution details
  agent_name VARCHAR(100),
  input_data JSONB,
  output_data JSONB,

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, executed, failed
  success BOOLEAN,
  error_message TEXT,

  -- Approval workflow
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  approval_notes TEXT,

  -- Impact tracking
  affected_entities JSONB, -- List of affected orders, drivers, etc.
  impact_level VARCHAR(20), -- low, medium, high, critical

  -- Timing
  scheduled_at TIMESTAMP WITH TIME ZONE,
  executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- Indexes for autonomous_actions
CREATE INDEX idx_autonomous_actions_status ON autonomous_actions(status);
CREATE INDEX idx_autonomous_actions_type ON autonomous_actions(action_type);
CREATE INDEX idx_autonomous_actions_agent ON autonomous_actions(agent_name);
CREATE INDEX idx_autonomous_actions_created ON autonomous_actions(created_at DESC);
CREATE INDEX idx_autonomous_actions_requires_approval ON autonomous_actions(requires_approval);

-- ============================================
-- DRIVERS TABLE (from original schema)
-- ============================================
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  vehicle_type vehicle_type NOT NULL,
  vehicle_number VARCHAR(50),
  license_number VARCHAR(50),
  status driver_status DEFAULT 'OFFLINE',

  -- Location tracking
  current_location GEOGRAPHY(POINT, 4326),
  last_location_update TIMESTAMP WITH TIME ZONE,

  -- Performance metrics
  rating DECIMAL(3, 2) DEFAULT 5.00,
  total_deliveries INTEGER DEFAULT 0,
  successful_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0,

  -- Service preferences
  service_types service_type[] DEFAULT ARRAY['BARQ', 'BULLET'],
  max_concurrent_orders INTEGER DEFAULT 1,
  working_hours JSONB,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for drivers
CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_drivers_location ON drivers USING GIST(current_location);
CREATE INDEX idx_drivers_service_types ON drivers USING GIN(service_types);
CREATE INDEX idx_drivers_employee_id ON drivers(employee_id);

-- ============================================
-- VEHICLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fleet_id VARCHAR(50) UNIQUE NOT NULL,
  vehicle_type vehicle_type NOT NULL,

  -- Capacity
  capacity_kg INTEGER NOT NULL,
  capacity_volume DECIMAL(10, 2),

  -- Current status
  status driver_status DEFAULT 'OFFLINE',
  current_location GEOGRAPHY(POINT, 4326),
  current_latitude DECIMAL(10, 6),
  current_longitude DECIMAL(10, 6),

  -- Assignment
  driver_id UUID REFERENCES drivers(id),
  outlet_id INTEGER,

  -- Specifications
  make VARCHAR(100),
  model VARCHAR(100),
  year INTEGER,
  license_plate VARCHAR(50),
  vin VARCHAR(50),

  -- Performance
  fuel_efficiency DECIMAL(5, 2), -- km per liter
  maintenance_due_date DATE,
  last_service_date DATE,
  total_km_driven DECIMAL(10, 2),

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for vehicles
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_fleet_id ON vehicles(fleet_id);
CREATE INDEX idx_vehicles_driver_id ON vehicles(driver_id);
CREATE INDEX idx_vehicles_location ON vehicles USING GIST(current_location);

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  order_id VARCHAR(50) UNIQUE NOT NULL, -- For compatibility
  customer_id UUID,
  driver_id UUID REFERENCES drivers(id),
  vehicle_id UUID REFERENCES vehicles(id),

  -- Service details
  service_type service_type NOT NULL,
  status order_status DEFAULT 'pending',
  priority priority_level DEFAULT 'MEDIUM',

  -- Locations
  pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
  pickup_address JSONB NOT NULL,
  dropoff_location GEOGRAPHY(POINT, 4326) NOT NULL,
  dropoff_address JSONB NOT NULL,

  -- Customer info (denormalized for performance)
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),

  -- Package details
  load_kg DECIMAL(10, 2) DEFAULT 0,
  time_window VARCHAR(50),
  package_details JSONB DEFAULT '{}',
  package_value DECIMAL(10, 2),
  cod_amount DECIMAL(10, 2) DEFAULT 0,

  -- Distance and route
  estimated_distance DECIMAL(10, 2),
  actual_distance DECIMAL(10, 2),
  route_polyline TEXT,

  -- Time management
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  assigned_at TIMESTAMP WITH TIME ZONE,
  picked_up_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,

  -- SLA tracking
  sla_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  estimated_delivery_time TIMESTAMP WITH TIME ZONE,
  actual_delivery_time TIMESTAMP WITH TIME ZONE,
  sla_breached BOOLEAN DEFAULT false,

  -- Fees and pricing
  delivery_fee DECIMAL(10, 2),
  surge_multiplier DECIMAL(3, 2) DEFAULT 1.0,
  total_amount DECIMAL(10, 2),

  -- Tracking
  tracking_url VARCHAR(500),
  signature_required BOOLEAN DEFAULT false,
  signature_data JSONB,

  -- Metadata
  notes TEXT,
  cancellation_reason TEXT,
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for orders
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_service_type ON orders(service_type);
CREATE INDEX idx_orders_driver_id ON orders(driver_id);
CREATE INDEX idx_orders_vehicle_id ON orders(vehicle_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_sla_deadline ON orders(sla_deadline);
CREATE INDEX idx_orders_pickup_location ON orders USING GIST(pickup_location);
CREATE INDEX idx_orders_dropoff_location ON orders USING GIST(dropoff_location);
CREATE INDEX idx_orders_priority ON orders(priority);

-- ============================================
-- ROUTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id VARCHAR(100) UNIQUE NOT NULL,
  optimization_request_id UUID REFERENCES optimization_requests(id),

  -- Route details
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id UUID REFERENCES drivers(id),

  -- Stops (ordered list of stop objects)
  stops JSONB NOT NULL,
  sequence INTEGER[] NOT NULL,

  -- Metrics
  total_distance DECIMAL(10, 2),
  total_duration INTEGER, -- minutes
  total_load_kg DECIMAL(10, 2),

  -- Optimization
  optimized_sequence INTEGER[],
  algorithm_used VARCHAR(50),

  -- Status
  status VARCHAR(50) DEFAULT 'planned', -- planned, active, completed, cancelled

  -- Timing
  planned_start_time TIMESTAMP WITH TIME ZONE,
  actual_start_time TIMESTAMP WITH TIME ZONE,
  planned_end_time TIMESTAMP WITH TIME ZONE,
  actual_end_time TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for routes
CREATE INDEX idx_routes_vehicle_id ON routes(vehicle_id);
CREATE INDEX idx_routes_driver_id ON routes(driver_id);
CREATE INDEX idx_routes_status ON routes(status);
CREATE INDEX idx_routes_optimization_request ON routes(optimization_request_id);

-- ============================================
-- SLA_VIOLATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sla_violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id),
  driver_id UUID REFERENCES drivers(id),

  -- Violation details
  violation_type VARCHAR(50) NOT NULL,
  severity alert_level NOT NULL,
  sla_target TIMESTAMP WITH TIME ZONE,
  actual_time TIMESTAMP WITH TIME ZONE,
  delay_minutes INTEGER,

  -- Resolution
  resolved BOOLEAN DEFAULT false,
  resolution_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id),

  -- Impact
  customer_notified BOOLEAN DEFAULT false,
  compensation_amount DECIMAL(10, 2),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for sla_violations
CREATE INDEX idx_sla_violations_order_id ON sla_violations(order_id);
CREATE INDEX idx_sla_violations_driver_id ON sla_violations(driver_id);
CREATE INDEX idx_sla_violations_severity ON sla_violations(severity);
CREATE INDEX idx_sla_violations_resolved ON sla_violations(resolved);

-- ============================================
-- AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,

  -- Event details
  actor_id UUID REFERENCES users(id),
  actor_type VARCHAR(50),
  action VARCHAR(100),

  -- Data
  old_data JSONB,
  new_data JSONB,
  changes JSONB, -- Specific changed fields

  -- Context
  ip_address INET,
  user_agent TEXT,
  request_id VARCHAR(100),

  -- Metadata
  metadata JSONB DEFAULT '{}',
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit_logs
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_occurred_at ON audit_logs(occurred_at DESC);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at on all tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_opt_requests_updated_at BEFORE UPDATE ON optimization_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_metrics_updated_at BEFORE UPDATE ON system_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check SLA violations
CREATE OR REPLACE FUNCTION check_sla_violation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'delivered' AND NEW.delivered_at > NEW.sla_deadline THEN
    NEW.sla_breached = true;

    INSERT INTO sla_violations (
      order_id,
      driver_id,
      violation_type,
      severity,
      sla_target,
      actual_time,
      delay_minutes
    ) VALUES (
      NEW.id,
      NEW.driver_id,
      'LATE_DELIVERY',
      CASE
        WHEN EXTRACT(EPOCH FROM (NEW.delivered_at - NEW.sla_deadline))/60 > 30 THEN 'CRITICAL'
        WHEN EXTRACT(EPOCH FROM (NEW.delivered_at - NEW.sla_deadline))/60 > 15 THEN 'HIGH'
        ELSE 'MEDIUM'
      END,
      NEW.sla_deadline,
      NEW.delivered_at,
      EXTRACT(EPOCH FROM (NEW.delivered_at - NEW.sla_deadline))/60
    );
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for SLA checking
CREATE TRIGGER check_order_sla BEFORE UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION check_sla_violation();

-- Function to log agent activities when agent executes
CREATE OR REPLACE FUNCTION log_agent_execution()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_executions = COALESCE(NEW.total_executions, 0) + 1;

  IF NEW.status = 'idle' AND OLD.status = 'active' THEN
    -- Execution completed, update last_execution_at
    NEW.last_execution_at = CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for agent execution logging
CREATE TRIGGER log_agent_exec BEFORE UPDATE ON agents
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_agent_execution();

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Active orders view
CREATE OR REPLACE VIEW active_orders_view AS
SELECT
  o.*,
  d.name as driver_name,
  d.phone as driver_phone,
  d.current_location as driver_location,
  v.fleet_id,
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - o.created_at))/60 as age_minutes,
  EXTRACT(EPOCH FROM (o.sla_deadline - CURRENT_TIMESTAMP))/60 as time_to_sla_minutes
FROM orders o
LEFT JOIN drivers d ON o.driver_id = d.id
LEFT JOIN vehicles v ON o.vehicle_id = v.id
WHERE o.status NOT IN ('delivered', 'cancelled', 'failed');

-- Driver performance view
CREATE OR REPLACE VIEW driver_performance_view AS
SELECT
  d.id,
  d.name,
  d.rating,
  d.total_deliveries,
  d.successful_deliveries,
  CASE
    WHEN d.total_deliveries > 0
    THEN (d.successful_deliveries::DECIMAL / d.total_deliveries * 100)
    ELSE 0
  END as success_rate,
  COUNT(DISTINCT o.id) as orders_today,
  AVG(EXTRACT(EPOCH FROM (o.delivered_at - o.picked_up_at))/60) as avg_delivery_time_minutes
FROM drivers d
LEFT JOIN orders o ON d.id = o.driver_id
  AND DATE(o.created_at) = CURRENT_DATE
GROUP BY d.id;

-- System health view
CREATE OR REPLACE VIEW system_health_view AS
SELECT
  COUNT(*) FILTER (WHERE status = 'active') as active_agents,
  COUNT(*) FILTER (WHERE status = 'error') as error_agents,
  COUNT(*) as total_agents
FROM agents;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
-- Note: Adjust username as needed for your environment
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- ============================================
-- INITIAL SEED DATA (Optional)
-- ============================================

-- Create default admin user (password: admin123 - CHANGE IN PRODUCTION!)
-- Password hash generated with bcrypt, cost 10
INSERT INTO users (email, password_hash, role, first_name, last_name, permissions, is_verified)
VALUES (
  'admin@barq.com',
  '$2a$10$rKxZvN1TJvJKrqLKHJ8gPuYhp8zJ5LvKzHqLJKzHqLJKzHqLJKzHq', -- admin123
  'admin',
  'System',
  'Administrator',
  '["all"]',
  true
) ON CONFLICT (email) DO NOTHING;

-- Create default agents
INSERT INTO agents (agent_name, agent_type, capabilities, is_active) VALUES
  ('route-optimization-agent', 'route_optimization', '["optimize_routes", "calculate_distances", "assign_vehicles"]', true),
  ('sla-monitor-agent', 'sla_monitoring', '["monitor_sla", "detect_violations", "escalate_issues"]', true),
  ('fleet-status-agent', 'fleet_management', '["track_vehicles", "monitor_status", "optimize_allocation"]', true),
  ('order-assignment-agent', 'order_management', '["assign_orders", "match_drivers", "optimize_assignments"]', true),
  ('performance-analytics-agent', 'analytics', '["calculate_metrics", "generate_reports", "track_kpis"]', true)
ON CONFLICT (agent_name) DO NOTHING;

-- Create indexes for performance (run concurrently in production)
-- These are already created above, but can be added later with CONCURRENTLY for zero downtime
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_created
--   ON orders(status, created_at DESC)
--   WHERE status IN ('pending', 'assigned');
