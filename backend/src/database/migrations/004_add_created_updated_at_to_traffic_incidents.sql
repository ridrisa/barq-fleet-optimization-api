-- Migration: Add missing created_at and updated_at columns to traffic_incidents table
-- Issue: traffic_incidents table is missing created_at and updated_at columns
-- The original migration (002) defined these columns but they weren't created in the actual table

-- Add created_at column to traffic_incidents
ALTER TABLE traffic_incidents
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add updated_at column to traffic_incidents
ALTER TABLE traffic_incidents
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Backfill created_at with reported_at for existing records
UPDATE traffic_incidents
SET created_at = reported_at
WHERE created_at IS NULL;

-- Backfill updated_at with reported_at for existing records
UPDATE traffic_incidents
SET updated_at = reported_at
WHERE updated_at IS NULL;

-- Make created_at NOT NULL after backfilling
ALTER TABLE traffic_incidents
ALTER COLUMN created_at SET NOT NULL;

-- Create trigger for updating updated_at timestamp (if not exists)
CREATE OR REPLACE FUNCTION update_traffic_incidents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_traffic_incidents_updated_at_trigger ON traffic_incidents;
CREATE TRIGGER update_traffic_incidents_updated_at_trigger
  BEFORE UPDATE ON traffic_incidents
  FOR EACH ROW
  EXECUTE FUNCTION update_traffic_incidents_updated_at();

-- Add index on created_at for query performance
CREATE INDEX IF NOT EXISTS idx_traffic_incidents_created_at ON traffic_incidents(created_at DESC);

-- Migration complete
COMMENT ON COLUMN traffic_incidents.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN traffic_incidents.updated_at IS 'Timestamp when the record was last updated';
