/**
 * Optimization Controller
 * Handles all optimization-related API endpoints
 */

const { v4: uuidv4 } = require('uuid');
const { logger, logFunctionExecution } = require('../utils/logger');
const { logisticsService } = require('../services/logistics.service');
const databaseService = require('../services/database.service');

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

        // Create a cleaned-up response structure (v3.1.1)
        const response = {
          success: true,
          requestId,
          time_taken: processingTime,
          businessRules: businessRules, // Keep rules at top level
          // Directly include the core data, removing redundant nesting
          routes: result.data.routes || [],
          summary: result.data.summary || {},
          insights: result.data.insights || [],
          unserviceablePoints: result.data.unserviceablePoints || [],
          // Include zones only once at the top level (extracted from businessRules)
          allowedZones: businessRules.allowedZones || [],
          restrictedAreas: businessRules.restrictedAreas || [],
          timestamp: result.data.timestamp || new Date().toISOString(),
        };

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
};

module.exports = OptimizationController;
