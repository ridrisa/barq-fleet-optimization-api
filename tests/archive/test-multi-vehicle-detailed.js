#!/usr/bin/env node

/**
 * Detailed Test for Multi-Vehicle Distribution
 * Shows raw response to debug why only 1 route is generated
 */

const axios = require('axios');

const API_URL = 'https://route-opt-backend-426674819922.us-central1.run.app/api/v1';

async function testMultiVehicleDetailed() {
  console.log('🔍 Detailed Multi-Vehicle Distribution Test\n');
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

  console.log('📋 Request Payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('\n' + '='.repeat(60) + '\n');

  try {
    console.log('🚀 Sending optimization request...\n');
    const response = await axios.post(`${API_URL}/optimize`, payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('📥 Raw Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('\n' + '='.repeat(60) + '\n');

    const { routes, success, requestId, executionPlan } = response.data;

    console.log('📊 Response Analysis:');
    console.log(`   • Success: ${success ? '✅' : '❌'}`);
    console.log(`   • Request ID: ${requestId || 'N/A'}`);
    console.log(`   • Routes Generated: ${routes ? routes.length : 0} (Expected: 3)`);

    if (executionPlan) {
      console.log(`   • Optimization Engine: ${executionPlan.optimizationEngine || 'N/A'}`);
      console.log(`   • Total Deliveries: ${executionPlan.totalDeliveries || 'N/A'}`);
      console.log(`   • Total Pickups: ${executionPlan.totalPickups || 'N/A'}`);
    }
    console.log();

    if (routes && routes.length > 0) {
      console.log('🚚 Vehicle Distribution:');

      let totalDeliveries = 0;
      routes.forEach((route, index) => {
        const deliveryWaypoints = route.waypoints ?
          route.waypoints.filter(w => w.type === 'delivery') : [];
        totalDeliveries += deliveryWaypoints.length;

        console.log(`\n   Vehicle ${index + 1} (ID: ${route.vehicle?.id || 'N/A'}):`);
        console.log(`     • Vehicle Type: ${route.vehicle?.type || 'N/A'}`);
        console.log(`     • Capacity: ${route.vehicle?.capacity || 'N/A'}kg`);
        console.log(`     • Total Waypoints: ${route.waypoints ? route.waypoints.length : 0}`);
        console.log(`     • Deliveries: ${deliveryWaypoints.length}`);
        console.log(`     • Total Distance: ${route.totalDistance || 'N/A'}km`);
        console.log(`     • Total Duration: ${route.totalDuration || 'N/A'}min`);

        if (deliveryWaypoints.length > 0) {
          console.log(`     • Delivery Stops:`);
          deliveryWaypoints.forEach(wp => {
            console.log(`       - ${wp.name || wp.id} (Priority: ${wp.priority || 'N/A'})`);
          });
        }
      });

      console.log('\n' + '='.repeat(60));
      console.log('\n📈 Summary:');
      console.log(`   • Total Deliveries Serviced: ${totalDeliveries} of ${payload.deliveryPoints.length}`);
      console.log(`   • Coverage: ${((totalDeliveries / payload.deliveryPoints.length) * 100).toFixed(1)}%`);

      if (routes.length === 3) {
        console.log(`   • ✅ All 3 vehicles are being used`);
        const avgPerVehicle = (totalDeliveries / routes.length).toFixed(1);
        console.log(`   • Average per Vehicle: ${avgPerVehicle} deliveries`);

        // Check distribution balance
        const deliveriesPerRoute = routes.map(r =>
          r.waypoints ? r.waypoints.filter(w => w.type === 'delivery').length : 0
        );
        const minDeliveries = Math.min(...deliveriesPerRoute);
        const maxDeliveries = Math.max(...deliveriesPerRoute);

        if (maxDeliveries - minDeliveries <= 2) {
          console.log(`   • ✅ Load is well balanced (${minDeliveries}-${maxDeliveries} deliveries per vehicle)`);
        } else {
          console.log(`   • ⚠️  Load imbalance detected: ${minDeliveries} to ${maxDeliveries} deliveries per vehicle`);
        }
      } else {
        console.log(`   • ❌ Only ${routes.length} of 3 vehicles are being used`);
        console.log(`   • This indicates the multi-vehicle distribution needs further fixes`);
      }

      if (totalDeliveries === payload.deliveryPoints.length) {
        console.log(`   • ✅ All deliveries are serviced`);
      } else {
        console.log(`   • ❌ Only ${totalDeliveries} of ${payload.deliveryPoints.length} deliveries serviced`);

        // Find which deliveries are missing
        const servicedDeliveries = new Set();
        routes.forEach(route => {
          if (route.waypoints) {
            route.waypoints.filter(w => w.type === 'delivery').forEach(w => {
              servicedDeliveries.add(w.name || w.id);
            });
          }
        });

        const missingDeliveries = payload.deliveryPoints
          .filter(d => !servicedDeliveries.has(d.name))
          .map(d => d.name);

        if (missingDeliveries.length > 0) {
          console.log(`   • Missing deliveries: ${missingDeliveries.join(', ')}`);
        }
      }

    } else {
      console.log('❌ No routes generated in response');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('\n' + '='.repeat(60));
}

// Run the test
testMultiVehicleDetailed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });