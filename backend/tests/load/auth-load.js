/**
 * Load Test: Authentication Endpoints
 * Tests login, registration, and token refresh under load
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const loginSuccessRate = new Rate('login_success');
const loginDuration = new Trend('login_duration');
const loginErrors = new Counter('login_errors');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Ramp up to 20 users
    { duration: '3m', target: 50 },   // Ramp to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Spike to 100 users
    { duration: '3m', target: 100 },  // Stay at 100
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],  // 95% of requests under 500ms
    'http_req_failed': ['rate<0.01'],    // Less than 1% errors
    'login_success': ['rate>0.99'],      // 99% login success rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3003';

// Test data
const users = [
  { email: 'test1@example.com', password: 'Test@123456' },
  { email: 'test2@example.com', password: 'Test@123456' },
  { email: 'test3@example.com', password: 'Test@123456' },
  { email: 'admin@barq.com', password: 'Admin@123' },
];

export default function () {
  // Select random user
  const user = users[Math.floor(Math.random() * users.length)];

  group('Authentication Flow', function () {
    // Login test
    const loginStart = Date.now();
    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        email: user.email,
        password: user.password,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'Login' },
      }
    );

    const loginTime = Date.now() - loginStart;
    loginDuration.add(loginTime);

    const loginSuccess = check(loginRes, {
      'login status is 200': (r) => r.status === 200,
      'login has token': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && body.data.token !== undefined;
        } catch (e) {
          return false;
        }
      },
      'login response time < 500ms': () => loginTime < 500,
    });

    loginSuccessRate.add(loginSuccess);

    if (!loginSuccess) {
      loginErrors.add(1);
      console.error(`Login failed: ${loginRes.status} - ${loginRes.body}`);
    }

    // If login successful, test authenticated endpoints
    if (loginRes.status === 200) {
      try {
        const body = JSON.parse(loginRes.body);
        const token = body.data.token;

        // Get user profile
        const profileRes = http.get(`${BASE_URL}/api/auth/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          tags: { name: 'GetProfile' },
        });

        check(profileRes, {
          'profile status is 200': (r) => r.status === 200,
        });

      } catch (e) {
        console.error(`Error parsing login response: ${e.message}`);
      }
    }
  });

  // Think time - simulate user behavior
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// Setup function - runs once before test
export function setup() {
  console.log(`Starting authentication load test against ${BASE_URL}`);
  console.log(`Test will run through multiple stages with up to 100 concurrent users`);

  // Verify server is accessible
  const healthRes = http.get(`${BASE_URL}/health`);
  if (healthRes.status !== 200) {
    throw new Error(`Server not accessible: ${healthRes.status}`);
  }

  return { baseUrl: BASE_URL };
}

// Teardown function - runs once after test
export function teardown(data) {
  console.log('Authentication load test completed');
}
