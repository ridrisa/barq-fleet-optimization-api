/**
 * Python Analytics Service
 *
 * Executes Python analytics scripts from gpt-fleet-optimizer/
 * and returns results to the frontend UI.
 */

const { spawn } = require('child_process');
const path = require('path');
const { logger } = require('../utils/logger');

class PythonAnalyticsService {
  constructor() {
    this.pythonPath = 'python3';
    this.scriptsDir = path.join(__dirname, '../../../gpt-fleet-optimizer');
    this.runningJobs = new Map(); // jobId -> { status, output, error }
    this.jobHistory = []; // Array of completed jobs
    this.maxHistorySize = 50;
  }

  /**
   * Generate unique job ID
   */
  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Execute route analyzer script
   * @param {Object} params - Analysis parameters
   * @returns {Promise<Object>} Job info with jobId
   */
  async runRouteAnalysis(params) {
    const {
      analysis_type = 'efficiency',
      date_range = 30,
      hub_id = null,
      min_deliveries = 10,
      output = 'json'
    } = params;

    const args = [
      path.join(this.scriptsDir, 'route_analyzer.py'),
      '--analysis_type', analysis_type,
      '--date_range', date_range.toString(),
      '--output', output
    ];

    if (hub_id) {
      args.push('--hub_id', hub_id.toString());
    }

    if (min_deliveries) {
      args.push('--min_deliveries', min_deliveries.toString());
    }

    const jobId = this.generateJobId();
    const jobInfo = {
      jobId,
      type: 'route_analysis',
      params,
      status: 'running',
      startedAt: new Date(),
      output: '',
      error: '',
      result: null
    };

    this.runningJobs.set(jobId, jobInfo);

    // Execute Python script
    this._executeScript(args, jobId);

    return {
      jobId,
      status: 'running',
      message: 'Route analysis started'
    };
  }

  /**
   * Execute fleet performance script
   * @param {Object} params - Analysis parameters
   * @returns {Promise<Object>} Job info with jobId
   */
  async runFleetPerformance(params) {
    const {
      analysis_type = 'driver',
      metric = 'delivery_rate',
      period = 'monthly',
      driver_id = null,
      vehicle_id = null,
      output = 'json'
    } = params;

    const args = [
      path.join(this.scriptsDir, 'fleet_performance.py'),
      '--analysis_type', analysis_type,
      '--metric', metric,
      '--period', period,
      '--output', output
    ];

    if (driver_id) {
      args.push('--driver_id', driver_id.toString());
    }

    if (vehicle_id) {
      args.push('--vehicle_id', vehicle_id.toString());
    }

    const jobId = this.generateJobId();
    const jobInfo = {
      jobId,
      type: 'fleet_performance',
      params,
      status: 'running',
      startedAt: new Date(),
      output: '',
      error: '',
      result: null
    };

    this.runningJobs.set(jobId, jobInfo);

    // Execute Python script
    this._executeScript(args, jobId);

    return {
      jobId,
      status: 'running',
      message: 'Fleet performance analysis started'
    };
  }

  /**
   * Execute demand forecaster script
   * @param {Object} params - Forecast parameters
   * @returns {Promise<Object>} Job info with jobId
   */
  async runDemandForecast(params) {
    const {
      forecast_type = 'daily',
      horizon = 7,
      hub_id = null,
      output = 'json'
    } = params;

    const args = [
      path.join(this.scriptsDir, 'demand_forecaster.py'),
      '--forecast_type', forecast_type,
      '--horizon', horizon.toString(),
      '--output', output
    ];

    if (hub_id) {
      args.push('--hub_id', hub_id.toString());
    }

    const jobId = this.generateJobId();
    const jobInfo = {
      jobId,
      type: 'demand_forecast',
      params,
      status: 'running',
      startedAt: new Date(),
      output: '',
      error: '',
      result: null
    };

    this.runningJobs.set(jobId, jobInfo);

    // Execute Python script
    this._executeScript(args, jobId);

    return {
      jobId,
      status: 'running',
      message: 'Demand forecast started'
    };
  }

  /**
   * Execute SLA analytics script
   * @param {Object} params - SLA analysis parameters
   * @returns {Promise<Object>} Job info with jobId
   */
  async runSLAAnalysis(params) {
    const {
      analysis_type = 'compliance',
      date_range = 30,
      hub_id = null,
      output = 'json'
    } = params;

    const args = [
      path.join(this.scriptsDir, 'sla_analytics.py'),
      '--analysis_type', analysis_type,
      '--date_range', date_range.toString(),
      '--output', output
    ];

    if (hub_id) {
      args.push('--hub_id', hub_id.toString());
    }

    const jobId = this.generateJobId();
    const jobInfo = {
      jobId,
      type: 'sla_analysis',
      params,
      status: 'running',
      startedAt: new Date(),
      output: '',
      error: '',
      result: null
    };

    this.runningJobs.set(jobId, jobInfo);

    // Execute Python script
    this._executeScript(args, jobId);

    return {
      jobId,
      status: 'running',
      message: 'SLA analysis started'
    };
  }

  /**
   * Get job status and results
   * @param {string} jobId - Job identifier
   * @returns {Object} Job status and results
   */
  getJobStatus(jobId) {
    const job = this.runningJobs.get(jobId);

    if (job) {
      return {
        jobId: job.jobId,
        type: job.type,
        status: job.status,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        duration: job.completedAt
          ? (job.completedAt - job.startedAt) / 1000
          : (Date.now() - job.startedAt) / 1000,
        result: job.result,
        error: job.error
      };
    }

    // Check history
    const historyJob = this.jobHistory.find(j => j.jobId === jobId);
    if (historyJob) {
      return historyJob;
    }

    return {
      jobId,
      status: 'not_found',
      error: 'Job not found'
    };
  }

  /**
   * Get job history
   * @param {number} limit - Number of jobs to return
   * @returns {Array} Array of job info
   */
  getJobHistory(limit = 20) {
    return this.jobHistory
      .slice(0, Math.min(limit, this.jobHistory.length))
      .map(job => ({
        jobId: job.jobId,
        type: job.type,
        status: job.status,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        duration: job.completedAt
          ? (job.completedAt - job.startedAt) / 1000
          : null,
        params: job.params
      }));
  }

  /**
   * Get all running jobs
   * @returns {Array} Array of running job info
   */
  getRunningJobs() {
    return Array.from(this.runningJobs.values()).map(job => ({
      jobId: job.jobId,
      type: job.type,
      status: job.status,
      startedAt: job.startedAt,
      duration: (Date.now() - job.startedAt) / 1000
    }));
  }

  /**
   * Execute Python script
   * @private
   */
  _executeScript(args, jobId) {
    const job = this.runningJobs.get(jobId);

    logger.info(`[PythonAnalytics] Starting job ${jobId}`, {
      type: job.type,
      command: `${this.pythonPath} ${args.join(' ')}`
    });

    // Pass BarqFleet production database credentials to Python scripts
    const pythonEnv = {
      ...process.env,
      DB_HOST: process.env.BARQ_PROD_DB_HOST || 'barqfleet-db-prod-stack-read-replica.cgr02s6xqwhy.me-south-1.rds.amazonaws.com',
      DB_PORT: process.env.BARQ_PROD_DB_PORT || '5432',
      DB_NAME: process.env.BARQ_PROD_DB_NAME || 'barqfleet_db',
      DB_USER: process.env.BARQ_PROD_DB_USER || 'ventgres',
      DB_PASSWORD: process.env.BARQ_PROD_DB_PASSWORD || 'Jk56tt4HkzePFfa3ht'
    };

    const pythonProcess = spawn(this.pythonPath, args, {
      cwd: this.scriptsDir,
      env: pythonEnv
    });

    let outputBuffer = '';
    let errorBuffer = '';

    pythonProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      outputBuffer += chunk;
      job.output += chunk;
    });

    pythonProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      errorBuffer += chunk;
      job.error += chunk;
      logger.warn(`[PythonAnalytics] Job ${jobId} stderr:`, chunk);
    });

    pythonProcess.on('close', (code) => {
      job.status = code === 0 ? 'completed' : 'failed';
      job.completedAt = new Date();

      if (code === 0) {
        // Try to parse JSON output
        try {
          // Find JSON in output (it might be after console logs)
          const jsonMatch = outputBuffer.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            job.result = JSON.parse(jsonMatch[0]);
          } else {
            job.result = { raw_output: outputBuffer };
          }

          logger.info(`[PythonAnalytics] Job ${jobId} completed successfully`, {
            duration: (job.completedAt - job.startedAt) / 1000
          });
        } catch (parseError) {
          logger.warn(`[PythonAnalytics] Failed to parse JSON output for job ${jobId}`, {
            error: parseError.message
          });
          job.result = { raw_output: outputBuffer };
        }
      } else {
        logger.error(`[PythonAnalytics] Job ${jobId} failed`, {
          exitCode: code,
          error: errorBuffer
        });
      }

      // Move to history
      this._moveToHistory(jobId);
    });

    pythonProcess.on('error', (error) => {
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();

      logger.error(`[PythonAnalytics] Job ${jobId} error`, {
        error: error.message
      });

      // Move to history
      this._moveToHistory(jobId);
    });
  }

  /**
   * Move completed job to history
   * @private
   */
  _moveToHistory(jobId) {
    const job = this.runningJobs.get(jobId);
    if (job) {
      // Add to history
      this.jobHistory.unshift({
        jobId: job.jobId,
        type: job.type,
        params: job.params,
        status: job.status,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        result: job.result,
        error: job.error
      });

      // Trim history
      if (this.jobHistory.length > this.maxHistorySize) {
        this.jobHistory = this.jobHistory.slice(0, this.maxHistorySize);
      }

      // Remove from running jobs
      this.runningJobs.delete(jobId);
    }
  }

  /**
   * Test Python environment
   * @returns {Promise<Object>} Environment info
   */
  async testEnvironment() {
    try {
      return new Promise((resolve, reject) => {
        const pythonProcess = spawn(this.pythonPath, ['--version']);
        let output = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          error += data.toString();
        });

        pythonProcess.on('close', (code) => {
          if (code === 0 || error.includes('Python')) {
            resolve({
              success: true,
              version: (output + error).trim(),
              scriptsDir: this.scriptsDir
            });
          } else {
            reject(new Error(`Python not found: ${error}`));
          }
        });

        pythonProcess.on('error', (err) => {
          reject(err);
        });
      });
    } catch (error) {
      logger.error('[PythonAnalytics] Environment test failed', {
        error: error.message
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new PythonAnalyticsService();
