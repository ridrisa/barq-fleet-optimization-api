/**
 * Demo Database Service
 * Handles database persistence for demo orders
 */

const db = require('../database');
const { logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class DemoDatabaseService {
  constructor() {
    this.demoCustomers = [];
    this.initialized = false;
  }

  /**
   * Initialize demo customers
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Create or get demo customers
      const demoCustomerNames = [
        { name: 'Ahmed Al-Rashid', phone: '+966501234501' },
        { name: 'Fatima Al-Zahrani', phone: '+966501234502' },
        { name: 'Mohammed Al-Qahtani', phone: '+966501234503' },
        { name: 'Sara Al-Otaibi', phone: '+966501234504' },
        { name: 'Abdullah Al-Harbi', phone: '+966501234505' },
        { name: 'Noura Al-Dosari', phone: '+966501234506' },
        { name: 'Khalid Al-Shehri', phone: '+966501234507' },
        { name: 'Maha Al-Ghamdi', phone: '+966501234508' },
        { name: 'Omar Al-Maliki', phone: '+966501234509' },
        { name: 'Layla Al-Enezi', phone: '+966501234510' },
      ];

      for (const customerData of demoCustomerNames) {
        // Check if customer exists
        const existingQuery = `SELECT id FROM customers WHERE phone = $1`;
        const existingResult = await db.query(existingQuery, [customerData.phone]);

        let customerId;
        if (existingResult.rows.length > 0) {
          customerId = existingResult.rows[0].id;
        } else {
          // Create new customer
          const insertQuery = `
            INSERT INTO customers (name, phone, is_active)
            VALUES ($1, $2, true)
            RETURNING id
          `;
          const insertResult = await db.query(insertQuery, [customerData.name, customerData.phone]);
          customerId = insertResult.rows[0].id;
          logger.info(`[DemoDB] Created demo customer: ${customerData.name}`);
        }

        this.demoCustomers.push({
          id: customerId,
          name: customerData.name,
          phone: customerData.phone,
        });
      }

      this.initialized = true;
      logger.info(`[DemoDB] Initialized ${this.demoCustomers.length} demo customers`);
    } catch (error) {
      logger.error('[DemoDB] Failed to initialize demo customers', error);
      throw error;
    }
  }

  /**
   * Get random demo customer
   */
  getRandomCustomer() {
    if (this.demoCustomers.length === 0) {
      throw new Error('Demo customers not initialized');
    }
    return this.demoCustomers[Math.floor(Math.random() * this.demoCustomers.length)];
  }

  /**
   * Save order to database
   */
  async saveOrder(demoOrder) {
    let query = ''; // Declare outside try block for error logging
    try {
      await this.initialize();

      const customer = this.getRandomCustomer();

      // Calculate delivery fee based on service type and distance
      const baseDeliveryFee = demoOrder.serviceType === 'BARQ' ? 15 : 25;
      const distanceFee = Math.round(demoOrder.distance * 2);
      const delivery_fee = baseDeliveryFee + distanceFee;

      // Map demo order to database schema
      const orderData = {
        customer_id: customer.id,
        service_type: demoOrder.serviceType,
        pickup_location: {
          lat: demoOrder.pickup.location?.lat || demoOrder.pickup.lat,
          lng: demoOrder.pickup.location?.lng || demoOrder.pickup.lng,
        },
        pickup_address: {
          street: demoOrder.pickup.address,
          city: demoOrder.pickup.city || 'Riyadh',
          district: demoOrder.pickup.district || 'Downtown',
        },
        dropoff_location: {
          lat: demoOrder.delivery.location?.lat || demoOrder.delivery.lat,
          lng: demoOrder.delivery.location?.lng || demoOrder.delivery.lng,
        },
        dropoff_address: {
          street: demoOrder.delivery.address,
          city: demoOrder.delivery.city || 'Riyadh',
          district: demoOrder.delivery.district || 'Delivery Area',
        },
        package_details: {
          items: demoOrder.items || [],
          weight: demoOrder.weight || 1,
          description: demoOrder.description || 'Demo order',
          special_instructions: demoOrder.specialInstructions || '',
          source: 'demo', // Tag for identifying demo orders for cleanup
          demo_id: demoOrder.id, // Reference to original demo order ID
        },
        priority: demoOrder.priority || 0,
        cod_amount: demoOrder.codAmount || 0,
        delivery_fee: delivery_fee,
      };

      // Calculate SLA deadline based on service type
      const slaHours = demoOrder.serviceType === 'BARQ' ? 1 : 4;
      const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const totalAmount = delivery_fee + orderData.cod_amount;

      query = `
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
          estimated_distance,
          package_details,
          priority,
          cod_amount,
          delivery_fee,
          sla_deadline,
          total_amount,
          status
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16, $17
        ) RETURNING *
      `;

      const values = [
        orderNumber,
        orderData.customer_id,
        orderData.service_type,
        orderData.pickup_location.lat,
        orderData.pickup_location.lng,
        orderData.pickup_address,
        orderData.dropoff_location.lat,
        orderData.dropoff_location.lng,
        orderData.dropoff_address,
        demoOrder.distance,
        orderData.package_details,
        orderData.priority,
        orderData.cod_amount,
        orderData.delivery_fee,
        slaDeadline.toISOString(),
        totalAmount,
        'PENDING', // Initial status - UPPERCASE for automation engines to pick up
      ];

      const result = await db.query(query, values);
      const savedOrder = result.rows[0];

      logger.info(`[DemoDB] Saved demo order: ${orderNumber} (ID: ${savedOrder.id})`);

      return {
        ...savedOrder,
        demoOrderId: demoOrder.id, // Keep reference to demo order ID
      };
    } catch (error) {
      logger.error('[DemoDB] Failed to save demo order', {
        error: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail,
        demoOrderId: demoOrder.id,
        query: query.substring(0, 200),
      });
      // Don't throw - let demo continue even if DB save fails
      return null;
    }
  }

  /**
   * Get orders with filters
   */
  async getOrders(filters = {}) {
    try {
      const { status, serviceType, limit = 100 } = filters;

      let query = `
        SELECT * FROM orders
        WHERE package_details->>'source' = 'demo'
      `;
      const values = [];
      let valueIndex = 1;

      // Filter by status (case-insensitive)
      if (status) {
        query += ` AND UPPER(status) = UPPER($${valueIndex})`;
        values.push(status);
        valueIndex++;
      }

      // Filter by service type
      if (serviceType) {
        query += ` AND service_type = $${valueIndex}`;
        values.push(serviceType);
        valueIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${valueIndex}`;
      values.push(limit);

      const result = await db.query(query, values);

      logger.info(`[DemoDB] Found ${result.rows.length} orders`, {
        filters: { status, serviceType, limit }
      });

      // Transform to match expected format
      return result.rows.map(order => ({
        id: order.id,
        orderNumber: order.order_number,
        customer: {
          id: order.customer_id,
          name: 'Demo Customer' // We can enhance this later
        },
        delivery: {
          location: {
            lat: order.dropoff_latitude,
            lng: order.dropoff_longitude
          },
          address: typeof order.dropoff_address === 'string'
            ? order.dropoff_address
            : `${order.dropoff_address?.street || ''}, ${order.dropoff_address?.city || 'Riyadh'}`
        },
        pickup: {
          location: {
            lat: order.pickup_latitude,
            lng: order.pickup_longitude
          },
          address: typeof order.pickup_address === 'string'
            ? order.pickup_address
            : `${order.pickup_address?.street || ''}, ${order.pickup_address?.city || 'Riyadh'}`
        },
        serviceType: order.service_type,
        priority: order.priority || 0,
        timeWindow: order.sla_deadline ? {
          latest: order.sla_deadline
        } : null,
        status: order.status,
        createdAt: order.created_at
      }));
    } catch (error) {
      logger.error('[DemoDB] Failed to get orders', error);
      return [];
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId, status, additionalData = {}) {
    try {
      let query = `UPDATE orders SET status = $1`;
      const values = [status];
      let valueIndex = 2;

      // Add timestamps for specific statuses
      const statusTimestamps = {
        assigned: 'assigned_at',
        picked_up: 'picked_up_at',
        delivered: 'delivered_at',
      };

      if (statusTimestamps[status]) {
        query += `, ${statusTimestamps[status]} = CURRENT_TIMESTAMP`;
      }

      // Add driver assignment
      if (status === 'assigned' && additionalData.driver_id) {
        query += `, driver_id = $${valueIndex}`;
        values.push(additionalData.driver_id);
        valueIndex++;
      }

      // Add failure reason
      if (status === 'failed' && additionalData.failure_reason) {
        query += `, failure_reason = $${valueIndex}`;
        values.push(additionalData.failure_reason);
        valueIndex++;
      }

      query += ` WHERE id = $${valueIndex} RETURNING *`;
      values.push(orderId);

      const result = await db.query(query, values);
      logger.info(`[DemoDB] Updated order ${orderId} status to ${status}`);
      return result.rows[0];
    } catch (error) {
      logger.error('[DemoDB] Failed to update order status', error);
      return null;
    }
  }

  /**
   * Clean up demo orders
   * @param {Object} options - Cleanup options
   * @param {boolean} options.all - Delete all demo orders (default: false)
   * @param {number} options.olderThanMinutes - Delete orders older than N minutes (default: keep all if not specified)
   * @param {number} options.keepLast - Keep last N orders (default: 1000)
   */
  async cleanup(options = {}) {
    try {
      const { all = false, olderThanMinutes = null, keepLast = 1000 } = options;

      let query;
      let values = [];

      if (all) {
        // Delete ALL demo orders
        query = `
          DELETE FROM orders
          WHERE package_details->>'source' = 'demo'
        `;
        logger.info('[DemoDB] Deleting ALL demo orders...');
      } else if (olderThanMinutes) {
        // Delete demo orders older than N minutes
        query = `
          DELETE FROM orders
          WHERE package_details->>'source' = 'demo'
            AND created_at < NOW() - INTERVAL '${parseInt(olderThanMinutes)} minutes'
        `;
        logger.info(`[DemoDB] Deleting demo orders older than ${olderThanMinutes} minutes...`);
      } else {
        // Keep last N demo orders, delete the rest
        query = `
          DELETE FROM orders
          WHERE id IN (
            SELECT id FROM orders
            WHERE package_details->>'source' = 'demo'
            ORDER BY created_at DESC
            OFFSET ${parseInt(keepLast)}
          )
        `;
        logger.info(`[DemoDB] Keeping last ${keepLast} demo orders, deleting the rest...`);
      }

      const result = await db.query(query, values);
      logger.info(`[DemoDB] Cleaned up ${result.rowCount} demo orders`);

      return {
        success: true,
        deletedCount: result.rowCount,
        message: `Deleted ${result.rowCount} demo orders`,
      };
    } catch (error) {
      logger.error('[DemoDB] Failed to cleanup demo orders', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Singleton instance
const demoDatabaseService = new DemoDatabaseService();

module.exports = demoDatabaseService;
