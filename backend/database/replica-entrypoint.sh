#!/bin/bash
# PostgreSQL Read Replica Initialization Script
# This script sets up a PostgreSQL instance as a streaming replica

set -e

echo "============================================"
echo "PostgreSQL Read Replica Initialization"
echo "============================================"

# Configuration from environment variables
PRIMARY_HOST=${POSTGRES_PRIMARY_HOST:-postgres}
PRIMARY_PORT=${POSTGRES_PRIMARY_PORT:-5432}
REPLICATION_USER=${POSTGRES_REPLICATION_USER:-replicator}
REPLICATION_PASSWORD=${POSTGRES_REPLICATION_PASSWORD:-replicator_password}
DB_USER=${POSTGRES_USER:-barq_user}
DB_NAME=${POSTGRES_DB:-barq_logistics}
PGDATA=${PGDATA:-/var/lib/postgresql/data}

echo "Configuration:"
echo "  Primary Host: $PRIMARY_HOST:$PRIMARY_PORT"
echo "  Replication User: $REPLICATION_USER"
echo "  Database: $DB_NAME"
echo "  Data Directory: $PGDATA"

# Check if this is first initialization
if [ -f "$PGDATA/PG_VERSION" ]; then
    echo "Data directory already initialized. Skipping setup."
    exit 0
fi

echo "Initializing replica from primary..."

# Wait for primary to be ready
echo "Waiting for primary database to be ready..."
until PGPASSWORD=$REPLICATION_PASSWORD psql -h "$PRIMARY_HOST" -p "$PRIMARY_PORT" -U "$REPLICATION_USER" -c '\q' 2>/dev/null; do
    echo "  Primary is unavailable - sleeping"
    sleep 2
done
echo "✓ Primary database is ready"

# Stop PostgreSQL if running
if pg_ctl -D "$PGDATA" status > /dev/null 2>&1; then
    echo "Stopping PostgreSQL..."
    pg_ctl -D "$PGDATA" stop -m fast -w
fi

# Remove existing data directory contents
if [ -d "$PGDATA" ]; then
    echo "Cleaning data directory..."
    rm -rf "${PGDATA:?}"/*
fi

# Use pg_basebackup to create replica from primary
echo "Creating base backup from primary..."
PGPASSWORD=$REPLICATION_PASSWORD pg_basebackup \
    -h "$PRIMARY_HOST" \
    -p "$PRIMARY_PORT" \
    -U "$REPLICATION_USER" \
    -D "$PGDATA" \
    -Fp \
    -Xs \
    -P \
    -R \
    -v

if [ $? -ne 0 ]; then
    echo "❌ ERROR: pg_basebackup failed"
    exit 1
fi

echo "✓ Base backup completed successfully"

# Configure standby settings
echo "Configuring standby settings..."

# Create or update postgresql.conf with replica settings
cat >> "$PGDATA/postgresql.conf" <<EOF

# Replica-specific settings
hot_standby = on
max_standby_streaming_delay = 30s
wal_receiver_status_interval = 10s
hot_standby_feedback = on
max_connections = 100

# Logging
log_statement = 'all'
log_duration = on
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0
log_autovacuum_min_duration = 0
log_error_verbosity = default

# Performance tuning for read replica
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB
maintenance_work_mem = 128MB
EOF

# Update or create pg_hba.conf for replica access
cat > "$PGDATA/pg_hba.conf" <<EOF
# PostgreSQL Client Authentication Configuration File
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Local connections
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust

# Docker network connections
host    all             all             172.28.0.0/16           md5

# Replication connections
host    replication     replicator      172.28.0.0/16           md5
host    all             replicator      172.28.0.0/16           md5

# Allow all from Docker network
host    all             $DB_USER        172.28.0.0/16           md5
EOF

# Create standby.signal file (PostgreSQL 12+)
touch "$PGDATA/standby.signal"

# Set proper permissions
chmod 0700 "$PGDATA"
chown -R postgres:postgres "$PGDATA"

echo "✓ Replica configuration completed"

# Create health check script
cat > /usr/local/bin/replica-healthcheck.sh <<'HEALTHCHECK'
#!/bin/bash
# Check if PostgreSQL is in recovery mode (replica)
psql -U $POSTGRES_USER -d $POSTGRES_DB -tAc "SELECT pg_is_in_recovery();" | grep -q 't' && exit 0 || exit 1
HEALTHCHECK

chmod +x /usr/local/bin/replica-healthcheck.sh

echo "============================================"
echo "✓ Replica initialization completed!"
echo "============================================"
echo ""
echo "Replica is ready to start."
echo "It will connect to primary at: $PRIMARY_HOST:$PRIMARY_PORT"
echo ""
