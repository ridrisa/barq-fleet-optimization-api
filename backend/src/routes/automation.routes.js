/**
 * Automation API Routes
 *
 * Provides REST API endpoints for Phase 4 Automation services:
 * - Auto-Dispatch Engine
 * - Dynamic Route Optimization
 * - Smart Batching Engine
 * - Autonomous Escalation Engine
 */

const express = require('express');
const router = express.Router();
const postgresService = require('../services/postgres.service');

// Import automation services (will be initialized on app start)
let autoDispatchEngine = null;
let dynamicRouteOptimizer = null;
let smartBatchingEngine = null;
let autonomousEscalationEngine = null;

/**
 * Initialize automation engines
 * Called from app.js on server start
 */
router.initializeEngines = (engines) => {
  autoDispatchEngine = engines.autoDispatch;
  dynamicRouteOptimizer = engines.routeOptimizer;
  smartBatchingEngine = engines.smartBatching;
  autonomousEscalationEngine = engines.escalation;
};

// =============================================================================
// AUTO-DISPATCH ENGINE ROUTES
// =============================================================================

/**
 * @route   POST /api/v1/automation/dispatch/start
 * @desc    Start the auto-dispatch engine
 * @access  Private (Admin only)
 */
router.post('/dispatch/start', async (req, res) => {
  try {
    if (!autoDispatchEngine) {
      return res.status(503).json({ error: 'Auto-dispatch engine not initialized' });
    }

    if (autoDispatchEngine.isRunning) {
      return res.status(400).json({ error: 'Auto-dispatch engine is already running' });
    }

    await autoDispatchEngine.start();

    res.json({
      success: true,
      message: 'Auto-dispatch engine started successfully',
      config: {
        checkInterval: '10 seconds',
        offerTimeout: `${autoDispatchEngine.offerTimeout} seconds`,
        maxOffersPerOrder: autoDispatchEngine.maxOffersPerOrder
      }
    });
  } catch (error) {
    console.error('Error starting auto-dispatch engine:', error);
    res.status(500).json({ error: 'Failed to start auto-dispatch engine', details: error.message });
  }
});

/**
 * @route   POST /api/v1/automation/dispatch/stop
 * @desc    Stop the auto-dispatch engine
 * @access  Private (Admin only)
 */
router.post('/dispatch/stop', async (req, res) => {
  try {
    if (!autoDispatchEngine) {
      return res.status(503).json({ error: 'Auto-dispatch engine not initialized' });
    }

    if (!autoDispatchEngine.isRunning) {
      return res.status(400).json({ error: 'Auto-dispatch engine is not running' });
    }

    await autoDispatchEngine.stop();

    res.json({
      success: true,
      message: 'Auto-dispatch engine stopped successfully'
    });
  } catch (error) {
    console.error('Error stopping auto-dispatch engine:', error);
    res.status(500).json({ error: 'Failed to stop auto-dispatch engine', details: error.message });
  }
});

/**
 * @route   GET /api/v1/automation/dispatch/status
 * @desc    Get auto-dispatch engine status
 * @access  Private
 */
router.get('/dispatch/status', async (req, res) => {
  try {
    if (!autoDispatchEngine) {
      return res.status(503).json({ error: 'Auto-dispatch engine not initialized' });
    }

    res.json({
      isRunning: autoDispatchEngine.isRunning,
      config: {
        checkInterval: '10 seconds',
        offerTimeout: autoDispatchEngine.offerTimeout,
        maxOffersPerOrder: autoDispatchEngine.maxOffersPerOrder
      }
    });
  } catch (error) {
    console.error('Error getting auto-dispatch status:', error);
    res.status(500).json({ error: 'Failed to get status', details: error.message });
  }
});

/**
 * @route   GET /api/v1/automation/dispatch/stats
 * @desc    Get auto-dispatch statistics
 * @access  Private
 */
router.get('/dispatch/stats', async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const stats = await postgresService.query(`
      SELECT * FROM auto_dispatch_stats
      WHERE date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      ORDER BY date DESC
    `);

    // Get today's real-time stats
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
      historical: stats.rows,
      today: todayStats.rows[0],
      period: `${days} days`
    });
  } catch (error) {
    console.error('Error getting auto-dispatch stats:', error);
    res.status(500).json({ error: 'Failed to get stats', details: error.message });
  }
});

/**
 * @route   POST /api/v1/automation/dispatch/assign/:orderId
 * @desc    Manually trigger auto-dispatch for a specific order
 * @access  Private
 */
router.post('/dispatch/assign/:orderId', async (req, res) => {
  try {
    if (!autoDispatchEngine) {
      return res.status(503).json({ error: 'Auto-dispatch engine not initialized' });
    }

    const { orderId } = req.params;

    const assignedDriver = await autoDispatchEngine.assignOrder(parseInt(orderId));

    if (!assignedDriver) {
      return res.status(404).json({ error: 'No eligible drivers found for this order' });
    }

    res.json({
      success: true,
      message: 'Order assigned successfully',
      driver: {
        id: assignedDriver.id,
        name: assignedDriver.name,
        score: assignedDriver.totalScore,
        breakdown: assignedDriver.scores
      }
    });
  } catch (error) {
    console.error('Error manually assigning order:', error);
    res.status(500).json({ error: 'Failed to assign order', details: error.message });
  }
});

// =============================================================================
// DYNAMIC ROUTE OPTIMIZATION ROUTES
// =============================================================================

/**
 * @route   POST /api/v1/automation/routes/start
 * @desc    Start the dynamic route optimizer
 * @access  Private (Admin only)
 */
router.post('/routes/start', async (req, res) => {
  try {
    if (!dynamicRouteOptimizer) {
      return res.status(503).json({ error: 'Route optimizer not initialized' });
    }

    if (dynamicRouteOptimizer.isRunning) {
      return res.status(400).json({ error: 'Route optimizer is already running' });
    }

    await dynamicRouteOptimizer.start();

    res.json({
      success: true,
      message: 'Dynamic route optimizer started successfully',
      config: {
        optimizationInterval: '5 minutes',
        improvementThreshold: `${dynamicRouteOptimizer.improvementThreshold}%`,
        trafficCheckInterval: '1 minute'
      }
    });
  } catch (error) {
    console.error('Error starting route optimizer:', error);
    res.status(500).json({ error: 'Failed to start route optimizer', details: error.message });
  }
});

/**
 * @route   POST /api/v1/automation/routes/stop
 * @desc    Stop the dynamic route optimizer
 * @access  Private (Admin only)
 */
router.post('/routes/stop', async (req, res) => {
  try {
    if (!dynamicRouteOptimizer) {
      return res.status(503).json({ error: 'Route optimizer not initialized' });
    }

    if (!dynamicRouteOptimizer.isRunning) {
      return res.status(400).json({ error: 'Route optimizer is not running' });
    }

    await dynamicRouteOptimizer.stop();

    res.json({
      success: true,
      message: 'Dynamic route optimizer stopped successfully'
    });
  } catch (error) {
    console.error('Error stopping route optimizer:', error);
    res.status(500).json({ error: 'Failed to stop route optimizer', details: error.message });
  }
});

/**
 * @route   GET /api/v1/automation/routes/status
 * @desc    Get route optimizer status
 * @access  Private
 */
router.get('/routes/status', async (req, res) => {
  try {
    if (!dynamicRouteOptimizer) {
      return res.status(503).json({ error: 'Route optimizer not initialized' });
    }

    res.json({
      isRunning: dynamicRouteOptimizer.isRunning,
      config: {
        optimizationInterval: '5 minutes',
        improvementThreshold: dynamicRouteOptimizer.improvementThreshold,
        trafficCheckInterval: '1 minute'
      }
    });
  } catch (error) {
    console.error('Error getting route optimizer status:', error);
    res.status(500).json({ error: 'Failed to get status', details: error.message });
  }
});

/**
 * @route   GET /api/v1/automation/routes/stats
 * @desc    Get route optimization statistics
 * @access  Private
 */
router.get('/routes/stats', async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const stats = await postgresService.query(`
      SELECT * FROM route_optimization_stats
      WHERE date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      ORDER BY date DESC
    `);

    // Get today's real-time stats
    const todayStats = await postgresService.query(`
      SELECT
        COUNT(*) AS total_optimizations,
        SUM(distance_saved_km) AS total_distance_saved_km,
        SUM(time_saved_minutes) AS total_time_saved_minutes,
        AVG(distance_saved_km) AS avg_distance_saved_km,
        AVG(time_saved_minutes) AS avg_time_saved_minutes,
        SUM(stops_reordered) AS total_stops_reordered
      FROM route_optimizations
      WHERE DATE(optimized_at) = CURRENT_DATE
    `);

    // Get active traffic incidents
    const trafficIncidents = await postgresService.query(`
      SELECT
        id, latitude, longitude, severity,
        reported_at, resolved_at
      FROM traffic_incidents
      WHERE active = true
      ORDER BY reported_at DESC
      LIMIT 20
    `);

    res.json({
      historical: stats.rows,
      today: todayStats.rows[0],
      activeIncidents: trafficIncidents.rows,
      period: `${days} days`
    });
  } catch (error) {
    console.error('Error getting route optimization stats:', error);
    res.status(500).json({ error: 'Failed to get stats', details: error.message });
  }
});

/**
 * @route   POST /api/v1/automation/routes/optimize/:driverId
 * @desc    Manually trigger route optimization for a driver
 * @access  Private
 */
router.post('/routes/optimize/:driverId', async (req, res) => {
  try {
    if (!dynamicRouteOptimizer) {
      return res.status(503).json({ error: 'Route optimizer not initialized' });
    }

    const { driverId } = req.params;

    const result = await dynamicRouteOptimizer.optimizeDriverIfBeneficial({
      id: parseInt(driverId)
    });

    if (!result.optimized) {
      return res.json({
        success: false,
        message: 'No significant improvement found',
        improvement: result.improvement
      });
    }

    res.json({
      success: true,
      message: 'Route optimized successfully',
      improvement: {
        distanceSaved: result.improvement.distanceSaved,
        timeSaved: result.improvement.timeSaved,
        percentageSaved: result.improvement.percentageSaved
      },
      newRoute: result.route
    });
  } catch (error) {
    console.error('Error manually optimizing route:', error);
    res.status(500).json({ error: 'Failed to optimize route', details: error.message });
  }
});

/**
 * @route   POST /api/v1/automation/routes/traffic-incident
 * @desc    Report a traffic incident
 * @access  Private
 */
router.post('/routes/traffic-incident', async (req, res) => {
  try {
    const { location, severity, description, affectedRadius } = req.body;

    if (!location || !location.lat || !location.lng || !severity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await postgresService.query(`
      INSERT INTO traffic_incidents (latitude, longitude, severity, description, affected_radius_meters, active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING *
    `, [location.lat, location.lng, severity, description || null, affectedRadius || 500]);

    const incident = result.rows[0];

    // Trigger rerouting if optimizer is running
    if (dynamicRouteOptimizer && dynamicRouteOptimizer.isRunning) {
      await dynamicRouteOptimizer.handleTrafficIncident(incident);
    }

    res.json({
      success: true,
      message: 'Traffic incident reported and drivers rerouted',
      incident: incident
    });
  } catch (error) {
    console.error('Error reporting traffic incident:', error);
    res.status(500).json({ error: 'Failed to report incident', details: error.message });
  }
});

// =============================================================================
// SMART BATCHING ENGINE ROUTES
// =============================================================================

/**
 * @route   POST /api/v1/automation/batching/start
 * @desc    Start the smart batching engine
 * @access  Private (Admin only)
 */
router.post('/batching/start', async (req, res) => {
  try {
    if (!smartBatchingEngine) {
      return res.status(503).json({ error: 'Smart batching engine not initialized' });
    }

    if (smartBatchingEngine.isRunning) {
      return res.status(400).json({ error: 'Smart batching engine is already running' });
    }

    await smartBatchingEngine.start();

    res.json({
      success: true,
      message: 'Smart batching engine started successfully',
      config: {
        batchingInterval: '10 minutes',
        minOrdersInBatch: smartBatchingEngine.minOrdersInBatch,
        maxOrdersInBatch: smartBatchingEngine.maxOrdersInBatch,
        maxDistanceKm: smartBatchingEngine.maxDistance / 1000
      }
    });
  } catch (error) {
    console.error('Error starting smart batching engine:', error);
    res.status(500).json({ error: 'Failed to start smart batching engine', details: error.message });
  }
});

/**
 * @route   POST /api/v1/automation/batching/stop
 * @desc    Stop the smart batching engine
 * @access  Private (Admin only)
 */
router.post('/batching/stop', async (req, res) => {
  try {
    if (!smartBatchingEngine) {
      return res.status(503).json({ error: 'Smart batching engine not initialized' });
    }

    if (!smartBatchingEngine.isRunning) {
      return res.status(400).json({ error: 'Smart batching engine is not running' });
    }

    await smartBatchingEngine.stop();

    res.json({
      success: true,
      message: 'Smart batching engine stopped successfully'
    });
  } catch (error) {
    console.error('Error stopping smart batching engine:', error);
    res.status(500).json({ error: 'Failed to stop smart batching engine', details: error.message });
  }
});

/**
 * @route   GET /api/v1/automation/batching/status
 * @desc    Get smart batching engine status
 * @access  Private
 */
router.get('/batching/status', async (req, res) => {
  try {
    if (!smartBatchingEngine) {
      return res.status(503).json({ error: 'Smart batching engine not initialized' });
    }

    res.json({
      isRunning: smartBatchingEngine.isRunning,
      config: {
        batchingInterval: '10 minutes',
        minOrdersInBatch: smartBatchingEngine.minOrdersInBatch,
        maxOrdersInBatch: smartBatchingEngine.maxOrdersInBatch,
        maxDistanceKm: smartBatchingEngine.maxDistance / 1000
      }
    });
  } catch (error) {
    console.error('Error getting smart batching status:', error);
    res.status(500).json({ error: 'Failed to get status', details: error.message });
  }
});

/**
 * @route   GET /api/v1/automation/batching/stats
 * @desc    Get smart batching statistics
 * @access  Private
 */
router.get('/batching/stats', async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const stats = await postgresService.query(`
      SELECT * FROM batch_performance_stats
      WHERE date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      ORDER BY date DESC
    `);

    // Get today's real-time stats
    const todayStats = await postgresService.query(`
      SELECT
        COUNT(*) AS total_batches,
        SUM(order_count) AS total_orders_batched,
        AVG(order_count) AS avg_orders_per_batch
      FROM order_batches
      WHERE DATE(created_at) = CURRENT_DATE
    `);

    // Get active batches
    const activeBatches = await postgresService.query(`
      SELECT
        ob.id, ob.batch_number, ob.order_count,
        ob.status, ob.created_at
      FROM order_batches ob
      WHERE ob.status IN ('pending', 'processing')
      ORDER BY ob.created_at DESC
      LIMIT 20
    `);

    res.json({
      historical: stats.rows,
      today: todayStats.rows[0],
      activeBatches: activeBatches.rows,
      period: `${days} days`
    });
  } catch (error) {
    console.error('Error getting smart batching stats:', error);
    res.status(500).json({ error: 'Failed to get stats', details: error.message });
  }
});

/**
 * @route   POST /api/v1/automation/batching/process
 * @desc    Manually trigger batch processing
 * @access  Private
 */
router.post('/batching/process', async (req, res) => {
  try {
    if (!smartBatchingEngine) {
      return res.status(503).json({ error: 'Smart batching engine not initialized' });
    }

    const result = await smartBatchingEngine.processBatchingOpportunities();

    res.json({
      success: true,
      message: 'Batch processing completed',
      batchesCreated: result.batchesCreated || 0,
      ordersAssigned: result.ordersAssigned || 0
    });
  } catch (error) {
    console.error('Error processing batches:', error);
    res.status(500).json({ error: 'Failed to process batches', details: error.message });
  }
});

/**
 * @route   GET /api/v1/automation/batching/batch/:batchId
 * @desc    Get details of a specific batch
 * @access  Private
 */
router.get('/batching/batch/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;

    const batch = await postgresService.query(`
      SELECT
        ob.*,
        d.name AS driver_name,
        d.phone AS driver_phone,
        json_agg(
          json_build_object(
            'orderId', o.id,
            'orderNumber', o.order_number,
            'status', o.status,
            'pickupAddress', o.pickup_address,
            'dropoffAddress', o.dropoff_address,
            'customerName', o.customer_name
          )
        ) AS orders
      FROM order_batches ob
      LEFT JOIN drivers d ON d.id = ob.driver_id
      LEFT JOIN orders o ON o.batch_id = ob.id
      WHERE ob.id = $1
      GROUP BY ob.id, d.name, d.phone
    `, [batchId]);

    if (batch.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    res.json(batch.rows[0]);
  } catch (error) {
    console.error('Error getting batch details:', error);
    res.status(500).json({ error: 'Failed to get batch details', details: error.message });
  }
});

// =============================================================================
// AUTONOMOUS ESCALATION ENGINE ROUTES
// =============================================================================

/**
 * @route   POST /api/v1/automation/escalation/start
 * @desc    Start the autonomous escalation engine
 * @access  Private (Admin only)
 */
router.post('/escalation/start', async (req, res) => {
  try {
    if (!autonomousEscalationEngine) {
      return res.status(503).json({ error: 'Escalation engine not initialized' });
    }

    if (autonomousEscalationEngine.isRunning) {
      return res.status(400).json({ error: 'Escalation engine is already running' });
    }

    await autonomousEscalationEngine.start();

    res.json({
      success: true,
      message: 'Autonomous escalation engine started successfully',
      config: {
        checkInterval: '1 minute',
        thresholds: autonomousEscalationEngine.thresholds
      }
    });
  } catch (error) {
    console.error('Error starting escalation engine:', error);
    res.status(500).json({ error: 'Failed to start escalation engine', details: error.message });
  }
});

/**
 * @route   POST /api/v1/automation/escalation/stop
 * @desc    Stop the autonomous escalation engine
 * @access  Private (Admin only)
 */
router.post('/escalation/stop', async (req, res) => {
  try {
    if (!autonomousEscalationEngine) {
      return res.status(503).json({ error: 'Escalation engine not initialized' });
    }

    if (!autonomousEscalationEngine.isRunning) {
      return res.status(400).json({ error: 'Escalation engine is not running' });
    }

    await autonomousEscalationEngine.stop();

    res.json({
      success: true,
      message: 'Autonomous escalation engine stopped successfully'
    });
  } catch (error) {
    console.error('Error stopping escalation engine:', error);
    res.status(500).json({ error: 'Failed to stop escalation engine', details: error.message });
  }
});

/**
 * @route   GET /api/v1/automation/escalation/status
 * @desc    Get escalation engine status
 * @access  Private
 */
router.get('/escalation/status', async (req, res) => {
  try {
    if (!autonomousEscalationEngine) {
      return res.status(503).json({ error: 'Escalation engine not initialized' });
    }

    res.json({
      isRunning: autonomousEscalationEngine.isRunning,
      config: {
        checkInterval: '1 minute',
        thresholds: autonomousEscalationEngine.thresholds
      }
    });
  } catch (error) {
    console.error('Error getting escalation engine status:', error);
    res.status(500).json({ error: 'Failed to get status', details: error.message });
  }
});

/**
 * @route   GET /api/v1/automation/escalation/stats
 * @desc    Get escalation statistics
 * @access  Private
 */
router.get('/escalation/stats', async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const stats = await postgresService.query(`
      SELECT * FROM escalation_stats
      WHERE date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      ORDER BY date DESC
    `);

    // Get today's real-time stats
    const todayStats = await postgresService.query(`
      SELECT
        COUNT(*) AS total_escalations,
        COUNT(*) FILTER (WHERE escalation_type = 'SLA_RISK') AS sla_risk_escalations,
        COUNT(*) FILTER (WHERE escalation_type = 'STUCK_ORDER') AS stuck_order_escalations,
        COUNT(*) FILTER (WHERE escalation_type = 'UNRESPONSIVE_DRIVER') AS unresponsive_driver_escalations,
        COUNT(*) FILTER (WHERE escalation_type = 'FAILED_DELIVERY') AS failed_delivery_escalations
      FROM escalation_logs
      WHERE DATE(created_at) = CURRENT_DATE
    `);

    res.json({
      historical: stats.rows,
      today: todayStats.rows[0],
      period: `${days} days`
    });
  } catch (error) {
    console.error('Error getting escalation stats:', error);
    res.status(500).json({ error: 'Failed to get stats', details: error.message });
  }
});

/**
 * @route   GET /api/v1/automation/escalation/logs
 * @desc    Get recent escalation logs
 * @access  Private
 */
router.get('/escalation/logs', async (req, res) => {
  try {
    const { limit = 50, offset = 0, type, severity } = req.query;

    let query = `
      SELECT
        el.id, el.order_id, el.escalation_type, el.severity, el.reason,
        el.escalated_to, el.status, el.resolution, el.escalated_at, el.resolved_at,
        el.created_at, el.metadata
      FROM escalation_logs el
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (type) {
      query += ` AND el.escalation_type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    if (severity) {
      query += ` AND el.metadata->>'severity' = $${paramCount}`;
      params.push(severity);
      paramCount++;
    }

    query += ` ORDER BY el.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const logs = await postgresService.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM escalation_logs WHERE 1=1';
    const countParams = [];
    let countParamNum = 1;

    if (type) {
      countQuery += ` AND escalation_type = $${countParamNum}`;
      countParams.push(type);
      countParamNum++;
    }

    if (severity) {
      countQuery += ` AND metadata->>'severity' = $${countParamNum}`;
      countParams.push(severity);
    }

    const countResult = await postgresService.query(countQuery, countParams);

    res.json({
      logs: logs.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < parseInt(countResult.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Error getting escalation logs:', error);
    res.status(500).json({ error: 'Failed to get escalation logs', details: error.message });
  }
});

/**
 * @route   GET /api/v1/automation/escalation/alerts
 * @desc    Get active dispatch alerts (require human intervention)
 * @access  Private
 */
router.get('/escalation/alerts', async (req, res) => {
  try {
    const { resolved = 'false' } = req.query;
    const isResolved = resolved === 'true';

    const alerts = await postgresService.query(`
      SELECT
        id, order_id, alert_type, severity, message,
        resolved, resolved_at, created_at, metadata
      FROM dispatch_alerts
      WHERE resolved = $1
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        created_at ASC
      LIMIT 100
    `, [isResolved]);

    res.json({
      alerts: alerts.rows,
      count: alerts.rows.length
    });
  } catch (error) {
    console.error('Error getting dispatch alerts:', error);
    res.status(500).json({ error: 'Failed to get alerts', details: error.message });
  }
});

/**
 * @route   POST /api/v1/automation/escalation/alerts/:alertId/resolve
 * @desc    Mark a dispatch alert as resolved
 * @access  Private
 */
router.post('/escalation/alerts/:alertId/resolve', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { resolution, notes } = req.body;

    const result = await postgresService.query(`
      UPDATE dispatch_alerts
      SET
        status = 'RESOLVED',
        resolved_at = NOW(),
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{resolution}',
          to_jsonb($1::text)
        ),
        metadata = jsonb_set(
          metadata,
          '{resolvedNotes}',
          to_jsonb($2::text)
        )
      WHERE id = $3
      RETURNING *
    `, [resolution, notes || '', alertId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({
      success: true,
      message: 'Alert resolved successfully',
      alert: result.rows[0]
    });
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({ error: 'Failed to resolve alert', details: error.message });
  }
});

/**
 * @route   GET /api/v1/automation/escalation/at-risk-orders
 * @desc    Get orders currently at risk of SLA breach
 * @access  Private
 */
router.get('/escalation/at-risk-orders', async (req, res) => {
  try {
    const atRiskOrders = await postgresService.query(`
      SELECT
        id, order_id, escalation_type, severity,
        reason, escalated_to, status, escalated_at, metadata
      FROM escalation_logs
      WHERE status IN ('open', 'investigating')
        AND severity IN ('high', 'critical')
      ORDER BY escalated_at ASC
      LIMIT 50
    `);

    res.json({
      atRiskOrders: atRiskOrders.rows,
      count: atRiskOrders.rows.length,
      breakdown: {
        critical: atRiskOrders.rows.filter(o => o.risk_level === 'CRITICAL').length,
        high: atRiskOrders.rows.filter(o => o.risk_level === 'HIGH').length,
        medium: atRiskOrders.rows.filter(o => o.risk_level === 'MEDIUM').length
      }
    });
  } catch (error) {
    console.error('Error getting at-risk orders:', error);
    res.status(500).json({ error: 'Failed to get at-risk orders', details: error.message });
  }
});

// =============================================================================
// MASTER CONTROL ROUTES
// =============================================================================

/**
 * @route   POST /api/v1/automation/start-all
 * @desc    Start all automation engines
 * @access  Private (Admin only)
 */
router.post('/start-all', async (req, res) => {
  try {
    const results = {};

    // Start auto-dispatch
    if (autoDispatchEngine && !autoDispatchEngine.isRunning) {
      await autoDispatchEngine.start();
      results.autoDispatch = 'started';
    } else {
      results.autoDispatch = 'already running';
    }

    // Start route optimizer
    if (dynamicRouteOptimizer && !dynamicRouteOptimizer.isRunning) {
      await dynamicRouteOptimizer.start();
      results.routeOptimizer = 'started';
    } else {
      results.routeOptimizer = 'already running';
    }

    // Start smart batching
    if (smartBatchingEngine && !smartBatchingEngine.isRunning) {
      await smartBatchingEngine.start();
      results.smartBatching = 'started';
    } else {
      results.smartBatching = 'already running';
    }

    // Start escalation
    if (autonomousEscalationEngine && !autonomousEscalationEngine.isRunning) {
      await autonomousEscalationEngine.start();
      results.escalation = 'started';
    } else {
      results.escalation = 'already running';
    }

    res.json({
      success: true,
      message: 'All automation engines started',
      engines: results
    });
  } catch (error) {
    console.error('Error starting all automation engines:', error);
    res.status(500).json({ error: 'Failed to start all engines', details: error.message });
  }
});

/**
 * @route   POST /api/v1/automation/stop-all
 * @desc    Stop all automation engines
 * @access  Private (Admin only)
 */
router.post('/stop-all', async (req, res) => {
  try {
    const results = {};

    // Stop auto-dispatch
    if (autoDispatchEngine && autoDispatchEngine.isRunning) {
      await autoDispatchEngine.stop();
      results.autoDispatch = 'stopped';
    } else {
      results.autoDispatch = 'not running';
    }

    // Stop route optimizer
    if (dynamicRouteOptimizer && dynamicRouteOptimizer.isRunning) {
      await dynamicRouteOptimizer.stop();
      results.routeOptimizer = 'stopped';
    } else {
      results.routeOptimizer = 'not running';
    }

    // Stop smart batching
    if (smartBatchingEngine && smartBatchingEngine.isRunning) {
      await smartBatchingEngine.stop();
      results.smartBatching = 'stopped';
    } else {
      results.smartBatching = 'not running';
    }

    // Stop escalation
    if (autonomousEscalationEngine && autonomousEscalationEngine.isRunning) {
      await autonomousEscalationEngine.stop();
      results.escalation = 'stopped';
    } else {
      results.escalation = 'not running';
    }

    res.json({
      success: true,
      message: 'All automation engines stopped',
      engines: results
    });
  } catch (error) {
    console.error('Error stopping all automation engines:', error);
    res.status(500).json({ error: 'Failed to stop all engines', details: error.message });
  }
});

/**
 * @route   GET /api/v1/automation/status-all
 * @desc    Get status of all automation engines
 * @access  Private
 */
router.get('/status-all', async (req, res) => {
  try {
    res.json({
      autoDispatch: {
        isRunning: autoDispatchEngine ? autoDispatchEngine.isRunning : false,
        initialized: !!autoDispatchEngine
      },
      routeOptimizer: {
        isRunning: dynamicRouteOptimizer ? dynamicRouteOptimizer.isRunning : false,
        initialized: !!dynamicRouteOptimizer
      },
      smartBatching: {
        isRunning: smartBatchingEngine ? smartBatchingEngine.isRunning : false,
        initialized: !!smartBatchingEngine
      },
      escalation: {
        isRunning: autonomousEscalationEngine ? autonomousEscalationEngine.isRunning : false,
        initialized: !!autonomousEscalationEngine
      }
    });
  } catch (error) {
    console.error('Error getting automation status:', error);
    res.status(500).json({ error: 'Failed to get status', details: error.message });
  }
});

/**
 * @route   GET /api/v1/automation/dashboard
 * @desc    Get comprehensive automation dashboard data
 * @access  Private
 */
router.get('/dashboard', async (req, res) => {
  try {
    // Get today's stats for all engines
    const [dispatchStats, routeStats, batchingStats, escalationStats] = await Promise.all([
      postgresService.query(`
        SELECT
          COUNT(*) AS total_assignments,
          COUNT(*) FILTER (WHERE assignment_type = 'AUTO_ASSIGNED') AS auto_assigned,
          AVG(total_score) AS avg_score
        FROM assignment_logs
        WHERE DATE(assigned_at) = CURRENT_DATE
      `),
      postgresService.query(`
        SELECT
          COUNT(*) AS total_optimizations,
          SUM(distance_saved_km) AS distance_saved_km,
          SUM(time_saved_minutes) AS time_saved_minutes
        FROM route_optimizations
        WHERE DATE(optimized_at) = CURRENT_DATE
      `),
      postgresService.query(`
        SELECT
          COUNT(*) AS total_batches,
          SUM(order_count) AS orders_batched
        FROM order_batches
        WHERE DATE(created_at) = CURRENT_DATE
      `),
      postgresService.query(`
        SELECT
          COUNT(*) AS total_escalations,
          COUNT(*) FILTER (WHERE escalation_type = 'SLA_RISK') AS sla_risk
        FROM escalation_logs
        WHERE DATE(created_at) = CURRENT_DATE
      `)
    ]);

    // Get active alerts count
    const alertsCount = await postgresService.query(`
      SELECT COUNT(*) FROM dispatch_alerts WHERE resolved = FALSE
    `);

    // Get at-risk orders count (from escalation_logs)
    const atRiskCount = await postgresService.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE severity IN ('high', 'critical')
        ) AS critical
      FROM escalation_logs
      WHERE status IN ('open', 'investigating')
    `);

    res.json({
      engines: {
        autoDispatch: autoDispatchEngine ? autoDispatchEngine.isRunning : false,
        routeOptimizer: dynamicRouteOptimizer ? dynamicRouteOptimizer.isRunning : false,
        smartBatching: smartBatchingEngine ? smartBatchingEngine.isRunning : false,
        escalation: autonomousEscalationEngine ? autonomousEscalationEngine.isRunning : false
      },
      summary: {
        totalAssignments: parseInt(dispatchStats.rows[0].total_assignments) || 0,
        totalOptimizations: parseInt(routeStats.rows[0].total_optimizations) || 0,
        totalBatches: parseInt(batchingStats.rows[0].total_batches) || 0,
        totalEscalations: parseInt(escalationStats.rows[0].total_escalations) || 0,
        activeAlerts: parseInt(alertsCount.rows[0].count) || 0
      },
      today: {
        dispatch: dispatchStats.rows[0],
        routes: routeStats.rows[0],
        batching: batchingStats.rows[0],
        escalation: escalationStats.rows[0]
      },
      alerts: {
        pending: parseInt(alertsCount.rows[0].count),
        atRiskOrders: parseInt(atRiskCount.rows[0].total),
        criticalRiskOrders: parseInt(atRiskCount.rows[0].critical)
      },
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error getting automation dashboard:', error);
    res.status(500).json({ error: 'Failed to get dashboard data', details: error.message });
  }
});

module.exports = router;
