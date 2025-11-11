#!/usr/bin/env node

const axios = require('axios');

// Local test endpoint
const API_URL = 'http://localhost:3002/api/v1/optimize';

async function testLocalFix() {
  console.log('🔍 Testing Multi-Vehicle Fix Locally');
  console.log('═'.repeat(60));

  const payload = {
    pickupPoints: [
      {
        name: 'Main Hub',
        lat: 24.7136,
        lng: 46.6753
      }
    ],
    deliveryPoints: [
      { name: 'Customer 1', lat: 24.6892, lng: 46.6239, priority: 9 },
      { name: 'Customer 2', lat: 24.6697, lng: 46.7397, priority: 7 },
      { name: 'Customer 3', lat: 24.6995, lng: 46.6849, priority: 8 },
      { name: 'Customer 4', lat: 24.6461, lng: 46.7093, priority: 6 },
      { name: 'Customer 5', lat: 24.7994, lng: 46.6142, priority: 5 },
      { name: 'Customer 6', lat: 24.7647, lng: 46.6412, priority: 10 },
      { name: 'Customer 7', lat: 24.7200, lng: 46.7000, priority: 8 },
      { name: 'Customer 8', lat: 24.7300, lng: 46.6800, priority: 7 },
      { name: 'Customer 9', lat: 24.6900, lng: 46.6600, priority: 9 },
      { name: 'Customer 10', lat: 24.7100, lng: 46.6900, priority: 6 },
      { name: 'Customer 11', lat: 24.6800, lng: 46.7200, priority: 8 },
      { name: 'Customer 12', lat: 24.7500, lng: 46.6700, priority: 7 },
      { name: 'Customer 13', lat: 24.7000, lng: 46.6500, priority: 9 }
    ],
    fleet: {
      vehicleType: 'truck',
      count: 3,
      capacity: 3000
    },
    options: {
      optimizationMode: 'balanced'
    }
  };

  console.log('\n📊 Request:');
  console.log(`  • Pickup Points: ${payload.pickupPoints.length}`);
  console.log(`  • Delivery Points: ${payload.deliveryPoints.length}`);
  console.log(`  • Requested Vehicles: ${payload.fleet.count}`);

  try {
    console.log('\n⏳ Sending request to local backend...');

    const response = await axios.post(API_URL, payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const { routes, success } = response.data;

    if (!success) {
      console.log('❌ Optimization failed');
      return;
    }

    console.log('\n🚚 Results:');
    console.log(`  • Routes Generated: ${routes.length}`);

    let totalDeliveries = 0;
    const deliveriesPerVehicle = [];

    routes.forEach((route, index) => {
      const deliveries = route.waypoints ?
        route.waypoints.filter(w => w.type === 'delivery') : [];

      totalDeliveries += deliveries.length;
      deliveriesPerVehicle.push(deliveries.length);

      console.log(`\n  Vehicle ${index + 1}:`);
      console.log(`    • Deliveries: ${deliveries.length}`);
      console.log(`    • Vehicle ID: ${route.vehicle?.id || 'N/A'}`);
    });

    console.log('\n' + '═'.repeat(60));
    console.log('📊 Summary:');
    console.log(`  • Total Routes: ${routes.length}`);
    console.log(`  • Total Deliveries: ${totalDeliveries} of ${payload.deliveryPoints.length}`);

    if (routes.length === payload.fleet.count) {
      console.log(`  ✅ SUCCESS: All ${payload.fleet.count} vehicles are being used!`);
      console.log(`  ✅ Planning agent is now working correctly!`);

      const min = Math.min(...deliveriesPerVehicle);
      const max = Math.max(...deliveriesPerVehicle);

      if (max - min <= 2) {
        console.log(`  ✅ Load is well balanced (${min}-${max} deliveries per vehicle)`);
      } else {
        console.log(`  ⚠️  Load imbalance: ${min} to ${max} deliveries per vehicle`);
      }
    } else if (routes.length === 1) {
      console.log(`  ❌ FAILURE: Only 1 vehicle being used (fallback plan)`);
      console.log(`  🔍 Planning agent not working, still using fallback`);
    } else {
      console.log(`  ⚠️  Only ${routes.length} of ${payload.fleet.count} vehicles used`);
    }

  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the backend is running on port 3002');
    }
  }
}

// Run the test
console.log('Starting Local Fix Test...\n');
testLocalFix()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });