/**
 * BarqFleet Production Database Service
 *
 * Connects to the live BarqFleet PostgreSQL database (read replica)
 * to fetch real orders, shipments, hubs, couriers, and operational data.
 *
 * This service provides the data source for the Route Optimization API,
 * replacing all mock data with actual production logistics data.
 */

const { Pool } = require('pg');
const { logger } = require('../utils/logger');

class BarqProductionDBService {
  constructor() {
    // Production database read replica connection
    // Using read replica to avoid impacting production writes
    this.pool = new Pool({
      host: process.env.BARQ_PROD_DB_HOST || 'barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com',
      port: process.env.BARQ_PROD_DB_PORT || 5432,
      database: process.env.BARQ_PROD_DB_NAME || 'barqfleet_db',
      user: process.env.BARQ_PROD_DB_USER || 'ventgres',
      password: process.env.BARQ_PROD_DB_PASSWORD || 'Jk56tt4HkzePFfa3ht',
      ssl: process.env.BARQ_PROD_DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on BarqFleet production database client', { error: err });
    });

    logger.info('BarqFleet Production Database Service initialized');
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const result = await this.pool.query('SELECT NOW() as current_time');
      logger.info('BarqFleet production database connection successful', {
        timestamp: result.rows[0].current_time,
      });
      return { success: true, timestamp: result.rows[0].current_time };
    } catch (error) {
      logger.error('Failed to connect to BarqFleet production database', {
        error: error.message,
        stack: error.stack,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch active hubs (pickup locations)
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of hubs
   */
  async getHubs(filters = {}) {
    try {
      logger.info('[BarqProduction] getHubs called - NEW CODE VERSION 1.0');

      let query = `
        SELECT
          id,
          code,
          manager,
          mobile,
          latitude,
          longitude,
          city_id,
          is_active,
          is_open,
          bundle_limit,
          dispatch_radius,
          max_distance,
          hub_type,
          street_name,
          created_at,
          updated_at
        FROM hubs
        WHERE 1=1
      `;

      const params = [];
      let paramIndex = 1;

      if (filters.is_active !== undefined) {
        query += ` AND is_active = $${paramIndex}`;
        params.push(filters.is_active);
        paramIndex++;
      }

      if (filters.city_id) {
        query += ` AND city_id = $${paramIndex}`;
        params.push(filters.city_id);
        paramIndex++;
      }

      query += ' ORDER BY code ASC';

      if (filters.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
      }

      const result = await this.pool.query(query, params);

      logger.info('Fetched hubs from BarqFleet production', {
        count: result.rows.length,
        filters,
      });

      return result.rows;
    } catch (error) {
      logger.error('Failed to fetch hubs', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Fetch couriers (delivery personnel)
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of couriers
   */
  async getCouriers(filters = {}) {
    try {
      let query = `
        SELECT
          c.id,
          c.mobile_number as mobile,
          c.first_name,
          c.last_name,
          c.is_online,
          c.is_busy,
          c.is_banned,
          c.city_id,
          c.vehicle_type,
          c.latitude,
          c.longitude,
          c.trust_level,
          c.courier_type,
          c.hub_id,
          c.created_at,
          c.updated_at
        FROM couriers c
        WHERE 1=1
      `;

      const params = [];
      let paramIndex = 1;

      // Note: is_active column doesn't exist in production schema
      // Using is_banned instead to filter active couriers

      if (filters.is_online !== undefined) {
        query += ` AND c.is_online = $${paramIndex}`;
        params.push(filters.is_online);
        paramIndex++;
      }

      if (filters.city_id) {
        query += ` AND c.city_id = $${paramIndex}`;
        params.push(filters.city_id);
        paramIndex++;
      }

      if (filters.is_banned !== undefined) {
        query += ` AND c.is_banned = $${paramIndex}`;
        params.push(filters.is_banned);
        paramIndex++;
      }

      query += ' ORDER BY c.first_name ASC, c.last_name ASC';

      if (filters.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
      }

      const result = await this.pool.query(query, params);

      logger.info('Fetched couriers from BarqFleet production', {
        count: result.rows.length,
        filters,
      });

      return result.rows;
    } catch (error) {
      logger.error('Failed to fetch couriers', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Fetch orders
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of orders
   */
  async getOrders(filters = {}) {
    try {
      let query = `
        SELECT
          o.id,
          o.tracking_no,
          o.merchant_id,
          o.hub_id,
          o.shipment_id,
          o.order_status,
          o.payment_type,
          o.delivery_fee,
          o.grand_total,
          o.customer_details,
          o.origin,
          o.destination,
          o.products,
          o.is_assigned,
          o.is_completed,
          o.delivery_start,
          o.delivery_finish,
          o.cod_fee,
          o.created_at,
          o.updated_at,
          m.name as merchant_name,
          h.code as hub_code,
          h.manager as hub_manager
        FROM orders o
        LEFT JOIN merchants m ON m.id = o.merchant_id
        LEFT JOIN hubs h ON h.id = o.hub_id
        WHERE 1=1
      `;

      const params = [];
      let paramIndex = 1;

      if (filters.order_status) {
        if (Array.isArray(filters.order_status)) {
          query += ` AND o.order_status = ANY($${paramIndex})`;
          params.push(filters.order_status);
        } else {
          query += ` AND o.order_status = $${paramIndex}`;
          params.push(filters.order_status);
        }
        paramIndex++;
      }

      if (filters.hub_id) {
        query += ` AND o.hub_id = $${paramIndex}`;
        params.push(filters.hub_id);
        paramIndex++;
      }

      if (filters.merchant_id) {
        query += ` AND o.merchant_id = $${paramIndex}`;
        params.push(filters.merchant_id);
        paramIndex++;
      }

      if (filters.created_after) {
        query += ` AND o.created_at >= $${paramIndex}`;
        params.push(filters.created_after);
        paramIndex++;
      }

      if (filters.created_before) {
        query += ` AND o.created_at <= $${paramIndex}`;
        params.push(filters.created_before);
        paramIndex++;
      }

      query += ' ORDER BY o.created_at DESC';

      if (filters.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
      }

      const result = await this.pool.query(query, params);

      logger.info('Fetched orders from BarqFleet production', {
        count: result.rows.length,
        filters,
      });

      return result.rows;
    } catch (error) {
      logger.error('Failed to fetch orders', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Fetch shipments (bundled orders assigned to couriers)
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of shipments
   */
  async getShipments(filters = {}) {
    try {
      let query = `
        SELECT
          s.id,
          s.courier_id,
          s.is_assigned,
          s.is_completed,
          s.latitude,
          s.longitude,
          s.reward,
          s.driving_distance as total_distance,
          s.created_at,
          s.updated_at,
          c.first_name as courier_first_name,
          c.last_name as courier_last_name,
          c.mobile_number as courier_mobile,
          NULL as hub_code,
          NULL as hub_manager,
          (
            SELECT COUNT(*)
            FROM orders
            WHERE shipment_id = s.id
          ) as order_count
        FROM shipments s
        LEFT JOIN couriers c ON c.id = s.courier_id
        WHERE 1=1
      `;

      const params = [];
      let paramIndex = 1;

      if (filters.is_completed !== undefined) {
        query += ` AND s.is_completed = $${paramIndex}`;
        params.push(filters.is_completed);
        paramIndex++;
      }

      if (filters.is_assigned !== undefined) {
        query += ` AND s.is_assigned = $${paramIndex}`;
        params.push(filters.is_assigned);
        paramIndex++;
      }

      if (filters.courier_id) {
        query += ` AND s.courier_id = $${paramIndex}`;
        params.push(filters.courier_id);
        paramIndex++;
      }

      // Note: shipments table doesn't have hub_id field in production schema
      // Removed hub_id filter

      query += ' ORDER BY s.created_at DESC';

      if (filters.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
      }

      const result = await this.pool.query(query, params);

      logger.info('Fetched shipments from BarqFleet production', {
        count: result.rows.length,
        filters,
      });

      return result.rows;
    } catch (error) {
      logger.error('Failed to fetch shipments', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Fetch order logs (status change history)
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of order logs
   */
  async getOrderLogs(filters = {}) {
    try {
      let query = `
        SELECT
          ol.id,
          ol.order_id,
          ol.new_status,
          ol.old_status,
          ol.reason,
          ol.created_at,
          o.tracking_no
        FROM order_logs ol
        LEFT JOIN orders o ON o.id = ol.order_id
        WHERE 1=1
      `;

      const params = [];
      let paramIndex = 1;

      if (filters.order_id) {
        query += ` AND ol.order_id = $${paramIndex}`;
        params.push(filters.order_id);
        paramIndex++;
      }

      if (filters.created_after) {
        query += ` AND ol.created_at >= $${paramIndex}`;
        params.push(filters.created_after);
        paramIndex++;
      }

      query += ' ORDER BY ol.created_at DESC';

      if (filters.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
      }

      const result = await this.pool.query(query, params);

      logger.info('Fetched order logs from BarqFleet production', {
        count: result.rows.length,
        filters,
      });

      return result.rows;
    } catch (error) {
      logger.error('Failed to fetch order logs', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get pending orders that need assignment
   * These are orders ready for delivery but not yet assigned to a courier
   */
  async getPendingOrders(hubId = null, limit = 100) {
    try {
      const filters = {
        order_status: ['ready_for_delivery', 'merchant_confirmed', 'processing'],
        limit: limit,
      };

      if (hubId) {
        filters.hub_id = hubId;
      }

      // Only get orders from today and yesterday to avoid old data
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      filters.created_after = yesterday.toISOString();

      return await this.getOrders(filters);
    } catch (error) {
      logger.error('Failed to fetch pending orders', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get available couriers (online, not busy, not banned)
   */
  async getAvailableCouriers(cityId = null, limit = 100) {
    try {
      const filters = {
        is_online: true,
        is_banned: false,
        limit: limit,
      };

      if (cityId) {
        filters.city_id = cityId;
      }

      return await this.getCouriers(filters);
    } catch (error) {
      logger.error('Failed to fetch available couriers', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get active shipments (assigned but not completed)
   */
  async getActiveShipments(limit = 100) {
    try {
      const filters = {
        is_assigned: true,
        is_completed: false,
        limit: limit,
      };

      return await this.getShipments(filters);
    } catch (error) {
      logger.error('Failed to fetch active shipments', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getStatistics() {
    try {
      const stats = {};

      // Total counts
      const totalOrders = await this.pool.query('SELECT COUNT(*) as count FROM orders');
      stats.total_orders = parseInt(totalOrders.rows[0].count);

      const totalCouriers = await this.pool.query('SELECT COUNT(*) as count FROM couriers WHERE is_banned = false');
      stats.total_couriers = parseInt(totalCouriers.rows[0].count);

      const totalHubs = await this.pool.query('SELECT COUNT(*) as count FROM hubs WHERE is_active = true');
      stats.total_hubs = parseInt(totalHubs.rows[0].count);

      const totalShipments = await this.pool.query('SELECT COUNT(*) as count FROM shipments');
      stats.total_shipments = parseInt(totalShipments.rows[0].count);

      // Today's orders
      const todayOrders = await this.pool.query(`
        SELECT COUNT(*) as count
        FROM orders
        WHERE created_at >= CURRENT_DATE
      `);
      stats.today_orders = parseInt(todayOrders.rows[0].count);

      // Pending orders
      const pendingOrders = await this.pool.query(`
        SELECT COUNT(*) as count
        FROM orders
        WHERE order_status IN ('ready_for_delivery', 'merchant_confirmed', 'processing')
        AND created_at >= CURRENT_DATE - INTERVAL '1 day'
      `);
      stats.pending_orders = parseInt(pendingOrders.rows[0].count);

      // Online couriers
      const onlineCouriers = await this.pool.query(`
        SELECT COUNT(*) as count
        FROM couriers
        WHERE is_online = true AND is_banned = false
      `);
      stats.online_couriers = parseInt(onlineCouriers.rows[0].count);

      // Active shipments
      const activeShipments = await this.pool.query(`
        SELECT COUNT(*) as count
        FROM shipments
        WHERE is_assigned = true AND is_completed = false
      `);
      stats.active_shipments = parseInt(activeShipments.rows[0].count);

      logger.info('Fetched database statistics', stats);

      return stats;
    } catch (error) {
      logger.error('Failed to fetch statistics', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Close database connections
   */
  async close() {
    await this.pool.end();
    logger.info('BarqFleet Production Database connections closed');
  }
}

// Export singleton instance
module.exports = new BarqProductionDBService();
