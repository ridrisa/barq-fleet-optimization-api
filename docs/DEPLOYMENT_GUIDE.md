# Frontend Deployment Guide

## Environment Configuration

The frontend now uses environment-based configuration instead of hardcoded URLs. This enables seamless deployment across development, staging, and production environments.

## Environment Variables

All environment variables are prefixed with `NEXT_PUBLIC_` to make them available in the browser.

### Available Environment Variables

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3003
NEXT_PUBLIC_WS_URL=ws://localhost:8081

# Mapbox Configuration
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your-mapbox-token

# Application Info
NEXT_PUBLIC_APP_NAME=AI Logistics Optimization
NEXT_PUBLIC_APP_VERSION=1.0.0

# Feature Flags
NEXT_PUBLIC_ENABLE_DEMO=true
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

## Environment Files

Three environment files are provided:

1. **`.env.development`** - Development environment
2. **`.env.staging`** - Staging environment
3. **`.env.production`** - Production environment
4. **`.env.local`** - Local overrides (gitignored, create manually)

## Setup Instructions

### For Development

1. Copy `.env.example` to `.env.local`:
   ```bash
   cd frontend
   cp .env.example .env.local
   ```

2. Update `.env.local` with your local configuration

3. Start the development server:
   ```bash
   npm run dev
   ```

### For Production Deployment

#### Option 1: Environment-specific builds

Build with a specific environment file:

```bash
# Development build
npm run build

# Staging build (create this script in package.json)
NODE_ENV=staging npm run build

# Production build
NODE_ENV=production npm run build
```

#### Option 2: Runtime environment variables

Set environment variables at deployment time:

```bash
# Example for Vercel
vercel --prod \
  -e NEXT_PUBLIC_API_URL=https://api.production.com \
  -e NEXT_PUBLIC_WS_URL=wss://ws.production.com \
  -e NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your-prod-token
```

#### Option 3: Platform-specific configuration

**Vercel:**
Add environment variables in the Vercel dashboard under Settings > Environment Variables

**Netlify:**
Add environment variables in Site settings > Build & deploy > Environment

**Docker:**
Use environment variables in your `docker-compose.yml`:

```yaml
services:
  frontend:
    build: ./frontend
    environment:
      - NEXT_PUBLIC_API_URL=https://api.production.com
      - NEXT_PUBLIC_WS_URL=wss://ws.production.com
      - NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=${MAPBOX_TOKEN}
    ports:
      - "3000:3000"
```

## API Client Usage

The API client is centralized in `/src/lib/api-client.ts`. It automatically:

- Uses environment-configured URLs
- Adds authentication tokens
- Handles errors consistently
- Provides type safety

### Example Usage

```typescript
import { apiClient } from '@/lib/api-client';

// GET request
const data = await apiClient.get('/api/routes');

// POST request
const result = await apiClient.post('/api/optimize', requestData);

// Access URLs
const apiUrl = apiClient.getBaseUrl();
const wsUrl = apiClient.getWsUrl();
```

## Authentication

Authentication is handled through `/src/lib/auth.ts`:

```typescript
import { auth } from '@/lib/auth';

// Set token
auth.setToken('your-jwt-token', 3600); // expires in 3600 seconds

// Check authentication
if (auth.isAuthenticated()) {
  // User is logged in
}

// Get current user
const user = auth.getUser();

// Clear authentication
auth.clearAuth();
```

## Deployment Checklist

- [ ] Update environment variables for target environment
- [ ] Set `NEXT_PUBLIC_API_URL` to correct backend URL
- [ ] Set `NEXT_PUBLIC_WS_URL` to correct WebSocket URL
- [ ] Configure `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
- [ ] Verify CORS settings on backend allow frontend domain
- [ ] Test API connectivity
- [ ] Test WebSocket connectivity
- [ ] Build and test production bundle
- [ ] Verify all features work in target environment

## Troubleshooting

### Issue: API requests fail with CORS errors

**Solution:** Ensure backend CORS configuration includes your frontend domain:

```javascript
// Backend CORS config
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://your-frontend-domain.com'
  ]
}));
```

### Issue: Environment variables not updating

**Solution:**
1. Rebuild the application after changing environment variables
2. Clear Next.js cache: `rm -rf .next`
3. Restart the development server

### Issue: WebSocket connection fails

**Solution:**
1. Verify `NEXT_PUBLIC_WS_URL` is set correctly
2. Check if backend WebSocket server is running
3. Ensure firewall allows WebSocket connections
4. Use `wss://` (secure) for HTTPS deployments

## Security Best Practices

1. **Never commit `.env.local`** - It's gitignored by default
2. **Use secure protocols** - `https://` and `wss://` in production
3. **Rotate tokens regularly** - Especially API keys and auth tokens
4. **Limit token exposure** - Store sensitive tokens server-side when possible
5. **Use environment-specific keys** - Different keys for dev/staging/prod

## Files Modified

### Created Files
- `frontend/.env.development` - Development environment config
- `frontend/.env.production` - Production environment config
- `frontend/.env.staging` - Staging environment config
- `frontend/src/lib/api-client.ts` - Centralized API client
- `frontend/src/lib/auth.ts` - Authentication service

### Modified Files
- `frontend/next.config.js` - Added environment variable configuration
- `frontend/src/app/autonomous/page.tsx` - Uses API client
- `frontend/src/components/demo-dashboard.tsx` - Uses API client
- `frontend/src/components/map-view.tsx` - Uses environment variables
- `frontend/src/store/slices/routesSlice.ts` - Uses environment variables

## Support

For issues or questions, please refer to:
- [Next.js Environment Variables Documentation](https://nextjs.org/docs/basic-features/environment-variables)
- [API Documentation](./API_DOCUMENTATION.md)
- Project README

---

**Last Updated:** 2025-01-05
**Sprint:** Sprint 1 - Production Readiness
