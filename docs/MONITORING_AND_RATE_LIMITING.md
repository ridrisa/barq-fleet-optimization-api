# Monitoring & Rate Limiting Guide

## 📊 Overview

This guide covers the production monitoring and API rate limiting features implemented for the BARQ Fleet Management system.

**Features Implemented:**
- ✅ API Rate Limiting (Express rate limit)
- ✅ Cloud Monitoring Dashboard
- ✅ Alert Policies for Critical Metrics
- ✅ Enhanced Structured Logging
- ✅ Performance Tracking

---

## 🚦 API Rate Limiting

### Rate Limit Configuration

Rate limiting is implemented using `express-rate-limit` middleware to prevent API abuse and protect system resources.

#### Rate Limit Tiers

| Endpoint Type | Limit | Window | Notes |
|--------------|-------|--------|-------|
| **Standard Endpoints** | 100 req | 15 min | General fleet management operations |
| **AI/LLM Endpoints** | 20 req | 15 min | Resource-intensive AI operations |
| **Optimization Endpoints** | 30 req | 15 min | Computationally expensive routing |
| **Authentication** | 5 req | 15 min | Brute force protection |

### Implementation Details

**File:** `backend/src/middleware/rate-limit.middleware.js`

```javascript
const { standardLimiter, aiLimiter, optimizationLimiter } = require('./middleware/rate-limit.middleware');

// Standard endpoints (100 req/15min)
router.post('/targets/set', standardLimiter, handler);

// AI endpoints (20 req/15min)
router.post('/ai/suggest-driver', aiLimiter, handler);

// Optimization endpoints (30 req/15min)
router.post('/assign', optimizationLimiter, handler);
```

### Rate Limit Response

When rate limit is exceeded, the API returns:

```json
{
  "success": false,
  "error": "Too many requests from this IP, please try again later.",
  "retryAfter": "15 minutes"
}
```

**HTTP Status:** `429 Too Many Requests`

**Response Headers:**
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests remaining in current window
- `RateLimit-Reset`: Time when limit resets (Unix timestamp)

### Affected Endpoints

#### Standard Limiter (100 req/15min)
- `POST /api/v1/fleet-manager/targets/set`
- `GET /api/v1/fleet-manager/targets/status`
- `POST /api/v1/fleet-manager/targets/reset`
- `POST /api/v1/fleet-manager/at-risk`
- `PUT /api/v1/fleet-manager/driver/:driverId/status`
- `GET /api/v1/fleet-manager/dashboard`

#### AI Limiter (20 req/15min)
- `POST /api/v1/fleet-manager/ai/suggest-driver`
- `POST /api/v1/fleet-manager/ai/predict-sla`
- `POST /api/v1/fleet-manager/ai/query`
- `POST /api/v1/fleet-manager/ai/recommendations`
- `GET /api/v1/fleet-manager/ai/status`

#### Optimization Limiter (30 req/15min)
- `POST /api/v1/fleet-manager/assign`
- `POST /api/v1/fleet-manager/reoptimize`

### Custom Rate Limiters

You can create custom rate limiters:

```javascript
const { createCustomLimiter } = require('./middleware/rate-limit.middleware');

const customLimiter = createCustomLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000,
  message: 'Custom rate limit exceeded'
});

router.get('/my-endpoint', customLimiter, handler);
```

---

## 📈 Cloud Monitoring Dashboard

### Dashboard Setup

**Location:** `monitoring/cloud-monitoring-dashboard.json`

The dashboard provides real-time visibility into:
- Request count and throughput
- Response latency (P95)
- Error rates (5xx responses)
- CPU utilization
- Memory utilization
- Active instances
- Database connections

### Deploying the Dashboard

```bash
cd monitoring
./deploy-monitoring.sh [project-id]
```

Or manually:

```bash
gcloud monitoring dashboards create \
  --config-from-file=cloud-monitoring-dashboard.json
```

### Dashboard Widgets

1. **Request Count** - Real-time request rate (req/sec)
2. **Response Latency (P95)** - 95th percentile response time
3. **Error Rate (HTTP 5xx)** - Server errors per second with thresholds
4. **CPU Utilization** - Container CPU usage with alerts at 70% and 90%
5. **Memory Utilization** - Memory usage with alerts at 80% and 95%
6. **Active Instances** - Auto-scaling instance count
7. **Database Connections** - Cloud SQL connection count

### Accessing the Dashboard

**URL:** `https://console.cloud.google.com/monitoring/dashboards?project=barq-fleet-optimization`

Or search for: **"BARQ Fleet Manager - Production Dashboard"**

---

## 🔔 Alert Policies

### Alert Configuration

**Location:** `monitoring/alert-policies.yaml`

### Critical Alerts

| Alert | Threshold | Duration | Action Required |
|-------|-----------|----------|-----------------|
| **High Error Rate** | > 1% of requests | 5 min | Check logs, recent deployments |
| **High Latency** | P95 > 1000ms | 5 min | Review database queries, external APIs |
| **High CPU** | > 80% | 10 min | Consider scaling up or optimization |
| **High Memory** | > 90% | 5 min | Check for leaks, increase allocation |
| **DB Connection Spike** | > 80 connections | 5 min | Review connection pooling |
| **No Traffic** | 0 requests | 5 min | **P1 Incident** - Service may be down |

### Setting Up Alerts

#### Option 1: Cloud Console (Recommended)

1. Go to: https://console.cloud.google.com/monitoring/alerting
2. Click **"Create Policy"**
3. Use configurations from `alert-policies.yaml`
4. Configure notification channels (email, Slack, SMS)

#### Option 2: gcloud CLI

```bash
gcloud alpha monitoring policies create \
  --policy-from-file=alert-policies.yaml
```

### Alert Response Procedures

Each alert includes detailed runbook documentation:

**Example: High Error Rate Alert**

```markdown
## High Error Rate Detected

**What's happening:** Server errors (5xx) are occurring at an elevated rate.

**Impact:** Users may be experiencing service failures.

**Action Required:**
1. Check Cloud Run logs: `gcloud run services logs read route-opt-backend --limit=50`
2. Look for error patterns in application logs
3. Check database connectivity and performance
4. Review recent deployments for issues

**Escalation:** If errors persist > 15 minutes, escalate to on-call engineer.
```

### Notification Channels

Configure in Cloud Console:
- **Email:** alerts@barq-fleet.com
- **Slack:** #barq-alerts
- **SMS:** On-call rotation
- **PagerDuty:** P1 incidents

---

## 📝 Enhanced Structured Logging

### Logging Format

All fleet operations now include structured logging with consistent fields:

```json
{
  "operation": "assignOrdersDynamic",
  "operation_id": "assign_1699890123456_abc123xyz",
  "timestamp": "2025-11-15T00:00:00.000Z",
  "status": "success",
  "duration_ms": 1234,
  "orders_count": 50,
  "drivers_count": 10,
  "assignments_count": 48,
  "urgency_breakdown": {
    "critical": 5,
    "urgent": 15,
    "normal": 20,
    "flexible": 10
  },
  "performance_summary": {
    "total_drivers": 10,
    "on_target_drivers": 8,
    "average_achievement": 92.5
  }
}
```

### Key Logging Operations

#### 1. Set Driver Targets
```javascript
logger.info('Setting driver targets', {
  operation: 'setDriverTargets',
  driver_count: 10,
  driver_ids: ['DRV_001', 'DRV_002', ...]
});
```

#### 2. Dynamic Order Assignment
```javascript
logger.info('Dynamic assignment completed successfully', {
  operation: 'assignOrdersDynamic',
  operation_id: 'assign_xxx',
  assignments_count: 48,
  routes_count: 10,
  duration_ms: 1234,
  status: 'success',
  driver_achievements: [...]
});
```

### Log Levels

- **DEBUG:** Detailed operation steps (development only)
- **INFO:** Normal operations, successful completions
- **WARN:** Degraded performance, near-threshold conditions
- **ERROR:** Failures, exceptions, critical issues

### Querying Logs

**Cloud Console:**
```
resource.type="cloud_run_revision"
resource.labels.service_name="route-opt-backend"
jsonPayload.operation="assignOrdersDynamic"
severity="ERROR"
```

**gcloud CLI:**
```bash
gcloud run services logs read route-opt-backend \
  --limit=100 \
  --filter='jsonPayload.operation="assignOrdersDynamic"'
```

### Log-Based Metrics

Create custom metrics from logs:

```sql
resource.type="cloud_run_revision"
jsonPayload.operation="assignOrdersDynamic"
jsonPayload.status="success"
```

Track:
- Assignment success rate
- Average operation duration
- Orders per assignment
- Driver achievement rates

---

## 🎯 Performance Metrics

### Key Metrics to Monitor

| Metric | Target | Alert Threshold | Notes |
|--------|--------|-----------------|-------|
| **Request Latency (P95)** | < 500ms | > 1000ms | API response time |
| **Error Rate** | < 0.1% | > 1% | 5xx responses |
| **CPU Utilization** | < 50% | > 80% | Container CPU |
| **Memory Utilization** | < 70% | > 90% | Container memory |
| **Database Connections** | < 50 | > 80 | Connection pool |
| **Driver Achievement** | > 85% | < 80% | Target completion |
| **SLA Compliance** | > 95% | < 90% | On-time delivery |

### Success Metrics

**Fleet Performance:**
- Driver target achievement rate: **> 85%**
- SLA compliance: **> 95%** within 1-4 hours
- Average assignment time: **< 2 seconds**

**System Performance:**
- API uptime: **99.9%**
- Average response time: **< 200ms**
- Error rate: **< 0.1%**

---

## 🔧 Troubleshooting

### High Error Rate

**Symptoms:** 5xx errors increasing

**Diagnosis:**
```bash
# Check recent logs
gcloud run services logs read route-opt-backend --limit=50

# Check error patterns
gcloud logging read 'severity="ERROR"' --limit=20
```

**Common Causes:**
- Database connection failures
- LLM API timeouts (GROQ)
- Memory exhaustion
- Bad deployment

**Resolution:**
1. Check database connectivity
2. Verify GROQ API key and quota
3. Review recent deployments
4. Check memory limits

### High Latency

**Symptoms:** P95 latency > 1 second

**Diagnosis:**
```bash
# Check slow queries
gcloud logging read 'jsonPayload.duration_ms>1000' --limit=20
```

**Common Causes:**
- Slow database queries
- External API delays (Maps, GROQ)
- Insufficient resources
- Missing database indexes

**Resolution:**
1. Review database query performance
2. Check external API status
3. Scale up resources if needed
4. Add database indexes

### Rate Limit Issues

**Symptoms:** Clients receiving 429 responses

**Diagnosis:**
```bash
# Check rate limit logs
gcloud logging read 'textPayload=~"rate limit"' --limit=20
```

**Common Causes:**
- Legitimate high traffic
- Client retry loops
- Missing request caching
- API abuse

**Resolution:**
1. Review client request patterns
2. Implement client-side caching
3. Increase limits if legitimate
4. Block abusive IPs if necessary

---

## 📚 Additional Resources

### Documentation
- [Cloud Monitoring Documentation](https://cloud.google.com/monitoring/docs)
- [Cloud Run Metrics](https://cloud.google.com/run/docs/monitoring)
- [Express Rate Limit](https://github.com/express-rate-limit/express-rate-limit)

### Tools
- **Cloud Console:** https://console.cloud.google.com
- **Metrics Explorer:** https://console.cloud.google.com/monitoring/metrics-explorer
- **Logs Explorer:** https://console.cloud.google.com/logs

### Support
- **Technical Issues:** Check logs first
- **Performance Issues:** Review dashboard and metrics
- **Alerts:** Follow runbook procedures
- **Escalation:** Contact on-call engineer

---

## 🚀 Quick Reference

### Deploy Monitoring
```bash
cd monitoring
./deploy-monitoring.sh barq-fleet-optimization
```

### Check Service Health
```bash
gcloud run services describe route-opt-backend --region=us-central1
```

### View Recent Logs
```bash
gcloud run services logs read route-opt-backend --limit=50
```

### Test Rate Limiting
```bash
# Send 25 requests to AI endpoint (should hit limit)
for i in {1..25}; do
  curl -X POST https://route-opt-backend-sek7q2ajva-uc.a.run.app/api/v1/fleet-manager/ai/status
  echo ""
done
```

### Check Current Metrics
```bash
gcloud monitoring time-series list \
  --filter='resource.type="cloud_run_revision"'
```

---

**Last Updated:** 2025-11-15
**Version:** 1.0
**Status:** Production Ready ✅
