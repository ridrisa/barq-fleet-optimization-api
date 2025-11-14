-- Migration: Add Driver State Tracking System
-- Version: 001
-- Description: Adds operational state tracking, performance metrics, and capacity management to drivers table

-- ============================================
-- 1. CREATE NEW ENUMS
-- ============================================

-- Operational state enum (more granular than status)
DO $$ BEGIN
  CREATE TYPE operational_state AS ENUM (
    'OFFLINE',    -- Driver not working
    'AVAILABLE',  -- Ready for assignments
    'BUSY',       -- Currently on delivery
    'RETURNING',  -- Returning to available location after delivery
    'ON_BREAK'    -- Taking mandatory break
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 2. ADD NEW COLUMNS TO DRIVERS TABLE
-- ============================================

-- State tracking columns
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS operational_state operational_state DEFAULT 'OFFLINE',
  ADD COLUMN IF NOT EXISTS state_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS previous_state operational_state;

-- Current activity tracking
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS active_delivery_id UUID,
  ADD COLUMN IF NOT EXISTS delivery_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS pickup_completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS eta_to_dropoff TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS dropoff_latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS dropoff_longitude DECIMAL(11, 8);

-- Performance tracking (daily targets)
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS target_deliveries INTEGER DEFAULT 25,
  ADD COLUMN IF NOT EXISTS completed_today INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_this_week INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_daily_reset TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS on_time_rate DECIMAL(5,2) DEFAULT 100.00; -- Last 30 days percentage

-- Capacity tracking
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS capacity_kg DECIMAL(10,2) DEFAULT 100.00,
  ADD COLUMN IF NOT EXISTS current_load_kg DECIMAL(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS max_volume_m3 DECIMAL(10,2) DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS current_volume_m3 DECIMAL(10,2) DEFAULT 0.00;

-- Work hours tracking
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS hours_worked_today DECIMAL(4,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS shift_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_break_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS break_duration_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consecutive_deliveries INTEGER DEFAULT 0;

-- Availability constraints
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS available_until TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS max_working_hours DECIMAL(4,2) DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS requires_break_after INTEGER DEFAULT 5; -- Deliveries before mandatory break

-- State transition history (for analytics)
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS state_history JSONB DEFAULT '[]'::jsonb;

-- ============================================
-- 3. CREATE INDEXES
-- ============================================

-- Index for finding available drivers
CREATE INDEX IF NOT EXISTS idx_drivers_operational_state
  ON drivers(operational_state)
  WHERE operational_state IN ('AVAILABLE', 'RETURNING');

-- Index for state and location lookup
CREATE INDEX IF NOT EXISTS idx_drivers_state_location
  ON drivers(operational_state, current_latitude, current_longitude)
  WHERE operational_state = 'AVAILABLE';

-- Index for performance tracking
CREATE INDEX IF NOT EXISTS idx_drivers_performance
  ON drivers(completed_today, target_deliveries, on_time_rate);

-- Index for active deliveries
CREATE INDEX IF NOT EXISTS idx_drivers_active_delivery
  ON drivers(active_delivery_id)
  WHERE active_delivery_id IS NOT NULL;

-- Composite index for availability check
CREATE INDEX IF NOT EXISTS idx_drivers_availability
  ON drivers(operational_state, is_active, hours_worked_today, consecutive_deliveries)
  WHERE is_active = true;

-- ============================================
-- 4. CREATE STATE TRANSITION LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS driver_state_transitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,

  -- Transition details
  from_state operational_state,
  to_state operational_state NOT NULL,
  transition_reason VARCHAR(100),

  -- Context
  order_id UUID,
  location_latitude DECIMAL(10, 8),
  location_longitude DECIMAL(11, 8),

  -- Metadata
  triggered_by VARCHAR(100), -- 'system', 'driver', 'admin', 'agent'
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamp
  transitioned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT valid_transition CHECK (from_state IS NULL OR from_state != to_state)
);

-- Indexes for state transitions
CREATE INDEX idx_driver_state_transitions_driver
  ON driver_state_transitions(driver_id, transitioned_at DESC);

CREATE INDEX idx_driver_state_transitions_states
  ON driver_state_transitions(from_state, to_state);

-- ============================================
-- 5. CREATE FUNCTIONS
-- ============================================

-- Function to calculate gap from target
CREATE OR REPLACE FUNCTION calculate_gap_from_target(driver_id UUID)
RETURNS INTEGER AS $$
DECLARE
  target INTEGER;
  completed INTEGER;
BEGIN
  SELECT target_deliveries, completed_today
  INTO target, completed
  FROM drivers
  WHERE id = driver_id;

  RETURN target - completed;
END;
$$ LANGUAGE plpgsql;

-- Function to check if driver can accept order
CREATE OR REPLACE FUNCTION can_accept_order(driver_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  driver RECORD;
BEGIN
  SELECT
    operational_state,
    hours_worked_today,
    max_working_hours,
    consecutive_deliveries,
    requires_break_after,
    target_deliveries,
    completed_today,
    is_active
  INTO driver
  FROM drivers
  WHERE id = driver_id;

  -- Check all availability conditions
  RETURN (
    driver.is_active = true AND
    driver.operational_state = 'AVAILABLE' AND
    driver.hours_worked_today < driver.max_working_hours AND
    driver.consecutive_deliveries < driver.requires_break_after AND
    driver.completed_today < driver.target_deliveries
  );
END;
$$ LANGUAGE plpgsql;

-- Function to log state transition
CREATE OR REPLACE FUNCTION log_state_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if state actually changed
  IF OLD.operational_state IS DISTINCT FROM NEW.operational_state THEN
    -- Insert transition log
    INSERT INTO driver_state_transitions (
      driver_id,
      from_state,
      to_state,
      location_latitude,
      location_longitude,
      triggered_by
    ) VALUES (
      NEW.id,
      OLD.operational_state,
      NEW.operational_state,
      NEW.current_latitude,
      NEW.current_longitude,
      COALESCE(current_setting('app.current_user', true), 'system')
    );

    -- Update state history JSONB
    NEW.state_history = COALESCE(NEW.state_history, '[]'::jsonb) ||
      jsonb_build_object(
        'from', OLD.operational_state,
        'to', NEW.operational_state,
        'timestamp', CURRENT_TIMESTAMP,
        'reason', NEW.transition_reason
      );

    -- Update state changed timestamp
    NEW.state_changed_at = CURRENT_TIMESTAMP;
    NEW.previous_state = OLD.operational_state;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to reset daily counters
CREATE OR REPLACE FUNCTION reset_daily_driver_metrics()
RETURNS void AS $$
BEGIN
  UPDATE drivers
  SET
    completed_today = 0,
    hours_worked_today = 0.00,
    consecutive_deliveries = 0,
    break_duration_minutes = 0,
    last_daily_reset = CURRENT_DATE
  WHERE
    last_daily_reset < CURRENT_DATE
    AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate on-time rate
CREATE OR REPLACE FUNCTION update_driver_on_time_rate(driver_id UUID)
RETURNS void AS $$
DECLARE
  total_deliveries INTEGER;
  on_time_deliveries INTEGER;
  rate DECIMAL(5,2);
BEGIN
  -- Calculate from last 30 days
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE sla_breached = false)
  INTO total_deliveries, on_time_deliveries
  FROM orders
  WHERE
    driver_id = driver_id
    AND status = 'delivered'
    AND delivered_at >= CURRENT_DATE - INTERVAL '30 days';

  -- Calculate rate
  IF total_deliveries > 0 THEN
    rate = (on_time_deliveries::DECIMAL / total_deliveries * 100)::DECIMAL(5,2);
  ELSE
    rate = 100.00;
  END IF;

  -- Update driver
  UPDATE drivers
  SET on_time_rate = rate
  WHERE id = driver_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. CREATE TRIGGERS
-- ============================================

-- Trigger to log state transitions
DROP TRIGGER IF EXISTS driver_state_transition_logger ON drivers;
CREATE TRIGGER driver_state_transition_logger
  BEFORE UPDATE ON drivers
  FOR EACH ROW
  WHEN (OLD.operational_state IS DISTINCT FROM NEW.operational_state)
  EXECUTE FUNCTION log_state_transition();

-- ============================================
-- 7. CREATE VIEWS
-- ============================================

-- View for available drivers with enriched data
CREATE OR REPLACE VIEW available_drivers_v AS
SELECT
  d.id,
  d.employee_id,
  d.name,
  d.phone,
  d.vehicle_type,
  d.operational_state,
  d.rating,
  d.target_deliveries,
  d.completed_today,
  (d.target_deliveries - d.completed_today) as gap_from_target,
  d.on_time_rate,
  d.hours_worked_today,
  d.max_working_hours,
  (d.max_working_hours - d.hours_worked_today) as hours_remaining,
  d.consecutive_deliveries,
  d.requires_break_after,
  d.current_latitude,
  d.current_longitude,
  d.capacity_kg,
  d.current_load_kg,
  (d.capacity_kg - d.current_load_kg) as available_capacity_kg,
  d.service_types,
  can_accept_order(d.id) as can_accept_order
FROM drivers d
WHERE
  d.is_active = true
  AND d.operational_state IN ('AVAILABLE', 'RETURNING')
ORDER BY
  d.operational_state DESC, -- AVAILABLE first
  d.rating DESC,
  d.completed_today ASC; -- Give more to drivers behind on target

-- View for driver performance dashboard
CREATE OR REPLACE VIEW driver_performance_dashboard AS
SELECT
  d.id,
  d.name,
  d.operational_state,
  d.state_changed_at,
  d.completed_today,
  d.target_deliveries,
  (d.target_deliveries - d.completed_today) as gap,
  CASE
    WHEN d.target_deliveries > 0
    THEN ROUND((d.completed_today::DECIMAL / d.target_deliveries * 100), 2)
    ELSE 0
  END as target_completion_rate,
  d.on_time_rate,
  d.hours_worked_today,
  d.consecutive_deliveries,
  d.rating,
  d.total_deliveries as lifetime_deliveries,
  COUNT(o.id) as active_orders
FROM drivers d
LEFT JOIN orders o ON d.id = o.driver_id
  AND o.status NOT IN ('delivered', 'cancelled', 'failed')
WHERE d.is_active = true
GROUP BY d.id;

-- View for real-time fleet status
CREATE OR REPLACE VIEW fleet_status_realtime AS
SELECT
  operational_state,
  COUNT(*) as driver_count,
  AVG(completed_today) as avg_completed_today,
  AVG(hours_worked_today) as avg_hours_worked,
  AVG(on_time_rate) as avg_on_time_rate,
  ARRAY_AGG(id) as driver_ids
FROM drivers
WHERE is_active = true
GROUP BY operational_state;

-- ============================================
-- 8. ADD CONSTRAINTS
-- ============================================

-- Ensure state transitions are valid
ALTER TABLE drivers
  ADD CONSTRAINT valid_state_transition CHECK (
    operational_state IN ('OFFLINE', 'AVAILABLE', 'BUSY', 'RETURNING', 'ON_BREAK')
  );

-- Ensure capacity constraints
ALTER TABLE drivers
  ADD CONSTRAINT valid_capacity CHECK (
    current_load_kg >= 0 AND current_load_kg <= capacity_kg
  );

-- Ensure working hours constraints
ALTER TABLE drivers
  ADD CONSTRAINT valid_working_hours CHECK (
    hours_worked_today >= 0 AND hours_worked_today <= max_working_hours
  );

-- Ensure performance metrics are valid
ALTER TABLE drivers
  ADD CONSTRAINT valid_on_time_rate CHECK (
    on_time_rate >= 0 AND on_time_rate <= 100
  );

-- ============================================
-- 9. SEED DEFAULT VALUES FOR EXISTING DRIVERS
-- ============================================

-- Update existing drivers with default state tracking values
UPDATE drivers
SET
  operational_state = CASE
    WHEN status = 'available' THEN 'AVAILABLE'::operational_state
    WHEN status = 'busy' THEN 'BUSY'::operational_state
    WHEN status = 'on_break' THEN 'ON_BREAK'::operational_state
    ELSE 'OFFLINE'::operational_state
  END,
  state_changed_at = COALESCE(last_location_update, updated_at, created_at),
  target_deliveries = 25,
  completed_today = 0,
  on_time_rate = 100.00,
  capacity_kg = CASE vehicle_type
    WHEN 'MOTORCYCLE' THEN 30.0
    WHEN 'CAR' THEN 100.0
    WHEN 'VAN' THEN 500.0
    WHEN 'TRUCK' THEN 1000.0
    ELSE 100.0
  END,
  max_working_hours = 10.00,
  requires_break_after = 5,
  last_daily_reset = CURRENT_DATE
WHERE operational_state IS NULL;

-- ============================================
-- 10. GRANT PERMISSIONS
-- ============================================

GRANT ALL PRIVILEGES ON driver_state_transitions TO postgres;
GRANT SELECT ON available_drivers_v TO postgres;
GRANT SELECT ON driver_performance_dashboard TO postgres;
GRANT SELECT ON fleet_status_realtime TO postgres;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

COMMENT ON COLUMN drivers.operational_state IS 'Real-time operational state for assignment logic';
COMMENT ON COLUMN drivers.gap_from_target IS 'Calculated: target_deliveries - completed_today';
COMMENT ON TABLE driver_state_transitions IS 'Audit log of all driver state changes';
COMMENT ON FUNCTION can_accept_order IS 'Checks all conditions for driver availability';
