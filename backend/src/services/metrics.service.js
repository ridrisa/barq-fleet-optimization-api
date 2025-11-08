/**
 * Metrics Service - Prometheus Metrics Collection
 * Provides comprehensive metrics for monitoring system performance
 */

const client = require('prom-client');
const { logger } = require('../utils/logger');

class MetricsService {
  constructor() {
    this.register = new client.Registry();

    // Add default labels
    this.register.setDefaultLabels({
      app: 'barq-fleet-api',
      env: process.env.NODE_ENV || 'development',
    });

    // Collect default metrics (CPU, memory, event loop lag, etc.)
    client.collectDefaultMetrics({
      register: this.register,
      prefix: 'barq_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    });

    this.initializeCustomMetrics();

    logger.info('Metrics service initialized with Prometheus client');
  }

  /**
   * Initialize all custom metrics
   */
  initializeCustomMetrics() {
    // HTTP Request Duration Histogram
    this.httpRequestDuration = new client.Histogram({
      name: 'barq_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
    });

    // HTTP Request Total Counter
    this.httpRequestTotal = new client.Counter({
      name: 'barq_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    // HTTP Request Size
    this.httpRequestSize = new client.Histogram({
      name: 'barq_http_request_size_bytes',
      help: 'Size of HTTP requests in bytes',
      labelNames: ['method', 'route'],
      buckets: [100, 1000, 10000, 100000, 1000000],
    });

    // HTTP Response Size
    this.httpResponseSize = new client.Histogram({
      name: 'barq_http_response_size_bytes',
      help: 'Size of HTTP responses in bytes',
      labelNames: ['method', 'route'],
      buckets: [100, 1000, 10000, 100000, 1000000],
    });

    // Optimization Request Metrics
    this.optimizationRequestsTotal = new client.Counter({
      name: 'barq_optimization_requests_total',
      help: 'Total number of optimization requests',
      labelNames: ['status', 'vehicle_type'],
    });

    this.optimizationDuration = new client.Histogram({
      name: 'barq_optimization_duration_seconds',
      help: 'Duration of optimization requests in seconds',
      labelNames: ['status', 'complexity'],
      buckets: [0.5, 1, 2, 5, 10, 30, 60, 120],
    });

    this.optimizationStopsCount = new client.Histogram({
      name: 'barq_optimization_stops_count',
      help: 'Number of stops in optimization requests',
      buckets: [1, 5, 10, 20, 50, 100, 200, 500],
    });

    this.optimizationVehiclesCount = new client.Histogram({
      name: 'barq_optimization_vehicles_count',
      help: 'Number of vehicles in optimization requests',
      buckets: [1, 2, 5, 10, 20, 50],
    });

    // AI Agent Metrics
    this.activeAgentsGauge = new client.Gauge({
      name: 'barq_active_agents',
      help: 'Number of active AI agents',
      labelNames: ['agent_name', 'status'],
    });

    this.agentExecutionsTotal = new client.Counter({
      name: 'barq_agent_executions_total',
      help: 'Total number of agent executions',
      labelNames: ['agent_name', 'status'],
    });

    this.agentExecutionDuration = new client.Histogram({
      name: 'barq_agent_execution_duration_seconds',
      help: 'Duration of agent executions in seconds',
      labelNames: ['agent_name'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    });

    this.agentErrorsTotal = new client.Counter({
      name: 'barq_agent_errors_total',
      help: 'Total number of agent errors',
      labelNames: ['agent_name', 'error_type'],
    });

    // Autonomous Operations Metrics
    this.autonomousActionsTotal = new client.Counter({
      name: 'barq_autonomous_actions_total',
      help: 'Total number of autonomous actions executed',
      labelNames: ['action_type', 'status'],
    });

    this.autonomousCycleDuration = new client.Histogram({
      name: 'barq_autonomous_cycle_duration_seconds',
      help: 'Duration of autonomous operation cycles',
      buckets: [1, 5, 10, 30, 60, 120, 300],
    });

    this.autonomousDecisionsTotal = new client.Counter({
      name: 'barq_autonomous_decisions_total',
      help: 'Total autonomous decisions made',
      labelNames: ['decision_type', 'confidence_level'],
    });

    // Database Metrics
    this.databaseConnectionsGauge = new client.Gauge({
      name: 'barq_database_connections',
      help: 'Number of active database connections',
      labelNames: ['pool', 'state'],
    });

    this.databaseQueryDuration = new client.Histogram({
      name: 'barq_database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    });

    this.databaseQueriesTotal = new client.Counter({
      name: 'barq_database_queries_total',
      help: 'Total number of database queries',
      labelNames: ['operation', 'table', 'status'],
    });

    this.databaseErrorsTotal = new client.Counter({
      name: 'barq_database_errors_total',
      help: 'Total number of database errors',
      labelNames: ['operation', 'error_type'],
    });

    // Cache Metrics
    this.cacheHitsTotal = new client.Counter({
      name: 'barq_cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_name'],
    });

    this.cacheMissesTotal = new client.Counter({
      name: 'barq_cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_name'],
    });

    this.cacheSize = new client.Gauge({
      name: 'barq_cache_size_bytes',
      help: 'Current cache size in bytes',
      labelNames: ['cache_name'],
    });

    // Authentication Metrics
    this.authAttemptsTotal = new client.Counter({
      name: 'barq_auth_attempts_total',
      help: 'Total authentication attempts',
      labelNames: ['method', 'status'],
    });

    this.activeSessionsGauge = new client.Gauge({
      name: 'barq_active_sessions',
      help: 'Number of active user sessions',
    });

    // Business Metrics
    this.ordersTotal = new client.Counter({
      name: 'barq_orders_total',
      help: 'Total number of orders processed',
      labelNames: ['status', 'priority'],
    });

    this.deliveriesTotal = new client.Counter({
      name: 'barq_deliveries_total',
      help: 'Total number of deliveries',
      labelNames: ['status', 'on_time'],
    });

    this.slaViolationsTotal = new client.Counter({
      name: 'barq_sla_violations_total',
      help: 'Total SLA violations',
      labelNames: ['violation_type', 'severity'],
    });

    this.driverUtilization = new client.Gauge({
      name: 'barq_driver_utilization',
      help: 'Driver utilization percentage',
      labelNames: ['driver_id', 'vehicle_type'],
    });

    // WebSocket Metrics
    this.websocketConnectionsGauge = new client.Gauge({
      name: 'barq_websocket_connections',
      help: 'Number of active WebSocket connections',
    });

    this.websocketMessagesTotal = new client.Counter({
      name: 'barq_websocket_messages_total',
      help: 'Total WebSocket messages',
      labelNames: ['direction', 'type'],
    });

    // Register all metrics
    this.register.registerMetric(this.httpRequestDuration);
    this.register.registerMetric(this.httpRequestTotal);
    this.register.registerMetric(this.httpRequestSize);
    this.register.registerMetric(this.httpResponseSize);
    this.register.registerMetric(this.optimizationRequestsTotal);
    this.register.registerMetric(this.optimizationDuration);
    this.register.registerMetric(this.optimizationStopsCount);
    this.register.registerMetric(this.optimizationVehiclesCount);
    this.register.registerMetric(this.activeAgentsGauge);
    this.register.registerMetric(this.agentExecutionsTotal);
    this.register.registerMetric(this.agentExecutionDuration);
    this.register.registerMetric(this.agentErrorsTotal);
    this.register.registerMetric(this.autonomousActionsTotal);
    this.register.registerMetric(this.autonomousCycleDuration);
    this.register.registerMetric(this.autonomousDecisionsTotal);
    this.register.registerMetric(this.databaseConnectionsGauge);
    this.register.registerMetric(this.databaseQueryDuration);
    this.register.registerMetric(this.databaseQueriesTotal);
    this.register.registerMetric(this.databaseErrorsTotal);
    this.register.registerMetric(this.cacheHitsTotal);
    this.register.registerMetric(this.cacheMissesTotal);
    this.register.registerMetric(this.cacheSize);
    this.register.registerMetric(this.authAttemptsTotal);
    this.register.registerMetric(this.activeSessionsGauge);
    this.register.registerMetric(this.ordersTotal);
    this.register.registerMetric(this.deliveriesTotal);
    this.register.registerMetric(this.slaViolationsTotal);
    this.register.registerMetric(this.driverUtilization);
    this.register.registerMetric(this.websocketConnectionsGauge);
    this.register.registerMetric(this.websocketMessagesTotal);
  }

  /**
   * Middleware to track HTTP requests
   */
  trackHttpRequest() {
    return (req, res, next) => {
      const start = Date.now();

      // Track request size
      const requestSize = req.headers['content-length'] || 0;

      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = this.normalizeRoute(req.route?.path || req.path);

        // Track duration
        this.httpRequestDuration.labels(req.method, route, res.statusCode).observe(duration);

        // Track total requests
        this.httpRequestTotal.labels(req.method, route, res.statusCode).inc();

        // Track request size
        if (requestSize > 0) {
          this.httpRequestSize.labels(req.method, route).observe(parseInt(requestSize, 10));
        }

        // Track response size
        const responseSize = res.get('content-length') || 0;
        if (responseSize > 0) {
          this.httpResponseSize.labels(req.method, route).observe(parseInt(responseSize, 10));
        }
      });

      next();
    };
  }

  /**
   * Normalize route path for better grouping
   */
  normalizeRoute(path) {
    if (!path) return 'unknown';

    // Replace UUIDs, IDs with placeholders
    return path
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/\/\d+/g, '/:id')
      .replace(/^\/api/, '');
  }

  /**
   * Get metrics for Prometheus scraping
   */
  async getMetrics() {
    return this.register.metrics();
  }

  /**
   * Get content type for metrics
   */
  getContentType() {
    return this.register.contentType;
  }

  /**
   * Track optimization request
   */
  trackOptimization(
    status,
    duration,
    stops = 0,
    vehicles = 0,
    vehicleType = 'unknown',
    complexity = 'medium'
  ) {
    this.optimizationRequestsTotal.labels(status, vehicleType).inc();

    if (duration) {
      this.optimizationDuration.labels(status, complexity).observe(duration);
    }

    if (stops > 0) {
      this.optimizationStopsCount.observe(stops);
    }

    if (vehicles > 0) {
      this.optimizationVehiclesCount.observe(vehicles);
    }
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentName, status, count = 1) {
    this.activeAgentsGauge.labels(agentName, status).set(count);
  }

  /**
   * Track agent execution
   */
  trackAgentExecution(agentName, status, duration) {
    this.agentExecutionsTotal.labels(agentName, status).inc();

    if (duration) {
      this.agentExecutionDuration.labels(agentName).observe(duration);
    }
  }

  /**
   * Track agent error
   */
  trackAgentError(agentName, errorType) {
    this.agentErrorsTotal.labels(agentName, errorType).inc();
  }

  /**
   * Track autonomous action
   */
  trackAutonomousAction(actionType, status) {
    this.autonomousActionsTotal.labels(actionType, status).inc();
  }

  /**
   * Track autonomous cycle
   */
  trackAutonomousCycle(duration) {
    this.autonomousCycleDuration.observe(duration);
  }

  /**
   * Track autonomous decision
   */
  trackAutonomousDecision(decisionType, confidenceLevel) {
    this.autonomousDecisionsTotal.labels(decisionType, confidenceLevel).inc();
  }

  /**
   * Update database connections
   */
  updateDatabaseConnections(pool, state, count) {
    this.databaseConnectionsGauge.labels(pool, state).set(count);
  }

  /**
   * Track database query
   */
  trackDatabaseQuery(operation, table, status, duration) {
    this.databaseQueriesTotal.labels(operation, table, status).inc();

    if (duration) {
      this.databaseQueryDuration.labels(operation, table).observe(duration);
    }
  }

  /**
   * Track database error
   */
  trackDatabaseError(operation, errorType) {
    this.databaseErrorsTotal.labels(operation, errorType).inc();
  }

  /**
   * Track cache hit
   */
  trackCacheHit(cacheName) {
    this.cacheHitsTotal.labels(cacheName).inc();
  }

  /**
   * Track cache miss
   */
  trackCacheMiss(cacheName) {
    this.cacheMissesTotal.labels(cacheName).inc();
  }

  /**
   * Update cache size
   */
  updateCacheSize(cacheName, size) {
    this.cacheSize.labels(cacheName).set(size);
  }

  /**
   * Track authentication attempt
   */
  trackAuthAttempt(method, status) {
    this.authAttemptsTotal.labels(method, status).inc();
  }

  /**
   * Update active sessions
   */
  updateActiveSessions(count) {
    this.activeSessionsGauge.set(count);
  }

  /**
   * Track order
   */
  trackOrder(status, priority = 'normal') {
    this.ordersTotal.labels(status, priority).inc();
  }

  /**
   * Track delivery
   */
  trackDelivery(status, onTime = 'yes') {
    this.deliveriesTotal.labels(status, onTime).inc();
  }

  /**
   * Track SLA violation
   */
  trackSLAViolation(violationType, severity) {
    this.slaViolationsTotal.labels(violationType, severity).inc();
  }

  /**
   * Update driver utilization
   */
  updateDriverUtilization(driverId, vehicleType, utilization) {
    this.driverUtilization.labels(driverId, vehicleType).set(utilization);
  }

  /**
   * Update WebSocket connections
   */
  updateWebSocketConnections(count) {
    this.websocketConnectionsGauge.set(count);
  }

  /**
   * Track WebSocket message
   */
  trackWebSocketMessage(direction, type) {
    this.websocketMessagesTotal.labels(direction, type).inc();
  }
}

// Create singleton instance
const metricsService = new MetricsService();

module.exports = metricsService;
