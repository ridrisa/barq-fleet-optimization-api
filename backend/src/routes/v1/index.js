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
const adminRoutes = require('./admin.routes');
const autonomousRoutes = require('./autonomous.routes');
const healthRoutes = require('./health.routes');
const analyticsRoutes = require('./analytics.routes');
const productionMetricsRoutes = require('./production-metrics.routes');
const aiQueryRoutes = require('./ai-query.routes');

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
      admin: '/api/v1/admin',
      autonomous: '/api/v1/autonomous',
      health: '/api/v1/health',
      analytics: '/api/v1/analytics',
      productionMetrics: '/api/v1/production-metrics',
      aiQuery: '/api/v1/ai-query',
    },
    features: [
      'Route optimization',
      'AI agent operations',
      'Fleet management',
      'Autonomous operations',
      'Authentication and authorization',
      'Admin operations',
      'Real-time SLA analytics',
      'Performance dashboards',
    ],
  });
});

// Mount v1 routes
router.use('/auth', authRoutes);
router.use('/optimize', optimizationRoutes);
router.use('/agents', agentRoutes);
router.use('/admin', adminRoutes);
router.use('/autonomous', autonomousRoutes);
router.use('/health', healthRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/production-metrics', productionMetricsRoutes);
router.use('/ai-query', aiQueryRoutes);

module.exports = router;
