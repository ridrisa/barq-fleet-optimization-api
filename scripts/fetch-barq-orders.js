#!/usr/bin/env node

/**
 * Fetch Real Orders from BARQ Fleet Database
 * Connects to production database and retrieves actual orders for route optimization
 */

const { Client } = require('pg');
const axios = require('axios');
require('dotenv').config();

// Database connection configuration (from barqfleet_connect.py)
const DB_CONFIG = {
  host: 'barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'barqfleet_db',
  user: 'ventgres',
  password: 'Jk56tt4HkzePFfa3ht',
  ssl: true
};

// API endpoint for optimization
const OPTIMIZATION_API = process.env.API_URL || 'https://route-opt-backend-426674819922.us-central1.run.app/api/v1/optimize';

async function fetchBARQOrders(options = {}) {
  const {
    limit = 50,
    status = 'pending',
    hubId = null,
    date = new Date().toISOString().split('T')[0]
  } = options;

  const client = new Client(DB_CONFIG);

  try {
    console.log('🔗 Connecting to BARQ Fleet database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Fetch hubs for pickup points
    console.log('📦 Fetching hubs...');
    const hubsQuery = `
      SELECT
        id,
        name,
        address,
        latitude,
        longitude,
        capacity
      FROM hubs
      WHERE status = 'active'
      ${hubId ? `AND id = $1` : ''}
      LIMIT 5
    `;

    const hubsResult = await client.query(hubsQuery, hubId ? [hubId] : []);
    console.log(`Found ${hubsResult.rows.length} active hubs\n`);

    // Fetch orders with delivery locations
    console.log('📋 Fetching orders...');
    const ordersQuery = `
      SELECT
        o.id AS order_id,
        o.tracking_number,
        o.status,
        o.priority,
        o.weight,
        o.volume,
        o.delivery_address,
        o.delivery_latitude,
        o.delivery_longitude,
        o.pickup_latitude,
        o.pickup_longitude,
        o.customer_name,
        o.customer_phone,
        o.delivery_time_window_start,
        o.delivery_time_window_end,
        o.notes,
        o.hub_id,
        h.name AS hub_name,
        h.latitude AS hub_latitude,
        h.longitude AS hub_longitude
      FROM orders o
      LEFT JOIN hubs h ON o.hub_id = h.id
      WHERE 1=1
        ${status ? `AND o.status = '${status}'` : ''}
        ${date ? `AND DATE(o.created_at) = '${date}'` : ''}
        AND o.delivery_latitude IS NOT NULL
        AND o.delivery_longitude IS NOT NULL
      ORDER BY o.priority DESC, o.created_at ASC
      LIMIT ${limit}
    `;

    const ordersResult = await client.query(ordersQuery);
    console.log(`Found ${ordersResult.rows.length} orders for ${date}\n`);

    if (ordersResult.rows.length === 0) {
      console.log('⚠️  No orders found for the specified criteria');
      return null;
    }

    // Fetch available vehicles
    console.log('🚚 Fetching available vehicles...');
    const vehiclesQuery = `
      SELECT
        v.id,
        v.registration_number,
        v.type,
        v.capacity_weight,
        v.capacity_volume,
        v.status,
        c.name AS courier_name,
        c.phone AS courier_phone
      FROM vehicles v
      LEFT JOIN couriers c ON v.courier_id = c.id
      WHERE v.status = 'available'
      ORDER BY v.capacity_weight DESC
      LIMIT 10
    `;

    const vehiclesResult = await client.query(vehiclesQuery);
    console.log(`Found ${vehiclesResult.rows.length} available vehicles\n`);

    // Group orders by hub for better route planning
    const ordersByHub = {};
    ordersResult.rows.forEach(order => {
      const hubId = order.hub_id || 'default';
      if (!ordersByHub[hubId]) {
        ordersByHub[hubId] = {
          hub: {
            id: hubId,
            name: order.hub_name || 'Main Hub',
            lat: order.hub_latitude || order.pickup_latitude || 24.7136,
            lng: order.hub_longitude || order.pickup_longitude || 46.6753
          },
          orders: []
        };
      }
      ordersByHub[hubId].orders.push(order);
    });

    // Format data for optimization API
    const optimizationRequests = [];

    Object.values(ordersByHub).forEach(hubData => {
      const request = {
        pickupPoints: [{
          id: hubData.hub.id,
          name: hubData.hub.name,
          lat: parseFloat(hubData.hub.lat),
          lng: parseFloat(hubData.hub.lng),
          address: hubData.hub.address || 'Hub Location'
        }],
        deliveryPoints: hubData.orders.map(order => ({
          id: order.order_id,
          name: order.customer_name || `Order ${order.tracking_number}`,
          lat: parseFloat(order.delivery_latitude),
          lng: parseFloat(order.delivery_longitude),
          address: order.delivery_address,
          priority: order.priority || 5,
          weight: order.weight || 10,
          volume: order.volume || 0.1,
          timeWindow: order.delivery_time_window_start ? {
            start: order.delivery_time_window_start,
            end: order.delivery_time_window_end
          } : null,
          notes: order.notes,
          phone: order.customer_phone,
          trackingNumber: order.tracking_number
        })),
        fleet: {
          vehicleType: 'mixed',
          count: Math.min(vehiclesResult.rows.length, Math.ceil(hubData.orders.length / 5)),
          vehicles: vehiclesResult.rows.map(v => ({
            id: v.id,
            registrationNumber: v.registration_number,
            type: v.type,
            capacity: v.capacity_weight || 1000,
            volume: v.capacity_volume || 10,
            courier: {
              name: v.courier_name,
              phone: v.courier_phone
            }
          }))
        },
        options: {
          optimizationMode: 'balanced',
          considerTraffic: true,
          useTimeWindows: true,
          maxRouteDistance: 150,
          maxRouteDuration: 480
        }
      };

      optimizationRequests.push(request);
    });

    return optimizationRequests;

  } catch (error) {
    console.error('❌ Database error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

async function optimizeRoutes(requests) {
  console.log('🚀 Sending optimization requests...\n');

  const results = [];

  for (const [index, request] of requests.entries()) {
    console.log(`\nProcessing hub ${index + 1}/${requests.length}:`);
    console.log(`  • Pickup: ${request.pickupPoints[0].name}`);
    console.log(`  • Deliveries: ${request.deliveryPoints.length}`);
    console.log(`  • Vehicles: ${request.fleet.count}`);

    try {
      const response = await axios.post(OPTIMIZATION_API, request, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        const { routes } = response.data;
        console.log(`  ✅ Generated ${routes.length} routes`);

        // Calculate statistics
        let totalDeliveries = 0;
        routes.forEach((route, i) => {
          const deliveries = route.waypoints.filter(w => w.type === 'delivery').length;
          totalDeliveries += deliveries;
          console.log(`     Route ${i + 1}: ${deliveries} deliveries, ${route.totalDistance}km, ${route.totalDuration}min`);
        });

        console.log(`  📊 Coverage: ${totalDeliveries}/${request.deliveryPoints.length} deliveries`);

        results.push({
          hub: request.pickupPoints[0].name,
          success: true,
          routes: routes,
          coverage: totalDeliveries / request.deliveryPoints.length,
          request: request
        });
      } else {
        console.log(`  ❌ Optimization failed`);
        results.push({
          hub: request.pickupPoints[0].name,
          success: false,
          error: response.data.error
        });
      }

    } catch (error) {
      console.error(`  ❌ Request failed:`, error.message);
      results.push({
        hub: request.pickupPoints[0].name,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

async function saveResults(results) {
  const fs = require('fs');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `optimization-results-${timestamp}.json`;

  fs.writeFileSync(filename, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to ${filename}`);

  // Generate summary report
  const summary = {
    timestamp: new Date().toISOString(),
    totalHubs: results.length,
    successfulOptimizations: results.filter(r => r.success).length,
    totalRoutes: results.reduce((sum, r) => sum + (r.routes?.length || 0), 0),
    totalDeliveries: results.reduce((sum, r) => {
      if (!r.routes) return sum;
      return sum + r.routes.reduce((routeSum, route) => {
        return routeSum + route.waypoints.filter(w => w.type === 'delivery').length;
      }, 0);
    }, 0),
    averageCoverage: results
      .filter(r => r.coverage)
      .reduce((sum, r) => sum + r.coverage, 0) / results.filter(r => r.coverage).length
  };

  console.log('\n📊 Summary Report:');
  console.log('═'.repeat(60));
  console.log(`  Total Hubs Processed: ${summary.totalHubs}`);
  console.log(`  Successful Optimizations: ${summary.successfulOptimizations}`);
  console.log(`  Total Routes Generated: ${summary.totalRoutes}`);
  console.log(`  Total Deliveries Planned: ${summary.totalDeliveries}`);
  console.log(`  Average Coverage: ${(summary.averageCoverage * 100).toFixed(1)}%`);
  console.log('═'.repeat(60));

  return summary;
}

// Main execution
async function main() {
  console.log('🚀 BARQ Fleet Order Optimization Tool');
  console.log('═'.repeat(60));
  console.log('Fetching real orders from production database...\n');

  try {
    // Fetch orders with different options
    const options = {
      limit: 30,           // Fetch 30 orders
      status: 'pending',   // Only pending orders
      date: new Date().toISOString().split('T')[0]  // Today's orders
    };

    const optimizationRequests = await fetchBARQOrders(options);

    if (!optimizationRequests || optimizationRequests.length === 0) {
      console.log('No orders to optimize');
      return;
    }

    console.log(`\n📦 Prepared ${optimizationRequests.length} optimization request(s)`);
    console.log('═'.repeat(60));

    // Optimize routes
    const results = await optimizeRoutes(optimizationRequests);

    // Save and report results
    await saveResults(results);

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Process completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n❌ Process failed:', err);
      process.exit(1);
    });
}

module.exports = { fetchBARQOrders, optimizeRoutes };