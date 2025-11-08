/**
 * Circuit Breaker Pattern
 * Prevents cascading failures by failing fast when external services are down
 */

const { logger } = require('./logger');
const { alertService, ALERT_LEVELS } = require('../services/alert.service');

// Circuit breaker states
const STATES = {
  CLOSED: 'CLOSED', // Normal operation
  OPEN: 'OPEN', // Service is down, fail fast
  HALF_OPEN: 'HALF_OPEN', // Testing if service recovered
};

class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'unnamed-service';
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000; // 1 minute
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    this.monitoringPeriod = options.monitoringPeriod || 60000; // 1 minute

    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      stateChanges: 0,
      lastStateChange: null,
    };

    // Sliding window for failure rate calculation
    this.callHistory = [];
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute(fn, fallback = null) {
    this.stats.totalCalls++;

    // Check if circuit is open
    if (this.state === STATES.OPEN) {
      if (Date.now() < this.nextAttempt) {
        this.stats.rejectedCalls++;
        logger.warn(`Circuit breaker ${this.name} is OPEN, rejecting call`, {
          nextAttempt: new Date(this.nextAttempt).toISOString(),
          failureCount: this.failureCount,
        });

        if (fallback) {
          return this.executeFallback(fallback);
        }

        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      } else {
        // Move to half-open state to test service
        this.moveToHalfOpen();
      }
    }

    try {
      // Execute the function with timeout
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);

      if (fallback) {
        return this.executeFallback(fallback);
      }

      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  async executeWithTimeout(fn) {
    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Circuit breaker timeout after ${this.timeout}ms`)),
          this.timeout
        )
      ),
    ]);
  }

  /**
   * Execute fallback function
   */
  async executeFallback(fallback) {
    try {
      logger.info(`Circuit breaker ${this.name} using fallback`, { state: this.state });
      return typeof fallback === 'function' ? await fallback() : fallback;
    } catch (error) {
      logger.error(`Circuit breaker ${this.name} fallback failed`, { error: error.message });
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  onSuccess() {
    this.stats.successfulCalls++;
    this.addToHistory(true);

    if (this.state === STATES.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.successThreshold) {
        this.moveToClosed();
      }
    } else {
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed execution
   */
  onFailure(error) {
    this.stats.failedCalls++;
    this.addToHistory(false);

    logger.error(`Circuit breaker ${this.name} call failed`, {
      error: error.message,
      state: this.state,
      failureCount: this.failureCount + 1,
    });

    if (this.state === STATES.HALF_OPEN) {
      this.moveToOpen();
    } else if (this.state === STATES.CLOSED) {
      this.failureCount++;

      if (this.failureCount >= this.failureThreshold) {
        this.moveToOpen();
      }
    }
  }

  /**
   * Add call result to history for monitoring
   */
  addToHistory(success) {
    const now = Date.now();
    this.callHistory.push({ success, timestamp: now });

    // Remove old entries outside monitoring period
    this.callHistory = this.callHistory.filter(
      (call) => now - call.timestamp < this.monitoringPeriod
    );
  }

  /**
   * Calculate failure rate in monitoring period
   */
  getFailureRate() {
    if (this.callHistory.length === 0) return 0;

    const failures = this.callHistory.filter((call) => !call.success).length;
    return failures / this.callHistory.length;
  }

  /**
   * Move circuit to OPEN state
   */
  moveToOpen() {
    if (this.state !== STATES.OPEN) {
      this.state = STATES.OPEN;
      this.failureCount = 0;
      this.successCount = 0;
      this.nextAttempt = Date.now() + this.resetTimeout;
      this.stats.stateChanges++;
      this.stats.lastStateChange = new Date().toISOString();

      logger.error(`Circuit breaker ${this.name} moved to OPEN state`, {
        nextAttempt: new Date(this.nextAttempt).toISOString(),
        failureRate: this.getFailureRate(),
      });

      // Send alert to ops team
      alertService.high(
        `Circuit Breaker Opened: ${this.name}`,
        `Service ${this.name} has failed ${this.failureThreshold} times and circuit breaker is now OPEN`,
        {
          service: this.name,
          state: STATES.OPEN,
          failureRate: `${(this.getFailureRate() * 100).toFixed(2)}%`,
          nextAttempt: new Date(this.nextAttempt).toISOString(),
        }
      );
    }
  }

  /**
   * Move circuit to HALF_OPEN state
   */
  moveToHalfOpen() {
    if (this.state !== STATES.HALF_OPEN) {
      this.state = STATES.HALF_OPEN;
      this.successCount = 0;
      this.stats.stateChanges++;
      this.stats.lastStateChange = new Date().toISOString();

      logger.info(`Circuit breaker ${this.name} moved to HALF_OPEN state`, {
        message: 'Testing if service has recovered',
      });
    }
  }

  /**
   * Move circuit to CLOSED state
   */
  moveToClosed() {
    if (this.state !== STATES.CLOSED) {
      const previousState = this.state;
      this.state = STATES.CLOSED;
      this.failureCount = 0;
      this.successCount = 0;
      this.stats.stateChanges++;
      this.stats.lastStateChange = new Date().toISOString();

      logger.info(`Circuit breaker ${this.name} moved to CLOSED state`, {
        message: 'Service has recovered',
        previousState,
      });

      // Send recovery alert if recovering from OPEN state
      if (previousState === STATES.HALF_OPEN) {
        alertService.info(
          `Circuit Breaker Recovered: ${this.name}`,
          `Service ${this.name} has recovered and circuit breaker is now CLOSED`,
          {
            service: this.name,
            state: STATES.CLOSED,
            successRate: `${((1 - this.getFailureRate()) * 100).toFixed(2)}%`,
          }
        );
      }
    }
  }

  /**
   * Get current state
   */
  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      failureRate: this.getFailureRate(),
      nextAttempt: this.state === STATES.OPEN ? new Date(this.nextAttempt).toISOString() : null,
      stats: this.stats,
    };
  }

  /**
   * Manually reset circuit breaker
   */
  reset() {
    logger.info(`Circuit breaker ${this.name} manually reset`);
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.callHistory = [];
  }

  /**
   * Check if circuit is healthy
   */
  isHealthy() {
    return this.state === STATES.CLOSED && this.getFailureRate() < 0.5;
  }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers for different services
 */
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * Get or create a circuit breaker for a service
   */
  getBreaker(name, options = {}) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({ name, ...options }));
      logger.info(`Circuit breaker created for ${name}`);
    }
    return this.breakers.get(name);
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute(serviceName, fn, fallback = null, options = {}) {
    const breaker = this.getBreaker(serviceName, options);
    return breaker.execute(fn, fallback);
  }

  /**
   * Get all circuit breaker states
   */
  getAllStates() {
    const states = {};
    for (const [name, breaker] of this.breakers) {
      states[name] = breaker.getState();
    }
    return states;
  }

  /**
   * Get health status of all circuit breakers
   */
  getHealthStatus() {
    const health = {
      healthy: 0,
      unhealthy: 0,
      breakers: {},
    };

    for (const [name, breaker] of this.breakers) {
      const isHealthy = breaker.isHealthy();
      health.breakers[name] = {
        healthy: isHealthy,
        state: breaker.state,
        failureRate: breaker.getFailureRate(),
      };

      if (isHealthy) {
        health.healthy++;
      } else {
        health.unhealthy++;
      }
    }

    return health;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    logger.info('All circuit breakers reset');
  }

  /**
   * Reset specific circuit breaker
   */
  reset(name) {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
    } else {
      logger.warn(`Circuit breaker ${name} not found`);
    }
  }
}

// Export singleton instance
const circuitBreakerManager = new CircuitBreakerManager();

module.exports = {
  CircuitBreaker,
  CircuitBreakerManager,
  circuitBreakerManager,
  STATES,
};
