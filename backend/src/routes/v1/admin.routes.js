/**
 * Admin Routes
 * API endpoints for agent monitoring and system administration
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize, ROLES } = require('../../middleware/auth.middleware');
const { logger } = require('../../utils/logger');
const { asyncHandler } = require('../../middleware/error.middleware');
const AgentInitializer = require('../../services/agent-initializer');

/**
 * Middleware to ensure agents are initialized
 */
const ensureAgentsInitialized = (req, res, next) => {
  const status = AgentInitializer.getStatus();
  if (!status.initialized) {
    return res.status(503).json({
      success: false,
      error: 'Agent system is initializing, please try again in a moment',
      status: status,
    });
  }
  next();
};

/**
 * @swagger
 * /api/admin/agents/status:
 *   get:
 *     summary: Get all agent statuses
 *     description: Retrieve status information for all registered agents
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Agent statuses retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [ACTIVE, IDLE, ERROR, DISABLED]
 *                       lastRun:
 *                         type: number
 *                       lastDuration:
 *                         type: number
 *                       healthScore:
 *                         type: number
 *                       successRate:
 *                         type: number
 *                       avgDuration:
 *                         type: number
 *                       executionCount:
 *                         type: number
 *                       errorCount:
 *                         type: number
 *       503:
 *         description: Agent system not initialized
 */
router.get(
  '/agents/status',
  asyncHandler(async (req, res) => {
    const startTime = Date.now();

    try {
      const instance = AgentInitializer.getInstance();
      const agentManager = instance.services.agentManager;

      if (!agentManager) {
        return res.status(503).json({
          success: false,
          error: 'Agent manager not available',
        });
      }

      const statuses = agentManager.getAllAgentStatus();
      const health = agentManager.getSystemHealth();
      const recentErrors = agentManager.getRecentErrors(20);

      // Transform agent statuses to match frontend expectations
      const transformedAgents = statuses.map((agent, index) => ({
        id: `agent-${index + 1}`,
        name: agent.name,
        description: getAgentDescription(agent.name),
        status: agent.status,
        lastRun: agent.lastRun ? new Date(agent.lastRun).toISOString() : null,
        lastDuration: agent.lastDuration || 0,
        healthScore: agent.healthScore || 0,
        successRate: agent.successRate || 0,
        totalExecutions: agent.executionCount || 0,
        failedExecutions: agent.errorCount || 0,
        averageDuration: agent.avgDuration || 0,
        errors: agent.lastError
          ? [
              {
                timestamp: new Date(agent.lastError.timestamp).toISOString(),
                message: agent.lastError.message,
                severity: 'HIGH',
              },
            ]
          : [],
        enabled: true,
        category: categorizeAgent(agent.name),
      }));

      // Transform recent errors to activity log
      const recentActivity = recentErrors.slice(0, 10).map((error, index) => ({
        id: `activity-${Date.now()}-${index}`,
        agentId: error.agentName,
        agentName: error.agentName,
        timestamp: new Date(error.timestamp).toISOString(),
        duration: 0,
        status: 'FAILURE',
        errorMessage: error.error,
      }));

      // Transform system health
      const systemHealth = {
        overall: health.overall.healthScore || 0,
        totalAgents: health.agents.total,
        activeAgents: health.agents.active,
        errorAgents: health.agents.error,
        idleAgents: health.agents.idle,
        disabledAgents: health.agents.disabled || 0,
        uptimePercentage: (health.performance.successRate * 100).toFixed(1),
        lastUpdated: new Date(health.overall.timestamp).toISOString(),
      };

      const responseTime = Date.now() - startTime;
      logger.debug(`[Admin] Agent status retrieved in ${responseTime}ms`);

      res.json({
        agents: transformedAgents,
        systemHealth: systemHealth,
        recentActivity: recentActivity,
      });
    } catch (error) {
      logger.error('[Admin] Failed to get agent statuses', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

/**
 * Helper function to get agent description
 */
function getAgentDescription(agentName) {
  const descriptions = {
    masterOrchestrator: 'Coordinates all AI agents and manages workflow execution',
    'master-orchestrator': 'Coordinates all AI agents and manages workflow execution',
    planning: 'Plans optimal delivery routes and strategies',
    optimization: 'Optimizes delivery routes using AI algorithms',
    formatting: 'Formats responses and data structures',
    fleetStatus: 'Monitors real-time fleet status and availability',
    'fleet-status': 'Monitors real-time fleet status and availability',
    slaMonitor: 'Monitors service level agreements and compliance',
    'sla-monitor': 'Monitors service level agreements and compliance',
    orderAssignment: 'Assigns orders to optimal drivers',
    'order-assignment': 'Assigns orders to optimal drivers',
    routeOptimization: 'Optimizes delivery routes in real-time',
    'route-optimization': 'Optimizes delivery routes in real-time',
    batchOptimization: 'Optimizes batched orders for efficiency',
    'batch-optimization': 'Optimizes batched orders for efficiency',
    demandForecasting: 'Predicts delivery demand patterns',
    'demand-forecasting': 'Predicts delivery demand patterns',
    emergencyEscalation: 'Handles emergency situations and escalations',
    'emergency-escalation': 'Handles emergency situations and escalations',
    fleetRebalancer: 'Rebalances fleet distribution across zones',
    'fleet-rebalancer': 'Rebalances fleet distribution across zones',
    geoIntelligence: 'Provides geographical intelligence and insights',
    'geo-intelligence': 'Provides geographical intelligence and insights',
    trafficPattern: 'Analyzes traffic patterns for optimization',
    'traffic-pattern': 'Analyzes traffic patterns for optimization',
    performanceAnalytics: 'Analyzes system performance metrics',
    'performance-analytics': 'Analyzes system performance metrics',
    orderRecovery: 'Recovers failed or problematic orders',
    'order-recovery': 'Recovers failed or problematic orders',
    customerCommunication: 'Manages customer communications and notifications',
    'customer-communication': 'Manages customer communications and notifications',
  };
  return descriptions[agentName] || `AI agent for ${agentName}`;
}

/**
 * Helper function to categorize agents
 */
function categorizeAgent(agentName) {
  const categories = {
    masterOrchestrator: 'Orchestration',
    'master-orchestrator': 'Orchestration',
    planning: 'Planning',
    optimization: 'Optimization',
    formatting: 'Formatting',
    fleetStatus: 'Fleet Management',
    'fleet-status': 'Fleet Management',
    slaMonitor: 'Monitoring',
    'sla-monitor': 'Monitoring',
    orderAssignment: 'Order Management',
    'order-assignment': 'Order Management',
    routeOptimization: 'Optimization',
    'route-optimization': 'Optimization',
    batchOptimization: 'Optimization',
    'batch-optimization': 'Optimization',
    demandForecasting: 'Analytics',
    'demand-forecasting': 'Analytics',
    emergencyEscalation: 'Emergency',
    'emergency-escalation': 'Emergency',
    fleetRebalancer: 'Fleet Management',
    'fleet-rebalancer': 'Fleet Management',
    geoIntelligence: 'Intelligence',
    'geo-intelligence': 'Intelligence',
    trafficPattern: 'Analytics',
    'traffic-pattern': 'Analytics',
    performanceAnalytics: 'Analytics',
    'performance-analytics': 'Analytics',
    orderRecovery: 'Order Management',
    'order-recovery': 'Order Management',
    customerCommunication: 'Communication',
    'customer-communication': 'Communication',
  };
  return categories[agentName] || 'General';
}

// Apply authentication to all admin routes
router.use(authenticate);
router.use(authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER));

// Apply initialization check to all routes
router.use(ensureAgentsInitialized);

/**
 * @swagger
 * /api/admin/agents/list:
 *   get:
 *     summary: List all available agents
 *     description: Get a simple list of all registered agent names
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Agent list retrieved successfully
 */
router.get(
  '/agents/list',
  asyncHandler(async (req, res) => {
    const startTime = Date.now();

    try {
      const instance = AgentInitializer.getInstance();
      const agentManager = instance.services.agentManager;

      if (!agentManager) {
        return res.status(503).json({
          success: false,
          error: 'Agent manager not available',
        });
      }

      const agents = Array.from(agentManager.agents.keys()).map((name) => {
        const stats = agentManager.executionStats.get(name) || {};
        return {
          name,
          registered: true,
          executionCount: stats.totalExecutions || 0,
          isContinuous: agentManager.continuousAgents.has(name),
        };
      });

      const responseTime = Date.now() - startTime;
      logger.debug(`[Admin] Agent list retrieved in ${responseTime}ms`);

      res.json({
        success: true,
        data: {
          agents,
          count: agents.length,
        },
        meta: {
          timestamp: Date.now(),
          responseTime,
        },
      });
    } catch (error) {
      logger.error('[Admin] Failed to get agent list', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

/**
 * @swagger
 * /api/admin/agents/{name}:
 *   get:
 *     summary: Get specific agent details
 *     description: Retrieve detailed information for a specific agent
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent name
 *     responses:
 *       200:
 *         description: Agent details retrieved successfully
 *       404:
 *         description: Agent not found
 */
router.get(
  '/agents/:name',
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    const startTime = Date.now();

    try {
      const instance = AgentInitializer.getInstance();
      const agentManager = instance.services.agentManager;

      if (!agentManager) {
        return res.status(503).json({
          success: false,
          error: 'Agent manager not available',
        });
      }

      const details = agentManager.getAgentDetails(name);

      const responseTime = Date.now() - startTime;
      logger.debug(`[Admin] Agent details for ${name} retrieved in ${responseTime}ms`);

      res.json({
        success: true,
        data: details,
        meta: {
          timestamp: Date.now(),
          responseTime,
        },
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: `Agent '${name}' not found`,
        });
      }

      logger.error(`[Admin] Failed to get agent details for ${name}`, { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

/**
 * @swagger
 * /api/admin/agents/{name}/history:
 *   get:
 *     summary: Get agent execution history
 *     description: Retrieve recent execution history for a specific agent
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent name
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Number of history records to retrieve
 *     responses:
 *       200:
 *         description: Execution history retrieved successfully
 *       404:
 *         description: Agent not found
 */
router.get(
  '/agents/:name/history',
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const startTime = Date.now();

    try {
      const instance = AgentInitializer.getInstance();
      const agentManager = instance.services.agentManager;

      if (!agentManager) {
        return res.status(503).json({
          success: false,
          error: 'Agent manager not available',
        });
      }

      // Check if agent exists
      if (!agentManager.agents.has(name)) {
        return res.status(404).json({
          success: false,
          error: `Agent '${name}' not found`,
        });
      }

      const history = agentManager.getExecutionHistory(name, limit);

      const responseTime = Date.now() - startTime;
      logger.debug(`[Admin] Execution history for ${name} retrieved in ${responseTime}ms`);

      res.json({
        success: true,
        data: {
          agentName: name,
          history,
          count: history.length,
        },
        meta: {
          limit,
          timestamp: Date.now(),
          responseTime,
        },
      });
    } catch (error) {
      logger.error(`[Admin] Failed to get execution history for ${name}`, { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

/**
 * @swagger
 * /api/admin/system/health:
 *   get:
 *     summary: Get system health overview
 *     description: Retrieve overall health status and metrics for the agent system
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: System health retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     overall:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [HEALTHY, DEGRADED]
 *                         healthScore:
 *                           type: number
 *                         timestamp:
 *                           type: number
 *                     agents:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         active:
 *                           type: number
 *                         error:
 *                           type: number
 *                         disabled:
 *                           type: number
 *                         idle:
 *                           type: number
 *                     performance:
 *                       type: object
 *                       properties:
 *                         totalExecutions:
 *                           type: number
 *                         totalErrors:
 *                           type: number
 *                         successRate:
 *                           type: number
 *                         avgResponseTime:
 *                           type: number
 */
router.get(
  '/system/health',
  asyncHandler(async (req, res) => {
    const startTime = Date.now();

    try {
      const instance = AgentInitializer.getInstance();
      const agentManager = instance.services.agentManager;

      if (!agentManager) {
        return res.status(503).json({
          success: false,
          error: 'Agent manager not available',
        });
      }

      const health = agentManager.getSystemHealth();

      const responseTime = Date.now() - startTime;
      logger.debug(`[Admin] System health retrieved in ${responseTime}ms`);

      // Determine HTTP status code based on health
      const httpStatus = health.overall.status === 'HEALTHY' ? 200 : 503;

      res.status(httpStatus).json({
        success: health.overall.status === 'HEALTHY',
        data: health,
        meta: {
          timestamp: Date.now(),
          responseTime,
        },
      });
    } catch (error) {
      logger.error('[Admin] Failed to get system health', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

/**
 * @swagger
 * /api/admin/system/errors:
 *   get:
 *     summary: Get recent system errors
 *     description: Retrieve recent errors across all agents
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Number of errors to retrieve
 *     responses:
 *       200:
 *         description: Recent errors retrieved successfully
 */
router.get(
  '/system/errors',
  asyncHandler(async (req, res) => {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const startTime = Date.now();

    try {
      const instance = AgentInitializer.getInstance();
      const agentManager = instance.services.agentManager;

      if (!agentManager) {
        return res.status(503).json({
          success: false,
          error: 'Agent manager not available',
        });
      }

      const errors = agentManager.getRecentErrors(limit);

      const responseTime = Date.now() - startTime;
      logger.debug(`[Admin] Recent errors retrieved in ${responseTime}ms`);

      res.json({
        success: true,
        data: {
          errors,
          count: errors.length,
        },
        meta: {
          limit,
          timestamp: Date.now(),
          responseTime,
        },
      });
    } catch (error) {
      logger.error('[Admin] Failed to get recent errors', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

/**
 * @swagger
 * /api/admin/agents/{name}/execute:
 *   post:
 *     summary: Manually execute an agent
 *     description: Trigger manual execution of a specific agent with tracking
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent name
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               context:
 *                 type: object
 *                 description: Execution context
 *     responses:
 *       200:
 *         description: Agent executed successfully
 *       404:
 *         description: Agent not found
 *       500:
 *         description: Execution failed
 */
router.post(
  '/agents/:name/execute',
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    const { context = {} } = req.body;
    const startTime = Date.now();

    try {
      const instance = AgentInitializer.getInstance();
      const agentManager = instance.services.agentManager;

      if (!agentManager) {
        return res.status(503).json({
          success: false,
          error: 'Agent manager not available',
        });
      }

      // Check if agent exists
      if (!agentManager.agents.has(name)) {
        return res.status(404).json({
          success: false,
          error: `Agent '${name}' not found`,
        });
      }

      // Execute agent with tracking
      const result = await agentManager.executeAgentWithTracking(name, {
        ...context,
        type: 'manual_execution',
        requestId: req.headers['x-request-id'],
      });

      const responseTime = Date.now() - startTime;
      logger.info(`[Admin] Agent ${name} executed manually in ${responseTime}ms`);

      res.json({
        success: true,
        data: {
          agentName: name,
          result,
          executionTime: responseTime,
        },
        meta: {
          timestamp: Date.now(),
          responseTime,
        },
      });
    } catch (error) {
      logger.error(`[Admin] Failed to execute agent ${name}`, { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
        agentName: name,
      });
    }
  })
);

/**
 * @swagger
 * /api/admin/system/metrics:
 *   get:
 *     summary: Get system metrics
 *     description: Retrieve detailed system performance metrics
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: System metrics retrieved successfully
 */
router.get(
  '/system/metrics',
  asyncHandler(async (req, res) => {
    const startTime = Date.now();

    try {
      const instance = AgentInitializer.getInstance();
      const agentManager = instance.services.agentManager;

      if (!agentManager) {
        return res.status(503).json({
          success: false,
          error: 'Agent manager not available',
        });
      }

      const health = agentManager.getSystemHealth();
      const allStatuses = agentManager.getAllAgentStatus();

      // Calculate additional metrics
      const metrics = {
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
        },
        agents: {
          total: allStatuses.length,
          byStatus: {
            active: allStatuses.filter((a) => a.status === 'ACTIVE').length,
            idle: allStatuses.filter((a) => a.status === 'IDLE').length,
            error: allStatuses.filter((a) => a.status === 'ERROR').length,
            disabled: allStatuses.filter((a) => a.status === 'DISABLED').length,
          },
          healthScores: {
            min: Math.min(...allStatuses.map((a) => a.healthScore)),
            max: Math.max(...allStatuses.map((a) => a.healthScore)),
            avg: allStatuses.reduce((sum, a) => sum + a.healthScore, 0) / allStatuses.length,
          },
        },
        performance: health.performance,
        mode: health.mode,
        continuousAgents: health.continuousAgents,
      };

      const responseTime = Date.now() - startTime;
      logger.debug(`[Admin] System metrics retrieved in ${responseTime}ms`);

      res.json({
        success: true,
        data: metrics,
        meta: {
          timestamp: Date.now(),
          responseTime,
        },
      });
    } catch (error) {
      logger.error('[Admin] Failed to get system metrics', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

module.exports = router;