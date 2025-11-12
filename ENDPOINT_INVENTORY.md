# 📡 BARQ Fleet Management API - Complete Endpoint Inventory

**Last Updated**: 2025-11-11
**API Version**: v1
**Base URL**: `https://route-opt-backend-sek7q2ajva-uc.a.run.app`

---

## 📋 Table of Contents

1. [System Endpoints](#system-endpoints)
2. [Authentication & Authorization](#authentication--authorization)
3. [Route Optimization](#route-optimization)
4. [AI & Agents](#ai--agents)
5. [Analytics & Metrics](#analytics--metrics)
6. [Autonomous Operations](#autonomous-operations)
7. [Automation & Workflows](#automation--workflows)
8. [Admin & Monitoring](#admin--monitoring)
9. [Health & Status](#health--status)

---

## 🔧 System Endpoints

### Root & Info
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/` | API information and available endpoints | ✅ Live |
| GET | `/api` | API root with version info | ✅ Live |
| GET | `/api/v1` | API v1 information | ✅ Live |
| GET | `/api/version` | API version details | ✅ Live |
| GET | `/api/versions` | All API versions info | ✅ Live |

### Documentation
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api-docs` | Swagger UI documentation | ✅ Live |
| GET | `/metrics` | Prometheus metrics | ✅ Live |

---

## 🔐 Authentication & Authorization

**Base Path**: `/api/v1/auth` or `/api/auth` (backward compatible)

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| POST | `/register` | Register new user | ❌ | Public |
| POST | `/login` | User login | ❌ | Public |
| POST | `/refresh` | Refresh access token | ✅ | All |
| POST | `/logout` | User logout | ✅ | All |
| GET | `/me` | Get current user profile | ✅ | All |

**Roles**: `ADMIN`, `MANAGER`, `DISPATCHER`, `DRIVER`, `USER`

---

## 🚛 Route Optimization

**Base Path**: `/api/v1/optimize` or `/api/optimize` (backward compatible)

### Core Optimization
| Method | Endpoint | Description | Auth Required | Status |
|--------|----------|-------------|---------------|--------|
| POST | `/` | Optimize delivery routes | ⚠️ Temp disabled | ✅ Live |
| GET | `/history` | Get optimization history | ⚠️ Temp disabled | ✅ Live |
| GET | `/history/:id` | Get specific optimization | ⚠️ Temp disabled | ✅ Live |
| GET | `/stats` | Optimization statistics | ⚠️ Temp disabled | ✅ Live |

---

## 🤖 AI & Agents

### AI Query Engine
**Base Path**: `/api/v1/ai-query`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/catalog` | Get available AI queries | ✅ Live |
| GET | `/categories` | Get query categories | ✅ Live |
| POST | `/execute` | Execute AI query | ✅ Live |
| POST | `/execute-batch` | Execute multiple queries | ✅ Live |
| POST | `/ask` | Natural language query | ✅ Live |
| GET | `/query/:queryName` | Get specific query details | ✅ Live |

### AI Agent Management
**Base Path**: `/api/v1/agents`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/health` | Agent system health | ✅ Live |
| POST | `/initialize` | Initialize agent system | ✅ Live |
| POST | `/shutdown` | Shutdown agent system | ✅ Live |

---

## 📊 Analytics & Metrics

### SLA Analytics
**Base Path**: `/api/v1/analytics`

| Method | Endpoint | Description | Response Time | Status |
|--------|----------|-------------|---------------|--------|
| GET | `/sla/realtime` | Real-time SLA metrics | ~200ms | ✅ Live |
| GET | `/sla/compliance` | SLA compliance report | ~300ms | ✅ Live |
| GET | `/sla/trend` | SLA trend analysis | ~400ms | ✅ Live |

### Fleet Analytics
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/fleet/performance` | Fleet performance metrics | ✅ Live |
| GET | `/fleet/drivers` | Driver analytics | ✅ Live |
| GET | `/fleet/drivers/:id` | Individual driver stats | ✅ Live |
| GET | `/fleet/vehicles` | Vehicle analytics | ✅ Live |

### Route Analytics
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/routes/efficiency` | Route efficiency metrics | ✅ Live |

### Dashboard
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/dashboard/summary` | Dashboard summary | ✅ Live |

---

## 📈 Production Metrics

**Base Path**: `/api/v1/production-metrics`

### Delivery Metrics
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/on-time-delivery` | On-time delivery rate | ✅ Live |
| GET | `/completion-rate` | Order completion rate | ✅ Live |
| GET | `/delivery-time` | Average delivery time | ✅ Live |
| GET | `/cancellation-rate` | Order cancellation rate | ✅ Live |
| GET | `/return-rate` | Order return rate | ✅ Live |

### Performance Metrics
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/courier-performance` | Courier performance metrics | ✅ Live |
| GET | `/fleet-utilization` | Fleet utilization stats | ✅ Live |
| GET | `/order-distribution` | Order distribution analysis | ✅ Live |

### SLA Metrics
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/sla/at-risk` | At-risk orders | ✅ Live |
| GET | `/sla/compliance` | SLA compliance | ✅ Live |

### Comprehensive
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/comprehensive` | All metrics combined | ✅ Live |

---

## 🚀 Autonomous Operations

**Base Path**: `/api/v1/autonomous`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/status` | Autonomous system status | ✅ Live |
| POST | `/start` | Start autonomous operations | ✅ Live |
| POST | `/stop` | Stop autonomous operations | ✅ Live |
| GET | `/cycles` | Get cycle results | ✅ Live |
| GET | `/logs` | Get operation logs | ✅ Live |
| POST | `/execute-action` | Execute specific action | ✅ Live |

---

## ⚙️ Automation & Workflows

**Base Path**: `/api/v1/automation`

### Dispatch Automation
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/dispatch/start` | Start auto-dispatch | ✅ Live |
| POST | `/dispatch/stop` | Stop auto-dispatch | ✅ Live |
| GET | `/dispatch/status` | Dispatch status | ✅ Live |
| GET | `/dispatch/stats` | Dispatch statistics | ✅ Live |
| POST | `/dispatch/assign/:orderId` | Assign order to courier | ✅ Live |

### Route Automation
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/routes/start` | Start auto-routing | ✅ Live |
| POST | `/routes/stop` | Stop auto-routing | ✅ Live |
| GET | `/routes/status` | Routing status | ✅ Live |
| GET | `/routes/stats` | Routing statistics | ✅ Live |
| POST | `/routes/optimize/:driverId` | Optimize driver route | ✅ Live |
| POST | `/routes/traffic-incident` | Report traffic incident | ✅ Live |

### Order Batching
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/batching/start` | Start auto-batching | ✅ Live |
| POST | `/batching/stop` | Stop auto-batching | ✅ Live |
| GET | `/batching/status` | Batching status | ✅ Live |
| GET | `/batching/stats` | Batching statistics | ✅ Live |
| POST | `/batching/process` | Process batch | ✅ Live |
| GET | `/batching/batch/:batchId` | Get batch details | ✅ Live |

### Escalation Management
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/escalation/start` | Start escalation system | ✅ Live |
| POST | `/escalation/stop` | Stop escalation system | ✅ Live |
| GET | `/escalation/status` | Escalation status | ✅ Live |
| GET | `/escalation/stats` | Escalation statistics | ✅ Live |
| GET | `/escalation/logs` | Escalation logs | ✅ Live |
| GET | `/escalation/alerts` | Active alerts | ✅ Live |
| POST | `/escalation/alerts/:alertId/resolve` | Resolve alert | ✅ Live |
| GET | `/escalation/at-risk-orders` | At-risk orders | ✅ Live |

### Master Controls
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/start-all` | Start all automation | ✅ Live |
| POST | `/stop-all` | Stop all automation | ✅ Live |
| GET | `/status-all` | All automation status | ✅ Live |
| GET | `/dashboard` | Automation dashboard | ✅ Live |

---

## 🛠️ Admin & Monitoring

**Base Path**: `/api/v1/admin`

### Agent Monitoring
| Method | Endpoint | Description | Auth Required | Status |
|--------|----------|-------------|---------------|--------|
| GET | `/agents/status` | All agent statuses | ✅ Admin | ✅ Live |
| GET | `/agents/:agentName` | Specific agent status | ✅ Admin | ✅ Live |
| POST | `/agents/:agentName/enable` | Enable agent | ✅ Admin | ✅ Live |
| POST | `/agents/:agentName/disable` | Disable agent | ✅ Admin | ✅ Live |
| POST | `/agents/:agentName/restart` | Restart agent | ✅ Admin | ✅ Live |

### System Management
| Method | Endpoint | Description | Auth Required | Status |
|--------|----------|-------------|---------------|--------|
| GET | `/system/info` | System information | ✅ Admin | ✅ Live |
| GET | `/system/logs` | System logs | ✅ Admin | ✅ Live |
| POST | `/system/clear-cache` | Clear system cache | ✅ Admin | ✅ Live |

---

## ❤️ Health & Status

### Health Checks
| Method | Endpoint | Description | Response Format | Status |
|--------|----------|-------------|-----------------|--------|
| GET | `/health` | Main health check | JSON | ✅ Live |
| GET | `/health/live` | Liveness probe | JSON | ✅ Live |
| GET | `/health/ready` | Readiness probe | JSON | ✅ Live |
| GET | `/health/info` | Detailed health info | JSON | ✅ Live |
| GET | `/api/health` | API health alias | JSON | ✅ Live |
| GET | `/api/v1/health` | v1 health endpoint | JSON | ✅ Live |

---

## 📊 Endpoint Statistics

### By Category
- **System**: 7 endpoints
- **Authentication**: 5 endpoints
- **Optimization**: 4 endpoints
- **AI & Agents**: 9 endpoints
- **Analytics**: 11 endpoints
- **Production Metrics**: 11 endpoints
- **Autonomous**: 6 endpoints
- **Automation**: 29 endpoints
- **Admin**: 8 endpoints
- **Health**: 6 endpoints

**Total**: **96 API endpoints**

### By Method
- **GET**: ~62 endpoints
- **POST**: ~34 endpoints

### By Status
- ✅ **Live**: 92+ endpoints
- ⚠️ **Auth Temp Disabled**: 4 endpoints (optimization)

---

## 🚀 Quick Start Examples

### Optimize Route
```bash
curl -X POST https://route-opt-backend-sek7q2ajva-uc.a.run.app/api/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "pickupPoints": [{"lat": 24.7136, "lng": 46.6753, "name": "Hub"}],
    "deliveryPoints": [{"lat": 24.724, "lng": 46.68, "name": "Customer"}],
    "fleet": {"vehicleType": "car", "count": 1, "capacity": 1000}
  }'
```

### Get SLA Metrics
```bash
curl https://route-opt-backend-sek7q2ajva-uc.a.run.app/api/v1/analytics/sla/realtime
```

### Check Health
```bash
curl https://route-opt-backend-sek7q2ajva-uc.a.run.app/health
```

---

**Generated**: 2025-11-11
**API Version**: v1.0.0
**Status**: Production
