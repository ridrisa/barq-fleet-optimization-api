/**
 * Demo Routes - Integrated into Main Server
 * Provides demo functionality within the same server as the main API
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/error.handler');
const { logger } = require('../utils/logger');

// Import demo components
const DemoGenerator = require('./demo-generator');
const demoDatabaseService = require('./demo-database.service');

// Global demo state (in production, this would be in a database or cache)
let demoState = {
  isRunning: false,
  generator: null,
  startTime: null,
  ordersPerMinute: 5,
  duration: 300,
  stats: {
    totalOrders: 0,
    completedOrders: 0,
    failedOrders: 0,
    activeDrivers: 0,
    busyDrivers: 0,
  },
};

/**
 * @swagger
 * /api/demo/start:
 *   post:
 *     summary: Start demo simulation
 *     description: Start the real-time demo simulation with configurable parameters
 *     tags: [Demo]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ordersPerMinute:
 *                 type: integer
 *                 default: 5
 *                 minimum: 1
 *                 maximum: 50
 *               duration:
 *                 type: integer
 *                 default: 300
 *                 minimum: 60
 *                 maximum: 3600
 *                 description: Duration in seconds
 *     responses:
 *       200:
 *         description: Demo started successfully
 *       400:
 *         description: Invalid parameters
 *       409:
 *         description: Demo already running
 */
router.post(
  '/start',
  asyncHandler(async (req, res) => {
    try {
      // Validate input parameters
      const { ordersPerMinute = 5, duration = 300 } = req.body;

      if (ordersPerMinute < 1 || ordersPerMinute > 50) {
        return res.status(400).json({
          success: false,
          error: 'Invalid ordersPerMinute',
          details: 'Must be between 1 and 50',
        });
      }

      if (duration < 60 || duration > 3600) {
        return res.status(400).json({
          success: false,
          error: 'Invalid duration',
          details: 'Must be between 60 and 3600 seconds',
        });
      }

      if (demoState.isRunning) {
        return res.status(409).json({
          success: false,
          error: 'Demo already running',
          details: 'Stop the current demo before starting a new one',
        });
      }

      // Start the demo
      demoState.generator = new DemoGenerator();
      demoState.isRunning = true;
      demoState.startTime = new Date();
      demoState.ordersPerMinute = ordersPerMinute;
      demoState.duration = duration;

      // Reset stats
      demoState.stats = {
        totalOrders: 0,
        completedOrders: 0,
        failedOrders: 0,
        activeDrivers: 0,
        busyDrivers: 0,
      };

      // Set up event listeners
      demoState.generator.on('orderCreated', (order) => {
        demoState.stats.totalOrders++;
        logger.info('Demo order created', { orderId: order.id });
      });

      demoState.generator.on('orderDelivered', (data) => {
        demoState.stats.completedOrders++;
        logger.info('Demo order delivered', { orderId: data.orderId });
      });

      demoState.generator.on('orderFailed', (data) => {
        demoState.stats.failedOrders++;
        logger.info('Demo order failed', { orderId: data.orderId });
      });

      // Start the generator
      await demoState.generator.start(ordersPerMinute, duration / 60); // Convert to minutes

      logger.info('Demo started', { ordersPerMinute, duration });

      res.json({
        success: true,
        message: 'Demo started successfully',
        data: {
          ordersPerMinute,
          duration,
          startTime: demoState.startTime.toISOString(),
          status: 'running',
        },
      });
    } catch (error) {
      logger.error('Failed to start demo', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to start demo',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  })
);

/**
 * @swagger
 * /api/demo/stop:
 *   post:
 *     summary: Stop demo simulation
 *     description: Stop the currently running demo simulation
 *     tags: [Demo]
 *     responses:
 *       200:
 *         description: Demo stopped successfully
 *       409:
 *         description: No demo running
 */
router.post(
  '/stop',
  asyncHandler(async (req, res) => {
    try {
      if (!demoState.isRunning) {
        return res.status(409).json({
          success: false,
          error: 'No demo running',
          details: 'Start a demo before trying to stop it',
        });
      }

      // Stop the demo
      if (demoState.generator) {
        await demoState.generator.stop();
        demoState.generator = null;
      }

      const endTime = new Date();
      const runTime = demoState.startTime ? (endTime - demoState.startTime) / 1000 : 0;

      demoState.isRunning = false;

      // Auto-cleanup demo orders older than the demo duration
      const cleanupMinutes = Math.ceil(runTime / 60) + 5; // Demo duration + 5 minutes buffer
      const cleanupResult = await demoDatabaseService.cleanup({
        olderThanMinutes: cleanupMinutes,
      });

      logger.info('Demo stopped', {
        runTimeSeconds: runTime,
        ordersCleanedUp: cleanupResult.deletedCount || 0,
      });

      res.json({
        success: true,
        message: 'Demo stopped successfully',
        data: {
          endTime: endTime.toISOString(),
          runTimeSeconds: runTime,
          finalStats: demoState.stats,
          cleanup: cleanupResult,
        },
      });
    } catch (error) {
      logger.error('Failed to stop demo', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to stop demo',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  })
);

/**
 * @swagger
 * /api/demo/status:
 *   get:
 *     summary: Get demo status
 *     description: Get the current status and statistics of the demo simulation
 *     tags: [Demo]
 *     responses:
 *       200:
 *         description: Demo status retrieved successfully
 */
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    try {
      const currentTime = new Date();
      const runTime = demoState.startTime ? (currentTime - demoState.startTime) / 1000 : 0;

      res.json({
        success: true,
        data: {
          isRunning: demoState.isRunning,
          startTime: demoState.startTime?.toISOString(),
          runTimeSeconds: runTime,
          ordersPerMinute: demoState.ordersPerMinute,
          duration: demoState.duration,
          stats: demoState.stats,
          remainingTime:
            demoState.isRunning && demoState.duration
              ? Math.max(0, demoState.duration - runTime)
              : 0,
        },
      });
    } catch (error) {
      logger.error('Failed to get demo status', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get demo status',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  })
);

/**
 * @swagger
 * /api/demo/reset:
 *   post:
 *     summary: Reset demo state
 *     description: Reset the demo state and statistics
 *     tags: [Demo]
 *     responses:
 *       200:
 *         description: Demo reset successfully
 */
router.post(
  '/reset',
  asyncHandler(async (req, res) => {
    try {
      // Stop demo if running
      if (demoState.isRunning && demoState.generator) {
        await demoState.generator.stop();
      }

      // Reset state
      demoState = {
        isRunning: false,
        generator: null,
        startTime: null,
        ordersPerMinute: 5,
        duration: 300,
        stats: {
          totalOrders: 0,
          completedOrders: 0,
          failedOrders: 0,
          activeDrivers: 0,
          busyDrivers: 0,
        },
      };

      logger.info('Demo reset');

      res.json({
        success: true,
        message: 'Demo reset successfully',
      });
    } catch (error) {
      logger.error('Failed to reset demo', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to reset demo',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  })
);

/**
 * @swagger
 * /api/demo/cleanup:
 *   post:
 *     summary: Clean up demo orders
 *     description: Delete demo orders from the database
 *     tags: [Demo]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               all:
 *                 type: boolean
 *                 default: false
 *                 description: Delete all demo orders
 *               olderThanMinutes:
 *                 type: integer
 *                 description: Delete orders older than N minutes
 *               keepLast:
 *                 type: integer
 *                 default: 1000
 *                 description: Keep last N orders (if all and olderThanMinutes not specified)
 *     responses:
 *       200:
 *         description: Cleanup completed successfully
 */
router.post(
  '/cleanup',
  asyncHandler(async (req, res) => {
    try {
      const { all = false, olderThanMinutes = null, keepLast = 1000 } = req.body;

      const result = await demoDatabaseService.cleanup({
        all,
        olderThanMinutes,
        keepLast,
      });

      res.json(result);
    } catch (error) {
      logger.error('Failed to cleanup demo orders', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup demo orders',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  })
);

/**
 * @swagger
 * /api/demo/order:
 *   post:
 *     summary: Create a demo order
 *     description: Manually create a demo order for testing
 *     tags: [Demo]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               serviceType:
 *                 type: string
 *                 enum: [BARQ, BULLET]
 *                 default: BARQ
 *     responses:
 *       200:
 *         description: Order created successfully
 *       400:
 *         description: Invalid service type
 *       409:
 *         description: Demo not running
 */
router.post(
  '/order',
  asyncHandler(async (req, res) => {
    try {
      const { serviceType = 'BARQ' } = req.body;

      if (!['BARQ', 'BULLET'].includes(serviceType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid service type',
          details: 'Service type must be BARQ or BULLET',
        });
      }

      if (!demoState.isRunning || !demoState.generator) {
        return res.status(409).json({
          success: false,
          error: 'Demo not running',
          details: 'Start the demo before creating orders',
        });
      }

      // Generate a random order via the demo generator
      const order = await demoState.generator.generateRandomOrder(serviceType);

      logger.info('Manual demo order created', { orderId: order.id, serviceType });

      res.json({
        success: true,
        message: 'Order created successfully',
        data: {
          order,
        },
      });
    } catch (error) {
      logger.error('Failed to create demo order', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to create order',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  })
);

module.exports = router;
