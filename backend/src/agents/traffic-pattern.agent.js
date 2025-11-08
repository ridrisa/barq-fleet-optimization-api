/**
 * Traffic Pattern Agent
 * Analyzes real-time and historical traffic patterns to optimize routes
 * Provides traffic predictions and alternative routing suggestions
 */

const { logger } = require('../utils/logger');

class TrafficPatternAgent {
  constructor(config, llmManager) {
    this.config = {
      name: 'Traffic Pattern',
      description: 'Analyzes traffic patterns for route optimization',
      version: '1.0.0',
      ...config,
    };
    this.llmManager = llmManager;

    // Traffic configuration
    this.trafficConfig = {
      // Traffic levels
      levels: {
        CLEAR: { factor: 1.0, speed: 40, color: '#00FF00' }, // 40 km/h
        LIGHT: { factor: 1.2, speed: 30, color: '#FFFF00' }, // 30 km/h
        MODERATE: { factor: 1.5, speed: 20, color: '#FFA500' }, // 20 km/h
        HEAVY: { factor: 2.0, speed: 15, color: '#FF0000' }, // 15 km/h
        CONGESTED: { factor: 3.0, speed: 10, color: '#8B0000' }, // 10 km/h
      },

      // Peak hours configuration
      peakHours: {
        morning: { start: 7, end: 9, factor: 1.8 },
        lunch: { start: 12, end: 14, factor: 1.3 },
        evening: { start: 17, end: 19, factor: 2.0 },
        night: { start: 21, end: 23, factor: 0.8 },
      },

      // Day of week factors
      dayFactors: {
        0: 0.7, // Sunday
        1: 1.2, // Monday
        2: 1.1, // Tuesday
        3: 1.1, // Wednesday
        4: 1.3, // Thursday
        5: 1.5, // Friday
        6: 0.8, // Saturday
      },

      // Special events impact
      eventImpact: {
        SPORTS_EVENT: { radius: 3, factor: 2.5 },
        CONCERT: { radius: 2, factor: 2.0 },
        FESTIVAL: { radius: 5, factor: 1.8 },
        ACCIDENT: { radius: 1, factor: 3.0 },
        CONSTRUCTION: { radius: 0.5, factor: 2.2 },
        WEATHER: { radius: 50, factor: 1.5 },
      },

      // Prediction configuration
      prediction: {
        horizons: [15, 30, 60, 120], // Minutes ahead
        updateInterval: 300000, // Update every 5 minutes
        historicalWeight: 0.6, // Weight for historical patterns
        realtimeWeight: 0.4, // Weight for real-time data
      },

      // Route optimization
      optimization: {
        maxAlternatives: 3,
        minTimeSaving: 5, // Minutes
        recalculationThreshold: 0.2, // 20% delay triggers recalculation
        dynamicRerouting: true,
      },
    };

    // Traffic data storage
    this.trafficData = new Map();

    // Historical patterns
    this.historicalPatterns = new Map();

    // Active incidents
    this.incidents = new Map();

    // Route predictions
    this.routePredictions = new Map();

    // Traffic metrics
    this.metrics = {
      predictions: 0,
      accuratePredictions: 0,
      routeOptimizations: 0,
      timeSaved: 0,
    };

    logger.info('[TrafficPattern] Agent initialized');
  }

  /**
   * Main execution method
   */
  async execute(context) {
    const startTime = Date.now();

    try {
      logger.info('[TrafficPattern] Starting traffic analysis');

      // Get current traffic conditions
      const currentTraffic = await this.getCurrentTrafficConditions(context);

      // Analyze historical patterns
      const historicalAnalysis = this.analyzeHistoricalPatterns(context);

      // Detect incidents and events
      const incidents = await this.detectIncidents(context);

      // Generate traffic predictions
      const predictions = await this.generateTrafficPredictions(
        currentTraffic,
        historicalAnalysis,
        incidents,
        context
      );

      // Optimize active routes
      const routeOptimizations = await this.optimizeActiveRoutes(predictions, context);

      // Generate alternative routes
      const alternatives = this.generateAlternativeRoutes(routeOptimizations, predictions);

      // Calculate traffic insights
      const insights = this.generateTrafficInsights(
        currentTraffic,
        predictions,
        routeOptimizations
      );

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        executionTime,
        currentTraffic,
        predictions,
        incidents: Array.from(this.incidents.values()),
        routeOptimizations,
        alternatives,
        insights,
        metrics: this.metrics,
      };
    } catch (error) {
      logger.error('[TrafficPattern] Execution failed', { error: error.message });

      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get current traffic conditions
   */
  async getCurrentTrafficConditions(context) {
    logger.info('[TrafficPattern] Analyzing current traffic conditions');

    const conditions = {
      timestamp: new Date(),
      overall: 'MODERATE',
      zones: [],
      mainCorridors: [],
      congestionLevel: 0,
    };

    // Analyze city zones
    const zones = this.divideCityIntoZones();

    for (const zone of zones) {
      const zoneTraffic = await this.analyzeZoneTraffic(zone, context);
      conditions.zones.push(zoneTraffic);
    }

    // Analyze main corridors
    const corridors = this.getMainCorridors();

    for (const corridor of corridors) {
      const corridorTraffic = await this.analyzeCorridorTraffic(corridor, context);
      conditions.mainCorridors.push(corridorTraffic);
    }

    // Calculate overall congestion
    conditions.congestionLevel = this.calculateOverallCongestion(conditions.zones);
    conditions.overall = this.mapCongestionToLevel(conditions.congestionLevel);

    // Store current conditions
    this.trafficData.set('current', conditions);

    return conditions;
  }

  /**
   * Analyze historical patterns
   */
  analyzeHistoricalPatterns(context) {
    logger.info('[TrafficPattern] Analyzing historical patterns');

    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    const patterns = {
      currentHour: hour,
      dayOfWeek,
      expectedFactor: 1.0,
      peakStatus: null,
      typicalConditions: null,
      anomalies: [],
    };

    // Check if current time is peak hour
    for (const [period, config] of Object.entries(this.trafficConfig.peakHours)) {
      if (hour >= config.start && hour < config.end) {
        patterns.peakStatus = period;
        patterns.expectedFactor = config.factor;
        break;
      }
    }

    // Apply day of week factor
    patterns.expectedFactor *= this.trafficConfig.dayFactors[dayOfWeek];

    // Get typical conditions for this time/day
    patterns.typicalConditions = this.getTypicalConditions(hour, dayOfWeek);

    // Detect anomalies
    patterns.anomalies = this.detectTrafficAnomalies(patterns, context);

    // Store patterns
    this.historicalPatterns.set(`${dayOfWeek}_${hour}`, patterns);

    return patterns;
  }

  /**
   * Detect traffic incidents
   */
  async detectIncidents(context) {
    logger.info('[TrafficPattern] Detecting traffic incidents');

    const incidents = [];

    // Check for accidents (mock data - would use real incident API)
    const accidents = await this.checkForAccidents(context);
    for (const accident of accidents) {
      const incident = {
        id: `incident_${Date.now()}_${incidents.length}`,
        type: 'ACCIDENT',
        location: accident.location,
        severity: accident.severity,
        impact: this.trafficConfig.eventImpact.ACCIDENT,
        estimatedClearTime: new Date(Date.now() + 3600000), // 1 hour
        affectedRoutes: this.identifyAffectedRoutes(accident.location, 1),
      };

      incidents.push(incident);
      this.incidents.set(incident.id, incident);
    }

    // Check for construction zones
    const construction = await this.checkConstructionZones(context);
    for (const zone of construction) {
      const incident = {
        id: `construction_${Date.now()}_${incidents.length}`,
        type: 'CONSTRUCTION',
        location: zone.location,
        severity: 'moderate',
        impact: this.trafficConfig.eventImpact.CONSTRUCTION,
        estimatedClearTime: zone.endTime,
        affectedRoutes: this.identifyAffectedRoutes(zone.location, 0.5),
      };

      incidents.push(incident);
      this.incidents.set(incident.id, incident);
    }

    // Check for special events
    const events = await this.checkSpecialEvents(context);
    for (const event of events) {
      const incident = {
        id: `event_${Date.now()}_${incidents.length}`,
        type: event.type,
        location: event.location,
        severity: 'low',
        impact: this.trafficConfig.eventImpact[event.type],
        estimatedClearTime: event.endTime,
        affectedRoutes: this.identifyAffectedRoutes(
          event.location,
          this.trafficConfig.eventImpact[event.type].radius
        ),
      };

      incidents.push(incident);
      this.incidents.set(incident.id, incident);
    }

    return incidents;
  }

  /**
   * Generate traffic predictions
   */
  async generateTrafficPredictions(currentTraffic, historicalAnalysis, incidents, context) {
    logger.info('[TrafficPattern] Generating traffic predictions');

    const predictions = [];

    for (const horizon of this.trafficConfig.prediction.horizons) {
      const prediction = await this.predictTrafficAtHorizon(
        horizon,
        currentTraffic,
        historicalAnalysis,
        incidents,
        context
      );

      predictions.push(prediction);

      // Store prediction
      this.routePredictions.set(`${horizon}min`, prediction);
    }

    // Update metrics
    this.metrics.predictions += predictions.length;

    return predictions;
  }

  /**
   * Predict traffic at specific time horizon
   */
  async predictTrafficAtHorizon(horizonMinutes, currentTraffic, historical, incidents, context) {
    const predictionTime = new Date(Date.now() + horizonMinutes * 60000);
    const predictionHour = predictionTime.getHours();

    // Base prediction on historical patterns
    const baseFactor = this.getHistoricalFactor(predictionHour, predictionTime.getDay());

    // Adjust for current conditions
    const currentFactor = currentTraffic.congestionLevel;
    const trend = this.calculateTrafficTrend(currentTraffic);

    // Weighted combination
    let predictedFactor =
      baseFactor * this.trafficConfig.prediction.historicalWeight +
      (currentFactor + (trend * horizonMinutes) / 60) *
        this.trafficConfig.prediction.realtimeWeight;

    // Adjust for incidents
    for (const incident of incidents) {
      if (new Date(incident.estimatedClearTime) > predictionTime) {
        predictedFactor *= 1 + incident.impact.factor * 0.2;
      }
    }

    // Generate zone-specific predictions
    const zonePredictions = [];
    for (const zone of currentTraffic.zones) {
      zonePredictions.push({
        zoneId: zone.id,
        currentLevel: zone.trafficLevel,
        predictedLevel: this.predictZoneTraffic(zone, predictedFactor, horizonMinutes),
        confidence: this.calculatePredictionConfidence(horizonMinutes),
      });
    }

    return {
      horizon: horizonMinutes,
      predictionTime,
      overallFactor: predictedFactor,
      trafficLevel: this.mapFactorToLevel(predictedFactor),
      zones: zonePredictions,
      confidence: this.calculatePredictionConfidence(horizonMinutes),
      incidents: incidents.filter((i) => new Date(i.estimatedClearTime) > predictionTime),
    };
  }

  /**
   * Optimize active routes
   */
  async optimizeActiveRoutes(predictions, context) {
    logger.info('[TrafficPattern] Optimizing active routes');

    const optimizations = [];
    const activeOrders = await this.getActiveOrders(context);

    for (const order of activeOrders) {
      if (!order.route) continue;

      const optimization = await this.optimizeRoute(order, predictions, context);

      if (optimization.improved) {
        optimizations.push(optimization);

        // Update metrics
        this.metrics.routeOptimizations++;
        this.metrics.timeSaved += optimization.timeSaved;
      }
    }

    return optimizations;
  }

  /**
   * Optimize individual route
   */
  async optimizeRoute(order, predictions, context) {
    const currentRoute = order.route;
    const currentETA = this.calculateETA(currentRoute, predictions[0]);

    // Check if optimization needed
    const delay = currentETA - new Date(order.estimatedDeliveryTime);
    const delayMinutes = delay / 60000;

    if (delayMinutes < this.trafficConfig.optimization.minTimeSaving) {
      return {
        orderId: order.id,
        improved: false,
        reason: 'Current route is optimal',
      };
    }

    // Find alternative routes
    const alternatives = await this.findAlternativeRoutes(
      order.pickup,
      order.delivery,
      predictions
    );

    if (alternatives.length === 0) {
      return {
        orderId: order.id,
        improved: false,
        reason: 'No better alternatives found',
      };
    }

    // Select best alternative
    const bestRoute = this.selectBestRoute(alternatives, order.serviceType);

    const newETA = this.calculateETA(bestRoute, predictions[0]);
    const timeSaved = (currentETA - newETA) / 60000; // in minutes

    if (timeSaved >= this.trafficConfig.optimization.minTimeSaving) {
      return {
        orderId: order.id,
        improved: true,
        originalRoute: currentRoute,
        optimizedRoute: bestRoute,
        originalETA: currentETA,
        newETA: newETA,
        timeSaved: Math.round(timeSaved),
        reason: `Avoid traffic on ${this.identifyCongestedSegments(currentRoute, predictions[0]).join(', ')}`,
      };
    }

    return {
      orderId: order.id,
      improved: false,
      reason: 'Minimal improvement',
    };
  }

  /**
   * Generate alternative routes
   */
  generateAlternativeRoutes(optimizations, predictions) {
    logger.info('[TrafficPattern] Generating alternative routes');

    const alternatives = [];

    for (const optimization of optimizations) {
      if (!optimization.improved) continue;

      // Generate backup alternatives
      const backupRoutes = this.generateBackupRoutes(optimization.optimizedRoute, predictions);

      alternatives.push({
        orderId: optimization.orderId,
        primary: optimization.optimizedRoute,
        backups: backupRoutes,
        switchConditions: this.defineSwitchConditions(backupRoutes, predictions),
      });
    }

    return alternatives;
  }

  /**
   * Generate traffic insights
   */
  generateTrafficInsights(currentTraffic, predictions, optimizations) {
    const insights = [];

    // Current traffic insight
    insights.push({
      type: 'CURRENT_CONDITIONS',
      level: currentTraffic.overall,
      message: `Current traffic: ${currentTraffic.overall}`,
      impact: this.trafficConfig.levels[currentTraffic.overall].factor,
    });

    // Congestion trends
    const trend = this.analyzeTrafficTrend(predictions);
    if (trend.increasing && trend.rate > 0.2) {
      insights.push({
        type: 'WORSENING_CONDITIONS',
        message: 'Traffic conditions expected to worsen',
        recommendation: 'Complete deliveries before conditions deteriorate',
        timeframe: `Next ${predictions[1].horizon} minutes`,
      });
    } else if (trend.decreasing && trend.rate < -0.2) {
      insights.push({
        type: 'IMPROVING_CONDITIONS',
        message: 'Traffic conditions improving',
        recommendation: 'Good window for deliveries',
        timeframe: `Next ${predictions[1].horizon} minutes`,
      });
    }

    // Incident impacts
    if (this.incidents.size > 0) {
      const majorIncidents = Array.from(this.incidents.values()).filter(
        (i) => i.severity === 'high' || i.severity === 'critical'
      );

      if (majorIncidents.length > 0) {
        insights.push({
          type: 'MAJOR_INCIDENTS',
          count: majorIncidents.length,
          message: `${majorIncidents.length} major incidents affecting routes`,
          locations: majorIncidents.map((i) => i.location),
          recommendation: 'Avoid affected areas or use alternative routes',
        });
      }
    }

    // Optimization success
    if (optimizations.length > 0) {
      const totalSaved = optimizations.reduce(
        (sum, opt) => sum + (opt.improved ? opt.timeSaved : 0),
        0
      );

      insights.push({
        type: 'OPTIMIZATION_SUCCESS',
        routesOptimized: optimizations.filter((o) => o.improved).length,
        totalTimeSaved: totalSaved,
        message: `Optimized ${optimizations.filter((o) => o.improved).length} routes`,
        averageSaving: Math.round(totalSaved / optimizations.filter((o) => o.improved).length),
      });
    }

    // Peak hour warnings
    const currentHour = new Date().getHours();
    for (const [period, config] of Object.entries(this.trafficConfig.peakHours)) {
      if (currentHour === config.start - 1) {
        insights.push({
          type: 'UPCOMING_PEAK',
          period,
          message: `${period} peak hour starting in 1 hour`,
          expectedImpact: config.factor,
          recommendation: 'Prepare for increased traffic and longer delivery times',
        });
      }
    }

    // Zone-specific insights
    const congestedZones = currentTraffic.zones.filter(
      (z) => z.trafficLevel === 'HEAVY' || z.trafficLevel === 'CONGESTED'
    );

    if (congestedZones.length > 0) {
      insights.push({
        type: 'CONGESTED_ZONES',
        zones: congestedZones.map((z) => z.id),
        message: `${congestedZones.length} zones experiencing heavy traffic`,
        recommendation: 'Prioritize deliveries outside congested areas',
      });
    }

    return insights;
  }

  /**
   * Helper methods for traffic analysis
   */

  divideCityIntoZones() {
    const zones = [];
    const gridSize = 5; // 5x5 grid

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        zones.push({
          id: `zone_${i}_${j}`,
          bounds: {
            north: 24.8 - i * 0.02,
            south: 24.8 - (i + 1) * 0.02,
            east: 46.7 + (j + 1) * 0.02,
            west: 46.7 + j * 0.02,
          },
          center: {
            lat: 24.8 - (i * 0.02 + 0.01),
            lng: 46.7 + (j * 0.02 + 0.01),
          },
        });
      }
    }

    return zones;
  }

  async analyzeZoneTraffic(zone, context) {
    // Mock traffic analysis - would use real traffic API
    const randomLevel = Math.random();
    let trafficLevel;

    if (randomLevel < 0.2) trafficLevel = 'CLEAR';
    else if (randomLevel < 0.4) trafficLevel = 'LIGHT';
    else if (randomLevel < 0.6) trafficLevel = 'MODERATE';
    else if (randomLevel < 0.8) trafficLevel = 'HEAVY';
    else trafficLevel = 'CONGESTED';

    return {
      id: zone.id,
      trafficLevel,
      congestionFactor: this.trafficConfig.levels[trafficLevel].factor,
      averageSpeed: this.trafficConfig.levels[trafficLevel].speed,
      activeVehicles: Math.floor(Math.random() * 100),
      incidents: this.getZoneIncidents(zone),
    };
  }

  getMainCorridors() {
    // Mock main corridors
    return [
      {
        id: 'corridor_1',
        name: 'Main Highway',
        start: { lat: 24.7, lng: 46.6 },
        end: { lat: 24.8, lng: 46.7 },
        importance: 'high',
      },
      {
        id: 'corridor_2',
        name: 'City Center Route',
        start: { lat: 24.75, lng: 46.65 },
        end: { lat: 24.75, lng: 46.75 },
        importance: 'high',
      },
      {
        id: 'corridor_3',
        name: 'Ring Road',
        start: { lat: 24.72, lng: 46.68 },
        end: { lat: 24.78, lng: 46.68 },
        importance: 'medium',
      },
    ];
  }

  async analyzeCorridorTraffic(corridor, context) {
    // Mock corridor analysis
    const congestion = Math.random();

    return {
      id: corridor.id,
      name: corridor.name,
      congestionLevel: congestion,
      flowRate: Math.floor((1 - congestion) * 100), // vehicles per minute
      averageSpeed: Math.floor((1 - congestion) * 50 + 10), // km/h
      incidents: this.getCorridorIncidents(corridor),
    };
  }

  calculateOverallCongestion(zones) {
    if (zones.length === 0) return 0;

    const totalCongestion = zones.reduce((sum, zone) => sum + zone.congestionFactor, 0);

    return totalCongestion / zones.length;
  }

  mapCongestionToLevel(congestion) {
    if (congestion <= 1.2) return 'CLEAR';
    if (congestion <= 1.5) return 'LIGHT';
    if (congestion <= 1.8) return 'MODERATE';
    if (congestion <= 2.5) return 'HEAVY';
    return 'CONGESTED';
  }

  mapFactorToLevel(factor) {
    for (const [level, config] of Object.entries(this.trafficConfig.levels)) {
      if (factor <= config.factor) return level;
    }
    return 'CONGESTED';
  }

  getTypicalConditions(hour, dayOfWeek) {
    // Mock typical conditions based on patterns
    const baseFactor = 1.0;
    let factor = baseFactor;

    // Apply peak hour factor
    for (const config of Object.values(this.trafficConfig.peakHours)) {
      if (hour >= config.start && hour < config.end) {
        factor *= config.factor;
        break;
      }
    }

    // Apply day factor
    factor *= this.trafficConfig.dayFactors[dayOfWeek];

    return {
      expectedLevel: this.mapFactorToLevel(factor),
      expectedFactor: factor,
      historicalAverage: factor,
    };
  }

  detectTrafficAnomalies(patterns, context) {
    const anomalies = [];

    // Check if current traffic significantly differs from expected
    const currentFactor = this.trafficData.get('current')?.congestionLevel || 1.0;
    const expectedFactor = patterns.expectedFactor;

    const deviation = Math.abs(currentFactor - expectedFactor) / expectedFactor;

    if (deviation > 0.3) {
      anomalies.push({
        type: 'UNEXPECTED_TRAFFIC',
        severity: deviation > 0.5 ? 'high' : 'medium',
        message:
          currentFactor > expectedFactor
            ? 'Traffic heavier than usual'
            : 'Traffic lighter than usual',
        deviation: Math.round(deviation * 100),
      });
    }

    return anomalies;
  }

  getHistoricalFactor(hour, dayOfWeek) {
    const key = `${dayOfWeek}_${hour}`;
    const historical = this.historicalPatterns.get(key);

    if (historical) {
      return historical.expectedFactor;
    }

    // Calculate default based on config
    let factor = 1.0;

    for (const config of Object.values(this.trafficConfig.peakHours)) {
      if (hour >= config.start && hour < config.end) {
        factor = config.factor;
        break;
      }
    }

    factor *= this.trafficConfig.dayFactors[dayOfWeek];

    return factor;
  }

  calculateTrafficTrend(currentTraffic) {
    // Simple trend calculation - would use more sophisticated analysis
    const recentData = this.getRecentTrafficData();

    if (recentData.length < 2) return 0;

    const current = currentTraffic.congestionLevel;
    const previous = recentData[recentData.length - 1].congestionLevel;

    return (current - previous) / previous;
  }

  predictZoneTraffic(zone, overallFactor, horizonMinutes) {
    // Predict zone-specific traffic
    const currentFactor = zone.congestionFactor;
    const trend = (overallFactor - currentFactor) / currentFactor;

    // Apply trend over time
    const predictedFactor = currentFactor * (1 + (trend * horizonMinutes) / 60);

    return this.mapFactorToLevel(predictedFactor);
  }

  calculatePredictionConfidence(horizonMinutes) {
    // Confidence decreases with longer horizons
    const baseConfidence = 0.9;
    const decay = 0.005; // 0.5% per minute

    return Math.max(0.5, baseConfidence - decay * horizonMinutes);
  }

  analyzeTrafficTrend(predictions) {
    if (predictions.length < 2) {
      return { increasing: false, decreasing: false, rate: 0 };
    }

    const factors = predictions.map((p) => p.overallFactor);
    const firstFactor = factors[0];
    const lastFactor = factors[factors.length - 1];

    const rate = (lastFactor - firstFactor) / firstFactor;

    return {
      increasing: rate > 0,
      decreasing: rate < 0,
      rate: rate,
    };
  }

  calculateETA(route, prediction) {
    if (!route || !route.distance) {
      return new Date(Date.now() + 3600000); // Default 1 hour
    }

    const baseTime = (route.distance / 30) * 60; // Base time at 30 km/h in minutes
    const adjustedTime = baseTime * prediction.overallFactor;

    return new Date(Date.now() + adjustedTime * 60000);
  }

  async findAlternativeRoutes(pickup, delivery, predictions) {
    // Mock alternative route generation
    const alternatives = [];

    for (let i = 0; i < this.trafficConfig.optimization.maxAlternatives; i++) {
      alternatives.push({
        id: `route_alt_${i}`,
        distance: 10 + Math.random() * 5, // 10-15 km
        estimatedTime: 20 + Math.random() * 20, // 20-40 minutes
        trafficFactor: 1 + Math.random(),
        avoidedZones: this.getCongestedZones(predictions[0]),
        waypoints: this.generateWaypoints(pickup, delivery),
      });
    }

    return alternatives;
  }

  selectBestRoute(alternatives, serviceType) {
    // Select route based on service type priorities
    if (serviceType === 'BARQ') {
      // Prioritize time for BARQ
      return alternatives.sort((a, b) => a.estimatedTime - b.estimatedTime)[0];
    } else {
      // Balance time and reliability for BULLET
      return alternatives.sort((a, b) => {
        const scoreA = a.estimatedTime + a.trafficFactor * 10;
        const scoreB = b.estimatedTime + b.trafficFactor * 10;
        return scoreA - scoreB;
      })[0];
    }
  }

  identifyCongestedSegments(route, prediction) {
    const congested = [];

    for (const zone of prediction.zones) {
      if (zone.predictedLevel === 'HEAVY' || zone.predictedLevel === 'CONGESTED') {
        congested.push(zone.zoneId);
      }
    }

    return congested;
  }

  generateBackupRoutes(primaryRoute, predictions) {
    // Generate 2 backup routes
    return [
      {
        id: `backup_1_${primaryRoute.id}`,
        trigger: 'PRIMARY_CONGESTED',
        route: { ...primaryRoute, id: `backup_1_${primaryRoute.id}` },
      },
      {
        id: `backup_2_${primaryRoute.id}`,
        trigger: 'INCIDENT_DETECTED',
        route: { ...primaryRoute, id: `backup_2_${primaryRoute.id}` },
      },
    ];
  }

  defineSwitchConditions(backupRoutes, predictions) {
    return backupRoutes.map((backup) => ({
      routeId: backup.id,
      trigger: backup.trigger,
      threshold: backup.trigger === 'PRIMARY_CONGESTED' ? 2.0 : null,
      checkInterval: 300000, // Check every 5 minutes
    }));
  }

  identifyAffectedRoutes(location, radius) {
    // Mock implementation - would calculate actual affected routes
    const affected = [];

    for (let i = 0; i < Math.ceil(radius); i++) {
      affected.push(`route_${Math.floor(Math.random() * 100)}`);
    }

    return affected;
  }

  getZoneIncidents(zone) {
    // Check if any incidents in this zone
    const incidents = [];

    for (const incident of this.incidents.values()) {
      if (this.isLocationInZone(incident.location, zone)) {
        incidents.push(incident.id);
      }
    }

    return incidents;
  }

  getCorridorIncidents(corridor) {
    // Check incidents along corridor
    const incidents = [];

    for (const incident of this.incidents.values()) {
      if (this.isLocationOnCorridor(incident.location, corridor)) {
        incidents.push(incident.id);
      }
    }

    return incidents;
  }

  isLocationInZone(location, zone) {
    return (
      location.lat <= zone.bounds.north &&
      location.lat >= zone.bounds.south &&
      location.lng >= zone.bounds.west &&
      location.lng <= zone.bounds.east
    );
  }

  isLocationOnCorridor(location, corridor) {
    // Simplified check - would use proper line-point distance calculation
    const tolerance = 0.01; // ~1km tolerance

    const minLat = Math.min(corridor.start.lat, corridor.end.lat) - tolerance;
    const maxLat = Math.max(corridor.start.lat, corridor.end.lat) + tolerance;
    const minLng = Math.min(corridor.start.lng, corridor.end.lng) - tolerance;
    const maxLng = Math.max(corridor.start.lng, corridor.end.lng) + tolerance;

    return (
      location.lat >= minLat &&
      location.lat <= maxLat &&
      location.lng >= minLng &&
      location.lng <= maxLng
    );
  }

  getCongestedZones(prediction) {
    return prediction.zones
      .filter((z) => z.predictedLevel === 'HEAVY' || z.predictedLevel === 'CONGESTED')
      .map((z) => z.zoneId);
  }

  generateWaypoints(pickup, delivery) {
    // Generate intermediate waypoints
    const waypoints = [];
    const steps = 3 + Math.floor(Math.random() * 3); // 3-5 waypoints

    for (let i = 1; i < steps; i++) {
      const ratio = i / steps;
      waypoints.push({
        lat: pickup.lat + (delivery.lat - pickup.lat) * ratio,
        lng: pickup.lng + (delivery.lng - pickup.lng) * ratio,
      });
    }

    return waypoints;
  }

  getRecentTrafficData() {
    // Return recent traffic data for trend analysis
    const recent = [];

    for (const [key, value] of this.trafficData) {
      if (key.startsWith('history_')) {
        recent.push(value);
      }
    }

    return recent.sort((a, b) => a.timestamp - b.timestamp);
  }

  // Mock data retrieval methods

  async checkForAccidents(context) {
    // Mock accident data - would use real incident API
    const accidents = [];

    if (Math.random() > 0.7) {
      accidents.push({
        location: {
          lat: 24.7 + Math.random() * 0.1,
          lng: 46.6 + Math.random() * 0.1,
        },
        severity: Math.random() > 0.5 ? 'high' : 'moderate',
        reportedAt: new Date(),
      });
    }

    return accidents;
  }

  async checkConstructionZones(context) {
    // Mock construction zones
    return [
      {
        location: { lat: 24.71, lng: 46.68 },
        endTime: new Date(Date.now() + 7 * 24 * 3600000), // 1 week
      },
    ];
  }

  async checkSpecialEvents(context) {
    // Mock special events
    const events = [];

    if (new Date().getDay() === 5) {
      // Friday
      events.push({
        type: 'SPORTS_EVENT',
        location: { lat: 24.75, lng: 46.7 },
        endTime: new Date(Date.now() + 4 * 3600000), // 4 hours
      });
    }

    return events;
  }

  async getActiveOrders(context) {
    // Mock active orders
    return context.activeOrders || [];
  }

  /**
   * Check agent health
   */
  isHealthy() {
    return {
      healthy: true,
      name: this.config.name,
      activeIncidents: this.incidents.size,
      predictionsGenerated: this.metrics.predictions,
      accuracyRate:
        this.metrics.predictions > 0
          ? this.metrics.accuratePredictions / this.metrics.predictions
          : 1.0,
      routeOptimizations: this.metrics.routeOptimizations,
      timeSaved: Math.round(this.metrics.timeSaved),
    };
  }

  /**
   * Get current traffic conditions (for autonomous orchestrator)
   */
  async getConditions() {
    try {
      const traffic = await this.execute({});
      return {
        congestionLevel: traffic.congestion?.averageLevel || 'LOW',
        congestedAreas: traffic.congestion?.areas || [],
        incidents: traffic.incidents || [],
        averageSpeed: traffic.avgSpeed || 50,
        delayFactor: traffic.delayFactor || 1.0,
        timestamp: traffic.timestamp || Date.now(),
      };
    } catch (error) {
      const { logger } = require('../utils/logger');
      logger.error('[TrafficPattern] getConditions() failed', { error: error.message });
      return {
        congestionLevel: 'LOW',
        congestedAreas: [],
        incidents: [],
        averageSpeed: 50,
        delayFactor: 1.0,
        timestamp: Date.now(),
      };
    }
  }
}

module.exports = TrafficPatternAgent;
