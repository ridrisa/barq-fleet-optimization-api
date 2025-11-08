# BARQ Fleet Management - Troubleshooting Guide

**Version**: 1.0.0
**Last Updated**: November 5, 2025

---

## Table of Contents
1. [Quick Diagnostics](#quick-diagnostics)
2. [Top 20 Common Issues](#top-20-common-issues)
3. [Service-Specific Issues](#service-specific-issues)
4. [Database Issues](#database-issues)
5. [Performance Issues](#performance-issues)
6. [Agent System Issues](#agent-system-issues)
7. [Frontend Issues](#frontend-issues)
8. [Network & Connectivity Issues](#network--connectivity-issues)
9. [Deployment Issues](#deployment-issues)
10. [Emergency Procedures](#emergency-procedures)

---

## Quick Diagnostics

### Run Health Check Script
```bash
#!/bin/bash
# Save as: check-system-health.sh

echo "=== BARQ System Health Check ==="
echo ""

# 1. Check if services are running
echo "1. Service Status:"
docker-compose ps

# 2. Check backend health
echo ""
echo "2. Backend API Health:"
curl -s http://localhost:3003/health | jq '.'

# 3. Check agent health
echo ""
echo "3. Agent System Health:"
curl -s http://localhost:3003/api/agents/health | jq '.summary'

# 4. Check database connection
echo ""
echo "4. Database Connection:"
docker-compose exec postgres pg_isready -U barq_user

# 5. Check Redis
echo ""
echo "5. Redis Connection:"
docker-compose exec redis redis-cli ping

# 6. Check recent errors
echo ""
echo "6. Recent Backend Errors (last 10):"
docker-compose logs --tail=100 backend | grep -i error | tail -n 10

# 7. Check disk space
echo ""
echo "7. Disk Space:"
df -h | grep -E '(Filesystem|/dev/disk)'

# 8. Check memory
echo ""
echo "8. Memory Usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "=== Health Check Complete ==="
```

### Quick Status Commands
```bash
# Check all services
docker-compose ps

# Check logs
docker-compose logs --tail=50 backend
docker-compose logs --tail=50 frontend

# Check resource usage
docker stats --no-stream

# Test API endpoint
curl http://localhost:3003/health

# Test agent status
curl http://localhost:3003/api/agents/status
```

---

## Top 20 Common Issues

### 1. Backend Service Won't Start

**Symptoms:**
- `docker-compose up` shows backend exiting immediately
- "Error: Cannot find module" errors
- Port 3003 not responding

**Diagnosis:**
```bash
# Check logs
docker-compose logs backend

# Check if port is already in use
lsof -i :3003

# Check node_modules
ls backend/node_modules | wc -l
```

**Solution:**
```bash
# 1. Reinstall dependencies
cd backend
rm -rf node_modules package-lock.json
npm install

# 2. If port is in use
kill -9 $(lsof -t -i:3003)

# 3. Restart service
docker-compose restart backend

# 4. If still failing, rebuild
docker-compose down
docker-compose build --no-cache backend
docker-compose up -d
```

**Prevention:**
- Always run `npm install` after pulling changes
- Keep Docker images up to date

---

### 2. Database Connection Failed

**Symptoms:**
- "ECONNREFUSED" errors in backend logs
- "database not found" errors
- "authentication failed" errors

**Diagnosis:**
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check connection
docker-compose exec postgres psql -U barq_user -d barq_db -c "SELECT version();"

# Check environment variables
docker-compose exec backend env | grep DB_
```

**Solution:**
```bash
# 1. Restart database
docker-compose restart postgres

# 2. Check credentials in .env
cat backend/.env | grep DB_

# 3. Recreate database
docker-compose down -v
docker-compose up -d postgres
sleep 10
docker-compose exec postgres psql -U barq_user -d postgres -c "CREATE DATABASE barq_db;"

# 4. Run migrations
cd backend
npm run migrate:latest
```

**Prevention:**
- Keep .env file synced with docker-compose.yml
- Always wait for database to be ready before starting backend

---

### 3. AI Agents Not Initializing

**Symptoms:**
- "Agent initialization failed" in logs
- Agent health check shows unhealthy agents
- Routes return "Agent not available" errors

**Diagnosis:**
```bash
# Check agent status
curl http://localhost:3003/api/agents/health | jq '.'

# Check backend logs for agent errors
docker-compose logs backend | grep -i "agent"

# Check LLM API configuration
curl http://localhost:3003/api/agents/status | jq '.systemStatus'
```

**Solution:**
```bash
# 1. Check GROQ API key is set
echo $GROQ_API_KEY

# 2. Reinitialize agents
curl -X POST http://localhost:3003/api/agents/initialize

# 3. Check specific agent
curl http://localhost:3003/api/agents/fleet/status

# 4. If all else fails, restart backend
docker-compose restart backend

# 5. Watch initialization
docker-compose logs -f backend | grep "Agent"
```

**Prevention:**
- Ensure GROQ_API_KEY is valid and has sufficient quota
- Monitor agent health regularly

---

### 4. Frontend Not Loading

**Symptoms:**
- Blank white screen
- "Failed to load resource" errors in browser console
- 404 errors on frontend routes

**Diagnosis:**
```bash
# Check if frontend is running
docker-compose ps frontend

# Check frontend logs
docker-compose logs frontend | tail -n 50

# Check browser console for errors
# Open DevTools → Console

# Check if backend is accessible
curl http://localhost:3003/health
```

**Solution:**
```bash
# 1. Check environment variables
cat frontend/.env.local

# 2. Rebuild frontend
cd frontend
rm -rf .next node_modules
npm install
npm run build

# 3. Restart frontend
docker-compose restart frontend

# 4. Clear browser cache
# Chrome: Cmd+Shift+Delete (Mac) or Ctrl+Shift+Delete (Windows)

# 5. Check API connectivity from frontend
# Open browser console and run:
# fetch('http://localhost:3003/health').then(r => r.json()).then(console.log)
```

**Prevention:**
- Always set NEXT_PUBLIC_API_URL in .env.local
- Clear cache after deployment

---

### 5. WebSocket Connection Failed

**Symptoms:**
- Real-time updates not working
- "WebSocket connection failed" in console
- No live order updates on dashboard

**Diagnosis:**
```bash
# Check WebSocket server
netstat -an | grep 8081

# Test WebSocket connection
npm install -g wscat
wscat -c ws://localhost:8081

# Check backend logs
docker-compose logs backend | grep -i websocket
```

**Solution:**
```bash
# 1. Restart backend (includes WebSocket server)
docker-compose restart backend

# 2. Check port availability
lsof -i :8081

# 3. If port blocked
kill -9 $(lsof -t -i:8081)

# 4. Update WebSocket URL in frontend
# Edit frontend/.env.local
NEXT_PUBLIC_WS_URL=ws://localhost:8081

# 5. Test connection
node test-websocket.js
```

**Prevention:**
- Ensure firewall allows port 8081
- Configure proper WebSocket URL for production

---

### 6. Orders Not Appearing in UI

**Symptoms:**
- POST /api/optimize returns success but orders not visible
- Empty order list in dashboard
- Order count is 0

**Diagnosis:**
```bash
# Check database
docker-compose exec postgres psql -U barq_user -d barq_db -c "SELECT COUNT(*) FROM orders;"

# Check API response
curl -X POST http://localhost:3003/api/optimize \
  -H "Content-Type: application/json" \
  -d '{"pickups":[...],"deliveries":[...]}'

# Check frontend API calls in browser DevTools → Network
```

**Solution:**
```bash
# 1. Check if data is being saved
curl http://localhost:3003/api/optimize/history

# 2. If using lowdb, check db.json
cat backend/src/db/db.json | jq '.optimizations'

# 3. Clear and reseed
curl -X DELETE http://localhost:3003/api/optimize/db/clear
npm run seed

# 4. Restart services
docker-compose restart backend frontend
```

**Prevention:**
- Verify database migrations run successfully
- Monitor database write operations

---

### 7. Route Optimization Takes Too Long

**Symptoms:**
- Optimization requests timeout
- Response time > 30 seconds
- Gateway timeout errors

**Diagnosis:**
```bash
# Check backend logs for slow operations
docker-compose logs backend | grep "duration"

# Monitor agent processing
curl http://localhost:3003/api/agents/status

# Check OSRM availability
curl http://router.project-osrm.org/route/v1/driving/13.388860,52.517037;13.397634,52.529407

# Check CPU/Memory usage
docker stats
```

**Solution:**
```bash
# 1. Optimize request payload (reduce stops)
# Keep pickups + deliveries < 25 stops

# 2. Enable caching
# Check Redis is running
docker-compose ps redis

# 3. Increase timeout in frontend
# Edit frontend/.env.local
NEXT_PUBLIC_API_TIMEOUT=60000

# 4. Scale backend
docker-compose up -d --scale backend=3

# 5. Use batch optimization for large requests
curl -X POST http://localhost:3003/api/agents/batch/optimize
```

**Prevention:**
- Implement request size limits
- Use batch processing for large orders
- Monitor optimization performance metrics

---

### 8. High Memory Usage

**Symptoms:**
- Services crashing with "Out of memory" errors
- Docker showing high memory usage
- System becomes slow

**Diagnosis:**
```bash
# Check memory usage
docker stats --no-stream

# Check specific service memory
docker inspect backend | grep -i memory

# Check system memory
free -h

# Check for memory leaks
docker-compose logs backend | grep -i "memory"
```

**Solution:**
```bash
# 1. Increase Docker memory limit
# Docker Desktop → Settings → Resources → Memory (8GB+)

# 2. Restart services
docker-compose restart

# 3. Clear cache
docker-compose exec redis redis-cli FLUSHALL

# 4. Set memory limits in docker-compose.yml
# services:
#   backend:
#     deploy:
#       resources:
#         limits:
#           memory: 2G

# 5. Investigate memory leak
npm install -g clinic
clinic doctor -- node backend/src/app.js
```

**Prevention:**
- Monitor memory usage regularly
- Implement proper cleanup in code
- Set appropriate memory limits

---

### 9. SSL Certificate Errors (Production)

**Symptoms:**
- "Certificate not trusted" warnings
- ERR_CERT_AUTHORITY_INVALID
- HTTPS not working

**Diagnosis:**
```bash
# Check certificate validity
openssl s_client -connect api.barq.com:443 -servername api.barq.com

# Check certificate expiry
echo | openssl s_client -connect api.barq.com:443 2>/dev/null | openssl x509 -noout -dates

# Check certificate chain
curl -vI https://api.barq.com
```

**Solution:**
```bash
# 1. Renew certificate (Let's Encrypt)
certbot renew --force-renewal

# 2. For GCP, update managed certificate
gcloud compute ssl-certificates create barq-cert \
  --domains=api.barq.com,www.barq.com

# 3. Update load balancer
gcloud compute target-https-proxies update barq-proxy \
  --ssl-certificates=barq-cert

# 4. Restart services
docker-compose restart
```

**Prevention:**
- Set up auto-renewal for certificates
- Monitor certificate expiry (alert 30 days before)
- Use managed certificates when possible

---

### 10. Redis Connection Issues

**Symptoms:**
- "Redis connection refused"
- Cache misses on all requests
- Session data lost

**Diagnosis:**
```bash
# Check Redis status
docker-compose ps redis

# Test connection
docker-compose exec redis redis-cli ping

# Check Redis logs
docker-compose logs redis | tail -n 50

# Check connection from backend
docker-compose exec backend nc -zv redis 6379
```

**Solution:**
```bash
# 1. Restart Redis
docker-compose restart redis

# 2. Clear Redis data if corrupted
docker-compose exec redis redis-cli FLUSHALL

# 3. Check Redis persistence
docker-compose exec redis redis-cli CONFIG GET save

# 4. Verify Redis configuration
cat backend/.env | grep REDIS_

# 5. If Redis container won't start
docker-compose down
docker volume rm barq_redis_data
docker-compose up -d redis
```

**Prevention:**
- Enable Redis persistence (AOF + RDB)
- Monitor Redis memory usage
- Regular Redis backups

---

### 11. Authentication Failures

**Symptoms:**
- "Unauthorized" errors
- JWT token rejected
- Login not working

**Diagnosis:**
```bash
# Check JWT secret is set
docker-compose exec backend env | grep JWT_SECRET

# Test login endpoint
curl -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@barq.com","password":"password123"}'

# Verify token
# Decode JWT at https://jwt.io

# Check token expiry
docker-compose logs backend | grep "token"
```

**Solution:**
```bash
# 1. Regenerate JWT secret
# Add to backend/.env
JWT_SECRET=$(openssl rand -base64 32)

# 2. Clear old sessions
docker-compose exec redis redis-cli FLUSHALL

# 3. Restart backend
docker-compose restart backend

# 4. Clear browser cookies
# DevTools → Application → Cookies → Clear

# 5. Re-login
# Navigate to /login and sign in again
```

**Prevention:**
- Use strong JWT secret (32+ characters)
- Implement token refresh
- Set appropriate token expiry

---

### 12. Driver Assignment Failures

**Symptoms:**
- "No available drivers" error
- Orders stuck in pending status
- Assignment agent not responding

**Diagnosis:**
```bash
# Check driver count
curl http://localhost:3003/api/agents/fleet/status | jq '.data.available'

# Check driver state
docker-compose logs backend | grep "driver.*state"

# Check order assignment logs
docker-compose logs backend | grep "OrderAssignment"
```

**Solution:**
```bash
# 1. Check if drivers are seeded
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT COUNT(*) FROM drivers WHERE status='available';"

# 2. Seed drivers if none exist
cd backend
npm run seed

# 3. Reinitialize agent system
curl -X POST http://localhost:3003/api/agents/initialize

# 4. Manually assign order
curl -X POST http://localhost:3003/api/agents/order/assign \
  -H "Content-Type: application/json" \
  -d '{"order": {...}}'
```

**Prevention:**
- Maintain minimum driver pool
- Monitor driver availability
- Implement driver auto-recovery

---

### 13. SLA Breaches Not Detected

**Symptoms:**
- Orders exceeding SLA without alerts
- SLA monitor not triggering
- No reassignment happening

**Diagnosis:**
```bash
# Check SLA monitor status
curl http://localhost:3003/api/agents/sla/monitor | jq '.'

# Check SLA thresholds
cat backend/src/agents/sla-monitor.agent.js | grep "SLA_TYPES"

# Check if monitoring is running
docker-compose logs backend | grep "SLAMonitor"
```

**Solution:**
```bash
# 1. Verify SLA configuration
# Check backend/.env
SLA_CHECK_INTERVAL=10000  # 10 seconds
SLA_WARNING_THRESHOLD=0.75  # 75%

# 2. Restart SLA monitoring
curl -X POST http://localhost:3003/api/agents/initialize

# 3. Test SLA escalation
curl -X POST http://localhost:3003/api/agents/emergency/escalate \
  -H "Content-Type: application/json" \
  -d '{"type":"SLA_CRITICAL","level":"L2","context":{...}}'

# 4. Check alert configuration
docker-compose logs backend | grep "alert"
```

**Prevention:**
- Monitor SLA compliance daily
- Test escalation procedures regularly
- Set up proper alerting (email/SMS)

---

### 14. Map Not Loading (Mapbox Issues)

**Symptoms:**
- Blank map area
- "Failed to load map style" error
- Map tiles not rendering

**Diagnosis:**
```bash
# Check Mapbox token
cat frontend/.env.local | grep MAPBOX

# Verify token in browser console
# localStorage.getItem('mapbox.token')

# Check network requests in DevTools
# Look for requests to api.mapbox.com

# Test token validity
curl "https://api.mapbox.com/styles/v1/mapbox/streets-v11?access_token=YOUR_TOKEN"
```

**Solution:**
```bash
# 1. Verify Mapbox token is set
echo "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk...." >> frontend/.env.local

# 2. Regenerate token if invalid
# Visit https://account.mapbox.com/access-tokens/

# 3. Rebuild frontend
cd frontend
rm -rf .next
npm run build

# 4. Clear browser cache
# Hard reload: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

# 5. Check token scope
# Token needs scopes: styles:read, fonts:read, styles:tiles
```

**Prevention:**
- Use separate tokens for dev/prod
- Monitor Mapbox usage quota
- Set token rotation reminder

---

### 15. Performance Degradation Over Time

**Symptoms:**
- Application gets slower over time
- Response times increasing
- Memory usage growing

**Diagnosis:**
```bash
# Monitor metrics over time
docker stats

# Check database performance
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Check for slow queries
docker-compose logs backend | grep "slow query"

# Check cache hit rate
docker-compose exec redis redis-cli INFO stats | grep keyspace
```

**Solution:**
```bash
# 1. Restart services (temporary fix)
docker-compose restart

# 2. Clear caches
docker-compose exec redis redis-cli FLUSHALL

# 3. Optimize database
docker-compose exec postgres psql -U barq_user -d barq_db -c "VACUUM ANALYZE;"

# 4. Review slow queries
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 5;"

# 5. Add missing indexes
# Analyze queries and add indexes as needed

# 6. Scale horizontally
docker-compose up -d --scale backend=3
```

**Prevention:**
- Regular database maintenance
- Monitor performance metrics
- Implement query optimization
- Regular cache cleanup

---

### 16. Deployment Failures

**Symptoms:**
- `docker-compose up` fails
- "Build failed" errors
- Services won't start after deployment

**Diagnosis:**
```bash
# Check Docker daemon
docker info

# Check disk space
df -h

# Review build logs
docker-compose build --no-cache 2>&1 | tee build.log

# Check for errors
cat build.log | grep -i error
```

**Solution:**
```bash
# 1. Clean Docker system
docker system prune -a --volumes

# 2. Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d

# 3. Check environment variables
cat .env | grep -v '^#'

# 4. Verify file permissions
find . -type f -name "*.sh" -exec chmod +x {} \;

# 5. Check for port conflicts
lsof -i :3003
lsof -i :3001
lsof -i :5432
```

**Prevention:**
- Test deployments in staging first
- Maintain clean Docker environment
- Document deployment process

---

### 17. Data Loss or Corruption

**Symptoms:**
- Missing orders/drivers
- Inconsistent data
- Foreign key violations

**Diagnosis:**
```bash
# Check database integrity
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT COUNT(*) FROM orders;"

# Check for orphaned records
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT o.* FROM orders o LEFT JOIN drivers d ON o.driver_id = d.id WHERE d.id IS NULL;"

# Check transaction logs
docker-compose logs postgres | grep -i error

# Check backup availability
ls -lh backend/database/backups/
```

**Solution:**
```bash
# 1. Stop all services
docker-compose stop

# 2. Restore from backup
docker-compose exec postgres psql -U barq_user -d barq_db < \
  backend/database/backups/barq_db_$(date +%Y%m%d).sql

# 3. Verify data integrity
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT COUNT(*) FROM orders; SELECT COUNT(*) FROM drivers;"

# 4. Restart services
docker-compose start

# 5. Verify application functionality
curl http://localhost:3003/health
```

**Prevention:**
- Automated daily backups
- Test backup restoration regularly
- Implement transaction logging
- Use database constraints

---

### 18. External API Failures (GROQ, OSRM)

**Symptoms:**
- "External API timeout" errors
- Route optimization fails
- AI agents not responding

**Diagnosis:**
```bash
# Test GROQ API
curl -X POST https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"mixtral-8x7b-32768","messages":[{"role":"user","content":"test"}]}'

# Test OSRM API
curl "http://router.project-osrm.org/route/v1/driving/46.6753,24.7136;46.6853,24.7236?overview=false"

# Check circuit breaker status
docker-compose logs backend | grep "circuit.*breaker"
```

**Solution:**
```bash
# 1. Verify API keys
echo $GROQ_API_KEY

# 2. Check API quotas/limits
# Visit https://console.groq.com/

# 3. Implement fallback
# Use cached results or default values

# 4. Configure circuit breaker
# Edit backend/.env
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=60000

# 5. Use alternative OSRM instance
# Self-host OSRM or use different provider
```

**Prevention:**
- Monitor external API health
- Implement circuit breakers
- Set up fallback mechanisms
- Cache API responses

---

### 19. Email/SMS Notifications Not Sending

**Symptoms:**
- Users not receiving notifications
- No error in logs but emails not delivered
- SMS not arriving

**Diagnosis:**
```bash
# Check notification service logs
docker-compose logs backend | grep -i notification

# Check SMTP configuration
cat backend/.env | grep -E "(SMTP|EMAIL)"

# Test email sending
curl -X POST http://localhost:3003/api/notifications/test

# Check notification queue
docker-compose exec redis redis-cli LLEN notification_queue
```

**Solution:**
```bash
# 1. Verify SMTP credentials
# Edit backend/.env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=app-specific-password

# 2. Test SMTP connection
npm install -g smtp-connection-tester
smtp-test smtp.gmail.com 587 your-email@gmail.com your-password

# 3. Check spam folder
# Notifications might be flagged as spam

# 4. Verify recipient emails
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT email FROM users WHERE id='...';"

# 5. Check notification service status
curl http://localhost:3003/api/agents/status | jq '.systemStatus.agents' | grep notification
```

**Prevention:**
- Use proper email service (SendGrid, AWS SES)
- Implement email verification
- Monitor delivery rates
- Set up SPF/DKIM records

---

### 20. WebSocket Memory Leak

**Symptoms:**
- WebSocket connections accumulating
- Memory usage increasing over time
- Backend crashes after several hours

**Diagnosis:**
```bash
# Check active WebSocket connections
docker-compose exec backend netstat -an | grep 8081 | wc -l

# Monitor memory over time
watch -n 5 'docker stats --no-stream backend | tail -n 1'

# Check for connection cleanup
docker-compose logs backend | grep "websocket.*close"

# Profile memory
npm install -g clinic
clinic heapprofiler -- node backend/src/app.js
```

**Solution:**
```bash
# 1. Implement connection timeout
# Edit backend/src/app.js
# Add: ws.setTimeout(300000); // 5 minutes

# 2. Implement heartbeat/ping-pong
# Add to WebSocket server:
# setInterval(() => { ws.ping(); }, 30000);

# 3. Clean up disconnected clients
# Implement proper cleanup on 'close' event

# 4. Restart backend (temporary)
docker-compose restart backend

# 5. Limit max connections
# Add: ws.maxConnections = 1000;
```

**Prevention:**
- Implement connection limits
- Use heartbeat mechanism
- Clean up disconnected clients
- Monitor WebSocket metrics

---

## Service-Specific Issues

### Backend API Issues

**Issue**: API returns 500 Internal Server Error
```bash
# Check logs
docker-compose logs --tail=100 backend | grep "Error"

# Check if specific endpoint
curl -v http://localhost:3003/api/optimize

# Enable debug logging
# Edit backend/.env
LOG_LEVEL=debug

# Restart with debug
docker-compose restart backend
docker-compose logs -f backend
```

**Issue**: API endpoint not found (404)
```bash
# Verify route registration
curl http://localhost:3003/api/agents/status

# Check routes file
cat backend/src/app.js | grep "app.use"

# List all registered routes
docker-compose exec backend node -e "
const app = require('./src/app');
console.log(app._router.stack.filter(r => r.route).map(r => r.route.path));
"
```

---

### Frontend Issues

**Issue**: Build fails
```bash
# Clear cache and rebuild
cd frontend
rm -rf .next node_modules
npm install
npm run build

# Check for TypeScript errors
npm run type-check

# Check for ESLint errors
npm run lint
```

**Issue**: API calls failing with CORS error
```bash
# Check CORS configuration in backend
cat backend/src/app.js | grep cors

# Verify NEXT_PUBLIC_API_URL is correct
cat frontend/.env.local | grep API_URL

# Check browser DevTools → Console for exact error
```

---

## Database Issues

### PostgreSQL Won't Start
```bash
# Check logs
docker-compose logs postgres

# Check data directory permissions
docker-compose exec postgres ls -la /var/lib/postgresql/data

# Remove corrupted data and restart
docker-compose down -v
docker volume rm barq_postgres_data
docker-compose up -d postgres
```

### Database Connection Pool Exhausted
```bash
# Check active connections
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active';"

# Increase pool size
# Edit backend/.env
DB_POOL_SIZE=20

# Kill idle connections
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < NOW() - INTERVAL '5 minutes';"
```

### Slow Queries
```bash
# Enable slow query logging
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "ALTER DATABASE barq_db SET log_min_duration_statement = 1000;"

# Find slow queries
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT query, mean_exec_time, calls FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Create missing indexes
# Analyze EXPLAIN output and add indexes
```

---

## Performance Issues

### High CPU Usage
```bash
# Identify CPU-hungry process
docker stats --no-stream | sort -k3 -hr

# Check backend for infinite loops
docker-compose logs backend | grep -i "loop\|infinite"

# Profile CPU usage
docker-compose exec backend node --prof src/app.js

# Reduce agent processing frequency
# Edit backend/.env
AGENT_CHECK_INTERVAL=30000  # Increase from 10s to 30s
```

### Slow API Responses
```bash
# Enable request timing
# Add middleware in backend/src/app.js:
# app.use((req, res, next) => {
#   const start = Date.now();
#   res.on('finish', () => {
#     console.log(`${req.method} ${req.path} - ${Date.now() - start}ms`);
#   });
#   next();
# });

# Check database query times
docker-compose logs backend | grep "query.*ms"

# Optimize slow endpoints
# Add caching, pagination, indexes
```

---

## Agent System Issues

### Agent Not Responding
```bash
# Check specific agent health
curl http://localhost:3003/api/agents/health | jq '.agents.orderAssignment'

# Reinitialize specific agent
curl -X POST http://localhost:3003/api/agents/initialize

# Check agent logs
docker-compose logs backend | grep "OrderAssignment"

# Verify LLM connectivity
curl -X POST https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"mixtral-8x7b-32768","messages":[{"role":"user","content":"ping"}]}'
```

### Agent System Crashed
```bash
# Check crash logs
docker-compose logs backend | grep -i "crash\|fatal\|uncaught"

# Restart agent system
docker-compose restart backend

# Verify all agents initialized
curl http://localhost:3003/api/agents/health | jq '.summary'

# Check for memory leaks
docker stats --no-stream backend
```

---

## Frontend Issues

### React Hydration Errors
```bash
# Clear .next cache
cd frontend
rm -rf .next

# Check for server/client mismatch
npm run build
npm run start

# Check browser console for specifics
# DevTools → Console
```

### Redux State Issues
```bash
# Clear Redux DevTools history
# Redux DevTools → Clear

# Check Redux state
# Redux DevTools → State → Inspect

# Reset state
# localStorage.clear();
# location.reload();
```

---

## Network & Connectivity Issues

### Cannot Connect to Backend from Frontend
```bash
# Check if backend is accessible
curl http://localhost:3003/health

# Check NEXT_PUBLIC_API_URL
cat frontend/.env.local | grep API_URL

# Check browser can access backend
# Open http://localhost:3003/health in browser

# Check for CORS issues
# DevTools → Console

# Check network requests
# DevTools → Network → XHR
```

### DNS Resolution Issues (Production)
```bash
# Check DNS records
dig api.barq.com

# Check DNS propagation
# Visit https://www.whatsmydns.net/

# Flush DNS cache
# Mac: sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
# Linux: sudo systemd-resolve --flush-caches
# Windows: ipconfig /flushdns

# Update /etc/hosts temporarily (testing)
echo "35.123.456.789 api.barq.com" | sudo tee -a /etc/hosts
```

---

## Deployment Issues

### Docker Compose Fails
```bash
# Validate docker-compose.yml
docker-compose config

# Check for syntax errors
yamllint docker-compose.yml

# Rebuild images
docker-compose build --no-cache

# Check Docker daemon
docker info

# Free up disk space
docker system prune -a
```

### GCP Deployment Fails
```bash
# Check Cloud Run logs
gcloud run services logs read barq-backend

# Check service configuration
gcloud run services describe barq-backend

# Redeploy
gcloud run deploy barq-backend \
  --source . \
  --region us-central1

# Check build logs
gcloud builds list --limit=5
```

---

## Emergency Procedures

### Complete System Failure

**Immediate Actions:**
```bash
# 1. Stop all services
docker-compose down

# 2. Check system resources
df -h
free -h
docker system df

# 3. Clean up if needed
docker system prune -a --volumes

# 4. Restore from backup
./scripts/restore-backup.sh

# 5. Start services
docker-compose up -d

# 6. Verify health
./scripts/check-system-health.sh
```

### Data Corruption

**Recovery Steps:**
```bash
# 1. Stop services immediately
docker-compose stop

# 2. Backup current state (even if corrupted)
./scripts/backup-db.sh emergency-$(date +%Y%m%d-%H%M%S)

# 3. Restore from last good backup
./scripts/restore-backup.sh backend/database/backups/barq_db_YYYYMMDD.sql

# 4. Verify restored data
docker-compose exec postgres psql -U barq_user -d barq_db -c "SELECT COUNT(*) FROM orders;"

# 5. Restart services
docker-compose start

# 6. Notify stakeholders
```

### Security Breach

**Immediate Response:**
```bash
# 1. Isolate affected systems
docker-compose down

# 2. Change all passwords and tokens
# - Database passwords
# - API keys
# - JWT secrets
# - Service account keys

# 3. Review access logs
docker-compose logs | grep -E "(auth|login|token)"

# 4. Backup evidence
cp -r logs/ security-incident-$(date +%Y%m%d-%H%M%S)/

# 5. Notify security team
# 6. Follow incident response plan
```

---

## Getting Help

### Before Asking for Help

Run diagnostics:
```bash
./scripts/check-system-health.sh > health-report.txt
docker-compose logs > full-logs.txt
docker stats --no-stream > resource-usage.txt
```

### What to Include in Bug Reports

1. Description of the issue
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Health check report
6. Relevant logs
7. Environment details (OS, Docker version, etc.)
8. Recent changes

### Support Channels

- **GitHub Issues**: https://github.com/barq/fleet-management/issues
- **Email**: support@barq.com
- **Slack**: #barq-support
- **Emergency**: +1-XXX-XXX-XXXX

---

## Appendix: Useful Commands

### Docker Commands
```bash
# View all containers
docker-compose ps

# View logs
docker-compose logs -f [service]

# Restart service
docker-compose restart [service]

# Rebuild service
docker-compose build --no-cache [service]

# Execute command in container
docker-compose exec [service] [command]

# Clean up
docker system prune -a --volumes
```

### Database Commands
```bash
# Connect to database
docker-compose exec postgres psql -U barq_user -d barq_db

# Backup database
docker-compose exec postgres pg_dump -U barq_user barq_db > backup.sql

# Restore database
docker-compose exec -T postgres psql -U barq_user -d barq_db < backup.sql

# Check database size
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT pg_size_pretty(pg_database_size('barq_db'));"
```

### Redis Commands
```bash
# Connect to Redis
docker-compose exec redis redis-cli

# Check memory usage
docker-compose exec redis redis-cli INFO memory

# Clear cache
docker-compose exec redis redis-cli FLUSHALL

# Monitor commands
docker-compose exec redis redis-cli MONITOR
```

---

**Document Version**: 1.0.0
**Last Updated**: November 5, 2025
**Maintained By**: DevOps Team
