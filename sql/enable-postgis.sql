-- Enable PostGIS extension for Cloud SQL PostgreSQL
-- This needs to be run as a superuser

-- Enable PostGIS core extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable PostGIS topology extension (optional but recommended)
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Enable PostGIS raster extension (optional)
CREATE EXTENSION IF NOT EXISTS postgis_raster;

-- Verify installation
SELECT PostGIS_Version();

-- Grant usage to public schema
GRANT USAGE ON SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Display installed extensions
SELECT * FROM pg_extension WHERE extname LIKE 'postgis%';
