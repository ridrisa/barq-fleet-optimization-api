# Security Testing Guide - BARQ Fleet Management

## Quick Reference
Test all security controls to ensure OWASP Top 10 compliance and enterprise security standards.

---

## Prerequisites

### Required Tools
```bash
# Install testing dependencies
npm install --save-dev jest supertest

# Install security testing tools (optional but recommended)
npm install -g owasp-zap-cli
npm install -g retire
```

### Environment Setup
```bash
# Create test environment
cp .env.example .env.test

# Update test configuration
DATABASE_URL=postgresql://test_user:test_pass@localhost:5432/barq_test
JWT_SECRET=test_secret_change_in_production
NODE_ENV=test
```

---

## Test Categories

### 1. Authentication Tests

#### Test 1: User Registration
```bash
# Valid registration
curl -X POST http://localhost:3003/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@test.com",
    "password": "SecurePass123!",
    "name": "Test User",
    "role": "customer"
  }'

# Expected: 201 Created
# Response should include: user object, token, refreshToken
```

#### Test 2: Weak Password Rejection
```bash
# Weak password (should fail)
curl -X POST http://localhost:3003/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "weak",
    "name": "Test"
  }'

# Expected: 400 Bad Request
# Error: Password must contain uppercase, lowercase, and number
```

#### Test 3: Duplicate Email Prevention
```bash
# Register same email twice
curl -X POST http://localhost:3003/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "duplicate@test.com",
    "password": "SecurePass123!",
    "name": "User 1"
  }'

# Try again with same email
curl -X POST http://localhost:3003/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "duplicate@test.com",
    "password": "SecurePass123!",
    "name": "User 2"
  }'

# Expected second request: 409 Conflict
# Error: User already exists
```

#### Test 4: Login with Valid Credentials
```bash
curl -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@barq.com",
    "password": "Admin@123"
  }'

# Expected: 200 OK
# Response: token, refreshToken, user object
# Save token for subsequent tests
export TOKEN="<token_from_response>"
```

#### Test 5: Login with Invalid Credentials
```bash
curl -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@barq.com",
    "password": "WrongPassword"
  }'

# Expected: 401 Unauthorized
# Error: Invalid credentials
```

#### Test 6: Token Refresh
```bash
curl -X POST http://localhost:3003/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<refresh_token>"}'

# Expected: 200 OK
# Response: new token and refreshToken
```

#### Test 7: Get User Profile
```bash
curl -X GET http://localhost:3003/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK
# Response: user profile with permissions
```

---

### 2. Authorization Tests

#### Test 1: Unauthorized Access (No Token)
```bash
curl -X GET http://localhost:3003/api/optimize/history

# Expected: 401 Unauthorized
# Error: Authentication required
```

#### Test 2: Insufficient Permissions
```bash
# Login as customer
curl -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@test.com",
    "password": "Customer123!"
  }'

export CUSTOMER_TOKEN="<token_from_response>"

# Try to access admin endpoint
curl -X GET http://localhost:3003/api/admin/agents/status \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"

# Expected: 403 Forbidden
# Error: Insufficient permissions
```

#### Test 3: Role-Based Access Control
```bash
# Test each role's access

# Super Admin - should access everything
curl -X GET http://localhost:3003/api/admin/system/health \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"
# Expected: 200 OK

# Manager - should access reports but not system config
curl -X GET http://localhost:3003/api/agents/performance/analytics \
  -H "Authorization: Bearer $MANAGER_TOKEN"
# Expected: 200 OK

curl -X POST http://localhost:3003/api/agents/shutdown \
  -H "Authorization: Bearer $MANAGER_TOKEN"
# Expected: 403 Forbidden

# Customer - should only access own resources
curl -X POST http://localhost:3003/api/optimize \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'
# Expected: 403 Forbidden (customers cannot optimize)
```

---

### 3. Input Validation Tests

#### Test 1: SQL Injection Attempts
```bash
# Try SQL injection in login
curl -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@barq.com'\'' OR 1=1--",
    "password": "anything"
  }'

# Expected: 401 Unauthorized (not vulnerable)
```

#### Test 2: XSS Attempts
```bash
# Try XSS in registration
curl -X POST http://localhost:3003/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "xss@test.com",
    "password": "Test@123",
    "name": "<script>alert(\"XSS\")</script>"
  }'

# Expected: 201 Created but name should be sanitized
# Verify: name should not contain script tags
```

#### Test 3: Invalid Data Types
```bash
# Send string where number expected
curl -X POST http://localhost:3003/api/agents/order/assign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order": {
      "id": "order-1",
      "serviceType": "BARQ",
      "pickup": {"lat": "not-a-number", "lng": 46.7, "address": "Test"},
      "delivery": {"lat": 24.7, "lng": 46.7, "address": "Test"}
    }
  }'

# Expected: 400 Bad Request
# Error: Validation failed
```

#### Test 4: Missing Required Fields
```bash
curl -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com"}'

# Expected: 400 Bad Request
# Error: Password is required
```

#### Test 5: Oversized Payload
```bash
# Create a 2MB payload (exceeds 1MB limit)
dd if=/dev/zero of=largefile.json bs=2M count=1

curl -X POST http://localhost:3003/api/optimize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @largefile.json

# Expected: 413 Payload Too Large
```

---

### 4. Rate Limiting Tests

#### Test 1: Anonymous Rate Limit
```bash
# Make 101 rapid requests (limit is 100 per 15 min)
for i in {1..101}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3003/health
done

# Expected: First 100 return 200, 101st returns 429
```

#### Test 2: Authenticated Rate Limit
```bash
# Authenticated users should have higher limits
for i in {1..150}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: Bearer $TOKEN" \
    http://localhost:3003/api/optimize/history
done

# Expected: More requests allowed than anonymous
```

---

### 5. Security Headers Tests

#### Test 1: Verify Security Headers
```bash
curl -I http://localhost:3003/api/auth/login

# Expected headers:
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Content-Security-Policy: ...
# Should NOT see: X-Powered-By
```

#### Test 2: CSP Violation
```bash
# Try to load external script (should be blocked by CSP)
# This test requires a browser or headless browser (Puppeteer/Playwright)
```

---

### 6. Session Management Tests

#### Test 1: Token Expiration
```bash
# Login and get token
curl -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@barq.com", "password": "Admin@123"}'

# Wait for token to expire (15 minutes by default)
# Or manually set JWT_EXPIRES_IN=10s for testing

# Try to use expired token
curl -X GET http://localhost:3003/api/auth/me \
  -H "Authorization: Bearer <expired_token>"

# Expected: 401 Unauthorized
# Error: Token expired
```

#### Test 2: Token Reuse After Logout
```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@barq.com", "password": "Admin@123"}' \
  | jq -r '.data.token')

# Logout
curl -X POST http://localhost:3003/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"

# Try to use token after logout
curl -X GET http://localhost:3003/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Expected: 401 Unauthorized (if token blacklisting implemented)
```

---

### 7. OWASP Top 10 Validation

#### A1: Injection
```bash
# SQL Injection
✓ Test login with SQL payload
✓ Test search with SQL payload
✓ Verify parameterized queries

# Command Injection
✓ Test file upload with malicious filename
✓ Test input fields with shell commands
```

#### A2: Broken Authentication
```bash
✓ Test weak password rejection
✓ Test password hashing (bcrypt)
✓ Test token expiration
✓ Test concurrent sessions
✓ Test password change flow
```

#### A3: Sensitive Data Exposure
```bash
✓ Verify passwords not in responses
✓ Verify error messages don't leak info
✓ Test HTTPS enforcement (production)
✓ Verify sensitive data not logged
```

#### A5: Broken Access Control
```bash
✓ Test horizontal privilege escalation
✓ Test vertical privilege escalation
✓ Test IDOR (Insecure Direct Object Reference)
✓ Test forced browsing
```

#### A7: Cross-Site Scripting (XSS)
```bash
✓ Test reflected XSS
✓ Test stored XSS
✓ Test DOM-based XSS
✓ Verify CSP headers
✓ Verify input sanitization
```

---

### 8. Penetration Testing

#### Using OWASP ZAP
```bash
# Start ZAP proxy
docker run -u zap -p 8080:8080 -p 8090:8090 \
  owasp/zap2docker-stable zap-webswing.sh

# Run automated scan
zap-cli quick-scan --self-contained \
  --start-options '-config api.disablekey=true' \
  http://localhost:3003

# Review results
zap-cli report -o security-report.html -f html
```

#### Manual Penetration Tests
1. **Authentication Bypass**
   - Try accessing protected endpoints without token
   - Try modifying JWT payload
   - Try using expired/invalid tokens

2. **Authorization Bypass**
   - Try accessing resources of other users
   - Try elevating privileges
   - Try accessing admin endpoints as regular user

3. **Business Logic Flaws**
   - Try race conditions
   - Try negative numbers
   - Try boundary values
   - Try workflow manipulation

---

### 9. Automated Security Testing

#### Jest Security Tests
```javascript
// tests/security/auth.test.js
const request = require('supertest');
const app = require('../../src/app');

describe('Authentication Security', () => {
  test('should reject weak passwords', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@test.com',
        password: 'weak',
        name: 'Test'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('password');
  });

  test('should hash passwords', async () => {
    // Register user
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'hash@test.com',
        password: 'Test@123',
        name: 'Test'
      });

    // Verify password is not stored as plaintext
    const user = await db.query(
      'SELECT password_hash FROM users WHERE email = $1',
      ['hash@test.com']
    );

    expect(user.rows[0].password_hash).not.toBe('Test@123');
    expect(user.rows[0].password_hash).toMatch(/^\$2[aby]\$/); // bcrypt format
  });

  test('should prevent SQL injection', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: "admin@barq.com' OR '1'='1",
        password: 'anything'
      });

    expect(res.status).toBe(401);
  });
});
```

#### Run Tests
```bash
# Run all security tests
npm test -- tests/security/

# Run specific test suite
npm test -- tests/security/auth.test.js

# Generate coverage report
npm test -- --coverage
```

---

### 10. Continuous Security Monitoring

#### Daily Checks
```bash
# Check for vulnerable dependencies
npm audit

# Update dependencies
npm update

# Check for outdated packages
npm outdated
```

#### Weekly Checks
```bash
# Full security audit
npm audit --audit-level=moderate

# Check for license issues
npx license-checker

# Scan for secrets in code
git secrets --scan
```

#### Monthly Checks
- Full penetration testing
- Security code review
- Access log review
- Failed authentication analysis
- Rate limit effectiveness review

---

## Security Testing Checklist

### Pre-Deployment
- [ ] All authentication tests pass
- [ ] All authorization tests pass
- [ ] Input validation covers all endpoints
- [ ] Rate limiting works correctly
- [ ] Security headers present
- [ ] No sensitive data in logs
- [ ] No secrets in code
- [ ] OWASP Top 10 tests pass
- [ ] Penetration testing complete
- [ ] npm audit shows no critical/high vulnerabilities

### Production Monitoring
- [ ] Failed login attempts monitoring
- [ ] Unusual access patterns detection
- [ ] Rate limit violations tracking
- [ ] Security header compliance
- [ ] SSL/TLS certificate validity
- [ ] Dependency vulnerability scanning
- [ ] Log aggregation and analysis

---

## Incident Response

### Security Incident Procedure
1. **Detection**: Monitor logs for security events
2. **Assessment**: Determine severity and impact
3. **Containment**: Block attacker, disable compromised accounts
4. **Eradication**: Remove malicious code, patch vulnerabilities
5. **Recovery**: Restore systems, verify integrity
6. **Lessons Learned**: Document and improve

### Security Contacts
- Security Lead: [TBD]
- DevOps Team: [TBD]
- Legal/Compliance: [TBD]

---

## Tools Reference

### Recommended Security Tools
- **OWASP ZAP**: Web application security scanner
- **Burp Suite**: Manual security testing
- **Postman**: API testing with security checks
- **npm audit**: Dependency vulnerability scanning
- **Snyk**: Continuous security monitoring
- **SonarQube**: Code security analysis
- **GitGuardian**: Secret detection in repositories

---

## Resources

### OWASP Resources
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)

### Security Standards
- [PCI DSS](https://www.pcisecuritystandards.org/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [ISO 27001](https://www.iso.org/isoiec-27001-information-security.html)

---

**Last Updated:** January 5, 2025
**Next Review:** February 5, 2025
