/**
 * Error Monitoring Service
 * Centralized error tracking and aggregation system
 * Provides real-time error metrics and analytics
 */

const { logger } = require('../utils/logger');
const { EventEmitter } = require('events');

/**
 * Error categories for classification
 */
const ERROR_CATEGORIES = {
  DATABASE: 'database',
  AGENT: 'agent',
  API: 'api',
  ANALYTICS: 'analytics',
  WEBSOCKET: 'websocket',
  EXTERNAL_SERVICE: 'external_service',
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  SYSTEM: 'system',
  UNKNOWN: 'unknown',
};

/**
 * Error severity levels
 */
const ERROR_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info',
};

/**
 * Error monitoring service class
 */
class ErrorMonitoringService extends EventEmitter {
  constructor() {
    super();

    // In-memory storage for error metrics
    this.errors = []; // Recent errors (rolling window)
    this.maxErrorHistory = 1000; // Maximum errors to keep in memory
    this.errorCounts = new Map(); // Error counts by category
    this.errorRates = []; // Error rates over time
    this.startTime = Date.now();

    // Time windows for metrics (in milliseconds)
    this.timeWindows = {
      '5min': 5 * 60 * 1000,
      '1hour': 60 * 60 * 1000,
      '24hour': 24 * 60 * 60 * 1000,
    };

    // Alert thresholds (configurable via environment variables)
    this.thresholds = {
      errorRatePerMinute: parseInt(process.env.ERROR_RATE_THRESHOLD) || 10,
      criticalErrorsPerHour: parseInt(process.env.CRITICAL_ERROR_THRESHOLD) || 5,
      consecutiveErrors: parseInt(process.env.CONSECUTIVE_ERROR_THRESHOLD) || 20,
    };

    // Initialize category counters
    Object.values(ERROR_CATEGORIES).forEach((category) => {
      this.errorCounts.set(category, 0);
    });

    // Start background cleanup task
    this.startCleanupTask();

    // Add default error event handler to prevent unhandled error events
    this.on('error', (error) => {
      // Default handler - errors are already logged in logError method
      // This prevents EventEmitter from throwing if no one is listening
    });

    // Add default alert event handler
    this.on('alert', (alert) => {
      // Default handler - alerts are already logged in checkAlertConditions method
    });

    logger.info('Error Monitoring Service initialized', {
      maxHistory: this.maxErrorHistory,
      thresholds: this.thresholds,
    });
  }

  /**
   * Log an error to the monitoring system
   * @param {Object} errorData - Error information
   */
  logError(errorData) {
    const error = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      timestampMs: Date.now(),
      category: this.categorizeError(errorData),
      severity: this.determineSeverity(errorData),
      message: errorData.message || 'Unknown error',
      stack: errorData.stack,
      statusCode: errorData.statusCode,
      errorCode: errorData.code,
      agentName: errorData.agentName,
      service: errorData.service,
      path: errorData.path,
      method: errorData.method,
      userId: errorData.userId,
      requestId: errorData.requestId,
      metadata: errorData.metadata || {},
    };

    // Add to error history
    this.errors.unshift(error);

    // Trim if exceeds max history
    if (this.errors.length > this.maxErrorHistory) {
      this.errors = this.errors.slice(0, this.maxErrorHistory);
    }

    // Update category counters
    const category = error.category;
    this.errorCounts.set(category, (this.errorCounts.get(category) || 0) + 1);

    // Check for alert conditions
    this.checkAlertConditions(error);

    // Emit error event for subscribers
    this.emit('error', error);

    // Log to winston
    logger.error('Error tracked by monitoring system', {
      errorId: error.id,
      category: error.category,
      severity: error.severity,
      message: error.message,
    });

    return error.id;
  }

  /**
   * Categorize error based on its properties
   * @param {Object} errorData - Error information
   * @returns {string} - Error category
   */
  categorizeError(errorData) {
    // Check error code patterns
    if (errorData.code) {
      if (errorData.code.includes('DATABASE') || errorData.code.includes('DB')) {
        return ERROR_CATEGORIES.DATABASE;
      }
      if (errorData.code.includes('AGENT')) {
        return ERROR_CATEGORIES.AGENT;
      }
      if (errorData.code.includes('VALIDATION')) {
        return ERROR_CATEGORIES.VALIDATION;
      }
      if (errorData.code.includes('UNAUTHORIZED') || errorData.code.includes('AUTH')) {
        return ERROR_CATEGORIES.AUTHENTICATION;
      }
      if (errorData.code.includes('FORBIDDEN')) {
        return ERROR_CATEGORIES.AUTHORIZATION;
      }
    }

    // Check agent name
    if (errorData.agentName) {
      return ERROR_CATEGORIES.AGENT;
    }

    // Check service
    if (errorData.service) {
      if (errorData.service.toLowerCase().includes('analytics')) {
        return ERROR_CATEGORIES.ANALYTICS;
      }
      if (errorData.service.toLowerCase().includes('websocket')) {
        return ERROR_CATEGORIES.WEBSOCKET;
      }
      return ERROR_CATEGORIES.EXTERNAL_SERVICE;
    }

    // Check path patterns
    if (errorData.path) {
      if (errorData.path.includes('/analytics')) {
        return ERROR_CATEGORIES.ANALYTICS;
      }
      if (errorData.path.includes('/agents')) {
        return ERROR_CATEGORIES.AGENT;
      }
    }

    // Check message patterns
    if (errorData.message) {
      const msg = errorData.message.toLowerCase();
      if (msg.includes('database') || msg.includes('postgres') || msg.includes('connection')) {
        return ERROR_CATEGORIES.DATABASE;
      }
      if (msg.includes('python') || msg.includes('analytics') || msg.includes('script')) {
        return ERROR_CATEGORIES.ANALYTICS;
      }
      if (msg.includes('agent')) {
        return ERROR_CATEGORIES.AGENT;
      }
      if (msg.includes('websocket') || msg.includes('ws')) {
        return ERROR_CATEGORIES.WEBSOCKET;
      }
    }

    // Check status code
    if (errorData.statusCode) {
      if (errorData.statusCode === 401) {
        return ERROR_CATEGORIES.AUTHENTICATION;
      }
      if (errorData.statusCode === 403) {
        return ERROR_CATEGORIES.AUTHORIZATION;
      }
      if (errorData.statusCode === 400 || errorData.statusCode === 422) {
        return ERROR_CATEGORIES.VALIDATION;
      }
      if (errorData.statusCode >= 500) {
        return ERROR_CATEGORIES.SYSTEM;
      }
    }

    return ERROR_CATEGORIES.UNKNOWN;
  }

  /**
   * Determine error severity
   * @param {Object} errorData - Error information
   * @returns {string} - Error severity level
   */
  determineSeverity(errorData) {
    // Critical: Database failures, agent orchestration failures
    if (errorData.code === 'DATABASE_ERROR' || errorData.code === 'ORCHESTRATION_FAILED') {
      return ERROR_SEVERITY.CRITICAL;
    }

    // Critical: 500+ status codes that aren't operational
    if (errorData.statusCode >= 500 && !errorData.isOperational) {
      return ERROR_SEVERITY.CRITICAL;
    }

    // High: Agent execution failures, SLA breaches
    if (
      errorData.code === 'AGENT_EXECUTION_ERROR' ||
      errorData.code === 'SLA_BREACH_IMMINENT' ||
      errorData.agentName
    ) {
      return ERROR_SEVERITY.HIGH;
    }

    // High: External service failures
    if (errorData.code === 'EXTERNAL_SERVICE_ERROR' || errorData.statusCode === 502) {
      return ERROR_SEVERITY.HIGH;
    }

    // Medium: Service unavailable, timeouts
    if (errorData.statusCode === 503 || errorData.statusCode === 504) {
      return ERROR_SEVERITY.MEDIUM;
    }

    // Medium: Authentication/Authorization failures
    if (errorData.statusCode === 401 || errorData.statusCode === 403) {
      return ERROR_SEVERITY.MEDIUM;
    }

    // Low: Client errors (400 range)
    if (errorData.statusCode >= 400 && errorData.statusCode < 500) {
      return ERROR_SEVERITY.LOW;
    }

    // Default to medium for unknown errors
    return ERROR_SEVERITY.MEDIUM;
  }

  /**
   * Generate unique error ID
   * @returns {string} - Unique error ID
   */
  generateErrorId() {
    return `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get error metrics for a time window
   * @param {string} window - Time window ('5min', '1hour', '24hour')
   * @returns {Object} - Error metrics
   */
  getMetrics(window = '1hour') {
    const windowMs = this.timeWindows[window] || this.timeWindows['1hour'];
    const cutoffTime = Date.now() - windowMs;

    // Filter errors within the time window
    const recentErrors = this.errors.filter((err) => err.timestampMs >= cutoffTime);

    // Calculate metrics
    const metrics = {
      window,
      totalErrors: recentErrors.length,
      errorRate: (recentErrors.length / (windowMs / 60000)).toFixed(2), // Errors per minute
      byCategory: {},
      bySeverity: {},
      byStatusCode: {},
      topErrors: this.getTopErrors(recentErrors, 10),
      recentErrors: recentErrors.slice(0, 20), // Last 20 errors
    };

    // Group by category
    Object.values(ERROR_CATEGORIES).forEach((category) => {
      const count = recentErrors.filter((err) => err.category === category).length;
      if (count > 0) {
        metrics.byCategory[category] = count;
      }
    });

    // Group by severity
    Object.values(ERROR_SEVERITY).forEach((severity) => {
      const count = recentErrors.filter((err) => err.severity === severity).length;
      if (count > 0) {
        metrics.bySeverity[severity] = count;
      }
    });

    // Group by status code
    const statusCodes = {};
    recentErrors.forEach((err) => {
      if (err.statusCode) {
        statusCodes[err.statusCode] = (statusCodes[err.statusCode] || 0) + 1;
      }
    });
    metrics.byStatusCode = statusCodes;

    return metrics;
  }

  /**
   * Get top recurring errors
   * @param {Array} errors - Array of errors
   * @param {number} limit - Number of top errors to return
   * @returns {Array} - Top errors with counts
   */
  getTopErrors(errors, limit = 10) {
    const errorGroups = new Map();

    errors.forEach((err) => {
      const key = `${err.category}-${err.errorCode || err.statusCode}-${err.message.substring(0, 100)}`;
      if (!errorGroups.has(key)) {
        errorGroups.set(key, {
          category: err.category,
          severity: err.severity,
          errorCode: err.errorCode,
          statusCode: err.statusCode,
          message: err.message,
          count: 0,
          lastOccurred: err.timestamp,
        });
      }
      const group = errorGroups.get(key);
      group.count++;
      group.lastOccurred = err.timestamp;
    });

    return Array.from(errorGroups.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get error trends over time
   * @param {number} intervals - Number of time intervals
   * @param {number} intervalMs - Interval duration in milliseconds
   * @returns {Array} - Error trend data
   */
  getErrorTrends(intervals = 12, intervalMs = 5 * 60 * 1000) {
    const trends = [];
    const now = Date.now();

    for (let i = intervals - 1; i >= 0; i--) {
      const endTime = now - i * intervalMs;
      const startTime = endTime - intervalMs;

      const errorsInInterval = this.errors.filter(
        (err) => err.timestampMs >= startTime && err.timestampMs < endTime
      );

      trends.push({
        timestamp: new Date(endTime).toISOString(),
        timestampMs: endTime,
        count: errorsInInterval.length,
        critical: errorsInInterval.filter((e) => e.severity === ERROR_SEVERITY.CRITICAL).length,
        high: errorsInInterval.filter((e) => e.severity === ERROR_SEVERITY.HIGH).length,
        medium: errorsInInterval.filter((e) => e.severity === ERROR_SEVERITY.MEDIUM).length,
        low: errorsInInterval.filter((e) => e.severity === ERROR_SEVERITY.LOW).length,
      });
    }

    return trends;
  }

  /**
   * Get comprehensive dashboard data
   * @returns {Object} - Dashboard data
   */
  getDashboardData() {
    return {
      summary: {
        totalErrors: this.errors.length,
        last5min: this.getMetrics('5min').totalErrors,
        last1hour: this.getMetrics('1hour').totalErrors,
        last24hour: this.getMetrics('24hour').totalErrors,
        errorRate: this.getMetrics('1hour').errorRate,
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
      },
      metrics: {
        '5min': this.getMetrics('5min'),
        '1hour': this.getMetrics('1hour'),
        '24hour': this.getMetrics('24hour'),
      },
      trends: this.getErrorTrends(12, 5 * 60 * 1000), // Last hour, 5-min intervals
      categoryBreakdown: this.getCategoryBreakdown(),
      recentErrors: this.errors.slice(0, 20),
      alerts: this.getActiveAlerts(),
    };
  }

  /**
   * Get category breakdown with health scores
   * @returns {Object} - Category breakdown
   */
  getCategoryBreakdown() {
    const breakdown = {};
    const oneHourAgo = Date.now() - this.timeWindows['1hour'];

    Object.entries(ERROR_CATEGORIES).forEach(([key, category]) => {
      const recentErrors = this.errors.filter(
        (err) => err.category === category && err.timestampMs >= oneHourAgo
      );

      const criticalCount = recentErrors.filter((e) => e.severity === ERROR_SEVERITY.CRITICAL)
        .length;
      const highCount = recentErrors.filter((e) => e.severity === ERROR_SEVERITY.HIGH).length;

      // Calculate health score (0-100)
      let healthScore = 100;
      if (criticalCount > 0) healthScore -= criticalCount * 20;
      if (highCount > 0) healthScore -= highCount * 10;
      healthScore = Math.max(0, healthScore);

      breakdown[category] = {
        total: recentErrors.length,
        critical: criticalCount,
        high: highCount,
        healthScore,
        status: healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'degraded' : 'unhealthy',
      };
    });

    return breakdown;
  }

  /**
   * Check alert conditions and emit alerts
   * @param {Object} error - Error object
   */
  checkAlertConditions(error) {
    const alerts = [];

    // Check error rate
    const last5MinErrors = this.getMetrics('5min').totalErrors;
    const errorRate = last5MinErrors / 5; // Errors per minute
    if (errorRate > this.thresholds.errorRatePerMinute) {
      alerts.push({
        type: 'HIGH_ERROR_RATE',
        severity: ERROR_SEVERITY.HIGH,
        message: `Error rate (${errorRate.toFixed(2)}/min) exceeds threshold (${this.thresholds.errorRatePerMinute}/min)`,
        threshold: this.thresholds.errorRatePerMinute,
        current: errorRate.toFixed(2),
      });
    }

    // Check critical errors
    if (error.severity === ERROR_SEVERITY.CRITICAL) {
      const lastHourCritical = this.errors.filter(
        (e) =>
          e.severity === ERROR_SEVERITY.CRITICAL &&
          e.timestampMs >= Date.now() - this.timeWindows['1hour']
      ).length;

      if (lastHourCritical >= this.thresholds.criticalErrorsPerHour) {
        alerts.push({
          type: 'CRITICAL_ERROR_THRESHOLD',
          severity: ERROR_SEVERITY.CRITICAL,
          message: `Critical errors (${lastHourCritical}) exceeded threshold (${this.thresholds.criticalErrorsPerHour}) in the last hour`,
          threshold: this.thresholds.criticalErrorsPerHour,
          current: lastHourCritical,
        });
      }
    }

    // Check consecutive errors
    const recentErrors = this.errors.slice(0, this.thresholds.consecutiveErrors);
    if (
      recentErrors.length === this.thresholds.consecutiveErrors &&
      recentErrors.every((e) => e.timestampMs >= Date.now() - 60000)
    ) {
      alerts.push({
        type: 'CONSECUTIVE_ERRORS',
        severity: ERROR_SEVERITY.HIGH,
        message: `${this.thresholds.consecutiveErrors} consecutive errors in the last minute`,
        threshold: this.thresholds.consecutiveErrors,
        current: recentErrors.length,
      });
    }

    // Emit alerts
    alerts.forEach((alert) => {
      this.emit('alert', alert);
      logger.warn('Error monitoring alert triggered', alert);

      // Console warning for immediate visibility
      console.warn(
        `\n⚠️  ERROR MONITORING ALERT: ${alert.type}\n` +
          `   ${alert.message}\n` +
          `   Severity: ${alert.severity}\n`
      );
    });
  }

  /**
   * Get active alerts
   * @returns {Array} - Active alerts
   */
  getActiveAlerts() {
    const alerts = [];
    const now = Date.now();

    // Check current error rate
    const last5MinErrors = this.getMetrics('5min').totalErrors;
    const errorRate = last5MinErrors / 5;
    if (errorRate > this.thresholds.errorRatePerMinute) {
      alerts.push({
        type: 'HIGH_ERROR_RATE',
        severity: ERROR_SEVERITY.HIGH,
        message: `High error rate: ${errorRate.toFixed(2)} errors/min`,
        active: true,
        since: new Date(now - 5 * 60 * 1000).toISOString(),
      });
    }

    // Check critical errors
    const lastHourCritical = this.errors.filter(
      (e) => e.severity === ERROR_SEVERITY.CRITICAL && e.timestampMs >= now - this.timeWindows['1hour']
    ).length;

    if (lastHourCritical >= this.thresholds.criticalErrorsPerHour) {
      alerts.push({
        type: 'CRITICAL_ERROR_THRESHOLD',
        severity: ERROR_SEVERITY.CRITICAL,
        message: `${lastHourCritical} critical errors in the last hour`,
        active: true,
        since: new Date(now - 60 * 60 * 1000).toISOString(),
      });
    }

    return alerts;
  }

  /**
   * Clear old errors (cleanup task)
   */
  cleanupOldErrors() {
    const cutoffTime = Date.now() - this.timeWindows['24hour'];
    const before = this.errors.length;
    this.errors = this.errors.filter((err) => err.timestampMs >= cutoffTime);
    const removed = before - this.errors.length;

    if (removed > 0) {
      logger.debug(`Cleaned up ${removed} old errors from monitoring history`);
    }
  }

  /**
   * Start cleanup task
   */
  startCleanupTask() {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanupOldErrors();
    }, 60 * 60 * 1000);
  }

  /**
   * Reset monitoring data (for testing)
   */
  reset() {
    this.errors = [];
    this.errorCounts.forEach((value, key) => {
      this.errorCounts.set(key, 0);
    });
    logger.info('Error monitoring data reset');
  }

  /**
   * Get service statistics
   * @returns {Object} - Service statistics
   */
  getStats() {
    return {
      totalErrorsTracked: this.errors.length,
      maxHistory: this.maxErrorHistory,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      uptimeFormatted: this.formatUptime((Date.now() - this.startTime) / 1000),
      thresholds: this.thresholds,
      categoryCounts: Object.fromEntries(this.errorCounts),
    };
  }

  /**
   * Format uptime in human-readable format
   * @param {number} seconds - Uptime in seconds
   * @returns {string} - Formatted uptime
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
}

// Export singleton instance
const errorMonitoringService = new ErrorMonitoringService();

module.exports = {
  errorMonitoringService,
  ErrorMonitoringService,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
};
