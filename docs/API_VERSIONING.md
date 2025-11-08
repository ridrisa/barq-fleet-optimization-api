# API Versioning Strategy

## Overview

The AI Route Optimization API implements comprehensive semantic versioning to ensure backward compatibility, smooth migrations, and predictable API evolution.

## Version Format

- **URL-based versioning**: `/api/v{major}/resource`
- **Current version**: `v1`
- **Stable since**: 2025-01-01

## Accessing the API

### Versioned Endpoints (Recommended)

All new integrations should use explicitly versioned endpoints:

```bash
# Authentication
POST /api/v1/auth/login
GET /api/v1/auth/me

# Route Optimization
POST /api/v1/optimize
GET /api/v1/optimize/history

# AI Agents
GET /api/v1/agents/status
POST /api/v1/agents/order/assign

# Fleet Management
GET /api/v1/agents/fleet/status
POST /api/v1/agents/fleet/rebalance

# Autonomous Operations
GET /api/v1/autonomous/status
POST /api/v1/autonomous/control
```

### Backward Compatibility Routes

For legacy integrations, unversioned routes are still supported but deprecated:

```bash
# These still work but will show deprecation warnings
POST /api/auth/login      # → redirects to /api/v1/auth/login
POST /api/optimize        # → redirects to /api/v1/optimize
GET /api/agents/status    # → redirects to /api/v1/agents/status
```

**⚠️ Warning**: Unversioned routes will be removed in a future major version. Please migrate to versioned endpoints.

## Version Headers

### Request Headers

Clients can specify version preferences:

```http
X-API-Version-Preference: v1
```

### Response Headers

All responses include version information:

```http
X-API-Version: v1
X-API-Versions-Supported: v1
X-API-Deprecated: false
```

### Deprecation Warnings

When using deprecated versions or routes:

```http
X-API-Deprecated: true
X-API-Sunset-Date: 2025-12-31
X-API-Unversioned-Access: true
Warning: 299 - "API version v0 is deprecated. Please migrate to v1"
```

## Frontend Integration

### Environment Configuration

Configure the API version in your `.env` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3003
NEXT_PUBLIC_API_VERSION=v1
```

### Using the API Client

The frontend API client automatically handles versioning:

```typescript
import { apiClient } from '@/lib/api-client';

// Automatically uses /api/v1/optimize
const result = await apiClient.post('/api/optimize', data);

// Version is automatically added
// Actual request: POST /api/v1/optimize
```

### Deprecation Handling

The client logs deprecation warnings to the console:

```javascript
// Console output when using deprecated endpoint:
// [API Client] Deprecation Warning: {
//   message: "API version v0 is deprecated. Please migrate to v1",
//   sunsetDate: "2025-12-31",
//   currentVersion: "v0"
// }
```

## Version Lifecycle

### v1 (Current - Stable)

**Status**: Active, Stable
**Release Date**: 2025-01-01
**Sunset Date**: TBD

**Features**:
- Route optimization with AI
- Multi-agent orchestration
- Fleet management
- Autonomous operations
- Real-time analytics
- SLA monitoring
- Emergency escalation

**Breaking Changes from Unversioned API**: None

## Migration Guide

### From Unversioned to v1

**Step 1**: Update your environment configuration

```diff
# .env
NEXT_PUBLIC_API_URL=http://localhost:3003
+ NEXT_PUBLIC_API_VERSION=v1
```

**Step 2**: Update direct API calls (if not using API client)

```diff
- POST /api/optimize
+ POST /api/v1/optimize

- GET /api/agents/status
+ GET /api/v1/agents/status
```

**Step 3**: Test all endpoints

```bash
# Run your test suite
npm test

# Verify no deprecation warnings in console
# Check response headers for X-API-Deprecated: false
```

**Step 4**: Monitor logs

Check your application logs for any deprecation warnings and update accordingly.

## Version Support Policy

### Support Levels

- **Active**: Full support, new features, bug fixes
- **Maintenance**: Security fixes only, no new features
- **Deprecated**: Security fixes for critical issues, scheduled for removal
- **Sunset**: No longer supported, removed from API

### Support Timeline

- **Active Support**: 24 months minimum
- **Deprecation Notice**: 6 months minimum before sunset
- **Sunset Grace Period**: 3 months after deprecation

### Current Support Status

| Version | Status | Release Date | Deprecation Date | Sunset Date |
|---------|--------|--------------|------------------|-------------|
| v1      | Active | 2025-01-01   | TBD              | TBD         |

## Breaking Changes Policy

### What Constitutes a Breaking Change

A new major version is required for:

1. **Removing endpoints** or parameters
2. **Changing response structures** (removing fields, changing types)
3. **Changing authentication** requirements
4. **Modifying error codes** or error response formats
5. **Changing default behaviors** that affect existing integrations

### Non-Breaking Changes

These can be added to existing versions:

1. **Adding new endpoints**
2. **Adding optional parameters**
3. **Adding new fields** to responses (additive only)
4. **Adding new HTTP methods** to existing endpoints
5. **Improving error messages** (without changing codes)

## API Version Negotiation

### Client-Specified Version

Clients can request a specific version:

```http
GET /api/v1/optimize/history
X-API-Version-Preference: v1
```

### Version Validation

Invalid versions return 400 Bad Request:

```json
{
  "success": false,
  "error": "API version 'v99' is not supported",
  "supportedVersions": ["v1"],
  "currentVersion": "v1"
}
```

## Testing Versioned Endpoints

### Using cURL

```bash
# Test v1 endpoint
curl -X POST http://localhost:3003/api/v1/optimize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"pickupPoints": [...], "deliveryPoints": [...]}'

# Check version headers
curl -I http://localhost:3003/api/v1/optimize
```

### Using Postman

1. Set base URL: `http://localhost:3003/api/v1`
2. Add header: `X-API-Version-Preference: v1`
3. Check response headers for version information

### Automated Testing

```javascript
// tests/api-versioning.test.js
describe('API Versioning', () => {
  it('should include version headers', async () => {
    const response = await request(app)
      .get('/api/v1/agents/status')
      .expect(200);

    expect(response.headers['x-api-version']).toBe('v1');
    expect(response.headers['x-api-versions-supported']).toContain('v1');
  });

  it('should reject invalid versions', async () => {
    const response = await request(app)
      .get('/api/v99/agents/status')
      .expect(400);

    expect(response.body.error).toContain('not supported');
  });
});
```

## Version Information Endpoint

### Get Current Version Info

```bash
GET /api/versions
```

**Response**:

```json
{
  "success": true,
  "currentVersion": "v1",
  "supportedVersions": ["v1"],
  "deprecatedVersions": [],
  "versions": {
    "v1": {
      "status": "stable",
      "releaseDate": "2025-01-01",
      "endpoints": "/api/v1",
      "documentation": "/api-docs#/v1",
      "features": [
        "Route optimization",
        "AI agent operations",
        "Fleet management",
        "Autonomous operations",
        "Authentication and authorization"
      ]
    }
  }
}
```

## Monitoring and Observability

### Version Usage Metrics

Track which versions are being used:

```javascript
// Logged for every request
{
  version: 'v1',
  path: '/api/v1/optimize',
  method: 'POST',
  timestamp: '2025-01-05T12:00:00Z'
}
```

### Deprecation Analytics

Monitor deprecation warning triggers to plan migrations:

```javascript
// Logged when deprecated endpoint accessed
{
  level: 'warn',
  message: 'Deprecated API version accessed',
  version: 'v0',
  path: '/api/optimize',
  ip: '192.168.1.100',
  requestId: 'req-123-456'
}
```

## Best Practices

### For API Consumers

1. ✅ **Always use versioned endpoints** in production
2. ✅ **Monitor deprecation warnings** in your logs
3. ✅ **Test migrations** in staging before production
4. ✅ **Subscribe to API changelog** for updates
5. ✅ **Set version in environment config**, not hardcoded

### For API Developers

1. ✅ **Never break backward compatibility** within a version
2. ✅ **Document all changes** in changelog
3. ✅ **Provide migration guides** for new versions
4. ✅ **Give ample deprecation notice** (6+ months)
5. ✅ **Support multiple versions** during transition periods

## Future Versions

### v2 (Planned)

**Estimated Release**: TBD
**Focus Areas**:
- GraphQL API support
- Enhanced real-time subscriptions
- Advanced analytics endpoints
- Multi-tenant support

**Breaking Changes**:
- TBD based on v1 feedback and evolution needs

## FAQ

### Q: Do I need to update my code immediately?

**A**: No. If you're using unversioned endpoints, they'll continue working with deprecation warnings. However, we strongly recommend migrating to v1 to future-proof your integration.

### Q: How long will unversioned routes be supported?

**A**: Unversioned routes will be supported for at least 12 months from the v1 release (until 2026-01-01), with a deprecation notice 6 months before removal.

### Q: Can I use multiple versions simultaneously?

**A**: Yes. You can call different versions in the same application:

```typescript
const v1Result = await apiClient.post('/api/v1/optimize', data);
// When v2 is available:
const v2Result = await apiClient.post('/api/v2/optimize', data);
```

### Q: How do I know which version I'm currently using?

**A**: Check the `X-API-Version` response header on any API call, or call `GET /api/versions`.

### Q: What happens if I request an unsupported version?

**A**: You'll receive a 400 Bad Request response with details about supported versions.

## Support and Contact

- **Documentation**: `/api-docs`
- **Version Status**: `GET /api/versions`
- **Health Check**: `GET /health`
- **GitHub Issues**: [Report versioning issues](https://github.com/yourorg/api/issues)

---

**Last Updated**: 2025-01-05
**Current Version**: v1
**API Version Policy Version**: 1.0
