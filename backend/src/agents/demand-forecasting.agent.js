/**
 * Demand Forecasting Agent
 * Predicts future order volume and geographical distribution
 * Helps with proactive fleet positioning and capacity planning
 */

const { generateId } = require('../utils/helper');
const { logger } = require('../utils/logger');

class DemandForecastingAgent {
  constructor() {
    this.historicalData = [];
    this.predictions = new Map();
    this.modelUpdateInterval = 3600000; // Update model every hour
    this.lastModelUpdate = null;
    this.lastLogTime = 0; // For throttling logs

    // Time-based patterns
    this.patterns = {
      hourly: new Map(),
      daily: new Map(),
      weekly: new Map(),
      seasonal: new Map(),
    };

    // Forecasting configuration
    this.config = {
      shortTermWindow: 30, // Next 30 minutes
      mediumTermWindow: 120, // Next 2 hours
      longTermWindow: 240, // Next 4 hours
      historicalDays: 30, // Use 30 days of historical data
      minDataPoints: 100, // Minimum data points for reliable prediction
      confidenceThreshold: 0.7, // Minimum confidence for recommendations
    };

    // Geographic zones for Riyadh
    this.zones = {
      north: { center: { lat: 24.85, lng: 46.72 }, radius: 10 },
      south: { center: { lat: 24.6, lng: 46.72 }, radius: 10 },
      east: { center: { lat: 24.71, lng: 46.83 }, radius: 10 },
      west: { center: { lat: 24.71, lng: 46.61 }, radius: 10 },
      central: { center: { lat: 24.71, lng: 46.67 }, radius: 8 },
    };

    // External factors
    this.externalFactors = {
      weather: 1.0,
      events: 1.0,
      holidays: 1.0,
      traffic: 1.0,
    };

    console.log('Demand Forecasting Agent initialized');
  }

  /**
   * Main execution method
   */
  async execute(context) {
    const startTime = Date.now();

    // Only log every 60 seconds to reduce verbosity
    const now = Date.now();
    if (now - this.lastLogTime > 60000) {
      logger.info('[DemandForecasting] Analyzing demand patterns');
      this.lastLogTime = now;
    }

    const forecast = {
      timestamp: Date.now(),
      shortTerm: {}, // Next 30 minutes
      mediumTerm: {}, // Next 2 hours
      longTerm: {}, // Next 4 hours
      hotspots: [], // Predicted high-demand areas
      recommendations: [],
      confidence: {},
      alerts: [],
    };

    try {
      // Update historical data if needed
      await this.updateHistoricalData();

      // Analyze current patterns
      const patterns = await this.analyzePatterns();

      // Get current demand snapshot
      const currentDemand = await this.getCurrentDemand();

      // Generate predictions for different time horizons
      forecast.shortTerm = await this.predictDemand(
        this.config.shortTermWindow,
        patterns,
        currentDemand
      );

      forecast.mediumTerm = await this.predictDemand(
        this.config.mediumTermWindow,
        patterns,
        currentDemand
      );

      forecast.longTerm = await this.predictDemand(
        this.config.longTermWindow,
        patterns,
        currentDemand
      );

      // Identify upcoming hotspots
      forecast.hotspots = await this.identifyHotspots(forecast);

      // Calculate confidence scores
      forecast.confidence = this.calculateConfidence(patterns, currentDemand);

      // Generate actionable recommendations
      forecast.recommendations = await this.generateRecommendations(forecast, context.fleetStatus);

      // Generate alerts for significant changes
      forecast.alerts = this.generateAlerts(forecast, currentDemand);

      // Store predictions for later validation
      this.storePredictions(forecast);

      const executionTime = Date.now() - startTime;
      logger.info(`[DemandForecasting] Completed in ${executionTime}ms`, {
        shortTermOrders: forecast.shortTerm.expectedOrders,
        confidence: forecast.confidence.overall,
      });

      return forecast;
    } catch (error) {
      logger.error('[DemandForecasting] Forecasting failed', {
        error: error.message,
      });

      // Return basic forecast on error
      return this.generateBasicForecast(context);
    }
  }

  /**
   * Predict demand for specified time window
   */
  async predictDemand(minutesAhead, patterns, currentDemand) {
    const prediction = {
      timeWindow: `${minutesAhead} minutes`,
      expectedOrders: {
        barq: 0,
        bullet: 0,
        total: 0,
      },
      peakTimes: [],
      geographicalDistribution: {},
      confidence: 0,
      factors: [],
      trend: 'stable', // 'increasing', 'decreasing', 'stable'
    };

    // Get time-based predictions
    const timeBasedPrediction = this.predictFromTimePatterns(minutesAhead, patterns);

    // Get trend-based predictions
    const trendPrediction = this.predictFromTrends(currentDemand, minutesAhead);

    // Get event-based adjustments
    const eventAdjustment = await this.getEventAdjustments(minutesAhead);

    // Get weather-based adjustments
    const weatherAdjustment = await this.getWeatherAdjustments();

    // Combine predictions with weights
    const weights = {
      timeBased: 0.4,
      trend: 0.3,
      event: 0.2,
      weather: 0.1,
    };

    // Calculate BARQ orders
    prediction.expectedOrders.barq = Math.round(
      (timeBasedPrediction.barq * weights.timeBased + trendPrediction.barq * weights.trend) *
        eventAdjustment *
        weatherAdjustment
    );

    // Calculate BULLET orders
    prediction.expectedOrders.bullet = Math.round(
      (timeBasedPrediction.bullet * weights.timeBased + trendPrediction.bullet * weights.trend) *
        eventAdjustment *
        weatherAdjustment
    );

    prediction.expectedOrders.total =
      prediction.expectedOrders.barq + prediction.expectedOrders.bullet;

    // Identify peak times
    prediction.peakTimes = this.identifyPeakTimes(minutesAhead, patterns);

    // Predict geographic distribution
    prediction.geographicalDistribution = await this.predictGeographicDemand(
      patterns,
      minutesAhead
    );

    // Determine trend
    prediction.trend = this.determineTrend(currentDemand, prediction);

    // Calculate confidence
    prediction.confidence = this.calculatePredictionConfidence(
      patterns,
      currentDemand,
      minutesAhead
    );

    // Add influencing factors
    prediction.factors = [
      {
        factor: 'timeOfDay',
        impact: this.getTimeOfDayImpact(minutesAhead),
        weight: weights.timeBased,
      },
      {
        factor: 'dayOfWeek',
        impact: this.getDayOfWeekImpact(),
        weight: 0.15,
      },
      {
        factor: 'weather',
        impact: weatherAdjustment < 1 ? 'negative' : 'neutral',
        weight: weights.weather,
      },
      {
        factor: 'events',
        impact: eventAdjustment > 1 ? 'positive' : 'neutral',
        weight: weights.event,
      },
    ];

    return prediction;
  }

  /**
   * Predict demand from time patterns
   */
  predictFromTimePatterns(minutesAhead, patterns) {
    const futureTime = new Date(Date.now() + minutesAhead * 60000);
    const hour = futureTime.getHours();
    const dayOfWeek = futureTime.getDay();

    // Get historical average for this time
    const hourlyPattern = patterns.hourly[hour] || { barq: 5, bullet: 10 };
    const dailyPattern = patterns.daily[dayOfWeek] || { multiplier: 1.0 };

    // Peak hour adjustments
    const peakMultiplier = this.getPeakHourMultiplier(hour);

    return {
      barq: hourlyPattern.barq * dailyPattern.multiplier * peakMultiplier,
      bullet: hourlyPattern.bullet * dailyPattern.multiplier * peakMultiplier,
    };
  }

  /**
   * Predict from current trends
   */
  predictFromTrends(currentDemand, minutesAhead) {
    const recentTrend = currentDemand.trend || 'stable';
    const baseRate = currentDemand.currentRate || { barq: 5, bullet: 10 };

    let trendMultiplier = 1.0;

    switch (recentTrend) {
      case 'increasing':
        trendMultiplier = 1 + (minutesAhead / 60) * 0.1; // 10% per hour increase
        break;
      case 'decreasing':
        trendMultiplier = 1 - (minutesAhead / 60) * 0.05; // 5% per hour decrease
        break;
      default:
        trendMultiplier = 1.0;
    }

    return {
      barq: baseRate.barq * trendMultiplier,
      bullet: baseRate.bullet * trendMultiplier,
    };
  }

  /**
   * Identify upcoming hotspots
   */
  async identifyHotspots(forecast) {
    const hotspots = [];

    // Analyze short-term geographic distribution
    const distribution = forecast.shortTerm.geographicalDistribution;

    for (const [zoneId, zoneData] of Object.entries(distribution)) {
      if (zoneData.expectedOrders > 10) {
        // Threshold for hotspot
        hotspots.push({
          id: generateId(),
          zone: zoneId,
          center: this.zones[zoneId].center,
          radius: this.zones[zoneId].radius,
          expectedOrders: zoneData.expectedOrders,
          expectedBarq: zoneData.barq || 0,
          expectedBullet: zoneData.bullet || 0,
          timeFrame: '30 minutes',
          priority: this.calculateHotspotPriority(zoneData),
          recommendedDrivers: Math.ceil(zoneData.expectedOrders / 5),
        });
      }
    }

    // Sort by priority
    return hotspots.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Generate actionable recommendations
   */
  async generateRecommendations(forecast, fleetStatus) {
    const recommendations = [];

    // Check for demand surge
    if (forecast.shortTerm.expectedOrders.total > 50) {
      recommendations.push({
        type: 'capacity',
        priority: 'critical',
        timeFrame: '30 minutes',
        action: 'ACTIVATE_STANDBY_DRIVERS',
        details: `Expecting ${forecast.shortTerm.expectedOrders.total} orders in next 30 minutes`,
        driversNeeded: Math.ceil(forecast.shortTerm.expectedOrders.total / 5),
      });
    }

    // Fleet repositioning recommendations
    for (const hotspot of forecast.hotspots) {
      const nearbyDrivers = await this.countNearbyDrivers(hotspot.center, fleetStatus);

      if (nearbyDrivers < hotspot.recommendedDrivers) {
        recommendations.push({
          type: 'repositioning',
          priority: hotspot.priority > 0.7 ? 'high' : 'medium',
          location: hotspot.zone,
          action: 'REPOSITION_DRIVERS',
          details: `Move ${hotspot.recommendedDrivers - nearbyDrivers} drivers to ${hotspot.zone}`,
          expectedOrders: hotspot.expectedOrders,
          timeFrame: hotspot.timeFrame,
        });
      }
    }

    // Service type specific recommendations
    if (forecast.shortTerm.expectedOrders.barq > 20) {
      recommendations.push({
        type: 'service_priority',
        priority: 'high',
        action: 'PRIORITIZE_BARQ_CAPABLE',
        details: `High BARQ demand expected (${forecast.shortTerm.expectedOrders.barq} orders)`,
        timeFrame: '30 minutes',
      });
    }

    // Time-based recommendations
    const peakTimes = forecast.mediumTerm.peakTimes || [];
    for (const peak of peakTimes) {
      recommendations.push({
        type: 'peak_preparation',
        priority: 'medium',
        action: 'PREPARE_FOR_PEAK',
        details: `Peak demand expected at ${peak.time}`,
        expectedVolume: peak.expectedOrders,
        timeFrame: peak.timeUntil,
      });
    }

    // Low demand recommendations
    if (forecast.longTerm.expectedOrders.total < 10) {
      recommendations.push({
        type: 'efficiency',
        priority: 'low',
        action: 'CONSOLIDATE_FLEET',
        details: 'Low demand period - consider driver breaks or maintenance',
        timeFrame: '4 hours',
      });
    }

    return recommendations;
  }

  /**
   * Generate alerts for significant changes
   */
  generateAlerts(forecast, currentDemand) {
    const alerts = [];

    // Surge alert
    const currentRate = currentDemand.ordersPerHour || 20;
    const expectedRate = forecast.shortTerm.expectedOrders.total * 2; // Convert to hourly

    if (expectedRate > currentRate * 1.5) {
      alerts.push({
        type: 'DEMAND_SURGE',
        severity: 'high',
        message: `Demand surge expected: ${Math.round((expectedRate / currentRate - 1) * 100)}% increase`,
        timeFrame: '30 minutes',
        action: 'Activate additional drivers',
      });
    }

    // Geographic imbalance alert
    const maxZoneDemand = Math.max(
      ...Object.values(forecast.shortTerm.geographicalDistribution).map(
        (z) => z.expectedOrders || 0
      )
    );

    const minZoneDemand = Math.min(
      ...Object.values(forecast.shortTerm.geographicalDistribution).map(
        (z) => z.expectedOrders || 0
      )
    );

    if (maxZoneDemand > minZoneDemand * 3) {
      alerts.push({
        type: 'GEOGRAPHIC_IMBALANCE',
        severity: 'medium',
        message: 'Significant geographic demand imbalance detected',
        action: 'Rebalance fleet distribution',
      });
    }

    // Confidence alert
    if (forecast.confidence.overall < 0.5) {
      alerts.push({
        type: 'LOW_CONFIDENCE',
        severity: 'low',
        message: 'Forecast confidence is low due to insufficient data',
        action: 'Monitor actual demand closely',
      });
    }

    return alerts;
  }

  /**
   * Analyze historical patterns
   */
  async analyzePatterns() {
    const patterns = {
      hourly: {},
      daily: {},
      weekly: {},
      seasonal: {},
    };

    // Get historical data
    const historicalData = await this.getHistoricalData();

    // Analyze hourly patterns
    for (let hour = 0; hour < 24; hour++) {
      const hourlyOrders = historicalData.filter((order) => {
        const orderHour = new Date(order.timestamp).getHours();
        return orderHour === hour;
      });

      patterns.hourly[hour] = {
        barq: this.calculateAverage(hourlyOrders.filter((o) => o.serviceType === 'BARQ')),
        bullet: this.calculateAverage(hourlyOrders.filter((o) => o.serviceType === 'BULLET')),
        total: hourlyOrders.length / this.config.historicalDays,
      };
    }

    // Analyze daily patterns
    for (let day = 0; day < 7; day++) {
      const dailyOrders = historicalData.filter((order) => {
        const orderDay = new Date(order.timestamp).getDay();
        return orderDay === day;
      });

      const avgDaily = dailyOrders.length / (this.config.historicalDays / 7);
      const overallAvg = historicalData.length / this.config.historicalDays;

      patterns.daily[day] = {
        multiplier: avgDaily / overallAvg || 1,
        avgOrders: avgDaily,
      };
    }

    // Analyze weekly patterns
    const currentWeek = this.getWeekNumber(new Date());
    for (let weekOffset = -4; weekOffset < 0; weekOffset++) {
      const weekOrders = historicalData.filter((order) => {
        const orderWeek = this.getWeekNumber(new Date(order.timestamp));
        return orderWeek === currentWeek + weekOffset;
      });

      patterns.weekly[currentWeek + weekOffset] = {
        avgOrders: weekOrders.length / 7,
        trend: this.calculateWeeklyTrend(weekOrders),
      };
    }

    // Seasonal patterns (simplified - by month)
    const currentMonth = new Date().getMonth();
    patterns.seasonal[currentMonth] = {
      multiplier: this.getSeasonalMultiplier(currentMonth),
      events: await this.getMonthlyEvents(currentMonth),
    };

    return patterns;
  }

  /**
   * Get current demand snapshot
   */
  async getCurrentDemand() {
    // This should fetch actual current demand from database
    const recentOrders = await this.getRecentOrders(60); // Last hour

    const demand = {
      ordersPerHour: recentOrders.length,
      currentRate: {
        barq: recentOrders.filter((o) => o.serviceType === 'BARQ').length,
        bullet: recentOrders.filter((o) => o.serviceType === 'BULLET').length,
      },
      trend: this.calculateCurrentTrend(recentOrders),
      lastUpdate: Date.now(),
    };

    // Geographic distribution
    demand.geographicDistribution = this.calculateGeographicDistribution(recentOrders);

    return demand;
  }

  /**
   * Predict geographic demand distribution
   */
  async predictGeographicDemand(patterns, minutesAhead) {
    const distribution = {};

    for (const [zoneId, zoneInfo] of Object.entries(this.zones)) {
      // Base prediction from historical patterns
      const historicalAvg = await this.getZoneHistoricalAverage(zoneId);

      // Time-based adjustment
      const timeAdjustment = this.getZoneTimeAdjustment(zoneId, minutesAhead);

      // Calculate expected orders
      const expectedOrders = Math.round(historicalAvg * timeAdjustment);

      distribution[zoneId] = {
        expectedOrders,
        barq: Math.round(expectedOrders * 0.3), // 30% BARQ estimate
        bullet: Math.round(expectedOrders * 0.7), // 70% BULLET estimate
        confidence: this.calculateZoneConfidence(zoneId, patterns),
      };
    }

    return distribution;
  }

  /**
   * Calculate prediction confidence
   */
  calculatePredictionConfidence(patterns, currentDemand, minutesAhead) {
    let confidence = 1.0;

    // Reduce confidence for longer predictions
    confidence *= Math.max(0.5, 1 - minutesAhead / 480); // 480 minutes = 8 hours

    // Reduce confidence if insufficient historical data
    const dataPoints = this.historicalData.length;
    if (dataPoints < this.config.minDataPoints) {
      confidence *= dataPoints / this.config.minDataPoints;
    }

    // Reduce confidence for high variance patterns
    const variance = this.calculatePatternVariance(patterns);
    confidence *= Math.max(0.3, 1 - variance);

    // Boost confidence if recent predictions were accurate
    const recentAccuracy = this.getRecentPredictionAccuracy();
    confidence *= 0.5 + recentAccuracy * 0.5;

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Calculate overall confidence scores
   */
  calculateConfidence(patterns, currentDemand) {
    return {
      overall: this.calculatePredictionConfidence(patterns, currentDemand, 60),
      shortTerm: this.calculatePredictionConfidence(patterns, currentDemand, 30),
      mediumTerm: this.calculatePredictionConfidence(patterns, currentDemand, 120),
      longTerm: this.calculatePredictionConfidence(patterns, currentDemand, 240),
      dataQuality: this.assessDataQuality(),
      modelAccuracy: this.getModelAccuracy(),
    };
  }

  /**
   * Helper methods
   */
  getPeakHourMultiplier(hour) {
    // Riyadh peak hours
    if (hour >= 11 && hour <= 14) return 1.5; // Lunch peak
    if (hour >= 18 && hour <= 21) return 1.3; // Dinner peak
    if (hour >= 8 && hour <= 10) return 1.2; // Breakfast peak
    if (hour >= 0 && hour <= 6) return 0.3; // Night hours
    return 1.0;
  }

  getTimeOfDayImpact(minutesAhead) {
    const futureHour = new Date(Date.now() + minutesAhead * 60000).getHours();

    if (futureHour >= 11 && futureHour <= 14) return 'high';
    if (futureHour >= 18 && futureHour <= 21) return 'high';
    if (futureHour >= 0 && futureHour <= 6) return 'low';
    return 'normal';
  }

  getDayOfWeekImpact() {
    const day = new Date().getDay();
    // Friday and Saturday are weekends in Saudi Arabia
    if (day === 5 || day === 6) return 'high';
    if (day === 0) return 'low'; // Sunday
    return 'normal';
  }

  async getEventAdjustments(minutesAhead) {
    // Check for special events
    const events = await this.getUpcomingEvents(minutesAhead);

    if (events.length === 0) return 1.0;

    // Calculate event impact
    let multiplier = 1.0;
    for (const event of events) {
      switch (event.type) {
        case 'holiday':
          multiplier *= 0.7; // Lower demand on holidays
          break;
        case 'sporting_event':
          multiplier *= 1.3; // Higher demand during sports
          break;
        case 'concert':
          multiplier *= 1.2;
          break;
        default:
          multiplier *= 1.1;
      }
    }

    return multiplier;
  }

  async getWeatherAdjustments() {
    // Get current weather (mock for now)
    const weather = await this.getCurrentWeather();

    switch (weather.condition) {
      case 'sandstorm':
        return 0.5; // Significant reduction
      case 'rain':
        return 0.8; // Some reduction
      case 'extreme_heat':
        return 1.2; // Increase in delivery demand
      default:
        return 1.0;
    }
  }

  calculateHotspotPriority(zoneData) {
    // Priority based on expected volume and service mix
    const volumeScore = Math.min(1, zoneData.expectedOrders / 20);
    const barqRatio = (zoneData.barq || 0) / (zoneData.expectedOrders || 1);
    const urgencyScore = barqRatio; // BARQ orders are more urgent

    return volumeScore * 0.6 + urgencyScore * 0.4;
  }

  async countNearbyDrivers(location, fleetStatus) {
    if (!fleetStatus || !fleetStatus.drivers) return 0;

    const nearbyDrivers = fleetStatus.drivers.available.filter((driver) => {
      const distance = this.calculateDistance(driver.location, location);
      return distance <= 5; // Within 5km
    });

    return nearbyDrivers.length;
  }

  determineTrend(currentDemand, prediction) {
    const currentRate = currentDemand.ordersPerHour || 20;
    const predictedRate = prediction.expectedOrders.total * 2; // Convert to hourly

    const change = (predictedRate - currentRate) / currentRate;

    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  identifyPeakTimes(minutesAhead, patterns) {
    const peaks = [];
    const now = Date.now();

    for (let minutes = 0; minutes < minutesAhead; minutes += 30) {
      const futureTime = new Date(now + minutes * 60000);
      const hour = futureTime.getHours();

      const hourlyPattern = patterns.hourly[hour];
      if (hourlyPattern && hourlyPattern.total > 15) {
        // Peak threshold
        peaks.push({
          time: futureTime.toISOString(),
          timeUntil: `${minutes} minutes`,
          expectedOrders: hourlyPattern.total,
          type:
            hour >= 11 && hour <= 14 ? 'lunch' : hour >= 18 && hour <= 21 ? 'dinner' : 'general',
        });
      }
    }

    return peaks;
  }

  calculateDistance(point1, point2) {
    if (!point1 || !point2) return 999;

    const lat1 = point1.lat || point1.latitude;
    const lng1 = point1.lng || point1.longitude;
    const lat2 = point2.lat || point2.latitude;
    const lng2 = point2.lng || point2.longitude;

    const R = 6371;
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

  storePredictions(forecast) {
    this.predictions.set(Date.now(), {
      forecast,
      actual: null, // Will be filled when actual data comes in
      accuracy: null,
    });

    // Keep only last 100 predictions
    if (this.predictions.size > 100) {
      const firstKey = this.predictions.keys().next().value;
      this.predictions.delete(firstKey);
    }
  }

  /**
   * Update historical data
   */
  async updateHistoricalData() {
    // Only update if needed
    if (this.lastModelUpdate && Date.now() - this.lastModelUpdate < this.modelUpdateInterval) {
      return;
    }

    // Fetch recent historical data
    const newData = await this.fetchHistoricalOrders();
    this.historicalData = newData;
    this.lastModelUpdate = Date.now();

    logger.info('[DemandForecasting] Historical data updated', {
      dataPoints: this.historicalData.length,
    });
  }

  /**
   * Mock data methods - Replace with actual database queries
   */
  async getHistoricalData() {
    // Mock historical data
    return this.historicalData.length > 0
      ? this.historicalData
      : Array(500)
          .fill(null)
          .map((_, i) => ({
            id: generateId(),
            timestamp: new Date(Date.now() - i * 3600000).toISOString(),
            serviceType: Math.random() > 0.3 ? 'BULLET' : 'BARQ',
            zone: Object.keys(this.zones)[Math.floor(Math.random() * 5)],
          }));
  }

  async fetchHistoricalOrders() {
    // This should fetch from database
    return this.getHistoricalData();
  }

  async getRecentOrders(minutes) {
    // Mock recent orders
    const count = Math.floor(Math.random() * 20) + 10;
    return Array(count)
      .fill(null)
      .map(() => ({
        id: generateId(),
        timestamp: new Date(Date.now() - Math.random() * minutes * 60000),
        serviceType: Math.random() > 0.3 ? 'BULLET' : 'BARQ',
      }));
  }

  calculateAverage(orders) {
    if (orders.length === 0) return 0;
    return orders.length / this.config.historicalDays;
  }

  calculateCurrentTrend(recentOrders) {
    // Simplified trend calculation
    const firstHalf = recentOrders.filter((o, i) => i < recentOrders.length / 2);
    const secondHalf = recentOrders.filter((o, i) => i >= recentOrders.length / 2);

    if (secondHalf.length > firstHalf.length * 1.2) return 'increasing';
    if (secondHalf.length < firstHalf.length * 0.8) return 'decreasing';
    return 'stable';
  }

  calculateGeographicDistribution(orders) {
    const distribution = {};

    for (const zone of Object.keys(this.zones)) {
      distribution[zone] = orders.filter((o) => o.zone === zone).length;
    }

    return distribution;
  }

  getWeekNumber(date) {
    const firstDay = new Date(date.getFullYear(), 0, 1);
    const pastDays = (date - firstDay) / 86400000;
    return Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
  }

  calculateWeeklyTrend(orders) {
    // Simplified weekly trend
    return 'stable';
  }

  getSeasonalMultiplier(month) {
    // Saudi Arabia seasonal patterns
    if (month >= 5 && month <= 8) return 1.3; // Summer - higher demand
    if (month === 8) return 1.5; // Ramadan typically
    return 1.0;
  }

  async getMonthlyEvents(month) {
    // Mock events
    return [];
  }

  async getZoneHistoricalAverage(zoneId) {
    // Mock zone average
    return Math.random() * 15 + 5;
  }

  getZoneTimeAdjustment(zoneId, minutesAhead) {
    // Zone-specific time adjustments
    const hour = new Date(Date.now() + minutesAhead * 60000).getHours();

    // Business districts busy during work hours
    if (zoneId === 'central' && hour >= 9 && hour <= 17) return 1.3;

    // Residential areas busy in evenings
    if ((zoneId === 'north' || zoneId === 'south') && hour >= 18 && hour <= 22) return 1.2;

    return 1.0;
  }

  calculateZoneConfidence(zoneId, patterns) {
    // Simplified zone confidence
    return 0.7 + Math.random() * 0.3;
  }

  calculatePatternVariance(patterns) {
    // Calculate variance in patterns
    const hourlyValues = Object.values(patterns.hourly).map((h) => h.total || 0);
    const mean = hourlyValues.reduce((a, b) => a + b, 0) / hourlyValues.length;
    const variance =
      hourlyValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / hourlyValues.length;

    return Math.min(1, variance / (mean * mean));
  }

  getRecentPredictionAccuracy() {
    // Calculate accuracy of recent predictions
    const recentPredictions = Array.from(this.predictions.values())
      .filter((p) => p.accuracy !== null)
      .slice(-10);

    if (recentPredictions.length === 0) return 0.7; // Default

    const avgAccuracy =
      recentPredictions.reduce((sum, p) => sum + p.accuracy, 0) / recentPredictions.length;
    return avgAccuracy;
  }

  assessDataQuality() {
    const quality = {
      completeness: Math.min(1, this.historicalData.length / 1000),
      recency: this.lastModelUpdate ? 1 - (Date.now() - this.lastModelUpdate) / 86400000 : 0,
      consistency: 0.8, // Mock value
    };

    return (quality.completeness + quality.recency + quality.consistency) / 3;
  }

  getModelAccuracy() {
    // Overall model accuracy
    return this.getRecentPredictionAccuracy();
  }

  async getUpcomingEvents(minutesAhead) {
    // Mock upcoming events
    return [];
  }

  async getCurrentWeather() {
    // Mock weather
    return { condition: 'clear' };
  }

  generateBasicForecast(context) {
    // Basic fallback forecast
    return {
      timestamp: Date.now(),
      shortTerm: {
        expectedOrders: { barq: 5, bullet: 10, total: 15 },
        confidence: 0.3,
      },
      mediumTerm: {
        expectedOrders: { barq: 10, bullet: 20, total: 30 },
        confidence: 0.3,
      },
      longTerm: {
        expectedOrders: { barq: 15, bullet: 30, total: 45 },
        confidence: 0.2,
      },
      hotspots: [],
      recommendations: [],
      alerts: [
        {
          type: 'FORECAST_FALLBACK',
          severity: 'low',
          message: 'Using basic forecast due to error',
        },
      ],
    };
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

  /**
   * Get current demand patterns (for autonomous orchestrator)
   */
  async getCurrentDemand() {
    try {
      const demand = await this.execute({});
      return {
        ordersPerHour: demand.currentDemand?.ordersPerHour || 0,
        currentRate: demand.currentDemand?.rateByType || { barq: 0, bullet: 0 },
        hotspots: demand.hotspots || [],
        trend: demand.trend || 'stable',
        geographicDistribution: demand.geographicDistribution || {},
        lastUpdate: Date.now(),
      };
    } catch (error) {
      const { logger } = require('../utils/logger');
      logger.error('[DemandForecasting] getCurrentDemand() failed', { error: error.message });
      return {
        ordersPerHour: 10,
        currentRate: { barq: 2, bullet: 8 },
        hotspots: [],
        trend: 'stable',
        lastUpdate: Date.now(),
        geographicDistribution: { north: 0, south: 0, east: 0, west: 0, central: 0 },
      };
    }
  }
}

module.exports = DemandForecastingAgent;
