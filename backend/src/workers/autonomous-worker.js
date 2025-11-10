/**
 * Autonomous Operations Worker Thread
 *
 * Runs autonomous operations in a separate thread to avoid blocking the main event loop.
 * Communicates with main thread via message passing.
 */

const { parentPort, workerData } = require('worker_threads');
const { logger } = require('../utils/logger');

// Import services needed for autonomous operations
const AutonomousOrchestratorService = require('../services/autonomous-orchestrator.service');

class AutonomousWorker {
  constructor(config) {
    this.config = config || {
      cycleIntervalMs: 300000, // 5 minutes
      enableContinuousOperation: true,
      enableLearning: true,
    };

    this.orchestrator = null;
    this.operationInterval = null;
    this.isRunning = false;

    logger.info('[AutonomousWorker] Worker thread initialized', {
      cycleInterval: this.config.cycleIntervalMs,
    });
  }

  /**
   * Initialize the orchestrator
   */
  async initialize(agentManagerData, agentsData) {
    try {
      // Reconstruct agent manager and agents from serialized data
      // Note: We need to recreate these objects in the worker thread context
      this.orchestrator = new AutonomousOrchestratorService(agentManagerData, agentsData);

      logger.info('[AutonomousWorker] Orchestrator initialized');

      // Send success message to main thread
      parentPort.postMessage({
        type: 'initialized',
        success: true,
      });

      return true;
    } catch (error) {
      logger.error('[AutonomousWorker] Initialization failed', {
        error: error.message,
      });

      parentPort.postMessage({
        type: 'initialized',
        success: false,
        error: error.message,
      });

      return false;
    }
  }

  /**
   * Start continuous operation cycles
   */
  startContinuousOperation() {
    if (this.isRunning) {
      logger.warn('[AutonomousWorker] Already running');
      return;
    }

    logger.info('[AutonomousWorker] Starting continuous operation', {
      intervalMs: this.config.cycleIntervalMs,
    });

    this.isRunning = true;

    // Run first cycle immediately
    this.runOperationCycle();

    // Then run on interval
    this.operationInterval = setInterval(() => {
      this.runOperationCycle();
    }, this.config.cycleIntervalMs);

    parentPort.postMessage({
      type: 'started',
      intervalMs: this.config.cycleIntervalMs,
    });
  }

  /**
   * Run a single operation cycle
   */
  async runOperationCycle() {
    const startTime = Date.now();

    try {
      logger.debug('[AutonomousWorker] Starting operation cycle');

      const result = await this.orchestrator.autonomousOperationCycle();

      const duration = Date.now() - startTime;

      logger.info('[AutonomousWorker] Operation cycle completed', {
        duration: `${duration}ms`,
        actionsPlanned: result.actionsPlanned,
        actionsExecuted: result.actionsExecuted,
        actionsEscalated: result.actionsEscalated,
      });

      // Send cycle result to main thread
      parentPort.postMessage({
        type: 'cycle_complete',
        result: {
          ...result,
          duration,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('[AutonomousWorker] Operation cycle failed', {
        error: error.message,
        duration: `${duration}ms`,
      });

      // Send error to main thread
      parentPort.postMessage({
        type: 'cycle_error',
        error: error.message,
        duration,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Stop continuous operations
   */
  stopContinuousOperation() {
    if (this.operationInterval) {
      clearInterval(this.operationInterval);
      this.operationInterval = null;
      this.isRunning = false;

      logger.info('[AutonomousWorker] Continuous operation stopped');

      parentPort.postMessage({
        type: 'stopped',
      });
    }
  }

  /**
   * Shutdown worker
   */
  async shutdown() {
    logger.info('[AutonomousWorker] Shutting down');

    this.stopContinuousOperation();

    // Save learning data if needed
    if (this.orchestrator && this.orchestrator.learningData.length > 0) {
      logger.info('[AutonomousWorker] Saving learning data', {
        records: this.orchestrator.learningData.length,
      });
      // Could save to database here
    }

    parentPort.postMessage({
      type: 'shutdown_complete',
    });

    // Give time for message to be sent before exiting
    setTimeout(() => {
      // Use proper error handling instead of process.exit
      parentPort.postMessage({
        type: 'shutdown_complete',
        final: true,
      });
      // Close the worker gracefully
      parentPort.close();
    }, 100);
  }
}

// Create worker instance
const worker = new AutonomousWorker(workerData?.config);

// Handle messages from main thread
parentPort.on('message', async (message) => {
  logger.debug('[AutonomousWorker] Received message', { type: message.type });

  switch (message.type) {
    case 'initialize':
      await worker.initialize(message.agentManager, message.agents);
      break;

    case 'start':
      worker.startContinuousOperation();
      break;

    case 'stop':
      worker.stopContinuousOperation();
      break;

    case 'run_cycle':
      await worker.runOperationCycle();
      break;

    case 'shutdown':
      await worker.shutdown();
      break;

    default:
      logger.warn('[AutonomousWorker] Unknown message type', {
        type: message.type,
      });
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('[AutonomousWorker] Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });

  parentPort.postMessage({
    type: 'error',
    error: error.message,
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('[AutonomousWorker] Unhandled rejection', {
    reason: String(reason),
  });

  parentPort.postMessage({
    type: 'error',
    error: String(reason),
  });
});

logger.info('[AutonomousWorker] Worker thread ready');
