/**
 * Comprehensive Integration Test Script
 *
 * Tests all major integrations and systems:
 * 1. BarqFleet Production Database Connection
 * 2. Data Fetching (Orders, Shipments, Hubs, Couriers, Logs)
 * 3. Automation Systems (Auto-Dispatch, Route Optimizer, etc.)
 * 4. Autonomous Operations
 * 5. API Endpoints
 */

const axios = require('axios');
const colors = require('colors');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3003';

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

/**
 * Log test result
 */
function logTest(name, passed, details = '') {
  results.tests.push({ name, passed, details });

  if (passed) {
    results.passed++;
    console.log(`✅ ${name}`.green);
    if (details) console.log(`   ${details}`.gray);
  } else {
    results.failed++;
    console.log(`❌ ${name}`.red);
    if (details) console.log(`   ${details}`.yellow);
  }
}

/**
 * Test BarqFleet Production Database Connection
 */
async function testProductionDatabase() {
  console.log('\n🔍 Testing BarqFleet Production Database Connection...'.cyan.bold);

  try {
    const response = await axios.get(`${API_BASE}/api/v1/barq-production/test-connection`);
    logTest(
      'Production Database Connection',
      response.data.success,
      response.data.success ? `Connected at ${response.data.timestamp}` : response.data.error
    );
  } catch (error) {
    logTest('Production Database Connection', false, error.message);
  }
}

/**
 * Test Database Statistics
 */
async function testStatistics() {
  console.log('\n📊 Testing Database Statistics...'.cyan.bold);

  try {
    const response = await axios.get(`${API_BASE}/api/v1/barq-production/statistics`);

    if (response.data.success) {
      const stats = response.data.data;
      logTest('Database Statistics', true, JSON.stringify(stats, null, 2));

      // Validate statistics
      logTest('Total Orders Count', stats.total_orders >= 0, `Count: ${stats.total_orders}`);
      logTest('Total Couriers Count', stats.total_couriers >= 0, `Count: ${stats.total_couriers}`);
      logTest('Total Hubs Count', stats.total_hubs >= 0, `Count: ${stats.total_hubs}`);
      logTest('Total Shipments Count', stats.total_shipments >= 0, `Count: ${stats.total_shipments}`);
      logTest('Today Orders Count', stats.today_orders >= 0, `Count: ${stats.today_orders}`);
      logTest('Pending Orders Count', stats.pending_orders >= 0, `Count: ${stats.pending_orders}`);
      logTest('Online Couriers Count', stats.online_couriers >= 0, `Count: ${stats.online_couriers}`);
      logTest('Active Shipments Count', stats.active_shipments >= 0, `Count: ${stats.active_shipments}`);
    } else {
      logTest('Database Statistics', false, 'Failed to fetch statistics');
    }
  } catch (error) {
    logTest('Database Statistics', false, error.message);
  }
}

/**
 * Test Hubs Fetching
 */
async function testHubs() {
  console.log('\n🏢 Testing Hubs Data...'.cyan.bold);

  try {
    const response = await axios.get(`${API_BASE}/api/v1/barq-production/hubs?limit=10`);

    if (response.data.success) {
      logTest('Fetch Hubs', true, `Fetched ${response.data.count} hubs`);

      if (response.data.count > 0) {
        const hub = response.data.data[0];
        logTest(
          'Hub Data Structure',
          hub.id && hub.name && hub.latitude && hub.longitude,
          `Sample: ${hub.name} (${hub.code})`
        );
      }
    } else {
      logTest('Fetch Hubs', false, 'Failed to fetch hubs');
    }
  } catch (error) {
    logTest('Fetch Hubs', false, error.message);
  }
}

/**
 * Test Couriers Fetching
 */
async function testCouriers() {
  console.log('\n🚗 Testing Couriers Data...'.cyan.bold);

  try {
    const response = await axios.get(`${API_BASE}/api/v1/barq-production/couriers?limit=10`);

    if (response.data.success) {
      logTest('Fetch Couriers', true, `Fetched ${response.data.count} couriers`);

      if (response.data.count > 0) {
        const courier = response.data.data[0];
        logTest(
          'Courier Data Structure',
          courier.id && courier.mobile && courier.name !== undefined,
          `Sample: ${courier.name || 'N/A'} (${courier.mobile})`
        );
      }
    } else {
      logTest('Fetch Couriers', false, 'Failed to fetch couriers');
    }

    // Test available couriers
    const availableResponse = await axios.get(`${API_BASE}/api/v1/barq-production/couriers/available?limit=10`);

    if (availableResponse.data.success) {
      logTest('Fetch Available Couriers', true, `Fetched ${availableResponse.data.count} available couriers`);
    } else {
      logTest('Fetch Available Couriers', false, 'Failed to fetch available couriers');
    }
  } catch (error) {
    logTest('Fetch Couriers', false, error.message);
  }
}

/**
 * Test Orders Fetching
 */
async function testOrders() {
  console.log('\n📦 Testing Orders Data...'.cyan.bold);

  try {
    const response = await axios.get(`${API_BASE}/api/v1/barq-production/orders?limit=10`);

    if (response.data.success) {
      logTest('Fetch Orders', true, `Fetched ${response.data.count} orders`);

      if (response.data.count > 0) {
        const order = response.data.data[0];
        logTest(
          'Order Data Structure',
          order.id && order.tracking_no && order.order_status,
          `Sample: ${order.tracking_no} - Status: ${order.order_status}`
        );
      }
    } else {
      logTest('Fetch Orders', false, 'Failed to fetch orders');
    }

    // Test pending orders
    const pendingResponse = await axios.get(`${API_BASE}/api/v1/barq-production/orders/pending?limit=10`);

    if (pendingResponse.data.success) {
      logTest('Fetch Pending Orders', true, `Fetched ${pendingResponse.data.count} pending orders`);
    } else {
      logTest('Fetch Pending Orders', false, 'Failed to fetch pending orders');
    }
  } catch (error) {
    logTest('Fetch Orders', false, error.message);
  }
}

/**
 * Test Shipments Fetching
 */
async function testShipments() {
  console.log('\n🚚 Testing Shipments Data...'.cyan.bold);

  try {
    const response = await axios.get(`${API_BASE}/api/v1/barq-production/shipments?limit=10`);

    if (response.data.success) {
      logTest('Fetch Shipments', true, `Fetched ${response.data.count} shipments`);

      if (response.data.count > 0) {
        const shipment = response.data.data[0];
        logTest(
          'Shipment Data Structure',
          shipment.id && shipment.hub_id !== undefined,
          `Sample: ID ${shipment.id} - ${shipment.order_count} orders`
        );
      }
    } else {
      logTest('Fetch Shipments', false, 'Failed to fetch shipments');
    }

    // Test active shipments
    const activeResponse = await axios.get(`${API_BASE}/api/v1/barq-production/shipments/active?limit=10`);

    if (activeResponse.data.success) {
      logTest('Fetch Active Shipments', true, `Fetched ${activeResponse.data.count} active shipments`);
    } else {
      logTest('Fetch Active Shipments', false, 'Failed to fetch active shipments');
    }
  } catch (error) {
    logTest('Fetch Shipments', false, error.message);
  }
}

/**
 * Test Order Logs Fetching
 */
async function testOrderLogs() {
  console.log('\n📋 Testing Order Logs Data...'.cyan.bold);

  try {
    const response = await axios.get(`${API_BASE}/api/v1/barq-production/order-logs?limit=10`);

    if (response.data.success) {
      logTest('Fetch Order Logs', true, `Fetched ${response.data.count} order logs`);

      if (response.data.count > 0) {
        const log = response.data.data[0];
        logTest(
          'Order Log Data Structure',
          log.id && log.order_id && log.new_status,
          `Sample: Order ${log.tracking_no} - ${log.old_status} → ${log.new_status}`
        );
      }
    } else {
      logTest('Fetch Order Logs', false, 'Failed to fetch order logs');
    }
  } catch (error) {
    logTest('Fetch Order Logs', false, error.message);
  }
}

/**
 * Test Automation Systems
 */
async function testAutomation() {
  console.log('\n🤖 Testing Automation Systems...'.cyan.bold);

  try {
    // Test automation status
    const statusResponse = await axios.get(`${API_BASE}/api/v1/automation/status-all`);

    if (statusResponse.data.success) {
      const engines = statusResponse.data.engines;
      logTest('Automation Status Check', true, `All engines status retrieved`);

      // Check individual engines
      logTest('Auto-Dispatch Engine', engines.autoDispatch.initialized, `Running: ${engines.autoDispatch.running}`);
      logTest(
        'Route Optimizer Engine',
        engines.routeOptimizer.initialized,
        `Running: ${engines.routeOptimizer.running}`
      );
      logTest(
        'Smart Batching Engine',
        engines.smartBatching.initialized,
        `Running: ${engines.smartBatching.running}`
      );
      logTest(
        'Escalation Engine',
        engines.escalation.initialized,
        `Running: ${engines.escalation.running}`
      );
    } else {
      logTest('Automation Status Check', false, 'Failed to get automation status');
    }
  } catch (error) {
    logTest('Automation Status Check', false, error.message);
  }
}

/**
 * Test Autonomous Operations
 */
async function testAutonomous() {
  console.log('\n🧠 Testing Autonomous Operations...'.cyan.bold);

  try {
    const response = await axios.get(`${API_BASE}/api/v1/autonomous/status`);

    if (response.data.success) {
      const status = response.data;
      logTest('Autonomous Status Check', true, `Initialized: ${status.initialized}`);
      logTest(
        'Autonomous Cycle Count',
        status.cycleCount !== undefined,
        `Completed ${status.cycleCount} cycles`
      );
    } else {
      logTest('Autonomous Status Check', false, 'Failed to get autonomous status');
    }
  } catch (error) {
    logTest('Autonomous Status Check', false, error.message);
  }
}

/**
 * Test Health Endpoint
 */
async function testHealth() {
  console.log('\n❤️  Testing Health Endpoint...'.cyan.bold);

  try {
    const response = await axios.get(`${API_BASE}/health`);

    logTest('Health Check', response.data.status === 'ok', JSON.stringify(response.data, null, 2));
  } catch (error) {
    logTest('Health Check', false, error.message);
  }
}

/**
 * Print Summary
 */
function printSummary() {
  console.log('\n' + '='.repeat(80).cyan);
  console.log('📊 TEST SUMMARY'.cyan.bold);
  console.log('='.repeat(80).cyan);

  console.log(`\nTotal Tests: ${results.passed + results.failed}`);
  console.log(`✅ Passed: ${results.passed}`.green);
  console.log(`❌ Failed: ${results.failed}`.red);

  const percentage = ((results.passed / (results.passed + results.failed)) * 100).toFixed(2);
  console.log(`\nSuccess Rate: ${percentage}%`.yellow);

  if (results.failed > 0) {
    console.log('\n❌ Failed Tests:'.red.bold);
    results.tests
      .filter((t) => !t.passed)
      .forEach((t) => {
        console.log(`   - ${t.name}`.red);
        if (t.details) console.log(`     ${t.details}`.yellow);
      });
  }

  console.log('\n' + '='.repeat(80).cyan + '\n');
}

/**
 * Main test execution
 */
async function runAllTests() {
  console.log('\n' + '='.repeat(80).cyan);
  console.log('🚀 COMPREHENSIVE INTEGRATION TEST SUITE'.cyan.bold);
  console.log('='.repeat(80).cyan);
  console.log(`\nTesting API at: ${API_BASE}`.yellow);
  console.log(`Timestamp: ${new Date().toISOString()}`.gray);

  try {
    await testHealth();
    await testProductionDatabase();
    await testStatistics();
    await testHubs();
    await testCouriers();
    await testOrders();
    await testShipments();
    await testOrderLogs();
    await testAutomation();
    await testAutonomous();

    printSummary();

    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Test suite failed with error:'.red.bold);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runAllTests();
