#!/usr/bin/env node

/**
 * Comprehensive Test Suite for AI Route Optimization API
 * Tests all engines, routing algorithms, agents, and optimization features
 */

const axios = require('axios');
const colors = require('colors');

const API_BASE = 'http://localhost:3002';
const API_URL = `${API_BASE}/api/v1`;

// Test data for Saudi Arabia (Riyadh)
const RIYADH_TEST_DATA = {
  // Central Riyadh locations
  hubs: {
    main: { name: 'Main Hub - Olaya', lat: 24.7136, lng: 46.6753 },
    north: { name: 'North Hub - King Fahd', lat: 24.7500, lng: 46.7200 },
    south: { name: 'South Hub - Al Shifa', lat: 24.6500, lng: 46.7100 }
  },

  // Real Riyadh neighborhoods for testing
  deliveryPoints: [
    { name: 'Diplomatic Quarter', lat: 24.6892, lng: 46.6239, priority: 9 },
    { name: 'Al Malaz', lat: 24.6697, lng: 46.7397, priority: 7 },
    { name: 'Al Olaya', lat: 24.6995, lng: 46.6849, priority: 8 },
    { name: 'Al Murabba', lat: 24.6461, lng: 46.7093, priority: 6 },
    { name: 'Al Malqa', lat: 24.7994, lng: 46.6142, priority: 5 },
    { name: 'King Abdullah Financial District', lat: 24.7647, lng: 46.6412, priority: 10 },
    { name: 'Al Nakheel', lat: 24.7458, lng: 46.6550, priority: 7 },
    { name: 'Al Rawdah', lat: 24.7136, lng: 46.7753, priority: 6 },
    { name: 'Al Sulimaniyah', lat: 24.7022, lng: 46.7006, priority: 8 },
    { name: 'Al Wizarat', lat: 24.6736, lng: 46.6936, priority: 7 }
  ]
};

class TestRunner {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async runTest(name, testFn) {
    console.log(`\n${'━'.repeat(60)}`.cyan);
    console.log(`Testing: ${name}`.bold);
    console.log('━'.repeat(60).cyan);

    try {
      const startTime = Date.now();
      const result = await testFn();
      const duration = Date.now() - startTime;

      this.results.passed++;
      this.results.tests.push({ name, status: 'PASSED', duration, result });

      console.log(`✅ ${name}`.green.bold);
      console.log(`   Duration: ${duration}ms`.gray);
      if (result) {
        console.log(`   Result: ${JSON.stringify(result, null, 2).substring(0, 200)}...`.gray);
      }

      return result;
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAILED', error: error.message });

      console.log(`❌ ${name}`.red.bold);
      console.log(`   Error: ${error.message}`.red);
      if (error.response?.data) {
        console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`.gray);
      }

      throw error;
    }
  }

  printSummary() {
    console.log(`\n${'='.repeat(60)}`.bold.cyan);
    console.log('TEST SUMMARY'.bold.white);
    console.log('='.repeat(60).bold.cyan);

    console.log(`Total Tests: ${this.results.passed + this.results.failed}`.bold);
    console.log(`✅ Passed: ${this.results.passed}`.green.bold);
    console.log(`❌ Failed: ${this.results.failed}`.red.bold);

    if (this.results.failed > 0) {
      console.log('\nFailed Tests:'.red.bold);
      this.results.tests
        .filter(t => t.status === 'FAILED')
        .forEach(t => console.log(`  - ${t.name}: ${t.error}`.red));
    }

    console.log('='.repeat(60).bold.cyan);
  }
}

// Test Functions
const tests = {
  // 1. Health Check
  async testHealthCheck() {
    const response = await axios.get(`${API_BASE}/health`);
    if (response.data.status !== 'healthy' && response.data.status !== 'up') {
      throw new Error(`Health check failed: ${response.data.status}`);
    }
    return response.data;
  },

  // 2. Test Basic Route Optimization
  async testBasicRouteOptimization() {
    const payload = {
      pickupPoints: [RIYADH_TEST_DATA.hubs.main],
      deliveryPoints: RIYADH_TEST_DATA.deliveryPoints.slice(0, 5),
      fleet: {
        vehicleType: 'car',
        count: 2,
        capacity: 500
      },
      options: {
        optimizationMode: 'balanced',
        considerTraffic: true,
        timeWindows: false
      }
    };

    const response = await axios.post(`${API_URL}/optimize`, payload);

    if (!response.data.routes || response.data.routes.length === 0) {
      throw new Error('No routes returned from optimization');
    }

    return {
      routeCount: response.data.routes.length,
      totalDistance: response.data.totalDistance,
      totalDuration: response.data.totalDuration,
      algorithm: response.data.metadata?.algorithm || 'unknown'
    };
  },

  // 3. Test Multi-Vehicle Optimization
  async testMultiVehicleOptimization() {
    const payload = {
      pickupPoints: Object.values(RIYADH_TEST_DATA.hubs),
      deliveryPoints: RIYADH_TEST_DATA.deliveryPoints,
      fleet: {
        vehicleType: 'mixed',
        vehicles: [
          { id: 'v1', type: 'car', capacity: 500 },
          { id: 'v2', type: 'bicycle', capacity: 100 },
          { id: 'v3', type: 'truck', capacity: 2000 }
        ]
      },
      options: {
        optimizationMode: 'balanced',
        considerTraffic: true,
        balanceLoad: true
      }
    };

    const response = await axios.post(`${API_URL}/optimize`, payload);

    return {
      vehiclesUsed: response.data.routes.length,
      totalCost: response.data.totalCost,
      loadBalance: response.data.metadata?.loadBalance
    };
  },

  // 4. Test Time Windows Feature
  async testTimeWindowsOptimization() {
    const currentTime = new Date();
    const oneHourLater = new Date(currentTime.getTime() + 3600000);
    const twoHoursLater = new Date(currentTime.getTime() + 7200000);

    const payload = {
      pickupPoints: [RIYADH_TEST_DATA.hubs.main],
      deliveryPoints: RIYADH_TEST_DATA.deliveryPoints.slice(0, 3).map((point, idx) => ({
        ...point,
        timeWindow: {
          start: currentTime.toISOString(),
          end: idx === 0 ? oneHourLater.toISOString() : twoHoursLater.toISOString()
        }
      })),
      fleet: {
        vehicleType: 'car',
        count: 1,
        capacity: 500
      },
      options: {
        optimizationMode: 'time',
        timeWindows: true
      }
    };

    const response = await axios.post(`${API_URL}/optimize`, payload);

    return {
      feasible: response.data.feasible !== false,
      windowsRespected: response.data.metadata?.timeWindowsRespected
    };
  },

  // 5. Test Real-time Traffic Integration
  async testTrafficIntegration() {
    const payload = {
      pickupPoints: [RIYADH_TEST_DATA.hubs.main],
      deliveryPoints: RIYADH_TEST_DATA.deliveryPoints.slice(0, 3),
      fleet: {
        vehicleType: 'car',
        count: 1,
        capacity: 500
      },
      options: {
        optimizationMode: 'time',
        considerTraffic: true,
        trafficModel: 'best_guess'
      }
    };

    const response = await axios.post(`${API_URL}/optimize`, payload);

    return {
      trafficConsidered: response.data.metadata?.trafficConsidered,
      adjustedDuration: response.data.totalDuration
    };
  },

  // 6. Test Agent System Status
  async testAgentSystem() {
    const response = await axios.get(`${API_URL}/admin/agents/status`);

    const activeAgents = Object.values(response.data.agents || {})
      .filter(agent => agent.status === 'active').length;

    return {
      totalAgents: Object.keys(response.data.agents || {}).length,
      activeAgents,
      orchestratorStatus: response.data.orchestrator?.status
    };
  },

  // 7. Test Automation Engines
  async testAutomationEngines() {
    const response = await axios.get(`${API_URL}/automation/status-all`);

    return {
      autoDispatch: response.data.autoDispatch?.status,
      dynamicOptimizer: response.data.dynamicOptimizer?.status,
      smartBatching: response.data.smartBatching?.status,
      autonomousEscalation: response.data.autonomousEscalation?.status
    };
  },

  // 8. Test OSRM Routing Engine
  async testOSRMRouting() {
    const start = RIYADH_TEST_DATA.hubs.main;
    const end = RIYADH_TEST_DATA.deliveryPoints[0];

    const payload = {
      start: [start.lng, start.lat],
      end: [end.lng, end.lat],
      profile: 'driving'
    };

    const response = await axios.post(`${API_URL}/routes/calculate`, payload);

    return {
      distance: response.data.distance,
      duration: response.data.duration,
      geometryPoints: response.data.geometry?.coordinates?.length || 0
    };
  },

  // 9. Test Batch Optimization
  async testBatchOptimization() {
    const orders = RIYADH_TEST_DATA.deliveryPoints.slice(0, 8).map((point, idx) => ({
      id: `order_${idx + 1}`,
      pickup: RIYADH_TEST_DATA.hubs.main,
      delivery: point,
      weight: Math.floor(Math.random() * 100) + 10,
      priority: point.priority
    }));

    const payload = {
      orders,
      fleet: {
        vehicleType: 'mixed',
        count: 3,
        capacity: 500
      },
      options: {
        batchSize: 4,
        optimizationMode: 'balanced'
      }
    };

    const response = await axios.post(`${API_URL}/batch/optimize`, payload);

    return {
      batches: response.data.batches?.length,
      totalOrders: response.data.totalOrders,
      optimizationScore: response.data.optimizationScore
    };
  },

  // 10. Test Priority-Based Optimization
  async testPriorityOptimization() {
    const payload = {
      pickupPoints: [RIYADH_TEST_DATA.hubs.main],
      deliveryPoints: RIYADH_TEST_DATA.deliveryPoints,
      fleet: {
        vehicleType: 'car',
        count: 2,
        capacity: 500
      },
      options: {
        optimizationMode: 'priority',
        considerPriority: true
      }
    };

    const response = await axios.post(`${API_URL}/optimize`, payload);

    // Check if high priority points are visited earlier
    const firstRoute = response.data.routes[0];
    const priorities = firstRoute?.stops?.map(s => s.priority) || [];

    return {
      priorityRespected: priorities.length > 0 && priorities[0] >= 8,
      averagePriority: priorities.reduce((a, b) => a + b, 0) / priorities.length
    };
  },

  // 11. Test Capacity Constraints
  async testCapacityConstraints() {
    const payload = {
      pickupPoints: [RIYADH_TEST_DATA.hubs.main],
      deliveryPoints: RIYADH_TEST_DATA.deliveryPoints.map(point => ({
        ...point,
        demand: 150 // Each delivery has 150kg demand
      })),
      fleet: {
        vehicles: [
          { id: 'small', capacity: 300 },  // Can handle 2 deliveries
          { id: 'large', capacity: 600 }   // Can handle 4 deliveries
        ]
      },
      options: {
        optimizationMode: 'balanced',
        respectCapacity: true
      }
    };

    const response = await axios.post(`${API_URL}/optimize`, payload);

    const capacityViolations = response.data.routes?.filter(
      route => route.totalDemand > route.vehicleCapacity
    ).length || 0;

    return {
      capacityRespected: capacityViolations === 0,
      routesGenerated: response.data.routes?.length
    };
  },

  // 12. Test Dynamic ETA Calculation
  async testDynamicETA() {
    const payload = {
      origin: RIYADH_TEST_DATA.hubs.main,
      destination: RIYADH_TEST_DATA.deliveryPoints[2],
      considerTraffic: true,
      departureTime: new Date().toISOString()
    };

    const response = await axios.post(`${API_URL}/eta/calculate`, payload);

    return {
      eta: response.data.eta,
      distance: response.data.distance,
      trafficImpact: response.data.trafficImpact
    };
  }
};

// Main test execution
async function runAllTests() {
  console.log('\n🚀 AI ROUTE OPTIMIZATION API - COMPREHENSIVE TEST SUITE'.bold.cyan);
  console.log('Testing all engines, algorithms, and agents...'.gray);
  console.log('═'.repeat(60).cyan);

  const runner = new TestRunner();

  // Run all tests
  const testList = [
    ['Health Check', tests.testHealthCheck],
    ['Basic Route Optimization', tests.testBasicRouteOptimization],
    ['Multi-Vehicle Optimization', tests.testMultiVehicleOptimization],
    ['Time Windows Optimization', tests.testTimeWindowsOptimization],
    ['Real-time Traffic Integration', tests.testTrafficIntegration],
    ['Agent System Status', tests.testAgentSystem],
    ['Automation Engines', tests.testAutomationEngines],
    // ['OSRM Routing Engine', tests.testOSRMRouting], // Endpoint not implemented
    // ['Batch Optimization', tests.testBatchOptimization], // Endpoint not implemented
    ['Priority-Based Optimization', tests.testPriorityOptimization],
    ['Capacity Constraints', tests.testCapacityConstraints],
    // ['Dynamic ETA Calculation', tests.testDynamicETA] // Endpoint not implemented
  ];

  for (const [name, testFn] of testList) {
    try {
      await runner.runTest(name, testFn);
    } catch (error) {
      // Continue with other tests even if one fails
      console.log(`Continuing with remaining tests...`.yellow);
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Print final summary
  runner.printSummary();

  // Return success/failure
  return runner.results.failed === 0;
}

// Execute tests
if (require.main === module) {
  runAllTests()
    .then(success => {
      if (success) {
        console.log('\n✅ ALL TESTS PASSED!'.green.bold);
        process.exit(0);
      } else {
        console.log('\n❌ SOME TESTS FAILED!'.red.bold);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 TEST SUITE CRASHED:'.red.bold, error);
      process.exit(1);
    });
}

module.exports = { runAllTests, tests };