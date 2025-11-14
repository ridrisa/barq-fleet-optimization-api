/**
 * Dynamic Fleet Manager API Routes
 *
 * Endpoints for managing driver targets and SLA-based order assignment
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../middleware/error.middleware');
const dynamicFleetManager = require('../../services/dynamic-fleet-manager.service');
const llmFleetAdvisor = require('../../services/llm-fleet-advisor.service');
const { logger } = require('../../utils/logger');
const { standardLimiter, aiLimiter, optimizationLimiter } = require('../../middleware/rate-limit.middleware');

/**
 * POST /api/v1/fleet-manager/targets/set
 * Set daily targets for drivers
 */
router.post(
  '/targets/set',
  standardLimiter, // Rate limit standard endpoints (100 req/15min)
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
  optimizationLimiter, // Rate limit optimization endpoints (30 req/15min)
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
  optimizationLimiter, // Rate limit optimization endpoints (30 req/15min)
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

// ==================== LLM-POWERED ENDPOINTS ====================

/**
 * POST /api/v1/fleet-manager/ai/suggest-driver
 * Get AI-powered driver assignment recommendation
 */
router.post(
  '/ai/suggest-driver',
  aiLimiter, // Rate limit AI endpoints (20 req/15min)
  asyncHandler(async (req, res) => {
    const { order, availableDrivers } = req.body;

    if (!order || !order.order_id) {
      return res.status(400).json({
        success: false,
        error: 'order object with order_id is required',
      });
    }

    if (!availableDrivers || !Array.isArray(availableDrivers)) {
      return res.status(400).json({
        success: false,
        error: 'availableDrivers array is required',
      });
    }

    logger.info('AI driver suggestion request', {
      order_id: order.order_id,
      num_drivers: availableDrivers.length,
    });

    const targetStatus = dynamicFleetManager.checkTargetAchievement();
    const suggestion = await llmFleetAdvisor.suggestDriverAssignment(
      order,
      availableDrivers,
      targetStatus
    );

    res.json(suggestion);
  })
);

/**
 * POST /api/v1/fleet-manager/ai/predict-sla
 * Get AI-powered SLA violation predictions
 */
router.post(
  '/ai/predict-sla',
  aiLimiter, // Rate limit AI endpoints (20 req/15min)
  asyncHandler(async (req, res) => {
    const { orders, drivers, currentRoutes } = req.body;

    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({
        success: false,
        error: 'orders array is required',
      });
    }

    logger.info('AI SLA prediction request', {
      num_orders: orders.length,
      num_drivers: drivers?.length || 0,
    });

    const prediction = await llmFleetAdvisor.predictSLAViolations(
      orders,
      drivers || [],
      currentRoutes || {}
    );

    res.json(prediction);
  })
);

/**
 * POST /api/v1/fleet-manager/ai/query
 * Natural language query about fleet status
 */
router.post(
  '/ai/query',
  aiLimiter, // Rate limit AI endpoints (20 req/15min)
  asyncHandler(async (req, res) => {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'query string is required',
      });
    }

    logger.info('AI natural language query', {
      query: query.substring(0, 100),
    });

    // Gather fleet data for context
    const targetStatus = dynamicFleetManager.checkTargetAchievement();
    const fleetData = {
      targetStatus: targetStatus,
      // Add more context as needed
    };

    const response = await llmFleetAdvisor.queryFleetStatus(query, fleetData);

    res.json(response);
  })
);

/**
 * POST /api/v1/fleet-manager/ai/recommendations
 * Get AI-powered optimization recommendations
 */
router.post(
  '/ai/recommendations',
  aiLimiter, // Rate limit AI endpoints (20 req/15min)
  asyncHandler(async (req, res) => {
    const { fleetMetrics } = req.body;

    logger.info('AI optimization recommendations request');

    // If no metrics provided, use current fleet status
    const metrics = fleetMetrics || {
      targetStatus: dynamicFleetManager.checkTargetAchievement(),
      timestamp: new Date(),
    };

    const recommendations = await llmFleetAdvisor.getOptimizationRecommendations(metrics);

    res.json(recommendations);
  })
);

/**
 * GET /api/v1/fleet-manager/ai/status
 * Get LLM advisor service status
 */
router.get(
  '/ai/status',
  asyncHandler(async (req, res) => {
    const status = llmFleetAdvisor.getStatus();

    res.json({
      success: true,
      llm_advisor: status,
    });
  })
);

module.exports = router;
