/**
 * Auto-Dispatch Engine
 * Intelligent automatic order assignment to drivers
 * Phase 4: Automation & Autonomous Operations
 */

const db = require('../database');
const { logger } = require('../utils/logger');
const redis = require('../config/redis.config');
const OrderModel = require('../models/order.model');
const DriverModel = require('../models/driver.model');

class AutoDispatchEngine {
  constructor() {
    this.offerTimeout = 30; // seconds to accept order
    this.maxOffersPerOrder = 3; // Try top 3 drivers
    this.isRunning = false;
  }

  /**
   * Start the auto-dispatch engine
   * Runs continuously in the background
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Auto-dispatch engine already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Auto-Dispatch Engine started');

    // Process unassigned orders every 10 seconds
    this.dispatchInterval = setInterval(async () => {
      try {
        await this.processUnassignedOrders();
      } catch (error) {
        logger.error('Error in auto-dispatch loop:', error);
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Stop the engine
   */
  async stop() {
    if (this.dispatchInterval) {
      clearInterval(this.dispatchInterval);
      this.isRunning = false;
      logger.info('Auto-Dispatch Engine stopped');
    }
  }

  /**
   * Process all unassigned orders
   */
  async processUnassignedOrders() {
    const unassignedOrders = await this.getUnassignedOrders();

    if (unassignedOrders.length === 0) {
      return;
    }

    logger.info(`📦 Processing ${unassignedOrders.length} unassigned orders`);

    for (const order of unassignedOrders) {
      try {
        await this.assignOrder(order.id);
      } catch (error) {
        logger.error(`Failed to assign order ${order.id}:`, error);
      }
    }
  }

  /**
   * Get unassigned orders that need drivers
   */
  async getUnassignedOrders() {
    const result = await db.query(`
      SELECT
        o.id,
        o.order_number,
        o.tracking_number,
        o.service_type,
        o.priority,
        o.pickup_latitude,
        o.pickup_longitude,
        o.dropoff_latitude,
        o.dropoff_longitude,
        o.sla_deadline,
        o.created_at,
        EXTRACT(EPOCH FROM (o.sla_deadline - NOW())) / 60 AS minutes_to_sla
      FROM orders o
      WHERE o.status = 'PENDING'
        AND o.driver_id IS NULL
        AND o.created_at > NOW() - INTERVAL '2 hours'
      ORDER BY
        o.priority DESC,
        o.sla_deadline ASC
      LIMIT 50
    `);

    return result.rows;
  }

  /**
   * Main assignment logic for an order
   */
  async assignOrder(orderId) {
    const order = await OrderModel.findById(orderId);

    if (!order || order.driver_id) {
      return null; // Already assigned
    }

    logger.info(`🎯 Auto-assigning order ${order.tracking_number}`);

    // Find eligible drivers
    const eligibleDrivers = await this.findEligibleDrivers(order);

    if (eligibleDrivers.length === 0) {
      logger.warn(`No eligible drivers for order ${order.tracking_number}`);

      // Escalate if critical
      if (order.minutes_to_sla < 30) {
        await this.escalateNoDriverAvailable(order);
      }

      return null;
    }

    // Score each driver
    const scoredDrivers = await Promise.all(
      eligibleDrivers.map((driver) => this.scoreDriver(driver, order))
    );

    // Sort by score (highest first)
    scoredDrivers.sort((a, b) => b.totalScore - a.totalScore);

    logger.info(
      `Found ${scoredDrivers.length} eligible drivers, top score: ${scoredDrivers[0].totalScore.toFixed(2)}`
    );

    // Try to offer to best drivers (top 3)
    for (let i = 0; i < Math.min(this.maxOffersPerOrder, scoredDrivers.length); i++) {
      const scored = scoredDrivers[i];

      logger.info(
        `Offering order to driver ${scored.driver.name} (score: ${scored.totalScore.toFixed(2)})`
      );

      const accepted = await this.offerToDriver(scored.driver.id, orderId, this.offerTimeout);

      if (accepted) {
        logger.info(`✅ Driver ${scored.driver.name} accepted order ${order.tracking_number}`);

        // Update order
        await OrderModel.assignDriver(orderId, scored.driver.id);

        // Optimize driver's route
        await this.optimizeDriverRoute(scored.driver.id);

        // Log assignment
        await this.logAssignment(orderId, scored.driver.id, 'AUTO_ASSIGNED', scored);

        return scored.driver;
      }

      logger.info(`Driver ${scored.driver.name} declined/timeout order ${order.tracking_number}`);
    }

    // No driver accepted - fallback to force assignment
    logger.warn(
      `No driver accepted order ${order.tracking_number}, force-assigning to best driver`
    );

    const bestDriver = scoredDrivers[0].driver;
    await OrderModel.assignDriver(orderId, bestDriver.id);
    await this.optimizeDriverRoute(bestDriver.id);
    await this.logAssignment(orderId, bestDriver.id, 'FORCE_ASSIGNED', scoredDrivers[0]);

    return bestDriver;
  }

  /**
   * Find drivers eligible for this order
   */
  async findEligibleDrivers(order) {
    const result = await db.query(
      `
      SELECT
        d.id,
        d.name,
        d.phone,
        d.vehicle_type,
        d.vehicle_number,
        d.current_latitude,
        d.current_longitude,
        d.status,
        d.shift_start,
        d.shift_end,

        -- Current load
        (
          SELECT COUNT(*)
          FROM orders o2
          WHERE o2.driver_id = d.id
            AND o2.status IN ('ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY')
        ) AS active_orders,

        -- Distance to pickup (km)
        ST_Distance(
          ST_MakePoint(d.current_longitude, d.current_latitude)::geography,
          ST_MakePoint($2, $3)::geography
        ) / 1000 AS distance_to_pickup,

        -- Driver performance metrics
        dp.total_deliveries,
        dp.on_time_deliveries,
        dp.sla_compliance_rate,
        dp.average_rating,
        dp.total_distance_km,

        -- Zone experience
        (
          SELECT COUNT(*)
          FROM orders o3
          WHERE o3.driver_id = d.id
            AND o3.status = 'DELIVERED'
            AND ST_DWithin(
              ST_MakePoint(o3.dropoff_longitude, o3.dropoff_latitude)::geography,
              ST_MakePoint($4, $5)::geography,
              5000
            )
        ) AS deliveries_in_zone

      FROM drivers d
      LEFT JOIN driver_performance dp ON dp.driver_id = d.id
      WHERE d.status = 'AVAILABLE'
        AND d.is_active = true
        AND d.current_latitude IS NOT NULL
        AND d.current_longitude IS NOT NULL

        -- Within reasonable distance (20km)
        AND ST_Distance(
          ST_MakePoint(d.current_longitude, d.current_latitude)::geography,
          ST_MakePoint($2, $3)::geography
        ) <= 20000

        -- Not overloaded
        AND (
          SELECT COUNT(*)
          FROM orders o2
          WHERE o2.driver_id = d.id
            AND o2.status IN ('ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY')
        ) < $6

        -- Vehicle type matches if specified
        AND (
          $7::VARCHAR IS NULL OR
          d.vehicle_type = $7
        )

      ORDER BY distance_to_pickup ASC
      LIMIT 20
    `,
      [
        order.id,
        order.pickup_longitude,
        order.pickup_latitude,
        order.dropoff_longitude,
        order.dropoff_latitude,
        5, // Max orders per driver
        order.vehicle_type_required || null,
      ]
    );

    return result.rows;
  }

  /**
   * Score a driver for order assignment
   * Returns 0-100 score
   */
  async scoreDriver(driver, order) {
    const scores = {
      // 1. Proximity to pickup (40% weight)
      proximity: this.calculateProximityScore(driver.distance_to_pickup),

      // 2. Driver performance (30% weight)
      performance: this.calculatePerformanceScore(driver),

      // 3. Current capacity (20% weight)
      capacity: this.calculateCapacityScore(driver.active_orders),

      // 4. Zone experience (10% weight)
      zoneExperience: this.calculateZoneScore(driver.deliveries_in_zone),
    };

    // Calculate weighted total
    const totalScore =
      scores.proximity * 0.4 +
      scores.performance * 0.3 +
      scores.capacity * 0.2 +
      scores.zoneExperience * 0.1;

    return {
      driver,
      scores,
      totalScore,
      reasoning: this.generateReasoningText(scores),
    };
  }

  /**
   * Calculate proximity score (0-100)
   * Closer is better
   */
  calculateProximityScore(distanceKm) {
    if (distanceKm <= 1) return 100;
    if (distanceKm <= 3) return 90;
    if (distanceKm <= 5) return 70;
    if (distanceKm <= 10) return 50;
    if (distanceKm <= 15) return 30;
    return 10;
  }

  /**
   * Calculate performance score (0-100)
   * Based on SLA compliance, ratings, experience
   */
  calculatePerformanceScore(driver) {
    if (!driver.total_deliveries || driver.total_deliveries < 10) {
      return 50; // Neutral for new drivers
    }

    const slaScore = (driver.sla_compliance_rate || 0) * 100;
    const ratingScore = ((driver.average_rating || 3) / 5) * 100;
    const experienceScore = Math.min((driver.total_deliveries / 100) * 100, 100);

    return slaScore * 0.5 + ratingScore * 0.3 + experienceScore * 0.2;
  }

  /**
   * Calculate capacity score (0-100)
   * Less load is better
   */
  calculateCapacityScore(activeOrders) {
    if (activeOrders === 0) return 100;
    if (activeOrders === 1) return 80;
    if (activeOrders === 2) return 60;
    if (activeOrders === 3) return 40;
    if (activeOrders === 4) return 20;
    return 0;
  }

  /**
   * Calculate zone experience score (0-100)
   * More deliveries in area is better
   */
  calculateZoneScore(deliveriesInZone) {
    if (deliveriesInZone >= 20) return 100;
    if (deliveriesInZone >= 10) return 80;
    if (deliveriesInZone >= 5) return 60;
    if (deliveriesInZone >= 2) return 40;
    if (deliveriesInZone >= 1) return 20;
    return 0;
  }

  /**
   * Generate human-readable reasoning
   */
  generateReasoningText(scores) {
    const reasons = [];

    if (scores.proximity > 80) reasons.push('Very close to pickup');
    if (scores.performance > 80) reasons.push('Excellent track record');
    if (scores.capacity > 80) reasons.push('Low current load');
    if (scores.zoneExperience > 60) reasons.push('Familiar with area');

    if (scores.proximity < 40) reasons.push('Far from pickup');
    if (scores.performance < 40) reasons.push('Below average performance');
    if (scores.capacity < 40) reasons.push('Currently busy');

    return reasons.join('; ');
  }

  /**
   * Offer order to driver and wait for response
   */
  async offerToDriver(driverId, orderId, timeoutSeconds) {
    // Create offer in Redis with expiration
    const offerKey = `order_offer:${orderId}:${driverId}`;

    await redis.setex(
      offerKey,
      timeoutSeconds,
      JSON.stringify({
        orderId,
        driverId,
        offeredAt: Date.now(),
        expiresAt: Date.now() + timeoutSeconds * 1000,
      })
    );

    // Send push notification to driver
    await this.sendOfferNotification(driverId, orderId);

    // Wait for response (check every 2 seconds)
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutSeconds * 1000) {
      // Check if driver accepted
      const response = await redis.get(`order_response:${orderId}:${driverId}`);

      if (response === 'ACCEPTED') {
        await redis.del(offerKey);
        await redis.del(`order_response:${orderId}:${driverId}`);
        return true;
      }

      if (response === 'REJECTED') {
        await redis.del(offerKey);
        await redis.del(`order_response:${orderId}:${driverId}`);
        return false;
      }

      // Wait 2 seconds before checking again
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Timeout
    await redis.del(offerKey);
    return false;
  }

  /**
   * Send offer notification to driver
   */
  async sendOfferNotification(driverId, orderId) {
    const order = await OrderModel.findById(orderId);
    const driver = await DriverModel.findById(driverId);

    // Send via FCM/APNS
    const notification = {
      title: 'New Order Available',
      body: `${order.service_type} delivery - ${order.distance_km}km`,
      data: {
        type: 'ORDER_OFFER',
        orderId: orderId.toString(),
        orderNumber: order.order_number,
        pickupAddress: order.pickup_address,
        deliveryFee: order.delivery_fee.toString(),
        timeToAccept: this.offerTimeout,
      },
    };

    // TODO: Implement FCM push notification
    logger.info(`📲 Sent order offer to driver ${driver.name}`);
  }

  /**
   * Optimize driver's route after assignment
   */
  async optimizeDriverRoute(driverId) {
    // Get all active orders for driver
    const orders = await db.query(
      `
      SELECT
        id,
        pickup_latitude,
        pickup_longitude,
        dropoff_latitude,
        dropoff_longitude,
        status,
        priority
      FROM orders
      WHERE driver_id = $1
        AND status IN ('ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY')
      ORDER BY priority DESC, sla_deadline ASC
    `,
      [driverId]
    );

    if (orders.rows.length === 0) return;

    // Call route optimization service
    // This would integrate with OR-Tools or your existing optimization
    logger.info(`🗺️ Optimizing route for driver with ${orders.rows.length} stops`);

    // TODO: Call route-optimization.agent or CVRP service
  }

  /**
   * Log assignment for audit trail
   */
  async logAssignment(orderId, driverId, assignmentType, scoringData) {
    await db.query(
      `
      INSERT INTO assignment_logs (
        order_id,
        driver_id,
        assignment_type,
        proximity_score,
        performance_score,
        capacity_score,
        zone_score,
        total_score,
        reasoning,
        assigned_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    `,
      [
        orderId,
        driverId,
        assignmentType,
        scoringData.scores.proximity,
        scoringData.scores.performance,
        scoringData.scores.capacity,
        scoringData.scores.zoneExperience,
        scoringData.totalScore,
        scoringData.reasoning,
      ]
    );
  }

  /**
   * Escalate when no driver available
   */
  async escalateNoDriverAvailable(order) {
    logger.error(`🚨 No driver available for critical order ${order.tracking_number}`);

    // Create alert
    await db.query(
      `
      INSERT INTO dispatch_alerts (
        order_id,
        alert_type,
        severity,
        message,
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `,
      [
        order.id,
        'NO_DRIVER_AVAILABLE',
        'CRITICAL',
        `Order ${order.tracking_number} has ${order.minutes_to_sla.toFixed(0)} minutes until SLA breach but no drivers available`,
      ]
    );

    // Send Slack/Teams notification
    // TODO: Implement webhook notification
  }

  /**
   * Get assignment statistics
   */
  async getStats(startDate, endDate) {
    const result = await db.query(
      `
      SELECT
        COUNT(*) AS total_assignments,
        COUNT(*) FILTER (WHERE assignment_type = 'AUTO_ASSIGNED') AS auto_assigned,
        COUNT(*) FILTER (WHERE assignment_type = 'FORCE_ASSIGNED') AS force_assigned,
        AVG(total_score) AS avg_score,
        AVG(EXTRACT(EPOCH FROM (assigned_at - created_at))) AS avg_time_to_assign_seconds
      FROM assignment_logs al
      JOIN orders o ON o.id = al.order_id
      WHERE al.assigned_at BETWEEN $1 AND $2
    `,
      [startDate, endDate]
    );

    return result.rows[0];
  }
}

module.exports = new AutoDispatchEngine();
