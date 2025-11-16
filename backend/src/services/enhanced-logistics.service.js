/**
 * Enhanced Logistics Service
 * Integrates instant delivery agents for BARQ/BULLET while maintaining legacy support
 * Handles both traditional route optimization and real-time instant delivery
 */

const LLMConfigManager = require('../config/llm.config');
const db = require('../config/db.config');
const { generateId } = require('../utils/helper');
const { logger, logFunctionExecution } = require('../utils/logger');

// Import Agent Manager for instant delivery
const AgentManagerService = require('./agent-manager.service');

// Import LLM Fleet Advisor for intelligent optimization
const LLMFleetAdvisor = require('./llm-fleet-advisor.service');

// Import legacy agents for backward compatibility
const PlanningAgent = require('../agents/planning.agent');
const OptimizationAgent = require('../agents/optimization.agent');
const FormatResponseAgent = require('../agents/formatting.agent');

class EnhancedLogisticsService {
  constructor(agentManager = null) {
    this.llmConfig = new LLMConfigManager();

    // Use provided agent manager or create new one for instant delivery
    this.agentManager = agentManager || new AgentManagerService(this.llmConfig);

    // Initialize LLM Fleet Advisor for intelligent optimization
    this.llmFleetAdvisor = LLMFleetAdvisor;

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
   * Process using legacy optimization system with LLM enhancement
   */
  async processLegacyOptimization(requestId, request) {
    logger.info('[EnhancedLogistics] Using legacy optimization system with LLM enhancement');

    try {
      // CRITICAL FIX: Extract vehicles BEFORE calling planning agent
      // The planning agent needs vehicles to be available in the request
      const vehicles = request.fleet?.vehicles || request.fleet || request.vehicles || [];
      const pickupPoints = request.pickupPoints || [];
      const deliveryPoints = request.deliveryPoints || [];

      // Ensure vehicles are properly structured in the request for planning agent
      // The planning agent expects either request.vehicles or request.fleet
      const planningRequest = {
        ...request,
        vehicles: vehicles,  // Add vehicles array directly
        fleet: request.fleet || { vehicles }  // Also maintain fleet structure if it exists
      };

      logger.info(`[EnhancedLogistics] Prepared request with ${vehicles.length} vehicles for planning agent`);

      // Step 1: Planning
      const initialPlan = await this.planningAgent.plan(planningRequest);

      if (!initialPlan.routes || initialPlan.routes.length === 0) {
        throw new Error('No valid routes generated');
      }

      logger.info(`[EnhancedLogistics] Initial plan created with ${initialPlan.routes.length} routes`);

      // Only use LLM optimization if we have multiple vehicles and deliveries
      if (vehicles.length > 1 && deliveryPoints.length > vehicles.length) {
        logger.info(
          `[EnhancedLogistics] Applying LLM multi-vehicle optimization (${vehicles.length} vehicles, ${deliveryPoints.length} deliveries)`
        );

        try {
          // Get LLM's intelligent vehicle distribution with SLA constraint
          const slaHours = request.constraints?.maxDeliveryTime
            ? request.constraints.maxDeliveryTime / 60
            : 4; // Default 4-hour SLA

          const llmOptimization = await this.llmFleetAdvisor.optimizeMultiVehicleRoutes(
            pickupPoints,
            deliveryPoints,
            vehicles,
            { slaHours }
          );

          if (llmOptimization.success && llmOptimization.optimization?.vehicle_assignments) {
            logger.info(
              `[EnhancedLogistics] LLM suggested ${llmOptimization.optimization.strategy.vehicles_used} vehicles, utilization: ${(llmOptimization.optimization.optimization_metrics.utilization_rate * 100).toFixed(1)}%, SLA: ${llmOptimization.optimization.strategy.sla_compliance || 'unknown'}`
            );

            // ACTUALLY USE the LLM's vehicle assignments to create routes
            const llmRoutes = llmOptimization.optimization.vehicle_assignments.map(assignment => {
              // Find the vehicle, pickup, and deliveries from the request data
              const vehicle = vehicles.find(v => v.id === assignment.vehicle_id) || vehicles[0];
              const pickup = pickupPoints.find(p => p.id === assignment.pickup_id);
              const assignedDeliveries = deliveryPoints.filter(d =>
                assignment.delivery_ids.includes(d.id)
              );

              // Create waypoints array
              const waypoints = [
                ...(pickup ? [{...pickup, type: 'pickup'}] : []),
                ...assignedDeliveries.map(d => ({...d, type: 'delivery'}))
              ];

              // CRITICAL: Create stops array for optimization agent
              // The optimization agent expects routes to have a 'stops' array (line 60 of optimization.agent.js)
              const stops = waypoints.map(wp => ({
                ...wp,
                id: wp.id,
                name: wp.name || wp.address || `Stop ${wp.id}`,
                location: {
                  latitude: wp.lat,
                  longitude: wp.lng
                },
                lat: wp.lat,
                lng: wp.lng,
                type: wp.type,
                serviceTime: wp.serviceTime || 5
              }));

              // Create a route with this vehicle's assigned deliveries
              return {
                id: `route-${generateId()}`,
                vehicle: vehicle,
                pickupPoints: pickup ? [pickup] : [],
                deliveryPoints: assignedDeliveries,
                waypoints: waypoints,
                stops: stops, // Required for optimization agent to process the route
                llm_assigned: true,
              };
            });

            // Replace the initial plan's routes with LLM-optimized multi-vehicle routes
            if (llmRoutes.length > 0) {
              initialPlan.routes = llmRoutes;
              logger.info(`[EnhancedLogistics] Created ${llmRoutes.length} routes from LLM assignments`);
            }

            // Store LLM metadata
            initialPlan.llmOptimization = llmOptimization.optimization;
            initialPlan.aiPowered = llmOptimization.ai_powered;
          }
        } catch (llmError) {
          logger.warn(`[EnhancedLogistics] LLM optimization failed: ${llmError.message}`);
          // Continue with standard optimization
        }
      }

      // Step 2: Optimization
      const optimizedPlan = await this.optimizationAgent.optimize({
        plan: initialPlan,
        context: request.context || {},
        preferences: request.preferences || {},
        businessRules: request.businessRules || {},
      });

      // Step 2.5: Add ETAs to all routes
      if (optimizedPlan.routes && optimizedPlan.routes.length > 0) {
        logger.info(`[EnhancedLogistics] Calculating ETAs for ${optimizedPlan.routes.length} routes`);

        const startTime = request.startTime
          ? new Date(request.startTime)
          : new Date();

        optimizedPlan.routes = optimizedPlan.routes.map((route) => {
          try {
            // Calculate ETAs for this route
            const routeWithETAs = this.llmFleetAdvisor.calculateRouteETAs(route, startTime);
            return routeWithETAs;
          } catch (etaError) {
            logger.warn(
              `[EnhancedLogistics] Failed to calculate ETAs for route ${route.id}: ${etaError.message}`
            );
            return route; // Return original route if ETA calculation fails
          }
        });

        logger.info('[EnhancedLogistics] ETAs calculated for all routes');
      }

      // Step 3: Formatting
      const formattedResponse = await this.formatAgent.format({
        optimizedPlan: optimizedPlan,
        request: request,
      });

      // Add LLM optimization metadata to response
      if (initialPlan.llmOptimization) {
        formattedResponse.llmOptimization = {
          enabled: true,
          aiPowered: initialPlan.aiPowered,
          strategy: initialPlan.llmOptimization.strategy,
          metrics: initialPlan.llmOptimization.optimization_metrics,
          recommendations: initialPlan.llmOptimization.recommendations,
        };
      }

      // Store and update status
      this.storeResult(requestId, formattedResponse);
      await this.updateRequestStatus(requestId, 'completed', formattedResponse);

      return {
        success: true,
        requestId,
        data: formattedResponse,
        serviceType: 'STANDARD',
        message: 'Optimization completed successfully',
        llmEnhanced: !!initialPlan.llmOptimization,
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
   * Get optimization history with pagination
   */
  getOptimizationHistory(limit = 10, page = 1) {
    logger.info(`Getting optimization history with limit: ${limit}, page: ${page}`);

    try {
      // Get requests from the database with their results
      const requests = db.get('requests').value() || [];
      const results = db.get('results').value() || [];

      logger.info(`Found ${requests.length} requests and ${results.length} results`);

      // Map requests to include their results
      const allHistory = requests
        .map((request) => {
          const result = results.find((r) => r.requestId === request.id);

          return {
            id: request.id,
            timestamp: request.timestamp,
            pickupPoints: request.pickupPoints,
            deliveryPoints: request.deliveryPoints,
            fleet: request.fleet,
            vehicles: request.vehicles,
            serviceType: request.serviceType,
            status: request.status,
            success: result ? result.success : null,
            time_taken: result ? result.time_taken : null,
            routes: result ? result.data?.routes : null,
            total_distance: result ? result.data?.summary?.total_distance : null,
            total_duration: result ? result.data?.summary?.total_duration : null,
            completed: !!result,
          };
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedHistory = allHistory.slice(startIndex, endIndex);

      logger.info(
        `Returning ${paginatedHistory.length} history records (page ${page} of ${Math.ceil(allHistory.length / limit)})`
      );

      return {
        items: paginatedHistory,
        pagination: {
          total: allHistory.length,
          page: page,
          limit: limit,
          pages: Math.ceil(allHistory.length / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to get optimization history', { error: error.message });
      return {
        items: [],
        pagination: {
          total: 0,
          page: page,
          limit: limit,
          pages: 0,
        },
      };
    }
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

// Create singleton instance
const service = new EnhancedLogisticsService();

// Wrap methods with logging
const wrappedService = {
  processOptimizationRequest: logFunctionExecution(
    service.processOptimizationRequest.bind(service),
    'EnhancedLogisticsService.processOptimizationRequest'
  ),
  getOptimizationStatus: logFunctionExecution(
    service.getOptimizationStatus.bind(service),
    'EnhancedLogisticsService.getOptimizationStatus'
  ),
  getOptimizationHistory: logFunctionExecution(
    service.getOptimizationHistory.bind(service),
    'EnhancedLogisticsService.getOptimizationHistory'
  ),
  shutdown: logFunctionExecution(
    service.shutdown.bind(service),
    'EnhancedLogisticsService.shutdown'
  ),
};

// Export both the class and the wrapped instance
module.exports = {
  EnhancedLogisticsService,
  logisticsService: wrappedService,
};
