/**
 * Hybrid Optimization Service
 * Intelligently routes requests between CVRP (OR-Tools) and current OSRM-based optimization
 *
 * Decision Logic:
 * - CVRP: For BULLET service, 10+ deliveries, capacity-critical scenarios
 * - OSRM: For BARQ service, <10 deliveries, real-time urgent scenarios
 */

const cvrpClient = require('./cvrp-client.service');
const enhancedCvrpOptimizer = require('./enhanced-cvrp-optimizer.service');
const { logger } = require('../utils/logger');

class HybridOptimizationService {
  constructor() {
    this.cvrpEnabled = process.env.CVRP_ENABLED !== 'false'; // Enabled by default
    this.cvrpMinDeliveries = parseInt(process.env.CVRP_MIN_DELIVERIES) || 10;
    this.cvrpServiceUrl = process.env.CVRP_SERVICE_URL || 'http://localhost:5001';

    logger.info('Hybrid Optimization Service initialized', {
      cvrpEnabled: this.cvrpEnabled,
      cvrpMinDeliveries: this.cvrpMinDeliveries,
      cvrpServiceUrl: this.cvrpServiceUrl,
    });
  }

  /**
   * Decide which optimization engine to use
   *
   * @param {Object} request - Optimization request
   * @returns {Object} - Decision with engine and reason
   */
  async decideOptimizationEngine(request) {
    const deliveryCount = request.deliveryPoints?.length || 0;
    const serviceType = request.serviceType || request.context?.serviceType;
    const useCVRP = request.preferences?.useCVRP;
    const fairDistribution = request.preferences?.fairDistribution;

    // Force CVRP if explicitly requested AND service is healthy
    if (useCVRP === true) {
      try {
        const health = await cvrpClient.healthCheck();
        if (health.healthy) {
          return {
            engine: 'CVRP',
            reason: 'Explicitly requested via preferences.useCVRP',
          };
        } else {
          console.warn('CVRP explicitly requested but service unhealthy, using OSRM');
        }
      } catch (error) {
        console.warn('CVRP health check failed, using OSRM:', error.message);
      }
    }

    // Disable CVRP if explicitly disabled
    if (useCVRP === false || !this.cvrpEnabled) {
      return {
        engine: 'OSRM',
        reason: 'CVRP disabled or not requested',
      };
    }

    // Only use CVRP for large batches if service is healthy
    if (deliveryCount >= 50) {
      // Increased threshold to reduce CVRP usage
      try {
        const health = await cvrpClient.healthCheck();
        if (health.healthy) {
          return {
            engine: 'CVRP',
            reason: `Large batch (${deliveryCount} deliveries >= 50) with healthy CVRP service`,
          };
        }
      } catch (error) {
        console.warn('CVRP health check failed for large batch, using OSRM:', error.message);
      }
    }

    // Default to OSRM for all other cases - it's more reliable
    return {
      engine: 'OSRM',
      reason: `Using reliable OSRM optimization (${deliveryCount} deliveries)`,
    };
  }

  /**
   * Optimize using CVRP engine
   *
   * @param {Object} request - Optimization request
   * @returns {Promise<Object>} - CVRP optimization result
   */
  async optimizeWithCVRP(request) {
    try {
      // Check if enhanced multi-vehicle optimization is requested
      const useEnhanced = request.options?.useEnhanced || request.options?.enhanced || false;
      const slaMinutes = request.options?.slaMinutes || 120;

      if (useEnhanced) {
        logger.info('Using ENHANCED CVRP optimization engine', {
          deliveries: request.deliveryPoints?.length || 0,
          vehicles: request.fleet?.length || 0,
          pickups: request.pickupPoints?.length || 0,
          slaMinutes: slaMinutes,
        });

        // Call enhanced optimizer directly
        const result = await enhancedCvrpOptimizer.optimizeWithEnhancements(request);

        if (result.success) {
          logger.info('Enhanced CVRP optimization successful', {
            routes: result.routes.length,
            vehiclesUsed: result.optimization_metadata.vehicles_used,
            vehiclesAvailable: result.optimization_metadata.vehicles_available,
            utilization: result.optimization_metadata.utilization_rate,
          });

          return {
            ...result,
            optimizationEngine: 'Enhanced CVRP',
            optimizationMetadata: {
              ...result.optimization_metadata,
              engine: 'Enhanced Multi-Pickup CVRP',
              fairDistribution: true,
              capacityConstrained: true,
              multiPickupSupport: true,
              slaAware: true,
            },
          };
        } else {
          throw new Error(result.error || 'Enhanced CVRP optimization failed');
        }
      }

      // Standard CVRP optimization
      logger.info('Using standard CVRP optimization engine');

      // Check if CVRP service is healthy
      const health = await cvrpClient.healthCheck();
      if (!health.healthy) {
        throw new Error('CVRP service is not healthy');
      }

      // Call CVRP optimization
      const result = await cvrpClient.optimizeBarqDeliveries(request);

      if (result.success) {
        logger.info('CVRP optimization successful', {
          routes: result.routes.length,
          totalDistance: result.summary.total_distance,
        });

        return {
          ...result,
          optimizationEngine: 'CVRP',
          optimizationMetadata: {
            ...result.optimization_metadata,
            engine: 'Google OR-Tools CVRP',
            fairDistribution: true,
            capacityConstrained: true,
          },
        };
      } else {
        throw new Error(result.error || 'CVRP optimization failed');
      }
    } catch (error) {
      logger.error('CVRP optimization error', { error: error.message });
      throw error;
    }
  }

  /**
   * Main optimization method with intelligent routing
   *
   * @param {Object} request - Optimization request
   * @param {Function} osrmOptimizer - Fallback OSRM optimizer function
   * @returns {Promise<Object>} - Optimization result
   */
  async optimize(request, osrmOptimizer) {
    try {
      // Decide which engine to use
      const decision = await this.decideOptimizationEngine(request);

      logger.info('Optimization engine decision', {
        engine: decision.engine,
        reason: decision.reason,
        deliveries: request.deliveryPoints?.length || 0,
        serviceType: request.serviceType || request.context?.serviceType,
      });

      // Try CVRP if decided
      if (decision.engine === 'CVRP') {
        try {
          const result = await this.optimizeWithCVRP(request);

          // Add decision metadata
          result.engineDecision = decision;

          return result;
        } catch (error) {
          logger.warn('CVRP optimization failed, falling back to OSRM', {
            error: error.message,
          });

          // Fallback to OSRM
          const osrmResult = await osrmOptimizer(request);

          return {
            ...osrmResult,
            optimizationEngine: 'OSRM',
            engineDecision: {
              ...decision,
              fallback: true,
              fallbackReason: error.message,
            },
          };
        }
      }

      // Use OSRM directly
      const result = await osrmOptimizer(request);

      return {
        ...result,
        optimizationEngine: 'OSRM',
        engineDecision: decision,
      };
    } catch (error) {
      logger.error('Hybrid optimization error', { error: error.message });
      throw error;
    }
  }

  /**
   * Get optimization engine status
   */
  async getStatus() {
    const cvrpHealth = await cvrpClient.healthCheck();

    return {
      hybrid: {
        enabled: true,
        cvrpEnabled: this.cvrpEnabled,
        cvrpMinDeliveries: this.cvrpMinDeliveries,
      },
      engines: {
        OSRM: {
          available: true,
          description: 'Current OSRM-based routing with genetic algorithm',
        },
        CVRP: {
          available: cvrpHealth.healthy,
          serviceUrl: this.cvrpServiceUrl,
          description: 'Google OR-Tools CVRP for fair distribution',
          health: cvrpHealth,
        },
      },
    };
  }
}

module.exports = new HybridOptimizationService();
