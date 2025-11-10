-- Database Schema for BARQ Logistics System (No PostGIS version)
-- Supports BARQ (1-hour) and BULLET (2-4 hour) delivery services
-- Uses standard PostgreSQL types instead of PostGIS for compatibility

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Service type enum
DO $$ BEGIN
    CREATE TYPE service_type AS ENUM ('BARQ', 'BULLET', 'EXPRESS', 'STANDARD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Order status enum
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
      'pending',
      'assigned',
      'picked_up',
      'in_transit',
      'delivered',
      'failed',
      'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Driver status enum
DO $$ BEGIN
    CREATE TYPE driver_status AS ENUM (
      'available',
      'busy',
      'offline',
      'on_break'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Vehicle type enum
DO $$ BEGIN
    CREATE TYPE vehicle_type AS ENUM (
      'MOTORCYCLE',
      'CAR',
      'VAN',
      'TRUCK',
      'BICYCLE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Alert level enum
DO $$ BEGIN
    CREATE TYPE alert_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- DRIVERS TABLE
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
  status driver_status DEFAULT 'offline',

  -- Location tracking (using standard lat/long instead of GEOGRAPHY)
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  last_location_update TIMESTAMP WITH TIME ZONE,

  -- Performance metrics
  rating DECIMAL(3, 2) DEFAULT 5.00,
  total_deliveries INTEGER DEFAULT 0,
  successful_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0,

  -- Service preferences
  service_types service_type[] DEFAULT ARRAY['BARQ', 'BULLET']::service_type[],
  max_concurrent_orders INTEGER DEFAULT 1,
  working_hours JSONB, -- Store schedule

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for drivers
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_location ON drivers(current_latitude, current_longitude);
CREATE INDEX IF NOT EXISTS idx_drivers_service_types ON drivers USING GIN(service_types);

-- ============================================
-- CUSTOMERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),

  -- Addresses
  addresses JSONB DEFAULT '[]', -- Array of address objects
  default_address JSONB,

  -- Preferences
  preferred_service_type service_type,
  language VARCHAR(10) DEFAULT 'ar',

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for customers
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  driver_id UUID REFERENCES drivers(id),

  -- Service details
  service_type service_type NOT NULL,
  status order_status DEFAULT 'pending',
  priority INTEGER DEFAULT 0, -- Higher number = higher priority

  -- Pickup location (using standard lat/long instead of GEOGRAPHY)
  pickup_latitude DECIMAL(10, 8) NOT NULL,
  pickup_longitude DECIMAL(11, 8) NOT NULL,
  pickup_address JSONB NOT NULL,

  -- Dropoff location (using standard lat/long instead of GEOGRAPHY)
  dropoff_latitude DECIMAL(10, 8) NOT NULL,
  dropoff_longitude DECIMAL(11, 8) NOT NULL,
  dropoff_address JSONB NOT NULL,

  -- Distance and route
  estimated_distance DECIMAL(10, 2), -- in kilometers
  actual_distance DECIMAL(10, 2),
  route_polyline TEXT, -- Encoded route

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

  -- Package details
  package_details JSONB DEFAULT '{}',
  package_value DECIMAL(10, 2),
  cod_amount DECIMAL(10, 2) DEFAULT 0,

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
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_service_type ON orders(service_type);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_sla_deadline ON orders(sla_deadline);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_location ON orders(pickup_latitude, pickup_longitude);
CREATE INDEX IF NOT EXISTS idx_orders_dropoff_location ON orders(dropoff_latitude, dropoff_longitude);

-- ============================================
-- ROUTE_OPTIMIZATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS route_optimizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES drivers(id),

  -- Optimization details
  order_ids UUID[] NOT NULL,
  optimized_sequence INTEGER[] NOT NULL,
  algorithm_used VARCHAR(50),

  -- Metrics
  total_distance DECIMAL(10, 2),
  total_time_minutes INTEGER,
  fuel_saved DECIMAL(10, 2),

  -- Route data
  optimized_route JSONB,
  original_route JSONB,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  executed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  success BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for route_optimizations
CREATE INDEX IF NOT EXISTS idx_route_opt_driver_id ON route_optimizations(driver_id);
CREATE INDEX IF NOT EXISTS idx_route_opt_created_at ON route_optimizations(created_at DESC);

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
  resolved_by VARCHAR(255),

  -- Impact
  customer_notified BOOLEAN DEFAULT false,
  compensation_amount DECIMAL(10, 2),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for sla_violations
CREATE INDEX IF NOT EXISTS idx_sla_violations_order_id ON sla_violations(order_id);
CREATE INDEX IF NOT EXISTS idx_sla_violations_driver_id ON sla_violations(driver_id);
CREATE INDEX IF NOT EXISTS idx_sla_violations_severity ON sla_violations(severity);
CREATE INDEX IF NOT EXISTS idx_sla_violations_resolved ON sla_violations(resolved);

-- ============================================
-- EVENTS TABLE (Audit Log)
-- ============================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,

  -- Event details
  actor_id VARCHAR(255),
  actor_type VARCHAR(50),
  action VARCHAR(100),

  -- Data
  old_data JSONB,
  new_data JSONB,
  metadata JSONB DEFAULT '{}',

  -- Timestamp
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for events
CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_events_occurred_at ON events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);

-- ============================================
-- METRICS TABLE (Time-series metrics)
-- ============================================
CREATE TABLE IF NOT EXISTS metrics (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(20, 4) NOT NULL,

  -- Dimensions
  service_type service_type,
  region VARCHAR(100),
  driver_id UUID,

  -- Tags
  tags JSONB DEFAULT '{}',

  -- Timestamp
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for metrics
CREATE INDEX IF NOT EXISTS idx_metrics_name_time ON metrics(metric_name, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_service_type ON metrics(service_type);
CREATE INDEX IF NOT EXISTS idx_metrics_tags ON metrics USING GIN(tags);

-- ============================================
-- ZONES TABLE (Delivery zones)
-- ============================================
CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  zone_type VARCHAR(50) NOT NULL, -- 'service_area', 'restricted', 'surge'

  -- Geographic boundary (stored as JSONB polygon instead of GEOGRAPHY)
  boundary JSONB NOT NULL, -- Store as {"type": "Polygon", "coordinates": [[[lon,lat], ...]]}
  center_latitude DECIMAL(10, 8),
  center_longitude DECIMAL(11, 8),

  -- Zone properties
  surge_multiplier DECIMAL(3, 2) DEFAULT 1.0,
  max_delivery_time_minutes INTEGER,
  is_active BOOLEAN DEFAULT true,

  -- Service availability
  available_services service_type[] DEFAULT ARRAY['BARQ', 'BULLET']::service_type[],
  operating_hours JSONB,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for zones
CREATE INDEX IF NOT EXISTS idx_zones_center_location ON zones(center_latitude, center_longitude);
CREATE INDEX IF NOT EXISTS idx_zones_type ON zones(zone_type);
CREATE INDEX IF NOT EXISTS idx_zones_active ON zones(is_active);

-- ============================================
-- AGENT_ACTIVITIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agent_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

  -- Timestamp
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for agent_activities
CREATE INDEX IF NOT EXISTS idx_agent_activities_agent ON agent_activities(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_activities_type ON agent_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_agent_activities_started ON agent_activities(started_at DESC);

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

-- Triggers for updated_at
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON zones
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

-- ============================================
-- VIEWS
-- ============================================

-- Active orders view
CREATE OR REPLACE VIEW active_orders AS
SELECT
  o.*,
  c.name as customer_name,
  c.phone as customer_phone,
  d.name as driver_name,
  d.phone as driver_phone,
  d.current_latitude as driver_latitude,
  d.current_longitude as driver_longitude,
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - o.created_at))/60 as age_minutes
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
LEFT JOIN drivers d ON o.driver_id = d.id
WHERE o.status NOT IN ('delivered', 'cancelled', 'failed');

-- Driver performance view
CREATE OR REPLACE VIEW driver_performance AS
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

-- SLA performance view
CREATE OR REPLACE VIEW sla_performance AS
SELECT
  service_type,
  COUNT(*) as total_orders,
  COUNT(*) FILTER (WHERE sla_breached = false) as on_time_deliveries,
  COUNT(*) FILTER (WHERE sla_breached = true) as late_deliveries,
  CASE
    WHEN COUNT(*) > 0
    THEN (COUNT(*) FILTER (WHERE sla_breached = false)::DECIMAL / COUNT(*) * 100)
    ELSE 100
  END as sla_compliance_rate,
  AVG(EXTRACT(EPOCH FROM (delivered_at - created_at))/60) as avg_delivery_time_minutes
FROM orders
WHERE status = 'delivered'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY service_type;

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default zones for major Saudi cities (using JSONB for boundaries)
INSERT INTO zones (name, zone_type, boundary, center_latitude, center_longitude, available_services) VALUES
  ('Riyadh Central', 'service_area',
   '{"type":"Polygon","coordinates":[[[46.6,24.65],[46.8,24.65],[46.8,24.78],[46.6,24.78],[46.6,24.65]]]}',
   24.7136,
   46.7136,
   ARRAY['BARQ', 'BULLET']::service_type[]),

  ('Jeddah Central', 'service_area',
   '{"type":"Polygon","coordinates":[[[39.1,21.4],[39.3,21.4],[39.3,21.6],[39.1,21.6],[39.1,21.4]]]}',
   21.4858,
   39.1925,
   ARRAY['BARQ', 'BULLET']::service_type[])
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON orders(status, created_at DESC)
  WHERE status IN ('pending', 'assigned');

CREATE INDEX IF NOT EXISTS idx_drivers_available
  ON drivers(status, service_types)
  WHERE status = 'available';

-- Grant permissions (adjust as needed for your user)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
