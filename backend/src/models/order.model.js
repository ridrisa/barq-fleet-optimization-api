/**
 * Order Model
 * Handles all database operations for orders
 */

const db = require('../database');
const { logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class OrderModel {
  /**
   * Create a new order
   */
  static async create(orderData) {
    const {
      customer_id,
      service_type,
      pickup_location,
      pickup_address,
      dropoff_location,
      dropoff_address,
      package_details,
      priority = 0,
      cod_amount = 0,
      delivery_fee,
    } = orderData;

    // Calculate SLA deadline based on service type
    const slaHours = service_type === 'BARQ' ? 1 : 4;
    const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    const query = `
      INSERT INTO orders (
        order_number,
        customer_id,
        service_type,
        pickup_latitude,
        pickup_longitude,
        pickup_address,
        dropoff_latitude,
        dropoff_longitude,
        dropoff_address,
        package_details,
        priority,
        cod_amount,
        delivery_fee,
        sla_deadline,
        total_amount
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6,
        $7, $8, $9,
        $10, $11, $12, $13, $14, $15
      ) RETURNING *
    `;

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const totalAmount = delivery_fee + cod_amount;

    const values = [
      orderNumber,
      customer_id,
      service_type,
      pickup_location.lat,
      pickup_location.lng,
      JSON.stringify(pickup_address),
      dropoff_location.lat,
      dropoff_location.lng,
      JSON.stringify(dropoff_address),
      JSON.stringify(package_details || {}),
      priority,
      cod_amount,
      delivery_fee,
      slaDeadline.toISOString(),
      totalAmount,
    ];

    try {
      const result = await db.query(query, values);
      logger.info(`[OrderModel] Created order: ${orderNumber}`);
      return result.rows[0];
    } catch (error) {
      logger.error('[OrderModel] Failed to create order', error);
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  static async getById(orderId) {
    const query = `
      SELECT o.*,
        c.name as customer_name, c.phone as customer_phone,
        d.name as driver_name, d.phone as driver_phone
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      WHERE o.id = $1
    `;

    try {
      const result = await db.query(query, [orderId]);
      return result.rows[0];
    } catch (error) {
      logger.error('[OrderModel] Failed to get order', error);
      throw error;
    }
  }

  /**
   * Get order by order number
   */
  static async getByOrderNumber(orderNumber) {
    const query = `
      SELECT o.*,
        c.name as customer_name, c.phone as customer_phone,
        d.name as driver_name, d.phone as driver_phone
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      WHERE o.order_number = $1
    `;

    try {
      const result = await db.query(query, [orderNumber]);
      return result.rows[0];
    } catch (error) {
      logger.error('[OrderModel] Failed to get order by number', error);
      throw error;
    }
  }

  /**
   * Update order status
   */
  static async updateStatus(orderId, status, additionalData = {}) {
    const statusTimestamps = {
      assigned: 'assigned_at',
      picked_up: 'picked_up_at',
      delivered: 'delivered_at',
    };

    let query = `UPDATE orders SET status = $1`;
    const values = [status];
    let valueIndex = 2;

    // Add timestamp for specific statuses
    if (statusTimestamps[status]) {
      query += `, ${statusTimestamps[status]} = CURRENT_TIMESTAMP`;
    }

    // Add driver assignment
    if (status === 'assigned' && additionalData.driver_id) {
      query += `, driver_id = $${valueIndex}`;
      values.push(additionalData.driver_id);
      valueIndex++;
    }

    // Add actual delivery time for delivered status
    if (status === 'delivered') {
      query += `, actual_delivery_time = CURRENT_TIMESTAMP`;
    }

    // Add failure/cancellation reason
    if (status === 'failed' && additionalData.failure_reason) {
      query += `, failure_reason = $${valueIndex}`;
      values.push(additionalData.failure_reason);
      valueIndex++;
    }

    if (status === 'cancelled' && additionalData.cancellation_reason) {
      query += `, cancellation_reason = $${valueIndex}`;
      values.push(additionalData.cancellation_reason);
      valueIndex++;
    }

    query += ` WHERE id = $${valueIndex} RETURNING *`;
    values.push(orderId);

    try {
      const result = await db.query(query, values);
      logger.info(`[OrderModel] Updated order ${orderId} status to ${status}`);
      return result.rows[0];
    } catch (error) {
      logger.error('[OrderModel] Failed to update order status', error);
      throw error;
    }
  }

  /**
   * Assign driver to order
   */
  static async assignDriver(orderId, driverId, estimatedDeliveryTime) {
    // Validate UUID format - if driverId is an integer, convert to UUID format
    let validDriverId = driverId;

    if (driverId && typeof driverId !== 'string') {
      // If it's a number, convert to string and validate
      validDriverId = String(driverId);
    }

    // Check if it's a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(validDriverId)) {
      logger.warn(`[OrderModel] Invalid UUID format for driver ID: ${driverId}, skipping local assignment`);
      // Return success but don't write to database (production has integer IDs)
      return {
        id: orderId,
        driver_id: driverId,
        status: 'assigned',
        warning: 'Driver ID not in UUID format - production assignment only'
      };
    }

    const query = `
      UPDATE orders
      SET
        driver_id = $1,
        status = 'assigned',
        assigned_at = CURRENT_TIMESTAMP,
        estimated_delivery_time = $2
      WHERE id = $3
      RETURNING *
    `;

    try {
      const result = await db.query(query, [validDriverId, estimatedDeliveryTime, orderId]);
      logger.info(`[OrderModel] Assigned driver ${validDriverId} to order ${orderId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('[OrderModel] Failed to assign driver', error);
      throw error;
    }
  }

  /**
   * Get active orders
   */
  static async getActiveOrders(filters = {}) {
    let query = `
      SELECT o.*,
        c.name as customer_name, c.phone as customer_phone,
        d.name as driver_name, d.phone as driver_phone,
        o.pickup_longitude as pickup_lng,
        o.pickup_latitude as pickup_lat,
        o.dropoff_longitude as dropoff_lng,
        o.dropoff_latitude as dropoff_lat
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      WHERE o.status NOT IN ('delivered', 'cancelled', 'failed')
    `;

    const values = [];
    let valueIndex = 1;

    if (filters.service_type) {
      query += ` AND o.service_type = $${valueIndex}`;
      values.push(filters.service_type);
      valueIndex++;
    }

    if (filters.driver_id) {
      query += ` AND o.driver_id = $${valueIndex}`;
      values.push(filters.driver_id);
      valueIndex++;
    }

    if (filters.status) {
      query += ` AND o.status = $${valueIndex}`;
      values.push(filters.status);
      valueIndex++;
    }

    query += ` ORDER BY o.priority DESC, o.created_at ASC`;

    if (filters.limit) {
      query += ` LIMIT $${valueIndex}`;
      values.push(filters.limit);
      valueIndex++;
    }

    try {
      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      logger.error('[OrderModel] Failed to get active orders', error);
      throw error;
    }
  }

  /**
   * Get orders near SLA breach
   */
  static async getOrdersNearSLABreach(minutesThreshold = 15) {
    const query = `
      SELECT o.*,
        c.name as customer_name, c.phone as customer_phone,
        d.name as driver_name, d.phone as driver_phone,
        EXTRACT(EPOCH FROM (o.sla_deadline - CURRENT_TIMESTAMP))/60 as minutes_remaining
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      WHERE o.status NOT IN ('delivered', 'cancelled', 'failed')
        AND o.sla_deadline <= CURRENT_TIMESTAMP + INTERVAL '${minutesThreshold} minutes'
        AND o.sla_deadline > CURRENT_TIMESTAMP
      ORDER BY o.sla_deadline ASC
    `;

    try {
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      logger.error('[OrderModel] Failed to get SLA risk orders', error);
      throw error;
    }
  }

  /**
   * Get order statistics
   */
  static async getStatistics(startDate, endDate) {
    const query = `
      SELECT
        service_type,
        status,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (delivered_at - created_at))/60) as avg_delivery_time_minutes,
        COUNT(*) FILTER (WHERE sla_breached = false) as on_time_count,
        COUNT(*) FILTER (WHERE sla_breached = true) as late_count
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY service_type, status
    `;

    try {
      const result = await db.query(query, [startDate, endDate]);

      // Transform results into structured statistics
      const stats = {
        byServiceType: {},
        byStatus: {},
        overall: {
          total: 0,
          onTime: 0,
          late: 0,
          avgDeliveryTime: 0,
        },
      };

      result.rows.forEach((row) => {
        // By service type
        if (!stats.byServiceType[row.service_type]) {
          stats.byServiceType[row.service_type] = {
            total: 0,
            onTime: 0,
            late: 0,
            byStatus: {},
          };
        }
        stats.byServiceType[row.service_type].total += parseInt(row.count);
        stats.byServiceType[row.service_type].onTime += parseInt(row.on_time_count || 0);
        stats.byServiceType[row.service_type].late += parseInt(row.late_count || 0);
        stats.byServiceType[row.service_type].byStatus[row.status] = parseInt(row.count);

        // By status
        if (!stats.byStatus[row.status]) {
          stats.byStatus[row.status] = 0;
        }
        stats.byStatus[row.status] += parseInt(row.count);

        // Overall
        stats.overall.total += parseInt(row.count);
        stats.overall.onTime += parseInt(row.on_time_count || 0);
        stats.overall.late += parseInt(row.late_count || 0);
      });

      return stats;
    } catch (error) {
      logger.error('[OrderModel] Failed to get statistics', error);
      throw error;
    }
  }

  /**
   * Update route information
   */
  static async updateRoute(orderId, routeData) {
    const { distance, polyline, estimatedTime } = routeData;

    const query = `
      UPDATE orders
      SET
        estimated_distance = $1,
        route_polyline = $2,
        estimated_delivery_time = CURRENT_TIMESTAMP + INTERVAL '${estimatedTime} minutes'
      WHERE id = $3
      RETURNING *
    `;

    try {
      const result = await db.query(query, [distance, polyline, orderId]);
      logger.info(`[OrderModel] Updated route for order ${orderId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('[OrderModel] Failed to update route', error);
      throw error;
    }
  }

  /**
   * Batch create orders
   */
  static async batchCreate(ordersData) {
    return await db.transaction(async (client) => {
      const orders = [];

      for (const orderData of ordersData) {
        const order = await this.create(orderData);
        orders.push(order);
      }

      logger.info(`[OrderModel] Created ${orders.length} orders in batch`);
      return orders;
    });
  }

  /**
   * Search orders
   */
  static async search(searchParams) {
    let query = `
      SELECT o.*,
        c.name as customer_name, c.phone as customer_phone,
        d.name as driver_name, d.phone as driver_phone
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      WHERE 1=1
    `;

    const values = [];
    let valueIndex = 1;

    // Add search conditions
    if (searchParams.orderNumber) {
      query += ` AND o.order_number ILIKE $${valueIndex}`;
      values.push(`%${searchParams.orderNumber}%`);
      valueIndex++;
    }

    if (searchParams.customerPhone) {
      query += ` AND c.phone = $${valueIndex}`;
      values.push(searchParams.customerPhone);
      valueIndex++;
    }

    if (searchParams.status) {
      query += ` AND o.status = $${valueIndex}`;
      values.push(searchParams.status);
      valueIndex++;
    }

    if (searchParams.serviceType) {
      query += ` AND o.service_type = $${valueIndex}`;
      values.push(searchParams.serviceType);
      valueIndex++;
    }

    if (searchParams.startDate) {
      query += ` AND o.created_at >= $${valueIndex}`;
      values.push(searchParams.startDate);
      valueIndex++;
    }

    if (searchParams.endDate) {
      query += ` AND o.created_at <= $${valueIndex}`;
      values.push(searchParams.endDate);
      valueIndex++;
    }

    query += ` ORDER BY o.created_at DESC LIMIT 100`;

    try {
      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      logger.error('[OrderModel] Failed to search orders', error);
      throw error;
    }
  }
}

module.exports = OrderModel;
