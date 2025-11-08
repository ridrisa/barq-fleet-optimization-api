-- SLA Auto-Reassignment System Database Tables
-- Migration: 001_sla_tables.sql
-- Version: 1.0.0
-- Date: November 5, 2025

-- ============================================
-- Table: sla_breaches
-- Purpose: Track SLA breaches and penalties
-- ============================================

CREATE TABLE IF NOT EXISTS sla_breaches (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  order_number VARCHAR(50) NOT NULL,
  customer_id VARCHAR(50),
  driver_id VARCHAR(50),
  service_type VARCHAR(20) NOT NULL CHECK (service_type IN ('BARQ', 'BULLET')),
  sla_minutes INTEGER NOT NULL,
  actual_minutes INTEGER NOT NULL,
  breach_minutes INTEGER NOT NULL,
  penalty_amount DECIMAL(10,2) NOT NULL,
  preventable BOOLEAN DEFAULT TRUE,
  reason TEXT,
  compensation_paid BOOLEAN DEFAULT FALSE,
  compensation_paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes for common queries
  CONSTRAINT check_breach_minutes CHECK (breach_minutes >= 0),
  CONSTRAINT check_penalty_amount CHECK (penalty_amount >= 0)
);

CREATE INDEX idx_sla_breaches_order_id ON sla_breaches(order_id);
CREATE INDEX idx_sla_breaches_created_at ON sla_breaches(created_at);
CREATE INDEX idx_sla_breaches_service_type ON sla_breaches(service_type);
CREATE INDEX idx_sla_breaches_preventable ON sla_breaches(preventable);
CREATE INDEX idx_sla_breaches_compensation_paid ON sla_breaches(compensation_paid);

COMMENT ON TABLE sla_breaches IS 'Records of SLA breaches with penalty calculations';
COMMENT ON COLUMN sla_breaches.preventable IS 'Indicates if breach could have been prevented by system';
COMMENT ON COLUMN sla_breaches.penalty_amount IS 'Penalty amount in SAR';

-- ============================================
-- Table: reassignment_events
-- Purpose: Track order reassignment history
-- ============================================

CREATE TABLE IF NOT EXISTS reassignment_events (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  from_driver_id VARCHAR(50),
  to_driver_id VARCHAR(50) NOT NULL,
  reason VARCHAR(100),
  distance_km DECIMAL(10,2),
  driver_score DECIMAL(5,3),
  estimated_time_saved INTEGER,
  success BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT check_distance CHECK (distance_km >= 0),
  CONSTRAINT check_score CHECK (driver_score >= 0 AND driver_score <= 1)
);

CREATE INDEX idx_reassignment_order_id ON reassignment_events(order_id);
CREATE INDEX idx_reassignment_created_at ON reassignment_events(created_at);
CREATE INDEX idx_reassignment_to_driver ON reassignment_events(to_driver_id);
CREATE INDEX idx_reassignment_from_driver ON reassignment_events(from_driver_id);

COMMENT ON TABLE reassignment_events IS 'History of order reassignments for analytics';
COMMENT ON COLUMN reassignment_events.driver_score IS 'Score of selected driver (0-1)';
COMMENT ON COLUMN reassignment_events.distance_km IS 'Distance from driver to order in kilometers';

-- ============================================
-- Table: escalations
-- Purpose: Track escalation events and actions
-- ============================================

CREATE TABLE IF NOT EXISTS escalations (
  id SERIAL PRIMARY KEY,
  escalation_id VARCHAR(100) UNIQUE NOT NULL,
  order_id VARCHAR(50) NOT NULL,
  order_number VARCHAR(50),
  service_type VARCHAR(20) CHECK (service_type IN ('BARQ', 'BULLET')),
  reason VARCHAR(100) NOT NULL,
  level VARCHAR(20) NOT NULL CHECK (level IN ('LEVEL_1', 'LEVEL_2', 'LEVEL_3')),
  metadata JSONB,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'escalated')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  resolution TEXT,
  actions JSONB,

  -- Constraints
  CONSTRAINT check_resolved_timestamp CHECK (
    (status = 'resolved' AND resolved_at IS NOT NULL) OR
    (status != 'resolved' AND resolved_at IS NULL)
  )
);

CREATE INDEX idx_escalations_order_id ON escalations(order_id);
CREATE INDEX idx_escalations_escalation_id ON escalations(escalation_id);
CREATE INDEX idx_escalations_level ON escalations(level);
CREATE INDEX idx_escalations_status ON escalations(status);
CREATE INDEX idx_escalations_created_at ON escalations(created_at);

COMMENT ON TABLE escalations IS 'Escalation events for critical order issues';
COMMENT ON COLUMN escalations.level IS 'Escalation level: LEVEL_1 (Supervisor), LEVEL_2 (Manager), LEVEL_3 (Emergency)';
COMMENT ON COLUMN escalations.metadata IS 'Additional context data in JSON format';
COMMENT ON COLUMN escalations.actions IS 'Actions taken during escalation in JSON format';

-- ============================================
-- Table: compensations
-- Purpose: Track customer compensation payments
-- ============================================

CREATE TABLE IF NOT EXISTS compensations (
  id SERIAL PRIMARY KEY,
  breach_id INTEGER REFERENCES sla_breaches(id) ON DELETE CASCADE,
  customer_id VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'ACCOUNT_CREDIT',
  transaction_id VARCHAR(100) UNIQUE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'refunded')),
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,

  -- Constraints
  CONSTRAINT check_amount CHECK (amount > 0)
);

CREATE INDEX idx_compensations_breach_id ON compensations(breach_id);
CREATE INDEX idx_compensations_customer_id ON compensations(customer_id);
CREATE INDEX idx_compensations_transaction_id ON compensations(transaction_id);
CREATE INDEX idx_compensations_status ON compensations(status);

COMMENT ON TABLE compensations IS 'Customer compensation payments for SLA breaches';
COMMENT ON COLUMN compensations.amount IS 'Compensation amount in SAR';
COMMENT ON COLUMN compensations.transaction_id IS 'Payment gateway transaction ID';

-- ============================================
-- Table: notification_log
-- Purpose: Track notification delivery
-- ============================================

CREATE TABLE IF NOT EXISTS notification_log (
  id SERIAL PRIMARY KEY,
  recipient_type VARCHAR(20) CHECK (recipient_type IN ('driver', 'customer', 'ops', 'supervisor', 'executive')),
  recipient_id VARCHAR(50),
  channel VARCHAR(20) CHECK (channel IN ('sms', 'email', 'push', 'websocket')),
  template_name VARCHAR(100),
  message_content TEXT,
  delivery_status VARCHAR(20) DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'failed', 'bounced')),
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP,
  error_message TEXT,

  -- References
  order_id VARCHAR(50),
  escalation_id VARCHAR(100),
  breach_id INTEGER,

  -- Metadata
  metadata JSONB
);

CREATE INDEX idx_notification_log_sent_at ON notification_log(sent_at);
CREATE INDEX idx_notification_log_recipient ON notification_log(recipient_id);
CREATE INDEX idx_notification_log_channel ON notification_log(channel);
CREATE INDEX idx_notification_log_order_id ON notification_log(order_id);

COMMENT ON TABLE notification_log IS 'Log of all notifications sent by the system';

-- ============================================
-- Views for Analytics
-- ============================================

-- SLA Breach Summary View
CREATE OR REPLACE VIEW v_sla_breach_summary AS
SELECT
  service_type,
  DATE(created_at) as breach_date,
  COUNT(*) as total_breaches,
  SUM(penalty_amount) as total_penalties,
  AVG(breach_minutes) as avg_breach_minutes,
  COUNT(*) FILTER (WHERE preventable = true) as preventable_count,
  COUNT(*) FILTER (WHERE compensation_paid = true) as compensated_count,
  SUM(penalty_amount) FILTER (WHERE compensation_paid = true) as total_compensated
FROM sla_breaches
GROUP BY service_type, DATE(created_at)
ORDER BY breach_date DESC;

COMMENT ON VIEW v_sla_breach_summary IS 'Daily summary of SLA breaches by service type';

-- Reassignment Performance View
CREATE OR REPLACE VIEW v_reassignment_performance AS
SELECT
  DATE(created_at) as reassignment_date,
  COUNT(*) as total_reassignments,
  COUNT(*) FILTER (WHERE success = true) as successful_reassignments,
  AVG(distance_km) as avg_distance,
  AVG(driver_score) as avg_driver_score,
  AVG(estimated_time_saved) as avg_time_saved
FROM reassignment_events
GROUP BY DATE(created_at)
ORDER BY reassignment_date DESC;

COMMENT ON VIEW v_reassignment_performance IS 'Daily reassignment performance metrics';

-- Active Escalations View
CREATE OR REPLACE VIEW v_active_escalations AS
SELECT
  e.escalation_id,
  e.order_number,
  e.service_type,
  e.reason,
  e.level,
  e.created_at,
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - e.created_at))/60 as age_minutes
FROM escalations e
WHERE e.status = 'active'
ORDER BY e.level DESC, e.created_at ASC;

COMMENT ON VIEW v_active_escalations IS 'Currently active escalations requiring attention';

-- ============================================
-- Functions for Analytics
-- ============================================

-- Function to calculate SLA compliance rate
CREATE OR REPLACE FUNCTION calculate_sla_compliance_rate(
  p_service_type VARCHAR DEFAULT NULL,
  p_start_date TIMESTAMP DEFAULT (CURRENT_TIMESTAMP - INTERVAL '30 days'),
  p_end_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
RETURNS TABLE (
  service_type VARCHAR,
  total_orders INTEGER,
  breached_orders INTEGER,
  compliance_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH order_stats AS (
    SELECT
      o.service_type,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE o.sla_breached = true) as breached
    FROM orders o
    WHERE o.created_at BETWEEN p_start_date AND p_end_date
      AND (p_service_type IS NULL OR o.service_type = p_service_type)
    GROUP BY o.service_type
  )
  SELECT
    os.service_type,
    os.total::INTEGER,
    os.breached::INTEGER,
    CASE
      WHEN os.total > 0 THEN ((os.total - os.breached)::DECIMAL / os.total * 100)
      ELSE 0
    END as compliance_rate
  FROM order_stats os;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_sla_compliance_rate IS 'Calculate SLA compliance rate by service type';

-- Function to get preventable breach rate
CREATE OR REPLACE FUNCTION get_preventable_breach_rate(
  p_start_date TIMESTAMP DEFAULT (CURRENT_TIMESTAMP - INTERVAL '30 days'),
  p_end_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
RETURNS TABLE (
  total_breaches INTEGER,
  preventable_breaches INTEGER,
  preventable_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_breaches,
    COUNT(*) FILTER (WHERE preventable = true)::INTEGER as preventable_breaches,
    CASE
      WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE preventable = true)::DECIMAL / COUNT(*) * 100)
      ELSE 0
    END as preventable_rate
  FROM sla_breaches
  WHERE created_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_preventable_breach_rate IS 'Calculate percentage of preventable SLA breaches';

-- ============================================
-- Add columns to existing orders table
-- ============================================

-- Add SLA tracking columns to orders table if not exists
DO $$
BEGIN
  -- Add reassignment_count column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='orders' AND column_name='reassignment_count') THEN
    ALTER TABLE orders ADD COLUMN reassignment_count INTEGER DEFAULT 0;
  END IF;

  -- Add last_reassignment_reason column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='orders' AND column_name='last_reassignment_reason') THEN
    ALTER TABLE orders ADD COLUMN last_reassignment_reason VARCHAR(100);
  END IF;

  -- Add sla_breached column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='orders' AND column_name='sla_breached') THEN
    ALTER TABLE orders ADD COLUMN sla_breached BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add priority column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='orders' AND column_name='priority') THEN
    ALTER TABLE orders ADD COLUMN priority INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================
-- Triggers
-- ============================================

-- Trigger to update sla_breached flag on orders
CREATE OR REPLACE FUNCTION update_order_sla_breach()
RETURNS TRIGGER AS $$
BEGIN
  -- Update orders table when breach is recorded
  UPDATE orders
  SET sla_breached = TRUE
  WHERE id = NEW.order_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_order_sla_breach ON sla_breaches;
CREATE TRIGGER trigger_update_order_sla_breach
  AFTER INSERT ON sla_breaches
  FOR EACH ROW
  EXECUTE FUNCTION update_order_sla_breach();

-- Trigger to increment reassignment count
CREATE OR REPLACE FUNCTION increment_reassignment_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment reassignment count on orders table
  UPDATE orders
  SET
    reassignment_count = COALESCE(reassignment_count, 0) + 1,
    last_reassignment_reason = NEW.reason
  WHERE id = NEW.order_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_reassignment_count ON reassignment_events;
CREATE TRIGGER trigger_increment_reassignment_count
  AFTER INSERT ON reassignment_events
  FOR EACH ROW
  EXECUTE FUNCTION increment_reassignment_count();

-- ============================================
-- Initial Data / Reference Data
-- ============================================

-- Insert reference data for testing (optional)
-- This can be removed in production

-- Sample escalation reasons
CREATE TABLE IF NOT EXISTS escalation_reasons (
  reason_code VARCHAR(50) PRIMARY KEY,
  description TEXT,
  default_level VARCHAR(20) CHECK (default_level IN ('LEVEL_1', 'LEVEL_2', 'LEVEL_3'))
);

INSERT INTO escalation_reasons (reason_code, description, default_level) VALUES
  ('NO_AVAILABLE_DRIVERS', 'No drivers available for reassignment', 'LEVEL_2'),
  ('MAX_REASSIGNMENT_ATTEMPTS', 'Maximum reassignment attempts reached', 'LEVEL_2'),
  ('SLA_CRITICAL_BREACH', 'SLA breach exceeds critical threshold', 'LEVEL_3'),
  ('DRIVER_CANCELLED', 'Driver cancelled order during delivery', 'LEVEL_1'),
  ('SYSTEM_ERROR', 'System error during order processing', 'LEVEL_2'),
  ('TRAFFIC_INCIDENT', 'Major traffic incident affecting delivery', 'LEVEL_1'),
  ('VEHICLE_BREAKDOWN', 'Driver vehicle breakdown', 'LEVEL_2'),
  ('CUSTOMER_EMERGENCY', 'Customer emergency requiring immediate attention', 'LEVEL_3')
ON CONFLICT (reason_code) DO NOTHING;

COMMENT ON TABLE escalation_reasons IS 'Reference table for escalation reason codes and default levels';

-- ============================================
-- Grants (adjust based on your user setup)
-- ============================================

-- Grant permissions to application user (replace 'app_user' with your actual user)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- ============================================
-- Migration Complete
-- ============================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 001_sla_tables.sql completed successfully';
  RAISE NOTICE 'Tables created: sla_breaches, reassignment_events, escalations, compensations, notification_log';
  RAISE NOTICE 'Views created: v_sla_breach_summary, v_reassignment_performance, v_active_escalations';
  RAISE NOTICE 'Functions created: calculate_sla_compliance_rate, get_preventable_breach_rate';
  RAISE NOTICE 'Triggers created: update_order_sla_breach, increment_reassignment_count';
END $$;
