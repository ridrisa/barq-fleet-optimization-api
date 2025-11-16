/**
 * Optimization Controller
 * Handles all optimization-related API endpoints
 */

const { v4: uuidv4 } = require('uuid');
const { logger, logFunctionExecution } = require('../utils/logger');
const { logisticsService } = require('../services/enhanced-logistics.service');
const databaseService = require('../services/database.service');
const { parseTimeWindow, isTimeInWindow } = require('../utils/helper');

// No need to initialize the service as we're importing the pre-wrapped instance

/**
 * Controller functions wrapped with logging
 */
const OptimizationController = {
  /**
   * Process an optimization request
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  optimizeRoute: logFunctionExecution(async (req, res) => {
    try {
      // Generate a UUID for the request or use the one provided in headers
      // This UUID format will be used consistently throughout the system
      // for identifying requests in database and API responses
      const requestId = req.headers['x-request-id'] || uuidv4();
      logger.info(`Starting optimization process for request: ${requestId}`, {
        requestId,
        method: 'optimizeRoute',
        userAgent: req.headers['user-agent'],
        contentType: req.headers['content-type'],
      });

      // Validate the request has the required fields
      if (!req.body || !req.body.pickupPoints || !req.body.deliveryPoints) {
        logger.error('Missing required fields in request', {
          requestId,
          body: JSON.stringify(req.body),
          pickupPoints: !!req.body?.pickupPoints,
          deliveryPoints: !!req.body?.deliveryPoints,
        });
        return res.status(400).json({
          success: false,
          requestId,
          error: 'Invalid request format',
          message: 'Request must include pickupPoints and deliveryPoints arrays',
        });
      }

      // Log business rules specifically if they exist
      if (req.body.businessRules) {
        logger.debug('Business rules in request:', {
          requestId,
          hasBusinessRules: true,
          hasAllowedZones: Array.isArray(req.body.businessRules.allowedZones),
          allowedZonesCount: req.body.businessRules.allowedZones?.length || 0,
          hasRestrictedAreas: Array.isArray(req.body.businessRules.restrictedAreas),
          restrictedAreasCount: req.body.businessRules.restrictedAreas?.length || 0,
          restrictedAreaSample: req.body.businessRules.restrictedAreas?.[0]
            ? JSON.stringify(req.body.businessRules.restrictedAreas[0])
            : 'none',
        });
      }

      // Basic validation of pickup and delivery points
      const hasValidPickupLocations = req.body.pickupPoints.some(
        (p) =>
          p &&
          ((p.location &&
            (typeof p.location.latitude === 'number' || typeof p.location.lat === 'number') &&
            (typeof p.location.longitude === 'number' || typeof p.location.lng === 'number')) ||
            (typeof p.lat === 'number' && typeof p.lng === 'number'))
      );

      const hasValidDeliveryLocations = req.body.deliveryPoints.some(
        (d) =>
          (d &&
            d.location &&
            (typeof d.location.latitude === 'number' || typeof d.location.lat === 'number') &&
            (typeof d.location.longitude === 'number' || typeof d.location.lng === 'number')) ||
          (typeof d.lat === 'number' && typeof d.lng === 'number')
      );

      // Debug logging for validation
      logger.debug('Request validation details', {
        requestId,
        pickupPointsCount: req.body.pickupPoints.length,
        deliveryPointsCount: req.body.deliveryPoints.length,
        hasValidPickupLocations,
        hasValidDeliveryLocations,
        firstPickup: req.body.pickupPoints[0] ? JSON.stringify(req.body.pickupPoints[0]) : 'none',
        firstDelivery: req.body.deliveryPoints[0]
          ? JSON.stringify(req.body.deliveryPoints[0])
          : 'none',
      });

      if (!hasValidPickupLocations || !hasValidDeliveryLocations) {
        logger.error('Invalid locations in request', {
          requestId,
          hasValidPickupLocations,
          hasValidDeliveryLocations,
        });
        return res.status(400).json({
          success: false,
          requestId,
          error: 'Invalid request data',
          message:
            'Request must include valid pickup and delivery points with locations (latitude/longitude)',
        });
      }

      // Log the request body for debugging
      logger.debug('Optimization request payload received', {
        requestId,
        pickupPointsCount: req.body.pickupPoints?.length || 0,
        deliveryPointsCount: req.body.deliveryPoints?.length || 0,
        fleetCount: req.body.fleet?.vehicles?.length || 0,
        hasBusinessRules: !!req.body.businessRules,
        hasAllowedZones: !!req.body.businessRules?.allowedZones,
        hasRestrictedAreas: !!req.body.businessRules?.restrictedAreas,
        allowedZonesCount: req.body.businessRules?.allowedZones?.length || 0,
        restrictedAreasCount: req.body.businessRules?.restrictedAreas?.length || 0,
      });

      // Add UUID requestId to the request body so it's used consistently
      // throughout all services and database operations
      req.body.requestId = requestId;

      // Process the optimization request
      const result = await logisticsService.processOptimizationRequest(requestId, req.body);

      // Record metrics about the request
      const processingTime = new Date() - req.startTime;
      logger.info(`Optimization completed successfully in ${processingTime}ms`, {
        requestId,
        processingTime,
        success: result.success,
        error: result.error,
      });

      // Handle both success and error cases
      if (result.success) {
        // Create the response structure with business rules explicitly at the top level
        const businessRules = req.body.businessRules || {};

        // Log what will be sent to ensure businessRules are included
        logger.debug('Business rules being sent in response:', {
          requestId,
          hasBusinessRules: !!businessRules,
          hasAllowedZones: Array.isArray(businessRules.allowedZones),
          allowedZonesCount: businessRules.allowedZones?.length || 0,
          hasRestrictedAreas: Array.isArray(businessRules.restrictedAreas),
          restrictedAreasCount: businessRules.restrictedAreas?.length || 0,
          firstRestrictedArea: businessRules.restrictedAreas?.[0]
            ? JSON.stringify(businessRules.restrictedAreas[0])
            : 'none',
        });

        // Calculate efficiency score based on route optimization metrics
        const calculateEfficiencyScore = () => {
          let score = 0;
          let factors = 0;

          // Factor 1: Route completion (all points serviced)
          const totalPoints = req.body.pickupPoints.length + req.body.deliveryPoints.length;
          const servicedPoints = (result.data.routes || []).reduce((sum, route) => {
            return sum + (route.stops ? route.stops.length : 0);
          }, 0);
          if (totalPoints > 0) {
            const completionRate = servicedPoints / totalPoints;
            score += completionRate * 30; // 30% weight for completion
            factors++;
          }

          // Factor 2: Distance optimization (vs simple straight-line distance)
          const totalDistance =
            result.data.summary?.totalDistance || result.data.summary?.total_distance || 0;
          if (totalDistance > 0) {
            // Estimate theoretical minimum distance (simplified)
            const theoreticalMin = totalDistance * 0.7; // Assume optimal is 70% of actual
            const distanceEfficiency = theoreticalMin / totalDistance;
            score += distanceEfficiency * 25; // 25% weight for distance
            factors++;
          }

          // Factor 3: Vehicle utilization
          const fleetSize = req.body.fleet?.count || 1;
          const usedVehicles = (result.data.routes || []).length;
          if (fleetSize > 0) {
            const utilizationRate = Math.min(usedVehicles / fleetSize, 1);
            score += utilizationRate * 20; // 20% weight for utilization
            factors++;
          }

          // Factor 4: Time efficiency (if duration data available)
          const totalDuration =
            result.data.summary?.totalTime || result.data.summary?.total_duration || 0;
          if (totalDuration > 0) {
            // Assume efficient if under 8 hours total
            const targetDuration = 8 * 60; // 8 hours in minutes
            const timeEfficiency = Math.min(targetDuration / totalDuration, 1);
            score += timeEfficiency * 15; // 15% weight for time
            factors++;
          }

          // Factor 5: Priority handling (higher priority points serviced first)
          if (result.data.routes && result.data.routes.length > 0) {
            let priorityScore = 0;
            result.data.routes.forEach((route) => {
              if (route.stops && route.stops.length > 1) {
                let correctOrder = true;
                for (let i = 1; i < route.stops.length; i++) {
                  const prevPriority = route.stops[i - 1].priority || 5;
                  const currPriority = route.stops[i].priority || 5;
                  if (prevPriority < currPriority) {
                    correctOrder = false;
                    break;
                  }
                }
                if (correctOrder) priorityScore = 1;
              }
            });
            score += priorityScore * 10; // 10% weight for priority
            factors++;
          }

          // Normalize score to 0-100
          const finalScore = factors > 0 ? Math.round(score) : 75; // Default to 75 if no factors
          return Math.min(100, Math.max(0, finalScore));
        };

        // Time window validation
        const validateTimeWindows = () => {
          if (!req.body.options?.respectTimeWindows) {
            return { valid: true, violations: [] };
          }

          const violations = [];
          const currentTime = new Date();
          currentTime.setHours(8, 0, 0, 0); // Start at 8:00 AM

          // Check each route for time window violations
          (result.data.routes || []).forEach((route, routeIndex) => {
            let routeTime = 0; // Track cumulative time in the route

            (route.stops || []).forEach((stop, stopIndex) => {
              // Find the original point data to get time window
              let originalPoint = null;
              let timeWindow = null;

              // Check if it's a pickup point
              const pickupPoint = req.body.pickupPoints.find(
                (p) => p.name === stop.name || (p.lat === stop.lat && p.lng === stop.lng)
              );

              // Check if it's a delivery point
              const deliveryPoint = req.body.deliveryPoints.find(
                (d) => d.name === stop.name || (d.lat === stop.lat && d.lng === stop.lng)
              );

              originalPoint = pickupPoint || deliveryPoint;
              if (originalPoint && originalPoint.timeWindow) {
                // Parse time window - handle both string format and object format
                if (typeof originalPoint.timeWindow === 'string') {
                  timeWindow = originalPoint.timeWindow;
                } else if (originalPoint.timeWindow.start && originalPoint.timeWindow.end) {
                  // Convert ISO format to HH:MM format
                  const startTime = new Date(originalPoint.timeWindow.start);
                  const endTime = new Date(originalPoint.timeWindow.end);
                  if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
                    const startHours = startTime.getHours().toString().padStart(2, '0');
                    const startMinutes = startTime.getMinutes().toString().padStart(2, '0');
                    const endHours = endTime.getHours().toString().padStart(2, '0');
                    const endMinutes = endTime.getMinutes().toString().padStart(2, '0');
                    timeWindow = `${startHours}:${startMinutes}-${endHours}:${endMinutes}`;
                  }
                }

                if (timeWindow) {
                  // Calculate arrival time at this stop
                  routeTime += (stop.duration || 0) / 60; // Convert seconds to minutes
                  const arrivalTime = new Date(currentTime);
                  arrivalTime.setMinutes(arrivalTime.getMinutes() + routeTime);

                  // Check if arrival time is within the window
                  const arrivalTimeStr = `${arrivalTime.getHours().toString().padStart(2, '0')}:${arrivalTime.getMinutes().toString().padStart(2, '0')}`;
                  const windowData = parseTimeWindow(timeWindow);

                  if (windowData.start && windowData.end) {
                    const windowStartStr = `${windowData.start.getHours().toString().padStart(2, '0')}:${windowData.start.getMinutes().toString().padStart(2, '0')}`;
                    const windowEndStr = `${windowData.end.getHours().toString().padStart(2, '0')}:${windowData.end.getMinutes().toString().padStart(2, '0')}`;

                    if (!isTimeInWindow(arrivalTimeStr, timeWindow)) {
                      violations.push({
                        route: routeIndex + 1,
                        stop: stop.name,
                        stopIndex: stopIndex + 1,
                        expectedWindow: `${windowStartStr}-${windowEndStr}`,
                        estimatedArrival: arrivalTimeStr,
                        violation: arrivalTime < windowData.start ? 'early' : 'late',
                      });
                    }
                  }
                }
              }

              // Add service time
              routeTime += stop.serviceTime || 5; // Default 5 minutes service time
            });
          });

          return {
            valid: violations.length === 0,
            violations: violations,
            totalViolations: violations.length,
          };
        };

        // Validate time windows if requested
        const timeWindowValidation = validateTimeWindows();

        // Calculate metrics
        const efficiencyScore = calculateEfficiencyScore();
        const metrics = {
          efficiency: efficiencyScore,
          processingTime: processingTime,
          routesGenerated: (result.data.routes || []).length,
          totalDistance:
            result.data.summary?.totalDistance || result.data.summary?.total_distance || 0,
          totalTime: result.data.summary?.totalTime || result.data.summary?.total_duration || 0,
          vehiclesUsed: (result.data.routes || []).length,
          pointsServiced: (result.data.routes || []).reduce((sum, route) => {
            return sum + (route.stops ? route.stops.length : 0);
          }, 0),
          timeWindowCompliance: timeWindowValidation.valid,
          timeWindowViolations: timeWindowValidation.totalViolations,
        };

        // Create a cleaned-up response structure (v3.1.1)
        const response = {
          success: true,
          requestId,
          time_taken: processingTime,
          businessRules: businessRules, // Keep rules at top level
          // Directly include the core data, removing redundant nesting
          routes: result.data.routes || [],
          summary: result.data.summary || {},
          metrics: metrics, // Add metrics with efficiency score
          insights: result.data.insights || [],
          unserviceablePoints: result.data.unserviceablePoints || [],
          // Include zones only once at the top level (extracted from businessRules)
          allowedZones: businessRules.allowedZones || [],
          restrictedAreas: businessRules.restrictedAreas || [],
          timestamp: result.data.timestamp || new Date().toISOString(),
        };

        // Add time window validation details if requested
        if (req.body.options?.respectTimeWindows) {
          response.timeWindowValidation = timeWindowValidation;
        }

        // Extra logging to confirm the final structure
        logger.debug('Cleaned optimization response structure (v3.1.1):', {
          requestId,
          keys: Object.keys(response),
          routesCount: response.routes.length,
          hasGeometryRoute0: response.routes[0]?.geometry
            ? response.routes[0].geometry.length > 0
            : 'N/A',
          hasOsrmStepsRoute0: response.routes[0]?.osrm?.legs?.[0]?.steps
            ? response.routes[0].osrm.legs[0].steps.length > 0
            : 'N/A',
          allowedZonesCount: response.allowedZones.length,
          restrictedAreasCount: response.restrictedAreas.length,
        });

        return res.status(200).json(response);
      } else {
        // Return the error result
        return res.status(400).json({
          success: false,
          requestId,
          error: result.error || 'Unknown error during optimization',
          data: result.data || null,
        });
      }
    } catch (error) {
      logger.error(`Error processing optimization request: ${error.message}`, {
        error: error.stack,
        requestId: req.headers['x-request-id'],
      });

      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
        requestId: req.headers['x-request-id'],
      });
    }
  }),

  /**
   * Get optimization status by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getOptimizationStatus: logFunctionExecution(async (req, res) => {
    try {
      const requestId = req.params.requestId;
      logger.info(`Getting optimization status for request: ${requestId}`, {
        requestId,
        method: 'getOptimizationStatus',
        ip: req.ip,
      });

      const status = await logisticsService.getOptimizationStatus(requestId);

      // Check if status is null (not found)
      if (!status) {
        logger.debug(`Request ${requestId} not found`, {
          requestId,
        });

        return res.status(404).json({
          success: false,
          requestId,
          error: `Optimization request with ID ${requestId} not found`,
        });
      }

      logger.debug(`Retrieved optimization status`, {
        requestId,
        status: status.status,
      });

      return res.status(200).json({
        success: true,
        requestId,
        ...status,
      });
    } catch (error) {
      logger.error(`Error getting optimization status: ${error.message}`, {
        error: error.stack,
        requestId: req.params.requestId,
      });

      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
        requestId: req.params.requestId,
      });
    }
  }),

  /**
   * Get optimization result by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getOptimizationResult: logFunctionExecution(async (req, res) => {
    try {
      const requestId = req.params.requestId;
      logger.info(`Getting optimization result for request: ${requestId}`, {
        requestId,
        method: 'getOptimizationResult',
        ip: req.ip,
      });

      // Retrieve the optimization result from the database
      const result = await logisticsService.getOptimizationResult(requestId);

      if (!result) {
        logger.debug(`Optimization result for request ${requestId} not found`, {
          requestId,
        });

        return res.status(404).json({
          success: false,
          requestId,
          error: `Optimization result with ID ${requestId} not found`,
        });
      }

      logger.debug(`Retrieved optimization result`, {
        requestId,
        hasRequestData: !!result.request,
        hasBusinessRules: !!result.request?.businessRules,
        hasAllowedZones: !!result.request?.businessRules?.allowedZones,
        hasRestrictedAreas: !!result.request?.businessRules?.restrictedAreas,
        allowedZonesCount: result.request?.businessRules?.allowedZones?.length || 0,
        restrictedAreasCount: result.request?.businessRules?.restrictedAreas?.length || 0,
      });

      // Extract business rules for placing at multiple levels
      const businessRules = result.request?.businessRules || {};

      // Log the business rules we're about to send
      logger.debug('Business rules being returned:', {
        requestId,
        hasBusinessRules: !!businessRules,
        allowedZonesCount: businessRules.allowedZones?.length || 0,
        restrictedAreasCount: businessRules.restrictedAreas?.length || 0,
        firstRestrictedArea: businessRules.restrictedAreas?.[0]
          ? JSON.stringify(businessRules.restrictedAreas[0])
          : 'none',
      });

      // Include business rules at the top level for maximum compatibility
      return res.status(200).json({
        success: true,
        requestId,
        // Add business rules directly at the top level
        businessRules: businessRules,
        // Add zones directly at the top level
        allowedZones: businessRules.allowedZones || [],
        restrictedAreas: businessRules.restrictedAreas || [],
        // Include the rest of the result data directly
        ...result,
        // Ensure routes are properly included from the result data
        routes: result.result?.routes || result.routes || [],
        summary: result.result?.summary || result.summary || {},
        insights: result.result?.insights || result.insights || [],
        metrics: result.result?.metrics || result.metrics || {},
      });
    } catch (error) {
      logger.error(`Error getting optimization result: ${error.message}`, {
        error: error.stack,
        requestId: req.params.requestId,
      });

      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
        requestId: req.params.requestId,
      });
    }
  }),

  /**
   * Get optimization history
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getOptimizationHistory: logFunctionExecution(async (req, res) => {
    try {
      const requestId = req.headers['x-request-id'] || uuidv4();
      logger.info(`Getting optimization history`, {
        requestId,
        method: 'getOptimizationHistory',
        ip: req.ip,
        query: req.query,
      });

      // Add pagination parameters - parse as integers with defaults
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;
      const page = req.query.page ? parseInt(req.query.page) : 1;

      logger.debug(`Fetching history with pagination params`, {
        requestId,
        limit,
        page,
      });

      const historyResult = await logisticsService.getOptimizationHistory(limit, page);

      logger.info(`Retrieved optimization history`, {
        requestId,
        historyItemsCount: historyResult.items.length,
        totalItems: historyResult.pagination.total,
      });

      return res.status(200).json({
        success: true,
        requestId,
        data: historyResult.items,
        meta: {
          pagination: historyResult.pagination,
        },
      });
    } catch (error) {
      logger.error(`Error getting optimization history: ${error.message}`, {
        error: error.stack,
        requestId: req.headers['x-request-id'],
      });

      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
        requestId: req.headers['x-request-id'],
      });
    }
  }),

  /**
   * Clear all optimization data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  clearData: logFunctionExecution(async (req, res) => {
    try {
      const requestId = req.headers['x-request-id'] || uuidv4();
      logger.info(`Clearing all optimization data`, {
        requestId,
        method: 'clearData',
        ip: req.ip,
      });

      // Use the database service to clear all data
      const success = databaseService.clearAllData();

      if (success) {
        logger.info(`Successfully cleared all optimization data`, {
          requestId,
        });

        return res.status(200).json({
          success: true,
          requestId,
          message: 'All optimization data has been cleared',
        });
      } else {
        throw new Error('Failed to clear database');
      }
    } catch (error) {
      logger.error(`Error clearing optimization data: ${error.message}`, {
        error: error.stack,
        requestId: req.headers['x-request-id'],
      });

      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
        requestId: req.headers['x-request-id'],
      });
    }
  }),

  /**
   * Get optimization statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getOptimizationStats: logFunctionExecution(async (req, res) => {
    try {
      const requestId = req.headers['x-request-id'] || uuidv4();
      logger.info(`Getting optimization statistics`, {
        requestId,
        method: 'getOptimizationStats',
        ip: req.ip,
      });

      // Get system statistics from the database service
      const stats = await databaseService.getSystemStats();

      // Calculate additional statistics
      const successRate = stats.totalRequests > 0
        ? ((stats.completedOptimizations / stats.totalRequests) * 100).toFixed(2)
        : 0;

      const avgDistance = stats.totalRoutes > 0
        ? (stats.totalDistance / stats.totalRoutes).toFixed(2)
        : 0;

      const avgDuration = stats.totalRoutes > 0
        ? (stats.totalDuration / stats.totalRoutes).toFixed(2)
        : 0;

      // Format the response
      const response = {
        success: true,
        requestId,
        data: {
          totalOptimizations: stats.totalRequests || 0,
          completedOptimizations: stats.completedOptimizations || 0,
          successRate: parseFloat(successRate),
          averageProcessingTime: stats.avgTimeTaken ? parseFloat(stats.avgTimeTaken.toFixed(2)) : 0,
          totalRoutes: stats.totalRoutes || 0,
          totalDistance: stats.totalDistance || 0,
          averageDistance: parseFloat(avgDistance),
          totalDuration: stats.totalDuration || 0,
          averageDuration: parseFloat(avgDuration),
          databaseMode: databaseService.getMode(),
        },
        timestamp: new Date().toISOString(),
      };

      logger.info(`Retrieved optimization statistics`, {
        requestId,
        totalOptimizations: response.data.totalOptimizations,
        successRate: response.data.successRate,
      });

      return res.status(200).json(response);
    } catch (error) {
      logger.error(`Error getting optimization statistics: ${error.message}`, {
        error: error.stack,
        requestId: req.headers['x-request-id'],
      });

      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
        requestId: req.headers['x-request-id'],
      });
    }
  }),
};

module.exports = OptimizationController;
