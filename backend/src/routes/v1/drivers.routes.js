/**
 * Driver State Management API Routes
 * Exposes real-time driver tracking and state management
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../utils/error.handler');
const { logger } = require('../../utils/logger');
const driverStateService = require('../../services/driver-state.service');

/**
 * @swagger
 * /api/v1/drivers/available:
 *   get:
 *     summary: Get available drivers
 *     description: Retrieve all drivers currently available for assignment
 *     tags: [Drivers]
 *     responses:
 *       200:
 *         description: Available drivers retrieved successfully
 */
router.get(
  '/available',
  asyncHandler(async (req, res) => {
    logger.info('Getting available drivers');

    const availableDrivers = driverStateService.getAvailableDrivers();

    res.json({
      success: true,
      data: {
        count: availableDrivers.length,
        drivers: availableDrivers,
      },
    });
  })
);

/**
 * @swagger
 * /api/v1/drivers/{driverId}/state:
 *   get:
 *     summary: Get driver state
 *     description: Get current state of a specific driver
 *     tags: [Drivers]
 *     parameters:
 *       - in: path
 *         name: driverId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Driver state retrieved successfully
 *       404:
 *         description: Driver not found
 */
router.get(
  '/:driverId/state',
  asyncHandler(async (req, res) => {
    const { driverId } = req.params;

    logger.info('Getting driver state', { driverId });

    const state = driverStateService.getDriverState(driverId);

    if (!state) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found',
      });
    }

    res.json({
      success: true,
      data: state,
    });
  })
);

/**
 * @swagger
 * /api/v1/drivers/{driverId}/state:
 *   put:
 *     summary: Update driver state
 *     description: Update the state of a driver (available, busy, on_break, offline)
 *     tags: [Drivers]
 *     parameters:
 *       - in: path
 *         name: driverId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               state:
 *                 type: string
 *                 enum: [available, busy, on_break, offline]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Driver state updated successfully
 */
router.put(
  '/:driverId/state',
  asyncHandler(async (req, res) => {
    const { driverId } = req.params;
    const { state, reason } = req.body;

    logger.info('Updating driver state', { driverId, state, reason });

    const result = driverStateService.updateDriverState(driverId, state, reason);

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * @swagger
 * /api/v1/drivers/{driverId}/performance:
 *   get:
 *     summary: Get driver performance metrics
 *     description: Retrieve performance metrics for a specific driver
 *     tags: [Drivers]
 *     parameters:
 *       - in: path
 *         name: driverId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Driver performance retrieved successfully
 */
router.get(
  '/:driverId/performance',
  asyncHandler(async (req, res) => {
    const { driverId } = req.params;

    logger.info('Getting driver performance', { driverId });

    const performance = driverStateService.getDriverPerformance(driverId);

    res.json({
      success: true,
      data: performance,
    });
  })
);

/**
 * @swagger
 * /api/v1/drivers/summary:
 *   get:
 *     summary: Get fleet summary
 *     description: Get summary of all drivers and their states
 *     tags: [Drivers]
 *     responses:
 *       200:
 *         description: Fleet summary retrieved successfully
 */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    logger.info('Getting fleet summary');

    const summary = {
      available: driverStateService.getAvailableDrivers().length,
      busy: driverStateService.drivers.filter((d) => d.state === 'busy').length,
      on_break: driverStateService.drivers.filter((d) => d.state === 'on_break').length,
      offline: driverStateService.drivers.filter((d) => d.state === 'offline').length,
      total: driverStateService.drivers.length,
    };

    res.json({
      success: true,
      data: summary,
    });
  })
);

module.exports = router;
