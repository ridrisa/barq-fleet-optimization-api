/**
 * Hubs and Shipments Migration Script
 *
 * Migrates hubs and shipments from AWS RDS barqfleet_db to local barq_logistics database
 * This should be run after the main orders migration completes.
 */

const { Pool } = require('pg');

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
const BATCH_SIZE = parseInt(process.env.MIGRATION_BATCH_SIZE) || 1000;

class HubsShipmentsMigration {
  constructor() {
    this.sourcePool = null;
    this.targetPool = null;
    this.stats = {
      hubs: 0,
      shipments: 0,
      orderLinked: 0,
      errors: [],
      startTime: null,
      endTime: null,
    };
    this.hubIdMap = new Map(); // source_hub_id → target_hub_id
    this.shipmentIdMap = new Map(); // source_shipment_id → target_shipment_id
    this.courierIdMap = new Map(); // source_courier_id → target_driver_uuid
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

  async loadCourierIdMap() {
    this.log('Loading courier ID mapping from target database...');

    const query = `
      SELECT id, employee_id
      FROM drivers
      WHERE employee_id IS NOT NULL
    `;

    const result = await this.targetPool.query(query);

    for (const row of result.rows) {
      // Extract numeric ID from employee_id (e.g., "DR-1001" → 1001)
      const match = row.employee_id.match(/DR-(\d+)/);
      if (match) {
        const sourceId = parseInt(match[1]);
        this.courierIdMap.set(sourceId, row.id);
      }
    }

    this.log(`✅ Loaded ${this.courierIdMap.size} courier ID mappings`);
  }

  async migrateHubs() {
    this.log('📦 Starting hubs migration...');

    // Get total count
    const countResult = await this.sourcePool.query('SELECT COUNT(*) FROM hubs');
    const totalHubs = parseInt(countResult.rows[0].count);
    this.log(`Found ${totalHubs} hubs to migrate`);

    let offset = 0;
    let migrated = 0;

    while (offset < totalHubs) {
      const selectQuery = `
        SELECT
          id,
          code,
          manager,
          mobile,
          phone,
          latitude,
          longitude,
          is_active,
          city_id,
          merchant_id,
          store_id,
          neighborhood_id,
          street_name,
          opening_time,
          closing_time,
          cutoff_time,
          start_day,
          end_day,
          timings,
          is_open,
          bundle_limit,
          dispatch_time_gap,
          dispatch_radius,
          last_dispatch_at,
          max_distance,
          max_multiplier_distance,
          promise_time_advantage,
          hub_type,
          flags,
          trusted_address,
          auto_send_to,
          external_reference_id,
          reference_id,
          created_at,
          updated_at
        FROM hubs
        ORDER BY id
        LIMIT $1 OFFSET $2
      `;

      const result = await this.sourcePool.query(selectQuery, [BATCH_SIZE, offset]);

      for (const hub of result.rows) {
        try {
          const insertQuery = `
            INSERT INTO hubs (
              code, manager, mobile, phone, latitude, longitude, is_active,
              city_id, merchant_id, store_id, neighborhood_id, street_name,
              opening_time, closing_time, cutoff_time, start_day, end_day, timings, is_open,
              bundle_limit, dispatch_time_gap, dispatch_radius, last_dispatch_at,
              max_distance, max_multiplier_distance, promise_time_advantage,
              hub_type, flags, trusted_address, auto_send_to,
              external_reference_id, reference_id, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
              $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
              $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34
            ) RETURNING id
          `;

          const insertResult = await this.targetPool.query(insertQuery, [
            hub.code,
            hub.manager,
            hub.mobile,
            hub.phone,
            hub.latitude,
            hub.longitude,
            hub.is_active !== false,
            hub.city_id,
            hub.merchant_id,
            hub.store_id,
            hub.neighborhood_id,
            hub.street_name,
            hub.opening_time,
            hub.closing_time,
            hub.cutoff_time,
            hub.start_day || 0,
            hub.end_day || 5,
            hub.timings || {},
            hub.is_open || false,
            hub.bundle_limit || 4,
            hub.dispatch_time_gap || 0,
            hub.dispatch_radius || 8,
            hub.last_dispatch_at,
            hub.max_distance || 50.0,
            hub.max_multiplier_distance || 0,
            hub.promise_time_advantage,
            hub.hub_type || 0,
            hub.flags || 0,
            hub.trusted_address || 0,
            hub.auto_send_to,
            hub.external_reference_id,
            hub.reference_id,
            hub.created_at,
            hub.updated_at || hub.created_at
          ]);

          // Map source hub ID to target hub ID
          this.hubIdMap.set(hub.id, insertResult.rows[0].id);
          migrated++;

        } catch (error) {
          this.log(`⚠️  Error migrating hub ${hub.code}`, { error: error.message });
          this.stats.errors.push({ type: 'hub', id: hub.id, error: error.message });
        }
      }

      offset += BATCH_SIZE;

      if (migrated % 100 === 0 || migrated === totalHubs) {
        this.log(`Progress: ${migrated}/${totalHubs} hubs migrated`);
      }
    }

    this.stats.hubs = migrated;
    this.log(`✅ Migrated ${migrated} hubs`);
  }

  async updateDriverHubs() {
    this.log('🔗 Updating driver hub assignments...');

    const query = `
      SELECT c.id as courier_id, c.hub_id
      FROM couriers c
      WHERE c.hub_id IS NOT NULL
    `;

    const result = await this.sourcePool.query(query);
    let updated = 0;

    for (const row of result.rows) {
      const targetDriverId = this.courierIdMap.get(row.courier_id);
      const targetHubId = this.hubIdMap.get(row.hub_id);

      if (targetDriverId && targetHubId) {
        try {
          await this.targetPool.query(
            'UPDATE drivers SET hub_id = $1 WHERE id = $2',
            [targetHubId, targetDriverId]
          );
          updated++;
        } catch (error) {
          this.log(`⚠️  Error updating driver hub for courier ${row.courier_id}`, { error: error.message });
        }
      }
    }

    this.log(`✅ Updated ${updated} driver hub assignments`);
  }

  async migrateShipments() {
    this.log('📦 Starting shipments migration...');

    // Get total count - ONLY shipments that have orders
    const countResult = await this.sourcePool.query(`
      SELECT COUNT(DISTINCT s.id)
      FROM shipments s
      INNER JOIN orders o ON o.shipment_id = s.id
    `);
    const totalShipments = parseInt(countResult.rows[0].count);
    this.log(`Found ${totalShipments} shipments with orders to migrate (skipping empty shipments)`);

    let offset = 0;
    let migrated = 0;

    while (offset < totalShipments) {
      const selectQuery = `
        SELECT DISTINCT
          s.id,
          s.courier_id,
          s.tracking_no,
          s.is_assigned,
          s.is_completed,
          s.is_cancelled,
          s.on_hold,
          s.is_force_published,
          s.assign_time,
          s.pickup_time,
          s.complete_time,
          s.delivery_finish,
          s.promise_time,
          s.promise_times,
          s.reward,
          s.low_reward,
          s.delivery_points,
          s.latitude,
          s.longitude,
          s.driving_distance,
          s.driving_duration,
          s.estimated_fuel_consumption,
          s.shipment_status,
          s.status_coordinates,
          s.notified_courier_ids,
          s.partner_id,
          s.order_status_reason_id,
          s.fmd_courier_id,
          s.created_at,
          s.updated_at
        FROM shipments s
        INNER JOIN orders o ON o.shipment_id = s.id
        ORDER BY s.id
        LIMIT $1 OFFSET $2
      `;

      const result = await this.sourcePool.query(selectQuery, [BATCH_SIZE, offset]);

      for (const shipment of result.rows) {
        try {
          // Map courier_id to driver UUID
          const targetDriverId = shipment.courier_id ? this.courierIdMap.get(shipment.courier_id) : null;

          const insertQuery = `
            INSERT INTO shipments (
              courier_id, tracking_no, is_assigned, is_completed, is_cancelled,
              on_hold, is_force_published, assign_time, pickup_time, complete_time,
              delivery_finish, promise_time, promise_times, reward, low_reward,
              delivery_points, latitude, longitude, driving_distance, driving_duration,
              estimated_fuel_consumption, shipment_status, status_coordinates,
              notified_courier_ids, partner_id, order_status_reason_id, fmd_courier_id,
              created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
              $21, $22, $23, $24, $25, $26, $27, $28, $29
            )
            ON CONFLICT (tracking_no) DO NOTHING
            RETURNING id
          `;

          const insertResult = await this.targetPool.query(insertQuery, [
            targetDriverId, // UUID or NULL
            shipment.tracking_no,
            shipment.is_assigned || false,
            shipment.is_completed || false,
            shipment.is_cancelled || false,
            shipment.on_hold || false,
            shipment.is_force_published || false,
            shipment.assign_time,
            shipment.pickup_time,
            shipment.complete_time,
            shipment.delivery_finish,
            shipment.promise_time,
            shipment.promise_times || {},
            shipment.reward,
            shipment.low_reward,
            shipment.delivery_points || 0,
            shipment.latitude,
            shipment.longitude,
            shipment.driving_distance,
            shipment.driving_duration,
            shipment.estimated_fuel_consumption || 0.0,
            shipment.shipment_status || 0,
            shipment.status_coordinates || {},
            shipment.notified_courier_ids || [],
            shipment.partner_id,
            shipment.order_status_reason_id,
            shipment.fmd_courier_id,
            shipment.created_at,
            shipment.updated_at || shipment.created_at
          ]);

          // Map source shipment ID to target shipment ID (only if inserted, not skipped)
          if (insertResult.rows.length > 0) {
            this.shipmentIdMap.set(shipment.id, insertResult.rows[0].id);
            migrated++;
          }

        } catch (error) {
          this.log(`⚠️  Error migrating shipment ${shipment.tracking_no}`, { error: error.message });
          this.stats.errors.push({ type: 'shipment', id: shipment.id, error: error.message });
        }
      }

      offset += BATCH_SIZE;

      if (migrated % 1000 === 0 || migrated === totalShipments) {
        this.log(`Progress: ${migrated}/${totalShipments} shipments migrated (${Math.round((migrated / totalShipments) * 100)}%)`);
      }
    }

    this.stats.shipments = migrated;
    this.log(`✅ Migrated ${migrated} shipments`);
  }

  async linkOrdersToShipmentsAndHubs() {
    this.log('🔗 Linking orders to shipments and hubs...');

    // Get orders from source that have shipment_id or hub_id
    const query = `
      SELECT id, shipment_id, hub_id, tracking_no
      FROM orders
      WHERE shipment_id IS NOT NULL OR hub_id IS NOT NULL
    `;

    const result = await this.sourcePool.query(query);
    this.log(`Found ${result.rows.length} orders to link`);

    let linked = 0;
    let batchUpdates = [];

    for (const order of result.rows) {
      const targetShipmentId = order.shipment_id ? this.shipmentIdMap.get(order.shipment_id) : null;
      const targetHubId = order.hub_id ? this.hubIdMap.get(order.hub_id) : null;

      if (targetShipmentId || targetHubId) {
        batchUpdates.push({
          orderNumber: order.tracking_no,
          shipmentId: targetShipmentId,
          hubId: targetHubId
        });
      }

      // Process in batches of 100
      if (batchUpdates.length >= 100) {
        await this.processBatchUpdates(batchUpdates);
        linked += batchUpdates.length;
        batchUpdates = [];

        if (linked % 1000 === 0) {
          this.log(`Progress: ${linked}/${result.rows.length} orders linked`);
        }
      }
    }

    // Process remaining updates
    if (batchUpdates.length > 0) {
      await this.processBatchUpdates(batchUpdates);
      linked += batchUpdates.length;
    }

    this.stats.orderLinked = linked;
    this.log(`✅ Linked ${linked} orders to shipments/hubs`);
  }

  async processBatchUpdates(updates) {
    for (const update of updates) {
      try {
        const setClauses = [];
        const values = [];
        let paramCount = 1;

        if (update.shipmentId !== null) {
          setClauses.push(`shipment_id = $${paramCount++}`);
          values.push(update.shipmentId);
        }

        if (update.hubId !== null) {
          setClauses.push(`hub_id = $${paramCount++}`);
          values.push(update.hubId);
        }

        if (setClauses.length > 0) {
          values.push(update.orderNumber);
          const updateQuery = `
            UPDATE orders
            SET ${setClauses.join(', ')}
            WHERE order_number = $${paramCount}
          `;
          await this.targetPool.query(updateQuery, values);
        }
      } catch (error) {
        this.log(`⚠️  Error linking order ${update.orderNumber}`, { error: error.message });
      }
    }
  }

  async printSummary() {
    this.log('');
    this.log('═══════════════════════════════════════');
    this.log('     MIGRATION SUMMARY');
    this.log('═══════════════════════════════════════');
    this.log(`Hubs migrated:           ${this.stats.hubs.toLocaleString()}`);
    this.log(`Shipments migrated:      ${this.stats.shipments.toLocaleString()}`);
    this.log(`Orders linked:           ${this.stats.orderLinked.toLocaleString()}`);
    this.log(`Errors encountered:      ${this.stats.errors.length}`);

    const duration = (this.stats.endTime - this.stats.startTime) / 1000;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    this.log(`Total time:              ${minutes}m ${seconds}s`);
    this.log('═══════════════════════════════════════');

    if (this.stats.errors.length > 0) {
      this.log('');
      this.log(`First 10 errors:`);
      this.stats.errors.slice(0, 10).forEach(err => {
        this.log(`  - ${err.type} ${err.id}: ${err.error}`);
      });
    }
  }

  async disconnect() {
    if (this.sourcePool) {
      await this.sourcePool.end();
      this.log('Disconnected from source database');
    }
    if (this.targetPool) {
      await this.targetPool.end();
      this.log('Disconnected from target database');
    }
  }

  async run() {
    this.stats.startTime = Date.now();

    try {
      await this.connect();
      await this.loadCourierIdMap();

      // Step 1: Migrate hubs
      await this.migrateHubs();

      // Step 2: Update driver hub assignments
      await this.updateDriverHubs();

      // Step 3: Migrate shipments
      await this.migrateShipments();

      // Step 4: Link orders to shipments and hubs
      await this.linkOrdersToShipmentsAndHubs();

      this.stats.endTime = Date.now();
      await this.printSummary();

      this.log('');
      this.log('🎉 Migration completed successfully!');
      process.exit(0);

    } catch (error) {
      this.log('❌ Migration failed', { error: error.message });
      console.error(error);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// Run migration
const migration = new HubsShipmentsMigration();
migration.run();
