/**
 * Enhanced Clustering Algorithm for Route Optimization
 * Implements multi-factor scoring that considers:
 * - Vehicle current location
 * - Pickup location
 * - Delivery locations
 * - Existing vehicle routes
 * - Cluster density
 * - Load balancing
 */

const { calculateDistance } = require('./helper');

/**
 * Default configuration for clustering weights
 * These weights determine the importance of each factor in the scoring formula
 */
const DEFAULT_WEIGHTS = {
  vehicleToPickupDistance: 0.25,    // W1: Distance from vehicle to pickup
  pickupToDeliveryDistance: 0.30,   // W2: Distance from pickup to delivery cluster
  deliveryClusterDensity: 0.20,     // W3: How tight the delivery cluster is
  vehicleLoadBalance: 0.15,         // W4: Balance load across vehicles
  existingRouteCompatibility: 0.10   // W5: Compatibility with existing routes
};

/**
 * Configuration class for clustering algorithm
 */
class ClusteringConfig {
  constructor(customWeights = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...customWeights };
    this.validateWeights();
  }

  /**
   * Validate that weights sum to 1.0
   */
  validateWeights() {
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      console.warn(`Warning: Clustering weights sum to ${sum.toFixed(2)}, expected 1.0`);
    }
  }

  /**
   * Get a specific weight
   */
  getWeight(key) {
    return this.weights[key] || 0;
  }

  /**
   * Update weights
   */
  updateWeights(newWeights) {
    this.weights = { ...this.weights, ...newWeights };
    this.validateWeights();
  }
}

/**
 * Enhanced Clustering Algorithm
 */
class EnhancedClustering {
  constructor(config = null) {
    this.config = config || new ClusteringConfig();
  }

  /**
   * Main clustering function - assigns deliveries to vehicles using multi-factor scoring
   *
   * @param {Array} vehicles - Array of vehicle objects with current location and existing routes
   * @param {Array} pickupPoints - Array of pickup location objects
   * @param {Array} deliveryPoints - Array of delivery location objects
   * @param {Object} options - Additional options for clustering
   * @returns {Object} Assignment result with vehicle-delivery mappings and scoring details
   */
  assignDeliveriesToVehicles(vehicles, pickupPoints, deliveryPoints, options = {}) {
    console.log(`\n=== Enhanced Clustering Algorithm Starting ===`);
    console.log(`Vehicles: ${vehicles.length}, Pickups: ${pickupPoints.length}, Deliveries: ${deliveryPoints.length}`);

    // Validate inputs
    if (!vehicles || vehicles.length === 0) {
      throw new Error('No vehicles available for clustering');
    }
    if (!pickupPoints || pickupPoints.length === 0) {
      throw new Error('No pickup points provided');
    }
    if (!deliveryPoints || deliveryPoints.length === 0) {
      throw new Error('No delivery points provided');
    }

    // Initialize result structure
    const assignments = new Map();
    vehicles.forEach(vehicle => {
      const vehicleId = vehicle.id || vehicle.fleet_id;
      assignments.set(vehicleId, {
        vehicle: vehicle,
        pickupId: null,
        deliveries: [],
        totalLoad: 0,
        scores: [],
        metadata: {
          avgScore: 0,
          clusterDensity: 0,
          totalDistance: 0
        }
      });
    });

    // Group deliveries by pickup point (if not already assigned)
    const deliveriesByPickup = this.groupDeliveriesByPickup(pickupPoints, deliveryPoints);

    // For each pickup point, assign deliveries to the best vehicle(s)
    pickupPoints.forEach(pickup => {
      const pickupDeliveries = deliveriesByPickup.get(pickup.id) || [];

      if (pickupDeliveries.length === 0) {
        console.log(`No deliveries for pickup ${pickup.id}`);
        return;
      }

      console.log(`\nProcessing pickup ${pickup.id} with ${pickupDeliveries.length} deliveries`);

      // Calculate scores for all vehicles for this pickup's deliveries
      const vehicleScores = this.calculateVehicleScores(
        vehicles,
        pickup,
        pickupDeliveries,
        assignments
      );

      // Assign deliveries to vehicles based on scores
      this.distributeDeliveries(
        vehicleScores,
        pickup,
        pickupDeliveries,
        assignments,
        options
      );
    });

    // Calculate final metadata for each assignment
    assignments.forEach((assignment, vehicleId) => {
      if (assignment.deliveries.length > 0) {
        assignment.metadata.avgScore =
          assignment.scores.reduce((sum, s) => sum + s, 0) / assignment.scores.length;

        assignment.metadata.clusterDensity =
          this.calculateClusterDensity(assignment.deliveries);

        assignment.metadata.totalDistance =
          this.calculateRouteDistance(
            assignment.vehicle,
            assignment.pickupId ? pickupPoints.find(p => p.id === assignment.pickupId) : null,
            assignment.deliveries
          );
      }
    });

    console.log(`\n=== Enhanced Clustering Algorithm Complete ===\n`);

    return {
      assignments: Object.fromEntries(assignments),
      summary: this.generateSummary(assignments)
    };
  }

  /**
   * Group deliveries by their assigned or nearest pickup point
   */
  groupDeliveriesByPickup(pickupPoints, deliveryPoints) {
    const deliveriesByPickup = new Map();

    // Initialize map
    pickupPoints.forEach(pickup => {
      deliveriesByPickup.set(pickup.id, []);
    });

    // Assign each delivery to a pickup
    deliveryPoints.forEach(delivery => {
      let targetPickupId = delivery.pickupId;

      // If no pickup assigned, find nearest
      if (!targetPickupId) {
        const deliveryLat = delivery.location?.latitude || delivery.lat;
        const deliveryLng = delivery.location?.longitude || delivery.lng;

        let minDistance = Infinity;
        pickupPoints.forEach(pickup => {
          const pickupLat = pickup.location?.latitude || pickup.lat;
          const pickupLng = pickup.location?.longitude || pickup.lng;

          const distance = calculateDistance(deliveryLat, deliveryLng, pickupLat, pickupLng);

          if (distance < minDistance) {
            minDistance = distance;
            targetPickupId = pickup.id;
          }
        });
      }

      if (targetPickupId && deliveriesByPickup.has(targetPickupId)) {
        deliveriesByPickup.get(targetPickupId).push(delivery);
      }
    });

    return deliveriesByPickup;
  }

  /**
   * Calculate multi-factor scores for all vehicles for a given pickup and its deliveries
   */
  calculateVehicleScores(vehicles, pickup, deliveries, currentAssignments) {
    const scores = [];

    vehicles.forEach(vehicle => {
      const vehicleId = vehicle.id || vehicle.fleet_id;
      const score = this.calculateSingleVehicleScore(
        vehicle,
        pickup,
        deliveries,
        currentAssignments.get(vehicleId)
      );

      scores.push({
        vehicleId,
        vehicle,
        score: score.total,
        breakdown: score.breakdown
      });
    });

    // Sort by score (lower is better)
    scores.sort((a, b) => a.score - b.score);

    return scores;
  }

  /**
   * Calculate the multi-factor score for a single vehicle
   *
   * Score Formula:
   * Total = W1 * vehicleToPickupDistance +
   *         W2 * pickupToDeliveryDistance +
   *         W3 * deliveryClusterDensity +
   *         W4 * vehicleLoadBalance +
   *         W5 * existingRouteCompatibility
   */
  calculateSingleVehicleScore(vehicle, pickup, deliveries, currentAssignment) {
    const vehicleId = vehicle.id || vehicle.fleet_id;

    // Extract vehicle location
    const vehicleLat = vehicle.startLocation?.latitude ||
                       vehicle.current_latitude ||
                       vehicle.lat || 0;
    const vehicleLng = vehicle.startLocation?.longitude ||
                       vehicle.current_longitude ||
                       vehicle.lng || 0;

    // Extract pickup location
    const pickupLat = pickup.location?.latitude || pickup.lat;
    const pickupLng = pickup.location?.longitude || pickup.lng;

    // Factor 1: Vehicle to Pickup Distance (normalized to 0-100 scale)
    const vehicleToPickupDist = calculateDistance(
      vehicleLat, vehicleLng, pickupLat, pickupLng
    );
    const factor1 = Math.min(vehicleToPickupDist * 2, 100); // Cap at 100

    // Factor 2: Pickup to Delivery Cluster Distance (average)
    let totalPickupToDeliveryDist = 0;
    deliveries.forEach(delivery => {
      const deliveryLat = delivery.location?.latitude || delivery.lat;
      const deliveryLng = delivery.location?.longitude || delivery.lng;
      totalPickupToDeliveryDist += calculateDistance(
        pickupLat, pickupLng, deliveryLat, deliveryLng
      );
    });
    const avgPickupToDeliveryDist = totalPickupToDeliveryDist / deliveries.length;
    const factor2 = Math.min(avgPickupToDeliveryDist * 2, 100);

    // Factor 3: Delivery Cluster Density (inverse - tighter clusters are better)
    const clusterDensity = this.calculateClusterDensity(deliveries);
    // Lower density (more spread out) = higher penalty score
    const factor3 = Math.max(0, 100 - clusterDensity);

    // Factor 4: Vehicle Load Balance
    const currentLoad = currentAssignment?.totalLoad || 0;
    const newLoad = deliveries.reduce((sum, d) => sum + (d.load_kg || 0), 0);
    const vehicleCapacity = vehicle.capacity_kg || vehicle.capacity || 3000;
    const loadUtilization = ((currentLoad + newLoad) / vehicleCapacity) * 100;

    // Penalize both under-utilization and over-capacity
    let factor4;
    if (loadUtilization > 100) {
      factor4 = 100; // Over capacity - maximum penalty
    } else if (loadUtilization > 90) {
      factor4 = 10; // Good utilization - low penalty
    } else if (loadUtilization > 70) {
      factor4 = 30; // Acceptable utilization
    } else {
      factor4 = 70 - loadUtilization; // Under-utilized - penalty
    }

    // Factor 5: Existing Route Compatibility
    const existingRouteCount = currentAssignment?.deliveries.length || 0;
    const existingPickup = currentAssignment?.pickupId;

    let factor5;
    if (existingPickup === pickup.id) {
      // Same pickup - very compatible
      factor5 = 0;
    } else if (existingPickup === null) {
      // No existing route - neutral
      factor5 = 50;
    } else {
      // Different pickup - check distance between pickups
      const existingPickupObj = pickup; // Would need to be passed in
      factor5 = 100; // High penalty for different pickup
    }

    // Calculate weighted total score
    const weights = this.config.weights;
    const totalScore =
      (weights.vehicleToPickupDistance * factor1) +
      (weights.pickupToDeliveryDistance * factor2) +
      (weights.deliveryClusterDensity * factor3) +
      (weights.vehicleLoadBalance * factor4) +
      (weights.existingRouteCompatibility * factor5);

    return {
      total: totalScore,
      breakdown: {
        vehicleToPickupDistance: { value: vehicleToPickupDist, score: factor1, weight: weights.vehicleToPickupDistance },
        pickupToDeliveryDistance: { value: avgPickupToDeliveryDist, score: factor2, weight: weights.pickupToDeliveryDistance },
        deliveryClusterDensity: { value: clusterDensity, score: factor3, weight: weights.deliveryClusterDensity },
        vehicleLoadBalance: { value: loadUtilization, score: factor4, weight: weights.vehicleLoadBalance },
        existingRouteCompatibility: { value: existingRouteCount, score: factor5, weight: weights.existingRouteCompatibility }
      }
    };
  }

  /**
   * Calculate cluster density (0-100, higher is tighter/better)
   */
  calculateClusterDensity(deliveries) {
    if (deliveries.length <= 1) return 100;

    // Calculate centroid
    let sumLat = 0, sumLng = 0;
    deliveries.forEach(d => {
      sumLat += d.location?.latitude || d.lat || 0;
      sumLng += d.location?.longitude || d.lng || 0;
    });
    const centroidLat = sumLat / deliveries.length;
    const centroidLng = sumLng / deliveries.length;

    // Calculate average distance from centroid
    let totalDist = 0;
    deliveries.forEach(d => {
      const lat = d.location?.latitude || d.lat || 0;
      const lng = d.location?.longitude || d.lng || 0;
      totalDist += calculateDistance(centroidLat, centroidLng, lat, lng);
    });
    const avgDistFromCentroid = totalDist / deliveries.length;

    // Convert to density score (inverse relationship, capped at 100)
    // 0km avg = 100, 10km avg = 50, 20km+ avg = 0
    const densityScore = Math.max(0, 100 - (avgDistFromCentroid * 5));

    return densityScore;
  }

  /**
   * Distribute deliveries to vehicles based on scores
   */
  distributeDeliveries(vehicleScores, pickup, deliveries, assignments, options = {}) {
    const strategy = options.distributionStrategy || 'best_match';

    if (strategy === 'best_match') {
      // Assign all deliveries to the best-scoring vehicle
      const bestVehicle = vehicleScores[0];
      const vehicleId = bestVehicle.vehicleId;
      const assignment = assignments.get(vehicleId);

      assignment.pickupId = pickup.id;
      assignment.deliveries.push(...deliveries);
      assignment.totalLoad += deliveries.reduce((sum, d) => sum + (d.load_kg || 0), 0);
      assignment.scores.push(bestVehicle.score);

      console.log(`Assigned ${deliveries.length} deliveries to vehicle ${vehicleId} (score: ${bestVehicle.score.toFixed(2)})`);

    } else if (strategy === 'balanced') {
      // Distribute deliveries among top vehicles
      const topN = Math.min(3, vehicleScores.length);
      const topVehicles = vehicleScores.slice(0, topN);

      deliveries.forEach((delivery, index) => {
        const targetVehicle = topVehicles[index % topN];
        const vehicleId = targetVehicle.vehicleId;
        const assignment = assignments.get(vehicleId);

        if (!assignment.pickupId) {
          assignment.pickupId = pickup.id;
        }

        assignment.deliveries.push(delivery);
        assignment.totalLoad += delivery.load_kg || 0;
        assignment.scores.push(targetVehicle.score);
      });

      console.log(`Distributed ${deliveries.length} deliveries among ${topN} vehicles`);
    }
  }

  /**
   * Calculate estimated route distance for a vehicle
   */
  calculateRouteDistance(vehicle, pickup, deliveries) {
    if (!pickup || deliveries.length === 0) return 0;

    const vehicleLat = vehicle.startLocation?.latitude || vehicle.current_latitude || vehicle.lat || 0;
    const vehicleLng = vehicle.startLocation?.longitude || vehicle.current_longitude || vehicle.lng || 0;
    const pickupLat = pickup.location?.latitude || pickup.lat;
    const pickupLng = pickup.location?.longitude || pickup.lng;

    // Distance from vehicle to pickup
    let totalDistance = calculateDistance(vehicleLat, vehicleLng, pickupLat, pickupLng);

    // Distance from pickup to first delivery
    if (deliveries.length > 0) {
      const firstDelivery = deliveries[0];
      const firstLat = firstDelivery.location?.latitude || firstDelivery.lat;
      const firstLng = firstDelivery.location?.longitude || firstDelivery.lng;
      totalDistance += calculateDistance(pickupLat, pickupLng, firstLat, firstLng);
    }

    // Distance between deliveries (simplified - just sum sequential distances)
    for (let i = 0; i < deliveries.length - 1; i++) {
      const d1 = deliveries[i];
      const d2 = deliveries[i + 1];
      const lat1 = d1.location?.latitude || d1.lat;
      const lng1 = d1.location?.longitude || d1.lng;
      const lat2 = d2.location?.latitude || d2.lat;
      const lng2 = d2.location?.longitude || d2.lng;
      totalDistance += calculateDistance(lat1, lng1, lat2, lng2);
    }

    return totalDistance;
  }

  /**
   * Generate summary statistics
   */
  generateSummary(assignments) {
    let totalDeliveries = 0;
    let totalLoad = 0;
    let totalDistance = 0;
    let vehiclesUsed = 0;

    assignments.forEach((assignment, vehicleId) => {
      if (assignment.deliveries.length > 0) {
        vehiclesUsed++;
        totalDeliveries += assignment.deliveries.length;
        totalLoad += assignment.totalLoad;
        totalDistance += assignment.metadata.totalDistance;
      }
    });

    return {
      vehiclesUsed,
      totalDeliveries,
      totalLoad,
      totalDistance: Math.round(totalDistance * 10) / 10,
      avgDeliveriesPerVehicle: vehiclesUsed > 0 ? Math.round(totalDeliveries / vehiclesUsed * 10) / 10 : 0,
      avgLoadPerVehicle: vehiclesUsed > 0 ? Math.round(totalLoad / vehiclesUsed * 10) / 10 : 0
    };
  }

  /**
   * Handle vehicles with existing routes
   * This function analyzes existing routes and adjusts scoring accordingly
   */
  analyzeExistingRoutes(vehicle) {
    const existingRoute = vehicle.currentRoute || vehicle.existing_route;

    if (!existingRoute) {
      return {
        hasExistingRoute: false,
        pickupId: null,
        deliveryCount: 0,
        currentLoad: 0,
        remainingCapacity: vehicle.capacity_kg || vehicle.capacity || 3000
      };
    }

    // Extract route information
    const deliveryCount = existingRoute.deliveries?.length || 0;
    const currentLoad = existingRoute.load_kg ||
                       existingRoute.deliveries?.reduce((sum, d) => sum + (d.load_kg || 0), 0) || 0;
    const pickupId = existingRoute.pickupId || existingRoute.pickup_id;

    return {
      hasExistingRoute: true,
      pickupId,
      deliveryCount,
      currentLoad,
      remainingCapacity: (vehicle.capacity_kg || vehicle.capacity || 3000) - currentLoad,
      route: existingRoute
    };
  }
}

// Export the module
module.exports = {
  EnhancedClustering,
  ClusteringConfig,
  DEFAULT_WEIGHTS
};
