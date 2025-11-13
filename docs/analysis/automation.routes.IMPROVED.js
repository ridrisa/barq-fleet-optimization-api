/**
 * IMPROVED VERSION: Better error handling for disabled automation engines
 *
 * This is a reference implementation showing how to improve error responses
 * when DISABLE_AUTONOMOUS_AGENTS=true
 *
 * Key improvements:
 * 1. Consistent error messages with context
 * 2. Clear instructions for users
 * 3. Graceful degradation where possible
 */

// Helper function to create consistent "service disabled" responses
const createServiceDisabledResponse = (engineName, details = {}) => {
  return {
    available: false,
    status: 'disabled',
    engine: engineName,
    reason: 'Automation engines are disabled in this environment',
    configuration: 'DISABLE_AUTONOMOUS_AGENTS=true',
    instructions: details.instructions || 'Contact system administrator to enable automation features',
    documentation: details.documentation || '/api-docs#automation',
    message: details.message || `${engineName} is not available in this environment`,
    canRetry: false,
    timestamp: new Date().toISOString()
  };
};

// Example: Improved status endpoint with graceful degradation
router.get('/dispatch/status', async (req, res) => {
  try {
    if (!autoDispatchEngine) {
      // Instead of 503, return 200 with detailed status
      return res.status(200).json(
        createServiceDisabledResponse('Auto-Dispatch Engine', {
          message: 'Auto-dispatch automation is not enabled in this environment',
          instructions: 'To enable: Set DISABLE_AUTONOMOUS_AGENTS=false and restart the service',
          documentation: '/api-docs#auto-dispatch'
        })
      );
    }

    // Normal operation when engine is available
    res.json({
      available: true,
      isRunning: autoDispatchEngine.isRunning,
      status: autoDispatchEngine.isRunning ? 'running' : 'ready',
      config: {
        checkInterval: '10 seconds',
        offerTimeout: autoDispatchEngine.offerTimeout,
        maxOffersPerOrder: autoDispatchEngine.maxOffersPerOrder,
      },
    });
  } catch (error) {
    console.error('Error getting auto-dispatch status:', error);
    res.status(500).json({
      error: 'Failed to get status',
      details: error.message
    });
  }
});

// Example: Improved stats endpoint that returns empty data when disabled
router.get('/dispatch/stats', async (req, res) => {
  try {
    if (!autoDispatchEngine) {
      // Return empty stats with clear message
      return res.status(200).json({
        available: false,
        status: 'disabled',
        message: 'Auto-dispatch statistics not available - engine is disabled',
        reason: 'DISABLE_AUTONOMOUS_AGENTS=true',
        historical: [],
        today: {
          total_assignments: 0,
          auto_assigned: 0,
          force_assigned: 0,
          avg_assignment_score: null,
        },
        period: '0 days',
        instructions: 'Enable automation engines to view statistics'
      });
    }

    // Normal operation...
    const { days = 7 } = req.query;

    const stats = await postgresService.query(`
      SELECT * FROM auto_dispatch_stats
      WHERE date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      ORDER BY date DESC
    `);

    const todayStats = await postgresService.query(`
      SELECT
        COUNT(*) AS total_assignments,
        COUNT(*) FILTER (WHERE assignment_type = 'AUTO_ASSIGNED') AS auto_assigned,
        COUNT(*) FILTER (WHERE assignment_type = 'FORCE_ASSIGNED') AS force_assigned,
        AVG(total_score) AS avg_assignment_score,
        AVG(distance_score) AS avg_distance_score,
        AVG(time_score) AS avg_time_score,
        AVG(load_score) AS avg_load_score,
        AVG(priority_score) AS avg_priority_score
      FROM assignment_logs
      WHERE DATE(assigned_at) = CURRENT_DATE
    `);

    res.json({
      available: true,
      historical: stats.rows,
      today: todayStats.rows[0],
      period: `${days} days`,
    });
  } catch (error) {
    console.error('Error getting auto-dispatch stats:', error);
    res.status(500).json({
      error: 'Failed to get stats',
      details: error.message
    });
  }
});

// Example: Improved start endpoint with clear error
router.post('/dispatch/start', async (req, res) => {
  try {
    if (!autoDispatchEngine) {
      // Use 503 for control endpoints (start/stop) as they can't be gracefully degraded
      return res.status(503).json(
        createServiceDisabledResponse('Auto-Dispatch Engine', {
          message: 'Cannot start engine - automation is disabled in this environment',
          instructions: 'To enable automation: Set DISABLE_AUTONOMOUS_AGENTS=false in environment configuration and redeploy',
          canRetry: false
        })
      );
    }

    if (autoDispatchEngine.isRunning) {
      return res.status(400).json({
        error: 'Auto-dispatch engine is already running',
        status: 'running'
      });
    }

    await autoDispatchEngine.start();

    res.json({
      success: true,
      message: 'Auto-dispatch engine started successfully',
      config: {
        checkInterval: '10 seconds',
        offerTimeout: `${autoDispatchEngine.offerTimeout} seconds`,
        maxOffersPerOrder: autoDispatchEngine.maxOffersPerOrder,
      },
    });
  } catch (error) {
    console.error('Error starting auto-dispatch engine:', error);
    res.status(500).json({
      error: 'Failed to start auto-dispatch engine',
      details: error.message
    });
  }
});

// NEW: Availability check endpoint
router.get('/availability', async (req, res) => {
  try {
    const availability = {
      automationEnabled: process.env.DISABLE_AUTONOMOUS_AGENTS !== 'true',
      autoStartEnabled: process.env.AUTO_START_AUTOMATION === 'true',
      engines: {
        autoDispatch: {
          available: !!autoDispatchEngine,
          initialized: !!autoDispatchEngine,
          running: autoDispatchEngine ? autoDispatchEngine.isRunning : false,
          status: !autoDispatchEngine
            ? 'unavailable'
            : autoDispatchEngine.isRunning
              ? 'running'
              : 'ready',
          endpoints: {
            status: '/api/v1/automation/dispatch/status',
            stats: '/api/v1/automation/dispatch/stats',
            start: '/api/v1/automation/dispatch/start',
            stop: '/api/v1/automation/dispatch/stop',
            assign: '/api/v1/automation/dispatch/assign/:orderId'
          }
        },
        routeOptimizer: {
          available: !!dynamicRouteOptimizer,
          initialized: !!dynamicRouteOptimizer,
          running: dynamicRouteOptimizer ? dynamicRouteOptimizer.isRunning : false,
          status: !dynamicRouteOptimizer
            ? 'unavailable'
            : dynamicRouteOptimizer.isRunning
              ? 'running'
              : 'ready',
          endpoints: {
            status: '/api/v1/automation/routes/status',
            stats: '/api/v1/automation/routes/stats',
            start: '/api/v1/automation/routes/start',
            stop: '/api/v1/automation/routes/stop',
            optimize: '/api/v1/automation/routes/optimize/:driverId'
          }
        },
        smartBatching: {
          available: !!smartBatchingEngine,
          initialized: !!smartBatchingEngine,
          running: smartBatchingEngine ? smartBatchingEngine.isRunning : false,
          status: !smartBatchingEngine
            ? 'unavailable'
            : smartBatchingEngine.isRunning
              ? 'running'
              : 'ready',
          endpoints: {
            status: '/api/v1/automation/batching/status',
            stats: '/api/v1/automation/batching/stats',
            start: '/api/v1/automation/batching/start',
            stop: '/api/v1/automation/batching/stop',
            process: '/api/v1/automation/batching/process'
          }
        },
        escalation: {
          available: !!autonomousEscalationEngine,
          initialized: !!autonomousEscalationEngine,
          running: autonomousEscalationEngine ? autonomousEscalationEngine.isRunning : false,
          status: !autonomousEscalationEngine
            ? 'unavailable'
            : autonomousEscalationEngine.isRunning
              ? 'running'
              : 'ready',
          endpoints: {
            status: '/api/v1/automation/escalation/status',
            stats: '/api/v1/automation/escalation/stats',
            logs: '/api/v1/automation/escalation/logs',
            alerts: '/api/v1/automation/escalation/alerts',
            atRiskOrders: '/api/v1/automation/escalation/at-risk-orders'
          }
        }
      },
      configuration: {
        DISABLE_AUTONOMOUS_AGENTS: process.env.DISABLE_AUTONOMOUS_AGENTS || 'false',
        AUTO_START_AUTOMATION: process.env.AUTO_START_AUTOMATION || 'false',
        environment: process.env.NODE_ENV || 'development'
      },
      instructions: {
        enableAutomation: 'Set DISABLE_AUTONOMOUS_AGENTS=false in environment configuration',
        enableAutoStart: 'Set AUTO_START_AUTOMATION=true to start engines on deployment',
        manualStart: 'Use POST /api/v1/automation/start-all to start all engines',
        manualStop: 'Use POST /api/v1/automation/stop-all to stop all engines'
      },
      documentation: '/api-docs#automation',
      timestamp: new Date().toISOString()
    };

    res.json(availability);
  } catch (error) {
    console.error('Error getting automation availability:', error);
    res.status(500).json({
      error: 'Failed to get availability',
      details: error.message
    });
  }
});

/**
 * IMPLEMENTATION NOTES:
 *
 * 1. Apply the createServiceDisabledResponse() helper to all endpoints
 * 2. Use 200 + available:false for read operations (status, stats)
 * 3. Use 503 for control operations (start, stop) that can't degrade gracefully
 * 4. Add the /availability endpoint to help frontends adapt
 * 5. Include clear instructions in all error responses
 *
 * Benefits:
 * - Better developer experience
 * - Self-documenting API
 * - Frontends can adapt gracefully
 * - Clear error messages guide users
 * - No breaking changes (still returns proper status codes)
 */

module.exports = router;
