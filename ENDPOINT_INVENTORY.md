# BARQ Fleet Optimization API - Endpoint Inventory

**Service URL:** https://route-opt-backend-426674819922.us-central1.run.app
**Last Updated:** 2025-11-11
**Total Endpoints:** 60+

---

## Quick Reference by Category

### 🏥 Health & Monitoring (7 endpoints)
```
GET  /health                           - Basic health check
GET  /api/v1/health                   - v1 health check
GET  /api/v1/health/detailed          - Detailed system health
GET  /api/v1/health/live              - Kubernetes liveness probe
GET  /api/v1/health/ready             - Kubernetes readiness probe
GET  /api/v1/health/info              - System information
GET  /api/v1/health/smoke             - Smoke test
```

### 📊 Analytics (7 endpoints)
```
GET  /api/v1/analytics/sla/realtime            - Real-time SLA status
GET  /api/v1/analytics/sla/compliance          - SLA compliance metrics
GET  /api/v1/analytics/sla/trend               - SLA trend analysis
GET  /api/v1/analytics/fleet/performance       - Fleet performance data
GET  /api/v1/analytics/dashboard/summary       - Dashboard summary
```

### 📈 Production Metrics (11 endpoints)
```
GET  /api/v1/production-metrics/on-time-delivery       - On-time delivery rate
GET  /api/v1/production-metrics/completion-rate        - Order completion rate
GET  /api/v1/production-metrics/delivery-time          - Average delivery time
GET  /api/v1/production-metrics/courier-performance    - Courier rankings
GET  /api/v1/production-metrics/cancellation-rate      - Cancellation metrics
GET  /api/v1/production-metrics/return-rate            - Return rate data
GET  /api/v1/production-metrics/fleet-utilization      - Fleet utilization
GET  /api/v1/production-metrics/order-distribution     - Order status distribution
GET  /api/v1/production-metrics/comprehensive          - All metrics combined
GET  /api/v1/production-metrics/sla/at-risk            - At-risk orders
GET  /api/v1/production-metrics/sla/compliance         - SLA compliance
```

### 🤖 Automation Engines (30+ endpoints)

#### Auto-Dispatch
```
POST GET  /api/v1/automation/dispatch/start            - Start engine
POST      /api/v1/automation/dispatch/stop             - Stop engine
GET       /api/v1/automation/dispatch/status           - Get status
GET       /api/v1/automation/dispatch/stats            - Get statistics
POST      /api/v1/automation/dispatch/assign/:orderId  - Manual assignment
```

#### Dynamic Route Optimization
```
POST GET  /api/v1/automation/routes/start              - Start optimizer
POST      /api/v1/automation/routes/stop               - Stop optimizer
GET       /api/v1/automation/routes/status             - Get status
GET       /api/v1/automation/routes/stats              - Get statistics
POST      /api/v1/automation/routes/optimize/:driverId - Manual optimization
POST      /api/v1/automation/routes/traffic-incident   - Report incident
```

#### Smart Batching
```
POST GET  /api/v1/automation/batching/start            - Start engine
POST      /api/v1/automation/batching/stop             - Stop engine
GET       /api/v1/automation/batching/status           - Get status
GET       /api/v1/automation/batching/stats            - Get statistics
POST      /api/v1/automation/batching/process          - Manual trigger
GET       /api/v1/automation/batching/batch/:batchId   - Get batch details
```

#### Autonomous Escalation
```
POST GET  /api/v1/automation/escalation/start          - Start engine
POST      /api/v1/automation/escalation/stop           - Stop engine
GET       /api/v1/automation/escalation/status         - Get status
GET       /api/v1/automation/escalation/stats          - Get statistics
GET       /api/v1/automation/escalation/logs           - Get logs
GET       /api/v1/automation/escalation/alerts         - Get active alerts
POST      /api/v1/automation/escalation/alerts/:id/resolve - Resolve alert
GET       /api/v1/automation/escalation/at-risk-orders - Get at-risk orders
```

#### Master Control
```
POST GET  /api/v1/automation/start-all                 - Start all engines
POST      /api/v1/automation/stop-all                  - Stop all engines
GET       /api/v1/automation/status-all                - Get all statuses
GET       /api/v1/automation/dashboard                 - Master dashboard
```

### 🔐 Authentication (6 endpoints)
```
POST GET  /api/v1/auth/register          - Register new user
POST      /api/v1/auth/login             - Login user
POST      /api/v1/auth/refresh           - Refresh token
POST      /api/v1/auth/logout            - Logout user
GET       /api/v1/auth/me                - Get profile
POST      /api/v1/auth/change-password   - Change password
```

### 🤖 AI Agents (14+ endpoints)
```
GET  POST /api/v1/agents/status                 - System status
GET       /api/v1/agents/health                 - Agent health
GET       /api/v1/agents/fleet/status           - Fleet status
GET       /api/v1/agents/sla/monitor            - SLA monitoring
POST      /api/v1/agents/order/assign           - AI assignment
POST      /api/v1/agents/batch/optimize         - Batch optimization
GET       /api/v1/agents/demand/forecast        - Demand forecast
GET       /api/v1/agents/geo/intelligence       - Geo intelligence
GET       /api/v1/agents/traffic/patterns       - Traffic patterns
GET       /api/v1/agents/performance/analytics  - Performance analytics
POST      /api/v1/agents/emergency/escalate     - Emergency escalation
POST      /api/v1/agents/recovery/initiate      - Order recovery
POST      /api/v1/agents/fleet/rebalance        - Fleet rebalancing
POST      /api/v1/agents/orchestrate            - Multi-agent orchestration
POST      /api/v1/agents/initialize             - Initialize system
POST      /api/v1/agents/shutdown               - Shutdown system
```

### 🗺️ Route Optimization (4 endpoints)
```
POST GET  /api/v1/optimization                  - Optimize routes
GET       /api/v1/optimization/history          - Get history
GET       /api/v1/optimization/status/:id       - Get status
GET       /api/v1/optimization/:id              - Get result
DELETE    /api/v1/optimization/db/clear         - Clear data (admin)
```

### ℹ️ API Information (2 endpoints)
```
GET  /api                                       - API root info
GET  /api/v1                                    - Version info
```

---

## Authentication Requirements

### Public Endpoints (No Auth Required)
- Health checks (`/health`, `/api/v1/health/*`)
- API info (`/api`, `/api/v1`)
- Auth endpoints (`/api/v1/auth/register`, `/api/v1/auth/login`)
- Optimization (temporarily public for testing)

### Protected Endpoints (Auth Required)

#### Dispatcher Role
- Order assignment
- Batch optimization
- Fleet rebalancing
- Order recovery

#### Manager Role
- All dispatcher permissions
- SLA monitoring
- Performance analytics
- Demand forecasting
- Geo intelligence

#### Admin Role
- All manager permissions
- Agent system control
- Automation engine control
- Emergency escalation
- System health monitoring

#### Super Admin Role
- All admin permissions
- Agent initialization/shutdown
- Database operations
- System configuration

---

## Common Query Parameters

### Date Range Parameters
```
?days=7              - Last 7 days (default for most)
?days=30             - Last 30 days
?start_date=YYYY-MM-DD - Custom start date
?end_date=YYYY-MM-DD   - Custom end date
```

### Pagination Parameters
```
?limit=10            - Number of items (default varies)
?page=1              - Page number
?offset=0            - Offset for pagination
```

### Filter Parameters
```
?service_type=BARQ   - Filter by service type
?status=active       - Filter by status
?severity=high       - Filter by severity
?type=SLA_RISK       - Filter by type
```

---

## Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2025-11-11T00:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "message": "Detailed error description",
  "code": "ERROR_CODE"
}
```

### Health Response
```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2025-11-11T00:00:00.000Z",
  "checks": {
    "database": { "healthy": true },
    "agents": { "healthy": true },
    "websocket": { "healthy": false }
  }
}
```

---

## Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 422 | Validation Error | Data validation failed |
| 500 | Internal Error | Server error |
| 503 | Service Unavailable | System not ready |

---

## Rate Limits

- **Default:** 100 requests per minute per IP
- **Authenticated:** 1000 requests per minute per user
- **Admin:** Unlimited

---

## WebSocket Endpoints

```
WS  ws://localhost:8081/health          - WebSocket health (currently down)
WS  ws://localhost:8081/realtime        - Real-time updates (currently down)
```

---

## Admin Health Endpoints (Require Admin Auth)

```
GET  /api/v1/health/metrics                     - Prometheus metrics
GET  /api/v1/health/dependencies                - Dependency health
GET  /api/v1/health/circuit-breakers            - Circuit breaker status
POST /api/v1/health/circuit-breakers/:name/reset - Reset breaker
GET  /api/v1/health/alerts/stats                - Alert statistics
POST /api/v1/health/alerts/test                 - Test alert
GET  /api/v1/health/audit/logs                  - Audit logs
GET  /api/v1/health/audit/stats                 - Audit statistics
POST /api/v1/health/audit/verify                - Verify integrity
```

---

## Endpoint Status Legend

- ✅ Working perfectly
- ⚠️ Working with minor issues
- ❌ Not working / failing
- ⏱️ Performance issues (slow)
- 🔒 Requires authentication
- 🔑 Requires admin/super-admin

---

**For detailed test results, see:** [TEST_REPORT.md](./TEST_REPORT.md)
**For test script, see:** [comprehensive-endpoint-test.sh](./comprehensive-endpoint-test.sh)
