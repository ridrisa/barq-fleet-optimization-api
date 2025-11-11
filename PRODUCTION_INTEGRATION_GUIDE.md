# Production Integration Guide
## Frontend-Backend Connection Fix

## 🔍 Current Status

### Architecture Overview
The system consists of 3 main services deployed on Google Cloud Run:

1. **Frontend (Next.js)**: `route-opt-frontend`
   - URL: https://route-opt-frontend-sek7q2ajva-uc.a.run.app
   - Framework: Next.js 14 with React
   - Purpose: User interface for route optimization

2. **Backend API (Node.js)**: `route-opt-backend`
   - URL: https://route-opt-backend-sek7q2ajva-uc.a.run.app
   - Framework: Express.js
   - Purpose: Main route optimization API (OSRM, agents, optimization)
   - WebSocket: `/ws` endpoint for real-time updates

3. **Analytics API (Python)**: `route-opt-analytics`
   - URL: https://route-opt-analytics-sek7q2ajva-uc.a.run.app
   - Framework: Flask
   - Purpose: SLA analytics, fleet performance, demand forecasting

### 🚨 Integration Issues Identified

#### Issue #1: Frontend Using Wrong Backend URL
- **Current Configuration**: `https://route-opt-backend-426674819922.us-central1.run.app`
- **Actual Service URL**: `https://route-opt-backend-sek7q2ajva-uc.a.run.app`

Both URLs respond to health checks, but they may point to different deployments or one might be outdated.

#### Issue #2: Analytics API Not Configured
- Frontend has analytics API client but no `NEXT_PUBLIC_ANALYTICS_API_URL` environment variable set
- Defaults to main backend URL, which doesn't have analytics endpoints

#### Issue #3: WebSocket URL Mismatch
- Frontend WebSocket configured for old URL pattern
- May cause real-time features to fail

## 🔧 Fix Steps

### Step 1: Update Frontend Environment Variables

Update the Cloud Run service with correct URLs:

```bash
# Navigate to project directory
cd /Users/ramiz_new/Desktop/AI-Route-Optimization-API

# Update frontend service with correct URLs
gcloud run services update route-opt-frontend \
  --region=us-central1 \
  --set-env-vars="NEXT_PUBLIC_API_URL=https://route-opt-backend-sek7q2ajva-uc.a.run.app,NEXT_PUBLIC_ANALYTICS_API_URL=https://route-opt-analytics-sek7q2ajva-uc.a.run.app,NEXT_PUBLIC_WS_URL=wss://route-opt-backend-sek7q2ajva-uc.a.run.app/ws"
```

### Step 2: Update Local Development .env File

Create/update `.env.local` in the frontend directory:

```bash
# Frontend environment variables
NEXT_PUBLIC_API_URL=https://route-opt-backend-sek7q2ajva-uc.a.run.app
NEXT_PUBLIC_ANALYTICS_API_URL=https://route-opt-analytics-sek7q2ajva-uc.a.run.app
NEXT_PUBLIC_WS_URL=wss://route-opt-backend-sek7q2ajva-uc.a.run.app/ws
NEXT_PUBLIC_API_VERSION=v1
```

### Step 3: Rebuild and Redeploy Frontend

```bash
# Build frontend with new environment variables
cd frontend
npm run build

# Deploy to Cloud Run
gcloud run deploy route-opt-frontend \
  --region=us-central1 \
  --source=. \
  --platform=managed \
  --allow-unauthenticated
```

### Step 4: Verify Integration

Test each connection:

```bash
# Test backend API
curl https://route-opt-backend-sek7q2ajva-uc.a.run.app/health

# Test analytics API
curl https://route-opt-analytics-sek7q2ajva-uc.a.run.app/health

# Test optimization endpoint
curl -X POST https://route-opt-backend-sek7q2ajva-uc.a.run.app/api/v1/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "pickupPoints": [{"name":"Hub","lat":24.7136,"lng":46.6753}],
    "deliveryPoints": [{"name":"Customer","lat":24.7240,"lng":46.6800}],
    "fleet": {"vehicleType":"van","count":1,"capacity":1000}
  }'

# Test analytics endpoint
curl https://route-opt-analytics-sek7q2ajva-uc.a.run.app/api/sla/realtime
```

## 📋 Service Endpoints Reference

### Backend API (Node.js)
**Base URL**: `https://route-opt-backend-sek7q2ajva-uc.a.run.app`

#### Core Endpoints
- `GET /health` - Health check
- `POST /api/v1/optimize` - Route optimization
- `GET /api/v1/routes` - Get routes
- `GET /api/v1/routes/:id` - Get specific route
- `WS /ws` - WebSocket for real-time updates

### Analytics API (Python)
**Base URL**: `https://route-opt-analytics-sek7q2ajva-uc.a.run.app`

#### SLA Analytics
- `GET /api/sla/realtime` - Real-time SLA status
- `GET /api/sla/compliance?days=7&service_type=BARQ` - SLA compliance
- `GET /api/sla/breach-risk?hub_id=1` - Breach risk patterns
- `GET /api/sla/trend?days=30` - SLA trend

#### Route Analytics
- `GET /api/routes/efficiency?days=30` - Route efficiency
- `GET /api/routes/bottlenecks?days=30` - Bottlenecks
- `GET /api/routes/abc?min_deliveries=10` - ABC analysis

#### Fleet Performance
- `GET /api/fleet/drivers?period=monthly` - Driver performance
- `GET /api/fleet/driver/{id}?period=weekly` - Single driver
- `GET /api/fleet/vehicles?period=monthly` - Vehicle performance
- `GET /api/fleet/cohorts?period=monthly` - Driver cohorts

#### Demand Forecasting
- `GET /api/demand/hourly?horizon=7` - Hourly forecast
- `GET /api/demand/daily?horizon=30` - Daily forecast
- `GET /api/demand/resources?horizon=14` - Resource requirements

## 🔐 CORS Configuration

Ensure backend services allow requests from frontend:

### Backend API CORS (backend/src/index.js)
```javascript
const cors = require('cors');
app.use(cors({
  origin: [
    'https://route-opt-frontend-sek7q2ajva-uc.a.run.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true
}));
```

### Analytics API CORS (gpt-fleet-optimizer/api_server.py)
```python
from flask_cors import CORS
CORS(app, origins=[
    'https://route-opt-frontend-sek7q2ajva-uc.a.run.app',
    'http://localhost:3000',
    'http://localhost:3001'
])
```

## 🧪 Testing Checklist

### Frontend Tests
- [ ] Homepage loads correctly
- [ ] Optimization form submits successfully
- [ ] Real-time route updates via WebSocket work
- [ ] Map displays routes correctly
- [ ] Analytics dashboard shows data

### Backend API Tests
- [ ] Health endpoint responds
- [ ] Optimization endpoint works
- [ ] WebSocket connection establishes
- [ ] Routes are saved and retrieved
- [ ] Error handling works correctly

### Analytics API Tests
- [ ] Health endpoint responds
- [ ] SLA endpoints return data
- [ ] Route analytics endpoints work
- [ ] Fleet performance endpoints work
- [ ] Demand forecasting endpoints work

### Integration Tests
- [ ] Frontend can call backend optimization API
- [ ] Frontend can connect to WebSocket
- [ ] Frontend can call analytics API
- [ ] Real-time updates flow from backend to frontend
- [ ] Error messages display correctly in UI

## 🚀 Quick Fix Script

Run this script to update frontend URLs:

```bash
#!/bin/bash
# fix-integration.sh

echo "🔧 Fixing Frontend-Backend Integration..."

# Update frontend Cloud Run service
echo "Updating frontend environment variables..."
gcloud run services update route-opt-frontend \
  --region=us-central1 \
  --set-env-vars="NEXT_PUBLIC_API_URL=https://route-opt-backend-sek7q2ajva-uc.a.run.app,NEXT_PUBLIC_ANALYTICS_API_URL=https://route-opt-analytics-sek7q2ajva-uc.a.run.app,NEXT_PUBLIC_WS_URL=wss://route-opt-backend-sek7q2ajva-uc.a.run.app/ws,NEXT_PUBLIC_API_VERSION=v1"

# Test endpoints
echo "Testing backend..."
curl -s https://route-opt-backend-sek7q2ajva-uc.a.run.app/health | jq .

echo "Testing analytics..."
curl -s https://route-opt-analytics-sek7q2ajva-uc.a.run.app/health | jq .

echo "✅ Integration fix complete!"
echo "Frontend URL: https://route-opt-frontend-sek7q2ajva-uc.a.run.app"
```

Save as `fix-integration.sh`, make executable, and run:
```bash
chmod +x fix-integration.sh
./fix-integration.sh
```

## 📊 Current Service Status

| Service | Status | URL |
|---------|--------|-----|
| Frontend | ✅ Running | https://route-opt-frontend-sek7q2ajva-uc.a.run.app |
| Backend API | ✅ Running | https://route-opt-backend-sek7q2ajva-uc.a.run.app |
| Analytics API | ✅ Running | https://route-opt-analytics-sek7q2ajva-uc.a.run.app |
| WebSocket | ✅ Enabled | wss://route-opt-backend-sek7q2ajva-uc.a.run.app/ws |
| Integration | ❌ Broken | Frontend using wrong URLs |

## 🎯 Expected Results After Fix

1. **Frontend loads correctly** with proper API connections
2. **Optimization requests** complete successfully
3. **Real-time updates** via WebSocket work
4. **Analytics dashboard** displays SLA, fleet, and demand data
5. **Map visualization** shows routes correctly
6. **Error handling** displays meaningful messages

## 📝 Notes

- Both URL patterns (`426674819922.us-central1.run.app` and `sek7q2ajva-uc.a.run.app`) currently respond
- Recommend standardizing on `sek7q2ajva-uc.a.run.app` pattern (current Cloud Run format)
- Old URL pattern might be deprecated or point to outdated deployment
- After fix, allow 1-2 minutes for Cloud Run to restart with new environment variables

## 🔄 Rollback Plan

If issues occur after update:

```bash
# Revert to old URL
gcloud run services update route-opt-frontend \
  --region=us-central1 \
  --set-env-vars="NEXT_PUBLIC_API_URL=https://route-opt-backend-426674819922.us-central1.run.app"
```

---

**Last Updated**: November 11, 2025
**Status**: Integration broken - awaiting fix