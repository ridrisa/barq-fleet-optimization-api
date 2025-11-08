/**
 * API Routes Index
 * Main router that handles version routing and backward compatibility
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const {
  addVersionHeaders,
  validateVersion,
  logVersionUsage,
  getVersionInfo,
} = require('../middleware/version.middleware');

// Import versioned routes
const v1Routes = require('./v1');

// Apply version middleware to all API routes
router.use(addVersionHeaders);
router.use(logVersionUsage);
router.use(validateVersion);

/**
 * @swagger
 * /api:
 *   get:
 *     summary: API Information
 *     description: Get general API information and available versions
 *     tags: [API]
 *     responses:
 *       200:
 *         description: API information retrieved successfully
 */
router.get('/', (req, res) => {
  const versionInfo = getVersionInfo();

  res.json({
    success: true,
    name: 'AI Route Optimization API',
    description: 'Advanced fleet management and route optimization with AI agents',
    ...versionInfo,
    documentation: '/api-docs',
    health: '/health',
    metrics: '/metrics',
  });
});

/**
 * @swagger
 * /api/versions:
 *   get:
 *     summary: API Versions
 *     description: Get detailed information about all API versions
 *     tags: [API]
 *     responses:
 *       200:
 *         description: Version information retrieved successfully
 */
router.get('/versions', (req, res) => {
  const versionInfo = getVersionInfo();

  res.json({
    success: true,
    ...versionInfo,
    versions: {
      v1: {
        status: 'stable',
        releaseDate: '2025-01-01',
        endpoints: '/api/v1',
        documentation: '/api-docs#/v1',
        features: [
          'Route optimization',
          'AI agent operations',
          'Fleet management',
          'Autonomous operations',
          'Authentication and authorization',
        ],
      },
    },
  });
});

// Mount versioned routes
router.use('/v1', v1Routes);

// Backward compatibility: Mount v1 routes at root /api level
// This allows old clients to continue working without /v1 prefix
// These routes will be deprecated in future versions
const authRoutes = require('./v1/auth.routes');
const optimizationRoutes = require('./v1/optimization.routes');
const agentRoutes = require('./v1/agents.routes');
const adminRoutes = require('./v1/admin.routes');
const autonomousRoutes = require('./v1/autonomous.routes');

// Log backward compatibility usage
router.use((req, res, next) => {
  // Only log if not already on a versioned path
  if (!req.path.match(/^\/v\d+\//)) {
    logger.debug('Backward compatibility route accessed', {
      requestId: req.headers['x-request-id'],
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });

    // Add deprecation header for unversioned routes
    res.setHeader('X-API-Unversioned-Access', 'true');
    res.setHeader(
      'Warning',
      '299 - "Accessing API without version prefix is deprecated. Please use /api/v1/ prefix."'
    );
  }
  next();
});

// Mount backward compatibility routes (without version prefix)
router.use('/auth', authRoutes);
router.use('/optimize', optimizationRoutes);
router.use('/agents', agentRoutes);
router.use('/admin', adminRoutes);
router.use('/autonomous', autonomousRoutes);

module.exports = router;
