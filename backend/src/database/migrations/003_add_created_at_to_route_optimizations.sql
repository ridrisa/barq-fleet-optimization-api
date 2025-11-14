-- Migration: Add missing created_at column to route_optimizations table
-- Issue: Dashboard endpoint fails because route_optimizations table is missing created_at
-- The original migration (002) defined this column but it wasn't created in the actual table

-- Add created_at column to route_optimizations
ALTER TABLE route_optimizations
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add updated_at column for consistency with other automation tables
ALTER TABLE route_optimizations
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Backfill created_at with optimized_at for existing records
UPDATE route_optimizations
SET created_at = optimized_at
WHERE created_at IS NULL;

-- Backfill updated_at with optimized_at for existing records
UPDATE route_optimizations
SET updated_at = optimized_at
WHERE updated_at IS NULL;

-- Make created_at NOT NULL after backfilling
ALTER TABLE route_optimizations
ALTER COLUMN created_at SET NOT NULL;

-- Create trigger for updating updated_at timestamp (if not exists)
CREATE OR REPLACE FUNCTION update_route_optimizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_route_optimizations_updated_at_trigger ON route_optimizations;
CREATE TRIGGER update_route_optimizations_updated_at_trigger
  BEFORE UPDATE ON route_optimizations
  FOR EACH ROW
  EXECUTE FUNCTION update_route_optimizations_updated_at();

-- Add index on created_at for query performance
CREATE INDEX IF NOT EXISTS idx_route_optimizations_created_at ON route_optimizations(created_at DESC);

-- Migration complete
COMMENT ON COLUMN route_optimizations.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN route_optimizations.updated_at IS 'Timestamp when the record was last updated';
