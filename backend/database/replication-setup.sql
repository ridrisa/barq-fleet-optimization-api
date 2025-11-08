-- PostgreSQL Replication Setup Script
-- This script configures the primary database for streaming replication
-- It should be executed automatically during container initialization

-- Create replication user with appropriate permissions
DO $$
BEGIN
    -- Check if replication user exists
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'replicator') THEN
        CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'replicator_password';
        RAISE NOTICE 'Created replication user: replicator';
    ELSE
        RAISE NOTICE 'Replication user already exists: replicator';
    END IF;
END
$$;

-- Grant necessary permissions to replication user
GRANT CONNECT ON DATABASE barq_logistics TO replicator;

-- Create replication slots for each replica
-- Replication slots ensure WAL segments are retained until all replicas have received them
SELECT pg_create_physical_replication_slot('replica_1_slot')
WHERE NOT EXISTS (
    SELECT 1 FROM pg_replication_slots WHERE slot_name = 'replica_1_slot'
);

SELECT pg_create_physical_replication_slot('replica_2_slot')
WHERE NOT EXISTS (
    SELECT 1 FROM pg_replication_slots WHERE slot_name = 'replica_2_slot'
);

-- Configure pg_hba.conf entries for replication (commented - done via Docker)
-- host replication replicator 172.28.0.0/16 md5
-- host all replicator 172.28.0.0/16 md5

-- Create monitoring function for replication status
CREATE OR REPLACE FUNCTION get_replication_status()
RETURNS TABLE (
    slot_name TEXT,
    active BOOLEAN,
    client_addr INET,
    state TEXT,
    sync_state TEXT,
    write_lag INTERVAL,
    flush_lag INTERVAL,
    replay_lag INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        rs.slot_name::TEXT,
        rs.active,
        sa.client_addr,
        sa.state::TEXT,
        sa.sync_state::TEXT,
        sa.write_lag,
        sa.flush_lag,
        sa.replay_lag
    FROM pg_replication_slots rs
    LEFT JOIN pg_stat_replication sa ON rs.slot_name = sa.slot_name
    WHERE rs.slot_type = 'physical';
END;
$$ LANGUAGE plpgsql;

-- Create view for easy replication monitoring
CREATE OR REPLACE VIEW replication_status AS
SELECT * FROM get_replication_status();

-- Grant access to monitoring views
GRANT SELECT ON replication_status TO replicator;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✓ Replication setup completed successfully';
    RAISE NOTICE '  - Replication user created: replicator';
    RAISE NOTICE '  - Replication slots created: replica_1_slot, replica_2_slot';
    RAISE NOTICE '  - Monitoring functions created';
END
$$;
