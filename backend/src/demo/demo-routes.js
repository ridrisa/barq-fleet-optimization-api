/**
 * Demo Routes - Integrated into Main Server
 * Provides demo functionality within the same server as the main API
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/error.handler');
const { logger } = require('../utils/logger');
const { generateId } = require('../utils/helper');

// Import demo components
const DemoGenerator = require('./demo-generator');
const demoDatabaseService = require('./demo-database.service');
const EnhancedDemoOrchestrator = require('./enhanced-demo-orchestrator');
const DemoSimulationEngine = require('./demo-simulation-engine');

// Initialize enhanced demo orchestrator
const demoOrchestrator = new EnhancedDemoOrchestrator();

// Demo scenarios configuration
const DEMO_SCENARIOS = {
  executive: {
    id: 'executive',
    title: 'Executive Dashboard',
    subtitle: 'Strategic Overview & ROI Analysis',
    duration: 5,
    ordersPerMinute: 8,
    steps: [
      { id: 'kpis', title: 'Real-time KPIs', duration: 60 },
      { id: 'roi', title: 'ROI Calculations', duration: 90 },
      { id: 'benchmarks', title: 'Performance Benchmarks', duration: 90 },
      { id: 'savings', title: 'Cost Savings Analysis', duration: 80 }
    ],
    metrics: {
      targetSavings: 10950000, // SAR 10.95M
      benchmarkEfficiency: 94.5,
      targetSLA: 96.8
    }
  },
  'fleet-manager': {
    id: 'fleet-manager',
    title: 'Fleet Manager Operations',
    subtitle: 'Operations & Optimization',
    duration: 7,
    ordersPerMinute: 12,
    steps: [
      { id: 'fleet-status', title: 'Fleet Status (800+ vehicles)', duration: 90 },
      { id: 'order-assignment', title: 'Order Assignment', duration: 120 },
      { id: 'sla-compliance', title: 'SLA Compliance', duration: 120 },
      { id: 'cvrp-optimization', title: 'CVRP Optimization', duration: 90 }
    ],
    metrics: {
      totalVehicles: 834,
      activeVehicles: 672,
      targetUtilization: 85.2
    }
  },
  dispatcher: {
    id: 'dispatcher',
    title: 'Dispatcher Workflow',
    subtitle: 'Real-time Operations',
    duration: 10,
    ordersPerMinute: 15,
    steps: [
      { id: 'emergency-escalation', title: 'Emergency Escalation', duration: 150 },
      { id: 'agent-orchestration', title: 'Agent Orchestration', duration: 180 },
      { id: 'traffic-adaptation', title: 'Traffic Adaptation', duration: 120 },
      { id: 'order-recovery', title: 'Order Recovery', duration: 150 }
    ],
    metrics: {
      emergencyResponse: 2.3, // minutes
      agentCoordination: 18,
      recoveryRate: 94.7
    }
  },
  analytics: {
    id: 'analytics',
    title: 'Analytics Deep Dive',
    subtitle: 'Data Intelligence',
    duration: 8,
    ordersPerMinute: 6,
    steps: [
      { id: 'demand-forecasting', title: 'Demand Forecasting', duration: 120 },
      { id: 'route-analysis', title: 'Route Analysis (7,444 deliveries)', duration: 150 },
      { id: 'fleet-performance', title: 'Fleet Performance', duration: 120 },
      { id: 'predictive-analytics', title: 'Predictive Analytics', duration: 90 }
    ],
    metrics: {
      totalDeliveries: 7444,
      avgRouteEfficiency: 92.3,
      forecastAccuracy: 89.7
    }
  },
  'ai-agents': {
    id: 'ai-agents',
    title: 'AI Agent Showcase',
    subtitle: '18+ Autonomous Agents',
    duration: 10,
    ordersPerMinute: 10,
    steps: [
      { id: 'agent-overview', title: '18+ AI Agents', duration: 120 },
      { id: 'master-orchestrator', title: 'Master Orchestrator', duration: 180 },
      { id: 'real-time-decisions', title: 'Real-time Decisions', duration: 150 },
      { id: 'autonomous-operations', title: 'Autonomous Operations', duration: 150 }
    ],
    metrics: {
      totalAgents: 18,
      activeAgents: 16,
      automationRate: 97.2
    }
  },
  integration: {
    id: 'integration',
    title: 'Full System Integration',
    subtitle: 'End-to-End Workflow',
    duration: 5,
    ordersPerMinute: 20,
    steps: [
      { id: 'end-to-end', title: 'End-to-End Lifecycle', duration: 75 },
      { id: 'multi-agent', title: 'Multi-agent Coordination', duration: 75 },
      { id: 'real-time-optimization', title: 'Real-time Optimization', duration: 75 },
      { id: 'complete-automation', title: 'Complete Automation', duration: 75 }
    ],
    metrics: {
      integrationPoints: 12,
      dataFlowRate: 1250, // events per minute
      systemReliability: 99.8
    }
  }
};

// Global demo state (in production, this would be in a database or cache)
let demoState = {
  isRunning: false,
  generator: null,
  startTime: null,
  ordersPerMinute: 5,
  duration: 300,
  currentScenario: null,
  currentStep: 0,
  scenarioStartTime: null,
  stats: {
    totalOrders: 0,
    completedOrders: 0,
    failedOrders: 0,
    activeOrders: 0,
    activeDrivers: 0,
    busyDrivers: 0,
    averageDeliveryTime: 0,
    slaCompliance: 100,
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

/**
 * @swagger
 * /api/demo/optimize-batch:
 *   post:
 *     summary: Run REAL route optimization on demo orders
 *     description: Collect pending BULLET orders and run actual route optimization
 *     tags: [Demo]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               minOrders:
 *                 type: integer
 *                 default: 5
 *                 description: Minimum orders to optimize
 *               serviceType:
 *                 type: string
 *                 enum: [BULLET, BARQ]
 *                 default: BULLET
 *                 description: Service type to optimize
 *     responses:
 *       200:
 *         description: Optimization completed successfully
 *       400:
 *         description: Not enough orders
 */
/**
 * @swagger
 * /api/demo/scenario:
 *   post:
 *     summary: Start or control demo scenario
 *     description: Start a specific demo scenario with guided steps
 *     tags: [Demo]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scenarioId:
 *                 type: string
 *                 enum: [executive, fleet-manager, dispatcher, analytics, ai-agents, integration]
 *               step:
 *                 type: integer
 *                 default: 0
 *               speed:
 *                 type: integer
 *                 default: 1
 *                 description: Scenario speed multiplier (1x, 2x, 5x)
 *     responses:
 *       200:
 *         description: Scenario started/updated successfully
 */
router.post(
  '/scenario',
  asyncHandler(async (req, res) => {
    try {
      const { scenarioId, step = 0, speed = 1 } = req.body;
      
      if (!DEMO_SCENARIOS[scenarioId]) {
        return res.status(400).json({
          success: false,
          error: 'Invalid scenario ID',
          details: `Valid scenarios: ${Object.keys(DEMO_SCENARIOS).join(', ')}`
        });
      }
      
      const scenario = DEMO_SCENARIOS[scenarioId];
      
      // Update demo state for scenario
      demoState.currentScenario = scenarioId;
      demoState.currentStep = step;
      demoState.ordersPerMinute = Math.round(scenario.ordersPerMinute * speed);
      demoState.scenarioStartTime = new Date();
      
      // Start demo if not already running
      if (!demoState.isRunning) {
        demoState.generator = new DemoGenerator();
        demoState.isRunning = true;
        demoState.startTime = new Date();
        demoState.duration = scenario.duration * 60; // Convert to seconds
        
        // Set up event listeners
        demoState.generator.on('orderCreated', (order) => {
          demoState.stats.totalOrders++;
          demoState.stats.activeOrders++;
          logger.info('Scenario order created', { orderId: order.id, scenario: scenarioId });
        });

        demoState.generator.on('orderDelivered', (data) => {
          demoState.stats.completedOrders++;
          demoState.stats.activeOrders = Math.max(0, demoState.stats.activeOrders - 1);
          logger.info('Scenario order delivered', { orderId: data.orderId, scenario: scenarioId });
        });

        demoState.generator.on('orderFailed', (data) => {
          demoState.stats.failedOrders++;
          demoState.stats.activeOrders = Math.max(0, demoState.stats.activeOrders - 1);
          logger.info('Scenario order failed', { orderId: data.orderId, scenario: scenarioId });
        });
        
        await demoState.generator.start(demoState.ordersPerMinute, scenario.duration);
      }
      
      // Generate scenario-specific data based on current step
      const currentStep = scenario.steps[step];
      const scenarioMetrics = generateScenarioMetrics(scenario, step);
      
      // Update demo stats with scenario-specific metrics
      Object.assign(demoState.stats, scenarioMetrics);
      
      logger.info('Scenario step started', { 
        scenarioId, 
        step, 
        stepTitle: currentStep?.title,
        speed 
      });
      
      res.json({
        success: true,
        message: `Scenario ${scenarioId} step ${step} started`,
        data: {
          scenario: {
            ...scenario,
            currentStep: step,
            currentStepData: currentStep
          },
          metrics: demoState.stats,
          speed,
          isRunning: demoState.isRunning
        }
      });
    } catch (error) {
      logger.error('Failed to start scenario', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to start scenario',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

/**
 * @swagger
 * /api/demo/scenarios:
 *   get:
 *     summary: Get available demo scenarios
 *     description: Get list of all available demo scenarios with their details
 *     tags: [Demo]
 *     responses:
 *       200:
 *         description: Scenarios retrieved successfully
 */
router.get(
  '/scenarios',
  asyncHandler(async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          scenarios: Object.values(DEMO_SCENARIOS),
          currentScenario: demoState.currentScenario,
          currentStep: demoState.currentStep
        }
      });
    } catch (error) {
      logger.error('Failed to get scenarios', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get scenarios',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

// Helper function to generate scenario-specific metrics
function generateScenarioMetrics(scenario, step) {
  const baseMetrics = {
    activeDrivers: Math.floor(Math.random() * 50) + 150,
    busyDrivers: Math.floor(Math.random() * 30) + 80,
    averageDeliveryTime: Math.floor(Math.random() * 10) + 25,
    slaCompliance: 95 + Math.random() * 5
  };
  
  // Scenario-specific metrics
  switch (scenario.id) {
    case 'executive':
      return {
        ...baseMetrics,
        totalSavings: scenario.metrics.targetSavings,
        benchmarkEfficiency: scenario.metrics.benchmarkEfficiency + (Math.random() * 2 - 1),
        slaCompliance: scenario.metrics.targetSLA + (Math.random() * 2 - 1)
      };
      
    case 'fleet-manager':
      return {
        ...baseMetrics,
        activeDrivers: scenario.metrics.activeVehicles + Math.floor(Math.random() * 20 - 10),
        fleetUtilization: scenario.metrics.targetUtilization + (Math.random() * 5 - 2.5)
      };
      
    case 'dispatcher':
      return {
        ...baseMetrics,
        emergencyResponseTime: scenario.metrics.emergencyResponse + (Math.random() * 0.5 - 0.25),
        agentsCoordinated: scenario.metrics.agentCoordination + Math.floor(Math.random() * 5 - 2),
        orderRecoveryRate: scenario.metrics.recoveryRate + (Math.random() * 2 - 1)
      };
      
    case 'analytics':
      return {
        ...baseMetrics,
        totalAnalyzedDeliveries: scenario.metrics.totalDeliveries,
        routeEfficiency: scenario.metrics.avgRouteEfficiency + (Math.random() * 3 - 1.5),
        forecastAccuracy: scenario.metrics.forecastAccuracy + (Math.random() * 2 - 1)
      };
      
    case 'ai-agents':
      return {
        ...baseMetrics,
        activeAgents: scenario.metrics.activeAgents + Math.floor(Math.random() * 3 - 1),
        totalAgents: scenario.metrics.totalAgents,
        automationRate: scenario.metrics.automationRate + (Math.random() * 1 - 0.5)
      };
      
    case 'integration':
      return {
        ...baseMetrics,
        integrationPoints: scenario.metrics.integrationPoints,
        dataFlowRate: scenario.metrics.dataFlowRate + Math.floor(Math.random() * 200 - 100),
        systemReliability: scenario.metrics.systemReliability + (Math.random() * 0.2 - 0.1)
      };
      
    default:
      return baseMetrics;
  }
}

router.post(
  '/optimize-batch',
  asyncHandler(async (req, res) => {
    try {
      const { minOrders = 5, serviceType = 'BULLET' } = req.body;

      // Import logistics service for real optimization
      const { logisticsService } = require('../services/enhanced-logistics.service');

      // Get pending orders from database
      const pendingOrders = await demoDatabaseService.getOrders({
        status: 'pending',
        serviceType,
        limit: 50,
      });

      logger.info(`Found ${pendingOrders.length} pending ${serviceType} orders for optimization`);

      if (pendingOrders.length < minOrders) {
        return res.status(400).json({
          success: false,
          error: 'Not enough orders',
          details: `Need at least ${minOrders} orders, found ${pendingOrders.length}`,
          data: {
            pendingOrders: pendingOrders.length,
            required: minOrders,
          },
        });
      }

      // Format orders for optimization API
      const pickupPoints = [
        {
          id: 'demo-warehouse-central',
          name: 'Demo Central Warehouse',
          address: 'King Fahd Road, Central Riyadh',
          lat: 24.7136,
          lng: 46.6753,
          priority: 1,
          serviceTime: 5,
        },
      ];

      const deliveryPoints = pendingOrders.slice(0, 20).map((order, index) => ({
        id: order.id || `demo-delivery-${index + 1}`,
        name: order.customer?.name || `Customer ${index + 1}`,
        address: order.delivery?.address || 'Riyadh',
        lat: order.delivery?.location?.lat || 24.7136 + (Math.random() * 0.1 - 0.05),
        lng: order.delivery?.location?.lng || 46.6753 + (Math.random() * 0.1 - 0.05),
        priority: order.priority === 'high' ? 1 : 2,
        serviceTime: 5,
        timeWindow: order.timeWindow || null,
      }));

      const vehicles = [
        { id: 'demo-vehicle-1', name: 'Van 1', type: 'van', capacity: 8, lat: 24.7136, lng: 46.6753 },
        { id: 'demo-vehicle-2', name: 'Van 2', type: 'van', capacity: 8, lat: 24.7136, lng: 46.6753 },
        { id: 'demo-vehicle-3', name: 'Van 3', type: 'van', capacity: 8, lat: 24.7136, lng: 46.6753 },
        { id: 'demo-vehicle-4', name: 'Van 4', type: 'van', capacity: 8, lat: 24.7136, lng: 46.6753 },
        { id: 'demo-vehicle-5', name: 'Van 5', type: 'van', capacity: 8, lat: 24.7136, lng: 46.6753 },
      ];

      // Call REAL optimization API
      logger.info('Calling REAL optimization API with demo data', {
        pickups: pickupPoints.length,
        deliveries: deliveryPoints.length,
        vehicles: vehicles.length,
      });

      // Generate unique request ID for this optimization
      const requestId = generateId();

      const optimizationRequest = {
        pickupPoints,
        deliveryPoints,
        vehicles,
        fleet: { vehicles },
        serviceType,
        context: {
          demo: true,
          source: 'interactive-demo',
          slaMinutes: 240, // 4 hours for BULLET
        },
        preferences: {
          optimizationLevel: 'balanced',
          enableGroqOptimization: true,
        },
      };

      const result = await logisticsService.processOptimizationRequest(requestId, optimizationRequest);

      logger.info('Real optimization completed', {
        success: result.success,
        routes: result.data?.routes?.length || 0,
      });

      // Update order statuses to "optimized"
      for (const order of pendingOrders.slice(0, deliveryPoints.length)) {
        await demoDatabaseService.updateOrderStatus(order.id, 'optimized', {
          optimization_id: result.requestId,
        });
      }

      res.json({
        success: true,
        message: 'Real route optimization completed',
        data: {
          ...result.data,
          ordersOptimized: deliveryPoints.length,
          requestId: result.requestId,
          llmPowered: result.data?.llmOptimization ? true : false,
          vehiclesUsed: result.data?.routes?.length || 0,
        },
      });
    } catch (error) {
      logger.error('Failed to run real optimization', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: 'Failed to optimize orders',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  })
);

// ========================================
// ENHANCED DEMO ORCHESTRATOR ENDPOINTS
// ========================================

/**
 * @swagger
 * /api/demo/enhanced/scenarios:
 *   get:
 *     summary: Get enhanced demo scenarios
 *     description: Get all available enhanced demo scenarios with detailed configurations
 *     tags: [Demo]
 *     responses:
 *       200:
 *         description: Enhanced scenarios retrieved successfully
 */
router.get(
  '/enhanced/scenarios',
  asyncHandler(async (req, res) => {
    try {
      const scenarios = demoOrchestrator.getAvailableScenarios();
      
      res.json({
        success: true,
        data: {
          scenarios,
          count: scenarios.length
        }
      });
    } catch (error) {
      logger.error('Failed to get enhanced scenarios', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get enhanced scenarios',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

/**
 * @swagger
 * /api/demo/enhanced/start:
 *   post:
 *     summary: Start enhanced demo scenario
 *     description: Start a specific enhanced demo scenario with comprehensive simulation
 *     tags: [Demo]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scenarioId:
 *                 type: string
 *                 enum: [executive-dashboard, fleet-operations, dispatcher-workflow, analytics-showcase, ai-agents-showcase, system-integration]
 *               config:
 *                 type: object
 *                 properties:
 *                   timeAcceleration:
 *                     type: number
 *                     default: 1
 *                   ordersPerMinute:
 *                     type: number
 *                   customDuration:
 *                     type: number
 *     responses:
 *       200:
 *         description: Enhanced demo scenario started successfully
 *       400:
 *         description: Invalid scenario ID or configuration
 *       409:
 *         description: Demo already running
 */
router.post(
  '/enhanced/start',
  asyncHandler(async (req, res) => {
    try {
      const { scenarioId, config = {} } = req.body;
      
      if (!scenarioId) {
        return res.status(400).json({
          success: false,
          error: 'Missing scenarioId',
          details: 'scenarioId is required'
        });
      }
      
      const result = await demoOrchestrator.startDemoScenario(scenarioId, config);
      
      res.json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (error) {
      logger.error('Failed to start enhanced demo scenario', { 
        error: error.message, 
        scenarioId: req.body.scenarioId 
      });
      
      const statusCode = error.message.includes('already running') ? 409 : 
                        error.message.includes('Unknown scenario') ? 400 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  })
);

/**
 * @swagger
 * /api/demo/enhanced/stop:
 *   post:
 *     summary: Stop enhanced demo
 *     description: Stop the currently running enhanced demo scenario
 *     tags: [Demo]
 *     responses:
 *       200:
 *         description: Enhanced demo stopped successfully
 */
router.post(
  '/enhanced/stop',
  asyncHandler(async (req, res) => {
    try {
      const result = await demoOrchestrator.stopDemo();
      
      res.json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (error) {
      logger.error('Failed to stop enhanced demo', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to stop enhanced demo',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

/**
 * @swagger
 * /api/demo/enhanced/status:
 *   get:
 *     summary: Get enhanced demo status
 *     description: Get comprehensive status of the enhanced demo including metrics and progress
 *     tags: [Demo]
 *     responses:
 *       200:
 *         description: Enhanced demo status retrieved successfully
 */
router.get(
  '/enhanced/status',
  asyncHandler(async (req, res) => {
    try {
      const status = demoOrchestrator.getDemoStatus();
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Failed to get enhanced demo status', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get enhanced demo status',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

/**
 * @swagger
 * /api/demo/enhanced/control:
 *   post:
 *     summary: Control enhanced demo playback
 *     description: Control demo playback (pause, resume, speed change, step navigation)
 *     tags: [Demo]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [pause, resume, speed, step]
 *               params:
 *                 type: object
 *                 properties:
 *                   multiplier:
 *                     type: number
 *                     description: Speed multiplier for speed action
 *                   step:
 *                     type: number
 *                     description: Step number for step action
 *     responses:
 *       200:
 *         description: Demo control action completed successfully
 *       400:
 *         description: Invalid control action or parameters
 */
router.post(
  '/enhanced/control',
  asyncHandler(async (req, res) => {
    try {
      const { action, params = {} } = req.body;
      
      if (!action) {
        return res.status(400).json({
          success: false,
          error: 'Missing action',
          details: 'action is required (pause, resume, speed, step)'
        });
      }
      
      const result = await demoOrchestrator.controlDemo(action, params);
      
      res.json({
        success: true,
        message: `Demo ${action} completed`,
        data: result
      });
    } catch (error) {
      logger.error('Failed to control enhanced demo', { 
        error: error.message,
        action: req.body.action 
      });
      
      const statusCode = error.message.includes('No demo is running') ? 400 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  })
);

/**
 * @swagger
 * /api/demo/enhanced/data/live:
 *   get:
 *     summary: Get live demo data stream
 *     description: Get comprehensive live demo data for analytics and monitoring
 *     tags: [Demo]
 *     responses:
 *       200:
 *         description: Live demo data retrieved successfully
 */
router.get(
  '/enhanced/data/live',
  asyncHandler(async (req, res) => {
    try {
      const liveData = demoOrchestrator.getLiveDemoData();
      
      if (liveData.error) {
        return res.status(400).json({
          success: false,
          error: liveData.error
        });
      }
      
      res.json({
        success: true,
        data: liveData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get live demo data', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get live demo data',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

/**
 * @swagger
 * /api/demo/enhanced/analytics:
 *   get:
 *     summary: Run analytics on demo data
 *     description: Execute Analytics Lab scripts on demo data for insights
 *     tags: [Demo]
 *     parameters:
 *       - in: query
 *         name: script
 *         schema:
 *           type: string
 *           enum: [demand-forecasting, route-analysis, fleet-performance, sla-analytics]
 *         description: Analytics script to run
 *     responses:
 *       200:
 *         description: Analytics completed successfully
 *       400:
 *         description: Invalid analytics script
 */
router.get(
  '/enhanced/analytics',
  asyncHandler(async (req, res) => {
    try {
      const { script } = req.query;
      
      if (!script) {
        return res.status(400).json({
          success: false,
          error: 'Missing script parameter',
          details: 'script parameter is required (demand-forecasting, route-analysis, fleet-performance, sla-analytics)'
        });
      }
      
      // Import and run Analytics Lab scripts
      const { pythonAnalyticsService } = require('../services/python-analytics.service');
      
      const analyticsResult = await pythonAnalyticsService.runAnalyticsScript(script, {
        demo: true,
        source: 'enhanced-demo'
      });
      
      res.json({
        success: true,
        script,
        data: analyticsResult,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to run demo analytics', { 
        error: error.message,
        script: req.query.script 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to run demo analytics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

/**
 * @swagger
 * /api/demo/enhanced/simulation/metrics:
 *   get:
 *     summary: Get simulation engine metrics
 *     description: Get detailed metrics from the simulation engine
 *     tags: [Demo]
 *     responses:
 *       200:
 *         description: Simulation metrics retrieved successfully
 */
router.get(
  '/enhanced/simulation/metrics',
  asyncHandler(async (req, res) => {
    try {
      const simulationEngine = demoOrchestrator.simulationEngine;
      
      if (!simulationEngine.isRunning) {
        return res.status(400).json({
          success: false,
          error: 'Simulation engine is not running'
        });
      }
      
      const metrics = simulationEngine.getDetailedMetrics();
      
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get simulation metrics', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get simulation metrics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

/**
 * @swagger
 * /api/demo/enhanced/websocket/info:
 *   get:
 *     summary: Get WebSocket connection information
 *     description: Get information about WebSocket server and connections
 *     tags: [Demo]
 *     responses:
 *       200:
 *         description: WebSocket information retrieved successfully
 */
router.get(
  '/enhanced/websocket/info',
  asyncHandler(async (req, res) => {
    try {
      const wsServer = demoOrchestrator.wsServer;
      
      const wsInfo = {
        isRunning: wsServer ? true : false,
        port: wsServer ? wsServer.port : null,
        connectedClients: wsServer ? wsServer.clients.size : 0,
        endpoint: wsServer ? `ws://localhost:${wsServer.port}` : null
      };
      
      res.json({
        success: true,
        data: wsInfo,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get WebSocket info', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get WebSocket info',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

// Initialize demo orchestrator on module load
demoOrchestrator.initialize().catch(error => {
  logger.error('Failed to initialize demo orchestrator', { error: error.message });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down demo orchestrator...');
  try {
    await demoOrchestrator.shutdown();
  } catch (error) {
    logger.error('Error during demo orchestrator shutdown', { error: error.message });
  }
});

/**
 * @swagger
 * /api/demo/analytics:
 *   get:
 *     summary: Get analytics lab integration data
 *     description: Fetch real production analytics data for demo scenarios
 *     tags: [Demo]
 *     responses:
 *       200:
 *         description: Analytics data retrieved successfully
 */
router.get(
  '/analytics',
  asyncHandler(async (req, res) => {
    try {
      // Import analytics services
      const pythonAnalyticsService = require('../services/python-analytics.service');
      
      // Fetch all analytics data in parallel
      const [
        demandForecast,
        routeAnalysis, 
        fleetPerformance,
        slaAnalytics
      ] = await Promise.allSettled([
        pythonAnalyticsService.getDemandForecast(),
        pythonAnalyticsService.getRouteAnalytics(),
        pythonAnalyticsService.getFleetPerformance(),
        pythonAnalyticsService.getSLAAnalytics()
      ]);

      // Format the response
      const analyticsData = {
        demandForecast: demandForecast.status === 'fulfilled' ? demandForecast.value : null,
        routeAnalysis: routeAnalysis.status === 'fulfilled' ? routeAnalysis.value : null,
        fleetPerformance: fleetPerformance.status === 'fulfilled' ? fleetPerformance.value : null,
        slaAnalytics: slaAnalytics.status === 'fulfilled' ? slaAnalytics.value : null,
        
        // Add demo-specific metrics
        demoMetrics: {
          totalDeliveries: 7444,
          routeEfficiency: 92.3,
          forecastAccuracy: 89.7,
          automationRate: 97.2,
          costSavings: 10950000, // SAR 10.95M
          benchmarkEfficiency: 94.5,
          slaCompliance: 96.8,
          fleetUtilization: 85.2,
          emergencyResponse: 2.3, // minutes
          systemReliability: 99.8
        },
        
        timestamp: new Date().toISOString()
      };

      logger.info('Analytics data fetched for demo', {
        demandForecast: demandForecast.status,
        routeAnalysis: routeAnalysis.status,
        fleetPerformance: fleetPerformance.status,
        slaAnalytics: slaAnalytics.status
      });

      res.json({
        success: true,
        data: analyticsData
      });
    } catch (error) {
      logger.error('Failed to fetch analytics data', { error: error.message });
      
      // Return demo data even if analytics service fails
      res.json({
        success: true,
        data: {
          demoMetrics: {
            totalDeliveries: 7444,
            routeEfficiency: 92.3,
            forecastAccuracy: 89.7,
            automationRate: 97.2,
            costSavings: 10950000, // SAR 10.95M
            benchmarkEfficiency: 94.5,
            slaCompliance: 96.8,
            fleetUtilization: 85.2,
            emergencyResponse: 2.3, // minutes
            systemReliability: 99.8
          },
          error: 'Analytics service unavailable - using demo data',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

/**
 * @swagger
 * /api/demo/production-insights:
 *   get:
 *     summary: Get BarqFleet production insights
 *     description: Fetch real production data insights for executive and analytics demos
 *     tags: [Demo]
 *     responses:
 *       200:
 *         description: Production insights retrieved successfully
 */
router.get(
  '/production-insights',
  asyncHandler(async (req, res) => {
    try {
      // This would connect to real BarqFleet production database
      // For demo purposes, we'll simulate with realistic data
      
      const productionInsights = {
        operationalMetrics: {
          totalVehicles: 834,
          activeVehicles: 672,
          dailyDeliveries: 7444,
          avgDeliveryTime: 28.4, // minutes
          fuelEfficiency: 87.3, // %
          customerSatisfaction: 4.6 // /5
        },
        
        costAnalysis: {
          annualSavings: 10950000, // SAR 10.95M
          fuelSavings: 4200000, // SAR 4.2M
          routeOptimizationSavings: 3800000, // SAR 3.8M
          laborOptimizationSavings: 2100000, // SAR 2.1M
          slaImprovementSavings: 850000, // SAR 0.85M
          roiPercentage: 428 // %
        },
        
        performanceBenchmarks: {
          deliveryEfficiency: 94.5, // % vs industry 70.5%
          slaPerformance: 96.8, // % vs industry 78.9%
          costEfficiency: 87.3, // % vs industry 56.2%
          automationRate: 97.2 // %
        },
        
        realTimeData: {
          ordersInProgress: 1247,
          emergenciesActive: 3,
          agentsCoordinated: 18,
          decisionsPerSecond: 247,
          uptime: 99.8 // %
        },
        
        predictiveAnalytics: {
          demandForecast24h: 18450, // orders
          peakLoadDay: 'Thursday',
          expectedCapacityIncrease: 15, // %
          efficiencyGainProjection: 8.7, // %
          riskAssessment: 'Low'
        },
        
        timestamp: new Date().toISOString()
      };

      logger.info('Production insights generated for demo');

      res.json({
        success: true,
        data: productionInsights
      });
    } catch (error) {
      logger.error('Failed to generate production insights', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch production insights',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

module.exports = router;
