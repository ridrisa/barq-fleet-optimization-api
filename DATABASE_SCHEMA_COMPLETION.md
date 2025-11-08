# Database Schema Completion Guide

**Quick Fix Guide** - Complete the database schema to unlock all advanced features

---

## 🎯 Priority 1: Fix Service Type Enum (2 minutes)

**Problem**: Analytics endpoints fail with "invalid input value for enum service_type: 'EXPRESS'"

**Solution**:
```sql
-- Connect to database
-- PGPASSWORD="BARQFleet2025SecurePass!" psql -h 34.65.15.192 -p 5432 -U postgres -d barq_logistics

-- Add EXPRESS to the enum
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'EXPRESS';

-- Verify
SELECT enum_range(NULL::service_type);
```

**Impact**: Unlocks `/api/v1/analytics/sla/realtime` endpoint

**Time**: 2 minutes

---

## 🎯 Priority 2: Create Automation Tracking Tables (15 minutes)

**Problem**: Automation dashboard fails with "relation 'order_batches' does not exist"

**Solution**: Create the missing tables

### 1. Assignment Logs (Auto-Dispatch Tracking)
```sql
CREATE TABLE IF NOT EXISTS assignment_logs (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id),
    driver_id BIGINT REFERENCES drivers(id),
    assigned_at TIMESTAMP DEFAULT NOW(),
    assignment_type VARCHAR(50), -- 'AUTO_ASSIGNED', 'FORCE_ASSIGNED', 'MANUAL'
    total_score DECIMAL(5,2),
    distance_score DECIMAL(5,2),
    time_score DECIMAL(5,2),
    load_score DECIMAL(5,2),
    priority_score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_assignment_logs_assigned_at ON assignment_logs(assigned_at);
CREATE INDEX idx_assignment_logs_order_id ON assignment_logs(order_id);
```

### 2. Route Optimizations (Route Optimizer Tracking)
```sql
CREATE TABLE IF NOT EXISTS route_optimizations (
    id BIGSERIAL PRIMARY KEY,
    driver_id BIGINT REFERENCES drivers(id),
    optimized_at TIMESTAMP DEFAULT NOW(),
    distance_saved_km DECIMAL(10,2),
    time_saved_minutes INTEGER,
    stops_reordered INTEGER,
    old_route_distance DECIMAL(10,2),
    new_route_distance DECIMAL(10,2),
    improvement_percentage DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_route_optimizations_optimized_at ON route_optimizations(optimized_at);
CREATE INDEX idx_route_optimizations_driver_id ON route_optimizations(driver_id);
```

### 3. Order Batches (Smart Batching Tracking)
```sql
CREATE TABLE IF NOT EXISTS order_batches (
    id BIGSERIAL PRIMARY KEY,
    batch_id VARCHAR(100) UNIQUE,
    order_count INTEGER,
    driver_id BIGINT REFERENCES drivers(id),
    status VARCHAR(50), -- 'created', 'assigned', 'completed'
    created_at TIMESTAMP DEFAULT NOW(),
    assigned_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_order_batches_created_at ON order_batches(created_at);
CREATE INDEX idx_order_batches_status ON order_batches(status);
```

### 4. Escalation Logs (Escalation Tracking)
```sql
CREATE TABLE IF NOT EXISTS escalation_logs (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id),
    escalation_type VARCHAR(50), -- 'SLA_RISK', 'DELAYED', 'FAILED_DELIVERY'
    severity VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    status VARCHAR(50), -- 'open', 'investigating', 'resolved'
    escalated_to VARCHAR(100),
    resolution TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

CREATE INDEX idx_escalation_logs_created_at ON escalation_logs(created_at);
CREATE INDEX idx_escalation_logs_status ON escalation_logs(status);
CREATE INDEX idx_escalation_logs_severity ON escalation_logs(severity);
```

### 5. Dispatch Alerts (Alert Management)
```sql
CREATE TABLE IF NOT EXISTS dispatch_alerts (
    id BIGSERIAL PRIMARY KEY,
    alert_type VARCHAR(50), -- 'NO_DRIVERS_AVAILABLE', 'HIGH_DEMAND', 'SLA_BREACH_IMMINENT'
    severity VARCHAR(20), -- 'info', 'warning', 'critical'
    message TEXT,
    metadata JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

CREATE INDEX idx_dispatch_alerts_resolved ON dispatch_alerts(resolved);
CREATE INDEX idx_dispatch_alerts_created_at ON dispatch_alerts(created_at);
```

### 6. Statistics Tables (Aggregated Data)
```sql
-- Auto-dispatch statistics (daily aggregates)
CREATE TABLE IF NOT EXISTS auto_dispatch_stats (
    id BIGSERIAL PRIMARY KEY,
    date DATE UNIQUE,
    total_assignments INTEGER DEFAULT 0,
    auto_assigned INTEGER DEFAULT 0,
    force_assigned INTEGER DEFAULT 0,
    avg_assignment_score DECIMAL(5,2),
    avg_response_time_seconds DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Route optimization statistics (daily aggregates)
CREATE TABLE IF NOT EXISTS route_optimization_stats (
    id BIGSERIAL PRIMARY KEY,
    date DATE UNIQUE,
    total_optimizations INTEGER DEFAULT 0,
    total_distance_saved_km DECIMAL(10,2),
    total_time_saved_minutes INTEGER,
    avg_improvement_percentage DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_auto_dispatch_stats_date ON auto_dispatch_stats(date);
CREATE INDEX idx_route_optimization_stats_date ON route_optimization_stats(date);
```

### 7. Traffic Incidents (Optional - for route optimization)
```sql
CREATE TABLE IF NOT EXISTS traffic_incidents (
    id BIGSERIAL PRIMARY KEY,
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    severity VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    description TEXT,
    affected_radius_meters INTEGER DEFAULT 500,
    active BOOLEAN DEFAULT TRUE,
    reported_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

CREATE INDEX idx_traffic_incidents_active ON traffic_incidents(active);
CREATE INDEX idx_traffic_incidents_location ON traffic_incidents(latitude, longitude);
```

**Impact**: Unlocks `/api/v1/automation/dashboard` and all automation statistics endpoints

**Time**: 15 minutes to run all scripts

---

## 📋 Complete SQL Script

**File**: `database/complete-schema.sql`

```sql
-- ==================================================
-- COMPLETE DATABASE SCHEMA FOR AUTOMATION FEATURES
-- ==================================================

-- 1. Fix service_type enum
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'EXPRESS';

-- 2. Assignment logs table
CREATE TABLE IF NOT EXISTS assignment_logs (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id),
    driver_id BIGINT REFERENCES drivers(id),
    assigned_at TIMESTAMP DEFAULT NOW(),
    assignment_type VARCHAR(50),
    total_score DECIMAL(5,2),
    distance_score DECIMAL(5,2),
    time_score DECIMAL(5,2),
    load_score DECIMAL(5,2),
    priority_score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_logs_assigned_at ON assignment_logs(assigned_at);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_order_id ON assignment_logs(order_id);

-- 3. Route optimizations table
CREATE TABLE IF NOT EXISTS route_optimizations (
    id BIGSERIAL PRIMARY KEY,
    driver_id BIGINT REFERENCES drivers(id),
    optimized_at TIMESTAMP DEFAULT NOW(),
    distance_saved_km DECIMAL(10,2),
    time_saved_minutes INTEGER,
    stops_reordered INTEGER,
    old_route_distance DECIMAL(10,2),
    new_route_distance DECIMAL(10,2),
    improvement_percentage DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_optimizations_optimized_at ON route_optimizations(optimized_at);
CREATE INDEX IF NOT EXISTS idx_route_optimizations_driver_id ON route_optimizations(driver_id);

-- 4. Order batches table
CREATE TABLE IF NOT EXISTS order_batches (
    id BIGSERIAL PRIMARY KEY,
    batch_id VARCHAR(100) UNIQUE,
    order_count INTEGER,
    driver_id BIGINT REFERENCES drivers(id),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    assigned_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_batches_created_at ON order_batches(created_at);
CREATE INDEX IF NOT EXISTS idx_order_batches_status ON order_batches(status);

-- 5. Escalation logs table
CREATE TABLE IF NOT EXISTS escalation_logs (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id),
    escalation_type VARCHAR(50),
    severity VARCHAR(20),
    status VARCHAR(50),
    escalated_to VARCHAR(100),
    resolution TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_escalation_logs_created_at ON escalation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_status ON escalation_logs(status);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_severity ON escalation_logs(severity);

-- 6. Dispatch alerts table
CREATE TABLE IF NOT EXISTS dispatch_alerts (
    id BIGSERIAL PRIMARY KEY,
    alert_type VARCHAR(50),
    severity VARCHAR(20),
    message TEXT,
    metadata JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_resolved ON dispatch_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_created_at ON dispatch_alerts(created_at);

-- 7. Statistics tables
CREATE TABLE IF NOT EXISTS auto_dispatch_stats (
    id BIGSERIAL PRIMARY KEY,
    date DATE UNIQUE,
    total_assignments INTEGER DEFAULT 0,
    auto_assigned INTEGER DEFAULT 0,
    force_assigned INTEGER DEFAULT 0,
    avg_assignment_score DECIMAL(5,2),
    avg_response_time_seconds DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS route_optimization_stats (
    id BIGSERIAL PRIMARY KEY,
    date DATE UNIQUE,
    total_optimizations INTEGER DEFAULT 0,
    total_distance_saved_km DECIMAL(10,2),
    total_time_saved_minutes INTEGER,
    avg_improvement_percentage DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_dispatch_stats_date ON auto_dispatch_stats(date);
CREATE INDEX IF NOT EXISTS idx_route_optimization_stats_date ON route_optimization_stats(date);

-- 8. Traffic incidents table (optional)
CREATE TABLE IF NOT EXISTS traffic_incidents (
    id BIGSERIAL PRIMARY KEY,
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    severity VARCHAR(20),
    description TEXT,
    affected_radius_meters INTEGER DEFAULT 500,
    active BOOLEAN DEFAULT TRUE,
    reported_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_traffic_incidents_active ON traffic_incidents(active);
CREATE INDEX IF NOT EXISTS idx_traffic_incidents_location ON traffic_incidents(latitude, longitude);

-- Verify all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

---

## 🚀 How to Apply

### Option 1: Via Cloud SQL Proxy (Recommended for local execution)
```bash
# Download the script
cd /Users/ramiz_new/Desktop/AI-Route-Optimization-API

# Create the SQL file (copy the complete script above)

# Run via psql
PGPASSWORD="BARQFleet2025SecurePass!" psql \
  -h 34.65.15.192 \
  -p 5432 \
  -U postgres \
  -d barq_logistics \
  -f database/complete-schema.sql
```

### Option 2: Via Cloud SQL Admin Console
1. Go to Cloud SQL Console
2. Select `ai-route-optimization-db`
3. Click "Cloud SQL Studio" or "Connect via psql"
4. Paste the SQL script
5. Execute

### Option 3: Via GCloud SQL Import (if you create the file)
```bash
# Upload to Cloud Storage
gsutil cp database/complete-schema.sql gs://barq-temp-init-1762528464/

# Import via gcloud
gcloud sql import sql ai-route-optimization-db \
  gs://barq-temp-init-1762528464/complete-schema.sql \
  --database=barq_logistics \
  --project=looker-barqdata-2030
```

---

## ✅ Verification

After running the script, verify with:

```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verify service_type enum
SELECT enum_range(NULL::service_type);

-- Should show: {BARQ,BULLET,EXPRESS}
```

Then test the endpoints:
```bash
# Analytics SLA (should work now)
curl https://route-opt-backend-426674819922.us-central1.run.app/api/v1/analytics/sla/realtime

# Automation dashboard (should work now)
curl https://route-opt-backend-426674819922.us-central1.run.app/api/v1/automation/dashboard
```

---

## 📊 Expected Results

**Before Schema Completion**:
- ❌ Analytics SLA: "invalid input value for enum"
- ❌ Automation Dashboard: "relation does not exist"

**After Schema Completion**:
- ✅ Analytics SLA: Returns empty arrays (no SLA violations - good!)
- ✅ Automation Dashboard: Returns 0 counts (no automation activity yet - normal!)

**Sample Success Response**:
```json
{
  "engines": {
    "autoDispatch": false,
    "routeOptimizer": false,
    "smartBatching": false,
    "escalation": false
  },
  "summary": {
    "totalAssignments": 0,
    "totalOptimizations": 0,
    "totalBatches": 0,
    "totalEscalations": 0,
    "activeAlerts": 0
  },
  "today": { ... }
}
```

---

## ⏱️ Total Time: ~20 minutes

1. Priority 1 (Enum fix): 2 minutes
2. Priority 2 (Tables): 15 minutes
3. Verification: 3 minutes

**After completion**: ALL endpoints will be functional! 🎉
