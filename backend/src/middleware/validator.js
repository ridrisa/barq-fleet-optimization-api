/**
 * Request Validation Middleware
 * Validates incoming API requests against schemas
 */

const { logger, safeStringify } = require('../utils/logger');
const { RequestSanitizer } = require('../utils/sanitizer');

// Schema validation error class
class ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
  }
}

// Initialize sanitizer
const sanitizer = new RequestSanitizer();

// Validation middleware
const validator = {
  /**
   * Validate optimization request
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Function} next - Express next function
   */
  validateOptimizationRequest: (req, res, next) => {
    try {
      const requestId = req.headers['x-request-id'];
      logger.debug('Validating optimization request', { requestId });

      // Sanitize request body to prevent injection
      const sanitizedBody = sanitizer.sanitize(req.body);

      // Store start time for performance tracking
      req.startTime = new Date();

      // Validate required fields
      const errors = [];

      // Validate pickupPoints
      if (
        !sanitizedBody.pickupPoints ||
        !Array.isArray(sanitizedBody.pickupPoints) ||
        sanitizedBody.pickupPoints.length === 0
      ) {
        errors.push('At least one pickup point is required');
      } else {
        // Validate each pickup point
        sanitizedBody.pickupPoints.forEach((point, index) => {
          if (!point.lat || !point.lng) {
            errors.push(`Pickup point at index ${index} is missing required coordinates`);
          }
        });
      }

      // Validate deliveryPoints
      if (
        !sanitizedBody.deliveryPoints ||
        !Array.isArray(sanitizedBody.deliveryPoints) ||
        sanitizedBody.deliveryPoints.length === 0
      ) {
        errors.push('At least one delivery point is required');
      } else {
        // Validate each delivery point
        sanitizedBody.deliveryPoints.forEach((point, index) => {
          if (!point.lat || !point.lng) {
            errors.push(`Delivery point at index ${index} is missing required coordinates`);
          }
        });
      }

      // Validate fleet
      if (
        !sanitizedBody.fleet ||
        !Array.isArray(sanitizedBody.fleet) ||
        sanitizedBody.fleet.length === 0
      ) {
        errors.push('At least one vehicle in the fleet is required');
      }

      // Check additional fields
      if (!sanitizedBody.businessRules) {
        errors.push('Business rules are required');
      }

      // Optional fields with default values
      sanitizedBody.preferences = sanitizedBody.preferences || {
        sustainabilityScore: 0.5,
        costScore: 0.5,
        serviceScore: 0.5,
      };

      sanitizedBody.context = sanitizedBody.context || {
        weatherConditions: 'normal',
        trafficData: 'normal',
        specialEvents: [],
        historicalData: false,
      };

      // If validation fails, return error
      if (errors.length > 0) {
        logger.warn('Validation failed for optimization request', {
          requestId,
          errors,
          body: safeStringify(sanitizedBody),
        });

        return res.status(400).json({
          success: false,
          requestId,
          error: 'Validation failed',
          details: errors,
        });
      }

      // Set sanitized body on request
      req.body = sanitizedBody;
      logger.debug('Request validation successful', { requestId });
      next();
    } catch (error) {
      logger.error(`Error validating request: ${error.message}`, {
        error: error.stack,
        requestId: req.headers['x-request-id'],
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
        requestId: req.headers['x-request-id'],
      });
    }
  },
};

module.exports = validator;
