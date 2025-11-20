# Schema Adapter for BarqFleet Production Database

## Overview

The Schema Adapter provides a **mapping layer** between local/demo database schemas and the **BarqFleet production database schema**. This allows analytics scripts to work seamlessly with both environments without code changes.

## Production Schema Discovered

### Database Information
- **Database Name**: `barqfleet_db`
- **Host**: `barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com`
- **Total Records**: 2.8M+ orders, 850+ couriers, 120+ hubs

### Production Tables

#### 1. **orders** (Primary Delivery Orders)
```sql
Key Columns:
- id (UUID)
- tracking_no (VARCHAR)
- merchant_id (INT)
- hub_id (INT)
- shipment_id (INT)
- order_status (VARCHAR) - States: 'delivered', 'ready_for_delivery', 'in_transit', 'cancelled', 'failed'
- payment_type (VARCHAR)
- delivery_fee (DECIMAL)
- grand_total (DECIMAL)
- customer_details (JSONB) - {name, phone, address, ...}
- origin (JSONB) - {lat, lng, address}
- destination (JSONB) - {lat, lng, address}
- products (JSONB)
- is_assigned (BOOLEAN)
- is_completed (BOOLEAN)
- delivery_start (TIMESTAMP)
- delivery_finish (TIMESTAMP)
- cod_fee (DECIMAL)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 2. **shipments** (Courier Assignments/Routes)
```sql
Key Columns:
- id (INT)
- courier_id (INT)
- is_assigned (BOOLEAN)
- is_completed (BOOLEAN)
- is_cancelled (BOOLEAN)
- latitude (DECIMAL)
- longitude (DECIMAL)
- reward (DECIMAL)
- driving_distance (DECIMAL) - Total distance in km
- promise_time (BIGINT) - Unix timestamp for SLA
- pickup_time (TIMESTAMP)
- complete_time (TIMESTAMP)
- delivery_finish (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 3. **couriers** (Delivery Personnel)
```sql
Key Columns:
- id (INT)
- mobile_number (VARCHAR)
- first_name (VARCHAR)
- last_name (VARCHAR)
- is_online (BOOLEAN)
- is_busy (BOOLEAN)
- is_banned (BOOLEAN)
- is_active (BOOLEAN)
- city_id (INT)
- vehicle_type (VARCHAR) - 'دراجة نارية', 'سيارة صغيرة', 'فان'
- latitude (DECIMAL)
- longitude (DECIMAL)
- trust_level (INT)
- courier_type (VARCHAR)
- hub_id (INT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 4. **hubs** (Pickup/Distribution Centers)
```sql
Key Columns:
- id (INT)
- code (VARCHAR) - Hub identifier
- manager (VARCHAR)
- mobile (VARCHAR)
- latitude (DECIMAL)
- longitude (DECIMAL)
- city_id (INT)
- is_active (BOOLEAN)
- is_open (BOOLEAN)
- bundle_limit (INT)
- dispatch_radius (DECIMAL)
- max_distance (DECIMAL)
- hub_type (VARCHAR)
- street_name (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### 5. **order_logs** (Status Change History)
```sql
Key Columns:
- id (INT)
- order_id (INT)
- new_status (VARCHAR)
- old_status (VARCHAR)
- reason (TEXT)
- created_at (TIMESTAMP)
```

#### 6. **merchants** (Business Customers)
```sql
Key Columns:
- id (INT)
- name (VARCHAR)
- mobile (VARCHAR)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)
```

## Schema Mapping Configuration

### Table Mappings
| Local/Demo Name | Production Name | Notes |
|----------------|-----------------|-------|
| `drivers` | `couriers` | Courier/driver terminology |
| `vehicles` | `couriers` | Vehicle type stored in couriers table |
| `deliveries` | `orders` | Main orders table |
| `daily_orders` | `orders` | No separate daily aggregate table |
| `shipment_logs` | `order_logs` | Status change history |

### Column Mappings

#### couriers Table
| Local Column | Production Column/Expression |
|-------------|------------------------------|
| `driver_id` | `courier_id` |
| `driver_name` | `CONCAT(first_name, ' ', last_name)` |
| `status` | `CASE WHEN is_banned = true THEN 'inactive' ELSE 'active' END` |
| `is_active` | `NOT is_banned` |
| `phone` | `mobile_number` |
| `mobile` | `mobile_number` |

#### orders Table
| Local Column | Production Column/Expression |
|-------------|------------------------------|
| `delivery_id` | `id` |
| `status` | `order_status` |
| `pickup_location` | `origin` |
| `dropoff_location` | `destination` |
| `pickup_lat` | `(origin->'lat')::float` |
| `pickup_lng` | `(origin->'lng')::float` |
| `dropoff_lat` | `(destination->'lat')::float` |
| `dropoff_lng` | `(destination->'lng')::float` |
| `customer_name` | `customer_details->>'name'` |
| `customer_phone` | `customer_details->>'phone'` |
| `estimated_delivery_time` | `promise_time` |
| `actual_delivery_time` | `delivery_finish` |
| `driver_id` | `courier_id` |

#### shipments Table
| Local Column | Production Column/Expression |
|-------------|------------------------------|
| `driver_id` | `courier_id` |
| `vehicle_id` | `courier_id` (vehicle type from courier) |
| `total_distance` | `driving_distance` |
| `status` | `CASE WHEN is_completed THEN 'completed' ...` |
| `pickup_time` | `created_at` |
| `delivery_time` | `complete_time` |
| `estimated_time` | `promise_time` |

## Usage

### 1. Environment Variable Control

```bash
# Enable production schema mapping (default)
export USE_PRODUCTION_SCHEMA=true

# Disable for local/demo database
export USE_PRODUCTION_SCHEMA=false
```

### 2. Python Integration

#### Basic Usage
```python
from schema_adapter import SchemaAdapter

# Initialize adapter (reads from environment)
adapter = SchemaAdapter()

# Check if enabled
if adapter.enabled:
    print("Using production schema")

# Map table names
prod_table = adapter.get_table_name('drivers')  # Returns 'couriers'

# Map column names
prod_column = adapter.get_column_name('couriers', 'driver_id')  # Returns 'courier_id'

# Transform entire query
original_query = "SELECT * FROM drivers WHERE status = 'active'"
production_query = adapter.transform_query(original_query)
```

#### Convenience Functions
```python
from schema_adapter import get_table_name, get_column_name, transform_query

# Direct usage without creating adapter instance
table = get_table_name('drivers')  # 'couriers'
column = get_column_name('orders', 'status')  # 'order_status'
query = transform_query("SELECT * FROM drivers")  # Transforms automatically
```

#### Integration with Database Connection
```python
from database_connection import get_database_connection
from schema_adapter import SchemaAdapter

# Initialize
db = get_database_connection(enable_fallback=True)
adapter = SchemaAdapter()

# Connect
db.connect()

# Build query with schema mapping
if adapter.enabled:
    query = "SELECT * FROM couriers WHERE NOT is_banned"
else:
    query = "SELECT * FROM drivers WHERE status = 'active'"

# Execute
results = db.execute_query(query)
```

### 3. Analytics Script Integration

The 4 analytics scripts are **already compatible** with production schema:

#### ✅ route_analyzer.py
- Already queries `orders`, `shipments`, `couriers`, `hubs` tables correctly
- Uses production column names (`hub_id`, `order_status`, `courier_id`)
- No schema adapter needed

#### ✅ demand_forecaster.py
- Already uses `orders.created_at` for demand patterns
- Production schema compatible out of the box

#### ✅ fleet_performance.py
- Already uses `courier_id`, `is_completed`, `driving_distance`
- Production schema compatible

#### ✅ sla_analytics.py
- Already uses `promise_time`, `delivery_finish`, `shipment_status`
- Production schema compatible

## Current Status

### Analytics Scripts Status
| Script | Production Compatible | Schema Adapter Needed | Status |
|--------|----------------------|----------------------|--------|
| `route_analyzer.py` | ✅ Yes | ❌ No | Working |
| `demand_forecaster.py` | ✅ Yes | ❌ No | Working |
| `fleet_performance.py` | ✅ Yes | ❌ No | Working |
| `sla_analytics.py` | ✅ Yes | ❌ No | Working |

### Why Schema Adapter Still Matters

1. **Future Development**: New scripts can use local naming conventions
2. **API Consistency**: Map production results to expected API format
3. **Documentation**: Clear mapping between schemas
4. **Migration Support**: Easier schema evolution
5. **Testing**: Local development with different schema

## Testing

### Test the Schema Adapter
```bash
cd /Users/ramiz_new/Desktop/AI-Route-Optimization-API/gpt-fleet-optimizer
python3 schema_adapter.py
```

Expected output:
```
Schema Adapter Test Suite
1. Schema Configuration: {...}
2. Table Name Mappings: drivers -> couriers
3. Column Name Mappings: couriers.driver_id -> courier_id
4. Query Transformation Examples: [transformations shown]
```

### Test Analytics Scripts
```bash
# Test with production database (default)
export USE_PRODUCTION_SCHEMA=true
python3 route_analyzer.py --analysis_type efficiency --date_range 30

# Test with demo data fallback
python3 route_analyzer.py --analysis_type efficiency --date_range 30
# (Will fallback to demo if production unavailable)
```

## Database Connection String

### Production (Read Replica)
```bash
export DB_HOST=barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com
export DB_PORT=5432
export DB_NAME=barqfleet_db
export DB_USER=ventgres
export DB_PASSWORD=Jk56tt4HkzePFfa3ht
```

### Query Performance Notes
- **Read replica used** to avoid impacting production writes
- **Connection pooling** configured (max 20 connections)
- **Query timeout**: 30 seconds default
- **Recommended limits**: Use `LIMIT` clauses for large datasets

## Advanced Features

### 1. Result Column Mapping
```python
# Map production columns back to local names for API consistency
results = db.execute_query("SELECT courier_id, first_name FROM couriers LIMIT 10")
mapped = adapter.map_result_columns(results, 'couriers', reverse=True)
# Results now have 'driver_id' instead of 'courier_id'
```

### 2. Schema Information
```python
# Get adapter configuration
info = adapter.get_schema_info()
print(f"Enabled: {info['enabled']}")
print(f"Source: {info['source']}")
print(f"Tables mapped: {info['tables_mapped']}")
```

### 3. Dynamic Adapter Creation
```python
# Force enable/disable regardless of environment
prod_adapter = SchemaAdapter(enable_mapping=True)
local_adapter = SchemaAdapter(enable_mapping=False)
```

## Troubleshooting

### Issue: "relation orders does not exist"
**Solution**: Ensure `USE_PRODUCTION_SCHEMA=true` and connection to correct database

### Issue: Schema adapter not transforming queries
**Solution**: Check environment variable:
```bash
echo $USE_PRODUCTION_SCHEMA  # Should be 'true'
```

### Issue: Column not found errors
**Solution**: Check if column name exists in COLUMN_MAPPINGS in `schema_adapter.py`

### Issue: Performance degradation
**Solution**:
- Use query LIMIT clauses
- Check indexes on production tables
- Monitor connection pool usage

## Future Enhancements

1. **SQL Parser Integration**: Use proper SQL parsing library (sqlparse) for more robust transformations
2. **Bidirectional Sync**: Support both local→production and production→local mappings
3. **Schema Versioning**: Handle multiple production schema versions
4. **Automated Discovery**: Auto-detect schema differences
5. **Query Optimization**: Automatic query rewrites for production performance

## References

- Production service: `/backend/src/services/barqfleet-production.service.js`
- Production routes: `/backend/src/routes/v1/barq-production.routes.js`
- Database connection: `/gpt-fleet-optimizer/database_connection.py`
- Analytics scripts: `/gpt-fleet-optimizer/*.py`

---

**Last Updated**: January 2025
**Production Database**: BarqFleet 2.8M+ orders
**Status**: ✅ Production Ready
