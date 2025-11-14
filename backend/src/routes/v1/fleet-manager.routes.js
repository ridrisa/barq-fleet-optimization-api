/**
 * Dynamic Fleet Manager API Routes
 *
 * Endpoints for managing driver targets and SLA-based order assignment
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../middleware/error.middleware');
const dynamicFleetManager = require('../../services/dynamic-fleet-manager.service');
const { logger } = require('../../utils/logger');

/**
 * POST /api/v1/fleet-manager/targets/set
 * Set daily targets for drivers
 */
router.post(
  '/targets/set',
  asyncHandler(async (req, res) => {
    const { drivers } = req.body;

    if (!drivers || !Array.isArray(drivers)) {
      return res.status(400).json({
        success: false,
        error: 'drivers array is required',
      });
    }

    const result = dynamicFleetManager.setDriverTargets(drivers);

    res.json(result);
  })
);

/**
 * GET /api/v1/fleet-manager/targets/status
 * Get current target achievement status for all drivers
 */
router.get(
  '/targets/status',
  asyncHandler(async (req, res) => {
    const status = dynamicFleetManager.checkTargetAchievement();
    res.json(status);
  })
);

/**
 * POST /api/v1/fleet-manager/targets/reset
 * Reset daily targets (new day)
 */
router.post(
  '/targets/reset',
  asyncHandler(async (req, res) => {
    const result = dynamicFleetManager.resetDailyTargets();
    res.json(result);
  })
);

/**
 * POST /api/v1/fleet-manager/assign
 * Dynamically assign orders to drivers based on targets and SLA
 */
router.post(
  '/assign',
  asyncHandler(async (req, res) => {
    const { orders, drivers, pickupPoints } = req.body;

    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({
        success: false,
        error: 'orders array is required',
      });
    }

    if (!drivers || !Array.isArray(drivers)) {
      return res.status(400).json({
        success: false,
        error: 'drivers array is required',
      });
    }

    logger.info('Dynamic assignment request', {
      orders: orders.length,
      drivers: drivers.length,
    });

    const result = await dynamicFleetManager.assignOrdersDynamic(
      orders,
      drivers,
      pickupPoints || []
    );

    res.json(result);
  })
);

/**
 * POST /api/v1/fleet-manager/reoptimize
 * Reoptimize routes with new orders
 */
router.post(
  '/reoptimize',
  asyncHandler(async (req, res) => {
    const { currentRoutes, newOrders, drivers, pickupPoints } = req.body;

    if (!currentRoutes || !Array.isArray(currentRoutes)) {
      return res.status(400).json({
        success: false,
        error: 'currentRoutes array is required',
      });
    }

    if (!newOrders || !Array.isArray(newOrders)) {
      return res.status(400).json({
        success: false,
        error: 'newOrders array is required',
      });
    }

    logger.info('Reoptimization request', {
      current_routes: currentRoutes.length,
      new_orders: newOrders.length,
    });

    const result = await dynamicFleetManager.reoptimize(
      currentRoutes,
      newOrders,
      drivers || [],
      pickupPoints || []
    );

    res.json(result);
  })
);

/**
 * GET /api/v1/fleet-manager/at-risk
 * Get orders at risk of SLA violation
 */
router.post(
  '/at-risk',
  asyncHandler(async (req, res) => {
    const { orders } = req.body;

    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({
        success: false,
        error: 'orders array is required',
      });
    }

    const atRisk = dynamicFleetManager.getAtRiskOrders(orders);

    res.json({
      success: true,
      at_risk_count: atRisk.length,
      orders: atRisk,
    });
  })
);

/**
 * PUT /api/v1/fleet-manager/driver/:driverId/status
 * Update driver status
 */
router.put(
  '/driver/:driverId/status',
  asyncHandler(async (req, res) => {
    const { driverId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'status is required (available, busy, break, offline)',
      });
    }

    const result = dynamicFleetManager.updateDriverStatus(driverId, status);
    res.json(result);
  })
);

/**
 * GET /api/v1/fleet-manager/dashboard
 * Get comprehensive dashboard data
 */
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const targetStatus = dynamicFleetManager.checkTargetAchievement();

    res.json({
      success: true,
      data: {
        target_achievement: targetStatus,
        timestamp: new Date(),
      },
    });
  })
);

module.exports = router;
