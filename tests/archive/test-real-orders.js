#!/usr/bin/env node

/**
 * Test Route Optimization with Real BARQ Fleet Orders
 * Fetches sample orders from production database and tests optimization
 */

const { Client } = require('pg');
const axios = require('axios');

// BARQ Fleet database connection (read-only replica)
const DB_CONFIG = {
  host: 'barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'barqfleet_db',
  user: 'ventgres',
  password: 'Jk56tt4HkzePFfa3ht',
  ssl: { rejectUnauthorized: false }
};

// Our optimization API endpoint
const API_URL = 'https://route-opt-backend-426674819922.us-central1.run.app/api/v1/optimize';

async function testWithRealOrders() {
  console.log('🚀 Testing Route Optimization with Real BARQ Fleet Orders');
  console.log('═'.repeat(60));

  const client = new Client(DB_CONFIG);

  try {
    console.log('\n📡 Connecting to BARQ Fleet database...');
    await client.connect();
    console.log('✅ Connected successfully');

    // Query to get sample real orders from today or recent days
    const ordersQuery = `
      SELECT
        o.id,
        o.id as tracking_number,
        o.delivery_address,
        o.delivery_latitude,
        o.delivery_longitude,
        o.priority,
        o.weight,
        o.customer_name,
        h.name as hub_name,
        h.latitude as hub_latitude,
        h.longitude as hub_longitude
      FROM orders o
      LEFT JOIN hubs h ON o.hub_id = h.id
      WHERE o.delivery_latitude IS NOT NULL
        AND o.delivery_longitude IS NOT NULL
        AND o.status IN ('pending', 'assigned')
        AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY o.created_at DESC
      LIMIT 15
    `;

    console.log('\n📦 Fetching recent orders...');
    const ordersResult = await client.query(ordersQuery);
    console.log(`Found ${ordersResult.rows.length} recent orders`);

    if (ordersResult.rows.length === 0) {
      console.log('⚠️  No recent orders found. Using sample data instead.');

      // Use sample Riyadh coordinates if no real orders
      const samplePayload = {
        pickupPoints: [
          { name: 'Riyadh Main Hub', lat: 24.7136, lng: 46.6753 }
        ],
        deliveryPoints: [
          { name: 'Al Olaya', lat: 24.6892, lng: 46.6239, priority: 9 },
          { name: 'Al Malaz', lat: 24.6697, lng: 46.7397, priority: 7 },
          { name: 'Al Muruj', lat: 24.6995, lng: 46.6849, priority: 8 },
          { name: 'Al Naseem', lat: 24.6461, lng: 46.7093, priority: 6 },
          { name: 'Al Nakheel', lat: 24.7994, lng: 46.6142, priority: 5 }
        ],
        fleet: {
          vehicleType: 'truck',
          count: 2,
          capacity: 2000
        },
        options: {
          optimizationMode: 'balanced',
          considerTraffic: true
        }
      };

      await runOptimization(samplePayload, 'Sample Data');

    } else {
      // Use real orders from database
      const hubLat = ordersResult.rows[0].hub_latitude || 24.7136;
      const hubLng = ordersResult.rows[0].hub_longitude || 46.6753;
      const hubName = ordersResult.rows[0].hub_name || 'Main Hub';

      const realPayload = {
        pickupPoints: [{
          name: hubName,
          lat: parseFloat(hubLat),
          lng: parseFloat(hubLng)
        }],
        deliveryPoints: ordersResult.rows.map(order => ({
          id: order.id,
          name: order.customer_name || `Order ${order.tracking_number}`,
          lat: parseFloat(order.delivery_latitude),
          lng: parseFloat(order.delivery_longitude),
          address: order.delivery_address,
          priority: order.priority || 5,
          weight: parseFloat(order.weight) || 10
        })),
        fleet: {
          vehicleType: 'truck',
          count: 3,  // Use 3 vehicles for real orders
          capacity: 3000
        },
        options: {
          optimizationMode: 'balanced',
          considerTraffic: true
        }
      };

      console.log('\n📍 Order Locations:');
      console.log(`  Hub: ${hubName} (${hubLat}, ${hubLng})`);
      realPayload.deliveryPoints.slice(0, 5).forEach(point => {
        console.log(`  • ${point.name}: ${point.address || 'No address'} (${point.lat}, ${point.lng})`);
      });
      if (realPayload.deliveryPoints.length > 5) {
        console.log(`  ... and ${realPayload.deliveryPoints.length - 5} more deliveries`);
      }

      await runOptimization(realPayload, 'Real BARQ Fleet Orders');
    }

  } catch (error) {
    console.error('\n❌ Database connection error:', error.message);
    console.log('\n📝 Note: If connection fails, it might be due to network restrictions.');
    console.log('   Running test with sample data instead...\n');

    // Fallback to sample data
    const fallbackPayload = {
      pickupPoints: [
        { name: 'Riyadh Hub', lat: 24.7136, lng: 46.6753 }
      ],
      deliveryPoints: Array.from({ length: 13 }, (_, i) => ({
        name: `Delivery ${i + 1}`,
        lat: 24.6500 + Math.random() * 0.15,
        lng: 46.6000 + Math.random() * 0.20,
        priority: Math.floor(Math.random() * 6) + 5
      })),
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

    await runOptimization(fallbackPayload, 'Fallback Sample Data');

  } finally {
    await client.end();
  }
}

async function runOptimization(payload, dataSource) {
  console.log('\n' + '─'.repeat(60));
  console.log(`🚀 Running Optimization (${dataSource})`);
  console.log('─'.repeat(60));
  console.log(`  • Pickup Points: ${payload.pickupPoints.length}`);
  console.log(`  • Delivery Points: ${payload.deliveryPoints.length}`);
  console.log(`  • Vehicles: ${payload.fleet.count} ${payload.fleet.vehicleType}s`);
  console.log(`  • Vehicle Capacity: ${payload.fleet.capacity}kg`);

  try {
    console.log('\n⏳ Sending optimization request...');
    const startTime = Date.now();

    const response = await axios.post(API_URL, payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const duration = Date.now() - startTime;
    console.log(`✅ Response received in ${duration}ms`);

    const { routes, success, requestId } = response.data;

    if (!success) {
      console.log('❌ Optimization failed');
      return;
    }

    console.log(`\n📊 Optimization Results:`);
    console.log(`  • Request ID: ${requestId}`);
    console.log(`  • Routes Generated: ${routes.length}`);

    let totalDeliveries = 0;
    let totalDistance = 0;
    let totalDuration = 0;

    console.log('\n🚚 Vehicle Routes:');
    routes.forEach((route, index) => {
      const deliveryWaypoints = route.waypoints ?
        route.waypoints.filter(w => w.type === 'delivery') : [];

      totalDeliveries += deliveryWaypoints.length;
      totalDistance += route.totalDistance || 0;
      totalDuration += route.totalDuration || 0;

      console.log(`\n  Vehicle ${index + 1} (${route.vehicle?.id || 'N/A'}):`);
      console.log(`    • Deliveries: ${deliveryWaypoints.length}`);
      console.log(`    • Distance: ${route.totalDistance?.toFixed(1) || 'N/A'}km`);
      console.log(`    • Duration: ${route.totalDuration?.toFixed(0) || 'N/A'}min`);

      if (deliveryWaypoints.length > 0) {
        console.log(`    • Route: ${route.waypoints.map(w =>
          w.type === 'pickup' ? '🏢' : '📦'
        ).join(' → ')}`);
      }
    });

    console.log('\n' + '═'.repeat(60));
    console.log('📈 Summary:');
    console.log(`  • Total Deliveries Serviced: ${totalDeliveries} of ${payload.deliveryPoints.length}`);
    console.log(`  • Coverage: ${((totalDeliveries / payload.deliveryPoints.length) * 100).toFixed(1)}%`);
    console.log(`  • Total Distance: ${totalDistance.toFixed(1)}km`);
    console.log(`  • Total Duration: ${(totalDuration / 60).toFixed(1)} hours`);
    console.log(`  • Average per Vehicle: ${(totalDeliveries / routes.length).toFixed(1)} deliveries`);

    // Check multi-vehicle distribution
    if (routes.length === payload.fleet.count) {
      console.log(`  ✅ All ${payload.fleet.count} vehicles are being utilized`);

      const deliveriesPerRoute = routes.map(r =>
        r.waypoints ? r.waypoints.filter(w => w.type === 'delivery').length : 0
      );
      const minDeliveries = Math.min(...deliveriesPerRoute);
      const maxDeliveries = Math.max(...deliveriesPerRoute);

      if (maxDeliveries - minDeliveries <= 2) {
        console.log(`  ✅ Load is well balanced (${minDeliveries}-${maxDeliveries} deliveries per vehicle)`);
      } else {
        console.log(`  ⚠️  Load imbalance: ${minDeliveries} to ${maxDeliveries} deliveries per vehicle`);
      }
    } else {
      console.log(`  ⚠️  Only ${routes.length} of ${payload.fleet.count} vehicles are being used`);
    }

    if (totalDeliveries === payload.deliveryPoints.length) {
      console.log(`  ✅ All deliveries are serviced`);
    } else {
      console.log(`  ⚠️  ${payload.deliveryPoints.length - totalDeliveries} deliveries not serviced`);
    }

  } catch (error) {
    console.error('\n❌ Optimization request failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run the test
testWithRealOrders()
  .then(() => {
    console.log('\n' + '═'.repeat(60));
    console.log('✅ Test completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });