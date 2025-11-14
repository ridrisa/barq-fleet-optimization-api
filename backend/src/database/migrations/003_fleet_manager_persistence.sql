-- Fleet Manager Data Persistence Migration
-- Enables permanent storage of driver targets and performance history

-- Driver Targets Table
CREATE TABLE IF NOT EXISTS driver_targets (
    driver_id VARCHAR(100) PRIMARY KEY,
    target_deliveries INTEGER NOT NULL DEFAULT 0,
    target_revenue DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    current_deliveries INTEGER NOT NULL DEFAULT 0,
    current_revenue DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    -- Status: available, busy, break, offline
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups by status
CREATE INDEX IF NOT EXISTS idx_driver_targets_status ON driver_targets(status);
CREATE INDEX IF NOT EXISTS idx_driver_targets_updated_at ON driver_targets(updated_at);

-- Driver Performance History Table
CREATE TABLE IF NOT EXISTS driver_performance_history (
    id SERIAL PRIMARY KEY,
    driver_id VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    deliveries_completed INTEGER NOT NULL DEFAULT 0,
    revenue_generated DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    target_deliveries INTEGER NOT NULL DEFAULT 0,
    target_revenue DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    target_achieved BOOLEAN NOT NULL DEFAULT false,
    achievement_percentage DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(driver_id, date)
);

-- Indexes for performance queries
CREATE INDEX IF NOT EXISTS idx_performance_driver_date ON driver_performance_history(driver_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_performance_date ON driver_performance_history(date DESC);
CREATE INDEX IF NOT EXISTS idx_performance_achieved ON driver_performance_history(target_achieved);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_driver_targets_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp on driver_targets changes
DROP TRIGGER IF EXISTS trigger_update_driver_targets_timestamp ON driver_targets;
CREATE TRIGGER trigger_update_driver_targets_timestamp
    BEFORE UPDATE ON driver_targets
    FOR EACH ROW
    EXECUTE FUNCTION update_driver_targets_timestamp();

-- Function to calculate achievement percentage
CREATE OR REPLACE FUNCTION calculate_achievement_percentage(
    current_del INTEGER,
    target_del INTEGER,
    current_rev DECIMAL,
    target_rev DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
    IF target_del = 0 AND target_rev = 0 THEN
        RETURN 0;
    END IF;
    
    DECLARE
        del_pct DECIMAL := CASE WHEN target_del > 0 THEN (current_del::DECIMAL / target_del) * 100 ELSE 0 END;
        rev_pct DECIMAL := CASE WHEN target_rev > 0 THEN (current_rev / target_rev) * 100 ELSE 0 END;
    BEGIN
        RETURN (del_pct + rev_pct) / 2;
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comments for documentation
COMMENT ON TABLE driver_targets IS 'Stores current driver targets and progress tracking';
COMMENT ON TABLE driver_performance_history IS 'Historical record of daily driver performance against targets';
COMMENT ON COLUMN driver_targets.status IS 'Driver availability: available, busy, break, offline';
COMMENT ON COLUMN driver_performance_history.achievement_percentage IS 'Average of delivery and revenue achievement percentages';

-- Grant permissions (adjust role as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON driver_targets TO your_app_role;
-- GRANT SELECT, INSERT, UPDATE ON driver_performance_history TO your_app_role;
