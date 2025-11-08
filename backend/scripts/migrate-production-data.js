/**
 * Production Data Migration Script
 *
 * Migrates data from AWS RDS barqfleet_db to local barq_logistics database
 * with proper schema transformation and mapping.
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Source database (AWS RDS)
const SOURCE_CONFIG = {
  host: process.env.AWS_RDS_HOST || 'barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com',
  port: process.env.AWS_RDS_PORT || 5432,
  database: process.env.AWS_RDS_DATABASE || 'barqfleet_db',
  user: process.env.AWS_RDS_USER || 'ventgres',
  password: process.env.AWS_RDS_PASSWORD || '',
  ssl: process.env.AWS_RDS_SSL === 'true' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 30000,
};

// Target database (Local PostgreSQL)
const TARGET_CONFIG = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'barq_logistics',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
};

// Migration configuration
const DAYS_TO_MIGRATE = parseInt(process.env.DAYS_TO_MIGRATE) || 365;
const BATCH_SIZE = parseInt(process.env.MIGRATION_BATCH_SIZE) || 1000;

// Enum mappings
const STATUS_MAPPING = {
  'pending': 'pending',
  'assigned': 'assigned',
  'picked_up': 'picked_up',
  'picked-up': 'picked_up',
  'in_transit': 'in_transit',
  'in-transit': 'in_transit',
  'delivered': 'delivered',
  'failed': 'failed',
  'cancelled': 'cancelled',
  'canceled': 'cancelled',
};

const VEHICLE_TYPE_MAPPING = {
  0: 'MOTORCYCLE',
  1: 'BICYCLE',
  2: 'CAR',
  3: 'VAN',
  4: 'TRUCK',
};

class ProductionDataMigration {
  constructor() {
    this.sourcePool = null;
    this.targetPool = null;
    this.stats = {
      couriers: 0,
      orders: 0,
      customers: 0,
      errors: [],
      startTime: null,
      endTime: null,
    };
    this.courierIdMap = new Map(); // source_id → target_uuid
    this.customerIdMap = new Map(); // phone → target_uuid
  }

  log(message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`, data);
  }

  async connect() {
    this.log('Connecting to source database (AWS RDS)...');
    this.sourcePool = new Pool(SOURCE_CONFIG);

    try {
      await this.sourcePool.query('SELECT 1');
      this.log('✅ Connected to source database');
    } catch (error) {
      this.log('❌ Failed to connect to source database', { error: error.message });
      throw error;
    }

    this.log('Connecting to target database (Local)...');
    this.targetPool = new Pool(TARGET_CONFIG);

    try {
      await this.targetPool.query('SELECT 1');
      this.log('✅ Connected to target database');
    } catch (error) {
      this.log('❌ Failed to connect to target database', { error: error.message });
      throw error;
    }
  }

  async disconnect() {
    if (this.sourcePool) await this.sourcePool.end();
    if (this.targetPool) await this.targetPool.end();
  }

  /**
   * Migrate couriers → drivers
   */
  async migrateCouriers() {
    this.log('📦 Starting couriers → drivers migration...');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_MIGRATE);

    // Get couriers active in last 365 days (simplified query for performance)
    const query = `
      SELECT *
      FROM couriers
      WHERE created_at >= $1
         OR updated_at >= $1
         OR last_seen >= $1
      ORDER BY id
      LIMIT 5000
    `;

    try {
      const result = await this.sourcePool.query(query, [cutoffDate]);
      this.log(`Found ${result.rows.length} couriers to migrate`);

      let processed = 0;
      for (const courier of result.rows) {
        try {
          await this.migrateSingleCourier(courier);
          processed++;

          if (processed % 100 === 0) {
            this.log(`Progress: ${processed}/${result.rows.length} couriers migrated`);
          }
        } catch (error) {
          this.stats.errors.push({
            table: 'couriers',
            id: courier.id,
            error: error.message,
          });
          this.log(`⚠️  Error migrating courier ${courier.id}: ${error.message}`);
        }
      }

      this.stats.couriers = processed;
      this.log(`✅ Migrated ${processed} couriers`);

    } catch (error) {
      this.log('❌ Error in courier migration', { error: error.message });
      throw error;
    }
  }

  async migrateSingleCourier(courier) {
    const driverUuid = uuidv4();
    this.courierIdMap.set(courier.id, driverUuid);

    // Determine driver status
    let status = 'offline';
    if (courier.is_banned) status = 'offline';
    else if (courier.is_busy) status = 'busy';
    else if (courier.is_online) status = 'available';

    // Map vehicle type
    const vehicleType = VEHICLE_TYPE_MAPPING[courier.vehicle_type] || 'MOTORCYCLE';

    const insertQuery = `
      INSERT INTO drivers (
        id, employee_id, name, phone, email, vehicle_type,
        status, current_latitude, current_longitude, last_location_update,
        rating, total_deliveries, successful_deliveries,
        service_types, max_concurrent_orders,
        created_at, updated_at, is_active, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6::vehicle_type,
        $7::driver_status, $8, $9, $10,
        5.00, 0, 0,
        ARRAY['BARQ', 'BULLET']::service_type[], 1,
        $11, $12, $13, $14
      )
      ON CONFLICT (employee_id) DO NOTHING
    `;

    const name = `${courier.first_name || ''} ${courier.last_name || ''}`.trim() || `Courier ${courier.id}`;

    await this.targetPool.query(insertQuery, [
      driverUuid,
      courier.id.toString(), // employee_id as string
      name,
      courier.mobile_number || '',
      courier.email || '',
      vehicleType,
      status,
      courier.latitude,
      courier.longitude,
      courier.last_seen || courier.updated_at,
      courier.created_at,
      courier.updated_at,
      !courier.is_banned,
      JSON.stringify({
        source_id: courier.id,
        citc_info: courier.citc_info,
        official_info: courier.official_info,
        hub_id: courier.hub_id,
        courier_type: courier.courier_type,
      }),
    ]);
  }

  /**
   * Migrate orders → orders + customers
   */
  async migrateOrders() {
    this.log('📦 Starting orders migration...');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_MIGRATE);

    // Get orders from last 365 days
    const countQuery = `
      SELECT COUNT(*) as total
      FROM orders
      WHERE created_at >= $1
    `;

    const countResult = await this.sourcePool.query(countQuery, [cutoffDate]);
    const totalOrders = parseInt(countResult.rows[0].total);

    this.log(`Found ${totalOrders} orders to migrate`);

    let offset = 0;
    let processed = 0;

    while (offset < totalOrders) {
      const query = `
        SELECT *
        FROM orders
        WHERE created_at >= $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.sourcePool.query(query, [cutoffDate, BATCH_SIZE, offset]);

      for (const order of result.rows) {
        try {
          await this.migrateSingleOrder(order);
          processed++;

          if (processed % 1000 === 0) {
            this.log(`Progress: ${processed}/${totalOrders} orders migrated (${Math.round(processed/totalOrders*100)}%)`);
          }
        } catch (error) {
          this.stats.errors.push({
            table: 'orders',
            id: order.id,
            error: error.message,
          });
          this.log(`⚠️  Error migrating order ${order.tracking_no}: ${error.message}`);
        }
      }

      offset += BATCH_SIZE;
    }

    this.stats.orders = processed;
    this.log(`✅ Migrated ${processed} orders`);
  }

  async migrateSingleOrder(order) {
    // Extract customer info
    const customerId = await this.createOrGetCustomer(order);

    // Get driver UUID if assigned
    let driverUuid = null;
    if (order.courier_id) {
      driverUuid = this.courierIdMap.get(order.courier_id);
    }

    // Extract location data from JSONB
    const origin = order.origin || {};
    const destination = order.destination || {};
    const customerDetails = order.customer_details || {};

    const pickupLat = origin.lat || origin.latitude;
    const pickupLng = origin.lng || origin.longitude || origin.long;
    const dropoffLat = destination.lat || destination.latitude;
    const dropoffLng = destination.lng || destination.longitude || destination.long;

    // Map order status
    const status = STATUS_MAPPING[order.order_status] || 'pending';

    // Determine service type from shipment_type
    let serviceType = 'BARQ';
    if (order.shipment_type && order.shipment_type.toLowerCase().includes('bullet')) {
      serviceType = 'BULLET';
    }

    // Calculate SLA deadline (1 hour for BARQ, 3 hours for BULLET)
    const slaHours = serviceType === 'BARQ' ? 1 : 3;
    const slaDeadline = new Date(order.created_at);
    slaDeadline.setHours(slaDeadline.getHours() + slaHours);

    const orderUuid = uuidv4();

    const insertQuery = `
      INSERT INTO orders (
        id, order_number, customer_id, driver_id,
        service_type, status, priority,
        pickup_latitude, pickup_longitude, pickup_address,
        dropoff_latitude, dropoff_longitude, dropoff_address,
        estimated_distance, actual_distance,
        created_at, assigned_at, picked_up_at, delivered_at,
        sla_deadline, sla_breached,
        package_details, cod_amount, delivery_fee, total_amount,
        notes, cancellation_reason, failure_reason,
        metadata
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, 0,
        $7, $8, $9,
        $10, $11, $12,
        $13, $14,
        $15, $16, $17, $18,
        $19, $20,
        $21, $22, $23, $24,
        $25, $26, $27,
        $28
      )
    `;

    const slaBreached = order.delivery_finish && new Date(order.delivery_finish) > slaDeadline;

    await this.targetPool.query(insertQuery, [
      orderUuid,
      order.tracking_no,
      customerId,
      driverUuid,
      serviceType,
      status,
      pickupLat,
      pickupLng,
      JSON.stringify({
        address: origin.address || origin.name || '',
        city: origin.city || '',
        details: origin,
      }),
      dropoffLat,
      dropoffLng,
      JSON.stringify({
        address: destination.address || destination.name || '',
        city: destination.city || '',
        details: destination,
      }),
      order.total_distance ? order.total_distance / 1000 : null, // meters to km
      order.total_distance ? order.total_distance / 1000 : null,
      order.created_at,
      order.is_assigned ? order.updated_at : null,
      order.delivery_start,
      order.delivery_finish,
      slaDeadline,
      slaBreached,
      JSON.stringify(order.products || {}),
      order.grand_total || 0,
      order.delivery_fee || 0,
      order.grand_total || 0,
      order.notes || order.additional_notes,
      null, // cancellation_reason
      order.return_reason,
      JSON.stringify({
        source_id: order.id,
        merchant_id: order.merchant_id,
        shipment_id: order.shipment_id,
        payment_type: order.payment_type,
        hub_id: order.hub_id,
      }),
    ]);
  }

  async createOrGetCustomer(order) {
    const customerDetails = order.customer_details || {};
    const phone = customerDetails.phone || customerDetails.mobile || '';

    if (!phone) {
      // Create anonymous customer
      return await this.createAnonymousCustomer(order);
    }

    // Check if customer already exists
    if (this.customerIdMap.has(phone)) {
      return this.customerIdMap.get(phone);
    }

    // Create new customer
    // Check if customer exists first
    const checkQuery = `SELECT id FROM customers WHERE phone = $1 LIMIT 1`;
    const existingCustomer = await this.targetPool.query(checkQuery, [phone]);

    if (existingCustomer.rows.length > 0) {
      return existingCustomer.rows[0].id;
    }

    const customerId = uuidv4();
    const destination = order.destination || {};
    const name = customerDetails.name || customerDetails.full_name || 'Customer';

    const insertQuery = `
      INSERT INTO customers (
        id, name, phone, email,
        addresses, default_address,
        preferred_service_type, language,
        created_at, updated_at, is_active, metadata
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6,
        $7, $8,
        $9, $10, true, $11
      )
      RETURNING id
    `;

    try {
      const result = await this.targetPool.query(insertQuery, [
        customerId,
        name,
        phone,
        customerDetails.email || '',
        JSON.stringify([{
          address: destination.address || destination.name || '',
          city: destination.city || '',
          latitude: destination.lat || destination.latitude,
          longitude: destination.lng || destination.longitude,
        }]),
        JSON.stringify({
          address: destination.address || destination.name || '',
          city: destination.city || '',
          latitude: destination.lat || destination.latitude,
          longitude: destination.lng || destination.longitude,
        }),
        'BARQ',
        'ar',
        order.created_at,
        order.updated_at,
        JSON.stringify({
          source_order_id: order.id,
        }),
      ]);

      this.customerIdMap.set(phone, customerId);
      this.stats.customers++;

      return customerId;
    } catch (error) {
      // If conflict, fetch existing customer ID
      const selectQuery = 'SELECT id FROM customers WHERE phone = $1';
      const result = await this.targetPool.query(selectQuery, [phone]);
      if (result.rows.length > 0) {
        const existingId = result.rows[0].id;
        this.customerIdMap.set(phone, existingId);
        return existingId;
      }
      throw error;
    }
  }

  async createAnonymousCustomer(order) {
    const customerId = uuidv4();
    const customerDetails = order.customer_details || {};

    const insertQuery = `
      INSERT INTO customers (
        id, name, phone, email,
        created_at, updated_at, is_active, metadata
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, true, $7
      )
      RETURNING id
    `;

    await this.targetPool.query(insertQuery, [
      customerId,
      customerDetails.name || 'Anonymous Customer',
      `anonymous-${order.id}`,
      '',
      order.created_at,
      order.updated_at,
      JSON.stringify({ anonymous: true, source_order_id: order.id }),
    ]);

    return customerId;
  }

  async printSummary() {
    this.log('');
    this.log('═══════════════════════════════════════════');
    this.log('       MIGRATION SUMMARY');
    this.log('═══════════════════════════════════════════');
    this.log(`✅ Couriers migrated: ${this.stats.couriers}`);
    this.log(`✅ Orders migrated: ${this.stats.orders}`);
    this.log(`✅ Customers created: ${this.stats.customers}`);
    this.log(`⚠️  Errors: ${this.stats.errors.length}`);

    if (this.stats.errors.length > 0) {
      this.log('');
      this.log('Errors encountered:');
      this.stats.errors.slice(0, 10).forEach(err => {
        this.log(`  - ${err.table} ID ${err.id}: ${err.error}`);
      });
      if (this.stats.errors.length > 10) {
        this.log(`  ... and ${this.stats.errors.length - 10} more errors`);
      }
    }

    const duration = (this.stats.endTime - this.stats.startTime) / 1000;
    this.log(`\n⏱️  Total time: ${Math.round(duration)}s`);
    this.log('═══════════════════════════════════════════');
  }

  async run() {
    this.stats.startTime = Date.now();

    try {
      await this.connect();

      // Migrate in order: couriers first (drivers), then orders
      await this.migrateCouriers();
      await this.migrateOrders();

      this.stats.endTime = Date.now();
      await this.printSummary();

    } catch (error) {
      this.log('❌ Migration failed', { error: error.message, stack: error.stack });
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Run migration
if (require.main === module) {
  const migration = new ProductionDataMigration();
  migration.run()
    .then(() => {
      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = ProductionDataMigration;
