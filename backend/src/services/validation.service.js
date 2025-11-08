/**
 * Validation Service
 * Handles request validation for the application
 */

const Joi = require('joi');
const { optimizationRequestSchema } = require('../models/request.model');
const { ValidationError } = require('../utils/sanitizer');

class ValidationService {
  /**
   * Validate an optimization request
   * @param {Object} request - Request to validate
   * @returns {Object} - Validation result
   * @throws {ValidationError} - If validation fails
   */
  validateOptimizationRequest(request) {
    const { error, value } = optimizationRequestSchema.validate(request, {
      abortEarly: false,
      allowUnknown: false,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        message: detail.message,
        path: detail.path.join('.'),
      }));

      throw new ValidationError(`Validation failed: ${error.message}`, details);
    }

    return value;
  }

  /**
   * Validate coordinates
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {boolean} - Whether the coordinates are valid
   */
  validateCoordinates(lat, lng) {
    const schema = Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
    });

    const { error } = schema.validate({ lat, lng });
    return !error;
  }

  /**
   * Validate a time window string
   * @param {string} timeWindow - Time window string (HH:MM-HH:MM)
   * @returns {boolean} - Whether the time window is valid
   */
  validateTimeWindow(timeWindow) {
    if (!timeWindow) return false;

    const timeWindowRegex = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeWindowRegex.test(timeWindow)) return false;

    // Extract hours and minutes
    const [startTime, endTime] = timeWindow.split('-');
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    // Convert to minutes for comparison
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    // End time should be after start time
    return endMinutes > startMinutes;
  }

  /**
   * Validate a vehicle
   * @param {Object} vehicle - Vehicle to validate
   * @returns {boolean} - Whether the vehicle is valid
   */
  validateVehicle(vehicle) {
    const schema = Joi.object({
      fleet_id: Joi.string().required(),
      vehicle_type: Joi.string().valid('TRUCK', 'CAR', 'VAN', 'MOTORCYCLE').required(),
      capacity_kg: Joi.number().min(0).required(),
      current_latitude: Joi.number().min(-90).max(90).required(),
      current_longitude: Joi.number().min(-180).max(180).required(),
      outlet_id: Joi.number().required(),
      status: Joi.string().valid('AVAILABLE', 'UNAVAILABLE', 'DELIVERING', 'RETURNING').required(),
    });

    const { error } = schema.validate(vehicle);
    return !error;
  }

  /**
   * Check if a route exceeds vehicle capacity
   * @param {Object} route - Route to check
   * @returns {boolean} - Whether the route exceeds capacity
   */
  routeExceedsCapacity(route) {
    if (!route || !route.vehicle || !route.waypoints) return true;

    const vehicleCapacity = route.vehicle.capacity_kg;

    // Calculate total load from deliveries
    const totalLoad = route.waypoints
      .filter((wp) => wp.type === 'delivery')
      .reduce((sum, wp) => sum + (wp.delivery.load_kg || 0), 0);

    return totalLoad > vehicleCapacity;
  }

  /**
   * Check if a polygon is valid
   * @param {Array} polygon - Array of [lat, lng] coordinates
   * @returns {boolean} - Whether the polygon is valid
   */
  validatePolygon(polygon) {
    if (!Array.isArray(polygon) || polygon.length < 3) return false;

    return polygon.every(
      (point) =>
        Array.isArray(point) && point.length === 2 && this.validateCoordinates(point[0], point[1])
    );
  }
}

module.exports = new ValidationService();
