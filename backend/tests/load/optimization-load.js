/**
 * Load Test: Route Optimization Endpoint
 * Tests the core optimization functionality under realistic load
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics
const optimizationSuccessRate = new Rate('optimization_success');
const optimizationDuration = new Trend('optimization_duration');
const optimizationErrors = new Counter('optimization_errors');
const activeOptimizations = new Gauge('active_optimizations');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Warm up with 10 users
    { duration: '3m', target: 20 },   // Increase to 20 users
    { duration: '5m', target: 50 },   // Peak at 50 concurrent optimizations
    { duration: '3m', target: 75 },   // Stress test with 75 users
    { duration: '2m', target: 100 },  // Maximum load
    { duration: '3m', target: 50 },   // Step down
    { duration: '2m', target: 0 },    // Cool down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<3000'],  // 95% under 3 seconds
    'http_req_failed': ['rate<0.05'],     // Less than 5% errors
    'optimization_success': ['rate>0.95'], // 95% success rate
    'optimization_duration': ['p(95)<5000'], // 95% complete in 5 seconds
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3003';

let authToken = null;

// Login and get token
export function setup() {
  console.log(`Starting optimization load test against ${BASE_URL}`);

  // Login to get auth token
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

  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${loginRes.status} - ${loginRes.body}`);
  }

  const body = JSON.parse(loginRes.body);
  authToken = body.data.token;

  console.log('Authentication successful');

  return { authToken };
}

// Generate realistic optimization request
function generateOptimizationRequest(complexity = 'medium') {
  const complexityLevels = {
    simple: { deliveries: 5, vehicles: 1 },
    medium: { deliveries: 15, vehicles: 3 },
    complex: { deliveries: 30, vehicles: 5 },
    veryComplex: { deliveries: 50, vehicles: 8 },
  };

  const config = complexityLevels[complexity] || complexityLevels.medium;

  // Riyadh coordinates (realistic)
  const baseLatitude = 24.7136;
  const baseLongitude = 46.6753;

  // Generate pickup points
  const pickupPoints = [
    {
      id: `pickup-${Date.now()}`,
      lat: baseLatitude + (Math.random() * 0.01 - 0.005),
      lng: baseLongitude + (Math.random() * 0.01 - 0.005),
      name: 'Central Warehouse',
    },
  ];

  // Generate delivery points
  const deliveryPoints = [];
  for (let i = 0; i < config.deliveries; i++) {
    deliveryPoints.push({
      order_id: `ORDER-${Date.now()}-${i}-${__VU}`,
      lat: baseLatitude + (Math.random() * 0.1 - 0.05),
      lng: baseLongitude + (Math.random() * 0.1 - 0.05),
      customer_name: `Customer ${i + 1}`,
      address: `Address ${i + 1}, Riyadh`,
      load_kg: Math.floor(Math.random() * 100) + 10,
      priority: Math.random() > 0.7 ? 'high' : 'normal',
      time_window_start: '09:00',
      time_window_end: '18:00',
    });
  }

  // Generate fleet
  const vehicleTypes = ['VAN', 'TRUCK', 'BIKE'];
  const fleet = [];
  for (let i = 0; i < config.vehicles; i++) {
    const vehicleType = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
    fleet.push({
      fleet_id: `VEHICLE-${i + 1}-${__VU}`,
      vehicle_type: vehicleType,
      capacity_kg: vehicleType === 'TRUCK' ? 3000 : vehicleType === 'VAN' ? 1000 : 50,
      current_latitude: baseLatitude + (Math.random() * 0.05 - 0.025),
      current_longitude: baseLongitude + (Math.random() * 0.05 - 0.025),
      available: true,
    });
  }

  return {
    pickupPoints,
    deliveryPoints,
    fleet,
    optimization_options: {
      minimize: 'total_distance',
      consider_traffic: Math.random() > 0.5,
      consider_priority: true,
    },
  };
}

export default function (data) {
  activeOptimizations.add(1);

  group('Route Optimization', function () {
    // Vary complexity - 60% medium, 25% simple, 10% complex, 5% very complex
    const rand = Math.random();
    let complexity;
    if (rand < 0.25) complexity = 'simple';
    else if (rand < 0.85) complexity = 'medium';
    else if (rand < 0.95) complexity = 'complex';
    else complexity = 'veryComplex';

    const payload = generateOptimizationRequest(complexity);

    const optimizationStart = Date.now();
    const optimizationRes = http.post(
      `${BASE_URL}/api/optimize`,
      JSON.stringify(payload),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.authToken}`,
        },
        tags: {
          name: 'Optimize',
          complexity: complexity,
        },
        timeout: '60s', // Allow up to 60 seconds for complex optimizations
      }
    );

    const optimizationTime = Date.now() - optimizationStart;
    optimizationDuration.add(optimizationTime);

    const optimizationSuccess = check(optimizationRes, {
      'optimization status is 200': (r) => r.status === 200,
      'optimization has requestId': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && body.data.requestId !== undefined;
        } catch (e) {
          return false;
        }
      },
      'optimization has routes': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && Array.isArray(body.data.routes);
        } catch (e) {
          return false;
        }
      },
      'optimization response time acceptable': () => optimizationTime < 10000, // 10 seconds
    });

    optimizationSuccessRate.add(optimizationSuccess);

    if (!optimizationSuccess) {
      optimizationErrors.add(1);
      console.error(
        `Optimization failed (${complexity}): ${optimizationRes.status} - Response time: ${optimizationTime}ms`
      );

      if (optimizationRes.status >= 400) {
        console.error(`Error body: ${optimizationRes.body.substring(0, 200)}`);
      }
    } else {
      console.log(
        `Optimization success (${complexity}): ${optimizationTime}ms - ` +
        `${payload.deliveryPoints.length} deliveries, ${payload.fleet.length} vehicles`
      );
    }
  });

  activeOptimizations.add(-1);

  // Think time - realistic pause between requests
  // More complex requests have longer think times
  const thinkTime = Math.random() * 3 + 2; // 2-5 seconds
  sleep(thinkTime);
}

export function teardown(data) {
  console.log('Optimization load test completed');
}
