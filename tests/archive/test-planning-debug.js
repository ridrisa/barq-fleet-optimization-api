#!/usr/bin/env node

/**
 * Debug test to understand why planning agent returns empty routes
 */

const axios = require('axios');

// API endpoint
const API_URL = 'https://route-opt-backend-426674819922.us-central1.run.app/api/v1/optimize';

async function testWithDebugLogging() {
  console.log('🔍 Testing Planning Agent Route Generation');
  console.log('═'.repeat(60));

  const payload = {
    pickupPoints: [
      {
        name: 'Main Hub',
        lat: 24.7136,
        lng: 46.6753,
        address: 'Riyadh, Saudi Arabia'
      }
    ],
    deliveryPoints: [
      { name: 'Customer 1', lat: 24.6892, lng: 46.6239, priority: 9, weight: 20 },
      { name: 'Customer 2', lat: 24.6697, lng: 46.7397, priority: 7, weight: 15 },
      { name: 'Customer 3', lat: 24.6995, lng: 46.6849, priority: 8, weight: 25 },
      { name: 'Customer 4', lat: 24.6461, lng: 46.7093, priority: 6, weight: 30 },
      { name: 'Customer 5', lat: 24.7994, lng: 46.6142, priority: 5, weight: 10 },
      { name: 'Customer 6', lat: 24.7647, lng: 46.6412, priority: 10, weight: 35 },
      { name: 'Customer 7', lat: 24.7200, lng: 46.7000, priority: 8, weight: 20 },
      { name: 'Customer 8', lat: 24.7300, lng: 46.6800, priority: 7, weight: 15 },
      { name: 'Customer 9', lat: 24.6900, lng: 46.6600, priority: 9, weight: 25 },
      { name: 'Customer 10', lat: 24.7100, lng: 46.6900, priority: 6, weight: 18 },
      { name: 'Customer 11', lat: 24.6800, lng: 46.7200, priority: 8, weight: 22 },
      { name: 'Customer 12', lat: 24.7500, lng: 46.6700, priority: 7, weight: 28 },
      { name: 'Customer 13', lat: 24.7000, lng: 46.6500, priority: 9, weight: 12 }
    ],
    fleet: {
      vehicleType: 'truck',
      count: 3,
      capacity: 3000
    },
    options: {
      optimizationMode: 'balanced',
      considerTraffic: false,
      // Add debug flag if API supports it
      debug: true
    }
  };

  console.log('\n📊 Request Summary:');
  console.log(`  • Pickup Points: ${payload.pickupPoints.length}`);
  console.log(`  • Delivery Points: ${payload.deliveryPoints.length}`);
  console.log(`  • Requested Vehicles: ${payload.fleet.count}`);
  console.log(`  • Vehicle Type: ${payload.fleet.vehicleType}`);
  console.log(`  • Vehicle Capacity: ${payload.fleet.capacity}kg`);
  console.log(`  • Total Delivery Weight: ${payload.deliveryPoints.reduce((sum, d) => sum + d.weight, 0)}kg`);
  console.log(`  • Optimization Mode: ${payload.options.optimizationMode}`);

  try {
    console.log('\n⏳ Sending optimization request...');
    console.log('Request payload:', JSON.stringify(payload, null, 2));

    const startTime = Date.now();
    const response = await axios.post(API_URL, payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const duration = Date.now() - startTime;

    console.log(`\n✅ Response received in ${duration}ms`);

    const { routes, success, requestId, error, debug } = response.data;

    if (!success) {
      console.log('\n❌ Optimization failed');
      console.log('Error:', error);
      return;
    }

    console.log('\n📋 Response Details:');
    console.log(`  • Request ID: ${requestId}`);
    console.log(`  • Routes Generated: ${routes.length}`);
    console.log(`  • Success: ${success}`);

    // Check if debug info is available
    if (debug) {
      console.log('\n🔧 Debug Information:');
      console.log(JSON.stringify(debug, null, 2));
    }

    // Analyze route distribution
    console.log('\n🚚 Route Analysis:');

    let totalDeliveries = 0;
    const vehicleLoads = [];

    routes.forEach((route, index) => {
      const deliveries = route.waypoints ?
        route.waypoints.filter(w => w.type === 'delivery') : [];

      totalDeliveries += deliveries.length;
      vehicleLoads.push(deliveries.length);

      console.log(`\n  Vehicle ${index + 1} (${route.vehicle?.id || 'N/A'}):`);
      console.log(`    • Deliveries: ${deliveries.length}`);
      console.log(`    • Distance: ${route.totalDistance?.toFixed(1) || 'N/A'}km`);
      console.log(`    • Duration: ${route.totalDuration?.toFixed(0) || 'N/A'}min`);

      if (deliveries.length > 0) {
        console.log(`    • Delivery IDs: ${deliveries.map(d => d.name || d.id).join(', ')}`);
      }

      // Check route structure
      if (!route.waypoints || route.waypoints.length === 0) {
        console.log('    ⚠️  No waypoints in route!');
      }
      if (!route.vehicle) {
        console.log('    ⚠️  No vehicle info in route!');
      }
    });

    console.log('\n' + '═'.repeat(60));
    console.log('📊 Summary:');
    console.log(`  • Total Routes: ${routes.length}`);
    console.log(`  • Total Deliveries Serviced: ${totalDeliveries} of ${payload.deliveryPoints.length}`);
    console.log(`  • Coverage: ${((totalDeliveries / payload.deliveryPoints.length) * 100).toFixed(1)}%`);

    // Check distribution
    if (routes.length === payload.fleet.count) {
      console.log(`  ✅ All ${payload.fleet.count} vehicles are being utilized`);

      const minDeliveries = Math.min(...vehicleLoads);
      const maxDeliveries = Math.max(...vehicleLoads);

      if (maxDeliveries - minDeliveries <= 2) {
        console.log(`  ✅ Load is well balanced (${minDeliveries}-${maxDeliveries} deliveries per vehicle)`);
      } else {
        console.log(`  ⚠️  Load imbalance: ${minDeliveries} to ${maxDeliveries} deliveries per vehicle`);
      }
    } else if (routes.length === 1) {
      console.log(`  ❌ Only 1 vehicle is being used (should be ${payload.fleet.count})`);
      console.log(`  🔍 Possible cause: Fallback plan is being used instead of planning agent`);
    } else {
      console.log(`  ⚠️  Only ${routes.length} of ${payload.fleet.count} vehicles are being used`);
    }

    // Check for fallback plan indicators
    if (routes.length === 1 && payload.fleet.count > 1) {
      console.log('\n⚠️  DIAGNOSTIC: Single route with multi-vehicle request');
      console.log('  This typically indicates the fallback plan is being triggered.');
      console.log('  Possible reasons:');
      console.log('  1. Planning agent returned empty routes');
      console.log('  2. Planning agent threw an error');
      console.log('  3. Fleet data format not recognized by planning agent');
    }

  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
console.log('Starting Planning Agent Debug Test...\n');
testWithDebugLogging()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });