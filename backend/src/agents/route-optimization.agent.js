/**
 * Route Optimization Agent
 * Advanced routing engine for BARQ and BULLET deliveries
 * Handles real-time route optimization, re-routing, and multi-stop planning
 */

const { generateId } = require('../utils/helper');
const { logger } = require('../utils/logger');
const axios = require('axios');

class RouteOptimizationAgent {
  constructor() {
    this.optimizationEngine = 'advanced'; // 'basic', 'advanced', 'ai-powered'
    this.routeCache = new Map(); // Cache recent route calculations
    this.cacheExpiry = 300000; // 5 minutes cache

    // OSRM configuration for routing
    this.osrmConfig = {
      baseUrl: process.env.OSRM_URL || 'http://router.project-osrm.org',
      profile: 'driving', // 'driving', 'walking', 'cycling'
    };

    // Algorithm preferences
    this.algorithms = {
      BARQ: 'nearest-neighbor', // Fast for urgent deliveries
      BULLET: 'genetic-algorithm', // More optimal for batched deliveries
    };

    // Route quality thresholds
    this.qualityThresholds = {
      excellent: 0.9,
      good: 0.7,
      acceptable: 0.5,
    };

    console.log('Route Optimization Agent initialized');
  }

  /**
   * Main execution method
   */
  async execute(context, dependencies = {}) {
    const startTime = Date.now();
    logger.info('[RouteOptimization] Optimizing route', {
      driverId: context.assignedDriver,
      orderCount: context.orders?.length || 1,
    });

    const optimization = {
      requestId: context.requestId || generateId(),
      driverId: context.assignedDriver,
      timestamp: Date.now(),
      originalRoute: null,
      optimizedRoute: null,
      improvements: {},
      visualization: null,
      quality: 'unknown',
      estimatedSavings: {},
    };

    try {
      // Get driver's current state
      const driverState = await this.getDriverState(context.assignedDriver);

      // Prepare orders for optimization
      const orders = await this.prepareOrders(context, driverState);

      // Check cache first
      const cacheKey = this.generateCacheKey(driverState.location, orders);
      const cachedRoute = this.getFromCache(cacheKey);

      if (cachedRoute) {
        optimization.optimizedRoute = cachedRoute;
        optimization.quality = 'cached';
        logger.info('[RouteOptimization] Using cached route');
      } else {
        // Generate optimal route
        optimization.optimizedRoute = await this.generateOptimalRoute(
          driverState,
          orders,
          context.serviceType
        );

        // Cache the result
        this.cacheRoute(cacheKey, optimization.optimizedRoute);
      }

      // Calculate improvements if there's an existing route
      if (context.currentRoute) {
        optimization.originalRoute = context.currentRoute;
        optimization.improvements = this.calculateImprovements(
          context.currentRoute,
          optimization.optimizedRoute
        );
      }

      // Generate visualization data
      optimization.visualization = await this.generateVisualization(optimization.optimizedRoute);

      // Assess route quality
      optimization.quality = this.assessRouteQuality(optimization.optimizedRoute);

      // Calculate estimated savings
      optimization.estimatedSavings = this.calculateSavings(
        optimization.optimizedRoute,
        optimization.originalRoute
      );

      const executionTime = Date.now() - startTime;
      logger.info(`[RouteOptimization] Completed in ${executionTime}ms`, {
        quality: optimization.quality,
        stops: optimization.optimizedRoute?.stops?.length,
      });

      return optimization;
    } catch (error) {
      logger.error('[RouteOptimization] Optimization failed', {
        error: error.message,
      });

      // Return a basic fallback route
      return this.generateFallbackRoute(context, optimization);
    }
  }

  /**
   * Generate optimal route based on service type
   */
  async generateOptimalRoute(driverState, orders, serviceType) {
    logger.info('[RouteOptimization] Generating optimal route', {
      algorithm: this.algorithms[serviceType] || 'default',
      orderCount: orders.length,
    });

    // Separate orders by priority
    const { barqOrders, bulletOrders } = this.categorizeOrders(orders);

    let route = {
      id: generateId(),
      driverId: driverState.driverId,
      serviceType: serviceType,
      algorithm: this.algorithms[serviceType] || 'default',
      segments: [],
      stops: [],
      totalDistance: 0,
      totalDuration: 0,
      geometry: null,
      metadata: {},
    };

    // Handle mixed service types
    if (barqOrders.length > 0 && bulletOrders.length > 0) {
      route = await this.optimizeMixedRoute(driverState.location, barqOrders, bulletOrders);
    } else if (barqOrders.length > 0) {
      route = await this.optimizeBarqRoute(driverState.location, barqOrders);
    } else if (bulletOrders.length > 0) {
      route = await this.optimizeBulletRoute(driverState.location, bulletOrders);
    }

    // Add navigation instructions
    route.navigation = await this.generateNavigation(route);

    // Add time estimates for each stop
    route.timeEstimates = this.calculateTimeEstimates(route);

    // Add traffic considerations
    route.trafficAdjusted = await this.adjustForTraffic(route);

    return route;
  }

  /**
   * Optimize route for BARQ orders (time-critical)
   */
  async optimizeBarqRoute(startLocation, orders) {
    logger.info('[RouteOptimization] Optimizing BARQ route');

    const route = {
      type: 'BARQ',
      priority: 'critical',
      stops: [],
      segments: [],
    };

    // Use nearest neighbor for speed
    const orderedStops = await this.nearestNeighborAlgorithm(startLocation, orders, {
      maxDetour: 2, // Max 2km detour for BARQ
      timeConstraint: 60, // 60 minutes total
    });

    // Build route segments
    let currentLocation = startLocation;
    let totalDistance = 0;
    let totalDuration = 0;

    for (const stop of orderedStops) {
      const segment = await this.calculateSegment(currentLocation, stop.location);

      route.segments.push({
        from: currentLocation,
        to: stop.location,
        distance: segment.distance,
        duration: segment.duration,
        geometry: segment.geometry,
      });

      route.stops.push({
        ...stop,
        estimatedArrival: new Date(Date.now() + totalDuration * 60000),
        type: stop.type || 'delivery',
        priority: 'critical',
      });

      totalDistance += segment.distance;
      totalDuration += segment.duration;
      currentLocation = stop.location;
    }

    route.totalDistance = totalDistance;
    route.totalDuration = totalDuration;

    return route;
  }

  /**
   * Optimize route for BULLET orders (efficiency-focused)
   */
  async optimizeBulletRoute(startLocation, orders) {
    logger.info('[RouteOptimization] Optimizing BULLET route');

    const route = {
      type: 'BULLET',
      priority: 'normal',
      stops: [],
      segments: [],
    };

    // Use genetic algorithm for better optimization
    const optimizedSequence = await this.geneticAlgorithm(startLocation, orders, {
      populationSize: 50,
      generations: 100,
      mutationRate: 0.01,
      crossoverRate: 0.7,
      elitismCount: 2,
    });

    // Build optimized route
    let currentLocation = startLocation;
    let totalDistance = 0;
    let totalDuration = 0;

    for (const stop of optimizedSequence) {
      const segment = await this.calculateSegment(currentLocation, stop.location);

      route.segments.push({
        from: currentLocation,
        to: stop.location,
        distance: segment.distance,
        duration: segment.duration,
        geometry: segment.geometry,
      });

      route.stops.push({
        ...stop,
        estimatedArrival: new Date(Date.now() + totalDuration * 60000),
        type: stop.type || 'delivery',
        priority: 'normal',
      });

      totalDistance += segment.distance;
      totalDuration += segment.duration;
      currentLocation = stop.location;
    }

    route.totalDistance = totalDistance;
    route.totalDuration = totalDuration;

    return route;
  }

  /**
   * Optimize mixed BARQ and BULLET route
   */
  async optimizeMixedRoute(startLocation, barqOrders, bulletOrders) {
    logger.info('[RouteOptimization] Optimizing mixed BARQ/BULLET route');

    const route = {
      type: 'MIXED',
      priority: 'critical', // BARQ takes precedence
      stops: [],
      segments: [],
    };

    // Phase 1: Handle all BARQ orders first
    const barqStops = await this.nearestNeighborAlgorithm(startLocation, barqOrders, {
      maxDetour: 2,
      timeConstraint: 60,
    });

    // Phase 2: Insert BULLET orders optimally
    const lastBarqLocation =
      barqStops.length > 0 ? barqStops[barqStops.length - 1].location : startLocation;

    const bulletStops = await this.insertionHeuristic(lastBarqLocation, bulletOrders, barqStops);

    // Combine stops
    const allStops = [...barqStops, ...bulletStops];

    // Build complete route
    let currentLocation = startLocation;
    let totalDistance = 0;
    let totalDuration = 0;

    for (const stop of allStops) {
      const segment = await this.calculateSegment(currentLocation, stop.location);

      route.segments.push({
        from: currentLocation,
        to: stop.location,
        distance: segment.distance,
        duration: segment.duration,
        geometry: segment.geometry,
      });

      route.stops.push({
        ...stop,
        estimatedArrival: new Date(Date.now() + totalDuration * 60000),
      });

      totalDistance += segment.distance;
      totalDuration += segment.duration;
      currentLocation = stop.location;
    }

    route.totalDistance = totalDistance;
    route.totalDuration = totalDuration;

    return route;
  }

  /**
   * Nearest Neighbor Algorithm (Greedy approach for speed)
   */
  async nearestNeighborAlgorithm(startLocation, orders, constraints = {}) {
    const unvisited = [...orders];
    const route = [];
    let currentLocation = startLocation;
    let totalTime = 0;

    while (unvisited.length > 0) {
      let nearestIndex = -1;
      let nearestDistance = Infinity;

      // Find nearest unvisited stop
      for (let i = 0; i < unvisited.length; i++) {
        const distance = this.calculateDistance(
          currentLocation,
          unvisited[i].location || unvisited[i]
        );

        if (distance < nearestDistance) {
          // Check constraints
          if (constraints.maxDetour && distance > constraints.maxDetour) {
            continue;
          }

          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      if (nearestIndex === -1) {
        // No valid next stop found
        logger.warn('[RouteOptimization] No valid next stop found');
        break;
      }

      // Add to route
      const nextStop = unvisited.splice(nearestIndex, 1)[0];
      route.push(nextStop);

      currentLocation = nextStop.location || nextStop;
      totalTime += nearestDistance * 3; // Approximate 3 min/km

      // Check time constraint
      if (constraints.timeConstraint && totalTime > constraints.timeConstraint) {
        logger.warn('[RouteOptimization] Time constraint exceeded');
        break;
      }
    }

    return route;
  }

  /**
   * Genetic Algorithm for optimal route
   */
  async geneticAlgorithm(startLocation, orders, params) {
    logger.info('[RouteOptimization] Running genetic algorithm');

    // Create initial population
    let population = this.createInitialPopulation(orders, params.populationSize);

    for (let generation = 0; generation < params.generations; generation++) {
      // Evaluate fitness
      const fitness = await this.evaluatePopulationFitness(population, startLocation);

      // Selection
      const parents = this.selectParents(population, fitness, params.elitismCount);

      // Crossover
      const offspring = this.crossover(parents, params.crossoverRate, params.populationSize);

      // Mutation
      const mutated = this.mutate(offspring, params.mutationRate);

      // Update population
      population = mutated;
    }

    // Return best solution
    const finalFitness = await this.evaluatePopulationFitness(population, startLocation);
    const bestIndex = finalFitness.indexOf(Math.max(...finalFitness));

    return population[bestIndex];
  }

  /**
   * Create initial population for genetic algorithm
   */
  createInitialPopulation(orders, size) {
    const population = [];

    for (let i = 0; i < size; i++) {
      // Create random permutation
      const individual = [...orders];
      for (let j = individual.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [individual[j], individual[k]] = [individual[k], individual[j]];
      }
      population.push(individual);
    }

    return population;
  }

  /**
   * Evaluate fitness of population
   */
  async evaluatePopulationFitness(population, startLocation) {
    const fitness = [];

    for (const individual of population) {
      let totalDistance = 0;
      let currentLocation = startLocation;

      for (const stop of individual) {
        const distance = this.calculateDistance(currentLocation, stop.location || stop);
        totalDistance += distance;
        currentLocation = stop.location || stop;
      }

      // Fitness is inverse of total distance (shorter is better)
      fitness.push(1 / (1 + totalDistance));
    }

    return fitness;
  }

  /**
   * Select parents for crossover
   */
  selectParents(population, fitness, elitismCount) {
    const parents = [];

    // Keep best individuals (elitism)
    const sortedIndices = fitness
      .map((f, i) => ({ fitness: f, index: i }))
      .sort((a, b) => b.fitness - a.fitness);

    for (let i = 0; i < elitismCount; i++) {
      parents.push(population[sortedIndices[i].index]);
    }

    // Tournament selection for remaining
    while (parents.length < population.length / 2) {
      const tournament = [];
      for (let i = 0; i < 3; i++) {
        const randomIndex = Math.floor(Math.random() * population.length);
        tournament.push({
          individual: population[randomIndex],
          fitness: fitness[randomIndex],
        });
      }

      tournament.sort((a, b) => b.fitness - a.fitness);
      parents.push(tournament[0].individual);
    }

    return parents;
  }

  /**
   * Crossover operation
   */
  crossover(parents, crossoverRate, targetSize) {
    const offspring = [...parents]; // Keep parents

    while (offspring.length < targetSize) {
      if (Math.random() < crossoverRate) {
        const parent1 = parents[Math.floor(Math.random() * parents.length)];
        const parent2 = parents[Math.floor(Math.random() * parents.length)];

        // Order crossover (OX)
        const child = this.orderCrossover(parent1, parent2);
        offspring.push(child);
      } else {
        // No crossover, copy parent
        offspring.push([...parents[Math.floor(Math.random() * parents.length)]]);
      }
    }

    return offspring.slice(0, targetSize);
  }

  /**
   * Order crossover for genetic algorithm
   */
  orderCrossover(parent1, parent2) {
    const size = parent1.length;
    const start = Math.floor(Math.random() * size);
    const end = start + Math.floor(Math.random() * (size - start));

    // Copy segment from parent1
    const child = new Array(size).fill(null);
    for (let i = start; i < end; i++) {
      child[i] = parent1[i];
    }

    // Fill remaining from parent2
    let currentIndex = 0;
    for (const item of parent2) {
      if (!child.includes(item)) {
        while (child[currentIndex] !== null) {
          currentIndex++;
        }
        child[currentIndex] = item;
      }
    }

    return child;
  }

  /**
   * Mutation operation
   */
  mutate(population, mutationRate) {
    return population.map((individual) => {
      if (Math.random() < mutationRate) {
        // Swap mutation
        const newIndividual = [...individual];
        const i = Math.floor(Math.random() * newIndividual.length);
        const j = Math.floor(Math.random() * newIndividual.length);
        [newIndividual[i], newIndividual[j]] = [newIndividual[j], newIndividual[i]];
        return newIndividual;
      }
      return individual;
    });
  }

  /**
   * Insertion heuristic for adding orders to existing route
   */
  async insertionHeuristic(startLocation, newOrders, existingStops) {
    const route = [...existingStops];

    for (const order of newOrders) {
      let bestPosition = route.length;
      let minIncrease = Infinity;

      // Try inserting at each position
      for (let i = 0; i <= route.length; i++) {
        const before = i > 0 ? route[i - 1].location : startLocation;
        const after = i < route.length ? route[i].location : null;

        const increase = this.calculateInsertionCost(before, order.location || order, after);

        if (increase < minIncrease) {
          minIncrease = increase;
          bestPosition = i;
        }
      }

      // Insert at best position
      route.splice(bestPosition, 0, order);
    }

    return route;
  }

  /**
   * Calculate cost of inserting a stop
   */
  calculateInsertionCost(before, newStop, after) {
    if (!after) {
      return this.calculateDistance(before, newStop);
    }

    const originalDistance = this.calculateDistance(before, after);
    const newDistance =
      this.calculateDistance(before, newStop) + this.calculateDistance(newStop, after);

    return newDistance - originalDistance;
  }

  /**
   * Calculate route segment using OSRM
   */
  async calculateSegment(from, to) {
    try {
      // Format coordinates for OSRM
      const fromCoords = `${from.lng || from.longitude},${from.lat || from.latitude}`;
      const toCoords = `${to.lng || to.longitude},${to.lat || to.latitude}`;

      // Call OSRM API (or use fallback calculation)
      const url = `${this.osrmConfig.baseUrl}/route/v1/${this.osrmConfig.profile}/${fromCoords};${toCoords}?overview=full&geometries=polyline`;

      // For now, use simple calculation
      const distance = this.calculateDistance(from, to);
      const duration = distance * 3; // 3 minutes per km average

      return {
        distance,
        duration,
        geometry: null, // Would be polyline from OSRM
      };
    } catch (error) {
      logger.error('[RouteOptimization] Segment calculation failed', {
        error: error.message,
      });

      // Fallback to simple calculation
      const distance = this.calculateDistance(from, to);
      return {
        distance,
        duration: distance * 3,
        geometry: null,
      };
    }
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(point1, point2) {
    if (!point1 || !point2) return 999;

    const lat1 = point1.lat || point1.latitude;
    const lng1 = point1.lng || point1.longitude;
    const lat2 = point2.lat || point2.latitude;
    const lng2 = point2.lng || point2.longitude;

    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Generate turn-by-turn navigation
   */
  async generateNavigation(route) {
    const navigation = {
      instructions: [],
      totalDistance: route.totalDistance,
      totalDuration: route.totalDuration,
    };

    for (let i = 0; i < route.stops.length; i++) {
      navigation.instructions.push({
        step: i + 1,
        action: i === 0 ? 'Start' : 'Continue',
        location: route.stops[i].name || `Stop ${i + 1}`,
        distance: route.segments[i]?.distance || 0,
        duration: route.segments[i]?.duration || 0,
        estimatedArrival: route.stops[i].estimatedArrival,
      });
    }

    return navigation;
  }

  /**
   * Calculate time estimates for each stop
   */
  calculateTimeEstimates(route) {
    const estimates = [];
    let cumulativeTime = 0;

    for (const stop of route.stops) {
      cumulativeTime += stop.serviceTime || 5; // Default 5 min service time

      estimates.push({
        stopId: stop.id,
        arrivalTime: new Date(Date.now() + cumulativeTime * 60000),
        departureTime: new Date(Date.now() + (cumulativeTime + 5) * 60000),
        waitTime: stop.waitTime || 0,
      });

      if (stop.segment) {
        cumulativeTime += stop.segment.duration;
      }
    }

    return estimates;
  }

  /**
   * Adjust route for traffic conditions
   */
  async adjustForTraffic(route) {
    // Get current traffic data (mock for now)
    const trafficMultiplier = 1.2; // 20% slower due to traffic

    return {
      ...route,
      trafficAdjustedDuration: route.totalDuration * trafficMultiplier,
      trafficCondition: 'moderate',
      alternativeRoutes: [],
    };
  }

  /**
   * Calculate improvements between routes
   */
  calculateImprovements(originalRoute, optimizedRoute) {
    if (!originalRoute || !optimizedRoute) {
      return { improved: false };
    }

    const distanceImprovement =
      ((originalRoute.totalDistance - optimizedRoute.totalDistance) / originalRoute.totalDistance) *
      100;

    const timeImprovement =
      ((originalRoute.totalDuration - optimizedRoute.totalDuration) / originalRoute.totalDuration) *
      100;

    return {
      improved: distanceImprovement > 0 || timeImprovement > 0,
      distanceReduction: Math.max(0, distanceImprovement),
      timeReduction: Math.max(0, timeImprovement),
      originalDistance: originalRoute.totalDistance,
      optimizedDistance: optimizedRoute.totalDistance,
      originalDuration: originalRoute.totalDuration,
      optimizedDuration: optimizedRoute.totalDuration,
    };
  }

  /**
   * Generate route visualization data
   */
  async generateVisualization(route) {
    return {
      type: 'FeatureCollection',
      features: [
        // Route line
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: route.stops.map((stop) => [
              stop.location?.lng || stop.location?.longitude,
              stop.location?.lat || stop.location?.latitude,
            ]),
          },
          properties: {
            type: 'route',
            totalDistance: route.totalDistance,
            totalDuration: route.totalDuration,
          },
        },
        // Stop markers
        ...route.stops.map((stop, index) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [
              stop.location?.lng || stop.location?.longitude,
              stop.location?.lat || stop.location?.latitude,
            ],
          },
          properties: {
            type: 'stop',
            index: index + 1,
            name: stop.name,
            estimatedArrival: stop.estimatedArrival,
          },
        })),
      ],
    };
  }

  /**
   * Assess route quality
   */
  assessRouteQuality(route) {
    if (!route) return 'unknown';

    // Calculate quality score based on various factors
    let score = 1.0;

    // Penalize for too many stops
    if (route.stops?.length > 10) {
      score *= 0.9;
    }

    // Penalize for long duration
    if (route.totalDuration > 120) {
      // More than 2 hours
      score *= 0.8;
    }

    // Penalize for long distance
    if (route.totalDistance > 50) {
      // More than 50km
      score *= 0.85;
    }

    // Determine quality level
    if (score >= this.qualityThresholds.excellent) return 'excellent';
    if (score >= this.qualityThresholds.good) return 'good';
    if (score >= this.qualityThresholds.acceptable) return 'acceptable';
    return 'poor';
  }

  /**
   * Calculate estimated savings
   */
  calculateSavings(optimizedRoute, originalRoute) {
    const savings = {
      distance: 0,
      time: 0,
      fuel: 0,
      cost: 0,
    };

    if (!originalRoute || !optimizedRoute) {
      return savings;
    }

    // Distance savings
    savings.distance = Math.max(0, originalRoute.totalDistance - optimizedRoute.totalDistance);

    // Time savings (in minutes)
    savings.time = Math.max(0, originalRoute.totalDuration - optimizedRoute.totalDuration);

    // Fuel savings (approximate)
    const fuelConsumption = 8; // liters per 100km
    savings.fuel = (savings.distance * fuelConsumption) / 100;

    // Cost savings (approximate)
    const fuelPrice = 2.5; // per liter
    const driverCostPerHour = 20;
    savings.cost = savings.fuel * fuelPrice + (savings.time / 60) * driverCostPerHour;

    return savings;
  }

  /**
   * Generate fallback route
   */
  generateFallbackRoute(context, optimization) {
    logger.warn('[RouteOptimization] Using fallback route');

    const fallbackRoute = {
      id: generateId(),
      type: 'fallback',
      stops: context.orders || [],
      totalDistance: 0,
      totalDuration: 0,
      quality: 'fallback',
      warning: 'Using simplified route due to optimization failure',
    };

    // Calculate basic metrics
    let totalDistance = 0;
    for (let i = 0; i < fallbackRoute.stops.length - 1; i++) {
      totalDistance += this.calculateDistance(
        fallbackRoute.stops[i].location || fallbackRoute.stops[i],
        fallbackRoute.stops[i + 1].location || fallbackRoute.stops[i + 1]
      );
    }

    fallbackRoute.totalDistance = totalDistance;
    fallbackRoute.totalDuration = totalDistance * 3; // 3 min/km estimate

    optimization.optimizedRoute = fallbackRoute;
    optimization.quality = 'fallback';

    return optimization;
  }

  /**
   * Helper methods
   */
  async getDriverState(driverId) {
    // This should fetch actual driver state from database
    return {
      driverId,
      location: { lat: 24.7136, lng: 46.6753 }, // Default Riyadh location
      currentOrders: [],
      status: 'available',
    };
  }

  async prepareOrders(context, driverState) {
    // Prepare orders for optimization
    if (context.orders) {
      return context.orders;
    }

    // Create order from context
    return [
      {
        id: context.orderId,
        location: context.delivery || context.deliveryLocation,
        type: 'delivery',
        serviceType: context.serviceType,
      },
    ];
  }

  categorizeOrders(orders) {
    const barqOrders = [];
    const bulletOrders = [];

    for (const order of orders) {
      if (order.serviceType === 'BARQ') {
        barqOrders.push(order);
      } else {
        bulletOrders.push(order);
      }
    }

    return { barqOrders, bulletOrders };
  }

  generateCacheKey(startLocation, orders) {
    const orderIds = orders
      .map((o) => o.id)
      .sort()
      .join('-');
    return `${startLocation.lat}-${startLocation.lng}-${orderIds}`;
  }

  getFromCache(key) {
    const cached = this.routeCache.get(key);
    if (!cached) return null;

    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.cacheExpiry) {
      this.routeCache.delete(key);
      return null;
    }

    return cached.route;
  }

  cacheRoute(key, route) {
    this.routeCache.set(key, {
      route,
      timestamp: Date.now(),
    });

    // Cleanup old cache entries
    if (this.routeCache.size > 1000) {
      const firstKey = this.routeCache.keys().next().value;
      this.routeCache.delete(firstKey);
    }
  }

  /**
   * Optimize route for driver (simplified version for demo)
   */
  async optimizeRoute(request) {
    try {
      const { driverId, orders, currentLocation } = request;

      // For demo, create a simple route
      const path = [currentLocation];

      // Add pickup and dropoff points for each order
      for (const order of orders) {
        path.push(order.pickup.coordinates);
        path.push(order.dropoff.coordinates);
      }

      // Calculate total distance and estimated time
      let totalDistance = 0;
      let totalDuration = 0;

      for (let i = 1; i < path.length; i++) {
        const distance = this.calculateDistance(path[i - 1], path[i]);
        totalDistance += distance;
        totalDuration += distance * 3; // Rough estimate
      }

      return {
        success: true,
        driverId,
        path,
        totalDistance,
        estimatedDeliveryTime: Math.ceil(totalDuration),
        optimizationMethod: 'nearest_neighbor',
      };
    } catch (error) {
      logger.error('[RouteOptimization] Error optimizing route', error);
      return {
        success: false,
        reason: error.message,
      };
    }
  }

  /**
   * Calculate distance between two coordinates
   */
  calculateDistance(coord1, coord2) {
    if (!coord1 || !coord2) return 0;

    const R = 6371; // Earth's radius in km
    const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
    const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((coord1.lat * Math.PI) / 180) *
        Math.cos((coord2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Check agent health
   */
  isHealthy() {
    const isHealthy = true;
    return {
      healthy: isHealthy,
      lastUpdate: this.lastUpdate || Date.now(),
      message: isHealthy ? 'Agent is healthy' : 'Agent health check failed',
    };
  }
}

module.exports = RouteOptimizationAgent;
