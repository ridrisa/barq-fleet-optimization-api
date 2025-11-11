#!/usr/bin/env node

const axios = require('axios');

const API_URL = 'https://route-opt-backend-426674819922.us-central1.run.app/api/v1/optimize';

async function testMultiPickup() {
  console.log('Testing with multiple pickup points...\n');

  const payload = {
    pickupPoints: [
      { name: 'Hub 1', lat: 24.7136, lng: 46.6753 },
      { name: 'Hub 2', lat: 24.7500, lng: 46.7000 },
      { name: 'Hub 3', lat: 24.6800, lng: 46.6500 }
    ],
    deliveryPoints: [
      { name: 'D1', lat: 24.6892, lng: 46.6239, priority: 9 },
      { name: 'D2', lat: 24.6697, lng: 46.7397, priority: 7 },
      { name: 'D3', lat: 24.6995, lng: 46.6849, priority: 8 },
      { name: 'D4', lat: 24.6461, lng: 46.7093, priority: 6 },
      { name: 'D5', lat: 24.7994, lng: 46.6142, priority: 5 },
      { name: 'D6', lat: 24.7647, lng: 46.6412, priority: 10 }
    ],
    fleet: {
      vehicleType: 'truck',
      count: 3,
      capacity: 2000
    },
    options: {
      optimizationMode: 'balanced'
    }
  };

  try {
    const response = await axios.post(API_URL, payload);
    const { routes } = response.data;

    console.log(`Routes generated: ${routes.length}`);
    console.log(`Expected: 3 (one per pickup point)`);

    if (routes.length === 3) {
      console.log('✅ Multi-vehicle working with multiple pickups!');
    } else {
      console.log('❌ Still only using', routes.length, 'vehicle(s)');
    }

    routes.forEach((route, i) => {
      const deliveries = route.waypoints?.filter(w => w.type === 'delivery').length || 0;
      console.log(`  Route ${i + 1}: ${deliveries} deliveries`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testMultiPickup();