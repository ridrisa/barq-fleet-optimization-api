# Performance Optimization Guide

## Overview

This comprehensive guide covers all aspects of optimizing the BARQ Fleet Management system for maximum performance, scalability, and cost-efficiency.

---

## 📊 Performance Targets

### Response Time Targets
- **P50 (Median)**: < 200ms
- **P95**: < 500ms
- **P99**: < 1000ms
- **P99.9**: < 3000ms

### Throughput Targets
- **Peak**: 1000 req/sec
- **Sustained**: 500 req/sec
- **CVRP Optimizations**: 50 concurrent optimizations

### Availability Targets
- **Uptime**: 99.9% (SLA)
- **RTO (Recovery Time Objective)**: < 15 minutes
- **RPO (Recovery Point Objective)**: < 5 minutes

---

## 🗄️ Database Optimization

### 1. Indexing Strategy

#### Existing Indexes (Review Required)
```sql
-- Check current indexes
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

#### Recommended Indexes

```sql
-- Orders table - frequently queried fields
CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id);
CREATE INDEX CONCURRENTLY idx_orders_status ON orders(status);
CREATE INDEX CONCURRENTLY idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX CONCURRENTLY idx_orders_status_created ON orders(status, created_at DESC);

-- Optimization requests
CREATE INDEX CONCURRENTLY idx_opt_req_status ON optimization_requests(status);
CREATE INDEX CONCURRENTLY idx_opt_req_timestamp ON optimization_requests(timestamp DESC);

-- Agent activities
CREATE INDEX CONCURRENTLY idx_agent_act_agent_name ON agent_activities(agent_name);
CREATE INDEX CONCURRENTLY idx_agent_act_created ON agent_activities(created_at DESC);

-- Composite index for common query pattern
CREATE INDEX CONCURRENTLY idx_orders_user_status_date ON orders(user_id, status, created_at DESC);

-- Partial index for active orders only
CREATE INDEX CONCURRENTLY idx_orders_active ON orders(id, user_id, status)
WHERE status NOT IN ('DELIVERED', 'CANCELLED');

-- GIN index for JSONB columns
CREATE INDEX CONCURRENTLY idx_orders_metadata ON orders USING GIN (metadata);
```

#### Index Maintenance

```sql
-- Reindex to rebuild indexes
REINDEX INDEX CONCURRENTLY idx_orders_user_id;

-- Analyze tables to update statistics
ANALYZE orders;
ANALYZE optimization_requests;

-- Auto-vacuum configuration
ALTER TABLE orders SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE orders SET (autovacuum_analyze_scale_factor = 0.02);
```

### 2. Query Optimization

#### Slow Query Identification

```sql
-- Enable slow query logging
ALTER DATABASE barq_logistics SET log_min_duration_statement = 1000; -- 1 second

-- Find slow queries
SELECT
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;
```

#### Query Optimization Techniques

**BEFORE** (Bad):
```sql
-- Inefficient: No index, full table scan
SELECT * FROM orders WHERE customer_name LIKE '%Smith%';

-- N+1 query problem
orders.forEach(order => {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [order.user_id]);
});
```

**AFTER** (Optimized):
```sql
-- Use full-text search with GIN index
CREATE INDEX idx_orders_customer_name_fts ON orders USING GIN (to_tsvector('english', customer_name));

SELECT * FROM orders WHERE to_tsvector('english', customer_name) @@ to_tsquery('Smith');

-- Use JOIN instead of N+1 queries
SELECT orders.*, users.* FROM orders
JOIN users ON orders.user_id = users.id
WHERE orders.status = 'PENDING';
```

###3. Connection Pooling

```javascript
// backend/src/config/db.config.js

const poolConfig = {
  // Connection pool limits
  max: 20,                    // Maximum connections
  min: 2,                     // Minimum connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Connection attempt timeout

  // Statement timeout
  statement_timeout: 30000,   // Kill queries after 30s

  // Application name for tracking
  application_name: 'barq-backend',
};
```

### 4. Read Replicas

```javascript
// Use read replicas for SELECT queries
const dbReplicated = require('./services/postgres-replicated.service');

// Reads go to replicas (auto-routed)
const orders = await dbReplicated.query('SELECT * FROM orders WHERE user_id = $1', [userId]);

// Writes go to primary (auto-routed)
await dbReplicated.query('INSERT INTO orders VALUES (...)', values);
```

### 5. Database Caching

```sql
-- Increase shared_buffers (25% of RAM)
ALTER SYSTEM SET shared_buffers = '2GB';

-- Increase effective_cache_size (50-75% of RAM)
ALTER SYSTEM SET effective_cache_size = '6GB';

-- Increase work_mem for sorting/grouping
ALTER SYSTEM SET work_mem = '16MB';

-- Reload configuration
SELECT pg_reload_conf();
```

---

## 🚀 Application-Level Caching

### 1. Redis Caching Strategy

```javascript
// backend/src/services/cache.service.js

class CacheService {
  constructor() {
    this.redis = require('redis').createClient({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
    });

    // Cache TTLs
    this.ttl = {
      short: 60,        // 1 minute
      medium: 300,      // 5 minutes
      long: 3600,       // 1 hour
      veryLong: 86400,  // 24 hours
    };
  }

  // Cache-aside pattern
  async getOrSet(key, fetchFunction, ttl = this.ttl.medium) {
    // Try to get from cache
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    // Cache miss - fetch data
    const data = await fetchFunction();

    // Store in cache
    await this.redis.setex(key, ttl, JSON.stringify(data));

    return data;
  }

  // Invalidate cache
  async invalidate(pattern) {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### 2. Caching Use Cases

```javascript
// Cache frequently accessed data
async getOptimizationRequest(requestId) {
  return cache.getOrSet(
    `opt_request:${requestId}`,
    () => postgres.getOptimizationRequest(requestId),
    cache.ttl.long
  );
}

// Cache CVRP results for identical requests
async optimizeCVRP(request) {
  const cacheKey = `cvrp:${hash(request)}`;

  return cache.getOrSet(
    cacheKey,
    () => cvrpClient.optimize(request),
    cache.ttl.medium
  );
}

// Cache agent status
async getAgentStatus() {
  return cache.getOrSet(
    'agent:status:all',
    () => agentManager.getAllAgentStatus(),
    cache.ttl.short
  );
}
```

### 3. Cache Invalidation

```javascript
// Invalidate on updates
async updateOrder(orderId, updates) {
  await postgres.query('UPDATE orders SET ... WHERE id = $1', [orderId]);

  // Invalidate related caches
  await cache.invalidate(`order:${orderId}:*`);
  await cache.invalidate(`user:${updates.userId}:orders:*`);
}
```

---

## 🔄 API Optimization

### 1. Response Compression

```javascript
// backend/src/app.js
const compression = require('compression');

app.use(compression({
  level: 6,           // Compression level (0-9)
  threshold: 1024,    // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));
```

### 2. Response Pagination

```javascript
// Paginate large result sets
async getAllOrders(req, res) {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100
  const offset = (page - 1) * limit;

  const orders = await postgres.query(
    'SELECT * FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );

  const total = await postgres.query('SELECT COUNT(*) FROM orders');

  res.json({
    success: true,
    data: orders.rows,
    pagination: {
      page,
      limit,
      total: parseInt(total.rows[0].count),
      pages: Math.ceil(total.rows[0].count / limit)
    }
  });
}
```

### 3. Field Selection

```javascript
// Allow clients to select specific fields
async getOrder(req, res) {
  const fields = req.query.fields ? req.query.fields.split(',') : ['*'];
  const safeFields = fields.filter(f => ['id', 'user_id', 'status', 'created_at'].includes(f));

  const order = await postgres.query(
    `SELECT ${safeFields.join(', ')} FROM orders WHERE id = $1`,
    [req.params.id]
  );

  res.json(order.rows[0]);
}
```

### 4. Conditional Requests (ETags)

```javascript
// Use ETags for caching
app.use((req, res, next) => {
  const etag = require('etag');

  const originalSend = res.send;
  res.send = function(body) {
    if (req.method === 'GET' && res.statusCode === 200) {
      const etagValue = etag(body);
      res.set('ETag', etagValue);

      if (req.headers['if-none-match'] === etagValue) {
        return res.status(304).end();
      }
    }

    originalSend.call(this, body);
  };

  next();
});
```

---

## ⚡ CVRP Optimization Performance

### 1. Request Batching

```javascript
// Batch multiple optimization requests
class CVRPBatchProcessor {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.batchSize = 5;
    this.batchInterval = 1000; // 1 second
  }

  async addRequest(request) {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });

      if (!this.processing) {
        setTimeout(() => this.processBatch(), this.batchInterval);
        this.processing = true;
      }
    });
  }

  async processBatch() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    const batch = this.queue.splice(0, this.batchSize);

    // Process all requests in parallel
    const results = await Promise.allSettled(
      batch.map(item => cvrpClient.optimize(item.request))
    );

    // Resolve/reject promises
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        batch[index].resolve(result.value);
      } else {
        batch[index].reject(result.reason);
      }
    });

    // Process next batch
    if (this.queue.length > 0) {
      setTimeout(() => this.processBatch(), 0);
    } else {
      this.processing = false;
    }
  }
}
```

### 2. Result Caching

```javascript
// Cache identical optimization requests
const crypto = require('crypto');

function hashRequest(request) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(request))
    .digest('hex');
}

async function optimizeWithCache(request) {
  const cacheKey = `cvrp:result:${hashRequest(request)}`;

  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Compute optimization
  const result = await cvrpClient.optimize(request);

  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(result));

  return result;
}
```

### 3. Time Limit Tuning

```python
# backend/optimization-service/app.py

# Adaptive time limits based on problem size
def calculate_time_limit(num_locations, num_vehicles):
    if num_locations < 10:
        return 5  # seconds
    elif num_locations < 20:
        return 10
    elif num_locations < 50:
        return 20
    else:
        return 30  # Maximum

time_limit = calculate_time_limit(len(locations), len(vehicles))
```

---

## 🎯 Load Balancing & Scaling

### 1. CVRP Cluster Optimization

```nginx
# nginx.conf - Optimized load balancing

upstream cvrp_cluster {
    least_conn;  # Route to server with fewest connections

    server cvrp-optimizer-1:5001 weight=2 max_fails=2 fail_timeout=30s;
    server cvrp-optimizer-2:5001 weight=2 max_fails=2 fail_timeout=30s;
    server cvrp-optimizer-3:5001 weight=1 max_fails=2 fail_timeout=30s;

    keepalive 32;  # Keep connections alive
    keepalive_timeout 60s;
    keepalive_requests 100;
}
```

### 2. Auto-Scaling Configuration

```yaml
# Cloud Run auto-scaling
minInstances: 2      # Always-on instances
maxInstances: 20     # Scale up to
concurrency: 80      # Requests per instance

# CPU-based scaling
cpuUtilization:
  targetUtilization: 0.70  # Scale at 70% CPU

# Request-based scaling
requestUtilization:
  targetRequestUtilization: 60  # Scale at 60 concurrent requests
```

---

## 📈 Performance Monitoring

### 1. Key Metrics to Track

```javascript
// Application Performance Metrics
const metrics = {
  // Response times
  'http.request.duration': histogram(),
  'http.request.size': histogram(),
  'http.response.size': histogram(),

  // Database
  'db.query.duration': histogram(),
  'db.connection.pool.size': gauge(),
  'db.connection.pool.idle': gauge(),

  // CVRP
  'cvrp.optimization.duration': histogram(),
  'cvrp.optimization.success': counter(),
  'cvrp.optimization.failure': counter(),

  // Cache
  'cache.hit': counter(),
  'cache.miss': counter(),
  'cache.hit_rate': gauge(),

  // Business
  'orders.total': counter(),
  'orders.success': counter(),
  'sla.compliance_rate': gauge(),
};
```

### 2. Performance Testing

```bash
# Run load test
k6 run load-testing/k6-load-test.js

# Profile backend
npm run profile

# Analyze slow queries
npm run analyze-queries

# Database performance report
npm run db-performance-report
```

---

## 🔧 System Tuning

### 1. Node.js Optimization

```javascript
// backend/src/server.js

// Increase memory limit
NODE_OPTIONS=--max-old-space-size=4096

// Enable production optimizations
NODE_ENV=production

// Cluster mode for multi-core utilization
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  startServer();
}
```

### 2. Docker Optimization

```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Use non-root user
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s \
  CMD node healthcheck.js

CMD ["node", "src/server.js"]
```

---

## ✅ Performance Optimization Checklist

### Database
- [ ] All frequently queried columns indexed
- [ ] Composite indexes for multi-column queries
- [ ] Partial indexes for filtered queries
- [ ] GIN indexes for JSONB columns
- [ ] Regular ANALYZE and VACUUM
- [ ] Connection pooling configured (max: 20, min: 2)
- [ ] Read replicas enabled for production
- [ ] Query timeout configured (30s)
- [ ] Slow query logging enabled (> 1s)

### Caching
- [ ] Redis configured and connected
- [ ] Cache-aside pattern implemented
- [ ] Appropriate TTLs set (1m - 24h)
- [ ] Cache invalidation strategy
- [ ] Cache hit rate monitored (target: > 80%)
- [ ] Cache size limits configured

### API
- [ ] Response compression enabled
- [ ] Pagination for large result sets
- [ ] Field selection supported
- [ ] ETags for conditional requests
- [ ] Rate limiting per user/IP
- [ ] CORS properly configured

### CVRP
- [ ] Request batching implemented
- [ ] Result caching enabled
- [ ] Adaptive time limits
- [ ] Cluster with 3+ instances
- [ ] Load balancer configured
- [ ] Circuit breaker enabled

### Monitoring
- [ ] Response time metrics tracked
- [ ] Error rate monitored
- [ ] Database query performance tracked
- [ ] Cache hit rate monitored
- [ ] Business metrics tracked
- [ ] Alerts configured for SLAs

### Infrastructure
- [ ] Auto-scaling configured
- [ ] Min instances set for production
- [ ] Resource limits defined
- [ ] Health checks configured
- [ ] Load balancer optimized
- [ ] CDN enabled for static assets

---

## 📚 Tools & Commands

```bash
# Performance testing
npm run test:performance
k6 run load-testing/k6-load-test.js

# Database analysis
npm run db:analyze
npm run db:slow-queries
npm run db:index-usage

# Cache analysis
npm run cache:stats
npm run cache:hit-rate

# Profiling
npm run profile:cpu
npm run profile:memory
npm run profile:heap-snapshot

# Monitoring
npm run metrics:export
npm run dashboard:view
```

---

**Last Updated**: 2025-01-07
**Target Score**: 10/10
**Status**: Production-Ready
