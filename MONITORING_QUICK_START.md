# Error Monitoring Dashboard - Quick Start Guide

## Quick Access

**Dashboard URL**: `http://localhost:3000/monitoring`

**Backend API**: `http://localhost:3003/api/v1/monitoring`

---

## 5-Minute Quick Start

### 1. Start the Servers

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 2. Access the Dashboard

Open your browser and navigate to:
```
http://localhost:3000/monitoring
```

### 3. Test the System

Run the test script to generate sample errors:
```bash
cd backend
node test-monitoring.js
```

Refresh the dashboard to see the errors appear!

---

## Key Features at a Glance

| Feature | What It Does | Where to Find It |
|---------|-------------|------------------|
| **Overall Health** | System-wide health score | Top left card |
| **Error Rate** | Errors per minute | Top right card |
| **Component Health** | Individual component status | Second row cards |
| **Category Breakdown** | Errors by type | Third row cards |
| **Time Windows** | 5min/1hr/24hr views | Tab selector |
| **Top Errors** | Most frequent errors | Below tabs |
| **Recent Errors** | Latest error log | Bottom section |
| **Active Alerts** | Current alerts | Red banner at top |

---

## API Endpoints Cheat Sheet

```bash
# Get complete dashboard
GET /api/v1/monitoring/dashboard

# Get system health
GET /api/v1/monitoring/health

# Get error metrics (5min, 1hour, or 24hour)
GET /api/v1/monitoring/errors?window=1hour

# Get active alerts
GET /api/v1/monitoring/alerts

# Get error trends
GET /api/v1/monitoring/errors/trends

# Get monitoring stats
GET /api/v1/monitoring/stats
```

### cURL Examples

```bash
# Dashboard data
curl http://localhost:3003/api/v1/monitoring/dashboard | jq

# System health
curl http://localhost:3003/api/v1/monitoring/health | jq

# Error metrics (last hour)
curl "http://localhost:3003/api/v1/monitoring/errors?window=1hour" | jq

# Active alerts
curl http://localhost:3003/api/v1/monitoring/alerts | jq
```

---

## Understanding the Dashboard

### Health Score (0-100)
- **100-80**: 🟢 Healthy - System operating normally
- **79-50**: 🟡 Degraded - Some issues detected
- **49-0**: 🔴 Unhealthy - Critical issues require attention

### Error Severity Levels
- **Critical**: System failures, immediate action required (Red)
- **High**: Major issues, action needed soon (Orange)
- **Medium**: Moderate issues, monitor closely (Yellow)
- **Low**: Minor issues, review when convenient (Blue)
- **Info**: Informational only (Gray)

### Error Categories
- **Database**: Connection/query failures
- **Agent**: AI agent execution errors
- **API**: General API errors
- **Analytics**: Python script failures
- **WebSocket**: Connection issues
- **External Service**: Third-party API failures
- **Validation**: Input validation errors
- **Authentication**: Login/token failures
- **Authorization**: Permission denied
- **System**: General system errors

---

## Alert Thresholds

Default thresholds (configurable in `.env`):

| Alert Type | Threshold | Description |
|------------|-----------|-------------|
| **High Error Rate** | 10 errors/min | Too many errors occurring |
| **Critical Errors** | 5 critical/hour | Too many critical errors |
| **Consecutive Errors** | 20 in 1 minute | Rapid error spike |

---

## Common Use Cases

### Scenario 1: Database Connection Lost
**What You'll See:**
- Red banner: "Database connection issues"
- Database component: 🔴 Unhealthy (Score: 0)
- Recent errors: Multiple "Connection failed" errors
- Category breakdown: Database category shows critical errors

**What to Do:**
1. Check database service is running
2. Verify connection credentials
3. Check network connectivity
4. Review database logs

### Scenario 2: Agent Execution Failures
**What You'll See:**
- Agent component: 🟡 Degraded (Score: 50-79)
- Recent errors: Agent execution errors with agent names
- Category breakdown: Agent category shows high errors

**What to Do:**
1. Check agent logs for details
2. Verify agent initialization
3. Review agent configuration
4. Check dependent services

### Scenario 3: High Error Rate Alert
**What You'll See:**
- Red alert banner: "Error rate exceeds threshold"
- Error rate card: >10 errors/min
- Multiple errors across categories

**What to Do:**
1. Identify the primary error category
2. Check recent code deployments
3. Review system logs
4. Scale resources if needed

---

## Dashboard Auto-Refresh

- **Default**: Auto-refresh every 30 seconds
- **Toggle**: Click "Auto" button in header
- **Manual**: Click "Refresh" button anytime
- **Last Update**: Timestamp shown in header

---

## Pro Tips

1. **Time Windows**: Use 5min for immediate issues, 1hour for trends, 24hour for patterns

2. **Top Errors**: Focus on high-count recurring errors first - they have the biggest impact

3. **Component Health**: Watch for components dropping below 80 - early warning sign

4. **Category Breakdown**: If one category shows critical errors, drill into that system

5. **Recent Errors**: Look for patterns - same error repeating? Common path/method?

6. **Alert Banner**: Red banner = immediate attention needed, investigate right away

7. **Error Rate**: Sudden spike? Check recent deployments or system changes

8. **Health Score**: Use as your "single number" - below 80 means action needed

---

## Keyboard Shortcuts

- **F5**: Refresh dashboard
- **Ctrl/Cmd + R**: Refresh dashboard
- **Scroll**: Navigate recent errors

---

## Mobile Access

The dashboard is fully responsive! Access from mobile devices:
```
http://YOUR_SERVER_IP:3000/monitoring
```

---

## Integrations

### Existing Health Endpoint
The monitoring system extends the existing `/health` endpoint:
```bash
curl http://localhost:3003/health
```

### WebSocket Events
Subscribe to error events (for custom integrations):
```javascript
const { errorMonitoringService } = require('./services/error-monitoring.service');

errorMonitoringService.on('error', (error) => {
  console.log('New error:', error);
});

errorMonitoringService.on('alert', (alert) => {
  console.log('New alert:', alert);
});
```

---

## Troubleshooting

### Dashboard Not Loading
1. Check backend is running: `curl http://localhost:3003/api/v1/monitoring/dashboard`
2. Check frontend is running: `http://localhost:3000`
3. Check console for errors: F12 → Console tab

### No Errors Showing
1. No errors occurred yet - this is good!
2. Run test script: `node backend/test-monitoring.js`
3. Generate real errors by using the API

### Auto-Refresh Not Working
1. Click "Auto" button to enable
2. Check browser console for fetch errors
3. Verify API is accessible

---

## Configuration

### Environment Variables (`.env`)

```bash
# Error Monitoring Thresholds
ERROR_RATE_THRESHOLD=10           # Alerts when errors/min exceeds this
CRITICAL_ERROR_THRESHOLD=5         # Alerts when critical errors/hour exceeds this
CONSECUTIVE_ERROR_THRESHOLD=20     # Alerts when consecutive errors exceeds this
```

### Adjust for Production
For production environments, consider:
- Increase `ERROR_RATE_THRESHOLD` to 50-100 (depending on traffic)
- Keep `CRITICAL_ERROR_THRESHOLD` at 5-10
- Increase `CONSECUTIVE_ERROR_THRESHOLD` to 50-100

---

## Quick Commands

```bash
# Run all tests
node backend/test-monitoring.js

# Start backend only
cd backend && npm run dev

# Start frontend only
cd frontend && npm run dev

# Check monitoring service status
curl http://localhost:3003/api/v1/monitoring/status

# Get dashboard data (formatted)
curl http://localhost:3003/api/v1/monitoring/dashboard | jq '.data.summary'

# Get active alerts count
curl http://localhost:3003/api/v1/monitoring/alerts | jq '.count'
```

---

## Next Steps

1. **Customize Thresholds**: Adjust alert thresholds for your environment
2. **Monitor for 24 Hours**: Observe normal error patterns
3. **Set Up Notifications**: Integrate with Slack/email (future enhancement)
4. **Create Runbooks**: Document response procedures for common errors
5. **Train Team**: Ensure all team members know how to use the dashboard

---

## Support

**Documentation**: See `ERROR_MONITORING_REPORT.md` for full details

**Test Script**: `backend/test-monitoring.js`

**Source Code**:
- Backend Service: `backend/src/services/error-monitoring.service.js`
- API Routes: `backend/src/routes/v1/monitoring.routes.js`
- Frontend Dashboard: `frontend/src/app/monitoring/page.tsx`

---

**Last Updated**: 2025-11-20
**Version**: 1.0.0
