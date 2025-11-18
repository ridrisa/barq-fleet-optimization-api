/**
 * Smart Batching Engine
 * Intelligently groups nearby orders using AI agents and optimization engines
 * Phase 4: Automation & Autonomous Operations
 *
 * Integrates with:
 * - Master Orchestrator Agent (decision making)
 * - Route Optimization Agent (route planning)
 * - Order Assignment Agent (driver selection)
 * - Hybrid Optimization Service (OR-Tools + OSRM)
 */

const db = require('../database');
const { logger } = require('../utils/logger');
const OrderModel = require('../models/order.model');
const masterOrchestrator = require('../agents/master-orchestrator.agent');
const routeOptimizationAgent = require('../agents/route-optimization.agent');
const orderAssignmentAgent = require('../agents/order-assignment.agent');
const hybridOptimization = require('./hybrid-optimization.service');
const barqProductionDB = require('./barqfleet-production.service');

class SmartBatchingEngine {
  constructor() {
    this.batchingInterval = 10 * 60 * 1000; // 10 minutes
    this.maxDistance = 3000; // 3km max distance between orders
    this.minOrdersInBatch = 2;
    this.maxOrdersInBatch = 5;
    this.isRunning = false;
  }

  /**
   * Start the batching engine
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Smart Batching Engine already running');
      return;
    }

    this.isRunning = true;
    logger.info('📦 Smart Batching Engine started');

    // Run batching every 10 minutes
    this.batchingTimer = setInterval(async () => {
      try {
        await this.processBatchingOpportunities();
      } catch (error) {
        logger.error('Error in batching loop:', error);
      }
    }, this.batchingInterval);

    // Run initial batch immediately
    setTimeout(() => this.processBatchingOpportunities(), 5000);
  }

  /**
   * Stop the engine
   */
  async stop() {
    if (this.batchingTimer) {
      clearInterval(this.batchingTimer);
    }
    this.isRunning = false;
    logger.info('Smart Batching Engine stopped');
  }

  /**
   * Process batching opportunities
   */
  async processBatchingOpportunities() {
    // Get unassigned orders eligible for batching
    const eligibleOrders = await this.getEligibleOrders();

    if (eligibleOrders.length < this.minOrdersInBatch) {
      logger.info('Not enough orders for batching');
      return { batchesCreated: 0, ordersAssigned: 0 };
    }

    logger.info(`📊 Analyzing ${eligibleOrders.length} orders for batching opportunities`);

    // Use Master Orchestrator to decide batching strategy
    const batchingStrategy = await this.consultMasterOrchestrator(eligibleOrders);

    if (!batchingStrategy.shouldBatch) {
      logger.info('Master Orchestrator decided not to batch at this time');
      return { batchesCreated: 0, ordersAssigned: 0 };
    }

    // Cluster orders geographically
    const clusters = await this.clusterOrders(eligibleOrders);

    logger.info(`Found ${clusters.length} potential batches`);

    let successfulBatches = 0;
    let totalOrdersAssigned = 0;

    for (const cluster of clusters) {
      try {
        const batchCreated = await this.createAndAssignBatch(cluster);
        if (batchCreated) {
          successfulBatches++;
          totalOrdersAssigned += cluster.length;
        }
      } catch (error) {
        logger.error(`Failed to create batch:`, error);
      }
    }

    logger.info(`✅ Created ${successfulBatches} batches with ${totalOrdersAssigned} orders`);
    return { batchesCreated: successfulBatches, ordersAssigned: totalOrdersAssigned };
  }

  /**
   * Get orders eligible for batching
   * Now fetching from BarqFleet production database
   */
  async getEligibleOrders() {
    try {
      // Fetch pending orders from production
      const productionOrders = await barqProductionDB.getPendingOrders(null, 100);

      // Transform and filter for batching eligibility
      const eligibleOrders = productionOrders
        .map((order) => {
          // Parse destination JSON if it's a string
          const destination =
            typeof order.destination === 'string' ? JSON.parse(order.destination) : order.destination;
          const origin = typeof order.origin === 'string' ? JSON.parse(order.origin) : order.origin;
          const customerDetails =
            typeof order.customer_details === 'string'
              ? JSON.parse(order.customer_details)
              : order.customer_details;

          // Calculate SLA deadline and minutes remaining
          const slaDeadline = order.delivery_finish
            ? new Date(order.delivery_finish)
            : new Date(new Date(order.created_at).getTime() + 2 * 60 * 60 * 1000);
          const minutesToSLA = (slaDeadline - new Date()) / 60000;

          // Skip if coordinates are missing
          if (
            !origin?.latitude &&
            !origin?.lat &&
            !destination?.latitude &&
            !destination?.lat
          ) {
            return null;
          }

          return {
            id: order.id,
            order_number: order.tracking_no,
            service_type: order.payment_type === 'COD' ? 'BULLET' : 'EXPRESS', // Map to service types
            priority: order.order_status === 'ready_for_delivery' ? 2 : 1,
            pickup_latitude: origin?.latitude || origin?.lat,
            pickup_longitude: origin?.longitude || origin?.lng || origin?.lon,
            pickup_address: origin?.address || customerDetails?.address,
            dropoff_latitude: destination?.latitude || destination?.lat,
            dropoff_longitude: destination?.longitude || destination?.lng || destination?.lon,
            dropoff_address: destination?.address || customerDetails?.address,
            sla_deadline: slaDeadline,
            created_at: order.created_at,
            package_details: order.products,
            delivery_fee: order.delivery_fee,
            minutes_to_sla: minutesToSLA,
            customer_name: customerDetails?.name || customerDetails?.customer_name,
            customer_phone: customerDetails?.phone || customerDetails?.mobile,
            tracking_no: order.tracking_no,
          };
        })
        .filter((order) => {
          if (!order) return false;

          // Only include orders that:
          // 1. Have valid coordinates
          if (!order.pickup_latitude || !order.dropoff_latitude) return false;

          // 2. Are non-express (BULLET type = COD orders)
          // if (order.service_type !== 'BULLET') return false; // Too restrictive, commenting out

          // 3. Created recently (last 30 minutes - more flexible than 15)
          const orderAge = (new Date() - new Date(order.created_at)) / 60000;
          if (orderAge > 30) return false;

          // 4. Not urgent (at least 30 minutes until SLA - more flexible than 1 hour)
          if (order.minutes_to_sla < 30) return false;

          return true;
        });

      // Sort by creation time
      eligibleOrders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      // Limit to 50
      const limitedOrders = eligibleOrders.slice(0, 50);

      logger.info(
        `Fetched ${limitedOrders.length} eligible orders for batching from production (${productionOrders.length} total pending)`
      );

      return limitedOrders;
    } catch (error) {
      logger.error('Failed to fetch eligible orders from production:', error);
      // Fallback to local database if production fails
      const result = await db.query(`
        SELECT
          o.id,
          o.order_number,
          o.service_type,
          o.priority,
          o.pickup_latitude,
          o.pickup_longitude,
          o.pickup_address,
          o.dropoff_latitude,
          o.dropoff_longitude,
          o.dropoff_address,
          o.sla_deadline,
          o.created_at,
          o.package_details,
          o.delivery_fee,
          EXTRACT(EPOCH FROM (o.sla_deadline - NOW())) / 60 AS minutes_to_sla,

          -- Customer info
          c.name AS customer_name,
          c.phone AS customer_phone

        FROM orders o
        JOIN customers c ON c.id = o.customer_id
        WHERE o.status = 'pending'
          AND o.driver_id IS NULL

          -- Only batch non-express orders (BULLET has more time)
          AND o.service_type = 'BULLET'

          -- Created in last 15 minutes
          AND o.created_at > NOW() - INTERVAL '15 minutes'

          -- Not urgent (at least 1 hour until SLA)
          AND o.sla_deadline > NOW() + INTERVAL '1 hour'

        ORDER BY o.created_at ASC
        LIMIT 50
      `);
      return result.rows;
    }
  }

  /**
   * Consult Master Orchestrator for batching decision
   */
  async consultMasterOrchestrator(orders) {
    try {
      const context = {
        totalOrders: orders.length,
        serviceTypes: [...new Set(orders.map((o) => o.service_type))],
        averageMinutesToSLA: orders.reduce((sum, o) => sum + o.minutes_to_sla, 0) / orders.length,
        currentTime: new Date().toISOString(),
        historicalData: await this.getHistoricalBatchingMetrics(),
      };

      // Ask master orchestrator if batching is appropriate
      const decision = await masterOrchestrator.decideBatchingStrategy(context);

      return {
        shouldBatch: decision.shouldBatch,
        maxBatchSize: decision.recommendedMaxSize || this.maxOrdersInBatch,
        maxDistance: decision.recommendedMaxDistance || this.maxDistance,
        reasoning: decision.reasoning,
      };
    } catch (error) {
      logger.error('Error consulting master orchestrator:', error);
      // Fallback to default batching
      return {
        shouldBatch: true,
        maxBatchSize: this.maxOrdersInBatch,
        maxDistance: this.maxDistance,
        reasoning: 'Using default strategy',
      };
    }
  }

  /**
   * Get historical batching performance
   */
  async getHistoricalBatchingMetrics() {
    const result = await db.query(`
      SELECT
        COUNT(*) AS total_batches,
        AVG(orders_in_batch) AS avg_batch_size,
        AVG(completion_rate) AS avg_completion_rate,
        AVG(time_saved_percentage) AS avg_time_saved
      FROM batch_performance
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);

    return result.rows[0] || {};
  }

  /**
   * Cluster orders using geographic proximity and AI optimization
   */
  async clusterOrders(orders) {
    if (orders.length < this.minOrdersInBatch) {
      return [];
    }

    // Use DBSCAN-like clustering algorithm
    const clusters = [];
    const visited = new Set();

    for (const order of orders) {
      if (visited.has(order.id)) continue;

      const cluster = [order];
      visited.add(order.id);

      // Find nearby orders
      for (const otherOrder of orders) {
        if (visited.has(otherOrder.id)) continue;
        if (cluster.length >= this.maxOrdersInBatch) break;

        const distance = this.calculateDistance(
          order.dropoff_latitude,
          order.dropoff_longitude,
          otherOrder.dropoff_latitude,
          otherOrder.dropoff_longitude
        );

        if (distance <= this.maxDistance) {
          // Check if adding this order makes sense
          const isCompatible = await this.checkOrderCompatibility(cluster, otherOrder);

          if (isCompatible) {
            cluster.push(otherOrder);
            visited.add(otherOrder.id);
          }
        }
      }

      // Only keep clusters with minimum size
      if (cluster.length >= this.minOrdersInBatch) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * Check if order is compatible with existing batch
   */
  async checkOrderCompatibility(batch, newOrder) {
    // Check service type compatibility
    const serviceTypes = new Set(batch.map((o) => o.service_type));
    serviceTypes.add(newOrder.service_type);

    if (serviceTypes.size > 1) {
      // Don't mix service types
      return false;
    }

    // Check SLA deadline compatibility
    const slaDeadlines = batch.map((o) => new Date(o.sla_deadline));
    slaDeadlines.push(new Date(newOrder.sla_deadline));

    const minSLA = Math.min(...slaDeadlines);
    const maxSLA = Math.max(...slaDeadlines);

    // SLA spread should be < 1 hour
    if (maxSLA - minSLA > 60 * 60 * 1000) {
      return false;
    }

    // Check package compatibility (weight, size, special handling)
    // TODO: Implement based on package_details

    return true;
  }

  /**
   * Create and assign batch to best driver
   */
  async createAndAssignBatch(cluster) {
    logger.info(`Creating batch with ${cluster.length} orders`);

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Create batch record
      const batchResult = await client.query(
        `
        INSERT INTO order_batches (
          batch_number,
          order_count,
          service_type,
          status,
          created_at
        ) VALUES (
          $1, $2, $3, 'PENDING', NOW()
        ) RETURNING id, batch_number
      `,
        [`BATCH-${Date.now()}`, cluster.length, cluster[0].service_type]
      );

      const batchId = batchResult.rows[0].id;
      const batchNumber = batchResult.rows[0].batch_number;

      // Associate orders with batch
      for (const order of cluster) {
        await client.query(
          `
          UPDATE orders
          SET batch_id = $1
          WHERE id = $2
        `,
          [batchId, order.id]
        );
      }

      await client.query('COMMIT');

      logger.info(`✅ Created batch ${batchNumber}`);

      // Use Order Assignment Agent to find best driver for this batch
      const assignedDriver = await this.assignBatchToDriver(batchId, cluster);

      if (assignedDriver) {
        // Use Route Optimization Agent to create optimized multi-stop route
        await this.optimizeBatchRoute(batchId, assignedDriver.id, cluster);

        return true;
      } else {
        logger.warn(`No driver available for batch ${batchNumber}`);

        // Unlink orders from batch
        await client.query(
          `
          UPDATE orders
          SET batch_id = NULL
          WHERE batch_id = $1
        `,
          [batchId]
        );

        return false;
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Assign batch to best driver using Order Assignment Agent
   */
  async assignBatchToDriver(batchId, orders) {
    try {
      // Prepare context for Order Assignment Agent
      const assignmentContext = {
        orderIds: orders.map((o) => o.id),
        orderCount: orders.length,
        serviceType: orders[0].service_type,
        pickupLocations: orders.map((o) => ({
          lat: o.pickup_latitude,
          lng: o.pickup_longitude,
          address: o.pickup_address,
        })),
        deliveryLocations: orders.map((o) => ({
          lat: o.dropoff_latitude,
          lng: o.dropoff_longitude,
          address: o.dropoff_address,
        })),
        totalValue: orders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0),
        earliestSLA: Math.min(...orders.map((o) => new Date(o.sla_deadline))),
      };

      // Use Order Assignment Agent to find best driver
      const assignment = await orderAssignmentAgent.assignBatch(assignmentContext);

      if (!assignment || !assignment.driverId) {
        return null;
      }

      // Assign all orders in batch to this driver
      for (const order of orders) {
        await OrderModel.assignDriver(order.id, assignment.driverId);
      }

      // Update batch status
      await db.query(
        `
        UPDATE order_batches
        SET driver_id = $1,
            status = 'ASSIGNED',
            assigned_at = NOW()
        WHERE id = $2
      `,
        [assignment.driverId, batchId]
      );

      logger.info(`✅ Assigned batch to driver ${assignment.driverName}`);

      return assignment;
    } catch (error) {
      logger.error('Error assigning batch to driver:', error);
      return null;
    }
  }

  /**
   * Optimize batch route using Route Optimization Agent and Hybrid Optimization
   */
  async optimizeBatchRoute(batchId, driverId, orders) {
    try {
      // Get driver's current location
      const driver = await db.query(
        `
        SELECT
          id,
          name,
          current_latitude,
          current_longitude
        FROM drivers
        WHERE id = $1
      `,
        [driverId]
      );

      if (driver.rows.length === 0) {
        throw new Error('Driver not found');
      }

      const driverLocation = {
        lat: driver.rows[0].current_latitude,
        lng: driver.rows[0].current_longitude,
      };

      // Build stops list (pickups + deliveries)
      const stops = [];

      for (const order of orders) {
        // Add pickup stop
        stops.push({
          orderId: order.id,
          type: 'PICKUP',
          location: {
            lat: order.pickup_latitude,
            lng: order.pickup_longitude,
            address: order.pickup_address,
          },
          timeWindow: null,
        });

        // Add delivery stop
        stops.push({
          orderId: order.id,
          type: 'DELIVERY',
          location: {
            lat: order.dropoff_latitude,
            lng: order.dropoff_longitude,
            address: order.dropoff_address,
          },
          timeWindow: {
            start: null,
            end: order.sla_deadline,
          },
        });
      }

      // Use Route Optimization Agent for intelligent route planning
      const optimizationContext = {
        driverLocation,
        stops,
        vehicleType: driver.rows[0].vehicle_type,
        constraints: {
          maxStops: stops.length,
          maxDuration: 240, // 4 hours max for BULLET
          mustPickupBeforeDelivery: true,
        },
      };

      const optimizedRoute =
        await routeOptimizationAgent.optimizeMultiStopRoute(optimizationContext);

      if (!optimizedRoute) {
        // Fallback to Hybrid Optimization Service
        logger.info('Using fallback hybrid optimization');

        const fallbackRoute = await hybridOptimization.optimizeMultiStop({
          origin: driverLocation,
          stops: stops.map((s) => s.location),
          serviceType: orders[0].service_type,
        });

        optimizedRoute = fallbackRoute;
      }

      // Save optimized route
      await this.saveOptimizedRoute(driverId, batchId, optimizedRoute, stops);

      logger.info(`✅ Optimized batch route with ${stops.length} stops`);

      return optimizedRoute;
    } catch (error) {
      logger.error('Error optimizing batch route:', error);
      throw error;
    }
  }

  /**
   * Save optimized route to database
   */
  async saveOptimizedRoute(driverId, batchId, route, stops) {
    const routeResult = await db.query(
      `
      INSERT INTO driver_routes (
        driver_id,
        batch_id,
        total_distance_km,
        total_duration_minutes,
        route_sequence,
        polyline,
        is_active,
        optimized_at
      ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
      RETURNING id
    `,
      [
        driverId,
        batchId,
        route.distance / 1000,
        route.duration / 60,
        JSON.stringify(route.sequence || []),
        route.polyline,
      ]
    );

    const routeId = routeResult.rows[0].id;

    // Save stop sequence
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      const eta = new Date(Date.now() + (route.duration / stops.length) * (i + 1) * 1000);

      await db.query(
        `
        INSERT INTO driver_route_stops (
          route_id,
          order_id,
          sequence_position,
          stop_type,
          estimated_arrival
        ) VALUES ($1, $2, $3, $4, $5)
      `,
        [routeId, stop.orderId, i + 1, stop.type, eta]
      );

      // Update order ETA
      if (stop.type === 'DELIVERY') {
        await OrderModel.updateETA(stop.orderId, eta);
      }
    }
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Get batching statistics
   */
  async getStats(startDate, endDate) {
    const result = await db.query(
      `
      SELECT
        COUNT(*) AS total_batches,
        AVG(order_count) AS avg_orders_per_batch,
        SUM(order_count) AS total_orders_batched,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_batches,
        AVG(
          EXTRACT(EPOCH FROM (completed_at - assigned_at)) / 60
        ) AS avg_completion_time_minutes
      FROM order_batches
      WHERE created_at BETWEEN $1 AND $2
    `,
      [startDate, endDate]
    );

    return result.rows[0];
  }

  /**
   * Get batch efficiency metrics
   */
  async getBatchEfficiencyMetrics() {
    const result = await db.query(`
      WITH batch_comparison AS (
        SELECT
          ob.id AS batch_id,
          ob.order_count,

          -- Calculate if batched vs individual
          (
            SELECT SUM(
              ST_Distance(
                ST_MakePoint(o1.pickup_longitude, o1.pickup_latitude)::geography,
                ST_MakePoint(o1.dropoff_longitude, o1.dropoff_latitude)::geography
              )
            ) / 1000
            FROM orders o1
            WHERE o1.batch_id = ob.id
          ) AS individual_total_distance,

          dr.total_distance_km AS batched_distance,

          (
            SELECT SUM(
              EXTRACT(EPOCH FROM (o2.sla_deadline - o2.created_at)) / 60
            )
            FROM orders o2
            WHERE o2.batch_id = ob.id
          ) AS individual_total_time,

          dr.total_duration_minutes AS batched_time

        FROM order_batches ob
        JOIN driver_routes dr ON dr.batch_id = ob.id
        WHERE ob.status = 'COMPLETED'
          AND ob.created_at > NOW() - INTERVAL '7 days'
      )
      SELECT
        COUNT(*) AS total_batches_analyzed,
        AVG((individual_total_distance - batched_distance) / individual_total_distance * 100) AS avg_distance_saved_pct,
        AVG((individual_total_time - batched_time) / individual_total_time * 100) AS avg_time_saved_pct,
        SUM(individual_total_distance - batched_distance) AS total_km_saved
      FROM batch_comparison
      WHERE individual_total_distance > 0
        AND individual_total_time > 0
    `);

    return result.rows[0] || {};
  }
}

module.exports = new SmartBatchingEngine();
