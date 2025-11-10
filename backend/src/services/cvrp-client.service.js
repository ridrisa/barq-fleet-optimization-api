/**
 * CVRP Client Service
 * Node.js client for Python OR-Tools CVRP optimization service
 * Provides integration between Node.js backend and Python microservice
 *
 * Features:
 * - Circuit breaker pattern for fault tolerance
 * - Retry logic with exponential backoff
 * - Comprehensive error handling
 */

const axios = require('axios');
const { logger } = require('../utils/logger');

class CVRPClientService {
  constructor() {
    this.pythonServiceUrl = process.env.CVRP_SERVICE_URL || 'http://localhost:5001';
    this.timeout = 30000; // 30 seconds
    this.maxRetries = parseInt(process.env.CVRP_MAX_RETRIES) || 2;
    this.retryDelay = parseInt(process.env.CVRP_RETRY_DELAY) || 1000; // 1 second

    // Circuit breaker state
    this.circuitBreaker = {
      failures: 0,
      maxFailures: parseInt(process.env.CVRP_CB_MAX_FAILURES) || 5,
      resetTimeout: parseInt(process.env.CVRP_CB_RESET_TIMEOUT) || 60000, // 1 minute
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      lastFailureTime: null,
      successCount: 0,
    };

    logger.info(`CVRP Client initialized: ${this.pythonServiceUrl}`, {
      maxRetries: this.maxRetries,
      circuitBreakerMaxFailures: this.circuitBreaker.maxFailures,
    });
  }

  /**
   * Circuit breaker check before making request
   */
  canMakeRequest() {
    const cb = this.circuitBreaker;

    if (cb.state === 'OPEN') {
      // Check if enough time has passed to try again
      const timeSinceFailure = Date.now() - cb.lastFailureTime;
      if (timeSinceFailure >= cb.resetTimeout) {
        logger.info('Circuit breaker moving to HALF_OPEN state');
        cb.state = 'HALF_OPEN';
        cb.successCount = 0;
        return true;
      }

      logger.warn('Circuit breaker is OPEN, rejecting request');
      return false;
    }

    return true;
  }

  /**
   * Record request success for circuit breaker
   */
  recordSuccess() {
    const cb = this.circuitBreaker;

    if (cb.state === 'HALF_OPEN') {
      cb.successCount++;
      if (cb.successCount >= 2) {
        logger.info('Circuit breaker moving to CLOSED state after successful requests');
        cb.state = 'CLOSED';
        cb.failures = 0;
        cb.successCount = 0;
      }
    } else if (cb.state === 'CLOSED') {
      // Reset failure count on success
      if (cb.failures > 0) {
        cb.failures = Math.max(0, cb.failures - 1);
      }
    }
  }

  /**
   * Record request failure for circuit breaker
   */
  recordFailure() {
    const cb = this.circuitBreaker;
    cb.failures++;
    cb.lastFailureTime = Date.now();

    if (cb.failures >= cb.maxFailures && cb.state !== 'OPEN') {
      logger.error(`Circuit breaker opening after ${cb.failures} failures`);
      cb.state = 'OPEN';
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  async retryWithBackoff(fn, maxRetries = this.maxRetries) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Check circuit breaker
        if (!this.canMakeRequest()) {
          throw new Error('Circuit breaker is OPEN');
        }

        const result = await fn();

        // Record success for circuit breaker
        this.recordSuccess();

        return result;
      } catch (error) {
        lastError = error;

        // Record failure for circuit breaker
        if (error.message !== 'Circuit breaker is OPEN') {
          this.recordFailure();
        }

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s, etc.
          const delay = this.retryDelay * Math.pow(2, attempt);
          logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, {
            error: error.message,
          });

          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if Python service is healthy
   */
  async healthCheck() {
    try {
      // Don't use retry for health checks
      const response = await axios.get(`${this.pythonServiceUrl}/health`, {
        timeout: 5000,
      });

      return {
        healthy: response.status === 200,
        data: response.data,
        circuitBreaker: {
          state: this.circuitBreaker.state,
          failures: this.circuitBreaker.failures,
        },
      };
    } catch (error) {
      logger.error(`CVRP service health check failed: ${error.message}`);
      return {
        healthy: false,
        error: error.message,
        circuitBreaker: {
          state: this.circuitBreaker.state,
          failures: this.circuitBreaker.failures,
        },
      };
    }
  }

  /**
   * Optimize routes using CVRP with distance matrix
   *
   * @param {Array<Array<number>>} distanceMatrix - 2D array of distances
   * @param {Array<number>} demands - Demand at each location
   * @param {Array<number>} vehicleCapacities - Capacity of each vehicle
   * @param {number} numVehicles - Number of vehicles
   * @param {number} depot - Depot location index (default: 0)
   * @param {number} timeLimit - Max solve time in seconds (default: 5)
   * @returns {Promise<Object>} Optimization result
   */
  async optimizeWithMatrix(
    distanceMatrix,
    demands,
    vehicleCapacities,
    numVehicles,
    depot = 0,
    timeLimit = 5
  ) {
    return this.retryWithBackoff(async () => {
      logger.info(
        `Calling CVRP service: ${distanceMatrix.length - 1} locations, ${numVehicles} vehicles`
      );

      const response = await axios.post(
        `${this.pythonServiceUrl}/api/optimize/cvrp`,
        {
          distance_matrix: distanceMatrix,
          demands: demands,
          vehicle_capacities: vehicleCapacities,
          num_vehicles: numVehicles,
          depot: depot,
          time_limit: timeLimit,
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        logger.info(
          `CVRP optimization successful: ${response.data.routes.length} routes, total distance: ${response.data.summary.total_distance}m`
        );
      }

      return response.data;
    }).catch((error) => {
      logger.error(`CVRP optimization failed after retries: ${error.message}`);

      if (error.response) {
        return {
          success: false,
          error: error.response.data.error || error.message,
        };
      }

      return {
        success: false,
        error: error.message,
        fallback: true,
      };
    });
  }

  /**
   * Optimize routes with location coordinates (auto-generates distance matrix)
   *
   * @param {Object} depot - Depot location {lat, lng}
   * @param {Array<Object>} locations - Delivery locations [{id, lat, lng, demand}, ...]
   * @param {Array<Object>} vehicles - Vehicle fleet [{id, capacity}, ...]
   * @param {number} timeLimit - Max solve time in seconds
   * @returns {Promise<Object>} Optimization result
   */
  async optimizeBatch(depot, locations, vehicles, timeLimit = 5) {
    return this.retryWithBackoff(async () => {
      logger.info(
        `Calling CVRP batch optimization: ${locations.length} locations, ${vehicles.length} vehicles`
      );

      const response = await axios.post(
        `${this.pythonServiceUrl}/api/optimize/batch`,
        {
          depot: depot,
          locations: locations,
          vehicles: vehicles,
          time_limit: timeLimit,
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        logger.info(`CVRP batch optimization successful: ${response.data.routes.length} routes`);
      }

      return response.data;
    }).catch((error) => {
      logger.error(`CVRP batch optimization failed after retries: ${error.message}`);

      if (error.response) {
        return {
          success: false,
          error: error.response.data.error || error.message,
        };
      }

      return {
        success: false,
        error: error.message,
        fallback: true,
      };
    });
  }

  /**
   * Optimize BARQ fleet deliveries using CVRP
   * Converts BARQ data structure to CVRP format
   *
   * @param {Object} request - BARQ optimization request
   * @returns {Promise<Object>} Optimization result in BARQ format
   */
  async optimizeBarqDeliveries(request) {
    try {
      const { pickupPoints, deliveryPoints, fleet } = request;

      // Validate inputs
      if (!pickupPoints || pickupPoints.length === 0) {
        throw new Error('No pickup points provided');
      }

      if (!deliveryPoints || deliveryPoints.length === 0) {
        throw new Error('No delivery points provided');
      }

      if (!fleet || fleet.length === 0) {
        throw new Error('No fleet vehicles provided');
      }

      // Use first pickup as depot
      const depot = {
        lat: pickupPoints[0].lat,
        lng: pickupPoints[0].lng,
      };

      // Prepare locations (deliveries only for now)
      const locations = deliveryPoints.map((delivery) => ({
        id: delivery.order_id,
        lat: delivery.lat,
        lng: delivery.lng,
        demand: delivery.load_kg || 1, // Use weight or default to 1 parcel
        customer_name: delivery.customer_name,
      }));

      // Prepare vehicles
      const vehicles = fleet.map((vehicle) => ({
        id: vehicle.fleet_id || vehicle.id,
        capacity: vehicle.capacity_kg || 3000, // Default 3000kg capacity
      }));

      // Call batch optimization with retry logic
      const result = await this.optimizeBatch(depot, locations, vehicles, 10);

      if (!result.success) {
        return result;
      }

      // Convert result to BARQ format
      return this.convertToBARQFormat(result, pickupPoints[0], deliveryPoints, fleet);
    } catch (error) {
      logger.error(`BARQ CVRP optimization failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Convert CVRP result to BARQ route format
   */
  convertToBARQFormat(cvrpResult, pickup, deliveryPoints, fleet) {
    const routes = cvrpResult.routes
      .filter((route) => route.stops.length > 2) // Only routes with actual deliveries
      .map((route) => {
        const vehicle = fleet[route.vehicle_id] || fleet[0];

        // Build stops (pickup -> deliveries -> return to pickup)
        const stops = route.stops.map((stop, index) => {
          if (stop.location_index === 0) {
            // Depot/pickup point
            return {
              type: index === 0 ? 'pickup' : 'return',
              location: {
                latitude: pickup.lat,
                longitude: pickup.lng,
              },
              name: pickup.name || 'Pickup Point',
              cumulative_load: stop.cumulative_load,
            };
          } else {
            // Delivery point
            return {
              type: 'delivery',
              location: {
                latitude: stop.location.lat,
                longitude: stop.location.lng,
              },
              name: stop.name || stop.location_id,
              order_id: stop.location_id,
              cumulative_load: stop.cumulative_load,
              demand: stop.demand,
            };
          }
        });

        return {
          id: `cvrp-route-${route.vehicle_id}`,
          vehicle: {
            fleet_id: vehicle.fleet_id || vehicle.id,
            vehicle_type: vehicle.vehicle_type || vehicle.type || 'TRUCK',
            capacity_kg: vehicle.capacity_kg || 3000,
          },
          stops: stops,
          distance: route.total_distance / 1000, // Convert to km
          duration: Math.round((route.total_distance / 1000) * 3), // Estimate: 3 min/km
          load_kg: route.total_load,
          capacity_utilization: route.capacity_utilization,
          optimization_method: 'OR-Tools CVRP',
        };
      });

    return {
      success: true,
      routes: routes,
      summary: {
        total_routes: routes.length,
        total_distance: cvrpResult.summary.total_distance / 1000, // Convert to km
        total_duration: Math.round((cvrpResult.summary.total_distance / 1000) * 3),
        total_deliveries: deliveryPoints.length,
        total_load: cvrpResult.summary.total_load,
        average_route_distance: cvrpResult.summary.average_route_distance / 1000,
        average_load_per_vehicle: cvrpResult.summary.average_load_per_vehicle,
      },
      optimization_metadata: {
        ...cvrpResult.optimization_metadata,
        service: 'Python OR-Tools CVRP',
        fair_distribution: true,
      },
    };
  }

  /**
   * Build distance matrix from coordinates using OSRM
   * (for higher accuracy than Haversine)
   *
   * @param {Array<Object>} locations - Array of {lat, lng} objects
   * @returns {Promise<Array<Array<number>>>} Distance matrix
   */
  async buildDistanceMatrixOSRM(locations) {
    try {
      const osrmBaseUrl = process.env.OSRM_BASE_URL || 'http://router.project-osrm.org';

      // Format coordinates for OSRM table service
      const coordinates = locations.map((loc) => `${loc.lng},${loc.lat}`).join(';');

      const url = `${osrmBaseUrl}/table/v1/driving/${coordinates}?annotations=distance`;

      logger.info(`Building distance matrix for ${locations.length} locations using OSRM`);

      const response = await axios.get(url, { timeout: 30000 });

      if (response.data.code !== 'Ok') {
        throw new Error(`OSRM error: ${response.data.message}`);
      }

      // OSRM returns distance matrix in meters
      const distanceMatrix = response.data.distances.map((row) =>
        row.map((distance) => Math.round(distance))
      );

      logger.info(
        `Distance matrix built successfully: ${distanceMatrix.length}x${distanceMatrix[0].length}`
      );

      return distanceMatrix;
    } catch (error) {
      logger.error(`Failed to build distance matrix with OSRM: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return {
      state: this.circuitBreaker.state,
      failures: this.circuitBreaker.failures,
      maxFailures: this.circuitBreaker.maxFailures,
      successCount: this.circuitBreaker.successCount,
      lastFailureTime: this.circuitBreaker.lastFailureTime,
    };
  }

  /**
   * Reset circuit breaker manually
   */
  resetCircuitBreaker() {
    logger.info('Manually resetting circuit breaker');
    this.circuitBreaker.state = 'CLOSED';
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.successCount = 0;
    this.circuitBreaker.lastFailureTime = null;
  }
}

// Export singleton instance
module.exports = new CVRPClientService();
