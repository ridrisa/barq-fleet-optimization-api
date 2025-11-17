/**
 * Logistics Service
 * Main service for handling logistics optimization requests
 */

const LLMConfigManager = require('../config/llm.config');
const db = require('../config/db.config');
const { generateId } = require('../utils/helper');
const PlanningAgent = require('../agents/planning.agent');
const OptimizationAgent = require('../agents/optimization.agent');
const FormatResponseAgent = require('../agents/formatting.agent');
const hybridOptimization = require('./hybrid-optimization.service');
const { logger, logFunctionExecution } = require('../utils/logger');

class LogisticsService {
  constructor() {
    this.llmConfig = new LLMConfigManager();

    // Initialize the AI agents with configurations
    this.planningAgent = new PlanningAgent(
      this.llmConfig.getConfig('planning'),
      this.llmConfig // Pass the entire config manager for system prompts
    );

    this.optimizationAgent = new OptimizationAgent(
      this.llmConfig.getConfig('optimization'),
      this.llmConfig // Pass the entire config manager for system prompts
    );

    this.formatAgent = new FormatResponseAgent(
      this.llmConfig.getConfig('formatting'),
      this.llmConfig // Pass the entire config manager for system prompts
    );

    // Track active optimization requests
    this.activeRequests = new Map();

    console.log('LogisticsService initialized with agents');
  }

  /**
   * Process an optimization request
   * @param {String} requestId - Request ID
   * @param {Object} sanitizedRequest - Sanitized request object
   * @param {Object} originalRequest - Original request object
   * @returns {Object} - Optimization result
   */
  async processOptimizationRequest(requestId, sanitizedRequest, originalRequest = null) {
    try {
      console.log(`Processing optimization request ${requestId}`);

      // Store the request in the database
      this.storeRequest(requestId, sanitizedRequest);

      // Update request status to processing
      await this.updateRequestStatus(requestId, 'processing');

      // Step 1: Generate initial route plan
      console.log('Planning Agent generating initial route plan');
      let initialPlan;
      try {
        initialPlan = await this.planningAgent.plan(sanitizedRequest);

        // Check if the plan has valid routes
        if (!initialPlan.routes || initialPlan.routes.length === 0) {
          console.log('Planning agent returned empty routes');

          // Instead of throwing an error, create a fallback plan with basic routes
          console.log('Generating fallback plan with basic routes');
          initialPlan = this.createFallbackPlan(sanitizedRequest);

          if (!initialPlan || !initialPlan.routes || initialPlan.routes.length === 0) {
            throw new Error('No valid routes could be generated. Please check your input data.');
          }
        }
      } catch (error) {
        console.log(`Planning agent error: ${error.message}`);

        // Try to create a fallback plan before giving up completely
        try {
          console.log('Attempting to create a fallback plan after error');
          initialPlan = this.createFallbackPlan(sanitizedRequest);

          if (!initialPlan || !initialPlan.routes || initialPlan.routes.length === 0) {
            throw new Error('No valid routes could be generated. Please check your input data.');
          }
        } catch (fallbackError) {
          console.error(`Failed to create fallback plan: ${fallbackError.message}`);

          // Create an error result
          const errorResult = {
            routes: [],
            summary: {
              total_routes: 0,
              total_distance: 0,
              total_duration: 0,
              total_deliveries: 0,
              total_load: 0,
              routingStats: {
                totalClusters: 0,
                averagePointsPerCluster: 0,
                alternativeRoutesGenerated: 0,
              },
              engineMetrics: {
                engineVersion: '1.0.0',
                profileUsed: 'driving',
                computationTime: 2.3,
              },
            },
            requestId,
            timestamp: new Date().toISOString(),
            insights: [`Failed to generate plan: ${error.message}`],
            error: error.message,
          };

          // Store the result
          this.storeResult(requestId, errorResult);

          // Update request status to error
          await this.updateRequestStatus(requestId, 'error', errorResult);

          // Return the error result with appropriate error status
          return {
            success: false,
            requestId,
            error: error.message,
            data: errorResult,
          };
        }
      }

      // Step 2: Optimize the plan
      console.log('Optimizing route plan');

      // NEW: Try hybrid optimization first (CVRP if eligible, otherwise OSRM)
      let optimizedPlan;
      try {
        const decision = hybridOptimization.decideOptimizationEngine(sanitizedRequest);
        console.log(`Optimization engine decision: ${decision.engine} - ${decision.reason}`);

        if (decision.engine === 'CVRP') {
          // Use CVRP optimization
          const cvrpResult = await hybridOptimization.optimizeWithCVRP(sanitizedRequest);

          if (cvrpResult.success) {
            // Convert CVRP result to match expected format
            optimizedPlan = {
              routes: cvrpResult.routes,
              pickupPoints: sanitizedRequest.pickupPoints,
              deliveryPoints: sanitizedRequest.deliveryPoints,
              vehicles: sanitizedRequest.fleet,
              businessRules: sanitizedRequest.businessRules || {},
              preferences: sanitizedRequest.preferences || {},
              optimizationEngine: 'CVRP',
              optimizationMetadata: cvrpResult.optimization_metadata,
            };

            console.log('CVRP optimization successful');
          } else {
            throw new Error('CVRP optimization failed');
          }
        } else {
          // Use existing OSRM-based optimization
          optimizedPlan = await this.optimizationAgent.optimize({
            plan: initialPlan,
            context: sanitizedRequest.context || {},
            preferences: sanitizedRequest.preferences || {},
            businessRules: sanitizedRequest.businessRules || {},
          });
        }
      } catch (cvrpError) {
        // Fallback to existing optimization if CVRP fails
        console.warn(`CVRP optimization error, using fallback: ${cvrpError.message}`);
        optimizedPlan = await this.optimizationAgent.optimize({
          plan: initialPlan,
          context: sanitizedRequest.context || {},
          preferences: sanitizedRequest.preferences || {},
          businessRules: sanitizedRequest.businessRules || {},
        });
      }

      // Step 3: Format the response
      console.log('FormatResponseAgent running');
      const formattedResponse = await this.formatAgent.format({
        optimizedPlan: optimizedPlan,
        request: sanitizedRequest,
      });

      console.log(`Optimization request ${requestId} processed successfully`);

      // Store the result
      this.storeResult(requestId, formattedResponse);

      // Update request status to completed
      await this.updateRequestStatus(requestId, 'completed', formattedResponse);

      return {
        success: true,
        requestId,
        data: formattedResponse,
        message: 'Optimization completed successfully',
      };
    } catch (error) {
      console.error(`Error processing optimization request: ${error.message}`);

      // Store error details
      const errorResult = {
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId,
        routes: [],
      };

      // Store the error result
      this.storeResult(requestId, errorResult);

      // Update request status to error
      await this.updateRequestStatus(requestId, 'error', errorResult);

      return {
        success: false,
        requestId,
        error: error.message,
        data: errorResult,
      };
    }
  }

  /**
   * Store a request in the database
   * @param {string} requestId - Request ID
   * @param {Object} request - Request data
   * @returns {Object} - Stored request object
   */
  storeRequest(requestId, request) {
    try {
      console.log(`Storing request ${requestId} in database`);

      // Create request object to store
      const requestToStore = {
        id: requestId,
        timestamp: new Date().toISOString(),
        status: 'pending',
        ...request,
      };

      // Store in database
      db.get('requests').push(requestToStore).write();

      return requestToStore;
    } catch (error) {
      console.error(`Error storing request: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store a result in the database
   * @param {string} requestId - Request ID
   * @param {Object} result - Result data
   */
  storeResult(requestId, result) {
    try {
      console.log(`Storing full result for request ${requestId} in database`);

      // Store the complete result data
      const resultToStore = {
        requestId, // Use exactly the requestId that was passed in
        timestamp: new Date().toISOString(),
        success: result.success,
        time_taken: result.time_taken,
        routes: result.data?.routes?.length || 0,
        total_distance: result.data?.summary?.total_distance || 0,
        total_duration: result.data?.summary?.total_duration || 0,
        complete_data: result.data || {}, // Store the full response data
        error: result.error || null,
      };

      // Check if result already exists
      const existingResult = db.get('optimizations').find({ requestId }).value();

      if (existingResult) {
        // Update existing result
        db.get('optimizations').find({ requestId }).assign(resultToStore).write();

        console.log(`Updated existing result for request ${requestId}`);
      } else {
        // Add to database
        db.get('optimizations').push(resultToStore).write();

        console.log(`Stored new result for request ${requestId}`);
      }

      // Update metrics
      this.updateMetrics(resultToStore);

      console.log(`Result for request ${requestId} stored successfully`);

      return resultToStore;
    } catch (error) {
      console.error(`Error storing result: ${error.message}`);
      // Continue execution even if there's an error storing the result
      return {
        requestId,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update system metrics
   * @param {Object} result - Result data
   */
  updateMetrics(result) {
    const currentDate = new Date().toISOString().split('T')[0];
    logger.debug(`Updating metrics for date ${currentDate}`, {
      functionName: 'updateMetrics',
    });

    // Get or create today's metrics
    let todayMetrics = db.get('metrics').find({ date: currentDate }).value();

    if (!todayMetrics) {
      todayMetrics = {
        date: currentDate,
        requests: 0,
        successful: 0,
        failed: 0,
        avg_time_taken: 0,
        total_routes: 0,
        total_distance: 0,
        total_duration: 0,
      };

      db.get('metrics').push(todayMetrics).write();

      logger.debug(`Created new metrics record for date ${currentDate}`, {
        functionName: 'updateMetrics',
      });
    }

    // Update metrics
    const updatedMetrics = {
      ...todayMetrics,
      requests: todayMetrics.requests + 1,
      successful: todayMetrics.successful + (result.success ? 1 : 0),
      failed: todayMetrics.failed + (result.success ? 0 : 1),
      avg_time_taken:
        (todayMetrics.avg_time_taken * todayMetrics.requests + result.time_taken) /
        (todayMetrics.requests + 1),
      total_routes: todayMetrics.total_routes + result.routes,
      total_distance: todayMetrics.total_distance + result.total_distance,
      total_duration: todayMetrics.total_duration + result.total_duration,
    };

    // Save updated metrics
    db.get('metrics').find({ date: currentDate }).assign(updatedMetrics).write();

    logger.debug(`Metrics updated for date ${currentDate}`, {
      functionName: 'updateMetrics',
      metrics: {
        requests: updatedMetrics.requests,
        successful: updatedMetrics.successful,
        failed: updatedMetrics.failed,
      },
    });
  }

  /**
   * Get the status of an optimization request
   * @param {string} requestId - Request ID
   * @returns {Object} - Request status
   */
  getOptimizationStatus(requestId) {
    logger.debug(`Getting status for request ${requestId}`, {
      functionName: 'getOptimizationStatus',
      requestId,
    });

    // Check if the request is active
    if (this.activeRequests.has(requestId)) {
      const status = this.activeRequests.get(requestId);
      logger.debug(`Found active request ${requestId} with status ${status.status}`, {
        functionName: 'getOptimizationStatus',
        requestId,
      });

      return {
        success: true,
        requestId,
        ...status,
      };
    }

    // Check if the request exists in the database
    const request = db.get('requests').find({ id: requestId }).value();

    if (!request) {
      logger.debug(`Request ${requestId} not found`, {
        functionName: 'getOptimizationStatus',
        requestId,
      });
      return null;
    }

    const result = db.get('optimizations').find({ requestId }).value();

    if (result) {
      logger.debug(`Found completed request ${requestId}`, {
        functionName: 'getOptimizationStatus',
        requestId,
      });

      return {
        success: true,
        requestId,
        status: 'completed',
        progress: 100,
        startTime: new Date(request.timestamp).getTime(),
        completedAt: new Date(result.timestamp).getTime(),
      };
    }

    // Request exists but no result yet
    logger.debug(`Request ${requestId} exists but has unknown status`, {
      functionName: 'getOptimizationStatus',
      requestId,
    });

    return {
      success: true,
      requestId,
      status: 'unknown',
      progress: 0,
      startTime: new Date(request.timestamp).getTime(),
    };
  }

  /**
   * Get optimization result by request ID
   * @param {string} requestId - Request ID
   * @returns {Object} - Optimization result
   */
  getOptimizationResult(requestId) {
    try {
      console.log(`Getting optimization result for request ${requestId}`);

      // Check if the request exists in the database
      const request = db.get('requests').find({ id: requestId }).value();

      if (!request) {
        console.log(`Request ${requestId} not found`);
        return null;
      }

      // Get the optimization result
      const result = db.get('optimizations').find({ requestId }).value();

      if (!result) {
        console.log(`No result found for request ${requestId}`);
        return null;
      }

      console.log(`Found result for request ${requestId}`);

      return {
        request: {
          id: request.id,
          timestamp: request.timestamp,
          pickupPoints: request.pickupPoints,
          deliveryPoints: request.deliveryPoints,
          fleet: request.fleet,
          context: request.context,
          businessRules: request.businessRules,
          preferences: request.preferences,
        },
        result: {
          success: result.success,
          timestamp: result.timestamp,
          time_taken: result.time_taken,
          routes: result.routes || result.complete_data?.routes || [],
          total_distance: result.total_distance,
          total_duration: result.total_duration,
          summary: result.summary || result.complete_data?.summary || {},
          insights: result.insights || result.complete_data?.insights || {},
          complete_data: result.complete_data || {},
        },
      };
    } catch (error) {
      console.error(`Error getting optimization result: ${error.message}`);
      return null;
    }
  }

  /**
   * Get optimization request history
   * @param {number} limit - Maximum number of items to return
   * @param {number} page - Page number (1-based)
   * @returns {Array} - History of optimization requests
   */
  getOptimizationHistory(limit = 10, page = 1) {
    console.log(`Getting optimization history with limit: ${limit}, page: ${page}`);

    // Get requests from the database with their results
    const requests = db.get('requests').value();

    const results = db.get('optimizations').value();

    console.log(`Found ${requests.length} requests and ${results.length} results`);

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
          context: request.context,
          success: result ? result.success : null,
          time_taken: result ? result.time_taken : null,
          routes: result ? result.routes : null,
          total_distance: result ? result.total_distance : null,
          total_duration: result ? result.total_duration : null,
          completed: !!result,
        };
      })
      .filter((item) => item.completed) // Only include completed optimizations with results
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedHistory = allHistory.slice(startIndex, endIndex);

    console.log(
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
  }

  /**
   * Update the status of an optimization request
   * @param {string} requestId - Request ID
   * @param {string} status - New status (processing, completed, failed)
   * @param {Object} result - Optional result data for completed requests
   * @returns {boolean} - Success flag
   */
  async updateRequestStatus(requestId, status, result = null) {
    try {
      console.log(`Updating request ${requestId} status to ${status}`);

      // Find the request in the database
      const request = db.get('requests').find({ id: requestId }).value();

      if (!request) {
        console.error(`Request ${requestId} not found, cannot update status`);
        return false;
      }

      // Update the request status
      db.get('requests')
        .find({ id: requestId })
        .assign({
          status,
          updatedAt: new Date().toISOString(),
        })
        .write();

      // If status is completed or failed and we have a result, store it
      if ((status === 'completed' || status === 'failed') && result) {
        // Check if there's already a result for this request
        const existingResult = db.get('optimizations').find({ requestId }).value();

        if (existingResult) {
          // Update existing result
          db.get('optimizations')
            .find({ requestId })
            .assign({
              ...result,
              status,
              updatedAt: new Date().toISOString(),
            })
            .write();
        } else {
          // Store new result
          db.get('optimizations')
            .push({
              requestId,
              status,
              result,
              timestamp: new Date().toISOString(),
            })
            .write();
        }
      }

      console.log(`Request ${requestId} status updated to ${status}`);
      return true;
    } catch (error) {
      console.error(`Error updating request status: ${error.message}`);
      return false;
    }
  }

  /**
   * Create a fallback plan with simplified routes when planning agent fails
   * @param {Object} request - The optimization request
   * @returns {Object} - Fallback plan with basic routes
   */
  createFallbackPlan(request) {
    console.log('Creating fallback plan with basic routes');

    try {
      const routes = [];
      const { pickupPoints, deliveryPoints, fleet } = request;

      // Ensure we have the basics
      if (!pickupPoints || !pickupPoints.length || !deliveryPoints || !deliveryPoints.length) {
        throw new Error('Cannot create fallback plan without pickup points and delivery points');
      }

      // Use all available vehicles or create defaults
      const vehicles =
        fleet && Array.isArray(fleet) && fleet.length > 0
          ? fleet
          : [
              {
                id: 'default-vehicle',
                fleet_id: 'default-vehicle',
                type: 'TRUCK',
                capacity_kg: 3000,
                current_latitude: pickupPoints[0].lat,
                current_longitude: pickupPoints[0].lng,
              },
            ];

      console.log(
        `Creating fallback plan with ${pickupPoints.length} pickups, ${deliveryPoints.length} deliveries, and ${vehicles.length} vehicles`
      );

      // Basic approach: for single pickup, use all vehicles; for multiple pickups, match pickup count
      const vehiclesToUse = pickupPoints.length === 1 ? vehicles.length : Math.min(vehicles.length, pickupPoints.length);

      // For each vehicle, create a route
      for (let i = 0; i < vehiclesToUse; i++) {
        const pickup = pickupPoints[i % pickupPoints.length];
        const vehicle = vehicles[i % vehicles.length];

        // Determine which deliveries to assign to this route
        // Simple approach: divide equally (or, for multi-region, use delivery order_id prefix matching)
        const deliveriesForRoute = deliveryPoints.filter((delivery, index) => {
          // If the delivery ID has a region prefix that matches the pickup ID prefix
          // (e.g., RUH-001 -> pickup-ruh)
          if (delivery.order_id && pickup.id) {
            const deliveryPrefix = delivery.order_id.split('-')[0].toUpperCase();
            const pickupPrefix = pickup.id.split('-')[1]?.toUpperCase();

            if (deliveryPrefix && pickupPrefix && deliveryPrefix === pickupPrefix) {
              return true;
            }
          }

          // Fallback: distribute evenly across vehicles
          return index % vehiclesToUse === i;
        });

        // Skip if no deliveries assigned
        if (deliveriesForRoute.length === 0) {
          console.log(
            `No deliveries assigned to pickup ${pickup.id || 'unknown'} with vehicle ${vehicle.fleet_id || vehicle.id || 'unknown'}`
          );
          continue;
        }

        // Create a simple route
        const routeId = `route-${generateId()}`;
        const vehicleId = vehicle.fleet_id || vehicle.id;

        // Create waypoints
        const waypoints = [];

        // Start at vehicle location
        waypoints.push({
          type: 'start',
          location: {
            latitude: vehicle.current_latitude || pickup.lat,
            longitude: vehicle.current_longitude || pickup.lng,
          },
          name: `Vehicle ${vehicleId} Start`,
        });

        // Go to pickup
        waypoints.push({
          type: 'pickup',
          location: {
            latitude: pickup.lat,
            longitude: pickup.lng,
          },
          name: pickup.name || `Pickup ${i + 1}`,
        });

        // Visit each delivery
        deliveriesForRoute.forEach((delivery) => {
          waypoints.push({
            type: 'delivery',
            location: {
              latitude: delivery.lat,
              longitude: delivery.lng,
            },
            name: delivery.customer_name || `Delivery ${delivery.order_id || ''}`,
          });
        });

        // Return to pickup/depot
        waypoints.push({
          type: 'end',
          location: {
            latitude: pickup.lat,
            longitude: pickup.lng,
          },
          name: `Return to ${pickup.name || 'depot'}`,
        });

        // Calculate simple distance (linear/air distance)
        let totalDistance = 0;
        for (let j = 0; j < waypoints.length - 1; j++) {
          const p1 = waypoints[j].location;
          const p2 = waypoints[j + 1].location;

          // Haversine formula for rough distance calculation
          const R = 6371; // Earth radius in km
          const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
          const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((p1.latitude * Math.PI) / 180) *
              Math.cos((p2.latitude * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;

          totalDistance += distance;
        }

        // Estimate duration (rough estimate: 40km/h average speed = 1.5 minutes per km)
        const totalDuration = Math.round(totalDistance * 1.5);

        const route = {
          id: routeId,
          vehicle: {
            fleet_id: vehicleId,
            vehicle_type: vehicle.vehicle_type || vehicle.type || 'TRUCK',
            capacity_kg: vehicle.capacity_kg || 3000,
          },
          waypoints,
          stops: waypoints,
          distance: Math.round(totalDistance * 10) / 10, // Round to 1 decimal
          duration: totalDuration,
          deliveries: deliveriesForRoute.map((d) => ({
            order_id: d.order_id || `order-${generateId()}`,
            customer_name: d.customer_name || 'Customer',
            load_kg: d.load_kg || 0,
          })),
          load_kg: deliveriesForRoute.reduce((sum, d) => sum + (d.load_kg || 0), 0),
        };

        routes.push(route);

        console.log(
          `Created fallback route for vehicle ${vehicleId} with ${deliveriesForRoute.length} deliveries (${route.distance.toFixed(1)}km, ${route.duration} mins)`
        );
      }

      // Ensure at least one route
      if (routes.length === 0 && pickupPoints.length > 0 && deliveryPoints.length > 0) {
        console.log('No routes created, generating a single fallback route');

        // Simplest fallback: one pickup, one vehicle, all deliveries
        const pickup = pickupPoints[0];
        const vehicle = vehicles[0] || {
          id: 'emergency-vehicle',
          fleet_id: 'emergency-vehicle',
          vehicle_type: 'TRUCK',
          capacity_kg: 3000,
          current_latitude: pickup.lat,
          current_longitude: pickup.lng,
        };

        // Create waypoints
        const waypoints = [
          {
            type: 'start',
            location: {
              latitude: vehicle.current_latitude || pickup.lat,
              longitude: vehicle.current_longitude || pickup.lng,
            },
            name: `Vehicle Start`,
          },
          {
            type: 'pickup',
            location: {
              latitude: pickup.lat,
              longitude: pickup.lng,
            },
            name: pickup.name || 'Pickup Point',
          },
        ];

        // Add all deliveries
        deliveryPoints.forEach((delivery) => {
          waypoints.push({
            type: 'delivery',
            location: {
              latitude: delivery.lat,
              longitude: delivery.lng,
            },
            name: delivery.customer_name || `Delivery ${delivery.order_id || ''}`,
          });
        });

        // Return to pickup
        waypoints.push({
          type: 'end',
          location: {
            latitude: pickup.lat,
            longitude: pickup.lng,
          },
          name: `Return to ${pickup.name || 'depot'}`,
        });

        // Simplified distance (700m per stop)
        const distance = waypoints.length * 0.7;

        // Create the route
        const route = {
          id: `route-${generateId()}`,
          vehicle: {
            fleet_id: vehicle.fleet_id || vehicle.id,
            vehicle_type: vehicle.vehicle_type || vehicle.type || 'TRUCK',
            capacity_kg: vehicle.capacity_kg || 3000,
          },
          waypoints,
          stops: waypoints,
          distance: Math.round(distance * 10) / 10,
          duration: Math.round(distance * 5), // ~5 minutes per stop
          deliveries: deliveryPoints.map((d) => ({
            order_id: d.order_id || `order-${generateId()}`,
            customer_name: d.customer_name || 'Customer',
            load_kg: d.load_kg || 0,
          })),
          load_kg: deliveryPoints.reduce((sum, d) => sum + (d.load_kg || 0), 0),
        };

        routes.push(route);
        console.log(`Created emergency fallback route with ${deliveryPoints.length} deliveries`);
      }

      // Build and return the fallback plan
      return {
        routes,
        pickupPoints,
        deliveryPoints,
        vehicles: fleet || vehicles,
        businessRules: request.businessRules || {},
        preferences: request.preferences || {},
      };
    } catch (error) {
      console.error(`Error creating fallback plan: ${error.message}`);
      throw new Error(`Failed to create fallback plan: ${error.message}`);
    }
  }
}

// Apply logging wrappers to all methods
const service = new LogisticsService();
const wrappedService = {
  processOptimizationRequest: logFunctionExecution(
    service.processOptimizationRequest.bind(service),
    'LogisticsService.processOptimizationRequest'
  ),
  storeRequest: logFunctionExecution(
    service.storeRequest.bind(service),
    'LogisticsService.storeRequest'
  ),
  storeResult: logFunctionExecution(
    service.storeResult.bind(service),
    'LogisticsService.storeResult'
  ),
  updateMetrics: logFunctionExecution(
    service.updateMetrics.bind(service),
    'LogisticsService.updateMetrics'
  ),
  updateRequestStatus: logFunctionExecution(
    service.updateRequestStatus.bind(service),
    'LogisticsService.updateRequestStatus'
  ),
  getOptimizationStatus: logFunctionExecution(
    service.getOptimizationStatus.bind(service),
    'LogisticsService.getOptimizationStatus'
  ),
  getOptimizationResult: logFunctionExecution(
    service.getOptimizationResult.bind(service),
    'LogisticsService.getOptimizationResult'
  ),
  getOptimizationHistory: logFunctionExecution(
    service.getOptimizationHistory.bind(service),
    'LogisticsService.getOptimizationHistory'
  ),
};

// Export both the class and the wrapped instance
module.exports = {
  LogisticsService,
  logisticsService: wrappedService,
};
