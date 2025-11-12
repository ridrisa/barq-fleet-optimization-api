# Production Metrics API Pagination Guide

## Overview

All production metrics endpoints now support pagination and query timeouts to prevent timeouts and improve performance with large datasets.

## Pagination Parameters

### Query Parameters

All endpoints support the following pagination parameters:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | integer | 100 | 1000 | Number of items per page |
| `offset` | integer | 0 | - | Number of items to skip |
| `page` | integer | 1 | - | Page number (alternative to offset) |

### Date Range Parameters

All endpoints also support date filtering:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | integer | 7 | Number of days to look back from now |
| `start_date` | ISO 8601 date | - | Start date for date range (overrides `days`) |
| `end_date` | ISO 8601 date | - | End date for date range (required with `start_date`) |

## Response Format

All paginated endpoints return responses in this format:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 500,
    "limit": 100,
    "offset": 0,
    "page": 1,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false,
    "nextOffset": 100,
    "previousOffset": null
  }
}
```

## Timeout Configuration

All queries have the following timeout limits:

- **Simple queries**: 5 seconds (counts, simple aggregates)
- **Metrics queries**: 8 seconds (complex aggregations)
- **Analytics queries**: 15 seconds (multi-table joins)

If a query exceeds its timeout, a `500` error will be returned with:

```json
{
  "success": false,
  "error": "Query execution timed out after 8000ms",
  "message": "Query execution timed out after 8000ms"
}
```

## Endpoints with Pagination

### 1. Courier Performance

**Endpoint**: `GET /api/v1/production-metrics/courier-performance`

**Example Request**:
```bash
curl "http://localhost:5001/api/v1/production-metrics/courier-performance?limit=50&offset=0&days=30"
```

**Response**:
```json
{
  "success": true,
  "period": {
    "start": "2024-11-01T00:00:00.000Z",
    "end": "2024-12-01T00:00:00.000Z"
  },
  "couriers": [
    {
      "driver_id": 123,
      "total_deliveries": 150,
      "completed": 145,
      "on_time": 140,
      "on_time_rate": 96.55,
      "avg_delivery_time_minutes": 35.5
    }
  ],
  "pagination": {
    "total": 200,
    "limit": 50,
    "offset": 0,
    "page": 1,
    "totalPages": 4,
    "hasNextPage": true,
    "hasPreviousPage": false,
    "nextOffset": 50,
    "previousOffset": null
  }
}
```

### 2. Order Distribution

**Endpoint**: `GET /api/v1/production-metrics/order-distribution`

**Example Request**:
```bash
curl "http://localhost:5001/api/v1/production-metrics/order-distribution?limit=20&page=1"
```

**Response**:
```json
{
  "success": true,
  "period": {
    "start": "2024-11-25T00:00:00.000Z",
    "end": "2024-12-02T00:00:00.000Z"
  },
  "distribution": [
    {
      "name": "delivered",
      "value": 1500
    },
    {
      "name": "in_transit",
      "value": 200
    }
  ],
  "pagination": {
    "total": 8,
    "limit": 20,
    "offset": 0,
    "page": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false,
    "nextOffset": null,
    "previousOffset": null
  }
}
```

### 3. SLA At-Risk Orders

**Endpoint**: `GET /api/v1/production-metrics/sla/at-risk`

**Example Request**:
```bash
curl "http://localhost:5001/api/v1/production-metrics/sla/at-risk?limit=100&offset=0"
```

**Response**:
```json
{
  "success": true,
  "timestamp": "2024-12-02T10:00:00.000Z",
  "summary": {
    "total_at_risk": 45,
    "critical": 5,
    "high": 15,
    "medium": 20,
    "breached": 5
  },
  "orders": [...],
  "pagination": {
    "total": 150,
    "limit": 100,
    "offset": 0,
    "page": 1,
    "totalPages": 2,
    "hasNextPage": true,
    "hasPreviousPage": false,
    "nextOffset": 100,
    "previousOffset": null
  }
}
```

### 4. SLA Compliance

**Endpoint**: `GET /api/v1/production-metrics/sla/compliance`

**Example Request**:
```bash
curl "http://localhost:5001/api/v1/production-metrics/sla/compliance?limit=200&page=2&days=30"
```

**Response**:
```json
{
  "success": true,
  "period": {
    "start": "2024-11-02T00:00:00.000Z",
    "end": "2024-12-02T00:00:00.000Z"
  },
  "overall": {
    "total_orders": 5000,
    "on_time": 4750,
    "late": 250,
    "compliance_rate": 95.0
  },
  "by_service_type": [...],
  "pagination": {
    "total": 5000,
    "limit": 200,
    "offset": 200,
    "page": 2,
    "totalPages": 25,
    "hasNextPage": true,
    "hasPreviousPage": true,
    "nextOffset": 400,
    "previousOffset": 0
  }
}
```

## Non-Paginated Endpoints

The following endpoints return aggregated metrics and do not support pagination:

- `/api/v1/production-metrics/on-time-delivery` - Single rate metric
- `/api/v1/production-metrics/completion-rate` - Single rate metric
- `/api/v1/production-metrics/delivery-time` - Aggregate time metrics
- `/api/v1/production-metrics/cancellation-rate` - Single rate metric
- `/api/v1/production-metrics/return-rate` - Single rate metric
- `/api/v1/production-metrics/fleet-utilization` - Aggregate fleet metrics
- `/api/v1/production-metrics/comprehensive` - Dashboard with all metrics

These endpoints still have query timeouts but return single aggregate values.

## Best Practices

### 1. Use Reasonable Limits
```bash
# Good - reasonable page size
curl "http://localhost:5001/api/v1/production-metrics/courier-performance?limit=100"

# Avoid - unnecessarily large page size
curl "http://localhost:5001/api/v1/production-metrics/courier-performance?limit=1000"
```

### 2. Use Page Parameter for User Navigation
```bash
# Better for UI pagination
curl "http://localhost:5001/api/v1/production-metrics/courier-performance?limit=50&page=3"
```

### 3. Use Offset for Data Processing
```bash
# Better for batch processing
for offset in 0 100 200 300; do
  curl "http://localhost:5001/api/v1/production-metrics/courier-performance?limit=100&offset=$offset"
done
```

### 4. Narrow Date Ranges for Large Datasets
```bash
# Good - specific date range
curl "http://localhost:5001/api/v1/production-metrics/sla/compliance?start_date=2024-11-01&end_date=2024-11-07&limit=100"

# Avoid - very large date range without pagination
curl "http://localhost:5001/api/v1/production-metrics/sla/compliance?days=365"
```

### 5. Handle Timeout Errors Gracefully
```javascript
async function fetchMetrics(limit = 100, offset = 0) {
  try {
    const response = await fetch(
      `/api/v1/production-metrics/courier-performance?limit=${limit}&offset=${offset}`
    );

    if (!response.ok) {
      if (response.status === 500) {
        // Retry with smaller limit or shorter date range
        return fetchMetrics(Math.floor(limit / 2), offset);
      }
      throw new Error('Failed to fetch metrics');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching metrics:', error);
    throw error;
  }
}
```

## Performance Tips

1. **Start with default parameters** - The defaults (limit=100, offset=0) are optimized for performance
2. **Use indexes** - Ensure your database has proper indexes on `created_at`, `driver_id`, and `status` columns
3. **Monitor query times** - Slow queries are logged with warnings when they exceed 3 seconds
4. **Batch requests** - When fetching large datasets, use smaller batches with pagination
5. **Cache results** - Consider caching frequently accessed metrics on the client side

## Error Handling

### Timeout Errors
```json
{
  "success": false,
  "error": "Query execution timed out after 8000ms",
  "message": "Query execution timed out after 8000ms"
}
```

**Solution**: Reduce date range or limit, or optimize database indexes

### Invalid Parameters
```json
{
  "success": false,
  "error": "Invalid pagination parameters",
  "message": "Limit must be between 1 and 1000"
}
```

**Solution**: Adjust parameters to be within valid ranges

## Migration from Non-Paginated Endpoints

If you were using these endpoints before pagination was added:

### Before:
```javascript
const response = await fetch('/api/v1/production-metrics/courier-performance');
const { couriers } = await response.json();
```

### After (with backwards compatibility):
```javascript
// Still works - uses default pagination (limit=100, offset=0)
const response = await fetch('/api/v1/production-metrics/courier-performance');
const { couriers, pagination } = await response.json();

// Or explicitly paginate
const response = await fetch('/api/v1/production-metrics/courier-performance?limit=50&page=1');
const { couriers, pagination } = await response.json();
```

## Support

For issues or questions about pagination:
- Check query timeout logs for slow queries
- Review database indexes
- Contact the backend team for optimization support
