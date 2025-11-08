# PostgreSQL Read Replicas Configuration Guide

## Overview

This guide explains how to set up and use PostgreSQL read replicas for the BARQ Fleet Management system. Read replicas provide:

- **High Availability**: Automatic failover to healthy replicas
- **Improved Performance**: Distribute read load across multiple servers
- **Scalability**: Handle more concurrent read operations
- **Reduced Latency**: Read from geographically closer replicas

---

## Architecture

```
                                    ┌──────────────────┐
                                    │   Application    │
                                    └────────┬─────────┘
                                             │
                         ┌───────────────────┴───────────────────┐
                         │                                       │
                    WRITE Queries                          READ Queries
                         │                                       │
                         ▼                                       ▼
                 ┌───────────────┐                    ┌─────────────────┐
                 │   PRIMARY DB  │───Streaming───────▶│   REPLICA 1     │
                 │   Port: 5432  │   Replication      │   Port: 5433    │
                 └───────────────┘                    └─────────────────┘
                         │                                       │
                         │                                       │
                         └────────Streaming───────────▶┌─────────────────┐
                                  Replication          │   REPLICA 2     │
                                                       │   Port: 5434    │
                                                       └─────────────────┘

                      ┌─────────────────────────────────────────────┐
                      │   Round-Robin Load Balancing for Reads     │
                      │   Automatic Failover to Primary if Needed  │
                      └─────────────────────────────────────────────┘
```

---

## Features

### 1. Automatic Read/Write Splitting
- **Write Operations** (INSERT, UPDATE, DELETE): Routed to primary database
- **Read Operations** (SELECT): Routed to healthy read replicas
- **Transactions**: Always executed on primary for consistency

### 2. Health Monitoring
- Continuous replication lag monitoring (default: every 30 seconds)
- Automatic replica health checks
- Configurable lag thresholds (default: 5 seconds)

### 3. Intelligent Load Balancing
- Round-robin distribution across healthy replicas
- Automatic failover to primary if all replicas are unhealthy
- Retry logic for failed replica queries

### 4. Connection Pooling
- Separate connection pools for primary and each replica
- Configurable pool sizes
- Idle connection management

---

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# ==========================================
# Database Read Replicas Configuration
# ==========================================

# Enable read replicas (set to 'true' to activate)
ENABLE_READ_REPLICAS=true

# Primary Database (existing settings)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=barq_logistics
POSTGRES_USER=barq_user
POSTGRES_PASSWORD=changeme

# Replication User Credentials
DB_REPLICATION_USER=replicator
DB_REPLICATION_PASSWORD=replicator_password

# Read Replica Hosts (comma-separated)
# If using docker-compose.replicas.yml, use service names
POSTGRES_REPLICA_HOSTS=postgres-replica-1,postgres-replica-2
POSTGRES_REPLICA_PORTS=5433,5434

# Connection Pool Settings
POSTGRES_POOL_MAX=20              # Primary pool max connections
POSTGRES_POOL_MIN=2               # Primary pool min connections
POSTGRES_REPLICA_POOL_MAX=10      # Per-replica pool max connections
POSTGRES_REPLICA_POOL_MIN=1       # Per-replica pool min connections

# Replication Monitoring
REPLICATION_CHECK_INTERVAL=30000  # Health check interval (ms)
REPLICATION_LAG_THRESHOLD=5       # Max acceptable lag (seconds)

# Connection Timeouts
POSTGRES_IDLE_TIMEOUT=30000       # Idle connection timeout (ms)
POSTGRES_CONNECTION_TIMEOUT=10000 # Connection attempt timeout (ms)

# SSL Configuration (if needed)
POSTGRES_SSL=false
```

---

## Docker Deployment

### Quick Start

1. **Using Docker Compose with Replicas**:

```bash
# Start with read replicas
docker-compose -f docker-compose.yml -f docker-compose.replicas.yml up -d

# Check services status
docker-compose -f docker-compose.yml -f docker-compose.replicas.yml ps

# View replication status
docker-compose -f docker-compose.yml -f docker-compose.replicas.yml logs replication-monitor

# Stop all services
docker-compose -f docker-compose.yml -f docker-compose.replicas.yml down
```

2. **Verify Replication**:

```bash
# Check primary replication status
docker exec -it barq-postgres psql -U barq_user -d barq_logistics -c "SELECT * FROM replication_status;"

# Check replica 1 is in recovery mode
docker exec -it barq-postgres-replica-1 psql -U barq_user -d barq_logistics -c "SELECT pg_is_in_recovery();"

# Check replica 2 is in recovery mode
docker exec -it barq-postgres-replica-2 psql -U barq_user -d barq_logistics -c "SELECT pg_is_in_recovery();"

# Check replication lag on replica 1
docker exec -it barq-postgres-replica-1 psql -U barq_user -d barq_logistics -c "SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::int as lag_seconds;"
```

---

## Application Usage

### Option 1: Use Replicated Service (Recommended)

Update your application code to use the replicated service:

```javascript
// backend/src/app.js or your initialization file

// OLD:
// const db = require('./services/postgres.service');

// NEW:
const db = require('./services/postgres-replicated.service');

// Initialize database with replicas
await db.initialize();

// Queries are automatically routed
const results = await db.query('SELECT * FROM orders'); // → Replica
await db.query('INSERT INTO orders VALUES (...)'); // → Primary
await db.query('UPDATE orders SET status = $1', ['delivered']); // → Primary

// Force a specific pool
const result = await db.query('SELECT * FROM orders', [], { forceWrite: true }); // → Primary

// Transactions always use primary
await db.transaction(async (client) => {
  await client.query('INSERT INTO orders ...');
  await client.query('UPDATE inventory ...');
});
```

### Option 2: Gradual Migration

Keep both services and switch gradually:

```javascript
const dbPrimary = require('./services/postgres.service');
const dbReplicated = require('./services/postgres-replicated.service');

// Use replicated for new features
// Use primary for existing features (gradual migration)
```

---

## Health Check Endpoint

Add a health check endpoint to monitor replica status:

```javascript
// backend/src/routes/health.routes.js

router.get('/health/database', async (req, res) => {
  try {
    const health = await db.healthCheck();

    res.json({
      success: true,
      database: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/health/database/stats', async (req, res) => {
  try {
    const stats = db.getPoolStats();

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

**Example Health Response**:

```json
{
  "success": true,
  "database": {
    "status": "healthy",
    "primary": {
      "status": "healthy",
      "name": "PRIMARY",
      "connected": true,
      "responseTime": 5,
      "poolSize": 3,
      "idleConnections": 2,
      "waitingClients": 0
    },
    "replicas": [
      {
        "status": "healthy",
        "name": "REPLICA 1",
        "connected": true,
        "responseTime": 4,
        "poolSize": 2,
        "idleConnections": 1
      },
      {
        "status": "healthy",
        "name": "REPLICA 2",
        "connected": true,
        "responseTime": 6,
        "poolSize": 2,
        "idleConnections": 1
      }
    ],
    "replicaSummary": {
      "total": 2,
      "healthy": 2,
      "unhealthy": 0
    },
    "stats": {
      "primaryQueries": 1250,
      "replicaQueries": 8934,
      "failedReplicaQueries": 12,
      "fallbackToPrimary": 8
    }
  }
}
```

---

## Monitoring & Troubleshooting

### 1. Check Replication Lag

```bash
# View replication monitor logs
docker-compose logs -f replication-monitor

# Query replication status from primary
docker exec -it barq-postgres psql -U barq_user -d barq_logistics -c \
  "SELECT slot_name, active, restart_lsn FROM pg_replication_slots;"
```

### 2. Check Application Stats

```bash
# Via health endpoint
curl http://localhost:3003/api/v1/health/database/stats

# Sample output:
{
  "primary": {
    "total": 5,
    "idle": 3,
    "waiting": 0
  },
  "replicas": [
    {
      "id": 1,
      "healthy": true,
      "lag": 250,
      "total": 3,
      "idle": 2,
      "waiting": 0
    },
    {
      "id": 2,
      "healthy": true,
      "lag": 180,
      "total": 3,
      "idle": 2,
      "waiting": 0
    }
  ],
  "queryStats": {
    "primaryQueries": 1250,
    "replicaQueries": 8934,
    "failedReplicaQueries": 12,
    "fallbackToPrimary": 8
  }
}
```

### 3. Common Issues

#### Issue: Replica not connecting to primary

**Symptoms**: Replica container keeps restarting

**Solution**:
```bash
# Check primary logs
docker-compose logs postgres | grep replication

# Verify pg_hba.conf allows replication connections
docker exec -it barq-postgres cat /var/lib/postgresql/data/pg_hba.conf

# Verify replication user exists
docker exec -it barq-postgres psql -U barq_user -d barq_logistics -c \
  "SELECT rolname FROM pg_roles WHERE rolname = 'replicator';"
```

#### Issue: High replication lag

**Symptoms**: `⚠️ WARNING: Replica lag exceeds threshold` in logs

**Possible Causes**:
- High write load on primary
- Network latency between primary and replica
- Replica hardware/resource constraints

**Solutions**:
```bash
# 1. Check disk I/O
docker stats

# 2. Increase lag threshold (temporary fix)
# In .env:
REPLICATION_LAG_THRESHOLD=10

# 3. Scale replica resources
# In docker-compose.replicas.yml, add resource limits:
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 4G
```

#### Issue: Replica queries failing

**Symptoms**: High `failedReplicaQueries` count

**Solution**:
```bash
# Check replica health
docker exec -it barq-postgres-replica-1 pg_isready

# Check replica logs for errors
docker-compose logs postgres-replica-1 | tail -50

# Verify replica is in recovery mode
docker exec -it barq-postgres-replica-1 psql -U barq_user -d barq_logistics -c \
  "SELECT pg_is_in_recovery();" # Should return 't'
```

---

## Performance Tuning

### 1. Optimize Connection Pools

```bash
# For high-traffic applications
POSTGRES_POOL_MAX=50              # Increase primary pool
POSTGRES_REPLICA_POOL_MAX=30      # Increase replica pools
```

### 2. Adjust Replication Settings

For faster replication (in `docker-compose.replicas.yml`):

```yaml
postgres:
  command: >
    postgres
    -c wal_level=replica
    -c max_wal_senders=10
    -c max_replication_slots=10
    -c wal_keep_size=1GB           # Add this (PostgreSQL 13+)
    -c synchronous_commit=local    # Add for async replication
```

### 3. Add More Replicas

To add a third replica:

1. Add to `docker-compose.replicas.yml`:

```yaml
postgres-replica-3:
  image: postgres:15-alpine
  container_name: barq-postgres-replica-3
  environment:
    # Same as replica-1 and replica-2
    POSTGRES_PRIMARY_HOST: postgres
    # ...
  ports:
    - "5435:5432"
  volumes:
    - postgres-replica-3-data:/var/lib/postgresql/data
    - ./backend/database/replica-entrypoint.sh:/docker-entrypoint-initdb.d/replica-entrypoint.sh:ro
  # ... rest of config

volumes:
  postgres-replica-3-data:
    driver: local
```

2. Update `.env`:

```bash
POSTGRES_REPLICA_HOSTS=postgres-replica-1,postgres-replica-2,postgres-replica-3
POSTGRES_REPLICA_PORTS=5433,5434,5435
```

3. Create replication slot on primary:

```bash
docker exec -it barq-postgres psql -U barq_user -d barq_logistics -c \
  "SELECT pg_create_physical_replication_slot('replica_3_slot');"
```

---

## Backup & Recovery

### Backup Primary Database

```bash
# Create backup from primary
docker exec -t barq-postgres pg_dumpall -c -U barq_user > dump_`date +%Y-%m-%d"_"%H_%M_%S`.sql

# Or use pg_basebackup for physical backup
docker exec -t barq-postgres pg_basebackup -U replicator -D /backups/backup_$(date +%Y%m%d) -Ft -z -Xs -P
```

### Restore from Backup

```bash
# Stop services
docker-compose -f docker-compose.yml -f docker-compose.replicas.yml down

# Restore primary
cat backup.sql | docker exec -i barq-postgres psql -U barq_user

# Rebuild replicas (they will sync from primary)
docker-compose -f docker-compose.yml -f docker-compose.replicas.yml up -d postgres-replica-1 postgres-replica-2
```

---

## Testing

### Load Testing with Replicas

```bash
# Run k6 load test with replicas enabled
ENABLE_READ_REPLICAS=true k6 run load-testing/k6-load-test.js

# Compare performance:
# Without replicas: p(95) response time
# With replicas: p(95) response time (should be lower)
```

### Functional Testing

Create a test script to verify read/write splitting:

```javascript
// test-replicas.js
const db = require('./backend/src/services/postgres-replicated.service');

async function test() {
  await db.initialize();

  console.log('Testing write operation...');
  await db.query('INSERT INTO test_table VALUES (1, \'test\')');
  console.log('✓ Write successful (routed to PRIMARY)');

  console.log('\nTesting read operation...');
  const result = await db.query('SELECT * FROM test_table LIMIT 1');
  console.log('✓ Read successful (routed to REPLICA)');
  console.log(`  Rows returned: ${result.rows.length}`);

  console.log('\nCurrent stats:');
  const stats = db.getPoolStats();
  console.log(JSON.stringify(stats, null, 2));

  await db.close();
}

test().catch(console.error);
```

```bash
# Run test
node test-replicas.js
```

---

## Migration Checklist

- [ ] Add replication environment variables to `.env`
- [ ] Make `replica-entrypoint.sh` executable: `chmod +x backend/database/replica-entrypoint.sh`
- [ ] Start services with replicas: `docker-compose -f docker-compose.yml -f docker-compose.replicas.yml up -d`
- [ ] Verify replication status: Check logs and run SQL queries
- [ ] Update application code to use `postgres-replicated.service.js`
- [ ] Test read/write operations
- [ ] Add health check endpoints
- [ ] Monitor replication lag
- [ ] Update deployment documentation
- [ ] Configure alerting for replication issues
- [ ] Update backup procedures

---

## Best Practices

1. **Monitor Replication Lag**: Set up alerts when lag exceeds 5 seconds
2. **Test Failover**: Regularly test that application handles replica failures gracefully
3. **Separate Workloads**: Use replicas for reporting/analytics queries
4. **Keep Replicas Close**: Minimize network latency between primary and replicas
5. **Size Appropriately**: Replicas should have similar resources to primary for consistency
6. **Use Read-Only Users**: Create read-only database users for replica access
7. **Document Topology**: Maintain clear documentation of your replication setup

---

## References

- [PostgreSQL Replication Documentation](https://www.postgresql.org/docs/current/replication.html)
- [pg_basebackup Documentation](https://www.postgresql.org/docs/current/app-pgbasebackup.html)
- [PostgreSQL Streaming Replication](https://www.postgresql.org/docs/current/warm-standby.html#STREAMING-REPLICATION)
- [node-postgres Documentation](https://node-postgres.com/)

---

**Last Updated**: 2025-01-07
**Version**: 1.0.0
**Maintained By**: BARQ Engineering Team
