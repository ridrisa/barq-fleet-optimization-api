-- Enable PostGIS extension for Cloud SQL PostgreSQL
-- This script enables PostGIS and its related extensions

-- Enable PostGIS core extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable PostGIS topology extension (optional but recommended)
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Verify installation
SELECT PostGIS_Version() as version;
