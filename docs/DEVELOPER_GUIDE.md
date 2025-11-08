# AI Route Optimization - Developer Guide

**Version**: 1.0.0
**Last Updated**: November 5, 2025
**System Status**: Production Candidate (70% Complete)

---

## Quick Start

```bash
# Install dependencies
npm install

# Start all services
npm run dev

# Access points
Backend API:    http://localhost:3003
Frontend:       http://localhost:3001
WebSocket:      ws://localhost:8081
Agent Monitor:  http://localhost:3001/admin/agents
```

---

## 1. System Architecture

### Core Components
- **Backend**: Node.js/Express with 20 AI agents
- **Frontend**: Next.js 14 with TypeScript
- **Database**: LowDB (JSON) → PostgreSQL migration ready
- **Routing**: OSRM for route optimization
- **Real-time**: WebSocket server on port 8081

### 20 AI Agents
1. Planning Agent - Analyzes delivery requirements
2. Optimization Agent - Calculates optimal routes
3. Formatting Agent - Structures responses
4. Fleet Status Agent - Monitors vehicle availability
5. SLA Monitor Agent - Tracks service compliance
6. Order Assignment Agent - Assigns orders to drivers
7-20. Additional agents (traffic, geo, forecasting, etc.)

---

## 2. Driver State Management

### States
```
OFFLINE → AVAILABLE → BUSY → RETURNING → ON_BREAK
```

### Driver Model (`backend/src/models/driver.class.js`)
```javascript
const Driver = require('./src/models/driver.class');

// Create driver
const driver = Driver.fromVehicle({
  fleet_id: 'driver-123',
  current_location: { latitude: 24.7136, longitude: 46.6753 }
});

// Check availability
if (driver.canAcceptOrder()) {
  driver.assignOrder(order);
}

// Complete delivery
driver.completeDelivery({ on_time: true });

// Check target gap
console.log(driver.gap_from_target); // Remaining deliveries to hit target
```

### Business Rules
- Daily target: 25 deliveries
- Max hours: 10 hours/day
- Mandatory break after 5 consecutive deliveries
- Minimum on-time rate: 90%

---

## 3. SLA Auto-Reassignment

### SLA Types
- **BARQ** (Express): 60 minutes, penalty 10 SAR/min
- **BULLET** (Standard): 240 minutes, penalty 5 SAR/min

### How It Works
```javascript
// Automatic monitoring every 10 seconds
// Triggers at 75% of SLA time:
// - BARQ: Warning at 45min, Critical at 54min
// - BULLET: Warning at 180min, Critical at 216min

// Auto-reassignment flow:
1. Detect order at risk (75% threshold)
2. Find nearest available driver (weighted scoring)
3. Execute reassignment (atomic transaction)
4. Notify all parties (driver, customer, ops)
5. Log for audit trail
```

### Driver Selection Algorithm
```
Score = (Distance × 0.4) + (Performance × 0.3) + (Load × 0.2) + (Target Gap × 0.1)
```

### Files
- `backend/src/agents/sla-monitor.agent.js` - SLA monitoring
- `backend/src/services/reassignment.service.js` - Driver selection
- `backend/src/services/notification.service.js` - Alerts
- `backend/src/services/escalation.service.js` - Escalation

---

## 4. Error Handling

### Custom Error Classes (`backend/src/middleware/error.middleware.js`)
```javascript
const { ValidationError, NotFoundError, AgentExecutionError } =
  require('./middleware/error.middleware');

// In routes
router.post('/orders', asyncHandler(async (req, res) => {
  if (!req.body.order) throw new ValidationError('Order required');

  const driver = await findDriver(req.body.driver_id);
  if (!driver) throw new NotFoundError('Driver not found');

  const result = await assignOrder(order, driver);
  res.json({ success: true, data: result });
}));
```

### Error Response Format
```json
{
  "success": false,
  "status": "error",
  "message": "Human readable error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-11-05T10:30:00.000Z"
}
```

### Logging
```javascript
const logger = require('./utils/logger');

logger.error('Order assignment failed', {
  orderId: order.id,
  driverId: driver.id,
  reason: 'Driver unavailable'
});
```

---

## 5. Agent Monitoring

### API Endpoints
```bash
# Get all agent statuses
GET /api/admin/agents/status

# Get specific agent
GET /api/admin/agents/:name

# Get system health
GET /api/admin/system/health
```

### Agent Status Response
```json
{
  "name": "sla-monitor",
  "status": "ACTIVE",
  "lastRun": "2025-11-05T12:00:00Z",
  "lastDuration": 150,
  "healthScore": 95,
  "successRate": 0.98,
  "avgDuration": 145,
  "executionCount": 1234,
  "errorCount": 24
}
```

### Dashboard
Access at: http://localhost:3001/admin/agents
- Real-time status updates (5-second refresh)
- Health scores for all 21 agents
- Error tracking and details
- Execution history

---

## 6. API Reference

### Main Endpoints

**Route Optimization**
```bash
POST /api/optimize
Content-Type: application/json

{
  "fleet": [{
    "id": "vehicle-1",
    "current_latitude": 24.7136,
    "current_longitude": 46.6753,
    "capacity": 1000,
    "type": "VAN"
  }],
  "pickups": [...],
  "deliveries": [...],
  "businessRules": {
    "maxDuration": 480,
    "maxDistance": 100
  }
}
```

**Health Check**
```bash
GET /health/detailed
```

---

## 7. Database Schema

### Current (LowDB - JSON)
```javascript
{
  "drivers": [],
  "orders": [],
  "vehicles": [],
  "routes": []
}
```

### Future (PostgreSQL - Ready but Not Deployed)
Migration files ready at: `backend/src/database/migrations/`
- Driver state tracking with PostGIS
- Order history and SLA tracking
- Audit logs with hash chaining

**When to Migrate**: When you have 30+ drivers (db.json breaks at ~100 orders)

---

## 8. Testing

### Run Driver State Tests
```bash
cd backend
node test-driver-state.js
# 22 tests, 100% pass rate
```

### Manual Testing
```bash
# Test optimization with random data
node test-optimize-with-vehicles.js

# Test SLA system
node test-sla-reassignment.js

# Test error handling
node demo-error-handling.js
```

---

## 9. Configuration

### Environment Variables
```bash
# Backend (.env)
PORT=3003
NODE_ENV=development
DB_PATH=./src/db/db.json

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3003
NEXT_PUBLIC_WS_URL=ws://localhost:8081
```

### Business Rules
Edit `backend/src/config/business-rules.js`:
```javascript
module.exports = {
  driver: {
    target_deliveries: 25,
    max_hours: 10,
    mandatory_break_after: 5,
    min_on_time_rate: 0.90
  },
  sla: {
    barq: { minutes: 60, penalty_per_minute: 10 },
    bullet: { minutes: 240, penalty_per_minute: 5 }
  }
};
```

---

## 10. Known Limitations

### Technical
1. **Database**: JSON file storage, breaks at 100+ orders
2. **Notifications**: Manual until Twilio/SendGrid integrated (TODO)
3. **Compensation**: Calculation works, payout manual (TODO)
4. **Scaling**: Designed for <30 drivers initially

### Missing Features (Documented TODOs)
- Customer SMS/Email notifications (stubs in place)
- Payment gateway integration (calculation ready)
- Real-time GPS tracking
- Advanced analytics dashboard

---

## 11. Troubleshooting

### Port Already in Use
```bash
./kill-ports.sh
# Or manually
lsof -ti:3003 | xargs kill -9
```

### Check Logs
```bash
# Backend logs
tail -f backend/logs/combined.log
tail -f backend/logs/error.log

# Service status
curl http://localhost:3003/health/detailed
```

### Agent Issues
```bash
# Check agent status
curl http://localhost:3003/api/admin/agents/status

# View agent dashboard
open http://localhost:3001/admin/agents
```

---

## 12. Deployment Checklist

### Before First Customer
- [ ] Run end-to-end integration test
- [ ] Verify agent monitoring dashboard works
- [ ] Set up error alerting (Slack webhook minimum)
- [ ] Document manual processes (notifications, compensations)
- [ ] Test with 50+ orders to find db.json limit
- [ ] Backup db.json file daily

### Production Requirements
- [ ] Integrate Twilio (SMS)
- [ ] Integrate SendGrid (Email)
- [ ] Set up payment gateway
- [ ] Migrate to PostgreSQL (if >30 drivers)
- [ ] Set up monitoring (DataDog, New Relic, etc.)
- [ ] Implement automated backups

---

## 13. File Structure

```
backend/
├── src/
│   ├── agents/              # 20 AI agents
│   ├── middleware/          # Error handling, auth, security
│   ├── models/              # Driver, Order, Request models
│   ├── routes/              # API endpoints
│   ├── services/            # Business logic
│   ├── utils/               # Helpers, logger
│   ├── database/            # Migration scripts (PostgreSQL ready)
│   └── app.js               # Express server

frontend/
├── src/
│   ├── app/                 # Next.js pages
│   │   └── admin/agents/    # Agent monitoring dashboard
│   ├── components/          # React components
│   ├── store/               # Redux state management
│   └── types/               # TypeScript definitions
```

---

## 14. Support & Documentation

### Key Documents
- **FINAL_SPRINT_0_SUMMARY.md** - System overview and DAN's review
- **This file** - Complete developer reference

### Getting Help
- Check error logs first: `backend/logs/error.log`
- Review agent status: http://localhost:3001/admin/agents
- Check system health: http://localhost:3003/health/detailed

### Code Examples
All test files contain working examples:
- `backend/test-driver-state.js` - Driver management
- `backend/test-sla-reassignment.js` - SLA system
- `backend/test-optimize-with-vehicles.js` - Route optimization

---

## 15. What Works vs What Doesn't

### ✅ Works TODAY
- Order acceptance and validation
- Driver assignment (checks availability)
- State transitions (OFFLINE → AVAILABLE → BUSY)
- SLA monitoring (continuous checks every 10s)
- Auto-reassignment (finds best driver, executes swap)
- Error handling (catches all errors, logs properly)
- Agent monitoring (tracks all 21 agents)

### ⚠️ Partial (Needs Manual Intervention)
- Customer notifications (logs only, no SMS/Email yet)
- Compensation payouts (calculated, not paid)
- Performance reports (data exists, delivery manual)

### ❌ Not Implemented
- Real-time GPS tracking
- Mobile apps
- Advanced analytics
- ML predictions

---

## Quick Reference

```bash
# Development
npm run dev                  # Start all services
npm run dev:backend          # Backend only
npm run dev:frontend         # Frontend only
npm run stop                 # Stop all services

# Testing
node backend/test-driver-state.js
node backend/test-sla-reassignment.js
node backend/test-optimize-with-vehicles.js

# Health Checks
curl http://localhost:3003/health
curl http://localhost:3003/api/admin/agents/status

# Logs
tail -f backend/logs/combined.log
tail -f backend/logs/error.log

# Database
cat backend/src/db/db.json | json_pp
```

---

**System Status**: Production Candidate (70% Complete)
**Recommendation**: Ship to first customer with documented caveats
**Next Milestone**: Integrate notifications, complete end-to-end testing

For questions or issues, check the logs first, then review agent status dashboard.
