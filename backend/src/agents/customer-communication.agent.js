/**
 * Customer Communication Agent
 * Manages all customer interactions, notifications, and communication strategies
 * Ensures timely updates and proactive communication for delivery status
 */

const { logger } = require('../utils/logger');

class CustomerCommunicationAgent {
  constructor(config, llmManager) {
    this.config = {
      name: 'Customer Communication',
      description: 'Manages customer interactions and notifications',
      version: '1.0.0',
      ...config,
    };
    this.llmManager = llmManager;

    // Communication configuration
    this.communicationConfig = {
      // Communication channels
      channels: {
        SMS: {
          enabled: true,
          priority: 1,
          costPerMessage: 0.02,
          maxLength: 160,
        },
        WHATSAPP: {
          enabled: true,
          priority: 2,
          costPerMessage: 0.01,
          maxLength: 1000,
        },
        EMAIL: {
          enabled: true,
          priority: 3,
          costPerMessage: 0.001,
          maxLength: null,
        },
        IN_APP: {
          enabled: true,
          priority: 4,
          costPerMessage: 0,
          maxLength: null,
        },
        VOICE_CALL: {
          enabled: true,
          priority: 5,
          costPerMessage: 0.1,
          maxDuration: 180, // 3 minutes
        },
      },

      // Message types and templates
      messageTypes: {
        ORDER_CONFIRMED: {
          channels: ['SMS', 'IN_APP', 'EMAIL'],
          priority: 'high',
          template: 'Your {serviceType} order #{orderId} has been confirmed. ETA: {eta}',
        },
        DRIVER_ASSIGNED: {
          channels: ['SMS', 'IN_APP', 'WHATSAPP'],
          priority: 'high',
          template: 'Driver {driverName} is assigned to your order. Contact: {driverPhone}',
        },
        DRIVER_NEARBY: {
          channels: ['IN_APP', 'SMS'],
          priority: 'medium',
          template: 'Your driver is {distance} away, arriving in ~{minutes} minutes',
        },
        DELIVERY_COMPLETED: {
          channels: ['SMS', 'IN_APP', 'EMAIL'],
          priority: 'high',
          template: 'Order #{orderId} delivered successfully. Thank you for using {serviceType}!',
        },
        DELAY_NOTIFICATION: {
          channels: ['SMS', 'IN_APP', 'WHATSAPP'],
          priority: 'critical',
          template:
            'Your delivery is delayed by ~{delay} minutes. New ETA: {newEta}. We apologize for the inconvenience.',
        },
        SLA_RISK: {
          channels: ['SMS', 'WHATSAPP', 'VOICE_CALL'],
          priority: 'critical',
          template: "We're working hard to deliver your order on time. Current status: {status}",
        },
        FAILED_DELIVERY: {
          channels: ['VOICE_CALL', 'SMS', 'EMAIL'],
          priority: 'critical',
          template: 'Unable to deliver order #{orderId}. Reason: {reason}. Please contact support.',
        },
        COMPENSATION_OFFERED: {
          channels: ['EMAIL', 'IN_APP'],
          priority: 'medium',
          template:
            "We've credited ${amount} to your account for the inconvenience. Reference: {reference}",
        },
        FEEDBACK_REQUEST: {
          channels: ['IN_APP', 'EMAIL', 'SMS'],
          priority: 'low',
          template: 'How was your {serviceType} delivery? Rate your experience: {feedbackLink}',
        },
      },

      // Communication rules
      rules: {
        minIntervalBetweenMessages: 300000, // 5 minutes
        maxMessagesPerOrder: 10,
        criticalMessageRetryAttempts: 3,
        preferredLanguages: ['en', 'ar'],
        quietHours: {
          start: 22, // 10 PM
          end: 7, // 7 AM
        },
        escalationThresholds: {
          noResponse: 600000, // 10 minutes
          criticalNoResponse: 180000, // 3 minutes for critical
        },
      },

      // Customer preferences
      defaultPreferences: {
        channel: 'SMS',
        language: 'en',
        frequency: 'normal',
        quietHours: true,
        marketingOptIn: false,
      },
    };

    // Communication queue
    this.messageQueue = [];

    // Active conversations
    this.activeConversations = new Map();

    // Message history
    this.messageHistory = new Map();

    // Customer preferences cache
    this.customerPreferences = new Map();

    // Communication metrics
    this.metrics = {
      totalMessages: 0,
      deliveredMessages: 0,
      failedMessages: 0,
      customerResponses: 0,
      averageResponseTime: 0,
    };

    logger.info('[CustomerCommunication] Agent initialized');
  }

  /**
   * Main execution method
   */
  async execute(context) {
    const startTime = Date.now();

    try {
      logger.info('[CustomerCommunication] Starting communication analysis');

      // Analyze communication needs
      const communicationNeeds = await this.analyzeCommunicationNeeds(context);

      // Generate communication plan
      const communicationPlan = await this.generateCommunicationPlan(communicationNeeds, context);

      // Process message queue
      const sentMessages = await this.processMessageQueue(communicationPlan);

      // Handle customer responses
      const responses = await this.handleCustomerResponses(context);

      // Generate proactive communications
      const proactiveMessages = await this.generateProactiveCommunications(context);

      // Update customer satisfaction metrics
      const satisfactionMetrics = this.updateSatisfactionMetrics(sentMessages, responses);

      // Generate communication insights
      const insights = this.generateCommunicationInsights(
        communicationNeeds,
        sentMessages,
        responses
      );

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        executionTime,
        communicationNeeds,
        messagesSent: sentMessages.length,
        responsesHandled: responses.length,
        proactiveMessages: proactiveMessages.length,
        satisfactionMetrics,
        insights,
        metrics: this.metrics,
      };
    } catch (error) {
      logger.error('[CustomerCommunication] Execution failed', { error: error.message });

      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Analyze communication needs
   */
  async analyzeCommunicationNeeds(context) {
    logger.info('[CustomerCommunication] Analyzing communication needs');

    const needs = {
      immediate: [],
      scheduled: [],
      followUp: [],
      escalation: [],
    };

    // Check orders requiring communication
    const orders = await this.getActiveOrders(context);

    for (const order of orders) {
      const communicationStatus = this.analyzeOrderCommunication(order);

      // Categorize by urgency
      if (communicationStatus.requiresImmediate) {
        needs.immediate.push({
          orderId: order.id,
          customerId: order.customerId,
          type: communicationStatus.messageType,
          reason: communicationStatus.reason,
          data: order,
        });
      }

      if (communicationStatus.requiresScheduled) {
        needs.scheduled.push({
          orderId: order.id,
          customerId: order.customerId,
          type: communicationStatus.messageType,
          scheduledTime: communicationStatus.scheduledTime,
          data: order,
        });
      }

      if (communicationStatus.requiresFollowUp) {
        needs.followUp.push({
          orderId: order.id,
          customerId: order.customerId,
          lastMessage: communicationStatus.lastMessage,
          followUpType: communicationStatus.followUpType,
          data: order,
        });
      }

      if (communicationStatus.requiresEscalation) {
        needs.escalation.push({
          orderId: order.id,
          customerId: order.customerId,
          escalationReason: communicationStatus.escalationReason,
          attempts: communicationStatus.communicationAttempts,
          data: order,
        });
      }
    }

    return needs;
  }

  /**
   * Analyze order communication requirements
   */
  analyzeOrderCommunication(order) {
    const status = {
      requiresImmediate: false,
      requiresScheduled: false,
      requiresFollowUp: false,
      requiresEscalation: false,
      messageType: null,
      reason: null,
    };

    const now = Date.now();
    const orderAge = now - new Date(order.createdAt).getTime();
    const lastCommunication = this.getLastCommunication(order.id);
    const timeSinceLastMessage = lastCommunication ? now - lastCommunication.timestamp : orderAge;

    // Check for status changes requiring notification
    if (order.statusChanged && !order.statusNotified) {
      status.requiresImmediate = true;
      status.messageType = this.mapStatusToMessageType(order.status);
      status.reason = 'Status change notification';
    }

    // Check for delays
    if (order.isDelayed && !order.delayNotified) {
      status.requiresImmediate = true;
      status.messageType = 'DELAY_NOTIFICATION';
      status.reason = `Delayed by ${Math.floor(order.delayMinutes)} minutes`;
    }

    // Check for SLA risks
    if (order.serviceType === 'BARQ' && orderAge > 3000000) {
      // 50 minutes
      if (!order.slaRiskNotified) {
        status.requiresImmediate = true;
        status.messageType = 'SLA_RISK';
        status.reason = 'BARQ SLA at risk';
      }
    }

    // Check for driver proximity
    if (order.driverDistance && order.driverDistance < 1) {
      // Within 1km
      if (!order.proximityNotified) {
        status.requiresScheduled = true;
        status.messageType = 'DRIVER_NEARBY';
        status.scheduledTime = new Date(now + 60000); // 1 minute from now
      }
    }

    // Check for follow-up needs
    if (timeSinceLastMessage > this.communicationConfig.rules.minIntervalBetweenMessages) {
      if (order.status === 'in_transit' && !order.recentUpdate) {
        status.requiresFollowUp = true;
        status.followUpType = 'STATUS_UPDATE';
        status.lastMessage = lastCommunication;
      }
    }

    // Check for escalation needs
    if (lastCommunication && lastCommunication.requiresResponse && !lastCommunication.responded) {
      const responseTime = now - lastCommunication.timestamp;
      const threshold =
        lastCommunication.priority === 'critical'
          ? this.communicationConfig.rules.escalationThresholds.criticalNoResponse
          : this.communicationConfig.rules.escalationThresholds.noResponse;

      if (responseTime > threshold) {
        status.requiresEscalation = true;
        status.escalationReason = 'No customer response';
        status.communicationAttempts = lastCommunication.attempts || 1;
      }
    }

    return status;
  }

  /**
   * Generate communication plan
   */
  async generateCommunicationPlan(needs, context) {
    logger.info('[CustomerCommunication] Generating communication plan');

    const plan = {
      messages: [],
      channels: new Map(),
      estimatedCost: 0,
      priority: [],
    };

    // Process immediate needs first
    for (const need of needs.immediate) {
      const message = await this.createMessage(need, 'immediate', context);
      plan.messages.push(message);
      plan.priority.push(message.id);
    }

    // Process escalations
    for (const need of needs.escalation) {
      const message = await this.createEscalationMessage(need, context);
      plan.messages.push(message);
      plan.priority.push(message.id);
    }

    // Process scheduled messages
    for (const need of needs.scheduled) {
      const message = await this.createMessage(need, 'scheduled', context);
      message.scheduledTime = need.scheduledTime;
      plan.messages.push(message);
    }

    // Process follow-ups
    for (const need of needs.followUp) {
      const message = await this.createFollowUpMessage(need, context);
      plan.messages.push(message);
    }

    // Optimize channel selection
    for (const message of plan.messages) {
      const optimalChannel = await this.selectOptimalChannel(message, context);
      message.channel = optimalChannel;

      // Track channel usage
      if (!plan.channels.has(optimalChannel)) {
        plan.channels.set(optimalChannel, []);
      }
      plan.channels.get(optimalChannel).push(message);

      // Calculate cost
      plan.estimatedCost += this.calculateMessageCost(message, optimalChannel);
    }

    return plan;
  }

  /**
   * Create message
   */
  async createMessage(need, urgency, context) {
    const messageType = this.communicationConfig.messageTypes[need.type];
    const customerPrefs = await this.getCustomerPreferences(need.customerId);

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId: need.orderId,
      customerId: need.customerId,
      type: need.type,
      urgency,
      priority: messageType.priority,
      template: messageType.template,
      data: this.extractMessageData(need.data),
      language: customerPrefs.language || 'en',
      retryCount: 0,
      maxRetries: urgency === 'immediate' ? 3 : 1,
      createdAt: new Date(),
    };

    // Personalize message
    message.content = this.personalizeMessage(message, need.data);

    return message;
  }

  /**
   * Create escalation message
   */
  async createEscalationMessage(need, context) {
    const message = {
      id: `esc_msg_${Date.now()}`,
      orderId: need.orderId,
      customerId: need.customerId,
      type: 'ESCALATION',
      urgency: 'critical',
      priority: 'critical',
      escalationLevel: need.attempts + 1,
      reason: need.escalationReason,
      requiresResponse: true,
      content: await this.generateEscalationContent(need),
      createdAt: new Date(),
    };

    // Use voice call for critical escalations
    if (need.attempts >= 2) {
      message.preferredChannel = 'VOICE_CALL';
    }

    return message;
  }

  /**
   * Create follow-up message
   */
  async createFollowUpMessage(need, context) {
    const content = await this.generateFollowUpContent(need);

    const message = {
      id: `followup_${Date.now()}`,
      orderId: need.orderId,
      customerId: need.customerId,
      type: 'FOLLOW_UP',
      urgency: 'normal',
      priority: 'low',
      followUpType: need.followUpType,
      previousMessage: need.lastMessage?.id,
      content,
      createdAt: new Date(),
    };

    return message;
  }

  /**
   * Process message queue
   */
  async processMessageQueue(plan) {
    logger.info('[CustomerCommunication] Processing message queue');

    const sentMessages = [];

    // Add plan messages to queue
    this.messageQueue.push(...plan.messages);

    // Sort by priority
    this.messageQueue.sort((a, b) => {
      if (a.priority === 'critical') return -1;
      if (b.priority === 'critical') return 1;
      if (a.priority === 'high') return -1;
      if (b.priority === 'high') return 1;
      return 0;
    });

    // Process queue
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();

      // Check if message should be sent now
      if (message.scheduledTime && new Date(message.scheduledTime) > new Date()) {
        // Re-queue for later
        this.messageQueue.push(message);
        continue;
      }

      // Check quiet hours
      if (this.isQuietHours(message)) {
        // Delay non-critical messages
        if (message.priority !== 'critical') {
          message.scheduledTime = this.getNextAvailableTime();
          this.messageQueue.push(message);
          continue;
        }
      }

      // Send message
      const result = await this.sendMessage(message);

      if (result.success) {
        sentMessages.push({
          ...message,
          sentAt: new Date(),
          channel: result.channel,
          deliveryStatus: 'sent',
        });

        // Update history
        this.updateMessageHistory(message.customerId, message);

        // Update metrics
        this.metrics.totalMessages++;
        this.metrics.deliveredMessages++;
      } else {
        // Handle failure
        await this.handleMessageFailure(message, result.error);
      }
    }

    return sentMessages;
  }

  /**
   * Send message through selected channel
   */
  async sendMessage(message) {
    logger.info('[CustomerCommunication] Sending message', {
      type: message.type,
      channel: message.channel,
      customerId: message.customerId,
    });

    try {
      const channel = message.channel || message.preferredChannel || 'SMS';

      switch (channel) {
        case 'SMS':
          return await this.sendSMS(message);
        case 'WHATSAPP':
          return await this.sendWhatsApp(message);
        case 'EMAIL':
          return await this.sendEmail(message);
        case 'IN_APP':
          return await this.sendInAppNotification(message);
        case 'VOICE_CALL':
          return await this.makeVoiceCall(message);
        default:
          throw new Error(`Unknown channel: ${channel}`);
      }
    } catch (error) {
      logger.error('[CustomerCommunication] Message send failed', {
        error: error.message,
        messageId: message.id,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle customer responses
   */
  async handleCustomerResponses(context) {
    logger.info('[CustomerCommunication] Handling customer responses');

    const responses = await this.getCustomerResponses(context);
    const handledResponses = [];

    for (const response of responses) {
      try {
        const handled = await this.processCustomerResponse(response, context);
        handledResponses.push(handled);

        // Update conversation
        this.updateConversation(response.customerId, response, handled);

        // Check if action required
        if (handled.actionRequired) {
          await this.triggerResponseAction(handled, context);
        }

        // Update metrics
        this.metrics.customerResponses++;
      } catch (error) {
        logger.error('[CustomerCommunication] Failed to handle response', {
          error: error.message,
          responseId: response.id,
        });
      }
    }

    return handledResponses;
  }

  /**
   * Process individual customer response
   */
  async processCustomerResponse(response, context) {
    // Analyze response sentiment
    const sentiment = await this.analyzeSentiment(response.content);

    // Classify response type
    const responseType = this.classifyResponse(response.content);

    // Determine required action
    const action = this.determineResponseAction(responseType, sentiment, response);

    return {
      responseId: response.id,
      customerId: response.customerId,
      orderId: response.orderId,
      sentiment,
      type: responseType,
      actionRequired: action !== null,
      action,
      processedAt: new Date(),
    };
  }

  /**
   * Generate proactive communications
   */
  async generateProactiveCommunications(context) {
    logger.info('[CustomerCommunication] Generating proactive communications');

    const proactiveMessages = [];

    // Check for orders nearing milestones
    const upcomingMilestones = await this.identifyUpcomingMilestones(context);

    for (const milestone of upcomingMilestones) {
      const message = {
        type: 'PROACTIVE_UPDATE',
        orderId: milestone.orderId,
        customerId: milestone.customerId,
        content: this.generateMilestoneMessage(milestone),
        priority: 'low',
        channel: 'IN_APP',
      };

      proactiveMessages.push(message);
    }

    // Check for customer satisfaction opportunities
    const satisfactionOpportunities = await this.identifySatisfactionOpportunities(context);

    for (const opportunity of satisfactionOpportunities) {
      if (opportunity.type === 'POSITIVE_EXPERIENCE') {
        const message = {
          type: 'FEEDBACK_REQUEST',
          orderId: opportunity.orderId,
          customerId: opportunity.customerId,
          content: "We'd love to hear about your experience!",
          priority: 'low',
          scheduledTime: new Date(Date.now() + 3600000), // 1 hour later
        };

        proactiveMessages.push(message);
      }
    }

    // Send proactive messages
    for (const message of proactiveMessages) {
      await this.sendMessage(message);
    }

    return proactiveMessages;
  }

  /**
   * Generate communication insights
   */
  generateCommunicationInsights(needs, sentMessages, responses) {
    const insights = [];

    // Response rate insight
    if (this.metrics.totalMessages > 0) {
      const responseRate = this.metrics.customerResponses / this.metrics.totalMessages;
      insights.push({
        type: 'RESPONSE_RATE',
        value: responseRate,
        message: `Customer response rate: ${Math.round(responseRate * 100)}%`,
        recommendation:
          responseRate < 0.3
            ? 'Consider improving message clarity and call-to-action'
            : 'Good engagement level maintained',
      });
    }

    // Channel effectiveness
    const channelStats = this.analyzeChannelEffectiveness(sentMessages);
    insights.push({
      type: 'CHANNEL_EFFECTIVENESS',
      data: channelStats,
      message: `Most effective channel: ${channelStats.mostEffective}`,
      recommendation: `Prioritize ${channelStats.mostEffective} for critical communications`,
    });

    // Communication volume
    if (needs.immediate.length > 10) {
      insights.push({
        type: 'HIGH_COMMUNICATION_VOLUME',
        count: needs.immediate.length,
        message: 'Unusually high immediate communication needs',
        recommendation: 'Investigate operational issues causing increased notifications',
      });
    }

    // Escalation patterns
    if (needs.escalation.length > 5) {
      insights.push({
        type: 'ESCALATION_PATTERN',
        count: needs.escalation.length,
        message: 'Multiple escalations required',
        recommendation: 'Review customer response times and message clarity',
      });
    }

    // Sentiment trends
    const sentimentTrend = this.analyzeSentimentTrends(responses);
    if (sentimentTrend.negative > 0.3) {
      insights.push({
        type: 'NEGATIVE_SENTIMENT',
        value: sentimentTrend.negative,
        message: 'Increased negative sentiment detected',
        recommendation: 'Review service quality and communication tone',
      });
    }

    return insights;
  }

  /**
   * Helper methods
   */

  mapStatusToMessageType(status) {
    const mapping = {
      confirmed: 'ORDER_CONFIRMED',
      driver_assigned: 'DRIVER_ASSIGNED',
      in_transit: 'DRIVER_NEARBY',
      delivered: 'DELIVERY_COMPLETED',
      failed: 'FAILED_DELIVERY',
    };
    return mapping[status] || 'STATUS_UPDATE';
  }

  extractMessageData(orderData) {
    return {
      orderId: orderData.id,
      serviceType: orderData.serviceType,
      eta: orderData.estimatedDeliveryTime,
      driverName: orderData.driverName,
      driverPhone: orderData.driverPhone,
      distance: orderData.driverDistance,
      status: orderData.status,
    };
  }

  personalizeMessage(message, orderData) {
    let content = message.template;

    // Replace placeholders
    const data = message.data;
    for (const key in data) {
      const placeholder = `{${key}}`;
      if (content.includes(placeholder)) {
        content = content.replace(placeholder, data[key]);
      }
    }

    // Add personal touch based on customer history
    const customerHistory = this.getCustomerHistory(message.customerId);
    if (customerHistory.orderCount > 10) {
      content = `Thank you for being a valued customer! ${content}`;
    }

    // Translate if needed
    if (message.language === 'ar') {
      content = this.translateToArabic(content);
    }

    return content;
  }

  async selectOptimalChannel(message, context) {
    const customerPrefs = await this.getCustomerPreferences(message.customerId);
    const messageType = this.communicationConfig.messageTypes[message.type];

    // Priority: Customer preference > Message type channels > Default
    if (customerPrefs.channel && this.isChannelAvailable(customerPrefs.channel)) {
      return customerPrefs.channel;
    }

    // Check message type allowed channels
    if (messageType && messageType.channels) {
      for (const channel of messageType.channels) {
        if (this.isChannelAvailable(channel)) {
          return channel;
        }
      }
    }

    // Default to SMS
    return 'SMS';
  }

  calculateMessageCost(message, channel) {
    const channelConfig = this.communicationConfig.channels[channel];
    if (!channelConfig) return 0;

    let cost = channelConfig.costPerMessage;

    // Additional costs for retries
    if (message.retryCount > 0) {
      cost *= 1 + message.retryCount * 0.5;
    }

    // Premium for voice calls
    if (channel === 'VOICE_CALL') {
      const duration = message.estimatedDuration || 60;
      cost = (duration / 60) * channelConfig.costPerMessage;
    }

    return cost;
  }

  isQuietHours(message) {
    const now = new Date();
    const hour = now.getHours();
    const { start, end } = this.communicationConfig.rules.quietHours;

    if (start > end) {
      // Crosses midnight
      return hour >= start || hour < end;
    } else {
      return hour >= start && hour < end;
    }
  }

  getNextAvailableTime() {
    const now = new Date();
    const { end } = this.communicationConfig.rules.quietHours;

    const nextAvailable = new Date(now);
    nextAvailable.setHours(end, 0, 0, 0);

    if (nextAvailable < now) {
      nextAvailable.setDate(nextAvailable.getDate() + 1);
    }

    return nextAvailable;
  }

  async analyzeSentiment(content) {
    // Mock sentiment analysis - would use NLP service
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'disappointed'];
    const positiveWords = ['good', 'great', 'excellent', 'love', 'perfect', 'amazing'];

    let sentiment = 'neutral';
    let score = 0;

    for (const word of negativeWords) {
      if (content.toLowerCase().includes(word)) {
        score--;
      }
    }

    for (const word of positiveWords) {
      if (content.toLowerCase().includes(word)) {
        score++;
      }
    }

    if (score > 0) sentiment = 'positive';
    if (score < 0) sentiment = 'negative';

    return {
      sentiment,
      score: Math.max(-1, Math.min(1, score / 3)),
      confidence: 0.7,
    };
  }

  classifyResponse(content) {
    const lower = content.toLowerCase();

    if (lower.includes('cancel')) return 'CANCELLATION_REQUEST';
    if (lower.includes('where') || lower.includes('status')) return 'STATUS_INQUIRY';
    if (lower.includes('change') || lower.includes('modify')) return 'MODIFICATION_REQUEST';
    if (lower.includes('help') || lower.includes('support')) return 'SUPPORT_REQUEST';
    if (lower.includes('thank')) return 'APPRECIATION';
    if (lower.includes('complain') || lower.includes('problem')) return 'COMPLAINT';

    return 'GENERAL';
  }

  determineResponseAction(type, sentiment, response) {
    switch (type) {
      case 'CANCELLATION_REQUEST':
        return {
          type: 'PROCESS_CANCELLATION',
          orderId: response.orderId,
          requiresConfirmation: true,
        };

      case 'STATUS_INQUIRY':
        return {
          type: 'SEND_STATUS_UPDATE',
          orderId: response.orderId,
          immediate: true,
        };

      case 'COMPLAINT':
        return {
          type: 'ESCALATE_TO_SUPPORT',
          customerId: response.customerId,
          sentiment: sentiment.sentiment,
          priority: sentiment.sentiment === 'negative' ? 'high' : 'medium',
        };

      case 'MODIFICATION_REQUEST':
        return {
          type: 'REVIEW_MODIFICATION',
          orderId: response.orderId,
          details: response.content,
        };

      default:
        return null;
    }
  }

  async generateEscalationContent(need) {
    const attempts = need.attempts || 1;

    if (attempts === 1) {
      return `We noticed you haven't responded to our previous message about order #${need.orderId}. Is everything okay? Please let us know if you need assistance.`;
    } else if (attempts === 2) {
      return `This is an urgent message regarding order #${need.orderId}. We need your immediate response to proceed. Please contact us at your earliest convenience.`;
    } else {
      return `URGENT: Multiple attempts to reach you regarding order #${need.orderId}. Please call us immediately at 1-800-DELIVERY to resolve this matter.`;
    }
  }

  async generateFollowUpContent(need) {
    switch (need.followUpType) {
      case 'STATUS_UPDATE':
        return `Your order is still on its way! Current status: In transit. We'll notify you when the driver is nearby.`;
      case 'SATISFACTION_CHECK':
        return `We hope you received your order successfully. How was your experience?`;
      default:
        return `Following up on your recent order. Please let us know if you need any assistance.`;
    }
  }

  generateMilestoneMessage(milestone) {
    const messages = {
      HALFWAY: 'Great news! Your order is halfway to you.',
      ARRIVING_SOON: 'Your delivery will arrive in the next 10 minutes.',
      THANK_YOU: 'Thank you for choosing our service today!',
    };

    return messages[milestone.type] || 'Order update: Making progress on your delivery.';
  }

  analyzeChannelEffectiveness(messages) {
    const channelStats = {};

    for (const message of messages) {
      if (!channelStats[message.channel]) {
        channelStats[message.channel] = {
          sent: 0,
          delivered: 0,
          responded: 0,
        };
      }

      channelStats[message.channel].sent++;
      if (message.deliveryStatus === 'delivered') {
        channelStats[message.channel].delivered++;
      }
      if (message.responded) {
        channelStats[message.channel].responded++;
      }
    }

    // Find most effective
    let mostEffective = 'SMS';
    let highestRate = 0;

    for (const channel in channelStats) {
      const rate = channelStats[channel].delivered / channelStats[channel].sent;
      if (rate > highestRate) {
        highestRate = rate;
        mostEffective = channel;
      }
    }

    return {
      stats: channelStats,
      mostEffective,
      effectivenessRate: highestRate,
    };
  }

  analyzeSentimentTrends(responses) {
    let positive = 0;
    let negative = 0;
    let neutral = 0;

    for (const response of responses) {
      if (response.sentiment?.sentiment === 'positive') positive++;
      else if (response.sentiment?.sentiment === 'negative') negative++;
      else neutral++;
    }

    const total = responses.length || 1;

    return {
      positive: positive / total,
      negative: negative / total,
      neutral: neutral / total,
    };
  }

  updateSatisfactionMetrics(sentMessages, responses) {
    const metrics = {
      messageSentCount: sentMessages.length,
      responseCount: responses.length,
      responseRate: responses.length / Math.max(sentMessages.length, 1),
      averageResponseTime: this.calculateAverageResponseTime(responses),
      satisfactionScore: this.calculateSatisfactionScore(responses),
    };

    return metrics;
  }

  calculateAverageResponseTime(responses) {
    if (responses.length === 0) return 0;

    const totalTime = responses.reduce((sum, response) => {
      const responseTime = response.respondedAt - response.sentAt;
      return sum + responseTime;
    }, 0);

    return totalTime / responses.length;
  }

  calculateSatisfactionScore(responses) {
    if (responses.length === 0) return 0;

    const sentimentScores = responses.map((r) => r.sentiment?.score || 0);
    const average = sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length;

    // Convert to 0-100 scale
    return Math.round((average + 1) * 50);
  }

  // Mock communication channel implementations

  async sendSMS(message) {
    // Mock SMS sending
    logger.info('[CustomerCommunication] Sending SMS', {
      to: message.customerId,
      content: message.content.substring(0, 50),
    });

    return {
      success: Math.random() > 0.05, // 95% success rate
      channel: 'SMS',
      messageId: `sms_${Date.now()}`,
    };
  }

  async sendWhatsApp(message) {
    // Mock WhatsApp sending
    logger.info('[CustomerCommunication] Sending WhatsApp', {
      to: message.customerId,
      content: message.content.substring(0, 50),
    });

    return {
      success: Math.random() > 0.1, // 90% success rate
      channel: 'WHATSAPP',
      messageId: `wa_${Date.now()}`,
    };
  }

  async sendEmail(message) {
    // Mock Email sending
    logger.info('[CustomerCommunication] Sending Email', {
      to: message.customerId,
      subject: message.type,
    });

    return {
      success: Math.random() > 0.02, // 98% success rate
      channel: 'EMAIL',
      messageId: `email_${Date.now()}`,
    };
  }

  async sendInAppNotification(message) {
    // Mock in-app notification
    logger.info('[CustomerCommunication] Sending in-app notification', {
      to: message.customerId,
      type: message.type,
    });

    return {
      success: true, // Always succeeds
      channel: 'IN_APP',
      messageId: `app_${Date.now()}`,
    };
  }

  async makeVoiceCall(message) {
    // Mock voice call
    logger.info('[CustomerCommunication] Making voice call', {
      to: message.customerId,
      urgency: message.urgency,
    });

    return {
      success: Math.random() > 0.2, // 80% success rate
      channel: 'VOICE_CALL',
      callId: `call_${Date.now()}`,
      duration: Math.floor(Math.random() * 180), // Random duration up to 3 minutes
    };
  }

  async handleMessageFailure(message, error) {
    logger.error('[CustomerCommunication] Message failed', {
      messageId: message.id,
      error,
    });

    message.retryCount++;

    if (message.retryCount < message.maxRetries) {
      // Retry with exponential backoff
      message.scheduledTime = new Date(Date.now() + Math.pow(2, message.retryCount) * 60000);
      this.messageQueue.push(message);
    } else {
      // Final failure
      this.metrics.failedMessages++;

      // Try alternative channel
      if (message.channel !== 'VOICE_CALL' && message.priority === 'critical') {
        message.channel = 'VOICE_CALL';
        message.retryCount = 0;
        this.messageQueue.push(message);
      }
    }
  }

  // Mock data retrieval methods

  async getActiveOrders(context) {
    // Mock implementation
    return context.activeOrders || [];
  }

  async getCustomerPreferences(customerId) {
    if (this.customerPreferences.has(customerId)) {
      return this.customerPreferences.get(customerId);
    }

    // Return default preferences
    return this.communicationConfig.defaultPreferences;
  }

  getCustomerHistory(customerId) {
    // Mock implementation
    return {
      orderCount: Math.floor(Math.random() * 50),
      lastOrderDate: new Date(Date.now() - Math.random() * 30 * 24 * 3600000),
      communicationPreference: 'SMS',
    };
  }

  getLastCommunication(orderId) {
    const history = this.messageHistory.get(orderId);
    if (history && history.length > 0) {
      return history[history.length - 1];
    }
    return null;
  }

  async getCustomerResponses(context) {
    // Mock implementation - would connect to actual messaging services
    return [];
  }

  async identifyUpcomingMilestones(context) {
    // Mock implementation
    return [];
  }

  async identifySatisfactionOpportunities(context) {
    // Mock implementation
    return [];
  }

  async triggerResponseAction(handled, context) {
    // Mock implementation
    logger.info('[CustomerCommunication] Triggering response action', handled.action);
  }

  updateConversation(customerId, response, handled) {
    if (!this.activeConversations.has(customerId)) {
      this.activeConversations.set(customerId, []);
    }

    this.activeConversations.get(customerId).push({
      response,
      handled,
      timestamp: new Date(),
    });
  }

  updateMessageHistory(customerId, message) {
    if (!this.messageHistory.has(customerId)) {
      this.messageHistory.set(customerId, []);
    }

    this.messageHistory.get(customerId).push({
      ...message,
      timestamp: new Date(),
    });

    // Keep only last 50 messages
    const history = this.messageHistory.get(customerId);
    if (history.length > 50) {
      this.messageHistory.set(customerId, history.slice(-50));
    }
  }

  isChannelAvailable(channel) {
    return this.communicationConfig.channels[channel]?.enabled || false;
  }

  translateToArabic(content) {
    // Mock translation - would use actual translation service
    return `[AR] ${content}`;
  }

  /**
   * Check agent health
   */
  isHealthy() {
    return {
      healthy: true,
      name: this.config.name,
      messageQueueLength: this.messageQueue.length,
      activeConversations: this.activeConversations.size,
      deliveryRate:
        this.metrics.totalMessages > 0
          ? this.metrics.deliveredMessages / this.metrics.totalMessages
          : 1.0,
    };
  }
}

module.exports = CustomerCommunicationAgent;
