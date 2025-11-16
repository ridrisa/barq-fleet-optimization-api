/**
 * Driver State Management API Routes
 * Exposes real-time driver tracking and state management
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../utils/error.handler');
const { logger } = require('../../utils/logger');
const driverStateService = require('../../services/driver-state.service');
const DriverModel = require('../../models/driver.model');

/**
 * @swagger
 * /api/v1/drivers/available:
 *   get:
 *     summary: Get available drivers
 *     description: Retrieve all drivers currently available for assignment
 *     tags: [Drivers]
 *     parameters:
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Pickup latitude (optional, defaults to Riyadh center)
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         description: Pickup longitude (optional, defaults to Riyadh center)
 *       - in: query
 *         name: serviceType
 *         schema:
 *           type: string
 *         description: Service type filter (BARQ/BULLET)
 *     responses:
 *       200:
 *         description: Available drivers retrieved successfully
 */
router.get(
  '/available',
  asyncHandler(async (req, res) => {
    const lat = parseFloat(req.query.lat) || 24.7136; // Riyadh center
    const lng = parseFloat(req.query.lng) || 46.6753;
    const serviceType = req.query.serviceType;

    logger.info('Getting available drivers', { lat, lng, serviceType });

    const availableDrivers = await driverStateService.getAvailableDrivers(
      { lat, lng },
      { serviceType }
    );

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

    try {
      const state = await driverStateService.checkAvailability(driverId);

      res.json({
        success: true,
        data: state,
      });
    } catch (error) {
      if (error.message && error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Driver not found',
        });
      }
      throw error;
    }
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
    let { state, reason, location } = req.body;

    // Normalize state to uppercase for comparison
    const normalizedState = state ? state.toUpperCase().replace(/-/g, '_') : null;

    logger.info('Updating driver state', { driverId, state: normalizedState, reason });

    let result;

    // Route to appropriate state service method
    switch (normalizedState) {
      case 'AVAILABLE':
        result = await driverStateService.startShift(driverId, location || { lat: 24.7136, lng: 46.6753 });
        break;
      case 'ON_BREAK':
        result = await driverStateService.startBreak(driverId);
        break;
      case 'OFFLINE':
        result = await driverStateService.endShift(driverId);
        break;
      default:
        // Use DriverModel directly for other state transitions
        result = await DriverModel.updateState(driverId, normalizedState, {
          reason: reason || 'Manual state update',
          triggeredBy: 'api',
        });
    }

    res.json({
      success: true,
      data: result,
      message: `Driver state updated to ${normalizedState}`,
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
    const period = req.query.period || '30 days';

    logger.info('Getting driver performance', { driverId, period });

    const performance = await driverStateService.getDriverPerformance(driverId, period);

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

    const fleetStatus = await driverStateService.getFleetStatus();

    // Transform to simple summary format
    const summary = {
      total: fleetStatus.total || 0,
      available: fleetStatus.by_state?.AVAILABLE?.count || 0,
      busy: fleetStatus.by_state?.BUSY?.count || 0,
      on_break: fleetStatus.by_state?.ON_BREAK?.count || 0,
      offline: fleetStatus.by_state?.OFFLINE?.count || 0,
      returning: fleetStatus.by_state?.RETURNING?.count || 0,
      utilization_rate: fleetStatus.metrics?.utilization_rate || 0,
      available_capacity: fleetStatus.metrics?.available_capacity || 0,
    };

    res.json({
      success: true,
      data: summary,
    });
  })
);

module.exports = router;
