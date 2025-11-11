/**
 * Clustering Integration Module
 * Provides integration functions for enhanced clustering with planning.agent.js
 */

const { EnhancedClustering, ClusteringConfig, DEFAULT_WEIGHTS } = require('./enhanced-clustering');

/**
 * Integration wrapper for planning agent
 * This can be used to replace or enhance the existing vehicle-to-delivery assignment logic
 */
class ClusteringIntegration {
  constructor(customWeights = null) {
    this.clustering = new EnhancedClustering(
      customWeights ? new ClusteringConfig(customWeights) : null
    );
  }

  /**
   * Enhanced vehicle-to-delivery assignment for planning agent
   *
   * This function can be called from planning.agent.js to replace the current
   * round-robin or distance-based assignment logic
   *
   * @param {Array} vehicles - Available vehicles
   * @param {Array} pickupPoints - Pickup locations
   * @param {Array} deliveryPoints - Delivery locations
   * @param {Object} preferences - User preferences
   * @returns {Object} Vehicle assignments with routes
   */
  assignVehiclesForPlanning(vehicles, pickupPoints, deliveryPoints, preferences = {}) {
    console.log('\n=== Using Enhanced Clustering for Vehicle Assignment ===');

    // Prepare vehicles with existing route information
    const preparedVehicles = vehicles.map(vehicle => {
      const routeInfo = this.clustering.analyzeExistingRoutes(vehicle);
      return {
        ...vehicle,
        existingRouteInfo: routeInfo
      };
    });

    // Run enhanced clustering
    const result = this.clustering.assignDeliveriesToVehicles(
      preparedVehicles,
      pickupPoints,
      deliveryPoints,
      {
        distributionStrategy: preferences.distributionStrategy || 'best_match'
      }
    );

    // Convert to planning agent format
    return this.convertToRouteFormat(result, vehicles, pickupPoints);
  }

  /**
   * Convert clustering result to route format expected by planning agent
   */
  convertToRouteFormat(clusteringResult, vehicles, pickupPoints) {
    const routes = [];
    const { assignments } = clusteringResult;

    Object.entries(assignments).forEach(([vehicleId, assignment]) => {
      if (assignment.deliveries.length === 0) {
        return; // Skip vehicles with no deliveries
      }

      // Find the vehicle and pickup
      const vehicle = vehicles.find(v => (v.id || v.fleet_id) === vehicleId);
      const pickup = pickupPoints.find(p => p.id === assignment.pickupId);

      if (!vehicle || !pickup) {
        console.warn(`Could not find vehicle ${vehicleId} or pickup ${assignment.pickupId}`);
        return;
      }

      // Create waypoints
      const waypoints = [];

      // Vehicle start location
      waypoints.push({
        id: `start-${vehicleId}`,
        type: 'start',
        location: {
          lat: vehicle.startLocation?.latitude || vehicle.current_latitude || vehicle.lat,
          lng: vehicle.startLocation?.longitude || vehicle.current_longitude || vehicle.lng
        },
        name: `${vehicle.name || vehicleId} Start`
      });

      // Pickup location
      waypoints.push({
        id: pickup.id,
        type: 'pickup',
        location: {
          lat: pickup.location?.latitude || pickup.lat,
          lng: pickup.location?.longitude || pickup.lng
        },
        name: pickup.name || `Pickup ${pickup.id}`,
        timeWindow: pickup.timeWindow || pickup.time_window
      });

      // Delivery stops
      assignment.deliveries.forEach(delivery => {
        waypoints.push({
          id: delivery.id || delivery.order_id,
          type: 'delivery',
          location: {
            lat: delivery.location?.latitude || delivery.lat,
            lng: delivery.location?.longitude || delivery.lng
          },
          name: delivery.customer_name || delivery.name,
          timeWindow: delivery.timeWindow || delivery.time_window
        });
      });

      // Create route object
      const route = {
        id: `route-${vehicleId}-${Date.now()}`,
        vehicle: {
          id: vehicleId,
          name: vehicle.name || vehicleId,
          type: vehicle.type || vehicle.vehicle_type
        },
        pickupId: assignment.pickupId,
        deliveries: assignment.deliveries.map(d => d.id || d.order_id),
        waypoints,
        stops: waypoints,
        load_kg: assignment.totalLoad,
        distance: assignment.metadata.totalDistance,
        duration: Math.round(assignment.metadata.totalDistance * 1.5), // Estimate
        clusteringMetadata: {
          avgScore: assignment.metadata.avgScore,
          clusterDensity: assignment.metadata.clusterDensity,
          scoreBreakdown: assignment.scores
        }
      };

      routes.push(route);
    });

    return {
      routes,
      summary: clusteringResult.summary,
      algorithm: 'enhanced_clustering'
    };
  }

  /**
   * Optimize delivery sequence within a cluster using enhanced metrics
   * This can be called after initial assignment to optimize the order of deliveries
   */
  optimizeDeliverySequence(pickup, deliveries, vehicleLocation) {
    if (!deliveries || deliveries.length <= 1) {
      return deliveries;
    }

    // Use nearest neighbor with cluster density consideration
    const optimized = [];
    const remaining = [...deliveries];

    // Start from pickup location
    let currentLat = pickup.location?.latitude || pickup.lat;
    let currentLng = pickup.location?.longitude || pickup.lng;

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestScore = Infinity;

      // Find nearest delivery considering both distance and priority
      for (let i = 0; i < remaining.length; i++) {
        const delivery = remaining[i];
        const lat = delivery.location?.latitude || delivery.lat;
        const lng = delivery.location?.longitude || delivery.lng;

        const distance = this.calculateDistance(currentLat, currentLng, lat, lng);
        const priority = delivery.priority === 'HIGH' ? 0.7 : delivery.priority === 'MEDIUM' ? 1.0 : 1.3;

        const score = distance * priority;

        if (score < nearestScore) {
          nearestScore = score;
          nearestIndex = i;
        }
      }

      // Add nearest to optimized list
      const nearest = remaining.splice(nearestIndex, 1)[0];
      optimized.push(nearest);

      // Update current location
      currentLat = nearest.location?.latitude || nearest.lat;
      currentLng = nearest.location?.longitude || nearest.lng;
    }

    return optimized;
  }

  /**
   * Calculate distance between two points (uses Haversine formula)
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return this.clustering.config;
  }

  /**
   * Update configuration weights
   */
  updateWeights(newWeights) {
    this.clustering.config.updateWeights(newWeights);
  }
}

/**
 * Factory function to create integration instance with custom weights
 */
function createClusteringIntegration(customWeights = null) {
  return new ClusteringIntegration(customWeights);
}

/**
 * Helper function to validate clustering configuration
 */
function validateClusteringConfig(config) {
  const requiredFields = [
    'vehicleToPickupDistance',
    'pickupToDeliveryDistance',
    'deliveryClusterDensity',
    'vehicleLoadBalance',
    'existingRouteCompatibility'
  ];

  const errors = [];

  requiredFields.forEach(field => {
    if (!(field in config)) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof config[field] !== 'number') {
      errors.push(`Field ${field} must be a number`);
    } else if (config[field] < 0 || config[field] > 1) {
      errors.push(`Field ${field} must be between 0 and 1`);
    }
  });

  const sum = requiredFields.reduce((acc, field) => acc + (config[field] || 0), 0);
  if (Math.abs(sum - 1.0) > 0.01) {
    errors.push(`Weights must sum to 1.0 (current sum: ${sum.toFixed(2)})`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Preset configurations for different scenarios
 */
const PRESET_CONFIGS = {
  // Prioritize proximity to vehicles
  proximity_focused: {
    vehicleToPickupDistance: 0.35,
    pickupToDeliveryDistance: 0.30,
    deliveryClusterDensity: 0.15,
    vehicleLoadBalance: 0.10,
    existingRouteCompatibility: 0.10
  },

  // Prioritize load balancing
  load_balanced: {
    vehicleToPickupDistance: 0.20,
    pickupToDeliveryDistance: 0.25,
    deliveryClusterDensity: 0.15,
    vehicleLoadBalance: 0.30,
    existingRouteCompatibility: 0.10
  },

  // Prioritize cluster density
  cluster_optimized: {
    vehicleToPickupDistance: 0.20,
    pickupToDeliveryDistance: 0.25,
    deliveryClusterDensity: 0.35,
    vehicleLoadBalance: 0.10,
    existingRouteCompatibility: 0.10
  },

  // Prioritize existing routes
  route_continuation: {
    vehicleToPickupDistance: 0.15,
    pickupToDeliveryDistance: 0.20,
    deliveryClusterDensity: 0.15,
    vehicleLoadBalance: 0.15,
    existingRouteCompatibility: 0.35
  },

  // Default balanced approach
  default: DEFAULT_WEIGHTS
};

module.exports = {
  ClusteringIntegration,
  createClusteringIntegration,
  validateClusteringConfig,
  PRESET_CONFIGS,
  DEFAULT_WEIGHTS
};
