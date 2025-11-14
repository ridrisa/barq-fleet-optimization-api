/**
 * Frontend Authentication Flow Test Script
 *
 * Tests the complete authentication flow for the BARQ Fleet Management API
 * Demonstrates how the frontend should authenticate and access protected endpoints
 *
 * Usage: node test-frontend-auth-flow.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const API_V1 = `${BASE_URL}/api/v1`;
const API_AUTH = `${BASE_URL}/api/auth`;

// ANSI colors for better output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

// Test credentials from migration
const TEST_USERS = {
  admin: {
    email: 'admin@barq.com',
    password: 'Admin@123', // Default password from migration
    expectedRole: 'super_admin',
  },
  // Additional test users for registration
  manager: {
    email: 'manager@barq.com',
    password: 'Manager@123',
    name: 'Test Manager',
    role: 'manager',
  },
  dispatcher: {
    email: 'dispatcher@barq.com',
    password: 'Dispatcher@123',
    name: 'Test Dispatcher',
    role: 'dispatcher',
  },
};

// Store tokens
let authTokens = {};

/**
 * Log with color
 */
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Log section header
 */
function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(`  ${title}`, 'bold');
  console.log('='.repeat(80) + '\n');
}

/**
 * Log test result
 */
function logResult(testName, passed, details = '') {
  const symbol = passed ? '✓' : '✗';
  const color = passed ? 'green' : 'red';
  log(`${symbol} ${testName}`, color);
  if (details) {
    console.log(`  ${details}\n`);
  }
}

/**
 * Test 1: Login with existing admin user
 */
async function testLogin() {
  logSection('TEST 1: Login with Admin User');

  try {
    const response = await axios.post(`${API_AUTH}/login`, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    if (response.data.success && response.data.data.token) {
      authTokens.admin = response.data.data.token;
      const user = response.data.data.user;

      logResult('Login successful', true,
        `User: ${user.name} (${user.email})\n` +
        `  Role: ${user.role}\n` +
        `  Token: ${authTokens.admin.substring(0, 30)}...`
      );

      return { success: true, user, token: authTokens.admin };
    } else {
      logResult('Login failed', false, 'No token received');
      return { success: false };
    }
  } catch (error) {
    logResult('Login failed', false,
      error.response?.data?.error || error.message
    );
    return { success: false };
  }
}

/**
 * Test 2: Register new users
 */
async function testRegister() {
  logSection('TEST 2: Register New Users');

  const results = [];

  for (const [role, userData] of Object.entries(TEST_USERS)) {
    if (role === 'admin') continue; // Skip admin, already exists

    try {
      const response = await axios.post(`${API_AUTH}/register`, {
        email: userData.email,
        password: userData.password,
        name: userData.name,
        role: userData.role,
      });

      if (response.data.success) {
        authTokens[role] = response.data.data.token;
        logResult(`Register ${role}`, true,
          `User: ${response.data.data.user.name}\n` +
          `  Email: ${userData.email}\n` +
          `  Role: ${userData.role}`
        );
        results.push({ role, success: true });
      }
    } catch (error) {
      if (error.response?.status === 409) {
        // User already exists, try to login
        logResult(`Register ${role}`, true, 'User already exists (409)');
        try {
          const loginResponse = await axios.post(`${API_AUTH}/login`, {
            email: userData.email,
            password: userData.password,
          });
          authTokens[role] = loginResponse.data.data.token;
          results.push({ role, success: true, existing: true });
        } catch (loginError) {
          logResult(`Login ${role}`, false, loginError.response?.data?.error || loginError.message);
          results.push({ role, success: false });
        }
      } else {
        logResult(`Register ${role}`, false, error.response?.data?.error || error.message);
        results.push({ role, success: false });
      }
    }
  }

  return results;
}

/**
 * Test 3: Access protected endpoints WITHOUT token (should fail with 401)
 */
async function testWithoutAuth() {
  logSection('TEST 3: Access Protected Endpoints WITHOUT Token (Expected: 401)');

  const endpoints = [
    { method: 'get', url: `${API_V1}/autonomous/health`, name: 'Autonomous Health' },
    { method: 'get', url: `${API_V1}/autonomous/dashboard`, name: 'Autonomous Dashboard' },
    { method: 'get', url: `${API_V1}/autonomous/actions/recent`, name: 'Recent Actions' },
    { method: 'get', url: `${API_V1}/agents/status`, name: 'Agent Status' },
  ];

  const results = [];

  for (const endpoint of endpoints) {
    try {
      await axios[endpoint.method](endpoint.url);
      logResult(endpoint.name, false, 'Expected 401 but got success');
      results.push({ endpoint: endpoint.name, success: false, got401: false });
    } catch (error) {
      if (error.response?.status === 401) {
        logResult(endpoint.name, true, `Correctly returned 401: ${error.response.data.error}`);
        results.push({ endpoint: endpoint.name, success: true, got401: true });
      } else {
        logResult(endpoint.name, false,
          `Expected 401 but got ${error.response?.status}: ${error.response?.data?.error || error.message}`
        );
        results.push({ endpoint: endpoint.name, success: false, got401: false });
      }
    }
  }

  return results;
}

/**
 * Test 4: Access protected endpoints WITH valid token (should succeed)
 */
async function testWithAuth() {
  logSection('TEST 4: Access Protected Endpoints WITH Valid Token (Expected: 200)');

  if (!authTokens.admin) {
    log('⚠ No admin token available, skipping test', 'yellow');
    return [];
  }

  const endpoints = [
    { method: 'get', url: `${API_V1}/autonomous/health`, name: 'Autonomous Health', roles: ['admin', 'manager'] },
    { method: 'get', url: `${API_V1}/autonomous/dashboard`, name: 'Autonomous Dashboard', roles: ['admin', 'manager'] },
    { method: 'get', url: `${API_V1}/autonomous/actions/recent`, name: 'Recent Actions', roles: ['admin', 'manager'] },
    { method: 'get', url: `${API_V1}/agents/status`, name: 'Agent Status', roles: ['admin', 'manager'] },
  ];

  const results = [];

  for (const endpoint of endpoints) {
    try {
      const response = await axios[endpoint.method](endpoint.url, {
        headers: {
          'Authorization': `Bearer ${authTokens.admin}`,
        },
      });

      if (response.status === 200) {
        logResult(endpoint.name, true,
          `Status: ${response.status}\n` +
          `  Success: ${response.data.success}`
        );
        results.push({ endpoint: endpoint.name, success: true, status: 200 });
      }
    } catch (error) {
      logResult(endpoint.name, false,
        `Status: ${error.response?.status}\n` +
        `  Error: ${error.response?.data?.error || error.message}`
      );
      results.push({
        endpoint: endpoint.name,
        success: false,
        status: error.response?.status,
        error: error.response?.data?.error || error.message
      });
    }
  }

  return results;
}

/**
 * Test 5: Test role-based access control
 */
async function testRoleBasedAccess() {
  logSection('TEST 5: Role-Based Access Control');

  const tests = [
    {
      role: 'admin',
      endpoint: `${API_V1}/agents/status`,
      name: 'Admin accessing Agent Status',
      shouldPass: true,
    },
    {
      role: 'manager',
      endpoint: `${API_V1}/agents/status`,
      name: 'Manager accessing Agent Status',
      shouldPass: true,
    },
    {
      role: 'dispatcher',
      endpoint: `${API_V1}/agents/status`,
      name: 'Dispatcher accessing Agent Status (should fail)',
      shouldPass: false,
    },
  ];

  const results = [];

  for (const test of tests) {
    const token = authTokens[test.role];

    if (!token) {
      log(`⚠ No token for ${test.role}, skipping`, 'yellow');
      continue;
    }

    try {
      const response = await axios.get(test.endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const passed = test.shouldPass;
      logResult(test.name, passed,
        passed ? `Correctly allowed (${response.status})` : 'Should have been denied'
      );
      results.push({ test: test.name, success: passed, expectedPass: test.shouldPass, actualPass: true });
    } catch (error) {
      const passed = !test.shouldPass && error.response?.status === 403;
      logResult(test.name, passed,
        passed ? `Correctly denied (403)` : `Unexpected error: ${error.response?.status} - ${error.response?.data?.error}`
      );
      results.push({
        test: test.name,
        success: passed,
        expectedPass: test.shouldPass,
        actualPass: false,
        status: error.response?.status
      });
    }
  }

  return results;
}

/**
 * Test 6: Get user profile
 */
async function testGetProfile() {
  logSection('TEST 6: Get Current User Profile');

  if (!authTokens.admin) {
    log('⚠ No admin token available, skipping test', 'yellow');
    return { success: false };
  }

  try {
    const response = await axios.get(`${API_AUTH}/me`, {
      headers: {
        'Authorization': `Bearer ${authTokens.admin}`,
      },
    });

    if (response.data.success) {
      const user = response.data.data.user;
      logResult('Get Profile', true,
        `Name: ${user.name}\n` +
        `  Email: ${user.email}\n` +
        `  Role: ${user.role}\n` +
        `  Permissions: ${user.permissions.length} permissions`
      );
      return { success: true, user };
    }
  } catch (error) {
    logResult('Get Profile', false, error.response?.data?.error || error.message);
    return { success: false };
  }
}

/**
 * Test 7: Test token refresh
 */
async function testTokenRefresh() {
  logSection('TEST 7: Token Refresh');

  try {
    const loginResponse = await axios.post(`${API_AUTH}/login`, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    const refreshToken = loginResponse.data.data.refreshToken;

    const response = await axios.post(`${API_AUTH}/refresh`, {
      refreshToken,
    });

    if (response.data.success && response.data.data.token) {
      logResult('Token Refresh', true,
        `New Token: ${response.data.data.token.substring(0, 30)}...\n` +
        `  Expires In: ${response.data.data.expiresIn}`
      );
      return { success: true };
    }
  } catch (error) {
    logResult('Token Refresh', false, error.response?.data?.error || error.message);
    return { success: false };
  }
}

/**
 * Test 8: Test invalid token
 */
async function testInvalidToken() {
  logSection('TEST 8: Invalid Token Handling');

  const invalidToken = 'invalid.jwt.token.here';

  try {
    await axios.get(`${API_V1}/agents/status`, {
      headers: {
        'Authorization': `Bearer ${invalidToken}`,
      },
    });
    logResult('Invalid Token', false, 'Should have rejected invalid token');
    return { success: false };
  } catch (error) {
    if (error.response?.status === 401) {
      logResult('Invalid Token', true, `Correctly rejected: ${error.response.data.error}`);
      return { success: true };
    } else {
      logResult('Invalid Token', false, `Expected 401 but got ${error.response?.status}`);
      return { success: false };
    }
  }
}

/**
 * Generate frontend integration guide
 */
function generateFrontendGuide() {
  logSection('FRONTEND INTEGRATION GUIDE');

  console.log(`
${colors.cyan}1. LOGIN FLOW${colors.reset}
   ---------------------------------------------------------
   POST ${API_AUTH}/login
   Body: { email: "user@example.com", password: "password" }

   Response:
   {
     "success": true,
     "data": {
       "user": { "id", "email", "name", "role" },
       "token": "eyJhbGc...",  // Access token (24h)
       "refreshToken": "...",  // Refresh token (7d)
       "expiresIn": "24h"
     }
   }

${colors.cyan}2. STORE TOKENS${colors.reset}
   ---------------------------------------------------------
   // In your frontend app (React/Next.js):

   // Option 1: localStorage (simple but less secure)
   localStorage.setItem('authToken', response.data.token);
   localStorage.setItem('refreshToken', response.data.refreshToken);

   // Option 2: httpOnly cookies (more secure - set by backend)
   // Backend already sets refreshToken as httpOnly cookie
   // Just store access token in memory/context

   // Option 3: React Context + sessionStorage
   const AuthContext = React.createContext();
   sessionStorage.setItem('authToken', token);

${colors.cyan}3. MAKE AUTHENTICATED REQUESTS${colors.reset}
   ---------------------------------------------------------
   // Using fetch:
   const response = await fetch('${API_V1}/agents/status', {
     headers: {
       'Authorization': 'Bearer ' + authToken,
       'Content-Type': 'application/json'
     }
   });

   // Using axios:
   const axiosInstance = axios.create({
     baseURL: '${BASE_URL}',
     headers: {
       'Authorization': 'Bearer ' + authToken
     }
   });

   // Or with axios interceptor:
   axios.interceptors.request.use(config => {
     const token = localStorage.getItem('authToken');
     if (token) {
       config.headers.Authorization = 'Bearer ' + token;
     }
     return config;
   });

${colors.cyan}4. HANDLE TOKEN EXPIRATION${colors.reset}
   ---------------------------------------------------------
   // Setup axios response interceptor
   axios.interceptors.response.use(
     response => response,
     async error => {
       if (error.response?.status === 401 &&
           error.response?.data?.error === 'Token expired') {

         // Try to refresh token
         const refreshToken = localStorage.getItem('refreshToken');
         const response = await axios.post('${API_AUTH}/refresh', {
           refreshToken
         });

         // Store new tokens
         localStorage.setItem('authToken', response.data.data.token);
         localStorage.setItem('refreshToken', response.data.data.refreshToken);

         // Retry original request
         error.config.headers.Authorization = 'Bearer ' + response.data.data.token;
         return axios.request(error.config);
       }

       return Promise.reject(error);
     }
   );

${colors.cyan}5. PROTECTED ROUTE COMPONENT (React)${colors.reset}
   ---------------------------------------------------------
   function ProtectedRoute({ children, requiredRole }) {
     const { user, token } = useAuth();

     if (!token) {
       return <Navigate to="/login" />;
     }

     if (requiredRole && user.role !== requiredRole) {
       return <div>Access Denied</div>;
     }

     return children;
   }

   // Usage:
   <Route path="/dashboard" element={
     <ProtectedRoute requiredRole="admin">
       <Dashboard />
     </ProtectedRoute>
   } />

${colors.cyan}6. EXAMPLE: Next.js API Route${colors.reset}
   ---------------------------------------------------------
   // app/api/proxy/[...path]/route.ts
   export async function GET(request: Request) {
     const token = request.headers.get('authorization');

     const response = await fetch('${BASE_URL}/api/v1/...', {
       headers: {
         'Authorization': token,
       }
     });

     return response;
   }

${colors.cyan}7. LOGOUT${colors.reset}
   ---------------------------------------------------------
   POST ${API_AUTH}/logout
   Headers: { Authorization: "Bearer <token>" }

   // Clear stored tokens
   localStorage.removeItem('authToken');
   localStorage.removeItem('refreshToken');
   sessionStorage.clear();

${colors.cyan}8. USER ROLES & PERMISSIONS${colors.reset}
   ---------------------------------------------------------
   Roles (in order of access):
   - super_admin: Full system access
   - admin: Administrative access (most endpoints)
   - manager: Management access (dashboards, analytics)
   - dispatcher: Order assignment and fleet management
   - driver: View assigned orders only
   - customer: Create and view own orders

   Check user role before showing UI elements:
   {user.role === 'admin' && <AdminPanel />}
   {['admin', 'manager'].includes(user.role) && <Dashboard />}

${colors.cyan}9. ERROR HANDLING${colors.reset}
   ---------------------------------------------------------
   Common status codes:
   - 401: Not authenticated (missing/invalid token)
   - 403: Not authorized (insufficient permissions)
   - 404: Resource not found
   - 500: Server error

   Handle in your UI:
   if (error.response?.status === 401) {
     // Redirect to login
     navigate('/login');
   } else if (error.response?.status === 403) {
     // Show access denied message
     toast.error('You do not have permission to access this resource');
   }

${colors.cyan}10. SECURITY BEST PRACTICES${colors.reset}
   ---------------------------------------------------------
   ✓ Always use HTTPS in production
   ✓ Never log tokens to console in production
   ✓ Set token expiration handling
   ✓ Clear tokens on logout
   ✓ Use httpOnly cookies for refresh tokens
   ✓ Implement CSRF protection for cookies
   ✓ Add rate limiting to login attempts
   ✓ Use strong passwords (min 8 chars with validation)
  `);
}

/**
 * Generate test summary
 */
function generateSummary(results) {
  logSection('TEST SUMMARY');

  console.log(`
${colors.bold}Authentication Endpoints:${colors.reset}
  Login:          POST ${API_AUTH}/login
  Register:       POST ${API_AUTH}/register
  Refresh:        POST ${API_AUTH}/refresh
  Logout:         POST ${API_AUTH}/logout
  Get Profile:    GET  ${API_AUTH}/me
  Change Password: POST ${API_AUTH}/change-password

${colors.bold}Protected Endpoints (require authentication):${colors.reset}
  Autonomous Health:   GET ${API_V1}/autonomous/health (admin, manager)
  Autonomous Dashboard: GET ${API_V1}/autonomous/dashboard (admin, manager)
  Recent Actions:      GET ${API_V1}/autonomous/actions/recent (admin, manager)
  Agent Status:        GET ${API_V1}/agents/status (admin, manager)

${colors.bold}Authentication Method:${colors.reset}
  Type: JWT (JSON Web Token)
  Header: Authorization: Bearer <token>
  Token Lifetime: 24 hours
  Refresh Token: 7 days

${colors.bold}Default Test Credentials:${colors.reset}
  Email: admin@barq.com
  Password: Admin@123
  Role: super_admin

${colors.yellow}⚠ IMPORTANT: Change default password in production!${colors.reset}
  `);
}

/**
 * Main test execution
 */
async function runAllTests() {
  console.clear();
  log('\n🔐 FRONTEND AUTHENTICATION FLOW TEST\n', 'bold');
  log(`Testing API at: ${BASE_URL}`, 'cyan');
  log(`Start Time: ${new Date().toISOString()}\n`, 'cyan');

  const results = {};

  try {
    // Run all tests
    results.login = await testLogin();
    results.register = await testRegister();
    results.withoutAuth = await testWithoutAuth();
    results.withAuth = await testWithAuth();
    results.roleAccess = await testRoleBasedAccess();
    results.profile = await testGetProfile();
    results.refresh = await testTokenRefresh();
    results.invalidToken = await testInvalidToken();

    // Generate guides
    generateFrontendGuide();
    generateSummary(results);

    // Overall status
    logSection('OVERALL STATUS');

    const allPassed = results.login.success &&
                     results.withoutAuth.every(r => r.got401) &&
                     results.withAuth.every(r => r.success);

    if (allPassed) {
      log('✓ All critical tests passed!', 'green');
      log('\n✓ Authentication system is working correctly', 'green');
      log('✓ Frontend can now integrate using the guide above', 'green');
    } else {
      log('✗ Some tests failed - review errors above', 'red');
      log('⚠ Fix issues before integrating with frontend', 'yellow');
    }

    // Save tokens for frontend testing
    if (authTokens.admin) {
      console.log(`\n${colors.cyan}Test Token (valid for 24h):${colors.reset}`);
      console.log(authTokens.admin);
      console.log('\nYou can use this token to test frontend integration:');
      console.log(`curl -H "Authorization: Bearer ${authTokens.admin}" ${API_V1}/agents/status`);
    }

  } catch (error) {
    log('\n✗ Test execution failed', 'red');
    console.error(error);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testLogin,
  testWithAuth,
  testWithoutAuth,
  BASE_URL,
  API_V1,
  API_AUTH,
};
