/**
 * Load Test: Mixed Workload
 * Simulates realistic usage with multiple endpoint types
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const endpointSuccessRate = new Rate('endpoint_success');
const endpointDuration = new Trend('endpoint_duration');

// Test configuration - realistic production simulation
export const options = {
  stages: [
    { duration: '3m', target: 25 },   // Normal load
    { duration: '5m', target: 50 },   // Business hours
    { duration: '5m', target: 100 },  // Peak hours
    { duration: '3m', target: 150 },  // Spike (e.g., morning rush)
    { duration: '5m', target: 75 },   // Post-spike
    { duration: '3m', target: 50 },   // Normal evening
    { duration: '2m', target: 0 },    // End of day
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // 95% under 1 second
    'http_req_failed': ['rate<0.02'],    // Less than 2% errors
    'endpoint_success': ['rate>0.98'],   // 98% success rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3003';

// User scenarios with different weights
const scenarios = [
  { name: 'health_check', weight: 20 },
  { name: 'authentication', weight: 15 },
  { name: 'optimization', weight: 40 },
  { name: 'agent_query', weight: 15 },
  { name: 'status_check', weight: 10 },
];

let authToken = null;

export function setup() {
  console.log('Starting mixed workload test');

  // Login to get token
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: 'admin@barq.com',
      password: 'Admin@123',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    authToken = body.data.token;
  }

  return { authToken };
}

function selectScenario() {
  const totalWeight = scenarios.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.random() * totalWeight;

  for (const scenario of scenarios) {
    random -= scenario.weight;
    if (random <= 0) {
      return scenario.name;
    }
  }

  return scenarios[0].name;
}

export default function (data) {
  const scenario = selectScenario();

  switch (scenario) {
    case 'health_check':
      healthCheck();
      break;
    case 'authentication':
      authenticationFlow();
      break;
    case 'optimization':
      optimizationRequest(data);
      break;
    case 'agent_query':
      agentQuery(data);
      break;
    case 'status_check':
      statusCheck(data);
      break;
  }

  sleep(Math.random() * 2 + 0.5); // 0.5-2.5 seconds
}

function healthCheck() {
  group('Health Check', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/health`, {
      tags: { endpoint: 'health' },
    });

    const duration = Date.now() - start;
    endpointDuration.add(duration, { endpoint: 'health' });

    const success = check(res, {
      'health status is 200': (r) => r.status === 200,
      'health has status field': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.status === 'up';
        } catch (e) {
          return false;
        }
      },
    });

    endpointSuccessRate.add(success);
  });
}

function authenticationFlow() {
  group('Authentication', function () {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        email: 'test@example.com',
        password: 'Test@123456',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { endpoint: 'auth' },
      }
    );

    const duration = Date.now() - start;
    endpointDuration.add(duration, { endpoint: 'auth' });

    const success = check(res, {
      'auth status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    });

    endpointSuccessRate.add(success);
  });
}

function optimizationRequest(data) {
  if (!data.authToken) return;

  group('Optimization Request', function () {
    const payload = {
      pickupPoints: [
        { id: 'pickup-1', lat: 24.7136, lng: 46.6753, name: 'Warehouse' },
      ],
      deliveryPoints: Array.from({ length: 10 }, (_, i) => ({
        order_id: `ORDER-${Date.now()}-${i}`,
        lat: 24.7136 + (Math.random() * 0.05 - 0.025),
        lng: 46.6753 + (Math.random() * 0.05 - 0.025),
        customer_name: `Customer ${i + 1}`,
        load_kg: Math.floor(Math.random() * 50) + 10,
      })),
      fleet: [
        {
          fleet_id: 'TRUCK-001',
          vehicle_type: 'TRUCK',
          capacity_kg: 3000,
          current_latitude: 24.7136,
          current_longitude: 46.6753,
        },
      ],
    };

    const start = Date.now();
    const res = http.post(`${BASE_URL}/api/optimize`, JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.authToken}`,
      },
      tags: { endpoint: 'optimize' },
      timeout: '30s',
    });

    const duration = Date.now() - start;
    endpointDuration.add(duration, { endpoint: 'optimize' });

    const success = check(res, {
      'optimize status is 200': (r) => r.status === 200,
    });

    endpointSuccessRate.add(success);
  });
}

function agentQuery(data) {
  if (!data.authToken) return;

  group('Agent Query', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/agents/status`, {
      headers: {
        'Authorization': `Bearer ${data.authToken}`,
      },
      tags: { endpoint: 'agents' },
    });

    const duration = Date.now() - start;
    endpointDuration.add(duration, { endpoint: 'agents' });

    const success = check(res, {
      'agents status is 200': (r) => r.status === 200,
    });

    endpointSuccessRate.add(success);
  });
}

function statusCheck(data) {
  if (!data.authToken) return;

  group('Status Check', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/health/detailed`, {
      headers: {
        'Authorization': `Bearer ${data.authToken}`,
      },
      tags: { endpoint: 'status' },
    });

    const duration = Date.now() - start;
    endpointDuration.add(duration, { endpoint: 'status' });

    const success = check(res, {
      'status code is 200 or 404': (r) => r.status === 200 || r.status === 404,
    });

    endpointSuccessRate.add(success);
  });
}

export function teardown(data) {
  console.log('Mixed workload test completed');
}
