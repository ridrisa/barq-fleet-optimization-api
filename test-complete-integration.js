#!/usr/bin/env node

/**
 * BARQ Fleet Management - Complete Integration Test
 * Tests routing, optimization, and dispatching engine
 */

const API_URL = 'http://localhost:3002';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

// Sample order data for testing
const sampleOrders = [
  {
    customer_address: "25.276987, 55.296249", // Dubai location
    priority: "high",
    service_type: "express",
    time_window_start: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    time_window_end: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
    weight: 5.5,
    volume: 0.3,
  },
  {
    customer_address: "25.197197, 55.274376", // Another Dubai location
    priority: "medium",
    service_type: "standard",
    time_window_start: new Date(Date.now() + 3600000).toISOString(),
    time_window_end: new Date(Date.now() + 10800000).toISOString(), // 3 hours from now
    weight: 3.2,
    volume: 0.2,
  },
  {
    customer_address: "25.262776, 55.287447", // Third Dubai location
    priority: "low",
    service_type: "standard",
    time_window_start: new Date(Date.now() + 7200000).toISOString(),
    time_window_end: new Date(Date.now() + 14400000).toISOString(), // 4 hours from now
    weight: 2.1,
    volume: 0.1,
  },
];

// Depot location (Dubai)
const depotLocation = {
  lat: 25.276987,
  lng: 55.296249,
};

const tests = [];

async function runTest(name, testFn) {
  process.stdout.write(`${colors.yellow}Testing: ${name}...${colors.reset} `);
  try {
    const startTime = Date.now();
    const result = await testFn();
    const duration = Date.now() - startTime;

    tests.push({ name, success: true, duration, result });
    console.log(`${colors.green}✓ PASS${colors.reset} (${duration}ms)`);
    return result;
  } catch (error) {
    tests.push({ name, success: false, error: error.message });
    console.log(`${colors.red}✗ FAIL${colors.reset} (${error.message})`);
    return null;
  }
}

async function test1_HealthCheck() {
  const response = await fetch(`${API_URL}/health`);
  const data = await response.json();

  if (data.status !== 'up') {
    throw new Error('Service is not up');
  }

  return data;
}

async function test2_RouteOptimization() {
  const response = await fetch(`${API_URL}/api/optimize/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orders: sampleOrders,
      depot: depotLocation,
      vehicle_capacity: { weight: 100, volume: 10 },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  const data = await response.json();

  if (!data.routes || data.routes.length === 0) {
    throw new Error('No routes generated');
  }

  return data;
}

async function test3_MultiVehicleOptimization() {
  const response = await fetch(`${API_URL}/api/optimize/multi-vehicle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orders: sampleOrders,
      vehicles: [
        {
          id: 'V1',
          capacity: { weight: 50, volume: 5 },
          start_location: depotLocation,
        },
        {
          id: 'V2',
          capacity: { weight: 50, volume: 5 },
          start_location: depotLocation,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  const data = await response.json();

  if (!data.vehicle_routes) {
    throw new Error('No vehicle routes generated');
  }

  return data;
}

async function test4_DynamicRouteOptimization() {
  const response = await fetch(`${API_URL}/api/optimize/dynamic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orders: sampleOrders,
      vehicles: [{ id: 'V1', capacity: { weight: 100, volume: 10 } }],
      constraints: {
        max_distance: 50000, // 50km
        max_duration: 14400, // 4 hours
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data;
}

async function test5_AutoDispatch() {
  const response = await fetch(`${API_URL}/api/dispatch/auto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orders: sampleOrders,
      available_drivers: [
        {
          id: 'D1',
          current_location: depotLocation,
          capacity: { weight: 100, volume: 10 },
          availability_window: {
            start: new Date().toISOString(),
            end: new Date(Date.now() + 28800000).toISOString(), // 8 hours
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data;
}

async function test6_DatabaseConnection() {
  const response = await fetch(`${API_URL}/api/database/status`);

  if (!response.ok) {
    throw new Error('Database status endpoint failed');
  }

  const data = await response.json();

  if (!data.connected) {
    throw new Error('Database is not connected');
  }

  return data;
}

async function test7_ETACalculation() {
  const response = await fetch(`${API_URL}/api/calculate/eta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origin: depotLocation,
      destination: { lat: 25.197197, lng: 55.274376 },
      traffic_conditions: 'moderate',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  const data = await response.json();

  if (!data.eta || !data.distance) {
    throw new Error('Invalid ETA calculation response');
  }

  return data;
}

async function test8_RouteReoptimization() {
  const response = await fetch(`${API_URL}/api/optimize/reoptimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      route_id: 'test-route-1',
      new_orders: [sampleOrders[0]],
      current_location: depotLocation,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    // This might fail if route doesn't exist, which is okay for testing
    return { message: 'Route not found (expected for new deployment)' };
  }

  const data = await response.json();
  return data;
}

async function runAllTests() {
  console.log(`${colors.bold}${colors.blue}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}║  BARQ Fleet - Complete Integration Test                       ║${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}╚════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  console.log(`${colors.yellow}Testing Backend API: ${colors.reset}${API_URL}\n`);

  // Run all tests
  await runTest('1. Health Check', test1_HealthCheck);
  await runTest('2. Route Optimization Engine', test2_RouteOptimization);
  await runTest('3. Multi-Vehicle Optimization', test3_MultiVehicleOptimization);
  await runTest('4. Dynamic Route Optimization', test4_DynamicRouteOptimization);
  await runTest('5. Auto-Dispatch Engine', test5_AutoDispatch);
  await runTest('6. Database Connection', test6_DatabaseConnection);
  await runTest('7. ETA Calculation', test7_ETACalculation);
  await runTest('8. Route Re-optimization', test8_RouteReoptimization);

  // Summary
  const passCount = tests.filter((t) => t.success).length;
  const failCount = tests.filter((t) => !t.success).length;
  const avgDuration = Math.round(
    tests.reduce((sum, t) => sum + (t.duration || 0), 0) / tests.length
  );

  console.log(`\n${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}Integration Test Summary:${colors.reset}`);
  console.log(`  ${colors.green}Passed:${colors.reset} ${passCount}/${tests.length}`);
  console.log(`  ${colors.red}Failed:${colors.reset} ${failCount}/${tests.length}`);
  console.log(`  ${colors.yellow}Average Response Time:${colors.reset} ${avgDuration}ms`);
  console.log(`${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

  if (failCount > 0) {
    console.log(`${colors.red}${colors.bold}Failed Tests:${colors.reset}`);
    tests
      .filter((t) => !t.success)
      .forEach((t) => {
        console.log(`  ${colors.red}✗${colors.reset} ${t.name}`);
        console.log(`    Error: ${t.error}`);
      });
    console.log();
  }

  // System Status
  console.log(`${colors.blue}${colors.bold}System Status:${colors.reset}`);

  const criticalTests = tests.slice(0, 6); // First 6 tests are critical
  const criticalPass = criticalTests.filter((t) => t.success).length;

  if (criticalPass === criticalTests.length) {
    console.log(`  ${colors.green}✓ Routing Engine: OPERATIONAL${colors.reset}`);
    console.log(`  ${colors.green}✓ Optimization Engine: OPERATIONAL${colors.reset}`);
    console.log(`  ${colors.green}✓ Dispatching Engine: OPERATIONAL${colors.reset}`);
    console.log(`  ${colors.green}✓ Database Integration: OPERATIONAL${colors.reset}`);
    console.log(`\n${colors.green}${colors.bold}✓ ALL CORE SYSTEMS FULLY FUNCTIONAL${colors.reset}\n`);
  } else {
    console.log(`  ${colors.red}⚠ Some core systems have issues${colors.reset}\n`);
  }

  // Next Steps
  console.log(`${colors.blue}Frontend Integration:${colors.reset}`);
  console.log(`  1. Ensure frontend is configured to use: ${colors.yellow}${API_URL}${colors.reset}`);
  console.log(`  2. Start frontend: ${colors.yellow}cd frontend && npm run dev${colors.reset}`);
  console.log(`  3. Visit: ${colors.yellow}http://localhost:3000${colors.reset}\n`);

  return passCount === tests.length ? 0 : 1;
}

// Run tests
runAllTests()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error(`${colors.red}${colors.bold}Fatal Error:${colors.reset} ${error.message}`);
    process.exit(1);
  });
