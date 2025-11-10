/**
 * PostgreSQL Database Service with Read Replica Support
 * Production-ready database layer with read/write splitting, connection pooling, and high availability
 */

const { Pool } = require('pg');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});

class PostgresReplicatedService {
  constructor() {
    this.primaryPool = null;
    this.replicaPools = [];
    this.replicaStatus = []; // Track health status of each replica
    this.currentReplicaIndex = 0; // For round-robin load balancing
    this.isConnected = false;
    this.replicationLagThreshold = parseInt(process.env.REPLICATION_LAG_THRESHOLD || '5'); // seconds
    this.enableReadReplicas = process.env.ENABLE_READ_REPLICAS === 'true';

    // Statistics
    this.stats = {
      primaryQueries: 0,
      replicaQueries: 0,
      failedReplicaQueries: 0,
      fallbackToPrimary: 0,
    };
  }

  /**
   * Initialize PostgreSQL connection pools (primary + replicas)
   */
  async initialize() {
    if (this.primaryPool) {
      logger.warn('PostgreSQL pools already initialized');
      return;
    }

    // Initialize primary connection pool
    await this.initializePrimary();

    // Initialize read replicas if enabled
    if (this.enableReadReplicas) {
      await this.initializeReplicas();

      // Start replication lag monitoring
      this.startReplicationMonitoring();
    } else {
      logger.info('Read replicas disabled - using primary for all queries');
    }

    this.isConnected = true;
  }

  /**
   * Initialize primary database connection pool
   */
  async initializePrimary() {
    const config = {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'barq_logistics',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      max: parseInt(process.env.POSTGRES_POOL_MAX || '20'),
      min: parseInt(process.env.POSTGRES_POOL_MIN || '2'),
      idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '10000'),
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

    this.primaryPool = new Pool(config);

    // Pool error handler
    this.primaryPool.on('error', (err, client) => {
      logger.error('[PRIMARY] Unexpected error on idle client', {
        error: err.message,
        stack: err.stack,
      });
    });

    // Test connection
    try {
      const client = await this.primaryPool.connect();
      await client.query('SELECT NOW()');
      client.release();

      logger.info('[PRIMARY] PostgreSQL connection pool initialized successfully', {
        database: config.database,
        host: config.host,
        port: config.port,
        max_connections: config.max,
      });
    } catch (error) {
      logger.error('[PRIMARY] Failed to initialize PostgreSQL connection pool', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Initialize read replica connection pools
   */
  async initializeReplicas() {
    const replicaHosts = (process.env.POSTGRES_REPLICA_HOSTS || '').split(',').filter((h) => h);
    const replicaPorts = (process.env.POSTGRES_REPLICA_PORTS || '5433,5434').split(',');

    if (replicaHosts.length === 0) {
      logger.warn('No replica hosts configured - using localhost defaults');
      replicaHosts.push('localhost', 'localhost');
    }

    for (let i = 0; i < replicaHosts.length; i++) {
      const replicaConfig = {
        host: replicaHosts[i].trim(),
        port: parseInt(replicaPorts[i] || '5433'),
        database: process.env.POSTGRES_DB || 'barq_logistics',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        max: parseInt(process.env.POSTGRES_REPLICA_POOL_MAX || '10'),
        min: parseInt(process.env.POSTGRES_REPLICA_POOL_MIN || '1'),
        idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000'),
        connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '10000'),
        ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
      };

      const pool = new Pool(replicaConfig);

      // Pool error handler
      pool.on('error', (err, client) => {
        logger.error(`[REPLICA ${i + 1}] Unexpected error on idle client`, {
          error: err.message,
        });
        this.replicaStatus[i] = { healthy: false, lastError: err.message };
      });

      // Test connection
      try {
        const client = await pool.connect();

        // Verify this is a replica (in recovery mode)
        const result = await client.query('SELECT pg_is_in_recovery() as is_replica');
        const isReplica = result.rows[0].is_replica;

        client.release();

        if (!isReplica) {
          logger.warn(`[REPLICA ${i + 1}] Warning: Server is not in recovery mode (not a replica)`);
        }

        this.replicaPools.push(pool);
        this.replicaStatus.push({
          healthy: true,
          lastCheck: Date.now(),
          lagMs: 0,
          isReplica,
        });

        logger.info(`[REPLICA ${i + 1}] Connection pool initialized successfully`, {
          host: replicaConfig.host,
          port: replicaConfig.port,
          is_replica: isReplica,
        });
      } catch (error) {
        logger.error(`[REPLICA ${i + 1}] Failed to initialize connection pool`, {
          host: replicaConfig.host,
          port: replicaConfig.port,
          error: error.message,
        });

        // Add pool anyway but mark as unhealthy
        this.replicaPools.push(pool);
        this.replicaStatus.push({
          healthy: false,
          lastCheck: Date.now(),
          lastError: error.message,
        });
      }
    }

    logger.info(`Initialized ${this.replicaPools.length} read replica(s)`, {
      healthy: this.replicaStatus.filter((s) => s.healthy).length,
    });
  }

  /**
   * Start monitoring replication lag on replicas
   */
  startReplicationMonitoring() {
    const checkInterval = parseInt(process.env.REPLICATION_CHECK_INTERVAL || '30000'); // 30 seconds

    setInterval(async () => {
      for (let i = 0; i < this.replicaPools.length; i++) {
        try {
          const pool = this.replicaPools[i];
          const client = await pool.connect();

          // Check replication lag
          const result = await client.query(`
            SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::int as lag_seconds,
                   pg_is_in_recovery() as is_replica
          `);

          client.release();

          if (result.rows.length > 0) {
            const lagSeconds = result.rows[0].lag_seconds || 0;
            const isReplica = result.rows[0].is_replica;

            this.replicaStatus[i] = {
              healthy: isReplica && lagSeconds <= this.replicationLagThreshold,
              lastCheck: Date.now(),
              lagMs: lagSeconds * 1000,
              isReplica,
            };

            if (lagSeconds > this.replicationLagThreshold) {
              logger.warn(`[REPLICA ${i + 1}] High replication lag detected: ${lagSeconds}s`);
            }
          }
        } catch (error) {
          logger.error(`[REPLICA ${i + 1}] Health check failed:`, error.message);
          this.replicaStatus[i] = {
            healthy: false,
            lastCheck: Date.now(),
            lastError: error.message,
          };
        }
      }
    }, checkInterval);

    logger.info('Replication monitoring started', {
      interval: `${checkInterval / 1000}s`,
      lag_threshold: `${this.replicationLagThreshold}s`,
    });
  }

  /**
   * Get a healthy replica pool using round-robin load balancing
   * @returns {Pool|null} - Healthy replica pool or null
   */
  getHealthyReplica() {
    if (!this.enableReadReplicas || this.replicaPools.length === 0) {
      return null;
    }

    // Find healthy replicas
    const healthyIndices = this.replicaStatus
      .map((status, index) => (status.healthy ? index : -1))
      .filter((index) => index !== -1);

    if (healthyIndices.length === 0) {
      logger.warn('No healthy replicas available - falling back to primary');
      this.stats.fallbackToPrimary++;
      return null;
    }

    // Round-robin selection among healthy replicas
    this.currentReplicaIndex = (this.currentReplicaIndex + 1) % healthyIndices.length;
    const selectedIndex = healthyIndices[this.currentReplicaIndex];

    return this.replicaPools[selectedIndex];
  }

  /**
   * Determine if a query is read-only
   * @param {string} text - SQL query text
   * @returns {boolean} - True if query is read-only
   */
  isReadOnlyQuery(text) {
    const upperText = text.trim().toUpperCase();

    // Read operations
    if (upperText.startsWith('SELECT') || upperText.startsWith('WITH')) {
      // Check for data modification in WITH clauses or subqueries
      if (
        upperText.includes('INSERT') ||
        upperText.includes('UPDATE') ||
        upperText.includes('DELETE')
      ) {
        return false;
      }
      return true;
    }

    // Write operations
    return false;
  }

  /**
   * Execute a query with automatic read/write splitting
   * @param {string} text - SQL query text
   * @param {Array} params - Query parameters
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Query result
   */
  async query(text, params = [], options = {}) {
    const start = Date.now();
    const isReadOnly = this.isReadOnlyQuery(text);
    const forceWritePool = options.forceWrite === true;

    let pool;
    let poolType;

    if (isReadOnly && !forceWritePool) {
      // Try to use replica for read queries
      pool = this.getHealthyReplica();
      if (pool) {
        poolType = 'REPLICA';
        this.stats.replicaQueries++;
      } else {
        // Fallback to primary
        pool = this.primaryPool;
        poolType = 'PRIMARY (fallback)';
        this.stats.primaryQueries++;
      }
    } else {
      // Use primary for write queries
      pool = this.primaryPool;
      poolType = 'PRIMARY';
      this.stats.primaryQueries++;
    }

    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;

      logger.debug(`[${poolType}] Query executed`, {
        query: text.substring(0, 100),
        duration: `${duration}ms`,
        rows: result.rowCount,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      // If replica query failed, retry on primary
      if (poolType === 'REPLICA' && !options.retried) {
        logger.warn(`[REPLICA] Query failed, retrying on primary`, {
          error: error.message,
        });
        this.stats.failedReplicaQueries++;
        return this.query(text, params, { ...options, forceWrite: true, retried: true });
      }

      logger.error(`[${poolType}] Query failed`, {
        query: text.substring(0, 100),
        error: error.message,
        duration: `${duration}ms`,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * Execute multiple queries in a transaction (always on primary)
   * @param {Function} callback - Async function that receives a client
   * @returns {Promise<any>} - Result from callback
   */
  async transaction(callback) {
    const client = await this.primaryPool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      logger.debug('[PRIMARY] Transaction committed successfully');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[PRIMARY] Transaction rolled back', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a client from the pool (for advanced use cases)
   * @param {boolean} forceWrite - Force primary pool
   * @returns {Promise<Client>}
   */
  async getClient(forceWrite = false) {
    if (forceWrite) {
      return await this.primaryPool.connect();
    }

    const replicaPool = this.getHealthyReplica();
    if (replicaPool) {
      return await replicaPool.connect();
    }

    return await this.primaryPool.connect();
  }

  /**
   * Check database health (primary + replicas)
   * @returns {Promise<Object>} - Health status
   */
  async healthCheck() {
    const primaryHealth = await this.checkPoolHealth(this.primaryPool, 'PRIMARY');

    const replicaHealth = await Promise.all(
      this.replicaPools.map((pool, index) => this.checkPoolHealth(pool, `REPLICA ${index + 1}`))
    );

    const healthyReplicas = replicaHealth.filter((h) => h.status === 'healthy').length;

    return {
      status: primaryHealth.status === 'healthy' ? 'healthy' : 'degraded',
      primary: primaryHealth,
      replicas: replicaHealth,
      replicaSummary: {
        total: this.replicaPools.length,
        healthy: healthyReplicas,
        unhealthy: this.replicaPools.length - healthyReplicas,
      },
      stats: this.stats,
    };
  }

  /**
   * Check health of a specific pool
   * @param {Pool} pool - PostgreSQL pool
   * @param {string} name - Pool name for logging
   * @returns {Promise<Object>} - Health status
   */
  async checkPoolHealth(pool, name) {
    try {
      const start = Date.now();
      const result = await pool.query('SELECT NOW(), pg_database_size(current_database()) as size');
      const duration = Date.now() - start;

      return {
        status: 'healthy',
        name,
        connected: true,
        responseTime: duration,
        databaseSize: result.rows[0].size,
        poolSize: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        name,
        connected: false,
        error: error.message,
      };
    }
  }

  /**
   * Get pool statistics
   * @returns {Object} - Pool stats
   */
  getPoolStats() {
    return {
      primary: {
        total: this.primaryPool?.totalCount || 0,
        idle: this.primaryPool?.idleCount || 0,
        waiting: this.primaryPool?.waitingCount || 0,
      },
      replicas: this.replicaPools.map((pool, index) => ({
        id: index + 1,
        healthy: this.replicaStatus[index]?.healthy || false,
        lag: this.replicaStatus[index]?.lagMs || 0,
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      })),
      queryStats: this.stats,
    };
  }

  /**
   * Close all connections in all pools
   */
  async close() {
    const closeTasks = [];

    if (this.primaryPool) {
      closeTasks.push(this.primaryPool.end());
    }

    for (const pool of this.replicaPools) {
      closeTasks.push(pool.end());
    }

    await Promise.all(closeTasks);

    this.isConnected = false;
    logger.info('All PostgreSQL connection pools closed');
  }

  // ===================================
  // DATABASE OPERATIONS
  // (All existing methods from postgres.service.js)
  // ===================================

  async createOptimizationRequest(request) {
    const query = `
      INSERT INTO optimization_requests (
        request_id, status, pickup_points, delivery_points, fleet,
        business_rules, preferences, context, timestamp, created_by, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      request.id || request.request_id,
      request.status || 'pending',
      JSON.stringify(request.pickupPoints || request.pickup_points || []),
      JSON.stringify(request.deliveryPoints || request.delivery_points || []),
      JSON.stringify(request.fleet || []),
      JSON.stringify(request.businessRules || request.business_rules || {}),
      JSON.stringify(request.preferences || {}),
      JSON.stringify(request.context || {}),
      request.timestamp || new Date(),
      request.created_by || null,
      JSON.stringify(request.metadata || {}),
    ];

    const result = await this.query(query, values, { forceWrite: true });
    return result.rows[0];
  }

  async updateOptimizationRequest(requestId, status, resultData = null) {
    const query = `
      UPDATE optimization_requests
      SET status = $2,
          result_data = $3,
          completed_at = CASE WHEN $2 IN ('completed', 'failed') THEN NOW() ELSE completed_at END,
          updated_at = NOW()
      WHERE request_id = $1
      RETURNING *
    `;

    const values = [requestId, status, resultData ? JSON.stringify(resultData) : null];
    const result = await this.query(query, values, { forceWrite: true });
    return result.rows[0];
  }

  async getOptimizationRequest(requestId) {
    const query = 'SELECT * FROM optimization_requests WHERE request_id = $1';
    const result = await this.query(query, [requestId]);
    return result.rows[0] || null;
  }

  async getAllOptimizationRequests(filters = {}) {
    let query = 'SELECT * FROM optimization_requests WHERE 1=1';
    const values = [];
    let paramIndex = 1;

    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      values.push(filters.status);
      paramIndex++;
    }

    query += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramIndex}`;
      values.push(filters.limit);
      paramIndex++;
    }

    if (filters.offset) {
      query += ` OFFSET $${paramIndex}`;
      values.push(filters.offset);
    }

    const result = await this.query(query, values);
    return result.rows;
  }

  async createOptimizationResult(optimization) {
    const query = `
      INSERT INTO optimization_results (
        request_id, optimization_id, success, routes,
        total_distance, total_duration, total_cost,
        fuel_consumption, co2_emissions,
        computation_time, algorithm_used, metadata
      ) VALUES (
        (SELECT id FROM optimization_requests WHERE request_id = $1),
        $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      )
      RETURNING *
    `;

    const values = [
      optimization.requestId || optimization.request_id,
      optimization.optimization_id || optimization.id,
      optimization.success || false,
      JSON.stringify(optimization.routes || []),
      optimization.total_distance,
      optimization.total_duration,
      optimization.total_cost,
      optimization.fuel_consumption,
      optimization.co2_emissions,
      optimization.computation_time || optimization.time_taken,
      optimization.algorithm_used,
      JSON.stringify(optimization.metadata || {}),
    ];

    const result = await this.query(query, values, { forceWrite: true });
    return result.rows[0];
  }

  async getOptimizationResult(requestId) {
    const query = `
      SELECT or.* FROM optimization_results or
      JOIN optimization_requests req ON or.request_id = req.id
      WHERE req.request_id = $1
    `;
    const result = await this.query(query, [requestId]);
    return result.rows[0] || null;
  }

  async getMetrics(date, metricType = 'daily') {
    const query = 'SELECT * FROM system_metrics WHERE date = $1 AND metric_type = $2';
    const result = await this.query(query, [date, metricType]);

    if (result.rows[0]) {
      return result.rows[0];
    }

    const insertQuery = `
      INSERT INTO system_metrics (date, metric_type)
      VALUES ($1, $2)
      RETURNING *
    `;
    const insertResult = await this.query(insertQuery, [date, metricType], { forceWrite: true });
    return insertResult.rows[0];
  }

  async updateMetrics(date, metrics) {
    const fields = [];
    const values = [date, metrics.metric_type || 'daily'];
    let paramIndex = 3;

    const updateFields = [
      'total_requests',
      'successful_requests',
      'failed_requests',
      'avg_response_time',
      'avg_route_distance',
      'avg_route_duration',
      'total_distance_optimized',
      'total_fuel_saved',
      'total_co2_reduced',
      'sla_compliance_rate',
      'customer_satisfaction',
      'total_revenue',
      'total_cost',
      'hourly_breakdown',
      'regional_breakdown',
    ];

    updateFields.forEach((field) => {
      if (metrics[field] !== undefined) {
        fields.push(`${field} = $${paramIndex}`);
        values.push(
          field === 'hourly_breakdown' || field === 'regional_breakdown'
            ? JSON.stringify(metrics[field])
            : metrics[field]
        );
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      return await this.getMetrics(date, metrics.metric_type || 'daily');
    }

    const query = `
      UPDATE system_metrics
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE date = $1 AND metric_type = $2
      RETURNING *
    `;

    const result = await this.query(query, values, { forceWrite: true });
    return result.rows[0];
  }

  async getAllMetrics(filters = {}) {
    let query = 'SELECT * FROM system_metrics WHERE 1=1';
    const values = [];
    let paramIndex = 1;

    if (filters.startDate) {
      query += ` AND date >= $${paramIndex}`;
      values.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      query += ` AND date <= $${paramIndex}`;
      values.push(filters.endDate);
      paramIndex++;
    }

    if (filters.metricType) {
      query += ` AND metric_type = $${paramIndex}`;
      values.push(filters.metricType);
      paramIndex++;
    }

    query += ' ORDER BY date DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramIndex}`;
      values.push(filters.limit);
    }

    const result = await this.query(query, values);
    return result.rows;
  }

  async upsertAgent(agent) {
    const query = `
      INSERT INTO agents (
        agent_name, agent_type, status, config, capabilities,
        is_active, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (agent_name) DO UPDATE SET
        agent_type = EXCLUDED.agent_type,
        status = EXCLUDED.status,
        config = EXCLUDED.config,
        capabilities = EXCLUDED.capabilities,
        is_active = EXCLUDED.is_active,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *
    `;

    const values = [
      agent.agent_name,
      agent.agent_type,
      agent.status || 'idle',
      JSON.stringify(agent.config || {}),
      JSON.stringify(agent.capabilities || []),
      agent.is_active !== undefined ? agent.is_active : true,
      JSON.stringify(agent.metadata || {}),
    ];

    const result = await this.query(query, values, { forceWrite: true });
    return result.rows[0];
  }

  async updateAgentStatus(agentName, status) {
    const query = `
      UPDATE agents
      SET status = $2, updated_at = NOW()
      WHERE agent_name = $1
      RETURNING *
    `;
    const result = await this.query(query, [agentName, status], { forceWrite: true });
    return result.rows[0];
  }

  async getAllAgents(filters = {}) {
    let query = 'SELECT * FROM agents WHERE 1=1';
    const values = [];
    let paramIndex = 1;

    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      values.push(filters.status);
      paramIndex++;
    }

    if (filters.is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      values.push(filters.is_active);
    }

    query += ' ORDER BY agent_name';

    const result = await this.query(query, values);
    return result.rows;
  }

  async logAgentActivity(activity) {
    const query = `
      INSERT INTO agent_activities (
        agent_id, agent_name, activity_type,
        input_data, output_data, success, error_message,
        execution_time_ms, tokens_used,
        order_id, driver_id, request_id,
        started_at, completed_at
      ) VALUES (
        (SELECT id FROM agents WHERE agent_name = $1),
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      )
      RETURNING *
    `;

    const values = [
      activity.agent_name,
      activity.activity_type,
      JSON.stringify(activity.input_data || {}),
      JSON.stringify(activity.output_data || {}),
      activity.success !== undefined ? activity.success : true,
      activity.error_message || null,
      activity.execution_time_ms || null,
      activity.tokens_used || null,
      activity.order_id || null,
      activity.driver_id || null,
      activity.request_id || null,
      activity.started_at || new Date(),
      activity.completed_at || new Date(),
    ];

    const result = await this.query(query, values, { forceWrite: true });
    return result.rows[0];
  }

  async createAutonomousAction(action) {
    const query = `
      INSERT INTO autonomous_actions (
        action_type, action_name, agent_name,
        input_data, status, requires_approval,
        affected_entities, impact_level,
        scheduled_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      action.action_type,
      action.action_name,
      action.agent_name || null,
      JSON.stringify(action.input_data || {}),
      action.status || 'pending',
      action.requires_approval !== undefined ? action.requires_approval : false,
      JSON.stringify(action.affected_entities || []),
      action.impact_level || 'medium',
      action.scheduled_at || new Date(),
      JSON.stringify(action.metadata || {}),
    ];

    const result = await this.query(query, values, { forceWrite: true });
    return result.rows[0];
  }

  async updateAutonomousAction(actionId, updates) {
    const fields = [];
    const values = [actionId];
    let paramIndex = 2;

    const allowedFields = [
      'status',
      'success',
      'error_message',
      'output_data',
      'approved_by',
      'approved_at',
      'approval_notes',
      'executed_at',
    ];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        fields.push(`${field} = $${paramIndex}`);
        values.push(field === 'output_data' ? JSON.stringify(updates[field]) : updates[field]);
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `
      UPDATE autonomous_actions
      SET ${fields.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.query(query, values, { forceWrite: true });
    return result.rows[0];
  }

  async getAutonomousActions(filters = {}) {
    let query = 'SELECT * FROM autonomous_actions WHERE 1=1';
    const values = [];
    let paramIndex = 1;

    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      values.push(filters.status);
      paramIndex++;
    }

    if (filters.requires_approval !== undefined) {
      query += ` AND requires_approval = $${paramIndex}`;
      values.push(filters.requires_approval);
      paramIndex++;
    }

    if (filters.agent_name) {
      query += ` AND agent_name = $${paramIndex}`;
      values.push(filters.agent_name);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramIndex}`;
      values.push(filters.limit);
    }

    const result = await this.query(query, values);
    return result.rows;
  }

  async clearAllData() {
    await this.transaction(async (client) => {
      await client.query('TRUNCATE TABLE optimization_results CASCADE');
      await client.query('TRUNCATE TABLE optimization_requests CASCADE');
      await client.query('TRUNCATE TABLE system_metrics CASCADE');
      await client.query('TRUNCATE TABLE agent_activities CASCADE');
      await client.query('TRUNCATE TABLE autonomous_actions CASCADE');
    });

    logger.warn('All data cleared from database');
    return true;
  }

  async getSystemStats() {
    const query = `
      SELECT
        (SELECT COUNT(*) FROM optimization_requests) as total_requests,
        (SELECT COUNT(*) FROM optimization_requests WHERE status = 'completed') as completed_requests,
        (SELECT COUNT(*) FROM optimization_results WHERE success = true) as successful_optimizations,
        (SELECT AVG(computation_time) FROM optimization_results) as avg_computation_time,
        (SELECT SUM(total_distance) FROM optimization_results) as total_distance_optimized,
        (SELECT COUNT(*) FROM agents WHERE is_active = true) as active_agents,
        (SELECT COUNT(*) FROM autonomous_actions WHERE status = 'pending') as pending_actions
    `;

    const result = await this.query(query);
    return result.rows[0];
  }
}

// Export singleton instance
module.exports = new PostgresReplicatedService();
