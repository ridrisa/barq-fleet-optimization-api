/**
 * Comprehensive Production Integration Test
 *
 * Tests all services with BarqFleet production database integration:
 * 1. Auto-Dispatch Service with production orders and couriers
 * 2. Dynamic Route Optimizer with production shipments
 * 3. Smart Batching Engine with production order clustering
 * 4. Automation engines startup and status
 * 5. Autonomous operations status
 */

const barqProductionDB = require('./src/services/barqfleet-production.service');
const { logger } = require('./src/utils/logger');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(80));
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

/**
 * Test 1: Production Database Connection
 */
async function testProductionDatabaseConnection() {
  logSection('TEST 1: Production Database Connection');

  try {
    const result = await barqProductionDB.testConnection();

    if (result.success) {
      logSuccess(`Connected to BarqFleet production database`);
      logInfo(`Timestamp: ${result.timestamp}`);
      return true;
    } else {
      logError(`Failed to connect: ${result.error}`);
      return false;
    }
  } catch (error) {
    logError(`Connection test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 2: Fetch Production Statistics
 */
async function testProductionStatistics() {
  logSection('TEST 2: Production Data Statistics');

  try {
    const stats = await barqProductionDB.getStatistics();

    logSuccess('Successfully fetched production statistics');
    console.log('');
    logInfo(`Total Orders: ${stats.total_orders?.toLocaleString() || 0}`);
    logInfo(`Total Couriers: ${stats.total_couriers?.toLocaleString() || 0}`);
    logInfo(`Total Hubs: ${stats.total_hubs?.toLocaleString() || 0}`);
    logInfo(`Total Shipments: ${stats.total_shipments?.toLocaleString() || 0}`);
    logInfo(`Today's Orders: ${stats.today_orders?.toLocaleString() || 0}`);
    logInfo(`Pending Orders: ${stats.pending_orders?.toLocaleString() || 0}`);
    logInfo(`Online Couriers: ${stats.online_couriers?.toLocaleString() || 0}`);
    logInfo(`Active Shipments: ${stats.active_shipments?.toLocaleString() || 0}`);

    return stats.total_orders > 0 && stats.total_couriers > 0;
  } catch (error) {
    logError(`Statistics fetch failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 3: Auto-Dispatch Service Integration
 */
async function testAutoDispatchIntegration() {
  logSection('TEST 3: Auto-Dispatch Service Integration');

  try {
    const autoDispatch = require('./src/services/auto-dispatch.service');

    // Test fetching unassigned orders from production
    logInfo('Fetching unassigned orders from production...');
    const unassignedOrders = await autoDispatch.getUnassignedOrders();

    logSuccess(`Fetched ${unassignedOrders.length} unassigned orders`);

    if (unassignedOrders.length > 0) {
      const firstOrder = unassignedOrders[0];
      logInfo(`Sample Order ID: ${firstOrder.id}`);
      logInfo(`  Tracking: ${firstOrder.tracking_number}`);
      logInfo(`  Service Type: ${firstOrder.service_type}`);
      logInfo(`  Priority: ${firstOrder.priority}`);
      logInfo(`  Pickup: (${firstOrder.pickup_latitude}, ${firstOrder.pickup_longitude})`);
      logInfo(`  Dropoff: (${firstOrder.dropoff_latitude}, ${firstOrder.dropoff_longitude})`);
      logInfo(`  Minutes to SLA: ${Math.round(firstOrder.minutes_to_sla || 0)}`);

      // Test finding eligible drivers for this order
      logInfo('');
      logInfo('Finding eligible couriers for first order...');
      const eligibleDrivers = await autoDispatch.findEligibleDrivers(firstOrder);

      logSuccess(`Found ${eligibleDrivers.length} eligible couriers`);

      if (eligibleDrivers.length > 0) {
        const firstDriver = eligibleDrivers[0];
        logInfo(`Top Courier: ${firstDriver.name}`);
        logInfo(`  Distance to pickup: ${firstDriver.distance_to_pickup.toFixed(2)} km`);
        logInfo(`  Vehicle Type: ${firstDriver.vehicle_type}`);
        logInfo(`  Active Orders: ${firstDriver.active_orders}`);
        logInfo(`  Trust Level: ${firstDriver.trust_level || 'N/A'}`);
      }
    } else {
      logWarning('No unassigned orders available for testing');
    }

    return true;
  } catch (error) {
    logError(`Auto-Dispatch integration failed: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

/**
 * Test 4: Dynamic Route Optimizer Integration
 */
async function testDynamicRouteOptimizerIntegration() {
  logSection('TEST 4: Dynamic Route Optimizer Integration');

  try {
    const routeOptimizer = require('./src/services/dynamic-route-optimizer.service');

    // Test fetching active drivers from production
    logInfo('Fetching active drivers/shipments from production...');
    const activeDrivers = await routeOptimizer.getActiveDrivers();

    logSuccess(`Fetched ${activeDrivers.length} active drivers`);

    if (activeDrivers.length > 0) {
      const firstDriver = activeDrivers[0];
      logInfo(`Sample Courier ID: ${firstDriver.id}`);
      logInfo(`  Name: ${firstDriver.name}`);
      logInfo(`  Location: (${firstDriver.current_latitude}, ${firstDriver.current_longitude})`);
      logInfo(`  Remaining Stops: ${firstDriver.remaining_stops}`);
      logInfo(`  Hub Code: ${firstDriver.hub_code || 'N/A'}`);
      logInfo(`  Shipment ID: ${firstDriver.shipment_id}`);

      // Test getting remaining stops for this driver
      logInfo('');
      logInfo('Fetching remaining stops for first courier...');
      const remainingStops = await routeOptimizer.getRemainingStops(firstDriver.id);

      logSuccess(`Found ${remainingStops.length} remaining stops`);

      if (remainingStops.length > 0) {
        const firstStop = remainingStops[0];
        logInfo(`First Stop: ${firstStop.type}`);
        logInfo(`  Order ID: ${firstStop.orderId}`);
        logInfo(`  Location: (${firstStop.location.lat}, ${firstStop.location.lng})`);
        logInfo(`  Priority: ${firstStop.priority}`);
      }
    } else {
      logWarning('No active drivers/shipments available for testing');
    }

    return true;
  } catch (error) {
    logError(`Dynamic Route Optimizer integration failed: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

/**
 * Test 5: Smart Batching Engine Integration
 */
async function testSmartBatchingIntegration() {
  logSection('TEST 5: Smart Batching Engine Integration');

  try {
    const smartBatching = require('./src/services/smart-batching.service');

    // Test fetching eligible orders for batching
    logInfo('Fetching eligible orders for batching from production...');
    const eligibleOrders = await smartBatching.getEligibleOrders();

    logSuccess(`Fetched ${eligibleOrders.length} orders eligible for batching`);

    if (eligibleOrders.length > 0) {
      const firstOrder = eligibleOrders[0];
      logInfo(`Sample Order ID: ${firstOrder.id}`);
      logInfo(`  Tracking: ${firstOrder.order_number}`);
      logInfo(`  Service Type: ${firstOrder.service_type}`);
      logInfo(`  Created: ${new Date(firstOrder.created_at).toLocaleString()}`);
      logInfo(`  Minutes to SLA: ${Math.round(firstOrder.minutes_to_sla || 0)}`);
      logInfo(`  Pickup: (${firstOrder.pickup_latitude}, ${firstOrder.pickup_longitude})`);
      logInfo(`  Dropoff: (${firstOrder.dropoff_latitude}, ${firstOrder.dropoff_longitude})`);

      // Test clustering if we have enough orders
      if (eligibleOrders.length >= 2) {
        logInfo('');
        logInfo(`Testing order clustering with ${eligibleOrders.length} orders...`);
        const clusters = await smartBatching.clusterOrders(eligibleOrders);

        if (clusters.length > 0) {
          logSuccess(`Created ${clusters.length} potential batches`);
          clusters.forEach((cluster, index) => {
            logInfo(`  Batch ${index + 1}: ${cluster.length} orders`);
          });
        } else {
          logWarning('No clusters formed (orders may be too far apart)');
        }
      }
    } else {
      logWarning('No orders eligible for batching (may need recent orders within 30 min)');
    }

    return true;
  } catch (error) {
    logError(`Smart Batching integration failed: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

/**
 * Test 6: Data Validation
 */
async function testDataValidation() {
  logSection('TEST 6: Data Validation - Field Existence & Calculations');

  let errors = 0;

  try {
    // Test pending orders data structure
    logInfo('Validating pending orders data structure...');
    const orders = await barqProductionDB.getPendingOrders(null, 10);

    if (orders.length > 0) {
      const order = orders[0];

      // Check required fields
      const requiredFields = ['id', 'tracking_no', 'order_status', 'created_at'];
      requiredFields.forEach(field => {
        if (!order[field]) {
          logError(`Missing field in orders: ${field}`);
          errors++;
        }
      });

      // Validate JSON parsing for destination/origin
      try {
        const destination = typeof order.destination === 'string' ? JSON.parse(order.destination) : order.destination;
        const origin = typeof order.origin === 'string' ? JSON.parse(order.origin) : order.origin;

        if (destination && (!destination.latitude && !destination.lat)) {
          logWarning('Order destination missing latitude');
        }
        if (origin && (!origin.latitude && !origin.lat)) {
          logWarning('Order origin missing latitude');
        }
      } catch (parseError) {
        logError(`JSON parsing failed for order ${order.id}: ${parseError.message}`);
        errors++;
      }
    }

    // Test couriers data structure
    logInfo('Validating couriers data structure...');
    const couriers = await barqProductionDB.getAvailableCouriers(null, 10);

    if (couriers.length > 0) {
      const courier = couriers[0];

      // Check required fields
      const requiredFields = ['id', 'is_online', 'is_banned'];
      requiredFields.forEach(field => {
        if (courier[field] === undefined) {
          logError(`Missing field in couriers: ${field}`);
          errors++;
        }
      });

      // Check location data
      if (!courier.latitude || !courier.longitude) {
        logWarning(`Courier ${courier.id} missing location data`);
      }
    }

    // Test shipments data structure
    logInfo('Validating shipments data structure...');
    const shipments = await barqProductionDB.getActiveShipments(10);

    if (shipments.length > 0) {
      const shipment = shipments[0];

      // Check required fields
      const requiredFields = ['id', 'courier_id', 'is_assigned', 'is_completed'];
      requiredFields.forEach(field => {
        if (shipment[field] === undefined) {
          logError(`Missing field in shipments: ${field}`);
          errors++;
        }
      });
    }

    if (errors === 0) {
      logSuccess('All data validation checks passed');
      return true;
    } else {
      logError(`Data validation failed with ${errors} errors`);
      return false;
    }

  } catch (error) {
    logError(`Data validation failed: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

/**
 * Main Test Runner
 */
async function runAllTests() {
  log('\n' + '╔' + '═'.repeat(78) + '╗', colors.bright + colors.cyan);
  log('║' + ' '.repeat(15) + 'PRODUCTION INTEGRATION TEST SUITE' + ' '.repeat(30) + '║', colors.bright + colors.cyan);
  log('╚' + '═'.repeat(78) + '╝\n', colors.bright + colors.cyan);

  const results = {
    passed: 0,
    failed: 0,
    total: 0,
  };

  const tests = [
    { name: 'Production Database Connection', fn: testProductionDatabaseConnection },
    { name: 'Production Statistics', fn: testProductionStatistics },
    { name: 'Auto-Dispatch Integration', fn: testAutoDispatchIntegration },
    { name: 'Dynamic Route Optimizer Integration', fn: testDynamicRouteOptimizerIntegration },
    { name: 'Smart Batching Integration', fn: testSmartBatchingIntegration },
    { name: 'Data Validation', fn: testDataValidation },
  ];

  for (const test of tests) {
    results.total++;

    try {
      const passed = await test.fn();
      if (passed) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (error) {
      logError(`Test "${test.name}" threw an error: ${error.message}`);
      results.failed++;
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  logSection('TEST SUMMARY');
  console.log('');
  log(`Total Tests: ${results.total}`, colors.bright);
  logSuccess(`Passed: ${results.passed}`);
  if (results.failed > 0) {
    logError(`Failed: ${results.failed}`);
  } else {
    log(`Failed: ${results.failed}`, colors.green);
  }
  console.log('');

  const passRate = ((results.passed / results.total) * 100).toFixed(1);
  if (results.failed === 0) {
    logSuccess(`✨ ALL TESTS PASSED! (${passRate}%)`);
  } else {
    logError(`⚠️  SOME TESTS FAILED (${passRate}% pass rate)`);
  }

  console.log('\n' + '═'.repeat(80) + '\n');

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch((error) => {
  logError(`Test suite failed: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
