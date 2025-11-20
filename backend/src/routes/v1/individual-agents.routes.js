/**
 * Individual Agent-Specific Routes
 * Specialized endpoints for specific agent types
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize, ROLES } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validation.middleware');
const { logger } = require('../../utils/logger');
const {
  asyncHandler,
  ValidationError,
  NotFoundError,
  ServiceUnavailableError,
} = require('../../middleware/error.middleware');

// Get agent services
const AgentInitializer = require('../../services/agent-initializer');

// ================================
// SLA MONITOR AGENT ENDPOINTS
// ================================

/**
 * @swagger
 * /api/agents/sla-monitor/dashboard:
 *   get:
 *     summary: Get SLA monitoring dashboard data
 *     description: Retrieve comprehensive SLA monitoring dashboard information
 *     tags: [SLA Monitor]
 *     responses:
 *       200:
 *         description: SLA dashboard data retrieved successfully
 */
router.get(
  '/sla-monitor/dashboard',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const instance = AgentInitializer.getInstance();
    const slaAgent = instance.agents.slaMonitor;

    if (!slaAgent) {
      throw new ServiceUnavailableError('SLA Monitor agent not available');
    }

    const dashboardData = await slaAgent.execute({
      type: 'DASHBOARD',
      includeDetails: true,
      timeRange: '24h',
    });

    res.json({
      success: true,
      data: dashboardData,
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/sla-monitor/alerts:
 *   get:
 *     summary: Get SLA alerts
 *     description: Retrieve active and recent SLA alerts
 *     tags: [SLA Monitor]
 *     parameters:
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [critical, high, medium, low]
 *         description: Filter by alert severity
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, resolved, acknowledged]
 *         description: Filter by alert status
 *     responses:
 *       200:
 *         description: SLA alerts retrieved successfully
 */
router.get(
  '/sla-monitor/alerts',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { severity, status } = req.query;
    const instance = AgentInitializer.getInstance();
    const slaAgent = instance.agents.slaMonitor;

    if (!slaAgent) {
      throw new ServiceUnavailableError('SLA Monitor agent not available');
    }

    const alerts = await slaAgent.execute({
      type: 'GET_ALERTS',
      filters: { severity, status },
    });

    res.json({
      success: true,
      data: alerts,
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/sla-monitor/thresholds:
 *   get:
 *     summary: Get SLA thresholds
 *     description: Retrieve current SLA threshold configurations
 *     tags: [SLA Monitor]
 *   put:
 *     summary: Update SLA thresholds
 *     description: Update SLA threshold configurations
 *     tags: [SLA Monitor]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               barq:
 *                 type: object
 *                 properties:
 *                   warning: { type: number, minimum: 1 }
 *                   critical: { type: number, minimum: 1 }
 *               bullet:
 *                 type: object
 *                 properties:
 *                   warning: { type: number, minimum: 1 }
 *                   critical: { type: number, minimum: 1 }
 */
router.get('/sla-monitor/thresholds', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), 
  asyncHandler(async (req, res) => {
    const instance = AgentInitializer.getInstance();
    const slaAgent = instance.agents.slaMonitor;

    if (!slaAgent) {
      throw new ServiceUnavailableError('SLA Monitor agent not available');
    }

    const thresholds = await slaAgent.execute({
      type: 'GET_THRESHOLDS',
    });

    res.json({
      success: true,
      data: thresholds,
      timestamp: Date.now(),
    });
  })
);

router.put('/sla-monitor/thresholds', authenticate, authorize(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const thresholds = req.body;
    const instance = AgentInitializer.getInstance();
    const slaAgent = instance.agents.slaMonitor;

    if (!slaAgent) {
      throw new ServiceUnavailableError('SLA Monitor agent not available');
    }

    const result = await slaAgent.execute({
      type: 'UPDATE_THRESHOLDS',
      thresholds,
    });

    res.json({
      success: true,
      data: result,
      message: 'SLA thresholds updated successfully',
      timestamp: Date.now(),
    });
  })
);

// ================================
// ORDER ASSIGNMENT AGENT ENDPOINTS
// ================================

/**
 * @swagger
 * /api/agents/order-assignment/assign:
 *   post:
 *     summary: Assign order using AI optimization
 *     description: Use the order assignment agent to assign an order to the best driver
 *     tags: [Order Assignment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - order
 *             properties:
 *               order:
 *                 type: object
 *               preferences:
 *                 type: object
 *               constraints:
 *                 type: object
 */
router.post(
  '/order-assignment/assign',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate('orderAssignment'),
  asyncHandler(async (req, res) => {
    const { order, preferences = {}, constraints = {} } = req.body;
    const instance = AgentInitializer.getInstance();
    const assignmentAgent = instance.agents.orderAssignment;

    if (!assignmentAgent) {
      throw new ServiceUnavailableError('Order Assignment agent not available');
    }

    const result = await assignmentAgent.execute({
      order,
      preferences,
      constraints,
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/order-assignment/batch-assign:
 *   post:
 *     summary: Batch assign multiple orders
 *     description: Assign multiple orders optimally using batch processing
 *     tags: [Order Assignment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orders
 *             properties:
 *               orders:
 *                 type: array
 *                 items:
 *                   type: object
 *               strategy:
 *                 type: string
 *                 enum: [optimal, fair, speed]
 */
router.post(
  '/order-assignment/batch-assign',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  asyncHandler(async (req, res) => {
    const { orders, strategy = 'optimal' } = req.body;
    const instance = AgentInitializer.getInstance();
    const assignmentAgent = instance.agents.orderAssignment;

    if (!assignmentAgent) {
      throw new ServiceUnavailableError('Order Assignment agent not available');
    }

    if (!Array.isArray(orders) || orders.length === 0) {
      throw new ValidationError('Orders array is required and must not be empty');
    }

    const result = await assignmentAgent.execute({
      type: 'BATCH_ASSIGN',
      orders,
      strategy,
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/order-assignment/performance:
 *   get:
 *     summary: Get assignment performance metrics
 *     description: Retrieve order assignment performance analytics
 *     tags: [Order Assignment]
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [1h, 6h, 24h, 7d, 30d]
 *         description: Time range for metrics
 */
router.get(
  '/order-assignment/performance',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { timeRange = '24h' } = req.query;
    const instance = AgentInitializer.getInstance();
    const assignmentAgent = instance.agents.orderAssignment;

    if (!assignmentAgent) {
      throw new ServiceUnavailableError('Order Assignment agent not available');
    }

    const metrics = await assignmentAgent.execute({
      type: 'GET_PERFORMANCE_METRICS',
      timeRange,
    });

    res.json({
      success: true,
      data: metrics,
      timestamp: Date.now(),
    });
  })
);

// ================================
// TRAFFIC PATTERN AGENT ENDPOINTS
// ================================

/**
 * @swagger
 * /api/agents/traffic-pattern/insights:
 *   get:
 *     summary: Get traffic pattern insights
 *     description: Retrieve current traffic patterns and predictions
 *     tags: [Traffic Patterns]
 *     parameters:
 *       - in: query
 *         name: area
 *         schema:
 *           type: string
 *         description: Geographic area to analyze
 *       - in: query
 *         name: forecast
 *         schema:
 *           type: boolean
 *         description: Include traffic forecasts
 */
router.get(
  '/traffic-pattern/insights',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.DISPATCHER),
  asyncHandler(async (req, res) => {
    const { area, forecast = false } = req.query;
    const instance = AgentInitializer.getInstance();
    const trafficAgent = instance.agents.trafficPattern;

    if (!trafficAgent) {
      throw new ServiceUnavailableError('Traffic Pattern agent not available');
    }

    const insights = await trafficAgent.execute({
      type: 'GET_INSIGHTS',
      area,
      includeForecast: forecast === 'true',
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      data: insights,
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/traffic-pattern/hotspots:
 *   get:
 *     summary: Get traffic hotspots
 *     description: Retrieve current traffic hotspots and congestion areas
 *     tags: [Traffic Patterns]
 */
router.get(
  '/traffic-pattern/hotspots',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.DISPATCHER),
  asyncHandler(async (req, res) => {
    const instance = AgentInitializer.getInstance();
    const trafficAgent = instance.agents.trafficPattern;

    if (!trafficAgent) {
      throw new ServiceUnavailableError('Traffic Pattern agent not available');
    }

    const hotspots = await trafficAgent.execute({
      type: 'GET_HOTSPOTS',
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      data: hotspots,
      timestamp: Date.now(),
    });
  })
);

// ================================
// FLEET STATUS AGENT ENDPOINTS
// ================================

/**
 * @swagger
 * /api/agents/fleet-status/summary:
 *   get:
 *     summary: Get fleet status summary
 *     description: Retrieve comprehensive fleet status summary
 *     tags: [Fleet Status]
 */
router.get(
  '/fleet-status/summary',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.DISPATCHER),
  asyncHandler(async (req, res) => {
    const instance = AgentInitializer.getInstance();
    const fleetAgent = instance.agents.fleetStatus;

    if (!fleetAgent) {
      throw new ServiceUnavailableError('Fleet Status agent not available');
    }

    const summary = await fleetAgent.execute({
      type: 'GET_SUMMARY',
      includeDriverDetails: true,
      includeVehicleDetails: true,
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      data: summary,
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/fleet-status/availability:
 *   get:
 *     summary: Get driver availability
 *     description: Get real-time driver availability by area or service type
 *     tags: [Fleet Status]
 *     parameters:
 *       - in: query
 *         name: serviceType
 *         schema:
 *           type: string
 *           enum: [BARQ, BULLET]
 *         description: Filter by service type
 *       - in: query
 *         name: area
 *         schema:
 *           type: string
 *         description: Geographic area
 */
router.get(
  '/fleet-status/availability',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.DISPATCHER),
  asyncHandler(async (req, res) => {
    const { serviceType, area } = req.query;
    const instance = AgentInitializer.getInstance();
    const fleetAgent = instance.agents.fleetStatus;

    if (!fleetAgent) {
      throw new ServiceUnavailableError('Fleet Status agent not available');
    }

    const availability = await fleetAgent.execute({
      type: 'GET_AVAILABILITY',
      filters: { serviceType, area },
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      data: availability,
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/fleet-status/utilization:
 *   get:
 *     summary: Get fleet utilization metrics
 *     description: Retrieve fleet utilization and efficiency metrics
 *     tags: [Fleet Status]
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [1h, 6h, 24h, 7d, 30d]
 *         description: Time range for metrics
 */
router.get(
  '/fleet-status/utilization',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { timeRange = '24h' } = req.query;
    const instance = AgentInitializer.getInstance();
    const fleetAgent = instance.agents.fleetStatus;

    if (!fleetAgent) {
      throw new ServiceUnavailableError('Fleet Status agent not available');
    }

    const utilization = await fleetAgent.execute({
      type: 'GET_UTILIZATION',
      timeRange,
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      data: utilization,
      timestamp: Date.now(),
    });
  })
);

// ================================
// PERFORMANCE ANALYTICS AGENT ENDPOINTS
// ================================

/**
 * @swagger
 * /api/agents/performance-analytics/kpis:
 *   get:
 *     summary: Get key performance indicators
 *     description: Retrieve comprehensive KPI dashboard
 *     tags: [Performance Analytics]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month, quarter]
 *         description: Reporting period
 */
router.get(
  '/performance-analytics/kpis',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { period = 'today' } = req.query;
    const instance = AgentInitializer.getInstance();
    const analyticsAgent = instance.agents.performanceAnalytics;

    if (!analyticsAgent) {
      throw new ServiceUnavailableError('Performance Analytics agent not available');
    }

    const kpis = await analyticsAgent.execute({
      type: 'GET_KPIS',
      period,
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      data: kpis,
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/performance-analytics/trends:
 *   get:
 *     summary: Get performance trends
 *     description: Retrieve performance trends and predictions
 *     tags: [Performance Analytics]
 *     parameters:
 *       - in: query
 *         name: metric
 *         schema:
 *           type: string
 *           enum: [delivery_time, success_rate, customer_satisfaction, driver_efficiency]
 *         description: Specific metric to analyze
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *         description: Time range for trend analysis
 */
router.get(
  '/performance-analytics/trends',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { metric, timeRange = '30d' } = req.query;
    const instance = AgentInitializer.getInstance();
    const analyticsAgent = instance.agents.performanceAnalytics;

    if (!analyticsAgent) {
      throw new ServiceUnavailableError('Performance Analytics agent not available');
    }

    const trends = await analyticsAgent.execute({
      type: 'GET_TRENDS',
      metric,
      timeRange,
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      data: trends,
      timestamp: Date.now(),
    });
  })
);

// ================================
// DEMAND FORECASTING AGENT ENDPOINTS
// ================================

/**
 * @swagger
 * /api/agents/demand-forecasting/predictions:
 *   get:
 *     summary: Get demand predictions
 *     description: Retrieve demand forecasts for different time horizons
 *     tags: [Demand Forecasting]
 *     parameters:
 *       - in: query
 *         name: horizon
 *         schema:
 *           type: string
 *           enum: [1h, 6h, 24h, 7d]
 *         description: Forecast horizon
 *       - in: query
 *         name: area
 *         schema:
 *           type: string
 *         description: Geographic area
 */
router.get(
  '/demand-forecasting/predictions',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { horizon = '24h', area } = req.query;
    const instance = AgentInitializer.getInstance();
    const forecastAgent = instance.agents.demandForecasting;

    if (!forecastAgent) {
      throw new ServiceUnavailableError('Demand Forecasting agent not available');
    }

    const predictions = await forecastAgent.execute({
      type: 'GET_PREDICTIONS',
      horizon,
      area,
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      data: predictions,
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/demand-forecasting/capacity-planning:
 *   get:
 *     summary: Get capacity planning recommendations
 *     description: Get AI-powered capacity planning recommendations
 *     tags: [Demand Forecasting]
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [shift, day, week, month]
 *         description: Planning timeframe
 */
router.get(
  '/demand-forecasting/capacity-planning',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { timeframe = 'day' } = req.query;
    const instance = AgentInitializer.getInstance();
    const forecastAgent = instance.agents.demandForecasting;

    if (!forecastAgent) {
      throw new ServiceUnavailableError('Demand Forecasting agent not available');
    }

    const recommendations = await forecastAgent.execute({
      type: 'CAPACITY_PLANNING',
      timeframe,
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      data: recommendations,
      timestamp: Date.now(),
    });
  })
);

module.exports = router;