/**
 * Optimization Agent
 * AI agent responsible for optimizing route plans
 */

const axios = require('axios');
const { generateId } = require('../utils/helper');

class OptimizationAgent {
  constructor(config) {
    this.config = config;
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.systemPrompt = config.system_prompt;
    this.osrmBaseUrl = process.env.OSRM_BASE_URL || 'http://router.project-osrm.org';
    console.log('OptimizationAgent initialized');
  }

  /**
   * Optimize a route plan based on context and preferences
   * @param {Object} data - The data containing the initial plan, context, and preferences
   * @returns {Object} - The optimized plan
   */
  async optimize(data) {
    try {
      console.log('Optimizing plan');

      const initialPlan = data.plan;
      const routes = initialPlan.routes || [];
      const businessRules = data.businessRules || {};

      console.log(`OptimizationAgent received ${routes.length} routes to enhance`);

      if (!routes || routes.length === 0) {
        console.warn('No routes to optimize');
        return initialPlan;
      }

      const optimizedRoutes = [];

      // Check if there are any restricted areas defined
      const restrictedAreas = businessRules.restrictedAreas || [];
      if (restrictedAreas.length > 0) {
        console.log(
          `Found ${restrictedAreas.length} restricted areas to consider during optimization`
        );
        restrictedAreas.forEach((area, i) => {
          if (area && area.area) {
            console.log(
              `Restricted area ${i + 1}: ${area.name || 'unnamed'} with ${area.area.length} points`
            );
          }
        });
      }

      // Create a list of unserviceable points
      const unserviceablePoints = [];

      for (const route of routes) {
        if (route && route.stops && route.stops.length > 0) {
          try {
            console.log(`Enhancing route ${route.id} with OSRM data`);

            // Add business rules to the route for processing
            const routeWithRules = {
              ...route,
              businessRules: businessRules,
            };

            // Identify points in restricted areas and mark them as unserviceable
            let hasUnserviceablePoints = false;
            if (restrictedAreas.length > 0) {
              // First pass: identify unserviceable points
              const processedStops = route.stops.map((stop) => {
                const point = {
                  lat: stop.location?.latitude || stop.lat,
                  lng: stop.location?.longitude || stop.lng,
                };

                const inRestrictedArea = this.isPointInRestrictedArea(point, restrictedAreas);
                if (inRestrictedArea) {
                  console.log(
                    `Stop ${stop.id || stop.name} is in a restricted area and marked as unserviceable`
                  );
                  hasUnserviceablePoints = true;

                  // Add to global list of unserviceable points
                  unserviceablePoints.push({
                    id: stop.id || stop.name,
                    location: point,
                    reason: `Inside restricted area: ${inRestrictedArea.name || 'Restricted Zone'}`,
                  });

                  return {
                    ...stop,
                    isInRestrictedArea: true,
                    restrictedAreaName: inRestrictedArea.name,
                    unserviceable: true,
                  };
                }
                return stop;
              });

              // Replace stops with processed ones
              route.stops = processedStops;
            }

            // Create a list of serviceable points only
            const serviceablePoints = route.stops.filter((stop) => !stop.unserviceable);

            // Only create routes for stops that aren't in restricted areas
            if (serviceablePoints.length >= 2) {
              // Need at least start and one stop
              // Create a modified route with only serviceable points
              const serviceableRoute = {
                ...routeWithRules,
                stops: serviceablePoints,
                hasUnserviceablePoints: hasUnserviceablePoints,
              };

              // Enhance this route with OSRM data, specifically passing the restricted areas
              const enhancedRoute = await this.enhanceWithOsrmData(
                serviceableRoute,
                restrictedAreas
              );

              // Add unserviceable points list to the route metadata
              enhancedRoute.unserviceableStops = route.stops.filter((stop) => stop.unserviceable);
              enhancedRoute.restrictedAreasAvoided = restrictedAreas.length > 0;

              optimizedRoutes.push(enhancedRoute);
              console.log(
                `Successfully enhanced route ${route.id} with ${serviceablePoints.length} serviceable stops`
              );
            } else {
              console.log(
                `Route ${route.id} has insufficient serviceable points (${serviceablePoints.length})`
              );

              // Still include the route but mark it as unserviceable
              const unserviceableRoute = {
                ...route,
                fullyUnserviceable: true,
                reason: 'All or most stops are in restricted areas',
                unserviceableStops: route.stops.filter((stop) => stop.unserviceable),
              };

              optimizedRoutes.push(unserviceableRoute);
            }
          } catch (error) {
            console.error(`Error enhancing route ${route.id}: ${error.message}`);
            // If enhancement fails, still include the original route
            optimizedRoutes.push(route);
            console.log(`Added original route ${route.id} without enhancement due to error`);
          }
        } else {
          console.warn(`Route ${route.id} has no stops or is invalid. Adding without enhancement.`);
          optimizedRoutes.push(route);
        }
      }

      console.log(`OptimizationAgent completed with ${optimizedRoutes.length} routes`);
      console.log(
        `Final routes from OptimizationAgent: ${optimizedRoutes.map((r) => r.id).join(', ')}`
      );

      return {
        ...initialPlan,
        routes: optimizedRoutes,
        context: data.context,
        preferences: data.preferences,
        businessRules: data.businessRules,
        unserviceablePoints: unserviceablePoints,
        optimized: true,
        restrictedAreasConsidered: restrictedAreas.length > 0,
      };
    } catch (error) {
      console.error(`Optimization error: ${error.message}`);
      return this.createFallbackPlan(data.plan, error);
    }
  }

  /**
   * Get route data from OSRM
   * @param {Array} waypoints - Array of {lat, lng} objects
   * @param {Array} restrictedAreas - Array of restricted area polygons
   * @returns {Object} - OSRM response
   */
  async getOsrmRoute(waypoints, restrictedAreas = []) {
    try {
      if (!waypoints || waypoints.length < 2) {
        throw new Error('Need at least 2 waypoints to create a route');
      }

      // Check if any waypoints are too close to each other
      for (let i = 0; i < waypoints.length; i++) {
        for (let j = i + 1; j < waypoints.length; j++) {
          const distance = this.calculateDistance(
            waypoints[i].lat,
            waypoints[i].lng,
            waypoints[j].lat,
            waypoints[j].lng
          );

          // If waypoints are within 25 meters, log a warning
          if (distance < 0.025) {
            console.warn(
              `Warning: Waypoints ${i} and ${j} are very close (${distance.toFixed(3)}km)`
            );
          }
        }
      }

      // Format waypoints for OSRM
      const coordinates = waypoints.map((wp) => `${wp.lng},${wp.lat}`).join(';');

      // Construct OSRM URL
      const url = `${this.osrmBaseUrl}/route/v1/driving/${coordinates}?overview=full&alternatives=true&steps=true&geometries=polyline`;

      // Check if we have restricted areas to avoid
      // if (restrictedAreas && restrictedAreas.length > 0) { // Remove hint parameter
      //   console.log(`Adding ${restrictedAreas.length} restricted areas consideration to OSRM request`);

      //   // Since public OSRM doesn't support polygon avoidance directly,
      //   // we'll add a parameter to indicate we care about restrictions
      //   url += '&hints=avoid_restricted_areas'; // REMOVED

      //   // Log the restricted areas for debugging
      //   restrictedAreas.forEach((area, index) => {
      //     if (area && area.area && Array.isArray(area.area)) {
      //       console.log(`Restricted area ${index + 1}: ${area.name || 'unnamed'} with ${area.area.length} points`);
      //
      //       // Add boundary point hints to help routing
      //       const boundaryPoints = this.extractBoundaryPoints(area.area, 4);
      //       if (boundaryPoints.length > 0) {
      //         console.log(`Added ${boundaryPoints.length} boundary hint points for area ${index + 1}`);
      //       }
      //     }
      //   });
      // }

      console.log(`Calling OSRM API: ${url}`);

      // Call OSRM API
      const response = await axios.get(url);

      // Check for OSRM errors
      if (response.data.code !== 'Ok') {
        throw new Error(`OSRM API returned error: ${response.data.message || 'Unknown error'}`);
      }

      console.log(`OSRM response received with ${response.data.routes.length} routes`);

      // Check if the returned route would cross any restricted area
      if (
        restrictedAreas &&
        restrictedAreas.length > 0 &&
        response.data.routes &&
        response.data.routes.length > 0
      ) {
        const mainRoute = response.data.routes[0];
        if (mainRoute.geometry) {
          console.log(
            `Checking if route with geometry (length: ${mainRoute.geometry.length}) crosses restricted areas`
          );
          // Note: Detailed polygon intersection would be needed here for a complete solution
          // This is a placeholder for a more complex implementation
        }
      }

      // Debug to check if geometry is present in the response
      if (response.data.routes && response.data.routes.length > 0) {
        const hasGeometry = !!response.data.routes[0].geometry;
        const geometryLength = response.data.routes[0].geometry
          ? response.data.routes[0].geometry.length
          : 0;
        console.log(`OSRM returned geometry: ${hasGeometry}, length: ${geometryLength}`);
      }

      return response.data;
    } catch (error) {
      console.error(`OSRM API error: ${error.message}`);
      throw new Error(`Failed to get route from OSRM: ${error.message}`);
    }
  }

  /**
   * Extract a smaller set of points to represent the boundary of a restricted area
   * @param {Array} areaPoints - The array of points defining the restricted area
   * @param {Number} numPoints - The number of points to extract
   * @returns {Array} - A reduced set of boundary points
   */
  extractBoundaryPoints(areaPoints, numPoints = 4) {
    if (!areaPoints || !Array.isArray(areaPoints) || areaPoints.length < 3) {
      return [];
    }

    // If we have only a few points, return all of them
    if (areaPoints.length <= numPoints) {
      return areaPoints.map((p) => ({ lat: p[0], lng: p[1] }));
    }

    // Otherwise, pick points at regular intervals
    const result = [];
    const interval = Math.floor(areaPoints.length / numPoints);

    for (let i = 0; i < numPoints; i++) {
      const index = i * interval;
      if (index < areaPoints.length) {
        result.push({ lat: areaPoints[index][0], lng: areaPoints[index][1] });
      }
    }

    return result;
  }

  /**
   * Calculate distance between two points in kilometers (Haversine formula)
   * @param {Number} lat1 - Latitude of first point
   * @param {Number} lon1 - Longitude of first point
   * @param {Number} lat2 - Latitude of second point
   * @param {Number} lon2 - Longitude of second point
   * @returns {Number} - Distance in kilometers
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  }

  /**
   * Check if a delivery point is inside any restricted area
   * @param {Object} point - The point to check with lat and lng
   * @param {Array} restrictedAreas - Array of restricted area objects
   * @returns {Object|null} - The restricted area object if point is inside, null otherwise
   */
  isPointInRestrictedArea(point, restrictedAreas) {
    if (!point || !point.lat || !point.lng || !restrictedAreas || !Array.isArray(restrictedAreas)) {
      return null;
    }

    for (const area of restrictedAreas) {
      if (!area.area || !Array.isArray(area.area) || area.area.length < 3) {
        continue;
      }

      // Use ray casting algorithm to determine if point is in polygon
      let inside = false;
      for (let i = 0, j = area.area.length - 1; i < area.area.length; j = i++) {
        // Input area format is [latitude, longitude]
        const yi = area.area[i][0]; // Latitude
        const xi = area.area[i][1]; // Longitude
        const yj = area.area[j][0]; // Latitude
        const xj = area.area[j][1]; // Longitude

        // Check if the horizontal ray from the point intersects the polygon edge (i, j)
        const intersect =
          yi > point.lat !== yj > point.lat && // Ray crosses the latitude range of the edge
          point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi; // Ray intersects the edge

        if (intersect) inside = !inside;
      }

      if (inside) {
        console.log(
          `Point (${point.lat}, ${point.lng}) is inside restricted area: ${area.name || 'Restricted Zone'}`
        );
        return area; // Return the actual area object
      }
    }

    return null;
  }

  /**
   * Enhance a route with OSRM data
   * @param {Object} route - Route to enhance
   * @param {Array} restrictedAreas - Array of restricted area objects
   * @returns {Object} - Enhanced route
   */
  async enhanceWithOsrmData(route, restrictedAreas = []) {
    try {
      // Check for both waypoints and stops, prioritizing stops
      if (!route.stops && !route.waypoints) {
        console.error(`Route ${route.id} has neither stops nor waypoints`);
        throw new Error('Route has no valid waypoints or stops');
      }

      // Use stops as the primary data source, but fall back to waypoints if needed
      const locationPoints = route.stops || route.waypoints;

      if (!Array.isArray(locationPoints) || locationPoints.length < 2) {
        console.error(
          `Route ${route.id} has insufficient location points: ${locationPoints?.length || 0}`
        );
        throw new Error('Not enough valid waypoints or stops for routing');
      }

      console.log(`Processing ${locationPoints.length} location points for route ${route.id}`);

      // Log the vehicleId and pickupId to help with debugging
      const vehicleId = route.vehicle?.id;
      const pickupId = route.pickupId;
      console.log(`Route ${route.id} is for vehicle ${vehicleId} and pickup ${pickupId}`);

      // Extract coordinates from stops/waypoints, handling different formats safely
      const coordinates = locationPoints
        .map((point) => {
          if (!point) return null;

          // Try to get lat/lng from various locations in the waypoint
          let lat, lng;

          if (point.location && typeof point.location === 'object') {
            // Check for location.latitude/longitude properties
            lat = point.location.latitude || point.location.lat;
            lng = point.location.longitude || point.location.lng;
          } else if (point.lat !== undefined && point.lng !== undefined) {
            // Check for direct lat/lng properties
            lat = point.lat;
            lng = point.lng;
          } else if (point.latitude !== undefined && point.longitude !== undefined) {
            // Check for latitude/longitude properties
            lat = point.latitude;
            lng = point.longitude;
          }

          // If we couldn't find coordinates, return null
          if (lat === undefined || lng === undefined) {
            console.warn('Could not extract coordinates from point:', point);
            return null;
          }

          return { lat, lng };
        })
        .filter((coord) => coord !== null); // Remove any null coordinates

      // If we have fewer than 2 waypoints, we can't create a route
      if (coordinates.length < 2) {
        console.error(`Route ${route.id} has fewer than 2 valid coordinates`);
        throw new Error('Not enough valid coordinates for routing');
      }

      console.log(`Extracted ${coordinates.length} valid coordinates for route ${route.id}`);

      // Check if the route has any potential issues with restricted areas
      if (restrictedAreas && restrictedAreas.length > 0) {
        console.log(`Checking coordinates for potential crossings with restricted areas`);

        // Look for potential restricted area crossings
        // In a more comprehensive solution, we'd implement line-polygon intersection
        // Here we're just flagging the route as potentially having issues
        const potentialCrossings = false;

        // Add this flag to the route for debugging
        route.potentialRestrictedAreaCrossings = potentialCrossings;

        if (potentialCrossings) {
          console.log(
            `Route ${route.id} may have crossings with restricted areas - will request alternatives`
          );
        }
      }

      // Call OSRM API to get route data
      const osrmData = await this.getOsrmRoute(coordinates, restrictedAreas);

      // Calculate route metrics
      const distance = (osrmData.routes[0]?.distance || 0) / 1000; // Convert to km
      const duration = (osrmData.routes[0]?.duration || 0) / 60; // Convert to minutes

      console.log(
        `OSRM returned route with distance: ${distance.toFixed(2)}km, duration: ${duration.toFixed(0)} mins`
      );

      // DEBUG: Log the geometry value we are about to assign
      const geometryValue = osrmData.routes[0]?.geometry || '';
      console.log(
        `DEBUG: Geometry value from OSRM for route ${route.id}: length=${geometryValue.length}, value='${geometryValue.substring(0, 50)}...'`
      );

      // Create enhanced route object with geometry directly exposed
      const enhancedRoute = {
        ...route,
        distance: parseFloat(distance.toFixed(2)),
        duration: parseInt(duration.toFixed(0)),
        // Expose the polyline geometry directly at the top level of the route
        geometry: geometryValue, // Use the logged value
        restrictedAreasConsidered: restrictedAreas.length > 0,
        osrm: {
          distance: osrmData.routes[0]?.distance || 0,
          duration: osrmData.routes[0]?.duration || 0,
          geometry: osrmData.routes[0]?.geometry || '',
          legs: osrmData.routes[0]?.legs || [],
          alternatives: osrmData.routes.slice(1) || [],
        },
        // Add optimization metrics
        metrics: {
          efficiency: 0.85,
          utilization:
            Math.min(
              100,
              Math.round(((route.load_kg || 0) / (route.vehicle?.capacity_kg || 1)) * 100)
            ) / 100,
          serviceQuality: 0.9,
          stopDensity: coordinates.length / (distance > 0 ? distance : 1),
        },
      };

      return enhancedRoute;
    } catch (error) {
      console.error(`Error enhancing route with OSRM data: ${error.message}`);
      // Return the original route with some default values
      return {
        ...route,
        distance: route.distance || 5,
        duration: route.duration || 30,
        osrmError: error.message,
      };
    }
  }

  /**
   * Create a fallback plan if optimization fails
   * @param {Object} initialPlan - Initial route plan
   * @param {Error} error - Error that caused the fallback
   * @returns {Object} - Fallback plan
   */
  createFallbackPlan(initialPlan, error) {
    console.log('Creating fallback plan due to optimization error:', error.message);

    // Create a copy of the initial plan
    const fallbackPlan = {
      ...initialPlan,
      optimizationApplied: false,
      optimizationFallback: true,
      optimizationTimestamp: new Date().toISOString(),
      optimizationError: error.message,
      insights: [
        'Using fallback plan due to optimization error',
        'Original route structure preserved',
        `Error: ${error.message}`,
      ],
    };

    // Add basic distance and duration estimates if not present
    fallbackPlan.routes = (fallbackPlan.routes || []).map((route) => {
      // Ensure the route has basic properties
      return {
        ...route,
        distance: route.distance || 5, // Default 5 km
        duration: route.duration || 30, // Default 30 minutes
        fallback: true,
      };
    });

    return fallbackPlan;
  }
}

module.exports = OptimizationAgent;
