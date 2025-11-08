#!/usr/bin/env node

/**
 * Test script to generate random vehicles, optimize routes, and assign drivers
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3003';
const NUM_VEHICLES = 5;
const NUM_PICKUPS = 3;
const NUM_DELIVERIES_PER_PICKUP = 4;

// Riyadh area coordinates (center: 24.7136, 46.6753)
const RIYADH_CENTER = { lat: 24.7136, lng: 46.6753 };
const RADIUS = 0.1; // ~11km radius

/**
 * Generate random coordinate within radius of center
 */
function randomLocation(center = RIYADH_CENTER, radius = RADIUS) {
  const randomAngle = Math.random() * 2 * Math.PI;
  const randomRadius = Math.random() * radius;

  return {
    latitude: center.lat + (randomRadius * Math.cos(randomAngle)),
    longitude: center.lng + (randomRadius * Math.sin(randomAngle))
  };
}

/**
 * Generate random vehicles
 */
function generateVehicles(count) {
  const vehicleTypes = ['TRUCK', 'VAN', 'MOTORCYCLE', 'CAR'];
  const vehicles = [];

  for (let i = 1; i <= count; i++) {
    const type = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
    const startLocation = randomLocation();

    vehicles.push({
      id: `vehicle-${i}`,
      name: `Driver ${i} - ${type}`,
      type: type,
      startLocation: startLocation,
      endLocation: startLocation, // Return to start
      capacity: type === 'TRUCK' ? 2000 : type === 'VAN' ? 1500 : type === 'CAR' ? 800 : 400,
      maxDistance: 100,
      maxDuration: 480 // 8 hours in minutes
    });
  }

  return vehicles;
}

/**
 * Generate random pickup points
 */
function generatePickups(count) {
  const pickups = [];

  for (let i = 1; i <= count; i++) {
    const location = randomLocation();
    pickups.push({
      id: `pickup-${i}`,
      name: `Warehouse ${i}`,
      lat: location.latitude,
      lng: location.longitude,
      address: `Warehouse ${i}, Riyadh, Saudi Arabia`,
      time_window: '08:00-18:00',
      priority: Math.floor(Math.random() * 3) + 1 // 1-3
    });
  }

  return pickups;
}

/**
 * Generate random delivery points
 */
function generateDeliveries(pickups, deliveriesPerPickup) {
  const deliveries = [];
  let deliveryCounter = 1;

  pickups.forEach(pickup => {
    for (let i = 0; i < deliveriesPerPickup; i++) {
      const location = randomLocation();
      const priorities = ['HIGH', 'MEDIUM', 'LOW'];
      deliveries.push({
        order_id: `delivery-${deliveryCounter}`,
        customer_name: `Customer ${deliveryCounter}`,
        lat: location.latitude,
        lng: location.longitude,
        address: `Customer ${deliveryCounter} Address, Riyadh, Saudi Arabia`,
        time_window: '09:00-17:00',
        priority: priorities[Math.floor(Math.random() * priorities.length)],
        pickup_id: pickup.id,
        load_kg: Math.floor(Math.random() * 100) + 10 // 10-110 kg
      });
      deliveryCounter++;
    }
  });

  return deliveries;
}

/**
 * Call optimization API
 */
async function optimizeRoutes(pickups, deliveries, vehicles) {
  console.log('\n🚀 Sending optimization request...\n');

  // Format vehicles for the API (it expects an array directly)
  const fleet = vehicles.map(v => ({
    fleet_id: v.id,
    vehicle_type: v.type,
    capacity_kg: v.capacity,
    current_latitude: v.startLocation.latitude,
    current_longitude: v.startLocation.longitude,
    outlet_id: 1,
    status: 'AVAILABLE'
  }));

  const request = {
    pickupPoints: pickups,
    deliveryPoints: deliveries,
    fleet: fleet,
    businessRules: {
      maxDriverHours: 8,
      restPeriodMinutes: 30,
      maxConsecutiveDriveTime: 4
    },
    preferences: {
      sustainabilityScore: 0.5,
      costScore: 0.5,
      serviceScore: 0.7
    }
  };

  try {
    const response = await axios.post(`${API_BASE_URL}/api/optimize`, request);
    return response.data;
  } catch (error) {
    console.error('❌ Optimization failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Display results
 */
function displayResults(result) {
  console.log('\n✅ OPTIMIZATION COMPLETE!\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Display summary
  const data = result.data || result;
  const routes = data.routes || [];
  const metrics = data.metrics || data.summary || {};

  console.log('📊 SUMMARY:');
  console.log(`   Total Routes: ${routes.length}`);
  console.log(`   Total Distance: ${(metrics.total_distance || metrics.totalDistance || 0).toFixed(2)} km`);
  console.log(`   Total Duration: ${(metrics.total_duration || metrics.totalDuration || 0).toFixed(0)} minutes`);
  console.log(`   Vehicles Used: ${routes.length}`);
  console.log('');

  // Display route details
  console.log('🚚 ROUTE ASSIGNMENTS:\n');

  routes.forEach((route, index) => {
    const vehicleId = route.vehicle?.id || route.vehicleId || 'Unknown';
    const vehicleName = route.vehicle?.name || route.vehicleName || vehicleId;
    const stops = route.stops || [];
    const waypoints = route.waypoints || [];

    console.log(`Route ${index + 1}: ${vehicleName}`);
    console.log(`   Driver: ${vehicleName}`);
    console.log(`   Distance: ${(route.distance || 0).toFixed(2)} km`);
    console.log(`   Duration: ${(route.duration || 0).toFixed(0)} minutes`);
    console.log(`   Stops: ${stops.length || waypoints.length}`);

    // List stops
    if (stops.length > 0) {
      stops.forEach((stop, stopIndex) => {
        const type = stop.type || 'unknown';
        const emoji = type === 'vehicle' ? '🚚' : type === 'pickup' ? '📦' : type === 'delivery' ? '🏠' : '📍';
        console.log(`      ${stopIndex + 1}. ${emoji} ${stop.name || stop.id} (${type})`);
      });
    } else if (waypoints.length > 0) {
      waypoints.forEach((waypoint, wpIndex) => {
        const type = waypoint.type || 'unknown';
        const emoji = type === 'start' ? '🚚' : type === 'pickup' ? '📦' : type === 'delivery' ? '🏠' : '📍';
        console.log(`      ${wpIndex + 1}. ${emoji} ${waypoint.name || waypoint.id} (${type})`);
      });
    }

    console.log('');
  });

  console.log('═══════════════════════════════════════════════════════════\n');
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('\n🎲 GENERATING RANDOM TEST DATA\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Generate data
    const vehicles = generateVehicles(NUM_VEHICLES);
    const pickups = generatePickups(NUM_PICKUPS);
    const deliveries = generateDeliveries(pickups, NUM_DELIVERIES_PER_PICKUP);

    console.log(`✓ Generated ${vehicles.length} vehicles`);
    console.log(`✓ Generated ${pickups.length} pickup points`);
    console.log(`✓ Generated ${deliveries.length} delivery points`);

    console.log('\n📍 Vehicle Locations:');
    vehicles.forEach(v => {
      console.log(`   ${v.name}: [${v.startLocation.latitude.toFixed(4)}, ${v.startLocation.longitude.toFixed(4)}]`);
    });

    console.log('\n📦 Pickup Locations:');
    pickups.forEach(p => {
      console.log(`   ${p.name}: [${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}]`);
    });

    // Optimize routes
    const result = await optimizeRoutes(pickups, deliveries, vehicles);

    // Display results
    displayResults(result);

    console.log('✅ Test completed successfully!');
    console.log('\n💡 TIP: Open http://localhost:3001 to view the routes on the map!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
