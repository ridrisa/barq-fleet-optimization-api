/**
 * Optimization Routes
 * API endpoints for route optimization
 */

const express = require('express');
const { asyncHandler } = require('../../utils/error.handler');
const { RequestSanitizer, ValidationError } = require('../../utils/sanitizer');
const { optimizationRequestSchema } = require('../../models/request.model');
const { logisticsService } = require('../../services/logistics.service');
const { generateId } = require('../../utils/helper');
const router = express.Router();

// Initialize services
const sanitizer = new RequestSanitizer();

/**
 * @swagger
 * /api/optimize:
 *   post:
 *     summary: Optimize delivery routes
 *     description: Creates optimized routes for a set of pickups and deliveries
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
 *         description: Invalid request data
 *       500:
 *         description: Server error
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    // Get the start time for metrics
    const startTime = Date.now();

    // Validate the request using Joi
    const { error, value } = optimizationRequestSchema.validate(req.body);
    if (error) {
      throw new ValidationError(`Invalid request: ${error.message}`);
    }

    // Sanitize the request
    const sanitizedRequest = sanitizer.sanitize(value);

    // Generate a request ID
    const requestId = req.headers['x-request-id'] || `req-${generateId()}`;

    // Process the optimization request
    const result = await logisticsService.processOptimizationRequest(requestId, sanitizedRequest);

    // Return the result
    res.json(result);
  })
);

/**
 * @swagger
 * /api/optimize/status/{requestId}:
 *   get:
 *     summary: Check optimization status
 *     description: Retrieve the status of an ongoing optimization request
 *     tags: [Optimization]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the optimization request
 *     responses:
 *       200:
 *         description: Status retrieved successfully
 *       404:
 *         description: Request not found
 */
router.get(
  '/status/:requestId',
  asyncHandler(async (req, res) => {
    const { requestId } = req.params;

    // Get the status
    const status = await logisticsService.getOptimizationStatus(requestId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: `Optimization request with ID ${requestId} not found`,
      });
    }

    res.json(status);
  })
);

/**
 * @swagger
 * /api/optimize/history:
 *   get:
 *     summary: Get optimization history
 *     description: Retrieve a list of past optimization requests
 *     tags: [Optimization]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of records to return
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: History retrieved successfully
 */
router.get(
  '/history',
  asyncHandler(async (req, res) => {
    // Get pagination parameters
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const page = req.query.page ? parseInt(req.query.page) : 1;

    // Get the optimization history
    const historyResult = await logisticsService.getOptimizationHistory(limit, page);

    res.json({
      success: true,
      data: historyResult.items,
      meta: {
        pagination: historyResult.pagination,
      },
    });
  })
);

module.exports = router;
