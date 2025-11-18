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
const barqProductionDB = require('../../services/barqfleet-production.service');
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

// ==================== PRODUCTION DATA ENDPOINTS ====================

/**
 * GET /api/v1/fleet-manager/production/dashboard
 * Get comprehensive dashboard with real production data
 */
router.get(
  '/production/dashboard',
  asyncHandler(async (req, res) => {
    logger.info('Fetching production dashboard data');

    // Fetch production data
    const [pendingOrders, availableCouriers, activeHubs, targetStatus] = await Promise.all([
      barqProductionDB.getPendingOrders(null, 100),
      barqProductionDB.getAvailableCouriers(null, 100),
      barqProductionDB.getHubs({ is_active: true, limit: 50 }),
      dynamicFleetManager.checkTargetAchievement(),
    ]);

    // Transform couriers to driver format
    const drivers = availableCouriers.map(courier => ({
      driver_id: courier.id,
      name: `${courier.first_name} ${courier.last_name}`,
      vehicle_type: courier.vehicle_type || 'CAR',
      capacity_kg: 500,
      is_online: courier.is_online,
      city_id: courier.city_id,
      hub_id: courier.hub_id,
    }));

    // Transform orders
    const orders = pendingOrders.map(order => {
      const destination = order.destination || {};
      return {
        order_id: order.id,
        tracking_no: order.tracking_no,
        customer_name: order.customer_details?.name || 'Unknown',
        delivery_lat: destination.latitude || 0,
        delivery_lng: destination.longitude || 0,
        load_kg: 10,
        created_at: order.created_at,
        sla_hours: 4,
        revenue: order.delivery_fee || 0,
        hub_id: order.hub_id,
        order_status: order.order_status,
      };
    });

    // Get at-risk orders
    const atRiskOrders = dynamicFleetManager.getAtRiskOrders(orders);

    res.json({
      success: true,
      data: {
        pending_orders: {
          total: orders.length,
          critical: atRiskOrders.filter(o => o.priority === 'CRITICAL').length,
          urgent: atRiskOrders.filter(o => o.priority === 'URGENT').length,
          normal: orders.length - atRiskOrders.length,
        },
        drivers: {
          total: drivers.length,
          online: drivers.filter(d => d.is_online).length,
        },
        hubs: {
          total: activeHubs.length,
        },
        target_achievement: targetStatus,
        at_risk_orders: atRiskOrders.slice(0, 10), // Top 10 most urgent
        timestamp: new Date(),
      },
    });

    logger.info('Production dashboard data fetched successfully', {
      orders: orders.length,
      drivers: drivers.length,
      hubs: activeHubs.length,
      at_risk: atRiskOrders.length,
    });
  })
);

/**
 * POST /api/v1/fleet-manager/production/assign
 * Automatically fetch production data and assign orders to drivers
 */
router.post(
  '/production/assign',
  optimizationLimiter,
  asyncHandler(async (req, res) => {
    const { hub_id, city_id, limit } = req.body;

    logger.info('Fetching production data for assignment', { hub_id, city_id });

    // Fetch production data
    const [pendingOrders, availableCouriers, hubs] = await Promise.all([
      barqProductionDB.getPendingOrders(hub_id, limit || 100),
      barqProductionDB.getAvailableCouriers(city_id, limit || 100),
      barqProductionDB.getHubs({ is_active: true }),
    ]);

    logger.info('Production data fetched', {
      orders: pendingOrders.length,
      couriers: availableCouriers.length,
      hubs: hubs.length,
    });

    if (pendingOrders.length === 0) {
      return res.json({
        success: true,
        message: 'No pending orders found',
        assignments: [],
        routes: [],
      });
    }

    if (availableCouriers.length === 0) {
      return res.json({
        success: false,
        error: 'No available couriers found',
        pending_orders: pendingOrders.length,
      });
    }

    // Transform couriers to driver format
    const drivers = availableCouriers.map(courier => ({
      driver_id: courier.id,
      name: `${courier.first_name} ${courier.last_name}`,
      vehicle_type: courier.vehicle_type || 'CAR',
      capacity_kg: 500,
      city_id: courier.city_id,
      hub_id: courier.hub_id,
    }));

    // Transform orders
    const orders = pendingOrders.map(order => {
      const destination = order.destination || {};
      return {
        order_id: order.id,
        tracking_no: order.tracking_no,
        customer_name: order.customer_details?.name || 'Unknown',
        delivery_lat: destination.latitude || 0,
        delivery_lng: destination.longitude || 0,
        load_kg: 10,
        created_at: order.created_at,
        sla_hours: 4,
        revenue: order.delivery_fee || 0,
        pickup_id: order.hub_id,
      };
    });

    // Transform hubs to pickup points
    const pickupPoints = hubs.map(hub => ({
      id: hub.id,
      pickup_id: hub.id,
      lat: hub.latitude,
      lng: hub.longitude,
      code: hub.code,
      manager: hub.manager,
    }));

    // Call fleet manager to assign orders
    logger.info('Calling dynamic assignment', {
      orders: orders.length,
      drivers: drivers.length,
      pickupPoints: pickupPoints.length,
    });

    const result = await dynamicFleetManager.assignOrdersDynamic(
      orders,
      drivers,
      pickupPoints
    );

    res.json(result);
  })
);

/**
 * GET /api/v1/fleet-manager/production/at-risk
 * Get orders from production that are at risk of SLA violation
 */
router.get(
  '/production/at-risk',
  asyncHandler(async (req, res) => {
    const { hub_id, limit } = req.query;

    logger.info('Fetching production at-risk orders', { hub_id });

    // Fetch pending orders from production
    const pendingOrders = await barqProductionDB.getPendingOrders(
      hub_id ? parseInt(hub_id) : null,
      limit ? parseInt(limit) : 100
    );

    // Transform orders
    const orders = pendingOrders.map(order => {
      const destination = order.destination || {};
      return {
        order_id: order.id,
        tracking_no: order.tracking_no,
        customer_name: order.customer_details?.name || 'Unknown',
        delivery_lat: destination.latitude || 0,
        delivery_lng: destination.longitude || 0,
        created_at: order.created_at,
        sla_hours: 4,
        revenue: order.delivery_fee || 0,
      };
    });

    // Get at-risk orders
    const atRiskOrders = dynamicFleetManager.getAtRiskOrders(orders);

    res.json({
      success: true,
      total_pending: orders.length,
      at_risk_count: atRiskOrders.length,
      at_risk_orders: atRiskOrders,
      breakdown: {
        critical: atRiskOrders.filter(o => o.priority === 'CRITICAL').length,
        urgent: atRiskOrders.filter(o => o.priority === 'URGENT').length,
      },
    });

    logger.info('At-risk orders fetched', {
      total_pending: orders.length,
      at_risk: atRiskOrders.length,
    });
  })
);

/**
 * POST /api/v1/fleet-manager/production/set-targets
 * Set driver targets based on production couriers
 */
router.post(
  '/production/set-targets',
  standardLimiter,
  asyncHandler(async (req, res) => {
    const { city_id, target_deliveries, target_revenue } = req.body;

    logger.info('Setting targets for production couriers', { city_id });

    // Fetch available couriers from production
    const couriers = await barqProductionDB.getAvailableCouriers(
      city_id ? parseInt(city_id) : null,
      500
    );

    // Transform to driver targets format
    const drivers = couriers.map(courier => ({
      driver_id: courier.id,
      target_deliveries: target_deliveries || 20,
      target_revenue: target_revenue || 5000,
    }));

    logger.info('Setting targets', { driver_count: drivers.length });

    const result = await dynamicFleetManager.setDriverTargets(drivers);

    res.json({
      success: result.success,
      couriers_configured: result.drivers_configured,
      target_deliveries: target_deliveries || 20,
      target_revenue: target_revenue || 5000,
    });
  })
);

module.exports = router;
