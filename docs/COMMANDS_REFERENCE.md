# BARQ Fleet Management - Commands Reference

**Complete command reference for all operations**

---

## Table of Contents
1. [NPM Scripts](#npm-scripts)
2. [Docker Commands](#docker-commands)
3. [Database Commands](#database-commands)
4. [API Commands (curl)](#api-commands-curl)
5. [Git Commands](#git-commands)
6. [Deployment Commands](#deployment-commands)
7. [Monitoring Commands](#monitoring-commands)
8. [Backup & Recovery](#backup--recovery)
9. [Debugging Commands](#debugging-commands)
10. [Maintenance Scripts](#maintenance-scripts)

---

## NPM Scripts

### Installation
```bash
# Install all dependencies (root, backend, frontend)
npm run install:all

# Install backend only
cd backend && npm install

# Install frontend only
cd frontend && npm install

# Clean install (remove node_modules first)
npm run clean:install
```

### Development
```bash
# Start all services (backend + frontend)
npm run dev

# Start backend only
npm run backend
# Or
cd backend && npm run dev

# Start frontend only
npm run frontend
# Or
cd frontend && npm run dev

# Start with debug mode
npm run dev:debug

# Start with nodemon (auto-restart)
npm run dev:watch
```

### Building
```bash
# Build all
npm run build

# Build backend
cd backend && npm run build

# Build frontend
cd frontend && npm run build

# Build for production
NODE_ENV=production npm run build

# Build Docker images
npm run docker:build
```

### Testing
```bash
# Run all tests
npm run test

# Run backend tests
npm run test:backend
# Or
cd backend && npm test

# Run frontend tests
npm run test:frontend
# Or
cd frontend && npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- path/to/test.spec.js

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e
```

### Linting & Formatting
```bash
# Lint all code
npm run lint

# Lint and fix
npm run lint:fix

# Check TypeScript types (frontend)
cd frontend && npm run type-check

# Format code with Prettier
npm run format

# Check formatting
npm run format:check
```

### Database
```bash
# Run migrations
npm run db:migrate
# Or
cd backend && npm run migrate:latest

# Rollback last migration
npm run db:rollback
# Or
cd backend && npm run migrate:rollback

# Seed database
npm run db:seed
# Or
cd backend && npm run seed

# Reset database (rollback all + migrate + seed)
npm run db:reset

# Create new migration
npm run db:migrate:make migration_name
```

### Utilities
```bash
# Clean all node_modules and builds
npm run clean

# Clean backend
cd backend && npm run clean

# Clean frontend
cd frontend && npm run clean

# Generate API documentation
npm run docs:generate

# Start API documentation server
npm run docs:serve
```

---

## Docker Commands

### Basic Operations
```bash
# Start all services
docker-compose up

# Start in detached mode (background)
docker-compose up -d

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart backend
```

### Building
```bash
# Build all images
docker-compose build

# Build specific service
docker-compose build backend

# Build without cache
docker-compose build --no-cache

# Pull latest base images and build
docker-compose build --pull
```

### Logs
```bash
# View all logs
docker-compose logs

# Follow logs (live)
docker-compose logs -f

# View specific service logs
docker-compose logs backend
docker-compose logs frontend

# Follow specific service logs
docker-compose logs -f backend

# View last N lines
docker-compose logs --tail=50 backend

# View logs since timestamp
docker-compose logs --since 2024-11-05T10:00:00
```

### Service Management
```bash
# List running services
docker-compose ps

# Check service status
docker-compose ps backend

# Stop specific service
docker-compose stop backend

# Start specific service
docker-compose start backend

# Remove specific service
docker-compose rm backend

# Scale service (multiple instances)
docker-compose up -d --scale backend=3
```

### Container Operations
```bash
# Execute command in container
docker-compose exec backend bash
docker-compose exec backend node -v

# Execute as specific user
docker-compose exec -u root backend bash

# Run one-off command
docker-compose run backend npm test

# Copy files to/from container
docker cp local_file container_name:/path/in/container
docker cp container_name:/path/in/container local_file
```

### Resource Management
```bash
# View resource usage
docker stats

# View resource usage (no streaming)
docker stats --no-stream

# View specific container
docker stats backend

# View disk usage
docker system df

# Clean up unused resources
docker system prune

# Clean up everything (dangerous!)
docker system prune -a --volumes
```

### Images
```bash
# List images
docker images

# Remove image
docker rmi image_name

# Remove unused images
docker image prune

# Tag image
docker tag source_image:tag target_image:tag

# Push image to registry
docker push image_name:tag

# Pull image from registry
docker pull image_name:tag
```

### Networks
```bash
# List networks
docker network ls

# Inspect network
docker network inspect barq_network

# Create network
docker network create network_name

# Remove network
docker network rm network_name
```

### Volumes
```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect volume_name

# Remove volume
docker volume rm volume_name

# Remove unused volumes
docker volume prune
```

---

## Database Commands

### PostgreSQL Connection
```bash
# Connect to database
docker-compose exec postgres psql -U barq_user -d barq_db

# Execute single query
docker-compose exec postgres psql -U barq_user -d barq_db -c "SELECT version();"

# Execute query from file
docker-compose exec -T postgres psql -U barq_user -d barq_db < query.sql
```

### Database Operations
```bash
# Create database
docker-compose exec postgres psql -U barq_user -c "CREATE DATABASE db_name;"

# Drop database
docker-compose exec postgres psql -U barq_user -c "DROP DATABASE db_name;"

# List databases
docker-compose exec postgres psql -U barq_user -c "\l"

# Connect to different database
docker-compose exec postgres psql -U barq_user -d other_db
```

### Table Operations
```bash
# List tables
docker-compose exec postgres psql -U barq_user -d barq_db -c "\dt"

# Describe table
docker-compose exec postgres psql -U barq_user -d barq_db -c "\d orders"

# Count rows
docker-compose exec postgres psql -U barq_user -d barq_db -c "SELECT COUNT(*) FROM orders;"

# Truncate table
docker-compose exec postgres psql -U barq_user -d barq_db -c "TRUNCATE TABLE orders CASCADE;"

# Drop table
docker-compose exec postgres psql -U barq_user -d barq_db -c "DROP TABLE orders;"
```

### Maintenance
```bash
# Vacuum database
docker-compose exec postgres psql -U barq_user -d barq_db -c "VACUUM;"

# Vacuum analyze
docker-compose exec postgres psql -U barq_user -d barq_db -c "VACUUM ANALYZE;"

# Full vacuum
docker-compose exec postgres psql -U barq_user -d barq_db -c "VACUUM FULL;"

# Reindex database
docker-compose exec postgres psql -U barq_user -d barq_db -c "REINDEX DATABASE barq_db;"

# Analyze tables
docker-compose exec postgres psql -U barq_user -d barq_db -c "ANALYZE;"
```

### Monitoring
```bash
# Check database size
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT pg_size_pretty(pg_database_size('barq_db'));"

# Check table sizes
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
   FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# Check active connections
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

### Backup & Restore
```bash
# Backup database
docker-compose exec postgres pg_dump -U barq_user barq_db > backup.sql

# Backup with compression
docker-compose exec postgres pg_dump -U barq_user barq_db | gzip > backup.sql.gz

# Restore database
docker-compose exec -T postgres psql -U barq_user -d barq_db < backup.sql

# Restore from compressed backup
gunzip -c backup.sql.gz | docker-compose exec -T postgres psql -U barq_user -d barq_db
```

### Redis Commands
```bash
# Connect to Redis
docker-compose exec redis redis-cli

# Ping Redis
docker-compose exec redis redis-cli ping

# Get info
docker-compose exec redis redis-cli INFO

# Get memory stats
docker-compose exec redis redis-cli INFO memory

# Get statistics
docker-compose exec redis redis-cli INFO stats

# List all keys
docker-compose exec redis redis-cli KEYS '*'

# Get key value
docker-compose exec redis redis-cli GET key_name

# Set key value
docker-compose exec redis redis-cli SET key_name value

# Delete key
docker-compose exec redis redis-cli DEL key_name

# Clear all data
docker-compose exec redis redis-cli FLUSHALL

# Clear current database
docker-compose exec redis redis-cli FLUSHDB

# Monitor commands
docker-compose exec redis redis-cli MONITOR
```

---

## API Commands (curl)

### Health Checks
```bash
# Basic health check
curl http://localhost:3003/health

# Detailed health check
curl http://localhost:3003/health/detailed

# Agent health
curl http://localhost:3003/api/agents/health

# System status
curl http://localhost:3003/api/agents/status
```

### Route Optimization
```bash
# Optimize route
curl -X POST http://localhost:3003/api/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "pickups": [{
      "id": "pickup1",
      "name": "Restaurant A",
      "coordinates": {"lat": 24.7136, "lng": 46.6753}
    }],
    "deliveries": [{
      "id": "delivery1",
      "name": "Customer 1",
      "coordinates": {"lat": 24.7236, "lng": 46.6853}
    }]
  }'

# Get optimization result
curl http://localhost:3003/api/optimize/{requestId}

# Get optimization status
curl http://localhost:3003/api/optimize/status/{requestId}

# Get optimization history
curl http://localhost:3003/api/optimize/history

# Clear database
curl -X DELETE http://localhost:3003/api/optimize/db/clear
```

### Agent Operations
```bash
# Initialize agents
curl -X POST http://localhost:3003/api/agents/initialize

# Shutdown agents
curl -X POST http://localhost:3003/api/agents/shutdown

# Get fleet status
curl http://localhost:3003/api/agents/fleet/status

# Get SLA monitoring
curl http://localhost:3003/api/agents/sla/monitor

# Assign order
curl -X POST http://localhost:3003/api/agents/order/assign \
  -H "Content-Type: application/json" \
  -d '{"order": {...}}'

# Batch optimize
curl -X POST http://localhost:3003/api/agents/batch/optimize \
  -H "Content-Type: application/json" \
  -d '{"orders": [...]}'

# Get demand forecast
curl http://localhost:3003/api/agents/demand/forecast

# Get geo intelligence
curl http://localhost:3003/api/agents/geo/intelligence

# Get traffic patterns
curl http://localhost:3003/api/agents/traffic/patterns

# Get performance analytics
curl http://localhost:3003/api/agents/performance/analytics
```

### Authentication (if enabled)
```bash
# Login
curl -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@barq.com","password":"password123"}'

# Use token
curl http://localhost:3003/api/protected-endpoint \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Refresh token
curl -X POST http://localhost:3003/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'

# Logout
curl -X POST http://localhost:3003/api/auth/logout \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Pretty Print JSON
```bash
# Use jq for formatted output
curl http://localhost:3003/api/agents/health | jq '.'

# Get specific field
curl http://localhost:3003/api/agents/health | jq '.summary'

# Save to file
curl http://localhost:3003/api/agents/health | jq '.' > health.json
```

---

## Git Commands

### Daily Workflow
```bash
# Check status
git status

# Pull latest changes
git pull origin main

# Create feature branch
git checkout -b feature/feature-name

# Stage changes
git add .
git add specific-file.js

# Commit changes
git commit -m "feat: add new feature"

# Push changes
git push origin feature/feature-name

# Switch branches
git checkout main
git checkout -b new-branch
```

### Branch Management
```bash
# List branches
git branch
git branch -a  # include remote branches

# Create branch
git branch branch-name

# Delete branch
git branch -d branch-name
git branch -D branch-name  # force delete

# Rename branch
git branch -m old-name new-name

# Merge branch
git checkout main
git merge feature/feature-name
```

### Remote Operations
```bash
# View remotes
git remote -v

# Add remote
git remote add origin url

# Fetch from remote
git fetch origin

# Pull from remote
git pull origin main

# Push to remote
git push origin branch-name

# Push and set upstream
git push -u origin branch-name
```

### History & Logs
```bash
# View commit history
git log

# View compact history
git log --oneline

# View last N commits
git log -5

# View changes
git log -p

# Search commits
git log --grep="search term"

# View file history
git log -- path/to/file
```

### Undoing Changes
```bash
# Discard changes in file
git checkout -- file.js

# Unstage file
git reset HEAD file.js

# Amend last commit
git commit --amend

# Reset to previous commit (keep changes)
git reset --soft HEAD~1

# Reset to previous commit (discard changes)
git reset --hard HEAD~1

# Revert commit (create new commit)
git revert commit-hash
```

### Stashing
```bash
# Stash changes
git stash

# Stash with message
git stash save "work in progress"

# List stashes
git stash list

# Apply stash
git stash apply
git stash apply stash@{0}

# Pop stash (apply and remove)
git stash pop

# Drop stash
git stash drop stash@{0}
```

---

## Deployment Commands

### Local Deployment
```bash
# Build for production
NODE_ENV=production npm run build

# Start production server
NODE_ENV=production npm start

# Using PM2
pm2 start ecosystem.config.js
pm2 status
pm2 logs
pm2 restart all
pm2 stop all
```

### Docker Production
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start production
docker-compose -f docker-compose.prod.yml up -d

# View production logs
docker-compose -f docker-compose.prod.yml logs -f
```

### GCP Cloud Run
```bash
# Deploy backend
gcloud run deploy barq-backend \
  --source ./backend \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated

# Deploy frontend
gcloud run deploy barq-frontend \
  --source ./frontend \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated

# View services
gcloud run services list

# View logs
gcloud run services logs read barq-backend

# Update service
gcloud run services update barq-backend \
  --set-env-vars KEY=VALUE

# Delete service
gcloud run services delete barq-backend
```

### GCP Cloud SQL
```bash
# Create instance
gcloud sql instances create barq-db \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create barq_db \
  --instance=barq-db

# Create user
gcloud sql users create barq_user \
  --instance=barq-db \
  --password=secure_password

# Connect to instance
gcloud sql connect barq-db --user=barq_user
```

---

## Monitoring Commands

### System Monitoring
```bash
# Monitor Docker stats
docker stats

# Monitor specific container
docker stats backend

# Monitor disk space
df -h

# Monitor memory
free -h

# Monitor processes
top
htop  # if available

# Monitor network
netstat -tulpn
ss -tulpn
```

### Application Monitoring
```bash
# View process logs
tail -f logs/backend.log

# Monitor API requests
docker-compose logs -f backend | grep "GET\|POST"

# Monitor errors
docker-compose logs -f backend | grep -i error

# Monitor performance
docker-compose logs -f backend | grep "response time"

# Count requests
docker-compose logs --since 1h backend | grep "GET" | wc -l
```

### Prometheus Queries
```bash
# Query Prometheus API
curl 'http://localhost:9090/api/v1/query?query=up'

# Query with time range
curl 'http://localhost:9090/api/v1/query_range?query=rate(http_requests_total[5m])&start=2024-11-05T00:00:00Z&end=2024-11-05T23:59:59Z&step=1h'

# Get targets
curl 'http://localhost:9090/api/v1/targets'

# Get alerts
curl 'http://localhost:9090/api/v1/alerts'
```

---

## Backup & Recovery

### Backup Commands
```bash
# Backup database
./scripts/backup-db.sh

# Backup with custom name
./scripts/backup-db.sh custom-backup-name

# Backup all (database + files)
./scripts/backup-all.sh

# Automated daily backup
echo "0 2 * * * /path/to/scripts/backup-db.sh" | crontab -
```

### Restore Commands
```bash
# Restore latest backup
./scripts/restore-backup.sh

# Restore specific backup
./scripts/restore-backup.sh backend/database/backups/barq_db_20250105.sql.gz

# Restore to different database
./scripts/restore-backup.sh backup.sql.gz test_database
```

---

## Debugging Commands

### Enable Debug Mode
```bash
# Backend debug mode
DEBUG=* npm run dev

# Specific debug namespace
DEBUG=app:* npm run dev

# Node.js inspector
node --inspect backend/src/app.js

# Chrome DevTools debugging
node --inspect-brk backend/src/app.js
# Open chrome://inspect in Chrome
```

### Check Connections
```bash
# Test backend connectivity
curl -I http://localhost:3003/health

# Test WebSocket
npm install -g wscat
wscat -c ws://localhost:8081

# Test database
docker-compose exec postgres pg_isready -U barq_user

# Test Redis
docker-compose exec redis redis-cli ping

# Check open ports
lsof -i :3003
lsof -i :3001
lsof -i :5432
```

### Performance Profiling
```bash
# Node.js profiler
node --prof backend/src/app.js

# Process profile log
node --prof-process isolate-*.log > profile.txt

# Clinic.js bubbleprof
npm install -g clinic
clinic doctor -- node backend/src/app.js
clinic bubbleprof -- node backend/src/app.js

# Memory profiling
node --inspect --max-old-space-size=4096 backend/src/app.js
```

---

## Maintenance Scripts

### Daily Scripts
```bash
# Run daily health check
./scripts/daily-health-check.sh

# Clean old logs
./scripts/clean-logs.sh

# Generate daily report
./scripts/generate-daily-report.sh
```

### Weekly Scripts
```bash
# Run weekly maintenance
./scripts/weekly-maintenance.sh

# Analyze slow queries
./scripts/analyze-slow-queries.sh

# Security audit
./scripts/security-audit.sh
```

### Utility Scripts
```bash
# Kill all processes on ports
./kill-ports.sh

# Reset development environment
./scripts/reset-dev-env.sh

# Update dependencies
./scripts/update-dependencies.sh

# Run all tests
./test-all.sh
```

---

## Quick Reference

### Most Used Commands
```bash
# Start everything
npm run dev

# View logs
docker-compose logs -f

# Restart backend
docker-compose restart backend

# Run tests
npm test

# Database backup
./scripts/backup-db.sh

# Check health
curl http://localhost:3003/health
```

### Emergency Commands
```bash
# Stop everything
docker-compose down

# Reset everything
docker-compose down -v && docker-compose up -d

# Restore from backup
./scripts/restore-backup.sh

# Check system resources
docker stats --no-stream
```

---

**Document Version**: 1.0.0
**Last Updated**: November 5, 2025
**Maintained By**: DevOps Team
