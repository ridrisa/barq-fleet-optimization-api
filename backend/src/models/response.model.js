/**
 * Response Model
 * Structures for API responses
 */

// Success response creator
const createSuccessResponse = (data, timeTaken = 0) => {
  return {
    success: true,
    time_taken: timeTaken,
    data,
    error: null,
  };
};

// Error response creator
const createErrorResponse = (error, details = null) => {
  return {
    success: false,
    error: error,
    details: details,
  };
};

// Create a route object
const createRoute = (tripId, vehicle, waypoints, distance, duration, geometry = null) => {
  // Extract deliveries from waypoints
  const deliveries = waypoints
    .filter((wp) => wp.type === 'delivery')
    .map((wp) => ({
      order_id: wp.delivery.order_id,
      customer_name: wp.delivery.customer_name,
      load_kg: wp.delivery.load_kg,
    }));

  // Calculate total load
  const totalLoad = deliveries.reduce((sum, del) => sum + del.load_kg, 0);

  // Create the route object
  return {
    trip_id: tripId,
    vehicle: {
      fleet_id: vehicle.fleet_id,
      vehicle_type: vehicle.vehicle_type,
      capacity_kg: vehicle.capacity_kg,
    },
    waypoints,
    distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
    duration,
    deliveries,
    geometry: geometry || 'encoded_polyline_string',
    load_kg: totalLoad,
  };
};

// Create a waypoint object
const createWaypoint = (type, location, details = null) => {
  const waypoint = {
    type, // 'start', 'delivery', or 'end'
    location: {
      lat: location.lat,
      lng: location.lng,
    },
  };

  // Add name for start/end points
  if (type === 'start' || type === 'end') {
    waypoint.name = details.name;
  }

  // Add delivery details for delivery points
  if (type === 'delivery') {
    waypoint.delivery = {
      order_id: details.order_id,
      customer_name: details.customer_name,
      load_kg: details.load_kg,
      time_window: details.time_window,
      priority: details.priority,
    };
  }

  return waypoint;
};

// Create OSRM details
const createOsrmDetails = (geometry, turnByTurn, alternatives = []) => {
  return {
    routeGeometry: geometry,
    turnByTurn,
    alternatives,
  };
};

// Create metrics for a route
const createRouteMetrics = (utilization, stopDensity, efficiency, constraints = []) => {
  return {
    vehicleUtilization: utilization,
    stopDensity,
    serviceEfficiency: efficiency,
    constraints: {
      satisfied: constraints.length === 0,
      violations: constraints,
    },
  };
};

// Create cluster information
const createClusterInfo = (clusterId, points, center) => {
  return {
    clusterId,
    pointsInCluster: points,
    centerPoint: center,
  };
};

// Create a summary of all routes
const createSummary = (routes, routingStats, osrmMetrics) => {
  // Calculate totals
  const totalRoutes = routes.length;
  const totalDistance = routes.reduce((sum, route) => sum + route.distance, 0);
  const totalDuration = routes.reduce((sum, route) => sum + route.duration, 0);
  const totalDeliveries = routes.reduce((sum, route) => sum + route.deliveries.length, 0);
  const totalLoad = routes.reduce((sum, route) => sum + route.load_kg, 0);

  return {
    total_routes: totalRoutes,
    total_distance: Math.round(totalDistance * 100) / 100,
    total_duration: totalDuration,
    total_deliveries: totalDeliveries,
    total_load: totalLoad,
    routingStats,
    osrmMetrics,
  };
};

module.exports = {
  createSuccessResponse,
  createErrorResponse,
  createRoute,
  createWaypoint,
  createOsrmDetails,
  createRouteMetrics,
  createClusterInfo,
  createSummary,
};
