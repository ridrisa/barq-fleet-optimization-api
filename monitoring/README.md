# BARQ Fleet Management - Monitoring Stack

Complete monitoring, metrics collection, alerting, and performance testing infrastructure for production deployments.

## Table of Contents

- [Overview](#overview)
- [Components](#components)
- [Quick Start](#quick-start)
- [Metrics](#metrics)
- [Dashboards](#dashboards)
- [Alerting](#alerting)
- [Load Testing](#load-testing)
- [Troubleshooting](#troubleshooting)

## Overview

The BARQ Fleet Management monitoring stack provides:

- **Real-time Metrics**: Prometheus-based metrics collection
- **Visualization**: Grafana dashboards for system monitoring
- **Error Tracking**: Sentry integration for error monitoring and APM
- **Alerting**: Automated alerts for critical conditions
- **Performance Testing**: k6-based load testing scenarios
- **Caching**: Multi-layer caching for performance optimization

## Components

### 1. Prometheus (Metrics Collection)

- **Port**: 9090
- **URL**: http://localhost:9090
- **Purpose**: Collects and stores time-series metrics
- **Scrape Interval**: 15 seconds
- **Retention**: 30 days

### 2. Grafana (Visualization)

- **Port**: 3000
- **URL**: http://localhost:3000
- **Default Credentials**: admin/admin
- **Purpose**: Visualizes metrics with interactive dashboards

### 3. Sentry (Error Tracking & APM)

- **Integration**: Backend application
- **Purpose**: Real-time error tracking and performance monitoring
- **Configuration**: Via SENTRY_DSN environment variable

### 4. Node Cache (Performance Optimization)

- **Type**: In-memory caching
- **Layers**: Main, Optimization, Agent, Static
- **Purpose**: Reduce database queries and improve response times

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Backend application running on port 3003
- (Optional) k6 installed for load testing

### 1. Start Monitoring Stack

```bash
cd monitoring
docker-compose up -d
```

This starts:
- Prometheus on port 9090
- Grafana on port 3000

### 2. Verify Services

```bash
# Check Prometheus
curl http://localhost:9090/-/healthy

# Check Grafana
curl http://localhost:3000/api/health

# Check backend metrics endpoint
curl http://localhost:3003/metrics
```

### 3. Access Dashboards

1. Open Grafana: http://localhost:3000
2. Login with admin/admin
3. Navigate to Dashboards
4. Select "BARQ Fleet Management" dashboard

### 4. Configure Sentry (Optional)

```bash
# In backend/.env
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_RELEASE=1.0.0
SERVER_NAME=barq-api-prod-1
```

## Metrics

### HTTP Metrics

```
barq_http_request_duration_seconds - Request duration histogram
barq_http_requests_total - Total HTTP requests counter
barq_http_request_size_bytes - Request size histogram
barq_http_response_size_bytes - Response size histogram
```

### Optimization Metrics

```
barq_optimization_requests_total - Total optimization requests
barq_optimization_duration_seconds - Optimization duration
barq_optimization_stops_count - Number of stops per request
barq_optimization_vehicles_count - Number of vehicles per request
```

### AI Agent Metrics

```
barq_active_agents - Active AI agents gauge
barq_agent_executions_total - Total agent executions
barq_agent_execution_duration_seconds - Agent execution time
barq_agent_errors_total - Agent errors counter
```

### Autonomous Operations

```
barq_autonomous_actions_total - Autonomous actions executed
barq_autonomous_cycle_duration_seconds - Cycle duration
barq_autonomous_decisions_total - Decisions made
```

### Database Metrics

```
barq_database_connections - Active connections
barq_database_query_duration_seconds - Query duration
barq_database_queries_total - Total queries
barq_database_errors_total - Database errors
```

### Cache Metrics

```
barq_cache_hits_total - Cache hits
barq_cache_misses_total - Cache misses
barq_cache_size_bytes - Cache size
```

### Business Metrics

```
barq_orders_total - Total orders processed
barq_deliveries_total - Total deliveries
barq_sla_violations_total - SLA violations
barq_driver_utilization - Driver utilization percentage
```

### System Metrics

```
process_resident_memory_bytes - Memory usage
process_cpu_seconds_total - CPU usage
nodejs_eventloop_lag_seconds - Event loop lag
```

## Dashboards

### Main Dashboard Panels

1. **Request Rate**: Requests per second over time
2. **Response Time**: p50, p95, p99 latencies
3. **Error Rate**: 5xx errors and error percentage
4. **Optimization Performance**: Optimization request metrics
5. **Agent Health**: Active agents and execution status
6. **Autonomous Operations**: Actions and decisions
7. **Database Performance**: Query duration and connections
8. **Cache Performance**: Hit rate and size
9. **System Resources**: CPU, memory, event loop
10. **Business Metrics**: Orders, deliveries, SLA

### Creating Custom Dashboards

1. Login to Grafana (http://localhost:3000)
2. Click "Create" → "Dashboard"
3. Add panel
4. Select Prometheus datasource
5. Write PromQL query
6. Configure visualization
7. Save dashboard

### Example PromQL Queries

```promql
# Request rate (requests/sec)
rate(barq_http_requests_total[5m])

# 95th percentile response time
histogram_quantile(0.95, rate(barq_http_request_duration_seconds_bucket[5m]))

# Error rate percentage
rate(barq_http_requests_total{status_code=~"5.."}[5m]) /
rate(barq_http_requests_total[5m]) * 100

# Cache hit rate
rate(barq_cache_hits_total[5m]) /
(rate(barq_cache_hits_total[5m]) + rate(barq_cache_misses_total[5m]))

# Active database connections
barq_database_connections{state="active"}

# Agent execution success rate
rate(barq_agent_executions_total{status="success"}[5m]) /
rate(barq_agent_executions_total[5m])
```

## Alerting

### Alert Rules

Alerts are defined in `prometheus/alerts.yml` and cover:

- **High Error Rate**: >5% error rate for 2 minutes
- **Slow Response Time**: >2s p95 latency for 5 minutes
- **Agent Failures**: Any agent in error state
- **Database Issues**: Connection pool exhaustion, slow queries
- **High SLA Violations**: Excessive delivery delays
- **System Resources**: High CPU/memory usage, event loop lag

### Alert Severity Levels

- **Critical**: Requires immediate attention
- **Warning**: Requires investigation
- **Info**: Informational only

### Viewing Alerts

1. Prometheus: http://localhost:9090/alerts
2. Grafana: Alerting → Alert rules

### Configuring Alertmanager (Optional)

```yaml
# monitoring/alertmanager/alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'severity']
  receiver: 'slack-notifications'

receivers:
  - name: 'slack-notifications'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#barq-alerts'
```

Then uncomment alertmanager in docker-compose.yml.

## Load Testing

### Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker pull grafana/k6
```

### Running Load Tests

#### 1. Authentication Load Test

Tests login, registration, and token refresh endpoints:

```bash
cd backend/tests/load
k6 run auth-load.js

# With custom parameters
k6 run --vus 50 --duration 5m auth-load.js

# With custom base URL
k6 run --env BASE_URL=http://production.example.com auth-load.js
```

**Stages:**
- Ramp to 50 users over 3 minutes
- Peak at 100 users for 3 minutes
- Ramp down over 2 minutes

**Thresholds:**
- 95% of requests < 500ms
- Error rate < 1%
- Login success rate > 99%

#### 2. Optimization Load Test

Tests route optimization under realistic load:

```bash
k6 run optimization-load.js

# Stress test
k6 run --vus 100 --duration 10m optimization-load.js

# With results output
k6 run --out json=results.json optimization-load.js
```

**Stages:**
- Warm up with 10 users
- Increase to 50 concurrent optimizations
- Peak at 100 users
- Step down gradually

**Complexity Levels:**
- Simple: 5 deliveries, 1 vehicle
- Medium: 15 deliveries, 3 vehicles (60% of requests)
- Complex: 30 deliveries, 5 vehicles
- Very Complex: 50 deliveries, 8 vehicles

**Thresholds:**
- 95% of requests < 3 seconds
- Error rate < 5%
- Success rate > 95%

#### 3. Mixed Workload Test

Simulates realistic production traffic:

```bash
k6 run mixed-load.js
```

**Scenarios:**
- Health checks (20%)
- Authentication (15%)
- Optimization (40%)
- Agent queries (15%)
- Status checks (10%)

**Stages:**
- Normal load: 25-50 users
- Business hours: 50-100 users
- Peak: 150 users (morning rush simulation)
- Evening: 50 users

### Analyzing Results

#### During Test

Monitor in real-time:
- Grafana dashboards: http://localhost:3000
- Prometheus metrics: http://localhost:9090
- k6 output in terminal

#### After Test

1. **k6 Summary**: Check terminal output for:
   - Request rate (req/s)
   - Response times (p50, p95, p99)
   - Error rate
   - Data transfer

2. **Prometheus**: Query historical data:
   ```promql
   # Response time during test
   barq_http_request_duration_seconds{quantile="0.95"}

   # Error rate during test
   rate(barq_http_requests_total{status_code=~"5.."}[1m])
   ```

3. **Grafana**: Review dashboard panels for:
   - Performance degradation
   - Resource utilization
   - Error spikes
   - Cache effectiveness

4. **Sentry**: Check for:
   - Error frequency
   - Performance issues
   - Slow transactions

### Performance Targets

- **Response Time**: p95 < 500ms for API, < 2s for optimization
- **Throughput**: 200+ concurrent users
- **Error Rate**: < 1% for normal operations, < 5% under peak
- **Uptime**: 99.9% availability
- **Database**: Query times p95 < 50ms

## Troubleshooting

### Prometheus Not Scraping Metrics

**Problem**: Prometheus can't reach backend metrics endpoint

**Solutions:**
1. Verify backend is running: `curl http://localhost:3003/health`
2. Check metrics endpoint: `curl http://localhost:3003/metrics`
3. Verify Docker network: `docker network inspect monitoring_monitoring`
4. Check Prometheus config: `monitoring/prometheus/prometheus.yml`
5. View Prometheus targets: http://localhost:9090/targets

### High Memory Usage

**Problem**: Application consuming excessive memory

**Solutions:**
1. Check cache size: Review cache metrics in Grafana
2. Monitor for leaks: Use Sentry performance tracking
3. Reduce cache TTL: Adjust in `cache.service.js`
4. Increase available memory: Update Docker/system limits

### Slow Database Queries

**Problem**: High query latencies

**Solutions:**
1. Review slow queries in logs
2. Check connection pool: `barq_database_connections` metric
3. Add missing indexes: Analyze query execution plans
4. Enable query caching: Use cache.service.js
5. Scale database: Add read replicas

### Failed Load Tests

**Problem**: Load tests failing with errors

**Solutions:**
1. Check application logs: `docker logs backend`
2. Verify rate limiting: Adjust in `app.js` if needed
3. Increase timeouts: Update k6 script timeouts
4. Scale resources: Increase CPU/memory allocation
5. Review error details: Check Sentry for error patterns

### Grafana Dashboard Not Showing Data

**Problem**: Empty or no data in Grafana panels

**Solutions:**
1. Verify Prometheus datasource: Configuration → Data sources
2. Check time range: Adjust dashboard time selector
3. Test query in Explore: Use Explore tab to test PromQL
4. Verify metrics exist: Check /metrics endpoint
5. Review Prometheus targets: Ensure target is UP

### Cache Not Working

**Problem**: Low cache hit rate

**Solutions:**
1. Check cache TTL: May be too short
2. Review cache keys: Ensure consistent key generation
3. Monitor cache size: May be evicting entries too quickly
4. Verify cache layer: Check correct cache is being used
5. Review access patterns: May need different caching strategy

## Best Practices

### Monitoring

1. **Set up alerts** for critical metrics
2. **Review dashboards** daily during initial deployment
3. **Establish baselines** for normal operation
4. **Monitor trends** not just point-in-time metrics
5. **Document incidents** and resolutions

### Performance

1. **Run load tests** before production deployment
2. **Test with realistic data** volumes
3. **Monitor during deployment** to catch regressions
4. **Set performance budgets** and enforce them
5. **Profile slow endpoints** and optimize

### Alerting

1. **Start conservative** with alert thresholds
2. **Tune based on experience** to reduce noise
3. **Document runbooks** for each alert
4. **Test alert routing** regularly
5. **Review and update** alert rules quarterly

### Caching

1. **Cache expensive operations** first
2. **Set appropriate TTLs** based on data volatility
3. **Monitor hit rates** and adjust strategy
4. **Invalidate on updates** to prevent stale data
5. **Use cache layers** for different data types

## Support

For questions or issues:
1. Check logs: `docker logs <container_name>`
2. Review documentation in this folder
3. Consult Prometheus documentation: https://prometheus.io/docs
4. Consult Grafana documentation: https://grafana.com/docs
5. Contact DevOps team

## License

Copyright (c) 2025 BARQ Fleet Management
