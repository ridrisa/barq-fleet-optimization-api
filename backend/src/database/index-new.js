/**
 * Database Connection Manager
 * Handles PostgreSQL connection pooling and intelligent schema initialization
 */

const { Pool } = require('pg');
const { logger } = require('../utils/logger');
const SchemaManager = require('./schema-manager');

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.schemaManager = null;
    this.config = this.loadConfig();
  }

  /**
   * Load database configuration
   */
  loadConfig() {
    const dbHost = process.env.DB_HOST || 'localhost';
    const isUnixSocket = dbHost.startsWith('/cloudsql/');

    const config = {
      host: dbHost,
      database: process.env.DB_NAME || 'barq_logistics',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: parseInt(process.env.DB_POOL_MAX || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '60000'), // 60 seconds
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'), // 30 seconds
      statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'), // 30 seconds
      query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'), // 30 seconds
    };

    // Only add port for TCP connections, not Unix sockets
    if (!isUnixSocket) {
      config.port = parseInt(process.env.DB_PORT || '5432');
    }

    return config;
  }

  /**
   * Initialize database connection
   */
  async connect() {
    try {
      if (this.isConnected) {
        logger.info('[Database] Already connected');
        return true;
      }

      this.pool = new Pool(this.config);

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      logger.info('[Database] Connected successfully', {
        host: this.config.host,
        database: this.config.database,
      });

      // Setup error handlers
      this.pool.on('error', (err) => {
        logger.error('[Database] Unexpected error on idle client', err);
      });

      // Initialize schema manager
      this.schemaManager = new SchemaManager(this.pool);

      // Initialize schema with intelligent version tracking
      try {
        const result = await this.schemaManager.initialize();
        logger.info('[Database] Schema initialization complete', result);
      } catch (schemaError) {
        logger.warn('[Database] Schema initialization encountered issues', {
          error: schemaError.message,
          stack: schemaError.stack,
        });
        // Continue with just the connection pool - database might already be initialized
      }

      return true;
    } catch (error) {
      logger.error('[Database] Connection failed', {
        error: error.message,
        config: {
          host: this.config.host,
          port: this.config.port,
          database: this.config.database,
        },
      });

      // If database doesn't exist, try to create it
      if (error.code === '3D000') {
        await this.createDatabase();
        return await this.connect();
      }

      throw error;
    }
  }

  /**
   * Create database if it doesn't exist
   */
  async createDatabase() {
    const tempConfig = {
      ...this.config,
      database: 'postgres', // Connect to default database
    };

    const tempPool = new Pool(tempConfig);

    try {
      const client = await tempPool.connect();

      // Check if database exists
      const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
        this.config.database,
      ]);

      if (result.rows.length === 0) {
        // Create database
        await client.query(`CREATE DATABASE ${this.config.database}`);
        logger.info(`[Database] Created database: ${this.config.database}`);
      }

      client.release();
    } catch (error) {
      logger.error('[Database] Failed to create database', error);
      throw error;
    } finally {
      await tempPool.end();
    }
  }

  /**
   * Get schema manager instance
   */
  getSchemaManager() {
    return this.schemaManager;
  }

  /**
   * Get schema information
   */
  async getSchemaInfo() {
    if (!this.schemaManager) {
      return { error: 'Schema manager not initialized' };
    }
    return await this.schemaManager.getDatabaseInfo();
  }

  /**
   * Execute a query
   */
  async query(text, params) {
    if (!this.isConnected) {
      await this.connect();
    }

    const start = Date.now();

    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      logger.debug('[Database] Query executed', {
        query: text.substring(0, 100),
        duration: `${duration}ms`,
        rows: result.rowCount,
      });

      return result;
    } catch (error) {
      logger.error('[Database] Query failed', {
        query: text.substring(0, 100),
        error: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint,
        position: error.position,
      });
      throw error;
    }
  }

  /**
   * Execute a transaction
   */
  async executeTransaction(callback) {
    if (!this.isConnected) {
      await this.connect();
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[Database] Transaction failed', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a client from the pool
   */
  async getClient() {
    if (!this.isConnected) {
      await this.connect();
    }
    return await this.pool.connect();
  }

  /**
   * Close database connection
   */
  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('[Database] Disconnected');
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const result = await this.query('SELECT NOW() as time, current_database() as database');

      // Get schema health if manager is available
      let schemaHealth = null;
      if (this.schemaManager) {
        schemaHealth = await this.schemaManager.healthCheck();
      }

      return {
        healthy: true,
        database: result.rows[0].database,
        serverTime: result.rows[0].time,
        poolStats: {
          totalCount: this.pool.totalCount,
          idleCount: this.pool.idleCount,
          waitingCount: this.pool.waitingCount,
        },
        schema: schemaHealth,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }
}

// Export singleton instance
let instance = null;

module.exports = {
  /**
   * Get database instance
   */
  getInstance: () => {
    if (!instance) {
      instance = new DatabaseManager();
    }
    return instance;
  },

  /**
   * Direct query execution
   */
  query: async (text, params) => {
    const db = module.exports.getInstance();
    return await db.query(text, params);
  },

  /**
   * Transaction execution
   */
  transaction: async (callback) => {
    const db = module.exports.getInstance();
    return await db.executeTransaction(callback);
  },

  /**
   * Connect to database
   */
  connect: async () => {
    const db = module.exports.getInstance();
    return await db.connect();
  },

  /**
   * Disconnect from database
   */
  disconnect: async () => {
    const db = module.exports.getInstance();
    return await db.disconnect();
  },

  /**
   * Health check
   */
  healthCheck: async () => {
    const db = module.exports.getInstance();
    return await db.healthCheck();
  },

  /**
   * Get schema information
   */
  getSchemaInfo: async () => {
    const db = module.exports.getInstance();
    return await db.getSchemaInfo();
  },

  /**
   * Get schema manager
   */
  getSchemaManager: () => {
    const db = module.exports.getInstance();
    return db.getSchemaManager();
  },
};
