/**
 * Hybrid Optimization Service
 * Intelligently routes requests between CVRP (OR-Tools) and current OSRM-based optimization
 *
 * Decision Logic:
 * - CVRP: For BULLET service, 10+ deliveries, capacity-critical scenarios
 * - OSRM: For BARQ service, <10 deliveries, real-time urgent scenarios
 */

const cvrpClient = require('./cvrp-client.service');
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
  decideOptimizationEngine(request) {
    const deliveryCount = request.deliveryPoints?.length || 0;
    const serviceType = request.serviceType || request.context?.serviceType;
    const useCVRP = request.preferences?.useCVRP;
    const fairDistribution = request.preferences?.fairDistribution;

    // Force CVRP if explicitly requested
    if (useCVRP === true) {
      return {
        engine: 'CVRP',
        reason: 'Explicitly requested via preferences.useCVRP',
      };
    }

    // Disable CVRP if explicitly disabled
    if (useCVRP === false || !this.cvrpEnabled) {
      return {
        engine: 'OSRM',
        reason: 'CVRP disabled or not requested',
      };
    }

    // Use CVRP for BULLET service (batch, non-urgent)
    if (serviceType === 'BULLET' && deliveryCount >= this.cvrpMinDeliveries) {
      return {
        engine: 'CVRP',
        reason: `BULLET service with ${deliveryCount} deliveries (>=${this.cvrpMinDeliveries})`,
      };
    }

    // Use CVRP for fair distribution scenarios
    if (fairDistribution && deliveryCount >= this.cvrpMinDeliveries) {
      return {
        engine: 'CVRP',
        reason: `Fair distribution requested with ${deliveryCount} deliveries`,
      };
    }

    // Use CVRP for large batches regardless of service type
    if (deliveryCount >= 20) {
      return {
        engine: 'CVRP',
        reason: `Large batch (${deliveryCount} deliveries >= 20)`,
      };
    }

    // Default to OSRM for BARQ (urgent) or small batches
    return {
      engine: 'OSRM',
      reason: serviceType === 'BARQ'
        ? `BARQ service (urgent, ${deliveryCount} deliveries)`
        : `Small batch (${deliveryCount} deliveries < ${this.cvrpMinDeliveries})`,
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
      logger.info('Using CVRP optimization engine');

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
      const decision = this.decideOptimizationEngine(request);

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
