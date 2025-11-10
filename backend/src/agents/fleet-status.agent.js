/**
 * Fleet Status Agent
 * Tracks real-time driver locations, availability, and capacity
 * Critical for BARQ and BULLET instant delivery operations
 */

const { generateId } = require('../utils/helper');
const { logger } = require('../utils/logger');

class FleetStatusAgent {
  constructor() {
    this.driverStates = new Map();
    this.updateInterval = 10000; // 10 seconds
    this.lastUpdate = Date.now();

    // Driver capacity based on vehicle type
    this.capacityConfig = {
      BIKE: { barq: 5, bullet: 8 },
      CAR: { barq: 8, bullet: 15 },
      VAN: { barq: 10, bullet: 25 },
    };

    console.log('Fleet Status Agent initialized');
  }

  /**
   * Main execution method
   */
  async execute(context) {
    logger.info('[FleetStatus] Analyzing fleet availability');

    // Update timestamp to mark agent as active
    this.lastUpdate = Date.now();

    const fleetSnapshot = {
      timestamp: Date.now(),
      drivers: {
        total: 0,
        available: [],
        busy: [],
        offline: [],
        breakTime: [],
      },
      capacity: {
        barq: { available: 0, utilized: 0, percentage: 0 },
        bullet: { available: 0, utilized: 0, percentage: 0 },
      },
      geographical: {},
      serviceCapability: {
        barqCapable: 0,
        bulletCapable: 0,
        bothCapable: 0,
      },
      predictions: {},
    };

    try {
      // Get all drivers from database
      const drivers = await this.getAllDrivers();
      fleetSnapshot.drivers.total = drivers.length;

      // Analyze each driver
      for (const driver of drivers) {
        const state = await this.analyzeDriverState(driver);
        this.driverStates.set(driver.id, state);

        // Categorize driver by status
        await this.categorizeDriver(driver, state, fleetSnapshot);

        // Update service capability counts
        this.updateServiceCapability(state, fleetSnapshot);
      }

      // Calculate fleet capacity metrics
      fleetSnapshot.capacity = await this.calculateFleetCapacity(fleetSnapshot);

      // Generate geographical heat map
      fleetSnapshot.geographical = await this.generateGeographicalDistribution(
        fleetSnapshot.drivers.available
      );

      // Predict near-future availability (next 30 minutes)
      fleetSnapshot.predictions = await this.predictFleetAvailability(fleetSnapshot);

      this.lastUpdate = Date.now();

      return fleetSnapshot;
    } catch (error) {
      logger.error('[FleetStatus] Error executing fleet status analysis', {
        error: error.message,
        stack: error.stack,
      });

      // Return empty snapshot to prevent crash
      fleetSnapshot.error = error.message;
      this.lastUpdate = Date.now();
      return fleetSnapshot;
    }
  }

  /**
   * Analyze individual driver state
   */
  async analyzeDriverState(driver) {
    const location = await this.getDriverLocation(driver.id);
    const currentOrders = await this.getDriverOrders(driver.id);
    const workHistory = await this.getDriverWorkHistory(driver.id);

    // Calculate driver's current capacity
    const vehicleCapacity = this.capacityConfig[driver.vehicleType] || this.capacityConfig.BIKE;

    const state = {
      id: driver.id,
      name: driver.name,
      vehicleType: driver.vehicleType,
      status: this.determineStatus(driver, currentOrders, workHistory),
      location: location,
      lastLocationUpdate: location?.timestamp || Date.now(),
      currentOrders: currentOrders,
      currentLoad: currentOrders.length,
      maxCapacity: vehicleCapacity,
      remainingCapacity: {
        barq: Math.max(
          0,
          vehicleCapacity.barq - currentOrders.filter((o) => o.serviceType === 'BARQ').length
        ),
        bullet: Math.max(
          0,
          vehicleCapacity.bullet - currentOrders.filter((o) => o.serviceType === 'BULLET').length
        ),
      },
      slaTypes: this.determineSLACapability(driver, workHistory, currentOrders),
      fatigue: this.calculateFatigue(workHistory),
      performance: await this.getDriverPerformance(driver.id),
      nextAvailable: this.estimateNextAvailability(driver, currentOrders),
      estimatedCompletionTime: this.estimateCompletionTime(currentOrders),
      activeTime: workHistory.continuousHours || 0,
      ordersDeliveredToday: workHistory.ordersToday || 0,
      battery: driver.deviceBattery || 100,
      lastBreak: workHistory.lastBreakTime,
    };

    return state;
  }

  /**
   * Categorize driver into appropriate status bucket
   */
  async categorizeDriver(driver, state, fleetSnapshot) {
    if (state.status === 'available') {
      fleetSnapshot.drivers.available.push({
        id: driver.id,
        name: driver.name,
        location: state.location,
        vehicleType: state.vehicleType,
        capacity: state.remainingCapacity,
        slaCapability: state.slaTypes,
        estimatedAvailability: 'immediate',
        score: await this.calculateDriverScore(driver, state),
        fatigue: state.fatigue,
        performance: state.performance,
      });
    } else if (state.status === 'busy') {
      fleetSnapshot.drivers.busy.push({
        id: driver.id,
        name: driver.name,
        currentOrders: state.currentOrders,
        estimatedFreeTime: state.estimatedCompletionTime,
        canTakeMore: state.remainingCapacity.barq > 0 || state.remainingCapacity.bullet > 0,
        remainingCapacity: state.remainingCapacity,
      });
    } else if (state.status === 'break') {
      fleetSnapshot.drivers.breakTime.push({
        id: driver.id,
        name: driver.name,
        breakStarted: state.lastBreak,
        expectedReturn: new Date(state.lastBreak + 30 * 60000).toISOString(),
      });
    } else if (state.status === 'offline') {
      fleetSnapshot.drivers.offline.push({
        id: driver.id,
        name: driver.name,
        lastSeen: state.lastLocationUpdate,
      });
    }
  }

  /**
   * Determine driver's current status
   */
  determineStatus(driver, currentOrders, workHistory) {
    // Check if driver is online
    const lastUpdate = driver.lastLocationUpdate || Date.now();
    const timeSinceUpdate = Date.now() - lastUpdate;

    if (timeSinceUpdate > 300000) {
      // 5 minutes
      return 'offline';
    }

    // Check if on break
    if (driver.onBreak || (workHistory.continuousHours > 5.5 && !currentOrders.length)) {
      return 'break';
    }

    // Check current load
    if (currentOrders.length === 0) {
      return 'available';
    }

    // Check if at capacity
    const vehicleCapacity = this.capacityConfig[driver.vehicleType] || this.capacityConfig.BIKE;
    const totalCapacity = Math.max(vehicleCapacity.barq, vehicleCapacity.bullet);

    if (currentOrders.length >= totalCapacity) {
      return 'full';
    }

    return 'busy';
  }

  /**
   * Determine which SLA types driver can handle
   */
  determineSLACapability(driver, workHistory, currentOrders) {
    const capabilities = [];

    // Check BARQ capability (requires good performance and low fatigue)
    const canHandleBarq =
      workHistory.barqSuccessRate >= 0.9 &&
      workHistory.continuousHours < 6 &&
      currentOrders.filter((o) => o.serviceType === 'BARQ').length < 3;

    if (canHandleBarq) {
      capabilities.push('BARQ');
    }

    // All drivers can handle BULLET
    capabilities.push('BULLET');

    return capabilities;
  }

  /**
   * Calculate driver fatigue level
   */
  calculateFatigue(workHistory) {
    const hoursWorked = workHistory.continuousHours || 0;
    const ordersDelivered = workHistory.ordersToday || 0;
    const lastBreak = workHistory.lastBreakTime || Date.now();
    const timeSinceBreak = (Date.now() - lastBreak) / 60000; // minutes

    // Calculate fatigue score (0-1, where 1 is most fatigued)
    let fatigueScore = 0;

    // Hours worked factor (max 8 hours)
    fatigueScore += (hoursWorked / 8) * 0.4;

    // Orders delivered factor (max 50 orders)
    fatigueScore += (ordersDelivered / 50) * 0.3;

    // Time since break factor (max 4 hours without break)
    fatigueScore += (timeSinceBreak / 240) * 0.3;

    fatigueScore = Math.min(1, fatigueScore);

    return {
      level: fatigueScore > 0.7 ? 'high' : fatigueScore > 0.4 ? 'medium' : 'low',
      score: fatigueScore,
      needsBreak: fatigueScore > 0.7 || timeSinceBreak > 180,
      minutesUntilBreak: Math.max(0, 240 - timeSinceBreak),
      recommendation: this.getFatigueRecommendation(fatigueScore),
    };
  }

  /**
   * Get fatigue-based recommendation
   */
  getFatigueRecommendation(fatigueScore) {
    if (fatigueScore > 0.8) {
      return 'Mandatory break required soon';
    } else if (fatigueScore > 0.6) {
      return 'Schedule break after current deliveries';
    } else if (fatigueScore > 0.4) {
      return 'Monitor fatigue level';
    }
    return 'Good to continue';
  }

  /**
   * Calculate driver score for assignment
   */
  async calculateDriverScore(driver, state) {
    const scores = {
      availability: 1.0, // Available drivers get full score
      fatigue: Math.max(0, 1 - state.fatigue.score),
      performance: state.performance?.rating || 0.8,
      battery: state.battery / 100,
      experience: Math.min(1, (state.ordersDeliveredToday || 0) / 20),
    };

    // Weighted average
    const weights = {
      availability: 0.3,
      fatigue: 0.2,
      performance: 0.25,
      battery: 0.15,
      experience: 0.1,
    };

    let totalScore = 0;
    for (const [factor, score] of Object.entries(scores)) {
      totalScore += score * weights[factor];
    }

    return Math.round(totalScore * 100) / 100;
  }

  /**
   * Estimate when driver will be available
   */
  estimateNextAvailability(driver, currentOrders) {
    if (currentOrders.length === 0) {
      return 'immediate';
    }

    // Calculate based on current orders and their SLA
    const estimatedMinutes = currentOrders.reduce((total, order) => {
      if (order.serviceType === 'BARQ') {
        return total + 15; // Average 15 minutes per BARQ delivery
      } else {
        return total + 25; // Average 25 minutes per BULLET delivery
      }
    }, 0);

    return new Date(Date.now() + estimatedMinutes * 60000).toISOString();
  }

  /**
   * Estimate completion time for current orders
   */
  estimateCompletionTime(currentOrders) {
    if (currentOrders.length === 0) return 0;

    // Sort by priority (BARQ first)
    const sortedOrders = currentOrders.sort((a, b) => {
      if (a.serviceType === 'BARQ' && b.serviceType !== 'BARQ') return -1;
      if (a.serviceType !== 'BARQ' && b.serviceType === 'BARQ') return 1;
      return 0;
    });

    let totalTime = 0;
    sortedOrders.forEach((order) => {
      if (order.serviceType === 'BARQ') {
        totalTime += 15; // 15 minutes average for BARQ
      } else {
        totalTime += 25; // 25 minutes average for BULLET
      }
    });

    return totalTime;
  }

  /**
   * Calculate fleet capacity metrics
   */
  async calculateFleetCapacity(fleetSnapshot) {
    const capacity = {
      barq: { available: 0, utilized: 0, percentage: 0 },
      bullet: { available: 0, utilized: 0, percentage: 0 },
    };

    // Sum available capacity
    fleetSnapshot.drivers.available.forEach((driver) => {
      capacity.barq.available += driver.capacity.barq;
      capacity.bullet.available += driver.capacity.bullet;
    });

    // Sum partially available capacity from busy drivers
    fleetSnapshot.drivers.busy.forEach((driver) => {
      if (driver.canTakeMore) {
        capacity.barq.available += driver.remainingCapacity.barq;
        capacity.bullet.available += driver.remainingCapacity.bullet;
      }
    });

    // Calculate utilization
    const totalBarqCapacity = fleetSnapshot.drivers.total * 8; // Average 8 BARQ per driver
    const totalBulletCapacity = fleetSnapshot.drivers.total * 15; // Average 15 BULLET per driver

    capacity.barq.utilized = totalBarqCapacity - capacity.barq.available;
    capacity.bullet.utilized = totalBulletCapacity - capacity.bullet.available;

    capacity.barq.percentage = Math.round((capacity.barq.utilized / totalBarqCapacity) * 100);
    capacity.bullet.percentage = Math.round((capacity.bullet.utilized / totalBulletCapacity) * 100);

    return capacity;
  }

  /**
   * Generate geographical distribution of available drivers
   */
  async generateGeographicalDistribution(availableDrivers) {
    // Divide city into zones (simplified grid)
    const zones = this.getCityZones();
    const distribution = {};

    zones.forEach((zone) => {
      distribution[zone.id] = {
        name: zone.name,
        center: zone.center,
        driverCount: 0,
        drivers: [],
      };
    });

    // Map drivers to zones
    availableDrivers.forEach((driver) => {
      if (driver.location) {
        const zone = this.getZoneForLocation(driver.location);
        if (distribution[zone]) {
          distribution[zone].driverCount++;
          distribution[zone].drivers.push(driver.id);
        }
      }
    });

    return distribution;
  }

  /**
   * Predict fleet availability for next 30 minutes
   */
  async predictFleetAvailability(fleetSnapshot) {
    const predictions = {
      in15Minutes: { available: 0, barqCapable: 0, bulletCapable: 0 },
      in30Minutes: { available: 0, barqCapable: 0, bulletCapable: 0 },
    };

    // Count currently available
    predictions.in15Minutes.available = fleetSnapshot.drivers.available.length;
    predictions.in30Minutes.available = fleetSnapshot.drivers.available.length;

    // Add drivers that will become available
    fleetSnapshot.drivers.busy.forEach((driver) => {
      if (driver.estimatedFreeTime <= 15) {
        predictions.in15Minutes.available++;
      }
      if (driver.estimatedFreeTime <= 30) {
        predictions.in30Minutes.available++;
      }
    });

    // Add drivers returning from break
    fleetSnapshot.drivers.breakTime.forEach((driver) => {
      const returnTime = new Date(driver.expectedReturn).getTime();
      const minutesUntilReturn = (returnTime - Date.now()) / 60000;

      if (minutesUntilReturn <= 15) {
        predictions.in15Minutes.available++;
      }
      if (minutesUntilReturn <= 30) {
        predictions.in30Minutes.available++;
      }
    });

    // Estimate capability
    predictions.in15Minutes.barqCapable = Math.round(predictions.in15Minutes.available * 0.7);
    predictions.in15Minutes.bulletCapable = predictions.in15Minutes.available;
    predictions.in30Minutes.barqCapable = Math.round(predictions.in30Minutes.available * 0.7);
    predictions.in30Minutes.bulletCapable = predictions.in30Minutes.available;

    return predictions;
  }

  /**
   * Update service capability counts
   */
  updateServiceCapability(state, fleetSnapshot) {
    if (state.slaTypes.includes('BARQ') && state.slaTypes.includes('BULLET')) {
      fleetSnapshot.serviceCapability.bothCapable++;
    } else if (state.slaTypes.includes('BARQ')) {
      fleetSnapshot.serviceCapability.barqCapable++;
    } else if (state.slaTypes.includes('BULLET')) {
      fleetSnapshot.serviceCapability.bulletCapable++;
    }
  }

  /**
   * Get city zones (simplified for Riyadh)
   */
  getCityZones() {
    return [
      { id: 'north', name: 'North Riyadh', center: { lat: 24.85, lng: 46.72 } },
      { id: 'south', name: 'South Riyadh', center: { lat: 24.6, lng: 46.72 } },
      { id: 'east', name: 'East Riyadh', center: { lat: 24.71, lng: 46.83 } },
      { id: 'west', name: 'West Riyadh', center: { lat: 24.71, lng: 46.61 } },
      { id: 'central', name: 'Central Riyadh', center: { lat: 24.71, lng: 46.67 } },
    ];
  }

  /**
   * Get zone for a given location
   */
  getZoneForLocation(location) {
    if (!location || !location.lat || !location.lng) return 'central';

    const lat = location.lat;
    const lng = location.lng;

    if (lat > 24.8) return 'north';
    if (lat < 24.65) return 'south';
    if (lng > 46.75) return 'east';
    if (lng < 46.65) return 'west';
    return 'central';
  }

  /**
   * Mock functions - replace with actual database calls
   */
  async getAllDrivers() {
    // This should be replaced with actual database query
    return [
      {
        id: 'driver1',
        name: 'Ahmed',
        vehicleType: 'BIKE',
        lastLocationUpdate: Date.now(),
      },
    ];
  }

  async getDriverLocation(driverId) {
    // This should be replaced with actual location tracking
    return {
      lat: 24.71 + (Math.random() - 0.5) * 0.1,
      lng: 46.67 + (Math.random() - 0.5) * 0.1,
      timestamp: Date.now(),
    };
  }

  async getDriverOrders(driverId) {
    // This should be replaced with actual database query
    return [];
  }

  async getDriverWorkHistory(driverId) {
    // This should be replaced with actual database query
    return {
      continuousHours: Math.random() * 6,
      ordersToday: Math.floor(Math.random() * 30),
      lastBreakTime: Date.now() - Math.random() * 10800000, // Random within last 3 hours
      barqSuccessRate: 0.95,
    };
  }

  async getDriverPerformance(driverId) {
    // This should be replaced with actual performance metrics
    return {
      rating: 0.85 + Math.random() * 0.15,
      onTimeDeliveryRate: 0.9 + Math.random() * 0.1,
      customerSatisfaction: 0.85 + Math.random() * 0.15,
    };
  }

  /**
   * Register a new driver
   */
  async registerDriver(driverData) {
    try {
      const driverId = driverData.id;

      const driver = {
        id: driverId,
        name: driverData.name,
        location: driverData.location,
        status: driverData.status || 'available',
        vehicleType: driverData.vehicleType || 'CAR',
        capacity: driverData.capacity || 10,
        currentOrders: [],
        lastUpdate: Date.now(),
      };

      this.driverStates.set(driverId, driver);

      logger.info(`[FleetStatus] Driver registered: ${driverId}`);
      return { success: true, driverId };
    } catch (error) {
      logger.error('[FleetStatus] Error registering driver', error);
      throw error;
    }
  }

  /**
   * Update driver location
   */
  async updateDriverLocation(data) {
    try {
      const driver = this.driverStates.get(data.driverId);
      if (driver) {
        driver.location = data.location;
        driver.lastUpdate = Date.now();
        this.driverStates.set(data.driverId, driver);
      }
      return { success: true };
    } catch (error) {
      logger.error('[FleetStatus] Error updating driver location', error);
      throw error;
    }
  }

  /**
   * Get available drivers for an order
   */
  async getAvailableDrivers(criteria) {
    try {
      const { location, serviceType } = criteria;
      const availableDrivers = [];

      for (const [driverId, driver] of this.driverStates) {
        if (driver.status === 'available') {
          // Calculate distance from order pickup
          const distance = this.calculateDistance(driver.location, location);

          // For BARQ, only consider drivers within 5km
          if (serviceType === 'BARQ' && distance > 5) {
            continue;
          }

          availableDrivers.push({
            ...driver,
            distance,
            estimatedArrival: Math.ceil(distance * 3), // Rough estimate
          });
        }
      }

      // Sort by distance
      availableDrivers.sort((a, b) => a.distance - b.distance);

      return availableDrivers;
    } catch (error) {
      logger.error('[FleetStatus] Error getting available drivers', error);
      return [];
    }
  }

  /**
   * Calculate distance between two coordinates
   */
  calculateDistance(coord1, coord2) {
    if (!coord1 || !coord2) return 999;

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
   * Get current fleet status (for autonomous orchestrator)
   */
  async getStatus() {
    try {
      const status = await this.execute({});
      return {
        available: status.drivers?.available || [],
        busy: status.drivers?.busy || [],
        offline: status.drivers?.offline || [],
        total: status.drivers?.total || 0,
        capacity: status.capacity,
        geographical: status.geographical,
        serviceCapability: status.serviceCapability,
        timestamp: status.timestamp,
      };
    } catch (error) {
      logger.error('[FleetStatus] getStatus() failed', { error: error.message });
      return {
        available: [],
        busy: [],
        offline: [],
        total: 0,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Check agent health
   */
  isHealthy() {
    const isHealthy = Date.now() - this.lastUpdate < 60000; // Healthy if updated within last minute
    return {
      healthy: isHealthy,
      lastUpdate: this.lastUpdate,
      message: isHealthy ? 'Agent is healthy' : 'Agent has not updated recently',
    };
  }
}

module.exports = FleetStatusAgent;
