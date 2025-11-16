# Rate Limiter Configuration Guide

**Updated**: 2025-11-16
**Commit**: 0c35242

---

## 🎯 Quick Fix for Testing

To increase rate limits or disable them for testing:

### Option 1: Increase Limits (Recommended for Testing)

```bash
gcloud run services update route-opt-backend \
  --region us-central1 \
  --update-env-vars RATE_LIMIT_MAX=1000,RATE_LIMIT_WINDOW_MS=60000
```

This allows **1000 requests per minute** (vs 100 per 15 minutes).

### Option 2: Disable Rate Limiting (For Development Only)

```bash
gcloud run services update route-opt-backend \
  --region us-central1 \
  --update-env-vars RATE_LIMIT_ENABLED=false
```

⚠️ **Warning**: Only use this for testing! Don't leave disabled in production.

### Option 3: Production-Friendly (Moderate Limits)

```bash
gcloud run services update route-opt-backend \
  --region us-central1 \
  --update-env-vars RATE_LIMIT_MAX=500,RATE_LIMIT_WINDOW_MS=300000
```

This allows **500 requests per 5 minutes**.

---

## 📊 Environment Variables

### `RATE_LIMIT_ENABLED`
- **Type**: Boolean (string)
- **Default**: `true`
- **Values**: `true` | `false`
- **Description**: Master switch for rate limiting

**Examples**:
```bash
# Disable rate limiting
RATE_LIMIT_ENABLED=false

# Enable rate limiting (default)
RATE_LIMIT_ENABLED=true
```

### `RATE_LIMIT_MAX`
- **Type**: Integer (string)
- **Default**: `100`
- **Description**: Maximum number of requests allowed per window

**Examples**:
```bash
# Very restrictive (authentication endpoints)
RATE_LIMIT_MAX=10

# Standard (current default)
RATE_LIMIT_MAX=100

# High limit for testing
RATE_LIMIT_MAX=1000

# Very high limit
RATE_LIMIT_MAX=10000
```

### `RATE_LIMIT_WINDOW_MS`
- **Type**: Integer (string, milliseconds)
- **Default**: `900000` (15 minutes)
- **Description**: Time window for rate limiting in milliseconds

**Examples**:
```bash
# 1 minute
RATE_LIMIT_WINDOW_MS=60000

# 5 minutes
RATE_LIMIT_WINDOW_MS=300000

# 15 minutes (default)
RATE_LIMIT_WINDOW_MS=900000

# 1 hour
RATE_LIMIT_WINDOW_MS=3600000
```

---

## 🚀 Deployment Scenarios

### Scenario 1: Running Tests

**Problem**: Automated tests hitting rate limits
**Solution**: High limits with short window

```bash
gcloud run services update route-opt-backend \
  --region us-central1 \
  --update-env-vars \
    RATE_LIMIT_MAX=5000,\
    RATE_LIMIT_WINDOW_MS=60000
```

**Result**: 5000 requests per minute

### Scenario 2: Development Environment

**Problem**: Frequent API calls during development
**Solution**: Disable or use very high limits

```bash
gcloud run services update route-opt-backend \
  --region us-central1 \
  --update-env-vars RATE_LIMIT_ENABLED=false
```

**Result**: No rate limiting

### Scenario 3: Production (Current)

**Problem**: Protect against abuse
**Solution**: Moderate limits

```bash
gcloud run services update route-opt-backend \
  --region us-central1 \
  --update-env-vars \
    RATE_LIMIT_MAX=100,\
    RATE_LIMIT_WINDOW_MS=900000
```

**Result**: 100 requests per 15 minutes (current default)

### Scenario 4: High-Traffic Production

**Problem**: Legitimate high traffic
**Solution**: Higher limits with same window

```bash
gcloud run services update route-opt-backend \
  --region us-central1 \
  --update-env-vars \
    RATE_LIMIT_MAX=500,\
    RATE_LIMIT_WINDOW_MS=900000
```

**Result**: 500 requests per 15 minutes

---

## 🔍 How to Check Current Configuration

### Via Logs (After Deployment)

Check Cloud Run logs for:
```
Rate limiting configured {
  enabled: true,
  maxRequests: 100,
  windowMinutes: 15
}
```

### Via Cloud Console

1. Go to Cloud Run: https://console.cloud.google.com/run
2. Click on `route-opt-backend`
3. Go to "Variables & Secrets" tab
4. Look for:
   - `RATE_LIMIT_ENABLED`
   - `RATE_LIMIT_MAX`
   - `RATE_LIMIT_WINDOW_MS`

### Via gcloud CLI

```bash
gcloud run services describe route-opt-backend \
  --region us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

Look for the rate limit variables in the output.

---

## 🧪 Testing Rate Limits

### Test Current Limits

```bash
# Make multiple requests quickly
for i in {1..10}; do
  curl -s https://route-opt-backend-426674819922.us-central1.run.app/api/v1/health \
    -w "\nStatus: %{http_code}\n" | grep -E "(Status|error)"
  sleep 0.1
done
```

**Expected**:
- With limits: After N requests, you'll see 429 errors
- Without limits: All requests succeed (200)

### Test Limit Headers

```bash
curl -I https://route-opt-backend-426674819922.us-central1.run.app/api/v1/health
```

Look for headers:
```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1700123456
```

---

## ⚠️ Important Considerations

### Security

**Production**:
- ✅ ALWAYS enable rate limiting in production
- ✅ Use moderate limits (100-500 per 15 minutes)
- ✅ Monitor for abuse patterns

**Development/Testing**:
- ⚠️ Disable or use high limits
- ⚠️ Remember to re-enable for production
- ⚠️ Document any changes

### Performance

**High Limits** (1000+ per minute):
- ✅ Good for testing
- ⚠️ May allow DDoS attacks
- ⚠️ Increases server load

**Low Limits** (10-50 per 15 minutes):
- ✅ Good for authentication endpoints
- ⚠️ May block legitimate users
- ⚠️ Frustrating user experience

**Recommended Production**:
- **Standard API**: 100-500 per 15 minutes
- **Authentication**: 5-10 per 15 minutes
- **Heavy operations**: 20-50 per 15 minutes

---

## 📝 Step-by-Step: Update for Testing

### 1. Update Environment Variables

```bash
# For testing (high limits)
gcloud run services update route-opt-backend \
  --region us-central1 \
  --update-env-vars RATE_LIMIT_MAX=1000,RATE_LIMIT_WINDOW_MS=60000 \
  --no-traffic  # Don't split traffic during update
```

### 2. Wait for Deployment

```bash
# Monitor deployment
gcloud run services describe route-opt-backend \
  --region us-central1 \
  --format="value(status.conditions[0].message)"
```

Wait for: "Ready condition status changed to True"

### 3. Verify Configuration

```bash
# Check logs for confirmation
gcloud logging read "resource.type=cloud_run_revision AND textPayload:\"Rate limiting configured\"" \
  --limit 1 \
  --format="value(textPayload)"
```

Expected:
```
Rate limiting configured { enabled: true, maxRequests: 1000, windowMinutes: 1 }
```

### 4. Test the New Limits

```bash
# Run your tests
./verify-all-fixes.sh
```

Should now work without rate limit errors!

### 5. Restore Production Limits

```bash
# After testing, restore production settings
gcloud run services update route-opt-backend \
  --region us-central1 \
  --update-env-vars RATE_LIMIT_MAX=100,RATE_LIMIT_WINDOW_MS=900000
```

---

## 🚨 Troubleshooting

### Still Getting Rate Limited

**Problem**: Updated env vars but still hitting limits

**Solutions**:
1. Check if deployment completed:
   ```bash
   gcloud run services describe route-opt-backend --region us-central1
   ```

2. Verify env vars are set:
   ```bash
   gcloud run services describe route-opt-backend \
     --region us-central1 \
     --format="value(spec.template.spec.containers[0].env)"
   ```

3. Check logs:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision" \
     --limit 10 \
     --format="value(textPayload)"
   ```

4. Force new revision:
   ```bash
   gcloud run services update route-opt-backend \
     --region us-central1 \
     --update-env-vars RATE_LIMIT_MAX=1000 \
     --revision-suffix="test-$(date +%s)"
   ```

### Env Vars Not Taking Effect

**Problem**: Changes don't reflect in app

**Solution**: Container might be cached

```bash
# Force rebuild and redeploy
gcloud run deploy route-opt-backend \
  --region us-central1 \
  --source . \
  --update-env-vars RATE_LIMIT_MAX=1000
```

### Need to Remove Env Vars

```bash
# Remove specific variable
gcloud run services update route-opt-backend \
  --region us-central1 \
  --remove-env-vars RATE_LIMIT_MAX

# This reverts to default (100)
```

---

## 📚 Additional Resources

- [Cloud Run Environment Variables](https://cloud.google.com/run/docs/configuring/environment-variables)
- [Express Rate Limit Docs](https://github.com/express-rate-limit/express-rate-limit)
- [OWASP Rate Limiting](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)

---

## ✅ Quick Reference

| Use Case | Command |
|----------|---------|
| **Testing** | `--update-env-vars RATE_LIMIT_MAX=1000,RATE_LIMIT_WINDOW_MS=60000` |
| **Development** | `--update-env-vars RATE_LIMIT_ENABLED=false` |
| **Production** | `--update-env-vars RATE_LIMIT_MAX=100,RATE_LIMIT_WINDOW_MS=900000` |
| **High Traffic** | `--update-env-vars RATE_LIMIT_MAX=500,RATE_LIMIT_WINDOW_MS=900000` |
| **Disable** | `--update-env-vars RATE_LIMIT_ENABLED=false` |

---

**Last Updated**: 2025-11-16
**Status**: ✅ Deployed (commit 0c35242)
