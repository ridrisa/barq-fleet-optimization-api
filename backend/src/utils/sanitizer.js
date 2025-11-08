/**
 * Request Sanitizer
 * Sanitizes and validates incoming API requests
 */

class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.errorCode = 'VALIDATION_ERROR';
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class RequestSanitizer {
  constructor() {
    // Define allowed values for enumeration fields
    this.allowedVehicleTypes = ['TRUCK', 'CAR', 'VAN', 'MOTORCYCLE'];
    this.allowedPriorities = ['HIGH', 'MEDIUM', 'LOW'];
    this.allowedPickupTypes = ['outlet', 'warehouse', 'hub', 'depot', 'store'];
    this.allowedDeliveryTypes = ['delivery', 'pickup'];
    this.allowedVehicleStatuses = ['AVAILABLE', 'UNAVAILABLE', 'DELIVERING', 'RETURNING'];
    this.allowedWeatherConditions = ['sunny', 'rainy', 'cloudy', 'snowy', 'normal'];
    this.allowedTrafficData = ['light', 'medium', 'heavy', 'normal'];

    // Define validation constraints
    this.maxPoints = 500; // Maximum number of pickup or delivery points
  }

  /**
   * Sanitize a request object
   * @param {Object} request - The request object to sanitize
   * @returns {Object} - Sanitized request object
   * @throws {ValidationError} - If validation fails
   */
  sanitize(request) {
    try {
      // Validate overall structure
      this.validateStructure(request);

      // Sanitize individual components
      const sanitized = {
        pickupPoints: this.sanitizePickupPoints(request.pickupPoints),
        deliveryPoints: this.sanitizeDeliveryPoints(request.deliveryPoints),
        fleet: this.sanitizeFleet(request.fleet),
        businessRules: this.sanitizeBusinessRules(request.businessRules),
        preferences: this.sanitizePreferences(request.preferences),
        context: this.sanitizeContext(request.context),
      };

      // Add prompt if it exists
      if (request.prompt) {
        sanitized.prompt = this.sanitizeString(request.prompt, '').substring(0, 500);
      }

      return sanitized;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ValidationError(`Request sanitization failed: ${error.message}`);
    }
  }

  /**
   * Validate the overall structure of a request
   * @param {Object} request - The request to validate
   * @throws {ValidationError} - If validation fails
   */
  validateStructure(request) {
    if (!request) {
      throw new ValidationError('Request body is missing');
    }

    if (
      !request.pickupPoints ||
      !Array.isArray(request.pickupPoints) ||
      request.pickupPoints.length < 1
    ) {
      throw new ValidationError('At least one pickup point is required');
    }

    if (
      !request.deliveryPoints ||
      !Array.isArray(request.deliveryPoints) ||
      request.deliveryPoints.length < 1
    ) {
      throw new ValidationError('At least one delivery point is required');
    }

    if (!request.fleet || !Array.isArray(request.fleet) || request.fleet.length < 1) {
      throw new ValidationError('At least one vehicle in the fleet is required');
    }
  }

  /**
   * Sanitize pickup points
   * @param {Array} points - Array of pickup points
   * @returns {Array} - Sanitized pickup points
   * @throws {ValidationError} - If validation fails
   */
  sanitizePickupPoints(points) {
    if (!points || !Array.isArray(points)) {
      throw new ValidationError('Pickup points must be an array');
    }

    if (points.length > this.maxPoints) {
      throw new ValidationError(`Too many pickup points (maximum: ${this.maxPoints})`);
    }

    return this.sanitizeArray(points).map((point) => {
      if (!point.lat || !point.lng) {
        throw new ValidationError('Pickup point missing coordinates');
      }

      if (!point.name) {
        throw new ValidationError('Pickup point missing name');
      }

      const sanitizedPoint = {
        lat: this.sanitizeCoordinate(point.lat),
        lng: this.sanitizeCoordinate(point.lng),
        type: this.sanitizeString(point.type, 'outlet'),
        name: this.sanitizeString(point.name),
        working_hours: point.working_hours || {
          sun: '09:00-17:00',
          mon: '09:00-17:00',
          tue: '09:00-17:00',
          wed: '09:00-17:00',
          thu: '09:00-17:00',
          fri: '09:00-17:00',
          sat: '09:00-17:00',
        },
      };

      // Sanitize working hours
      sanitizedPoint.working_hours = this.sanitizeWorkingHours(sanitizedPoint.working_hours);

      // Ensure type is valid
      if (!this.allowedPickupTypes.includes(sanitizedPoint.type)) {
        sanitizedPoint.type = 'outlet';
      }

      return sanitizedPoint;
    });
  }

  /**
   * Sanitize delivery points
   * @param {Array} points - Array of delivery points
   * @returns {Array} - Sanitized delivery points
   * @throws {ValidationError} - If validation fails
   */
  sanitizeDeliveryPoints(points) {
    if (!points || !Array.isArray(points)) {
      throw new ValidationError('Delivery points must be an array');
    }

    if (points.length > this.maxPoints) {
      throw new ValidationError(`Too many delivery points (maximum: ${this.maxPoints})`);
    }

    return this.sanitizeArray(points).map((point) => {
      if (!point.lat || !point.lng) {
        throw new ValidationError('Delivery point missing coordinates');
      }

      if (!point.order_id) {
        throw new ValidationError('Delivery point missing order_id');
      }

      if (!point.customer_name) {
        throw new ValidationError('Delivery point missing customer_name');
      }

      const sanitizedPoint = {
        lat: this.sanitizeCoordinate(point.lat),
        lng: this.sanitizeCoordinate(point.lng),
        type: this.sanitizeString(point.type, 'delivery'),
        order_id: this.sanitizeString(point.order_id),
        customer_name: this.sanitizeString(point.customer_name),
        load_kg: this.sanitizeNumber(point.load_kg, 0, 10000, 0),
        time_window: this.sanitizeTimeWindow(point.time_window || '09:00-17:00'),
        priority: this.sanitizePriority(point.priority || 'MEDIUM'),
      };

      // Ensure type is valid
      if (!this.allowedDeliveryTypes.includes(sanitizedPoint.type)) {
        sanitizedPoint.type = 'delivery';
      }

      return sanitizedPoint;
    });
  }

  /**
   * Sanitize fleet
   * @param {Array} fleet - Array of vehicles
   * @returns {Array} - Sanitized fleet
   * @throws {ValidationError} - If validation fails
   */
  sanitizeFleet(fleet) {
    if (!fleet || !Array.isArray(fleet)) {
      throw new ValidationError('Fleet must be an array');
    }

    if (fleet.length < 1) {
      throw new ValidationError('At least one vehicle in the fleet is required');
    }

    return this.sanitizeArray(fleet).map((vehicle) => {
      if (!vehicle.fleet_id) {
        throw new ValidationError('Vehicle missing fleet_id');
      }

      if (
        !this.isValidCoordinate(vehicle.current_latitude) ||
        !this.isValidCoordinate(vehicle.current_longitude)
      ) {
        throw new ValidationError('Vehicle missing valid coordinates');
      }

      const sanitizedVehicle = {
        fleet_id: this.sanitizeString(vehicle.fleet_id),
        vehicle_type: this.sanitizeVehicleType(vehicle.vehicle_type || 'TRUCK'),
        capacity_kg: this.sanitizeNumber(vehicle.capacity_kg, 0, 50000, 1000),
        current_latitude: this.sanitizeCoordinate(vehicle.current_latitude),
        current_longitude: this.sanitizeCoordinate(vehicle.current_longitude),
        outlet_id: this.sanitizeNumber(vehicle.outlet_id, 1, 1000000, 1),
        status: this.sanitizeVehicleStatus(vehicle.status || 'AVAILABLE'),
      };

      return sanitizedVehicle;
    });
  }

  /**
   * Sanitize business rules
   * @param {Object} rules - Business rules
   * @returns {Object} - Sanitized business rules
   */
  sanitizeBusinessRules(rules) {
    if (!rules || typeof rules !== 'object') {
      return {
        maxDriverHours: 8,
        restPeriodMinutes: 30,
        maxConsecutiveDriveTime: 4,
        allowedZones: [],
        restrictedAreas: [],
      };
    }

    return {
      maxDriverHours: this.sanitizeNumber(rules.maxDriverHours, 1, 24, 8),
      restPeriodMinutes: this.sanitizeNumber(rules.restPeriodMinutes, 0, 120, 30),
      maxConsecutiveDriveTime: this.sanitizeNumber(rules.maxConsecutiveDriveTime, 1, 12, 4),
      allowedZones: this.sanitizeAreaDefinitions(rules.allowedZones || []),
      restrictedAreas: this.sanitizeRestrictedAreas(rules.restrictedAreas || []),
    };
  }

  /**
   * Sanitize preferences
   * @param {Object} preferences - Preferences
   * @returns {Object} - Sanitized preferences
   */
  sanitizePreferences(preferences) {
    if (!preferences || typeof preferences !== 'object') {
      return {
        sustainabilityScore: 0.5,
        costScore: 0.5,
        serviceScore: 0.5,
      };
    }

    return {
      sustainabilityScore: this.sanitizeNumber(preferences.sustainabilityScore, 0, 1, 0.5),
      costScore: this.sanitizeNumber(preferences.costScore, 0, 1, 0.5),
      serviceScore: this.sanitizeNumber(preferences.serviceScore, 0, 1, 0.5),
    };
  }

  /**
   * Sanitize context
   * @param {Object} context - Context
   * @returns {Object} - Sanitized context
   */
  sanitizeContext(context) {
    if (!context || typeof context !== 'object') {
      return {
        weatherConditions: 'normal',
        trafficData: 'normal',
        specialEvents: [],
        historicalData: false,
      };
    }

    return {
      weatherConditions: this.sanitizeWeatherCondition(context.weatherConditions || 'normal'),
      trafficData: this.sanitizeTrafficData(context.trafficData || 'normal'),
      specialEvents: Array.isArray(context.specialEvents)
        ? context.specialEvents.map((event) => this.sanitizeString(event))
        : [],
      historicalData: !!context.historicalData,
    };
  }

  /**
   * Check if a coordinate is valid
   * @param {number} coord - Coordinate to check
   * @returns {boolean} - Whether the coordinate is valid
   */
  isValidCoordinate(coord) {
    return typeof coord === 'number' && !isNaN(coord) && isFinite(coord);
  }

  /**
   * Sanitize a string value
   * @param {string} value - Value to sanitize
   * @param {string} defaultValue - Default value if invalid
   * @returns {string} - Sanitized string
   */
  sanitizeString(value, defaultValue = '') {
    return value && typeof value === 'string' ? value.trim() : defaultValue;
  }

  /**
   * Sanitize a numeric value
   * @param {number} value - Value to sanitize
   * @param {number} min - Minimum allowed value
   * @param {number} max - Maximum allowed value
   * @param {number} defaultValue - Default value if invalid
   * @returns {number} - Sanitized number
   */
  sanitizeNumber(value, min, max, defaultValue = min) {
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) return defaultValue;
    return Math.max(min, Math.min(max, num));
  }

  /**
   * Sanitize a coordinate
   * @param {number} value - Coordinate to sanitize
   * @returns {number} - Sanitized coordinate
   * @throws {ValidationError} - If coordinate is invalid
   */
  sanitizeCoordinate(value) {
    if (!this.isValidCoordinate(value)) {
      throw new ValidationError(`Invalid coordinate: ${value}`);
    }

    return Number(value);
  }

  /**
   * Sanitize a time window
   * @param {string} timeWindow - Time window to sanitize
   * @returns {string} - Sanitized time window
   */
  sanitizeTimeWindow(timeWindow) {
    const timeWindowRegex = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;

    if (!timeWindow || typeof timeWindow !== 'string' || !timeWindowRegex.test(timeWindow)) {
      return '09:00-17:00';
    }

    return timeWindow;
  }

  /**
   * Sanitize a priority value
   * @param {string} priority - Priority to sanitize
   * @returns {string} - Sanitized priority
   */
  sanitizePriority(priority) {
    return this.allowedPriorities.includes(priority) ? priority : 'MEDIUM';
  }

  /**
   * Sanitize a vehicle type
   * @param {string} type - Vehicle type to sanitize
   * @returns {string} - Sanitized vehicle type
   */
  sanitizeVehicleType(type) {
    return this.allowedVehicleTypes.includes(type) ? type : 'TRUCK';
  }

  /**
   * Sanitize a vehicle status
   * @param {string} status - Vehicle status to sanitize
   * @returns {string} - Sanitized vehicle status
   */
  sanitizeVehicleStatus(status) {
    return this.allowedVehicleStatuses.includes(status) ? status : 'AVAILABLE';
  }

  /**
   * Sanitize a weather condition
   * @param {string} condition - Weather condition to sanitize
   * @returns {string} - Sanitized weather condition
   */
  sanitizeWeatherCondition(condition) {
    return this.allowedWeatherConditions.includes(condition) ? condition : 'normal';
  }

  /**
   * Sanitize traffic data
   * @param {string} traffic - Traffic data to sanitize
   * @returns {string} - Sanitized traffic data
   */
  sanitizeTrafficData(traffic) {
    return this.allowedTrafficData.includes(traffic) ? traffic : 'normal';
  }

  /**
   * Sanitize working hours
   * @param {Object} hours - Working hours to sanitize
   * @returns {Object} - Sanitized working hours
   */
  sanitizeWorkingHours(hours) {
    if (!hours || typeof hours !== 'object') {
      return {
        sun: '09:00-17:00',
        mon: '09:00-17:00',
        tue: '09:00-17:00',
        wed: '09:00-17:00',
        thu: '09:00-17:00',
        fri: '09:00-17:00',
        sat: '09:00-17:00',
      };
    }

    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const result = {};

    days.forEach((day) => {
      const value = hours[day];

      if (value === 'closed') {
        result[day] = 'closed';
      } else {
        result[day] = this.sanitizeTimeWindow(value);
      }
    });

    return result;
  }

  /**
   * Sanitize an array
   * @param {Array} array - Array to sanitize
   * @param {number} maxLength - Maximum allowed length
   * @returns {Array} - Sanitized array
   */
  sanitizeArray(array) {
    if (!array || !Array.isArray(array)) {
      return [];
    }

    // Filter out null or undefined items
    return array.filter((item) => item != null);
  }

  /**
   * Sanitize area definitions
   * @param {Array} areas - Area definitions to sanitize
   * @returns {Array} - Sanitized area definitions
   */
  sanitizeAreaDefinitions(areas) {
    if (!areas || !Array.isArray(areas)) {
      return [];
    }

    return this.sanitizeArray(areas)
      .map((area) => {
        // Handle string values (legacy format)
        if (typeof area === 'string') {
          return this.sanitizeString(area);
        }

        // Handle object format with id, name, area
        if (area && typeof area === 'object') {
          if (!area.id || !area.name || !area.area) {
            throw new ValidationError('Area definition must have id, name, and area properties');
          }

          return {
            id: this.sanitizeString(area.id),
            name: this.sanitizeString(area.name),
            area: Array.isArray(area.area)
              ? area.area.map((point) => {
                  if (!Array.isArray(point) || point.length !== 2) {
                    throw new ValidationError('Invalid area point');
                  }
                  return [this.sanitizeCoordinate(point[0]), this.sanitizeCoordinate(point[1])];
                })
              : [],
            ...(area.timeRestriction
              ? { timeRestriction: this.sanitizeTimeWindow(area.timeRestriction) }
              : {}),
          };
        }

        return null;
      })
      .filter((area) => area !== null);
  }

  /**
   * Sanitize restricted areas
   * @param {Array} areas - Restricted areas to sanitize
   * @returns {Array} - Sanitized restricted areas
   */
  sanitizeRestrictedAreas(areas) {
    if (!areas || !Array.isArray(areas)) {
      return [];
    }

    return this.sanitizeArray(areas)
      .map((area) => {
        // Handle new format (area definition)
        if (area && typeof area === 'object' && area.id && area.name && area.area) {
          return {
            id: this.sanitizeString(area.id),
            name: this.sanitizeString(area.name),
            area: Array.isArray(area.area)
              ? area.area.map((point) => {
                  if (!Array.isArray(point) || point.length !== 2) {
                    throw new ValidationError('Invalid area point');
                  }
                  return [this.sanitizeCoordinate(point[0]), this.sanitizeCoordinate(point[1])];
                })
              : [],
            timeRestriction: this.sanitizeTimeWindow(area.timeRestriction || '00:00-23:59'),
          };
        }

        // Handle legacy format (polygon)
        if (area && area.polygon && Array.isArray(area.polygon) && area.polygon.length >= 3) {
          return {
            id: `restricted-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: 'Restricted Area',
            area: area.polygon.map((point) => {
              if (!Array.isArray(point) || point.length !== 2) {
                throw new ValidationError('Invalid polygon point');
              }
              return [this.sanitizeCoordinate(point[0]), this.sanitizeCoordinate(point[1])];
            }),
            timeRestriction: this.sanitizeTimeWindow(area.timeRestriction || '00:00-23:59'),
          };
        }

        return null;
      })
      .filter((area) => area !== null);
  }
}

module.exports = {
  RequestSanitizer,
  ValidationError,
};
