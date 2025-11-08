/**
 * Escalation Service
 * Handles failed reassignments and critical order escalations
 */

const { logger } = require('../utils/logger');
const db = require('../database');
const { getInstance: getNotificationService } = require('./notification.service');

class EscalationService {
  constructor() {
    this.escalations = [];
    this.escalationLevels = {
      LEVEL_1: {
        name: 'Supervisor Alert',
        autoResolve: true,
        actions: ['supervisor_sms', 'ops_email', 'dashboard_alert'],
      },
      LEVEL_2: {
        name: 'Operations Manager',
        autoResolve: false,
        actions: ['manager_call', 'ops_email', 'dashboard_critical', 'external_courier'],
      },
      LEVEL_3: {
        name: 'Emergency Response',
        autoResolve: false,
        actions: [
          'emergency_team',
          'customer_compensation',
          'incident_report',
          'c_level_notification',
        ],
      },
    };

    this.escalationReasons = {
      NO_AVAILABLE_DRIVERS: 'LEVEL_2',
      MAX_REASSIGNMENT_ATTEMPTS: 'LEVEL_2',
      SLA_CRITICAL_BREACH: 'LEVEL_3',
      DRIVER_CANCELLED: 'LEVEL_1',
      SYSTEM_ERROR: 'LEVEL_2',
      TRAFFIC_INCIDENT: 'LEVEL_1',
      VEHICLE_BREAKDOWN: 'LEVEL_2',
      CUSTOMER_EMERGENCY: 'LEVEL_3',
    };

    this.activeEscalations = new Map();
    this.notificationService = getNotificationService();
  }

  /**
   * Escalate an order
   */
  async escalate(order, reason, metadata = {}) {
    try {
      logger.warn(`[EscalationService] Escalating order ${order.id}`, {
        orderId: order.id,
        reason,
        metadata,
      });

      // Determine escalation level
      const level = this.determineEscalationLevel(reason, metadata);

      // Check if already escalated
      if (this.activeEscalations.has(order.id)) {
        const existing = this.activeEscalations.get(order.id);

        // Escalate to higher level if needed
        if (this.isHigherLevel(level, existing.level)) {
          logger.warn(
            `[EscalationService] Escalating to higher level: ${existing.level} -> ${level}`
          );
          return await this.escalateToHigherLevel(order, reason, level, existing);
        }

        // Already escalated at same or higher level
        logger.info(`[EscalationService] Order already escalated at level ${existing.level}`);
        return {
          success: true,
          alreadyEscalated: true,
          escalationId: existing.id,
          level: existing.level,
        };
      }

      // Create escalation record
      const escalation = await this.createEscalation(order, reason, level, metadata);

      // Execute escalation actions
      await this.executeEscalationActions(escalation);

      // Store in active escalations
      this.activeEscalations.set(order.id, escalation);

      // Record in history
      this.recordEscalation(escalation);

      logger.info(`[EscalationService] Order ${order.id} escalated to ${level}`, {
        escalationId: escalation.id,
      });

      return {
        success: true,
        escalationId: escalation.id,
        level: level,
        actions: this.escalationLevels[level].actions,
      };
    } catch (error) {
      logger.error('[EscalationService] Failed to escalate order', {
        error: error.message,
        orderId: order.id,
        reason,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Determine escalation level based on reason and metadata
   */
  determineEscalationLevel(reason, metadata) {
    // Check predefined escalation levels
    if (this.escalationReasons[reason]) {
      return this.escalationReasons[reason];
    }

    // Determine based on metadata
    if (metadata.slaBreachMinutes > 30) {
      return 'LEVEL_3';
    }

    if (metadata.reassignmentAttempts >= 3) {
      return 'LEVEL_2';
    }

    if (metadata.serviceType === 'BARQ' && metadata.slaStatus === 'critical') {
      return 'LEVEL_2';
    }

    // Default to Level 1
    return 'LEVEL_1';
  }

  /**
   * Check if level A is higher than level B
   */
  isHigherLevel(levelA, levelB) {
    const levels = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'];
    return levels.indexOf(levelA) > levels.indexOf(levelB);
  }

  /**
   * Create escalation record
   */
  async createEscalation(order, reason, level, metadata) {
    const escalationId = `ESC-${Date.now()}-${order.id}`;

    const escalation = {
      id: escalationId,
      orderId: order.id,
      orderNumber: order.order_number,
      serviceType: order.service_type,
      reason: reason,
      level: level,
      metadata: metadata,
      status: 'active',
      createdAt: new Date(),
      resolvedAt: null,
      actions: [],
      notifications: [],
    };

    // Save to database
    try {
      await this.saveEscalationToDatabase(escalation);
    } catch (error) {
      logger.error('[EscalationService] Failed to save escalation to database', error);
      // Continue with escalation even if DB save fails
    }

    return escalation;
  }

  /**
   * Execute escalation actions based on level
   */
  async executeEscalationActions(escalation) {
    const level = this.escalationLevels[escalation.level];
    const actions = level.actions;

    logger.info(`[EscalationService] Executing ${actions.length} actions for ${escalation.level}`);

    for (const action of actions) {
      try {
        const result = await this.executeAction(action, escalation);
        escalation.actions.push({
          action,
          result,
          timestamp: new Date(),
        });
      } catch (error) {
        logger.error(`[EscalationService] Failed to execute action: ${action}`, error);
        escalation.actions.push({
          action,
          error: error.message,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Execute individual escalation action
   */
  async executeAction(action, escalation) {
    switch (action) {
      case 'supervisor_sms':
        return await this.notifySupervisorSMS(escalation);

      case 'ops_email':
        return await this.notifyOpsEmail(escalation);

      case 'dashboard_alert':
        return await this.createDashboardAlert(escalation, 'high');

      case 'dashboard_critical':
        return await this.createDashboardAlert(escalation, 'critical');

      case 'manager_call':
        return await this.triggerManagerCall(escalation);

      case 'external_courier':
        return await this.contactExternalCourier(escalation);

      case 'emergency_team':
        return await this.activateEmergencyTeam(escalation);

      case 'customer_compensation':
        return await this.processCustomerCompensation(escalation);

      case 'incident_report':
        return await this.generateIncidentReport(escalation);

      case 'c_level_notification':
        return await this.notifyCLevelExecutives(escalation);

      default:
        logger.warn(`[EscalationService] Unknown action: ${action}`);
        return { success: false, message: 'Unknown action' };
    }
  }

  /**
   * Notify supervisor via SMS
   */
  async notifySupervisorSMS(escalation) {
    const data = {
      orderNumber: escalation.orderNumber,
      reason: escalation.reason,
      serviceType: escalation.serviceType,
      slaStatus: escalation.metadata.slaStatus || 'unknown',
      attempts: escalation.metadata.reassignmentAttempts || 0,
    };

    const result = await this.notificationService.notifyEscalation(data);

    logger.info('[EscalationService] Supervisor SMS sent', {
      escalationId: escalation.id,
      result,
    });

    return result;
  }

  /**
   * Notify ops team via email
   */
  async notifyOpsEmail(escalation) {
    const data = {
      orderNumber: escalation.orderNumber,
      reason: escalation.reason,
      serviceType: escalation.serviceType,
      level: escalation.level,
      metadata: escalation.metadata,
    };

    const result = await this.notificationService.notifyOpsReassignment(data);

    logger.info('[EscalationService] Ops email sent', {
      escalationId: escalation.id,
    });

    return result;
  }

  /**
   * Create dashboard alert
   */
  async createDashboardAlert(escalation, severity) {
    // Emit WebSocket event for real-time dashboard
    this.notificationService.emit('escalation_alert', {
      escalationId: escalation.id,
      orderId: escalation.orderId,
      orderNumber: escalation.orderNumber,
      reason: escalation.reason,
      level: escalation.level,
      severity: severity,
      timestamp: new Date(),
    });

    logger.info('[EscalationService] Dashboard alert created', {
      escalationId: escalation.id,
      severity,
    });

    return { success: true, severity };
  }

  /**
   * Trigger manager call (automated system)
   */
  async triggerManagerCall(escalation) {
    // TODO: Integrate with automated calling system (Twilio Voice API)
    logger.info('[EscalationService] Manager call triggered', {
      escalationId: escalation.id,
    });

    return {
      success: true,
      message: 'Manager call queued',
      phone: process.env.OPERATIONS_MANAGER_PHONE,
    };
  }

  /**
   * Contact external courier service
   */
  async contactExternalCourier(escalation) {
    // TODO: Integrate with external courier API
    logger.info('[EscalationService] External courier contacted', {
      escalationId: escalation.id,
    });

    return {
      success: true,
      message: 'External courier request submitted',
      provider: 'backup-courier',
    };
  }

  /**
   * Activate emergency response team
   */
  async activateEmergencyTeam(escalation) {
    logger.warn('[EscalationService] EMERGENCY TEAM ACTIVATED', {
      escalationId: escalation.id,
      orderNumber: escalation.orderNumber,
    });

    // Send high-priority notifications to emergency team
    const emergencyContacts = process.env.EMERGENCY_TEAM_PHONES?.split(',') || [];

    for (const phone of emergencyContacts) {
      await this.notificationService.sendSMS(
        phone,
        `EMERGENCY: Order ${escalation.orderNumber} requires immediate attention. Reason: ${escalation.reason}`,
        {}
      );
    }

    return {
      success: true,
      message: 'Emergency team activated',
      contactedCount: emergencyContacts.length,
    };
  }

  /**
   * Process customer compensation
   */
  async processCustomerCompensation(escalation) {
    try {
      // Calculate compensation based on SLA breach
      const delayMinutes = escalation.metadata.slaBreachMinutes || 0;
      const serviceType = escalation.serviceType;

      let compensationAmount = 0;
      if (serviceType === 'BARQ') {
        // Express: 10 SAR per minute late
        compensationAmount = delayMinutes * 10;
      } else {
        // Standard: 5 SAR per minute late
        compensationAmount = delayMinutes * 5;
      }

      // Cap compensation at 200 SAR
      compensationAmount = Math.min(compensationAmount, 200);

      logger.info('[EscalationService] Processing customer compensation', {
        escalationId: escalation.id,
        compensationAmount,
        delayMinutes,
      });

      // TODO: Process actual compensation payment

      return {
        success: true,
        compensationAmount,
        delayMinutes,
      };
    } catch (error) {
      logger.error('[EscalationService] Failed to process compensation', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate incident report
   */
  async generateIncidentReport(escalation) {
    const report = {
      incidentId: `INC-${Date.now()}`,
      escalationId: escalation.id,
      orderNumber: escalation.orderNumber,
      serviceType: escalation.serviceType,
      reason: escalation.reason,
      level: escalation.level,
      metadata: escalation.metadata,
      timeline: escalation.actions,
      createdAt: new Date(),
      status: 'open',
    };

    // TODO: Save to incident management system

    logger.info('[EscalationService] Incident report generated', {
      incidentId: report.incidentId,
      escalationId: escalation.id,
    });

    return {
      success: true,
      incidentId: report.incidentId,
    };
  }

  /**
   * Notify C-level executives
   */
  async notifyCLevelExecutives(escalation) {
    logger.warn('[EscalationService] C-LEVEL NOTIFICATION', {
      escalationId: escalation.id,
      reason: escalation.reason,
    });

    const cLevelEmails = process.env.C_LEVEL_EMAILS?.split(',') || [];

    for (const email of cLevelEmails) {
      await this.notificationService.sendEmail(
        email,
        {
          subject: `CRITICAL: Order Escalation - ${escalation.orderNumber}`,
          body: `A critical order escalation requires executive attention.\n\nEscalation ID: ${escalation.id}\nOrder: ${escalation.orderNumber}\nReason: ${escalation.reason}\nLevel: ${escalation.level}\n\nImmediate action required.`,
        },
        {}
      );
    }

    return {
      success: true,
      message: 'C-level executives notified',
      recipientCount: cLevelEmails.length,
    };
  }

  /**
   * Escalate to higher level
   */
  async escalateToHigherLevel(order, reason, newLevel, existingEscalation) {
    existingEscalation.level = newLevel;
    existingEscalation.reason = reason;
    existingEscalation.escalatedAt = new Date();

    // Execute higher-level actions
    await this.executeEscalationActions(existingEscalation);

    // Update database
    await this.updateEscalationInDatabase(existingEscalation);

    logger.warn(`[EscalationService] Escalated to ${newLevel}`, {
      escalationId: existingEscalation.id,
      orderId: order.id,
    });

    return {
      success: true,
      escalationId: existingEscalation.id,
      level: newLevel,
      escalated: true,
    };
  }

  /**
   * Resolve escalation
   */
  async resolveEscalation(escalationId, resolution) {
    const escalation = Array.from(this.activeEscalations.values()).find(
      (e) => e.id === escalationId
    );

    if (!escalation) {
      logger.warn(`[EscalationService] Escalation not found: ${escalationId}`);
      return { success: false, message: 'Escalation not found' };
    }

    escalation.status = 'resolved';
    escalation.resolvedAt = new Date();
    escalation.resolution = resolution;

    // Remove from active escalations
    this.activeEscalations.delete(escalation.orderId);

    // Update database
    await this.updateEscalationInDatabase(escalation);

    logger.info(`[EscalationService] Escalation resolved: ${escalationId}`, {
      resolution,
    });

    return {
      success: true,
      escalationId,
      resolution,
    };
  }

  /**
   * Save escalation to database
   */
  async saveEscalationToDatabase(escalation) {
    const query = `
      INSERT INTO escalations (
        escalation_id,
        order_id,
        order_number,
        service_type,
        reason,
        level,
        metadata,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await db.query(query, [
      escalation.id,
      escalation.orderId,
      escalation.orderNumber,
      escalation.serviceType,
      escalation.reason,
      escalation.level,
      JSON.stringify(escalation.metadata),
      escalation.status,
      escalation.createdAt,
    ]);
  }

  /**
   * Update escalation in database
   */
  async updateEscalationInDatabase(escalation) {
    const query = `
      UPDATE escalations
      SET
        level = $1,
        status = $2,
        resolved_at = $3,
        resolution = $4,
        actions = $5
      WHERE escalation_id = $6
    `;

    await db.query(query, [
      escalation.level,
      escalation.status,
      escalation.resolvedAt,
      escalation.resolution || null,
      JSON.stringify(escalation.actions),
      escalation.id,
    ]);
  }

  /**
   * Record escalation in history
   */
  recordEscalation(escalation) {
    this.escalations.push({
      ...escalation,
      recordedAt: new Date(),
    });

    // Keep only last 100 escalations
    if (this.escalations.length > 100) {
      this.escalations.shift();
    }
  }

  /**
   * Get active escalations
   */
  getActiveEscalations() {
    return Array.from(this.activeEscalations.values());
  }

  /**
   * Get escalation statistics
   */
  getStats(timeRangeMinutes = 60) {
    const cutoff = new Date(Date.now() - timeRangeMinutes * 60000);
    const recent = this.escalations.filter((e) => e.createdAt >= cutoff);

    const stats = {
      total: recent.length,
      active: this.activeEscalations.size,
      byLevel: {
        LEVEL_1: 0,
        LEVEL_2: 0,
        LEVEL_3: 0,
      },
      byReason: {},
      avgResolutionTime: 0,
    };

    recent.forEach((e) => {
      stats.byLevel[e.level] = (stats.byLevel[e.level] || 0) + 1;
      stats.byReason[e.reason] = (stats.byReason[e.reason] || 0) + 1;
    });

    return stats;
  }

  /**
   * Get escalation history
   */
  getHistory(limit = 50) {
    return this.escalations.slice(-limit).reverse();
  }
}

// Export singleton instance
let instance = null;

module.exports = {
  EscalationService,
  getInstance: () => {
    if (!instance) {
      instance = new EscalationService();
    }
    return instance;
  },
};
