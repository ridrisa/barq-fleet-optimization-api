/**
 * Audit Service
 * Comprehensive audit logging with tamper-evident hash chaining
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');

// Audit event types
const AUDIT_EVENTS = {
  // Authentication
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILURE: 'auth.login.failure',
  LOGOUT: 'auth.logout',
  TOKEN_REFRESH: 'auth.token.refresh',
  TOKEN_REVOKED: 'auth.token.revoked',

  // Authorization
  ACCESS_GRANTED: 'authz.access.granted',
  ACCESS_DENIED: 'authz.access.denied',
  PERMISSION_CHANGED: 'authz.permission.changed',
  ROLE_CHANGED: 'authz.role.changed',

  // Data Access
  DATA_READ: 'data.read',
  DATA_CREATE: 'data.create',
  DATA_UPDATE: 'data.update',
  DATA_DELETE: 'data.delete',
  DATA_EXPORT: 'data.export',

  // Configuration
  CONFIG_CHANGED: 'config.changed',
  SETTINGS_UPDATED: 'settings.updated',

  // Security
  SECURITY_VIOLATION: 'security.violation',
  RATE_LIMIT_EXCEEDED: 'security.rate_limit',
  BRUTE_FORCE_ATTEMPT: 'security.brute_force',
  SUSPICIOUS_ACTIVITY: 'security.suspicious',

  // System
  SYSTEM_ERROR: 'system.error',
  SYSTEM_WARNING: 'system.warning',
  DEPLOYMENT: 'system.deployment',
  BACKUP: 'system.backup',
};

class AuditService {
  constructor() {
    this.auditLogDir = path.join(__dirname, '../../logs/audit');
    this.currentLogFile = null;
    this.previousHash = '0';
    this.logsBuffer = [];
    this.bufferSize = 100;
    this.flushInterval = 5000; // 5 seconds
    this.enabled = process.env.AUDIT_LOGGING_ENABLED !== 'false';

    // Initialize audit logging
    this.initialize();
  }

  /**
   * Initialize audit logging system
   */
  async initialize() {
    try {
      // Create audit log directory
      await fs.mkdir(this.auditLogDir, { recursive: true });

      // Load last hash from previous logs
      await this.loadLastHash();

      // Start periodic flush
      this.startPeriodicFlush();

      logger.info('Audit logging initialized', {
        directory: this.auditLogDir,
        previousHash: this.previousHash,
      });
    } catch (error) {
      logger.error('Failed to initialize audit logging', { error: error.message });
    }
  }

  /**
   * Load the last hash from previous audit logs
   */
  async loadLastHash() {
    try {
      const files = await fs.readdir(this.auditLogDir);
      const auditFiles = files
        .filter((f) => f.startsWith('audit-') && f.endsWith('.jsonl'))
        .sort()
        .reverse();

      if (auditFiles.length > 0) {
        const lastFile = path.join(this.auditLogDir, auditFiles[0]);
        const content = await fs.readFile(lastFile, 'utf8');
        const lines = content.trim().split('\n').filter(Boolean);

        if (lines.length > 0) {
          const lastLog = JSON.parse(lines[lines.length - 1]);
          this.previousHash = lastLog.hash || '0';
          logger.info('Loaded previous audit hash', { hash: this.previousHash });
        }
      }
    } catch (error) {
      logger.warn('Could not load previous audit hash', { error: error.message });
      this.previousHash = '0';
    }
  }

  /**
   * Log an audit event
   */
  async log(eventType, details = {}) {
    if (!this.enabled) {
      return;
    }

    try {
      const auditEntry = {
        id: this.generateId(),
        timestamp: new Date().toISOString(),
        eventType,
        userId: details.userId || null,
        organizationId: details.organizationId || null,
        resource: details.resource || null,
        resourceId: details.resourceId || null,
        action: details.action || null,
        changes: details.changes || null,
        metadata: {
          ipAddress: details.ipAddress || null,
          userAgent: details.userAgent || null,
          requestId: details.requestId || null,
          sessionId: details.sessionId || null,
        },
        result: details.result || 'success',
        reason: details.reason || null,
        previousHash: this.previousHash,
        hash: null,
      };

      // Calculate hash (includes previous hash for chain integrity)
      auditEntry.hash = this.calculateHash(auditEntry);
      this.previousHash = auditEntry.hash;

      // Add to buffer
      this.logsBuffer.push(auditEntry);

      // Flush if buffer is full
      if (this.logsBuffer.length >= this.bufferSize) {
        await this.flush();
      }

      // Also log to winston for immediate visibility
      logger.info('Audit event', {
        eventType,
        userId: auditEntry.userId,
        resource: auditEntry.resource,
        action: auditEntry.action,
      });

      return auditEntry;
    } catch (error) {
      logger.error('Failed to create audit log', { error: error.message, eventType });
    }
  }

  /**
   * Calculate hash for audit entry (tamper-evident)
   */
  calculateHash(entry) {
    const data = JSON.stringify({
      timestamp: entry.timestamp,
      eventType: entry.eventType,
      userId: entry.userId,
      resource: entry.resource,
      resourceId: entry.resourceId,
      action: entry.action,
      changes: entry.changes,
      previousHash: entry.previousHash,
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate unique ID for audit entry
   */
  generateId() {
    return `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Get current log file path
   */
  getCurrentLogFilePath() {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.auditLogDir, `audit-${date}.jsonl`);
  }

  /**
   * Flush buffered logs to file
   */
  async flush() {
    if (this.logsBuffer.length === 0) {
      return;
    }

    try {
      const logFile = this.getCurrentLogFilePath();
      const logLines = `${this.logsBuffer.map((entry) => JSON.stringify(entry)).join('\n')}\n`;

      await fs.appendFile(logFile, logLines, 'utf8');

      logger.debug('Flushed audit logs', {
        count: this.logsBuffer.length,
        file: logFile,
      });

      this.logsBuffer = [];
    } catch (error) {
      logger.error('Failed to flush audit logs', { error: error.message });
    }
  }

  /**
   * Start periodic flush
   */
  startPeriodicFlush() {
    setInterval(() => {
      this.flush().catch((error) => {
        logger.error('Periodic flush failed', { error: error.message });
      });
    }, this.flushInterval);
  }

  /**
   * Verify audit log integrity
   */
  async verifyIntegrity(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const entries = content
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));

      let previousHash = '0';
      const violations = [];

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];

        // Check if previous hash matches
        if (entry.previousHash !== previousHash) {
          violations.push({
            index: i,
            entryId: entry.id,
            reason: 'Previous hash mismatch',
            expected: previousHash,
            actual: entry.previousHash,
          });
        }

        // Recalculate hash
        const calculatedHash = this.calculateHash(entry);
        if (entry.hash !== calculatedHash) {
          violations.push({
            index: i,
            entryId: entry.id,
            reason: 'Hash mismatch (tampered)',
            expected: calculatedHash,
            actual: entry.hash,
          });
        }

        previousHash = entry.hash;
      }

      return {
        valid: violations.length === 0,
        totalEntries: entries.length,
        violations,
      };
    } catch (error) {
      logger.error('Failed to verify audit log integrity', { error: error.message, filePath });
      throw error;
    }
  }

  /**
   * Query audit logs
   */
  async query(filters = {}) {
    try {
      const files = await fs.readdir(this.auditLogDir);
      const auditFiles = files.filter((f) => f.startsWith('audit-') && f.endsWith('.jsonl'));

      let results = [];

      for (const file of auditFiles) {
        const filePath = path.join(this.auditLogDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const entries = content
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line));

        results = results.concat(entries);
      }

      // Apply filters
      if (filters.eventType) {
        results = results.filter((e) => e.eventType === filters.eventType);
      }
      if (filters.userId) {
        results = results.filter((e) => e.userId === filters.userId);
      }
      if (filters.resource) {
        results = results.filter((e) => e.resource === filters.resource);
      }
      if (filters.startDate) {
        results = results.filter((e) => e.timestamp >= filters.startDate);
      }
      if (filters.endDate) {
        results = results.filter((e) => e.timestamp <= filters.endDate);
      }

      // Sort by timestamp (newest first)
      results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Limit results
      const limit = filters.limit || 100;
      return results.slice(0, limit);
    } catch (error) {
      logger.error('Failed to query audit logs', { error: error.message });
      throw error;
    }
  }

  /**
   * Get audit statistics
   */
  async getStatistics(startDate, endDate) {
    try {
      const logs = await this.query({ startDate, endDate });

      const stats = {
        totalEvents: logs.length,
        byEventType: {},
        byUser: {},
        byResource: {},
        successRate: 0,
        timeRange: {
          start: startDate,
          end: endDate,
        },
      };

      let successCount = 0;

      for (const log of logs) {
        // Count by event type
        stats.byEventType[log.eventType] = (stats.byEventType[log.eventType] || 0) + 1;

        // Count by user
        if (log.userId) {
          stats.byUser[log.userId] = (stats.byUser[log.userId] || 0) + 1;
        }

        // Count by resource
        if (log.resource) {
          stats.byResource[log.resource] = (stats.byResource[log.resource] || 0) + 1;
        }

        // Count successes
        if (log.result === 'success') {
          successCount++;
        }
      }

      stats.successRate = logs.length > 0 ? (successCount / logs.length) * 100 : 0;

      return stats;
    } catch (error) {
      logger.error('Failed to get audit statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Convenience methods for common audit events
   */

  async logLogin(userId, ipAddress, userAgent, success = true, reason = null) {
    return this.log(success ? AUDIT_EVENTS.LOGIN_SUCCESS : AUDIT_EVENTS.LOGIN_FAILURE, {
      userId,
      action: 'login',
      result: success ? 'success' : 'failure',
      reason,
      ipAddress,
      userAgent,
    });
  }

  async logAuthEvent(userId, action, result, metadata = {}) {
    const eventTypeMap = {
      register: result === 'success' ? AUDIT_EVENTS.LOGIN_SUCCESS : AUDIT_EVENTS.LOGIN_FAILURE,
      login: result === 'success' ? AUDIT_EVENTS.LOGIN_SUCCESS : AUDIT_EVENTS.LOGIN_FAILURE,
      logout: AUDIT_EVENTS.LOGOUT,
      password_change: AUDIT_EVENTS.CONFIG_CHANGED,
    };

    const eventType = eventTypeMap[action] || AUDIT_EVENTS.LOGIN_FAILURE;

    return this.log(eventType, {
      userId,
      action,
      result: result === 'success' ? 'success' : 'failure',
      reason: metadata.reason || null,
      ipAddress: metadata.ipAddress || null,
      userAgent: metadata.userAgent || null,
      requestId: metadata.requestId || null,
      sessionId: metadata.sessionId || null,
    });
  }

  async logDataAccess(userId, resource, resourceId, action, changes = null, metadata = {}) {
    const eventType =
      {
        read: AUDIT_EVENTS.DATA_READ,
        create: AUDIT_EVENTS.DATA_CREATE,
        update: AUDIT_EVENTS.DATA_UPDATE,
        delete: AUDIT_EVENTS.DATA_DELETE,
      }[action] || AUDIT_EVENTS.DATA_READ;

    return this.log(eventType, {
      userId,
      resource,
      resourceId,
      action,
      changes,
      ...metadata,
    });
  }

  async logAccessDenied(userId, resource, action, reason, metadata = {}) {
    return this.log(AUDIT_EVENTS.ACCESS_DENIED, {
      userId,
      resource,
      action,
      result: 'denied',
      reason,
      ...metadata,
    });
  }

  async logSecurityViolation(description, metadata = {}) {
    return this.log(AUDIT_EVENTS.SECURITY_VIOLATION, {
      action: 'security_violation',
      reason: description,
      result: 'violation',
      ...metadata,
    });
  }

  async logConfigChange(userId, changes, metadata = {}) {
    return this.log(AUDIT_EVENTS.CONFIG_CHANGED, {
      userId,
      resource: 'config',
      action: 'update',
      changes,
      ...metadata,
    });
  }
}

// Export singleton instance
const auditService = new AuditService();

// Graceful shutdown - flush remaining logs
process.on('SIGTERM', async () => {
  logger.info('Flushing audit logs before shutdown');
  await auditService.flush();
});

process.on('SIGINT', async () => {
  logger.info('Flushing audit logs before shutdown');
  await auditService.flush();
});

module.exports = {
  auditService,
  AuditService,
  AUDIT_EVENTS,
};
