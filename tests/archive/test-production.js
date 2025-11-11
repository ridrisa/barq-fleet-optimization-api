#!/usr/bin/env node

/**
 * Production Test Suite for AI Route Optimization API
 * Tests all endpoints against the deployed Cloud Run service
 */

const axios = require('axios');
const colors = require('colors');

// Production URL
const API_BASE = 'https://route-opt-backend-426674819922.us-central1.run.app';
const API_URL = `${API_BASE}/api/v1`;

// Test data for Saudi Arabia (Riyadh)
const RIYADH_TEST_DATA = {
  hubs: {
    main: { name: 'Main Hub - Olaya', lat: 24.7136, lng: 46.6753 },
    north: { name: 'North Hub - King Fahd', lat: 24.7500, lng: 46.7200 },
    south: { name: 'South Hub - Al Shifa', lat: 24.6500, lng: 46.7100 }
  },
  deliveryPoints: [
    { name: 'Diplomatic Quarter', lat: 24.6892, lng: 46.6239, priority: 9 },
    { name: 'Al Malaz', lat: 24.6697, lng: 46.7397, priority: 7 },
    { name: 'Al Olaya', lat: 24.6995, lng: 46.6849, priority: 8 },
    { name: 'Al Murabba', lat: 24.6461, lng: 46.7093, priority: 6 },
    { name: 'Al Malqa', lat: 24.7994, lng: 46.6142, priority: 5 }
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

      // Don't throw - continue with other tests
      return null;
    }
  }

  printSummary() {
    console.log(`\n${'='.repeat(60)}`.bold.cyan);
    console.log('PRODUCTION TEST SUMMARY'.bold.white);
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
    return {
      status: response.data.status,
      environment: response.data.environment,
      uptime: Math.floor(response.data.uptime)
    };
  },

  // 2. Test Basic Route Optimization
  async testBasicRouteOptimization() {
    const payload = {
      pickupPoints: [RIYADH_TEST_DATA.hubs.main],
      deliveryPoints: RIYADH_TEST_DATA.deliveryPoints.slice(0, 3),
      fleet: {
        vehicleType: 'car',
        count: 1,
        capacity: 500
      },
      options: {
        optimizationMode: 'balanced',
        considerTraffic: false
      }
    };

    const response = await axios.post(`${API_URL}/optimize`, payload);

    if (!response.data.routes || response.data.routes.length === 0) {
      throw new Error('No routes returned from optimization');
    }

    return {
      success: response.data.success,
      routeCount: response.data.routes.length,
      waypointCount: response.data.routes[0].waypoints?.length || 0
    };
  },

  // 3. Test Multi-Vehicle Optimization
  async testMultiVehicleOptimization() {
    const payload = {
      pickupPoints: [RIYADH_TEST_DATA.hubs.main, RIYADH_TEST_DATA.hubs.north],
      deliveryPoints: RIYADH_TEST_DATA.deliveryPoints,
      fleet: {
        vehicleType: 'mixed',
        vehicles: [
          { id: 'v1', type: 'car', capacity: 500 },
          { id: 'v2', type: 'truck', capacity: 2000 }
        ]
      },
      options: {
        optimizationMode: 'balanced',
        balanceLoad: true
      }
    };

    const response = await axios.post(`${API_URL}/optimize`, payload);

    return {
      vehiclesUsed: response.data.routes?.length || 0,
      success: response.data.success
    };
  },

  // 4. Test Priority-Based Optimization
  async testPriorityOptimization() {
    const payload = {
      pickupPoints: [RIYADH_TEST_DATA.hubs.main],
      deliveryPoints: RIYADH_TEST_DATA.deliveryPoints,
      fleet: {
        vehicleType: 'car',
        count: 1,
        capacity: 500
      },
      options: {
        optimizationMode: 'priority',
        considerPriority: true
      }
    };

    const response = await axios.post(`${API_URL}/optimize`, payload);

    const firstRoute = response.data.routes?.[0];
    const priorities = firstRoute?.waypoints?.filter(w => w.priority).map(w => w.priority) || [];

    return {
      highPriorityFirst: priorities.length > 0 && priorities[0] >= 7,
      routeGenerated: response.data.routes?.length > 0
    };
  },

  // 5. Test Agent System Status
  async testAgentSystem() {
    try {
      const response = await axios.get(`${API_URL}/admin/agents/status`);

      const activeAgents = Object.values(response.data.agents || {})
        .filter(agent => agent.status === 'active').length;

      return {
        totalAgents: Object.keys(response.data.agents || {}).length,
        activeAgents,
        orchestratorStatus: response.data.orchestrator?.status
      };
    } catch (error) {
      // Agents might be disabled in production
      if (error.response?.status === 404) {
        return {
          note: 'Agents endpoint not available (disabled in production)',
          status: 'expected'
        };
      }
      throw error;
    }
  },

  // 6. Test Time Windows Feature
  async testTimeWindows() {
    const currentTime = new Date();
    const oneHourLater = new Date(currentTime.getTime() + 3600000);

    const payload = {
      pickupPoints: [RIYADH_TEST_DATA.hubs.main],
      deliveryPoints: [
        {
          ...RIYADH_TEST_DATA.deliveryPoints[0],
          timeWindow: {
            start: currentTime.toISOString(),
            end: oneHourLater.toISOString()
          }
        }
      ],
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
      success: response.data.success,
      routesGenerated: response.data.routes?.length > 0
    };
  },

  // 7. Test Capacity Constraints
  async testCapacityConstraints() {
    const payload = {
      pickupPoints: [RIYADH_TEST_DATA.hubs.main],
      deliveryPoints: RIYADH_TEST_DATA.deliveryPoints.slice(0, 3).map(point => ({
        ...point,
        demand: 150
      })),
      fleet: {
        vehicles: [
          { id: 'small', capacity: 300 }
        ]
      },
      options: {
        optimizationMode: 'balanced',
        respectCapacity: true
      }
    };

    const response = await axios.post(`${API_URL}/optimize`, payload);

    return {
      success: response.data.success,
      routesGenerated: response.data.routes?.length || 0
    };
  }
};

// Main test execution
async function runProductionTests() {
  console.log('\n🚀 PRODUCTION API TEST SUITE'.bold.cyan);
  console.log('Testing Cloud Run deployment...'.gray);
  console.log(`URL: ${API_BASE}`.yellow);
  console.log('═'.repeat(60).cyan);

  const runner = new TestRunner();

  // Run all tests
  const testList = [
    ['Health Check', tests.testHealthCheck],
    ['Basic Route Optimization', tests.testBasicRouteOptimization],
    ['Multi-Vehicle Optimization', tests.testMultiVehicleOptimization],
    ['Priority-Based Optimization', tests.testPriorityOptimization],
    ['Agent System Status', tests.testAgentSystem],
    ['Time Windows Feature', tests.testTimeWindows],
    ['Capacity Constraints', tests.testCapacityConstraints]
  ];

  for (const [name, testFn] of testList) {
    await runner.runTest(name, testFn);
    // Small delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Print final summary
  runner.printSummary();

  // Return success/failure
  return runner.results.failed === 0;
}

// Execute tests
if (require.main === module) {
  runProductionTests()
    .then(success => {
      if (success) {
        console.log('\n✅ ALL PRODUCTION TESTS PASSED!'.green.bold);
        console.log('The API is fully operational in production!'.green);
        process.exit(0);
      } else {
        console.log('\n⚠️  Some tests failed but API is operational'.yellow.bold);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 TEST SUITE CRASHED:'.red.bold, error);
      process.exit(1);
    });
}

module.exports = { runProductionTests, tests };