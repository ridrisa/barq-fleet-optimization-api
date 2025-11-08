/**
 * Reassignment Service
 * Handles SLA auto-reassignment logic with intelligent driver selection
 */

const { logger } = require('../utils/logger');
const OrderModel = require('../models/order.model');
const DriverModel = require('../models/driver.model');
const db = require('../database');

class ReassignmentService {
  constructor() {
    this.reassignmentHistory = [];
    this.failedReassignments = new Map();
    this.DISTANCE_WEIGHT = 0.4;
    this.PERFORMANCE_WEIGHT = 0.3;
    this.LOAD_WEIGHT = 0.2;
    this.TARGET_WEIGHT = 0.1;
    this.MAX_DISTANCE_KM = 20; // Maximum distance for reassignment
    this.MAX_REASSIGNMENT_ATTEMPTS = 3;
  }

  /**
   * Auto-reassign order based on SLA risk
   */
  async autoReassign(order, reason = 'SLA_AT_RISK') {
    try {
      logger.info(`[ReassignmentService] Starting auto-reassignment for order ${order.id}`, {
        orderId: order.id,
        reason,
        currentDriver: order.driver_id,
      });

      // Check reassignment attempt count
      const attempts = this.failedReassignments.get(order.id) || 0;
      if (attempts >= this.MAX_REASSIGNMENT_ATTEMPTS) {
        logger.warn(
          `[ReassignmentService] Max reassignment attempts reached for order ${order.id}`
        );
        return {
          success: false,
          reason: 'MAX_ATTEMPTS_REACHED',
          shouldEscalate: true,
        };
      }

      // Find best driver for reassignment
      const bestDriver = await this.findBestDriver(order);

      if (!bestDriver) {
        logger.warn(`[ReassignmentService] No available driver found for order ${order.id}`);
        this.failedReassignments.set(order.id, attempts + 1);

        return {
          success: false,
          reason: 'NO_AVAILABLE_DRIVERS',
          shouldEscalate: true,
        };
      }

      // Check if best driver is the same as current driver
      if (bestDriver.id === order.driver_id) {
        logger.info(`[ReassignmentService] Best driver is current driver, no reassignment needed`);
        return {
          success: false,
          reason: 'CURRENT_DRIVER_IS_BEST',
          shouldEscalate: false,
        };
      }

      // Execute reassignment
      const result = await this.executeReassignment(order, bestDriver, reason);

      if (result.success) {
        // Clear failed attempts
        this.failedReassignments.delete(order.id);

        // Record successful reassignment
        this.recordReassignment({
          orderId: order.id,
          fromDriver: order.driver_id,
          toDriver: bestDriver.id,
          reason,
          timestamp: new Date(),
          driverScore: bestDriver.score,
          distanceKm: bestDriver.distance_km,
        });
      } else {
        this.failedReassignments.set(order.id, attempts + 1);
      }

      return result;
    } catch (error) {
      logger.error('[ReassignmentService] Auto-reassignment failed', {
        error: error.message,
        orderId: order.id,
      });

      return {
        success: false,
        reason: 'SYSTEM_ERROR',
        error: error.message,
        shouldEscalate: true,
      };
    }
  }

  /**
   * Find best driver for order reassignment
   */
  async findBestDriver(order) {
    try {
      // Get eligible drivers
      const candidates = await this.getEligibleDrivers(order);

      if (!candidates || candidates.length === 0) {
        return null;
      }

      logger.info(
        `[ReassignmentService] Found ${candidates.length} eligible drivers for order ${order.id}`
      );

      // Calculate score for each driver
      const scoredDrivers = candidates.map((driver) => ({
        ...driver,
        score: this.calculateDriverScore(driver, order),
      }));

      // Sort by score (higher is better)
      scoredDrivers.sort((a, b) => b.score - a.score);

      logger.info(`[ReassignmentService] Best driver for order ${order.id}`, {
        driverId: scoredDrivers[0].id,
        driverName: scoredDrivers[0].name,
        score: scoredDrivers[0].score.toFixed(3),
        distance: `${scoredDrivers[0].distance_km?.toFixed(2)}km`,
      });

      return scoredDrivers[0];
    } catch (error) {
      logger.error('[ReassignmentService] Failed to find best driver', error);
      throw error;
    }
  }

  /**
   * Get eligible drivers for reassignment
   */
  async getEligibleDrivers(order) {
    try {
      // Get order location (pickup or current delivery location)
      const orderLocation = {
        lat: order.pickup_lat || order.dropoff_lat,
        lng: order.pickup_lng || order.dropoff_lng,
      };

      // Get available drivers near the order location
      const availableDrivers = await DriverModel.getAvailableDrivers(
        order.service_type,
        orderLocation,
        this.MAX_DISTANCE_KM
      );

      if (!availableDrivers || availableDrivers.length === 0) {
        return [];
      }

      // Filter eligible drivers based on business criteria
      const eligibleDrivers = [];

      for (const driver of availableDrivers) {
        // Get driver performance metrics
        const metrics = await this.getDriverMetrics(driver.id);

        // Skip if driver has poor on-time rate
        if (metrics.on_time_rate < 0.9) {
          logger.debug(
            `[ReassignmentService] Skipping driver ${driver.id} - low on-time rate: ${metrics.on_time_rate}`
          );
          continue;
        }

        // Skip if driver is exhausted (worked >10 hours)
        if (metrics.hours_worked >= 10) {
          logger.debug(
            `[ReassignmentService] Skipping driver ${driver.id} - exhausted: ${metrics.hours_worked} hours`
          );
          continue;
        }

        // Skip if driver has hit daily target
        if (metrics.gap_from_target <= 0) {
          logger.debug(`[ReassignmentService] Skipping driver ${driver.id} - target reached`);
          continue;
        }

        // Skip if vehicle capacity is insufficient
        const orderWeight = order.package_details?.weight || 0;
        if (driver.current_load + orderWeight > driver.capacity_kg) {
          logger.debug(
            `[ReassignmentService] Skipping driver ${driver.id} - insufficient capacity`
          );
          continue;
        }

        // Add driver with metrics
        eligibleDrivers.push({
          ...driver,
          metrics,
        });
      }

      return eligibleDrivers;
    } catch (error) {
      logger.error('[ReassignmentService] Failed to get eligible drivers', error);
      throw error;
    }
  }

  /**
   * Calculate driver score for assignment
   * Higher score = better match
   */
  calculateDriverScore(driver, order) {
    // 1. Distance score (closer is better)
    const distanceKm = driver.distance_km || 0;
    const distanceScore = Math.max(0, 1 - distanceKm / 50); // Normalize to 50km max

    // 2. Performance score (on-time rate)
    const performanceScore = driver.metrics?.on_time_rate || 0.85;

    // 3. Load score (lower current load is better)
    const currentLoad = driver.current_load || 0;
    const capacity = driver.capacity_kg || 3000;
    const loadScore = Math.max(0, 1 - currentLoad / capacity);

    // 4. Target gap score (drivers further from target get priority)
    const gapFromTarget = driver.metrics?.gap_from_target || 0;
    const targetDeliveries = driver.metrics?.target_deliveries || 20;
    const targetScore = gapFromTarget / targetDeliveries;

    // Calculate weighted score
    const totalScore =
      distanceScore * this.DISTANCE_WEIGHT +
      performanceScore * this.PERFORMANCE_WEIGHT +
      loadScore * this.LOAD_WEIGHT +
      targetScore * this.TARGET_WEIGHT;

    logger.debug(`[ReassignmentService] Driver ${driver.id} score breakdown`, {
      distanceScore: distanceScore.toFixed(3),
      performanceScore: performanceScore.toFixed(3),
      loadScore: loadScore.toFixed(3),
      targetScore: targetScore.toFixed(3),
      totalScore: totalScore.toFixed(3),
    });

    return totalScore;
  }

  /**
   * Get driver performance metrics
   */
  async getDriverMetrics(driverId) {
    try {
      // Get driver statistics from database
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      const stats = await DriverModel.getStatistics(driverId, startOfDay, endOfDay);

      if (!stats) {
        return {
          on_time_rate: 0.85,
          hours_worked: 0,
          gap_from_target: 20,
          target_deliveries: 20,
        };
      }

      // Calculate metrics
      const totalDeliveries = stats.period_delivered || 0;
      const slaCompliant = totalDeliveries - (stats.period_sla_breached || 0);
      const onTimeRate = totalDeliveries > 0 ? slaCompliant / totalDeliveries : 0.85;

      // Estimate hours worked (rough estimate based on deliveries)
      const hoursWorked = Math.floor(totalDeliveries * 0.5); // ~30 mins per delivery

      // Target deliveries per day (varies by service type and vehicle)
      const targetDeliveries = 20;
      const gapFromTarget = targetDeliveries - totalDeliveries;

      return {
        on_time_rate: onTimeRate,
        hours_worked: hoursWorked,
        gap_from_target: gapFromTarget,
        target_deliveries: targetDeliveries,
        total_deliveries: totalDeliveries,
      };
    } catch (error) {
      logger.error('[ReassignmentService] Failed to get driver metrics', error);

      // Return default metrics
      return {
        on_time_rate: 0.85,
        hours_worked: 0,
        gap_from_target: 20,
        target_deliveries: 20,
      };
    }
  }

  /**
   * Execute reassignment transaction
   */
  async executeReassignment(order, newDriver, reason) {
    try {
      logger.info(`[ReassignmentService] Executing reassignment`, {
        orderId: order.id,
        fromDriver: order.driver_id,
        toDriver: newDriver.id,
        reason,
      });

      // Execute in transaction
      const result = await db.transaction(async (client) => {
        // 1. Update order assignment
        const updateOrderQuery = `
          UPDATE orders
          SET
            driver_id = $1,
            status = 'assigned',
            assigned_at = CURRENT_TIMESTAMP,
            reassignment_count = COALESCE(reassignment_count, 0) + 1,
            last_reassignment_reason = $2
          WHERE id = $3
          RETURNING *
        `;

        const orderResult = await client.query(updateOrderQuery, [newDriver.id, reason, order.id]);

        // 2. Update old driver status (if exists)
        if (order.driver_id) {
          await client.query('UPDATE drivers SET status = $1 WHERE id = $2', [
            'available',
            order.driver_id,
          ]);
        }

        // 3. Update new driver status
        await client.query('UPDATE drivers SET status = $1 WHERE id = $2', ['busy', newDriver.id]);

        // 4. Record reassignment event
        const eventQuery = `
          INSERT INTO reassignment_events (
            order_id,
            from_driver_id,
            to_driver_id,
            reason,
            distance_km,
            driver_score
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `;

        await client.query(eventQuery, [
          order.id,
          order.driver_id,
          newDriver.id,
          reason,
          newDriver.distance_km || 0,
          newDriver.score || 0,
        ]);

        return {
          success: true,
          order: orderResult.rows[0],
          newDriver: {
            id: newDriver.id,
            name: newDriver.name,
            phone: newDriver.phone,
            distance: newDriver.distance_km,
          },
          oldDriver: order.driver_id
            ? {
                id: order.driver_id,
              }
            : null,
        };
      });

      logger.info(`[ReassignmentService] Reassignment executed successfully`, {
        orderId: order.id,
        newDriver: result.newDriver.id,
      });

      return result;
    } catch (error) {
      logger.error('[ReassignmentService] Failed to execute reassignment', {
        error: error.message,
        orderId: order.id,
      });

      return {
        success: false,
        reason: 'EXECUTION_FAILED',
        error: error.message,
        shouldEscalate: true,
      };
    }
  }

  /**
   * Record reassignment in history
   */
  recordReassignment(reassignmentData) {
    this.reassignmentHistory.push(reassignmentData);

    // Keep only last 100 reassignments in memory
    if (this.reassignmentHistory.length > 100) {
      this.reassignmentHistory.shift();
    }

    logger.info('[ReassignmentService] Reassignment recorded', reassignmentData);
  }

  /**
   * Get reassignment statistics
   */
  getReassignmentStats(timeRangeMinutes = 60) {
    const cutoff = new Date(Date.now() - timeRangeMinutes * 60000);

    const recent = this.reassignmentHistory.filter((r) => r.timestamp >= cutoff);

    const stats = {
      total: recent.length,
      byReason: {},
      avgDistance: 0,
      avgDriverScore: 0,
    };

    if (recent.length > 0) {
      let totalDistance = 0;
      let totalScore = 0;

      recent.forEach((r) => {
        stats.byReason[r.reason] = (stats.byReason[r.reason] || 0) + 1;
        totalDistance += r.distanceKm || 0;
        totalScore += r.driverScore || 0;
      });

      stats.avgDistance = totalDistance / recent.length;
      stats.avgDriverScore = totalScore / recent.length;
    }

    return stats;
  }

  /**
   * Check if order should be reassigned
   */
  shouldReassign(order, slaStatus) {
    // Don't reassign if already delivered or cancelled
    if (['delivered', 'cancelled', 'failed'].includes(order.status)) {
      return false;
    }

    // Don't reassign if already reassigned multiple times
    if ((order.reassignment_count || 0) >= this.MAX_REASSIGNMENT_ATTEMPTS) {
      return false;
    }

    // Reassign based on SLA status
    if (slaStatus.category === 'breached') {
      return false; // Too late, escalate instead
    }

    if (slaStatus.category === 'critical' && !slaStatus.canMeetSLA) {
      return true; // Emergency reassignment
    }

    if (slaStatus.category === 'warning' && !slaStatus.canMeetSLA) {
      return true; // Proactive reassignment
    }

    return false;
  }

  /**
   * Get reassignment history
   */
  getHistory(limit = 50) {
    return this.reassignmentHistory.slice(-limit).reverse();
  }

  /**
   * Clear failed reassignment attempts for an order
   */
  clearFailedAttempts(orderId) {
    this.failedReassignments.delete(orderId);
  }

  /**
   * Get failed reassignment attempts
   */
  getFailedAttempts(orderId) {
    return this.failedReassignments.get(orderId) || 0;
  }
}

// Export singleton instance
let instance = null;

module.exports = {
  ReassignmentService,
  getInstance: () => {
    if (!instance) {
      instance = new ReassignmentService();
    }
    return instance;
  },
};
