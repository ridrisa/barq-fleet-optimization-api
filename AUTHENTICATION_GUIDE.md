# Authentication & Authorization Guide

## Overview

The BARQ Fleet Management API uses **JWT (JSON Web Token)** based authentication with role-based access control (RBAC).

## Quick Start

### 1. Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@barq.com",
  "password": "Admin@123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@barq.com",
      "name": "System Administrator",
      "role": "super_admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h"
  }
}
```

### 2. Make Authenticated Request
```bash
GET /api/v1/agents/status
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Authentication Endpoints

### Login
**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "user": { "id", "email", "name", "role" },
    "token": "access_token",
    "refreshToken": "refresh_token",
    "expiresIn": "24h"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

**Status Codes:**
- `200` - Login successful
- `401` - Invalid credentials
- `403` - Account disabled

---

### Register
**Endpoint:** `POST /api/auth/register`

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "SecureP@ssw0rd",
  "name": "John Doe",
  "role": "customer"
}
```

**Roles:**
- `customer` (default)
- `driver`
- `dispatcher`
- `manager`
- `admin`
- `super_admin`

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "id", "email", "name", "role", "createdAt" },
    "token": "access_token",
    "refreshToken": "refresh_token",
    "expiresIn": "24h"
  }
}
```

**Status Codes:**
- `201` - Registration successful
- `409` - Email already exists
- `400` - Validation error

---

### Refresh Token
**Endpoint:** `POST /api/auth/refresh`

**Request:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

**Response:**
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

**Status Codes:**
- `200` - Token refreshed
- `401` - Invalid or expired refresh token

---

### Get Current User Profile
**Endpoint:** `GET /api/auth/me`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "admin",
      "permissions": ["orders.create", "orders.read", ...],
      "createdAt": "2025-01-01T00:00:00Z",
      "lastLogin": "2025-01-14T12:00:00Z",
      "active": true
    }
  }
}
```

---

### Logout
**Endpoint:** `POST /api/auth/logout`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### Change Password
**Endpoint:** `POST /api/auth/change-password`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "currentPassword": "OldP@ssw0rd",
  "newPassword": "NewP@ssw0rd123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

## Protected Endpoints

### Endpoints Requiring Authentication

The following endpoints return `401 Unauthorized` without a valid token:

#### Autonomous Operations
- `GET /api/v1/autonomous/health` - Admin, Manager only
- `GET /api/v1/autonomous/dashboard` - Admin, Manager only
- `GET /api/v1/autonomous/actions/recent` - Admin, Manager only
- `POST /api/v1/autonomous/execute` - Super Admin only
- `POST /api/v1/autonomous/enable` - Super Admin, Admin only

#### Agent Management
- `GET /api/v1/agents/status` - Admin, Manager only
- `GET /api/v1/agents/health` - Admin, Manager only
- `POST /api/v1/agents/trigger` - Admin, Manager only
- `POST /api/v1/agents/initialize` - Super Admin only

#### Fleet Operations
- `GET /api/v1/agents/fleet/status` - Admin, Manager, Dispatcher
- `POST /api/v1/agents/fleet/rebalance` - Admin, Manager only

#### Analytics
- `GET /api/v1/agents/performance/analytics` - Admin, Manager only
- `GET /api/v1/agents/demand/forecast` - Admin, Manager only

---

## Roles & Permissions

### Role Hierarchy (highest to lowest)
1. **super_admin** - Full system access
2. **admin** - Administrative access
3. **manager** - Management and analytics access
4. **dispatcher** - Order assignment and fleet management
5. **driver** - View assigned orders
6. **customer** - Create and view own orders

### Role Permissions Matrix

| Permission | Super Admin | Admin | Manager | Dispatcher | Driver | Customer |
|-----------|------------|-------|---------|-----------|--------|----------|
| Manage System | ✓ | | | | | |
| Manage Agents | ✓ | | | | | |
| View Analytics | ✓ | ✓ | ✓ | | | |
| Manage Fleet | ✓ | ✓ | | | | |
| Assign Orders | ✓ | ✓ | ✓ | ✓ | | |
| Create Orders | ✓ | ✓ | ✓ | ✓ | | ✓ |
| View Orders | ✓ | ✓ | ✓ | ✓ | ✓ (own) | ✓ (own) |

---

## Frontend Integration

### React/Next.js Example

#### 1. Authentication Context
```javascript
// contexts/AuthContext.js
import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load token from storage on mount
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setToken(storedToken);
      loadUserProfile(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const loadUserProfile = async (token) => {
    try {
      const response = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data.data.user);
    } catch (error) {
      // Token invalid, clear it
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post('/api/auth/login', {
      email,
      password
    });

    const { token, refreshToken, user } = response.data.data;

    localStorage.setItem('authToken', token);
    localStorage.setItem('refreshToken', refreshToken);

    setToken(token);
    setUser(user);

    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

#### 2. Axios Interceptor
```javascript
// lib/axios.js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
});

// Request interceptor - Add token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle token expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Token expired, try to refresh
    if (error.response?.status === 401 &&
        error.response?.data?.error === 'Token expired' &&
        !originalRequest._retry) {

      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post('/api/auth/refresh', {
          refreshToken
        });

        const { token, refreshToken: newRefreshToken } = response.data.data;

        localStorage.setItem('authToken', token);
        localStorage.setItem('refreshToken', newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

#### 3. Protected Route Component
```javascript
// components/ProtectedRoute.js
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export function ProtectedRoute({ children, requiredRole }) {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!token) {
        router.push('/login');
      } else if (requiredRole && !checkRole(user.role, requiredRole)) {
        router.push('/unauthorized');
      }
    }
  }, [loading, token, user, requiredRole, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!token) {
    return null;
  }

  if (requiredRole && !checkRole(user.role, requiredRole)) {
    return null;
  }

  return children;
}

function checkRole(userRole, requiredRole) {
  const roleHierarchy = {
    super_admin: 7,
    admin: 6,
    manager: 5,
    dispatcher: 4,
    driver: 3,
    customer: 2,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}
```

#### 4. Login Page
```javascript
// pages/login.js
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      {error && <div className="error">{error}</div>}
      <button type="submit">Login</button>
    </form>
  );
}
```

#### 5. Protected Page
```javascript
// pages/dashboard.js
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/axios';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const { user } = useAuth();
  const [agentStatus, setAgentStatus] = useState(null);

  useEffect(() => {
    loadAgentStatus();
  }, []);

  const loadAgentStatus = async () => {
    try {
      const response = await api.get('/api/v1/agents/status');
      setAgentStatus(response.data);
    } catch (error) {
      console.error('Failed to load agent status', error);
    }
  };

  return (
    <ProtectedRoute requiredRole="manager">
      <div>
        <h1>Welcome, {user.name}</h1>
        <p>Role: {user.role}</p>
        {agentStatus && (
          <pre>{JSON.stringify(agentStatus, null, 2)}</pre>
        )}
      </div>
    </ProtectedRoute>
  );
}
```

---

## Security Best Practices

### 1. Token Storage
- **Never** store tokens in cookies without `httpOnly` flag
- Use `httpOnly` cookies for refresh tokens (backend sets this)
- Store access tokens in memory or sessionStorage
- Clear tokens on logout

### 2. HTTPS Only
- Always use HTTPS in production
- Tokens sent over HTTP can be intercepted

### 3. Token Expiration
- Access tokens expire after 24 hours
- Refresh tokens expire after 7 days
- Implement automatic token refresh

### 4. Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### 5. Rate Limiting
- Login attempts are rate-limited
- Implement exponential backoff on failed attempts

### 6. CORS Configuration
```javascript
// Backend CORS config (already configured)
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

## Error Handling

### Common Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "Authentication required"
}
```
**Action:** Redirect to login page

#### 401 Token Expired
```json
{
  "success": false,
  "error": "Token expired"
}
```
**Action:** Attempt token refresh

#### 403 Forbidden
```json
{
  "success": false,
  "error": "Insufficient permissions"
}
```
**Action:** Show access denied message

#### 409 Conflict
```json
{
  "success": false,
  "error": "User with this email already exists"
}
```
**Action:** Show user already exists message

---

## Testing

### Test Script
```bash
# Run the comprehensive authentication test
node test-frontend-auth-flow.js
```

### Manual Testing with curl

#### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@barq.com","password":"Admin@123"}'
```

#### Access Protected Endpoint
```bash
TOKEN="your_token_here"
curl -X GET http://localhost:3000/api/v1/agents/status \
  -H "Authorization: Bearer $TOKEN"
```

#### Get User Profile
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## Default Test Credentials

**Email:** `admin@barq.com`
**Password:** `Admin@123`
**Role:** `super_admin`

⚠️ **IMPORTANT:** Change this password in production!

---

## Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# CORS
FRONTEND_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/barq
```

---

## Troubleshooting

### Token Not Working
1. Check token format: `Bearer <token>`
2. Verify token hasn't expired
3. Check token is being sent in Authorization header
4. Verify JWT_SECRET matches between backend instances

### CORS Issues
1. Add frontend URL to CORS whitelist
2. Include credentials: true in fetch/axios
3. Check preflight OPTIONS requests succeed

### Role Access Denied
1. Verify user role in database
2. Check endpoint permission requirements
3. Ensure user is active in database

---

## Support

For issues or questions:
- Check logs: `backend/logs/`
- Review test results: `node test-frontend-auth-flow.js`
- API Documentation: `/api-docs` (Swagger)

---

**Last Updated:** 2025-01-14
**Version:** 1.0
**Maintainer:** BARQ Development Team
