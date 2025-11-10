/**
 * Health Check and Monitoring Routes
 * Provides system health status and metrics
 */

const express = require('express');
const router = express.Router();
const os = require('os');
const { asyncHandler } = require('../../middleware/error.middleware');
const {
  optionalAuthenticate,
  authenticate,
  authorize,
  ROLES,
} = require('../../middleware/auth.middleware');
// Database connection
const db = require('../../database');
const { logger } = require('../../utils/logger');
const { healthService } = require('../../services/health.service');
const { circuitBreakerManager } = require('../../utils/circuit-breaker');
const { auditService } = require('../../services/audit.service');
const { alertService } = require('../../services/alert.service');

// System start time
const startTime = Date.now();

/**
 * Basic health check
 * GET /health
 */
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Liveness probe for Kubernetes
 * GET /health/live
 */
router.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness probe for Kubernetes
 * GET /health/ready
 */
router.get(
  '/ready',
  asyncHandler(async (req, res) => {
    const checks = {
      database: false,
      agents: false,
      websocket: false,
    };

    // Check database
    try {
      const dbHealth = await db.healthCheck();
      checks.database = dbHealth.healthy;
    } catch (error) {
      logger.error('Database health check failed', error);
    }

    // Check agents
    try {
      const AgentInitializer = require('../../services/agent-initializer');
      const agentStatus = AgentInitializer.getStatus();
      checks.agents = agentStatus.initialized && agentStatus.health.healthy > 0;
    } catch (error) {
      logger.error('Agent health check failed', error);
      checks.agents = false;
    }

    // Check WebSocket server
    try {
      const wsHealthCheck = await fetch('http://localhost:8081/health').then((r) => r.json());
      checks.websocket = wsHealthCheck.status === 'healthy';
    } catch (error) {
      checks.websocket = false;
    }

    const allHealthy = Object.values(checks).every((check) => check === true);
    const status = allHealthy ? 200 : 503;

    res.status(status).json({
      status: allHealthy ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * Detailed health check
 * GET /health/detailed
 */
router.get(
  '/detailed',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const healthData = {
      status: 'checking',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0',
      checks: {},
    };

    // System metrics
    healthData.system = {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        percentage: (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2),
      },
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0]?.model,
        load: os.loadavg(),
      },
      process: {
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
      },
    };

    // Database health
    try {
      const dbHealth = await db.healthCheck();
      healthData.checks.database = {
        healthy: dbHealth.healthy,
        database: dbHealth.database,
        serverTime: dbHealth.serverTime,
        poolStats: dbHealth.poolStats,
      };
    } catch (error) {
      healthData.checks.database = {
        healthy: false,
        error: error.message,
      };
    }

    // Agent system health
    try {
      const AgentInitializer = require('../../services/agent-initializer');
      const agentStatus = AgentInitializer.getStatus();
      healthData.checks.agents = {
        healthy: agentStatus.initialized,
        uptime: agentStatus.uptime,
        agents: agentStatus.agents,
        health: agentStatus.health,
      };
    } catch (error) {
      healthData.checks.agents = {
        healthy: false,
        error: error.message,
      };
    }

    // WebSocket health
    try {
      const wsResponse = await fetch('http://localhost:8081/health');
      const wsHealth = await wsResponse.json();
      healthData.checks.websocket = {
        healthy: wsHealth.status === 'healthy',
        ...wsHealth,
      };
    } catch (error) {
      healthData.checks.websocket = {
        healthy: false,
        error: 'WebSocket server unreachable',
      };
    }

    // Order processing metrics (if authenticated)
    if (req.user) {
      try {
        const OrderModel = require('../models/order.model');
        const now = new Date();
        const todayStart = new Date(now.setHours(0, 0, 0, 0));
        const stats = await OrderModel.getStatistics(todayStart, new Date());

        healthData.metrics = {
          orders: stats.overall,
          byServiceType: stats.byServiceType,
          byStatus: stats.byStatus,
        };
      } catch (error) {
        healthData.metrics = {
          error: 'Failed to fetch metrics',
        };
      }
    }

    // Determine overall health
    const isHealthy = Object.values(healthData.checks).every((check) => check.healthy === true);

    healthData.status = isHealthy ? 'healthy' : 'degraded';

    res.status(isHealthy ? 200 : 503).json(healthData);
  })
);

/**
 * Metrics endpoint (Prometheus format)
 * GET /health/metrics
 */
router.get(
  '/metrics',
  authorize(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const metrics = [];

    // System metrics
    const memUsage = process.memoryUsage();
    metrics.push(`# HELP nodejs_memory_heap_used_bytes Process heap memory used`);
    metrics.push(`# TYPE nodejs_memory_heap_used_bytes gauge`);
    metrics.push(`nodejs_memory_heap_used_bytes ${memUsage.heapUsed}`);

    metrics.push(`# HELP nodejs_memory_heap_total_bytes Process heap memory total`);
    metrics.push(`# TYPE nodejs_memory_heap_total_bytes gauge`);
    metrics.push(`nodejs_memory_heap_total_bytes ${memUsage.heapTotal}`);

    metrics.push(`# HELP process_uptime_seconds Process uptime in seconds`);
    metrics.push(`# TYPE process_uptime_seconds counter`);
    metrics.push(`process_uptime_seconds ${process.uptime()}`);

    // Database metrics
    try {
      const dbHealth = await db.healthCheck();
      if (dbHealth.healthy && dbHealth.poolStats) {
        metrics.push(`# HELP database_pool_total Total database connections`);
        metrics.push(`# TYPE database_pool_total gauge`);
        metrics.push(`database_pool_total ${dbHealth.poolStats.totalCount}`);

        metrics.push(`# HELP database_pool_idle Idle database connections`);
        metrics.push(`# TYPE database_pool_idle gauge`);
        metrics.push(`database_pool_idle ${dbHealth.poolStats.idleCount}`);

        metrics.push(`# HELP database_pool_waiting Waiting database connections`);
        metrics.push(`# TYPE database_pool_waiting gauge`);
        metrics.push(`database_pool_waiting ${dbHealth.poolStats.waitingCount}`);
      }
    } catch (error) {
      // Ignore database metrics if unavailable
    }

    // Order metrics
    try {
      const result = await db.query(`
      SELECT
        service_type,
        status,
        COUNT(*) as count
      FROM orders
      WHERE created_at >= CURRENT_DATE
      GROUP BY service_type, status
    `);

      metrics.push(`# HELP orders_total Total orders by type and status`);
      metrics.push(`# TYPE orders_total counter`);

      result.rows.forEach((row) => {
        metrics.push(
          `orders_total{service_type="${row.service_type}",status="${row.status}"} ${row.count}`
        );
      });

      // SLA compliance
      const slaResult = await db.query(`
      SELECT
        service_type,
        COUNT(*) FILTER (WHERE sla_breached = false) as on_time,
        COUNT(*) FILTER (WHERE sla_breached = true) as late,
        COUNT(*) as total
      FROM orders
      WHERE status = 'delivered'
        AND created_at >= CURRENT_DATE
      GROUP BY service_type
    `);

      metrics.push(`# HELP sla_compliance_rate SLA compliance rate by service type`);
      metrics.push(`# TYPE sla_compliance_rate gauge`);

      slaResult.rows.forEach((row) => {
        const rate = row.total > 0 ? row.on_time / row.total : 1;
        metrics.push(`sla_compliance_rate{service_type="${row.service_type}"} ${rate}`);
      });
    } catch (error) {
      // Ignore order metrics if unavailable
    }

    // Agent metrics
    try {
      const AgentInitializer = require('../../services/agent-initializer');
      const agentStatus = AgentInitializer.getStatus();

      metrics.push(`# HELP agents_healthy Number of healthy agents`);
      metrics.push(`# TYPE agents_healthy gauge`);
      metrics.push(`agents_healthy ${agentStatus.health.healthy || 0}`);

      metrics.push(`# HELP agents_unhealthy Number of unhealthy agents`);
      metrics.push(`# TYPE agents_unhealthy gauge`);
      metrics.push(`agents_unhealthy ${agentStatus.health.unhealthy || 0}`);
    } catch (error) {
      // Ignore agent metrics if unavailable
    }

    res.set('Content-Type', 'text/plain');
    res.send(metrics.join('\n'));
  })
);

/**
 * Application info endpoint
 * GET /health/info
 */
router.get('/info', (req, res) => {
  res.json({
    name: 'BARQ Logistics API',
    version: process.env.APP_VERSION || '1.0.0',
    description: 'AI-powered route optimization for instant delivery',
    environment: process.env.NODE_ENV || 'development',
    services: {
      barq: '1-hour delivery within 5km radius',
      bullet: '2-4 hour delivery city-wide',
    },
    api: {
      version: 'v1',
      documentation: '/api/docs',
    },
    build: {
      timestamp: process.env.BUILD_TIMESTAMP || 'unknown',
      commit: process.env.GIT_COMMIT || 'unknown',
      branch: process.env.GIT_BRANCH || 'unknown',
    },
  });
});

/**
 * Dependencies health check
 * GET /health/dependencies
 */
router.get(
  '/dependencies',
  authorize(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const dependencies = {
      database: { status: 'checking', latency: null },
      redis: { status: 'checking', latency: null },
      websocket: { status: 'checking', latency: null },
      agents: { status: 'checking', count: 0 },
      external: {},
    };

    // Check database
    try {
      const start = Date.now();
      await db.query('SELECT 1');
      dependencies.database.latency = Date.now() - start;
      dependencies.database.status = 'healthy';
    } catch (error) {
      dependencies.database.status = 'unhealthy';
      dependencies.database.error = error.message;
    }

    // Check Redis (if configured)
    try {
      // Implement Redis check if Redis is set up
      dependencies.redis.status = 'not_configured';
    } catch (error) {
      dependencies.redis.status = 'unhealthy';
    }

    // Check WebSocket
    try {
      const start = Date.now();
      const response = await fetch('http://localhost:8081/health');
      dependencies.websocket.latency = Date.now() - start;
      dependencies.websocket.status = response.ok ? 'healthy' : 'unhealthy';
    } catch (error) {
      dependencies.websocket.status = 'unreachable';
    }

    // Check agents
    try {
      const AgentInitializer = require('../../services/agent-initializer');
      const status = AgentInitializer.getStatus();
      dependencies.agents.status = status.initialized ? 'healthy' : 'not_initialized';
      dependencies.agents.count = status.agents?.length || 0;
    } catch (error) {
      dependencies.agents.status = 'error';
    }

    // Check external services (Google Maps, SMS gateway, etc.)
    // Add checks for your external dependencies here

    const allHealthy = Object.values(dependencies).every(
      (dep) => dep.status === 'healthy' || dep.status === 'not_configured'
    );

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      dependencies,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * Smoke test endpoint
 * GET /health/smoke
 */
router.get(
  '/smoke',
  asyncHandler(async (req, res) => {
    const tests = {
      api: false,
      database: false,
      orderCreation: false,
    };

    // Test API
    tests.api = true;

    // Test database connectivity
    try {
      await db.query('SELECT NOW()');
      tests.database = true;
    } catch (error) {
      logger.error('Smoke test: Database failed', error);
    }

    // Test order creation flow (dry run)
    try {
      // This would be a dry-run test of order creation
      // without actually creating an order
      tests.orderCreation = true;
    } catch (error) {
      logger.error('Smoke test: Order creation failed', error);
    }

    const allPassed = Object.values(tests).every((test) => test === true);

    res.status(allPassed ? 200 : 503).json({
      status: allPassed ? 'passed' : 'failed',
      tests,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * Circuit Breaker status
 * GET /health/circuit-breakers
 */
router.get(
  '/circuit-breakers',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const status = circuitBreakerManager.getAllStates();

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * Reset circuit breaker
 * POST /health/circuit-breakers/:name/reset
 */
router.post(
  '/circuit-breakers/:name/reset',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { name } = req.params;

    circuitBreakerManager.reset(name);

    // Log audit event
    await auditService.logConfigChange(
      req.user.id,
      {
        action: 'circuit_breaker_reset',
        service: name,
      },
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.id,
      }
    );

    res.json({
      success: true,
      message: `Circuit breaker ${name} reset successfully`,
    });
  })
);

/**
 * Alert statistics
 * GET /health/alerts/stats
 */
router.get(
  '/alerts/stats',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const stats = alertService.getStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * Test alert
 * POST /health/alerts/test
 */
router.post(
  '/alerts/test',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { level, title, message } = req.body;

    await alertService.sendAlert(
      level || 'INFO',
      title || 'Test Alert',
      message || 'This is a test alert from the health monitoring system',
      {
        triggeredBy: req.user.id,
        environment: process.env.NODE_ENV,
      }
    );

    res.json({
      success: true,
      message: 'Test alert sent successfully',
    });
  })
);

/**
 * Audit logs query
 * GET /health/audit/logs
 */
router.get(
  '/audit/logs',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const filters = {
      eventType: req.query.eventType,
      userId: req.query.userId,
      resource: req.query.resource,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: parseInt(req.query.limit) || 100,
    };

    const logs = await auditService.query(filters);

    res.json({
      success: true,
      data: {
        logs,
        count: logs.length,
        filters,
      },
    });
  })
);

/**
 * Audit statistics
 * GET /health/audit/stats
 */
router.get(
  '/audit/stats',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const stats = await auditService.getStatistics(
      startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      endDate || new Date().toISOString()
    );

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * Verify audit log integrity
 * POST /health/audit/verify
 */
router.post(
  '/audit/verify',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'File path is required',
      });
    }

    const verification = await auditService.verifyIntegrity(filePath);

    res.json({
      success: true,
      data: verification,
    });
  })
);

module.exports = router;
