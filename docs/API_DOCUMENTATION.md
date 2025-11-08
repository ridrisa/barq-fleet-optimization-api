# AI Logistics Optimization API Documentation

## Table of Contents
- [Overview](#overview)
- [Base URLs](#base-urls)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
  - [Health Check](#health-check)
  - [Route Optimization](#route-optimization)
  - [Agent Management](#agent-management)
  - [Fleet Status](#fleet-status)
  - [SLA Monitoring](#sla-monitoring)
  - [Order Assignment](#order-assignment)
  - [Batch Optimization](#batch-optimization)
  - [Demand Forecasting](#demand-forecasting)
  - [Geo Intelligence](#geo-intelligence)
  - [Traffic Patterns](#traffic-patterns)
  - [Performance Analytics](#performance-analytics)
  - [Emergency Management](#emergency-management)
  - [Order Recovery](#order-recovery)
  - [WebSocket Events](#websocket-events)

---

## Overview

The AI Logistics Optimization API provides AI-powered route optimization and fleet management for instant delivery operations with two service types:
- **BARQ**: 1-hour delivery within 5km radius
- **BULLET**: 2-4 hour delivery city-wide

The system uses 18+ specialized AI agents working together to optimize operations in real-time.

### API Version
Current Version: `v1`

### Request/Response Format
- All requests and responses use JSON format
- Timestamps are in ISO 8601 format
- Coordinates use WGS84 (latitude, longitude)

---

## Authentication

The API uses JWT (JSON Web Token) based authentication with role-based access control (RBAC). All protected endpoints require a valid Bearer token in the Authorization header.

**Supported Roles:**
- `super_admin` - Full system access
- `admin` - Administrative operations
- `manager` - Fleet and order management
- `dispatcher` - Order assignment and tracking
- `driver` - Driver-specific operations
- `customer` - Customer-facing operations
- `external_service` - Third-party integrations

### Obtaining a Token

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "dispatcher",
      "permissions": ["orders.create", "orders.read"]
    }
  }
}
```

### Using the Token

Include the token in the Authorization header:
```http
Authorization: Bearer YOUR_JWT_TOKEN
```

### API Key Authentication

For external services, use API key authentication:
```http
X-API-Key: YOUR_API_KEY
```

---

## Base URLs

- **Development**: `http://localhost:3003`
- **WebSocket**: `ws://localhost:8081`
- **Frontend Dashboard**: `http://localhost:3001`
- **Demo Dashboard**: `http://localhost:3001/demo`

---

## Rate Limiting

- **General API**: 100 requests per 15 minutes
- **Authentication**: 5 requests per 15 minutes
- **Order Creation**: 10 requests per minute
- **API Key**: 1000 requests per minute

Rate limit headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Reset time (Unix timestamp)

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "status": "error",
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ],
  "timestamp": "2024-11-04T12:00:00.000Z"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests
- `500` - Internal Server Error
- `502` - Bad Gateway
- `503` - Service Unavailable

---

## Endpoints

### Health Check

#### Basic Health Check
```http
GET /health

Response:
{
  "status": "healthy",
  "timestamp": "2024-11-04T12:00:00.000Z"
}
```

#### Detailed Health Check
```http
GET /health/detailed

Response:
{
  "status": "healthy",
  "uptime": 3600,
  "version": "1.0.0",
  "checks": {
    "database": { "healthy": true },
    "redis": { "healthy": true },
    "agents": { "healthy": true, "count": 18 }
  }
}
```

---

### Route Optimization

#### Optimize Route
```http
POST /api/v1/optimize
Content-Type: application/json

{
  "pickups": [
    {
      "id": "pickup1",
      "name": "Restaurant A",
      "address": "123 Main St",
      "coordinates": { "lat": 24.7136, "lng": 46.6753 }
    }
  ],
  "deliveries": [
    {
      "id": "delivery1",
      "name": "Customer 1",
      "address": "456 King Fahd Rd",
      "coordinates": { "lat": 24.7236, "lng": 46.6853 }
    }
  ],
  "constraints": {
    "maxDistance": 50,
    "maxTime": 120
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requestId": "uuid",
    "routes": [...],
    "totalDistance": 25.5,
    "totalTime": 45,
    "optimizedSequence": [...]
  }
}
```

#### Get Optimization Result
```http
GET /api/v1/optimize/{requestId}
```

#### Get Optimization Status
```http
GET /api/v1/optimize/status/{requestId}
```

#### Get Optimization History
```http
GET /api/v1/optimize/history?limit=10&page=1
```

#### Clear All Data
```http
DELETE /api/v1/optimize/db/clear
```

---

### Agent Management

#### Get System Status
```http
GET /api/v1/agents/status

Response:
{
  "success": true,
  "systemStatus": {
    "initialized": true,
    "uptime": 3600,
    "agents": [...],
    "health": {
      "healthy": 18,
      "unhealthy": 0
    }
  }
}
```

#### Get Agent Health
```http
GET /api/v1/agents/health

Response:
{
  "success": true,
  "summary": {
    "totalAgents": 18,
    "healthyAgents": 18,
    "unhealthyAgents": 0
  },
  "agents": {
    "masterOrchestrator": true,
    "orderAssignment": true,
    ...
  }
}
```

#### Initialize Agents
```http
POST /api/v1/agents/initialize
```

#### Shutdown Agents
```http
POST /api/v1/agents/shutdown
```

---

### Fleet Status

#### Get Fleet Status
```http
GET /api/v1/agents/fleet/status

Response:
{
  "success": true,
  "data": {
    "totalDrivers": 50,
    "available": 20,
    "busy": 25,
    "offline": 5,
    "utilization": 0.75
  }
}
```

#### Rebalance Fleet
```http
POST /api/v1/agents/fleet/rebalance

Response:
{
  "success": true,
  "data": {
    "rebalancingActions": [...],
    "affectedDrivers": 10
  }
}
```

---

### SLA Monitoring

#### Get SLA Status
```http
GET /api/v1/agents/sla/monitor

Response:
{
  "success": true,
  "data": {
    "compliance": 0.95,
    "atRiskOrders": [...],
    "criticalOrders": [...]
  }
}
```

---

### Order Assignment

#### Assign Order to Driver
```http
POST /api/v1/agents/order/assign
Content-Type: application/json

{
  "order": {
    "id": "ORDER-123",
    "serviceType": "BARQ",
    "pickup": {
      "coordinates": { "lat": 24.7136, "lng": 46.6753 }
    },
    "delivery": {
      "coordinates": { "lat": 24.7236, "lng": 46.6853 }
    }
  }
}

Response:
{
  "success": true,
  "data": {
    "assignedDriver": "DRV-456",
    "estimatedTime": 45,
    "confidence": 0.92
  }
}
```

---

### Batch Optimization

#### Optimize Batch Orders
```http
POST /api/v1/agents/batch/optimize
Content-Type: application/json

{
  "orders": [
    { "id": "ORDER-1", ... },
    { "id": "ORDER-2", ... }
  ],
  "serviceType": "BULLET"
}

Response:
{
  "success": true,
  "data": {
    "batches": [...],
    "savings": {
      "distance": 12.5,
      "time": 25
    }
  }
}
```

---

### Demand Forecasting

#### Get Demand Forecast
```http
GET /api/v1/agents/demand/forecast?horizon=60

Response:
{
  "success": true,
  "data": {
    "forecasts": [
      {
        "horizon": 30,
        "predictedOrders": 25,
        "confidence": 0.85
      }
    ]
  }
}
```

---

### Geo Intelligence

#### Get Geo Intelligence
```http
GET /api/v1/agents/geo/intelligence

Response:
{
  "success": true,
  "data": {
    "hotspots": [...],
    "zones": [...],
    "recommendations": [...]
  }
}
```

---

### Traffic Patterns

#### Get Traffic Patterns
```http
GET /api/v1/agents/traffic/patterns

Response:
{
  "success": true,
  "data": {
    "currentConditions": {...},
    "predictions": [...],
    "congestionZones": [...]
  }
}
```

---

### Performance Analytics

#### Get Performance Analytics
```http
GET /api/v1/agents/performance/analytics

Response:
{
  "success": true,
  "data": {
    "kpis": {...},
    "trends": [...],
    "insights": [...]
  }
}
```

---

### Emergency Management

#### Escalate Emergency
```http
POST /api/v1/agents/emergency/escalate
Content-Type: application/json

{
  "type": "SLA_CRITICAL",
  "level": "L2",
  "context": {
    "orderId": "ORDER-123",
    "description": "Customer urgent request"
  }
}

Response:
{
  "success": true,
  "data": {
    "escalationId": "ESC-789",
    "actions": [...],
    "notifiedParties": [...]
  }
}
```

---

### Order Recovery

#### Initiate Order Recovery
```http
POST /api/v1/agents/recovery/initiate
Content-Type: application/json

{
  "orderId": "ORDER-123",
  "reason": "Driver unavailable"
}

Response:
{
  "success": true,
  "data": {
    "recoveryPlan": {...},
    "reassignedDriver": "DRV-789"
  }
}
```

---

### Orchestration

#### Orchestrate Multi-Agent Operation
```http
POST /api/v1/agents/orchestrate
Content-Type: application/json

{
  "event": {
    "type": "NEW_ORDER_BATCH",
    "data": {
      "orders": [...],
      "priority": "high"
    }
  }
}

Response:
{
  "success": true,
  "data": {
    "orchestrationId": "ORCH-123",
    "agentsInvolved": [...],
    "result": {...}
  }
}
```

---

**Note**: The following endpoints (Orders, Drivers, Analytics) are planned for future releases and are not yet implemented. The system currently focuses on route optimization and AI agent operations.

## WebSocket Events

Connect to WebSocket server for real-time updates:

```javascript
const ws = new WebSocket('wss://ws.barq-logistics.com');

// Subscribe to events
ws.send(JSON.stringify({
  type: 'subscribe',
  events: ['orders', 'drivers', 'alerts']
}));
```

### Event Types

#### Order Events
- `orderCreated` - New order created
- `orderAssigned` - Order assigned to driver
- `orderPickedUp` - Order picked up
- `orderDelivered` - Order delivered
- `orderFailed` - Order delivery failed

#### Driver Events
- `driverOnline` - Driver came online
- `driverOffline` - Driver went offline
- `driverLocationUpdate` - Driver location changed

#### Alert Events
- `slaWarning` - SLA breach warning
- `emergencyAlert` - Emergency situation
- `systemAlert` - System-level alert

### Event Format

```json
{
  "type": "orderCreated",
  "data": {
    "orderId": "uuid",
    "orderNumber": "ORD-123",
    "serviceType": "BARQ",
    "status": "pending"
  },
  "timestamp": "2024-11-04T12:00:00.000Z"
}
```

---

## SDK Examples

### JavaScript/Node.js
```javascript
const BarqAPI = require('@barq/logistics-sdk');

const client = new BarqAPI({
  apiKey: 'YOUR_API_KEY',
  environment: 'production'
});

// Create order
const order = await client.orders.create({
  serviceType: 'BARQ',
  pickup: { /* ... */ },
  dropoff: { /* ... */ }
});

// Track order
const status = await client.orders.track(order.orderNumber);
```

### Python
```python
from barq_logistics import BarqClient

client = BarqClient(api_key='YOUR_API_KEY')

# Create order
order = client.orders.create(
    service_type='BARQ',
    pickup={...},
    dropoff={...}
)

# Get analytics
metrics = client.analytics.dashboard(
    start_date='2024-11-01',
    end_date='2024-11-04'
)
```

---

## Postman Collection

Download our Postman collection for easy API testing:
[Download Postman Collection](https://api.barq-logistics.com/docs/postman-collection.json)

---

## Support

- **Email**: api-support@barq-logistics.com
- **Documentation**: https://docs.barq-logistics.com
- **Status Page**: https://status.barq-logistics.com
- **Developer Portal**: https://developers.barq-logistics.com

---

## Changelog

### v1.0.0 (2024-11-04)
- Initial API release
- BARQ and BULLET service types
- Real-time tracking via WebSocket
- Multi-agent AI optimization
- JWT authentication
- Comprehensive analytics

---

## License

Copyright © 2024 BARQ Logistics. All rights reserved.