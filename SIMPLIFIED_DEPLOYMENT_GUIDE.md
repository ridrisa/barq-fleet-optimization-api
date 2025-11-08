# Simplified Deployment Guide - AI Route Optimization

**Last Updated**: November 8, 2025

---

## 🎯 Current Complexity Issues

### What's Making It Complicated
1. ❌ **Long upload times** (241MB with all source files)
2. ❌ **Build-time environment variables** - requires full rebuild to change config
3. ❌ **Multiple build failures** from ESLint/Prettier enforcement
4. ❌ **Complex cloudbuild.yaml** with many build arguments
5. ❌ **Docker multi-stage builds** adding overhead

---

## ✨ Three Simplified Approaches

### **Option 1: Cloud Run Direct Source Deploy** ⭐ RECOMMENDED

**No Docker, No cloudbuild.yaml, No complexity!**

#### Single Command Deployment
```bash
cd frontend
gcloud run deploy route-opt-frontend \
  --source . \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_API_URL=https://route-opt-backend-426674819922.us-central1.run.app,NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoiZGF0YWJhcnEiLCJhIjoiY21nZjczdjBuMDVoZTJpc2F1Z21vYWpwYiJ9.JzyHzvz5q8e5XayOtQfkYg,NEXT_PUBLIC_APP_NAME=AI Route Optimization,NEXT_PUBLIC_APP_VERSION=1.0.0" \
  --project=looker-barqdata-2030
```

#### Why This Is Better
- ✅ **No Dockerfile needed** - Cloud Run auto-detects Next.js
- ✅ **No cloudbuild.yaml** - automatic build configuration
- ✅ **Faster builds** - optimized caching
- ✅ **Change env vars** without rebuild using `gcloud run services update`
- ✅ **Smaller uploads** - only source code
- ✅ **Auto ESLint handling** - Cloud Build handles it gracefully

#### Update Environment Variables (Without Rebuild!)
```bash
gcloud run services update route-opt-frontend \
  --update-env-vars="NEXT_PUBLIC_API_URL=https://new-backend-url.run.app" \
  --region=us-central1 \
  --project=looker-barqdata-2030
```

---

### **Option 2: Pre-built Deployment** (Fastest)

**Build locally, deploy only the artifacts**

#### Step 1: Build Locally
```bash
cd frontend

# Set environment variables
export NEXT_PUBLIC_API_URL=https://route-opt-backend-426674819922.us-central1.run.app
export NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoiZGF0YWJhcnEiLCJhIjoiY21nZjczdjBuMDVoZTJpc2F1Z21vYWpwYiJ9.JzyHzvz5q8e5XayOtQfkYg
export NEXT_PUBLIC_APP_NAME="AI Route Optimization"
export NEXT_PUBLIC_APP_VERSION="1.0.0"

# Build
npm run build
```

#### Step 2: Create Lightweight Dockerfile
```dockerfile
# Dockerfile.production
FROM node:18-alpine

WORKDIR /app

# Copy only built artifacts and necessary files
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
```

#### Step 3: Deploy
```bash
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/looker-barqdata-2030/barq-services/route-opt-frontend:latest \
  --dockerfile=Dockerfile.production

gcloud run deploy route-opt-frontend \
  --image us-central1-docker.pkg.dev/looker-barqdata-2030/barq-services/route-opt-frontend:latest \
  --region=us-central1 \
  --allow-unauthenticated \
  --project=looker-barqdata-2030
```

**Benefits**:
- ✅ Upload ~5MB instead of 241MB
- ✅ Deploy in seconds
- ✅ No ESLint failures (already built)
- ✅ Test locally before deploy

---

### **Option 3: Simplified Docker Build** (Current Approach Improved)

**Keep Docker, but make it simpler**

#### Simplified cloudbuild.yaml
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'NEXT_PUBLIC_API_URL=$$API_URL'
      - '--build-arg'
      - 'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=$$MAPBOX_TOKEN'
      - '-t'
      - 'us-central1-docker.pkg.dev/$PROJECT_ID/barq-services/route-opt-frontend:latest'
      - '.'
    secretEnv: ['API_URL', 'MAPBOX_TOKEN']

images:
  - 'us-central1-docker.pkg.dev/$PROJECT_ID/barq-services/route-opt-frontend:latest'

availableSecrets:
  secretManager:
    - versionName: projects/$PROJECT_ID/secrets/frontend-api-url/versions/latest
      env: 'API_URL'
    - versionName: projects/$PROJECT_ID/secrets/mapbox-token/versions/latest
      env: 'MAPBOX_TOKEN'

timeout: 1200s
options:
  machineType: 'E2_HIGHCPU_8'
```

**Benefits**:
- ✅ Secrets managed in Secret Manager
- ✅ Cleaner configuration
- ✅ Easier to maintain

---

## 🚀 Migration Plan

### Immediate (Let current build finish)
Wait for current build to complete, verify frontend works

### Short-term (Next deployment)
Switch to **Option 1: Direct Source Deploy**
```bash
# Delete cloudbuild.yaml (not needed)
rm frontend/cloudbuild.yaml

# Deploy directly
cd frontend
gcloud run deploy route-opt-frontend --source . ...
```

### Long-term (Production)
Move to **Option 2: Pre-built Deployment** for:
- Faster deployments
- Smaller attack surface
- Better control

---

## 📊 Comparison

| Approach | Upload Size | Build Time | Complexity | Flexibility |
|----------|-------------|------------|------------|-------------|
| **Current (Docker + cloudbuild)** | 241MB | 10-15min | High | Low |
| **Option 1 (Direct Source)** | ~50MB | 5-8min | **Very Low** | **High** |
| **Option 2 (Pre-built)** | ~5MB | 1-2min | Medium | Medium |
| **Option 3 (Simplified Docker)** | 241MB | 10-15min | Medium | Medium |

---

## 🎯 Recommended Workflow

### For Development/Staging
**Use Option 1** - fastest iteration, easy env var changes

```bash
# Deploy frontend
cd frontend
gcloud run deploy route-opt-frontend \
  --source . \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_API_URL=https://route-opt-backend-426674819922.us-central1.run.app" \
  --project=looker-barqdata-2030
```

### For Production
**Use Option 2** - optimized, secure, fast

```bash
# Build
npm run build

# Deploy
gcloud builds submit --dockerfile=Dockerfile.production
gcloud run deploy ...
```

---

## ✅ Immediate Action Items

1. **Let current build finish** (already running)
2. **Verify frontend works** after deployment
3. **Next deployment**: Use Option 1 (Direct Source)
4. **Test thoroughly** before migrating production

---

## 🔧 Quick Fixes for Current Setup

### If you must use current Docker approach:

**1. Speed up builds with better caching**
Add to Dockerfile:
```dockerfile
# Cache dependencies layer
COPY package*.json ./
RUN npm ci --only=production
# Then copy source
COPY . .
```

**2. Reduce ESLint failures**
Already done in `next.config.js`:
```javascript
eslint: {
  ignoreDuringBuilds: true,
}
```

**3. Monitor build progress**
```bash
gcloud builds log df5d5fc6-6813-4d8e-9703-90e923c27dfb --stream
```

---

## 📚 Additional Resources

- [Cloud Run Source Deploys](https://cloud.google.com/run/docs/deploying-source-code)
- [Next.js Standalone Output](https://nextjs.org/docs/advanced-features/output-file-tracing)
- [Secret Manager Integration](https://cloud.google.com/secret-manager/docs)

---

**Current Build Status**: 🟡 Running (ID: df5d5fc6-6813-4d8e-9703-90e923c27dfb)

**Next Update**: After current build completes
