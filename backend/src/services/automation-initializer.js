/**
 * Automation Initializer
 *
 * Manages Phase 4 automation engines:
 * - Auto-Dispatch Engine
 * - Dynamic Route Optimizer
 * - Smart Batching Engine
 * - Autonomous Escalation Engine
 */

const { logger } = require('../utils/logger');

class AutomationInitializer {
  constructor() {
    this.autoDispatchEngine = null;
    this.dynamicRouteOptimizer = null;
    this.smartBatchingEngine = null;
    this.autonomousEscalationEngine = null;
    this.initialized = false;
  }

  /**
   * Initialize all automation engines
   * @param {Object} agentManager - Agent manager instance (optional for now)
   * @param {Object} agents - Individual agents (optional for now)
   * @returns {Object} Initialization result
   */
  async initialize(agentManager = null, agents = null) {
    try {
      logger.info('Starting Phase 4 automation engines initialization...');

      // Import automation services (they export singleton instances)
      logger.info('Initializing Auto-Dispatch Engine...');
      this.autoDispatchEngine = require('./auto-dispatch.service');

      logger.info('Initializing Dynamic Route Optimizer...');
      this.dynamicRouteOptimizer = require('./dynamic-route-optimizer.service');

      logger.info('Initializing Smart Batching Engine...');
      this.smartBatchingEngine = require('./smart-batching.service');

      logger.info('Initializing Autonomous Escalation Engine...');
      this.autonomousEscalationEngine = require('./autonomous-escalation.service');

      this.initialized = true;

      logger.info('Phase 4 automation engines initialized successfully');

      return {
        success: true,
        message: 'All automation engines initialized',
        engines: {
          autoDispatch: 'initialized',
          routeOptimizer: 'initialized',
          smartBatching: 'initialized',
          escalation: 'initialized',
        },
      };
    } catch (error) {
      logger.error('Failed to initialize automation engines', {
        error: error.message,
        stack: error.stack,
      });

      // Log detailed error to console for debugging
      console.error('Detailed Automation Init Error:', error);

      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  /**
   * Start all automation engines
   * @param {Object} options - Start options
   * @returns {Object} Start result
   */
  async startAll(options = {}) {
    if (!this.initialized) {
      throw new Error('Automation engines not initialized');
    }

    try {
      const results = {};

      // Check if should auto-start (default: false, requires manual start)
      const autoStart = options.autoStart || process.env.AUTO_START_AUTOMATION === 'true';

      if (!autoStart) {
        logger.info('Automation engines ready (auto-start disabled)');
        logger.info('Use POST /api/v1/automation/start-all to start engines');
        return {
          success: true,
          message: 'Engines initialized but not started (manual start required)',
          autoStart: false,
        };
      }

      logger.info('Starting all automation engines...');

      // Start auto-dispatch
      if (this.autoDispatchEngine && !this.autoDispatchEngine.isRunning) {
        await this.autoDispatchEngine.start();
        results.autoDispatch = 'started';
        logger.info('Auto-Dispatch Engine started');
      } else {
        results.autoDispatch = 'already running';
      }

      // Start route optimizer
      if (this.dynamicRouteOptimizer && !this.dynamicRouteOptimizer.isRunning) {
        await this.dynamicRouteOptimizer.start();
        results.routeOptimizer = 'started';
        logger.info('Dynamic Route Optimizer started');
      } else {
        results.routeOptimizer = 'already running';
      }

      // Start smart batching
      if (this.smartBatchingEngine && !this.smartBatchingEngine.isRunning) {
        await this.smartBatchingEngine.start();
        results.smartBatching = 'started';
        logger.info('Smart Batching Engine started');
      } else {
        results.smartBatching = 'already running';
      }

      // Start escalation
      if (this.autonomousEscalationEngine && !this.autonomousEscalationEngine.isRunning) {
        await this.autonomousEscalationEngine.start();
        results.escalation = 'started';
        logger.info('Autonomous Escalation Engine started');
      } else {
        results.escalation = 'already running';
      }

      logger.info('All automation engines started successfully');

      return {
        success: true,
        message: 'All automation engines started',
        engines: results,
      };
    } catch (error) {
      logger.error('Failed to start automation engines', {
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Stop all automation engines
   * @returns {Object} Stop result
   */
  async stopAll() {
    if (!this.initialized) {
      return {
        success: false,
        error: 'Automation engines not initialized',
      };
    }

    try {
      logger.info('Stopping all automation engines...');

      const results = {};

      // Stop auto-dispatch
      if (this.autoDispatchEngine && this.autoDispatchEngine.isRunning) {
        await this.autoDispatchEngine.stop();
        results.autoDispatch = 'stopped';
        logger.info('Auto-Dispatch Engine stopped');
      } else {
        results.autoDispatch = 'not running';
      }

      // Stop route optimizer
      if (this.dynamicRouteOptimizer && this.dynamicRouteOptimizer.isRunning) {
        await this.dynamicRouteOptimizer.stop();
        results.routeOptimizer = 'stopped';
        logger.info('Dynamic Route Optimizer stopped');
      } else {
        results.routeOptimizer = 'not running';
      }

      // Stop smart batching
      if (this.smartBatchingEngine && this.smartBatchingEngine.isRunning) {
        await this.smartBatchingEngine.stop();
        results.smartBatching = 'stopped';
        logger.info('Smart Batching Engine stopped');
      } else {
        results.smartBatching = 'not running';
      }

      // Stop escalation
      if (this.autonomousEscalationEngine && this.autonomousEscalationEngine.isRunning) {
        await this.autonomousEscalationEngine.stop();
        results.escalation = 'stopped';
        logger.info('Autonomous Escalation Engine stopped');
      } else {
        results.escalation = 'not running';
      }

      logger.info('All automation engines stopped successfully');

      return {
        success: true,
        message: 'All automation engines stopped',
        engines: results,
      };
    } catch (error) {
      logger.error('Failed to stop automation engines', {
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Graceful shutdown of automation engines
   */
  async shutdown() {
    logger.info('Shutting down automation engines...');

    try {
      await this.stopAll();
      this.initialized = false;
      logger.info('Automation engines shutdown complete');
    } catch (error) {
      logger.error('Error during automation engines shutdown', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get all automation engines
   * @returns {Object} All engines
   */
  getEngines() {
    return {
      autoDispatch: this.autoDispatchEngine,
      routeOptimizer: this.dynamicRouteOptimizer,
      smartBatching: this.smartBatchingEngine,
      escalation: this.autonomousEscalationEngine,
    };
  }

  /**
   * Get engine status
   * @returns {Object} Status of all engines
   */
  getStatus() {
    return {
      initialized: this.initialized,
      engines: {
        autoDispatch: {
          initialized: !!this.autoDispatchEngine,
          running: this.autoDispatchEngine ? this.autoDispatchEngine.isRunning : false,
        },
        routeOptimizer: {
          initialized: !!this.dynamicRouteOptimizer,
          running: this.dynamicRouteOptimizer ? this.dynamicRouteOptimizer.isRunning : false,
        },
        smartBatching: {
          initialized: !!this.smartBatchingEngine,
          running: this.smartBatchingEngine ? this.smartBatchingEngine.isRunning : false,
        },
        escalation: {
          initialized: !!this.autonomousEscalationEngine,
          running: this.autonomousEscalationEngine
            ? this.autonomousEscalationEngine.isRunning
            : false,
        },
      },
    };
  }
}

// Create singleton instance
const automationInitializer = new AutomationInitializer();

module.exports = automationInitializer;
