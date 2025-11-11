/**
 * Planning Agent
 * AI agent responsible for creating initial route plans
 */

const axios = require('axios');
const { generateId } = require('../utils/helper');
const { v4: uuidv4 } = require('uuid');

class PlanningAgent {
  /**
   * Create a PlanningAgent instance
   * @param {Object} config - Agent configuration
   * @param {Object} llmConfig - LLM configuration
   */
  constructor(config = {}, llmConfig = {}) {
    this.config = config;
    this.llmConfig = llmConfig;
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.systemPrompt = config.system_prompt;

    console.log('Planning Agent initialized');
  }

  /**
   * Generate a route plan
   *
   * The function intelligently distributes deliveries across vehicles based on the distribution_strategy
   * specified in preferences, or automatically determines the best strategy for the scenario:
   * - For single pickup with multiple vehicles: distributes deliveries to vehicles by proximity or balanced load
   * - For multiple pickups: assigns pickups to nearest vehicles, then assigns deliveries to those pickups
   *
   * @param {Object} data - Request data
   * @returns {Object} - Generated plan
   */
  async generatePlan(data) {
    console.log('Generating plan with Planning Agent');

    // Extract data safely with better validation - handle both formats
    const pickupPoints = Array.isArray(data.pickupPoints)
      ? data.pickupPoints
          .filter(
            (p) =>
              p &&
              // Check for location.latitude/longitude format
              ((p.location &&
                typeof p.location.latitude === 'number' &&
                typeof p.location.longitude === 'number') ||
                // Check for lat/lng format
                (typeof p.lat === 'number' && typeof p.lng === 'number'))
          )
          .map((p) => {
            // Normalize to location format if using lat/lng
            const normalized = { ...p };

            if (
              !normalized.location &&
              typeof normalized.lat === 'number' &&
              typeof normalized.lng === 'number'
            ) {
              normalized.location = {
                latitude: normalized.lat,
                longitude: normalized.lng,
              };
            }

            // Ensure pickup has an ID - RESPECT CLIENT-PROVIDED ID
            if (!normalized.id) {
              // Try to use other fields as ID or generate a new one
              normalized.id =
                normalized.outlet_id ||
                normalized.hub_id ||
                normalized.name?.replace(/\s+/g, '-').toLowerCase() ||
                `pickup-${generateId()}`;

              console.log(
                `Generated pickup ID: ${normalized.id} for pickup ${normalized.name || 'unnamed'}`
              );
            } else {
              console.log(
                `Using client-provided pickup ID: ${normalized.id} for pickup ${normalized.name || 'unnamed'}`
              );
            }

            return normalized;
          })
      : [];

    const deliveryPoints = Array.isArray(data.deliveryPoints)
      ? data.deliveryPoints
          .filter(
            (d) =>
              d &&
              // Check for location.latitude/longitude format
              ((d.location &&
                typeof d.location.latitude === 'number' &&
                typeof d.location.longitude === 'number') ||
                // Check for lat/lng format
                (typeof d.lat === 'number' && typeof d.lng === 'number'))
          )
          .map((d) => {
            // Normalize to location format if using lat/lng
            const normalized = { ...d };

            if (
              !normalized.location &&
              typeof normalized.lat === 'number' &&
              typeof normalized.lng === 'number'
            ) {
              normalized.location = {
                latitude: normalized.lat,
                longitude: normalized.lng,
              };
            }

            // Ensure delivery has an ID
            if (!normalized.id && normalized.order_id) {
              normalized.id = normalized.order_id;
            } else if (!normalized.id) {
              normalized.id = `delivery-${generateId()}`;
            }

            return normalized;
          })
      : [];

    console.log(
      `After validation: ${pickupPoints.length} valid pickups, ${deliveryPoints.length} valid deliveries`
    );

    if (pickupPoints.length === 0) {
      console.error('No valid pickup points found in request');
      throw new Error(
        'No valid pickup points found. Please check that your pickup points have valid location data.'
      );
    }

    if (deliveryPoints.length === 0) {
      console.error('No valid delivery points found in request');
      throw new Error(
        'No valid delivery points found. Please check that your delivery points have valid location data.'
      );
    }

    // Extract vehicles from the fleet with better validation - support more formats
    let vehicles = [];
    if (data.fleet && Array.isArray(data.fleet.vehicles)) {
      // Format 1: fleet.vehicles array (original format)
      vehicles = data.fleet.vehicles
        .filter(
          (v) =>
            v &&
            (v.id || v.fleet_id) &&
            // Check for startLocation object
            ((v.startLocation &&
              ((typeof v.startLocation.latitude === 'number' &&
                typeof v.startLocation.longitude === 'number') ||
                (typeof v.startLocation.lat === 'number' &&
                  typeof v.startLocation.lng === 'number'))) ||
              // Check for current_latitude/longitude
              (typeof v.current_latitude === 'number' && typeof v.current_longitude === 'number') ||
              // Check for lat/lng directly on vehicle
              (typeof v.lat === 'number' && typeof v.lng === 'number'))
        )
        .map((v) => this.normalizeVehicle(v));
    } else if (Array.isArray(data.fleet)) {
      // Format 2: fleet as array
      vehicles = data.fleet
        .filter(
          (v) =>
            v &&
            (v.id || v.fleet_id) &&
            // Check for startLocation object
            ((v.startLocation &&
              ((typeof v.startLocation.latitude === 'number' &&
                typeof v.startLocation.longitude === 'number') ||
                (typeof v.startLocation.lat === 'number' &&
                  typeof v.startLocation.lng === 'number'))) ||
              // Check for current_latitude/longitude
              (typeof v.current_latitude === 'number' && typeof v.current_longitude === 'number') ||
              // Check for lat/lng directly on vehicle
              (typeof v.lat === 'number' && typeof v.lng === 'number'))
        )
        .map((v) => this.normalizeVehicle(v));
    } else if (Array.isArray(data.vehicles)) {
      // Format 3: vehicles array
      vehicles = data.vehicles
        .filter(
          (v) =>
            v &&
            (v.id || v.fleet_id) &&
            // Check for startLocation object
            ((v.startLocation &&
              ((typeof v.startLocation.latitude === 'number' &&
                typeof v.startLocation.longitude === 'number') ||
                (typeof v.startLocation.lat === 'number' &&
                  typeof v.startLocation.lng === 'number'))) ||
              // Check for current_latitude/longitude
              (typeof v.current_latitude === 'number' && typeof v.current_longitude === 'number') ||
              // Check for lat/lng directly on vehicle
              (typeof v.lat === 'number' && typeof v.lng === 'number'))
        )
        .map((v) => this.normalizeVehicle(v));
    }

    // Create a default vehicle if none is found
    if (vehicles.length === 0) {
      console.log('No valid vehicles found in request, creating a default vehicle');

      // Find a valid pickup point for the vehicle start location
      const defaultLocation = {
        latitude: 24.7136, // Default to Riyadh
        longitude: 46.6753,
      };

      // Use first pickup point location if available
      const vehicleStartLocation =
        pickupPoints.length > 0 && pickupPoints[0].location
          ? pickupPoints[0].location
          : defaultLocation;

      vehicles = [
        {
          id: `default-vehicle-${generateId()}`,
          name: 'Default Vehicle',
          type: 'truck',
          startLocation: vehicleStartLocation,
          endLocation: null,
        },
      ];
    }

    console.log(
      `Planning with ${pickupPoints.length} pickups, ${deliveryPoints.length} deliveries, and ${vehicles.length} vehicles`
    );

    // Only auto-assign deliveries to first pickup if there's just one pickup point
    // For multi-pickup scenarios, we'll let the assignment functions handle it
    if (pickupPoints.length === 1) {
      const firstPickupId = pickupPoints[0].id;
      console.log(`Single pickup scenario: auto-assigning all deliveries to ${firstPickupId}`);

      // Assign all deliveries to the first pickup point if not assigned
      deliveryPoints.forEach((delivery) => {
        if (!delivery.pickupId) {
          delivery.pickupId = firstPickupId;
          console.log(
            `Assigned delivery ${delivery.id || delivery.order_id} to pickup ${firstPickupId}`
          );
        }
      });
    } else {
      console.log(
        `Multi-pickup scenario: ${pickupPoints.length} pickup points detected, will use distance-based assignment`
      );
    }

    // Business rules
    const businessRules = data.businessRules || {};

    // Get preferences
    const preferences = data.preferences || {};

    // Create initial routes
    const routes = await this.createInitialRoutes(
      pickupPoints,
      deliveryPoints,
      vehicles,
      businessRules,
      preferences
    );

    console.log(`Created ${routes.length} initial routes`);

    return {
      routes,
      pickupPoints,
      deliveryPoints,
      vehicles,
      businessRules,
      preferences: data.preferences || {},
    };
  }

  /**
   * Normalize vehicle data from different formats
   * @param {Object} vehicle - Vehicle data in various formats
   * @returns {Object} - Normalized vehicle object
   */
  normalizeVehicle(vehicle) {
    // Create a copy to avoid modifying the original
    const result = { ...vehicle };

    // Normalize ID
    if (!result.id && result.fleet_id) {
      result.id = result.fleet_id;
    }

    // Normalize name
    if (!result.name && result.vehicle_type) {
      result.name = `${result.vehicle_type} ${result.id}`;
    }

    // Normalize type
    if (!result.type && result.vehicle_type) {
      result.type = result.vehicle_type.toLowerCase();
    }

    // Normalize startLocation
    if (!result.startLocation) {
      if (
        typeof result.current_latitude === 'number' &&
        typeof result.current_longitude === 'number'
      ) {
        // Use current_latitude/longitude if available
        result.startLocation = {
          latitude: result.current_latitude,
          longitude: result.current_longitude,
        };
      } else if (typeof result.lat === 'number' && typeof result.lng === 'number') {
        // Use lat/lng if available
        result.startLocation = {
          latitude: result.lat,
          longitude: result.lng,
        };
      }
    } else if (
      result.startLocation &&
      typeof result.startLocation.lat === 'number' &&
      typeof result.startLocation.lng === 'number'
    ) {
      // Normalize startLocation from lat/lng to latitude/longitude
      result.startLocation = {
        latitude: result.startLocation.lat,
        longitude: result.startLocation.lng,
      };
    }

    // Normalize capacity
    if (!result.capacity && result.capacity_kg) {
      result.capacity = result.capacity_kg;
    }

    return result;
  }

  /**
   * Creates initial routes based on pickup points, delivery points, and available vehicles
   *
   * Supports multiple distribution strategies:
   * - 'single_vehicle': Assign all deliveries to one vehicle (traditional approach)
   * - 'balanced_vehicles': Evenly distribute deliveries across all vehicles
   * - 'proximity_based': Assign deliveries to the nearest vehicle
   * - 'capacity_based': Distribute deliveries based on vehicle capacities
   * - 'auto': Intelligently choose the best strategy based on the scenario (default)
   *
   * @param {Array} pickupPoints - Available pickup points
   * @param {Array} deliveryPoints - Delivery points to be assigned
   * @param {Array} vehicles - Available vehicles
   * @param {Object} businessRules - Business rules
   * @param {Object} preferences - Optimization preferences
   * @returns {Array} - Array of routes
   */
  async createInitialRoutes(
    pickupPoints,
    deliveryPoints,
    vehicles,
    businessRules,
    preferences = {}
  ) {
    console.log('Creating initial routes');

    // Default constraints
    const constraints = businessRules || {};

    // Normalize pickup points
    const normalizedPickups = pickupPoints.map((pickup) => {
      // Ensure the pickup has an ID
      const pickupId = pickup.id || `pickup-${Math.random().toString(36).substring(2, 10)}`;

      // Normalize location format
      const location = pickup.location || {};
      const latitude = location.latitude || location.lat || pickup.latitude || pickup.lat;
      const longitude = location.longitude || location.lng || pickup.longitude || pickup.lng;

      return {
        id: pickupId,
        name: pickup.name || `Pickup ${pickupId}`,
        location: {
          latitude,
          longitude,
        },
        address: pickup.address || '',
        timeWindow: pickup.timeWindow || pickup.time_window,
      };
    });

    console.log(`Normalized pickup points: ${JSON.stringify(normalizedPickups, null, 2)}`);

    // Define distribution strategy (balanced, closest, regional)
    const distributionStrategy = preferences.distributionStrategy || 'auto';
    console.log(`Using distribution strategy: ${distributionStrategy}`);

    // Determine how many vehicles to use
    let numVehiclesToUse = vehicles.length;
    if (preferences.useMinVehicles) {
      // Calculate minimum vehicles needed based on total load and vehicle capacities
      const totalLoad = deliveryPoints.reduce((sum, d) => sum + (d.load_kg || 0), 0);
      const avgCapacity =
        vehicles.reduce((sum, v) => sum + (v.capacity_kg || 1000), 0) / vehicles.length;
      let minVehicles = Math.ceil(totalLoad / avgCapacity);

      // Ensure we use at least 1 vehicle
      minVehicles = Math.max(1, minVehicles);
      // Don't use more vehicles than available
      minVehicles = Math.min(minVehicles, vehicles.length);

      console.log(
        `Using ${minVehicles} vehicles out of ${vehicles.length} available (min vehicles strategy)`
      );
      numVehiclesToUse = minVehicles;
    } else if (distributionStrategy === 'auto') {
      // For auto strategy with single pickup point, use all available vehicles
      // to distribute the load efficiently
      if (normalizedPickups.length === 1 && deliveryPoints.length > vehicles.length) {
        // When we have many deliveries and one pickup point, use all vehicles
        console.log(
          `Single pickup with ${deliveryPoints.length} deliveries - using all ${vehicles.length} vehicles for distribution`
        );
        numVehiclesToUse = vehicles.length;
      } else {
        // Otherwise, use as many vehicles as we have pickup points
        const minVehicles = Math.min(normalizedPickups.length, vehicles.length);
        console.log(
          `Using ${minVehicles} vehicles out of ${vehicles.length} available (auto strategy)`
        );
        numVehiclesToUse = minVehicles;
      }
    }

    // Use only the specified number of vehicles
    const activeVehicles = vehicles.slice(0, numVehiclesToUse);

    console.log(
      `Planning with ${activeVehicles.length} active vehicles and ${normalizedPickups.length} pickup points`
    );

    // Normalize vehicle information
    const normalizedVehicles = activeVehicles.map((vehicle) => {
      const vehicleId =
        vehicle.id || vehicle.fleet_id || `vehicle-${Math.random().toString(36).substring(2, 10)}`;

      // Extract start location
      let startLocation;
      if (vehicle.startLocation) {
        startLocation = {
          latitude: vehicle.startLocation.latitude || vehicle.startLocation.lat,
          longitude: vehicle.startLocation.longitude || vehicle.startLocation.lng,
        };
      } else if (vehicle.current_latitude !== undefined) {
        startLocation = {
          latitude: vehicle.current_latitude,
          longitude: vehicle.current_longitude,
        };
      } else if (normalizedPickups.length > 0) {
        // Default to first pickup point if no location specified
        startLocation = {
          latitude: normalizedPickups[0].location.latitude,
          longitude: normalizedPickups[0].location.longitude,
        };
      } else {
        // Fallback coordinates in case no pickup points
        startLocation = { latitude: 0, longitude: 0 };
      }

      return {
        id: vehicleId,
        startLocation,
      };
    });

    console.log(`Normalized vehicles: ${JSON.stringify(normalizedVehicles, null, 2)}`);

    // Initialize map for storing vehicle start locations
    const vehicleStartLocations = {};
    normalizedVehicles.forEach((vehicle) => {
      vehicleStartLocations[vehicle.id] = vehicle.startLocation;
    });

    // Assign deliveries to pickup points
    const deliveriesByPickup = this.assignDeliveriesToPickups(
      normalizedPickups,
      deliveryPoints,
      businessRules,
      preferences
    );

    // Container for all routes
    const routes = [];

    // Track vehicle assignments
    const vehicleToPickupAssignments = new Map();
    const pickupToVehicleAssignments = new Map();

    // Initialize all pickup points with empty vehicle arrays
    normalizedPickups.forEach((pickup) => {
      pickupToVehicleAssignments.set(pickup.id, []);
    });

    // Step 2: Assign vehicles to pickup points
    console.log(
      `Planning for ${normalizedPickups.length} pickup points with ${deliveryPoints.length} deliveries and ${activeVehicles.length} vehicles`
    );

    // CASE 1: Single pickup point scenario - assign all vehicles to it
    if (normalizedPickups.length === 1) {
      const pickupId = normalizedPickups[0].id;
      activeVehicles.forEach((vehicle) => {
        const vehicleId = vehicle.id || vehicle.fleet_id;
        vehicleToPickupAssignments.set(vehicleId, pickupId);
        pickupToVehicleAssignments.get(pickupId).push(vehicleId);
      });

      console.log(
        `Single pickup center detected - using all ${activeVehicles.length} vehicles for pickup ${pickupId}`
      );
    }
    // CASE 2: Multiple pickup points with vehicles
    else if (normalizedPickups.length > 1) {
      console.log(
        'Multiple pickup centers detected - using proximity-based distribution for optimal efficiency'
      );

      // Initialize a set to track which vehicles have been assigned to routes
      const assignedVehicles = new Set();

      // Track assigned pickup points
      const assignedPickups = new Set();

      // Assign vehicles based on proximity to pickup points
      this.assignVehiclesToPickups(
        normalizedVehicles,
        normalizedPickups,
        vehicleToPickupAssignments,
        pickupToVehicleAssignments
      );
    }

    // Initialize a set to track which vehicles have been assigned to routes
    const assignedVehicles = new Set();

    // MULTI-VEHICLE DISTRIBUTION FIX: Distribute deliveries among vehicles at the same pickup
    // First, determine how many vehicles are assigned to each pickup
    const vehiclesPerPickup = new Map();
    for (const [vehicleId, pickupId] of vehicleToPickupAssignments) {
      if (!vehiclesPerPickup.has(pickupId)) {
        vehiclesPerPickup.set(pickupId, []);
      }
      vehiclesPerPickup.get(pickupId).push(vehicleId);
    }

    // Create a map to track delivery distribution
    const deliveriesPerVehicle = new Map();

    // Distribute deliveries for each pickup among its assigned vehicles
    for (const [pickupId, vehicleIds] of vehiclesPerPickup) {
      const pickupDeliveries = deliveriesByPickup[pickupId] || [];
      const vehicleCount = vehicleIds.length;

      if (vehicleCount > 1 && pickupDeliveries.length > 0) {
        console.log(`Distributing ${pickupDeliveries.length} deliveries among ${vehicleCount} vehicles at pickup ${pickupId}`);

        // Sort deliveries by priority (higher priority first)
        const sortedDeliveries = [...pickupDeliveries].sort((a, b) => (b.priority || 0) - (a.priority || 0));

        // Distribute deliveries round-robin among vehicles
        vehicleIds.forEach((vehicleId, index) => {
          const vehicleDeliveries = [];
          // Assign deliveries to this vehicle using round-robin distribution
          for (let i = index; i < sortedDeliveries.length; i += vehicleCount) {
            vehicleDeliveries.push(sortedDeliveries[i]);
          }
          deliveriesPerVehicle.set(vehicleId, vehicleDeliveries);
          console.log(`Vehicle ${vehicleId} assigned ${vehicleDeliveries.length} deliveries`);
        });
      } else if (vehicleCount === 1) {
        // Single vehicle gets all deliveries
        deliveriesPerVehicle.set(vehicleIds[0], pickupDeliveries);
      }
    }

    // Create a route for each vehicle with its assigned pickup and deliveries
    for (const vehicle of activeVehicles) {
      const vehicleId = vehicle.id || vehicle.fleet_id;

      // Get the assigned pickup for this vehicle
      const assignedPickupId = vehicleToPickupAssignments.get(vehicleId);

      if (!assignedPickupId) {
        console.warn(`No pickup assigned to vehicle ${vehicleId}, skipping route creation`);
        continue;
      }

      // Find the pickup details
      const pickup = normalizedPickups.find((p) => p.id === assignedPickupId);

      if (!pickup) {
        console.warn(
          `Could not find pickup ${assignedPickupId} for vehicle ${vehicleId}, skipping route creation`
        );
        continue;
      }

      // Get the deliveries for this vehicle (now properly distributed!)
      const deliveries = deliveriesPerVehicle.get(vehicleId) || [];

      if (deliveries.length === 0) {
        console.warn(`No deliveries assigned to pickup ${assignedPickupId}, creating empty route`);
      }

      console.log(
        `Creating route for vehicle ${vehicleId} with pickup ${assignedPickupId} and ${deliveries.length} deliveries`
      );

      // ⭐ HYBRID OPTIMIZATION: GROQ AI + Nearest Neighbor algorithm
      const optimizedDeliveries =
        deliveries.length > 1
          ? await this.optimizeDeliverySequenceWithGroq(pickup.location, deliveries, vehicleId)
          : deliveries;

      // Create waypoints array for this route
      const waypoints = [];

      // Add vehicle start location
      if (vehicleStartLocations[vehicleId]) {
        waypoints.push({
          id: `vehicle-start-${vehicleId}`,
          name: `${vehicle.name || 'Vehicle'} Start`,
          type: 'start',
          location: {
            lat: vehicleStartLocations[vehicleId].latitude,
            lng: vehicleStartLocations[vehicleId].longitude,
          },
        });
      }

      // Add pickup location as waypoint
      waypoints.push({
        id: pickup.id,
        name: pickup.name || `Pickup ${pickup.id}`,
        type: 'pickup',
        location: {
          lat: pickup.location.latitude,
          lng: pickup.location.longitude,
        },
        timeWindow: pickup.timeWindow || pickup.time_window,
        priority: pickup.priority || 1,
      });

      // Add delivery stops (NOW OPTIMIZED!)
      const deliveryStops = optimizedDeliveries.map((delivery) => {
        const stopId = delivery.id || delivery.order_id || `delivery-${this.generateId()}`;

        const waypoint = {
          id: stopId,
          name: delivery.name || delivery.customer_name || `Delivery ${stopId}`,
          type: 'delivery',
          location: {
            lat: delivery.location?.latitude || delivery.lat,
            lng: delivery.location?.longitude || delivery.lng,
          },
          timeWindow: delivery.timeWindow || delivery.time_window,
          priority: delivery.priority || 1,
        };

        waypoints.push(waypoint);

        return {
          id: stopId,
          name: delivery.name || delivery.customer_name || `Delivery ${stopId}`,
          type: 'delivery',
          location: {
            latitude: delivery.location?.latitude || delivery.lat,
            longitude: delivery.location?.longitude || delivery.lng,
          },
          address: delivery.address || '',
          timeWindow: delivery.timeWindow || delivery.time_window,
        };
      });

      // Create the route object
      const route = {
        id: `route-${this.generateId()}`,
        vehicle: {
          id: vehicleId,
          name: vehicle.name || vehicle.fleet_id || `Vehicle ${vehicleId}`,
          type: vehicle.type || vehicle.vehicle_type || 'truck',
        },
        stops: [
          {
            id: pickup.id,
            name: pickup.name || `Pickup ${pickup.id}`,
            type: 'pickup',
            location: pickup.location,
            address: pickup.address || '',
            timeWindow: pickup.timeWindow || pickup.time_window,
          },
          ...deliveryStops,
        ],
        pickupId: pickup.id,
        deliveries: optimizedDeliveries.map(
          (d) => d.id || d.order_id || `delivery-${this.generateId()}`
        ),
        load_kg: optimizedDeliveries.reduce((sum, d) => sum + (d.load_kg || 0), 0),
      };

      // Calculate accurate distance and duration using our new method
      const metrics = this.calculateRouteMetrics(waypoints);
      route.distance = metrics.distance;
      route.duration = metrics.duration;

      // Add the route to our results
      routes.push(route);

      // Mark this vehicle as assigned
      assignedVehicles.add(vehicleId);

      console.log(
        `Created OPTIMIZED route for vehicle ${vehicleId} with pickup ${pickup.id} and ${optimizedDeliveries.length} deliveries (${route.distance.toFixed(2)}km, ${route.duration} mins)`
      );
    }

    console.log(`Created ${routes.length} initial routes for ${assignedVehicles.size} vehicles`);
    return routes;
  }

  /**
   * Create messages for the LLM
   * @param {Array} pickupPoints - List of pickup points
   * @param {Array} deliveryPoints - List of delivery points
   * @param {Array} fleet - List of vehicles
   * @param {Object} businessRules - Business rules
   * @param {Object} preferences - Optimization preferences
   * @param {Object} context - Context information
   * @param {String} prompt - Optional user prompt
   * @returns {Array} - Array of messages for the LLM
   */
  createMessages(pickupPoints, deliveryPoints, fleet, businessRules, preferences, context, prompt) {
    const pickupPointsStr = JSON.stringify(pickupPoints, null, 2);
    const deliveryPointsStr = JSON.stringify(deliveryPoints, null, 2);
    const fleetStr = JSON.stringify(fleet, null, 2);
    const businessRulesStr = JSON.stringify(businessRules, null, 2);
    const preferencesStr = preferences ? JSON.stringify(preferences, null, 2) : '{}';
    const contextStr = context ? JSON.stringify(context, null, 2) : '{}';

    const messages = [
      {
        role: 'system',
        content: this.systemPrompt,
      },
      {
        role: 'user',
        content: `
I need you to create an initial route plan for our logistics operation.
Please analyze the following data and create an efficient plan that assigns deliveries to vehicles.

PICKUP POINTS:
${pickupPointsStr}

DELIVERY POINTS:
${deliveryPointsStr}

AVAILABLE FLEET:
${fleetStr}

BUSINESS RULES:
${businessRulesStr}

PREFERENCES:
${preferencesStr}

CONTEXT:
${contextStr}

${prompt ? `ADDITIONAL INSTRUCTIONS:\n${prompt}\n` : ''}

Create an initial route plan that:
1. Assigns all deliveries to appropriate vehicles
2. Respects vehicle capacities
3. Considers time windows
4. Prioritizes high-priority deliveries
5. Takes into account the context information
6. Minimizes total distance and duration

For each route, provide:
1. The assigned vehicle
2. Start point (pickup location)
3. Sequence of delivery points
4. End point (return to pickup location)
5. Estimated distance and duration

Your response should be in a structured JSON format that includes all routes with their waypoints.
`,
      },
    ];

    return messages;
  }

  /**
   * Call the LLM API with messages
   * @param {Array} messages - Messages for the LLM
   * @returns {String} - LLM response
   */
  async callLLM(messages) {
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

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: this.model,
          messages: messages,
          temperature: this.config.temperature || 0.2,
          max_tokens: this.config.maxTokens || 4096,
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data || !response.data.choices || !response.data.choices[0]) {
        console.error('Invalid response from Groq API:', response.data);
        throw new Error('Invalid response format from LLM API');
      }

      return response.data.choices[0].message.content;
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
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error('Network error: Unable to connect to LLM API');
      }

      throw new Error(`LLM API error: ${error.message}`);
    }
  }

  /**
   * Parse the LLM response and structure it
   * @param {String} response - Raw LLM response
   * @param {Object} request - Original request data
   * @returns {Object} - Structured initial plan
   */
  parseResponse(response, request) {
    try {
      console.log('Parsing LLM response for planning agent');

      // Create lookup tables for customer names and vehicle data
      const customerMap = {};
      const vehicleMap = {};

      // Extract customer data from request
      if (request && request.deliveryPoints && Array.isArray(request.deliveryPoints)) {
        request.deliveryPoints.forEach((point) => {
          if (point.order_id) {
            customerMap[point.order_id] = {
              name: point.customer_name,
              load: point.load_kg,
              timeWindow: point.time_window,
              priority: point.priority,
            };
          }
        });
      }

      // Extract vehicle data from request
      if (request && request.fleet && Array.isArray(request.fleet)) {
        request.fleet.forEach((vehicle) => {
          if (vehicle.fleet_id) {
            vehicleMap[vehicle.fleet_id] = {
              id: vehicle.fleet_id,
              type: vehicle.vehicle_type,
              capacity: vehicle.capacity_kg,
            };
          }
        });
      }

      // Parse JSON response - handle different response formats
      let parsedData;
      try {
        // Attempt to extract JSON directly from the response
        const jsonMatch =
          response.match(/```json\n([\s\S]*?)\n```/) ||
          response.match(/{[\s\S]*}/) ||
          response.match(/\[[\s\S]*\]/);

        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        } else {
          // Try JSON parsing the entire response as a fallback
          parsedData = JSON.parse(response);
        }
      } catch (parseError) {
        console.error('Error parsing LLM response as JSON:', parseError);
        throw new Error(`Failed to parse LLM response: ${parseError.message}`);
      }

      // Extract routes from the response
      const routes = Array.isArray(parsedData.routes) ? parsedData.routes : [];

      // Format the routes with proper waypoint structure and original data
      const formattedRoutes = routes.map((route, routeIndex) => {
        // Preserve original vehicle ID if available or generate fallback
        let vehicleId = route.vehicle?.id || `vehicle-${routeIndex + 1}`;
        let vehicleInfo = route.vehicle || {};

        // Use original vehicle data if we have it
        if (request.fleet && request.fleet.length > 0) {
          // Map vehicle from the fleet if possible
          const fleetVehicle = request.fleet[0]; // Use first vehicle as default
          vehicleId = fleetVehicle.fleet_id;
          vehicleInfo = {
            id: fleetVehicle.fleet_id,
            type: fleetVehicle.vehicle_type,
            capacity: fleetVehicle.capacity_kg,
          };
        }

        // Ensure waypoints have proper format and preserve customer names
        const waypoints = (route.waypoints || []).map((waypoint, wpIndex) => {
          if (waypoint.type === 'delivery') {
            // Try to match this waypoint with original delivery data
            const deliveryPoint = request.deliveryPoints && request.deliveryPoints[wpIndex - 1];

            if (deliveryPoint) {
              return {
                ...waypoint,
                id: deliveryPoint.order_id || waypoint.id,
                customer: deliveryPoint.customer_name || waypoint.customer || 'Unknown Customer',
              };
            }
          }
          return waypoint;
        });

        return {
          ...route,
          id: route.id || `route-${routeIndex + 1}`,
          vehicle: vehicleInfo,
          waypoints,
        };
      });

      // Return structured plan
      return {
        routes: formattedRoutes,
        insights: parsedData.insights || [],
        metadata: {
          generated: new Date().toISOString(),
          requestId: request.requestId || uuidv4(),
        },
      };
    } catch (error) {
      console.error(`Error parsing response: ${error.message}`);
      throw new Error(`Failed to parse response: ${error.message}`);
    }
  }

  /**
   * Create a fallback plan when the primary plan generation fails
   * @param {Error} error - The error that occurred
   * @returns {Object} - Basic fallback plan
   */
  createFallbackPlan(error) {
    return {
      routes: [],
      insights: [`Failed to generate plan: ${error.message}`],
      metadata: {
        error: true,
        errorMessage: error.message,
        generated: new Date().toISOString(),
        fallback: true,
      },
    };
  }

  /**
   * Prepare data for LLM prompt
   * @param {Object} request - Request data
   * @returns {Object} - Prepared prompt data
   */
  preparePromptData(request) {
    // Simple pass-through for now
    return request;
  }

  /**
   * Generate a plan using the LLM
   * @param {Object} promptData - Data for the prompt
   * @returns {String} - LLM response
   */
  async generateWithLLM(promptData) {
    try {
      console.log('Generating plan with LLM');

      // Extract data to build the prompt
      const { pickupPoints, deliveryPoints, fleet, businessRules, preferences, context, prompt } =
        promptData;

      // Create messages for the LLM
      const messages = this.createMessages(
        pickupPoints,
        deliveryPoints,
        fleet,
        businessRules,
        preferences,
        context,
        prompt
      );

      console.log('Calling real LLM API for route planning');

      // Call the LLM API
      const llmResponse = await this.callLLM(messages);

      return llmResponse;
    } catch (error) {
      console.error(`Error generating plan: ${error.message}`);
      throw new Error(`Failed to generate plan with LLM: ${error.message}`);
    }
  }

  /**
   * Main method to generate a plan from a request
   * @param {Object} request - The optimization request
   * @returns {Object} - The generated plan
   */
  async plan(request) {
    try {
      console.log(
        'Planning with',
        `${request.pickupPoints?.length || 0} pickups, ` +
          `${request.deliveryPoints?.length || 0} deliveries, and ` +
          `${request.fleet?.vehicles?.length || request.fleet?.length || request.vehicles?.length || 0} vehicles`
      );

      console.log(
        'Request data:',
        JSON.stringify(
          {
            pickupPoints: request.pickupPoints
              ? request.pickupPoints.map((p) => ({
                  id: p.id,
                  name: p.name,
                  location: p.location || { latitude: p.lat, longitude: p.lng },
                }))
              : [],
            deliveryPointsCount: request.deliveryPoints?.length || 0,
            fleetCount:
              request.fleet?.vehicles?.length ||
              request.fleet?.length ||
              request.vehicles?.length ||
              0,
            preferences: request.preferences,
          },
          null,
          2
        )
      );

      // Validate inputs
      if (
        !request.pickupPoints ||
        !Array.isArray(request.pickupPoints) ||
        request.pickupPoints.length === 0
      ) {
        throw new Error('At least one valid pickup point is required');
      }

      if (
        !request.deliveryPoints ||
        !Array.isArray(request.deliveryPoints) ||
        request.deliveryPoints.length === 0
      ) {
        throw new Error('At least one valid delivery point is required');
      }

      // Generate an initial plan with hybrid AI optimization
      const plan = await this.generatePlan(request);

      // Check if we have valid routes
      if (!plan.routes || plan.routes.length === 0) {
        console.error(
          'No routes were generated - this is likely due to a logic error in createInitialRoutes'
        );

        // Create a fallback plan with fallback routes
        console.log('Creating fallback plan with default routes');

        const fallbackRoutes = [];

        // Create at least one route for each pickup with the closest vehicle
        request.pickupPoints.forEach((pickup, index) => {
          const vehicle = request.fleet?.[index] ||
            request.fleet?.vehicles?.[index] ||
            request.vehicles?.[index] || {
              id: `fallback-vehicle-${index}`,
              name: `Fallback Vehicle ${index}`,
              startLocation: { latitude: pickup.lat, longitude: pickup.lng },
            };

          const vehicleId = vehicle.id || vehicle.fleet_id;

          // Find deliveries for this pickup based on region or proximity
          const deliveriesForPickup = request.deliveryPoints.filter((d) => {
            // Filter by region based on IDs if available
            if (d.order_id && pickup.id) {
              const deliveryRegion = d.order_id.split('-')[0];
              const pickupRegion = pickup.id.split('-')[0];

              // If regions match and are 3 char codes, use this match
              if (
                deliveryRegion &&
                pickupRegion &&
                deliveryRegion.length === 3 &&
                pickupRegion.length === 3 &&
                deliveryRegion === pickupRegion
              ) {
                return true;
              }
            }

            // CHANGE: Don't filter by index - instead, find all deliveries in this region
            // If no region match, use proximity to determine best pickup
            // Calculate distance to this pickup
            const deliveryLat = d.location?.latitude || d.lat;
            const deliveryLng = d.location?.longitude || d.lng;
            const pickupLat = pickup.location?.latitude || pickup.lat;
            const pickupLng = pickup.location?.longitude || pickup.lng;

            if (!deliveryLat || !deliveryLng || !pickupLat || !pickupLng) {
              return false;
            }

            // Check if this pickup is the closest to this delivery
            let isClosest = true;
            const thisDistance = this.calculateDistance(
              deliveryLat,
              deliveryLng,
              pickupLat,
              pickupLng
            );

            // Compare with other pickups
            request.pickupPoints.forEach((otherPickup, otherIndex) => {
              if (otherIndex !== index) {
                const otherLat = otherPickup.location?.latitude || otherPickup.lat;
                const otherLng = otherPickup.location?.longitude || otherPickup.lng;

                if (otherLat && otherLng) {
                  const otherDistance = this.calculateDistance(
                    deliveryLat,
                    deliveryLng,
                    otherLat,
                    otherLng
                  );
                  if (otherDistance < thisDistance) {
                    isClosest = false;
                  }
                }
              }
            });

            return isClosest;
          });

          // Create a simple route
          const fallbackRoute = {
            id: `route-${generateId()}`,
            vehicleId: vehicleId,
            vehicleName: vehicle.name || vehicle.fleet_id || `Vehicle ${vehicleId}`,
            pickupId: pickup.id || `pickup-${index}`,
            pickupName: pickup.name || `Pickup ${index}`,
            deliveries: deliveriesForPickup.map(
              (d) => d.id || d.order_id || `delivery-${generateId()}`
            ),
            load_kg: deliveriesForPickup.reduce((sum, d) => sum + (d.load_kg || 0), 0),
            stops: [
              {
                type: 'start',
                location: {
                  latitude:
                    vehicle.startLocation?.latitude || vehicle.current_latitude || pickup.lat,
                  longitude:
                    vehicle.startLocation?.longitude || vehicle.current_longitude || pickup.lng,
                },
                name: `${vehicle.name || 'Vehicle'} Start`,
                details: { type: 'start', id: `start-${vehicleId}` },
              },
              {
                type: 'pickup',
                location: {
                  latitude: pickup.location?.latitude || pickup.lat,
                  longitude: pickup.location?.longitude || pickup.lng,
                },
                name: pickup.name || `Pickup ${pickup.id || index}`,
                details: { type: 'pickup', id: pickup.id || `pickup-${index}` },
              },
              ...deliveriesForPickup.map((d) => ({
                type: 'delivery',
                location: {
                  latitude: d.location?.latitude || d.lat,
                  longitude: d.location?.longitude || d.lng,
                },
                name: d.customer_name || `Delivery ${d.id || d.order_id}`,
                details: {
                  type: 'delivery',
                  id: d.id || d.order_id || `delivery-${generateId()}`,
                  customer: d.customer_name,
                },
              })),
              {
                type: 'end',
                location: {
                  latitude: pickup.location?.latitude || pickup.lat,
                  longitude: pickup.location?.longitude || pickup.lng,
                },
                name: pickup.name || `Pickup ${pickup.id || index}`,
                details: { type: 'end', id: `end-${pickup.id || `pickup-${index}`}` },
              },
            ],
          };

          // Calculate distance and duration
          const metrics = this.calculateRouteMetrics(fallbackRoute.stops);
          fallbackRoute.distance = metrics.distance;
          fallbackRoute.duration = metrics.duration;

          fallbackRoutes.push(fallbackRoute);

          console.log(
            `Created fallback route for vehicle ${vehicleId} with pickup ${pickup.id || `pickup-${index}`} and ${deliveriesForPickup.length} deliveries`
          );
        });

        // Add fallback routes to the plan
        plan.routes = fallbackRoutes;
        console.log(`Added ${fallbackRoutes.length} fallback routes to the plan`);
      }

      // Calculate totals
      const totalDistance = this.calculateTotalDistance(plan.routes);
      const totalDuration = this.calculateTotalDuration(plan.routes);

      // Add metadata
      plan.metadata = {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
        metrics: {
          totalDistance: totalDistance,
          totalDuration: totalDuration,
          vehiclesUsed: plan.routes.length,
          completionRate: 1.0,
        },
      };

      return plan;
    } catch (error) {
      console.error('Error generating plan:', error);
      // Return a minimal valid plan with the error
      return {
        routes: [],
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: request.requestId,
        metadata: {
          error: error.message,
          errorDetails: error.stack,
          metrics: {
            totalDistance: 0,
            totalDuration: 0,
            vehiclesUsed: 0,
            completionRate: 0,
          },
        },
      };
    }
  }

  /**
   * Calculate total distance from routes
   * @param {Array} routes - Array of routes
   * @returns {number} - Total distance in kilometers
   */
  calculateTotalDistance(routes) {
    return routes.reduce((total, route) => total + (route.distance || 0), 0);
  }

  /**
   * Calculate total duration from routes
   * @param {Array} routes - Array of routes
   * @returns {number} - Total duration in minutes
   */
  calculateTotalDuration(routes) {
    return routes.reduce((total, route) => total + (route.duration || 0), 0);
  }

  /**
   * Calculate the distance in kilometers between two coordinates using the Haversine formula
   * This is more accurate for geographic distances than simple Euclidean distance
   * @param {Object} point1 - First point with lat/lng
   * @param {Object} point2 - Second point with lat/lng
   * @returns {number} Distance in kilometers
   */
  calculateGeoDistance(point1, point2) {
    if (!point1 || !point2) return 0;

    // Extract coordinates
    const lat1 = point1.lat || point1.latitude;
    const lng1 = point1.lng || point1.longitude;
    const lat2 = point2.lat || point2.latitude;
    const lng2 = point2.lng || point2.longitude;

    if (
      typeof lat1 !== 'number' ||
      typeof lng1 !== 'number' ||
      typeof lat2 !== 'number' ||
      typeof lng2 !== 'number'
    ) {
      return 0;
    }

    // Earth radius in kilometers
    const R = 6371;

    // Convert latitude and longitude from degrees to radians
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;

    // Haversine formula
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }

  /**
   * Calculate the total distance and duration for a route
   * @param {Array} waypoints - Array of waypoints in the route
   * @returns {Object} Object containing distance (km) and duration (minutes)
   */
  calculateRouteMetrics(waypoints) {
    if (!waypoints || waypoints.length < 2) {
      return { distance: 0, duration: 0 };
    }

    let totalDistance = 0;

    // Calculate total distance
    for (let i = 0; i < waypoints.length - 1; i++) {
      const current = waypoints[i].location;
      const next = waypoints[i + 1].location;
      totalDistance += this.calculateGeoDistance(current, next);
    }

    // Estimate duration based on distance and assumptions:
    // - City driving: ~30 km/h average speed (~2 minutes per km)
    // - Highway driving: ~80 km/h average speed (~0.75 minutes per km)
    // - Add time for stops: ~10 minutes per delivery stop

    // Count delivery stops
    const deliveryStops = waypoints.filter((wp) => wp.type === 'delivery').length;

    // Assume city/highway mix based on distance
    let durationMinutes;
    if (totalDistance < 10) {
      // Short urban routes: slower speed
      durationMinutes = totalDistance * 2;
    } else if (totalDistance < 50) {
      // Mixed urban/suburban routes
      durationMinutes = totalDistance * 1.5;
    } else {
      // Long distance routes with highways
      durationMinutes = totalDistance * 0.75;
    }

    // Add time for stops
    durationMinutes += deliveryStops * 10;

    // Round to nearest integer
    durationMinutes = Math.round(durationMinutes);

    return {
      distance: parseFloat(totalDistance.toFixed(2)),
      duration: durationMinutes,
    };
  }

  /**
   * Assign deliveries to pickup points based on proximity or region
   * @param {Array} pickupPoints - List of pickup points
   * @param {Array} deliveryPoints - List of delivery points
   * @param {Object} businessRules - Business rules
   * @param {Object} preferences - Preferences
   * @returns {Object} Map of pickup IDs to arrays of deliveries
   */
  assignDeliveriesToPickups(pickupPoints, deliveryPoints, businessRules = {}, preferences = {}) {
    console.log(
      `Assigning ${deliveryPoints.length} deliveries to ${pickupPoints.length} pickup points based on region and proximity`
    );

    // Create a map to store deliveries by pickup
    const deliveriesByPickup = {};

    // Initialize the map with empty arrays for each pickup
    pickupPoints.forEach((pickup) => {
      deliveriesByPickup[pickup.id] = [];
    });

    // Extract region codes from pickup IDs where available
    const pickupRegions = new Map();
    pickupPoints.forEach((pickup) => {
      // Try to extract region code from ID (e.g., "riyadh-distribution-center" → "riyadh")
      let regionCode = null;

      if (pickup.id) {
        // Check for region code in ID
        const idParts = pickup.id.split('-');
        if (idParts.length > 0) {
          regionCode = idParts[0].toUpperCase();
        }
      }

      if (pickup.name) {
        // Also check name which might have city name
        const cities = ['Riyadh', 'Jeddah', 'Dammam', 'Mecca', 'Medina', 'Tabuk', 'Abha'];
        const cityCodes = {
          Riyadh: 'RUH',
          Jeddah: 'JED',
          Dammam: 'DMM',
          Mecca: 'MKH',
          Medina: 'MED',
          Tabuk: 'TUI',
          Abha: 'AHB',
        };

        for (const city of cities) {
          if (pickup.name.includes(city)) {
            regionCode = cityCodes[city];
            break;
          }
        }
      }

      pickupRegions.set(pickup.id, regionCode);
    });

    // Log pickup locations for debugging
    console.log('Pickup locations:');
    pickupPoints.forEach((pickup) => {
      console.log(
        `${pickup.id} (${pickup.name}): ${pickup.location.latitude}, ${pickup.location.longitude}`
      );
    });

    // First pass: Assign deliveries to pickups in the same region
    // This ensures regional delivery patterns are respected
    deliveryPoints.forEach((delivery) => {
      const deliveryId = delivery.id || delivery.order_id;
      let deliveryRegion = null;

      // Extract region code from delivery ID if possible
      if (deliveryId) {
        // Check for standard formats like "RUH-001" or "DMM-D-123"
        const idParts = deliveryId.split('-');
        if (idParts.length > 0) {
          const potentialRegion = idParts[0].toUpperCase();
          // Verify it's a real region code (3-4 letters)
          if (/^[A-Z]{3,4}$/.test(potentialRegion)) {
            deliveryRegion = potentialRegion;
            console.log(
              `Detected region code ${deliveryRegion} for delivery ${deliveryId} from ID prefix`
            );
          }
        }
      }

      // If we extracted a region, try to find a matching pickup
      let assigned = false;
      if (deliveryRegion) {
        for (const [pickupId, pickupRegion] of pickupRegions.entries()) {
          if (pickupRegion === deliveryRegion) {
            deliveriesByPickup[pickupId].push(delivery);
            assigned = true;
            console.log(
              `Assigned delivery ${deliveryId} to pickup ${pickupId} based on matching region code ${deliveryRegion}`
            );
            break;
          }
        }
      }
    });

    console.log('First pass: assigning deliveries to pickups in same region');

    // Second pass: Assign remaining deliveries based on proximity
    console.log('Second pass: assigning remaining deliveries based on proximity');

    const unassignedDeliveries = deliveryPoints.filter((delivery) => {
      const deliveryId = delivery.id || delivery.order_id;
      // Check if this delivery is already assigned to any pickup
      return !Object.values(deliveriesByPickup).some((deliveries) =>
        deliveries.some((d) => (d.id || d.order_id) === deliveryId)
      );
    });

    unassignedDeliveries.forEach((delivery) => {
      const deliveryId = delivery.id || delivery.order_id;

      // Get delivery location
      const deliveryLat = delivery.location?.latitude || delivery.lat;
      const deliveryLng = delivery.location?.longitude || delivery.lng;

      if (!deliveryLat || !deliveryLng) {
        console.log(`Skipping delivery ${deliveryId} with invalid location`);
        return;
      }

      // Find closest pickup
      let closestPickup = null;
      let minDistance = Infinity;

      for (const pickup of pickupPoints) {
        const pickupLat = pickup.location?.latitude || pickup.lat;
        const pickupLng = pickup.location?.longitude || pickup.lng;

        if (!pickupLat || !pickupLng) {
          console.log(`Skipping pickup ${pickup.id} with invalid location`);
          continue;
        }

        // Calculate distance
        const distance = this.calculateDistance(deliveryLat, deliveryLng, pickupLat, pickupLng);

        console.log(
          `Distance from delivery ${deliveryId} to pickup ${pickup.id}: ${distance.toFixed(2)}km`
        );

        if (distance < minDistance) {
          minDistance = distance;
          closestPickup = pickup;
        }
      }

      if (closestPickup) {
        deliveriesByPickup[closestPickup.id].push(delivery);
        console.log(
          `Assigned delivery ${deliveryId} to nearest pickup ${closestPickup.id} (${closestPickup.name}) distance: ${minDistance.toFixed(2)}km`
        );
      } else {
        console.log(
          `Could not assign delivery ${deliveryId} to any pickup - no valid pickups found`
        );

        // Fallback: assign to first pickup if any exists
        if (pickupPoints.length > 0) {
          deliveriesByPickup[pickupPoints[0].id].push(delivery);
          console.log(
            `Fallback: assigned delivery ${deliveryId} to first pickup ${pickupPoints[0].id}`
          );
        }
      }
    });

    // Log the assignment results
    Object.entries(deliveriesByPickup).forEach(([pickupId, deliveries]) => {
      const pickup = pickupPoints.find((p) => p.id === pickupId);
      console.log(
        `Pickup ${pickupId} (${pickup?.name || 'Unknown'}) has ${deliveries.length} assigned deliveries:`
      );
      deliveries.forEach((d) => {
        console.log(`  - ${d.id || d.order_id}: ${d.customer_name || 'unnamed'}`);
      });
    });

    return deliveriesByPickup;
  }

  /**
   * Assign vehicles to pickup points based on proximity
   * @param {Array} vehicles - List of vehicles
   * @param {Array} pickupPoints - List of pickup points
   * @param {Map} vehicleToPickupAssignments - Output map of vehicle ID to pickup ID
   * @param {Map} pickupToVehicleAssignments - Output map of pickup ID to array of vehicle IDs
   */
  assignVehiclesToPickups(
    vehicles,
    pickupPoints,
    vehicleToPickupAssignments,
    pickupToVehicleAssignments
  ) {
    console.log(
      `Assigning ${vehicles.length} vehicles to ${pickupPoints.length} pickup points using proximity matching`
    );

    // Create an array to store all vehicle-to-pickup distances
    const distanceScores = [];

    // Calculate distances and check for region matches
    vehicles.forEach((vehicle) => {
      const vehicleId = vehicle.id;
      // Try to extract region code from vehicle ID
      let vehicleRegion = null;

      if (vehicleId) {
        // Check for standard formats like "RUH-VEH-001"
        const idParts = vehicleId.split('-');
        if (idParts.length > 0) {
          const potentialRegion = idParts[0].toUpperCase();
          // Verify it's a real region code (3-4 letters)
          if (/^[A-Z]{3,4}$/.test(potentialRegion)) {
            vehicleRegion = potentialRegion;
            console.log(
              `Detected region code ${vehicleRegion} for vehicle ${vehicleId} from ID prefix`
            );
          }
        }
      }

      // Get vehicle location
      const vehicleLat = vehicle.startLocation?.latitude || vehicle.lat;
      const vehicleLng = vehicle.startLocation?.longitude || vehicle.lng;

      if (!vehicleLat || !vehicleLng) {
        console.log(`Warning: Vehicle ${vehicleId} has no valid location, using default`);
      }

      // Calculate distance to each pickup
      pickupPoints.forEach((pickup) => {
        const pickupId = pickup.id;

        // Try to extract region code from pickup ID
        let pickupRegion = null;
        if (pickupId) {
          const idParts = pickupId.split('-');
          if (idParts.length > 0) {
            const potentialRegion = idParts[0].toUpperCase();
            if (/^[A-Z]{3,4}$/.test(potentialRegion)) {
              pickupRegion = potentialRegion;
            }
          }
        }

        // Also check pickup name for region/city
        if (pickup.name) {
          const cities = ['Riyadh', 'Jeddah', 'Dammam', 'Mecca', 'Medina', 'Tabuk', 'Abha'];
          const cityCodes = {
            Riyadh: 'RUH',
            Jeddah: 'JED',
            Dammam: 'DMM',
            Mecca: 'MKH',
            Medina: 'MED',
            Tabuk: 'TUI',
            Abha: 'AHB',
          };

          for (const city of cities) {
            if (pickup.name.includes(city)) {
              pickupRegion = cityCodes[city];
              break;
            }
          }
        }

        if (!pickupRegion) {
          console.log(
            `No region code detected for pickup ${pickupId}, will use proximity matching`
          );
        }

        // Get pickup location
        const pickupLat = pickup.location?.latitude || pickup.lat;
        const pickupLng = pickup.location?.longitude || pickup.lng;

        // Calculate distance
        const distance = this.calculateDistance(vehicleLat, vehicleLng, pickupLat, pickupLng);

        // Calculate estimated driving time (simple approximation)
        const drivingTimeHours = distance / 40; // Assume 40 km/h average speed

        // Check if there's a region match
        const regionMatch = vehicleRegion && pickupRegion && vehicleRegion === pickupRegion;

        console.log(
          `Distance from vehicle ${vehicleId} to pickup ${pickupId}: ${distance.toFixed(2)}km (Est. driving time: ${drivingTimeHours.toFixed(2)}h, Region match: ${regionMatch})`
        );

        // Calculate a score (lower is better)
        // Give MUCH higher priority to region matches by making their scores much lower
        const score = regionMatch ? distance * 0.1 : distance * 10;

        distanceScores.push({
          vehicleId,
          pickupId,
          distance,
          regionMatch,
          score,
        });
      });
    });

    // Sort by score (ascending) - prioritizing region matches much more strongly
    distanceScores.sort((a, b) => a.score - b.score);

    // Log sorted distances
    console.log('Sorted vehicle distances by region match and proximity:');
    distanceScores.forEach((score) => {
      console.log(
        `- Vehicle ${score.vehicleId} to Pickup ${score.pickupId}: ${score.distance.toFixed(2)}km, Region match: ${score.regionMatch}, Score: ${score.score.toFixed(2)}`
      );
    });

    console.log('First pass: matching vehicles to pickups based on region match and proximity');

    // First pass: assign vehicles to pickups based on sorted distances
    const assignedVehicles = new Set();
    const assignedPickups = new Set();

    // Go through each vehicle-pickup pair in order of preference
    distanceScores.forEach((score) => {
      const { vehicleId, pickupId, distance, regionMatch } = score;

      // Skip if vehicle or pickup is already assigned
      if (assignedVehicles.has(vehicleId) || assignedPickups.has(pickupId)) {
        return;
      }

      // Make the assignment
      vehicleToPickupAssignments.set(vehicleId, pickupId);
      pickupToVehicleAssignments.get(pickupId).push(vehicleId);

      // Mark as assigned
      assignedVehicles.add(vehicleId);
      assignedPickups.add(pickupId);

      console.log(
        `Assigned vehicle ${vehicleId} to pickup ${pickupId} (distance: ${distance.toFixed(2)}km, Region match: ${regionMatch})`
      );
    });

    // Second pass: ensure all vehicles are assigned to some pickup
    vehicles.forEach((vehicle) => {
      const vehicleId = vehicle.id;

      if (!assignedVehicles.has(vehicleId)) {
        // Find best unassigned pickup
        let bestPickup = null;

        for (const pickup of pickupPoints) {
          const pickupId = pickup.id;

          if (!assignedPickups.has(pickupId)) {
            bestPickup = pickup;
            break;
          }
        }

        // If no unassigned pickup, use the one with fewest vehicles
        if (!bestPickup) {
          let minVehicles = Infinity;
          for (const pickup of pickupPoints) {
            const pickupId = pickup.id;
            const vehicleCount = pickupToVehicleAssignments.get(pickupId).length;

            if (vehicleCount < minVehicles) {
              minVehicles = vehicleCount;
              bestPickup = pickup;
            }
          }
        }

        if (bestPickup) {
          // Assign this vehicle to the best pickup
          vehicleToPickupAssignments.set(vehicleId, bestPickup.id);
          pickupToVehicleAssignments.get(bestPickup.id).push(vehicleId);
          assignedVehicles.add(vehicleId);

          console.log(`Second pass: assigned vehicle ${vehicleId} to pickup ${bestPickup.id}`);
        }
      }
    });

    // Third pass: ensure all pickups have at least one vehicle
    pickupPoints.forEach((pickup) => {
      const pickupId = pickup.id;

      if (pickupToVehicleAssignments.get(pickupId).length === 0) {
        // Find an vehicle with the fewest assignments
        let bestVehicle = null;
        let minAssignments = Infinity;

        for (const vehicle of vehicles) {
          const vehicleId = vehicle.id;
          const assignedPickup = vehicleToPickupAssignments.get(vehicleId);
          const vehicleCount = pickupToVehicleAssignments.get(assignedPickup).length;

          if (vehicleCount < minAssignments) {
            minAssignments = vehicleCount;
            bestVehicle = vehicle;
          }
        }

        if (bestVehicle) {
          const vehicleId = bestVehicle.id;
          const currentPickup = vehicleToPickupAssignments.get(vehicleId);

          // Remove from current pickup
          pickupToVehicleAssignments.set(
            currentPickup,
            pickupToVehicleAssignments.get(currentPickup).filter((id) => id !== vehicleId)
          );

          // Assign to this pickup
          vehicleToPickupAssignments.set(vehicleId, pickupId);
          pickupToVehicleAssignments.get(pickupId).push(vehicleId);

          console.log(
            `Third pass: reassigned vehicle ${vehicleId} from pickup ${currentPickup} to pickup ${pickupId}`
          );
        }
      }
    });

    console.log(
      `Finished vehicle assignments: ${assignedVehicles.size}/${vehicles.length} vehicles assigned to ${assignedPickups.size}/${pickupPoints.length} pickups`
    );

    // Log the final assignments
    console.log('Vehicle to pickup assignments:');
    vehicleToPickupAssignments.forEach((pickupId, vehicleId) => {
      console.log(`- Vehicle ${vehicleId} → Pickup ${pickupId}`);
    });

    return { vehicleToPickupAssignments, pickupToVehicleAssignments };
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @param {number} lat1 - Latitude of first point
   * @param {number} lng1 - Longitude of first point
   * @param {number} lat2 - Latitude of second point
   * @param {number} lng2 - Longitude of second point
   * @returns {number} Distance in kilometers
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    // If any coordinates are invalid, return a large distance
    if (!lat1 || !lng1 || !lat2 || !lng2) {
      return 10000; // Large value to indicate invalid distance
    }

    const R = 6371; // Radius of the Earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  }

  /**
   * Convert degrees to radians
   * @param {number} deg - Degrees
   * @returns {number} Radians
   */
  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Optimize delivery sequence using Nearest Neighbor algorithm
   * @param {Object} startLocation - Starting location (pickup point) {latitude, longitude}
   * @param {Array} deliveries - Array of delivery objects with location
   * @returns {Array} - Optimized sequence of deliveries
   */
  optimizeDeliverySequence(startLocation, deliveries) {
    // If no deliveries or only one, no optimization needed
    if (!deliveries || deliveries.length <= 1) {
      return deliveries;
    }

    try {
      console.log(
        `Optimizing sequence for ${deliveries.length} deliveries using Nearest Neighbor algorithm`
      );

      // Create a copy to avoid modifying original
      const unvisited = [...deliveries];
      const optimized = [];

      // Start from the pickup location
      let currentLat = startLocation.latitude;
      let currentLng = startLocation.longitude;

      // While there are unvisited deliveries
      while (unvisited.length > 0) {
        let nearestIndex = 0;
        let nearestDistance = Infinity;

        // Find the nearest unvisited delivery
        for (let i = 0; i < unvisited.length; i++) {
          const delivery = unvisited[i];
          const deliveryLat = delivery.location?.latitude || delivery.lat;
          const deliveryLng = delivery.location?.longitude || delivery.lng;

          if (!deliveryLat || !deliveryLng) {
            console.warn(`Delivery ${i} missing location data, skipping`);
            continue;
          }

          const distance = this.calculateDistance(currentLat, currentLng, deliveryLat, deliveryLng);

          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = i;
          }
        }

        // Add nearest delivery to optimized route
        const nearest = unvisited.splice(nearestIndex, 1)[0];
        optimized.push(nearest);

        // Update current location to the delivery we just added
        currentLat = nearest.location?.latitude || nearest.lat;
        currentLng = nearest.location?.longitude || nearest.lng;
      }

      console.log(`Route optimization complete - delivery sequence optimized`);
      return optimized;
    } catch (error) {
      console.error(`Error in delivery sequence optimization: ${error.message}`);
      // Return original deliveries if optimization fails
      return deliveries;
    }
  }

  /**
   * Hybrid optimization: Use GROQ AI to enhance Nearest Neighbor algorithm
   * @param {Object} startLocation - Starting location (pickup point) {latitude, longitude}
   * @param {Array} deliveries - Array of delivery objects with location
   * @param {String} vehicleId - Vehicle ID for logging
   * @returns {Array} - Optimized sequence of deliveries
   */
  async optimizeDeliverySequenceWithGroq(startLocation, deliveries, vehicleId = 'unknown') {
    // If no deliveries or only one, no optimization needed
    if (!deliveries || deliveries.length <= 1) {
      console.log(
        `[Vehicle ${vehicleId}] Only ${deliveries?.length || 0} delivery - no optimization needed`
      );
      return deliveries;
    }

    // Check if GROQ optimization is enabled
    const groqEnabled = process.env.ENABLE_GROQ_OPTIMIZATION === 'true';

    if (!groqEnabled) {
      console.log(
        `[Vehicle ${vehicleId}] 🔧 GROQ optimization disabled - using Nearest Neighbor only`
      );
      return this.optimizeDeliverySequence(startLocation, deliveries);
    }

    console.log(
      `[Vehicle ${vehicleId}] 🔄 HYBRID OPTIMIZATION: Starting for ${deliveries.length} deliveries`
    );

    // STEP 1: Get baseline using Nearest Neighbor (fast, deterministic)
    const nearestNeighborResult = this.optimizeDeliverySequence(startLocation, deliveries);
    const nnDistance = this.calculateTotalDistance(startLocation, nearestNeighborResult);

    console.log(`[Vehicle ${vehicleId}] ✅ Nearest Neighbor baseline: ${nnDistance.toFixed(2)} km`);

    // STEP 2: Try GROQ AI optimization (intelligent, considers complex factors)
    try {
      const groqResult = await this.optimizeWithGroq(startLocation, deliveries, vehicleId);

      if (groqResult && groqResult.length === deliveries.length) {
        const groqDistance = this.calculateTotalDistance(startLocation, groqResult);

        console.log(
          `[Vehicle ${vehicleId}] 🤖 GROQ AI optimization: ${groqDistance.toFixed(2)} km`
        );

        // Compare and choose the better result
        if (groqDistance < nnDistance) {
          const improvement = ((1 - groqDistance / nnDistance) * 100).toFixed(1);
          console.log(
            `[Vehicle ${vehicleId}] ⭐ GROQ WINS! ${improvement}% improvement - using AI-optimized route`
          );
          return groqResult;
        } else {
          const difference = ((groqDistance / nnDistance - 1) * 100).toFixed(1);
          console.log(
            `[Vehicle ${vehicleId}] 📊 Nearest Neighbor wins (GROQ was ${difference}% longer) - using baseline`
          );
          return nearestNeighborResult;
        }
      } else {
        console.log(
          `[Vehicle ${vehicleId}] ⚠️ GROQ validation failed - using Nearest Neighbor baseline`
        );
        return nearestNeighborResult;
      }
    } catch (error) {
      console.log(
        `[Vehicle ${vehicleId}] ⚠️ GROQ optimization failed: ${error.message} - using Nearest Neighbor baseline`
      );
      return nearestNeighborResult;
    }
  }

  /**
   * Calculate total distance for a route
   * @param {Object} startLocation - Starting location
   * @param {Array} deliveries - Ordered array of deliveries
   * @returns {Number} - Total distance in km
   */
  calculateTotalDistance(startLocation, deliveries) {
    if (!deliveries || deliveries.length === 0) return 0;

    let totalDistance = 0;
    let currentLat = startLocation.latitude;
    let currentLng = startLocation.longitude;

    for (const delivery of deliveries) {
      const deliveryLat = delivery.location?.latitude || delivery.lat;
      const deliveryLng = delivery.location?.longitude || delivery.lng;

      const distance = this.calculateDistance(currentLat, currentLng, deliveryLat, deliveryLng);
      totalDistance += distance;

      currentLat = deliveryLat;
      currentLng = deliveryLng;
    }

    return totalDistance;
  }

  /**
   * Use GROQ AI to optimize delivery sequence
   * @param {Object} startLocation - Starting location
   * @param {Array} deliveries - Array of delivery objects
   * @param {String} vehicleId - Vehicle ID for logging
   * @returns {Array} - GROQ-optimized sequence
   */
  async optimizeWithGroq(startLocation, deliveries, vehicleId) {
    // Prepare delivery data for GROQ
    const deliveryData = deliveries.map((d, idx) => ({
      index: idx,
      id: d.id || d.order_id || `delivery-${idx}`,
      customer: d.customer_name || d.name || `Customer ${idx + 1}`,
      lat: d.location?.latitude || d.lat,
      lng: d.location?.longitude || d.lng,
      priority: d.priority || 'MEDIUM',
      timeWindow: d.time_window || d.timeWindow || 'flexible',
    }));

    const prompt = `You are an expert route optimization AI. Given a starting point and a list of delivery locations, determine the OPTIMAL delivery sequence that minimizes total travel distance.

STARTING POINT:
Latitude: ${startLocation.latitude}
Longitude: ${startLocation.longitude}

DELIVERIES TO OPTIMIZE (${deliveries.length} total):
${JSON.stringify(deliveryData, null, 2)}

TASK:
Analyze the geographic distribution of these deliveries and determine the optimal visiting order that minimizes total distance traveled.

Consider:
1. Geographic proximity (primary factor)
2. Priority levels (HIGH priority deliveries should be earlier if possible)
3. Time windows (if specified, respect them)
4. Avoiding backtracking

REQUIRED OUTPUT FORMAT (JSON only, no explanation):
{
  "optimizedSequence": [0, 3, 1, 4, 2],
  "reasoning": "Brief explanation of the route logic"
}

The "optimizedSequence" array should contain the indices (0-${deliveries.length - 1}) in the optimal visiting order.
CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no extra text.`;

    const messages = [
      {
        role: 'system',
        content:
          'You are an expert logistics optimization AI. You analyze delivery locations and determine optimal routes. Always respond with valid JSON only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    // Call GROQ API
    const response = await this.callGroqApi(messages);

    // Parse GROQ response
    return this.parseGroqOptimizationResponse(response, deliveries, vehicleId);
  }

  /**
   * Parse and validate GROQ optimization response
   * @param {String} response - GROQ API response
   * @param {Array} deliveries - Original delivery array
   * @param {String} vehicleId - Vehicle ID for logging
   * @returns {Array} - Validated optimized delivery sequence
   */
  parseGroqOptimizationResponse(response, deliveries, vehicleId) {
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedResponse = response.trim();
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      const parsed = JSON.parse(cleanedResponse);

      if (!parsed.optimizedSequence || !Array.isArray(parsed.optimizedSequence)) {
        throw new Error('Missing or invalid optimizedSequence array');
      }

      const sequence = parsed.optimizedSequence;

      // Validation 1: Check length
      if (sequence.length !== deliveries.length) {
        throw new Error(
          `Sequence length mismatch: expected ${deliveries.length}, got ${sequence.length}`
        );
      }

      // Validation 2: Check all indices are present (0 to n-1)
      const sortedSequence = [...sequence].sort((a, b) => a - b);
      for (let i = 0; i < deliveries.length; i++) {
        if (sortedSequence[i] !== i) {
          throw new Error(`Invalid sequence: missing or duplicate index ${i}`);
        }
      }

      // Validation 3: Check all indices are within bounds
      if (sequence.some((idx) => idx < 0 || idx >= deliveries.length)) {
        throw new Error('Sequence contains out-of-bounds indices');
      }

      // Apply the optimized sequence
      const optimizedDeliveries = sequence.map((idx) => deliveries[idx]);

      console.log(`[Vehicle ${vehicleId}] ✅ GROQ optimization validated successfully`);
      if (parsed.reasoning) {
        console.log(`[Vehicle ${vehicleId}] 💡 GROQ reasoning: ${parsed.reasoning}`);
      }

      return optimizedDeliveries;
    } catch (error) {
      console.error(`[Vehicle ${vehicleId}] ❌ Failed to parse GROQ response:`, error.message);
      throw new Error(`GROQ response parsing failed: ${error.message}`);
    }
  }

  /**
   * Call GROQ API for optimization
   * @param {Array} messages - Messages to send to GROQ
   * @returns {String} - GROQ response
   */
  async callGroqApi(messages) {
    try {
      // Check if API key is available
      if (!this.config || !this.config.apiKey || this.config.apiKey.length < 10) {
        throw new Error('GROQ API key not configured');
      }

      const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      const headers = {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      };
      const data = {
        model: this.config.model || 'llama-3.1-70b-versatile',
        messages,
        temperature: 0.1, // Low temperature for consistent, logical optimization
        max_tokens: 2000,
      };

      const response = await axios.post(apiUrl, data, { headers });
      return response.data.choices[0]?.message?.content || '';
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('GROQ API authentication failed');
      } else if (error.response?.status === 429) {
        throw new Error('GROQ API rate limit exceeded');
      }
      throw new Error(`GROQ API error: ${error.message}`);
    }
  }

  /**
   * Generate a random ID
   * @returns {string} Random ID
   */
  generateId() {
    return Math.random().toString(36).substring(2, 10);
  }
}

module.exports = PlanningAgent;
