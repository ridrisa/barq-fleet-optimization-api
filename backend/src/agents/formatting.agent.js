/**
 * Formatting Agent
 * AI agent responsible for formatting the final API response
 */

const axios = require('axios');
const responseModel = require('../models/response.model');
const { generateId } = require('../utils/helper');

class FormatResponseAgent {
  constructor(config) {
    this.config = config;
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.systemPrompt = config.system_prompt;
    console.log('FormatResponseAgent initialized');
  }

  /**
   * Format the optimized plan into the final API response
   * @param {Object} data - Data containing plan and formatting details
   * @returns {Object} - Formatted API response
   */
  async format(data) {
    try {
      console.log('FormatResponseAgent running');

      // Extract data safely with defaults
      const optimizedPlan = data?.optimizedPlan || {};
      const request = data?.request || {};
      const originalRequest = data?.originalRequest || null;

      // Use our formatResponse method which handles null safety
      return await this.formatResponse({
        optimizedPlan,
        request,
        originalRequest,
      });
    } catch (error) {
      console.error('Formatting agent error:', error);
      return this.createFallbackResponse(error);
    }
  }

  /**
   * Format the optimized plan into the final API response
   * @param {Object} data - Data containing plan and formatting details
   * @returns {Object} - Formatted API response
   */
  async formatResponse(data) {
    try {
      const { optimizedPlan, request } = data;

      // Extract routes from optimized plan
      const optimizedRoutes = optimizedPlan.routes || [];

      // Add more detailed logging
      console.log(`FormatResponseAgent received ${optimizedRoutes.length} routes to format`);
      console.log(
        `Route data validation: ${optimizedRoutes
          .map(
            (r, i) =>
              `Route ${i}: id=${r.id}, stops=${r.stops?.length || 0}, deliveries=${r.deliveries?.length || 0}, vehicleId=${r.vehicleId || r.vehicle?.id || 'unknown'}`
          )
          .join(', ')}`
      );

      // Convert routes to standard format
      const formattedRoutes = [];

      // Enhanced logging for debugging delivery issues
      console.log(`Formatting ${optimizedRoutes.length} routes with optimizing agent's output`);

      for (const route of optimizedRoutes) {
        // Skip routes with no stops
        if (!route.stops || route.stops.length === 0) {
          console.log(`Skipping route ${route.id} with no stops`);
          continue;
        }

        // Log deliveries for this route - make sure we're seeing multiple deliveries per route
        console.log(`Route ${route.id} has ${route.deliveries?.length || 0} deliveries`);
        if (route.deliveries && route.deliveries.length > 0) {
          console.log(`Deliveries for route ${route.id}: ${JSON.stringify(route.deliveries)}`);
        }

        const formattedRoute = this.formatRoute(route, request);
        console.log(`Successfully formatted route ${route.id}`);
        formattedRoutes.push(formattedRoute);
      }

      // Log the final formatted routes
      console.log(
        `Formatted ${formattedRoutes.length} routes with ${formattedRoutes.reduce((sum, route) => sum + (route.deliveries?.length || 0), 0)} total deliveries`
      );
      console.log(
        `Final formatted routes: ${JSON.stringify(formattedRoutes.map((r) => ({ id: r.id, vehicle: r.vehicle.id, pickupId: r.pickupId, numDeliveries: r.deliveries.length })))}`
      );

      // Generate insights
      const insights = await this.generateSimpleInsights({
        routes: formattedRoutes,
      });

      // Generate summary statistics
      const summary = this.generateSummary(formattedRoutes);

      // Log the actual response being sent
      console.log(
        `Final API response will have ${formattedRoutes.length} routes in the 'routes' array`
      );

      // Return formatted response
      return {
        routes: formattedRoutes,
        summary,
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
        insights: [insights],
      };
    } catch (error) {
      console.error(`Error in FormatResponseAgent.formatResponse: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Format a route for API output
   * @param {Object} route - Route from optimized plan
   * @param {Object} request - Original request
   * @returns {Object} - Formatted route
   */
  formatRoute(route, request) {
    try {
      console.log(`Formatting route: ${route.id} with ${route.deliveries?.length || 0} deliveries`);
      console.log(`Route vehicle info: ${JSON.stringify(route.vehicle || {})}`);
      console.log(`Route pickup ID: ${route.pickupId || 'not set'}`);

      // Make sure the route has the necessary data
      if (!route || !route.stops || route.stops.length === 0) {
        console.log('Empty route or missing stops, creating minimal route');
        return {
          id: route?.id || `route-${Math.random().toString(36).substring(2, 10)}`,
          vehicle: {
            id: route?.vehicleId || route?.vehicle?.id || 'unknown',
            name: route?.vehicleName || route?.vehicle?.name || 'Unknown Vehicle',
            type: 'TRUCK',
          },
          waypoints: [],
          stops: [],
          pickupId: route?.pickupId || 'unknown',
          deliveries: route?.deliveries || [],
          load_kg: route?.load_kg || 0,
          distance: route?.distance || 0,
          duration: route?.duration || 0,
        };
      }

      // Create waypoints array
      const waypoints = [];

      // Get all stops and organize them
      const stops = [...route.stops];

      // Track the types we've already processed
      let hasStart = false;
      let hasPickup = false;
      const deliveryPoints = [];

      // Get vehicle information from fleet data
      const vehicleId = route.vehicleId || route.vehicle?.id;
      let vehicleInfo = {
        id: vehicleId || 'unknown-vehicle',
        name: route.vehicleName || route.vehicle?.name || `Vehicle ${vehicleId}`,
        type: 'TRUCK',
        capacity: 1000,
      };

      // Try to find vehicle in fleet
      if (request.fleet && Array.isArray(request.fleet)) {
        const matchingVehicle = request.fleet.find(
          (v) => v.fleet_id === vehicleId || v.id === vehicleId
        );

        if (matchingVehicle) {
          console.log(
            `Found matching vehicle in fleet: ${matchingVehicle.name || matchingVehicle.id}`
          );
          vehicleInfo = {
            id: vehicleId,
            name: matchingVehicle.name || `${matchingVehicle.vehicle_type || 'TRUCK'} ${vehicleId}`,
            type: matchingVehicle.vehicle_type || 'TRUCK',
            capacity: matchingVehicle.capacity_kg || 1000,
          };
        } else {
          console.log(`No matching vehicle found in fleet for ID: ${vehicleId}`);
          // Try to extract vehicle information directly from route
          if (route.vehicle && typeof route.vehicle === 'object') {
            vehicleInfo = {
              id: route.vehicle.id || vehicleId || 'unknown-vehicle',
              name: route.vehicle.name || `TRUCK ${vehicleId}`,
              type: route.vehicle.type || 'TRUCK',
              capacity: route.vehicle.capacity || 1000,
            };
            console.log(`Using vehicle info from route: ${JSON.stringify(vehicleInfo)}`);
          }
        }
      } else if (request.vehicles && Array.isArray(request.vehicles)) {
        // Try vehicles array if fleet is not available
        const matchingVehicle = request.vehicles.find(
          (v) => v.id === vehicleId || v.fleet_id === vehicleId
        );

        if (matchingVehicle) {
          console.log(
            `Found matching vehicle in vehicles array: ${matchingVehicle.name || matchingVehicle.id}`
          );
          vehicleInfo = {
            id: vehicleId,
            name: matchingVehicle.name || `${matchingVehicle.vehicle_type || 'TRUCK'} ${vehicleId}`,
            type: matchingVehicle.vehicle_type || 'TRUCK',
            capacity: matchingVehicle.capacity_kg || 1000,
          };
        }
      }

      // Fix vehicle name if it's undefined
      if (vehicleInfo.name.includes('undefined')) {
        vehicleInfo.name = `TRUCK ${vehicleInfo.id}`;
      }

      // Get pickup information
      const pickupStop = stops.find((stop) => stop.type === 'pickup');
      const pickupId = pickupStop?.id || route.pickupId;

      // Find the pickup in the request
      let pickupInfo = null;
      if (request.pickupPoints && Array.isArray(request.pickupPoints)) {
        pickupInfo = request.pickupPoints.find((p) => p.id === pickupId);

        if (!pickupInfo && pickupId) {
          console.log(`No matching pickup found in request for ID: ${pickupId}`);
          // Try to match by name or location
          pickupInfo = request.pickupPoints.find((p) => {
            if (pickupStop && p.name === pickupStop.name) return true;
            if (pickupStop && pickupStop.location && p.location) {
              const pLat = p.location.latitude || p.location.lat;
              const pLng = p.location.longitude || p.location.lng;
              const stopLat = pickupStop.location.latitude;
              const stopLng = pickupStop.location.longitude;

              return Math.abs(pLat - stopLat) < 0.001 && Math.abs(pLng - stopLng) < 0.001;
            }
            return false;
          });

          if (pickupInfo) {
            console.log(`Found matching pickup by name/location: ${pickupInfo.name}`);
          }
        } else if (pickupInfo) {
          console.log(`Found matching pickup in request: ${pickupInfo.name}`);
        }
      }

      // Extract all delivery items from route.deliveries
      const deliveryItems = route.deliveries || [];
      const deliveryMap = new Map();

      console.log(`Processing ${deliveryItems.length} deliveries for route ${route.id}`);

      // Create a map of delivery IDs to details from request
      if (request.deliveryPoints && Array.isArray(request.deliveryPoints)) {
        request.deliveryPoints.forEach((dp) => {
          const id = dp.id || dp.order_id;
          if (id) {
            deliveryMap.set(id, dp);
            console.log(`Mapped delivery ID ${id} to customer ${dp.customer_name || 'unknown'}`);
          }
        });
      }

      // Extract all stops
      stops.forEach((stop) => {
        if (stop.type === 'start') {
          hasStart = true;
          waypoints.push({
            id: `vehicle-start-${vehicleId}`,
            name: `${vehicleInfo.name} Start`,
            type: 'start',
            location: {
              lat: stop.location.latitude,
              lng: stop.location.longitude,
            },
          });
        } else if (stop.type === 'pickup') {
          hasPickup = true;
          waypoints.push({
            id: pickupId || stop.id || 'pickup-unknown',
            name: stop.name || pickupInfo?.name || 'Pickup Point',
            type: 'pickup',
            location: {
              lat: stop.location.latitude,
              lng: stop.location.longitude,
            },
            priority: 1,
          });
        } else if (stop.type === 'delivery') {
          // Find the corresponding delivery information
          const deliveryId = stop.id || stop.details?.id;
          console.log(`Looking for delivery data for ID: ${deliveryId}`);

          const deliveryData =
            deliveryMap.get(deliveryId) ||
            deliveryItems.find((d) => {
              if (typeof d === 'string') return d === deliveryId;
              return d.order_id === deliveryId || d.id === deliveryId;
            });

          if (deliveryData) {
            console.log(`Found delivery data for ${deliveryId}: ${JSON.stringify(deliveryData)}`);
          } else {
            console.log(`No delivery data found for ${deliveryId}`);
          }

          const customerName = deliveryData?.customer_name || stop.name || 'Unknown Customer';

          deliveryPoints.push({
            id: deliveryId || `delivery-${Math.random().toString(36).substring(2, 10)}`,
            name: customerName,
            type: 'delivery',
            location: {
              lat: stop.location.latitude,
              lng: stop.location.longitude,
            },
            timeWindow: deliveryData?.time_window || '09:00-17:00',
            priority: deliveryData?.priority || 'HIGH',
            customer: customerName,
          });
        }
      });

      // Add all delivery waypoints
      deliveryPoints.forEach((dp) => {
        waypoints.push(dp);
      });

      // Format pickup and deliveries for stops array
      const formattedStops = [];

      // Add vehicle starting location as the first stop (if available)
      // First, try to find the vehicle in the request fleet/vehicles to get its startLocation
      let vehicleStartLocation = null;

      // Check fleet.vehicles array
      if (request.fleet && Array.isArray(request.fleet)) {
        const fleetVehicle = request.fleet.find(
          (v) => v && (v.id === vehicleId || v.fleet_id === vehicleId)
        );
        if (fleetVehicle) {
          // Try startLocation first
          if (fleetVehicle.startLocation) {
            vehicleStartLocation = fleetVehicle.startLocation;
          }
          // Try current_latitude/longitude (from test-optimize-with-vehicles.js format)
          else if (fleetVehicle.current_latitude && fleetVehicle.current_longitude) {
            vehicleStartLocation = {
              latitude: fleetVehicle.current_latitude,
              longitude: fleetVehicle.current_longitude,
            };
          }
        }
      }

      // Check vehicles array if not found
      if (!vehicleStartLocation && request.vehicles && Array.isArray(request.vehicles)) {
        const vehicle = request.vehicles.find(
          (v) => v && (v.id === vehicleId || v.fleet_id === vehicleId)
        );
        if (vehicle) {
          // Try startLocation first
          if (vehicle.startLocation) {
            vehicleStartLocation = vehicle.startLocation;
          }
          // Try current_latitude/longitude
          else if (vehicle.current_latitude && vehicle.current_longitude) {
            vehicleStartLocation = {
              latitude: vehicle.current_latitude,
              longitude: vehicle.current_longitude,
            };
          }
        }
      }

      // If vehicle start location is found, add it as the first stop
      if (vehicleStartLocation) {
        formattedStops.push({
          id: `vehicle-${vehicleInfo.id}`,
          name: vehicleInfo.name || `Vehicle ${vehicleInfo.id}`,
          type: 'vehicle',
          location: {
            latitude: vehicleStartLocation.latitude || vehicleStartLocation.lat,
            longitude: vehicleStartLocation.longitude || vehicleStartLocation.lng,
          },
          address: '',
          vehicleInfo: vehicleInfo,
        });
        console.log(
          `Added vehicle start location for ${vehicleInfo.name} at [${vehicleStartLocation.latitude || vehicleStartLocation.lat}, ${vehicleStartLocation.longitude || vehicleStartLocation.lng}]`
        );
      } else {
        console.log(`No vehicle start location found for vehicle ID: ${vehicleId}`);
      }

      // Add pickup to stops
      if (pickupStop) {
        formattedStops.push({
          id: pickupId || 'pickup-unknown',
          name: pickupStop.name || pickupInfo?.name || 'Pickup Point',
          type: 'pickup',
          location: {
            latitude: pickupStop.location.latitude,
            longitude: pickupStop.location.longitude,
          },
          address: pickupInfo?.address || '',
        });
      }

      // Find all delivery stops
      stops
        .filter((stop) => stop.type === 'delivery')
        .forEach((deliveryStop) => {
          const deliveryId = deliveryStop.id || deliveryStop.details?.id;
          const deliveryData =
            deliveryMap.get(deliveryId) ||
            deliveryItems.find((d) => {
              if (typeof d === 'string') return d === deliveryId;
              return d.order_id === deliveryId || d.id === deliveryId;
            });

          const customerName =
            deliveryData?.customer_name || deliveryStop.name || 'Unknown Customer';

          formattedStops.push({
            id: `delivery-${Math.random().toString(36).substring(2, 10)}`,
            name: customerName,
            type: 'delivery',
            location: {
              latitude: deliveryStop.location.latitude,
              longitude: deliveryStop.location.longitude,
            },
            address: deliveryData?.address || '',
            timeWindow: deliveryData?.time_window || '09:00-17:00',
          });
        });

      // Get the actual deliveries from the route.deliveries array
      const actualDeliveries = [];
      if (route.deliveries && Array.isArray(route.deliveries)) {
        route.deliveries.forEach((deliveryItem) => {
          if (typeof deliveryItem === 'string') {
            // The delivery is just an ID, we need to get details from request
            const deliveryData = deliveryMap.get(deliveryItem);
            if (deliveryData) {
              actualDeliveries.push({
                order_id: deliveryItem,
                customer_name: deliveryData.customer_name || 'Unknown Customer',
                load_kg: deliveryData.load_kg || 0,
              });
              console.log(
                `Added delivery for order ${deliveryItem} with customer ${deliveryData.customer_name || 'Unknown'}`
              );
            } else {
              // If we can't find it in the map, create a minimal entry
              actualDeliveries.push({
                order_id: deliveryItem,
                customer_name: 'Unknown Customer',
                load_kg: 0,
              });
              console.log(`Added minimal delivery for order ${deliveryItem} (no details found)`);
            }
          } else if (typeof deliveryItem === 'object') {
            // The delivery is already an object with details
            const orderid =
              deliveryItem.order_id ||
              deliveryItem.id ||
              `delivery-${Math.random().toString(36).substring(2, 10)}`;
            actualDeliveries.push({
              order_id: orderid,
              customer_name: deliveryItem.customer_name || 'Unknown Customer',
              load_kg: deliveryItem.load_kg || 0,
            });
            console.log(
              `Added delivery object for order ${orderid} with customer ${deliveryItem.customer_name || 'Unknown'}`
            );
          }
        });
      }

      // If we don't have actual deliveries, try to extract them from delivery points
      if (actualDeliveries.length === 0 && deliveryPoints.length > 0) {
        deliveryPoints.forEach((dp) => {
          const deliveryData = deliveryMap.get(dp.id);
          if (deliveryData) {
            actualDeliveries.push({
              order_id: dp.id,
              customer_name: dp.name,
              load_kg: deliveryData.load_kg || 0,
            });
            console.log(`Added delivery from waypoint: ${dp.id} for customer ${dp.name}`);
          }
        });
      }

      // Final formatted route object
      const formattedRoute = {
        id: route.id || `route-${Math.random().toString(36).substring(2, 10)}`,
        vehicle: vehicleInfo,
        waypoints,
        stops: formattedStops,
        pickupId: pickupId || 'unknown',
        deliveries: actualDeliveries.length > 0 ? actualDeliveries : route.deliveries || [],
        load_kg: route.load_kg || actualDeliveries.reduce((sum, d) => sum + (d.load_kg || 0), 0),
        distance: route.distance || 0,
        duration: route.duration || 0,
        geometry: route.geometry || '',
        osrm: route.osrm || null,
        metrics: {
          efficiency: 0.85,
          utilization: 1,
          serviceQuality: 0.9,
          stopDensity: route.distance > 0 ? waypoints.length / route.distance : 0,
        },
        vehicleName: vehicleInfo.name,
      };

      console.log(
        `Formatted route: ${formattedRoute.id} with ${formattedRoute.deliveries.length} deliveries and vehicle ${formattedRoute.vehicle.name}`
      );
      return formattedRoute;
    } catch (error) {
      console.error(`Error formatting route: ${error.message}`);
      return {
        id: route?.id || `route-error-${Math.random().toString(36).substring(2, 10)}`,
        vehicle: {
          id: route?.vehicleId || route?.vehicle?.id || 'unknown',
          name: route?.vehicleName || route?.vehicle?.name || 'Unknown Vehicle',
          type: 'TRUCK',
        },
        waypoints: [],
        stops: [],
        deliveries: route?.deliveries || [],
        load_kg: 0,
        distance: 0,
        duration: 0,
      };
    }
  }

  /**
   * Generate simple insights using LLM
   * @param {Object} plan - Optimized route plan
   * @returns {String} - Insights text
   */
  async generateSimpleInsights(plan) {
    try {
      // Safety check for routes
      const routes = plan?.routes || [];
      const numRoutes = routes.length;
      const numDeliveries = routes.reduce((sum, route) => {
        const waypoints = route?.waypoints || [];
        return sum + waypoints.filter((wp) => wp && wp.type === 'delivery').length;
      }, 0);

      // If plan already has insights, return them
      if (plan.insights && Array.isArray(plan.insights) && plan.insights.length > 0) {
        return plan.insights.join('\n');
      }

      // Create a prompt for the LLM
      const messages = [
        {
          role: 'system',
          content:
            this.systemPrompt ||
            'You are an AI logistics analyst that provides concise insights about route optimization plans.',
        },
        {
          role: 'user',
          content: `Please provide a brief summary of the following logistics optimization plan. Be concise and highlight key aspects only:\n\nRoutes: ${numRoutes}\nDeliveries: ${numDeliveries}\nTotal Distance: ${Math.round((routes.reduce((sum, r) => sum + (r?.distance || 0), 0) || 0) * 10) / 10} km\nTotal Duration: ${routes.reduce((sum, r) => sum + (r?.duration || 0), 0) || 0} minutes`,
        },
      ];

      // Call the LLM API
      const response = await this.callLLMApi(messages);

      return (
        response ||
        `Optimization complete. Generated ${numRoutes} routes for ${numDeliveries} deliveries. Routes have been optimized for efficiency.`
      );
    } catch (error) {
      console.error('Error generating insights:', error);
      return 'Optimization complete. Routes generated successfully.';
    }
  }

  /**
   * Generate detailed insights using LLM
   * @param {Object} plan - Optimized route plan
   * @returns {String} - Detailed insights text
   */
  async generateDetailedInsights(plan) {
    try {
      // Extract key statistics to send to the LLM
      const routes = plan?.routes || [];
      const numRoutes = routes.length;
      const totalDistance =
        Math.round((routes.reduce((sum, r) => sum + (r?.distance || 0), 0) || 0) * 10) / 10;
      const totalDuration = routes.reduce((sum, r) => sum + (r?.duration || 0), 0) || 0;
      const numDeliveries = routes.reduce((sum, route) => {
        const waypoints = route?.waypoints || [];
        return sum + waypoints.filter((wp) => wp && wp.type === 'delivery').length;
      }, 0);

      // Create detailed plan summary
      const planSummary = {
        routes: numRoutes,
        deliveries: numDeliveries,
        totalDistance,
        totalDuration,
        vehicleUtilization: routes.map((r) => ({
          vehicleId: r?.vehicle?.fleet_id || 'unknown',
          capacityKg: r?.vehicle?.capacity_kg || 0,
          loadKg: r?.load_kg || 0,
          utilizationPercent: Math.round(
            ((r?.load_kg || 0) / (r?.vehicle?.capacity_kg || 1)) * 100
          ),
        })),
      };

      // Create a prompt for the LLM
      const messages = [
        {
          role: 'system',
          content:
            this.systemPrompt ||
            'You are an AI logistics analyst that provides detailed insights about route optimization plans. Structure your response with markdown headings.',
        },
        {
          role: 'user',
          content: `Please provide detailed insights about the following logistics optimization plan. Use markdown formatting with headings and bullet points:\n\n${JSON.stringify(planSummary, null, 2)}`,
        },
      ];

      // Call the LLM API
      const response = await this.callLLMApi(messages);

      return (
        response ||
        `# Logistics Optimization Insights\n\n## Key Performance Metrics\n- Total routes: ${numRoutes}\n- Total distance: ${totalDistance} km\n- Total deliveries: ${numDeliveries}\n\nRoutes have been optimized for efficiency.`
      );
    } catch (error) {
      console.error('Error generating detailed insights:', error);
      return '# Logistics Optimization Insights\n\nOptimization complete. Routes generated successfully.';
    }
  }

  /**
   * Call the LLM API
   * @param {Array} messages - Messages to send to the LLM
   * @returns {String} - LLM response
   */
  async callLLMApi(messages) {
    try {
      // Check if API key is available and valid
      if (
        !this.config ||
        !this.config.apiKey ||
        typeof this.config.apiKey !== 'string' ||
        this.config.apiKey.length < 10
      ) {
        console.error('GROQ API key is missing or invalid');
        throw new Error('Missing or invalid API key for LLM service');
      }

      console.log(`Calling Groq API with model: ${this.model}`);

      // Create API request
      const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      const headers = {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      };
      const data = {
        model: this.model,
        messages,
        temperature: this.config.temperature || 0.2,
        max_tokens: this.config.maxTokens || 1000,
      };

      // Call the API
      const response = await axios.post(apiUrl, data, { headers });

      // Extract response content
      return response.data.choices[0]?.message?.content || '';
    } catch (error) {
      // Enhanced error logging
      console.error('Groq API error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        apiKey: this.config.apiKey ? `${this.config.apiKey.substring(0, 5)}...` : 'missing',
      });

      if (error.response?.status === 401) {
        throw new Error('Authentication failed: Invalid API key');
      } else if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded: Too many requests to LLM API');
      }

      throw new Error(`LLM API error: ${error.message}`);
    }
  }

  /**
   * Generate summary statistics for a set of routes
   * @param {Array} routes - Formatted routes
   * @returns {Object} - Summary metrics
   */
  generateSummary(routes) {
    try {
      // Calculate summary statistics with safety checks
      const totalRoutes = Array.isArray(routes) ? routes.length : 0;
      const totalDistance = routes.reduce((sum, route) => sum + (route.distance || 0), 0);
      const totalDuration = routes.reduce((sum, route) => sum + (route.duration || 0), 0);

      // Count deliveries across all routes
      const totalDeliveries = routes.reduce((sum, route) => {
        const deliveryWaypoints = Array.isArray(route.waypoints)
          ? route.waypoints.filter((wp) => wp && wp.type === 'delivery').length
          : 0;
        return sum + deliveryWaypoints;
      }, 0);

      // Calculate total load
      const totalLoad = routes.reduce((sum, route) => sum + (route.load || 0), 0);

      // Create routing stats
      const routingStats = {
        totalClusters: totalRoutes,
        averagePointsPerCluster: totalRoutes > 0 ? (totalDeliveries / totalRoutes).toFixed(2) : 0,
        alternativeRoutesGenerated: 0,
      };

      // Create engine metrics
      const engineMetrics = {
        engineVersion: '1.0.0',
        profileUsed: 'driving',
        computationTime: 2.3, // Sample value
      };

      // Return complete summary
      return {
        total_routes: totalRoutes,
        total_distance: Math.round(totalDistance * 100) / 100,
        total_duration: totalDuration,
        total_deliveries: totalDeliveries,
        total_load: totalLoad,
        routingStats,
        engineMetrics,
      };
    } catch (error) {
      console.error('Error generating summary:', error);
      return {
        total_routes: 0,
        total_distance: 0,
        total_duration: 0,
        total_deliveries: 0,
        total_load: 0,
        error: error.message,
      };
    }
  }

  /**
   * Create a fallback response in case of errors
   * @param {Error} error - The error that occurred
   * @returns {Object} - Basic fallback response
   */
  createFallbackResponse(error) {
    return {
      routes: [],
      summary: {
        total_routes: 0,
        total_distance: 0,
        total_duration: 0,
        total_deliveries: 0,
        total_load: 0,
        error: true,
        error_message: error.message,
      },
      timestamp: new Date().toISOString(),
      insights: ['Error occurred during response formatting. Basic response returned.'],
    };
  }
}

module.exports = FormatResponseAgent;
