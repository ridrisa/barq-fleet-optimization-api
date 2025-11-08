/**
 * Alert Service
 * Sends notifications to ops team via multiple channels
 */

const axios = require('axios');
const { logger } = require('../utils/logger');

// Alert levels
const ALERT_LEVELS = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INFO: 'INFO',
};

// Alert channels
const CHANNELS = {
  SLACK: 'slack',
  EMAIL: 'email',
  SMS: 'sms',
  PAGERDUTY: 'pagerduty',
  WEBHOOK: 'webhook',
};

class AlertService {
  constructor() {
    this.enabled = process.env.ALERTS_ENABLED === 'true';
    this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.pagerdutyKey = process.env.PAGERDUTY_KEY;
    this.smsApiKey = process.env.SMS_API_KEY;
    this.emailApiKey = process.env.EMAIL_API_KEY;
    this.emailRecipients = (process.env.ALERT_EMAIL_RECIPIENTS || '').split(',').filter(Boolean);
    this.smsRecipients = (process.env.ALERT_SMS_RECIPIENTS || '').split(',').filter(Boolean);

    // Alert rate limiting to prevent spam
    this.alertCache = new Map();
    this.alertCooldown = 300000; // 5 minutes

    // Alert statistics
    this.stats = {
      total: 0,
      byLevel: {},
      byChannel: {},
      failed: 0,
    };
  }

  /**
   * Send alert to appropriate channels based on severity
   */
  async sendAlert(level, title, message, context = {}) {
    if (!this.enabled) {
      logger.info('Alerts disabled, skipping notification', { level, title });
      return;
    }

    // Check rate limiting
    const alertKey = `${level}:${title}`;
    if (this.isRateLimited(alertKey)) {
      logger.warn('Alert rate limited, skipping', { alertKey });
      return;
    }

    // Update statistics
    this.updateStats(level);

    // Determine channels based on alert level
    const channels = this.getChannelsForLevel(level);

    // Build alert payload
    const alert = {
      level,
      title,
      message,
      context,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      service: 'BARQ Fleet Management API',
    };

    // Send to all appropriate channels
    const promises = channels.map((channel) =>
      this.sendToChannel(channel, alert).catch((error) => {
        logger.error(`Failed to send alert to ${channel}`, { error: error.message, alert });
        this.stats.failed++;
      })
    );

    try {
      await Promise.allSettled(promises);
      logger.info('Alert sent successfully', { level, title, channels });

      // Update rate limiting cache
      this.alertCache.set(alertKey, Date.now());
    } catch (error) {
      logger.error('Failed to send alerts', { error: error.message, alert });
    }
  }

  /**
   * Check if alert is rate limited
   */
  isRateLimited(alertKey) {
    const lastSent = this.alertCache.get(alertKey);
    if (!lastSent) return false;

    const timeSinceLastSent = Date.now() - lastSent;
    return timeSinceLastSent < this.alertCooldown;
  }

  /**
   * Get appropriate channels for alert level
   */
  getChannelsForLevel(level) {
    switch (level) {
      case ALERT_LEVELS.CRITICAL:
        return [CHANNELS.SMS, CHANNELS.PAGERDUTY, CHANNELS.SLACK, CHANNELS.EMAIL];

      case ALERT_LEVELS.HIGH:
        return [CHANNELS.SLACK, CHANNELS.EMAIL];

      case ALERT_LEVELS.MEDIUM:
        return [CHANNELS.EMAIL, CHANNELS.SLACK];

      case ALERT_LEVELS.LOW:
      case ALERT_LEVELS.INFO:
        return [CHANNELS.SLACK];

      default:
        return [CHANNELS.SLACK];
    }
  }

  /**
   * Send alert to specific channel
   */
  async sendToChannel(channel, alert) {
    switch (channel) {
      case CHANNELS.SLACK:
        return this.sendToSlack(alert);

      case CHANNELS.EMAIL:
        return this.sendEmail(alert);

      case CHANNELS.SMS:
        return this.sendSMS(alert);

      case CHANNELS.PAGERDUTY:
        return this.sendToPagerDuty(alert);

      default:
        logger.warn(`Unknown alert channel: ${channel}`);
    }
  }

  /**
   * Send alert to Slack
   */
  async sendToSlack(alert) {
    if (!this.slackWebhookUrl) {
      logger.warn('Slack webhook URL not configured');
      return;
    }

    const color = this.getColorForLevel(alert.level);
    const emoji = this.getEmojiForLevel(alert.level);

    const payload = {
      text: `${emoji} *${alert.level} Alert*`,
      attachments: [
        {
          color: color,
          title: alert.title,
          text: alert.message,
          fields: [
            {
              title: 'Environment',
              value: alert.environment,
              short: true,
            },
            {
              title: 'Service',
              value: alert.service,
              short: true,
            },
            {
              title: 'Timestamp',
              value: alert.timestamp,
              short: true,
            },
          ],
          footer: 'BARQ Fleet Management',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    // Add context fields if provided
    if (alert.context && Object.keys(alert.context).length > 0) {
      Object.entries(alert.context).forEach(([key, value]) => {
        payload.attachments[0].fields.push({
          title: key,
          value: String(value),
          short: true,
        });
      });
    }

    try {
      await axios.post(this.slackWebhookUrl, payload);
      this.stats.byChannel[CHANNELS.SLACK] = (this.stats.byChannel[CHANNELS.SLACK] || 0) + 1;
      logger.debug('Alert sent to Slack', { title: alert.title });
    } catch (error) {
      logger.error('Failed to send Slack alert', { error: error.message });
      throw error;
    }
  }

  /**
   * Send email alert
   */
  async sendEmail(alert) {
    if (!this.emailApiKey || this.emailRecipients.length === 0) {
      logger.warn('Email alerts not configured');
      return;
    }

    const subject = `[${alert.level}] ${alert.title}`;
    const htmlBody = this.generateEmailHtml(alert);

    // Using SendGrid as example (replace with your email service)
    const payload = {
      personalizations: this.emailRecipients.map((email) => ({ to: [{ email }] })),
      from: { email: process.env.ALERT_FROM_EMAIL || 'alerts@barq.com' },
      subject: subject,
      content: [{ type: 'text/html', value: htmlBody }],
    };

    try {
      await axios.post('https://api.sendgrid.com/v3/mail/send', payload, {
        headers: {
          Authorization: `Bearer ${this.emailApiKey}`,
          'Content-Type': 'application/json',
        },
      });
      this.stats.byChannel[CHANNELS.EMAIL] = (this.stats.byChannel[CHANNELS.EMAIL] || 0) + 1;
      logger.debug('Alert sent via email', {
        title: alert.title,
        recipients: this.emailRecipients.length,
      });
    } catch (error) {
      logger.error('Failed to send email alert', { error: error.message });
      throw error;
    }
  }

  /**
   * Send SMS alert
   */
  async sendSMS(alert) {
    if (!this.smsApiKey || this.smsRecipients.length === 0) {
      logger.warn('SMS alerts not configured');
      return;
    }

    const message = `[${alert.level}] ${alert.title}: ${alert.message}`;

    // Using Twilio as example (replace with your SMS service)
    const promises = this.smsRecipients.map(async (recipient) => {
      try {
        await axios.post(
          `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
          new URLSearchParams({
            To: recipient,
            From: process.env.TWILIO_PHONE_NUMBER,
            Body: message,
          }),
          {
            auth: {
              username: process.env.TWILIO_ACCOUNT_SID,
              password: this.smsApiKey,
            },
          }
        );
        logger.debug('SMS alert sent', { recipient });
      } catch (error) {
        logger.error('Failed to send SMS alert', { error: error.message, recipient });
        throw error;
      }
    });

    await Promise.all(promises);
    this.stats.byChannel[CHANNELS.SMS] =
      (this.stats.byChannel[CHANNELS.SMS] || 0) + this.smsRecipients.length;
  }

  /**
   * Send alert to PagerDuty
   */
  async sendToPagerDuty(alert) {
    if (!this.pagerdutyKey) {
      logger.warn('PagerDuty not configured');
      return;
    }

    const payload = {
      routing_key: this.pagerdutyKey,
      event_action: 'trigger',
      payload: {
        summary: `${alert.level}: ${alert.title}`,
        severity: this.getPagerDutySeverity(alert.level),
        source: alert.service,
        timestamp: alert.timestamp,
        custom_details: {
          message: alert.message,
          environment: alert.environment,
          ...alert.context,
        },
      },
    };

    try {
      await axios.post('https://events.pagerduty.com/v2/enqueue', payload);
      this.stats.byChannel[CHANNELS.PAGERDUTY] =
        (this.stats.byChannel[CHANNELS.PAGERDUTY] || 0) + 1;
      logger.debug('Alert sent to PagerDuty', { title: alert.title });
    } catch (error) {
      logger.error('Failed to send PagerDuty alert', { error: error.message });
      throw error;
    }
  }

  /**
   * Helper: Get color for alert level
   */
  getColorForLevel(level) {
    const colors = {
      [ALERT_LEVELS.CRITICAL]: '#d32f2f',
      [ALERT_LEVELS.HIGH]: '#f57c00',
      [ALERT_LEVELS.MEDIUM]: '#fbc02d',
      [ALERT_LEVELS.LOW]: '#388e3c',
      [ALERT_LEVELS.INFO]: '#1976d2',
    };
    return colors[level] || '#757575';
  }

  /**
   * Helper: Get emoji for alert level
   */
  getEmojiForLevel(level) {
    const emojis = {
      [ALERT_LEVELS.CRITICAL]: '🚨',
      [ALERT_LEVELS.HIGH]: '⚠️',
      [ALERT_LEVELS.MEDIUM]: '⚡',
      [ALERT_LEVELS.LOW]: 'ℹ️',
      [ALERT_LEVELS.INFO]: '📢',
    };
    return emojis[level] || '📌';
  }

  /**
   * Helper: Get PagerDuty severity
   */
  getPagerDutySeverity(level) {
    const severityMap = {
      [ALERT_LEVELS.CRITICAL]: 'critical',
      [ALERT_LEVELS.HIGH]: 'error',
      [ALERT_LEVELS.MEDIUM]: 'warning',
      [ALERT_LEVELS.LOW]: 'info',
      [ALERT_LEVELS.INFO]: 'info',
    };
    return severityMap[level] || 'info';
  }

  /**
   * Generate HTML email body
   */
  generateEmailHtml(alert) {
    const contextRows = Object.entries(alert.context)
      .map(
        ([key, value]) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-weight: bold;">${key}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${value}</td>
        </tr>
      `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${alert.title}</title>
      </head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="background-color: ${this.getColorForLevel(alert.level)}; color: white; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 24px;">${this.getEmojiForLevel(alert.level)} ${alert.level} Alert</h1>
          </div>

          <h2 style="color: #333; margin-top: 0;">${alert.title}</h2>
          <p style="color: #666; line-height: 1.6;">${alert.message}</p>

          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-weight: bold;">Service</td>
              <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${alert.service}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-weight: bold;">Environment</td>
              <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${alert.environment}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-weight: bold;">Timestamp</td>
              <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${alert.timestamp}</td>
            </tr>
            ${contextRows}
          </table>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #999; font-size: 12px;">
            <p>This is an automated alert from BARQ Fleet Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Update alert statistics
   */
  updateStats(level) {
    this.stats.total++;
    this.stats.byLevel[level] = (this.stats.byLevel[level] || 0) + 1;
  }

  /**
   * Get alert statistics
   */
  getStats() {
    return {
      ...this.stats,
      uptime: process.uptime(),
      cacheSize: this.alertCache.size,
    };
  }

  /**
   * Clear alert rate limiting cache
   */
  clearCache() {
    this.alertCache.clear();
    logger.info('Alert cache cleared');
  }

  /**
   * Convenience methods for different alert levels
   */
  async critical(title, message, context) {
    return this.sendAlert(ALERT_LEVELS.CRITICAL, title, message, context);
  }

  async high(title, message, context) {
    return this.sendAlert(ALERT_LEVELS.HIGH, title, message, context);
  }

  async medium(title, message, context) {
    return this.sendAlert(ALERT_LEVELS.MEDIUM, title, message, context);
  }

  async low(title, message, context) {
    return this.sendAlert(ALERT_LEVELS.LOW, title, message, context);
  }

  async info(title, message, context) {
    return this.sendAlert(ALERT_LEVELS.INFO, title, message, context);
  }
}

// Export singleton instance
const alertService = new AlertService();

module.exports = {
  alertService,
  AlertService,
  ALERT_LEVELS,
  CHANNELS,
};
