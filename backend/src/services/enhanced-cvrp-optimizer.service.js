/**
 * Enhanced CVRP Optimizer Service
 *
 * Enhancements:
 * 1. Utilizes ALL vehicles even when vehicles > pickups
 * 2. Allows same pickup with multiple dropoffs across multiple vehicles
 * 3. SLA-aware optimization with time windows
 * 4. Multi-pickup support (not just pickupPoints[0])
 *
 * This solves the issue where excess vehicles sit idle by distributing
 * deliveries from each pickup across multiple vehicles to meet SLA targets.
 */

const cvrpClient = require('./cvrp-client.service');
const { logger } = require('../utils/logger');

class EnhancedCVRPOptimizer {
  constructor() {
    this.defaultSLAMinutes = parseInt(process.env.DEFAULT_SLA_MINUTES) || 120; // 2 hours
    logger.info('Enhanced CVRP Optimizer initialized', {
      defaultSLA: this.defaultSLAMinutes,
    });
  }

  /**
   * Calculate optimal number of vehicles needed per pickup to meet SLA
   *
   * @param {number} deliveryCount - Number of deliveries from this pickup
   * @param {number} availableVehicles - Total vehicles available
   * @param {number} slaMinutes - SLA target in minutes
   * @returns {number} - Number of vehicles to allocate
   */
  calculateVehiclesNeeded(deliveryCount, availableVehicles, slaMinutes) {
    // Estimate time per delivery (avg 10 minutes including travel)
    const avgTimePerDelivery = 10;
    const totalTimeNeeded = deliveryCount * avgTimePerDelivery;

    // How many vehicles needed to complete within SLA?
    const vehiclesNeeded = Math.ceil(totalTimeNeeded / slaMinutes);

    // Don't exceed available vehicles
    return Math.min(vehiclesNeeded, availableVehicles);
  }

  /**
   * Split deliveries across multiple vehicles for a single pickup
   * Uses round-robin to ensure fair distribution
   *
   * @param {Array} deliveries - Deliveries to split
   * @param {number} numVehicles - Number of vehicles to use
   * @returns {Array<Array>} - Array of delivery batches
   */
  splitDeliveriesAcrossVehicles(deliveries, numVehicles) {
    const batches = Array(numVehicles)
      .fill(null)
      .map(() => []);

    // Round-robin distribution (most fair)
    deliveries.forEach((delivery, index) => {
      const vehicleIndex = index % numVehicles;
      batches[vehicleIndex].push(delivery);
    });

    // Filter out empty batches
    return batches.filter((batch) => batch.length > 0);
  }

  /**
   * Enhanced optimization with multi-pickup and multi-vehicle support
   *
   * @param {Object} request - Optimization request
   * @returns {Promise<Object>} - Optimization result
   */
  async optimizeWithEnhancements(request) {
    try {
      const { pickupPoints, deliveryPoints, fleet, options = {} } = request;

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

      logger.info('Enhanced optimization starting', {
        pickups: pickupPoints.length,
        deliveries: deliveryPoints.length,
        vehicles: fleet.length,
      });

      // Get SLA from options or use default
      const slaMinutes = options.slaMinutes || this.defaultSLAMinutes;

      // Group deliveries by pickup point (if they have pickup_id)
      const deliveriesByPickup = this.groupDeliveriesByPickup(deliveryPoints, pickupPoints);

      // Strategy: If vehicles > pickups, split deliveries across multiple vehicles
      const allRoutes = [];
      let vehicleIndex = 0;

      for (const [pickupId, deliveries] of Object.entries(deliveriesByPickup)) {
        const pickup = pickupPoints.find((p) => p.id === pickupId) || pickupPoints[0];

        // Calculate how many vehicles to use for this pickup
        const availableVehicles = fleet.length - vehicleIndex;
        const vehiclesForPickup = this.calculateVehiclesNeeded(
          deliveries.length,
          availableVehicles,
          slaMinutes
        );

        logger.info(`Pickup ${pickupId}: ${deliveries.length} deliveries, using ${vehiclesForPickup} vehicles`);

        if (vehiclesForPickup === 1) {
          // Single vehicle - use standard optimization
          const routes = await this.optimizeSinglePickup(
            pickup,
            deliveries,
            [fleet[vehicleIndex]],
            slaMinutes
          );

          allRoutes.push(...routes);
          vehicleIndex++;
        } else {
          // Multiple vehicles - split deliveries
          const deliveryBatches = this.splitDeliveriesAcrossVehicles(
            deliveries,
            vehiclesForPickup
          );

          for (const batch of deliveryBatches) {
            if (vehicleIndex >= fleet.length) break;

            const routes = await this.optimizeSinglePickup(
              pickup,
              batch,
              [fleet[vehicleIndex]],
              slaMinutes
            );

            allRoutes.push(...routes);
            vehicleIndex++;
          }
        }

        // Stop if we've used all vehicles
        if (vehicleIndex >= fleet.length) break;
      }

      // Calculate summary statistics
      const summary = this.calculateSummary(allRoutes);

      return {
        success: true,
        routes: allRoutes,
        summary: summary,
        optimization_metadata: {
          method: 'Enhanced Multi-Pickup CVRP',
          sla_minutes: slaMinutes,
          vehicles_used: allRoutes.length,
          vehicles_available: fleet.length,
          utilization_rate: (allRoutes.length / fleet.length) * 100,
          enhanced: true,
        },
      };
    } catch (error) {
      logger.error('Enhanced optimization failed', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Group deliveries by their pickup point
   *
   * @param {Array} deliveryPoints - All delivery points
   * @param {Array} pickupPoints - All pickup points
   * @returns {Object} - Deliveries grouped by pickup ID
   */
  groupDeliveriesByPickup(deliveryPoints, pickupPoints) {
    const grouped = {};

    // If deliveries have pickup_id, use it; otherwise distribute evenly
    deliveryPoints.forEach((delivery, index) => {
      const pickupId = delivery.pickup_id || `pickup_${index % pickupPoints.length}`;

      if (!grouped[pickupId]) {
        grouped[pickupId] = [];
      }

      grouped[pickupId].push(delivery);
    });

    // If no pickup_id was set, create default groups
    if (Object.keys(grouped).length === deliveryPoints.length) {
      // No grouping happened, distribute evenly across all pickups
      const deliveriesPerPickup = Math.ceil(deliveryPoints.length / pickupPoints.length);
      const newGrouped = {};

      pickupPoints.forEach((pickup, pIndex) => {
        const start = pIndex * deliveriesPerPickup;
        const end = Math.min(start + deliveriesPerPickup, deliveryPoints.length);
        newGrouped[pickup.id || `pickup_${pIndex}`] = deliveryPoints.slice(start, end);
      });

      return newGrouped;
    }

    return grouped;
  }

  /**
   * Optimize routes for a single pickup point
   *
   * @param {Object} pickup - Pickup point
   * @param {Array} deliveries - Deliveries from this pickup
   * @param {Array} vehicles - Vehicles to use
   * @param {number} slaMinutes - SLA target
   * @returns {Promise<Array>} - Optimized routes
   */
  async optimizeSinglePickup(pickup, deliveries, vehicles, slaMinutes) {
    // Use depot as this pickup point
    const depot = {
      lat: pickup.lat,
      lng: pickup.lng,
    };

    // Prepare locations
    const locations = deliveries.map((delivery) => ({
      id: delivery.order_id || delivery.id,
      lat: delivery.lat,
      lng: delivery.lng,
      demand: delivery.load_kg || 1,
      customer_name: delivery.customer_name,
      time_window: delivery.sla_deadline
        ? {
            start: 0,
            end: Math.floor((new Date(delivery.sla_deadline) - Date.now()) / 60000), // Minutes from now
          }
        : {
            start: 0,
            end: slaMinutes,
          },
    }));

    // Prepare vehicles
    const vehicleList = vehicles.map((vehicle) => ({
      id: vehicle.fleet_id || vehicle.id,
      capacity: vehicle.capacity_kg || 3000,
    }));

    // Call CVRP optimization
    const result = await cvrpClient.optimizeBatch(depot, locations, vehicleList, 10);

    if (!result.success) {
      logger.warn('CVRP optimization failed, using fallback');
      return this.createFallbackRoute(pickup, deliveries, vehicles[0]);
    }

    // Convert to BARQ format
    return this.convertRoutes(result.routes, pickup, deliveries, vehicles);
  }

  /**
   * Convert CVRP routes to BARQ format
   */
  convertRoutes(cvrpRoutes, pickup, deliveries, vehicles) {
    return cvrpRoutes
      .filter((route) => route.stops && route.stops.length > 2)
      .map((route, index) => {
        const vehicle = vehicles[index] || vehicles[0];

        const stops = route.stops.map((stop, stopIndex) => {
          if (stop.location_index === 0) {
            return {
              type: stopIndex === 0 ? 'pickup' : 'return',
              location: {
                latitude: pickup.lat,
                longitude: pickup.lng,
              },
              name: pickup.name || 'Pickup Point',
              cumulative_load: stop.cumulative_load || 0,
            };
          } else {
            return {
              type: 'delivery',
              location: {
                latitude: stop.location.lat,
                longitude: stop.location.lng,
              },
              name: stop.name || stop.location_id,
              order_id: stop.location_id,
              cumulative_load: stop.cumulative_load || 0,
              demand: stop.demand || 1,
            };
          }
        });

        return {
          id: `enhanced-route-${vehicle.fleet_id || vehicle.id}`,
          vehicle: {
            fleet_id: vehicle.fleet_id || vehicle.id,
            vehicle_type: vehicle.vehicle_type || 'TRUCK',
            capacity_kg: vehicle.capacity_kg || 3000,
          },
          stops: stops,
          distance: route.total_distance ? route.total_distance / 1000 : 0,
          duration: route.total_distance ? Math.round((route.total_distance / 1000) * 3) : 0,
          load_kg: route.total_load || 0,
          capacity_utilization: route.capacity_utilization || 0,
          optimization_method: 'Enhanced Multi-Vehicle CVRP',
        };
      });
  }

  /**
   * Create fallback route if CVRP fails
   */
  createFallbackRoute(pickup, deliveries, vehicle) {
    const stops = [
      {
        type: 'pickup',
        location: { latitude: pickup.lat, longitude: pickup.lng },
        name: pickup.name || 'Pickup Point',
        cumulative_load: 0,
      },
      ...deliveries.map((delivery, index) => ({
        type: 'delivery',
        location: { latitude: delivery.lat, longitude: delivery.lng },
        name: delivery.customer_name || `Delivery ${index + 1}`,
        order_id: delivery.order_id || delivery.id,
        cumulative_load: (delivery.load_kg || 1) * (index + 1),
        demand: delivery.load_kg || 1,
      })),
      {
        type: 'return',
        location: { latitude: pickup.lat, longitude: pickup.lng },
        name: pickup.name || 'Return to Pickup',
        cumulative_load: 0,
      },
    ];

    return [
      {
        id: `fallback-route-${vehicle.fleet_id || vehicle.id}`,
        vehicle: {
          fleet_id: vehicle.fleet_id || vehicle.id,
          vehicle_type: vehicle.vehicle_type || 'TRUCK',
          capacity_kg: vehicle.capacity_kg || 3000,
        },
        stops: stops,
        distance: deliveries.length * 5, // Rough estimate: 5km per delivery
        duration: deliveries.length * 15, // Rough estimate: 15min per delivery
        load_kg: deliveries.reduce((sum, d) => sum + (d.load_kg || 1), 0),
        capacity_utilization: 50, // Conservative estimate
        optimization_method: 'Fallback Simple Route',
      },
    ];
  }

  /**
   * Calculate summary statistics for all routes
   */
  calculateSummary(routes) {
    if (routes.length === 0) {
      return {
        total_routes: 0,
        total_distance: 0,
        total_duration: 0,
        total_deliveries: 0,
        total_load: 0,
        average_route_distance: 0,
        average_load_per_vehicle: 0,
      };
    }

    return {
      total_routes: routes.length,
      total_distance: routes.reduce((sum, r) => sum + (r.distance || 0), 0),
      total_duration: routes.reduce((sum, r) => sum + (r.duration || 0), 0),
      total_deliveries: routes.reduce(
        (sum, r) => sum + r.stops.filter((s) => s.type === 'delivery').length,
        0
      ),
      total_load: routes.reduce((sum, r) => sum + (r.load_kg || 0), 0),
      average_route_distance:
        routes.reduce((sum, r) => sum + (r.distance || 0), 0) / routes.length,
      average_load_per_vehicle: routes.reduce((sum, r) => sum + (r.load_kg || 0), 0) / routes.length,
    };
  }
}

// Export singleton instance
module.exports = new EnhancedCVRPOptimizer();
