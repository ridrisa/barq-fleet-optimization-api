/**
 * Order Assignment Agent
 * Intelligently assigns BARQ and BULLET orders to the most suitable drivers
 * Considers proximity, capacity, fatigue, SLA requirements, and time windows
 */

const { generateId } = require('../utils/helper');
const { logger } = require('../utils/logger');
const dynamicETA = require('../services/dynamic-eta.service');

class OrderAssignmentAgent {
  constructor() {
    this.assignmentStrategies = {
      BARQ: this.assignBarqStrategy.bind(this),
      BULLET: this.assignBulletStrategy.bind(this),
    };

    // Scoring weights for different factors
    this.scoringWeights = {
      BARQ: {
        proximity: 0.4, // Distance to pickup is critical for BARQ
        availability: 0.3, // Driver must be immediately available
        performance: 0.2, // Historical performance
        fatigue: 0.1, // Driver fatigue level
      },
      BULLET: {
        proximity: 0.25, // Distance is less critical for BULLET
        capacity: 0.3, // Can handle multiple orders
        efficiency: 0.25, // Route efficiency matters more
        fatigue: 0.2, // Can affect longer deliveries more
      },
    };

    this.recentAssignments = new Map(); // Track recent assignments for load balancing

    console.log('Order Assignment Agent initialized');
  }

  /**
   * Main execution method
   */
  async execute(order, dependencies = {}) {
    const startTime = Date.now();
    logger.info(`[OrderAssignment] Processing ${order.serviceType} order ${order.id}`);

    const assignment = {
      orderId: order.id,
      serviceType: order.serviceType,
      timestamp: Date.now(),
      assignedDriver: null,
      assignmentType: null, // 'immediate', 'batched', 'scheduled', 'queued'
      batchId: null,
      estimatedPickupTime: null,
      estimatedDeliveryTime: null,
      confidence: 0,
      score: 0,
      backupDrivers: [],
      reasoning: [],
      warnings: [],
      fallbackUsed: false,
    };

    try {
      // Extract dependencies
      const fleetStatus = dependencies['fleet-status'] || (await this.getFleetStatus());
      const slaFeasibility = dependencies['sla-feasibility'];

      // Check if order is feasible
      if (slaFeasibility && !slaFeasibility.feasible) {
        assignment.warnings.push('Order may not meet SLA requirements');
        assignment.reasoning.push(`SLA feasibility check failed: ${slaFeasibility.reason}`);
      }

      // Use appropriate strategy based on service type
      const strategy = this.assignmentStrategies[order.serviceType];
      if (!strategy) {
        throw new Error(`Unknown service type: ${order.serviceType}`);
      }

      // Execute assignment strategy
      const result = await strategy(order, fleetStatus, slaFeasibility);

      // Merge results with assignment
      Object.assign(assignment, result);

      // Track assignment for load balancing
      this.trackAssignment(assignment.assignedDriver, order);

      const executionTime = Date.now() - startTime;
      logger.info(`[OrderAssignment] Completed in ${executionTime}ms`, {
        orderId: order.id,
        assignedDriver: assignment.assignedDriver,
        confidence: assignment.confidence,
      });
    } catch (error) {
      logger.error('[OrderAssignment] Assignment failed', {
        error: error.message,
        orderId: order.id,
      });

      // Fallback to queue
      assignment.assignmentType = 'queued';
      assignment.reasoning.push(`Assignment failed: ${error.message}`);
      assignment.warnings.push('Order queued for manual assignment');
    }

    return assignment;
  }

  /**
   * BARQ assignment strategy - requires immediate assignment
   */
  async assignBarqStrategy(order, fleetStatus, feasibility) {
    logger.info(`[OrderAssignment] Executing BARQ strategy for order ${order.id}`);

    // Find candidates within 5km radius for BARQ
    const candidates = await this.findBarqCandidates(
      order,
      fleetStatus.drivers.available,
      5 // 5km max radius for BARQ
    );

    if (candidates.length === 0) {
      // Try to find busy drivers who can take one more BARQ order
      const busyCandidates = await this.findBusyButCapable(order, fleetStatus.drivers.busy, 'BARQ');

      if (busyCandidates.length > 0) {
        return this.assignToBusyDriver(order, busyCandidates[0]);
      }

      // Emergency: Try to interrupt a BULLET delivery for BARQ priority
      return this.emergencyBarqAssignment(order, fleetStatus);
    }

    // Score and rank candidates
    const scoredCandidates = await this.scoreBarqCandidates(candidates, order);

    // Select best driver
    const bestDriver = scoredCandidates[0];

    // Get backup drivers
    const backupDrivers = scoredCandidates.slice(1, 4).map((c) => ({
      driverId: c.id,
      score: c.totalScore,
    }));

    // Calculate time estimates
    const estimates = await this.calculateTimeEstimates(bestDriver, order);

    return {
      assignedDriver: bestDriver.id,
      assignmentType: 'immediate',
      estimatedPickupTime: estimates.pickupTime,
      estimatedDeliveryTime: estimates.deliveryTime,
      confidence: bestDriver.totalScore,
      score: bestDriver.totalScore,
      backupDrivers,
      reasoning: [
        `Selected driver ${bestDriver.name || bestDriver.id}`,
        `Distance to pickup: ${bestDriver.distanceToPickup.toFixed(1)}km`,
        `Estimated delivery time: ${estimates.totalMinutes} minutes`,
        `Driver performance score: ${(bestDriver.scores.performance * 100).toFixed(0)}%`,
        `Current load: ${bestDriver.currentLoad || 0} orders`,
      ],
    };
  }

  /**
   * BULLET assignment strategy - can batch and optimize
   */
  async assignBulletStrategy(order, fleetStatus, feasibility) {
    logger.info(`[OrderAssignment] Executing BULLET strategy for order ${order.id}`);

    // Check for batching opportunity
    const batchingOpportunity = await this.findBatchingOpportunity(order, fleetStatus);

    if (batchingOpportunity && batchingOpportunity.viable) {
      return this.createBatchedAssignment(order, batchingOpportunity);
    }

    // Find candidates within wider radius for BULLET
    const candidates = await this.findBulletCandidates(
      order,
      fleetStatus.drivers.available,
      20 // 20km radius for BULLET
    );

    if (candidates.length === 0) {
      // Find busy drivers with capacity
      const busyCandidates = await this.findBusyButCapable(
        order,
        fleetStatus.drivers.busy,
        'BULLET'
      );

      if (busyCandidates.length > 0) {
        return this.assignToBusyDriver(order, busyCandidates[0]);
      }

      // Queue for next available driver
      return this.queueForLaterAssignment(order);
    }

    // Score candidates for BULLET
    const scoredCandidates = await this.scoreBulletCandidates(candidates, order);
    const bestDriver = scoredCandidates[0];

    const estimates = await this.calculateTimeEstimates(bestDriver, order);

    return {
      assignedDriver: bestDriver.id,
      assignmentType: 'immediate',
      estimatedPickupTime: estimates.pickupTime,
      estimatedDeliveryTime: estimates.deliveryTime,
      confidence: bestDriver.totalScore,
      score: bestDriver.totalScore,
      backupDrivers: scoredCandidates.slice(1, 4).map((c) => ({
        driverId: c.id,
        score: c.totalScore,
      })),
      reasoning: [
        `Assigned to driver ${bestDriver.name || bestDriver.id}`,
        `Distance to pickup: ${bestDriver.distanceToPickup.toFixed(1)}km`,
        `Can deliver within SLA window`,
        `Driver has ${bestDriver.capacity.bullet} BULLET capacity remaining`,
      ],
    };
  }

  /**
   * Find BARQ-capable candidates
   */
  async findBarqCandidates(order, availableDrivers, maxRadius) {
    const candidates = [];

    for (const driver of availableDrivers) {
      // Check if driver can handle BARQ
      if (!driver.slaCapability || !driver.slaCapability.includes('BARQ')) {
        continue;
      }

      // Check remaining BARQ capacity
      if (driver.capacity.barq === 0) {
        continue;
      }

      // Calculate distance to pickup
      const distance = await this.calculateDistance(
        driver.location,
        order.pickup || order.pickupLocation
      );

      if (distance <= maxRadius) {
        candidates.push({
          ...driver,
          distanceToPickup: distance,
        });
      }
    }

    return candidates;
  }

  /**
   * Find BULLET-capable candidates
   */
  async findBulletCandidates(order, availableDrivers, maxRadius) {
    const candidates = [];

    for (const driver of availableDrivers) {
      // All drivers can handle BULLET orders
      if (driver.capacity.bullet === 0) {
        continue;
      }

      const distance = await this.calculateDistance(
        driver.location,
        order.pickup || order.pickupLocation
      );

      if (distance <= maxRadius) {
        candidates.push({
          ...driver,
          distanceToPickup: distance,
        });
      }
    }

    return candidates;
  }

  /**
   * Score BARQ candidates
   */
  async scoreBarqCandidates(candidates, order) {
    const scoredCandidates = await Promise.all(
      candidates.map(async (candidate) => {
        const scores = {
          proximity: this.scoreProximity(candidate.distanceToPickup, 5),
          availability: this.scoreAvailability(candidate, 'BARQ'),
          performance: await this.scorePerformance(candidate),
          fatigue: this.scoreFatigue(candidate.fatigue),
        };

        // Calculate weighted total score
        const weights = this.scoringWeights.BARQ;
        const totalScore = Object.entries(scores).reduce((total, [factor, score]) => {
          return total + score * weights[factor];
        }, 0);

        return {
          ...candidate,
          scores,
          totalScore,
        };
      })
    );

    // Sort by total score (highest first)
    return scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);
  }

  /**
   * Score BULLET candidates
   */
  async scoreBulletCandidates(candidates, order) {
    const scoredCandidates = await Promise.all(
      candidates.map(async (candidate) => {
        const scores = {
          proximity: this.scoreProximity(candidate.distanceToPickup, 20),
          capacity: this.scoreCapacity(candidate, 'BULLET'),
          efficiency: await this.scoreRouteEfficiency(candidate, order),
          fatigue: this.scoreFatigue(candidate.fatigue),
        };

        const weights = this.scoringWeights.BULLET;
        const totalScore = Object.entries(scores).reduce((total, [factor, score]) => {
          return total + score * weights[factor];
        }, 0);

        return {
          ...candidate,
          scores,
          totalScore,
        };
      })
    );

    return scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);
  }

  /**
   * Scoring functions
   */
  scoreProximity(distance, maxDistance) {
    // Closer is better (exponential decay)
    return Math.exp(-distance / (maxDistance * 0.5));
  }

  scoreAvailability(driver, serviceType) {
    if (driver.estimatedAvailability === 'immediate') {
      return 1.0;
    }
    // Penalize based on wait time
    const waitMinutes = this.parseAvailabilityTime(driver.estimatedAvailability);
    if (serviceType === 'BARQ') {
      // Heavy penalty for BARQ if not immediately available
      return Math.max(0, 1 - waitMinutes / 10);
    }
    // More lenient for BULLET
    return Math.max(0, 1 - waitMinutes / 30);
  }

  async scorePerformance(driver) {
    if (driver.performance) {
      return driver.performance.rating || 0.8;
    }
    return 0.8; // Default score
  }

  scoreFatigue(fatigue) {
    if (!fatigue) return 1.0;

    // Lower fatigue is better
    if (fatigue.level === 'low') return 1.0;
    if (fatigue.level === 'medium') return 0.7;
    if (fatigue.level === 'high') return 0.4;
    return 0.5;
  }

  scoreCapacity(driver, serviceType) {
    const capacity = driver.capacity[serviceType.toLowerCase()];
    const maxCapacity = serviceType === 'BARQ' ? 5 : 10;
    return capacity / maxCapacity;
  }

  async scoreRouteEfficiency(driver, order) {
    // Simplified route efficiency scoring
    // In production, this would calculate actual route optimization potential
    return 0.7 + Math.random() * 0.3;
  }

  /**
   * Find batching opportunities for BULLET orders
   */
  async findBatchingOpportunity(order, fleetStatus) {
    const opportunity = {
      viable: false,
      driverId: null,
      batchId: null,
      otherOrders: [],
      efficiencyGain: 0,
    };

    // Look for drivers with existing BULLET orders going in similar direction
    for (const busyDriver of fleetStatus.drivers.busy) {
      if (!busyDriver.canTakeMore || busyDriver.remainingCapacity.bullet === 0) {
        continue;
      }

      const existingBulletOrders = busyDriver.currentOrders.filter(
        (o) => o.serviceType === 'BULLET'
      );

      if (existingBulletOrders.length > 0) {
        // Check if new order fits the route
        const routeFit = await this.checkRouteFit(order, existingBulletOrders);

        if (routeFit.fits && routeFit.detour < 5) {
          // Max 5km detour
          opportunity.viable = true;
          opportunity.driverId = busyDriver.id;
          opportunity.batchId = generateId();
          opportunity.otherOrders = existingBulletOrders.map((o) => o.id);
          opportunity.efficiencyGain = this.calculateEfficiencyGain(
            routeFit.originalDistance,
            routeFit.newDistance
          );
          break;
        }
      }
    }

    return opportunity;
  }

  /**
   * Create batched assignment
   */
  createBatchedAssignment(order, batchingOpportunity) {
    return {
      assignedDriver: batchingOpportunity.driverId,
      assignmentType: 'batched',
      batchId: batchingOpportunity.batchId,
      estimatedPickupTime: Date.now() + 30 * 60000, // 30 minutes estimate
      estimatedDeliveryTime: Date.now() + 90 * 60000, // 90 minutes estimate
      confidence: 0.85,
      score: 0.85,
      backupDrivers: [],
      reasoning: [
        `Batched with ${batchingOpportunity.otherOrders.length} existing orders`,
        `Efficiency gain: ${(batchingOpportunity.efficiencyGain * 100).toFixed(0)}%`,
        `Minimal route deviation required`,
      ],
    };
  }

  /**
   * Assign to busy driver with remaining capacity
   */
  async assignToBusyDriver(order, busyDriver) {
    return {
      assignedDriver: busyDriver.id,
      assignmentType: 'added_to_route',
      estimatedPickupTime: Date.now() + busyDriver.estimatedFreeTime * 60000,
      estimatedDeliveryTime: Date.now() + (busyDriver.estimatedFreeTime + 30) * 60000,
      confidence: 0.7,
      score: 0.7,
      backupDrivers: [],
      reasoning: [
        `Added to busy driver ${busyDriver.id} with remaining capacity`,
        `Driver will be available in ${busyDriver.estimatedFreeTime} minutes`,
        `Current load: ${busyDriver.currentOrders.length} orders`,
      ],
    };
  }

  /**
   * Emergency assignment for BARQ orders
   */
  async emergencyBarqAssignment(order, fleetStatus) {
    logger.warn(`[OrderAssignment] Emergency BARQ assignment for order ${order.id}`);

    // Try to find any driver within extended radius
    const emergencyCandidates = await this.findBarqCandidates(
      order,
      fleetStatus.drivers.available,
      10 // Extended to 10km for emergency
    );

    if (emergencyCandidates.length > 0) {
      const driver = emergencyCandidates[0];
      return {
        assignedDriver: driver.id,
        assignmentType: 'emergency',
        estimatedPickupTime: Date.now() + 15 * 60000,
        estimatedDeliveryTime: Date.now() + 45 * 60000,
        confidence: 0.6,
        score: 0.6,
        backupDrivers: [],
        reasoning: [
          'EMERGENCY: Extended search radius used',
          `Driver ${driver.id} found at ${driver.distanceToPickup.toFixed(1)}km`,
          'SLA at risk - customer notification recommended',
        ],
        warnings: ['SLA compliance at risk due to driver distance'],
      };
    }

    // Last resort: Queue with high priority
    return {
      assignedDriver: null,
      assignmentType: 'queued_priority',
      estimatedPickupTime: null,
      estimatedDeliveryTime: null,
      confidence: 0,
      score: 0,
      backupDrivers: [],
      reasoning: ['No drivers available for BARQ order - queued with high priority'],
      warnings: ['CRITICAL: BARQ order queued - SLA will be breached'],
    };
  }

  /**
   * Queue order for later assignment
   */
  queueForLaterAssignment(order) {
    return {
      assignedDriver: null,
      assignmentType: 'queued',
      estimatedPickupTime: null,
      estimatedDeliveryTime: null,
      confidence: 0,
      score: 0,
      backupDrivers: [],
      reasoning: [
        'No suitable drivers currently available',
        'Order queued for next available driver',
        'Will retry assignment in 2 minutes',
      ],
    };
  }

  /**
   * Calculate time estimates for assignment using dynamic ETA
   * Considers traffic, weather, and time windows
   *
   * @param {Object} driver - Driver details
   * @param {Object} order - Order details
   * @returns {Object} Time estimates
   */
  async calculateTimeEstimates(driver, order) {
    const now = Date.now();

    try {
      // Extract context from order
      const trafficCondition = order.context?.trafficData || 'normal';
      const weatherCondition = order.context?.weatherConditions || 'normal';
      const vehicleType = driver.vehicle_type || driver.vehicleType || 'TRUCK';

      // Calculate ETA to pickup using dynamic service
      const pickupETA = dynamicETA.calculateDriverToPickupETA({
        distanceKm: driver.distanceToPickup,
        vehicleType,
        trafficCondition,
        weatherCondition,
        driverState: driver.operational_state || driver.state || 'AVAILABLE',
        driverHistory: driver.performance_history || driver.performanceHistory,
      });

      // Calculate delivery distance
      const deliveryDistance = await this.calculateDistance(
        order.pickup || order.pickupLocation,
        order.delivery || order.deliveryLocation || order.dropoff
      );

      // Calculate delivery route ETA
      const deliveryETA = dynamicETA.calculateETA({
        distanceKm: deliveryDistance,
        vehicleType,
        trafficCondition,
        weatherCondition,
        driverHistory: driver.performance_history || driver.performanceHistory,
        numStops: 1,
        totalRouteDistance: driver.distanceToPickup + deliveryDistance,
      });

      // Total time = pickup travel + pickup service + delivery travel
      const totalMinutes =
        pickupETA.totalMinutes + dynamicETA.stopTimes.pickup + deliveryETA.totalMinutes;

      // Check time window feasibility if provided
      let timeWindowStatus = null;
      if (order.time_window || order.timeWindow) {
        const tw = order.time_window || order.timeWindow;
        timeWindowStatus = dynamicETA.checkTimeWindowFeasibility({
          currentTime: new Date(),
          timeWindow: tw,
          travelMinutes: totalMinutes,
        });
      }

      return {
        pickupTime: pickupETA.arrivalTime,
        deliveryTime: new Date(now + totalMinutes * 60 * 1000).toISOString(),
        totalMinutes,
        breakdown: {
          toPickup: pickupETA.totalMinutes,
          pickupService: dynamicETA.stopTimes.pickup,
          delivery: deliveryETA.totalMinutes,
        },
        dynamicFactors: {
          traffic: trafficCondition,
          weather: weatherCondition,
          timeOfDay: new Date().getHours(),
        },
        timeWindowStatus,
      };
    } catch (error) {
      logger.warn('[OrderAssignment] Failed to calculate dynamic ETA, using fallback', {
        error: error.message,
        orderId: order.id,
      });

      // Fallback to simple calculation
      const pickupMinutes = Math.ceil(driver.distanceToPickup * 3);
      const handlingMinutes = 5;
      const deliveryDistance = await this.calculateDistance(
        order.pickup || order.pickupLocation,
        order.delivery || order.deliveryLocation || order.dropoff
      );
      const deliveryMinutes = Math.ceil(deliveryDistance * 3);
      const totalMinutes = pickupMinutes + handlingMinutes + deliveryMinutes;

      return {
        pickupTime: new Date(now + pickupMinutes * 60000).toISOString(),
        deliveryTime: new Date(now + totalMinutes * 60000).toISOString(),
        totalMinutes,
        fallback: true,
      };
    }
  }

  /**
   * Track assignment for load balancing
   */
  trackAssignment(driverId, order) {
    if (!driverId) return;

    if (!this.recentAssignments.has(driverId)) {
      this.recentAssignments.set(driverId, []);
    }

    const assignments = this.recentAssignments.get(driverId);
    assignments.push({
      orderId: order.id,
      serviceType: order.serviceType,
      timestamp: Date.now(),
    });

    // Keep only last hour of assignments
    const oneHourAgo = Date.now() - 3600000;
    const recentOnly = assignments.filter((a) => a.timestamp > oneHourAgo);
    this.recentAssignments.set(driverId, recentOnly);
  }

  /**
   * Helper methods
   */
  async calculateDistance(point1, point2) {
    if (!point1 || !point2) return 999;

    const lat1 = point1.lat || point1.latitude;
    const lng1 = point1.lng || point1.longitude;
    const lat2 = point2.lat || point2.latitude;
    const lng2 = point2.lng || point2.longitude;

    // Haversine formula for distance
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

  parseAvailabilityTime(availability) {
    if (availability === 'immediate') return 0;
    // Parse ISO string or return default
    try {
      const availTime = new Date(availability).getTime();
      return Math.max(0, (availTime - Date.now()) / 60000);
    } catch {
      return 15; // Default 15 minutes
    }
  }

  async checkRouteFit(newOrder, existingOrders) {
    // Simplified route fit check
    // In production, this would use actual routing algorithms
    return {
      fits: Math.random() > 0.3, // 70% chance of fit
      detour: Math.random() * 8,
      originalDistance: 20,
      newDistance: 22,
    };
  }

  calculateEfficiencyGain(originalDistance, newDistance) {
    return Math.max(0, 1 - (newDistance - originalDistance) / originalDistance);
  }

  async findBusyButCapable(order, busyDrivers, serviceType) {
    const capable = [];

    for (const driver of busyDrivers) {
      if (!driver.canTakeMore) continue;

      const capacity = driver.remainingCapacity[serviceType.toLowerCase()];
      if (capacity > 0) {
        capable.push(driver);
      }
    }

    return capable;
  }

  /**
   * Mock function - replace with actual fleet status service
   */
  async getFleetStatus() {
    return {
      drivers: {
        available: [],
        busy: [],
        offline: [],
      },
    };
  }

  /**
   * Get assignment statistics
   */
  getAssignmentStats() {
    const stats = {
      totalAssignments: 0,
      byDriver: {},
      averageLoad: 0,
    };

    this.recentAssignments.forEach((assignments, driverId) => {
      stats.totalAssignments += assignments.length;
      stats.byDriver[driverId] = assignments.length;
    });

    if (this.recentAssignments.size > 0) {
      stats.averageLoad = stats.totalAssignments / this.recentAssignments.size;
    }

    return stats;
  }

  /**
   * Assign order to driver (simplified version for demo)
   */
  async assignOrder(request) {
    try {
      const { order, drivers } = request;

      if (!drivers || drivers.length === 0) {
        return {
          success: false,
          reason: 'No available drivers',
        };
      }

      // Score drivers based on distance and other factors
      const scoredDrivers = drivers.map((driver) => {
        // Simple scoring: closer is better
        const distanceScore = Math.max(0, 100 - (driver.distance || 0) * 10);
        const score = distanceScore;
        return { ...driver, score };
      });

      // Sort by score (higher is better)
      scoredDrivers.sort((a, b) => b.score - a.score);

      // Select best driver
      const bestDriver = scoredDrivers[0];

      // Track assignment
      if (!this.recentAssignments.has(bestDriver.id)) {
        this.recentAssignments.set(bestDriver.id, []);
      }
      this.recentAssignments.get(bestDriver.id).push({
        orderId: order.id,
        timestamp: Date.now(),
      });

      return {
        success: true,
        driverId: bestDriver.id,
        driverLocation: bestDriver.location,
        estimatedPickupTime: bestDriver.estimatedArrival,
        score: bestDriver.score,
      };
    } catch (error) {
      logger.error('[OrderAssignment] Error assigning order', error);
      return {
        success: false,
        reason: error.message,
      };
    }
  }

  /**
   * Get pending orders awaiting assignment (for autonomous orchestrator)
   */
  async getPendingOrders() {
    try {
      // Get all unassigned orders from database
      const db = require('../db/db.json');
      const orders = db.orders || [];

      const pending = orders.filter(
        (order) =>
          order.status === 'PENDING' ||
          order.status === 'CREATED' ||
          (!order.assignedDriver && order.status !== 'COMPLETED' && order.status !== 'CANCELLED')
      );

      return {
        pending: pending.map((order) => ({
          orderId: order.id,
          pickupLocation: order.pickup,
          dropoffLocation: order.dropoff,
          slaType: order.sla?.type || 'BARQ',
          slaDeadline: order.sla?.deadline,
          priority: order.priority || 'MEDIUM',
          createdAt: order.createdAt,
          waitingTime: Date.now() - new Date(order.createdAt).getTime(),
        })),
        count: pending.length,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('[OrderAssignment] getPendingOrders() failed', { error: error.message });
      return {
        pending: [],
        count: 0,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Check agent health
   */
  isHealthy() {
    return {
      healthy: true,
      message: 'Agent is healthy',
      lastUpdate: Date.now(),
    };
  }
}

module.exports = OrderAssignmentAgent;
