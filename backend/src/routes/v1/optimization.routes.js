/**
 * Optimization Routes
 * Defines all API routes for the optimization service
 */

const express = require('express');
const router = express.Router();
const validator = require('../../middleware/validator');
const optimizationController = require('../../controllers/optimization.controller');
const { authenticate, authorize, ROLES } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validation.middleware');
const { logger } = require('../../utils/logger');

// Log all requests to the API
router.use((req, res, next) => {
  logger.debug(`Optimization API request: ${req.method} ${req.originalUrl}`, {
    requestId: req.headers['x-request-id'],
    method: req.method,
    path: req.originalUrl,
    contentType: req.headers['content-type'],
  });
  next();
});

/**
 * @swagger
 * /api/optimize:
 *   post:
 *     summary: Optimize delivery routes
 *     description: |
 *       Generate optimized delivery routes based on pickup and delivery points.
 *       Each pickup point should have a unique "id" field to ensure proper routing.
 *       If no "id" is provided, the system will generate one, but providing explicit IDs
 *       gives you more control over the routing process and region assignments.
 *     tags: [Optimization]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OptimizationRequest'
 *     responses:
 *       200:
 *         description: Successful optimization
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OptimizationResponse'
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post(
  '/',
  // authenticate,  // TEMPORARILY DISABLED FOR TESTING
  // authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.DISPATCHER),  // TEMPORARILY DISABLED FOR TESTING
  validate('optimizeRequest'),
  optimizationController.optimizeRoute
);

/**
 * @swagger
 * /api/optimize/history:
 *   get:
 *     summary: Get optimization history
 *     description: Retrieve the history of optimization requests
 *     tags: [Optimization]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items to retrieve
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: History retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OptimizationHistory'
 *       500:
 *         description: Server error
 */
router.get(
  '/history',
  // authenticate,  // TEMPORARILY DISABLED FOR TESTING
  // authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.DISPATCHER),  // TEMPORARILY DISABLED FOR TESTING
  optimizationController.getOptimizationHistory
);

/**
 * @swagger
 * /api/optimize/status/{requestId}:
 *   get:
 *     summary: Get optimization status
 *     description: Check the status of an optimization request
 *     tags: [Optimization]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OptimizationStatus'
 *       404:
 *         description: Optimization request not found
 *       500:
 *         description: Server error
 */
router.get(
  '/status/:requestId',
  // authenticate,  // TEMPORARILY DISABLED FOR TESTING
  // authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.DISPATCHER),  // TEMPORARILY DISABLED FOR TESTING
  optimizationController.getOptimizationStatus
);

/**
 * @swagger
 * /api/optimize/db/clear:
 *   delete:
 *     summary: Clear all optimization data
 *     description: Delete all optimization requests, results, and related data from the database
 *     tags: [Administration]
 *     responses:
 *       200:
 *         description: Data cleared successfully
 *       500:
 *         description: Server error
 */
router.delete(
  '/db/clear',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  optimizationController.clearData
);

/**
 * @swagger
 * /api/optimize/{requestId}:
 *   get:
 *     summary: Get optimization result by ID
 *     description: Retrieve the complete result of a specific optimization request
 *     tags: [Optimization]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Optimization result retrieved successfully
 *       404:
 *         description: Optimization request not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:requestId',
  // authenticate,  // TEMPORARILY DISABLED FOR TESTING
  // authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.DISPATCHER),  // TEMPORARILY DISABLED FOR TESTING
  optimizationController.getOptimizationResult
);

// Export the router
module.exports = router;
