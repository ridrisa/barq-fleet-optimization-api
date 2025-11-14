/**
 * Test Enhanced CVRP Optimization
 *
 * Scenario:
 * - 3 Pickup Points (distribution centers)
 * - 30 Delivery Points (customers)
 * - 15 Vehicles available (more than pickups!)
 * - 2-hour SLA requirement
 *
 * Expected Result:
 * - System should utilize ALL 15 vehicles (not just 3)
 * - Same pickup point should be assigned to multiple vehicles
 * - Deliveries distributed to meet SLA constraints
 */

const axios = require('axios');

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_ENDPOINT = `${BASE_URL}/api/optimize`;

// Riyadh coordinates for realistic test
const RIYADH_CENTER = { lat: 24.7136, lng: 46.6753 };

/**
 * Generate pickup points (distribution centers)
 */
function generatePickupPoints(count = 3) {
  const pickups = [];

  for (let i = 0; i < count; i++) {
    pickups.push({
      id: `pickup_${i + 1}`,
      name: `Distribution Center ${i + 1}`,
      lat: RIYADH_CENTER.lat + (Math.random() - 0.5) * 0.1,
      lng: RIYADH_CENTER.lng + (Math.random() - 0.5) * 0.1,
      address: `DC ${i + 1} - Riyadh`,
      priority: 8,
    });
  }

  return pickups;
}

/**
 * Generate delivery points (customers)
 */
function generateDeliveryPoints(count = 30, pickups = []) {
  const deliveries = [];

  for (let i = 0; i < count; i++) {
    // Assign to random pickup
    const pickup = pickups[i % pickups.length];

    deliveries.push({
      id: `delivery_${i + 1}`,
      order_id: `ORD-${1000 + i}`,
      customer_name: `Customer ${i + 1}`,
      lat: RIYADH_CENTER.lat + (Math.random() - 0.5) * 0.3,
      lng: RIYADH_CENTER.lng + (Math.random() - 0.5) * 0.3,
      address: `Customer Address ${i + 1}`,
      pickup_id: pickup.id,
      load_kg: Math.floor(Math.random() * 50) + 10, // 10-60 kg
      priority: Math.floor(Math.random() * 10) + 1,
      sla_deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    });
  }

  return deliveries;
}

/**
 * Generate fleet (vehicles)
 */
function generateFleet(count = 15) {
  const fleet = [];
  const vehicleTypes = ['MOTORCYCLE', 'CAR', 'VAN', 'TRUCK'];

  for (let i = 0; i < count; i++) {
    const type = vehicleTypes[i % vehicleTypes.length];

    fleet.push({
      id: `vehicle_${i + 1}`,
      fleet_id: `FLT-${100 + i}`,
      vehicle_type: type,
      capacity_kg: type === 'MOTORCYCLE' ? 50 : type === 'CAR' ? 200 : type === 'VAN' ? 500 : 1000,
      driver_name: `Driver ${i + 1}`,
    });
  }

  return fleet;
}

/**
 * Test standard optimization (baseline)
 */
async function testStandardOptimization(pickups, deliveries, fleet) {
  console.log('\n=== Testing STANDARD Optimization ===\n');

  const request = {
    pickupPoints: pickups,
    deliveryPoints: deliveries,
    fleet: fleet,
    options: {
      // Standard optimization - no enhanced flag
      slaMinutes: 120,
    },
    preferences: {
      useCVRP: true, // Force CVRP for comparison
    },
  };

  try {
    const response = await axios.post(API_ENDPOINT, request, {
      headers: { 'Content-Type': 'application/json' },
    });

    const result = response.data;

    console.log('✅ Standard Optimization Result:');
    console.log(`   - Success: ${result.success}`);
    console.log(`   - Routes Generated: ${result.routes?.length || 0}`);
    console.log(`   - Vehicles Used: ${result.routes?.length || 0}/${fleet.length}`);
    console.log(`   - Utilization Rate: ${((result.routes?.length || 0) / fleet.length * 100).toFixed(2)}%`);
    console.log(`   - Total Distance: ${result.summary?.total_distance?.toFixed(2) || 0} km`);
    console.log(`   - Total Duration: ${result.summary?.total_duration?.toFixed(2) || 0} min`);
    console.log(`   - Optimization Engine: ${result.optimizationEngine || 'N/A'}`);

    // Analyze pickup distribution
    if (result.routes) {
      const pickupUsage = {};
      result.routes.forEach((route) => {
        const pickupStop = route.stops?.find((s) => s.type === 'pickup');
        if (pickupStop) {
          const name = pickupStop.name || 'Unknown';
          pickupUsage[name] = (pickupUsage[name] || 0) + 1;
        }
      });

      console.log('\n   Pickup Point Usage:');
      Object.entries(pickupUsage).forEach(([name, count]) => {
        console.log(`   - ${name}: ${count} vehicle(s)`);
      });
    }

    return result;
  } catch (error) {
    console.error('❌ Standard optimization failed:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test enhanced optimization
 */
async function testEnhancedOptimization(pickups, deliveries, fleet) {
  console.log('\n=== Testing ENHANCED Optimization ===\n');

  const request = {
    pickupPoints: pickups,
    deliveryPoints: deliveries,
    fleet: fleet,
    options: {
      useEnhanced: true, // Enable enhanced optimization
      slaMinutes: 120,
    },
    preferences: {
      useCVRP: true,
    },
  };

  try {
    const response = await axios.post(API_ENDPOINT, request, {
      headers: { 'Content-Type': 'application/json' },
    });

    const result = response.data;

    console.log('✅ Enhanced Optimization Result:');
    console.log(`   - Success: ${result.success}`);
    console.log(`   - Routes Generated: ${result.routes?.length || 0}`);
    console.log(`   - Vehicles Used: ${result.routes?.length || 0}/${fleet.length}`);
    console.log(`   - Utilization Rate: ${((result.routes?.length || 0) / fleet.length * 100).toFixed(2)}%`);
    console.log(`   - Total Distance: ${result.summary?.total_distance?.toFixed(2) || 0} km`);
    console.log(`   - Total Duration: ${result.summary?.total_duration?.toFixed(2) || 0} min`);
    console.log(`   - Optimization Engine: ${result.optimizationEngine || 'N/A'}`);

    // Show optimization metadata
    if (result.optimizationMetadata) {
      console.log('\n   Enhanced Optimization Metadata:');
      console.log(`   - Method: ${result.optimizationMetadata.method || 'N/A'}`);
      console.log(`   - SLA Minutes: ${result.optimizationMetadata.sla_minutes || 'N/A'}`);
      console.log(`   - Multi-Pickup Support: ${result.optimizationMetadata.multiPickupSupport || 'N/A'}`);
      console.log(`   - SLA Aware: ${result.optimizationMetadata.slaAware || 'N/A'}`);
    }

    // Analyze pickup distribution
    if (result.routes) {
      const pickupUsage = {};
      result.routes.forEach((route) => {
        const pickupStop = route.stops?.find((s) => s.type === 'pickup');
        if (pickupStop) {
          const name = pickupStop.name || 'Unknown';
          pickupUsage[name] = (pickupUsage[name] || 0) + 1;
        }
      });

      console.log('\n   Pickup Point Usage (Multi-Vehicle per Pickup):');
      Object.entries(pickupUsage).forEach(([name, count]) => {
        console.log(`   - ${name}: ${count} vehicle(s)`);
      });
    }

    return result;
  } catch (error) {
    console.error('❌ Enhanced optimization failed:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Compare results
 */
function compareResults(standardResult, enhancedResult) {
  console.log('\n=== COMPARISON ===\n');

  if (!standardResult || !enhancedResult) {
    console.log('⚠️  Cannot compare - one or both tests failed');
    return;
  }

  const standardVehicles = standardResult.routes?.length || 0;
  const enhancedVehicles = enhancedResult.routes?.length || 0;

  console.log('Vehicle Utilization:');
  console.log(`   Standard: ${standardVehicles} vehicles used`);
  console.log(`   Enhanced: ${enhancedVehicles} vehicles used`);
  console.log(`   Improvement: ${enhancedVehicles - standardVehicles > 0 ? '+' : ''}${enhancedVehicles - standardVehicles} vehicles`);

  if (enhancedVehicles > standardVehicles) {
    console.log('\n✅ SUCCESS: Enhanced optimization uses MORE vehicles!');
    console.log('   This means deliveries are distributed across multiple vehicles');
    console.log('   from the same pickup point to meet SLA requirements.');
  } else if (enhancedVehicles === standardVehicles) {
    console.log('\n⚠️  NEUTRAL: Both use same number of vehicles');
    console.log('   May indicate sufficient vehicles for workload');
  } else {
    console.log('\n❌ UNEXPECTED: Standard uses more vehicles than enhanced');
  }

  // Compare efficiency
  const standardDistance = standardResult.summary?.total_distance || 0;
  const enhancedDistance = enhancedResult.summary?.total_distance || 0;

  console.log('\nDistance Efficiency:');
  console.log(`   Standard: ${standardDistance.toFixed(2)} km`);
  console.log(`   Enhanced: ${enhancedDistance.toFixed(2)} km`);

  if (enhancedDistance > 0) {
    const distanceDiff = ((enhancedDistance - standardDistance) / standardDistance * 100).toFixed(2);
    console.log(`   Difference: ${distanceDiff}%`);

    if (Math.abs(distanceDiff) < 20) {
      console.log('   ✅ Distance impact is acceptable (< 20% difference)');
    }
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     ENHANCED CVRP OPTIMIZATION TEST SUITE                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  console.log('\n📊 Test Scenario:');
  console.log('   - 3 Pickup Points (Distribution Centers)');
  console.log('   - 30 Delivery Points (Customers)');
  console.log('   - 15 Vehicles Available');
  console.log('   - 2-Hour SLA Requirement');
  console.log('\n🎯 Expected Outcome:');
  console.log('   - Enhanced mode should utilize MORE vehicles than standard');
  console.log('   - Same pickup point assigned to MULTIPLE vehicles');
  console.log('   - All deliveries completed within SLA');

  // Generate test data
  const pickups = generatePickupPoints(3);
  const deliveries = generateDeliveryPoints(30, pickups);
  const fleet = generateFleet(15);

  console.log('\n✅ Test data generated successfully');

  // Run tests
  const standardResult = await testStandardOptimization(pickups, deliveries, fleet);
  const enhancedResult = await testEnhancedOptimization(pickups, deliveries, fleet);

  // Compare results
  compareResults(standardResult, enhancedResult);

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST COMPLETE                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
