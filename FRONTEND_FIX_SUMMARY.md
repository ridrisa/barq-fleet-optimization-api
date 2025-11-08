# Frontend API Connection Fix

**Date**: November 8, 2025
**Issue**: Frontend showing "API URL: Not configured" error
**Status**: 🟡 In Progress (Build running)

---

## 🔍 Problem Identified

### Issue
Frontend was deployed without the `NEXT_PUBLIC_API_URL` environment variable, causing it to show "Not configured" and unable to connect to the backend.

### Root Cause
Next.js requires `NEXT_PUBLIC_*` environment variables to be set at **build time** (not runtime). The previous deployment didn't pass the build argument during Docker build.

---

## ✅ Solution Applied

### 1. Updated cloudbuild.yaml
**File**: `/frontend/cloudbuild.yaml`

Added build arguments:
```yaml
- '--build-arg'
- 'NEXT_PUBLIC_API_URL=https://route-opt-backend-426674819922.us-central1.run.app'
```

### 2. Fixed Image Registry
Changed from `gcr.io` to `us-central1-docker.pkg.dev` (Artifact Registry)

### 3. Triggered Rebuild
```bash
cd frontend
gcloud builds submit --config=cloudbuild.yaml --project=looker-barqdata-2030 --timeout=20m
```

---

## 📊 Build Details

### Previous Build (Failed)
**Build ID**: `68658d8f-8693-42f6-a901-6da8dbf33abf`
**Status**: ❌ Failed (ESLint errors)

### Current Build (In Progress)
**Build ID**: Checking...
**Status**: 🟡 Building
**Image**: `us-central1-docker.pkg.dev/looker-barqdata-2030/barq-services/route-opt-frontend:latest`
**Build Args**:
- `NEXT_PUBLIC_API_URL=https://route-opt-backend-426674819922.us-central1.run.app`
- `NEXT_PUBLIC_APP_NAME=AI Route Optimization`
- `NEXT_PUBLIC_APP_VERSION=1.0.0`
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoiZGF0YWJhcnEiLCJhIjoiY21nZjczdjBuMDVoZTJpc2F1Z21vYWpwYiJ9.JzyHzvz5q8e5XayOtQfkYg`

---

## 🚀 Deployment Plan

Once build completes:

```bash
gcloud run deploy route-opt-frontend \
  --image us-central1-docker.pkg.dev/looker-barqdata-2030/barq-services/route-opt-frontend:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --project=looker-barqdata-2030
```

---

## 🔗 Service URLs

| Service | URL | Status |
|---------|-----|--------|
| Frontend | https://route-opt-frontend-426674819922.us-central1.run.app | 🟡 Updating |
| Backend API | https://route-opt-backend-426674819922.us-central1.run.app | 🟢 Working |
| Analytics API | https://barq-fleet-analytics-426674819922.us-central1.run.app | 🟢 Working |

---

## 🧪 Verification Steps

After deployment:

1. **Test Frontend Load**
   ```bash
   curl -I https://route-opt-frontend-426674819922.us-central1.run.app
   ```

2. **Verify API Connection**
   - Open: https://route-opt-frontend-426674819922.us-central1.run.app
   - Check browser console for API calls
   - Should see requests to: https://route-opt-backend-426674819922.us-central1.run.app

3. **Test Optimization**
   - Click "New Optimization" button
   - Should no longer show "Cannot connect to backend server" error
   - Backend should respond with validation errors or success

---

## 📝 Backend API Endpoints

The backend uses versioned API routes:

### Working Endpoints
- ✅ `GET /health` - Health check
- ✅ `GET /api` - API info
- ✅ `GET /api/v1` - Version info
- ✅ `POST /api/v1/optimize` - Route optimization (requires `pickupPoints` and `deliveryPoints`)
- ✅ `GET /api/v1/agents` - Agent status
- ✅ `GET /api/v1/health` - Detailed health
- ✅ `GET /api/v1/autonomous` - Autonomous operations
- ✅ `GET /api-docs` - Swagger documentation

### Not Found (Expected)
- ❌ `/` - No root route (returns 404 with error message)
- ❌ `/api/optimize` - Must use `/api/v1/optimize`
- ❌ `/api/v1/analytics` - Not implemented (analytics at separate service)

---

## 🎯 Expected Frontend Behavior After Fix

### Before Fix
```
Error: Cannot connect to the backend server
API URL: Not configured
```

### After Fix
```
✅ Frontend loads normally
✅ API URL: https://route-opt-backend-426674819922.us-central1.run.app
✅ Backend connection successful
✅ Optimization form submits to /api/v1/optimize
```

---

## 🔧 Technical Details

### How Next.js Environment Variables Work

1. **Build-time variables** (`NEXT_PUBLIC_*`):
   - Must be set during `npm run build`
   - Baked into the JavaScript bundle
   - Available in browser code
   - Cannot be changed after build

2. **Server-side variables**:
   - Set at runtime
   - Only available in server components
   - Not in browser code

### Docker Build Process

```dockerfile
# Build stage
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build  # ← Env vars must be set before this
```

### Cloud Build Configuration

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'NEXT_PUBLIC_API_URL=https://route-opt-backend-426674819922.us-central1.run.app'
      # ↑ This passes the value to Docker build
```

---

## 📚 Related Documentation

- **Main Handover**: [HANDOVER.md](./HANDOVER.md)
- **Documentation Index**: [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)
- **Sample Data**: [gpt-fleet-optimizer/SAMPLE_DATA_DEPLOYMENT_SUMMARY.md](./gpt-fleet-optimizer/SAMPLE_DATA_DEPLOYMENT_SUMMARY.md)

---

## ⏱️ Timeline

| Time | Event |
|------|-------|
| 01:02 UTC | Build started (ID: 68658d8f-8693-42f6-a901-6da8dbf33abf) |
| ~01:15 UTC | Build completion expected |
| ~01:20 UTC | Deployment to Cloud Run expected |

---

## ✅ Success Criteria

- [ ] Build completes successfully
- [ ] Image pushed to Artifact Registry
- [ ] Service deployed to Cloud Run
- [ ] Frontend loads without errors
- [ ] Frontend shows correct API URL
- [ ] Backend connection successful
- [ ] Optimization form works

---

**Next Update**: Once build completes and deployment finishes

**Estimated Completion**: ~15 minutes from build start
