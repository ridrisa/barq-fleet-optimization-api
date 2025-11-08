# Load Testing Guide - BARQ Fleet Management API

Comprehensive guide for performance and load testing of the BARQ Fleet Management API.

## Overview

This guide covers:
- Load testing setup and execution
- Performance analysis and optimization
- Bottleneck identification
- Capacity planning
- Production readiness verification

## Prerequisites

### Install k6

**macOS:**
```bash
brew install k6
```

**Linux (Debian/Ubuntu):**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Docker:**
```bash
docker pull grafana/k6
```

**Verify installation:**
```bash
k6 version
```

## Load Test Scenarios

### 1. Authentication Load Test

**Purpose**: Verify authentication endpoints can handle concurrent login requests

**File**: `tests/load/auth-load.js`

**Run:**
```bash
cd backend/tests/load
k6 run auth-load.js
```

**Custom Options:**
```bash
# Run with specific VUs and duration
k6 run --vus 100 --duration 5m auth-load.js

# Set custom base URL
k6 run --env BASE_URL=https://api.production.com auth-load.js

# Save results to file
k6 run --out json=auth-results.json auth-load.js

# Run with custom stages
k6 run --stage 2m:50,5m:100,2m:0 auth-load.js
```

**Expected Results:**
- Throughput: 50-100 req/sec
- Response Time: p95 < 500ms
- Error Rate: < 1%
- Success Rate: > 99%

### 2. Optimization Load Test

**Purpose**: Test route optimization under realistic load with varying complexity

**File**: `tests/load/optimization-load.js`

**Run:**
```bash
k6 run optimization-load.js
```

**Custom Options:**
```bash
# Stress test with high load
k6 run --vus 150 --duration 10m optimization-load.js

# Quick smoke test
k6 run --vus 10 --duration 2m optimization-load.js

# Production simulation
k6 run --env BASE_URL=https://api.production.com optimization-load.js
```

**Expected Results:**
- Throughput: 20-50 optimizations/sec
- Response Time: p95 < 3s (medium complexity), < 5s (complex)
- Error Rate: < 5%
- Success Rate: > 95%

### 3. Mixed Workload Test

**Purpose**: Simulate realistic production traffic with mixed endpoint types

**File**: `tests/load/mixed-load.js`

**Run:**
```bash
k6 run mixed-load.js
```

**Traffic Mix:**
- 40% - Route optimization
- 20% - Health checks
- 15% - Authentication
- 15% - Agent queries
- 10% - Status checks

**Expected Results:**
- Throughput: 100-200 req/sec (mixed)
- Response Time: p95 < 1s (overall)
- Error Rate: < 2%
- Success Rate: > 98%

## Interpreting Results

### k6 Output Metrics

```
checks.........................: 98.50% ✓ 9850      ✗ 150
data_received..................: 15 MB  250 kB/s
data_sent......................: 8.5 MB 142 kB/s
http_req_blocked...............: avg=1.2ms   min=1µs     med=5µs     max=500ms  p(90)=10µs   p(95)=15µs
http_req_connecting............: avg=800µs   min=0s      med=0s      max=450ms  p(90)=0s     p(95)=0s
http_req_duration..............: avg=245ms   min=50ms    med=180ms   max=2.5s   p(90)=450ms  p(95)=680ms
http_req_failed................: 1.50%  ✓ 150       ✗ 9850
http_req_receiving.............: avg=1.5ms   min=100µs   med=800µs   max=50ms   p(90)=3ms    p(95)=5ms
http_req_sending...............: avg=800µs   min=50µs    med=500µs   max=20ms   p(90)=1.5ms  p(95)=2ms
http_req_tls_handshaking.......: avg=0s      min=0s      med=0s      max=0s     p(90)=0s     p(95)=0s
http_req_waiting...............: avg=243ms   min=48ms    med=178ms   max=2.49s  p(90)=448ms  p(95)=678ms
http_reqs......................: 10000  166.67/s
iteration_duration.............: avg=1.5s    min=1s      med=1.4s    max=4s     p(90)=2.1s   p(95)=2.5s
iterations.....................: 10000  166.67/s
vus............................: 100    min=0       max=100
vus_max........................: 100    min=100     max=100
```

### Key Metrics Explained

**http_req_duration**: Total request time (sending + waiting + receiving)
- Target: p95 < 500ms for API, < 2s for optimization
- p90 and p95 are most important (median can hide issues)

**http_req_failed**: Percentage of failed requests
- Target: < 1% for normal, < 5% under stress
- Check logs/Sentry for error details

**http_reqs**: Total requests per second
- Indicates system throughput
- Compare with expected production load

**vus**: Virtual users (concurrent connections)
- Simulates concurrent user load
- Ramp up gradually to find breaking point

**checks**: Application-specific validations
- Should be > 95% passing
- Failed checks indicate functional issues

### Performance Targets

#### Response Times (p95)
- Health check: < 50ms
- Authentication: < 500ms
- Simple queries: < 200ms
- Optimization (simple): < 1s
- Optimization (medium): < 3s
- Optimization (complex): < 5s

#### Throughput
- Health checks: 500+ req/sec
- Authentication: 100+ req/sec
- Optimization: 50+ req/sec
- Mixed workload: 200+ req/sec

#### Error Rates
- Normal load: < 1%
- Peak load: < 5%
- Sustained load: < 2%

#### Concurrent Users
- Minimum: 100 users
- Target: 200 users
- Maximum: 500+ users

## Monitoring During Tests

### Real-Time Monitoring

**Terminal Output:**
```bash
# Run with verbose output
k6 run --verbose optimization-load.js

# Monitor specific metrics
k6 run --summary-trend-stats="min,avg,med,max,p(95),p(99)" optimization-load.js
```

**Grafana Dashboards:**
1. Open http://localhost:3000
2. Navigate to BARQ Fleet Management dashboard
3. Adjust time range to "Last 30 minutes"
4. Watch for:
   - Spike in request rate
   - Increase in response times
   - Error rate changes
   - Resource utilization

**Prometheus Metrics:**
1. Open http://localhost:9090
2. Query relevant metrics:
   ```promql
   # Current request rate
   rate(barq_http_requests_total[1m])

   # 95th percentile latency
   histogram_quantile(0.95, rate(barq_http_request_duration_seconds_bucket[5m]))

   # Error rate
   rate(barq_http_requests_total{status_code=~"5.."}[1m])
   ```

**Application Logs:**
```bash
# Follow logs during test
docker logs -f barq-backend

# Or if running locally
tail -f backend/logs/combined.log
```

## Identifying Bottlenecks

### Common Bottlenecks

#### 1. High Response Times

**Symptoms:**
- p95 latency > target
- Increasing over time
- Affects all endpoints

**Possible Causes:**
- CPU saturation
- Memory pressure
- Database slow queries
- External API latency

**Investigation:**
```bash
# Check system resources
docker stats barq-backend

# Check database connections
curl http://localhost:3003/metrics | grep barq_database_connections

# Check cache hit rate
curl http://localhost:3003/metrics | grep barq_cache
```

**Solutions:**
- Add caching
- Optimize database queries
- Scale horizontally
- Increase resources

#### 2. Database Connection Pool Exhaustion

**Symptoms:**
- Errors: "Connection pool timeout"
- Spike in errors during load
- `barq_database_connections` at maximum

**Investigation:**
```promql
# Prometheus query
barq_database_connections{state="active"}
```

**Solutions:**
- Increase pool size in `.env`: `POSTGRES_POOL_MAX=30`
- Fix connection leaks
- Use connection pooling middleware
- Implement query caching

#### 3. Memory Leaks

**Symptoms:**
- Memory usage increases over time
- Never stabilizes
- Eventually crashes

**Investigation:**
```bash
# Monitor memory during test
watch -n 1 'docker stats barq-backend --no-stream'

# Check heap usage
curl http://localhost:3003/metrics | grep process_resident_memory_bytes
```

**Solutions:**
- Profile with Node.js heap snapshot
- Check for circular references
- Implement proper cleanup in async operations
- Limit cache size

#### 4. Event Loop Blocking

**Symptoms:**
- High event loop lag
- Timeout errors
- Degraded performance under load

**Investigation:**
```promql
# Prometheus query
nodejs_eventloop_lag_seconds
```

**Solutions:**
- Remove synchronous operations
- Use worker threads for CPU-intensive tasks
- Implement async/await properly
- Break up large operations

#### 5. External API Rate Limiting

**Symptoms:**
- Errors from external services (LLM APIs)
- 429 status codes
- Agent execution failures

**Investigation:**
```bash
# Check agent errors
curl http://localhost:3003/metrics | grep barq_agent_errors_total
```

**Solutions:**
- Implement request queuing
- Add exponential backoff
- Use multiple API keys
- Cache API responses

### Performance Profiling

**Enable Node.js profiling:**
```bash
# Start with profiling enabled
node --inspect src/app.js

# Or with Chrome DevTools
node --inspect-brk src/app.js
```

**Use clinic.js:**
```bash
npm install -g clinic

# Profile during load test
clinic doctor -- node src/app.js
# Run load test in another terminal
# Stop server with Ctrl+C
# View report in browser
```

## Optimization Strategies

### 1. Caching

**Implementation:**
```javascript
const cacheService = require('./services/cache.service');

async function getExpensiveData(id) {
  return await cacheService.getCached(
    `data:${id}`,
    async () => {
      // Expensive operation
      return await database.query('SELECT * FROM ...');
    },
    { ttl: 300, cacheName: 'main' }
  );
}
```

**Benefits:**
- Reduce database load
- Improve response times
- Handle traffic spikes

### 2. Database Query Optimization

**Add indexes:**
```sql
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_deliveries_date ON deliveries(delivered_at);
CREATE INDEX idx_drivers_org ON drivers(organization_id);
```

**Use connection pooling:**
```javascript
// Already implemented in postgres.service.js
POSTGRES_POOL_MAX=20
POSTGRES_POOL_MIN=2
```

**Implement query caching:**
```javascript
const result = await cacheService.getCached(
  `query:orders:${orgId}`,
  async () => await db.getOrders(orgId),
  { ttl: 60, cacheName: 'optimization' }
);
```

### 3. Horizontal Scaling

**Docker Compose with replicas:**
```yaml
services:
  backend:
    deploy:
      replicas: 3
    # Add load balancer
```

**Kubernetes deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 3
  # HPA for auto-scaling
```

### 4. Response Compression

**Enable gzip compression:**
```javascript
const compression = require('compression');
app.use(compression());
```

### 5. Async Processing

**Use queues for long operations:**
```javascript
const Queue = require('bull');
const optimizationQueue = new Queue('optimization');

// Enqueue instead of blocking
await optimizationQueue.add({ data });

// Process in background
optimizationQueue.process(async (job) => {
  // Long-running optimization
});
```

## Best Practices

### Before Load Testing

1. **Baseline Performance**: Run single-user tests first
2. **Clean Environment**: Start with fresh database and caches
3. **Monitoring Setup**: Ensure all monitoring is running
4. **Realistic Data**: Use production-like data volumes
5. **Document System State**: Record configuration and versions

### During Load Testing

1. **Start Gradually**: Ramp up load slowly
2. **Monitor Continuously**: Watch dashboards in real-time
3. **Note Anomalies**: Document any unusual behavior
4. **Check Logs**: Monitor for errors and warnings
5. **Test Incrementally**: Don't jump to maximum load

### After Load Testing

1. **Analyze Results**: Review all metrics thoroughly
2. **Document Findings**: Record bottlenecks and issues
3. **Create Action Items**: Prioritize optimizations
4. **Re-test**: Verify improvements with follow-up tests
5. **Update Baselines**: Establish new performance targets

## Load Test Checklist

- [ ] k6 installed and verified
- [ ] Monitoring stack running (Prometheus + Grafana)
- [ ] Backend application running
- [ ] Database initialized with test data
- [ ] Environment variables configured
- [ ] Sentry configured (optional but recommended)
- [ ] Baseline performance documented
- [ ] Test scenarios reviewed and understood
- [ ] Monitoring dashboards accessible
- [ ] Log aggregation configured

## Common Issues

### Issue: k6 command not found

**Solution:**
```bash
# Verify installation
which k6

# Reinstall if needed
brew reinstall k6
```

### Issue: Connection refused errors

**Solution:**
```bash
# Verify backend is running
curl http://localhost:3003/health

# Check port
lsof -i :3003

# Restart backend if needed
docker-compose restart backend
```

### Issue: Authentication failures in tests

**Solution:**
```javascript
// Verify credentials in test scripts
// Default: admin@barq.com / Admin@123

// Or set via environment
k6 run --env EMAIL=user@example.com --env PASSWORD=pass auth-load.js
```

### Issue: Tests timeout

**Solution:**
```javascript
// Increase timeout in test script
http.post(url, payload, {
  timeout: '60s' // Increase from default
});
```

### Issue: Memory errors during test

**Solution:**
```bash
# Increase Node.js memory
node --max-old-space-size=4096 src/app.js

# Or in Docker
docker run -e NODE_OPTIONS="--max-old-space-size=4096" ...
```

## Sample Load Test Report

```markdown
# Load Test Report - 2025-01-15

## Test Configuration
- Scenario: Mixed workload
- Duration: 20 minutes
- Peak VUs: 150
- Environment: Staging

## Results Summary
- Total Requests: 48,532
- Throughput: 40.4 req/sec
- Error Rate: 1.2%
- Success Rate: 98.8%

## Response Times
- p50: 185ms
- p95: 720ms
- p99: 1,450ms
- max: 3,200ms

## Bottlenecks Identified
1. Database connection pool reached 95% capacity at peak load
2. Cache hit rate dropped to 45% (target: >70%)
3. Agent execution times spiked during traffic peaks

## Recommendations
1. Increase database pool size from 20 to 30
2. Optimize cache TTL for agent results
3. Implement agent request queuing
4. Add horizontal scaling for >100 concurrent users

## Action Items
- [HIGH] Increase DB pool size - Owner: DevOps - ETA: 2 days
- [MEDIUM] Optimize caching - Owner: Backend - ETA: 1 week
- [LOW] Add monitoring alerts - Owner: SRE - ETA: 3 days
```

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Node.js Performance](https://nodejs.org/en/docs/guides/simple-profiling/)
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html)

## Support

For questions or issues with load testing:
1. Check this documentation
2. Review test scripts in `tests/load/`
3. Check monitoring dashboards
4. Consult team leads
