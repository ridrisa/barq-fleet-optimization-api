/**
 * Dynamic Fleet Manager Service
 *
 * Ensures:
 * 1. All drivers achieve daily targets
 * 2. All orders delivered within 1-4 hour SLA from creation
 *
 * Features:
 * - Real-time driver target tracking
 * - Dynamic order assignment based on urgency
 * - SLA-aware routing (1-4 hour windows)
 * - Fair workload distribution
 * - Continuous reoptimization
 */

const enhancedCvrpOptimizer = require('./enhanced-cvrp-optimizer.service');
const { logger } = require('../utils/logger');

class DynamicFleetManager {
  constructor() {
    this.driverTargets = new Map(); // driver_id -> target info
    this.activeOrders = new Map();  // order_id -> order details
    this.driverProgress = new Map(); // driver_id -> current progress

    // SLA configuration
    this.minSLA = 60;  // 1 hour minimum
    this.maxSLA = 240; // 4 hours maximum

    logger.info('Dynamic Fleet Manager initialized');
  }

  /**
   * Set daily targets for drivers
   *
   * @param {Array} drivers - Array of {driver_id, target_deliveries, target_revenue}
   */
  setDriverTargets(drivers) {
    drivers.forEach(driver => {
      this.driverTargets.set(driver.driver_id, {
        driver_id: driver.driver_id,
        target_deliveries: driver.target_deliveries || 20,
        target_revenue: driver.target_revenue || 5000,
        current_deliveries: 0,
        current_revenue: 0,
        assigned_orders: [],
        status: 'available', // available, busy, break, offline
      });
    });

    logger.info(`Targets set for ${drivers.length} drivers`);
    return {
      success: true,
      drivers_configured: drivers.length,
    };
  }

  /**
   * Calculate remaining time until SLA deadline
   *
   * @param {Date} orderCreatedAt - Order creation timestamp
   * @param {number} slaHours - SLA in hours (1-4)
   * @returns {number} - Minutes remaining until deadline
   */
  calculateRemainingTime(orderCreatedAt, slaHours = 4) {
    const now = new Date();
    const createdAt = new Date(orderCreatedAt);
    const deadlineMinutes = slaHours * 60;
    const elapsedMinutes = (now - createdAt) / (1000 * 60);
    const remainingMinutes = deadlineMinutes - elapsedMinutes;

    return Math.max(0, remainingMinutes);
  }

  /**
   * Categorize orders by urgency based on SLA
   *
   * @param {Array} orders - All pending orders
   * @returns {Object} - Orders categorized by urgency
   */
  categorizeOrdersByUrgency(orders) {
    const categories = {
      critical: [],   // < 30 min remaining
      urgent: [],     // 30-60 min remaining
      normal: [],     // 60-180 min remaining
      flexible: [],   // > 180 min remaining
    };

    orders.forEach(order => {
      const remaining = this.calculateRemainingTime(
        order.created_at,
        order.sla_hours || 4
      );

      if (remaining < 30) {
        categories.critical.push({ ...order, remaining_minutes: remaining });
      } else if (remaining < 60) {
        categories.urgent.push({ ...order, remaining_minutes: remaining });
      } else if (remaining < 180) {
        categories.normal.push({ ...order, remaining_minutes: remaining });
      } else {
        categories.flexible.push({ ...order, remaining_minutes: remaining });
      }
    });

    // Sort each category by remaining time (ascending)
    Object.keys(categories).forEach(key => {
      categories[key].sort((a, b) => a.remaining_minutes - b.remaining_minutes);
    });

    return categories;
  }

  /**
   * Calculate driver scores for fair workload distribution
   *
   * @param {string} driverId - Driver ID
   * @returns {number} - Score (lower = needs more orders)
   */
  calculateDriverScore(driverId) {
    const target = this.driverTargets.get(driverId);
    if (!target) return Infinity;

    const deliveryProgress = target.current_deliveries / target.target_deliveries;
    const revenueProgress = target.current_revenue / target.target_revenue;

    // Combined progress (0-1, lower means further from target)
    const combinedProgress = (deliveryProgress + revenueProgress) / 2;

    // Score inversely proportional to progress
    return 1 - combinedProgress;
  }

  /**
   * Assign orders to drivers based on targets and SLA
   *
   * @param {Array} orders - Pending orders
   * @param {Array} drivers - Available drivers
   * @param {Array} pickupPoints - Pickup locations
   * @returns {Promise<Object>} - Assignment result
   */
  async assignOrdersDynamic(orders, drivers, pickupPoints) {
    try {
      logger.info('Starting dynamic order assignment', {
        orders: orders.length,
        drivers: drivers.length,
      });

      // Step 1: Categorize orders by urgency
      const categorized = this.categorizeOrdersByUrgency(orders);

      logger.info('Orders categorized by urgency', {
        critical: categorized.critical.length,
        urgent: categorized.urgent.length,
        normal: categorized.normal.length,
        flexible: categorized.flexible.length,
      });

      // Step 2: Calculate driver scores (who needs more orders)
      const driverScores = drivers.map(driver => ({
        ...driver,
        score: this.calculateDriverScore(driver.driver_id),
        target: this.driverTargets.get(driver.driver_id),
      })).sort((a, b) => b.score - a.score); // Highest score first (needs orders most)

      // Step 3: Assign critical/urgent orders first to nearest drivers
      const assignments = [];
      const urgentOrders = [
        ...categorized.critical,
        ...categorized.urgent,
      ];

      for (const order of urgentOrders) {
        // Find driver with highest score (furthest from target)
        const availableDriver = driverScores.find(d => d.target?.status === 'available');

        if (availableDriver) {
          assignments.push({
            order_id: order.order_id,
            driver_id: availableDriver.driver_id,
            priority: order.remaining_minutes < 30 ? 'CRITICAL' : 'URGENT',
            remaining_minutes: order.remaining_minutes,
            sla_deadline: new Date(Date.now() + order.remaining_minutes * 60000),
          });

          // Update driver progress
          const target = this.driverTargets.get(availableDriver.driver_id);
          if (target) {
            target.assigned_orders.push(order.order_id);
            target.current_deliveries += 1;
            target.current_revenue += order.revenue || 0;
          }
        }
      }

      // Step 4: Assign normal/flexible orders to balance targets
      const remainingOrders = [
        ...categorized.normal,
        ...categorized.flexible,
      ];

      for (const order of remainingOrders) {
        // Recalculate scores after urgent assignments
        const driver = driverScores
          .filter(d => d.target?.status === 'available')
          .sort((a, b) => {
            const scoreA = this.calculateDriverScore(a.driver_id);
            const scoreB = this.calculateDriverScore(b.driver_id);
            return scoreB - scoreA;
          })[0];

        if (driver) {
          assignments.push({
            order_id: order.order_id,
            driver_id: driver.driver_id,
            priority: 'NORMAL',
            remaining_minutes: order.remaining_minutes,
            sla_deadline: new Date(Date.now() + order.remaining_minutes * 60000),
          });

          // Update driver progress
          const target = this.driverTargets.get(driver.driver_id);
          if (target) {
            target.assigned_orders.push(order.order_id);
            target.current_deliveries += 1;
            target.current_revenue += order.revenue || 0;
          }
        }
      }

      // Step 5: Optimize routes using enhanced CVRP
      const optimizationRequest = this.buildOptimizationRequest(
        assignments,
        orders,
        drivers,
        pickupPoints
      );

      const optimizedRoutes = await enhancedCvrpOptimizer.optimizeWithEnhancements(
        optimizationRequest
      );

      logger.info('Dynamic assignment completed', {
        assignments: assignments.length,
        routes: optimizedRoutes.routes?.length || 0,
      });

      return {
        success: true,
        assignments: assignments,
        routes: optimizedRoutes.routes || [],
        urgency_breakdown: {
          critical: categorized.critical.length,
          urgent: categorized.urgent.length,
          normal: categorized.normal.length,
          flexible: categorized.flexible.length,
        },
        driver_target_status: this.getTargetStatus(),
      };
    } catch (error) {
      logger.error('Dynamic assignment failed', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Build optimization request from assignments
   */
  buildOptimizationRequest(assignments, orders, drivers, pickupPoints) {
    // Group orders by pickup point
    const ordersByPickup = {};

    orders.forEach(order => {
      const pickupId = order.pickup_id || 'default';
      if (!ordersByPickup[pickupId]) {
        ordersByPickup[pickupId] = [];
      }
      ordersByPickup[pickupId].push(order);
    });

    // Build delivery points with SLA deadlines
    const deliveryPoints = orders.map(order => {
      const assignment = assignments.find(a => a.order_id === order.order_id);
      const remainingMinutes = this.calculateRemainingTime(
        order.created_at,
        order.sla_hours || 4
      );

      return {
        id: order.order_id,
        order_id: order.order_id,
        lat: order.delivery_lat,
        lng: order.delivery_lng,
        load_kg: order.load_kg || 10,
        pickup_id: order.pickup_id || 'default',
        customer_name: order.customer_name,
        priority: assignment?.priority === 'CRITICAL' ? 10 : assignment?.priority === 'URGENT' ? 8 : 5,
        sla_deadline: new Date(Date.now() + remainingMinutes * 60000),
      };
    });

    // Build fleet
    const fleet = drivers.map(driver => ({
      id: driver.driver_id,
      fleet_id: driver.driver_id,
      vehicle_type: driver.vehicle_type || 'CAR',
      capacity_kg: driver.capacity_kg || 500,
      driver_name: driver.name,
    }));

    return {
      pickupPoints: pickupPoints || [],
      deliveryPoints: deliveryPoints,
      fleet: fleet,
      options: {
        useEnhanced: true,
        slaMinutes: this.maxSLA, // 4 hours max
      },
    };
  }

  /**
   * Get current target achievement status for all drivers
   */
  getTargetStatus() {
    const status = [];

    this.driverTargets.forEach((target, driverId) => {
      const deliveryProgress = (target.current_deliveries / target.target_deliveries) * 100;
      const revenueProgress = (target.current_revenue / target.target_revenue) * 100;

      status.push({
        driver_id: driverId,
        target_deliveries: target.target_deliveries,
        current_deliveries: target.current_deliveries,
        delivery_progress: deliveryProgress.toFixed(1) + '%',
        target_revenue: target.target_revenue,
        current_revenue: target.current_revenue,
        revenue_progress: revenueProgress.toFixed(1) + '%',
        on_track: deliveryProgress >= 50 && revenueProgress >= 50, // Halfway through day
        status: target.status,
      });
    });

    return status;
  }

  /**
   * Check if all drivers are on track to meet targets
   */
  checkTargetAchievement() {
    const status = this.getTargetStatus();
    const onTrack = status.filter(s => s.on_track).length;
    const total = status.length;

    return {
      success: true,
      drivers_on_track: onTrack,
      total_drivers: total,
      percentage: ((onTrack / total) * 100).toFixed(1) + '%',
      drivers: status,
      recommendation: onTrack === total
        ? 'All drivers on track to meet targets'
        : `${total - onTrack} drivers need more orders`,
    };
  }

  /**
   * Get orders that are at risk of SLA violation
   */
  getAtRiskOrders(orders) {
    const atRisk = [];

    orders.forEach(order => {
      const remaining = this.calculateRemainingTime(
        order.created_at,
        order.sla_hours || 4
      );

      if (remaining < 60) { // Less than 1 hour remaining
        atRisk.push({
          order_id: order.order_id,
          customer_name: order.customer_name,
          created_at: order.created_at,
          remaining_minutes: remaining,
          priority: remaining < 30 ? 'CRITICAL' : 'URGENT',
        });
      }
    });

    return atRisk.sort((a, b) => a.remaining_minutes - b.remaining_minutes);
  }

  /**
   * Reoptimize routes during the day (for new orders or delays)
   */
  async reoptimize(currentRoutes, newOrders, drivers, pickupPoints) {
    logger.info('Triggering dynamic reoptimization', {
      current_routes: currentRoutes.length,
      new_orders: newOrders.length,
    });

    // Combine existing undelivered orders with new orders
    const allPendingOrders = [
      ...this.extractUndeliveredOrders(currentRoutes),
      ...newOrders,
    ];

    // Reassign all pending orders
    return await this.assignOrdersDynamic(
      allPendingOrders,
      drivers,
      pickupPoints
    );
  }

  /**
   * Extract undelivered orders from current routes
   */
  extractUndeliveredOrders(routes) {
    const undelivered = [];

    routes.forEach(route => {
      route.stops?.forEach(stop => {
        if (stop.type === 'delivery' && stop.status !== 'completed') {
          undelivered.push({
            order_id: stop.order_id,
            delivery_lat: stop.location.latitude,
            delivery_lng: stop.location.longitude,
            load_kg: stop.demand || 10,
            pickup_id: stop.pickup_id,
            customer_name: stop.name,
            created_at: stop.created_at || new Date(),
            sla_hours: 4,
          });
        }
      });
    });

    return undelivered;
  }

  /**
   * Update driver status (available, busy, break, offline)
   */
  updateDriverStatus(driverId, status) {
    const target = this.driverTargets.get(driverId);
    if (target) {
      target.status = status;
      logger.info(`Driver ${driverId} status updated to ${status}`);
      return { success: true, driver_id: driverId, status };
    }
    return { success: false, error: 'Driver not found' };
  }

  /**
   * Reset all targets (new day)
   */
  resetDailyTargets() {
    this.driverTargets.forEach((target) => {
      target.current_deliveries = 0;
      target.current_revenue = 0;
      target.assigned_orders = [];
      target.status = 'available';
    });

    logger.info('Daily targets reset');
    return { success: true, message: 'All driver targets reset for new day' };
  }
}

// Export singleton instance
module.exports = new DynamicFleetManager();
