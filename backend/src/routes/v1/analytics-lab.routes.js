/**
 * Analytics Lab API Routes
 *
 * Provides HTTP endpoints for running Python analytics scripts
 * and retrieving results through the PythonAnalyticsService.
 */

const express = require('express');
const router = express.Router();
const pythonAnalyticsService = require('../../services/python-analytics.service');
const { logger } = require('../../utils/logger');

/**
 * GET /api/v1/analytics-lab/dashboard
 * Get dashboard data with job history, running jobs, and system health
 */
router.get('/dashboard', async (req, res) => {
  try {
    const dashboard = {
      runningJobs: pythonAnalyticsService.getRunningJobs(),
      recentJobs: pythonAnalyticsService.getJobHistory(10),
      pythonEnv: await pythonAnalyticsService.testEnvironment(),
      systemStatus: pythonAnalyticsService.getSystemStatus()
    };

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    logger.error('[AnalyticsLab] Dashboard error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/analytics-lab/run/route-analysis
 * Run route analysis script
 */
router.post('/run/route-analysis', async (req, res) => {
  try {
    const params = {
      analysis_type: req.body.analysis_type || 'efficiency',
      date_range: req.body.date_range || 30,
      hub_id: req.body.hub_id || null,
      min_deliveries: req.body.min_deliveries || 10,
      output: 'json'
    };

    const jobInfo = await pythonAnalyticsService.runRouteAnalysis(params);

    logger.info('[AnalyticsLab] Route analysis job started', {
      jobId: jobInfo.jobId,
      params
    });

    res.json({
      success: true,
      data: jobInfo
    });
  } catch (error) {
    logger.error('[AnalyticsLab] Route analysis error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/analytics-lab/run/fleet-performance
 * Run fleet performance analysis script
 */
router.post('/run/fleet-performance', async (req, res) => {
  try {
    const params = {
      analysis_type: req.body.analysis_type || 'courier',
      metric: req.body.metric || 'delivery_rate',
      period: req.body.period || 'monthly',
      driver_id: req.body.driver_id || null,
      vehicle_id: req.body.vehicle_id || null,
      output: 'json'
    };

    const jobInfo = await pythonAnalyticsService.runFleetPerformance(params);

    logger.info('[AnalyticsLab] Fleet performance job started', {
      jobId: jobInfo.jobId,
      params
    });

    res.json({
      success: true,
      data: jobInfo
    });
  } catch (error) {
    logger.error('[AnalyticsLab] Fleet performance error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/analytics-lab/run/demand-forecast
 * Run demand forecasting script
 */
router.post('/run/demand-forecast', async (req, res) => {
  try {
    const params = {
      forecast_type: req.body.forecast_type || 'daily',
      horizon: req.body.horizon || 7,
      hub_id: req.body.hub_id || null,
      output: 'json'
    };

    const jobInfo = await pythonAnalyticsService.runDemandForecast(params);

    logger.info('[AnalyticsLab] Demand forecast job started', {
      jobId: jobInfo.jobId,
      params
    });

    res.json({
      success: true,
      data: jobInfo
    });
  } catch (error) {
    logger.error('[AnalyticsLab] Demand forecast error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/analytics-lab/run/sla-analysis
 * Run SLA analytics script
 */
router.post('/run/sla-analysis', async (req, res) => {
  try {
    const params = {
      analysis_type: req.body.analysis_type || 'compliance',
      date_range: req.body.date_range || 30,
      hub_id: req.body.hub_id || null,
      output: 'json'
    };

    const jobInfo = await pythonAnalyticsService.runSLAAnalysis(params);

    logger.info('[AnalyticsLab] SLA analysis job started', {
      jobId: jobInfo.jobId,
      params
    });

    res.json({
      success: true,
      data: jobInfo
    });
  } catch (error) {
    logger.error('[AnalyticsLab] SLA analysis error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/analytics-lab/job/:jobId
 * Get job status and results
 */
router.get('/job/:jobId', (req, res) => {
  try {
    const jobId = req.params.jobId;
    const jobStatus = pythonAnalyticsService.getJobStatus(jobId);

    if (jobStatus.status === 'not_found') {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: jobStatus
    });
  } catch (error) {
    logger.error('[AnalyticsLab] Get job status error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/analytics-lab/jobs/history
 * Get job history
 */
router.get('/jobs/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = pythonAnalyticsService.getJobHistory(limit);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error('[AnalyticsLab] Get job history error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/analytics-lab/jobs/running
 * Get all running jobs
 */
router.get('/jobs/running', (req, res) => {
  try {
    const runningJobs = pythonAnalyticsService.getRunningJobs();

    res.json({
      success: true,
      data: runningJobs
    });
  } catch (error) {
    logger.error('[AnalyticsLab] Get running jobs error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/analytics-lab/test
 * Test Python environment
 */
router.get('/test', async (req, res) => {
  try {
    const envInfo = await pythonAnalyticsService.testEnvironment();

    res.json({
      success: true,
      data: envInfo
    });
  } catch (error) {
    logger.error('[AnalyticsLab] Test environment error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/analytics-lab/health
 * Get database connectivity health status
 */
router.get('/health', (req, res) => {
  try {
    const health = pythonAnalyticsService.getConnectionHealth();
    const systemStatus = pythonAnalyticsService.getSystemStatus();

    res.json({
      success: true,
      data: {
        database: health,
        system: systemStatus
      }
    });
  } catch (error) {
    logger.error('[AnalyticsLab] Health check error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/analytics-lab/system-status
 * Get comprehensive system status
 */
router.get('/system-status', (req, res) => {
  try {
    const systemStatus = pythonAnalyticsService.getSystemStatus();

    res.json({
      success: true,
      data: systemStatus
    });
  } catch (error) {
    logger.error('[AnalyticsLab] System status error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
