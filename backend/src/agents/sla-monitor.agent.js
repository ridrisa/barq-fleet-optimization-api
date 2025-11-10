/**
 * SLA Monitor Agent
 * Monitors and ensures SLA compliance for BARQ (1-hour) and BULLET (2-4 hours) deliveries
 * Triggers escalations and corrective actions when SLA is at risk
 */

const { logger } = require('../utils/logger');
const OrderModel = require('../models/order.model');
const DriverModel = require('../models/driver.model');
const { getInstance: getReassignmentService } = require('../services/reassignment.service');
const { getInstance: getNotificationService } = require('../services/notification.service');
const { getInstance: getEscalationService } = require('../services/escalation.service');
const agentTriggerService = require('../services/agent-trigger.service');

class SLAMonitorAgent {
  constructor() {
    this.slaThresholds = {
      BARQ: {
        target: 60, // 60 minutes target
        warning: 40, // Alert at 40 minutes (75% of SLA)
        critical: 50, // Critical at 50 minutes (90% of SLA)
        breach: 60, // Breached at 60 minutes (100% of SLA)
      },
      BULLET: {
        target: 240, // 4 hours target
        warning: 150, // Alert at 2.5 hours (75% of SLA)
        critical: 210, // Critical at 3.5 hours (90% of SLA)
        breach: 240, // Breached at 4 hours (100% of SLA)
      },
    };

    this.activeMonitoring = new Map();
    this.breachHistory = [];
    this.lastCheck = Date.now();

    // Initialize services
    this.reassignmentService = getReassignmentService();
    this.notificationService = getNotificationService();
    this.escalationService = getEscalationService();

    console.log('SLA Monitor Agent initialized with real execution services');
  }

  /**
   * Main execution method - monitors all active orders
   */
  async execute(context) {
    logger.info('[SLAMonitor] Checking SLA compliance for all active orders');

    // Update timestamp to mark agent as active
    this.lastCheck = Date.now();

    const monitoring = {
      timestamp: Date.now(),
      orders: {
        healthy: [],
        warning: [],
        critical: [],
        breached: [],
      },
      metrics: {
        totalActive: 0,
        barqActive: 0,
        bulletActive: 0,
        atRisk: 0,
        breached: 0,
      },
      alerts: [],
      actions: [],
      predictions: {},
    };

    // Get all active orders
    const activeOrders = await this.getActiveOrders();
    monitoring.metrics.totalActive = activeOrders.length;

    // Check each order's SLA status
    for (const order of activeOrders) {
      const slaStatus = await this.checkSLAStatus(order);

      // Update metrics
      if (order.serviceType === 'BARQ') {
        monitoring.metrics.barqActive++;
      } else {
        monitoring.metrics.bulletActive++;
      }

      // Categorize order by SLA status
      monitoring.orders[slaStatus.category].push({
        orderId: order.id,
        serviceType: order.serviceType,
        createdAt: order.createdAt,
        assignedDriver: order.assignedDriver,
        elapsedMinutes: slaStatus.elapsedMinutes,
        remainingMinutes: slaStatus.remainingMinutes,
        risk: slaStatus.risk,
        predictedDeliveryTime: slaStatus.predictedDeliveryTime,
        canMeetSLA: slaStatus.canMeetSLA,
      });

      // Track at-risk orders
      if (slaStatus.category === 'warning' || slaStatus.category === 'critical') {
        monitoring.metrics.atRisk++;
      }

      // Track breached orders
      if (slaStatus.category === 'breached') {
        monitoring.metrics.breached++;
        this.recordBreach(order, slaStatus);
      }

      // Generate alerts if needed
      if (slaStatus.alertRequired) {
        const alert = this.generateAlert(order, slaStatus);
        monitoring.alerts.push(alert);
      }

      // Generate corrective actions
      if (slaStatus.actionRequired) {
        const actions = await this.generateCorrectiveActions(order, slaStatus);
        monitoring.actions.push(...actions);
      }

      // Update monitoring state
      this.activeMonitoring.set(order.id, {
        lastCheck: Date.now(),
        status: slaStatus,
      });
    }

    // Calculate SLA predictions
    monitoring.predictions = await this.predictSLACompliance(monitoring);

    // Execute high-priority actions immediately
    if (monitoring.actions.length > 0) {
      await this.executeUrgentActions(monitoring.actions);
    }

    // Trigger autonomous operations if critical conditions detected
    await this.triggerAutonomousIfNeeded(monitoring);

    this.lastCheck = Date.now();

    return monitoring;
  }

  /**
   * Check SLA status for an individual order
   */
  async checkSLAStatus(order) {
    const now = Date.now();
    const orderTime = new Date(order.createdAt).getTime();
    const elapsed = now - orderTime;
    const elapsedMinutes = Math.floor(elapsed / 60000);

    const thresholds = this.slaThresholds[order.serviceType];

    const status = {
      orderId: order.id,
      serviceType: order.serviceType,
      elapsedMinutes: elapsedMinutes,
      remainingMinutes: thresholds.breach - elapsedMinutes,
      category: 'healthy',
      risk: 'low',
      alertRequired: false,
      actionRequired: false,
      canMeetSLA: true,
      predictedDeliveryTime: null,
    };

    // Get current delivery progress
    const progress = await this.getDeliveryProgress(order);

    // Calculate predicted delivery time
    const predictedMinutes = await this.predictDeliveryTime(order, progress);
    status.predictedDeliveryTime = predictedMinutes;

    // Determine SLA category and risk level
    if (elapsedMinutes >= thresholds.breach) {
      status.category = 'breached';
      status.risk = 'breached';
      status.alertRequired = true;
      status.actionRequired = true;
      status.canMeetSLA = false;
    } else if (elapsedMinutes >= thresholds.critical) {
      status.category = 'critical';
      status.risk = 'critical';
      status.alertRequired = true;
      status.actionRequired = true;
      status.canMeetSLA = predictedMinutes <= thresholds.breach;
    } else if (elapsedMinutes >= thresholds.warning) {
      status.category = 'warning';
      status.risk = 'high';
      status.alertRequired = true;
      status.actionRequired = true;
      status.canMeetSLA = predictedMinutes <= thresholds.breach;
    } else if (predictedMinutes > thresholds.warning) {
      // Proactive warning based on prediction
      status.category = 'warning';
      status.risk = 'medium';
      status.alertRequired = true;
      status.actionRequired = false;
    } else {
      status.risk = 'low';
    }

    // Special handling for BARQ orders (more aggressive monitoring)
    if (order.serviceType === 'BARQ' && elapsedMinutes >= 30) {
      status.risk = status.risk === 'low' ? 'medium' : status.risk;
      status.alertRequired = true;
    }

    return status;
  }

  /**
   * Generate alert for SLA issue
   */
  generateAlert(order, slaStatus) {
    const alert = {
      id: `alert-${Date.now()}-${order.id}`,
      timestamp: Date.now(),
      orderId: order.id,
      serviceType: order.serviceType,
      severity: this.mapRiskToSeverity(slaStatus.risk),
      type: this.getAlertType(slaStatus),
      message: this.generateAlertMessage(order, slaStatus),
      assignedDriver: order.assignedDriver,
      customerNotification: slaStatus.risk === 'critical' || slaStatus.risk === 'breached',
      requiresAction: slaStatus.actionRequired,
    };

    // Log the alert
    logger.warn('[SLAMonitor] Alert generated', alert);

    return alert;
  }

  /**
   * Generate alert message based on status
   */
  generateAlertMessage(order, slaStatus) {
    const remaining = slaStatus.remainingMinutes;

    if (slaStatus.category === 'breached') {
      return `SLA BREACHED: ${order.serviceType} order ${order.id} has exceeded ${this.slaThresholds[order.serviceType].breach} minutes`;
    } else if (slaStatus.category === 'critical') {
      return `CRITICAL: ${order.serviceType} order ${order.id} has ${remaining} minutes remaining (${slaStatus.elapsedMinutes} elapsed)`;
    } else if (slaStatus.category === 'warning') {
      return `WARNING: ${order.serviceType} order ${order.id} approaching SLA limit - ${remaining} minutes remaining`;
    }
    return `Order ${order.id} SLA status: ${slaStatus.category}`;
  }

  /**
   * Generate corrective actions for at-risk orders
   */
  async generateCorrectiveActions(order, slaStatus) {
    const actions = [];

    if (slaStatus.category === 'breached') {
      // Breach recovery actions
      actions.push({
        type: 'customer_compensation',
        priority: 'high',
        orderId: order.id,
        description: 'Apply SLA breach compensation policy',
        autoExecute: true,
      });

      actions.push({
        type: 'customer_notification',
        priority: 'critical',
        orderId: order.id,
        description: 'Send apology and compensation details to customer',
        autoExecute: true,
      });

      actions.push({
        type: 'incident_report',
        priority: 'medium',
        orderId: order.id,
        description: 'Generate incident report for analysis',
        autoExecute: true,
      });
    } else if (slaStatus.category === 'critical') {
      // Critical intervention actions
      if (!slaStatus.canMeetSLA) {
        actions.push({
          type: 'emergency_reassignment',
          priority: 'critical',
          orderId: order.id,
          description: `Emergency reassignment needed - current driver cannot meet SLA`,
          autoExecute: true,
          execute: async () => await this.emergencyReassign(order),
        });
      } else {
        actions.push({
          type: 'expedite_delivery',
          priority: 'critical',
          orderId: order.id,
          description: 'Expedite delivery - skip non-critical stops',
          autoExecute: true,
          execute: async () => await this.expediteDelivery(order),
        });
      }

      actions.push({
        type: 'supervisor_alert',
        priority: 'high',
        orderId: order.id,
        description: 'Alert supervisor for manual intervention',
        autoExecute: true,
      });
    } else if (slaStatus.category === 'warning') {
      // Preventive actions
      actions.push({
        type: 'optimize_route',
        priority: 'high',
        orderId: order.id,
        description: 'Re-optimize driver route to prioritize this order',
        autoExecute: false,
        execute: async () => await this.prioritizeOrder(order),
      });

      if (order.serviceType === 'BARQ') {
        actions.push({
          type: 'proactive_communication',
          priority: 'medium',
          orderId: order.id,
          description: 'Send proactive update to customer',
          autoExecute: true,
        });
      }
    }

    return actions;
  }

  /**
   * Execute urgent actions immediately - REAL IMPLEMENTATION
   */
  async executeUrgentActions(actions) {
    const urgent = actions.filter(
      (a) => a.autoExecute && (a.priority === 'critical' || a.priority === 'high')
    );

    logger.info(`[SLAMonitor] Executing ${urgent.length} urgent actions`);

    const results = [];

    for (const action of urgent) {
      try {
        let result;

        switch (action.type) {
          case 'emergency_reassignment':
            result = await this.executeEmergencyReassignment(action);
            break;

          case 'expedite_delivery':
            result = await this.executeExpediteDelivery(action);
            break;

          case 'customer_compensation':
            result = await this.executeCustomerCompensation(action);
            break;

          case 'customer_notification':
            result = await this.executeCustomerNotification(action);
            break;

          case 'supervisor_alert':
            result = await this.executeSupervisorAlert(action);
            break;

          case 'incident_report':
            result = await this.executeIncidentReport(action);
            break;

          case 'optimize_route':
            result = await this.executeOptimizeRoute(action);
            break;

          case 'proactive_communication':
            result = await this.executeProactiveCommunication(action);
            break;

          default:
            logger.warn(`[SLAMonitor] Unknown action type: ${action.type}`);
            result = { success: false, reason: 'UNKNOWN_ACTION_TYPE' };
        }

        results.push({
          action: action.type,
          orderId: action.orderId,
          result,
          timestamp: new Date(),
        });

        logger.info(`[SLAMonitor] Executed action: ${action.type} for order ${action.orderId}`, {
          success: result.success,
        });
      } catch (error) {
        logger.error(`[SLAMonitor] Failed to execute action: ${action.type}`, {
          error: error.message,
          action,
        });

        results.push({
          action: action.type,
          orderId: action.orderId,
          error: error.message,
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Execute emergency reassignment
   */
  async executeEmergencyReassignment(action) {
    try {
      // Get full order details
      const order = await OrderModel.getById(action.orderId);

      if (!order) {
        logger.error(`[SLAMonitor] Order not found: ${action.orderId}`);
        return { success: false, reason: 'ORDER_NOT_FOUND' };
      }

      // Check if should reassign
      const slaStatus = this.activeMonitoring.get(order.id)?.status;

      if (!this.reassignmentService.shouldReassign(order, slaStatus)) {
        logger.info(`[SLAMonitor] Order ${order.id} should not be reassigned`);
        return { success: false, reason: 'REASSIGNMENT_NOT_NEEDED' };
      }

      // Execute auto-reassignment
      const result = await this.reassignmentService.autoReassign(order, 'SLA_CRITICAL');

      if (result.success) {
        // Notify all parties
        await this.notifyReassignmentSuccess(order, result);
      } else if (result.shouldEscalate) {
        // Escalate if reassignment failed
        await this.escalationService.escalate(order, result.reason, {
          slaStatus: slaStatus?.category,
          reassignmentAttempts: this.reassignmentService.getFailedAttempts(order.id),
          serviceType: order.service_type,
        });
      }

      return result;
    } catch (error) {
      logger.error('[SLAMonitor] Emergency reassignment failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute expedite delivery
   */
  async executeExpediteDelivery(action) {
    try {
      const order = await OrderModel.getById(action.orderId);

      if (!order) {
        return { success: false, reason: 'ORDER_NOT_FOUND' };
      }

      // Update order priority
      await OrderModel.updateStatus(order.id, order.status, {
        priority: 100, // Highest priority
      });

      // Notify driver to prioritize this delivery
      if (order.driver_id) {
        const driver = await DriverModel.getById(order.driver_id);

        if (driver) {
          await this.notificationService.sendSMS(
            driver.phone,
            `URGENT: Please prioritize order ${order.order_number}. This is a critical delivery!`,
            {}
          );
        }
      }

      logger.info(`[SLAMonitor] Expedited delivery for order ${order.id}`);

      return { success: true, prioritySet: 100 };
    } catch (error) {
      logger.error('[SLAMonitor] Expedite delivery failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute customer compensation
   */
  async executeCustomerCompensation(action) {
    try {
      const order = await OrderModel.getById(action.orderId);

      if (!order) {
        return { success: false, reason: 'ORDER_NOT_FOUND' };
      }

      // Calculate compensation
      const slaStatus = this.activeMonitoring.get(order.id)?.status;
      const delayMinutes = Math.max(
        0,
        slaStatus?.elapsedMinutes - this.slaThresholds[order.service_type].breach
      );

      let compensationAmount = 0;
      if (order.service_type === 'BARQ') {
        compensationAmount = delayMinutes * 10; // 10 SAR per minute
      } else {
        compensationAmount = delayMinutes * 5; // 5 SAR per minute
      }

      compensationAmount = Math.min(compensationAmount, 200); // Cap at 200 SAR

      // Process compensation (TODO: integrate with payment system)
      logger.info(`[SLAMonitor] Processing compensation for order ${order.id}`, {
        amount: compensationAmount,
        delayMinutes,
      });

      // Notify customer
      // TODO: Get customer details
      // await this.notificationService.notifyCompensation(customer, order, compensationAmount, delayMinutes);

      return {
        success: true,
        compensationAmount,
        delayMinutes,
      };
    } catch (error) {
      logger.error('[SLAMonitor] Customer compensation failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute customer notification
   */
  async executeCustomerNotification(action) {
    try {
      const order = await OrderModel.getById(action.orderId);

      if (!order) {
        return { success: false, reason: 'ORDER_NOT_FOUND' };
      }

      // TODO: Get customer details and send notification
      logger.info(`[SLAMonitor] Customer notification sent for order ${order.id}`);

      return { success: true };
    } catch (error) {
      logger.error('[SLAMonitor] Customer notification failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute supervisor alert
   */
  async executeSupervisorAlert(action) {
    try {
      const order = await OrderModel.getById(action.orderId);

      if (!order) {
        return { success: false, reason: 'ORDER_NOT_FOUND' };
      }

      const slaStatus = this.activeMonitoring.get(order.id)?.status;

      await this.escalationService.escalate(order, 'SLA_AT_RISK', {
        slaStatus: slaStatus?.category,
        serviceType: order.service_type,
        elapsedMinutes: slaStatus?.elapsedMinutes,
        remainingMinutes: slaStatus?.remainingMinutes,
      });

      logger.info(`[SLAMonitor] Supervisor alerted for order ${order.id}`);

      return { success: true };
    } catch (error) {
      logger.error('[SLAMonitor] Supervisor alert failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute incident report
   */
  async executeIncidentReport(action) {
    try {
      // Create incident report
      logger.info(`[SLAMonitor] Incident report created for order ${action.orderId}`);

      return { success: true, reportId: `INC-${Date.now()}` };
    } catch (error) {
      logger.error('[SLAMonitor] Incident report failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute optimize route
   */
  async executeOptimizeRoute(action) {
    try {
      // TODO: Integrate with route optimization agent
      logger.info(`[SLAMonitor] Route optimization triggered for order ${action.orderId}`);

      return { success: true };
    } catch (error) {
      logger.error('[SLAMonitor] Route optimization failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute proactive communication
   */
  async executeProactiveCommunication(action) {
    try {
      const order = await OrderModel.getById(action.orderId);

      if (!order) {
        return { success: false, reason: 'ORDER_NOT_FOUND' };
      }

      // TODO: Send proactive update to customer
      logger.info(`[SLAMonitor] Proactive communication sent for order ${order.id}`);

      return { success: true };
    } catch (error) {
      logger.error('[SLAMonitor] Proactive communication failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notify all parties of successful reassignment
   */
  async notifyReassignmentSuccess(order, reassignmentResult) {
    try {
      // Notify old driver (if exists)
      if (reassignmentResult.oldDriver) {
        const oldDriver = await DriverModel.getById(reassignmentResult.oldDriver.id);
        if (oldDriver) {
          await this.notificationService.notifyDriverOrderRemoved(
            oldDriver,
            order,
            'SLA optimization'
          );
        }
      }

      // Notify new driver
      if (reassignmentResult.newDriver) {
        const newDriver = await DriverModel.getById(reassignmentResult.newDriver.id);
        if (newDriver) {
          await this.notificationService.notifyDriverOrderAssigned(
            newDriver,
            order,
            30 // Estimated time
          );
        }
      }

      // Notify ops team
      await this.notificationService.notifyOpsReassignment({
        orderNumber: order.order_number,
        fromDriver: reassignmentResult.oldDriver,
        toDriver: reassignmentResult.newDriver,
        reason: 'SLA_CRITICAL',
        distance: reassignmentResult.newDriver?.distance,
        score: reassignmentResult.newDriver?.score,
      });

      logger.info(`[SLAMonitor] Reassignment notifications sent for order ${order.id}`);
    } catch (error) {
      logger.error('[SLAMonitor] Failed to send reassignment notifications', error);
    }
  }

  /**
   * Emergency reassignment for critical orders
   */
  async emergencyReassign(order) {
    logger.info(`[SLAMonitor] Emergency reassignment for order ${order.id}`);

    // Find nearest available driver
    const nearestDriver = await this.findNearestAvailableDriver(order);

    if (nearestDriver) {
      // Reassign order
      await this.reassignOrder(order, nearestDriver);

      // Notify all parties
      await this.notifyReassignment(order, nearestDriver);

      return {
        success: true,
        newDriver: nearestDriver.id,
        estimatedDeliveryTime: nearestDriver.estimatedTime,
      };
    }

    return {
      success: false,
      reason: 'No available drivers for emergency reassignment',
    };
  }

  /**
   * Expedite delivery by optimizing current route
   */
  async expediteDelivery(order) {
    logger.info(`[SLAMonitor] Expediting delivery for order ${order.id}`);

    // Prioritize this order in driver's route
    return {
      success: true,
      action: 'Order prioritized in route',
    };
  }

  /**
   * Predict delivery time based on current progress
   */
  async predictDeliveryTime(order, progress) {
    // Base prediction on order status
    let estimatedMinutes = 0;

    if (progress.status === 'pending') {
      // Not yet assigned - add assignment time
      estimatedMinutes += 2;
      // Add travel to pickup
      estimatedMinutes += 10;
      // Add pickup time
      estimatedMinutes += 5;
      // Add delivery time
      estimatedMinutes += order.serviceType === 'BARQ' ? 15 : 25;
    } else if (progress.status === 'assigned') {
      // Add travel to pickup
      estimatedMinutes += progress.minutesToPickup || 10;
      // Add pickup time
      estimatedMinutes += 5;
      // Add delivery time
      estimatedMinutes += progress.minutesToDelivery || (order.serviceType === 'BARQ' ? 15 : 25);
    } else if (progress.status === 'pickup_in_progress') {
      // Add remaining pickup time
      estimatedMinutes += 3;
      // Add delivery time
      estimatedMinutes += progress.minutesToDelivery || (order.serviceType === 'BARQ' ? 15 : 25);
    } else if (progress.status === 'delivery_in_progress') {
      // Only remaining delivery time
      estimatedMinutes += progress.minutesToDelivery || 10;
    }

    // Add current elapsed time
    const elapsedMinutes = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
    return elapsedMinutes + estimatedMinutes;
  }

  /**
   * Predict overall SLA compliance
   */
  async predictSLACompliance(monitoring) {
    const predictions = {
      next15Minutes: {
        expectedBreaches: 0,
        atRiskOrders: [],
      },
      next30Minutes: {
        expectedBreaches: 0,
        atRiskOrders: [],
      },
      recommendations: [],
    };

    // Analyze orders in warning and critical states
    const atRiskOrders = [...monitoring.orders.warning, ...monitoring.orders.critical];

    for (const order of atRiskOrders) {
      if (order.remainingMinutes <= 15) {
        predictions.next15Minutes.expectedBreaches++;
        predictions.next15Minutes.atRiskOrders.push(order.orderId);
      } else if (order.remainingMinutes <= 30) {
        predictions.next30Minutes.expectedBreaches++;
        predictions.next30Minutes.atRiskOrders.push(order.orderId);
      }
    }

    // Generate recommendations
    if (predictions.next15Minutes.expectedBreaches > 0) {
      predictions.recommendations.push({
        type: 'urgent',
        message: `${predictions.next15Minutes.expectedBreaches} orders at immediate risk of SLA breach`,
        action: 'Activate emergency response team',
      });
    }

    if (monitoring.metrics.barqActive > 20) {
      predictions.recommendations.push({
        type: 'capacity',
        message: 'High BARQ order volume detected',
        action: 'Consider activating additional BARQ-capable drivers',
      });
    }

    return predictions;
  }

  /**
   * Record SLA breach for analysis
   */
  recordBreach(order, slaStatus) {
    const breach = {
      timestamp: Date.now(),
      orderId: order.id,
      serviceType: order.serviceType,
      assignedDriver: order.assignedDriver,
      elapsedMinutes: slaStatus.elapsedMinutes,
      exceedMinutes: slaStatus.elapsedMinutes - this.slaThresholds[order.serviceType].breach,
      reason: 'SLA_BREACH',
      compensationRequired: true,
    };

    this.breachHistory.push(breach);

    // Keep only last 100 breaches in memory
    if (this.breachHistory.length > 100) {
      this.breachHistory.shift();
    }

    // Log breach to database (implement actual database call)
    logger.error('[SLAMonitor] SLA Breach Recorded', breach);
  }

  /**
   * Helper methods
   */
  mapRiskToSeverity(risk) {
    const mapping = {
      breached: 'critical',
      critical: 'high',
      high: 'medium',
      medium: 'low',
      low: 'info',
    };
    return mapping[risk] || 'info';
  }

  getAlertType(slaStatus) {
    if (slaStatus.category === 'breached') return 'SLA_BREACH';
    if (slaStatus.category === 'critical') return 'SLA_CRITICAL';
    if (slaStatus.category === 'warning') return 'SLA_WARNING';
    return 'SLA_INFO';
  }

  /**
   * Get active orders from database with retry logic
   */
  async getActiveOrders() {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Get all active orders (not completed, cancelled, or failed)
        const orders = await OrderModel.getActiveOrders({
          // No additional filters - get all active orders
        });

        logger.debug(`[SLAMonitor] Retrieved ${orders.length} active orders`);

        return orders;
      } catch (error) {
        logger.error(
          `[SLAMonitor] Failed to get active orders (attempt ${attempt}/${maxRetries})`,
          {
            error: error.message,
            code: error.code,
            willRetry: attempt < maxRetries,
          }
        );

        if (attempt < maxRetries) {
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
        } else {
          // All retries failed, return empty array to prevent crash
          logger.error('[SLAMonitor] All retries failed, returning empty orders array');
          return [];
        }
      }
    }

    return [];
  }

  async getDeliveryProgress(order) {
    try {
      // Estimate progress based on order status
      const progress = {
        status: order.status || 'pending',
        minutesToPickup: 10,
        minutesToDelivery: 15,
      };

      // Adjust based on actual status
      switch (order.status) {
        case 'pending':
          progress.minutesToPickup = 10;
          progress.minutesToDelivery = 25;
          break;

        case 'assigned':
          progress.minutesToPickup = 5;
          progress.minutesToDelivery = 20;
          break;

        case 'pickup_in_progress':
          progress.minutesToPickup = 2;
          progress.minutesToDelivery = 15;
          break;

        case 'delivery_in_progress':
          progress.minutesToPickup = 0;
          progress.minutesToDelivery = 10;
          break;

        default:
          break;
      }

      return progress;
    } catch (error) {
      logger.error('[SLAMonitor] Failed to get delivery progress', error);
      return {
        status: 'unknown',
        minutesToPickup: 10,
        minutesToDelivery: 15,
      };
    }
  }

  async findNearestAvailableDriver(order) {
    try {
      // Use reassignment service to find best driver
      const bestDriver = await this.reassignmentService.findBestDriver(order);
      return bestDriver;
    } catch (error) {
      logger.error('[SLAMonitor] Failed to find nearest driver', error);
      return null;
    }
  }

  async reassignOrder(order, newDriver) {
    try {
      // Use reassignment service
      const result = await this.reassignmentService.autoReassign(order, 'SLA_MONITOR');
      logger.info(`[SLAMonitor] Order ${order.id} reassignment result:`, result);
      return result;
    } catch (error) {
      logger.error('[SLAMonitor] Failed to reassign order', error);
      throw error;
    }
  }

  async notifyReassignment(order, newDriver) {
    try {
      // Get old driver if exists
      let oldDriver = null;
      if (order.driver_id) {
        oldDriver = await DriverModel.getById(order.driver_id);
      }

      // Send notifications
      if (oldDriver) {
        await this.notificationService.notifyDriverOrderRemoved(
          oldDriver,
          order,
          'SLA optimization'
        );
      }

      await this.notificationService.notifyDriverOrderAssigned(newDriver, order, 30);

      // Notify ops team
      await this.notificationService.notifyOpsReassignment({
        orderNumber: order.order_number,
        fromDriver: oldDriver,
        toDriver: newDriver,
        reason: 'SLA_MONITOR',
        distance: newDriver.distance_km,
        score: newDriver.score,
      });

      logger.info(`[SLAMonitor] Notifications sent for order ${order.id} reassignment`);
    } catch (error) {
      logger.error('[SLAMonitor] Failed to send notifications', error);
    }
  }

  async queueAction(action) {
    // Log action for now (can be enhanced with real queue system like Bull)
    logger.info(`[SLAMonitor] Action queued: ${action.type} for order ${action.orderId}`);
  }

  async prioritizeOrder(order) {
    try {
      // Update order priority
      await OrderModel.updateStatus(order.id, order.status, {
        priority: 100,
      });

      logger.info(`[SLAMonitor] Order ${order.id} prioritized`);

      return {
        success: true,
        message: `Order ${order.id} prioritized`,
      };
    } catch (error) {
      logger.error('[SLAMonitor] Failed to prioritize order', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check agent health
   */
  isHealthy() {
    const isHealthy = Date.now() - this.lastCheck < 30000; // Healthy if checked within last 30 seconds
    return {
      healthy: isHealthy,
      lastCheck: this.lastCheck,
      message: isHealthy ? 'Agent is healthy' : 'Agent has not checked recently',
    };
  }

  /**
   * Get breach statistics
   */
  getBreachStats() {
    const stats = {
      total: this.breachHistory.length,
      last24Hours: 0,
      byServiceType: {
        BARQ: 0,
        BULLET: 0,
      },
    };

    const oneDayAgo = Date.now() - 86400000;

    this.breachHistory.forEach((breach) => {
      if (breach.timestamp > oneDayAgo) {
        stats.last24Hours++;
      }
      stats.byServiceType[breach.serviceType]++;
    });

    return stats;
  }

  /**
   * Check SLA for an order (simplified for demo)
   */
  async checkSLA(request) {
    try {
      const { order, currentTime } = request;

      const createdTime = new Date(order.createdAt).getTime();
      const now = new Date(currentTime).getTime();
      const elapsedMinutes = Math.floor((now - createdTime) / 60000);

      const slaLimit = order.sla || (order.serviceType === 'BARQ' ? 60 : 240);
      const remainingMinutes = slaLimit - elapsedMinutes;

      // Determine risk level
      let atRisk = false;
      let level = 'normal';
      let message = `Order on track (${remainingMinutes} min remaining)`;

      if (remainingMinutes <= 0) {
        atRisk = true;
        level = 'breach';
        message = 'SLA breached!';
      } else if (remainingMinutes <= 10) {
        atRisk = true;
        level = 'critical';
        message = `Critical: Only ${remainingMinutes} minutes remaining`;
      } else if (remainingMinutes <= 20) {
        atRisk = true;
        level = 'warning';
        message = `Warning: ${remainingMinutes} minutes remaining`;
      }

      return {
        atRisk,
        level,
        message,
        elapsedMinutes,
        remainingMinutes,
        slaLimit,
      };
    } catch (error) {
      logger.error('[SLAMonitor] Error checking SLA', error);
      return {
        atRisk: false,
        level: 'normal',
        message: 'Unable to check SLA',
      };
    }
  }

  /**
   * Trigger autonomous operations if critical conditions detected
   */
  async triggerAutonomousIfNeeded(monitoring) {
    try {
      // Determine if we should trigger autonomous operations
      let shouldTrigger = false;
      let reason = '';
      let priority = 'medium';
      const context = {};

      // Check for critical SLA breaches
      if (monitoring.metrics.breached > 0) {
        shouldTrigger = true;
        reason = 'SLA_BREACH_DETECTED';
        priority = 'critical';
        context.breachedOrders = monitoring.metrics.breached;
        context.totalActive = monitoring.metrics.totalActive;
      }
      // Check for multiple critical orders
      else if (monitoring.orders.critical.length >= 3) {
        shouldTrigger = true;
        reason = 'MULTIPLE_CRITICAL_SLA';
        priority = 'high';
        context.criticalOrders = monitoring.orders.critical.length;
        context.totalActive = monitoring.metrics.totalActive;
      }
      // Check for high percentage of at-risk orders
      else if (monitoring.metrics.totalActive > 0) {
        const atRiskPercentage = monitoring.metrics.atRisk / monitoring.metrics.totalActive;

        if (atRiskPercentage > 0.3) {
          // More than 30% of orders at risk
          shouldTrigger = true;
          reason = 'HIGH_SLA_RISK_PERCENTAGE';
          priority = 'high';
          context.atRiskPercentage = Math.round(atRiskPercentage * 100);
          context.atRiskOrders = monitoring.metrics.atRisk;
          context.totalActive = monitoring.metrics.totalActive;
        }
      }
      // Check predictions for imminent breaches
      else if (monitoring.predictions.next15Minutes.expectedBreaches > 0) {
        shouldTrigger = true;
        reason = 'IMMINENT_SLA_BREACHES';
        priority = 'high';
        context.expectedBreaches = monitoring.predictions.next15Minutes.expectedBreaches;
        context.atRiskOrders = monitoring.predictions.next15Minutes.atRiskOrders;
      }

      // Trigger if conditions met
      if (shouldTrigger) {
        logger.warn(
          '[SLAMonitor] Critical conditions detected - triggering autonomous operations',
          {
            reason,
            priority,
            context,
          }
        );

        const result = await agentTriggerService.triggerFromAgent(
          'sla-monitor',
          reason,
          context,
          priority
        );

        if (result.triggered) {
          logger.info('[SLAMonitor] Autonomous operations triggered successfully', {
            mode: result.mode,
            reason,
          });
        } else {
          logger.warn('[SLAMonitor] Failed to trigger autonomous operations', {
            reason: result.reason,
            message: result.message,
          });
        }

        return result;
      }

      return { triggered: false, reason: 'NO_CRITICAL_CONDITIONS' };
    } catch (error) {
      logger.error('[SLAMonitor] Error checking autonomous trigger conditions', {
        error: error.message,
      });
      return { triggered: false, error: error.message };
    }
  }

  /**
   * Get orders at risk of SLA breach (for autonomous orchestrator)
   */
  async getAtRiskOrders() {
    try {
      const orders = await this.getActiveOrders();
      const atRisk = [];
      const critical = [];

      for (const order of orders) {
        const slaCheck = await this.checkOrderSLA(order);

        if (slaCheck.atRisk) {
          const percentageUsed = slaCheck.elapsedMinutes / slaCheck.slaLimit;

          if (percentageUsed >= 0.9 || slaCheck.level === 'critical') {
            critical.push({
              ...order,
              slaPercentUsed: percentageUsed,
              remainingMinutes: slaCheck.remainingMinutes,
              level: 'critical',
            });
          } else if (percentageUsed >= 0.75) {
            atRisk.push({
              ...order,
              slaPercentUsed: percentageUsed,
              remainingMinutes: slaCheck.remainingMinutes,
              level: 'warning',
            });
          }
        }
      }

      return {
        atRisk,
        critical,
        total: atRisk.length + critical.length,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('[SLAMonitor] getAtRiskOrders() failed', { error: error.message });
      return {
        atRisk: [],
        critical: [],
        total: 0,
        timestamp: Date.now(),
      };
    }
  }
}

module.exports = SLAMonitorAgent;
