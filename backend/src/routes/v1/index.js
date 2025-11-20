/**
 * API v1 Routes Aggregator
 * Consolidates all v1 API routes
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../../utils/logger');

// Import v1 route modules
const authRoutes = require('./auth.routes');
const optimizationRoutes = require('./optimization.routes');
const agentRoutes = require('./agents.routes');
const individualAgentsRoutes = require('./individual-agents.routes');
const adminRoutes = require('./admin.routes');
const autonomousRoutes = require('./autonomous.routes');
const healthRoutes = require('./health.routes');
const analyticsRoutes = require('./analytics.routes');
const productionMetricsRoutes = require('./production-metrics.routes');
const aiQueryRoutes = require('./ai-query.routes');
const automationRoutes = require('../automation.routes');
const fleetManagerRoutes = require('./fleet-manager.routes');
const driverRoutes = require('./drivers.routes');
const aiMetricsRoutes = require('./ai-metrics.routes');
const vehiclesRoutes = require('./vehicles.routes');
const analyticsLabRoutes = require('./analytics-lab.routes');
const demoRoutes = require('../../demo/demo-routes');

// Log v1 API usage
router.use((req, res, next) => {
  logger.debug('API v1 request', {
    requestId: req.headers['x-request-id'],
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
  });
  next();
});

/**
 * @swagger
 * /api/v1:
 *   get:
 *     summary: API v1 Information
 *     description: Get information about API version 1
 *     tags: [Version]
 *     responses:
 *       200:
 *         description: Version information retrieved successfully
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    version: 'v1',
    status: 'stable',
    documentation: '/api-docs',
    endpoints: {
      auth: '/api/v1/auth',
      optimization: '/api/v1/optimize',
      agents: '/api/v1/agents',
      individualAgents: '/api/v1/agents/individual',
      admin: '/api/v1/admin',
      autonomous: '/api/v1/autonomous',
      health: '/api/v1/health',
      analytics: '/api/v1/analytics',
      productionMetrics: '/api/v1/production-metrics',
      aiQuery: '/api/v1/ai-query',
      automation: '/api/v1/automation',
      fleetManager: '/api/v1/fleet-manager',
      drivers: '/api/v1/drivers',
      aiMetrics: '/api/v1/admin/ai',
      vehicles: '/api/v1/vehicles',
      analyticsLab: '/api/v1/analytics-lab',
      demo: '/api/v1/demo',
    },
    features: [
      'Route optimization',
      'AI agent operations',
      'Fleet management',
      'Driver state management',
      'Autonomous operations',
      'Authentication and authorization',
      'Admin operations',
      'Real-time SLA analytics',
      'Performance dashboards',
      'Interactive demo system',
      'Live simulation engine',
    ],
  });
});

// Mount v1 routes
router.use('/auth', authRoutes);
router.use('/optimize', optimizationRoutes);
router.use('/agents', agentRoutes);
router.use('/agents/individual', individualAgentsRoutes);
router.use('/admin', adminRoutes);
router.use('/autonomous', autonomousRoutes);
router.use('/health', healthRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/production-metrics', productionMetricsRoutes);
router.use('/ai-query', aiQueryRoutes);
router.use('/automation', automationRoutes);
router.use('/fleet-manager', fleetManagerRoutes);
router.use('/drivers', driverRoutes);
router.use('/admin/ai', aiMetricsRoutes);
router.use('/vehicles', vehiclesRoutes);
router.use('/analytics-lab', analyticsLabRoutes);
router.use('/demo', demoRoutes);

module.exports = router;
