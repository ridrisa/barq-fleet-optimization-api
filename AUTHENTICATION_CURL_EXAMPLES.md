# Authentication Flow - cURL Examples

Quick reference for testing authentication endpoints using cURL.

## Prerequisites

Backend server must be running:
```bash
cd backend
npm run dev
# Server starts on http://localhost:3000
```

---

## 1. Login

### Request
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@barq.com",
    "password": "Admin@123"
  }'
```

### Expected Response (200)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "admin@barq.com",
      "name": "System Administrator",
      "role": "super_admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCIsImVtYWlsIjoiYWRtaW5AYmFycS5jb20iLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJwZXJtaXNzaW9ucyI6WyIuLi4iXSwiaWF0IjoxNzM2ODkzMzIwLCJleHAiOjE3MzY5Nzk3MjAsImlzcyI6ImJhcnEtbG9naXN0aWNzIiwiYXVkIjoiYmFycS1hcGkifQ.signature",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h"
  }
}
```

### Save Token
```bash
# Extract token from response
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@barq.com","password":"Admin@123"}' | \
  jq -r '.data.token')

echo "Token saved: $TOKEN"
```

---

## 2. Register New User

### Request
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@barq.com",
    "password": "Manager@123",
    "name": "Test Manager",
    "role": "manager"
  }'
```

### Expected Response (201)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "manager@barq.com",
      "name": "Test Manager",
      "role": "manager",
      "createdAt": "2025-11-14T12:00:00Z"
    },
    "token": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": "24h"
  }
}
```

### Error: User Already Exists (409)
```json
{
  "success": false,
  "error": "User with this email already exists"
}
```

---

## 3. Get Current User Profile

### Request
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Expected Response (200)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@barq.com",
      "name": "System Administrator",
      "role": "super_admin",
      "permissions": [
        "orders.create",
        "orders.read",
        "orders.update",
        "orders.delete",
        "drivers.create",
        "..."
      ],
      "createdAt": "2025-01-01T00:00:00Z",
      "lastLogin": "2025-11-14T12:00:00Z",
      "active": true
    }
  }
}
```

### Error: Not Authenticated (401)
```json
{
  "success": false,
  "error": "Authentication required"
}
```

---

## 4. Access Protected Endpoints

### Test: Agent Status (Requires: admin or manager)

```bash
curl -X GET http://localhost:3000/api/v1/agents/status \
  -H "Authorization: Bearer $TOKEN"
```

**Success (200):**
```json
{
  "success": true,
  "systemStatus": {
    "initialized": true,
    "healthy": true
  },
  "agentManager": {
    "activeAgents": 12,
    "status": "running"
  }
}
```

**Error - Not Authenticated (401):**
```json
{
  "success": false,
  "error": "Authentication required"
}
```

**Error - Insufficient Permissions (403):**
```json
{
  "success": false,
  "error": "Insufficient permissions"
}
```

### Test: Autonomous Health (Requires: admin or manager)

```bash
curl -X GET http://localhost:3000/api/v1/autonomous/health \
  -H "Authorization: Bearer $TOKEN"
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "orchestrator": "READY",
    "actionAuth": "READY",
    "autonomousMode": false,
    "pendingApprovals": 0,
    "learningRecords": 150
  }
}
```

### Test: Autonomous Dashboard (Requires: admin or manager)

```bash
curl -X GET http://localhost:3000/api/v1/autonomous/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

### Test: Recent Actions (Requires: admin or manager)

```bash
curl -X GET http://localhost:3000/api/v1/autonomous/actions/recent \
  -H "Authorization: Bearer $TOKEN"
```

---

## 5. Refresh Token

### Request
```bash
REFRESH_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@barq.com","password":"Admin@123"}' | \
  jq -r '.data.refreshToken')

curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }"
```

### Expected Response (200)
```json
{
  "success": true,
  "data": {
    "token": "new_access_token",
    "refreshToken": "new_refresh_token",
    "expiresIn": "24h"
  }
}
```

---

## 6. Change Password

### Request
```bash
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "Admin@123",
    "newPassword": "NewSecureP@ssw0rd"
  }'
```

### Expected Response (200)
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### Error: Invalid Current Password (401)
```json
{
  "success": false,
  "error": "Current password is incorrect"
}
```

---

## 7. Logout

### Request
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

### Expected Response (200)
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 8. Test Without Authentication (Expected: 401)

### Request
```bash
# Try to access protected endpoint without token
curl -X GET http://localhost:3000/api/v1/agents/status
```

### Expected Response (401)
```json
{
  "success": false,
  "error": "Authentication required"
}
```

---

## 9. Test With Invalid Token (Expected: 401)

### Request
```bash
curl -X GET http://localhost:3000/api/v1/agents/status \
  -H "Authorization: Bearer invalid.token.here"
```

### Expected Response (401)
```json
{
  "success": false,
  "error": "Invalid token"
}
```

---

## 10. Test With Expired Token (Expected: 401)

### Request
```bash
# Use an old/expired token
curl -X GET http://localhost:3000/api/v1/agents/status \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired"
```

### Expected Response (401)
```json
{
  "success": false,
  "error": "Token expired"
}
```

---

## Complete Test Flow Script

```bash
#!/bin/bash

# 1. Login and save token
echo "1. Logging in..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@barq.com","password":"Admin@123"}')

TOKEN=$(echo $RESPONSE | jq -r '.data.token')
echo "Token: ${TOKEN:0:50}..."
echo ""

# 2. Get user profile
echo "2. Getting user profile..."
curl -s -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

# 3. Test protected endpoint
echo "3. Testing protected endpoint..."
curl -s -X GET http://localhost:3000/api/v1/agents/status \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

# 4. Test without authentication (should fail)
echo "4. Testing without authentication (should fail with 401)..."
curl -s -X GET http://localhost:3000/api/v1/agents/status | jq
echo ""

# 5. Logout
echo "5. Logging out..."
curl -s -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

echo "✓ Test flow completed!"
```

---

## Role-Based Access Testing

### Test Admin Access
```bash
# Login as admin
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@barq.com","password":"Admin@123"}' | \
  jq -r '.data.token')

# Should succeed
curl -X GET http://localhost:3000/api/v1/agents/status \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Test Manager Access
```bash
# First register a manager (or login if exists)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@barq.com",
    "password": "Manager@123",
    "name": "Test Manager",
    "role": "manager"
  }'

# Login as manager
MANAGER_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@barq.com","password":"Manager@123"}' | \
  jq -r '.data.token')

# Should succeed (managers can access agent status)
curl -X GET http://localhost:3000/api/v1/agents/status \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```

### Test Dispatcher Access
```bash
# Register dispatcher
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dispatcher@barq.com",
    "password": "Dispatcher@123",
    "name": "Test Dispatcher",
    "role": "dispatcher"
  }'

# Login as dispatcher
DISPATCHER_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dispatcher@barq.com","password":"Dispatcher@123"}' | \
  jq -r '.data.token')

# Should fail with 403 (dispatchers cannot access agent status)
curl -X GET http://localhost:3000/api/v1/agents/status \
  -H "Authorization: Bearer $DISPATCHER_TOKEN"
```

---

## Error Responses Reference

### 400 - Bad Request
```json
{
  "success": false,
  "error": "Email and password are required"
}
```

### 401 - Unauthorized
```json
{
  "success": false,
  "error": "Authentication required"
}
```
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```
```json
{
  "success": false,
  "error": "Token expired"
}
```
```json
{
  "success": false,
  "error": "Invalid token"
}
```

### 403 - Forbidden
```json
{
  "success": false,
  "error": "Insufficient permissions"
}
```
```json
{
  "success": false,
  "error": "Account is disabled"
}
```

### 404 - Not Found
```json
{
  "success": false,
  "error": "User not found"
}
```

### 409 - Conflict
```json
{
  "success": false,
  "error": "User with this email already exists"
}
```

### 500 - Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error during login"
}
```

---

## Tips & Tricks

### Pretty Print JSON
```bash
# Add | jq to format JSON output
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Save Response to File
```bash
curl http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@barq.com","password":"Admin@123"}' \
  -o login-response.json
```

### View Response Headers
```bash
curl -i http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@barq.com","password":"Admin@123"}'
```

### Verbose Output (Debug)
```bash
curl -v http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@barq.com","password":"Admin@123"}'
```

### Test Multiple Endpoints in Sequence
```bash
# Create a test script
cat > test-auth.sh << 'EOF'
#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@barq.com","password":"Admin@123"}' | jq -r '.data.token')

endpoints=(
  "/api/v1/agents/status"
  "/api/v1/autonomous/health"
  "/api/v1/autonomous/dashboard"
)

for endpoint in "${endpoints[@]}"; do
  echo "Testing: $endpoint"
  curl -s http://localhost:3000$endpoint \
    -H "Authorization: Bearer $TOKEN" | jq '.success'
  echo ""
done
EOF

chmod +x test-auth.sh
./test-auth.sh
```

---

## Default Test Credentials

**Email:** admin@barq.com
**Password:** Admin@123
**Role:** super_admin

⚠️ **IMPORTANT:** Change this password in production!

---

**For automated testing, use:**
```bash
node test-frontend-auth-flow.js
```

**Or use the quick start script:**
```bash
./test-auth-quick-start.sh
```
