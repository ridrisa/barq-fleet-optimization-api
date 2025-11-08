/**
 * OSRM Service (Production Implementation)
 * Production-ready route calculation using OSRM API
 * Includes retry logic, caching, and fallback to straight-line distance
 */

const axios = require('axios');
const { logger } = require('../utils/logger');
const { osrmConfig, buildOsrmUrl } = require('../config/osrm.config');

class OSRMService {
  constructor() {
    this.baseUrl = osrmConfig.baseUrl;
    this.timeout = osrmConfig.timeout;
    this.cache = new Map(); // Simple cache for route calculations
    this.useFallback = false;

    // Configure axios instance
    this.axios = axios.create({
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Test OSRM connection
    this.testConnection();

    logger.info('[OSRM] Production service initialized', { baseUrl: this.baseUrl });
  }

  /**
   * Test OSRM connection
   */
  async testConnection() {
    try {
      const testCoords = [
        [51.5074, -0.1278], // London
        [51.5155, -0.0922], // Near London
      ];
      const url = buildOsrmUrl('route', 'car', testCoords, { overview: 'false' });
      await this.axios.get(url, { timeout: 3000 });
      logger.info('[OSRM] Connection test successful');
    } catch (error) {
      logger.warn('[OSRM] Connection test failed, will use fallback', {
        error: error.message,
      });
      this.useFallback = true;
    }
  }

  /**
   * Calculate optimized route between waypoints
   * @param {Array} waypoints - Array of {lat, lng} coordinates
   * @param {Object} options - Route calculation options
   * @returns {Object} Route information
   */
  async calculateOptimizedRoute(waypoints, options = {}) {
    try {
      if (!waypoints || waypoints.length < 2) {
        throw new Error('At least 2 waypoints are required');
      }

      // Use fallback if OSRM is unavailable
      if (this.useFallback) {
        logger.debug('[OSRM] Using fallback calculation');
        return this._fallbackCalculateRoute(waypoints);
      }

      // Create cache key
      const cacheKey = this._createCacheKey(waypoints, options);
      if (this.cache.has(cacheKey)) {
        logger.debug('[OSRM] Returning cached route');
        return this.cache.get(cacheKey);
      }

      // Convert waypoints to OSRM coordinate format [lat, lng]
      const coordinates = waypoints.map((wp) => [wp.lat, wp.lng]);

      // Build OSRM URL
      const profile = options.profile || 'car';
      const url = buildOsrmUrl('route', profile, coordinates, {
        overview: options.overview || 'full',
        alternatives: options.alternatives !== false,
        steps: options.steps !== false,
        annotations: options.annotations !== false,
      });

      // Make request with retry logic
      const result = await this._retryRequest(url, 3);

      // Cache the result (expire after 5 minutes)
      this.cache.set(cacheKey, result);
      setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);

      return result;
    } catch (error) {
      logger.error('[OSRM] Route calculation failed', {
        error: error.message,
        waypoints: waypoints.length,
      });

      // Fallback to straight-line calculation
      logger.warn('[OSRM] Falling back to straight-line calculation');
      return this._fallbackCalculateRoute(waypoints);
    }
  }

  /**
   * Calculate distance matrix between multiple points
   * @param {Array} sources - Source coordinates
   * @param {Array} destinations - Destination coordinates
   * @returns {Object} Distance matrix
   */
  async calculateDistanceMatrix(sources, destinations) {
    try {
      if (this.useFallback) {
        return this._fallbackCalculateMatrix(sources, destinations);
      }

      // Combine sources and destinations for OSRM table request
      const coordinates = [...sources, ...destinations].map((coord) => [coord.lat, coord.lng]);

      const profile = 'car';
      const url = buildOsrmUrl('table', profile, coordinates, {
        sources: sources.map((_, i) => i).join(';'),
        destinations: destinations.map((_, i) => sources.length + i).join(';'),
      });

      const result = await this._retryRequest(url, 3);
      return result;
    } catch (error) {
      logger.error('[OSRM] Distance matrix calculation failed', {
        error: error.message,
      });
      return this._fallbackCalculateMatrix(sources, destinations);
    }
  }

  /**
   * Retry HTTP request with exponential backoff
   * @private
   */
  async _retryRequest(url, maxRetries = 3) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.axios.get(url);

        if (response.data.code !== 'Ok') {
          throw new Error(`OSRM returned code: ${response.data.code}`);
        }

        return response.data;
      } catch (error) {
        lastError = error;
        const delay = Math.pow(2, attempt) * 100; // 100ms, 200ms, 400ms

        if (attempt < maxRetries - 1) {
          logger.warn(`[OSRM] Request failed, retrying in ${delay}ms`, {
            attempt: attempt + 1,
            maxRetries,
            error: error.message,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Create cache key from waypoints and options
   * @private
   */
  _createCacheKey(waypoints, options) {
    const wpKey = waypoints.map((wp) => `${wp.lat},${wp.lng}`).join('|');
    const optKey = JSON.stringify(options);
    return `${wpKey}:${optKey}`;
  }

  /**
   * Fallback route calculation using straight-line distance
   * @private
   */
  _fallbackCalculateRoute(waypoints) {
    const distance = this._calculateTotalDistance(waypoints);
    const duration = (distance / 40) * 3600; // Assume 40 km/h average speed

    return {
      code: 'Ok',
      routes: [
        {
          distance: distance * 1000, // Convert to meters
          duration: duration, // In seconds
          geometry: this._createSimpleGeometry(waypoints),
          legs: this._createLegs(waypoints),
          weight: duration,
          weight_name: 'routability',
        },
      ],
      waypoints: waypoints.map((wp, index) => ({
        hint: '',
        distance: 0,
        name: `Stop ${index + 1}`,
        location: [wp.lng, wp.lat],
      })),
    };
  }

  /**
   * Fallback distance matrix calculation
   * @private
   */
  _fallbackCalculateMatrix(sources, destinations) {
    const durations = [];
    const distances = [];

    for (const source of sources) {
      const durationRow = [];
      const distanceRow = [];

      for (const dest of destinations) {
        const distance = this._haversineDistance(source.lat, source.lng, dest.lat, dest.lng);
        const duration = (distance / 40) * 3600;

        durationRow.push(duration);
        distanceRow.push(distance * 1000);
      }

      durations.push(durationRow);
      distances.push(distanceRow);
    }

    return {
      code: 'Ok',
      durations,
      distances,
      sources: sources.map((s, i) => ({
        hint: '',
        distance: 0,
        name: `Source ${i + 1}`,
        location: [s.lng, s.lat],
      })),
      destinations: destinations.map((d, i) => ({
        hint: '',
        distance: 0,
        name: `Destination ${i + 1}`,
        location: [d.lng, d.lat],
      })),
    };
  }

  /**
   * Calculate straight-line distance between waypoints (Haversine formula)
   * @private
   */
  _calculateTotalDistance(waypoints) {
    let totalDistance = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];
      totalDistance += this._haversineDistance(from.lat, from.lng, to.lat, to.lng);
    }

    return totalDistance;
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @private
   */
  _haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this._toRadians(lat2 - lat1);
    const dLon = this._toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this._toRadians(lat1)) *
        Math.cos(this._toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   * @private
   */
  _toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Create simple polyline geometry from waypoints
   * @private
   */
  _createSimpleGeometry(waypoints) {
    // Simple polyline - in production, use actual OSRM polyline encoding
    return waypoints.map((wp) => [wp.lng, wp.lat]);
  }

  /**
   * Create route legs between waypoints
   * @private
   */
  _createLegs(waypoints) {
    const legs = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];
      const distance = this._haversineDistance(from.lat, from.lng, to.lat, to.lng);
      const duration = (distance / 40) * 3600; // 40 km/h average

      legs.push({
        distance: distance * 1000,
        duration: duration,
        steps: [],
        summary: `From Stop ${i + 1} to Stop ${i + 2}`,
        weight: duration,
      });
    }

    return legs;
  }

}

// Export singleton instance
module.exports = new OSRMService();
