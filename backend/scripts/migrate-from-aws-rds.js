/**
 * Data Migration Script: AWS RDS barqfleet_db → Local barq_logistics
 *
 * Migrates the last 365 days of data from production AWS RDS database
 * to local PostgreSQL database for development/testing.
 *
 * Usage:
 *   node scripts/migrate-from-aws-rds.js
 */

const { Pool } = require('pg');
const { logger } = require('../src/utils/logger');

// Source database (AWS RDS)
const SOURCE_CONFIG = {
  host: process.env.AWS_RDS_HOST || 'your-rds-endpoint.amazonaws.com',
  port: process.env.AWS_RDS_PORT || 5432,
  database: process.env.AWS_RDS_DATABASE || 'barqfleet_db',
  user: process.env.AWS_RDS_USER || 'postgres',
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
const MIGRATION_CONFIG = {
  daysToMigrate: 365,
  batchSize: 1000, // Process records in batches
  tables: [
    'driver_orders',
    'driver_locations',
    'order_issues',
    'courier',
    'vehicles',
    'couriers',
    'workflow_instances',
    'leave_requests',
    'leave_approvals',
    'vehicle_assignments',
    'audit_logs',
  ],
};

class DataMigration {
  constructor() {
    this.sourcePool = null;
    this.targetPool = null;
    this.stats = {
      tablesProcessed: 0,
      totalRowsMigrated: 0,
      errors: [],
      startTime: null,
      endTime: null,
    };
  }

  async connect() {
    logger.info('[Migration] Connecting to source database (AWS RDS)...');
    this.sourcePool = new Pool(SOURCE_CONFIG);

    // Test source connection
    try {
      const result = await this.sourcePool.query('SELECT NOW()');
      logger.info('[Migration] Connected to source database', {
        timestamp: result.rows[0].now,
      });
    } catch (error) {
      logger.error('[Migration] Failed to connect to source database', {
        error: error.message,
        config: {
          host: SOURCE_CONFIG.host,
          database: SOURCE_CONFIG.database,
          user: SOURCE_CONFIG.user,
        },
      });
      throw error;
    }

    logger.info('[Migration] Connecting to target database (Local)...');
    this.targetPool = new Pool(TARGET_CONFIG);

    // Test target connection
    try {
      const result = await this.targetPool.query('SELECT NOW()');
      logger.info('[Migration] Connected to target database', {
        timestamp: result.rows[0].now,
      });
    } catch (error) {
      logger.error('[Migration] Failed to connect to target database', {
        error: error.message,
      });
      throw error;
    }
  }

  async disconnect() {
    logger.info('[Migration] Closing database connections...');
    if (this.sourcePool) await this.sourcePool.end();
    if (this.targetPool) await this.targetPool.end();
  }

  async checkTableExists(pool, tableName, schema = 'public') {
    const query = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = $1
        AND table_name = $2
      );
    `;
    const result = await pool.query(query, [schema, tableName]);
    return result.rows[0].exists;
  }

  async getTableColumns(pool, tableName, schema = 'public') {
    const query = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position;
    `;
    const result = await pool.query(query, [schema, tableName]);
    return result.rows;
  }

  async findDateColumn(columns) {
    // Look for common timestamp columns
    const dateColumns = ['created_at', 'updated_at', 'timestamp', 'date', 'order_date'];

    for (const col of columns) {
      if (
        dateColumns.includes(col.column_name.toLowerCase()) &&
        (col.data_type.includes('timestamp') || col.data_type.includes('date'))
      ) {
        return col.column_name;
      }
    }
    return null;
  }

  async migrateTable(tableName, schema = 'public') {
    logger.info(`[Migration] Starting migration for table: ${schema}.${tableName}`);

    try {
      // Check if table exists in source
      const sourceExists = await this.checkTableExists(
        this.sourcePool,
        tableName,
        schema
      );

      if (!sourceExists) {
        logger.warn(`[Migration] Table ${schema}.${tableName} not found in source - skipping`);
        return 0;
      }

      // Check if table exists in target
      const targetExists = await this.checkTableExists(
        this.targetPool,
        tableName,
        schema
      );

      if (!targetExists) {
        logger.warn(
          `[Migration] Table ${schema}.${tableName} not found in target - needs schema setup`
        );
        return 0;
      }

      // Get table columns
      const columns = await this.getTableColumns(this.sourcePool, tableName, schema);
      const columnNames = columns.map((c) => c.column_name);

      // Find date column for filtering
      const dateColumn = await this.findDateColumn(columns);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - MIGRATION_CONFIG.daysToMigrate);

      // Build SELECT query
      let selectQuery = `SELECT ${columnNames.join(', ')} FROM ${schema}.${tableName}`;

      if (dateColumn) {
        selectQuery += ` WHERE ${dateColumn} >= $1`;
        logger.info(`[Migration] Filtering ${tableName} by ${dateColumn} >= ${cutoffDate.toISOString()}`);
      } else {
        logger.warn(`[Migration] No date column found for ${tableName} - migrating all data`);
      }

      // Count total rows
      let countQuery = `SELECT COUNT(*) FROM ${schema}.${tableName}`;
      if (dateColumn) {
        countQuery += ` WHERE ${dateColumn} >= $1`;
      }

      const countResult = dateColumn
        ? await this.sourcePool.query(countQuery, [cutoffDate])
        : await this.sourcePool.query(countQuery);

      const totalRows = parseInt(countResult.rows[0].count);
      logger.info(`[Migration] Found ${totalRows} rows to migrate in ${tableName}`);

      if (totalRows === 0) {
        return 0;
      }

      // Fetch data in batches
      let offset = 0;
      let migratedCount = 0;

      while (offset < totalRows) {
        const batchQuery = `${selectQuery} LIMIT ${MIGRATION_CONFIG.batchSize} OFFSET ${offset}`;
        const batchParams = dateColumn ? [cutoffDate] : [];

        const batchResult = await this.sourcePool.query(batchQuery, batchParams);
        const rows = batchResult.rows;

        if (rows.length === 0) break;

        // Insert into target database
        for (const row of rows) {
          const insertColumns = Object.keys(row);
          const insertValues = insertColumns.map((_, i) => `$${i + 1}`);

          const insertQuery = `
            INSERT INTO ${schema}.${tableName} (${insertColumns.join(', ')})
            VALUES (${insertValues.join(', ')})
            ON CONFLICT DO NOTHING
          `;

          try {
            await this.targetPool.query(insertQuery, Object.values(row));
            migratedCount++;
          } catch (error) {
            logger.error(`[Migration] Failed to insert row into ${tableName}`, {
              error: error.message,
              row: row,
            });
            this.stats.errors.push({
              table: tableName,
              error: error.message,
              row: row,
            });
          }
        }

        offset += MIGRATION_CONFIG.batchSize;
        logger.info(
          `[Migration] Progress: ${Math.min(offset, totalRows)}/${totalRows} rows (${Math.round((offset / totalRows) * 100)}%)`
        );
      }

      logger.info(`[Migration] Completed ${tableName}: ${migratedCount} rows migrated`);
      this.stats.tablesProcessed++;
      this.stats.totalRowsMigrated += migratedCount;

      return migratedCount;
    } catch (error) {
      logger.error(`[Migration] Failed to migrate table ${tableName}`, {
        error: error.message,
        stack: error.stack,
      });
      this.stats.errors.push({
        table: tableName,
        error: error.message,
      });
      return 0;
    }
  }

  async run() {
    this.stats.startTime = new Date();

    try {
      logger.info('[Migration] ===== Starting Data Migration =====');
      logger.info('[Migration] Configuration:', {
        source: `${SOURCE_CONFIG.host}/${SOURCE_CONFIG.database}`,
        target: `${TARGET_CONFIG.host}/${TARGET_CONFIG.database}`,
        daysToMigrate: MIGRATION_CONFIG.daysToMigrate,
        batchSize: MIGRATION_CONFIG.batchSize,
        tables: MIGRATION_CONFIG.tables.length,
      });

      // Connect to both databases
      await this.connect();

      // Migrate each table
      for (const table of MIGRATION_CONFIG.tables) {
        // Check if table uses schema prefix (e.g., 'barq.couriers')
        let schema = 'public';
        let tableName = table;

        if (table.includes('.')) {
          [schema, tableName] = table.split('.');
        }

        await this.migrateTable(tableName, schema);
      }

      this.stats.endTime = new Date();
      const durationMs = this.stats.endTime - this.stats.startTime;
      const durationSec = Math.round(durationMs / 1000);

      logger.info('[Migration] ===== Migration Complete =====');
      logger.info('[Migration] Summary:', {
        tablesProcessed: this.stats.tablesProcessed,
        totalRowsMigrated: this.stats.totalRowsMigrated,
        errors: this.stats.errors.length,
        duration: `${durationSec}s`,
      });

      if (this.stats.errors.length > 0) {
        logger.warn('[Migration] Errors encountered:', {
          count: this.stats.errors.length,
          errors: this.stats.errors.slice(0, 10), // Show first 10 errors
        });
      }

      console.log('\n📊 Migration Statistics:');
      console.log(`   Tables Processed: ${this.stats.tablesProcessed}`);
      console.log(`   Total Rows Migrated: ${this.stats.totalRowsMigrated}`);
      console.log(`   Errors: ${this.stats.errors.length}`);
      console.log(`   Duration: ${durationSec}s`);
      console.log(`   Avg Speed: ${Math.round(this.stats.totalRowsMigrated / durationSec)} rows/sec`);

      return {
        success: this.stats.errors.length === 0,
        stats: this.stats,
      };
    } catch (error) {
      logger.error('[Migration] Migration failed', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new DataMigration();

  migration
    .run()
    .then((result) => {
      if (result.success) {
        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
      } else {
        console.log('\n⚠️  Migration completed with errors');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error.message);
      process.exit(1);
    });
}

module.exports = DataMigration;
