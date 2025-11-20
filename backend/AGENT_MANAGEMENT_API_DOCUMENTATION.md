# Agent Management API Documentation

## Overview

This document outlines the comprehensive Agent Management API system that provides full CRUD operations, real-time monitoring, and advanced control capabilities for the AI agent ecosystem.

## Features Implemented

### 1. Agent Control Operations
- **Start/Stop/Restart** individual agents
- **Status monitoring** with detailed health information
- **Log retrieval** with filtering capabilities
- **Execution history** tracking

### 2. Configuration Management
- **Dynamic configuration** updates without restarts
- **Configuration validation** with comprehensive schemas
- **Default configuration** management
- **Configuration backup/restore** functionality

### 3. Real-time Monitoring
- **WebSocket integration** for live updates
- **Event-driven notifications** for agent state changes
- **Performance metrics** streaming
- **System health monitoring**

### 4. Bulk Operations
- **Batch start/stop** operations for multiple agents
- **Bulk status retrieval** for monitoring dashboards
- **Efficient resource management** for large-scale operations

### 5. Individual Agent APIs
- **Agent-specific endpoints** for specialized functionality
- **SLA monitoring** with customizable thresholds
- **Traffic pattern analysis** and forecasting
- **Fleet status** and utilization metrics

---

## API Endpoints

### Agent Control Operations

#### Start Agent
```http
POST /api/v1/agents/{agentId}/start
```
**Description**: Start a specific agent by ID
**Authentication**: Admin, Manager
**Response**: Agent start status and confirmation

#### Stop Agent
```http
POST /api/v1/agents/{agentId}/stop
```
**Description**: Stop a specific agent by ID
**Authentication**: Admin, Manager
**Response**: Agent stop status and confirmation

#### Restart Agent
```http
POST /api/v1/agents/{agentId}/restart
```
**Description**: Restart a specific agent by ID
**Authentication**: Admin, Manager
**Response**: Agent restart status and confirmation

#### Get Agent Status
```http
GET /api/v1/agents/{agentId}/status
```
**Description**: Get detailed status of a specific agent
**Authentication**: Admin, Manager, Dispatcher
**Response**: Comprehensive agent status including state, metrics, and configuration

#### Get Agent Logs
```http
GET /api/v1/agents/{agentId}/logs?limit=50&level=info
```
**Description**: Retrieve recent logs for a specific agent
**Authentication**: Admin, Manager
**Query Parameters**:
- `limit`: Number of log entries (1-1000, default: 50)
- `level`: Filter by log level (debug, info, warn, error)
**Response**: Filtered log entries with metadata

---

### Configuration Management

#### Get Agent Configuration
```http
GET /api/v1/agents/{agentId}/config
```
**Description**: Retrieve configuration for a specific agent
**Authentication**: Admin, Manager
**Response**: Current agent configuration

#### Update Agent Configuration
```http
PUT /api/v1/agents/{agentId}/config
```
**Description**: Update configuration for a specific agent
**Authentication**: Admin
**Request Body**:
```json
{
  "interval": 10000,
  "timeout": 30000,
  "retryAttempts": 3,
  "enabled": true,
  "logLevel": "info"
}
```
**Response**: Updated configuration

#### Reset Agent Configuration
```http
POST /api/v1/agents/{agentId}/config/reset
```
**Description**: Reset agent configuration to defaults
**Authentication**: Admin
**Response**: Default configuration applied

---

### Monitoring and Metrics

#### Get Agent Health
```http
GET /api/v1/agents/{agentId}/health
```
**Description**: Get health status and diagnostic information
**Authentication**: Admin, Manager
**Response**: Health score, issues, and recommendations

#### Get Agent Metrics
```http
GET /api/v1/agents/{agentId}/metrics
```
**Description**: Get performance metrics for a specific agent
**Authentication**: Admin, Manager
**Response**: Performance data, execution statistics, and custom metrics

#### Get Agent History
```http
GET /api/v1/agents/{agentId}/history?limit=20
```
**Description**: Get execution history for a specific agent
**Authentication**: Admin, Manager
**Query Parameters**:
- `limit`: Number of executions (1-100, default: 20)
**Response**: Execution history with timestamps and results

---

### Bulk Operations

#### Bulk Start Agents
```http
POST /api/v1/agents/bulk/start
```
**Description**: Start multiple agents in bulk
**Authentication**: Admin
**Request Body**:
```json
{
  "agentIds": ["agent1", "agent2", "agent3"]
}
```
**Response**: Operation results with success/failure summary

#### Bulk Stop Agents
```http
POST /api/v1/agents/bulk/stop
```
**Description**: Stop multiple agents in bulk
**Authentication**: Admin
**Request Body**:
```json
{
  "agentIds": ["agent1", "agent2", "agent3"]
}
```
**Response**: Operation results with success/failure summary

#### Bulk Get Status
```http
POST /api/v1/agents/bulk/status
```
**Description**: Get status of multiple agents in bulk
**Authentication**: Admin, Manager
**Request Body**:
```json
{
  "agentIds": ["agent1", "agent2", "agent3"]
}
```
**Response**: Status information for all requested agents

---

### System Monitoring

#### Get System Metrics
```http
GET /api/v1/agents/system/metrics
```
**Description**: Get comprehensive system metrics and performance data
**Authentication**: Admin, Manager
**Response**: System-wide performance metrics and resource usage

#### Get Real-time Updates
```http
GET /api/v1/agents/system/realtime
```
**Description**: Get real-time agent and system status updates
**Authentication**: Admin, Manager
**Response**: Current system state with live metrics

---

### Individual Agent APIs

#### SLA Monitor Dashboard
```http
GET /api/v1/agents/individual/sla-monitor/dashboard
```
**Description**: Get comprehensive SLA monitoring dashboard data
**Authentication**: Admin, Manager
**Response**: SLA metrics, alerts, and compliance status

#### SLA Alerts
```http
GET /api/v1/agents/individual/sla-monitor/alerts?severity=high&status=active
```
**Description**: Get SLA alerts with filtering
**Authentication**: Admin, Manager
**Query Parameters**:
- `severity`: critical, high, medium, low
- `status`: active, resolved, acknowledged
**Response**: Filtered alert list

#### Order Assignment
```http
POST /api/v1/agents/individual/order-assignment/assign
```
**Description**: Assign order using AI optimization
**Authentication**: Admin, Dispatcher
**Request Body**:
```json
{
  "order": {
    "id": "order123",
    "serviceType": "BARQ",
    "pickup": {"lat": 40.7128, "lng": -74.0060},
    "delivery": {"lat": 40.7589, "lng": -73.9851}
  }
}
```
**Response**: Assignment result with driver and route information

#### Traffic Pattern Insights
```http
GET /api/v1/agents/individual/traffic-pattern/insights?area=manhattan&forecast=true
```
**Description**: Get traffic pattern insights and predictions
**Authentication**: Admin, Manager, Dispatcher
**Query Parameters**:
- `area`: Geographic area to analyze
- `forecast`: Include traffic forecasts (boolean)
**Response**: Traffic insights and predictions

#### Fleet Status Summary
```http
GET /api/v1/agents/individual/fleet-status/summary
```
**Description**: Get comprehensive fleet status summary
**Authentication**: Admin, Manager, Dispatcher
**Response**: Driver availability, vehicle status, and utilization metrics

---

## WebSocket Real-time Monitoring

### Connection Endpoint
```
ws://localhost:3003/ws/agents
```

### Authentication
Clients must authenticate within 10 seconds of connection:
```json
{
  "type": "auth",
  "data": {
    "token": "jwt_token_here",
    "userId": "user123",
    "role": "admin"
  }
}
```

### Subscription Topics
Subscribe to specific agent events:
```json
{
  "type": "subscribe",
  "data": {
    "topics": [
      "agent.*.status",
      "agent.*.metrics",
      "agent.sla-monitor.logs",
      "system.alerts",
      "system.metrics"
    ]
  }
}
```

### Real-time Events
- **agentStarted**: Agent startup notifications
- **agentStopped**: Agent shutdown notifications
- **agentRestarted**: Agent restart notifications
- **agentLog**: Real-time log streaming
- **agentMetrics**: Performance metric updates
- **systemAlert**: System-wide alerts and notifications

---

## Enhanced Agent Manager Service

### New Capabilities

#### State Management
- **Agent states**: idle, running, stopped, error, starting, stopping
- **State persistence** across service restarts
- **State transition validation** and logging

#### Logging System
- **Centralized logging** for all agents
- **Log level filtering** and retention policies
- **Real-time log streaming** via WebSocket
- **Log aggregation** and search capabilities

#### Metrics Collection
- **Performance tracking**: execution time, success rate, error count
- **Resource monitoring**: memory usage, CPU utilization
- **Custom metrics**: agent-specific KPIs and measurements
- **Health scoring**: automated health assessment

#### Configuration Management
- **Dynamic updates**: real-time configuration changes
- **Validation**: comprehensive input validation
- **Defaults**: intelligent default configuration
- **Backup/restore**: configuration versioning

---

## Validation Schemas

### Agent Configuration
```javascript
{
  interval: number (1000-3600000),      // Execution interval in ms
  timeout: number (1000-300000),        // Timeout in ms
  retryAttempts: number (0-10),         // Retry attempts
  retryDelay: number (100-60000),       // Retry delay in ms
  enabled: boolean,                     // Agent enabled status
  priority: string (low/medium/high/critical),
  logLevel: string (debug/info/warn/error),
  maxConcurrency: number (1-10),        // Max concurrent executions
  memoryLimit: number (64-2048),        // Memory limit in MB
  cpuLimit: number (0.1-2.0)           // CPU limit in cores
}
```

### Bulk Operations
```javascript
{
  agentIds: string[] (1-50 items)      // Array of agent identifiers
}
```

### WebSocket Events
```javascript
{
  type: string,                        // Event type
  agentName?: string,                  // Optional agent name
  data?: object,                       // Event data
  timestamp?: number                   // Event timestamp
}
```

---

## Error Handling

### Common Error Codes
- **400**: Bad Request - Invalid parameters or request body
- **401**: Unauthorized - Authentication required
- **403**: Forbidden - Insufficient permissions
- **404**: Not Found - Agent not found
- **409**: Conflict - Agent already in requested state
- **500**: Internal Server Error - Service unavailable
- **503**: Service Unavailable - Agent manager not available

### Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": 1234567890,
  "details": {
    "agentId": "agent123",
    "requestId": "req123"
  }
}
```

---

## Performance Considerations

### Optimization Features
- **Connection pooling** for WebSocket management
- **Event batching** for reduced network overhead
- **Caching** for frequently accessed data
- **Rate limiting** to prevent system overload
- **Circuit breakers** for resilient error handling

### Scalability
- **Horizontal scaling** support for multiple instances
- **Load balancing** for distributed agent management
- **Resource monitoring** for capacity planning
- **Auto-scaling** triggers based on system metrics

---

## Security Features

### Authentication & Authorization
- **JWT token validation** for all endpoints
- **Role-based access control** (RBAC)
- **Rate limiting** per user and endpoint
- **Audit logging** for security compliance

### Data Protection
- **Input validation** for all requests
- **SQL injection prevention** through parameterized queries
- **XSS protection** through output encoding
- **CSRF protection** via tokens

---

## Monitoring & Observability

### Health Checks
- **Service health** monitoring endpoints
- **Agent health** individual status checks
- **System health** overall system monitoring
- **Dependency health** external service checks

### Metrics & Alerts
- **Performance metrics** collection and aggregation
- **Custom alerts** based on configurable thresholds
- **Notification systems** for critical events
- **Dashboard integration** for visual monitoring

---

## Usage Examples

### Starting an Agent
```bash
curl -X POST \
  http://localhost:3003/api/v1/agents/sla-monitor/start \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Getting Agent Status
```bash
curl -X GET \
  http://localhost:3003/api/v1/agents/sla-monitor/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Updating Configuration
```bash
curl -X PUT \
  http://localhost:3003/api/v1/agents/sla-monitor/config \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "interval": 5000,
    "logLevel": "debug",
    "enabled": true
  }'
```

### WebSocket Connection (JavaScript)
```javascript
const ws = new WebSocket('ws://localhost:3003/ws/agents');

ws.onopen = () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    data: { token: 'YOUR_JWT_TOKEN' }
  }));
  
  // Subscribe to agent events
  ws.send(JSON.stringify({
    type: 'subscribe',
    data: { topics: ['agent.*.status', 'system.alerts'] }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

---

## Integration Points

### Frontend Integration
- **React components** for agent management UI
- **Real-time updates** via WebSocket connection
- **Dashboard widgets** for monitoring displays
- **Control panels** for administrative operations

### External Systems
- **Monitoring platforms** (Grafana, DataDog)
- **Alerting systems** (PagerDuty, Slack)
- **Logging aggregators** (ELK Stack, Splunk)
- **Service mesh** integration (Istio, Consul)

---

## Future Enhancements

### Planned Features
- **Auto-scaling** based on system load
- **Machine learning** for predictive monitoring
- **Advanced analytics** for performance optimization
- **Multi-tenancy** support for enterprise deployments

### Roadmap Items
- **Plugin system** for custom agent types
- **Workflow orchestration** for complex operations
- **Cost optimization** recommendations
- **Compliance reporting** for regulatory requirements

---

This comprehensive Agent Management API provides a robust foundation for managing, monitoring, and controlling AI agents in production environments with enterprise-grade features and scalability.