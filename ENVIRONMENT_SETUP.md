# BARQ Fleet Management - Environment Setup Guide

**Version:** 2.0 (Post-Consolidation)
**Last Updated:** 2025-11-11
**Security Level:** Production-Ready

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment File Structure](#environment-file-structure)
3. [Local Development Setup](#local-development-setup)
4. [Production Deployment](#production-deployment)
5. [Required Environment Variables](#required-environment-variables)
6. [Google Cloud Secret Manager](#google-cloud-secret-manager)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### New Developer Setup (5 minutes)

```bash
# 1. Clone repository
git clone https://github.com/your-org/AI-Route-Optimization-API.git
cd AI-Route-Optimization-API

# 2. Create local environment files from templates
cp .env.example .env.local
cp backend/.env.example backend/.env.local
cp frontend/.env.example frontend/.env.local
cp backend/optimization-service/.env.example backend/optimization-service/.env.local
cp gpt-fleet-optimizer/.env.example gpt-fleet-optimizer/.env.local

# 3. Install dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd backend/optimization-service && pip install -r requirements.txt && cd ../..
cd gpt-fleet-optimizer && pip install -r requirements.txt && cd ..

# 4. Setup local PostgreSQL database
# Option A: Using Docker
docker-compose up -d postgres redis

# Option B: Using local PostgreSQL
createdb barq_logistics
psql barq_logistics < database/schema.sql

# 5. Configure your .env.local files
# Edit .env.local, backend/.env.local, frontend/.env.local with your credentials

# 6. Start development servers
npm run dev
```

**That's it!** You're ready to develop locally.

---

## Environment File Structure

After consolidation, the project uses a clean structure:

```
AI-Route-Optimization-API/
│
├── .env.example                    ✅ Template (tracked in git)
├── .env.local                      🔒 Your local config (gitignored)
│
├── backend/
│   ├── .env.example                ✅ Template (tracked in git)
│   ├── .env.local                  🔒 Your local config (gitignored)
│   └── optimization-service/
│       ├── .env.example            ✅ Template (tracked in git)
│       └── .env.local              🔒 Your local config (gitignored)
│
├── frontend/
│   ├── .env.example                ✅ Template (tracked in git)
│   ├── .env.local                  🔒 Your local config (gitignored)
│   └── .env.analytics.example      ✅ Template (tracked in git)
│
└── gpt-fleet-optimizer/
    ├── .env.example                ✅ Template (tracked in git)
    └── .env.local                  🔒 Your local config (gitignored)
```

### File Naming Convention

- **`.env.example`** - Templates with placeholder values (committed to git)
- **`.env.local`** - Your actual local configuration (NEVER committed)
- **`.env.*.example`** - Special-purpose templates (e.g., analytics)

**Golden Rule:** Only `.env.example` files should be tracked in git!

---

## Local Development Setup

### 1. Database Configuration

Edit **backend/.env.local**:

```bash
# For local PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=barq_logistics
DB_USER=your_postgres_user
DB_PASSWORD=your_local_password

# Same for POSTGRES_* variables
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=barq_logistics
POSTGRES_USER=your_postgres_user
POSTGRES_PASSWORD=your_local_password
```

**Using Docker Compose:**
```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Use these credentials (from docker-compose.yml):
DB_HOST=localhost
DB_USER=barq_user
DB_PASSWORD=barq_password
```

### 2. API Keys (Development)

Get free development API keys:

#### GROQ (Required for AI features)
1. Sign up at https://console.groq.com/
2. Create API key at https://console.groq.com/keys
3. Add to **backend/.env.local**:
   ```bash
   GROQ_API_KEY=gsk_your_development_key_here
   ```

#### Mapbox (Required for maps)
1. Sign up at https://account.mapbox.com/
2. Create token at https://account.mapbox.com/access-tokens/
3. Add to **frontend/.env.local**:
   ```bash
   NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token_here
   ```

#### OpenAI (Optional - for advanced AI features)
1. Get key at https://platform.openai.com/api-keys
2. Add to **backend/.env.local**:
   ```bash
   OPENAI_API_KEY=sk-your_openai_key_here
   ```

### 3. Redis Configuration

**Using Docker:**
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

**Using Cloud Memorystore (Production):**
```bash
REDIS_HOST=your-memorystore-ip
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

### 4. CORS Configuration

For local development, allow your frontend URL:

**backend/.env.local:**
```bash
CORS_ORIGIN=http://localhost:3001
```

For multiple origins:
```bash
CORS_ORIGIN=http://localhost:3001,http://localhost:3000
```

### 5. Starting Services

```bash
# Terminal 1: Backend API
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: CVRP Optimization Service
cd backend/optimization-service
python app.py

# Terminal 4: Analytics Service
cd gpt-fleet-optimizer
python app.py
```

Access:
- Frontend: http://localhost:3001
- Backend API: http://localhost:3003
- CVRP Service: http://localhost:5001
- Analytics: http://localhost:8080

---

## Production Deployment

### Google Cloud Run Deployment

Production secrets are managed via **Google Cloud Secret Manager**.

#### 1. Create Secrets in Secret Manager

```bash
# Database password
echo -n "your_production_db_password" | gcloud secrets create DB_PASSWORD --data-file=-

# JWT secrets (generate strong random values)
openssl rand -base64 64 | gcloud secrets create JWT_SECRET --data-file=-
openssl rand -base64 64 | gcloud secrets create JWT_REFRESH_SECRET --data-file=-

# API keys
echo -n "your_production_groq_key" | gcloud secrets create GROQ_API_KEY --data-file=-
echo -n "your_production_mapbox_token" | gcloud secrets create MAPBOX_TOKEN --data-file=-

# Redis password
echo -n "your_redis_password" | gcloud secrets create REDIS_PASSWORD --data-file=-
```

#### 2. Deploy Backend with Secrets

```bash
cd backend

gcloud run deploy route-opt-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,PORT=3003,DATABASE_MODE=postgres \
  --set-env-vars DB_HOST=/cloudsql/your-project:region:instance \
  --set-secrets DB_PASSWORD=DB_PASSWORD:latest \
  --set-secrets JWT_SECRET=JWT_SECRET:latest \
  --set-secrets JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest \
  --set-secrets GROQ_API_KEY=GROQ_API_KEY:latest \
  --set-secrets REDIS_PASSWORD=REDIS_PASSWORD:latest \
  --add-cloudsql-instances your-project:region:instance
```

#### 3. Deploy Frontend with Secrets

```bash
cd frontend

gcloud run deploy route-opt-frontend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-env-vars NEXT_PUBLIC_API_URL=https://route-opt-backend-xxx.run.app \
  --set-secrets NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=MAPBOX_TOKEN:latest
```

### Environment Variables in Cloud Run

**Non-Secret Variables** (set via --set-env-vars):
```bash
NODE_ENV=production
PORT=3003
DATABASE_MODE=postgres
CORS_ORIGIN=https://your-production-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

**Secret Variables** (set via --set-secrets):
```bash
DB_PASSWORD=DB_PASSWORD:latest
JWT_SECRET=JWT_SECRET:latest
JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest
GROQ_API_KEY=GROQ_API_KEY:latest
REDIS_PASSWORD=REDIS_PASSWORD:latest
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=MAPBOX_TOKEN:latest
```

---

## Required Environment Variables

### Essential (Required)

| Variable | Description | Example | Where to Set |
|----------|-------------|---------|--------------|
| `NODE_ENV` | Environment mode | `development` or `production` | All |
| `PORT` | Server port | `3003` | Backend |
| `DB_HOST` | Database host | `localhost` | Backend |
| `DB_USER` | Database user | `barq_user` | Backend |
| `DB_PASSWORD` | Database password | `changeme` | Backend (Secret Manager in prod) |
| `JWT_SECRET` | JWT signing key | Generate with `openssl rand -base64 64` | Backend (Secret Manager) |
| `GROQ_API_KEY` | GROQ API key | `gsk_xxx` | Backend (Secret Manager) |
| `NEXT_PUBLIC_API_URL` | Backend URL | `http://localhost:3003` | Frontend |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox token | `pk.xxx` | Frontend (Secret Manager in prod) |

### Optional (Recommended)

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis cache host | `localhost` |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `SENTRY_DSN` | Error tracking | - |
| `CORS_ORIGIN` | Allowed origins | `*` |
| `LOG_LEVEL` | Logging level | `info` |

### Feature Flags

| Variable | Description | Default |
|----------|-------------|---------|
| `DISABLE_AUTONOMOUS_AGENTS` | Disable AI agents | `false` |
| `ENABLE_DEMO_MODE` | Enable demo mode | `false` |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | Enable analytics | `false` |

---

## Google Cloud Secret Manager

### Access Secrets in Code

**backend/config/secrets.js:**
```javascript
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

class SecretsManager {
  constructor() {
    this.client = new SecretManagerServiceClient();
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT;
  }

  async getSecret(secretName) {
    if (process.env.NODE_ENV !== 'production') {
      // Use local .env.local in development
      return process.env[secretName];
    }

    try {
      const name = `projects/${this.projectId}/secrets/${secretName}/versions/latest`;
      const [version] = await this.client.accessSecretVersion({ name });
      return version.payload.data.toString();
    } catch (error) {
      console.error(`Failed to fetch secret ${secretName}:`, error);
      throw error;
    }
  }

  async loadSecrets() {
    const secrets = await Promise.all([
      this.getSecret('DB_PASSWORD'),
      this.getSecret('JWT_SECRET'),
      this.getSecret('JWT_REFRESH_SECRET'),
      this.getSecret('GROQ_API_KEY'),
    ]);

    return {
      DB_PASSWORD: secrets[0],
      JWT_SECRET: secrets[1],
      JWT_REFRESH_SECRET: secrets[2],
      GROQ_API_KEY: secrets[3],
    };
  }
}

module.exports = new SecretsManager();
```

**Usage:**
```javascript
// backend/index.js
const secretsManager = require('./config/secrets');

async function startServer() {
  // Load secrets at startup
  const secrets = await secretsManager.loadSecrets();

  // Use secrets in configuration
  const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: secrets.DB_PASSWORD,
  };

  // Start server...
}

startServer();
```

### Secret Rotation

Rotate secrets every 90 days:

```bash
# Generate new secret
openssl rand -base64 64 > new_jwt_secret.txt

# Update secret in Secret Manager
gcloud secrets versions add JWT_SECRET --data-file=new_jwt_secret.txt

# Redeploy service to use new version
gcloud run services update route-opt-backend --region us-central1

# Clean up
rm new_jwt_secret.txt
```

---

## Security Best Practices

### ✅ DO

1. **Use Strong Secrets in Production:**
   ```bash
   # Generate strong JWT secret
   openssl rand -base64 64

   # Generate strong password
   openssl rand -base64 32
   ```

2. **Keep .env.local Out of Git:**
   - Already configured in `.gitignore`
   - Verify: `git check-ignore .env.local` (should return `.env.local`)

3. **Use Different Credentials per Environment:**
   - Development: Weak passwords OK
   - Staging: Moderate security
   - Production: Strong secrets in Secret Manager

4. **Rotate Credentials Regularly:**
   - Every 90 days for production
   - After any suspected compromise
   - When team members leave

5. **Limit Secret Access:**
   ```bash
   # Grant Secret Manager access to service account only
   gcloud secrets add-iam-policy-binding DB_PASSWORD \
     --member="serviceAccount:cloud-run@project.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

### ❌ DON'T

1. **Never Commit .env.local to Git**
   - Check before committing: `git status`
   - If accidentally committed: `git rm --cached .env.local`

2. **Never Share Production Credentials**
   - Use Secret Manager
   - Grant IAM access instead

3. **Never Use Weak Secrets in Production**
   - ❌ `JWT_SECRET=secret123`
   - ✅ `JWT_SECRET=<64-character random string>`

4. **Never Store Secrets in Code**
   - ❌ `const API_KEY = "sk_live_xxx"`
   - ✅ `const API_KEY = process.env.GROQ_API_KEY`

5. **Never Log Secrets**
   - ❌ `console.log('DB Password:', dbPassword)`
   - ✅ `console.log('DB connected successfully')`

---

## Troubleshooting

### Issue: "Database connection failed"

**Cause:** Incorrect database credentials

**Solution:**
```bash
# Check your .env.local
cat backend/.env.local | grep DB_

# Test PostgreSQL connection
psql -h localhost -U barq_user -d barq_logistics

# If using Docker, check container status
docker-compose ps postgres
docker-compose logs postgres
```

### Issue: "JWT secret not defined"

**Cause:** Missing JWT_SECRET in .env.local

**Solution:**
```bash
# Generate strong secret
openssl rand -base64 64

# Add to backend/.env.local
echo "JWT_SECRET=<generated-secret>" >> backend/.env.local
echo "JWT_REFRESH_SECRET=<another-generated-secret>" >> backend/.env.local
```

### Issue: "CORS error in browser"

**Cause:** Frontend URL not in CORS_ORIGIN

**Solution:**
```bash
# backend/.env.local
CORS_ORIGIN=http://localhost:3001

# Or for multiple origins
CORS_ORIGIN=http://localhost:3001,http://localhost:3000
```

### Issue: "Mapbox map not loading"

**Cause:** Missing or invalid Mapbox token

**Solution:**
```bash
# Get token from https://account.mapbox.com/access-tokens/

# Add to frontend/.env.local
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoieW91ciIsImEiOiJhYmMxMjMifQ.xxx
```

### Issue: "Secret not found in Secret Manager"

**Cause:** Secret not created or wrong permissions

**Solution:**
```bash
# List all secrets
gcloud secrets list

# Create missing secret
echo -n "your_secret_value" | gcloud secrets create SECRET_NAME --data-file=-

# Grant access to Cloud Run service account
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"
```

### Issue: ".env.local not being loaded"

**Cause:** Wrong file location or naming

**Solution:**
```bash
# Check file exists
ls -la .env.local

# Verify it's in the correct directory
pwd  # Should be project root

# For Next.js (frontend), restart dev server
cd frontend
npm run dev

# For backend, check dotenv is configured
# backend/index.js should have:
require('dotenv').config({ path: '.env.local' });
```

---

## Environment Variable Loading Order

Understanding how environment variables are loaded:

### Backend (Node.js + Express)

```javascript
// backend/index.js
require('dotenv').config({ path: '.env.local' });  // 1. Load .env.local first
// 2. Then check process.env (from system/Cloud Run)
// 3. Then Secret Manager (production only)

const config = {
  port: process.env.PORT || 3003,
  dbHost: process.env.DB_HOST || 'localhost',
  // ...
};
```

**Load Priority:**
1. `.env.local` (development)
2. System environment variables
3. Cloud Run environment variables (production)
4. Secret Manager (production secrets)

### Frontend (Next.js)

```javascript
// Next.js automatically loads .env files in this order:
// 1. .env.local (highest priority)
// 2. .env.development (if NODE_ENV=development)
// 3. .env.production (if NODE_ENV=production)
// 4. .env

// Only variables prefixed with NEXT_PUBLIC_ are exposed to browser
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
```

**Load Priority:**
1. `.env.local` (all environments)
2. `.env.development` / `.env.production` (environment-specific)
3. `.env` (fallback)

---

## Migration from Old .env Files

If you have old .env files from before consolidation:

```bash
# 1. Backup old files
mkdir .env-backup
cp .env* .env-backup/

# 2. Run consolidation script
./consolidate-env-files.sh

# 3. Copy your credentials to new .env.local
# Manually copy API keys, passwords from backup to new .env.local files

# 4. Test everything works
npm run dev

# 5. Delete backups (after confirming everything works)
rm -rf .env-backup
```

---

## Quick Reference

### Development Commands

```bash
# Start all services
npm run dev                          # Backend
cd frontend && npm run dev           # Frontend
cd backend/optimization-service && python app.py  # CVRP
cd gpt-fleet-optimizer && python app.py          # Analytics

# Database operations
npm run db:migrate                   # Run migrations
npm run db:seed                      # Seed demo data

# Testing
npm test                             # Backend tests
cd frontend && npm test              # Frontend tests

# Linting
npm run lint                         # Backend linting
cd frontend && npm run lint          # Frontend linting
```

### Production Deployment

```bash
# Deploy backend
gcloud run deploy route-opt-backend --source ./backend

# Deploy frontend
gcloud run deploy route-opt-frontend --source ./frontend

# View logs
gcloud run services logs read route-opt-backend --limit=50
```

### Secret Management

```bash
# Create secret
echo -n "value" | gcloud secrets create NAME --data-file=-

# Update secret
echo -n "new_value" | gcloud secrets versions add NAME --data-file=-

# List secrets
gcloud secrets list

# View secret (requires permission)
gcloud secrets versions access latest --secret=NAME
```

---

## Support

**Documentation:**
- [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md) - Security audit details
- [README.md](./README.md) - Project overview
- [backend/README.md](./backend/README.md) - Backend API docs
- [frontend/README.md](./frontend/README.md) - Frontend docs

**External Resources:**
- [Google Cloud Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [GROQ API Documentation](https://console.groq.com/docs)
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/)

**Team Contact:**
- Security issues: security@barq-fleet.com
- Technical questions: dev@barq-fleet.com

---

**Last Updated:** 2025-11-11
**Maintained By:** Security Specialist - BARQ Fleet Management
