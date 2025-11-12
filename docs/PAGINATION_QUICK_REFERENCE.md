# Pagination Quick Reference Card

## TL;DR
All production metrics endpoints now support pagination with default `limit=100` and configurable timeouts (5-10s).

## Quick Examples

### Default Usage (Backwards Compatible)
```bash
curl http://localhost:5001/api/v1/production-metrics/courier-performance
# Returns first 100 results with pagination metadata
```

### Page-Based Navigation
```bash
# Page 1
curl "http://localhost:5001/api/v1/production-metrics/courier-performance?page=1&limit=50"

# Page 2
curl "http://localhost:5001/api/v1/production-metrics/courier-performance?page=2&limit=50"
```

### Offset-Based Navigation
```bash
# First 100 records
curl "http://localhost:5001/api/v1/production-metrics/courier-performance?limit=100&offset=0"

# Next 100 records
curl "http://localhost:5001/api/v1/production-metrics/courier-performance?limit=100&offset=100"
```

## Query Parameters

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | int | 100 | 1000 | Items per page |
| `offset` | int | 0 | - | Skip N items |
| `page` | int | 1 | - | Page number |
| `days` | int | 7 | - | Days to look back |
| `start_date` | ISO8601 | - | - | Range start |
| `end_date` | ISO8601 | - | - | Range end |

## Response Format

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

## Paginated Endpoints

✅ `/courier-performance` - Courier rankings
✅ `/order-distribution` - Status distribution
✅ `/sla/at-risk` - At-risk orders
✅ `/sla/compliance` - Compliance metrics

## Timeout Protected Endpoints

⏱️ All 11 endpoints have timeout protection (5-10 seconds):
- `/on-time-delivery`
- `/completion-rate`
- `/delivery-time`
- `/cancellation-rate`
- `/return-rate`
- `/fleet-utilization`
- `/comprehensive`
- And all paginated endpoints above

## Error Handling

### Timeout Error
```json
{
  "success": false,
  "error": "Query execution timed out after 8000ms"
}
```
**Fix**: Reduce date range or limit parameter

### Invalid Parameters
Parameters are auto-corrected:
- `limit < 1` → becomes `1`
- `limit > 1000` → becomes `1000`
- `offset < 0` → becomes `0`

## Frontend Integration

### React Example
```javascript
const [page, setPage] = useState(1);
const [data, setData] = useState([]);
const [pagination, setPagination] = useState(null);

async function fetchData() {
  const res = await fetch(
    `/api/v1/production-metrics/courier-performance?page=${page}&limit=50`
  );
  const json = await res.json();

  setData(json.couriers);
  setPagination(json.pagination);
}

// Next page
function nextPage() {
  if (pagination.hasNextPage) {
    setPage(page + 1);
  }
}
```

### Angular Example
```typescript
export class MetricsComponent {
  page = 1;
  limit = 50;
  data: any[] = [];
  pagination: any;

  async loadData() {
    const url = `/api/v1/production-metrics/courier-performance?page=${this.page}&limit=${this.limit}`;
    const response = await this.http.get(url).toPromise();

    this.data = response.couriers;
    this.pagination = response.pagination;
  }

  nextPage() {
    if (this.pagination.hasNextPage) {
      this.page++;
      this.loadData();
    }
  }
}
```

### Vue Example
```javascript
export default {
  data() {
    return {
      page: 1,
      limit: 50,
      couriers: [],
      pagination: null
    }
  },
  methods: {
    async fetchData() {
      const response = await fetch(
        `/api/v1/production-metrics/courier-performance?page=${this.page}&limit=${this.limit}`
      );
      const json = await response.json();

      this.couriers = json.couriers;
      this.pagination = json.pagination;
    },
    nextPage() {
      if (this.pagination?.hasNextPage) {
        this.page++;
        this.fetchData();
      }
    }
  }
}
```

## Best Practices

### ✅ DO
- Use default limit (100) for most cases
- Handle timeout errors gracefully
- Show loading states during fetch
- Cache results when appropriate
- Use page parameter for UI pagination

### ❌ DON'T
- Request limit > 1000 (automatically capped)
- Fetch all data at once (use pagination)
- Ignore pagination metadata
- Query large date ranges without pagination
- Retry failed requests without reducing parameters

## Performance Tips

1. **Start Small**: Use limit=50 for initial requests
2. **Narrow Dates**: Prefer shorter date ranges (7-30 days)
3. **Cache Results**: Cache frequently accessed metrics
4. **Batch Wisely**: Use pagination for processing large datasets
5. **Monitor Logs**: Watch for slow query warnings in logs

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Timeout errors | Reduce `limit` or date range |
| Slow response | Check database indexes |
| Missing data | Verify `offset` is within total |
| Wrong page count | Check `totalPages` in response |

## Testing Checklist

- [ ] Default pagination works (no params)
- [ ] Custom limit respected (within 1-1000)
- [ ] Page parameter calculates offset correctly
- [ ] Pagination metadata accurate
- [ ] Timeout errors handled gracefully
- [ ] Date range filtering works with pagination

## Quick Commands

```bash
# Test default pagination
curl http://localhost:5001/api/v1/production-metrics/courier-performance | jq .pagination

# Test custom limit
curl "http://localhost:5001/api/v1/production-metrics/courier-performance?limit=25" | jq .pagination.limit

# Test page navigation
curl "http://localhost:5001/api/v1/production-metrics/courier-performance?page=2&limit=50" | jq .pagination.page

# Test with date range
curl "http://localhost:5001/api/v1/production-metrics/sla/compliance?start_date=2024-11-01&end_date=2024-11-30&limit=100" | jq .pagination

# Check for timeout (large date range)
curl "http://localhost:5001/api/v1/production-metrics/courier-performance?days=365&limit=1000"
```

## Database Indexes Required

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at);
```

## Migration Checklist

If updating from non-paginated version:

- [ ] Update API calls to handle `pagination` field in response
- [ ] Add UI controls for page navigation
- [ ] Handle `hasNextPage` / `hasPreviousPage` flags
- [ ] Update data structure (e.g., `couriers` array still in same place)
- [ ] Add loading states for pagination actions
- [ ] Update error handling for timeout errors
- [ ] Test with various limit/offset combinations
- [ ] Update documentation/comments in frontend code

## Support

**Documentation**: See [PAGINATION_GUIDE.md](./PAGINATION_GUIDE.md) for detailed documentation

**Common Issues**:
- Timeout? → Reduce date range or limit
- Slow? → Check database indexes
- Wrong data? → Verify offset calculation

**Contact**: Backend team for optimization support
