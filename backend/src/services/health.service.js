/**
 * Health Check Service
 * Monitors system health and dependencies
 */

const { logger } = require('../utils/logger');
const { circuitBreakerManager } = require('../utils/circuit-breaker');

class HealthService {
  constructor() {
    this.checks = new Map();
    this.lastCheckResults = new Map();
    this.checkInterval = 30000; // 30 seconds
    this.isMonitoring = false;
  }

  /**
   * Register a health check
   */
  registerCheck(name, checkFn, options = {}) {
    this.checks.set(name, {
      name,
      fn: checkFn,
      critical: options.critical !== false,
      timeout: options.timeout || 5000,
      enabled: options.enabled !== false,
    });

    logger.info(`Health check registered: ${name}`, {
      critical: options.critical !== false,
      timeout: options.timeout || 5000,
    });
  }

  /**
   * Run all health checks
   */
  async checkHealth() {
    const results = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {},
      system: this.getSystemMetrics(),
    };

    const checkPromises = [];

    for (const [name, check] of this.checks) {
      if (!check.enabled) {
        results.checks[name] = {
          status: 'disabled',
          message: 'Check is disabled',
        };
        continue;
      }

      checkPromises.push(
        this.runSingleCheck(check)
          .then((result) => {
            results.checks[name] = result;
            this.lastCheckResults.set(name, result);

            if (result.status === 'unhealthy' && check.critical) {
              results.status = 'unhealthy';
            } else if (result.status === 'degraded' && results.status === 'healthy') {
              results.status = 'degraded';
            }
          })
          .catch((error) => {
            const errorResult = {
              status: 'unhealthy',
              message: `Health check failed: ${error.message}`,
              error: error.message,
            };

            results.checks[name] = errorResult;
            this.lastCheckResults.set(name, errorResult);

            if (check.critical) {
              results.status = 'unhealthy';
            }
          })
      );
    }

    await Promise.allSettled(checkPromises);

    // Add circuit breaker status
    results.circuitBreakers = circuitBreakerManager.getHealthStatus();

    return results;
  }

  /**
   * Run a single health check with timeout
   */
  async runSingleCheck(check) {
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        check.fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), check.timeout)
        ),
      ]);

      const duration = Date.now() - startTime;

      return {
        status: result.status || 'healthy',
        message: result.message || 'Check passed',
        duration: `${duration}ms`,
        ...result,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        status: 'unhealthy',
        message: error.message,
        duration: `${duration}ms`,
        error: error.message,
      };
    }
  }

  /**
   * Get system metrics
   */
  getSystemMetrics() {
    const memUsage = process.memoryUsage();

    return {
      memory: {
        used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        percentage: `${Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)}%`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      },
      cpu: {
        usage: process.cpuUsage(),
        loadAverage: process.platform !== 'win32' ? require('os').loadavg() : null,
      },
      uptime: {
        seconds: Math.floor(process.uptime()),
        formatted: this.formatUptime(process.uptime()),
      },
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
    };
  }

  /**
   * Format uptime in human-readable format
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0) parts.push(`${secs}s`);

    return parts.join(' ') || '0s';
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('Health monitoring already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting health monitoring', { interval: `${this.checkInterval}ms` });

    this.monitoringInterval = setInterval(async () => {
      try {
        const health = await this.checkHealth();

        if (health.status === 'unhealthy') {
          logger.error('System health check failed', {
            status: health.status,
            checks: health.checks,
          });
        } else if (health.status === 'degraded') {
          logger.warn('System health degraded', {
            status: health.status,
            checks: health.checks,
          });
        } else {
          logger.debug('System health check passed', {
            status: health.status,
          });
        }
      } catch (error) {
        logger.error('Health monitoring error', { error: error.message });
      }
    }, this.checkInterval);
  }

  /**
   * Stop continuous monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.isMonitoring = false;
      logger.info('Health monitoring stopped');
    }
  }

  /**
   * Get readiness status (can accept traffic)
   */
  async isReady() {
    const health = await this.checkHealth();
    return health.status !== 'unhealthy';
  }

  /**
   * Get liveness status (should restart)
   */
  async isAlive() {
    // Basic liveness check - is the process responding?
    return {
      alive: true,
      uptime: process.uptime(),
      memory: process.memoryUsage().heapUsed,
    };
  }
}

// Export singleton instance
const healthService = new HealthService();

// Register default health checks

// Memory check
healthService.registerCheck(
  'memory',
  async () => {
    const memUsage = process.memoryUsage();
    const heapPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    if (heapPercentage > 90) {
      return {
        status: 'unhealthy',
        message: `Memory usage critical: ${heapPercentage.toFixed(2)}%`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      };
    } else if (heapPercentage > 75) {
      return {
        status: 'degraded',
        message: `Memory usage high: ${heapPercentage.toFixed(2)}%`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      };
    }

    return {
      status: 'healthy',
      message: 'Memory usage normal',
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      percentage: `${heapPercentage.toFixed(2)}%`,
    };
  },
  { critical: true }
);

// Event loop check
healthService.registerCheck(
  'eventLoop',
  async () => {
    const start = Date.now();
    await new Promise((resolve) => setImmediate(resolve));
    const lag = Date.now() - start;

    if (lag > 100) {
      return {
        status: 'degraded',
        message: `Event loop lag detected: ${lag}ms`,
        lag: `${lag}ms`,
      };
    }

    return {
      status: 'healthy',
      message: 'Event loop responsive',
      lag: `${lag}ms`,
    };
  },
  { critical: false }
);

// Process check
healthService.registerCheck(
  'process',
  async () => {
    const uptime = process.uptime();

    return {
      status: 'healthy',
      message: 'Process running',
      uptime: `${Math.floor(uptime)}s`,
      pid: process.pid,
      version: process.version,
    };
  },
  { critical: true }
);

module.exports = {
  healthService,
  HealthService,
};
