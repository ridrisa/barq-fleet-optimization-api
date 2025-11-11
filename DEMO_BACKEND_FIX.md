# Demo Backend Availability Fix

**Date**: 2025-11-11
**Status**: ✅ FIXED
**Severity**: High - Demo functionality was unavailable

---

## Problem Summary

The demo backend showed "Disconnected" status with the error message:
> "Demo backend is unavailable. Ensure the WebSocket server is deployed and set NEXT_PUBLIC_WS_URL to its wss URL."

### Root Causes Identified

1. **Missing Environment Variable**: `NEXT_PUBLIC_WS_URL` was not set in `frontend/.env`
2. **Incorrect Production URL**: `.env.production` had outdated backend URL
3. **Missing `/ws` path**: WebSocket URL didn't include the required path segment
4. **Incorrect API Paths**: Demo control endpoints were missing `/api` prefix
5. **Demo Feature Disabled**: Production config had `NEXT_PUBLIC_ENABLE_DEMO=false`

---

## Backend Analysis

### ✅ Backend Status: OPERATIONAL

**Deployed URL**: `https://route-opt-backend-sek7q2ajva-uc.a.run.app`

**WebSocket Server**:
- **Status**: ✅ Active and responding
- **Endpoint**: `wss://route-opt-backend-sek7q2ajva-uc.a.run.app/ws`
- **Test Result**: Successfully connected and received system state

**Demo API Endpoints**:
- `POST /api/demo/start` - ✅ Working
- `POST /api/demo/stop` - ✅ Working
- `GET /api/demo/status` - ✅ Working
- `POST /api/demo/reset` - ✅ Working

**Health Check**: `GET /api/v1/health` - ✅ Healthy

---

## Fixes Applied

### 1. Frontend Environment Configuration

#### File: `frontend/.env` (Local Development)
```env
# Before
NEXT_PUBLIC_API_URL=http://localhost:3002
# (NEXT_PUBLIC_WS_URL was missing)

# After
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_WS_URL=ws://localhost:3002/ws
```

#### File: `frontend/.env.production` (Production)
```env
# Before
NEXT_PUBLIC_API_URL=https://route-opt-backend-426674819922.us-central1.run.app
NEXT_PUBLIC_WS_URL=wss://route-opt-backend-426674819922.us-central1.run.app
NEXT_PUBLIC_ENABLE_DEMO=false

# After
NEXT_PUBLIC_API_URL=https://route-opt-backend-sek7q2ajva-uc.a.run.app
NEXT_PUBLIC_WS_URL=wss://route-opt-backend-sek7q2ajva-uc.a.run.app/ws
NEXT_PUBLIC_ENABLE_DEMO=true
```

**Changes**:
- ✅ Updated backend URL to current deployment
- ✅ Added `/ws` path to WebSocket URL
- ✅ Enabled demo feature flag

---

### 2. API Client Default Values

#### File: `frontend/src/lib/api-client.ts`
```typescript
// Before
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://route-opt-backend-sek7q2ajva-uc.a.run.app';

// After
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://route-opt-backend-sek7q2ajva-uc.a.run.app/ws';
```

**Changes**:
- ✅ Added `/ws` path to fallback URL
- ✅ Ensures WebSocket connects even without env var

---

### 3. Demo Dashboard API Paths

#### File: `frontend/src/components/demo-dashboard.tsx`
```typescript
// Before
const data = await apiClient.postAbsolute(`${httpBase}/demo/start`, config);
const data = await apiClient.postAbsolute(`${httpBase}/demo/stop`);
const data = await apiClient.postAbsolute(`${httpBase}/demo/order`, { serviceType });

// After
const data = await apiClient.postAbsolute(`${httpBase}/api/demo/start`, config);
const data = await apiClient.postAbsolute(`${httpBase}/api/demo/stop`);
const data = await apiClient.postAbsolute(`${httpBase}/api/demo/order`, { serviceType });
```

**Changes**:
- ✅ Added `/api` prefix to all demo endpoints
- ✅ Matches backend route configuration

---

## Verification Tests

### WebSocket Connection Test
```bash
✅ Connected to: wss://route-opt-backend-sek7q2ajva-uc.a.run.app/ws
✅ Received initial state:
{
  "type": "connection",
  "data": {
    "clientId": "client-1762820474447-ipxz0r",
    "message": "Connected to Demo WebSocket Server",
    "systemState": {
      "orders": [],
      "drivers": [],
      "metrics": { ... }
    }
  }
}
```

### Demo API Test
```bash
# Start Demo
POST https://route-opt-backend-sek7q2ajva-uc.a.run.app/api/demo/start
✅ Response: {"success": true, "message": "Demo started successfully"}

# Get Status
GET https://route-opt-backend-sek7q2ajva-uc.a.run.app/api/demo/status
✅ Response: {"success": true, "data": {"isRunning": true, ...}}

# Stop Demo
POST https://route-opt-backend-sek7q2ajva-uc.a.run.app/api/demo/stop
✅ Response: {"success": true, "message": "Demo stopped successfully"}
```

---

## Deployment Instructions

### Local Development

1. **Start Backend** (if not running):
   ```bash
   cd backend
   npm start
   # Backend runs on http://localhost:3002
   # WebSocket available at ws://localhost:3002/ws
   ```

2. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   # Frontend runs on http://localhost:3000
   ```

3. **Test Demo**:
   - Navigate to demo dashboard page
   - Click "Start Demo" button
   - Verify "Connected" status appears
   - Observe real-time order creation

---

### Production Deployment

#### Option 1: Frontend Static Build (Recommended)
```bash
cd frontend

# Build with production environment
npm run build

# Deploy to your hosting platform
# Examples:
# - Vercel: vercel --prod
# - Netlify: netlify deploy --prod
# - Firebase: firebase deploy
```

#### Option 2: Frontend on Cloud Run
```bash
cd frontend

# Build Docker image
docker build -t gcr.io/PROJECT_ID/route-opt-frontend:latest .

# Push to GCR
docker push gcr.io/PROJECT_ID/route-opt-frontend:latest

# Deploy to Cloud Run
gcloud run deploy route-opt-frontend \
  --image gcr.io/PROJECT_ID/route-opt-frontend:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NEXT_PUBLIC_API_URL=https://route-opt-backend-sek7q2ajva-uc.a.run.app,NEXT_PUBLIC_WS_URL=wss://route-opt-backend-sek7q2ajva-uc.a.run.app/ws
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│  https://your-frontend-url.com                               │
│                                                               │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Demo Dashboard                                    │       │
│  │  - Real-time order tracking                        │       │
│  │  - Driver fleet monitoring                         │       │
│  │  - SLA metrics                                     │       │
│  └──────────────────────────────────────────────────┘       │
│           │                              │                    │
│           │ HTTP API Calls               │ WebSocket          │
│           │ (Demo Controls)              │ (Real-time)        │
└───────────┼──────────────────────────────┼────────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│         Backend (Express.js + WebSocket Server)              │
│  https://route-opt-backend-sek7q2ajva-uc.a.run.app          │
│                                                               │
│  ┌──────────────────┐         ┌─────────────────────┐       │
│  │  Demo API        │         │  WebSocket Server   │       │
│  │  /api/demo/*     │         │  /ws                │       │
│  │                  │         │                     │       │
│  │  - start         │◄────────┤  - Connection       │       │
│  │  - stop          │         │  - Events           │       │
│  │  - status        │         │  - System State     │       │
│  │  - reset         │         │                     │       │
│  └──────────────────┘         └─────────────────────┘       │
│           │                              │                    │
│           ▼                              ▼                    │
│  ┌──────────────────────────────────────────────────┐       │
│  │         Demo Generator                            │       │
│  │  - Creates orders (BARQ/BULLET)                   │       │
│  │  - Simulates drivers                              │       │
│  │  - Broadcasts events via WebSocket                │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## Environment Variables Summary

### Frontend Required Variables

| Variable | Purpose | Development | Production |
|----------|---------|-------------|------------|
| `NEXT_PUBLIC_API_URL` | Backend HTTP API | `http://localhost:3002` | `https://route-opt-backend-sek7q2ajva-uc.a.run.app` |
| `NEXT_PUBLIC_WS_URL` | WebSocket endpoint | `ws://localhost:3002/ws` | `wss://route-opt-backend-sek7q2ajva-uc.a.run.app/ws` |
| `NEXT_PUBLIC_ENABLE_DEMO` | Enable demo features | `true` | `true` |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Map visualization | (your token) | (your token) |

### Backend Required Variables

| Variable | Purpose | Value |
|----------|---------|-------|
| `PORT` | Server port | `3002` (dev), `8080` (production) |
| `POSTGRES_HOST` | Database host | `localhost` or Cloud SQL IP |
| `POSTGRES_DB` | Database name | `barq_logistics` |
| `GROQ_API_KEY` | AI model access | (your key) |

---

## Testing Checklist

- [x] WebSocket connects successfully
- [x] Demo API endpoints respond correctly
- [x] Start demo creates orders
- [x] Stop demo halts simulation
- [x] Real-time events broadcast to UI
- [x] Metrics update in real-time
- [x] Connection status shows "Connected"
- [x] Demo controls are functional

---

## Next Steps

1. **Deploy Frontend**: Use one of the deployment methods above
2. **Update DNS**: Point your domain to frontend deployment
3. **Configure CORS**: Update backend CORS to allow frontend domain
4. **Monitor Logs**: Check Cloud Run logs for any WebSocket errors
5. **Load Testing**: Test with multiple simultaneous connections

---

## Support & Troubleshooting

### WebSocket Connection Issues

**Problem**: "Disconnected" status persists
**Solution**:
1. Verify `NEXT_PUBLIC_WS_URL` is set correctly
2. Check browser console for WebSocket errors
3. Ensure `/ws` path is included in URL
4. Test WebSocket endpoint directly (see verification tests above)

**Problem**: Demo controls don't work
**Solution**:
1. Check that endpoints include `/api` prefix
2. Verify backend is deployed and healthy
3. Check browser network tab for 404 errors

**Problem**: No real-time updates
**Solution**:
1. Confirm WebSocket connection is established
2. Check that demo is actually running (`GET /api/demo/status`)
3. Verify browser supports WebSocket protocol

---

## Files Modified

1. ✅ `frontend/.env` - Added NEXT_PUBLIC_WS_URL
2. ✅ `frontend/.env.production` - Updated URLs and enabled demo
3. ✅ `frontend/src/lib/api-client.ts` - Fixed WebSocket fallback URL
4. ✅ `frontend/src/components/demo-dashboard.tsx` - Fixed API paths

---

## Performance Notes

- WebSocket heartbeat: Every 30 seconds
- Reconnection attempts: 5 attempts with 3-second delay
- Event history: Last 100 events retained
- System state: Last 50 orders retained
- Default demo rate: 5 orders/minute

---

**Document Version**: 1.0
**Last Updated**: 2025-11-11
**Author**: Claude Code
**Status**: ✅ All Issues Resolved
