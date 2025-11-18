/**
 * Analytics Lab API Routes
 *
 * Provides endpoints for executing and managing Python analytics scripts
 * from the frontend UI.
 */

const express = require('express');
const router = express.Router();
const pythonAnalytics = require('../../services/python-analytics.service');
const { logger } = require('../../utils/logger');

/**
 * POST /api/v1/analytics-lab/run/route-analysis
 * Execute route efficiency analysis
 */
router.post('/run/route-analysis', async (req, res) => {
  try {
    const params = req.body;

    logger.info('[AnalyticsLab] Route analysis requested', { params });

    const result = await pythonAnalytics.runRouteAnalysis(params);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('[AnalyticsLab] Route analysis failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/analytics-lab/run/fleet-performance
 * Execute fleet performance analysis
 */
router.post('/run/fleet-performance', async (req, res) => {
  try {
    const params = req.body;

    logger.info('[AnalyticsLab] Fleet performance analysis requested', { params });

    const result = await pythonAnalytics.runFleetPerformance(params);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('[AnalyticsLab] Fleet performance analysis failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/analytics-lab/run/demand-forecast
 * Execute demand forecasting
 */
router.post('/run/demand-forecast', async (req, res) => {
  try {
    const params = req.body;

    logger.info('[AnalyticsLab] Demand forecast requested', { params });

    const result = await pythonAnalytics.runDemandForecast(params);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('[AnalyticsLab] Demand forecast failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/analytics-lab/run/sla-analysis
 * Execute SLA analysis
 */
router.post('/run/sla-analysis', async (req, res) => {
  try {
    const params = req.body;

    logger.info('[AnalyticsLab] SLA analysis requested', { params });

    const result = await pythonAnalytics.runSLAAnalysis(params);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('[AnalyticsLab] SLA analysis failed', {
      error: error.message,
      stack: error.stack
    });

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
    const { jobId } = req.params;

    const jobStatus = pythonAnalytics.getJobStatus(jobId);

    res.json({
      success: true,
      job: jobStatus
    });
  } catch (error) {
    logger.error('[AnalyticsLab] Failed to get job status', {
      error: error.message
    });

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

    const history = pythonAnalytics.getJobHistory(limit);

    res.json({
      success: true,
      jobs: history,
      total: history.length
    });
  } catch (error) {
    logger.error('[AnalyticsLab] Failed to get job history', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/analytics-lab/jobs/running
 * Get currently running jobs
 */
router.get('/jobs/running', (req, res) => {
  try {
    const runningJobs = pythonAnalytics.getRunningJobs();

    res.json({
      success: true,
      jobs: runningJobs,
      total: runningJobs.length
    });
  } catch (error) {
    logger.error('[AnalyticsLab] Failed to get running jobs', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/analytics-lab/environment
 * Test Python environment
 */
router.get('/environment', async (req, res) => {
  try {
    const envInfo = await pythonAnalytics.testEnvironment();

    res.json({
      success: true,
      environment: envInfo
    });
  } catch (error) {
    logger.error('[AnalyticsLab] Environment test failed', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Python environment not configured properly'
    });
  }
});

/**
 * GET /api/v1/analytics-lab/dashboard
 * Get dashboard overview
 */
router.get('/dashboard', (req, res) => {
  try {
    const runningJobs = pythonAnalytics.getRunningJobs();
    const history = pythonAnalytics.getJobHistory(10);

    // Calculate statistics
    const totalJobs = history.length;
    const completedJobs = history.filter(j => j.status === 'completed').length;
    const failedJobs = history.filter(j => j.status === 'failed').length;

    const avgDuration = history.length > 0
      ? history.reduce((sum, j) => sum + (j.duration || 0), 0) / history.length
      : 0;

    res.json({
      success: true,
      dashboard: {
        running_jobs: runningJobs.length,
        total_jobs: totalJobs,
        completed_jobs: completedJobs,
        failed_jobs: failedJobs,
        success_rate: totalJobs > 0 ? (completedJobs / totalJobs * 100).toFixed(1) : 0,
        avg_duration: avgDuration.toFixed(2),
        recent_jobs: history.slice(0, 5)
      }
    });
  } catch (error) {
    logger.error('[AnalyticsLab] Dashboard failed', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
