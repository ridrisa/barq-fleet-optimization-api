# BARQ Fleet Management - Maintenance Guide

**Version**: 1.0.0
**Last Updated**: November 5, 2025

---

## Table of Contents
1. [Daily Maintenance Tasks](#daily-maintenance-tasks)
2. [Weekly Maintenance Tasks](#weekly-maintenance-tasks)
3. [Monthly Maintenance Tasks](#monthly-maintenance-tasks)
4. [Quarterly Maintenance Tasks](#quarterly-maintenance-tasks)
5. [Database Maintenance](#database-maintenance)
6. [Security Maintenance](#security-maintenance)
7. [Performance Optimization](#performance-optimization)
8. [Backup & Recovery](#backup--recovery)
9. [Dependency Updates](#dependency-updates)
10. [Monitoring & Health Checks](#monitoring--health-checks)

---

## Daily Maintenance Tasks

### Morning Checklist (30 minutes)

#### 1. System Health Check
```bash
#!/bin/bash
# Save as: daily-health-check.sh

echo "=== Daily Health Check - $(date) ===" | tee -a maintenance.log

# Check all services
echo "1. Checking service status..."
docker-compose ps | tee -a maintenance.log

# Health endpoints
echo "2. Checking health endpoints..."
curl -s http://localhost:3003/health | jq '.' | tee -a maintenance.log

# Agent health
echo "3. Checking agent health..."
curl -s http://localhost:3003/api/agents/health | jq '.summary' | tee -a maintenance.log

# Database connection
echo "4. Checking database..."
docker-compose exec -T postgres pg_isready -U barq_user | tee -a maintenance.log

# Redis connection
echo "5. Checking Redis..."
docker-compose exec -T redis redis-cli ping | tee -a maintenance.log

# Check disk space
echo "6. Checking disk space..."
df -h | grep -E '(Filesystem|/dev/disk)' | tee -a maintenance.log

# Check memory
echo "7. Checking memory..."
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}" | tee -a maintenance.log

echo "=== Health Check Complete ===" | tee -a maintenance.log
```

#### 2. Review Overnight Alerts
```bash
# Check Grafana dashboard
# URL: http://localhost:3000/d/alerts

# Or check logs for alerts
docker-compose logs --since 24h | grep -i "alert\|warning\|error" | tail -n 20
```

#### 3. Verify Backups
```bash
# Check latest backup
ls -lh backend/database/backups/ | head -n 5

# Verify backup file size (should be > 1MB)
du -h backend/database/backups/barq_db_$(date +%Y%m%d).sql

# Test backup integrity (sample check)
file backend/database/backups/barq_db_$(date +%Y%m%d).sql
```

#### 4. Review Error Logs
```bash
# Backend errors (last 24 hours)
docker-compose logs --since 24h backend | grep -i error | tail -n 50

# Frontend errors
docker-compose logs --since 24h frontend | grep -i error | tail -n 20

# Database errors
docker-compose logs --since 24h postgres | grep -i error | tail -n 20

# Generate error summary
docker-compose logs --since 24h | grep -i error | \
  awk '{print $NF}' | sort | uniq -c | sort -rn | head -n 10
```

#### 5. Monitor Key Metrics
```bash
# Check active users
curl -s http://localhost:3003/api/agents/performance/analytics | \
  jq '.data.kpis.activeUsers'

# Check order volume
docker-compose exec postgres psql -U barq_user -d barq_db -t -c \
  "SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE;"

# Check fleet utilization
curl -s http://localhost:3003/api/agents/fleet/status | \
  jq '.data.utilization'

# Check SLA compliance
curl -s http://localhost:3003/api/agents/sla/monitor | \
  jq '.data.compliance'
```

### Evening Checklist (15 minutes)

#### 1. Trigger Manual Backup
```bash
# Run backup script
./scripts/backup-db.sh

# Verify backup created
ls -lh backend/database/backups/ | head -n 2
```

#### 2. Review Day's Performance
```bash
# Generate daily report
cat << EOF > daily-report-$(date +%Y%m%d).txt
BARQ Fleet Management - Daily Report
Date: $(date)

Service Status:
$(docker-compose ps)

Total Orders Today:
$(docker-compose exec -T postgres psql -U barq_user -d barq_db -t -c \
  "SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE;")

Error Count Today:
$(docker-compose logs --since 24h | grep -i error | wc -l)

Disk Usage:
$(df -h | grep -E '/dev/disk')

Memory Usage:
$(docker stats --no-stream)
EOF

cat daily-report-$(date +%Y%m%d).txt
```

#### 3. Clean Up Logs
```bash
# Rotate logs if getting too large (keep last 7 days)
find logs/ -name "*.log" -mtime +7 -delete

# Compress old logs
find logs/ -name "*.log" -mtime +1 -exec gzip {} \;
```

#### 4. Check Scheduled Jobs
```bash
# Verify cron jobs are running
crontab -l

# Check job logs
tail -n 20 /var/log/cron.log
```

---

## Weekly Maintenance Tasks

### Every Monday (1 hour)

#### 1. Database Maintenance
```bash
# Run VACUUM ANALYZE
docker-compose exec postgres psql -U barq_user -d barq_db -c "VACUUM ANALYZE;"

# Check database size
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT pg_size_pretty(pg_database_size('barq_db'));"

# Check table sizes
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
   FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# Check for bloated indexes
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT schemaname, tablename, indexname, pg_size_pretty(pg_relation_size(indexrelid))
   FROM pg_stat_user_indexes ORDER BY pg_relation_size(indexrelid) DESC LIMIT 10;"
```

#### 2. Performance Review
```bash
# Analyze slow queries (last 7 days)
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT query, calls, mean_exec_time, max_exec_time
   FROM pg_stat_statements
   WHERE mean_exec_time > 100
   ORDER BY mean_exec_time DESC LIMIT 20;"

# Check cache hit ratio
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT sum(heap_blks_read) as heap_read,
          sum(heap_blks_hit) as heap_hit,
          sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
   FROM pg_statio_user_tables;"

# Redis cache stats
docker-compose exec redis redis-cli INFO stats | grep keyspace_hits
docker-compose exec redis redis-cli INFO stats | grep keyspace_misses
```

#### 3. Security Audit
```bash
# Check for failed login attempts
docker-compose logs --since 7d backend | grep -i "auth.*failed" | wc -l

# Review user activity
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT user_id, COUNT(*) as activity_count
   FROM audit_logs WHERE created_at >= NOW() - INTERVAL '7 days'
   GROUP BY user_id ORDER BY activity_count DESC LIMIT 10;"

# Check for suspicious IPs
docker-compose logs --since 7d backend | \
  grep -oE "\b([0-9]{1,3}\.){3}[0-9]{1,3}\b" | \
  sort | uniq -c | sort -rn | head -n 20
```

#### 4. Dependency Audit
```bash
# Backend dependencies
cd backend
npm audit
npm outdated

# Frontend dependencies
cd ../frontend
npm audit
npm outdated

# Generate security report
cd ..
npm audit --json > security-audit-$(date +%Y%m%d).json
```

#### 5. Backup Verification
```bash
# List all backups
ls -lh backend/database/backups/

# Test restore on backup from 7 days ago
# (Use test database)
docker-compose exec postgres psql -U barq_user -c "CREATE DATABASE barq_db_test;"
docker-compose exec -T postgres psql -U barq_user -d barq_db_test < \
  backend/database/backups/barq_db_$(date -d '7 days ago' +%Y%m%d).sql

# Verify test database
docker-compose exec postgres psql -U barq_user -d barq_db_test -c \
  "SELECT COUNT(*) FROM orders;"

# Drop test database
docker-compose exec postgres psql -U barq_user -c "DROP DATABASE barq_db_test;"
```

#### 6. Log Analysis
```bash
# Generate weekly log summary
cat << EOF > weekly-log-summary-$(date +%Y%m%d).txt
Weekly Log Summary: $(date -d '7 days ago' +%Y-%m-%d) to $(date +%Y-%m-%d)

Top Errors:
$(docker-compose logs --since 7d | grep -i error | awk '{print $NF}' | sort | uniq -c | sort -rn | head -n 10)

API Endpoint Usage:
$(docker-compose logs --since 7d backend | grep "GET\|POST\|PUT\|DELETE" | awk '{print $6}' | sort | uniq -c | sort -rn | head -n 20)

Response Time Statistics:
$(docker-compose logs --since 7d backend | grep "response time" | awk '{print $NF}' | \
  awk '{sum+=$1; sumsq+=$1*$1} END {print "Avg: " sum/NR "ms, StdDev: " sqrt(sumsq/NR - (sum/NR)^2) "ms"}')
EOF

cat weekly-log-summary-$(date +%Y%m%d).txt
```

---

## Monthly Maintenance Tasks

### First Monday of Each Month (3 hours)

#### 1. Full System Backup
```bash
# Backup database
./scripts/backup-db.sh monthly-$(date +%Y%m)

# Backup application files
tar -czf backup-app-$(date +%Y%m).tar.gz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='logs' \
  backend/ frontend/ docker-compose.yml

# Backup environment files (encrypted)
tar -czf backup-env-$(date +%Y%m).tar.gz backend/.env frontend/.env.local
gpg --symmetric --cipher-algo AES256 backup-env-$(date +%Y%m).tar.gz

# Upload to cloud storage
# gsutil cp backup-*.tar.gz gs://barq-backups/monthly/
```

#### 2. Database Deep Cleaning
```bash
# Full VACUUM
docker-compose exec postgres psql -U barq_user -d barq_db -c "VACUUM FULL ANALYZE;"

# Reindex all tables
docker-compose exec postgres psql -U barq_user -d barq_db -c "REINDEX DATABASE barq_db;"

# Remove old partitions (if using partitioning)
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "DROP TABLE IF EXISTS orders_archive_$(date -d '6 months ago' +%Y%m);"

# Clean up old audit logs (keep last 90 days)
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';"
```

#### 3. Security Updates
```bash
# Update base Docker images
docker-compose pull

# Update OS packages (if using custom Dockerfile)
docker-compose build --no-cache --pull

# Rotate secrets
# 1. Generate new JWT secret
NEW_JWT_SECRET=$(openssl rand -base64 32)
echo "New JWT_SECRET: $NEW_JWT_SECRET"

# 2. Update in secure vault (GCP Secret Manager)
# gcloud secrets versions add jwt-secret --data-file=<(echo $NEW_JWT_SECRET)

# 3. Rotate API keys
# - GROQ API key
# - Mapbox token
# - Database password (coordinate with team)

# 4. Update .env files
# (Do this during maintenance window)
```

#### 4. Performance Optimization
```bash
# Analyze and optimize queries
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT query, calls, total_exec_time, mean_exec_time
   FROM pg_stat_statements
   WHERE calls > 100
   ORDER BY total_exec_time DESC LIMIT 30;" > slow-queries-$(date +%Y%m).txt

# Create recommended indexes
# (Review slow-queries report first)

# Update statistics
docker-compose exec postgres psql -U barq_user -d barq_db -c "ANALYZE;"

# Clear old cache entries
docker-compose exec redis redis-cli --scan --pattern "*:cache:*" | \
  xargs docker-compose exec redis redis-cli del
```

#### 5. Capacity Planning
```bash
# Generate capacity report
cat << EOF > capacity-report-$(date +%Y%m).txt
BARQ Fleet Management - Capacity Report
Date: $(date)

Database Size:
$(docker-compose exec postgres psql -U barq_user -d barq_db -t -c \
  "SELECT pg_size_pretty(pg_database_size('barq_db'));")

Database Growth (last 30 days):
# Compare with previous month's report

Disk Usage:
$(df -h)

Average Daily Orders:
$(docker-compose exec postgres psql -U barq_user -d barq_db -t -c \
  "SELECT AVG(daily_count)::INTEGER FROM (
     SELECT DATE(created_at) as day, COUNT(*) as daily_count
     FROM orders
     WHERE created_at >= NOW() - INTERVAL '30 days'
     GROUP BY DATE(created_at)
   ) daily_stats;")

Peak Concurrent Users:
# Check from monitoring dashboard

Projected Growth:
# Based on current trends, when will we need to scale?

Recommendations:
- Increase disk space if usage > 70%
- Scale horizontally if CPU > 70% sustained
- Add read replicas if database queries > 1000/min
EOF

cat capacity-report-$(date +%Y%m).txt
```

#### 6. Dependency Updates
```bash
# Update non-breaking dependencies
cd backend
npm update

cd ../frontend
npm update

# Test after updates
npm run test
npm run build

# Commit updates
git add package*.json
git commit -m "chore: update dependencies - $(date +%Y-%m)"
```

#### 7. Documentation Review
```bash
# Check if documentation is up to date
# Review and update:
# - README.md
# - API_DOCUMENTATION.md
# - DEPLOYMENT_GUIDE.md
# - TROUBLESHOOTING.md
# - This MAINTENANCE_GUIDE.md

# Verify all links work
# Use tool like markdown-link-check

# Update version numbers
# Update "Last Updated" dates
```

---

## Quarterly Maintenance Tasks

### First Week of Each Quarter (Full Day)

#### 1. Complete Security Audit
```bash
# Run comprehensive security scan
# Using tools like:
# - OWASP ZAP
# - Snyk
# - npm audit
# - Docker bench security

# Penetration testing
# Engage security firm or use automated tools

# Review access logs
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT user_id, action, COUNT(*) as count
   FROM audit_logs
   WHERE created_at >= NOW() - INTERVAL '90 days'
   GROUP BY user_id, action
   ORDER BY count DESC;"

# Update security policies
# Review and update:
# - Password policies
# - Access control policies
# - Data retention policies
```

#### 2. Performance Benchmarking
```bash
# Run load tests
cd backend
npm install -g artillery
artillery quick --count 100 --num 50 http://localhost:3003/api/optimize

# Compare with baseline
# Document results in benchmark-YYYYQ[1-4].txt

# Stress test
artillery quick --count 500 --num 100 http://localhost:3003/health

# Database performance test
pgbench -U barq_user -d barq_db -c 10 -j 2 -t 1000
```

#### 3. Disaster Recovery Drill
```bash
# Simulate complete system failure and recovery

# 1. Create snapshot of current state
./scripts/backup-db.sh dr-drill-$(date +%Y%m%d)

# 2. Destroy environment (on test system)
docker-compose down -v

# 3. Time full recovery
time {
  docker-compose up -d
  ./scripts/restore-backup.sh backend/database/backups/dr-drill-$(date +%Y%m%d).sql
  # Verify all services healthy
}

# 4. Document recovery time (should be < 30 minutes)
# 5. Update runbook with lessons learned
```

#### 4. Infrastructure Review
```bash
# Review cloud costs
# gcloud billing accounts list
# gcloud billing projects describe PROJECT_ID

# Optimize resources
# - Rightsize VMs
# - Review storage classes
# - Archive old data
# - Review data transfer costs

# Update infrastructure as code
# Review and update Terraform/CloudFormation

# Capacity planning for next quarter
# Based on growth trends
```

#### 5. Training & Knowledge Transfer
```bash
# Update runbooks
# Document new procedures
# Record training videos
# Conduct team training session
# Update on-call procedures
```

---

## Database Maintenance

### Daily Database Tasks
```bash
# Quick health check
docker-compose exec postgres pg_isready -U barq_user

# Check connection count
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT count(*) FROM pg_stat_activity;"

# Check for long-running queries
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT pid, now() - pg_stat_activity.query_start AS duration, query
   FROM pg_stat_activity
   WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '5 minutes';"
```

### Weekly Database Tasks
```bash
# Vacuum analyze
docker-compose exec postgres psql -U barq_user -d barq_db -c "VACUUM ANALYZE;"

# Check bloat
docker-compose exec postgres psql -U barq_user -d barq_db -f scripts/check_bloat.sql

# Update statistics
docker-compose exec postgres psql -U barq_user -d barq_db -c "ANALYZE;"
```

### Monthly Database Tasks
```bash
# Full vacuum (requires maintenance window)
docker-compose exec postgres psql -U barq_user -d barq_db -c "VACUUM FULL;"

# Reindex
docker-compose exec postgres psql -U barq_user -d barq_db -c "REINDEX DATABASE barq_db;"

# Check for missing indexes
docker-compose exec postgres psql -U barq_user -d barq_db -f scripts/check_missing_indexes.sql
```

### Database Backup Strategy
```bash
# Daily automated backups (keep 7 days)
0 2 * * * /path/to/scripts/backup-db.sh

# Weekly backups (keep 4 weeks)
0 3 * * 0 /path/to/scripts/backup-db.sh weekly

# Monthly backups (keep 12 months)
0 4 1 * * /path/to/scripts/backup-db.sh monthly

# Verify backups daily
0 5 * * * /path/to/scripts/verify-backup.sh
```

---

## Security Maintenance

### Daily Security Tasks
```bash
# Check for failed login attempts
docker-compose logs --since 24h backend | grep -i "auth.*failed"

# Review audit logs
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT * FROM audit_logs WHERE created_at >= CURRENT_DATE ORDER BY created_at DESC LIMIT 50;"

# Check for security alerts
# Review monitoring dashboard
```

### Weekly Security Tasks
```bash
# Dependency security scan
cd backend && npm audit
cd frontend && npm audit

# Docker image scan
docker scan barq-backend:latest
docker scan barq-frontend:latest

# Review access logs for anomalies
docker-compose logs --since 7d | grep -E "(401|403|429)" | tail -n 100
```

### Monthly Security Tasks
```bash
# Update security patches
docker-compose pull
docker-compose build --no-cache

# Rotate secrets
# - JWT secret
# - API keys
# - Database passwords

# Review user permissions
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT * FROM users WHERE last_login < NOW() - INTERVAL '30 days';"

# Security training review
# Ensure team is up to date on security best practices
```

---

## Performance Optimization

### Weekly Performance Tasks
```bash
# Analyze slow queries
docker-compose exec postgres psql -U barq_user -d barq_db -c \
  "SELECT query, mean_exec_time, calls FROM pg_stat_statements
   WHERE mean_exec_time > 100 ORDER BY mean_exec_time DESC LIMIT 10;"

# Check cache hit ratios
docker-compose exec redis redis-cli INFO stats

# Monitor response times
docker-compose logs --since 7d backend | grep "response time" | \
  awk '{print $NF}' | sort -n | tail -n 100
```

### Monthly Performance Tasks
```bash
# Full performance audit
# Run load tests
artillery quick --count 100 --num 50 http://localhost:3003/api/optimize

# Database optimization
docker-compose exec postgres psql -U barq_user -d barq_db -c "VACUUM ANALYZE;"

# Review and optimize indexes
# Based on slow query analysis

# Clear old caches
docker-compose exec redis redis-cli FLUSHDB
```

---

## Backup & Recovery

### Automated Backup Script
```bash
#!/bin/bash
# Save as: scripts/backup-db.sh

BACKUP_DIR="backend/database/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/barq_db_$DATE.sql"

# Create backup directory if not exists
mkdir -p $BACKUP_DIR

# Perform backup
docker-compose exec -T postgres pg_dump -U barq_user barq_db > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# Log backup
echo "Backup completed: $BACKUP_FILE.gz" >> backup.log

# Optional: Upload to cloud storage
# gsutil cp $BACKUP_FILE.gz gs://barq-backups/daily/
```

### Recovery Procedure
```bash
# 1. Stop application
docker-compose stop backend frontend

# 2. Restore database
BACKUP_FILE="backend/database/backups/barq_db_20250105.sql.gz"
gunzip -c $BACKUP_FILE | docker-compose exec -T postgres psql -U barq_user -d barq_db

# 3. Verify restoration
docker-compose exec postgres psql -U barq_user -d barq_db -c "SELECT COUNT(*) FROM orders;"

# 4. Restart application
docker-compose start backend frontend

# 5. Verify application health
curl http://localhost:3003/health
```

---

## Dependency Updates

### Minor Updates (Weekly)
```bash
# Backend
cd backend
npm update
npm audit fix
npm test

# Frontend
cd ../frontend
npm update
npm audit fix
npm run build
```

### Major Updates (Monthly - Staging First)
```bash
# Check for major updates
cd backend
npm outdated

# Update one at a time
npm install express@latest
npm test

# If tests pass, commit
git commit -m "chore: update express to vX.Y.Z"

# Repeat for other dependencies
# Always test thoroughly before production
```

### Security Updates (Immediate)
```bash
# When security vulnerability detected
npm audit

# Fix automatically if possible
npm audit fix

# If manual intervention required
npm audit fix --force
# Review changes carefully
npm test

# Deploy to production immediately after verification
```

---

## Monitoring & Health Checks

### Monitoring Checklist
```bash
# Daily monitoring review
- [ ] All services healthy
- [ ] Error rate < 1%
- [ ] Response time < 200ms (p95)
- [ ] CPU usage < 70%
- [ ] Memory usage < 80%
- [ ] Disk usage < 70%
- [ ] Database connections < 80% of max
- [ ] No critical alerts firing
- [ ] Backups completed successfully
- [ ] SSL certificate valid > 30 days
```

### Alert Configuration
```yaml
# Example Prometheus alerts
groups:
  - name: barq_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"

      - alert: SlowResponseTime
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 1
        for: 5m
        annotations:
          summary: "Response time p95 > 1s"
```

---

## Maintenance Windows

### Scheduled Maintenance
- **Weekly**: Sunday 2:00 AM - 4:00 AM (low traffic)
- **Monthly**: First Sunday 2:00 AM - 6:00 AM
- **Quarterly**: First Sunday of quarter 12:00 AM - 6:00 AM

### Maintenance Notification
```bash
# 7 days before
# Send notification to all users about upcoming maintenance

# 24 hours before
# Send reminder notification

# During maintenance
# Update status page to "Under Maintenance"

# After maintenance
# Send completion notification
# Update status page to "Operational"
```

---

## Maintenance Logs

### Log Template
```markdown
# Maintenance Log - [Date]

**Performed by**: [Name]
**Start time**: [Time]
**End time**: [Time]
**Type**: Daily / Weekly / Monthly / Emergency

## Tasks Completed
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## Issues Found
- Issue 1: Description and resolution
- Issue 2: Description and resolution

## Metrics Before/After
- Disk usage: Before 65% / After 55%
- Database size: Before 2.5GB / After 2.2GB
- Response time: Before 150ms / After 130ms

## Actions Required
- Action 1: Description and deadline
- Action 2: Description and deadline

## Notes
Any additional observations or concerns
```

---

## Emergency Maintenance

### When to Perform Emergency Maintenance
- Critical security vulnerability
- Data corruption detected
- Performance degradation > 50%
- Service outage
- Security breach

### Emergency Procedure
```bash
# 1. Assess severity
# 2. Notify team immediately
# 3. Create incident ticket
# 4. Execute fix
# 5. Verify resolution
# 6. Post-mortem analysis
# 7. Update runbooks
```

---

**Document Version**: 1.0.0
**Last Updated**: November 5, 2025
**Next Review**: December 5, 2025
**Owner**: DevOps Team
