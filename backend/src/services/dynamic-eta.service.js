/**
 * Dynamic ETA Calculation Service
 * Provides accurate ETA estimates considering:
 * - Traffic conditions (real-time and historical patterns)
 * - Weather conditions
 * - Time of day (peak hours, off-peak)
 * - Driver performance history
 * - Route complexity
 */

const { logger } = require('../utils/logger');

class DynamicETAService {
  constructor() {
    // Base speed in km/h for different conditions
    this.baseSpeed = {
      TRUCK: 40,
      CAR: 50,
      VAN: 45,
      MOTORCYCLE: 60,
    };

    // Time of day multipliers (Riyadh traffic patterns)
    this.timeOfDayFactors = {
      // Morning rush: 7-10 AM
      morningRush: { start: 7, end: 10, factor: 0.6 },
      // Evening rush: 4-8 PM
      eveningRush: { start: 16, end: 20, factor: 0.55 },
      // Midday: 10 AM - 4 PM
      midday: { start: 10, end: 16, factor: 0.85 },
      // Off-peak: 8 PM - 7 AM
      offPeak: { start: 20, end: 7, factor: 1.0 },
    };

    // Traffic condition multipliers
    this.trafficMultipliers = {
      light: 1.0,
      normal: 0.85,
      medium: 0.7,
      heavy: 0.5,
    };

    // Weather condition multipliers
    this.weatherMultipliers = {
      sunny: 1.0,
      normal: 1.0,
      cloudy: 0.95,
      rainy: 0.7,
      snowy: 0.5,
    };

    // Stop time estimates (minutes per stop)
    this.stopTimes = {
      pickup: 5, // Time to pick up package
      delivery: 8, // Time to deliver package (includes finding customer, handoff)
      warehouse: 10, // Time at warehouse/depot
    };

    logger.info('[DynamicETA] Service initialized');
  }

  /**
   * Calculate time of day factor based on current hour
   */
  getTimeOfDayFactor(hour = new Date().getHours()) {
    // Morning rush hour
    if (hour >= this.timeOfDayFactors.morningRush.start &&
        hour < this.timeOfDayFactors.morningRush.end) {
      return this.timeOfDayFactors.morningRush.factor;
    }

    // Evening rush hour
    if (hour >= this.timeOfDayFactors.eveningRush.start &&
        hour < this.timeOfDayFactors.eveningRush.end) {
      return this.timeOfDayFactors.eveningRush.factor;
    }

    // Midday
    if (hour >= this.timeOfDayFactors.midday.start &&
        hour < this.timeOfDayFactors.midday.end) {
      return this.timeOfDayFactors.midday.factor;
    }

    // Off-peak
    return this.timeOfDayFactors.offPeak.factor;
  }

  /**
   * Get driver speed index based on historical performance
   * @param {Object} driverHistory - Driver's historical performance data
   * @returns {number} Speed index (0.8 to 1.2, where 1.0 is average)
   */
  getDriverSpeedIndex(driverHistory) {
    if (!driverHistory || !driverHistory.avgCompletionRatio) {
      return 1.0; // Default for new drivers
    }

    // Driver who consistently completes faster than estimated
    const ratio = driverHistory.avgCompletionRatio;

    if (ratio < 0.85) return 1.2; // Fast driver (20% faster)
    if (ratio < 0.95) return 1.1; // Above average (10% faster)
    if (ratio <= 1.05) return 1.0; // Average
    if (ratio <= 1.15) return 0.9; // Below average (10% slower)
    return 0.8; // Slow driver (20% slower)
  }

  /**
   * Calculate route complexity factor
   * More stops or longer routes may have delays
   */
  getRouteComplexityFactor(numStops, totalDistance) {
    let complexityFactor = 1.0;

    // Many stops increase complexity
    if (numStops > 10) {
      complexityFactor *= 0.95; // 5% slower
    } else if (numStops > 20) {
      complexityFactor *= 0.9; // 10% slower
    }

    // Very long routes may have fatigue factor
    if (totalDistance > 50) {
      complexityFactor *= 0.95;
    } else if (totalDistance > 100) {
      complexityFactor *= 0.9;
    }

    return complexityFactor;
  }

  /**
   * Calculate dynamic ETA for a route segment
   *
   * @param {Object} params
   * @param {number} params.distanceKm - Distance in kilometers
   * @param {string} params.vehicleType - Type of vehicle (TRUCK, CAR, VAN, MOTORCYCLE)
   * @param {string} params.trafficCondition - Traffic condition (light, normal, medium, heavy)
   * @param {string} params.weatherCondition - Weather condition (sunny, normal, cloudy, rainy, snowy)
   * @param {Object} params.driverHistory - Driver's historical performance
   * @param {number} params.numStops - Number of stops on the route
   * @param {number} params.totalRouteDistance - Total route distance
   * @param {Date} params.departureTime - When the driver will start
   * @returns {Object} ETA breakdown with estimated minutes
   */
  calculateETA(params) {
    const {
      distanceKm,
      vehicleType = 'TRUCK',
      trafficCondition = 'normal',
      weatherCondition = 'normal',
      driverHistory = null,
      numStops = 0,
      totalRouteDistance = distanceKm,
      departureTime = new Date(),
    } = params;

    try {
      // Base travel time (hours)
      const baseSpeedKmh = this.baseSpeed[vehicleType] || this.baseSpeed.TRUCK;
      const baseTravelHours = distanceKm / baseSpeedKmh;

      // Apply multipliers
      const timeOfDayFactor = this.getTimeOfDayFactor(departureTime.getHours());
      const trafficFactor = this.trafficMultipliers[trafficCondition] ||
                            this.trafficMultipliers.normal;
      const weatherFactor = this.weatherMultipliers[weatherCondition] ||
                            this.weatherMultipliers.normal;
      const driverSpeedIndex = this.getDriverSpeedIndex(driverHistory);
      const complexityFactor = this.getRouteComplexityFactor(numStops, totalRouteDistance);

      // Combined speed multiplier
      const speedMultiplier = timeOfDayFactor * trafficFactor * weatherFactor *
                              driverSpeedIndex * complexityFactor;

      // Adjusted travel time
      const adjustedTravelHours = baseTravelHours / speedMultiplier;
      const travelMinutes = Math.ceil(adjustedTravelHours * 60);

      // Add buffer for uncertainty (5% of travel time, min 2 minutes)
      const bufferMinutes = Math.max(2, Math.ceil(travelMinutes * 0.05));

      // Total ETA
      const totalMinutes = travelMinutes + bufferMinutes;

      // Calculate arrival time
      const arrivalTime = new Date(departureTime.getTime() + totalMinutes * 60 * 1000);

      return {
        travelMinutes,
        bufferMinutes,
        totalMinutes,
        arrivalTime: arrivalTime.toISOString(),
        breakdown: {
          baseSpeedKmh,
          distanceKm,
          baseTravelMinutes: Math.ceil(baseTravelHours * 60),
          factors: {
            timeOfDay: timeOfDayFactor,
            traffic: trafficFactor,
            weather: weatherFactor,
            driverSpeed: driverSpeedIndex,
            complexity: complexityFactor,
            combined: speedMultiplier,
          },
        },
      };
    } catch (error) {
      logger.error('[DynamicETA] Error calculating ETA', { error: error.message, params });

      // Fallback to simple calculation
      const fallbackMinutes = Math.ceil(distanceKm * 3) + 5;
      return {
        travelMinutes: fallbackMinutes - 5,
        bufferMinutes: 5,
        totalMinutes: fallbackMinutes,
        arrivalTime: new Date(departureTime.getTime() + fallbackMinutes * 60 * 1000).toISOString(),
        breakdown: {
          error: 'Fallback calculation used',
        },
      };
    }
  }

  /**
   * Calculate ETA for driver to reach pickup location
   */
  calculateDriverToPickupETA(params) {
    const eta = this.calculateETA({
      ...params,
      numStops: 0, // No stops on way to pickup
    });

    // Add time for driver to prepare (if not already moving)
    const preparationMinutes = params.driverState === 'AVAILABLE' ? 2 : 0;

    return {
      ...eta,
      totalMinutes: eta.totalMinutes + preparationMinutes,
      preparationMinutes,
    };
  }

  /**
   * Calculate ETA for entire delivery route
   */
  calculateDeliveryRouteETA(params) {
    const {
      stops = [], // Array of stops with distances
      vehicleType,
      trafficCondition,
      weatherCondition,
      driverHistory,
      departureTime = new Date(),
    } = params;

    try {
      let totalTravelMinutes = 0;
      let totalStopMinutes = 0;
      let currentTime = new Date(departureTime);
      const stopETAs = [];

      // Calculate cumulative distance for complexity factor
      const totalDistance = stops.reduce((sum, stop) => sum + (stop.distanceKm || 0), 0);

      stops.forEach((stop, index) => {
        // Calculate travel time to this stop
        const segmentETA = this.calculateETA({
          distanceKm: stop.distanceKm || 0,
          vehicleType,
          trafficCondition,
          weatherCondition,
          driverHistory,
          numStops: stops.length,
          totalRouteDistance: totalDistance,
          departureTime: currentTime,
        });

        totalTravelMinutes += segmentETA.travelMinutes;

        // Add stop time
        const stopMinutes = this.stopTimes[stop.type] || this.stopTimes.delivery;
        totalStopMinutes += stopMinutes;

        // Calculate arrival at this stop
        currentTime = new Date(currentTime.getTime() +
                              (segmentETA.travelMinutes + stopMinutes) * 60 * 1000);

        stopETAs.push({
          stopIndex: index,
          stopId: stop.id,
          stopType: stop.type,
          arrivalTime: currentTime.toISOString(),
          travelMinutes: segmentETA.travelMinutes,
          stopMinutes,
        });
      });

      const bufferMinutes = Math.max(5, Math.ceil(totalTravelMinutes * 0.05));

      return {
        totalTravelMinutes,
        totalStopMinutes,
        bufferMinutes,
        totalMinutes: totalTravelMinutes + totalStopMinutes + bufferMinutes,
        finalArrivalTime: currentTime.toISOString(),
        stopETAs,
        summary: {
          totalStops: stops.length,
          totalDistance,
          avgMinutesPerStop: Math.ceil((totalTravelMinutes + totalStopMinutes) / stops.length),
        },
      };
    } catch (error) {
      logger.error('[DynamicETA] Error calculating delivery route ETA', {
        error: error.message,
        params
      });
      throw error;
    }
  }

  /**
   * Calculate time window feasibility
   * Check if delivery can be made within specified time window
   */
  checkTimeWindowFeasibility(params) {
    const {
      currentTime = new Date(),
      timeWindow, // { earliest: "14:00", latest: "16:00" }
      travelMinutes,
    } = params;

    try {
      // Parse time window
      const [earliestHour, earliestMin] = timeWindow.earliest.split(':').map(Number);
      const [latestHour, latestMin] = timeWindow.latest.split(':').map(Number);

      const today = new Date(currentTime);
      const earliestTime = new Date(today.setHours(earliestHour, earliestMin, 0, 0));
      const latestTime = new Date(today.setHours(latestHour, latestMin, 0, 0));

      // Calculate arrival time
      const arrivalTime = new Date(currentTime.getTime() + travelMinutes * 60 * 1000);

      // Check feasibility
      const isFeasible = arrivalTime >= earliestTime && arrivalTime <= latestTime;

      // Calculate slack time (minutes before latest deadline)
      const slackMinutes = Math.floor((latestTime - arrivalTime) / (60 * 1000));

      // Calculate wait time if arriving too early
      const waitMinutes = Math.max(0, Math.floor((earliestTime - arrivalTime) / (60 * 1000)));

      return {
        isFeasible,
        arrivalTime: arrivalTime.toISOString(),
        timeWindow: {
          earliest: earliestTime.toISOString(),
          latest: latestTime.toISOString(),
        },
        slackMinutes,
        waitMinutes,
        status: isFeasible ?
          (slackMinutes > 0 ? 'ON_TIME' : 'TIGHT') :
          (arrivalTime < earliestTime ? 'TOO_EARLY' : 'TOO_LATE'),
      };
    } catch (error) {
      logger.error('[DynamicETA] Error checking time window feasibility', {
        error: error.message,
        params
      });

      // Default to feasible if parsing fails
      return {
        isFeasible: true,
        status: 'UNKNOWN',
        error: error.message,
      };
    }
  }

  /**
   * Update ETA based on real-time progress
   * As driver moves, update ETA with actual position
   */
  updateETAWithProgress(params) {
    const {
      originalETA,
      completedDistance,
      remainingDistance,
      elapsedMinutes,
      currentTrafficCondition,
      currentWeatherCondition,
    } = params;

    try {
      // Calculate actual speed so far
      const actualSpeedKmh = completedDistance / (elapsedMinutes / 60);

      // Recalculate remaining time with current conditions
      const remainingETA = this.calculateETA({
        distanceKm: remainingDistance,
        vehicleType: params.vehicleType,
        trafficCondition: currentTrafficCondition,
        weatherCondition: currentWeatherCondition,
        driverHistory: {
          ...params.driverHistory,
          currentSpeedKmh: actualSpeedKmh,
        },
        departureTime: new Date(),
      });

      // Calculate deviation from original estimate
      const originalRemainingMinutes = originalETA.totalMinutes - elapsedMinutes;
      const deviationMinutes = remainingETA.totalMinutes - originalRemainingMinutes;

      return {
        updatedTotalMinutes: elapsedMinutes + remainingETA.totalMinutes,
        remainingMinutes: remainingETA.totalMinutes,
        elapsedMinutes,
        deviationMinutes,
        status: Math.abs(deviationMinutes) <= 5 ? 'ON_TRACK' :
                deviationMinutes > 0 ? 'DELAYED' : 'AHEAD',
        newArrivalTime: remainingETA.arrivalTime,
        actualSpeedKmh: Math.round(actualSpeedKmh * 10) / 10,
      };
    } catch (error) {
      logger.error('[DynamicETA] Error updating ETA with progress', {
        error: error.message,
        params
      });
      throw error;
    }
  }
}

module.exports = new DynamicETAService();
