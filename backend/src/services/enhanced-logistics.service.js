/**
 * Enhanced Logistics Service
 * Integrates instant delivery agents for BARQ/BULLET while maintaining legacy support
 * Handles both traditional route optimization and real-time instant delivery
 */

const LLMConfigManager = require('../config/llm.config');
const db = require('../config/db.config');
const { generateId } = require('../utils/helper');
const { logger } = require('../utils/logger');

// Import Agent Manager for instant delivery
const AgentManagerService = require('./agent-manager.service');

// Import legacy agents for backward compatibility
const PlanningAgent = require('../agents/planning.agent');
const OptimizationAgent = require('../agents/optimization.agent');
const FormatResponseAgent = require('../agents/formatting.agent');

class EnhancedLogisticsService {
  constructor(agentManager = null) {
    this.llmConfig = new LLMConfigManager();

    // Use provided agent manager or create new one for instant delivery
    this.agentManager = agentManager || new AgentManagerService(this.llmConfig);

    // Initialize legacy agents for backward compatibility
    this.initializeLegacyAgents();

    // Track active requests
    this.activeRequests = new Map();

    // Service type configuration
    this.serviceTypes = {
      BARQ: {
        enabled: true,
        maxDeliveryTime: 60, // 60 minutes
        maxRadius: 5, // 5km
        priority: 'critical',
      },
      BULLET: {
        enabled: true,
        maxDeliveryTime: 240, // 4 hours
        maxRadius: 30, // city-wide
        priority: 'normal',
      },
      STANDARD: {
        enabled: true,
        useLegacySystem: true, // Use old system for standard deliveries
        priority: 'low',
      },
    };

    // Don't initialize here - let AgentInitializer handle it
    // this.initialize();

    console.log('Enhanced Logistics Service initialized');
  }

  /**
   * Initialize the service and all agents
   * Note: This is now called by AgentInitializer after all agents are registered
   */
  async initialize() {
    try {
      // Don't initialize agent manager here - it's already initialized by AgentInitializer
      // Just log that we're ready
      logger.info('[EnhancedLogistics] Service ready for operations');
    } catch (error) {
      logger.error('[EnhancedLogistics] Initialization error', {
        error: error.message,
      });
    }
  }

  /**
   * Initialize legacy agents for backward compatibility
   */
  initializeLegacyAgents() {
    this.planningAgent = new PlanningAgent(this.llmConfig.getConfig('planning'), this.llmConfig);

    this.optimizationAgent = new OptimizationAgent(
      this.llmConfig.getConfig('optimization'),
      this.llmConfig
    );

    this.formatAgent = new FormatResponseAgent(
      this.llmConfig.getConfig('formatting'),
      this.llmConfig
    );
  }

  /**
   * Main entry point for processing optimization requests
   */
  async processOptimizationRequest(requestId, sanitizedRequest, originalRequest = null) {
    const startTime = Date.now();

    try {
      logger.info(`[EnhancedLogistics] Processing request ${requestId}`, {
        serviceType: sanitizedRequest.serviceType,
        hasServiceType: !!sanitizedRequest.serviceType,
      });

      // Store the request
      this.storeRequest(requestId, sanitizedRequest);
      await this.updateRequestStatus(requestId, 'processing');

      // Determine service type and route accordingly
      const serviceType = this.determineServiceType(sanitizedRequest);

      let result;

      if (serviceType === 'BARQ' || serviceType === 'BULLET') {
        // Use new instant delivery system
        result = await this.processInstantDelivery(requestId, sanitizedRequest, serviceType);
      } else {
        // Use legacy system for standard deliveries
        result = await this.processLegacyOptimization(requestId, sanitizedRequest);
      }

      const executionTime = Date.now() - startTime;
      logger.info(`[EnhancedLogistics] Request completed in ${executionTime}ms`, {
        requestId,
        serviceType,
        success: result.success,
      });

      return result;
    } catch (error) {
      logger.error('[EnhancedLogistics] Processing error', {
        error: error.message,
        requestId,
      });

      return this.handleProcessingError(requestId, error);
    }
  }

  /**
   * Process instant delivery orders (BARQ/BULLET)
   */
  async processInstantDelivery(requestId, request, serviceType) {
    logger.info(`[EnhancedLogistics] Processing ${serviceType} instant delivery`);

    // Transform request for instant delivery format
    const instantDeliveryOrder = {
      id: requestId,
      serviceType: serviceType,
      pickup: request.pickupPoints?.[0] || {
        lat: request.pickupPoints?.[0]?.lat,
        lng: request.pickupPoints?.[0]?.lng,
        name: request.pickupPoints?.[0]?.name,
      },
      delivery: request.deliveryPoints?.[0] || {
        lat: request.deliveryPoints?.[0]?.lat,
        lng: request.deliveryPoints?.[0]?.lng,
        name: request.deliveryPoints?.[0]?.customer_name,
      },
      createdAt: new Date().toISOString(),
      timeWindow: this.extractTimeWindow(request, serviceType),
      priority: request.priority || this.serviceTypes[serviceType].priority,
      context: request.context,
      preferences: request.preferences,
    };

    // Process through agent manager
    const agentResult = await this.agentManager.handleNewOrder(instantDeliveryOrder);

    // Format response for API compatibility
    const formattedResponse = await this.formatInstantDeliveryResponse(
      agentResult,
      request,
      serviceType
    );

    // Store the result
    this.storeResult(requestId, formattedResponse);
    await this.updateRequestStatus(requestId, 'completed', formattedResponse);

    return {
      success: true,
      requestId,
      data: formattedResponse,
      serviceType,
      message: `${serviceType} delivery processed successfully`,
    };
  }

  /**
   * Process using legacy optimization system
   */
  async processLegacyOptimization(requestId, request) {
    logger.info('[EnhancedLogistics] Using legacy optimization system');

    try {
      // Step 1: Planning
      const initialPlan = await this.planningAgent.plan(request);

      if (!initialPlan.routes || initialPlan.routes.length === 0) {
        throw new Error('No valid routes generated');
      }

      // Step 2: Optimization
      const optimizedPlan = await this.optimizationAgent.optimize({
        plan: initialPlan,
        context: request.context || {},
        preferences: request.preferences || {},
        businessRules: request.businessRules || {},
      });

      // Step 3: Formatting
      const formattedResponse = await this.formatAgent.format({
        optimizedPlan: optimizedPlan,
        request: request,
      });

      // Store and update status
      this.storeResult(requestId, formattedResponse);
      await this.updateRequestStatus(requestId, 'completed', formattedResponse);

      return {
        success: true,
        requestId,
        data: formattedResponse,
        serviceType: 'STANDARD',
        message: 'Optimization completed successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Determine service type from request
   */
  determineServiceType(request) {
    // Check if explicitly specified
    if (request.serviceType) {
      return request.serviceType.toUpperCase();
    }

    // Check preferences for service type hints
    if (request.preferences?.deliverySpeed === 'express') {
      return 'BARQ';
    }

    if (request.preferences?.deliverySpeed === 'same-day') {
      return 'BULLET';
    }

    // Check time constraints
    if (request.constraints?.maxDeliveryTime) {
      const maxTime = request.constraints.maxDeliveryTime;
      if (maxTime <= 60) return 'BARQ';
      if (maxTime <= 240) return 'BULLET';
    }

    // Check for time window urgency
    const hasUrgentTimeWindow = request.deliveryPoints?.some((point) => {
      if (point.time_window) {
        const windowStart = new Date(point.time_window.split('-')[0]);
        const windowEnd = new Date(point.time_window.split('-')[1]);
        const windowDuration = (windowEnd - windowStart) / 60000;
        return windowDuration <= 60;
      }
      return false;
    });

    if (hasUrgentTimeWindow) return 'BARQ';

    // Default to standard delivery
    return 'STANDARD';
  }

  /**
   * Format instant delivery response for API compatibility
   */
  async formatInstantDeliveryResponse(agentResult, originalRequest, serviceType) {
    const response = {
      requestId: originalRequest.requestId,
      timestamp: new Date().toISOString(),
      serviceType: serviceType,
      routes: [],
      summary: {
        total_routes: 0,
        total_distance: 0,
        total_duration: 0,
        total_deliveries: 1,
        sla_compliance: true,
      },
      assignment: {
        driver: agentResult.assignedDriver,
        estimatedPickupTime: agentResult.estimatedPickupTime,
        estimatedDeliveryTime: agentResult.estimatedDeliveryTime,
        confidence: agentResult.confidence || 0,
      },
      insights: [],
      warnings: agentResult.warnings || [],
    };

    // Add route if available
    if (agentResult.route) {
      response.routes.push({
        id: generateId(),
        vehicleId: agentResult.assignedDriver,
        serviceType: serviceType,
        stops: [
          {
            type: 'pickup',
            location: originalRequest.pickupPoints?.[0],
            estimatedTime: agentResult.estimatedPickupTime,
          },
          {
            type: 'delivery',
            location: originalRequest.deliveryPoints?.[0],
            estimatedTime: agentResult.estimatedDeliveryTime,
          },
        ],
        geometry: agentResult.route.geometry,
      });

      response.summary.total_routes = 1;
      response.summary.total_distance = agentResult.route.distance || 0;
      response.summary.total_duration = agentResult.route.duration || 0;
    }

    // Add insights based on service type
    if (serviceType === 'BARQ') {
      response.insights.push('Order assigned for express 1-hour delivery');
      response.insights.push(`Driver ${agentResult.assignedDriver} is within 5km radius`);
    } else if (serviceType === 'BULLET') {
      response.insights.push('Order scheduled for 2-4 hour delivery window');
      if (agentResult.batchId) {
        response.insights.push('Order batched with other deliveries for efficiency');
      }
    }

    // Add any action-specific insights
    if (agentResult.action === 'QUEUED') {
      response.insights.push('Order queued for next available driver');
      response.summary.sla_compliance = false;
    }

    return response;
  }

  /**
   * Extract time window based on service type
   */
  extractTimeWindow(request, serviceType) {
    if (serviceType === 'BARQ') {
      const now = new Date();
      const deadline = new Date(now.getTime() + 60 * 60000); // 1 hour
      return {
        start: now.toISOString(),
        end: deadline.toISOString(),
      };
    } else if (serviceType === 'BULLET') {
      const now = new Date();
      const deadline = new Date(now.getTime() + 240 * 60000); // 4 hours
      return {
        start: now.toISOString(),
        end: deadline.toISOString(),
      };
    }

    // Default time window
    return request.timeWindow || null;
  }

  /**
   * Handle processing errors
   */
  handleProcessingError(requestId, error) {
    const errorResult = {
      success: false,
      requestId,
      error: error.message,
      timestamp: new Date().toISOString(),
      data: {
        routes: [],
        summary: {
          total_routes: 0,
          total_distance: 0,
          total_duration: 0,
          error: error.message,
        },
      },
    };

    this.storeResult(requestId, errorResult);
    this.updateRequestStatus(requestId, 'error', errorResult);

    return errorResult;
  }

  /**
   * Get optimization status
   */
  async getOptimizationStatus(requestId) {
    const request = await this.getRequest(requestId);

    if (!request) {
      return {
        success: false,
        error: 'Request not found',
      };
    }

    return {
      success: true,
      requestId,
      status: request.status,
      serviceType: request.serviceType || 'STANDARD',
      createdAt: request.timestamp,
      updatedAt: request.updatedAt,
    };
  }

  /**
   * Get system status including agent health
   */
  getSystemStatus() {
    const agentStatus = this.agentManager.getSystemStatus();

    return {
      service: 'enhanced-logistics',
      status: 'operational',
      features: {
        instantDelivery: true,
        barqEnabled: this.serviceTypes.BARQ.enabled,
        bulletEnabled: this.serviceTypes.BULLET.enabled,
        legacySupport: true,
      },
      agents: agentStatus.agents,
      monitoring: agentStatus.continuousAgents,
      metrics: agentStatus.metrics,
      activeRequests: this.activeRequests.size,
    };
  }

  /**
   * Database operations (using existing methods)
   */
  storeRequest(requestId, request) {
    try {
      const requestToStore = {
        id: requestId,
        timestamp: new Date().toISOString(),
        status: 'pending',
        serviceType: this.determineServiceType(request),
        ...request,
      };

      // Store in memory
      this.activeRequests.set(requestId, requestToStore);

      // Store in database
      const requests = db.get('requests').value() || [];
      requests.push(requestToStore);
      db.set('requests', requests).write();

      logger.info(`Request ${requestId} stored`);
      return requestToStore;
    } catch (error) {
      logger.error('Failed to store request', { error: error.message });
      throw error;
    }
  }

  storeResult(requestId, result) {
    try {
      const results = db.get('results').value() || [];
      results.push({
        requestId,
        timestamp: new Date().toISOString(),
        ...result,
      });
      db.set('results', results).write();

      logger.info(`Result for ${requestId} stored`);
    } catch (error) {
      logger.error('Failed to store result', { error: error.message });
    }
  }

  async updateRequestStatus(requestId, status, data = {}) {
    try {
      const requests = db.get('requests').value() || [];
      const index = requests.findIndex((r) => r.id === requestId);

      if (index !== -1) {
        requests[index].status = status;
        requests[index].updatedAt = new Date().toISOString();

        if (data) {
          requests[index].result = data;
        }

        db.set('requests', requests).write();
      }

      // Update in memory
      if (this.activeRequests.has(requestId)) {
        const request = this.activeRequests.get(requestId);
        request.status = status;
        request.updatedAt = new Date().toISOString();
      }

      logger.info(`Request ${requestId} status updated to ${status}`);
    } catch (error) {
      logger.error('Failed to update request status', { error: error.message });
    }
  }

  async getRequest(requestId) {
    // Check memory first
    if (this.activeRequests.has(requestId)) {
      return this.activeRequests.get(requestId);
    }

    // Check database
    const requests = db.get('requests').value() || [];
    return requests.find((r) => r.id === requestId);
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    logger.info('[EnhancedLogistics] Shutting down service');

    // Stop agent manager
    await this.agentManager.shutdown();

    // Clear active requests
    this.activeRequests.clear();

    logger.info('[EnhancedLogistics] Service shutdown complete');
  }
}

module.exports = EnhancedLogisticsService;
