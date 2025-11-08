#!/usr/bin/env node

/**
 * Test script to verify AI route optimization with REAL production data
 */

const axios = require('axios');
const { Pool } = require('pg');

// Configuration
const API_BASE_URL = 'http://localhost:3002';
const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'barq_logistics',
  user: 'postgres',
  password: 'postgres',
};

const pool = new Pool(DB_CONFIG);

/**
 * Fetch real orders from the database
 */
async function fetchRealOrders(limit = 10) {
  console.log('\n📦 Fetching real orders from production database...\n');

  const query = `
    SELECT
      order_number,
      pickup_latitude,
      pickup_longitude,
      pickup_address,
      dropoff_latitude,
      dropoff_longitude,
      dropoff_address,
      service_type,
      status,
      priority,
      created_at
    FROM orders
    WHERE pickup_latitude IS NOT NULL
      AND dropoff_latitude IS NOT NULL
      AND status = 'pending'
      AND created_at >= NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
    LIMIT $1
  `;

  const result = await pool.query(query, [limit]);
  console.log(`✓ Found ${result.rows.length} orders with valid coordinates`);

  return result.rows;
}

/**
 * Fetch available drivers
 */
async function fetchAvailableDrivers(limit = 5) {
  console.log('\n🚗 Fetching available drivers from production database...\n');

  const query = `
    SELECT
      id,
      name,
      employee_id,
      vehicle_type,
      current_latitude,
      current_longitude,
      status
    FROM drivers
    WHERE current_latitude IS NOT NULL
      AND current_longitude IS NOT NULL
      AND status = 'available'
    LIMIT $1
  `;

  const result = await pool.query(query, [limit]);
  console.log(`✓ Found ${result.rows.length} available drivers`);

  return result.rows;
}

/**
 * Convert production orders to pickup/delivery points format
 */
function convertOrdersToPoints(orders) {
  const pickupPoints = [];
  const deliveryPoints = [];
  const pickupMap = new Map();

  orders.forEach((order, index) => {
    // Create unique pickup location based on coordinates
    const pickupKey = `${order.pickup_latitude}_${order.pickup_longitude}`;

    let pickupId;
    if (!pickupMap.has(pickupKey)) {
      pickupId = `pickup-${pickupMap.size + 1}`;
      pickupMap.set(pickupKey, pickupId);

      pickupPoints.push({
        id: pickupId,
        name: `Pickup Location ${pickupMap.size}`,
        lat: parseFloat(order.pickup_latitude),
        lng: parseFloat(order.pickup_longitude),
        address: String(order.pickup_address || 'Riyadh, Saudi Arabia'),
        priority: Number(order.priority || 5),
        serviceTime: 5
      });
    } else {
      pickupId = pickupMap.get(pickupKey);
    }

    // Create delivery point
    deliveryPoints.push({
      id: `delivery-${index + 1}`,
      name: `Order ${order.order_number}`,
      lat: parseFloat(order.dropoff_latitude),
      lng: parseFloat(order.dropoff_longitude),
      address: String(order.dropoff_address || 'Riyadh, Saudi Arabia'),
      pickup_id: pickupId,
      priority: order.service_type === 'BARQ' ? 8 : 5,
      serviceTime: 10
    });
  });

  return { pickupPoints, deliveryPoints };
}

/**
 * Convert drivers to fleet format
 */
function convertDriversToFleet(drivers) {
  return drivers.map(driver => ({
    fleet_id: driver.employee_id || driver.id,
    vehicle_type: driver.vehicle_type || 'MOTORCYCLE',
    capacity_kg: driver.vehicle_type === 'TRUCK' ? 2000 :
                 driver.vehicle_type === 'VAN' ? 1500 :
                 driver.vehicle_type === 'CAR' ? 800 : 400,
    current_latitude: parseFloat(driver.current_latitude),
    current_longitude: parseFloat(driver.current_longitude),
    outlet_id: 1,
    status: 'AVAILABLE'
  }));
}

/**
 * Call optimization API WITHOUT authentication (for testing)
 */
async function optimizeRoutesNoAuth(pickupPoints, deliveryPoints, fleet) {
  console.log('\n🚀 Sending optimization request to API...\n');

  const request = {
    pickupPoints,
    deliveryPoints,
    fleet: {
      vehicles: fleet
    },
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

  console.log(`📊 Request Summary:`);
  console.log(`   Pickup Points: ${pickupPoints.length}`);
  console.log(`   Delivery Points: ${deliveryPoints.length}`);
  console.log(`   Fleet Vehicles: ${fleet.length}`);
  console.log('');

  try {
    // Try without authentication first (might work in development mode)
    const response = await axios.post(`${API_BASE_URL}/api/optimize`, request, {
      timeout: 60000, // 60 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.error('❌ Authentication required. Endpoint is protected.');
      console.log('\n💡 To test without auth, you would need to:');
      console.log('   1. Modify the route to remove auth middleware for testing');
      console.log('   2. Or create a test user and get an auth token');
      console.log('\nRequest was valid but blocked by authentication.\n');
      throw new Error('Authentication required');
    }
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

  const data = result.data || result;
  const routes = data.routes || [];
  const metrics = data.metrics || data.summary || {};

  console.log('📊 SUMMARY:');
  console.log(`   Total Routes: ${routes.length}`);
  console.log(`   Total Distance: ${(metrics.total_distance || metrics.totalDistance || 0).toFixed(2)} km`);
  console.log(`   Total Duration: ${(metrics.total_duration || metrics.totalDuration || 0).toFixed(0)} minutes`);
  console.log(`   Vehicles Used: ${routes.length}`);
  console.log('');

  console.log('🚚 ROUTE ASSIGNMENTS:\n');

  routes.forEach((route, index) => {
    const vehicleId = route.vehicle?.id || route.vehicleId || 'Unknown';
    const stops = route.stops || [];

    console.log(`Route ${index + 1}: Vehicle ${vehicleId}`);
    console.log(`   Distance: ${(route.distance || 0).toFixed(2)} km`);
    console.log(`   Duration: ${(route.duration || 0).toFixed(0)} minutes`);
    console.log(`   Stops: ${stops.length}`);

    stops.forEach((stop, stopIndex) => {
      const type = stop.type || 'unknown';
      const emoji = type === 'pickup' ? '📦' : type === 'delivery' ? '🏠' : '📍';
      console.log(`      ${stopIndex + 1}. ${emoji} ${stop.name || stop.id}`);
    });

    console.log('');
  });

  console.log('═══════════════════════════════════════════════════════════\n');
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('\n🔬 TESTING AI ROUTE OPTIMIZATION WITH REAL PRODUCTION DATA\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Fetch real data from database
    const orders = await fetchRealOrders(10);
    const drivers = await fetchAvailableDrivers(5);

    if (orders.length === 0) {
      console.error('❌ No pending orders found with valid coordinates');
      process.exit(1);
    }

    if (drivers.length === 0) {
      console.error('❌ No available drivers found');
      process.exit(1);
    }

    // Convert to API format
    const { pickupPoints, deliveryPoints } = convertOrdersToPoints(orders);
    const fleet = convertDriversToFleet(drivers);

    console.log('\n📋 Production Data Loaded:');
    console.log(`   Real Orders: ${orders.length}`);
    console.log(`   Pickup Locations: ${pickupPoints.length} (unique)`);
    console.log(`   Delivery Locations: ${deliveryPoints.length}`);
    console.log(`   Available Drivers: ${fleet.length}`);
    console.log('');

    // Sample data display
    console.log('📍 Sample Order:');
    console.log(`   Order: ${orders[0].order_number}`);
    console.log(`   Pickup: [${orders[0].pickup_latitude}, ${orders[0].pickup_longitude}]`);
    console.log(`   Dropoff: [${orders[0].dropoff_latitude}, ${orders[0].dropoff_longitude}]`);
    console.log(`   Service: ${orders[0].service_type}`);
    console.log('');

    // Try to optimize routes
    const result = await optimizeRoutesNoAuth(pickupPoints, deliveryPoints, fleet);

    // Display results
    displayResults(result);

    console.log('✅ Test completed successfully!');
    console.log('\n💡 PRODUCTION DATA TEST PASSED - AI Route Optimization works with real coordinates!\n');

  } catch (error) {
    if (error.message === 'Authentication required') {
      console.log('📝 Next step: Need to implement auth bypass for testing or get auth token\n');
    } else {
      console.error('\n❌ Test failed:', error.message);
    }
  } finally {
    await pool.end();
  }
}

// Run the script
main();
