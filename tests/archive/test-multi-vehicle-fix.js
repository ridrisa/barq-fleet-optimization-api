#!/usr/bin/env node

/**
 * Test Multi-Vehicle Distribution Fix
 * Verifies that all deliveries are properly distributed across multiple vehicles
 */

const axios = require('axios');

const API_URL = 'https://route-opt-backend-426674819922.us-central1.run.app/api/v1';

async function testMultiVehicleDistribution() {
  console.log('🔧 Testing Multi-Vehicle Distribution Fix\n');
  console.log('=' .repeat(60));

  const payload = {
    pickupPoints: [
      { name: 'Main Hub', lat: 24.7136, lng: 46.6753 }
    ],
    deliveryPoints: [
      { name: 'Delivery 1', lat: 24.6892, lng: 46.6239, priority: 9 },
      { name: 'Delivery 2', lat: 24.6697, lng: 46.7397, priority: 7 },
      { name: 'Delivery 3', lat: 24.6995, lng: 46.6849, priority: 8 },
      { name: 'Delivery 4', lat: 24.6461, lng: 46.7093, priority: 6 },
      { name: 'Delivery 5', lat: 24.7994, lng: 46.6142, priority: 5 },
      { name: 'Delivery 6', lat: 24.7647, lng: 46.6412, priority: 10 },
      { name: 'Delivery 7', lat: 24.7458, lng: 46.6550, priority: 7 },
      { name: 'Delivery 8', lat: 24.7136, lng: 46.7753, priority: 6 },
      { name: 'Delivery 9', lat: 24.7022, lng: 46.7006, priority: 8 },
      { name: 'Delivery 10', lat: 24.6736, lng: 46.6936, priority: 7 },
      { name: 'Delivery 11', lat: 24.6500, lng: 46.7100, priority: 5 },
      { name: 'Delivery 12', lat: 24.7500, lng: 46.7200, priority: 6 },
      { name: 'Delivery 13', lat: 24.7250, lng: 46.6900, priority: 4 }
    ],
    fleet: {
      vehicleType: 'truck',
      count: 3,
      capacity: 3000
    },
    options: {
      optimizationMode: 'balanced',
      considerTraffic: false
    }
  };

  console.log(`📦 Test Configuration:`);
  console.log(`   • Pickup Points: ${payload.pickupPoints.length}`);
  console.log(`   • Delivery Points: ${payload.deliveryPoints.length}`);
  console.log(`   • Vehicles: ${payload.fleet.count}`);
  console.log(`   • Vehicle Capacity: ${payload.fleet.capacity}kg`);
  console.log();

  try {
    console.log('🚀 Sending optimization request...\n');
    const response = await axios.post(`${API_URL}/optimize`, payload, {
      timeout: 30000
    });

    const { routes, success } = response.data;

    console.log('📊 Results:');
    console.log(`   • Success: ${success ? '✅' : '❌'}`);
    console.log(`   • Routes Generated: ${routes ? routes.length : 0}`);
    console.log();

    if (routes && routes.length > 0) {
      let totalDeliveries = 0;
      console.log('🚚 Vehicle Distribution:');

      routes.forEach((route, index) => {
        const deliveryWaypoints = route.waypoints ?
          route.waypoints.filter(w => w.type === 'delivery') : [];
        totalDeliveries += deliveryWaypoints.length;

        console.log(`   Vehicle ${index + 1}:`);
        console.log(`     • Deliveries: ${deliveryWaypoints.length}`);
        console.log(`     • Capacity Used: ${route.vehicle?.capacity || 'N/A'}kg`);

        if (deliveryWaypoints.length > 0) {
          const deliveryNames = deliveryWaypoints.map(w => w.name || w.id).join(', ');
          console.log(`     • Stops: ${deliveryNames}`);
        }
      });

      console.log();
      console.log('📈 Summary:');
      console.log(`   • Total Deliveries Serviced: ${totalDeliveries} of ${payload.deliveryPoints.length}`);
      console.log(`   • Coverage: ${((totalDeliveries / payload.deliveryPoints.length) * 100).toFixed(1)}%`);
      console.log(`   • Average per Vehicle: ${(totalDeliveries / routes.length).toFixed(1)} deliveries`);

      // Check if fix is working
      if (totalDeliveries === payload.deliveryPoints.length) {
        console.log('\n✅ SUCCESS: All deliveries are serviced!');
        console.log('The multi-vehicle distribution fix is working correctly.');
      } else {
        console.log(`\n⚠️  WARNING: Only ${totalDeliveries} of ${payload.deliveryPoints.length} deliveries serviced`);
        console.log('The issue may not be fully resolved.');
      }

      // Check distribution balance
      const minDeliveries = Math.min(...routes.map(r =>
        r.waypoints ? r.waypoints.filter(w => w.type === 'delivery').length : 0
      ));
      const maxDeliveries = Math.max(...routes.map(r =>
        r.waypoints ? r.waypoints.filter(w => w.type === 'delivery').length : 0
      ));

      if (maxDeliveries - minDeliveries <= 1) {
        console.log('✅ Load is well balanced across vehicles');
      } else {
        console.log(`⚠️  Load imbalance detected: ${minDeliveries} to ${maxDeliveries} deliveries per vehicle`);
      }

    } else {
      console.log('❌ No routes generated');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }

  console.log('\n' + '='.repeat(60));
}

// Run the test
testMultiVehicleDistribution()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });