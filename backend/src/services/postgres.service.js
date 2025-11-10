/**
 * PostgreSQL Database Service
 * Production-ready database layer with connection pooling, transactions, and error handling
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

class PostgresService {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  /**
   * Initialize PostgreSQL connection pool
   */
  async initialize() {
    if (this.pool) {
      logger.warn('PostgreSQL pool already initialized');
      return;
    }

    const dbHost = process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost';
    const isUnixSocket = dbHost.startsWith('/cloudsql/');

    const config = {
      host: dbHost,
      database: process.env.DB_NAME || process.env.POSTGRES_DB || 'barq_logistics',
      user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
      password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
      max: parseInt(process.env.POSTGRES_POOL_MAX || '20'), // Maximum pool size
      min: parseInt(process.env.POSTGRES_POOL_MIN || '2'), // Minimum pool size
      idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '10000'),
    };

    // Only add port and SSL for TCP connections, not Unix sockets
    if (!isUnixSocket) {
      config.port = parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432');
      config.ssl = process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false;
    }

    this.pool = new Pool(config);

    // Pool error handler
    this.pool.on('error', (err, client) => {
      logger.error('Unexpected error on idle client', { error: err.message, stack: err.stack });
    });

    // Pool connection event
    this.pool.on('connect', (client) => {
      logger.debug('New client connected to PostgreSQL pool');
    });

    // Pool removal event
    this.pool.on('remove', (client) => {
      logger.debug('Client removed from PostgreSQL pool');
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      this.isConnected = true;
      logger.info('PostgreSQL connection pool initialized successfully', {
        database: config.database,
        host: config.host,
        port: config.port,
        max_connections: config.max,
      });
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to initialize PostgreSQL connection pool', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Execute a query with parameters
   * @param {string} text - SQL query text
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} - Query result
   */
  async query(text, params = []) {
    const start = Date.now();

    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      logger.debug('Query executed', {
        query: text.substring(0, 100),
        duration: `${duration}ms`,
        rows: result.rowCount,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      logger.error('Query failed', {
        query: text.substring(0, 100),
        error: error.message,
        duration: `${duration}ms`,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * Execute multiple queries in a transaction
   * @param {Function} callback - Async function that receives a client
   * @returns {Promise<any>} - Result from callback
   */
  async transaction(callback) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      logger.debug('Transaction committed successfully');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a client from the pool (for advanced use cases)
   * Don't forget to release the client!
   * @returns {Promise<Client>}
   */
  async getClient() {
    return await this.pool.connect();
  }

  /**
   * Check database health
   * @returns {Promise<Object>} - Health status
   */
  async healthCheck() {
    try {
      const start = Date.now();
      const result = await this.query('SELECT NOW(), pg_database_size(current_database()) as size');
      const duration = Date.now() - start;

      return {
        status: 'healthy',
        connected: true,
        responseTime: duration,
        databaseSize: result.rows[0].size,
        poolSize: this.pool.totalCount,
        idleConnections: this.pool.idleCount,
        waitingClients: this.pool.waitingCount,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
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
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  /**
   * Close all connections in the pool
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('PostgreSQL connection pool closed');
    }
  }

  // ===================================
  // OPTIMIZATION REQUESTS
  // ===================================

  /**
   * Create a new optimization request
   * @param {Object} request - Request data
   * @returns {Promise<Object>} - Created request
   */
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

    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Update optimization request status
   * @param {string} requestId - Request ID
   * @param {string} status - New status
   * @param {Object} resultData - Optional result data
   * @returns {Promise<Object>} - Updated request
   */
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
    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Get optimization request by ID
   * @param {string} requestId - Request ID
   * @returns {Promise<Object>} - Request data
   */
  async getOptimizationRequest(requestId) {
    const query = 'SELECT * FROM optimization_requests WHERE request_id = $1';
    const result = await this.query(query, [requestId]);
    return result.rows[0] || null;
  }

  /**
   * Get all optimization requests
   * @param {Object} filters - Optional filters (status, limit, offset)
   * @returns {Promise<Array>} - Array of requests
   */
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

  // ===================================
  // OPTIMIZATION RESULTS
  // ===================================

  /**
   * Create optimization result
   * @param {Object} optimization - Optimization result data
   * @returns {Promise<Object>} - Created result
   */
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

    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Get optimization result by request ID
   * @param {string} requestId - Request ID
   * @returns {Promise<Object>} - Optimization result
   */
  async getOptimizationResult(requestId) {
    const query = `
      SELECT or.* FROM optimization_results or
      JOIN optimization_requests req ON or.request_id = req.id
      WHERE req.request_id = $1
    `;
    const result = await this.query(query, [requestId]);
    return result.rows[0] || null;
  }

  // ===================================
  // METRICS
  // ===================================

  /**
   * Get or create metrics for a date
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} metricType - Metric type (daily, hourly, realtime)
   * @returns {Promise<Object>} - Metrics data
   */
  async getMetrics(date, metricType = 'daily') {
    const query = 'SELECT * FROM system_metrics WHERE date = $1 AND metric_type = $2';
    const result = await this.query(query, [date, metricType]);

    if (result.rows[0]) {
      return result.rows[0];
    }

    // Create default metrics if not exists
    const insertQuery = `
      INSERT INTO system_metrics (date, metric_type)
      VALUES ($1, $2)
      RETURNING *
    `;
    const insertResult = await this.query(insertQuery, [date, metricType]);
    return insertResult.rows[0];
  }

  /**
   * Update metrics for a date
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {Object} metrics - Metrics data to update
   * @returns {Promise<Object>} - Updated metrics
   */
  async updateMetrics(date, metrics) {
    const fields = [];
    const values = [date, metrics.metric_type || 'daily'];
    let paramIndex = 3;

    // Build dynamic update query
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
      // No fields to update, just return existing
      return await this.getMetrics(date, metrics.metric_type || 'daily');
    }

    const query = `
      UPDATE system_metrics
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE date = $1 AND metric_type = $2
      RETURNING *
    `;

    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Get all metrics with optional filters
   * @param {Object} filters - Filters (startDate, endDate, metricType)
   * @returns {Promise<Array>} - Array of metrics
   */
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

  // ===================================
  // AGENTS
  // ===================================

  /**
   * Create or update agent
   * @param {Object} agent - Agent data
   * @returns {Promise<Object>} - Agent record
   */
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

    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Update agent status
   * @param {string} agentName - Agent name
   * @param {string} status - New status
   * @returns {Promise<Object>} - Updated agent
   */
  async updateAgentStatus(agentName, status) {
    const query = `
      UPDATE agents
      SET status = $2, updated_at = NOW()
      WHERE agent_name = $1
      RETURNING *
    `;
    const result = await this.query(query, [agentName, status]);
    return result.rows[0];
  }

  /**
   * Get all agents
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} - Array of agents
   */
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

  /**
   * Log agent activity
   * @param {Object} activity - Activity data
   * @returns {Promise<Object>} - Activity record
   */
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

    const result = await this.query(query, values);
    return result.rows[0];
  }

  // ===================================
  // AUTONOMOUS ACTIONS
  // ===================================

  /**
   * Create autonomous action
   * @param {Object} action - Action data
   * @returns {Promise<Object>} - Created action
   */
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

    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Update autonomous action
   * @param {string} actionId - Action ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} - Updated action
   */
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

    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Get autonomous actions with filters
   * @param {Object} filters - Filters
   * @returns {Promise<Array>} - Array of actions
   */
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

  // ===================================
  // UTILITY METHODS
  // ===================================

  /**
   * Clear all data (USE WITH CAUTION!)
   * @returns {Promise<boolean>}
   */
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

  /**
   * Get system statistics
   * @returns {Promise<Object>} - System stats
   */
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
module.exports = new PostgresService();
