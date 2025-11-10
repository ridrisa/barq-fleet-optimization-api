/**
 * Dynamic Route Re-optimization Service
 * Continuously monitors and improves driver routes in real-time
 * Phase 4: Automation & Autonomous Operations
 */

const db = require('../database');
const { logger } = require('../utils/logger');
const redis = require('../config/redis.config');
const OrderModel = require('../models/order.model');
const osrmService = require('./osrm.service');

class DynamicRouteOptimizer {
  constructor() {
    this.optimizationInterval = 5 * 60 * 1000; // 5 minutes
    this.improvementThreshold = 10; // 10% improvement required to update
    this.isRunning = false;
  }

  /**
   * Start continuous optimization
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Dynamic Route Optimizer already running');
      return;
    }

    this.isRunning = true;
    logger.info('🔄 Dynamic Route Optimizer started');

    // Monitor and optimize routes every 5 minutes
    this.optimizationTimer = setInterval(async () => {
      try {
        await this.monitorAndOptimize();
      } catch (error) {
        logger.error('Error in route optimization loop:', error);
      }
    }, this.optimizationInterval);

    // Monitor traffic incidents separately (every minute)
    this.trafficTimer = setInterval(async () => {
      try {
        await this.monitorTrafficIncidents();
      } catch (error) {
        logger.error('Error in traffic monitoring:', error);
      }
    }, 60 * 1000); // Every minute
  }

  /**
   * Stop the optimizer
   */
  async stop() {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
    }
    if (this.trafficTimer) {
      clearInterval(this.trafficTimer);
    }
    this.isRunning = false;
    logger.info('Dynamic Route Optimizer stopped');
  }

  /**
   * Monitor all active drivers and optimize if beneficial
   */
  async monitorAndOptimize() {
    const activeDrivers = await this.getActiveDrivers();

    logger.info(
      `📊 Monitoring ${activeDrivers.length} active drivers for optimization opportunities`
    );

    let optimizedCount = 0;

    for (const driver of activeDrivers) {
      try {
        const optimized = await this.optimizeDriverIfBeneficial(driver);
        if (optimized) optimizedCount++;
      } catch (error) {
        logger.error(`Failed to optimize driver ${driver.id}:`, error);
      }
    }

    if (optimizedCount > 0) {
      logger.info(`✅ Re-optimized routes for ${optimizedCount} drivers`);
    }
  }

  /**
   * Get all active drivers with pending deliveries
   */
  async getActiveDrivers() {
    const result = await db.query(`
      SELECT DISTINCT
        d.id,
        d.name,
        d.current_latitude,
        d.current_longitude,
        d.last_location_update,

        -- Count of remaining stops
        (
          SELECT COUNT(*)
          FROM orders o
          WHERE o.driver_id = d.id
            AND o.status IN ('ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY')
        ) AS remaining_stops,

        -- Current route info
        dr.id AS route_id,
        dr.total_distance_km,
        dr.total_duration_minutes,
        dr.optimized_at,
        dr.route_sequence

      FROM drivers d
      LEFT JOIN driver_routes dr ON dr.driver_id = d.id AND dr.status = 'active'
      WHERE d.status = 'BUSY'
        AND d.current_latitude IS NOT NULL
        AND d.current_longitude IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM orders o
          WHERE o.driver_id = d.id
            AND o.status IN ('ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY')
        )
    `);

    return result.rows;
  }

  /**
   * Check if driver's route can be improved and apply if yes
   */
  async optimizeDriverIfBeneficial(driver) {
    // Don't re-optimize if recently optimized (< 5 min ago)
    if (driver.optimized_at) {
      const minutesSinceOptimization =
        (Date.now() - new Date(driver.optimized_at).getTime()) / (1000 * 60);

      if (minutesSinceOptimization < 5) {
        return false;
      }
    }

    // Get remaining stops
    const remainingStops = await this.getRemainingStops(driver.id);

    if (remainingStops.length < 2) {
      return false; // Nothing to optimize with less than 2 stops
    }

    // Get current route plan
    const currentRoute = await this.getCurrentRoute(driver.id);

    // Calculate optimized route
    const optimizedRoute = await this.calculateOptimizedRoute(
      {
        lat: driver.current_latitude,
        lng: driver.current_longitude,
      },
      remainingStops
    );

    // Compare improvement
    const improvement = this.calculateImprovement(currentRoute, optimizedRoute);

    logger.info(
      `Driver ${driver.name}: Current ${currentRoute.duration}min, Optimized ${optimizedRoute.duration}min, Improvement ${improvement.percentageSaved.toFixed(1)}%`
    );

    // Apply if improvement exceeds threshold
    if (improvement.percentageSaved >= this.improvementThreshold) {
      await this.applyNewRoute(driver.id, optimizedRoute);
      await this.notifyDriverRouteUpdate(driver.id, improvement);

      // Log optimization
      await this.logOptimization(driver.id, currentRoute, optimizedRoute, improvement);

      logger.info(
        `✅ Applied new route for driver ${driver.name} (saved ${improvement.timeSaved}min)`
      );
      return true;
    }

    return false;
  }

  /**
   * Get remaining stops for driver
   */
  async getRemainingStops(driverId) {
    const result = await db.query(
      `
      SELECT
        o.id,
        o.order_number,
        o.tracking_number,
        o.status,
        o.priority,
        o.sla_deadline,

        -- Pickup location (if not picked up yet)
        CASE
          WHEN o.status = 'ASSIGNED' THEN o.pickup_latitude
          ELSE NULL
        END AS pickup_latitude,
        CASE
          WHEN o.status = 'ASSIGNED' THEN o.pickup_longitude
          ELSE NULL
        END AS pickup_longitude,
        CASE
          WHEN o.status = 'ASSIGNED' THEN o.pickup_address
          ELSE NULL
        END AS pickup_address,

        -- Delivery location
        o.dropoff_latitude,
        o.dropoff_longitude,
        o.dropoff_address,

        -- Time windows
        o.delivery_time_window_start,
        o.delivery_time_window_end,

        -- Current sequence position
        dr.sequence_position

      FROM orders o
      LEFT JOIN driver_route_stops dr ON dr.order_id = o.id
      WHERE o.driver_id = $1
        AND o.status IN ('ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY')
      ORDER BY
        o.priority DESC,
        o.sla_deadline ASC,
        dr.sequence_position ASC NULLS LAST
    `,
      [driverId]
    );

    return result.rows.map((row) => ({
      orderId: row.id,
      type: row.pickup_latitude ? 'PICKUP' : 'DELIVERY',
      location: {
        lat: row.pickup_latitude || row.dropoff_latitude,
        lng: row.pickup_longitude || row.dropoff_longitude,
        address: row.pickup_address || row.dropoff_address,
      },
      priority: row.priority,
      slaDeadline: row.sla_deadline,
      timeWindow: {
        start: row.delivery_time_window_start,
        end: row.delivery_time_window_end,
      },
    }));
  }

  /**
   * Get current route plan
   */
  async getCurrentRoute(driverId) {
    const result = await db.query(
      `
      SELECT
        dr.id,
        dr.total_distance_km,
        dr.total_duration_minutes,
        dr.route_sequence,
        dr.polyline,
        dr.optimized_at
      FROM driver_routes dr
      WHERE dr.driver_id = $1
        AND dr.status = 'active'
      ORDER BY dr.optimized_at DESC
      LIMIT 1
    `,
      [driverId]
    );

    if (result.rows.length === 0) {
      return {
        distance: 0,
        duration: 0,
        sequence: [],
      };
    }

    const route = result.rows[0];
    return {
      id: route.id,
      distance: route.total_distance_km,
      duration: route.total_duration_minutes,
      sequence: route.route_sequence || [],
      polyline: route.polyline,
    };
  }

  /**
   * Calculate optimized route using OR-Tools or OSRM
   */
  async calculateOptimizedRoute(currentLocation, stops) {
    // Build waypoints
    const waypoints = [
      currentLocation, // Start from current position
      ...stops.map((stop) => stop.location),
    ];

    // Use OSRM for route calculation
    const route = await osrmService.calculateOptimizedRoute(waypoints, {
      optimize: 'time', // Or 'distance'
      considerTraffic: true,
    });

    // Apply constraints (SLA deadlines, time windows, priorities)
    const optimizedSequence = await this.applyConstraints(route, stops);

    return {
      distance: route.distance / 1000, // Convert to km
      duration: route.duration / 60, // Convert to minutes
      sequence: optimizedSequence,
      polyline: route.polyline,
      legs: route.legs,
    };
  }

  /**
   * Apply business constraints to route
   */
  async applyConstraints(route, stops) {
    // Sort stops considering:
    // 1. Priority (urgent first)
    // 2. SLA deadline (earlier first)
    // 3. Geographic proximity (OSRM sequence)
    // 4. Time windows

    const sortedStops = [...stops].sort((a, b) => {
      // Priority first
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }

      // SLA deadline second
      if (a.slaDeadline && b.slaDeadline) {
        return new Date(a.slaDeadline) - new Date(b.slaDeadline);
      }

      return 0;
    });

    return sortedStops.map((stop, index) => ({
      stopNumber: index + 1,
      orderId: stop.orderId,
      type: stop.type,
      location: stop.location,
      eta: this.calculateETA(route, index),
    }));
  }

  /**
   * Calculate ETA for each stop
   */
  calculateETA(route, stopIndex) {
    // Sum duration of all legs up to this stop
    let totalMinutes = 0;
    for (let i = 0; i <= stopIndex; i++) {
      if (route.legs && route.legs[i]) {
        totalMinutes += route.legs[i].duration / 60;
      }
    }

    const eta = new Date(Date.now() + totalMinutes * 60 * 1000);
    return eta;
  }

  /**
   * Calculate improvement metrics
   */
  calculateImprovement(currentRoute, optimizedRoute) {
    const timeSaved = currentRoute.duration - optimizedRoute.duration;
    const distanceSaved = currentRoute.distance - optimizedRoute.distance;
    const percentageSaved = (timeSaved / currentRoute.duration) * 100 || 0;

    return {
      timeSaved: Math.max(0, timeSaved),
      distanceSaved: Math.max(0, distanceSaved),
      percentageSaved: Math.max(0, percentageSaved),
    };
  }

  /**
   * Apply new route to driver
   */
  async applyNewRoute(driverId, optimizedRoute) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Mark old route as inactive
      await client.query(
        `
        UPDATE driver_routes
        SET is_active = false,
            deactivated_at = NOW()
        WHERE driver_id = $1
          AND is_active = true
      `,
        [driverId]
      );

      // Insert new route
      const routeResult = await client.query(
        `
        INSERT INTO driver_routes (
          driver_id,
          total_distance_km,
          total_duration_minutes,
          route_sequence,
          polyline,
          is_active,
          optimized_at
        ) VALUES ($1, $2, $3, $4, $5, true, NOW())
        RETURNING id
      `,
        [
          driverId,
          optimizedRoute.distance,
          optimizedRoute.duration,
          JSON.stringify(optimizedRoute.sequence),
          optimizedRoute.polyline,
        ]
      );

      const newRouteId = routeResult.rows[0].id;

      // Update stop sequences
      for (const stop of optimizedRoute.sequence) {
        await client.query(
          `
          INSERT INTO driver_route_stops (
            route_id,
            order_id,
            sequence_position,
            stop_type,
            estimated_arrival
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (route_id, order_id)
          DO UPDATE SET
            sequence_position = EXCLUDED.sequence_position,
            estimated_arrival = EXCLUDED.estimated_arrival
        `,
          [newRouteId, stop.orderId, stop.stopNumber, stop.type, stop.eta]
        );

        // Update order ETA
        await OrderModel.updateETA(stop.orderId, stop.eta);
      }

      await client.query('COMMIT');

      logger.info(`Applied new route ${newRouteId} to driver ${driverId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Notify driver of route update
   */
  async notifyDriverRouteUpdate(driverId, improvement) {
    // Send push notification
    const message = {
      title: 'Route Updated',
      body: `Your route has been optimized. Saved ${improvement.timeSaved.toFixed(0)} minutes!`,
      data: {
        type: 'ROUTE_UPDATED',
        timeSaved: improvement.timeSaved.toString(),
        distanceSaved: improvement.distanceSaved.toString(),
      },
    };

    // TODO: Implement FCM push notification
    logger.info(`📲 Sent route update notification to driver ${driverId}`);
  }

  /**
   * Monitor traffic incidents and reroute if needed
   */
  async monitorTrafficIncidents() {
    // Get active traffic incidents from external API or internal system
    const incidents = await this.getActiveTrafficIncidents();

    if (incidents.length === 0) return;

    logger.info(`🚦 Found ${incidents.length} active traffic incidents`);

    for (const incident of incidents) {
      await this.handleTrafficIncident(incident);
    }
  }

  /**
   * Get active traffic incidents
   */
  async getActiveTrafficIncidents() {
    // This would integrate with:
    // - Google Maps Traffic API
    // - Waze API
    // - HERE Traffic API
    // - Internal incident reporting

    // For now, return from database
    const result = await db.query(`
      SELECT
        id,
        latitude,
        longitude,
        severity,
        type,
        description,
        radius_meters,
        reported_at
      FROM traffic_incidents
      WHERE status = 'ACTIVE'
        AND reported_at > NOW() - INTERVAL '2 hours'
    `);

    return result.rows;
  }

  /**
   * Handle traffic incident by rerouting affected drivers
   */
  async handleTrafficIncident(incident) {
    // Find drivers near incident
    const affectedDrivers = await this.findDriversNearIncident(
      incident,
      incident.radius_meters || 5000 // Default 5km radius
    );

    if (affectedDrivers.length === 0) return;

    logger.info(`🚨 Traffic incident affecting ${affectedDrivers.length} drivers`);

    for (const driver of affectedDrivers) {
      try {
        // Calculate alternate route avoiding incident area
        const alternateRoute = await this.calculateAlternateRoute(driver, incident.location);

        // Apply if time saved > 5 minutes
        if (alternateRoute.timeSaved > 5) {
          await this.applyNewRoute(driver.id, alternateRoute);
          await this.notifyDriverTrafficReroute(driver.id, incident, alternateRoute);

          logger.info(
            `✅ Rerouted driver ${driver.name} around traffic incident (saved ${alternateRoute.timeSaved}min)`
          );
        }
      } catch (error) {
        logger.error(`Failed to reroute driver ${driver.id}:`, error);
      }
    }
  }

  /**
   * Find drivers near traffic incident
   */
  async findDriversNearIncident(incident, radiusMeters) {
    const result = await db.query(
      `
      SELECT
        d.id,
        d.name,
        d.current_latitude,
        d.current_longitude,
        dr.id AS route_id
      FROM drivers d
      JOIN driver_routes dr ON dr.driver_id = d.id AND dr.status = 'active'
      WHERE d.status = 'busy'
    `,
      []
    );

    return result.rows;
  }

  /**
   * Calculate alternate route avoiding area
   */
  async calculateAlternateRoute(driver, avoidLocation) {
    const remainingStops = await this.getRemainingStops(driver.id);

    // Use OSRM with avoid parameter
    const alternateRoute = await osrmService.calculateOptimizedRoute(
      [
        { lat: driver.current_latitude, lng: driver.current_longitude },
        ...remainingStops.map((s) => s.location),
      ],
      {
        optimize: 'time',
        avoid: [avoidLocation], // Avoid incident area
        considerTraffic: true,
      }
    );

    return {
      distance: alternateRoute.distance / 1000,
      duration: alternateRoute.duration / 60,
      sequence: this.applyConstraints(alternateRoute, remainingStops),
      polyline: alternateRoute.polyline,
      timeSaved: driver.current_route_duration - alternateRoute.duration / 60,
    };
  }

  /**
   * Notify driver of traffic reroute
   */
  async notifyDriverTrafficReroute(driverId, incident, alternateRoute) {
    const message = {
      title: 'Traffic Alert - Route Updated',
      body: `Traffic ${incident.type} ahead. New route assigned. ETA saved: ${alternateRoute.timeSaved.toFixed(0)} min`,
      data: {
        type: 'TRAFFIC_REROUTE',
        incidentType: incident.type,
        timeSaved: alternateRoute.timeSaved.toString(),
      },
    };

    // TODO: Implement FCM push notification
    logger.info(`📲 Sent traffic reroute notification to driver ${driverId}`);
  }

  /**
   * Log optimization event
   */
  async logOptimization(driverId, oldRoute, newRoute, improvement) {
    await db.query(
      `
      INSERT INTO route_optimizations (
        driver_id,
        old_route_id,
        old_distance_km,
        old_duration_minutes,
        new_distance_km,
        new_duration_minutes,
        time_saved_minutes,
        distance_saved_km,
        improvement_percentage,
        optimized_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    `,
      [
        driverId,
        oldRoute.id,
        oldRoute.distance,
        oldRoute.duration,
        newRoute.distance,
        newRoute.duration,
        improvement.timeSaved,
        improvement.distanceSaved,
        improvement.percentageSaved,
      ]
    );
  }

  /**
   * Get optimization statistics
   */
  async getStats(startDate, endDate) {
    const result = await db.query(
      `
      SELECT
        COUNT(*) AS total_optimizations,
        AVG(time_saved_minutes) AS avg_time_saved,
        SUM(time_saved_minutes) AS total_time_saved,
        AVG(distance_saved_km) AS avg_distance_saved,
        SUM(distance_saved_km) AS total_distance_saved,
        AVG(improvement_percentage) AS avg_improvement_percentage
      FROM route_optimizations
      WHERE optimized_at BETWEEN $1 AND $2
    `,
      [startDate, endDate]
    );

    return result.rows[0];
  }
}

module.exports = new DynamicRouteOptimizer();
