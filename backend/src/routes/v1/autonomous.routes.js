/**
 * Autonomous Operations API Routes
 *
 * Endpoints for managing and monitoring AI autonomous operations
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize, ROLES } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validation.middleware');
const { asyncHandler } = require('../../middleware/error.middleware');
const { logger } = require('../../utils/logger');

// Will be injected by app.js
let autonomousOrchestrator = null;
let actionAuth = null;
let autonomousInitializer = null;

/**
 * Initialize with services
 */
router.init = (orchestrator, authService, initializer) => {
  autonomousOrchestrator = orchestrator;
  actionAuth = authService;
  autonomousInitializer = initializer;
  logger.info('[AutonomousRoutes] Initialized', {
    hasOrchestrator: !!orchestrator,
    hasInitializer: !!initializer,
  });
};

/**
 * GET /api/v1/autonomous/status
 * Get autonomous operations status
 */
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    if (!autonomousInitializer) {
      return res.json({
        success: true,
        status: 'not_initialized',
        message: 'Autonomous operations not initialized',
      });
    }

    const status = autonomousInitializer.getStatus();
    const stats = autonomousInitializer.getCycleStats();
    const recentCycles = autonomousInitializer.getCycleResults(5);

    res.json({
      success: true,
      status: status.initialized ? 'running' : 'stopped',
      data: {
        ...status,
        recentCycles,
      },
    });
  })
);

/**
 * POST /api/v1/autonomous/start
 * Start autonomous operations
 */
router.post(
  '/start',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    if (!autonomousInitializer) {
      return res.status(503).json({
        success: false,
        message: 'Autonomous operations not initialized',
      });
    }

    try {
      await autonomousInitializer.start();

      res.json({
        success: true,
        message: 'Autonomous operations started successfully',
        data: autonomousInitializer.getStatus(),
      });
    } catch (error) {
      logger.error('Failed to start autonomous operations', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to start autonomous operations',
        error: error.message,
      });
    }
  })
);

/**
 * POST /api/v1/autonomous/stop
 * Stop autonomous operations
 */
router.post(
  '/stop',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    if (!autonomousInitializer) {
      return res.status(503).json({
        success: false,
        message: 'Autonomous operations not initialized',
      });
    }

    try {
      await autonomousInitializer.stop();

      res.json({
        success: true,
        message: 'Autonomous operations stopped successfully',
        data: autonomousInitializer.getStatus(),
      });
    } catch (error) {
      logger.error('Failed to stop autonomous operations', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to stop autonomous operations',
        error: error.message,
      });
    }
  })
);

/**
 * GET /api/v1/autonomous/cycles
 * Get autonomous operation cycles history
 */
router.get(
  '/cycles',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    if (!autonomousInitializer) {
      return res.status(503).json({
        success: false,
        message: 'Autonomous operations not initialized',
      });
    }

    const limit = parseInt(req.query.limit) || 50;
    const cycles = autonomousInitializer.getCycleResults(limit);
    const stats = autonomousInitializer.getCycleStats();

    res.json({
      success: true,
      data: {
        cycles,
        stats,
        count: cycles.length,
      },
    });
  })
);

/**
 * GET /api/v1/autonomous/logs
 * Get autonomous operations logs
 */
router.get(
  '/logs',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    if (!autonomousInitializer) {
      return res.status(503).json({
        success: false,
        message: 'Autonomous operations not initialized',
      });
    }

    const limit = parseInt(req.query.limit) || 100;
    const level = req.query.level; // filter by log level if provided

    // Get recent cycles which contain logs
    const cycles = autonomousInitializer.getCycleResults(limit);

    // Extract logs from cycles
    const logs = cycles.flatMap(cycle => {
      const cycleLog = {
        timestamp: cycle.timestamp,
        type: 'cycle',
        level: cycle.success ? 'info' : 'error',
        message: `Cycle ${cycle.cycleNumber}: ${cycle.actionsExecuted} actions executed`,
        data: cycle,
      };

      if (level && cycleLog.level !== level) {
        return [];
      }

      return [cycleLog];
    });

    res.json({
      success: true,
      data: {
        logs,
        count: logs.length,
        totalCycles: cycles.length,
      },
    });
  })
);

/**
 * GET /api/autonomous/dashboard
 * Get dashboard data for AI operations monitoring
 */
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    if (!autonomousOrchestrator && !autonomousInitializer) {
      return res.status(503).json({
        success: false,
        message: 'Autonomous operations not initialized',
      });
    }

    const status = autonomousInitializer
      ? autonomousInitializer.getStatus()
      : { initialized: false };
    const stats = autonomousInitializer ? autonomousInitializer.getCycleStats() : {};

    const dashboardData = {
      autonomousStatus: status,
      statistics: stats,
      recentActivity: autonomousInitializer ? autonomousInitializer.getCycleResults(10) : [],
    };

    res.json({
      success: true,
      data: dashboardData,
    });
  })
);

/**
 * GET /api/autonomous/intelligence
 * Get current intelligence gathered from all agents
 */
router.get(
  '/intelligence',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    if (!autonomousOrchestrator) {
      return res.status(503).json({
        success: false,
        message: 'Autonomous orchestrator not initialized',
      });
    }

    const intelligence = await autonomousOrchestrator.gatherIntelligence();

    res.json({
      success: true,
      data: intelligence,
      timestamp: new Date(),
    });
  })
);

/**
 * POST /api/autonomous/analyze
 * Analyze current situation and get recommended actions
 */
router.post(
  '/analyze',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    if (!autonomousOrchestrator) {
      return res.status(503).json({
        success: false,
        message: 'Autonomous orchestrator not initialized',
      });
    }

    const intelligence = await autonomousOrchestrator.gatherIntelligence();
    const situation = await autonomousOrchestrator.analyzeSituation(intelligence);
    const actionPlan = await autonomousOrchestrator.generateActionPlan(situation);

    res.json({
      success: true,
      data: {
        situation,
        recommendedActions: actionPlan,
        timestamp: new Date(),
      },
    });
  })
);

/**
 * POST /api/autonomous/execute
 * Trigger autonomous operation cycle manually
 */
router.post(
  '/execute',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    if (!autonomousOrchestrator) {
      return res.status(503).json({
        success: false,
        message: 'Autonomous orchestrator not initialized',
      });
    }

    const result = await autonomousOrchestrator.autonomousOperationCycle();

    res.json({
      success: true,
      data: result,
      timestamp: new Date(),
    });
  })
);

/**
 * GET /api/autonomous/stats
 * Get execution statistics
 */
router.get(
  '/stats',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    if (!actionAuth) {
      return res.status(503).json({
        success: false,
        message: 'Action authorization service not initialized',
      });
    }

    const timeframe = req.query.timeframe || '24h';
    const stats = actionAuth.getStatistics(timeframe);

    res.json({
      success: true,
      data: stats,
      timeframe,
    });
  })
);

/**
 * GET /api/autonomous/actions/recent
 * Get recent autonomous actions
 */
router.get(
  '/actions/recent',
  asyncHandler(async (req, res) => {
    if (!actionAuth) {
      return res.status(503).json({
        success: false,
        message: 'Action authorization service not initialized',
      });
    }

    const limit = parseInt(req.query.limit) || 50;
    const recentActions = actionAuth.executionHistory.slice(-limit).reverse();

    res.json({
      success: true,
      data: recentActions,
      count: recentActions.length,
    });
  })
);

/**
 * GET /api/autonomous/approvals/pending
 * Get pending approval requests
 */
router.get(
  '/approvals/pending',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    if (!actionAuth) {
      return res.status(503).json({
        success: false,
        message: 'Action authorization service not initialized',
      });
    }

    const pending = Array.from(actionAuth.pendingApprovals.values()).filter(
      (a) => a.status === 'PENDING'
    );

    res.json({
      success: true,
      data: pending,
      count: pending.length,
    });
  })
);

/**
 * POST /api/autonomous/approvals/:id/approve
 * Approve a pending action
 */
router.post(
  '/approvals/:id/approve',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  validate('approvalAction'),
  asyncHandler(async (req, res) => {
    if (!actionAuth) {
      return res.status(503).json({
        success: false,
        message: 'Action authorization service not initialized',
      });
    }

    const approvalId = req.params.id;
    const { approvedBy } = req.body;

    if (!approvedBy) {
      return res.status(400).json({
        success: false,
        message: 'approvedBy field is required',
      });
    }

    const approval = await actionAuth.approveAction(approvalId, approvedBy);

    res.json({
      success: true,
      data: approval,
      message: 'Action approved successfully',
    });
  })
);

/**
 * POST /api/autonomous/approvals/:id/reject
 * Reject a pending action
 */
router.post(
  '/approvals/:id/reject',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  validate('rejectionAction'),
  asyncHandler(async (req, res) => {
    if (!actionAuth) {
      return res.status(503).json({
        success: false,
        message: 'Action authorization service not initialized',
      });
    }

    const approvalId = req.params.id;
    const { rejectedBy, reason } = req.body;

    if (!rejectedBy || !reason) {
      return res.status(400).json({
        success: false,
        message: 'rejectedBy and reason fields are required',
      });
    }

    const approval = await actionAuth.rejectAction(approvalId, rejectedBy, reason);

    res.json({
      success: true,
      data: approval,
      message: 'Action rejected',
    });
  })
);

/**
 * POST /api/v1/autonomous/enable
 * Enable autonomous mode (simplified endpoint)
 */
router.post(
  '/enable',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    if (!autonomousOrchestrator) {
      return res.status(503).json({
        success: false,
        message: 'Autonomous orchestrator not initialized',
      });
    }

    const newMode = autonomousOrchestrator.setAutonomousMode(true);

    res.json({
      success: true,
      data: {
        autonomousMode: newMode,
        message: 'Autonomous mode ENABLED',
        timestamp: new Date(),
      },
    });
  })
);

/**
 * POST /api/v1/autonomous/disable
 * Disable autonomous mode (simplified endpoint)
 */
router.post(
  '/disable',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    if (!autonomousOrchestrator) {
      return res.status(503).json({
        success: false,
        message: 'Autonomous orchestrator not initialized',
      });
    }

    const newMode = autonomousOrchestrator.setAutonomousMode(false);

    res.json({
      success: true,
      data: {
        autonomousMode: newMode,
        message: 'Autonomous mode DISABLED',
        timestamp: new Date(),
      },
    });
  })
);

/**
 * POST /api/autonomous/mode
 * Toggle autonomous mode on/off
 */
router.post(
  '/mode',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  validate('autonomousMode'),
  asyncHandler(async (req, res) => {
    if (!autonomousOrchestrator) {
      return res.status(503).json({
        success: false,
        message: 'Autonomous orchestrator not initialized',
      });
    }

    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'enabled field must be a boolean',
      });
    }

    const newMode = autonomousOrchestrator.setAutonomousMode(enabled);

    res.json({
      success: true,
      data: {
        autonomousMode: newMode,
        message: newMode ? 'Autonomous mode ENABLED' : 'Autonomous mode DISABLED',
      },
    });
  })
);

/**
 * GET /api/autonomous/learning/insights
 * Get AI learning insights
 */
router.get(
  '/learning/insights',
  authenticate,
  authorize(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    if (!autonomousOrchestrator) {
      return res.status(503).json({
        success: false,
        message: 'Autonomous orchestrator not initialized',
      });
    }

    const insights = autonomousOrchestrator.analyzeLearningPatterns();

    res.json({
      success: true,
      data: insights,
      totalRecords: autonomousOrchestrator.learningData.length,
    });
  })
);

/**
 * GET /api/autonomous/triggers/stats
 * Get agent trigger statistics
 */
router.get(
  '/triggers/stats',
  asyncHandler(async (req, res) => {
    if (!autonomousInitializer) {
      return res.json({
        success: false,
        message: 'Autonomous operations not initialized',
      });
    }

    const triggerService = autonomousInitializer.getAgentTriggerService();
    const stats = triggerService.getStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * GET /api/autonomous/triggers/recent
 * Get recent trigger attempts
 */
router.get(
  '/triggers/recent',
  asyncHandler(async (req, res) => {
    if (!autonomousInitializer) {
      return res.json({
        success: false,
        message: 'Autonomous operations not initialized',
      });
    }

    const limit = parseInt(req.query.limit) || 20;
    const triggerService = autonomousInitializer.getAgentTriggerService();
    const recentTriggers = triggerService.getRecentTriggers(limit);

    res.json({
      success: true,
      data: recentTriggers,
      count: recentTriggers.length,
    });
  })
);

/**
 * GET /api/autonomous/triggers/agent/:agentName
 * Get trigger history for a specific agent
 */
router.get(
  '/triggers/agent/:agentName',
  asyncHandler(async (req, res) => {
    if (!autonomousInitializer) {
      return res.json({
        success: false,
        message: 'Autonomous operations not initialized',
      });
    }

    const { agentName } = req.params;
    const triggerService = autonomousInitializer.getAgentTriggerService();
    const agentTriggers = triggerService.getAgentTriggers(agentName);

    res.json({
      success: true,
      data: agentTriggers,
    });
  })
);

/**
 * POST /api/autonomous/triggers/reset-cooldowns
 * Reset trigger cooldowns (admin only)
 */
router.post(
  '/triggers/reset-cooldowns',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    if (!autonomousInitializer) {
      return res.status(503).json({
        success: false,
        message: 'Autonomous operations not initialized',
      });
    }

    const triggerService = autonomousInitializer.getAgentTriggerService();
    triggerService.resetCooldowns();

    res.json({
      success: true,
      message: 'All trigger cooldowns have been reset',
    });
  })
);

/**
 * POST /api/autonomous/trigger
 * Manually trigger autonomous cycle
 */
router.post(
  '/trigger',
  asyncHandler(async (req, res) => {
    if (!autonomousInitializer) {
      return res.status(503).json({
        success: false,
        message: 'Autonomous operations not initialized',
      });
    }

    const result = await autonomousInitializer.triggerCycle();

    res.json({
      success: result.triggered,
      data: result,
    });
  })
);

/**
 * GET /api/autonomous/health
 * Health check for autonomous operations system
 */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const health = {
      orchestrator: autonomousOrchestrator ? 'READY' : 'NOT_INITIALIZED',
      actionAuth: actionAuth ? 'READY' : 'NOT_INITIALIZED',
      autonomousMode: autonomousOrchestrator?.isAutonomousMode || false,
      pendingApprovals: actionAuth?.pendingApprovals?.size || 0,
      learningRecords: autonomousOrchestrator?.learningData?.length || 0,
    };

    const isHealthy = health.orchestrator === 'READY' && health.actionAuth === 'READY';

    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      data: health,
    });
  })
);

module.exports = router;
