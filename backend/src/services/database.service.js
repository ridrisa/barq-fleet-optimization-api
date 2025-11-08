/**
 * Database Service (Dual Mode)
 * Supports both LowDB (legacy) and PostgreSQL (production)
 * Automatically switches based on DATABASE_MODE environment variable
 */

const postgresService = require('./postgres.service');
const lowdb = require('../config/db.config');

class DatabaseService {
  constructor() {
    // Determine database mode from environment
    this.mode = process.env.DATABASE_MODE || 'lowdb';
    this.initialized = false;
  }

  /**
   * Initialize database connection (only for PostgreSQL)
   */
  async initialize() {
    if (this.mode === 'postgres' && !this.initialized) {
      await postgresService.initialize();
      this.initialized = true;
    }
  }

  /**
   * Get all requests from the database
   * @returns {Promise<Array>} - Array of requests
   */
  async getAllRequests() {
    if (this.mode === 'postgres') {
      const requests = await postgresService.getAllOptimizationRequests();
      return requests.map(this._transformPostgresRequest);
    }
    return lowdb.get('requests').value();
  }

  /**
   * Get a request by ID
   * @param {string} id - Request ID
   * @returns {Promise<Object>} - Request object
   */
  async getRequestById(id) {
    if (this.mode === 'postgres') {
      const request = await postgresService.getOptimizationRequest(id);
      return request ? this._transformPostgresRequest(request) : null;
    }
    return lowdb.get('requests').find({ id }).value();
  }

  /**
   * Add a new request to the database
   * @param {Object} request - Request object
   * @returns {Promise<Object>} - Added request
   */
  async addRequest(request) {
    if (this.mode === 'postgres') {
      const created = await postgresService.createOptimizationRequest(request);
      return this._transformPostgresRequest(created);
    }
    lowdb.get('requests').push(request).write();
    return request;
  }

  /**
   * Update request status
   * @param {string} id - Request ID
   * @param {string} status - New status
   * @param {Object} resultData - Optional result data
   * @returns {Promise<Object>} - Updated request
   */
  async updateRequest(id, status, resultData = null) {
    if (this.mode === 'postgres') {
      const updated = await postgresService.updateOptimizationRequest(id, status, resultData);
      return updated ? this._transformPostgresRequest(updated) : null;
    }

    const request = lowdb.get('requests').find({ id });
    if (request.value()) {
      request.assign({ status, updatedAt: new Date().toISOString() }).write();
      return request.value();
    }
    return null;
  }

  /**
   * Get all optimization results from the database
   * @returns {Promise<Array>} - Array of optimization results
   */
  async getAllOptimizations() {
    if (this.mode === 'postgres') {
      const results = await postgresService.query(
        'SELECT * FROM optimization_results ORDER BY timestamp DESC'
      );
      return results.rows.map(this._transformPostgresOptimization);
    }
    return lowdb.get('optimizations').value();
  }

  /**
   * Get an optimization result by request ID
   * @param {string} requestId - Request ID
   * @returns {Promise<Object>} - Optimization result
   */
  async getOptimizationByRequestId(requestId) {
    if (this.mode === 'postgres') {
      const result = await postgresService.getOptimizationResult(requestId);
      return result ? this._transformPostgresOptimization(result) : null;
    }
    return lowdb.get('optimizations').find({ requestId }).value();
  }

  /**
   * Add a new optimization result to the database
   * @param {Object} optimization - Optimization result
   * @returns {Promise<Object>} - Added optimization result
   */
  async addOptimization(optimization) {
    if (this.mode === 'postgres') {
      const created = await postgresService.createOptimizationResult(optimization);
      return this._transformPostgresOptimization(created);
    }
    lowdb.get('optimizations').push(optimization).write();
    return optimization;
  }

  /**
   * Get all metrics from the database
   * @returns {Promise<Array>} - Array of metrics
   */
  async getAllMetrics() {
    if (this.mode === 'postgres') {
      const metrics = await postgresService.getAllMetrics();
      return metrics.map(this._transformPostgresMetric);
    }
    return lowdb.get('metrics').value();
  }

  /**
   * Get metrics for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Object>} - Metrics for the date
   */
  async getMetricsByDate(date) {
    if (this.mode === 'postgres') {
      const metric = await postgresService.getMetrics(date, 'daily');
      return metric ? this._transformPostgresMetric(metric) : null;
    }
    return lowdb.get('metrics').find({ date }).value();
  }

  /**
   * Add or update metrics for a date
   * @param {Object} metrics - Metrics object
   * @returns {Promise<Object>} - Added/updated metrics
   */
  async updateMetrics(metrics) {
    const { date } = metrics;

    if (this.mode === 'postgres') {
      const updated = await postgresService.updateMetrics(date, metrics);
      return this._transformPostgresMetric(updated);
    }

    const existing = this.getMetricsByDate(date);

    if (existing) {
      lowdb.get('metrics').find({ date }).assign(metrics).write();
    } else {
      lowdb.get('metrics').push(metrics).write();
    }

    return metrics;
  }

  /**
   * Get system statistics
   * @returns {Promise<Object>} - System statistics
   */
  async getSystemStats() {
    if (this.mode === 'postgres') {
      return await postgresService.getSystemStats();
    }

    const requests = this.getAllRequests();
    const optimizations = this.getAllOptimizations();
    const metrics = this.getAllMetrics();

    return {
      totalRequests: requests.length,
      completedOptimizations: optimizations.length,
      successRate: requests.length
        ? (optimizations.filter((o) => o.success).length / requests.length) * 100
        : 0,
      avgTimeTaken: optimizations.length
        ? optimizations.reduce((sum, o) => sum + (o.time_taken || o.computation_time || 0), 0) /
          optimizations.length
        : 0,
      totalRoutes: optimizations.reduce((sum, o) => sum + (o.routes?.length || 0), 0),
      totalDistance: optimizations.reduce((sum, o) => sum + (o.total_distance || 0), 0),
      totalDuration: optimizations.reduce((sum, o) => sum + (o.total_duration || 0), 0),
      dailyStats: metrics,
    };
  }

  /**
   * Clear all data from the database
   * @returns {Promise<boolean>} - Success flag
   */
  async clearAllData() {
    if (this.mode === 'postgres') {
      return await postgresService.clearAllData();
    }

    lowdb.set('requests', []).write();
    lowdb.set('optimizations', []).write();
    lowdb.set('metrics', []).write();
    return true;
  }

  /**
   * Health check
   * @returns {Promise<Object>} - Health status
   */
  async healthCheck() {
    if (this.mode === 'postgres') {
      return await postgresService.healthCheck();
    }

    return {
      status: 'healthy',
      mode: 'lowdb',
      connected: true,
    };
  }

  /**
   * Get database mode
   * @returns {string} - 'lowdb' or 'postgres'
   */
  getMode() {
    return this.mode;
  }

  // ===================================
  // TRANSFORMATION METHODS
  // ===================================

  /**
   * Transform PostgreSQL request to LowDB format
   * @private
   */
  _transformPostgresRequest(pgRequest) {
    return {
      id: pgRequest.request_id,
      requestId: pgRequest.request_id,
      timestamp: pgRequest.timestamp,
      status: pgRequest.status,
      pickupPoints: pgRequest.pickup_points,
      deliveryPoints: pgRequest.delivery_points,
      fleet: pgRequest.fleet,
      businessRules: pgRequest.business_rules,
      preferences: pgRequest.preferences,
      context: pgRequest.context,
      updatedAt: pgRequest.updated_at,
    };
  }

  /**
   * Transform PostgreSQL optimization to LowDB format
   * @private
   */
  _transformPostgresOptimization(pgOpt) {
    return {
      id: pgOpt.optimization_id,
      requestId: pgOpt.request_id,
      success: pgOpt.success,
      routes: pgOpt.routes,
      total_distance: pgOpt.total_distance,
      total_duration: pgOpt.total_duration,
      total_cost: pgOpt.total_cost,
      fuel_consumption: pgOpt.fuel_consumption,
      co2_emissions: pgOpt.co2_emissions,
      time_taken: pgOpt.computation_time,
      algorithm_used: pgOpt.algorithm_used,
      timestamp: pgOpt.timestamp,
    };
  }

  /**
   * Transform PostgreSQL metric to LowDB format
   * @private
   */
  _transformPostgresMetric(pgMetric) {
    return {
      date: pgMetric.date,
      total_requests: pgMetric.total_requests,
      successful_requests: pgMetric.successful_requests,
      failed_requests: pgMetric.failed_requests,
      avg_response_time: pgMetric.avg_response_time,
      avg_route_distance: pgMetric.avg_route_distance,
      avg_route_duration: pgMetric.avg_route_duration,
      total_distance_optimized: pgMetric.total_distance_optimized,
      total_fuel_saved: pgMetric.total_fuel_saved,
      total_co2_reduced: pgMetric.total_co2_reduced,
      sla_compliance_rate: pgMetric.sla_compliance_rate,
      customer_satisfaction: pgMetric.customer_satisfaction,
      total_revenue: pgMetric.total_revenue,
      total_cost: pgMetric.total_cost,
      hourly_breakdown: pgMetric.hourly_breakdown,
      regional_breakdown: pgMetric.regional_breakdown,
    };
  }
}

module.exports = new DatabaseService();
