/**
 * Action Authorization Service
 *
 * Manages which actions AI agents can execute autonomously vs requiring human approval.
 *
 * Authorization Levels:
 * - Level 1: Always allowed (no risk, immediate execution)
 * - Level 2: Conditionally allowed (requires validation against rules)
 * - Level 3: Requires human approval (high risk/impact)
 */

const { logger } = require('../utils/logger');

class ActionAuthorizationService {
  constructor() {
    // Define action authorization levels
    this.actionLevels = {
      // Level 1: Always allowed - No risk, immediate execution
      LEVEL_1: new Set([
        'SEND_STATUS_UPDATE',
        'LOG_METRIC',
        'UPDATE_ETA',
        'CALCULATE_ROUTE',
        'MONITOR_CONDITION',
        'GENERATE_REPORT',
        'UPDATE_DRIVER_LOCATION',
        'TRACK_PERFORMANCE',
      ]),

      // Level 2: Conditionally allowed - Requires validation
      LEVEL_2: new Set([
        'REASSIGN_ORDER',
        'NOTIFY_CUSTOMER',
        'NOTIFY_DRIVER',
        'REBALANCE_FLEET',
        'PREPOSITION_DRIVERS',
        'REROUTE_DRIVER',
        'SCHEDULE_BREAK',
        'ASSIGN_NEW_ORDER',
        'ESCALATE_TO_SUPERVISOR',
        'SEND_DELAY_NOTIFICATION',
      ]),

      // Level 3: Requires human approval - High risk/impact
      LEVEL_3: new Set([
        'CANCEL_ORDER',
        'ISSUE_REFUND',
        'HIRE_EXTERNAL_COURIER',
        'CHANGE_PRICING',
        'MODIFY_SLA_RULES',
        'TERMINATE_DRIVER',
        'EMERGENCY_SHUTDOWN',
      ]),
    };

    // Store pending approvals
    this.pendingApprovals = new Map();

    // Track execution history
    this.executionHistory = [];
  }

  /**
   * Check if an action can be executed autonomously
   * @param {string} action - Action name
   * @param {object} context - Action context (SLA status, driver info, etc.)
   * @param {string} agentName - Name of requesting agent
   * @returns {Promise<object>} Authorization result
   */
  async canExecuteAutonomously(action, context, agentName) {
    const level = this.getActionLevel(action);

    logger.debug('Authorization check', {
      action,
      level,
      agent: agentName,
      context,
    });

    // Level 1: Always allowed
    if (level === 1) {
      return {
        allowed: true,
        level: 1,
        reason: 'Low-risk action, authorized for autonomous execution',
        requiresApproval: false,
      };
    }

    // Level 2: Check constraints
    if (level === 2) {
      const validation = await this.validateConstraints(action, context, agentName);

      if (validation.allowed) {
        logger.info('Autonomous action authorized', {
          action,
          agent: agentName,
          reason: validation.reason,
        });
      } else {
        logger.warn('Autonomous action denied', {
          action,
          agent: agentName,
          reason: validation.reason,
        });
      }

      return {
        allowed: validation.allowed,
        level: 2,
        reason: validation.reason,
        requiresApproval: false,
        constraints: validation.constraints,
      };
    }

    // Level 3: Requires human approval
    if (level === 3) {
      const approvalRequest = await this.requestApproval(action, context, agentName);

      logger.warn('Human approval required', {
        action,
        agent: agentName,
        approvalId: approvalRequest.approvalId,
      });

      return {
        allowed: false,
        level: 3,
        reason: 'High-risk action requires human approval',
        requiresApproval: true,
        approvalId: approvalRequest.approvalId,
        approvalUrl: approvalRequest.approvalUrl,
      };
    }

    // Unknown action - deny by default
    logger.error('Unknown action requested', { action, agent: agentName });
    return {
      allowed: false,
      level: 0,
      reason: 'Unknown action type',
      requiresApproval: true,
    };
  }

  /**
   * Get authorization level for an action
   * @param {string} action - Action name
   * @returns {number} Level (1, 2, 3, or 0 for unknown)
   */
  getActionLevel(action) {
    if (this.actionLevels.LEVEL_1.has(action)) return 1;
    if (this.actionLevels.LEVEL_2.has(action)) return 2;
    if (this.actionLevels.LEVEL_3.has(action)) return 3;
    return 0; // Unknown
  }

  /**
   * Validate constraints for Level 2 actions
   * @param {string} action - Action name
   * @param {object} context - Action context
   * @param {string} agentName - Requesting agent
   * @returns {Promise<object>} Validation result
   */
  async validateConstraints(action, context, agentName) {
    switch (action) {
      case 'REASSIGN_ORDER':
        return this.validateReassignment(context);

      case 'REBALANCE_FLEET':
        return this.validateFleetRebalancing(context);

      case 'PREPOSITION_DRIVERS':
        return this.validateDriverPositioning(context);

      case 'REROUTE_DRIVER':
        return this.validateRerouting(context);

      case 'NOTIFY_CUSTOMER':
      case 'NOTIFY_DRIVER':
        return this.validateNotification(context);

      case 'SCHEDULE_BREAK':
        return this.validateBreakScheduling(context);

      case 'ASSIGN_NEW_ORDER':
        return this.validateOrderAssignment(context);

      case 'ESCALATE_TO_SUPERVISOR':
        return this.validateEscalation(context);

      default:
        return {
          allowed: false,
          reason: `No validation rules defined for action: ${action}`,
        };
    }
  }

  /**
   * Validate order reassignment
   */
  validateReassignment(context) {
    const { order, slaPercentUsed, currentDriver, proposedDriver } = context;

    // Must be at SLA risk (75%+)
    if (slaPercentUsed < 0.75) {
      return {
        allowed: false,
        reason: `SLA not at risk yet (${(slaPercentUsed * 100).toFixed(1)}% < 75%)`,
        constraints: { minSlaThreshold: 0.75, current: slaPercentUsed },
      };
    }

    // Proposed driver must be available
    if (!proposedDriver || proposedDriver.status !== 'AVAILABLE') {
      return {
        allowed: false,
        reason: 'No available driver found for reassignment',
        constraints: { requiresAvailableDriver: true },
      };
    }

    // Must improve ETA
    const improvement = (currentDriver?.eta || 0) - (proposedDriver?.eta || 0);
    if (improvement <= 5) {
      return {
        allowed: false,
        reason: `Reassignment would not significantly improve ETA (${improvement} min)`,
        constraints: { minImprovement: 5, actualImprovement: improvement },
      };
    }

    return {
      allowed: true,
      reason: `SLA at ${(slaPercentUsed * 100).toFixed(1)}%, reassignment will improve ETA by ${improvement} min`,
      constraints: {
        slaPercentUsed,
        etaImprovement: improvement,
      },
    };
  }

  /**
   * Validate fleet rebalancing
   */
  validateFleetRebalancing(context) {
    const { idleDrivers, demandImbalance, sourceZone, targetZone, driversToMove } = context;

    // Need sufficient idle drivers
    if (idleDrivers < 3) {
      return {
        allowed: false,
        reason: `Insufficient idle drivers (${idleDrivers} < 3)`,
        constraints: { minIdleDrivers: 3, current: idleDrivers },
      };
    }

    // Demand imbalance must be significant
    if (demandImbalance < 0.3) {
      return {
        allowed: false,
        reason: `Demand imbalance not significant (${(demandImbalance * 100).toFixed(1)}% < 30%)`,
        constraints: { minImbalance: 0.3, current: demandImbalance },
      };
    }

    // Don't move too many drivers at once
    if (driversToMove > 5) {
      return {
        allowed: false,
        reason: `Too many drivers to move at once (${driversToMove} > 5)`,
        constraints: { maxDriversPerMove: 5, requested: driversToMove },
      };
    }

    return {
      allowed: true,
      reason: `Significant demand imbalance (${(demandImbalance * 100).toFixed(1)}%), moving ${driversToMove} drivers`,
      constraints: {
        idleDrivers,
        demandImbalance,
        driversToMove,
      },
    };
  }

  /**
   * Validate driver positioning
   */
  validateDriverPositioning(context) {
    const { predictedDemand, confidence, driversNeeded, availableDrivers } = context;

    // Confidence must be reasonable
    if (confidence < 0.6) {
      return {
        allowed: false,
        reason: `Prediction confidence too low (${(confidence * 100).toFixed(1)}% < 60%)`,
        constraints: { minConfidence: 0.6, current: confidence },
      };
    }

    // Must have available drivers
    if (availableDrivers < driversNeeded) {
      return {
        allowed: false,
        reason: `Insufficient available drivers (${availableDrivers} < ${driversNeeded})`,
        constraints: { required: driversNeeded, available: availableDrivers },
      };
    }

    return {
      allowed: true,
      reason: `High-confidence prediction (${(confidence * 100).toFixed(1)}%), positioning ${driversNeeded} drivers`,
      constraints: {
        predictedDemand,
        confidence,
        driversNeeded,
      },
    };
  }

  /**
   * Validate driver rerouting
   */
  validateRerouting(context) {
    const { currentRoute, proposedRoute, delayMinutes, trafficSeverity } = context;

    // Only reroute for significant delays
    if (delayMinutes < 10) {
      return {
        allowed: false,
        reason: `Delay not significant enough (${delayMinutes} min < 10 min)`,
        constraints: { minDelay: 10, current: delayMinutes },
      };
    }

    // New route must be better
    const timeSaved = currentRoute.duration - proposedRoute.duration;
    if (timeSaved < 5) {
      return {
        allowed: false,
        reason: `Alternative route not significantly better (saves ${timeSaved} min < 5 min)`,
        constraints: { minTimeSaved: 5, actual: timeSaved },
      };
    }

    return {
      allowed: true,
      reason: `Traffic delay ${delayMinutes} min, new route saves ${timeSaved} min`,
      constraints: {
        delayMinutes,
        timeSaved,
        trafficSeverity,
      },
    };
  }

  /**
   * Validate customer/driver notification
   */
  validateNotification(context) {
    const { notificationType, urgency, recipientCount } = context;

    // Don't spam notifications
    if (recipientCount > 100) {
      return {
        allowed: false,
        reason: `Too many recipients (${recipientCount} > 100), requires approval`,
        constraints: { maxRecipients: 100, requested: recipientCount },
      };
    }

    return {
      allowed: true,
      reason: `Sending ${notificationType} notification to ${recipientCount} recipients`,
      constraints: { notificationType, recipientCount },
    };
  }

  /**
   * Validate break scheduling
   */
  validateBreakScheduling(context) {
    const { driver, consecutive_deliveries, hours_worked, break_type } = context;

    // Mandatory break after 5 consecutive deliveries
    if (break_type === 'MANDATORY' && consecutive_deliveries >= 5) {
      return {
        allowed: true,
        reason: `Mandatory break required after ${consecutive_deliveries} consecutive deliveries`,
        constraints: { consecutive_deliveries, break_type },
      };
    }

    // Max 8 hours worked
    if (hours_worked >= 8) {
      return {
        allowed: true,
        reason: `Break required after ${hours_worked} hours worked`,
        constraints: { hours_worked, break_type },
      };
    }

    // Voluntary break - allow if reasonable
    if (break_type === 'VOLUNTARY' && hours_worked >= 4) {
      return {
        allowed: true,
        reason: 'Voluntary break allowed after 4+ hours worked',
        constraints: { hours_worked, break_type },
      };
    }

    return {
      allowed: false,
      reason: 'Break conditions not met',
      constraints: { consecutive_deliveries, hours_worked },
    };
  }

  /**
   * Validate order assignment
   */
  validateOrderAssignment(context) {
    const { driver, order, distance, estimatedTime } = context;

    // Driver must be available
    if (driver.status !== 'AVAILABLE') {
      return {
        allowed: false,
        reason: `Driver not available (status: ${driver.status})`,
        constraints: { requiredStatus: 'AVAILABLE', current: driver.status },
      };
    }

    // Driver must have capacity
    if (driver.gap_from_target <= 0) {
      return {
        allowed: false,
        reason: 'Driver already met daily target',
        constraints: { gap_from_target: driver.gap_from_target },
      };
    }

    // Driver must meet performance threshold
    if (driver.on_time_rate < 0.9) {
      return {
        allowed: false,
        reason: `Driver on-time rate too low (${(driver.on_time_rate * 100).toFixed(1)}% < 90%)`,
        constraints: { minOnTimeRate: 0.9, current: driver.on_time_rate },
      };
    }

    return {
      allowed: true,
      reason: `Driver available with ${driver.gap_from_target} deliveries remaining`,
      constraints: {
        gap_from_target: driver.gap_from_target,
        on_time_rate: driver.on_time_rate,
        estimatedTime,
      },
    };
  }

  /**
   * Validate escalation to supervisor
   */
  validateEscalation(context) {
    const { severity, attempts, issue } = context;

    // Auto-escalate critical issues
    if (severity === 'CRITICAL') {
      return {
        allowed: true,
        reason: 'Critical severity requires supervisor attention',
        constraints: { severity },
      };
    }

    // Escalate after multiple failed attempts
    if (attempts >= 3) {
      return {
        allowed: true,
        reason: `${attempts} failed attempts, escalating to supervisor`,
        constraints: { attempts, maxAttempts: 3 },
      };
    }

    return {
      allowed: false,
      reason: 'Escalation threshold not met',
      constraints: { severity, attempts, threshold: 3 },
    };
  }

  /**
   * Request human approval for Level 3 actions
   */
  async requestApproval(action, context, agentName) {
    const approvalId = `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const approvalRequest = {
      id: approvalId,
      action,
      context,
      requestedBy: agentName,
      requestedAt: new Date(),
      status: 'PENDING',
      approvalUrl: `/admin/approvals/${approvalId}`,
    };

    this.pendingApprovals.set(approvalId, approvalRequest);

    // Log for notification system to pick up
    logger.warn('APPROVAL_REQUIRED', {
      approvalId,
      action,
      agent: agentName,
      severity: 'HIGH',
      requiresImmediateAttention: true,
    });

    return approvalRequest;
  }

  /**
   * Approve a pending action
   */
  async approveAction(approvalId, approvedBy) {
    const approval = this.pendingApprovals.get(approvalId);

    if (!approval) {
      throw new Error(`Approval not found: ${approvalId}`);
    }

    approval.status = 'APPROVED';
    approval.approvedBy = approvedBy;
    approval.approvedAt = new Date();

    logger.info('Action approved', {
      approvalId,
      action: approval.action,
      approvedBy,
    });

    return approval;
  }

  /**
   * Reject a pending action
   */
  async rejectAction(approvalId, rejectedBy, reason) {
    const approval = this.pendingApprovals.get(approvalId);

    if (!approval) {
      throw new Error(`Approval not found: ${approvalId}`);
    }

    approval.status = 'REJECTED';
    approval.rejectedBy = rejectedBy;
    approval.rejectedAt = new Date();
    approval.rejectionReason = reason;

    logger.info('Action rejected', {
      approvalId,
      action: approval.action,
      rejectedBy,
      reason,
    });

    return approval;
  }

  /**
   * Record action execution for audit trail
   */
  recordExecution(action, context, outcome, agentName) {
    const record = {
      timestamp: new Date(),
      action,
      agent: agentName,
      context,
      outcome,
      level: this.getActionLevel(action),
    };

    this.executionHistory.push(record);

    // Keep last 1000 records in memory
    if (this.executionHistory.length > 1000) {
      this.executionHistory.shift();
    }

    logger.info('Action executed', {
      action,
      agent: agentName,
      success: outcome.success,
      duration: outcome.duration,
    });

    return record;
  }

  /**
   * Get execution statistics
   */
  getStatistics(timeframe = '24h') {
    const cutoff = new Date(Date.now() - this.parseTimeframe(timeframe));
    const recent = this.executionHistory.filter((r) => r.timestamp >= cutoff);

    const stats = {
      total: recent.length,
      byLevel: { 1: 0, 2: 0, 3: 0 },
      byOutcome: { success: 0, failure: 0 },
      byAgent: {},
      successRate: 0,
    };

    recent.forEach((record) => {
      stats.byLevel[record.level]++;

      if (record.outcome.success) {
        stats.byOutcome.success++;
      } else {
        stats.byOutcome.failure++;
      }

      if (!stats.byAgent[record.agent]) {
        stats.byAgent[record.agent] = 0;
      }
      stats.byAgent[record.agent]++;
    });

    stats.successRate =
      stats.total > 0 ? ((stats.byOutcome.success / stats.total) * 100).toFixed(1) : 0;

    return stats;
  }

  /**
   * Parse timeframe string to milliseconds
   */
  parseTimeframe(timeframe) {
    const units = {
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
    };

    const match = timeframe.match(/^(\d+)([hdw])$/);
    if (!match) return 24 * 60 * 60 * 1000; // Default 24h

    const value = parseInt(match[1]);
    const unit = match[2];

    return value * units[unit];
  }
}

// Singleton instance
const actionAuthorizationService = new ActionAuthorizationService();

module.exports = actionAuthorizationService;
