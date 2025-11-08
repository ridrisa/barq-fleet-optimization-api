# Autonomous Operations Guide

## Overview

The AI Logistics Optimization system includes **Autonomous Operations** - a feature that allows AI agents to monitor the system and automatically take actions without human intervention.

## Current Status

⚠️ **Important**: Autonomous operations are **DISABLED by default** due to performance considerations.

### Why Disabled?

The autonomous operations run CPU-intensive cycles that can block Node.js's single-threaded event loop, causing:
- API requests to timeout
- High CPU usage (90%+)
- Degraded system performance
- Poor user experience

### Solution Implemented

We've implemented a **Worker Thread** architecture to run autonomous operations in parallel without blocking the main API thread. However, this is currently in development.

## Architecture

### Main Thread Mode (Not Recommended)

```
┌─────────────────────────────────────┐
│   Express API Server (Main Thread)  │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  HTTP Request Handling         │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  Autonomous Operations ❌       │ │
│  │  • Blocks event loop           │ │
│  │  • High CPU usage              │ │
│  │  • Delays API responses        │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Worker Thread Mode (Recommended - In Development)

```
┌─────────────────────┐         ┌──────────────────────┐
│  Main Thread        │         │  Worker Thread       │
│                     │         │                      │
│  Express API Server │◄───────►│  Autonomous Ops      │
│  • Fast & Responsive│ Message │  • Non-blocking      │
│  • Low CPU usage    │ Passing │  • Parallel exec     │
│  • Handles requests │         │  • Isolated CPU      │
└─────────────────────┘         └──────────────────────┘
```

## Configuration

### File: `backend/src/services/autonomous-initializer.js`

```javascript
this.config = {
  cycleIntervalMs: 300000,              // 5 minutes
  enableContinuousOperation: false,     // Disabled by default
  enableLearning: true,
  useWorkerThread: false,               // Worker mode (in development)
};
```

### How to Enable

**Option 1: Manually Trigger Cycles (Recommended)**
```bash
# Trigger a single cycle via API
curl -X POST http://localhost:3003/api/v1/autonomous/trigger

# Check status
curl http://localhost:3003/api/v1/autonomous/status
```

**Option 2: Enable Continuous Mode (May Impact Performance)**
```javascript
// In autonomous-initializer.js
this.config = {
  enableContinuousOperation: true,  // Enable continuous mode
  useWorkerThread: false,            // Main thread (blocks event loop)
};
```

**Option 3: Use Worker Thread Mode (Experimental)**
```javascript
// In autonomous-initializer.js
this.config = {
  enableContinuousOperation: true,
  useWorkerThread: true,  // Enable worker thread
};
```

## API Endpoints

### GET /api/v1/autonomous/status

Get current status of autonomous operations.

```bash
curl http://localhost:3003/api/v1/autonomous/status
```

**Response:**
```json
{
  "success": true,
  "status": "running",
  "data": {
    "initialized": true,
    "workerThread": false,
    "workerReady": false,
    "cycleInterval": 300000,
    "continuousOperation": false,
    "cycleCount": 0,
    "stats": {
      "totalCycles": 0,
      "avgDuration": 0,
      "avgActionsPlanned": 0,
      "avgActionsExecuted": 0
    }
  }
}
```

### POST /api/v1/autonomous/trigger

Manually trigger a single autonomous operation cycle.

```bash
curl -X POST http://localhost:3003/api/v1/autonomous/trigger
```

### GET /api/v1/autonomous/dashboard

Get detailed dashboard data (requires authentication).

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3003/api/v1/autonomous/dashboard
```

## How Autonomous Operations Work

### 5-Step Autonomous Cycle

Each cycle performs the following steps:

```
1. GATHER INTELLIGENCE
   ├─ Query Fleet Status Agent
   ├─ Query SLA Monitor Agent
   ├─ Query Demand Forecasting Agent
   ├─ Query Traffic Pattern Agent
   ├─ Query Performance Analytics Agent
   └─ Query Order Assignment Agent

2. ANALYZE SITUATION
   ├─ Identify problems (SLA breaches, delays)
   ├─ Detect opportunities (optimization chances)
   └─ Calculate severity levels

3. GENERATE ACTION PLAN
   ├─ Prioritize actions by impact
   ├─ Check authorization levels
   └─ Create execution plan

4. EXECUTE AUTONOMOUSLY
   ├─ Execute HIGH_CONFIDENCE actions (>75%)
   ├─ Escalate MEDIUM_CONFIDENCE actions
   └─ Log all decisions

5. LEARN FROM OUTCOMES
   ├─ Track action results
   ├─ Update confidence scores
   └─ Improve future decisions
```

### Typical Cycle Duration

- **Without Worker Thread**: 500-2000ms (blocks API)
- **With Worker Thread**: 500-2000ms (non-blocking)

## Performance Impact

### Main Thread Mode

| Metric | Without Autonomous | With Autonomous |
|--------|-------------------|-----------------|
| CPU Usage | 0.1% | 90-100% |
| API Response Time | 10-50ms | 500-5000ms |
| Event Loop Lag | 0ms | 100-1000ms |

### Worker Thread Mode

| Metric | Without Autonomous | With Autonomous |
|--------|-------------------|-----------------|
| CPU Usage | 0.1% | 0.5-2% |
| API Response Time | 10-50ms | 10-60ms |
| Event Loop Lag | 0ms | 0-10ms |

## Use Cases

### When to Enable Autonomous Operations

✅ **Production environments** with worker thread mode
✅ **Dedicated autonomous server** (separate from API)
✅ **Low-traffic periods** for testing
✅ **Manual trigger** for specific situations

### When to Keep Disabled

❌ **Development environments** (impacts DX)
❌ **High-traffic API servers** (main thread mode)
❌ **Limited CPU resources**
❌ **Real-time applications** requiring low latency

## Development Roadmap

### Phase 1: Current (DONE ✓)
- [x] Autonomous operations framework
- [x] 14+ AI agents
- [x] 5-step operation cycle
- [x] Manual trigger API
- [x] Status monitoring

### Phase 2: Worker Thread (IN PROGRESS)
- [x] Worker thread architecture
- [ ] Serialization of agent state
- [ ] Message passing protocol
- [ ] Worker health monitoring
- [ ] Graceful restart

### Phase 3: Production Ready (PLANNED)
- [ ] Load balancing across workers
- [ ] Distributed operations (Redis/BullMQ)
- [ ] Real-time monitoring dashboard
- [ ] A/B testing framework
- [ ] Automated rollback

## Troubleshooting

### Problem: API is slow/timing out

**Cause**: Autonomous operations running in main thread
**Solution**:
```javascript
// Disable continuous mode
enableContinuousOperation: false
```

### Problem: High CPU usage

**Cause**: Complex agent queries blocking event loop
**Solution**:
```javascript
// Enable worker thread (when ready)
useWorkerThread: true
```

### Problem: Worker thread not starting

**Cause**: Worker implementation incomplete
**Solution**:
```javascript
// Use manual trigger instead
useWorkerThread: false
enableContinuousOperation: false
// Trigger via API when needed
```

## Best Practices

### 1. Start with Manual Triggers
```bash
# Trigger only when needed
curl -X POST http://localhost:3003/api/v1/autonomous/trigger
```

### 2. Monitor Performance
```bash
# Check system impact
curl http://localhost:3003/api/v1/autonomous/status
```

### 3. Gradual Rollout
```javascript
// Start with long intervals
cycleIntervalMs: 900000  // 15 minutes

// Then reduce gradually
cycleIntervalMs: 600000  // 10 minutes
cycleIntervalMs: 300000  // 5 minutes
```

### 4. Use Separate Service (Recommended)
```bash
# Run autonomous operations on dedicated server
# API Server: Handles HTTP requests
# Autonomous Server: Runs AI operations
```

## Environment Variables

Add to `.env`:
```bash
# Autonomous Operations
AUTONOMOUS_ENABLED=false
AUTONOMOUS_INTERVAL_MS=300000
AUTONOMOUS_USE_WORKER=false
AUTONOMOUS_CONFIDENCE_THRESHOLD=0.75
```

## Monitoring

### Metrics to Track

1. **Cycle Performance**
   - Average duration
   - Success rate
   - Error rate

2. **Actions Taken**
   - Actions planned
   - Actions executed
   - Actions escalated

3. **System Impact**
   - CPU usage
   - Memory usage
   - API response time
   - Event loop lag

4. **Business Impact**
   - SLA compliance improvement
   - Order delivery time reduction
   - Cost optimization
   - Customer satisfaction

## Support

For questions or issues:
1. Check `/api/v1/autonomous/status`
2. Review logs: `backend/logs/`
3. See API docs: http://localhost:3003/api-docs
4. GitHub Issues: [Project Repository]

---

**Last Updated**: 2025-01-06
**Version**: 1.0.0 (Worker Thread in development)
