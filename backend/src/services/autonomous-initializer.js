/**
 * Autonomous Operations Initializer
 *
 * Initializes and starts the autonomous AI operations system using Worker Threads
 * to avoid blocking the main event loop
 */

const { Worker } = require('worker_threads');
const path = require('path');
const actionAuth = require('./action-authorization.service');
const agentTriggerService = require('./agent-trigger.service');
const { logger } = require('../utils/logger');

class AutonomousInitializer {
  constructor() {
    this.worker = null;
    this.workerReady = false;
    this.cycleResults = [];
    this.maxCycleResults = 100; // Keep last 100 cycle results
    this.config = {
      cycleIntervalMs: 60000, // Run cycle every 1 minute (60 seconds) - now using production data
      enableContinuousOperation: true, // ENABLED - now integrated with real data
      enableLearning: true,
      useWorkerThread: false, // Worker thread mode (in development - not fully functional yet)
    };
  }

  /**
   * Initialize autonomous operations
   * @param {object} agentManager - Agent manager instance
   * @param {Map} agents - Map of registered agents
   */
  async initialize(agentManager, agents) {
    try {
      logger.info('[AutonomousInit] Initializing autonomous operations system', {
        useWorkerThread: this.config.useWorkerThread,
      });

      // Initialize agent trigger service
      agentTriggerService.initialize(this);
      logger.info('[AutonomousInit] Agent trigger service linked');

      if (this.config.useWorkerThread) {
        // Use Worker Thread for autonomous operations (recommended)
        return await this.initializeWorkerThread(agentManager, agents);
      } else {
        // Fallback: Run in main thread (not recommended, blocks event loop)
        return await this.initializeMainThread(agentManager, agents);
      }
    } catch (error) {
      logger.error('[AutonomousInit] Initialization failed', {
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Initialize using Worker Thread (recommended - doesn't block event loop)
   */
  async initializeWorkerThread(agentManager, agents) {
    return new Promise((resolve) => {
      try {
        const workerPath = path.join(__dirname, '../workers/autonomous-worker.js');

        logger.info('[AutonomousInit] Creating worker thread', { workerPath });

        // Create worker with configuration
        this.worker = new Worker(workerPath, {
          workerData: {
            config: this.config,
          },
        });

        // Handle messages from worker
        this.worker.on('message', (message) => {
          this.handleWorkerMessage(message);
        });

        // Handle worker errors
        this.worker.on('error', (error) => {
          logger.error('[AutonomousInit] Worker error', {
            error: error.message,
          });
        });

        // Handle worker exit
        this.worker.on('exit', (code) => {
          logger.info('[AutonomousInit] Worker exited', { code });
          this.workerReady = false;
        });

        // Wait for worker to be ready, then initialize
        const initTimeout = setTimeout(() => {
          resolve({
            success: false,
            error: 'Worker initialization timeout',
          });
        }, 5000);

        // Listen for initialization response
        const messageHandler = (message) => {
          if (message.type === 'initialized') {
            clearTimeout(initTimeout);
            this.worker.off('message', messageHandler);

            if (message.success) {
              this.workerReady = true;

              // Start continuous operation
              if (this.config.enableContinuousOperation) {
                this.worker.postMessage({ type: 'start' });
              }

              logger.info('[AutonomousInit] Worker thread initialized successfully');

              resolve({
                success: true,
                autonomousMode: true,
                cycleInterval: this.config.cycleIntervalMs,
                workerThread: true,
              });
            } else {
              resolve({
                success: false,
                error: message.error,
              });
            }
          }
        };

        this.worker.on('message', messageHandler);

        // Send initialization message to worker
        // Note: We can't send complex objects through worker threads,
        // so we'll use a simplified approach
        this.worker.postMessage({
          type: 'initialize',
          agentManager: null, // Will be recreated in worker
          agents: null, // Will be recreated in worker
        });
      } catch (error) {
        logger.error('[AutonomousInit] Worker creation failed', {
          error: error.message,
        });

        resolve({
          success: false,
          error: error.message,
        });
      }
    });
  }

  /**
   * Initialize in main thread (not recommended - blocks event loop)
   */
  async initializeMainThread(agentManager, agents) {
    const AutonomousOrchestratorService = require('./autonomous-orchestrator.service');

    logger.warn('[AutonomousInit] Running in main thread - may impact API performance');

    // Create autonomous orchestrator
    this.autonomousOrchestrator = new AutonomousOrchestratorService(agentManager, agents);

    // Start continuous operation cycle
    if (this.config.enableContinuousOperation) {
      this.startContinuousOperation();
    }

    logger.info('[AutonomousInit] Autonomous operations initialized in main thread');

    return {
      success: true,
      autonomousMode: this.autonomousOrchestrator.isAutonomousMode,
      cycleInterval: this.config.cycleIntervalMs,
      workerThread: false,
    };
  }

  /**
   * Handle messages from worker thread
   */
  handleWorkerMessage(message) {
    switch (message.type) {
      case 'started':
        logger.info('[AutonomousInit] Worker operations started', {
          intervalMs: message.intervalMs,
        });
        break;

      case 'stopped':
        logger.info('[AutonomousInit] Worker operations stopped');
        break;

      case 'cycle_complete':
        this.storeCycleResult(message.result);
        logger.debug('[AutonomousInit] Cycle completed', {
          actionsPlanned: message.result.actionsPlanned,
          actionsExecuted: message.result.actionsExecuted,
          duration: message.result.duration,
        });
        break;

      case 'cycle_error':
        logger.error('[AutonomousInit] Cycle error', {
          error: message.error,
          duration: message.duration,
        });
        break;

      case 'error':
        logger.error('[AutonomousInit] Worker error', {
          error: message.error,
        });
        break;

      case 'shutdown_complete':
        logger.info('[AutonomousInit] Worker shutdown complete');
        break;

      default:
        logger.debug('[AutonomousInit] Worker message', { type: message.type });
    }
  }

  /**
   * Store cycle result for reporting
   */
  storeCycleResult(result) {
    this.cycleResults.push(result);

    // Keep only last N results
    if (this.cycleResults.length > this.maxCycleResults) {
      this.cycleResults.shift();
    }
  }

  /**
   * Get recent cycle results
   */
  getCycleResults(limit = 10) {
    return this.cycleResults.slice(-limit);
  }

  /**
   * Get cycle statistics
   */
  getCycleStats() {
    if (this.cycleResults.length === 0) {
      return {
        totalCycles: 0,
        avgDuration: 0,
        avgActionsPlanned: 0,
        avgActionsExecuted: 0,
      };
    }

    const stats = this.cycleResults.reduce(
      (acc, result) => {
        acc.totalDuration += result.duration || 0;
        acc.totalPlanned += result.actionsPlanned || 0;
        acc.totalExecuted += result.actionsExecuted || 0;
        return acc;
      },
      { totalDuration: 0, totalPlanned: 0, totalExecuted: 0 }
    );

    const count = this.cycleResults.length;

    return {
      totalCycles: count,
      avgDuration: Math.round(stats.totalDuration / count),
      avgActionsPlanned: Math.round(stats.totalPlanned / count),
      avgActionsExecuted: Math.round(stats.totalExecuted / count),
      latestCycle: this.cycleResults[this.cycleResults.length - 1],
    };
  }

  /**
   * Start continuous autonomous operation cycles (main thread only)
   */
  startContinuousOperation() {
    if (!this.autonomousOrchestrator) {
      logger.warn('[AutonomousInit] Cannot start - orchestrator not initialized');
      return;
    }

    logger.info('[AutonomousInit] Starting continuous operation in main thread', {
      intervalMs: this.config.cycleIntervalMs,
    });

    // Run first cycle immediately
    this.runOperationCycle();

    // Then run on interval
    this.operationInterval = setInterval(() => {
      this.runOperationCycle();
    }, this.config.cycleIntervalMs);
  }

  /**
   * Run a single operation cycle (main thread only)
   */
  async runOperationCycle() {
    if (!this.autonomousOrchestrator) {
      return;
    }

    try {
      const result = await this.autonomousOrchestrator.autonomousOperationCycle();

      logger.info('[AutonomousInit] Operation cycle completed', {
        actionsPlanned: result.actionsPlanned,
        actionsExecuted: result.actionsExecuted,
        actionsEscalated: result.actionsEscalated,
      });
    } catch (error) {
      logger.error('[AutonomousInit] Operation cycle failed', {
        error: error.message,
      });
    }
  }

  /**
   * Stop continuous operations
   */
  stopContinuousOperation() {
    if (this.worker && this.workerReady) {
      // Stop worker thread operations
      this.worker.postMessage({ type: 'stop' });
    }

    if (this.operationInterval) {
      // Stop main thread operations
      clearInterval(this.operationInterval);
      this.operationInterval = null;
      logger.info('[AutonomousInit] Continuous operation stopped');
    }
  }

  /**
   * Manually trigger a cycle (works with both worker and main thread)
   */
  async triggerCycle() {
    if (this.worker && this.workerReady) {
      // Trigger cycle in worker thread
      this.worker.postMessage({ type: 'run_cycle' });
      return { triggered: true, mode: 'worker' };
    } else if (this.autonomousOrchestrator) {
      // Trigger cycle in main thread
      await this.runOperationCycle();
      return { triggered: true, mode: 'main' };
    } else {
      return { triggered: false, error: 'Not initialized' };
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      initialized: this.workerReady || !!this.autonomousOrchestrator,
      workerThread: !!this.worker,
      workerReady: this.workerReady,
      cycleInterval: this.config.cycleIntervalMs,
      continuousOperation: this.config.enableContinuousOperation,
      cycleCount: this.cycleResults.length,
      stats: this.getCycleStats(),
    };
  }

  /**
   * Get orchestrator instance (main thread only)
   */
  getOrchestrator() {
    return this.autonomousOrchestrator;
  }

  /**
   * Get action authorization service
   */
  getActionAuth() {
    return actionAuth;
  }

  /**
   * Get agent trigger service
   */
  getAgentTriggerService() {
    return agentTriggerService;
  }

  /**
   * Shutdown
   */
  async shutdown() {
    logger.info('[AutonomousInit] Shutting down autonomous operations');

    if (this.worker) {
      // Shutdown worker thread
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          logger.warn('[AutonomousInit] Worker shutdown timeout, terminating');
          this.worker.terminate();
          resolve();
        }, 5000);

        this.worker.once('message', (message) => {
          if (message.type === 'shutdown_complete') {
            clearTimeout(timeout);
            this.worker.terminate();
            resolve();
          }
        });

        this.worker.postMessage({ type: 'shutdown' });
      });
    } else {
      // Shutdown main thread operations
      this.stopContinuousOperation();

      // Save learning data if needed
      if (this.autonomousOrchestrator && this.autonomousOrchestrator.learningData.length > 0) {
        logger.info('[AutonomousInit] Saving learning data', {
          records: this.autonomousOrchestrator.learningData.length,
        });
        // Could save to database here
      }
    }
  }
}

// Singleton instance
const autonomousInitializer = new AutonomousInitializer();

module.exports = autonomousInitializer;
