/**
 * Agent Routes
 * API endpoints for agent operations and management
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
  AgentExecutionError,
} = require('../../middleware/error.middleware');

// Get agent services
const AgentInitializer = require('../../services/agent-initializer');
const AgentManagerService = require('../../services/agent-manager.service');

// Middleware to ensure agents are initialized
const ensureAgentsInitialized = async (req, res, next) => {
  const status = AgentInitializer.getStatus();
  if (!status.initialized) {
    throw new ServiceUnavailableError(
      'Agent system is initializing, please try again in a moment',
      30
    );
  }
  next();
};

// Apply initialization check to all routes
router.use(ensureAgentsInitialized);

/**
 * @swagger
 * /api/agents/status:
 *   get:
 *     summary: Get system status
 *     description: Retrieve the overall status of the agent system
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System status retrieved successfully
 *       503:
 *         description: System not ready
 */
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    const status = AgentInitializer.getStatus();
    const instance = AgentInitializer.getInstance();
    const detailedStatus = instance.services.agentManager?.getSystemStatus();

    res.json({
      success: true,
      systemStatus: status,
      agentManager: detailedStatus,
      timestamp: new Date(),
    });
  })
);

/**
 * @swagger
 * /api/agents/trigger:
 *   post:
 *     summary: Trigger agent execution
 *     description: Manually trigger any agent by name
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agentName
 *             properties:
 *               agentName:
 *                 type: string
 *                 description: Name of the agent to trigger
 *                 example: orderAssignment
 *               context:
 *                 type: object
 *                 description: Optional context data for the agent
 *     responses:
 *       200:
 *         description: Agent triggered successfully
 *       400:
 *         description: Invalid agent name or missing parameters
 *       404:
 *         description: Agent not found
 */
router.post(
  '/trigger',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { agentName, context = {} } = req.body;

    if (!agentName) {
      throw new ValidationError('Agent name is required');
    }

    const instance = AgentInitializer.getInstance();
    const agent = instance.agents[agentName];

    if (!agent) {
      throw new NotFoundError(`Agent '${agentName}' not found`);
    }

    // Add timestamp to context
    context.timestamp = context.timestamp || new Date();
    context.triggeredBy = 'api';

    const result = await agent.execute(context);

    res.json({
      success: true,
      agentName,
      data: result,
      triggeredAt: context.timestamp,
    });
  })
);

/**
 * @swagger
 * /api/agents/health:
 *   get:
 *     summary: Get agent health status
 *     description: Check the health of all active agents
 *     tags: [Agents]
 *     responses:
 *       200:
 *         description: Health status retrieved successfully
 */
router.get('/health', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
  try {
    const instance = AgentInitializer.getInstance();
    const health = instance.getHealthSummary();

    const agentHealth = {};
    for (const [name, agent] of Object.entries(instance.agents)) {
      agentHealth[name] = agent.isHealthy();
    }

    res.json({
      success: true,
      summary: health,
      agents: agentHealth,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('[AgentRoutes] Failed to get health', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/agents/fleet/status:
 *   get:
 *     summary: Get fleet status
 *     description: Get real-time fleet status and driver availability
 *     tags: [Fleet]
 *     responses:
 *       200:
 *         description: Fleet status retrieved successfully
 */
router.get(
  '/fleet/status',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.DISPATCHER),
  async (req, res) => {
    try {
      const instance = AgentInitializer.getInstance();
      const fleetAgent = instance.agents.fleetStatus;

      const result = await fleetAgent.execute({
        timestamp: new Date(),
        requestType: 'api',
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('[AgentRoutes] Failed to get fleet status', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/agents/sla/monitor:
 *   get:
 *     summary: Get SLA monitoring status
 *     description: Check SLA compliance and at-risk orders
 *     tags: [SLA]
 *     responses:
 *       200:
 *         description: SLA status retrieved successfully
 */
router.get(
  '/sla/monitor',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  async (req, res) => {
    try {
      const instance = AgentInitializer.getInstance();
      const slaAgent = instance.agents.slaMonitor;

      const result = await slaAgent.execute({
        timestamp: new Date(),
        checkAll: true,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('[AgentRoutes] Failed to get SLA status', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/agents/order/assign:
 *   post:
 *     summary: Assign order to driver
 *     description: Use AI to assign an order to the best available driver
 *     tags: [Orders]
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
 *                 properties:
 *                   id:
 *                     type: string
 *                   serviceType:
 *                     type: string
 *                     enum: [BARQ, BULLET]
 *                   pickup:
 *                     type: object
 *                   delivery:
 *                     type: object
 *     responses:
 *       200:
 *         description: Order assigned successfully
 */
router.post(
  '/order/assign',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate('orderAssignment'),
  asyncHandler(async (req, res) => {
    const { order } = req.body;

    if (!order) {
      throw new ValidationError('Order data is required');
    }

    const instance = AgentInitializer.getInstance();
    const assignmentAgent = instance.agents.orderAssignment;

    if (!assignmentAgent) {
      throw new NotFoundError('Order assignment agent not available');
    }

    const result = await assignmentAgent.execute({
      order,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * @swagger
 * /api/agents/batch/optimize:
 *   post:
 *     summary: Optimize batch orders
 *     description: Create optimized batches for multiple orders
 *     tags: [Batch]
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
 *               serviceType:
 *                 type: string
 *                 enum: [BARQ, BULLET]
 *     responses:
 *       200:
 *         description: Batch optimization completed
 */
router.post(
  '/batch/optimize',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate('batchOptimization'),
  async (req, res) => {
    try {
      const { orders, serviceType } = req.body;

      if (!orders || orders.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Orders array is required',
        });
      }

      const instance = AgentInitializer.getInstance();
      const batchAgent = instance.agents.batchOptimization;

      const result = await batchAgent.execute({
        orders,
        serviceType: serviceType || 'BULLET',
        timestamp: new Date(),
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('[AgentRoutes] Failed to optimize batch', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/agents/demand/forecast:
 *   get:
 *     summary: Get demand forecast
 *     description: Get AI-powered demand predictions
 *     tags: [Forecasting]
 *     parameters:
 *       - in: query
 *         name: horizon
 *         schema:
 *           type: integer
 *           enum: [30, 60, 120, 240]
 *         description: Forecast horizon in minutes
 *     responses:
 *       200:
 *         description: Forecast retrieved successfully
 */
router.get(
  '/demand/forecast',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  async (req, res) => {
    try {
      const { horizon } = req.query;

      const instance = AgentInitializer.getInstance();
      const forecastAgent = instance.agents.demandForecasting;

      const result = await forecastAgent.execute({
        horizons: horizon ? [parseInt(horizon)] : [30, 60, 120],
        timestamp: new Date(),
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('[AgentRoutes] Failed to get forecast', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/agents/geo/intelligence:
 *   get:
 *     summary: Get geo intelligence
 *     description: Get hotspots, zones, and geographical insights
 *     tags: [Geography]
 *     responses:
 *       200:
 *         description: Geo intelligence retrieved successfully
 */
router.get(
  '/geo/intelligence',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.DISPATCHER),
  async (req, res) => {
    try {
      const instance = AgentInitializer.getInstance();
      const geoAgent = instance.agents.geoIntelligence;

      const result = await geoAgent.execute({
        timestamp: new Date(),
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('[AgentRoutes] Failed to get geo intelligence', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/agents/traffic/patterns:
 *   get:
 *     summary: Get traffic patterns
 *     description: Get current traffic conditions and predictions
 *     tags: [Traffic]
 *     responses:
 *       200:
 *         description: Traffic patterns retrieved successfully
 */
router.get(
  '/traffic/patterns',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.DISPATCHER),
  async (req, res) => {
    try {
      const instance = AgentInitializer.getInstance();
      const trafficAgent = instance.agents.trafficPattern;

      const result = await trafficAgent.execute({
        timestamp: new Date(),
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('[AgentRoutes] Failed to get traffic patterns', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/agents/performance/analytics:
 *   get:
 *     summary: Get performance analytics
 *     description: Get KPIs, metrics, and performance insights
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 */
router.get(
  '/performance/analytics',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  async (req, res) => {
    try {
      const instance = AgentInitializer.getInstance();
      const analyticsAgent = instance.agents.performanceAnalytics;

      const result = await analyticsAgent.execute({
        timestamp: new Date(),
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('[AgentRoutes] Failed to get analytics', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/agents/emergency/escalate:
 *   post:
 *     summary: Trigger emergency escalation
 *     description: Escalate an emergency situation
 *     tags: [Emergency]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - level
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [SLA_CRITICAL, DRIVER_EMERGENCY, SYSTEM_FAILURE, MAJOR_INCIDENT]
 *               level:
 *                 type: string
 *                 enum: [L1, L2, L3, L4]
 *               context:
 *                 type: object
 *     responses:
 *       200:
 *         description: Escalation triggered successfully
 */
router.post(
  '/emergency/escalate',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  validate('emergencyEscalation'),
  async (req, res) => {
    try {
      const { type, level, context } = req.body;

      if (!type || !level) {
        return res.status(400).json({
          success: false,
          error: 'Emergency type and level are required',
        });
      }

      const instance = AgentInitializer.getInstance();
      const emergencyAgent = instance.agents.emergencyEscalation;

      const result = await emergencyAgent.execute({
        emergency: {
          type,
          level,
          context: context || {},
          timestamp: new Date(),
        },
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('[AgentRoutes] Failed to escalate emergency', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/agents/recovery/initiate:
 *   post:
 *     summary: Initiate order recovery
 *     description: Start recovery process for failed orders
 *     tags: [Recovery]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *             properties:
 *               orderId:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Recovery initiated successfully
 */
router.post(
  '/recovery/initiate',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.DISPATCHER),
  validate('orderRecovery'),
  async (req, res) => {
    try {
      const { orderId, reason } = req.body;

      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: 'Order ID is required',
        });
      }

      const instance = AgentInitializer.getInstance();
      const recoveryAgent = instance.agents.orderRecovery;

      const result = await recoveryAgent.execute({
        orders: [
          {
            id: orderId,
            issues: reason ? [{ type: reason, severity: 'high' }] : [],
            status: 'failed',
          },
        ],
        timestamp: new Date(),
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('[AgentRoutes] Failed to initiate recovery', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/agents/fleet/rebalance:
 *   post:
 *     summary: Rebalance fleet
 *     description: Trigger fleet geographical rebalancing
 *     tags: [Fleet]
 *     responses:
 *       200:
 *         description: Fleet rebalancing initiated
 */
router.post(
  '/fleet/rebalance',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  async (req, res) => {
    try {
      const instance = AgentInitializer.getInstance();
      const rebalancerAgent = instance.agents.fleetRebalancer;

      const result = await rebalancerAgent.execute({
        timestamp: new Date(),
        manual: true,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('[AgentRoutes] Failed to rebalance fleet', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/agents/orchestrate:
 *   post:
 *     summary: Orchestrate multi-agent operation
 *     description: Trigger master orchestrator for complex operations
 *     tags: [Orchestration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event
 *             properties:
 *               event:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                   data:
 *                     type: object
 *     responses:
 *       200:
 *         description: Orchestration completed
 */
router.post(
  '/orchestrate',
  authenticate,
  authorize(ROLES.ADMIN),
  validate('orchestrationEvent'),
  asyncHandler(async (req, res) => {
    const { event } = req.body;

    if (!event || !event.type) {
      throw new ValidationError('Event with type is required');
    }

    const instance = AgentInitializer.getInstance();
    const orchestrator = instance.agents.masterOrchestrator;

    if (!orchestrator) {
      throw new NotFoundError('Master orchestrator not available');
    }

    const result = await orchestrator.orchestrate(event);

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * @swagger
 * /api/agents/initialize:
 *   post:
 *     summary: Initialize agent system
 *     description: Start the agent initialization process
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Initialization completed
 *       503:
 *         description: Already initializing
 */
router.post('/initialize', authenticate, authorize(ROLES.SUPER_ADMIN), async (req, res) => {
  try {
    const status = AgentInitializer.getStatus();

    if (status.initialized) {
      return res.json({
        success: true,
        message: 'System already initialized',
        status,
      });
    }

    // Start initialization asynchronously
    AgentInitializer.initialize()
      .then((result) => {
        logger.info('[AgentRoutes] System initialized successfully', result);
      })
      .catch((error) => {
        logger.error('[AgentRoutes] System initialization failed', { error: error.message });
      });

    res.json({
      success: true,
      message: 'Initialization started',
      status: AgentInitializer.getStatus(),
    });
  } catch (error) {
    logger.error('[AgentRoutes] Failed to start initialization', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/agents/shutdown:
 *   post:
 *     summary: Shutdown agent system
 *     description: Gracefully shutdown all agents
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Shutdown completed
 */
router.post('/shutdown', authenticate, authorize(ROLES.SUPER_ADMIN), async (req, res) => {
  try {
    await AgentInitializer.shutdown();

    res.json({
      success: true,
      message: 'System shutdown complete',
    });
  } catch (error) {
    logger.error('[AgentRoutes] Failed to shutdown', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ================================
// AGENT CONTROL OPERATIONS
// ================================

/**
 * @swagger
 * /api/agents/{agentId}/start:
 *   post:
 *     summary: Start a specific agent
 *     description: Start an individual agent by ID
 *     tags: [Agent Control]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent identifier
 *     responses:
 *       200:
 *         description: Agent started successfully
 *       404:
 *         description: Agent not found
 *       409:
 *         description: Agent already running
 */
router.post(
  '/:agentId/start',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const instance = AgentInitializer.getInstance();
    const agentManager = instance.services.agentManager;

    if (!agentManager) {
      throw new ServiceUnavailableError('Agent manager not available');
    }

    const result = await agentManager.startAgent(agentId);

    res.json({
      success: true,
      agentId,
      ...result,
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/{agentId}/stop:
 *   post:
 *     summary: Stop a specific agent
 *     description: Stop an individual agent by ID
 *     tags: [Agent Control]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent identifier
 *     responses:
 *       200:
 *         description: Agent stopped successfully
 *       404:
 *         description: Agent not found
 */
router.post(
  '/:agentId/stop',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const instance = AgentInitializer.getInstance();
    const agentManager = instance.services.agentManager;

    if (!agentManager) {
      throw new ServiceUnavailableError('Agent manager not available');
    }

    const result = await agentManager.stopAgent(agentId);

    res.json({
      success: true,
      agentId,
      ...result,
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/{agentId}/restart:
 *   post:
 *     summary: Restart a specific agent
 *     description: Restart an individual agent by ID
 *     tags: [Agent Control]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent identifier
 *     responses:
 *       200:
 *         description: Agent restarted successfully
 *       404:
 *         description: Agent not found
 */
router.post(
  '/:agentId/restart',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const instance = AgentInitializer.getInstance();
    const agentManager = instance.services.agentManager;

    if (!agentManager) {
      throw new ServiceUnavailableError('Agent manager not available');
    }

    const result = await agentManager.restartAgent(agentId);

    res.json({
      success: true,
      agentId,
      ...result,
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/{agentId}/status:
 *   get:
 *     summary: Get agent status
 *     description: Get detailed status of a specific agent
 *     tags: [Agent Control]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent identifier
 *     responses:
 *       200:
 *         description: Agent status retrieved successfully
 *       404:
 *         description: Agent not found
 */
router.get(
  '/:agentId/status',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.DISPATCHER),
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const instance = AgentInitializer.getInstance();
    const agentManager = instance.services.agentManager;

    if (!agentManager) {
      throw new ServiceUnavailableError('Agent manager not available');
    }

    const status = agentManager.getAgentStatus(agentId);

    res.json({
      success: true,
      agentId,
      data: status,
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/{agentId}/logs:
 *   get:
 *     summary: Get agent logs
 *     description: Retrieve recent logs for a specific agent
 *     tags: [Agent Control]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent identifier
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 50
 *         description: Number of log entries to retrieve
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [debug, info, warn, error]
 *         description: Filter by log level
 *     responses:
 *       200:
 *         description: Agent logs retrieved successfully
 *       404:
 *         description: Agent not found
 */
router.get(
  '/:agentId/logs',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const { limit = 50, level } = req.query;
    const instance = AgentInitializer.getInstance();
    const agentManager = instance.services.agentManager;

    if (!agentManager) {
      throw new ServiceUnavailableError('Agent manager not available');
    }

    const logs = agentManager.getAgentLogs(agentId, parseInt(limit));
    const filteredLogs = level ? logs.filter(log => log.level === level) : logs;

    res.json({
      success: true,
      agentId,
      data: {
        logs: filteredLogs,
        total: filteredLogs.length,
        filtered: !!level,
        level: level || 'all',
      },
      timestamp: Date.now(),
    });
  })
);

// ================================
// AGENT CONFIGURATION MANAGEMENT
// ================================

/**
 * @swagger
 * /api/agents/{agentId}/config:
 *   get:
 *     summary: Get agent configuration
 *     description: Retrieve configuration for a specific agent
 *     tags: [Agent Configuration]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent identifier
 *     responses:
 *       200:
 *         description: Agent configuration retrieved successfully
 *       404:
 *         description: Agent not found
 */
router.get(
  '/:agentId/config',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const instance = AgentInitializer.getInstance();
    const agentManager = instance.services.agentManager;

    if (!agentManager) {
      throw new ServiceUnavailableError('Agent manager not available');
    }

    const config = agentManager.getAgentConfig(agentId);

    res.json({
      success: true,
      agentId,
      data: config,
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/{agentId}/config:
 *   put:
 *     summary: Update agent configuration
 *     description: Update configuration for a specific agent
 *     tags: [Agent Configuration]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               interval:
 *                 type: integer
 *                 minimum: 1000
 *                 description: Execution interval in milliseconds
 *               timeout:
 *                 type: integer
 *                 minimum: 1000
 *                 description: Timeout in milliseconds
 *               retryAttempts:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 10
 *                 description: Number of retry attempts
 *               enabled:
 *                 type: boolean
 *                 description: Whether the agent is enabled
 *               logLevel:
 *                 type: string
 *                 enum: [debug, info, warn, error]
 *                 description: Log level
 *     responses:
 *       200:
 *         description: Agent configuration updated successfully
 *       400:
 *         description: Invalid configuration
 *       404:
 *         description: Agent not found
 */
router.put(
  '/:agentId/config',
  authenticate,
  authorize(ROLES.ADMIN),
  validate('agentConfig'),
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const config = req.body;
    const instance = AgentInitializer.getInstance();
    const agentManager = instance.services.agentManager;

    if (!agentManager) {
      throw new ServiceUnavailableError('Agent manager not available');
    }

    const result = agentManager.updateAgentConfig(agentId, config);

    res.json({
      success: true,
      agentId,
      data: result.config,
      message: 'Configuration updated successfully',
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/{agentId}/config/reset:
 *   post:
 *     summary: Reset agent configuration
 *     description: Reset agent configuration to defaults
 *     tags: [Agent Configuration]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent identifier
 *     responses:
 *       200:
 *         description: Agent configuration reset successfully
 *       404:
 *         description: Agent not found
 */
router.post(
  '/:agentId/config/reset',
  authenticate,
  authorize(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const instance = AgentInitializer.getInstance();
    const agentManager = instance.services.agentManager;

    if (!agentManager) {
      throw new ServiceUnavailableError('Agent manager not available');
    }

    const result = agentManager.resetAgentConfig(agentId);

    res.json({
      success: true,
      agentId,
      data: result.config,
      message: 'Configuration reset to defaults',
      timestamp: Date.now(),
    });
  })
);

// ================================
// AGENT MONITORING AND METRICS
// ================================

/**
 * @swagger
 * /api/agents/{agentId}/health:
 *   get:
 *     summary: Get agent health
 *     description: Get health status and diagnostic information for a specific agent
 *     tags: [Agent Monitoring]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent identifier
 *     responses:
 *       200:
 *         description: Agent health retrieved successfully
 *       404:
 *         description: Agent not found
 */
router.get(
  '/:agentId/health',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const instance = AgentInitializer.getInstance();
    const agentManager = instance.services.agentManager;

    if (!agentManager) {
      throw new ServiceUnavailableError('Agent manager not available');
    }

    const health = agentManager.getAgentHealth(agentId);

    res.json({
      success: true,
      agentId,
      data: health,
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/{agentId}/metrics:
 *   get:
 *     summary: Get agent metrics
 *     description: Get performance metrics for a specific agent
 *     tags: [Agent Monitoring]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent identifier
 *     responses:
 *       200:
 *         description: Agent metrics retrieved successfully
 *       404:
 *         description: Agent not found
 */
router.get(
  '/:agentId/metrics',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const instance = AgentInitializer.getInstance();
    const agentManager = instance.services.agentManager;

    if (!agentManager) {
      throw new ServiceUnavailableError('Agent manager not available');
    }

    const metrics = agentManager.getAgentMetrics(agentId);

    res.json({
      success: true,
      agentId,
      data: metrics,
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/{agentId}/history:
 *   get:
 *     summary: Get agent execution history
 *     description: Get execution history for a specific agent
 *     tags: [Agent Monitoring]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent identifier
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of executions to retrieve
 *     responses:
 *       200:
 *         description: Execution history retrieved successfully
 *       404:
 *         description: Agent not found
 */
router.get(
  '/:agentId/history',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const { limit = 20 } = req.query;
    const instance = AgentInitializer.getInstance();
    const agentManager = instance.services.agentManager;

    if (!agentManager) {
      throw new ServiceUnavailableError('Agent manager not available');
    }

    const history = agentManager.getExecutionHistory(agentId, parseInt(limit));

    res.json({
      success: true,
      agentId,
      data: {
        executions: history,
        total: history.length,
        limit: parseInt(limit),
      },
      timestamp: Date.now(),
    });
  })
);

// ================================
// BULK OPERATIONS
// ================================

/**
 * @swagger
 * /api/agents/bulk/start:
 *   post:
 *     summary: Start multiple agents
 *     description: Start multiple agents in bulk
 *     tags: [Bulk Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agentIds
 *             properties:
 *               agentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of agent identifiers
 *     responses:
 *       200:
 *         description: Bulk start operation completed
 */
router.post(
  '/bulk/start',
  authenticate,
  authorize(ROLES.ADMIN),
  validate('bulkAgentOperation'),
  asyncHandler(async (req, res) => {
    const { agentIds } = req.body;
    const instance = AgentInitializer.getInstance();
    const agentManager = instance.services.agentManager;

    if (!agentManager) {
      throw new ServiceUnavailableError('Agent manager not available');
    }

    const results = await agentManager.startAgents(agentIds);

    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    };

    res.json({
      success: true,
      data: {
        results,
        summary,
      },
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/bulk/stop:
 *   post:
 *     summary: Stop multiple agents
 *     description: Stop multiple agents in bulk
 *     tags: [Bulk Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agentIds
 *             properties:
 *               agentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of agent identifiers
 *     responses:
 *       200:
 *         description: Bulk stop operation completed
 */
router.post(
  '/bulk/stop',
  authenticate,
  authorize(ROLES.ADMIN),
  validate('bulkAgentOperation'),
  asyncHandler(async (req, res) => {
    const { agentIds } = req.body;
    const instance = AgentInitializer.getInstance();
    const agentManager = instance.services.agentManager;

    if (!agentManager) {
      throw new ServiceUnavailableError('Agent manager not available');
    }

    const results = await agentManager.stopAgents(agentIds);

    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    };

    res.json({
      success: true,
      data: {
        results,
        summary,
      },
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/bulk/status:
 *   post:
 *     summary: Get status of multiple agents
 *     description: Get status of multiple agents in bulk
 *     tags: [Bulk Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agentIds
 *             properties:
 *               agentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of agent identifiers
 *     responses:
 *       200:
 *         description: Bulk status operation completed
 */
router.post(
  '/bulk/status',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  validate('bulkAgentOperation'),
  asyncHandler(async (req, res) => {
    const { agentIds } = req.body;
    const instance = AgentInitializer.getInstance();
    const agentManager = instance.services.agentManager;

    if (!agentManager) {
      throw new ServiceUnavailableError('Agent manager not available');
    }

    const results = agentManager.getBulkAgentStatus(agentIds);

    res.json({
      success: true,
      data: results,
      timestamp: Date.now(),
    });
  })
);

// ================================
// SYSTEM MONITORING
// ================================

/**
 * @swagger
 * /api/agents/system/metrics:
 *   get:
 *     summary: Get system-wide metrics
 *     description: Get comprehensive system metrics and performance data
 *     tags: [System Monitoring]
 *     responses:
 *       200:
 *         description: System metrics retrieved successfully
 */
router.get(
  '/system/metrics',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const instance = AgentInitializer.getInstance();
    const agentManager = instance.services.agentManager;

    if (!agentManager) {
      throw new ServiceUnavailableError('Agent manager not available');
    }

    const metrics = agentManager.getSystemMetrics();

    res.json({
      success: true,
      data: metrics,
      timestamp: Date.now(),
    });
  })
);

/**
 * @swagger
 * /api/agents/system/realtime:
 *   get:
 *     summary: Get real-time system updates
 *     description: Get real-time agent and system status updates
 *     tags: [System Monitoring]
 *     responses:
 *       200:
 *         description: Real-time updates retrieved successfully
 */
router.get(
  '/system/realtime',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const instance = AgentInitializer.getInstance();
    const agentManager = instance.services.agentManager;

    if (!agentManager) {
      throw new ServiceUnavailableError('Agent manager not available');
    }

    const updates = agentManager.getRealtimeUpdates();

    res.json({
      success: true,
      data: updates,
      timestamp: Date.now(),
    });
  })
);

module.exports = router;
