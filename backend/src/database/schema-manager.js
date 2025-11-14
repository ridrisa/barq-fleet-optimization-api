/**
 * Schema Version Manager
 * Handles intelligent schema initialization and migration tracking
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { logger } = require('../utils/logger');

class SchemaManager {
  constructor(pool) {
    this.pool = pool;
    this.currentSchemaVersion = 1; // Main schema.sql is version 1
  }

  /**
   * Calculate SHA256 checksum of a file
   */
  async calculateChecksum(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      return null;
    }
  }

  /**
   * Initialize schema versioning system
   * This sets up the infrastructure for tracking schema versions
   */
  async initializeVersioning() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Read and execute schema-version.sql
      const versioningPath = path.join(__dirname, 'schema-version.sql');
      const versioningSQL = await fs.readFile(versioningPath, 'utf8');

      logger.info('[SchemaManager] Installing schema versioning system...');
      await client.query(versioningSQL);

      await client.query('COMMIT');
      logger.info('[SchemaManager] Schema versioning system installed');

      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[SchemaManager] Failed to initialize versioning', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if versioning system is installed
   */
  async isVersioningInstalled() {
    try {
      const result = await this.pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'schema_version'
        ) as exists
      `);
      return result.rows[0].exists;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current schema version from database
   */
  async getSchemaVersion() {
    try {
      const result = await this.pool.query('SELECT get_schema_version() as version');
      return result.rows[0].version;
    } catch (error) {
      logger.warn('[SchemaManager] Could not get schema version', {
        error: error.message,
      });
      return -1; // Version unknown
    }
  }

  /**
   * Check if main schema is installed
   */
  async isSchemaInstalled() {
    try {
      // Check for existence of key tables
      const result = await this.pool.query(`
        SELECT COUNT(*) as table_count
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('drivers', 'customers', 'orders', 'zones')
      `);

      const tableCount = parseInt(result.rows[0].table_count);
      return tableCount >= 4; // All core tables exist
    } catch (error) {
      return false;
    }
  }

  /**
   * Install main database schema
   */
  async installSchema() {
    const client = await this.pool.connect();
    const startTime = Date.now();

    try {
      await client.query('BEGIN');

      // Read main schema file
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schemaSQL = await fs.readFile(schemaPath, 'utf8');
      const checksum = await this.calculateChecksum(schemaPath);

      logger.info('[SchemaManager] Installing main database schema (version 1)...');

      // Execute schema
      await client.query(schemaSQL);

      const executionTime = Date.now() - startTime;

      // Record schema version
      await client.query(
        `SELECT record_schema_version($1, $2, $3, $4, $5)`,
        [
          1, // version
          'base-schema',
          'Initial database schema with core tables, views, and functions',
          executionTime,
          checksum,
        ]
      );

      await client.query('COMMIT');

      logger.info('[SchemaManager] Main schema installed successfully', {
        version: 1,
        executionTime: `${executionTime}ms`,
      });

      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[SchemaManager] Failed to install schema', {
        error: error.message,
        stack: error.stack,
      });

      // Try to record the failure
      try {
        await this.pool.query(
          `INSERT INTO schema_version (version, name, success, error_message)
           VALUES ($1, $2, false, $3)
           ON CONFLICT (version) DO NOTHING`,
          [1, 'base-schema', error.message]
        );
      } catch (recordError) {
        // Ignore if we can't record
      }

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if a migration has been applied
   */
  async isMigrationApplied(migrationName) {
    try {
      const result = await this.pool.query(
        'SELECT is_migration_applied($1) as applied',
        [migrationName]
      );
      return result.rows[0].applied;
    } catch (error) {
      return false;
    }
  }

  /**
   * Apply a single migration file
   */
  async applyMigration(migrationFile, migrationPath) {
    const client = await this.pool.connect();
    const migrationName = path.basename(migrationFile, '.sql');
    const startTime = Date.now();

    try {
      // Check if already applied
      const alreadyApplied = await this.isMigrationApplied(migrationName);
      if (alreadyApplied) {
        logger.debug(`[SchemaManager] Migration already applied: ${migrationName}`);
        return { skipped: true };
      }

      await client.query('BEGIN');

      // Read migration SQL
      const migrationSQL = await fs.readFile(migrationPath, 'utf8');

      logger.info(`[SchemaManager] Applying migration: ${migrationName}...`);

      // Execute migration
      await client.query(migrationSQL);

      const executionTime = Date.now() - startTime;

      // Extract version number from filename (e.g., "001_add_driver_state.sql" -> 1)
      const versionMatch = migrationName.match(/^(\d+)_/);
      const version = versionMatch ? parseInt(versionMatch[1]) : 0;

      // Record migration
      await client.query(
        `SELECT record_migration($1, $2, $3, $4, $5, $6, $7)`,
        [
          migrationName,
          version,
          migrationPath,
          executionTime,
          true, // success
          null, // error_message
          JSON.stringify({ file: migrationFile }),
        ]
      );

      await client.query('COMMIT');

      logger.info(`[SchemaManager] Migration applied successfully: ${migrationName}`, {
        executionTime: `${executionTime}ms`,
      });

      return { success: true, executionTime };
    } catch (error) {
      await client.query('ROLLBACK');

      logger.error(`[SchemaManager] Migration failed: ${migrationName}`, {
        error: error.message,
        stack: error.stack,
      });

      // Record failure
      try {
        const versionMatch = migrationName.match(/^(\d+)_/);
        const version = versionMatch ? parseInt(versionMatch[1]) : 0;

        await this.pool.query(
          `SELECT record_migration($1, $2, $3, $4, $5, $6, $7)`,
          [
            migrationName,
            version,
            migrationPath,
            Date.now() - startTime,
            false, // success
            error.message,
            JSON.stringify({ file: migrationFile }),
          ]
        );
      } catch (recordError) {
        // Ignore if we can't record
      }

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations() {
    try {
      const migrationsDir = path.join(__dirname, 'migrations');

      // Check if migrations directory exists
      try {
        await fs.access(migrationsDir);
      } catch {
        logger.info('[SchemaManager] No migrations directory found');
        return { applied: 0, skipped: 0, failed: 0 };
      }

      // Read all migration files
      const files = await fs.readdir(migrationsDir);
      const migrationFiles = files.filter((f) => f.endsWith('.sql')).sort();

      if (migrationFiles.length === 0) {
        logger.info('[SchemaManager] No migration files found');
        return { applied: 0, skipped: 0, failed: 0 };
      }

      logger.info(`[SchemaManager] Found ${migrationFiles.length} migration file(s)`);

      let applied = 0;
      let skipped = 0;
      let failed = 0;

      // Execute each migration
      for (const file of migrationFiles) {
        try {
          const migrationPath = path.join(migrationsDir, file);
          const result = await this.applyMigration(file, migrationPath);

          if (result.skipped) {
            skipped++;
          } else if (result.success) {
            applied++;
          }
        } catch (error) {
          failed++;
          logger.error(`[SchemaManager] Failed to apply migration: ${file}`, {
            error: error.message,
          });
          // Continue with other migrations
        }
      }

      logger.info('[SchemaManager] Migration summary', {
        total: migrationFiles.length,
        applied,
        skipped,
        failed,
      });

      return { applied, skipped, failed };
    } catch (error) {
      logger.error('[SchemaManager] Failed to run migrations', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get database information
   */
  async getDatabaseInfo() {
    try {
      const result = await this.pool.query('SELECT * FROM database_info');
      return result.rows[0];
    } catch (error) {
      logger.warn('[SchemaManager] Could not get database info', {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Main initialization method
   * This orchestrates the entire schema setup process
   */
  async initialize() {
    try {
      logger.info('[SchemaManager] Starting schema initialization...');

      // Step 1: Check if versioning system is installed
      const versioningInstalled = await this.isVersioningInstalled();

      if (!versioningInstalled) {
        logger.info('[SchemaManager] Versioning system not found, installing...');
        await this.initializeVersioning();
      } else {
        logger.info('[SchemaManager] Versioning system already installed');
      }

      // Step 2: Check current schema version
      const currentVersion = await this.getSchemaVersion();
      logger.info(`[SchemaManager] Current schema version: ${currentVersion}`);

      // Step 3: Install main schema if needed (version 1)
      if (currentVersion < 1) {
        logger.info('[SchemaManager] Main schema not installed, installing...');
        await this.installSchema();
      } else {
        logger.info('[SchemaManager] Main schema already installed (version 1)');
      }

      // Step 4: Run any pending migrations
      logger.info('[SchemaManager] Checking for pending migrations...');
      const migrationResults = await this.runMigrations();

      // Step 5: Get final database info
      const dbInfo = await this.getDatabaseInfo();

      logger.info('[SchemaManager] Schema initialization complete', {
        schemaVersion: dbInfo?.current_version,
        appliedMigrations: dbInfo?.applied_migrations,
        migrationResults,
      });

      return {
        success: true,
        schemaVersion: dbInfo?.current_version,
        migrationResults,
      };
    } catch (error) {
      logger.error('[SchemaManager] Schema initialization failed', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Health check for schema
   */
  async healthCheck() {
    try {
      const dbInfo = await this.getDatabaseInfo();

      return {
        healthy: true,
        schemaVersion: dbInfo?.current_version,
        appliedMigrations: dbInfo?.applied_migrations,
        failedMigrations: dbInfo?.failed_migrations,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }
}

module.exports = SchemaManager;
