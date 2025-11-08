-- Add Shipments and Hubs tables to existing schema
-- Run this after orders migration completes

-- ============================================
-- HUBS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS hubs (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50),
  manager VARCHAR(255),
  mobile VARCHAR(20),
  phone VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_active BOOLEAN DEFAULT true,

  -- Location details
  city_id INTEGER,
  merchant_id INTEGER,
  store_id BIGINT,
  neighborhood_id BIGINT,
  street_name VARCHAR(255),

  -- Operating hours
  opening_time TIME DEFAULT '07:00:00',
  closing_time TIME DEFAULT '14:00:00',
  cutoff_time TIME DEFAULT '09:00:00',
  start_day INTEGER DEFAULT 0,
  end_day INTEGER DEFAULT 5,
  timings JSONB DEFAULT '{}',
  is_open BOOLEAN NOT NULL DEFAULT false,

  -- Dispatch settings
  bundle_limit INTEGER DEFAULT 4,
  dispatch_time_gap INTEGER DEFAULT 0,
  dispatch_radius INTEGER DEFAULT 8,
  last_dispatch_at TIMESTAMP WITH TIME ZONE,

  -- Delivery constraints
  max_distance DECIMAL(10, 2) DEFAULT 50.0,
  max_multiplier_distance INTEGER NOT NULL DEFAULT 0,
  promise_time_advantage INTEGER,

  -- Configuration
  hub_type INTEGER DEFAULT 0,
  flags INTEGER NOT NULL DEFAULT 0,
  trusted_address INTEGER DEFAULT 0,
  auto_send_to INTEGER,

  -- External references
  external_reference_id VARCHAR(255),
  reference_id VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for hubs
CREATE INDEX idx_hubs_merchant_id ON hubs(merchant_id);
CREATE INDEX idx_hubs_store_id ON hubs(store_id);
CREATE INDEX idx_hubs_neighborhood_id ON hubs(neighborhood_id);
CREATE INDEX idx_hubs_is_active ON hubs(is_active);
CREATE INDEX idx_hubs_location ON hubs(latitude, longitude);

-- ============================================
-- SHIPMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS shipments (
  id SERIAL PRIMARY KEY,
  courier_id UUID REFERENCES drivers(id),
  tracking_no VARCHAR(100) UNIQUE,

  -- Assignment status
  is_assigned BOOLEAN DEFAULT false,
  is_completed BOOLEAN DEFAULT false,
  is_cancelled BOOLEAN DEFAULT false,
  on_hold BOOLEAN DEFAULT false,
  is_force_published BOOLEAN DEFAULT false,

  -- Timestamps
  assign_time TIMESTAMP WITH TIME ZONE,
  pickup_time TIMESTAMP WITH TIME ZONE,
  complete_time TIMESTAMP WITH TIME ZONE,
  delivery_finish TIMESTAMP WITH TIME ZONE,

  -- Delivery promise
  promise_time INTEGER,
  promise_times JSONB DEFAULT '{}',

  -- Rewards and points
  reward DECIMAL(10, 2),
  low_reward DECIMAL(10, 2),
  delivery_points INTEGER NOT NULL DEFAULT 0,

  -- Location (hub/pickup location)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- Route metrics
  driving_distance DECIMAL(10, 2),
  driving_duration DECIMAL(10, 2),
  estimated_fuel_consumption DECIMAL(10, 2) DEFAULT 0.0,

  -- Status tracking
  shipment_status INTEGER DEFAULT 0,
  status_coordinates JSONB DEFAULT '{}',
  notified_courier_ids TEXT[] DEFAULT '{}',

  -- References
  partner_id BIGINT,
  order_status_reason_id BIGINT,
  fmd_courier_id INTEGER,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for shipments
CREATE INDEX idx_shipments_courier_id ON shipments(courier_id);
CREATE INDEX idx_shipments_tracking_no ON shipments(tracking_no);
CREATE INDEX idx_shipments_shipment_status ON shipments(shipment_status);
CREATE INDEX idx_shipments_is_assigned ON shipments(is_assigned);
CREATE INDEX idx_shipments_is_completed ON shipments(is_completed);
CREATE INDEX idx_shipments_partner_id ON shipments(partner_id);
CREATE INDEX idx_shipments_promise_times ON shipments USING GIN(promise_times);

-- ============================================
-- ALTER ORDERS TABLE
-- ============================================
-- Add foreign key columns to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipment_id INTEGER REFERENCES shipments(id),
  ADD COLUMN IF NOT EXISTS hub_id INTEGER REFERENCES hubs(id);

-- Add indexes for new foreign keys
CREATE INDEX IF NOT EXISTS idx_orders_shipment_id ON orders(shipment_id);
CREATE INDEX IF NOT EXISTS idx_orders_hub_id ON orders(hub_id);

-- ============================================
-- ALTER DRIVERS TABLE
-- ============================================
-- Add hub_id to drivers (couriers are assigned to hubs)
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS hub_id INTEGER REFERENCES hubs(id);

CREATE INDEX IF NOT EXISTS idx_drivers_hub_id ON drivers(hub_id);

-- ============================================
-- UPDATED VIEWS
-- ============================================

-- Drop and recreate active_orders view with shipment and hub info
DROP VIEW IF EXISTS active_orders;
CREATE VIEW active_orders AS
SELECT
  o.*,
  c.name as customer_name,
  c.phone as customer_phone,
  d.name as driver_name,
  d.phone as driver_phone,
  d.current_latitude as driver_latitude,
  d.current_longitude as driver_longitude,
  s.tracking_no as shipment_tracking_no,
  s.shipment_status,
  s.is_assigned as shipment_assigned,
  h.code as hub_code,
  h.manager as hub_manager,
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - o.created_at))/60 as age_minutes
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
LEFT JOIN drivers d ON o.driver_id = d.id
LEFT JOIN shipments s ON o.shipment_id = s.id
LEFT JOIN hubs h ON o.hub_id = h.id
WHERE o.status NOT IN ('delivered', 'cancelled', 'failed');

-- Create shipment summary view
CREATE VIEW shipment_summary AS
SELECT
  s.id,
  s.tracking_no,
  s.courier_id,
  d.name as courier_name,
  s.shipment_status,
  s.is_assigned,
  s.is_completed,
  COUNT(o.id) as total_orders,
  COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as delivered_orders,
  COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
  s.driving_distance,
  s.driving_duration,
  s.assign_time,
  s.pickup_time,
  s.complete_time
FROM shipments s
LEFT JOIN drivers d ON s.courier_id = d.id
LEFT JOIN orders o ON o.shipment_id = s.id
GROUP BY s.id, s.tracking_no, s.courier_id, d.name, s.shipment_status,
         s.is_assigned, s.is_completed, s.driving_distance,
         s.driving_duration, s.assign_time, s.pickup_time, s.complete_time;

-- Create hub performance view
CREATE VIEW hub_performance AS
SELECT
  h.id,
  h.code,
  h.manager,
  h.is_active,
  COUNT(DISTINCT o.id) as total_orders,
  COUNT(DISTINCT s.id) as total_shipments,
  COUNT(DISTINCT d.id) as assigned_couriers,
  AVG(EXTRACT(EPOCH FROM (o.delivered_at - o.created_at))/60) as avg_delivery_time_minutes
FROM hubs h
LEFT JOIN orders o ON o.hub_id = h.id
LEFT JOIN shipments s ON o.shipment_id = s.id
LEFT JOIN drivers d ON h.id = d.hub_id
WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY h.id, h.code, h.manager, h.is_active;

COMMENT ON TABLE hubs IS 'Warehouse/pickup locations for shipments';
COMMENT ON TABLE shipments IS 'Batches of orders assigned to couriers from hubs';
COMMENT ON COLUMN orders.shipment_id IS 'Groups multiple orders into a single courier delivery batch';
COMMENT ON COLUMN orders.hub_id IS 'Pickup location/warehouse for this order';
