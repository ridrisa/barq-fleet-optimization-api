/**
 * Driver State Service
 * High-level business logic for driver state management and availability
 *
 * Responsibilities:
 * - Driver availability checks
 * - Intelligent order assignment
 * - State transition orchestration
 * - Performance tracking
 * - Break management
 * - Real-time fleet monitoring
 */

const DriverModel = require('../models/driver.model');
const { logger } = require('../utils/logger');
const dynamicETA = require('./dynamic-eta.service');
const EventEmitter = require('events');

class DriverStateService extends EventEmitter {
  constructor() {
    super();
    this.stateChangeListeners = new Map();
  }

  /**
   * Get available drivers for order assignment
   * Returns drivers sorted by priority (best match first)
   *
   * @param {Object} pickupLocation - Pickup location {lat, lng}
   * @param {Object} options - Search and scoring options
   * @param {string} options.serviceType - Service type (BARQ/BULLET)
   * @param {Object} options.timeWindow - Delivery time window {earliest, latest}
   * @param {string} options.trafficCondition - Current traffic (light/normal/medium/heavy)
   * @param {string} options.weatherCondition - Current weather (sunny/rainy/etc)
   * @returns {Array} Sorted list of available drivers
   */
  async getAvailableDrivers(pickupLocation, options = {}) {
    try {
      const drivers = await DriverModel.getAvailableDrivers(pickupLocation, {
        serviceType: options.serviceType,
        radiusKm: options.radiusKm || 10,
        minRating: options.minRating || 4.0,
        vehicleType: options.vehicleType,
        limit: options.limit || 20,
      });

      // Enrich with dynamic ETA calculations and priority scores
      const enrichedDrivers = await Promise.all(
        drivers.map(async (driver) => {
          // Calculate dynamic ETA to pickup
          const etaToPickup = dynamicETA.calculateDriverToPickupETA({
            distanceKm: driver.distance_km,
            vehicleType: driver.vehicle_type || 'TRUCK',
            trafficCondition: options.trafficCondition || 'normal',
            weatherCondition: options.weatherCondition || 'normal',
            driverState: driver.operational_state,
            driverHistory: driver.performance_history,
          });

          return {
            ...driver,
            eta_to_pickup: etaToPickup,
            legacy_eta: await DriverModel.calculateETA(driver.id), // Keep for backwards compatibility
            priority_score: this.calculatePriorityScore(driver, pickupLocation, {
              timeWindow: options.timeWindow,
              trafficCondition: options.trafficCondition,
              weatherCondition: options.weatherCondition,
            }),
          };
        })
      );

      // Sort by priority score
      enrichedDrivers.sort((a, b) => b.priority_score - a.priority_score);

      logger.info('[DriverStateService] Found available drivers with dynamic ETA', {
        count: enrichedDrivers.length,
        location: pickupLocation,
        hasTimeWindow: !!options.timeWindow,
        traffic: options.trafficCondition,
        weather: options.weatherCondition,
      });

      return enrichedDrivers;
    } catch (error) {
      logger.error('[DriverStateService] Failed to get available drivers', error);
      throw error;
    }
  }

  /**
   * Calculate priority score for driver assignment
   * Higher score = better match
   *
   * @param {Object} driver - Driver details
   * @param {Object} pickupLocation - Pickup location coordinates
   * @param {Object} options - Additional options
   * @param {Object} options.timeWindow - Delivery time window constraint
   * @param {string} options.trafficCondition - Current traffic condition
   * @param {string} options.weatherCondition - Current weather condition
   * @returns {number} Priority score (0-100+)
   */
  calculatePriorityScore(driver, pickupLocation, options = {}) {
    let score = 0;

    // Factor 1: Operational state (40 points max)
    if (driver.operational_state === 'AVAILABLE') {
      score += 40;
    } else if (driver.operational_state === 'RETURNING') {
      score += 20;
    }

    // Factor 2: Distance (30 points max, inversely proportional)
    // Closer = higher score
    const maxDistance = 10; // km
    const distanceScore = Math.max(0, 30 * (1 - driver.distance_km / maxDistance));
    score += distanceScore;

    // Factor 3: Rating (15 points max)
    score += (driver.rating / 5.0) * 15;

    // Factor 4: Target gap (15 points max)
    // Drivers behind on target get priority
    if (driver.gap_from_target > 0) {
      score += Math.min(15, driver.gap_from_target * 2);
    }

    // Factor 5: Time window feasibility (BONUS: 0-20 points)
    // Check if driver can meet delivery time window
    if (options.timeWindow) {
      try {
        // Calculate ETA using dynamic service
        const etaResult = dynamicETA.calculateDriverToPickupETA({
          distanceKm: driver.distance_km,
          vehicleType: driver.vehicle_type || 'TRUCK',
          trafficCondition: options.trafficCondition || 'normal',
          weatherCondition: options.weatherCondition || 'normal',
          driverState: driver.operational_state,
          driverHistory: driver.performance_history,
        });

        // Check if delivery is feasible within time window
        const feasibility = dynamicETA.checkTimeWindowFeasibility({
          currentTime: new Date(),
          timeWindow: options.timeWindow,
          travelMinutes: etaResult.totalMinutes,
        });

        if (feasibility.isFeasible) {
          // Reward drivers with more slack time
          if (feasibility.status === 'ON_TIME' && feasibility.slackMinutes > 10) {
            score += 20; // Comfortable buffer
          } else if (feasibility.status === 'ON_TIME') {
            score += 15; // Tight but feasible
          } else if (feasibility.status === 'TIGHT') {
            score += 10; // Very tight window
          }
        } else {
          // Penalize drivers who cannot meet time window
          score -= 50; // Strong penalty for infeasible assignments
        }
      } catch (error) {
        logger.warn('[DriverStateService] Failed to calculate time window feasibility', {
          driverId: driver.id,
          error: error.message,
        });
        // No penalty if calculation fails, treat as neutral
      }
    }

    return Math.round(score * 100) / 100; // Round to 2 decimals
  }

  /**
   * Assign order to best available driver
   */
  async assignOrderToDriver(orderId, orderDetails) {
    try {
      // Find best driver
      const availableDrivers = await this.getAvailableDrivers(orderDetails.pickup_location, {
        serviceType: orderDetails.service_type,
        vehicleType: orderDetails.vehicle_type_required,
      });

      if (availableDrivers.length === 0) {
        throw new Error('No available drivers for this order');
      }

      const bestDriver = availableDrivers[0];

      // Assign order
      const updatedDriver = await DriverModel.assignOrder(bestDriver.id, orderId, orderDetails);

      // Emit state change event
      this.emit('state-changed', {
        driverId: bestDriver.id,
        orderId,
        fromState: bestDriver.operational_state,
        toState: 'BUSY',
        reason: 'order_assigned',
        timestamp: new Date(),
      });

      logger.info('[DriverStateService] Order assigned', {
        orderId,
        driverId: bestDriver.id,
        driverName: bestDriver.name,
        priorityScore: bestDriver.priority_score,
      });

      return {
        driver: updatedDriver,
        assignment: {
          orderId,
          assignedAt: new Date(),
          estimatedPickupTime: this.calculatePickupETA(bestDriver, orderDetails),
          estimatedDeliveryTime: orderDetails.eta_to_dropoff,
        },
      };
    } catch (error) {
      logger.error('[DriverStateService] Failed to assign order', error);
      throw error;
    }
  }

  /**
   * Calculate estimated pickup time based on driver location
   * Uses dynamic ETA calculation with traffic and weather
   *
   * @param {Object} driver - Driver details
   * @param {Object} orderDetails - Order information
   * @returns {Date} Estimated pickup time
   */
  calculatePickupETA(driver, orderDetails) {
    try {
      // Use dynamic ETA if context is available
      if (orderDetails.context) {
        const etaResult = dynamicETA.calculateDriverToPickupETA({
          distanceKm: driver.distance_km,
          vehicleType: driver.vehicle_type || 'TRUCK',
          trafficCondition: orderDetails.context.trafficData || 'normal',
          weatherCondition: orderDetails.context.weatherConditions || 'normal',
          driverState: driver.operational_state,
          driverHistory: driver.performance_history,
        });

        return new Date(etaResult.arrivalTime);
      }

      // Fallback to simple estimation if no context available
      const travelTimeMinutes = Math.ceil(driver.distance_km * 3) + 5;
      return new Date(Date.now() + travelTimeMinutes * 60 * 1000);
    } catch (error) {
      logger.warn('[DriverStateService] Failed to calculate dynamic pickup ETA, using fallback', {
        error: error.message,
      });

      // Fallback to simple estimation
      const travelTimeMinutes = Math.ceil(driver.distance_km * 3) + 5;
      return new Date(Date.now() + travelTimeMinutes * 60 * 1000);
    }
  }

  /**
   * Mark pickup completed
   */
  async completePickup(driverId, orderId) {
    try {
      const driver = await DriverModel.completePickup(driverId, orderId);

      this.emit('pickup-completed', {
        driverId,
        orderId,
        timestamp: new Date(),
      });

      logger.info('[DriverStateService] Pickup completed', {
        driverId,
        orderId,
      });

      return driver;
    } catch (error) {
      logger.error('[DriverStateService] Failed to complete pickup', error);
      throw error;
    }
  }

  /**
   * Complete delivery and transition driver state
   */
  async completeDelivery(driverId, orderId, deliveryDetails = {}) {
    try {
      const driver = await DriverModel.getById(driverId);

      // Determine if driver needs to return (e.g., far from base)
      const needsReturn = deliveryDetails.distanceFromBase > 15; // km

      // Complete delivery
      const updatedDriver = await DriverModel.completeDelivery(driverId, orderId, {
        needsReturn,
      });

      // Update on-time rate
      await DriverModel.updateOnTimeRate(driverId);

      // Check if driver needs mandatory break
      if (updatedDriver.consecutive_deliveries >= updatedDriver.requires_break_after) {
        logger.warn('[DriverStateService] Driver requires mandatory break', {
          driverId,
          consecutiveDeliveries: updatedDriver.consecutive_deliveries,
        });

        this.emit('break-required', {
          driverId,
          consecutiveDeliveries: updatedDriver.consecutive_deliveries,
          timestamp: new Date(),
        });
      }

      // Emit completion event
      this.emit('delivery-completed', {
        driverId,
        orderId,
        completedToday: updatedDriver.completed_today,
        gap: updatedDriver.gap_from_target,
        nextState: updatedDriver.operational_state,
        timestamp: new Date(),
      });

      logger.info('[DriverStateService] Delivery completed', {
        driverId,
        orderId,
        completedToday: updatedDriver.completed_today,
        gap: updatedDriver.gap_from_target,
      });

      return updatedDriver;
    } catch (error) {
      logger.error('[DriverStateService] Failed to complete delivery', error);
      throw error;
    }
  }

  /**
   * Start driver shift (transition to AVAILABLE)
   */
  async startShift(driverId, location) {
    try {
      // Update location
      await DriverModel.updateLocation(driverId, location.lat, location.lng);

      // Transition to AVAILABLE
      const driver = await DriverModel.updateState(driverId, 'AVAILABLE', {
        reason: DriverModel.TRANSITION_REASONS.SHIFT_START,
        triggeredBy: 'driver',
      });

      this.emit('shift-started', {
        driverId,
        timestamp: new Date(),
      });

      logger.info('[DriverStateService] Shift started', {
        driverId,
        driverName: driver.name,
      });

      return driver;
    } catch (error) {
      logger.error('[DriverStateService] Failed to start shift', error);
      throw error;
    }
  }

  /**
   * End driver shift (transition to OFFLINE)
   */
  async endShift(driverId) {
    try {
      const driver = await DriverModel.getById(driverId);

      // Check if driver has active delivery
      if (driver.active_delivery_id) {
        throw new Error('Cannot end shift with active delivery');
      }

      // Transition to OFFLINE
      const updatedDriver = await DriverModel.updateState(driverId, 'OFFLINE', {
        reason: DriverModel.TRANSITION_REASONS.SHIFT_END,
        triggeredBy: 'driver',
      });

      this.emit('shift-ended', {
        driverId,
        completedToday: driver.completed_today,
        hoursWorked: driver.hours_worked_today,
        timestamp: new Date(),
      });

      logger.info('[DriverStateService] Shift ended', {
        driverId,
        completedToday: driver.completed_today,
        hoursWorked: driver.hours_worked_today,
      });

      return updatedDriver;
    } catch (error) {
      logger.error('[DriverStateService] Failed to end shift', error);
      throw error;
    }
  }

  /**
   * Start mandatory break
   */
  async startBreak(driverId) {
    try {
      const driver = await DriverModel.startBreak(driverId);

      this.emit('break-started', {
        driverId,
        timestamp: new Date(),
      });

      logger.info('[DriverStateService] Break started', {
        driverId,
      });

      return driver;
    } catch (error) {
      logger.error('[DriverStateService] Failed to start break', error);
      throw error;
    }
  }

  /**
   * End break and return to available
   */
  async endBreak(driverId) {
    try {
      const driver = await DriverModel.endBreak(driverId);

      this.emit('break-ended', {
        driverId,
        timestamp: new Date(),
      });

      logger.info('[DriverStateService] Break ended', {
        driverId,
      });

      return driver;
    } catch (error) {
      logger.error('[DriverStateService] Failed to end break', error);
      throw error;
    }
  }

  /**
   * Get driver performance dashboard
   */
  async getDriverPerformance(driverId, period = '30 days') {
    try {
      const performance = await DriverModel.getPerformance(driverId, period);
      const stateHistory = await DriverModel.getStateHistory(driverId, 100);

      // Calculate additional metrics
      const avgTimeInState = this.calculateAvgTimeInState(stateHistory);

      return {
        ...performance,
        state_analytics: {
          avg_time_in_state: avgTimeInState,
          recent_transitions: stateHistory.slice(0, 10),
        },
      };
    } catch (error) {
      logger.error('[DriverStateService] Failed to get driver performance', error);
      throw error;
    }
  }

  /**
   * Calculate average time in each state
   */
  calculateAvgTimeInState(stateHistory) {
    const stateDurations = {
      AVAILABLE: [],
      BUSY: [],
      RETURNING: [],
      ON_BREAK: [],
      OFFLINE: [],
    };

    for (let i = 0; i < stateHistory.length - 1; i++) {
      const current = stateHistory[i];
      const next = stateHistory[i + 1];

      const duration =
        (new Date(next.transitioned_at) - new Date(current.transitioned_at)) / 1000 / 60; // minutes

      if (stateDurations[current.to_state]) {
        stateDurations[current.to_state].push(duration);
      }
    }

    // Calculate averages
    const averages = {};
    for (const [state, durations] of Object.entries(stateDurations)) {
      if (durations.length > 0) {
        averages[state] = Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length);
      } else {
        averages[state] = 0;
      }
    }

    return averages;
  }

  /**
   * Get real-time fleet status
   */
  async getFleetStatus() {
    try {
      const status = await DriverModel.getFleetStatus();

      const summary = {
        total: status.reduce((sum, s) => sum + s.driver_count, 0),
        by_state: {},
        metrics: {},
      };

      status.forEach((s) => {
        summary.by_state[s.operational_state] = {
          count: s.driver_count,
          avg_completed_today: Math.round(s.avg_completed_today * 100) / 100,
          avg_hours_worked: Math.round(s.avg_hours_worked * 100) / 100,
          avg_on_time_rate: Math.round(s.avg_on_time_rate * 100) / 100,
          driver_ids: s.driver_ids,
        };
      });

      // Calculate fleet-wide metrics
      summary.metrics = {
        available_capacity: summary.by_state.AVAILABLE?.count || 0,
        utilization_rate:
          summary.total > 0
            ? Math.round(((summary.by_state.BUSY?.count || 0) / summary.total) * 100)
            : 0,
      };

      logger.debug('[DriverStateService] Fleet status retrieved', summary);

      return summary;
    } catch (error) {
      logger.error('[DriverStateService] Failed to get fleet status', error);
      throw error;
    }
  }

  /**
   * Check driver availability for order
   */
  async checkAvailability(driverId) {
    try {
      const isAvailable = await DriverModel.isAvailable(driverId);
      const driver = await DriverModel.getById(driverId);

      return {
        available: isAvailable,
        state: driver.operational_state,
        reason: this.getUnavailableReason(driver),
        eta_to_available: await DriverModel.calculateETA(driverId),
      };
    } catch (error) {
      logger.error('[DriverStateService] Failed to check availability', error);
      throw error;
    }
  }

  /**
   * Get reason why driver is unavailable
   */
  getUnavailableReason(driver) {
    if (!driver.is_active) {
      return 'Driver is inactive';
    }

    if (driver.operational_state !== 'AVAILABLE') {
      return `Driver is ${driver.operational_state}`;
    }

    if (driver.hours_worked_today >= driver.max_working_hours) {
      return 'Driver has reached maximum working hours';
    }

    if (driver.consecutive_deliveries >= driver.requires_break_after) {
      return 'Driver requires mandatory break';
    }

    if (driver.completed_today >= driver.target_deliveries) {
      return 'Driver has completed daily target';
    }

    return null; // Driver is available
  }

  /**
   * Update driver location (real-time GPS)
   */
  async updateDriverLocation(driverId, location) {
    try {
      const driver = await DriverModel.updateLocation(driverId, location.lat, location.lng);

      this.emit('location-updated', {
        driverId,
        location,
        timestamp: new Date(),
      });

      return driver;
    } catch (error) {
      logger.error('[DriverStateService] Failed to update location', error);
      throw error;
    }
  }

  /**
   * Batch update driver locations
   */
  async batchUpdateLocations(updates) {
    try {
      const updated = await DriverModel.batchUpdateLocations(updates);

      logger.info('[DriverStateService] Batch location update', {
        count: updated.length,
      });

      return updated;
    } catch (error) {
      logger.error('[DriverStateService] Failed to batch update locations', error);
      throw error;
    }
  }

  /**
   * Reset daily metrics (scheduled job at midnight)
   */
  async resetDailyMetrics() {
    try {
      await DriverModel.resetDailyMetrics();

      this.emit('daily-reset', {
        timestamp: new Date(),
      });

      logger.info('[DriverStateService] Daily metrics reset completed');
      return true;
    } catch (error) {
      logger.error('[DriverStateService] Failed to reset daily metrics', error);
      throw error;
    }
  }

  /**
   * Subscribe to state change events
   */
  onStateChange(callback) {
    this.on('state-changed', callback);
  }

  /**
   * Subscribe to delivery completion events
   */
  onDeliveryComplete(callback) {
    this.on('delivery-completed', callback);
  }

  /**
   * Subscribe to break required events
   */
  onBreakRequired(callback) {
    this.on('break-required', callback);
  }
}

// Export singleton instance
module.exports = new DriverStateService();
