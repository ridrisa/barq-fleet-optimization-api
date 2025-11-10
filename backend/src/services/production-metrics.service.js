/**
 * Production Metrics Service
 * Contains production-tested SQL queries from BARQ Fleet production system
 * Source: barqfleet_db_files/queries_external_metrics.py
 */

const pool = require('./postgres.service');
const logger = require('../utils/logger');

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
      const result = await pool.query(query, [startDate, endDate]);
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
      const result = await pool.query(query, [startDate, endDate]);
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
      const result = await pool.query(query, [startDate, endDate]);
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
  static async getCourierPerformance(startDate, endDate) {
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
      LIMIT 20
    `;

    try {
      const result = await pool.query(query, [startDate, endDate]);
      return result.rows.map((row) => ({
        driver_id: parseInt(row.driver_id),
        total_deliveries: parseInt(row.total_deliveries),
        completed: parseInt(row.completed),
        on_time: parseInt(row.on_time),
        on_time_rate: parseFloat(row.on_time_rate) || 0,
        avg_delivery_time_minutes: parseFloat(row.avg_delivery_time_minutes) || 0,
      }));
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
      const result = await pool.query(query, [startDate, endDate]);
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
      const result = await pool.query(query, [startDate, endDate]);
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
      const result = await pool.query(query, [startDate, endDate]);
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
      const result = await pool.query(query, [startDate, endDate]);
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
  static async getOrderStatusDistribution(startDate, endDate) {
    const query = `
      SELECT
        status as name,
        COUNT(*) as value
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY status
      ORDER BY value DESC
    `;

    try {
      const result = await pool.query(query, [startDate, endDate]);
      return result.rows.map((row) => ({
        name: row.name,
        value: parseInt(row.value),
      }));
    } catch (error) {
      logger.error('Error getting order status distribution:', error);
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
