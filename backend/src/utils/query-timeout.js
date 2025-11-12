/**
 * Query Timeout Utilities
 * Provides timeout handling for database queries
 */

const { logger } = require('./logger');

/**
 * Default timeout configurations
 */
const TIMEOUT_CONFIG = {
  DEFAULT: 10000, // 10 seconds
  METRICS: 8000, // 8 seconds for metrics queries
  ANALYTICS: 15000, // 15 seconds for analytics
  SIMPLE: 5000, // 5 seconds for simple queries
};

/**
 * Execute a query with timeout
 * @param {Object} pool - Database pool
 * @param {string} query - SQL query string
 * @param {Array} params - Query parameters
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} Query result
 * @throws {Error} If query times out or fails
 */
async function executeWithTimeout(pool, query, params = [], timeout = TIMEOUT_CONFIG.DEFAULT) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Query execution timed out after ${timeout}ms`));
    }, timeout);
  });

  const queryPromise = pool.query(query, params);

  try {
    const result = await Promise.race([queryPromise, timeoutPromise]);
    return result;
  } catch (error) {
    if (error.message.includes('timed out')) {
      logger.warn('Query timeout occurred', {
        timeout,
        query: query.substring(0, 200),
        params: params.slice(0, 5),
      });
    }
    throw error;
  }
}

/**
 * Execute query with PostgreSQL statement timeout
 * @param {Object} pool - Database pool
 * @param {string} query - SQL query string
 * @param {Array} params - Query parameters
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} Query result
 */
async function executeWithStatementTimeout(
  pool,
  query,
  params = [],
  timeout = TIMEOUT_CONFIG.DEFAULT
) {
  const client = await pool.connect();

  try {
    // Set statement timeout for this session
    await client.query(`SET statement_timeout = ${timeout}`);

    // Execute the main query
    const result = await client.query(query, params);

    return result;
  } catch (error) {
    if (error.message.includes('canceling statement due to statement timeout')) {
      logger.warn('PostgreSQL statement timeout occurred', {
        timeout,
        query: query.substring(0, 200),
      });
      throw new Error(`Query execution timed out after ${timeout}ms`);
    }
    throw error;
  } finally {
    // Always release the client back to the pool
    client.release();
  }
}

/**
 * Wrapper for metrics queries with timeout and pagination
 * @param {Object} pool - Database pool
 * @param {string} query - SQL query string
 * @param {Array} params - Query parameters
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Query result
 */
async function executeMetricsQuery(pool, query, params = [], options = {}) {
  const {
    timeout = TIMEOUT_CONFIG.METRICS,
    useStatementTimeout = true,
    logSlow = true,
    slowThreshold = 3000,
  } = options;

  const startTime = Date.now();

  try {
    const result = useStatementTimeout
      ? await executeWithStatementTimeout(pool, query, params, timeout)
      : await executeWithTimeout(pool, query, params, timeout);

    const duration = Date.now() - startTime;

    // Log slow queries
    if (logSlow && duration > slowThreshold) {
      logger.warn('Slow query detected', {
        duration,
        threshold: slowThreshold,
        query: query.substring(0, 200),
      });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Metrics query failed', {
      duration,
      error: error.message,
      query: query.substring(0, 200),
    });
    throw error;
  }
}

module.exports = {
  TIMEOUT_CONFIG,
  executeWithTimeout,
  executeWithStatementTimeout,
  executeMetricsQuery,
};
