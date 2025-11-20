/**
 * Error Monitoring Routes
 * Provides endpoints for error tracking and system monitoring
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../middleware/error.middleware');
const { optionalAuthenticate, authenticate, authorize, ROLES } = require('../../middleware/auth.middleware');
const { errorMonitoringService } = require('../../services/error-monitoring.service');
const { healthService } = require('../../services/health.service');
const db = require('../../database');

/**
 * Get error monitoring dashboard data
 * GET /api/v1/monitoring/dashboard
 */
router.get(
  '/dashboard',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const dashboardData = errorMonitoringService.getDashboardData();

    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * Get error metrics for a specific time window
 * GET /api/v1/monitoring/errors
 * Query params: window (5min, 1hour, 24hour)
 */
router.get(
  '/errors',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const { window = '1hour' } = req.query;
    const metrics = errorMonitoringService.getMetrics(window);

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * Get error trends over time
 * GET /api/v1/monitoring/errors/trends
 * Query params: intervals, intervalMs
 */
router.get(
  '/errors/trends',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const intervals = parseInt(req.query.intervals) || 12;
    const intervalMs = parseInt(req.query.intervalMs) || 5 * 60 * 1000;

    const trends = errorMonitoringService.getErrorTrends(intervals, intervalMs);

    res.json({
      success: true,
      data: trends,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * Get active alerts
 * GET /api/v1/monitoring/alerts
 */
router.get(
  '/alerts',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const alerts = errorMonitoringService.getActiveAlerts();

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * Get error monitoring statistics
 * GET /api/v1/monitoring/stats
 */
router.get(
  '/stats',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const stats = errorMonitoringService.getStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * Get comprehensive system health
 * GET /api/v1/monitoring/health
 */
router.get(
  '/health',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const healthData = {
      timestamp: new Date().toISOString(),
      components: {},
      overallStatus: 'healthy',
      overallScore: 100,
    };

    // Database health
    try {
      const dbHealth = await db.healthCheck();
      healthData.components.database = {
        status: dbHealth.healthy ? 'healthy' : 'unhealthy',
        score: dbHealth.healthy ? 100 : 0,
        latency: dbHealth.latency || null,
        details: {
          database: dbHealth.database,
          poolStats: dbHealth.poolStats,
        },
      };
      if (!dbHealth.healthy) {
        healthData.overallStatus = 'degraded';
        healthData.overallScore -= 30;
      }
    } catch (error) {
      healthData.components.database = {
        status: 'unhealthy',
        score: 0,
        error: error.message,
      };
      healthData.overallStatus = 'unhealthy';
      healthData.overallScore -= 30;
    }

    // Agent system health
    try {
      const AgentInitializer = require('../../services/agent-initializer');
      const agentStatus = AgentInitializer.getStatus();
      const agentHealthy = agentStatus.initialized && agentStatus.health.healthy > 0;

      healthData.components.agents = {
        status: agentHealthy ? 'healthy' : 'degraded',
        score: agentHealthy ? 100 : 50,
        details: {
          initialized: agentStatus.initialized,
          totalAgents: agentStatus.agents?.length || 0,
          healthyAgents: agentStatus.health?.healthy || 0,
          unhealthyAgents: agentStatus.health?.unhealthy || 0,
        },
      };
      if (!agentHealthy) {
        healthData.overallScore -= 20;
        if (healthData.overallStatus === 'healthy') {
          healthData.overallStatus = 'degraded';
        }
      }
    } catch (error) {
      healthData.components.agents = {
        status: 'unknown',
        score: 50,
        error: error.message,
      };
      healthData.overallScore -= 20;
    }

    // Analytics Lab health
    try {
      const analyticsHealth = await fetch('http://localhost:3003/api/v1/analytics-lab/status')
        .then(r => r.json())
        .catch(() => ({ status: 'unknown' }));

      const analyticsHealthy = analyticsHealth.status === 'operational' || analyticsHealth.pythonAvailable;

      healthData.components.analytics = {
        status: analyticsHealthy ? 'healthy' : 'degraded',
        score: analyticsHealthy ? 100 : 50,
        details: {
          pythonAvailable: analyticsHealth.pythonAvailable,
          databaseConnected: analyticsHealth.databaseHealth?.isHealthy,
          fallbackMode: analyticsHealth.databaseHealth?.circuitBreaker?.isOpen,
        },
      };
      if (!analyticsHealthy) {
        healthData.overallScore -= 15;
      }
    } catch (error) {
      healthData.components.analytics = {
        status: 'unknown',
        score: 50,
        error: 'Unable to reach analytics service',
      };
      healthData.overallScore -= 15;
    }

    // WebSocket health
    try {
      const wsHealth = await fetch('http://localhost:8081/health')
        .then(r => r.json())
        .catch(() => null);

      healthData.components.websocket = {
        status: wsHealth?.status === 'healthy' ? 'healthy' : 'unhealthy',
        score: wsHealth?.status === 'healthy' ? 100 : 0,
        details: wsHealth || {},
      };
      if (wsHealth?.status !== 'healthy') {
        healthData.overallScore -= 10;
        if (healthData.overallStatus === 'healthy') {
          healthData.overallStatus = 'degraded';
        }
      }
    } catch (error) {
      healthData.components.websocket = {
        status: 'unhealthy',
        score: 0,
        error: 'WebSocket server unreachable',
      };
      healthData.overallScore -= 10;
    }

    // Error monitoring health
    const errorStats = errorMonitoringService.getStats();
    const errorBreakdown = errorMonitoringService.getCategoryBreakdown();
    const recentErrors = errorMonitoringService.getMetrics('5min').totalErrors;

    healthData.components.errorMonitoring = {
      status: recentErrors < 10 ? 'healthy' : recentErrors < 50 ? 'degraded' : 'unhealthy',
      score: Math.max(0, 100 - recentErrors * 2),
      details: {
        recentErrors,
        totalTracked: errorStats.totalErrorsTracked,
        uptime: errorStats.uptimeFormatted,
      },
    };

    // Ensure score is between 0 and 100
    healthData.overallScore = Math.max(0, Math.min(100, healthData.overallScore));

    // Determine overall status based on score
    if (healthData.overallScore >= 80) {
      healthData.overallStatus = 'healthy';
    } else if (healthData.overallScore >= 50) {
      healthData.overallStatus = 'degraded';
    } else {
      healthData.overallStatus = 'unhealthy';
    }

    const statusCode = healthData.overallStatus === 'unhealthy' ? 503 : 200;

    res.status(statusCode).json({
      success: true,
      data: healthData,
    });
  })
);

/**
 * Get category breakdown
 * GET /api/v1/monitoring/categories
 */
router.get(
  '/categories',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const breakdown = errorMonitoringService.getCategoryBreakdown();

    res.json({
      success: true,
      data: breakdown,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * Manually log a test error (admin only)
 * POST /api/v1/monitoring/errors/test
 */
router.post(
  '/errors/test',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { message, category, severity } = req.body;

    const errorId = errorMonitoringService.logError({
      message: message || 'Test error from monitoring dashboard',
      category: category || 'api',
      severity: severity || 'low',
      statusCode: 500,
      code: 'TEST_ERROR',
      path: req.path,
      method: req.method,
      userId: req.user.id,
      requestId: req.headers['x-request-id'],
      metadata: {
        isTest: true,
        triggeredBy: req.user.email,
      },
    });

    res.json({
      success: true,
      message: 'Test error logged successfully',
      errorId,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * Reset monitoring data (super admin only, for testing)
 * POST /api/v1/monitoring/reset
 */
router.post(
  '/reset',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    errorMonitoringService.reset();

    res.json({
      success: true,
      message: 'Error monitoring data reset successfully',
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * Get monitoring service status
 * GET /api/v1/monitoring/status
 */
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    const stats = errorMonitoringService.getStats();
    const alerts = errorMonitoringService.getActiveAlerts();

    res.json({
      success: true,
      data: {
        service: 'Error Monitoring',
        status: 'operational',
        uptime: stats.uptimeFormatted,
        version: '1.0.0',
        stats,
        activeAlerts: alerts.length,
      },
      timestamp: new Date().toISOString(),
    });
  })
);

module.exports = router;
