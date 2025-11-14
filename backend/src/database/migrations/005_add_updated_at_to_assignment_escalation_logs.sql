-- Migration: Add missing updated_at column to assignment_logs and escalation_logs tables
-- Issue: These tables are missing updated_at columns defined in the original migration
-- This ensures schema consistency across all automation tables

-- ============================================
-- ASSIGNMENT_LOGS TABLE
-- ============================================

-- Add updated_at column to assignment_logs
ALTER TABLE assignment_logs
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Backfill updated_at with created_at for existing records
UPDATE assignment_logs
SET updated_at = created_at
WHERE updated_at IS NULL;

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_assignment_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_assignment_logs_updated_at_trigger ON assignment_logs;
CREATE TRIGGER update_assignment_logs_updated_at_trigger
  BEFORE UPDATE ON assignment_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_assignment_logs_updated_at();

-- ============================================
-- ESCALATION_LOGS TABLE
-- ============================================

-- Add updated_at column to escalation_logs
ALTER TABLE escalation_logs
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Backfill updated_at with created_at for existing records
UPDATE escalation_logs
SET updated_at = created_at
WHERE updated_at IS NULL;

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_escalation_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_escalation_logs_updated_at_trigger ON escalation_logs;
CREATE TRIGGER update_escalation_logs_updated_at_trigger
  BEFORE UPDATE ON escalation_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_escalation_logs_updated_at();

-- Migration complete
COMMENT ON COLUMN assignment_logs.updated_at IS 'Timestamp when the record was last updated';
COMMENT ON COLUMN escalation_logs.updated_at IS 'Timestamp when the record was last updated';
