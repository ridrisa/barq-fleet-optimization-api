/**
 * Notification Service
 * Handles multi-channel notifications (SMS, Email, Push, WebSocket)
 */

const { logger } = require('../utils/logger');
const EventEmitter = require('events');

class NotificationService extends EventEmitter {
  constructor() {
    super();
    this.channels = {
      sms: true, // Twilio integration
      email: true, // SendGrid integration
      push: true, // Firebase FCM integration
      websocket: true, // Real-time dashboard updates
    };

    this.notificationQueue = [];
    this.sentNotifications = [];
    this.templates = this.loadTemplates();
  }

  /**
   * Load notification templates
   */
  loadTemplates() {
    return {
      // Driver notifications
      ORDER_REASSIGNED_FROM: {
        sms: 'Order #{orderNumber} has been reassigned to another driver. You are now available for new orders.',
        email: {
          subject: 'Order Reassigned',
          body: 'Order #{orderNumber} has been reassigned. Reason: {reason}. You are now available.',
        },
        push: {
          title: 'Order Reassigned',
          body: 'Order #{orderNumber} reassigned to another driver',
        },
      },

      ORDER_ASSIGNED_TO: {
        sms: 'New order #{orderNumber} assigned! Pickup: {pickupAddress}. Deliver to: {dropoffAddress}. ETA: {eta} mins. Service: {serviceType}',
        email: {
          subject: 'New Order Assigned - #{orderNumber}',
          body: 'You have been assigned order #{orderNumber}.\nPickup: {pickupAddress}\nDropoff: {dropoffAddress}\nService: {serviceType}\nExpected delivery: {eta} minutes',
        },
        push: {
          title: 'New Order Assigned',
          body: 'Order #{orderNumber} - {serviceType} delivery',
        },
      },

      // Customer notifications
      DRIVER_UPDATED: {
        sms: 'Your order #{orderNumber} driver has been updated. New driver: {driverName} ({driverPhone}). Updated ETA: {eta} mins.',
        email: {
          subject: 'Order Update - Driver Changed',
          body: 'Your order #{orderNumber} has been assigned to a new driver.\n\nNew Driver: {driverName}\nPhone: {driverPhone}\nUpdated ETA: {eta} minutes\n\nReason: To ensure on-time delivery',
        },
        push: {
          title: 'Driver Updated',
          body: 'Your order has a new driver: {driverName}',
        },
      },

      ORDER_DELAYED: {
        sms: 'Order #{orderNumber} is delayed. New ETA: {eta} mins. We apologize for the inconvenience.',
        email: {
          subject: 'Order Delay Notification - #{orderNumber}',
          body: 'We regret to inform you that order #{orderNumber} is experiencing a delay.\n\nNew ETA: {eta} minutes\nReason: {reason}\n\nWe are working to deliver as soon as possible.',
        },
        push: {
          title: 'Order Delayed',
          body: 'Order #{orderNumber} - New ETA: {eta} mins',
        },
      },

      SLA_BREACH_COMPENSATION: {
        sms: 'We apologize for the delay on order #{orderNumber}. A compensation of {amount} SAR has been credited to your account.',
        email: {
          subject: 'Delivery Delay Compensation - #{orderNumber}',
          body: 'We sincerely apologize for the delay in delivering order #{orderNumber}.\n\nCompensation: {amount} SAR\nReason: Late delivery\nDelay: {delayMinutes} minutes\n\nThe compensation has been credited to your account.',
        },
        push: {
          title: 'Compensation Issued',
          body: '{amount} SAR credited for delayed order',
        },
      },

      // Ops team notifications
      EMERGENCY_ESCALATION: {
        sms: 'URGENT: Order #{orderNumber} escalated! Reason: {reason}. Immediate action required.',
        email: {
          subject: 'URGENT - Order Escalation #{orderNumber}',
          body: 'Order #{orderNumber} has been escalated.\n\nReason: {reason}\nService Type: {serviceType}\nSLA Status: {slaStatus}\nReassignment Attempts: {attempts}\n\nImmediate intervention required.',
        },
        push: {
          title: 'URGENT Escalation',
          body: 'Order #{orderNumber} - {reason}',
        },
      },

      REASSIGNMENT_EVENT: {
        email: {
          subject: 'Reassignment Event - #{orderNumber}',
          body: 'Order #{orderNumber} reassigned.\n\nFrom Driver: {fromDriver}\nTo Driver: {toDriver}\nReason: {reason}\nDistance: {distance}km\nDriver Score: {score}',
        },
      },

      SLA_AT_RISK: {
        sms: 'ALERT: {count} orders at risk of SLA breach. Check dashboard.',
        email: {
          subject: 'SLA Risk Alert - {count} Orders',
          body: '{count} orders are at risk of SLA breach.\n\nCritical: {critical}\nWarning: {warning}\n\nAction required.',
        },
        push: {
          title: 'SLA Risk Alert',
          body: '{count} orders at risk',
        },
      },
    };
  }

  /**
   * Send notification to driver (order reassigned FROM them)
   */
  async notifyDriverOrderRemoved(driver, order, reason) {
    try {
      const template = this.templates.ORDER_REASSIGNED_FROM;
      const data = {
        orderNumber: order.order_number,
        reason: reason || 'SLA optimization',
      };

      await this.sendMultiChannel(
        {
          phone: driver.phone,
          email: driver.email,
          fcmToken: driver.fcm_token,
        },
        template,
        data,
        {
          priority: 'normal',
          channels: ['sms', 'push'],
        }
      );

      logger.info(`[NotificationService] Notified driver ${driver.id} of order removal`);

      return { success: true };
    } catch (error) {
      logger.error('[NotificationService] Failed to notify driver of order removal', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification to driver (order assigned TO them)
   */
  async notifyDriverOrderAssigned(driver, order, eta) {
    try {
      const template = this.templates.ORDER_ASSIGNED_TO;
      const data = {
        orderNumber: order.order_number,
        pickupAddress: this.formatAddress(order.pickup_address),
        dropoffAddress: this.formatAddress(order.dropoff_address),
        eta: eta || 30,
        serviceType: order.service_type,
      };

      await this.sendMultiChannel(
        {
          phone: driver.phone,
          email: driver.email,
          fcmToken: driver.fcm_token,
        },
        template,
        data,
        {
          priority: 'high',
          channels: ['sms', 'push'],
        }
      );

      logger.info(`[NotificationService] Notified driver ${driver.id} of new order assignment`);

      return { success: true };
    } catch (error) {
      logger.error('[NotificationService] Failed to notify driver of order assignment', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification to customer (driver updated)
   */
  async notifyCustomerDriverUpdated(customer, order, newDriver, eta) {
    try {
      const template = this.templates.DRIVER_UPDATED;
      const data = {
        orderNumber: order.order_number,
        driverName: newDriver.name,
        driverPhone: newDriver.phone,
        eta: eta || 30,
      };

      await this.sendMultiChannel(
        {
          phone: customer.phone,
          email: customer.email,
          fcmToken: customer.fcm_token,
        },
        template,
        data,
        {
          priority: 'high',
          channels: ['sms', 'push', 'email'],
        }
      );

      logger.info(`[NotificationService] Notified customer ${customer.id} of driver update`);

      return { success: true };
    } catch (error) {
      logger.error('[NotificationService] Failed to notify customer of driver update', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification to ops team (reassignment event)
   */
  async notifyOpsReassignment(reassignmentData) {
    try {
      const template = this.templates.REASSIGNMENT_EVENT;
      const data = {
        orderNumber: reassignmentData.orderNumber,
        fromDriver: reassignmentData.fromDriver?.name || 'N/A',
        toDriver: reassignmentData.toDriver?.name || 'N/A',
        reason: reassignmentData.reason,
        distance: reassignmentData.distance?.toFixed(2) || '0',
        score: reassignmentData.score?.toFixed(3) || '0',
      };

      // Send to ops team emails
      const opsEmails = process.env.OPS_TEAM_EMAILS?.split(',') || [];

      for (const email of opsEmails) {
        await this.sendEmail(email, template.email, data);
      }

      // Send WebSocket update to dashboard
      this.emit('reassignment', reassignmentData);

      logger.info('[NotificationService] Notified ops team of reassignment');

      return { success: true };
    } catch (error) {
      logger.error('[NotificationService] Failed to notify ops team', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send escalation notification
   */
  async notifyEscalation(escalationData) {
    try {
      const template = this.templates.EMERGENCY_ESCALATION;
      const data = {
        orderNumber: escalationData.orderNumber,
        reason: escalationData.reason,
        serviceType: escalationData.serviceType,
        slaStatus: escalationData.slaStatus,
        attempts: escalationData.attempts || 0,
      };

      // Send SMS to supervisor
      const supervisorPhone = process.env.SUPERVISOR_PHONE;
      if (supervisorPhone) {
        await this.sendSMS(supervisorPhone, template.sms, data);
      }

      // Send email to ops team
      const opsEmails = process.env.OPS_TEAM_EMAILS?.split(',') || [];
      for (const email of opsEmails) {
        await this.sendEmail(email, template.email, data);
      }

      // Send push notification
      // Send to ops team devices
      const opsTokens = await this.getOpsTeamFCMTokens();
      for (const token of opsTokens) {
        await this.sendPushNotification(token, template.push, data);
      }

      // Emit WebSocket event
      this.emit('escalation', escalationData);

      logger.info('[NotificationService] Escalation notification sent', {
        orderNumber: escalationData.orderNumber,
        reason: escalationData.reason,
      });

      return { success: true };
    } catch (error) {
      logger.error('[NotificationService] Failed to send escalation notification', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send SLA breach compensation notification
   */
  async notifyCompensation(customer, order, compensationAmount, delayMinutes) {
    try {
      const template = this.templates.SLA_BREACH_COMPENSATION;
      const data = {
        orderNumber: order.order_number,
        amount: compensationAmount,
        delayMinutes: delayMinutes,
      };

      await this.sendMultiChannel(
        {
          phone: customer.phone,
          email: customer.email,
          fcmToken: customer.fcm_token,
        },
        template,
        data,
        {
          priority: 'normal',
          channels: ['sms', 'email', 'push'],
        }
      );

      logger.info(
        `[NotificationService] Sent compensation notification to customer ${customer.id}`
      );

      return { success: true };
    } catch (error) {
      logger.error('[NotificationService] Failed to send compensation notification', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send multi-channel notification
   */
  async sendMultiChannel(recipient, template, data, options = {}) {
    const { priority = 'normal', channels = ['sms', 'email', 'push'] } = options;

    const results = {};

    // Send SMS
    if (channels.includes('sms') && recipient.phone && this.channels.sms) {
      results.sms = await this.sendSMS(recipient.phone, template.sms, data);
    }

    // Send Email
    if (channels.includes('email') && recipient.email && this.channels.email) {
      results.email = await this.sendEmail(recipient.email, template.email, data);
    }

    // Send Push Notification
    if (channels.includes('push') && recipient.fcmToken && this.channels.push) {
      results.push = await this.sendPushNotification(recipient.fcmToken, template.push, data);
    }

    // Record notification
    this.recordNotification({
      recipient,
      template: template,
      data,
      results,
      priority,
      timestamp: new Date(),
    });

    return results;
  }

  /**
   * Send SMS via Twilio
   */
  async sendSMS(phone, template, data) {
    try {
      const message = this.interpolateTemplate(template, data);

      // TODO: Integrate with Twilio
      // const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      // await twilio.messages.create({
      //   body: message,
      //   from: process.env.TWILIO_PHONE_NUMBER,
      //   to: phone
      // });

      logger.info(`[NotificationService] SMS sent to ${phone}: ${message.substring(0, 50)}...`);

      return { success: true, channel: 'sms', message };
    } catch (error) {
      logger.error('[NotificationService] Failed to send SMS', error);
      return { success: false, channel: 'sms', error: error.message };
    }
  }

  /**
   * Send Email via SendGrid
   */
  async sendEmail(email, template, data) {
    try {
      const subject = this.interpolateTemplate(template.subject, data);
      const body = this.interpolateTemplate(template.body, data);

      // TODO: Integrate with SendGrid
      // const sgMail = require('@sendgrid/mail');
      // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      // await sgMail.send({
      //   to: email,
      //   from: process.env.SENDGRID_FROM_EMAIL,
      //   subject: subject,
      //   text: body
      // });

      logger.info(`[NotificationService] Email sent to ${email}: ${subject}`);

      return { success: true, channel: 'email', subject, body };
    } catch (error) {
      logger.error('[NotificationService] Failed to send email', error);
      return { success: false, channel: 'email', error: error.message };
    }
  }

  /**
   * Send Push Notification via Firebase FCM
   */
  async sendPushNotification(fcmToken, template, data) {
    try {
      const title = this.interpolateTemplate(template.title, data);
      const body = this.interpolateTemplate(template.body, data);

      // TODO: Integrate with Firebase FCM
      // const admin = require('firebase-admin');
      // await admin.messaging().send({
      //   token: fcmToken,
      //   notification: {
      //     title: title,
      //     body: body
      //   }
      // });

      logger.info(`[NotificationService] Push notification sent: ${title}`);

      return { success: true, channel: 'push', title, body };
    } catch (error) {
      logger.error('[NotificationService] Failed to send push notification', error);
      return { success: false, channel: 'push', error: error.message };
    }
  }

  /**
   * Interpolate template with data
   */
  interpolateTemplate(template, data) {
    if (!template) return '';

    let result = template;
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{${key}}`, 'g');
      result = result.replace(regex, value || '');
    }
    return result;
  }

  /**
   * Format address for display
   */
  formatAddress(address) {
    if (typeof address === 'string') {
      try {
        address = JSON.parse(address);
      } catch (e) {
        return address;
      }
    }

    if (!address) return 'N/A';

    return `${address.street || ''}, ${address.city || ''}, ${address.district || ''}`.trim();
  }

  /**
   * Get ops team FCM tokens
   */
  async getOpsTeamFCMTokens() {
    // TODO: Query from database
    return [];
  }

  /**
   * Record notification in history
   */
  recordNotification(notification) {
    this.sentNotifications.push(notification);

    // Keep only last 1000 notifications
    if (this.sentNotifications.length > 1000) {
      this.sentNotifications.shift();
    }
  }

  /**
   * Get notification history
   */
  getHistory(limit = 50) {
    return this.sentNotifications.slice(-limit).reverse();
  }

  /**
   * Get notification statistics
   */
  getStats(timeRangeMinutes = 60) {
    const cutoff = new Date(Date.now() - timeRangeMinutes * 60000);
    const recent = this.sentNotifications.filter((n) => n.timestamp >= cutoff);

    const stats = {
      total: recent.length,
      byChannel: {
        sms: 0,
        email: 0,
        push: 0,
      },
      byPriority: {
        high: 0,
        normal: 0,
      },
    };

    recent.forEach((n) => {
      if (n.results.sms?.success) stats.byChannel.sms++;
      if (n.results.email?.success) stats.byChannel.email++;
      if (n.results.push?.success) stats.byChannel.push++;

      stats.byPriority[n.priority] = (stats.byPriority[n.priority] || 0) + 1;
    });

    return stats;
  }
}

// Export singleton instance
let instance = null;

module.exports = {
  NotificationService,
  getInstance: () => {
    if (!instance) {
      instance = new NotificationService();
    }
    return instance;
  },
};
