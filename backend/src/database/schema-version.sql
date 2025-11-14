-- ============================================
-- SCHEMA VERSION MANAGEMENT SYSTEM
-- ============================================
-- This file sets up the infrastructure for tracking schema versions
-- and migrations. It should be the FIRST thing run on a new database.

-- Enable UUID extension (idempotent)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SCHEMA VERSION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS schema_version (
  id SERIAL PRIMARY KEY,
  version INTEGER NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Tracking
  installed_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  installed_by VARCHAR(100) DEFAULT CURRENT_USER,
  execution_time_ms INTEGER,

  -- Status
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  -- Checksums for verification
  schema_checksum VARCHAR(64),

  CONSTRAINT version_positive CHECK (version >= 0)
);

-- Index for quick version lookup
CREATE INDEX IF NOT EXISTS idx_schema_version_version
  ON schema_version(version DESC);

-- Index for installation tracking
CREATE INDEX IF NOT EXISTS idx_schema_version_installed
  ON schema_version(installed_on DESC);

-- ============================================
-- MIGRATION TRACKING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  version INTEGER NOT NULL,

  -- Migration file details
  file_path VARCHAR(500),
  file_checksum VARCHAR(64),

  -- Execution tracking
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  applied_by VARCHAR(100) DEFAULT CURRENT_USER,
  execution_time_ms INTEGER,

  -- Status
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  rollback_sql TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT migration_version_positive CHECK (version >= 0)
);

-- Index for migration lookup
CREATE INDEX IF NOT EXISTS idx_schema_migrations_name
  ON schema_migrations(migration_name);

-- Index for version tracking
CREATE INDEX IF NOT EXISTS idx_schema_migrations_version
  ON schema_migrations(version DESC);

-- Index for status tracking
CREATE INDEX IF NOT EXISTS idx_schema_migrations_status
  ON schema_migrations(success, applied_at DESC);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get current schema version
CREATE OR REPLACE FUNCTION get_schema_version()
RETURNS INTEGER AS $$
DECLARE
  current_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version), 0)
  INTO current_version
  FROM schema_version
  WHERE success = true;

  RETURN current_version;
END;
$$ LANGUAGE plpgsql;

-- Function to check if migration was applied
CREATE OR REPLACE FUNCTION is_migration_applied(migration_name VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  applied BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM schema_migrations
    WHERE migration_name = $1
    AND success = true
  ) INTO applied;

  RETURN applied;
END;
$$ LANGUAGE plpgsql;

-- Function to record schema version
CREATE OR REPLACE FUNCTION record_schema_version(
  p_version INTEGER,
  p_name VARCHAR,
  p_description TEXT DEFAULT NULL,
  p_execution_time_ms INTEGER DEFAULT NULL,
  p_checksum VARCHAR DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO schema_version (
    version,
    name,
    description,
    execution_time_ms,
    schema_checksum,
    success
  ) VALUES (
    p_version,
    p_name,
    p_description,
    p_execution_time_ms,
    p_checksum,
    true
  )
  ON CONFLICT (version) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    execution_time_ms = EXCLUDED.execution_time_ms,
    schema_checksum = EXCLUDED.schema_checksum,
    installed_on = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to record migration
CREATE OR REPLACE FUNCTION record_migration(
  p_migration_name VARCHAR,
  p_version INTEGER,
  p_file_path VARCHAR DEFAULT NULL,
  p_execution_time_ms INTEGER DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
  INSERT INTO schema_migrations (
    migration_name,
    version,
    file_path,
    execution_time_ms,
    success,
    error_message,
    metadata
  ) VALUES (
    p_migration_name,
    p_version,
    p_file_path,
    p_execution_time_ms,
    p_success,
    p_error_message,
    p_metadata
  )
  ON CONFLICT (migration_name) DO UPDATE
  SET
    applied_at = CURRENT_TIMESTAMP,
    execution_time_ms = EXCLUDED.execution_time_ms,
    success = EXCLUDED.success,
    error_message = EXCLUDED.error_message,
    metadata = EXCLUDED.metadata;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS FOR MONITORING
-- ============================================

-- View: Schema version history
CREATE OR REPLACE VIEW schema_version_history AS
SELECT
  version,
  name,
  description,
  installed_on,
  installed_by,
  execution_time_ms,
  success,
  CASE
    WHEN success THEN 'Success'
    ELSE 'Failed: ' || COALESCE(error_message, 'Unknown error')
  END as status
FROM schema_version
ORDER BY version DESC;

-- View: Migration history
CREATE OR REPLACE VIEW migration_history AS
SELECT
  migration_name,
  version,
  applied_at,
  applied_by,
  execution_time_ms,
  success,
  CASE
    WHEN success THEN 'Applied'
    ELSE 'Failed: ' || COALESCE(error_message, 'Unknown error')
  END as status
FROM schema_migrations
ORDER BY applied_at DESC;

-- View: Pending migrations (if any)
CREATE OR REPLACE VIEW database_info AS
SELECT
  get_schema_version() as current_version,
  (SELECT COUNT(*) FROM schema_migrations WHERE success = true) as applied_migrations,
  (SELECT COUNT(*) FROM schema_migrations WHERE success = false) as failed_migrations,
  current_database() as database_name,
  current_user as current_db_user,
  NOW() as current_timestamp;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE schema_version IS 'Tracks major schema versions';
COMMENT ON TABLE schema_migrations IS 'Tracks individual migration files';
COMMENT ON FUNCTION get_schema_version() IS 'Returns the current schema version number';
COMMENT ON FUNCTION is_migration_applied(VARCHAR) IS 'Checks if a specific migration has been applied';
COMMENT ON FUNCTION record_schema_version IS 'Records a new schema version';
COMMENT ON FUNCTION record_migration IS 'Records a migration execution';

-- ============================================
-- INITIAL BOOTSTRAP
-- ============================================

-- Record that the versioning system itself is installed
INSERT INTO schema_version (version, name, description, success)
VALUES (0, 'schema-version-system', 'Schema versioning and migration tracking system', true)
ON CONFLICT (version) DO NOTHING;

-- Grant permissions
GRANT SELECT ON schema_version TO PUBLIC;
GRANT SELECT ON schema_migrations TO PUBLIC;
GRANT SELECT ON schema_version_history TO PUBLIC;
GRANT SELECT ON migration_history TO PUBLIC;
GRANT SELECT ON database_info TO PUBLIC;
