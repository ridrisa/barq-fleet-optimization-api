/**
 * Comprehensive Load Testing Suite using k6
 * Tests system performance under various load conditions
 *
 * Install k6: brew install k6 (macOS) or https://k6.io/docs/getting-started/installation/
 * Run: k6 run load-testing/k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const optimizationDuration = new Trend('optimization_duration');
const requestsPerSecond = new Counter('requests_per_second');

// Test configuration
export const options = {
  stages: [
    // Ramp-up: 0 to 100 users over 2 minutes
    { duration: '2m', target: 100 },
    // Stay at 100 users for 5 minutes
    { duration: '5m', target: 100 },
    // Ramp-up: 100 to 500 users over 3 minutes
    { duration: '3m', target: 500 },
    // Stay at 500 users for 5 minutes (stress test)
    { duration: '5m', target: 500 },
    // Spike test: 500 to 1000 users over 1 minute
    { duration: '1m', target: 1000 },
    // Stay at 1000 users for 3 minutes
    { duration: '3m', target: 1000 },
    // Ramp-down: 1000 to 0 over 2 minutes
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    // 99% of requests must complete within 3000ms
    http_req_duration: ['p(99)<3000'],
    // Error rate must be below 1%
    errors: ['rate<0.01'],
    // 95% of requests must complete within 1000ms
    'http_req_duration{scenario:optimization}': ['p(95)<1000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3003';

// Sample optimization request
const optimizationRequest = {
  serviceType: 'BARQ',
  pickupPoints: [
    {
      id: 'P1',
      lat: 24.7136,
      lng: 46.6753,
      name: 'Riyadh Warehouse',
      address: 'Riyadh, Saudi Arabia',
    },
  ],
  deliveryPoints: [
    {
      order_id: `D${__VU}-${__ITER}`,
      lat: 24.7236 + (Math.random() * 0.1),
      lng: 46.6853 + (Math.random() * 0.1),
      name: `Customer ${__VU}-${__ITER}`,
      address: 'Delivery Location, Riyadh',
      load_kg: 5,
    },
    {
      order_id: `D${__VU}-${__ITER}-2`,
      lat: 24.7336 + (Math.random() * 0.1),
      lng: 46.6953 + (Math.random() * 0.1),
      name: `Customer ${__VU}-${__ITER}-2`,
      address: 'Delivery Location 2, Riyadh',
      load_kg: 8,
    },
  ],
  fleet: {
    vehicles: [
      {
        fleet_id: `V${__VU}`,
        vehicle_type: 'TRUCK',
        capacity_kg: 30,
      },
    ],
  },
};

export default function () {
  group('Health Check', function () {
    const healthRes = http.get(`${BASE_URL}/api/v1/health`);
    check(healthRes, {
      'health check status is 200': (r) => r.status === 200,
      'health check returns healthy': (r) => {
        const body = JSON.parse(r.body);
        return body.status === 'healthy';
      },
    });
    errorRate.add(healthRes.status !== 200);
  });

  sleep(1);

  group('Route Optimization', function () {
    const startTime = Date.now();

    const optimizeRes = http.post(
      `${BASE_URL}/api/v1/optimize`,
      JSON.stringify(optimizationRequest),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { scenario: 'optimization' },
      }
    );

    const duration = Date.now() - startTime;
    optimizationDuration.add(duration);
    requestsPerSecond.add(1);

    check(optimizeRes, {
      'optimization status is 200': (r) => r.status === 200,
      'optimization returns success': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true;
        } catch {
          return false;
        }
      },
      'optimization has routes': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && body.data.routes && body.data.routes.length > 0;
        } catch {
          return false;
        }
      },
      'optimization completes in <5s': (r) => duration < 5000,
    });

    errorRate.add(optimizeRes.status !== 200);
  });

  sleep(2);

  group('CVRP Optimization (Large Batch)', function () {
    // Create large batch request
    const largeBatchRequest = {
      serviceType: 'BULLET',
      pickupPoints: [
        {
          id: 'P1',
          lat: 24.7136,
          lng: 46.6753,
          name: 'Warehouse',
          address: 'Riyadh',
        },
      ],
      deliveryPoints: [],
      fleet: {
        vehicles: [
          { fleet_id: 'V1', vehicle_type: 'TRUCK', capacity_kg: 50 },
          { fleet_id: 'V2', vehicle_type: 'TRUCK', capacity_kg: 50 },
        ],
      },
    };

    // Generate 12 delivery points (triggers CVRP)
    for (let i = 0; i < 12; i++) {
      largeBatchRequest.deliveryPoints.push({
        order_id: `D${__VU}-${__ITER}-${i}`,
        lat: 24.7136 + (i * 0.01) + (Math.random() * 0.01),
        lng: 46.6753 + (i * 0.01) + (Math.random() * 0.01),
        name: `Customer ${i}`,
        address: `Location ${i}`,
        load_kg: 5,
      });
    }

    const cvrpRes = http.post(
      `${BASE_URL}/api/v1/optimize`,
      JSON.stringify(largeBatchRequest),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { scenario: 'cvrp' },
      }
    );

    check(cvrpRes, {
      'CVRP status is 200': (r) => r.status === 200,
      'CVRP returns success': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true;
        } catch {
          return false;
        }
      },
      'CVRP uses CVRP engine': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && body.data.optimizationEngine === 'CVRP';
        } catch {
          return false;
        }
      },
    });

    errorRate.add(cvrpRes.status !== 200);
  });

  sleep(1);

  group('Agent Status', function () {
    const agentRes = http.get(`${BASE_URL}/api/v1/agents/status`);
    check(agentRes, {
      'agent status is 200': (r) => r.status === 200,
    });
    errorRate.add(agentRes.status !== 200);
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    'load-test-summary.txt': textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const colors = options.enableColors !== false;

  const lines = [];
  lines.push(`${indent}Load Test Summary`);
  lines.push(`${indent}${'='.repeat(50)}`);
  lines.push('');
  lines.push(`${indent}Total Requests: ${data.metrics.http_reqs.values.count}`);
  lines.push(`${indent}Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)} req/s`);
  lines.push(`${indent}Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%`);
  lines.push('');
  lines.push(`${indent}HTTP Request Duration:`);
  lines.push(`${indent}  avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`);
  lines.push(`${indent}  min: ${data.metrics.http_req_duration.values.min.toFixed(2)}ms`);
  lines.push(`${indent}  med: ${data.metrics.http_req_duration.values.med.toFixed(2)}ms`);
  lines.push(`${indent}  max: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms`);
  lines.push(`${indent}  p(90): ${data.metrics.http_req_duration.values['p(90)'].toFixed(2)}ms`);
  lines.push(`${indent}  p(95): ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  lines.push(`${indent}  p(99): ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`);
  lines.push('');
  lines.push(`${indent}Virtual Users: ${data.metrics.vus.values.value}`);
  lines.push(`${indent}Test Duration: ${(data.state.testRunDurationMs / 1000).toFixed(2)}s`);

  return lines.join('\n');
}
