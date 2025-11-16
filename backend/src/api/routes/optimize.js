/**
 * Optimization Routes
 * API endpoints for route optimization
 */

const express = require('express');
const { asyncHandler } = require('../../utils/error.handler');
const { RequestSanitizer } = require('../../utils/sanitizer');
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
    try {
      // Get the start time for metrics
      const startTime = Date.now();

      // Validate the request using Joi
      const { error, value } = optimizationRequestSchema.validate(req.body);
      if (error) {
        console.error('Validation error:', error.details);
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
            type: detail.type,
          })),
        });
      }

      // Sanitize the request
      const sanitizedRequest = sanitizer.sanitize(value);

      // Generate a request ID
      const requestId = req.headers['x-request-id'] || `req-${generateId()}`;

      // Process the optimization request
      const result = await logisticsService.processOptimizationRequest(requestId, sanitizedRequest);

      // Return the result
      res.json(result);
    } catch (error) {
      console.error(`Optimization error: ${error.message}`);

      // Provide specific error messages
      let statusCode = 500;
      let errorMessage = 'Internal server error';

      if (error.message.includes('ValidationError')) {
        statusCode = 400;
        errorMessage = 'Invalid request data';
      } else if (error.message.includes('CVRP')) {
        statusCode = 503;
        errorMessage = 'Optimization service temporarily unavailable';
      } else if (error.message.includes('GROQ') || error.message.includes('API')) {
        statusCode = 503;
        errorMessage = 'External service temporarily unavailable';
      }

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        requestId: req.headers['x-request-id'] || `req-${generateId()}`,
      });
    }
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
    try {
      const { requestId } = req.params;

      // Validate requestId
      if (!requestId || typeof requestId !== 'string' || requestId.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request ID',
          details: 'Request ID must be a non-empty string',
        });
      }

      // Get the status
      const status = await logisticsService.getOptimizationStatus(requestId);

      if (!status) {
        return res.status(404).json({
          success: false,
          error: `Optimization request with ID ${requestId} not found`,
        });
      }

      res.json(status);
    } catch (error) {
      console.error(`Status check error for ${req.params.requestId}: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to check optimization status',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        requestId: req.params.requestId,
      });
    }
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
    try {
      // Get and validate pagination parameters
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;
      const page = req.query.page ? parseInt(req.query.page) : 1;

      // Validate pagination parameters
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          error: 'Invalid limit parameter',
          details: 'Limit must be a number between 1 and 100',
        });
      }

      if (isNaN(page) || page < 1) {
        return res.status(400).json({
          success: false,
          error: 'Invalid page parameter',
          details: 'Page must be a number greater than 0',
        });
      }

      // Get the optimization history
      const historyResult = await logisticsService.getOptimizationHistory(limit, page);

      res.json({
        success: true,
        data: historyResult.items,
        meta: {
          pagination: historyResult.pagination,
        },
      });
    } catch (error) {
      console.error(`History retrieval error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve optimization history',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  })
);

/**
 * @swagger
 * /api/optimize/{id}:
 *   get:
 *     summary: Get optimization details by ID
 *     description: Retrieve complete details of a specific optimization request
 *     tags: [Optimization]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the optimization request
 *     responses:
 *       200:
 *         description: Optimization details retrieved successfully
 *       404:
 *         description: Optimization not found
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      // Validate ID
      if (!id || typeof id !== 'string' || id.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid optimization ID',
          details: 'Optimization ID must be a non-empty string',
        });
      }

      // Get the optimization result
      const result = await logisticsService.getOptimizationResult(id);

      if (!result) {
        return res.status(404).json({
          success: false,
          error: `Optimization with ID ${id} not found`,
        });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error(`Optimization retrieval error for ${req.params.id}: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve optimization details',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        optimizationId: req.params.id,
      });
    }
  })
);

module.exports = router;
