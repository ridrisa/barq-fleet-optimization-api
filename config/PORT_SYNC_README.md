# 🔄 Dynamic Port Synchronization System

## Overview
This system ensures frontend and backend ports are always synchronized and configurable from a single source of truth.

## How It Works

### 1. Central Configuration
All ports are defined in `config/ports.json`:
```json
{
  "development": {
    "backend": 3003,
    "frontend": 3001,
    "websocket": 8081,
    "analytics": 8080,
    "cvrp": 5001
  }
}
```

### 2. Automatic Synchronization
When you run `npm run dev`, the system automatically:
1. Cleans up any processes on old ports (`kill-ports.sh`)
2. Syncs all environment files (`sync-ports.js`)
3. Starts services with synchronized ports

### 3. Dynamic Loading
- **Backend**: Dynamically loads ports from `config/ports.json`
- **Frontend**: Gets updated `.env` files with correct backend URLs
- **Scripts**: Package.json scripts are updated automatically

## Usage

### Change Ports
1. Edit `config/ports.json`
2. Run `npm run sync-ports`
3. Start services with `npm run dev`

### Manual Sync
```bash
node sync-ports.js
```

### Check Current Configuration
```bash
node config/get-ports.js
```

### Get Specific Port
```bash
node config/get-ports.js backend  # Output: 3003
node config/get-ports.js frontend # Output: 3001
```

## Benefits

✅ **Single Source of Truth**: Change ports in one place
✅ **No Conflicts**: Automatic detection and resolution
✅ **Environment-Aware**: Different ports for dev/staging/prod
✅ **Auto-Sync**: Updates all config files automatically
✅ **Dynamic**: Backend reads config at runtime
✅ **Foolproof**: Can't accidentally mismatch ports

## Files Affected

When ports are synchronized, these files are automatically updated:
- `frontend/.env.development`
- `frontend/.env.local` (if exists)
- `backend/.env.development`
- `package.json` (dev scripts)

## Environment Variables

The system ensures these are always in sync:
- `NEXT_PUBLIC_API_URL` → Points to backend port
- `NEXT_PUBLIC_WS_URL` → Points to websocket port
- `PORT` → Backend server port
- `WS_PORT` → WebSocket server port

## Troubleshooting

### Ports Not Syncing?
```bash
# Force sync
node sync-ports.js

# Verify configuration
cat config/ports.json

# Check if services are using correct ports
npm run health
```

### Port Already in Use?
```bash
# Kill all services and clean ports
./kill-ports.sh

# Then restart
npm run dev
```

### Different Environment?
```bash
# Production
NODE_ENV=production node sync-ports.js

# Staging
NODE_ENV=staging node sync-ports.js
```

## Advanced Configuration

### Add New Service
1. Add to `config/ports.json`:
```json
"myservice": 4000
```

2. Update `sync-ports.js` to include new service

3. Run sync:
```bash
npm run sync-ports
```

### Custom Port Override
You can still override with environment variables:
```bash
PORT=4000 npm run dev:backend
```

---
**Last Updated**: November 17, 2025
**Version**: 1.0.0