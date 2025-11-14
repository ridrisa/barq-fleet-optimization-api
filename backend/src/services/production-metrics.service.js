/**
 * Production Metrics Service
 * Contains production-tested SQL queries from BARQ Fleet production system
 * Source: barqfleet_db_files/queries_external_metrics.py
 */

const pool = require('./postgres.service');
const { logger } = require('../utils/logger');
const { executeMetricsQuery, TIMEOUT_CONFIG } = require('../utils/query-timeout');

class ProductionMetricsService {
  /**
   * Get on-time delivery rate
   * Critical metric for customer satisfaction
   */
  static async getOnTimeDeliveryRate(startDate, endDate) {
    const query = `
      SELECT
        COALESCE(
          CAST(COUNT(*) FILTER(WHERE delivered_at <= sla_deadline) AS DECIMAL) * 100.0 /
          NULLIF(COUNT(*) FILTER(WHERE sla_deadline IS NOT NULL), 0),
          0.0
        ) AS on_time_rate,
        COUNT(*) FILTER(WHERE delivered_at <= sla_deadline) as on_time_count,
        COUNT(*) FILTER(WHERE delivered_at > sla_deadline) as late_count,
        COUNT(*) as total_deliveries
      FROM orders
      WHERE status = 'delivered'
        AND created_at BETWEEN $1 AND $2
    `;

    try {
      const result = await executeMetricsQuery(pool, query, [startDate, endDate], {
        timeout: TIMEOUT_CONFIG.METRICS,
      });
      return {
        on_time_rate: parseFloat(result.rows[0].on_time_rate) || 0,
        on_time_count: parseInt(result.rows[0].on_time_count) || 0,
        late_count: parseInt(result.rows[0].late_count) || 0,
        total_deliveries: parseInt(result.rows[0].total_deliveries) || 0,
      };
    } catch (error) {
      logger.error('Error getting on-time delivery rate:', error);
      throw error;
    }
  }

  /**
   * Get order completion rate
   * Measures fulfillment success
   */
  static async getOrderCompletionRate(startDate, endDate) {
    const query = `
      SELECT
        COALESCE(
          CAST(COUNT(*) FILTER(WHERE status = 'delivered') AS DECIMAL) * 100.0 /
          NULLIF(COUNT(*) FILTER(WHERE status IN('delivered','failed','cancelled')), 0),
          0.0
        ) AS completion_rate,
        COUNT(*) FILTER(WHERE status = 'delivered') as delivered_count,
        COUNT(*) FILTER(WHERE status = 'failed') as failed_count,
        COUNT(*) FILTER(WHERE status = 'cancelled') as cancelled_count
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
    `;

    try {
      const result = await executeMetricsQuery(pool, query, [startDate, endDate], {
        timeout: TIMEOUT_CONFIG.METRICS,
      });
      return {
        completion_rate: parseFloat(result.rows[0].completion_rate) || 0,
        delivered_count: parseInt(result.rows[0].delivered_count) || 0,
        failed_count: parseInt(result.rows[0].failed_count) || 0,
        cancelled_count: parseInt(result.rows[0].cancelled_count) || 0,
      };
    } catch (error) {
      logger.error('Error getting order completion rate:', error);
      throw error;
    }
  }

  /**
   * Get average delivery time in minutes
   * From pickup to delivery completion
   */
  static async getAverageDeliveryTime(startDate, endDate) {
    const query = `
      SELECT
        COALESCE(
          AVG(EXTRACT(EPOCH FROM (delivered_at - pickup_at)) / 60.0),
          0.0
        ) AS avg_delivery_time_minutes,
        MIN(EXTRACT(EPOCH FROM (delivered_at - pickup_at)) / 60.0) as min_time,
        MAX(EXTRACT(EPOCH FROM (delivered_at - pickup_at)) / 60.0) as max_time,
        COUNT(*) as delivery_count
      FROM orders
      WHERE status = 'delivered'
        AND delivered_at > pickup_at
        AND pickup_at IS NOT NULL
        AND delivered_at IS NOT NULL
        AND created_at BETWEEN $1 AND $2
    `;

    try {
      const result = await executeMetricsQuery(pool, query, [startDate, endDate], {
        timeout: TIMEOUT_CONFIG.METRICS,
      });
      return {
        avg_delivery_time_minutes: parseFloat(result.rows[0].avg_delivery_time_minutes) || 0,
        min_time: parseFloat(result.rows[0].min_time) || 0,
        max_time: parseFloat(result.rows[0].max_time) || 0,
        delivery_count: parseInt(result.rows[0].delivery_count) || 0,
      };
    } catch (error) {
      logger.error('Error getting average delivery time:', error);
      throw error;
    }
  }

  /**
   * Get courier performance metrics
   * Rankings and efficiency scores
   */
  static async getCourierPerformance(startDate, endDate, limit = 100, offset = 0) {
    const query = `
      SELECT
        driver_id,
        COUNT(*) as total_deliveries,
        COUNT(*) FILTER(WHERE status = 'delivered') as completed,
        COUNT(*) FILTER(WHERE status = 'delivered' AND delivered_at <= sla_deadline) as on_time,
        COALESCE(
          CAST(COUNT(*) FILTER(WHERE status = 'delivered' AND delivered_at <= sla_deadline) AS DECIMAL) * 100.0 /
          NULLIF(COUNT(*) FILTER(WHERE status = 'delivered'), 0),
          0.0
        ) AS on_time_rate,
        AVG(
          EXTRACT(EPOCH FROM (delivered_at - pickup_at)) / 60.0
        ) FILTER(WHERE status = 'delivered' AND delivered_at > pickup_at) as avg_delivery_time_minutes
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
        AND driver_id IS NOT NULL
      GROUP BY driver_id
      ORDER BY completed DESC, on_time_rate DESC
      LIMIT $3 OFFSET $4
    `;

    // Get total count for pagination metadata
    const countQuery = `
      SELECT COUNT(DISTINCT driver_id) as total
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
        AND driver_id IS NOT NULL
    `;

    try {
      const [result, countResult] = await Promise.all([
        executeMetricsQuery(pool, query, [startDate, endDate, limit, offset], {
          timeout: TIMEOUT_CONFIG.METRICS,
        }),
        executeMetricsQuery(pool, countQuery, [startDate, endDate], {
          timeout: TIMEOUT_CONFIG.SIMPLE,
        }),
      ]);

      return {
        data: result.rows.map((row) => ({
          driver_id: parseInt(row.driver_id),
          total_deliveries: parseInt(row.total_deliveries),
          completed: parseInt(row.completed),
          on_time: parseInt(row.on_time),
          on_time_rate: parseFloat(row.on_time_rate) || 0,
          avg_delivery_time_minutes: parseFloat(row.avg_delivery_time_minutes) || 0,
        })),
        total: parseInt(countResult.rows[0].total) || 0,
      };
    } catch (error) {
      logger.error('Error getting courier performance:', error);
      throw error;
    }
  }

  /**
   * Get cancellation rate
   * Problem detection metric
   */
  static async getCancellationRate(startDate, endDate) {
    const query = `
      SELECT
        COALESCE(
          CAST(COUNT(*) FILTER(WHERE status = 'cancelled') AS DECIMAL) * 100.0 /
          NULLIF(COUNT(*), 0),
          0.0
        ) AS cancellation_rate,
        COUNT(*) FILTER(WHERE status = 'cancelled') as cancelled_count,
        COUNT(*) as total_orders
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
    `;

    try {
      const result = await executeMetricsQuery(pool, query, [startDate, endDate], {
        timeout: TIMEOUT_CONFIG.METRICS,
      });
      return {
        cancellation_rate: parseFloat(result.rows[0].cancellation_rate) || 0,
        cancelled_count: parseInt(result.rows[0].cancelled_count) || 0,
        total_orders: parseInt(result.rows[0].total_orders) || 0,
      };
    } catch (error) {
      logger.error('Error getting cancellation rate:', error);
      throw error;
    }
  }

  /**
   * Get return rate
   * Quality and satisfaction metric
   */
  static async getReturnRate(startDate, endDate) {
    const query = `
      SELECT
        COALESCE(
          CAST(COUNT(*) FILTER(WHERE status = 'returned') AS DECIMAL) * 100.0 /
          NULLIF(COUNT(*), 0),
          0.0
        ) AS return_rate,
        COUNT(*) FILTER(WHERE status = 'returned') as returned_count,
        COUNT(*) as total_orders
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
    `;

    try {
      const result = await executeMetricsQuery(pool, query, [startDate, endDate], {
        timeout: TIMEOUT_CONFIG.METRICS,
      });
      return {
        return_rate: parseFloat(result.rows[0].return_rate) || 0,
        returned_count: parseInt(result.rows[0].returned_count) || 0,
        total_orders: parseInt(result.rows[0].total_orders) || 0,
      };
    } catch (error) {
      logger.error('Error getting return rate:', error);
      throw error;
    }
  }

  /**
   * Get active couriers count
   */
  static async getActiveCouriers(startDate, endDate) {
    const query = `
      SELECT
        COUNT(DISTINCT driver_id) AS active_couriers
      FROM orders
      WHERE driver_id IS NOT NULL
        AND created_at BETWEEN $1 AND $2
    `;

    try {
      const result = await executeMetricsQuery(pool, query, [startDate, endDate], {
        timeout: TIMEOUT_CONFIG.SIMPLE,
      });
      return {
        active_couriers: parseInt(result.rows[0].active_couriers) || 0,
      };
    } catch (error) {
      logger.error('Error getting active couriers:', error);
      throw error;
    }
  }

  /**
   * Get deliveries per courier
   * Workload distribution metric
   */
  static async getDeliveriesPerCourier(startDate, endDate) {
    const query = `
      SELECT
        COALESCE(
          CAST(COUNT(*) FILTER(WHERE status IN('delivered','returned')) AS DECIMAL) /
          NULLIF(COUNT(DISTINCT driver_id), 0),
          0.0
        ) AS deliveries_per_courier,
        COUNT(*) FILTER(WHERE status IN('delivered','returned')) as total_completed,
        COUNT(DISTINCT driver_id) as total_couriers
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
        AND driver_id IS NOT NULL
    `;

    try {
      const result = await executeMetricsQuery(pool, query, [startDate, endDate], {
        timeout: TIMEOUT_CONFIG.METRICS,
      });
      return {
        deliveries_per_courier: parseFloat(result.rows[0].deliveries_per_courier) || 0,
        total_completed: parseInt(result.rows[0].total_completed) || 0,
        total_couriers: parseInt(result.rows[0].total_couriers) || 0,
      };
    } catch (error) {
      logger.error('Error getting deliveries per courier:', error);
      throw error;
    }
  }

  /**
   * Get order status distribution
   */
  static async getOrderStatusDistribution(startDate, endDate, limit = 100, offset = 0) {
    const query = `
      SELECT
        status as name,
        COUNT(*) as value
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY status
      ORDER BY value DESC
      LIMIT $3 OFFSET $4
    `;

    // Get total count of distinct statuses
    const countQuery = `
      SELECT COUNT(DISTINCT status) as total
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
    `;

    try {
      const [result, countResult] = await Promise.all([
        executeMetricsQuery(pool, query, [startDate, endDate, limit, offset], {
          timeout: TIMEOUT_CONFIG.SIMPLE,
        }),
        executeMetricsQuery(pool, countQuery, [startDate, endDate], {
          timeout: TIMEOUT_CONFIG.SIMPLE,
        }),
      ]);

      return {
        data: result.rows.map((row) => ({
          name: row.name,
          value: parseInt(row.value),
        })),
        total: parseInt(countResult.rows[0].total) || 0,
      };
    } catch (error) {
      logger.error('Error getting order status distribution:', error);
      throw error;
    }
  }

  /**
   * Get fleet performance metrics
   * Fleet utilization, availability, and performance by vehicle type
   */
  static async getFleetPerformance(startDate, endDate) {
    const query = `
      SELECT
        d.vehicle_type,
        COUNT(DISTINCT d.id) as total_drivers,
        COUNT(DISTINCT d.id) FILTER(WHERE d.status = 'available') as available_drivers,
        COUNT(DISTINCT d.id) FILTER(WHERE d.status = 'busy') as busy_drivers,
        COUNT(DISTINCT d.id) FILTER(WHERE d.status = 'offline') as offline_drivers,
        COALESCE(
          CAST(COUNT(DISTINCT d.id) FILTER(WHERE d.status IN ('available', 'busy')) AS DECIMAL) * 100.0 /
          NULLIF(COUNT(DISTINCT d.id), 0),
          0.0
        ) as utilization_rate,
        AVG(d.rating) as avg_rating,
        SUM(d.total_deliveries) as total_deliveries,
        SUM(d.successful_deliveries) as successful_deliveries,
        SUM(d.failed_deliveries) as failed_deliveries,
        COALESCE(
          CAST(SUM(d.successful_deliveries) AS DECIMAL) * 100.0 /
          NULLIF(SUM(d.total_deliveries), 0),
          0.0
        ) as success_rate
      FROM drivers d
      WHERE d.is_active = true
      GROUP BY d.vehicle_type
      ORDER BY total_drivers DESC
    `;

    try {
      const result = await executeMetricsQuery(pool, query, [], {
        timeout: TIMEOUT_CONFIG.METRICS,
      });

      const metrics = result.rows.map((row) => ({
        vehicle_type: row.vehicle_type,
        total_drivers: parseInt(row.total_drivers) || 0,
        available_drivers: parseInt(row.available_drivers) || 0,
        busy_drivers: parseInt(row.busy_drivers) || 0,
        offline_drivers: parseInt(row.offline_drivers) || 0,
        utilization_rate: parseFloat(row.utilization_rate) || 0,
        avg_rating: parseFloat(row.avg_rating) || 0,
        total_deliveries: parseInt(row.total_deliveries) || 0,
        successful_deliveries: parseInt(row.successful_deliveries) || 0,
        failed_deliveries: parseInt(row.failed_deliveries) || 0,
        success_rate: parseFloat(row.success_rate) || 0,
      }));

      // Calculate overall fleet metrics
      const overall = {
        total_drivers: metrics.reduce((sum, m) => sum + m.total_drivers, 0),
        available_drivers: metrics.reduce((sum, m) => sum + m.available_drivers, 0),
        busy_drivers: metrics.reduce((sum, m) => sum + m.busy_drivers, 0),
        offline_drivers: metrics.reduce((sum, m) => sum + m.offline_drivers, 0),
        total_deliveries: metrics.reduce((sum, m) => sum + m.total_deliveries, 0),
        successful_deliveries: metrics.reduce((sum, m) => sum + m.successful_deliveries, 0),
        failed_deliveries: metrics.reduce((sum, m) => sum + m.failed_deliveries, 0),
      };

      overall.utilization_rate = overall.total_drivers > 0
        ? ((overall.available_drivers + overall.busy_drivers) / overall.total_drivers) * 100
        : 0;

      overall.success_rate = overall.total_deliveries > 0
        ? (overall.successful_deliveries / overall.total_deliveries) * 100
        : 0;

      overall.avg_rating = metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.avg_rating, 0) / metrics.length
        : 0;

      return {
        overall,
        by_vehicle_type: metrics,
      };
    } catch (error) {
      logger.error('Error getting fleet performance:', error);
      throw error;
    }
  }

  /**
   * Get driver efficiency metrics
   * Deliveries per hour, route efficiency, working time analysis
   */
  static async getDriverEfficiency(startDate, endDate) {
    const query = `
      WITH driver_stats AS (
        SELECT
          driver_id,
          COUNT(*) as total_orders,
          COUNT(*) FILTER(WHERE status = 'delivered') as completed_orders,
          AVG(
            EXTRACT(EPOCH FROM (delivered_at - picked_up_at)) / 60.0
          ) FILTER(WHERE status = 'delivered' AND delivered_at > picked_up_at) as avg_delivery_time_minutes,
          AVG(estimated_distance) FILTER(WHERE estimated_distance > 0) as avg_estimated_distance,
          AVG(actual_distance) FILTER(WHERE actual_distance > 0) as avg_actual_distance,
          MIN(created_at) as first_order_time,
          MAX(delivered_at) as last_delivery_time
        FROM orders
        WHERE created_at BETWEEN $1 AND $2
          AND driver_id IS NOT NULL
        GROUP BY driver_id
      ),
      driver_details AS (
        SELECT
          ds.*,
          d.name as driver_name,
          d.vehicle_type,
          d.rating,
          EXTRACT(EPOCH FROM (ds.last_delivery_time - ds.first_order_time)) / 3600.0 as working_hours
        FROM driver_stats ds
        JOIN drivers d ON ds.driver_id = d.id
      )
      SELECT
        driver_id,
        driver_name,
        vehicle_type,
        rating,
        total_orders,
        completed_orders,
        avg_delivery_time_minutes,
        avg_estimated_distance,
        avg_actual_distance,
        working_hours,
        CASE
          WHEN working_hours > 0 THEN completed_orders / working_hours
          ELSE 0
        END as deliveries_per_hour,
        CASE
          WHEN avg_estimated_distance > 0 AND avg_actual_distance > 0
          THEN (avg_estimated_distance / NULLIF(avg_actual_distance, 0)) * 100.0
          ELSE 100.0
        END as route_efficiency_percent,
        COALESCE(
          CAST(completed_orders AS DECIMAL) * 100.0 /
          NULLIF(total_orders, 0),
          0.0
        ) as completion_rate
      FROM driver_details
      WHERE completed_orders > 0
      ORDER BY deliveries_per_hour DESC, completion_rate DESC
    `;

    try {
      const result = await executeMetricsQuery(pool, query, [startDate, endDate], {
        timeout: TIMEOUT_CONFIG.METRICS,
      });

      const drivers = result.rows.map((row) => ({
        driver_id: row.driver_id,
        driver_name: row.driver_name,
        vehicle_type: row.vehicle_type,
        rating: parseFloat(row.rating) || 0,
        total_orders: parseInt(row.total_orders) || 0,
        completed_orders: parseInt(row.completed_orders) || 0,
        avg_delivery_time_minutes: parseFloat(row.avg_delivery_time_minutes) || 0,
        avg_estimated_distance: parseFloat(row.avg_estimated_distance) || 0,
        avg_actual_distance: parseFloat(row.avg_actual_distance) || 0,
        working_hours: parseFloat(row.working_hours) || 0,
        deliveries_per_hour: parseFloat(row.deliveries_per_hour) || 0,
        route_efficiency_percent: parseFloat(row.route_efficiency_percent) || 100,
        completion_rate: parseFloat(row.completion_rate) || 0,
      }));

      // Calculate summary statistics
      const summary = {
        total_drivers: drivers.length,
        avg_deliveries_per_hour: drivers.length > 0
          ? drivers.reduce((sum, d) => sum + d.deliveries_per_hour, 0) / drivers.length
          : 0,
        avg_route_efficiency: drivers.length > 0
          ? drivers.reduce((sum, d) => sum + d.route_efficiency_percent, 0) / drivers.length
          : 100,
        avg_completion_rate: drivers.length > 0
          ? drivers.reduce((sum, d) => sum + d.completion_rate, 0) / drivers.length
          : 0,
        avg_delivery_time_minutes: drivers.length > 0
          ? drivers.reduce((sum, d) => sum + d.avg_delivery_time_minutes, 0) / drivers.length
          : 0,
        total_completed_orders: drivers.reduce((sum, d) => sum + d.completed_orders, 0),
        total_working_hours: drivers.reduce((sum, d) => sum + d.working_hours, 0),
      };

      return {
        summary,
        top_performers: drivers.slice(0, 10), // Top 10 by deliveries per hour
        all_drivers: drivers,
      };
    } catch (error) {
      logger.error('Error getting driver efficiency:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive dashboard metrics
   * All key metrics in one call
   */
  static async getComprehensiveDashboard(startDate, endDate) {
    try {
      logger.info('Starting comprehensive dashboard query', { startDate, endDate });

      // Execute queries sequentially to identify which one hangs
      logger.info('Executing on-time delivery rate query...');
      const onTimeRate = await this.getOnTimeDeliveryRate(startDate, endDate);
      logger.info('On-time delivery rate query completed');

      logger.info('Executing completion rate query...');
      const completionRate = await this.getOrderCompletionRate(startDate, endDate);
      logger.info('Completion rate query completed');

      logger.info('Executing average delivery time query...');
      const avgDeliveryTime = await this.getAverageDeliveryTime(startDate, endDate);
      logger.info('Average delivery time query completed');

      logger.info('Executing cancellation rate query...');
      const cancellationRate = await this.getCancellationRate(startDate, endDate);
      logger.info('Cancellation rate query completed');

      logger.info('Executing return rate query...');
      const returnRate = await this.getReturnRate(startDate, endDate);
      logger.info('Return rate query completed');

      logger.info('Executing active couriers query...');
      const activeCouriers = await this.getActiveCouriers(startDate, endDate);
      logger.info('Active couriers query completed');

      logger.info('Executing deliveries per courier query...');
      const deliveriesPerCourier = await this.getDeliveriesPerCourier(startDate, endDate);
      logger.info('Deliveries per courier query completed');

      logger.info('Executing order status distribution query...');
      const statusDistribution = await this.getOrderStatusDistribution(startDate, endDate);
      logger.info('Order status distribution query completed');

      logger.info('All queries completed successfully');

      // Use the results from sequential execution
      return {
        timestamp: new Date().toISOString(),
        period: {
          start: startDate,
          end: endDate,
        },
        performance: {
          on_time_delivery: onTimeRate,
          completion_rate: completionRate,
          avg_delivery_time: avgDeliveryTime,
        },
        quality: {
          cancellation_rate: cancellationRate,
          return_rate: returnRate,
        },
        fleet: {
          active_couriers: activeCouriers,
          deliveries_per_courier: deliveriesPerCourier,
        },
        distribution: {
          order_status: statusDistribution,
        },
      };
    } catch (error) {
      logger.error('Error getting comprehensive dashboard:', error);
      throw error;
    }
  }
}

module.exports = ProductionMetricsService;
