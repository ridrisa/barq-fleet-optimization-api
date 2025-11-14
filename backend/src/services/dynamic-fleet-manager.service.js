/**
 * Dynamic Fleet Manager Service
 *
 * Ensures:
 * 1. All drivers achieve daily targets
 * 2. All orders delivered within 1-4 hour SLA from creation
 *
 * Features:
 * - Real-time driver target tracking with PostgreSQL persistence
 * - Dynamic order assignment based on urgency
 * - SLA-aware routing (1-4 hour windows)
 * - Fair workload distribution
 * - Continuous reoptimization
 * - Historical performance tracking
 */

const enhancedCvrpOptimizer = require('./enhanced-cvrp-optimizer.service');
const { logger } = require('../utils/logger');
const { Pool } = require('pg');

class DynamicFleetManager {
  constructor() {
    // Database connection pool
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'barq_logistics',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // SLA configuration
    this.minSLA = 60;  // 1 hour minimum
    this.maxSLA = 240; // 4 hours maximum

    // Initialize database tables
    this.initializeDatabase().catch(err => {
      logger.error('Failed to initialize database', { error: err.message });
    });

    logger.info('Dynamic Fleet Manager initialized with database persistence');
  }

  /**
   * Initialize database tables if they don't exist
   */
  async initializeDatabase() {
    try {
      const client = await this.pool.connect();

      try {
        // Check if tables exist
        const tableCheck = await client.query(`
          SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name IN ('driver_targets', 'driver_performance_history')
        `);

        if (tableCheck.rows.length < 2) {
          logger.info('Database tables not found, running migration...');

          // Read and execute migration
          const fs = require('fs');
          const path = require('path');
          const migrationPath = path.join(__dirname, '../database/migrations/003_fleet_manager_persistence.sql');

          if (fs.existsSync(migrationPath)) {
            const sql = fs.readFileSync(migrationPath, 'utf8');
            await client.query(sql);
            logger.info('Migration completed successfully');
          } else {
            logger.warn('Migration file not found, tables may not exist');
          }
        } else {
          logger.info('Database tables verified');
        }
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Database initialization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Set daily targets for drivers (persisted to database)
   *
   * @param {Array} drivers - Array of {driver_id, target_deliveries, target_revenue}
   */
  async setDriverTargets(drivers) {
    const startTime = Date.now();
    try {
      logger.info('Setting driver targets', {
        operation: 'setDriverTargets',
        driver_count: drivers.length,
        driver_ids: drivers.map(d => d.driver_id),
      });

      for (const driver of drivers) {
        const targetDeliveries = driver.target_deliveries || 20;
        const targetRevenue = driver.target_revenue || 5000;

        await this.pool.query(`
          INSERT INTO driver_targets (driver_id, target_deliveries, target_revenue, status)
          VALUES ($1, $2, $3, 'available')
          ON CONFLICT (driver_id)
          DO UPDATE SET
            target_deliveries = $2,
            target_revenue = $3,
            status = 'available',
            current_deliveries = 0,
            current_revenue = 0,
            updated_at = CURRENT_TIMESTAMP
        `, [driver.driver_id, targetDeliveries, targetRevenue]);

        logger.debug('Driver target set', {
          operation: 'setDriverTargets',
          driver_id: driver.driver_id,
          target_deliveries: targetDeliveries,
          target_revenue: targetRevenue,
        });
      }

      const duration = Date.now() - startTime;
      logger.info('Driver targets configured successfully', {
        operation: 'setDriverTargets',
        drivers_configured: drivers.length,
        duration_ms: duration,
        status: 'success',
      });

      return {
        success: true,
        drivers_configured: drivers.length,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to set driver targets', {
        operation: 'setDriverTargets',
        error: error.message,
        error_stack: error.stack,
        driver_count: drivers.length,
        duration_ms: duration,
        status: 'error',
      });
      throw error;
    }
  }

  /**
   * Get driver target by ID
   */
  async getDriverTarget(driverId) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM driver_targets WHERE driver_id = $1',
        [driverId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get driver target', { error: error.message });
      return null;
    }
  }

  /**
   * Get all driver targets
   */
  async getAllDriverTargets() {
    try {
      const result = await this.pool.query('SELECT * FROM driver_targets ORDER BY driver_id');
      return result.rows;
    } catch (error) {
      logger.error('Failed to get all driver targets', { error: error.message });
      return [];
    }
  }

  /**
   * Update driver progress
   */
  async updateDriverProgress(driverId, deliveries, revenue) {
    try {
      await this.pool.query(`
        UPDATE driver_targets
        SET current_deliveries = current_deliveries + $2,
            current_revenue = current_revenue + $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE driver_id = $1
      `, [driverId, deliveries, revenue]);
    } catch (error) {
      logger.error('Failed to update driver progress', { error: error.message });
    }
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
   * @param {Object} target - Driver target object from database
   * @returns {number} - Score (lower = needs more orders)
   */
  calculateDriverScore(target) {
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
    const startTime = Date.now();
    const operationId = `assign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.info('Starting dynamic order assignment', {
        operation: 'assignOrdersDynamic',
        operation_id: operationId,
        orders_count: orders.length,
        drivers_count: drivers.length,
        pickup_points_count: pickupPoints?.length || 0,
        timestamp: new Date().toISOString(),
      });

      // Step 1: Categorize orders by urgency
      const categorized = this.categorizeOrdersByUrgency(orders);

      logger.info('Orders categorized by urgency', {
        operation: 'assignOrdersDynamic',
        operation_id: operationId,
        critical_count: categorized.critical.length,
        urgent_count: categorized.urgent.length,
        normal_count: categorized.normal.length,
        flexible_count: categorized.flexible.length,
        critical_orders: categorized.critical.map(o => ({ id: o.order_id, remaining_min: o.remaining_minutes })),
        urgent_orders: categorized.urgent.map(o => ({ id: o.order_id, remaining_min: o.remaining_minutes })),
      });

      // Step 2: Get all driver targets from database
      const allTargets = await this.getAllDriverTargets();
      const targetMap = new Map(allTargets.map(t => [t.driver_id, t]));

      // Calculate driver scores (who needs more orders)
      const driverScores = drivers.map(driver => ({
        ...driver,
        target: targetMap.get(driver.driver_id),
        score: this.calculateDriverScore(targetMap.get(driver.driver_id)),
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

          // Update driver progress in database
          await this.updateDriverProgress(
            availableDriver.driver_id,
            1,
            order.revenue || 0
          );

          // Update local cache
          if (availableDriver.target) {
            availableDriver.target.current_deliveries += 1;
            availableDriver.target.current_revenue += order.revenue || 0;
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
            const scoreA = this.calculateDriverScore(a.target);
            const scoreB = this.calculateDriverScore(b.target);
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

          // Update driver progress in database
          await this.updateDriverProgress(
            driver.driver_id,
            1,
            order.revenue || 0
          );

          // Update local cache
          if (driver.target) {
            driver.target.current_deliveries += 1;
            driver.target.current_revenue += order.revenue || 0;
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

      const duration = Date.now() - startTime;
      const targetStatus = await this.getTargetStatus();

      logger.info('Dynamic assignment completed successfully', {
        operation: 'assignOrdersDynamic',
        operation_id: operationId,
        assignments_count: assignments.length,
        routes_count: optimizedRoutes.routes?.length || 0,
        duration_ms: duration,
        status: 'success',
        urgency_breakdown: {
          critical: categorized.critical.length,
          urgent: categorized.urgent.length,
          normal: categorized.normal.length,
          flexible: categorized.flexible.length,
        },
        driver_achievements: targetStatus.drivers.map(d => ({
          driver_id: d.driver_id,
          achievement: d.achievement_percentage,
          deliveries: `${d.current_deliveries}/${d.target_deliveries}`,
        })),
        performance_summary: {
          total_drivers: targetStatus.drivers.length,
          on_target_drivers: targetStatus.drivers.filter(d => d.achievement_percentage >= 100).length,
          average_achievement: targetStatus.fleet_summary.average_achievement,
        },
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
        driver_target_status: targetStatus,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Dynamic assignment failed', {
        operation: 'assignOrdersDynamic',
        operation_id: operationId,
        error: error.message,
        error_stack: error.stack,
        orders_count: orders.length,
        drivers_count: drivers.length,
        duration_ms: duration,
        status: 'error',
      });
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
  async getTargetStatus() {
    try {
      const targets = await this.getAllDriverTargets();

      return targets.map(target => {
        const deliveryProgress = (target.current_deliveries / target.target_deliveries) * 100;
        const revenueProgress = (target.current_revenue / target.target_revenue) * 100;

        return {
          driver_id: target.driver_id,
          target_deliveries: target.target_deliveries,
          current_deliveries: target.current_deliveries,
          delivery_progress: deliveryProgress.toFixed(1) + '%',
          target_revenue: target.target_revenue,
          current_revenue: target.current_revenue,
          revenue_progress: revenueProgress.toFixed(1) + '%',
          on_track: deliveryProgress >= 50 && revenueProgress >= 50, // Halfway through day
          status: target.status,
          updated_at: target.updated_at,
        };
      });
    } catch (error) {
      logger.error('Failed to get target status', { error: error.message });
      return [];
    }
  }

  /**
   * Check if all drivers are on track to meet targets
   */
  async checkTargetAchievement() {
    try {
      const status = await this.getTargetStatus();
      const onTrack = status.filter(s => s.on_track).length;
      const total = status.length;

      return {
        success: true,
        drivers_on_track: onTrack,
        total_drivers: total,
        percentage: total > 0 ? ((onTrack / total) * 100).toFixed(1) + '%' : '0%',
        drivers: status,
        recommendation: onTrack === total
          ? 'All drivers on track to meet targets'
          : `${total - onTrack} drivers need more orders`,
      };
    } catch (error) {
      logger.error('Failed to check target achievement', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
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
  async updateDriverStatus(driverId, status) {
    try {
      const result = await this.pool.query(`
        UPDATE driver_targets
        SET status = $2, updated_at = CURRENT_TIMESTAMP
        WHERE driver_id = $1
        RETURNING *
      `, [driverId, status]);

      if (result.rows.length > 0) {
        logger.info(`Driver ${driverId} status updated to ${status}`);
        return { success: true, driver_id: driverId, status };
      } else {
        return { success: false, error: 'Driver not found' };
      }
    } catch (error) {
      logger.error('Failed to update driver status', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Reset all targets (new day)
   */
  async resetDailyTargets() {
    try {
      // First, snapshot current day's performance to history
      await this.snapshotDailyPerformance();

      // Then reset current progress
      await this.pool.query(`
        UPDATE driver_targets
        SET current_deliveries = 0,
            current_revenue = 0,
            status = 'available',
            updated_at = CURRENT_TIMESTAMP
      `);

      logger.info('Daily targets reset');
      return { success: true, message: 'All driver targets reset for new day' };
    } catch (error) {
      logger.error('Failed to reset daily targets', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Snapshot daily performance to history
   */
  async snapshotDailyPerformance() {
    try {
      await this.pool.query(`
        INSERT INTO driver_performance_history
          (driver_id, date, deliveries_completed, revenue_generated,
           target_deliveries, target_revenue, target_achieved, achievement_percentage)
        SELECT
          driver_id,
          CURRENT_DATE,
          current_deliveries,
          current_revenue,
          target_deliveries,
          target_revenue,
          (current_deliveries >= target_deliveries AND current_revenue >= target_revenue),
          calculate_achievement_percentage(current_deliveries, target_deliveries,
                                          current_revenue, target_revenue)
        FROM driver_targets
        ON CONFLICT (driver_id, date)
        DO UPDATE SET
          deliveries_completed = EXCLUDED.deliveries_completed,
          revenue_generated = EXCLUDED.revenue_generated,
          target_achieved = EXCLUDED.target_achieved,
          achievement_percentage = EXCLUDED.achievement_percentage
      `);

      logger.info('Daily performance snapshot saved');
    } catch (error) {
      logger.error('Failed to snapshot daily performance', { error: error.message });
    }
  }

  /**
   * Get historical performance for a driver
   */
  async getDriverHistory(driverId, days = 30) {
    try {
      const result = await this.pool.query(`
        SELECT * FROM driver_performance_history
        WHERE driver_id = $1
        AND date >= CURRENT_DATE - INTERVAL '${days} days'
        ORDER BY date DESC
      `, [driverId]);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get driver history', { error: error.message });
      return [];
    }
  }

  /**
   * Get top performing drivers
   */
  async getTopPerformers(days = 7, limit = 10) {
    try {
      const result = await this.pool.query(`
        SELECT
          driver_id,
          COUNT(*) as days_worked,
          SUM(deliveries_completed) as total_deliveries,
          SUM(revenue_generated) as total_revenue,
          AVG(achievement_percentage) as avg_achievement,
          COUNT(*) FILTER (WHERE target_achieved = true) as days_achieved
        FROM driver_performance_history
        WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY driver_id
        ORDER BY avg_achievement DESC
        LIMIT $1
      `, [limit]);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get top performers', { error: error.message });
      return [];
    }
  }

  /**
   * Cleanup - close database connections
   */
  async close() {
    await this.pool.end();
    logger.info('Dynamic Fleet Manager database connections closed');
  }
}

// Export singleton instance
module.exports = new DynamicFleetManager();
