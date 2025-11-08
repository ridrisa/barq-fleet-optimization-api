# Error Codes Documentation

## Overview
This document defines all error codes used in the BARQ Fleet Management API. All errors follow a consistent structure with HTTP status codes, error codes, and descriptive messages.

## Error Response Format

```json
{
  "success": false,
  "status": "error",
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "errors": [], // Optional: validation errors or additional details
  "timestamp": "2025-01-05T10:30:00.000Z",
  "requestId": "req-abc123" // Only for 500+ errors
}
```

## Error Categories

### 1. Client Errors (4xx)

#### 400 - Bad Request
| Code | Description | Typical Cause |
|------|-------------|---------------|
| `VALIDATION_ERROR` | Input validation failed | Invalid or missing required fields |
| `INVALID_INPUT` | Generic invalid input | Malformed request data |
| `INVALID_COORDINATES` | Invalid GPS coordinates | Lat/lng out of valid range |
| `INVALID_SERVICE_TYPE` | Invalid service type | Must be BARQ or BULLET |
| `INVALID_ORDER_STATUS` | Invalid order status | Status transition not allowed |
| `PAYLOAD_TOO_LARGE` | Request payload exceeds limit | Body size > 1MB |

#### 401 - Unauthorized
| Code | Description | Typical Cause |
|------|-------------|---------------|
| `UNAUTHORIZED` | Authentication required | Missing or invalid auth token |
| `INVALID_TOKEN` | Token is invalid | Malformed JWT token |
| `TOKEN_EXPIRED` | Token has expired | JWT token past expiration |
| `INVALID_CREDENTIALS` | Login credentials invalid | Wrong username/password |

#### 403 - Forbidden
| Code | Description | Typical Cause |
|------|-------------|---------------|
| `FORBIDDEN` | Access denied | Insufficient permissions |
| `INSUFFICIENT_PERMISSIONS` | User lacks required role | RBAC authorization failed |
| `CORS_VIOLATION` | CORS policy violation | Request from unauthorized origin |
| `IP_BLOCKED` | IP address blocked | Security blacklist |

#### 404 - Not Found
| Code | Description | Typical Cause |
|------|-------------|---------------|
| `NOT_FOUND` | Resource not found | Invalid ID or deleted resource |
| `ROUTE_NOT_FOUND` | API endpoint not found | Invalid URL path |
| `ORDER_NOT_FOUND` | Order not found | Order ID doesn't exist |
| `DRIVER_NOT_FOUND` | Driver not found | Driver ID doesn't exist |
| `AGENT_NOT_FOUND` | Agent not found | Agent not registered |

#### 409 - Conflict
| Code | Description | Typical Cause |
|------|-------------|---------------|
| `CONFLICT` | Resource conflict | Duplicate entry or state conflict |
| `DUPLICATE_ENTRY` | Resource already exists | Unique constraint violation |
| `ORDER_ALREADY_ASSIGNED` | Order already assigned | Cannot reassign assigned order |
| `DRIVER_UNAVAILABLE` | Driver not available | Driver already has max orders |

#### 429 - Too Many Requests
| Code | Description | Typical Cause |
|------|-------------|---------------|
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded | Too many requests in time window |
| `TOO_MANY_REQUESTS` | Generic rate limiting | API quota exhausted |

### 2. Server Errors (5xx)

#### 500 - Internal Server Error
| Code | Description | Typical Cause |
|------|-------------|---------------|
| `INTERNAL_ERROR` | Generic server error | Unhandled exception |
| `AGENT_EXECUTION_ERROR` | Agent failed to execute | AI agent runtime error |
| `CALCULATION_ERROR` | Calculation failed | Math/logic error in algorithm |
| `CONFIGURATION_ERROR` | Configuration issue | Invalid env vars or settings |

#### 502 - Bad Gateway
| Code | Description | Typical Cause |
|------|-------------|---------------|
| `EXTERNAL_SERVICE_ERROR` | External service failed | LLM API, Maps API down |
| `LLM_SERVICE_ERROR` | LLM service unavailable | OpenAI/Anthropic API error |
| `MAPS_SERVICE_ERROR` | Maps service unavailable | Google Maps API error |

#### 503 - Service Unavailable
| Code | Description | Typical Cause |
|------|-------------|---------------|
| `SERVICE_UNAVAILABLE` | Service temporarily down | Maintenance or restart |
| `AGENT_SYSTEM_INITIALIZING` | Agents not ready | System starting up |
| `DATABASE_UNAVAILABLE` | Database unreachable | DB connection failed |

#### 504 - Gateway Timeout
| Code | Description | Typical Cause |
|------|-------------|---------------|
| `TIMEOUT_ERROR` | Request timeout | Operation took too long |
| `AGENT_TIMEOUT` | Agent execution timeout | AI agent exceeded time limit |
| `EXTERNAL_TIMEOUT` | External service timeout | Third-party API timeout |

## Agent-Specific Errors

### Master Orchestrator
| Code | Description | Recovery Strategy |
|------|-------------|-------------------|
| `ORCHESTRATION_FAILED` | Orchestration workflow failed | Queue order for manual review |
| `AGENT_PLAN_FAILED` | Agent execution plan failed | Use fallback plan |
| `CRITICAL_AGENT_FAILED` | Critical agent unavailable | Enter emergency mode |

### Fleet Status Agent
| Code | Description | Recovery Strategy |
|------|-------------|-------------------|
| `NO_DRIVERS_AVAILABLE` | No drivers available | Queue order, notify dispatch |
| `FLEET_DATA_STALE` | Fleet data outdated | Refresh fleet status |
| `DRIVER_LOCATION_UNKNOWN` | Driver location not updated | Request location update |

### Order Assignment Agent
| Code | Description | Recovery Strategy |
|------|-------------|-------------------|
| `ASSIGNMENT_FAILED` | Unable to assign order | Retry with different parameters |
| `NO_SUITABLE_DRIVER` | No driver meets criteria | Relax constraints and retry |
| `SCORING_ERROR` | Driver scoring failed | Use simple distance-based fallback |

### Route Optimization Agent
| Code | Description | Recovery Strategy |
|------|-------------|-------------------|
| `ROUTE_OPTIMIZATION_FAILED` | Route calculation failed | Use direct route |
| `INVALID_ROUTE` | Generated route invalid | Recalculate with constraints |
| `MAPS_API_ERROR` | Maps API unavailable | Use cached/estimated routes |

### SLA Monitor Agent
| Code | Description | Recovery Strategy |
|------|-------------|-------------------|
| `SLA_BREACH_IMMINENT` | SLA breach likely | Escalate to supervisor |
| `SLA_BREACH_CONFIRMED` | SLA breached | Initiate recovery protocol |
| `SLA_CHECK_FAILED` | SLA check error | Continue with warning |

### Batch Optimization Agent
| Code | Description | Recovery Strategy |
|------|-------------|-------------------|
| `BATCH_OPTIMIZATION_FAILED` | Batch optimization failed | Process orders individually |
| `BATCH_SIZE_EXCEEDED` | Too many orders in batch | Split into smaller batches |
| `BATCH_EMPTY` | No orders to batch | Skip optimization |

### Emergency Escalation Agent
| Code | Description | Recovery Strategy |
|------|-------------|-------------------|
| `ESCALATION_FAILED` | Escalation notification failed | Log and alert manually |
| `INVALID_EMERGENCY_TYPE` | Unknown emergency type | Use generic escalation |
| `ESCALATION_TIMEOUT` | Escalation timeout | Retry with higher priority |

## Error Handling Best Practices

### For API Consumers
1. **Always check `success` field** before processing response
2. **Use `code` for programmatic handling**, not message text
3. **Log `requestId`** for 500+ errors when reporting issues
4. **Implement exponential backoff** for rate limit errors
5. **Handle `503` errors** with retry logic (system initializing)

### For Developers
1. **Use custom error classes** from `error.middleware.js`
2. **Wrap async routes** with `asyncHandler`
3. **Throw specific errors**, not generic Error
4. **Log errors** with context (userId, orderId, etc.)
5. **Never expose stack traces** in production

### Example: Proper Error Handling

```javascript
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/error.middleware');

// Route with proper error handling
router.post('/orders', asyncHandler(async (req, res) => {
  const { order } = req.body;

  // Validation
  if (!order || !order.pickup || !order.delivery) {
    throw new ValidationError('Order must have pickup and delivery locations');
  }

  // Check if order exists
  const existing = await db.orders.findById(order.id);
  if (existing) {
    throw new ConflictError('Order already exists');
  }

  // Process order
  const result = await orderService.create(order);

  res.status(201).json({
    success: true,
    data: result
  });
}));
```

## Monitoring and Alerting

### Error Thresholds
- **4xx errors > 5%**: Investigate client integration issues
- **5xx errors > 1%**: Critical system issue, page on-call
- **Rate limit hits > 100/hr**: Review client usage patterns
- **Agent failures > 10%**: Review agent health and LLM service

### Error Logging
All errors are logged with:
- Timestamp
- Request ID
- User/Organization ID
- Error code and message
- Stack trace (non-operational errors)
- Request context (path, method, body)

### Log Locations
- **Combined logs**: `logs/combined.log`
- **Error logs**: `logs/error.log`
- **API logs**: `logs/api.log`

## Support

When reporting errors, include:
- Error code
- Request ID (for 500+ errors)
- Timestamp
- Steps to reproduce
- Expected vs actual behavior

---

**Last Updated**: 2025-01-05
**Version**: 1.0
**Maintained by**: BARQ Backend Team
