# BARQ Fleet Management - Infrastructure Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Docker Setup](#docker-setup)
4. [Environment Configuration](#environment-configuration)
5. [Deployment Procedures](#deployment-procedures)
6. [Monitoring](#monitoring)
7. [Database Management](#database-management)
8. [CI/CD Pipeline](#cicd-pipeline)
9. [Security](#security)
10. [Troubleshooting](#troubleshooting)

---

## Overview

BARQ Fleet Management is a containerized, microservices-based application designed for production deployment with full observability and automated operations.

### Technology Stack

- **Runtime**: Node.js 20 (Alpine Linux)
- **Backend**: Express.js (REST API)
- **Frontend**: Next.js 14 (React)
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Monitoring**: Prometheus + Grafana
- **Containerization**: Docker + Docker Compose
- **CI/CD**: GitHub Actions

### Infrastructure Components

```
┌─────────────────────────────────────────────────────────────┐
│                    BARQ Fleet Management                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Frontend   │  │   Backend    │  │  Monitoring  │     │
│  │  (Next.js)   │  │  (Express)   │  │  (Grafana)   │     │
│  │  Port: 3001  │  │  Port: 3003  │  │  Port: 3000  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         └──────────┬───────┴──────────────────┘             │
│                    │                                         │
│  ┌─────────────────┴─────────────────────────────────────┐ │
│  │            Docker Network (barq-network)              │ │
│  └─────────────────┬─────────────────────────────────────┘ │
│                    │                                         │
│  ┌────────────┬────┴────────┬────────────┬───────────┐     │
│  │            │              │            │           │     │
│  │ PostgreSQL │    Redis     │ Prometheus │ Volumes   │     │
│  │ Port: 5432 │  Port: 6379  │ Port: 9090 │           │     │
│  └────────────┴──────────────┴────────────┴───────────┘     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Multi-Stage Docker Builds

Both backend and frontend use multi-stage Docker builds for optimization:

**Benefits:**
- Reduced image size (production images ~150MB vs ~1GB)
- Security (no build tools in production)
- Faster deployments
- Layer caching for quick rebuilds

**Backend Stages:**
1. **dependencies**: Install production node_modules
2. **builder**: Prepare application code
3. **production**: Minimal runtime image

**Frontend Stages:**
1. **dependencies**: Install all dependencies
2. **builder**: Build Next.js application
3. **production**: Serve built application

### Health Checks

All services implement health checks:

- **Backend**: `http://localhost:3003/health` (30s interval)
- **Frontend**: `http://localhost:3001/` (30s interval)
- **PostgreSQL**: `pg_isready` (10s interval)
- **Redis**: `redis-cli ping` (10s interval)
- **Prometheus**: `/-/healthy` endpoint (30s interval)
- **Grafana**: `/api/health` endpoint (30s interval)

### Networking

- **Network**: Custom bridge network `barq-network` (172.28.0.0/16)
- **Service Discovery**: Services communicate via container names
- **Port Mapping**:
  - Backend: 3003:3003
  - Frontend: 3001:3001
  - PostgreSQL: 5432:5432
  - Redis: 6379:6379
  - Prometheus: 9090:9090
  - Grafana: 3000:3000

### Data Persistence

**Docker Volumes:**
- `postgres-data`: Database persistence
- `redis-data`: Cache persistence (AOF enabled)
- `prometheus-data`: Metrics history
- `grafana-data`: Dashboards and settings

**Bind Mounts:**
- `./backend/logs`: Application logs
- `./backend/database/backups`: Database backups

---

## Docker Setup

### Prerequisites

```bash
# Docker 20.10+
docker --version

# Docker Compose 2.0+
docker-compose --version
```

### Quick Start

```bash
# 1. Clone repository
git clone <repository-url>
cd AI-Route-Optimization-API

# 2. Copy environment template
cp .env.template .env

# 3. Update environment variables
nano .env  # Fill in required values

# 4. Start all services
docker-compose up -d

# 5. Check service status
docker-compose ps

# 6. View logs
docker-compose logs -f
```

### Building Images

```bash
# Build all images
docker-compose build

# Build specific service
docker-compose build backend

# Build with no cache (force rebuild)
docker-compose build --no-cache

# Build with specific tag
docker build -t barq-backend:v1.0.0 ./backend
```

### Managing Services

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose stop

# Restart service
docker-compose restart backend

# Remove containers (keeps volumes)
docker-compose down

# Remove containers and volumes
docker-compose down -v

# Scale services
docker-compose up -d --scale backend=3
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend

# Since timestamp
docker-compose logs --since 2024-01-01T00:00:00
```

---

## Environment Configuration

### Environment Files

- `.env.template`: Template with all variables
- `.env.development`: Development configuration
- `.env.staging`: Staging configuration
- `.env.production.template`: Production template

### Required Variables

```bash
# Database
DB_PASSWORD=<strong-password>
DB_NAME=barq_logistics
DB_USER=barq_user

# JWT Authentication
JWT_SECRET=<random-256-bit-key>
JWT_REFRESH_SECRET=<random-256-bit-key>

# AI Providers (optional)
OPENAI_API_KEY=<your-key>
ANTHROPIC_API_KEY=<your-key>

# Monitoring
GRAFANA_PASSWORD=<strong-password>
```

### Generating Secrets

```bash
# Generate JWT secrets
openssl rand -base64 32

# Generate strong password
openssl rand -base64 24
```

### Environment-Specific Configuration

**Development:**
- Longer JWT expiry (24h)
- More lenient rate limiting
- Demo mode enabled
- Detailed logging

**Staging:**
- Production-like settings
- Real API keys
- Monitoring enabled
- Demo mode available

**Production:**
- Short JWT expiry (15m)
- Strict rate limiting
- No demo mode
- Error tracking (Sentry)
- Secrets from secrets manager

---

## Deployment Procedures

### Manual Deployment

```bash
# Deploy to development
./scripts/deploy.sh development

# Deploy to staging
./scripts/deploy.sh staging v1.2.0

# Deploy to production (requires confirmation)
./scripts/deploy.sh production v1.0.0
```

### Deployment Script Features

- Environment validation
- Pre-deployment checks
- Docker image building
- Database migrations
- Health check verification
- Service availability testing
- Rollback on failure
- Deployment notifications

### Zero-Downtime Deployment

For production deployments:

1. **Blue-Green Strategy:**
```bash
# Start new version (green)
docker-compose -f docker-compose.yml -f docker-compose.green.yml up -d

# Test new version
./scripts/smoke-test.sh green

# Switch traffic
./scripts/switch-traffic.sh green

# Remove old version (blue)
docker-compose -f docker-compose.blue.yml down
```

2. **Rolling Update:**
```bash
# Update services one by one
docker-compose up -d --no-deps --scale backend=2 backend
sleep 30
docker-compose up -d --no-deps --scale backend=1 backend
```

### Database Migrations

```bash
# Run migrations during deployment
docker-compose run --rm backend npm run db:migrate

# Rollback last migration
docker-compose run --rm backend npm run db:rollback

# Check migration status
docker-compose run --rm backend npm run db:status
```

---

## Monitoring

### Prometheus

**Access:** http://localhost:9090

**Metrics Collected:**
- HTTP request rates
- Response times (p50, p95, p99)
- Error rates by status code
- Active connections
- Database query times
- Cache hit rates
- System resources (CPU, memory)

**Configuration:**
- Location: `/Users/ramiz_new/Desktop/AI-Route-Optimization-API/monitoring/prometheus/prometheus.yml`
- Scrape interval: 15s
- Retention: 15 days (default)

**Alert Rules:**
- High error rate (>5%)
- High latency (p95 > 1s)
- Service down
- High database connections
- High memory usage

### Grafana

**Access:** http://localhost:3000
**Credentials:** admin / (GRAFANA_PASSWORD from .env)

**Pre-configured Dashboards:**
- API Performance
- Database Metrics
- Redis Metrics
- System Overview
- Alert Status

**Adding Custom Dashboard:**
1. Create dashboard JSON in `monitoring/grafana/provisioning/dashboards/json/`
2. Restart Grafana: `docker-compose restart grafana`

### Viewing Metrics

```bash
# API metrics (if instrumented)
curl http://localhost:3003/metrics

# Prometheus targets
curl http://localhost:9090/api/v1/targets

# Query metrics via Prometheus API
curl 'http://localhost:9090/api/v1/query?query=up'
```

### Alerting

**Alert Channels:**
- Email
- Slack (configure webhook)
- PagerDuty (configure integration key)

**Alert Configuration:**
```yaml
# monitoring/prometheus/alerts.yml
- alert: HighErrorRate
  expr: rate(http_errors[5m]) > 0.05
  for: 5m
  annotations:
    summary: "Error rate above 5%"
```

---

## Database Management

### Backups

```bash
# Create backup
./scripts/backup-db.sh

# Backups are stored in backend/database/backups/
# Format: barq_db_backup_YYYYMMDD_HHMMSS.sql.gz
```

**Automated Backups:**
```bash
# Add to crontab for daily backups at 2 AM
0 2 * * * /path/to/scripts/backup-db.sh
```

### Restore

```bash
# List available backups
ls -lh backend/database/backups/

# Restore from backup (requires confirmation)
./scripts/restore-db.sh backend/database/backups/barq_db_backup_20250105_120000.sql.gz
```

### Direct Database Access

```bash
# PostgreSQL shell
docker-compose exec postgres psql -U barq_user -d barq_logistics

# Run SQL file
docker-compose exec -T postgres psql -U barq_user -d barq_logistics < schema.sql

# Export data
docker-compose exec postgres pg_dump -U barq_user -d barq_logistics -t orders > orders.sql
```

### Redis Operations

```bash
# Redis CLI
docker-compose exec redis redis-cli

# Check memory usage
docker-compose exec redis redis-cli INFO memory

# Clear all cache
docker-compose exec redis redis-cli FLUSHALL

# Monitor commands in real-time
docker-compose exec redis redis-cli MONITOR
```

---

## CI/CD Pipeline

### GitHub Actions Workflows

**1. Continuous Integration (.github/workflows/ci.yml)**
- Triggers: Push to main/develop, Pull requests
- Jobs:
  - Lint backend and frontend code
  - Run tests
  - Security scanning (Trivy)
  - Build Docker images
- Duration: ~5-8 minutes

**2. Staging Deployment (.github/workflows/cd-staging.yml)**
- Triggers: Push to develop branch
- Jobs:
  - Build and push images to registry
  - Deploy to staging environment
  - Run smoke tests
- Duration: ~10-12 minutes

**3. Production Deployment (.github/workflows/cd-production.yml)**
- Triggers: Version tags (v*.*.*)
- Jobs:
  - Build production images
  - Database backup
  - Canary deployment (25% traffic)
  - Monitor for 5 minutes
  - Full rollout (100% traffic)
  - Create GitHub release
- Duration: ~15-20 minutes

### Pushing Images to Registry

```bash
# GitHub Container Registry
./scripts/push-images.sh ghcr.io barq/fleet-management v1.0.0

# Docker Hub
./scripts/push-images.sh docker.io username/barq v1.0.0
```

### Triggering Deployments

```bash
# Staging (via git push)
git push origin develop

# Production (via tags)
git tag v1.0.0
git push origin v1.0.0

# Manual trigger (via GitHub UI)
# Go to Actions > Select workflow > Run workflow
```

---

## Security

### Container Security

- Non-root user (nodejs:nodejs, uid 1001)
- Minimal base image (Alpine Linux)
- No shell access in production containers
- Read-only filesystems where possible
- Security scanning with Trivy
- Regular base image updates

### Network Security

- Internal network isolation
- Only necessary ports exposed
- CORS configuration for frontend
- Rate limiting on API endpoints
- Helmet.js security headers

### Secrets Management

**Development:**
- .env files (gitignored)

**Production:**
- Use secrets management service (GCP Secret Manager, AWS Secrets Manager)
- Environment variables injected at runtime
- Never commit production secrets to git

### Vulnerability Scanning

```bash
# Scan images with Trivy
trivy image barq-backend:latest

# Scan filesystem
trivy fs ./backend

# Check for known vulnerabilities
npm audit --production
```

---

## Troubleshooting

### Common Issues

**1. Service Won't Start**
```bash
# Check logs
docker-compose logs backend

# Check health status
docker-compose ps

# Verify environment variables
docker-compose config

# Restart service
docker-compose restart backend
```

**2. Database Connection Errors**
```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres pg_isready -U barq_user

# Verify credentials
echo $DB_PASSWORD
```

**3. High Memory Usage**
```bash
# Check container stats
docker stats

# Limit container memory
docker-compose up -d --scale backend=1 --memory="512m"

# Clear Redis cache
docker-compose exec redis redis-cli FLUSHALL
```

**4. Port Already in Use**
```bash
# Find process using port
lsof -i :3003

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
```

**5. Image Build Failures**
```bash
# Clear build cache
docker builder prune -a

# Rebuild without cache
docker-compose build --no-cache backend

# Check Dockerfile syntax
docker build --check ./backend
```

### Debug Mode

```bash
# Run with debug logging
NODE_ENV=development LOG_LEVEL=debug docker-compose up

# Attach to running container
docker-compose exec backend sh

# Inspect container
docker inspect barq-backend

# View container processes
docker-compose top backend
```

### Performance Tuning

```bash
# Optimize PostgreSQL
docker-compose exec postgres psql -U barq_user -d barq_logistics -c "
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
"

# Restart PostgreSQL
docker-compose restart postgres

# Monitor query performance
docker-compose exec postgres psql -U barq_user -d barq_logistics -c "
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
"
```

### Getting Help

- Check logs: `docker-compose logs -f`
- Review documentation: [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md)
- Inspect container: `docker inspect <container>`
- Check GitHub Issues: <repository-url>/issues

---

## Appendix

### Useful Commands Reference

```bash
# Docker
docker-compose up -d                    # Start services
docker-compose down                     # Stop services
docker-compose ps                       # Service status
docker-compose logs -f <service>        # View logs
docker-compose restart <service>        # Restart service
docker-compose exec <service> sh        # Shell into container

# Database
./scripts/backup-db.sh                  # Backup database
./scripts/restore-db.sh <file>          # Restore database
docker-compose exec postgres psql -U barq_user -d barq_logistics

# Deployment
./scripts/deploy.sh development         # Deploy to dev
./scripts/deploy.sh staging v1.0.0      # Deploy to staging
./scripts/deploy.sh production v1.0.0   # Deploy to production

# Monitoring
curl http://localhost:9090              # Prometheus
curl http://localhost:3000              # Grafana
curl http://localhost:3003/health       # API health
```

### Environment Variables Reference

See [.env.template](.env.template) for complete list.

### Port Reference

| Service | Port | Description |
|---------|------|-------------|
| Backend API | 3003 | REST API and health checks |
| Frontend | 3001 | Next.js application |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3000 | Monitoring dashboards |

---

**Last Updated:** January 2025
**Version:** 1.0.0
**Maintained By:** DevOps Team
