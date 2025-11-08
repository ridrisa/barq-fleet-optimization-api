/**
 * Geo Intelligence Agent
 * Provides location-based insights, zone management, and geographical analytics
 * Manages delivery zones, identifies hotspots, and optimizes geographical operations
 */

const { logger } = require('../utils/logger');

class GeoIntelligenceAgent {
  constructor(config, llmManager) {
    this.config = {
      name: 'Geo Intelligence',
      description: 'Location-based insights and zone management',
      version: '1.0.0',
      ...config,
    };
    this.llmManager = llmManager;

    // Geo configuration
    this.geoConfig = {
      // Zone types
      zoneTypes: {
        BARQ: {
          maxRadius: 5, // 5km radius
          maxDeliveryTime: 60, // 60 minutes
          zoneColor: '#FF6B6B', // Red for urgent
          priority: 'critical',
        },
        BULLET: {
          maxRadius: 30, // City-wide
          maxDeliveryTime: 240, // 4 hours
          zoneColor: '#4ECDC4', // Teal for standard
          priority: 'normal',
        },
        RESTRICTED: {
          accessible: false,
          reasons: ['traffic', 'construction', 'security', 'weather'],
          zoneColor: '#95A5A6', // Grey for restricted
        },
      },

      // Hotspot detection
      hotspotDetection: {
        minOrders: 5, // Min orders to qualify as hotspot
        timeWindow: 3600000, // 1 hour window
        radiusMeters: 500, // Cluster within 500m
        updateInterval: 300000, // Update every 5 minutes
      },

      // Traffic patterns
      trafficFactors: {
        peakHours: [
          { start: 7, end: 9, factor: 1.5 }, // Morning rush
          { start: 12, end: 14, factor: 1.2 }, // Lunch time
          { start: 17, end: 19, factor: 1.6 }, // Evening rush
          { start: 21, end: 23, factor: 0.8 }, // Night time
        ],
        weatherImpact: {
          clear: 1.0,
          rain: 1.3,
          heavyRain: 1.8,
          sandstorm: 2.5,
        },
      },

      // Zone optimization
      zoneOptimization: {
        dynamicBoundaries: true,
        rebalanceInterval: 1800000, // 30 minutes
        overlapAllowed: true,
        maxZonesPerDriver: 2,
      },
    };

    // Active zones
    this.zones = new Map();

    // Hotspot tracking
    this.hotspots = new Map();

    // Geographical cache
    this.geoCache = new Map();

    // Zone performance metrics
    this.zoneMetrics = new Map();

    logger.info('[GeoIntelligence] Agent initialized');
  }

  /**
   * Main execution method
   */
  async execute(context) {
    const startTime = Date.now();

    try {
      logger.info('[GeoIntelligence] Starting geographical analysis');

      // Update zones based on current conditions
      const zoneUpdate = await this.updateDeliveryZones(context);

      // Detect and analyze hotspots
      const hotspotAnalysis = await this.analyzeHotspots(context);

      // Calculate optimal delivery areas
      const optimalAreas = this.calculateOptimalDeliveryAreas(context.fleetStatus, hotspotAnalysis);

      // Analyze traffic and accessibility
      const accessibilityAnalysis = await this.analyzeAccessibility(context);

      // Generate zone recommendations
      const zoneRecommendations = await this.generateZoneRecommendations(
        zoneUpdate,
        hotspotAnalysis,
        optimalAreas,
        accessibilityAnalysis
      );

      // Calculate geographical insights
      const geoInsights = this.generateGeoInsights(hotspotAnalysis, accessibilityAnalysis, context);

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        executionTime,
        zones: Array.from(this.zones.values()),
        hotspots: Array.from(this.hotspots.values()),
        optimalAreas,
        accessibility: accessibilityAnalysis,
        recommendations: zoneRecommendations,
        insights: geoInsights,
        metrics: {
          activeZones: this.zones.size,
          identifiedHotspots: this.hotspots.size,
          restrictedAreas: accessibilityAnalysis.restrictedZones.length,
          coveragePercentage: this.calculateCoveragePercentage(),
        },
      };
    } catch (error) {
      logger.error('[GeoIntelligence] Execution failed', { error: error.message });

      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Update delivery zones based on current conditions
   */
  async updateDeliveryZones(context) {
    logger.info('[GeoIntelligence] Updating delivery zones');

    const updatedZones = [];

    // Create BARQ zones around high-demand areas
    const barqZones = this.createServiceZones('BARQ', context);
    for (const zone of barqZones) {
      this.zones.set(zone.id, zone);
      updatedZones.push(zone);
    }

    // Create BULLET zones for wider coverage
    const bulletZones = this.createServiceZones('BULLET', context);
    for (const zone of bulletZones) {
      this.zones.set(zone.id, zone);
      updatedZones.push(zone);
    }

    // Identify and mark restricted zones
    const restrictedZones = await this.identifyRestrictedZones(context);
    for (const zone of restrictedZones) {
      this.zones.set(zone.id, zone);
      updatedZones.push(zone);
    }

    // Optimize zone boundaries
    if (this.geoConfig.zoneOptimization.dynamicBoundaries) {
      await this.optimizeZoneBoundaries(updatedZones, context);
    }

    return {
      updated: updatedZones.length,
      zones: updatedZones,
      timestamp: new Date(),
    };
  }

  /**
   * Analyze hotspots for order concentration
   */
  async analyzeHotspots(context) {
    logger.info('[GeoIntelligence] Analyzing hotspots');

    const analysis = {
      timestamp: new Date(),
      hotspots: [],
      emerging: [],
      declining: [],
      patterns: [],
    };

    // Get recent orders
    const recentOrders = await this.getRecentOrders(context);

    // Cluster orders to identify hotspots
    const clusters = this.clusterOrders(recentOrders);

    for (const cluster of clusters) {
      if (cluster.orders.length >= this.geoConfig.hotspotDetection.minOrders) {
        const hotspot = {
          id: `hotspot_${Date.now()}_${cluster.center.lat}_${cluster.center.lng}`,
          center: cluster.center,
          radius: cluster.radius,
          orderCount: cluster.orders.length,
          intensity: this.calculateHotspotIntensity(cluster),
          type: this.classifyHotspot(cluster),
          predictions: await this.predictHotspotEvolution(cluster, context),
          recommendedDrivers: this.calculateRequiredDrivers(cluster),
        };

        // Categorize hotspot
        if (hotspot.predictions.trend === 'increasing') {
          analysis.emerging.push(hotspot);
        } else if (hotspot.predictions.trend === 'decreasing') {
          analysis.declining.push(hotspot);
        }

        analysis.hotspots.push(hotspot);
        this.hotspots.set(hotspot.id, hotspot);
      }
    }

    // Identify patterns
    analysis.patterns = this.identifyGeographicalPatterns(analysis.hotspots);

    return analysis;
  }

  /**
   * Calculate optimal delivery areas
   */
  calculateOptimalDeliveryAreas(fleetStatus, hotspotAnalysis) {
    logger.info('[GeoIntelligence] Calculating optimal delivery areas');

    const optimalAreas = [];

    // For each service type, calculate optimal coverage
    for (const serviceType of ['BARQ', 'BULLET']) {
      const drivers = fleetStatus.drivers.filter((d) => d.serviceType === serviceType);
      const hotspots = hotspotAnalysis.hotspots.filter((h) =>
        this.isHotspotSuitableForService(h, serviceType)
      );

      // Calculate Voronoi diagram for optimal coverage
      const voronoiCells = this.calculateVoronoiDiagram(
        drivers.map((d) => d.currentLocation),
        hotspots.map((h) => h.center)
      );

      // Create optimal areas from Voronoi cells
      for (const cell of voronoiCells) {
        optimalAreas.push({
          id: `optimal_${serviceType}_${cell.id}`,
          serviceType,
          polygon: cell.polygon,
          center: cell.center,
          assignedDrivers: this.findDriversInArea(drivers, cell.polygon),
          expectedOrders: this.estimateOrdersInArea(cell.polygon, hotspots),
          efficiency: this.calculateAreaEfficiency(cell, drivers, hotspots),
        });
      }
    }

    // Rank areas by efficiency
    optimalAreas.sort((a, b) => b.efficiency - a.efficiency);

    return optimalAreas;
  }

  /**
   * Analyze accessibility and traffic conditions
   */
  async analyzeAccessibility(context) {
    logger.info('[GeoIntelligence] Analyzing accessibility');

    const currentHour = new Date().getHours();
    const weather = await this.getCurrentWeather(context);

    const analysis = {
      timestamp: new Date(),
      trafficConditions: this.getTrafficConditions(currentHour),
      weatherImpact: this.geoConfig.trafficFactors.weatherImpact[weather] || 1.0,
      restrictedZones: [],
      slowZones: [],
      fastCorridors: [],
    };

    // Identify restricted zones
    analysis.restrictedZones = await this.identifyRestrictedZones(context);

    // Identify slow zones (high traffic areas)
    analysis.slowZones = this.identifySlowZones(currentHour, weather);

    // Identify fast corridors (optimal routes)
    analysis.fastCorridors = this.identifyFastCorridors(currentHour);

    // Calculate overall accessibility score
    analysis.accessibilityScore = this.calculateAccessibilityScore(analysis);

    return analysis;
  }

  /**
   * Generate zone recommendations
   */
  async generateZoneRecommendations(zoneUpdate, hotspotAnalysis, optimalAreas, accessibility) {
    logger.info('[GeoIntelligence] Generating zone recommendations');

    const recommendations = [];

    // Recommend zone expansions for emerging hotspots
    for (const hotspot of hotspotAnalysis.emerging) {
      recommendations.push({
        type: 'EXPAND_ZONE',
        priority: 'high',
        location: hotspot.center,
        reason: `Emerging hotspot with ${hotspot.orderCount} orders`,
        action: {
          createZone: {
            type: hotspot.intensity > 0.7 ? 'BARQ' : 'BULLET',
            center: hotspot.center,
            radius: hotspot.radius * 1.5,
          },
          assignDrivers: hotspot.recommendedDrivers,
        },
      });
    }

    // Recommend zone contractions for declining areas
    for (const hotspot of hotspotAnalysis.declining) {
      const zone = this.findZoneForLocation(hotspot.center);
      if (zone) {
        recommendations.push({
          type: 'CONTRACT_ZONE',
          priority: 'medium',
          zoneId: zone.id,
          reason: 'Declining demand in area',
          action: {
            reduceRadius: zone.radius * 0.7,
            reassignDrivers: Math.floor(zone.assignedDrivers * 0.5),
          },
        });
      }
    }

    // Recommend avoiding restricted zones
    for (const restricted of accessibility.restrictedZones) {
      recommendations.push({
        type: 'AVOID_AREA',
        priority: 'critical',
        location: restricted.center,
        reason: restricted.reason,
        duration: restricted.estimatedDuration,
        alternativeRoutes: await this.findAlternativeRoutes(restricted),
      });
    }

    // Recommend utilizing fast corridors
    for (const corridor of accessibility.fastCorridors) {
      recommendations.push({
        type: 'UTILIZE_CORRIDOR',
        priority: 'low',
        corridor: corridor,
        reason: 'Optimal route with low traffic',
        expectedTimeSaving: corridor.timeSaving,
      });
    }

    // Recommend rebalancing based on optimal areas
    const topOptimalAreas = optimalAreas.slice(0, 5);
    for (const area of topOptimalAreas) {
      if (area.assignedDrivers.length < area.expectedOrders / 3) {
        recommendations.push({
          type: 'REBALANCE_DRIVERS',
          priority: 'high',
          areaId: area.id,
          reason: 'Understaffed optimal area',
          action: {
            requiredDrivers: Math.ceil(area.expectedOrders / 3) - area.assignedDrivers.length,
            serviceType: area.serviceType,
          },
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate geographical insights
   */
  generateGeoInsights(hotspotAnalysis, accessibility, context) {
    const insights = [];

    // Hotspot insights
    if (hotspotAnalysis.emerging.length > 0) {
      insights.push({
        type: 'EMERGING_DEMAND',
        message: `${hotspotAnalysis.emerging.length} emerging hotspots detected`,
        locations: hotspotAnalysis.emerging.map((h) => h.center),
        impact: 'high',
        recommendation: 'Proactively position drivers in these areas',
      });
    }

    // Pattern insights
    for (const pattern of hotspotAnalysis.patterns) {
      insights.push({
        type: 'GEOGRAPHICAL_PATTERN',
        message: pattern.description,
        confidence: pattern.confidence,
        impact: pattern.impact,
        recommendation: pattern.recommendation,
      });
    }

    // Accessibility insights
    if (accessibility.weatherImpact > 1.2) {
      insights.push({
        type: 'WEATHER_IMPACT',
        message: `Weather conditions causing ${Math.round((accessibility.weatherImpact - 1) * 100)}% delay`,
        impact: 'medium',
        recommendation: 'Adjust delivery time estimates and inform customers',
      });
    }

    // Coverage insights
    const coveragePercentage = this.calculateCoveragePercentage();
    if (coveragePercentage < 70) {
      insights.push({
        type: 'LOW_COVERAGE',
        message: `Only ${coveragePercentage}% of city area covered`,
        impact: 'critical',
        recommendation: 'Expand zones or recruit more drivers',
      });
    }

    // Zone efficiency insights
    const inefficientZones = Array.from(this.zones.values()).filter(
      (z) => z.efficiency && z.efficiency < 0.5
    );
    if (inefficientZones.length > 0) {
      insights.push({
        type: 'INEFFICIENT_ZONES',
        message: `${inefficientZones.length} zones operating below 50% efficiency`,
        zones: inefficientZones.map((z) => z.id),
        impact: 'medium',
        recommendation: 'Consider consolidating or reorganizing these zones',
      });
    }

    return insights;
  }

  /**
   * Helper methods for zone creation and management
   */

  createServiceZones(serviceType, context) {
    const zones = [];
    const config = this.geoConfig.zoneTypes[serviceType];

    // Create zones based on demand centers
    const demandCenters = this.identifyDemandCenters(context);

    for (const center of demandCenters) {
      const zone = {
        id: `zone_${serviceType}_${Date.now()}_${zones.length}`,
        type: serviceType,
        center: center.location,
        radius: config.maxRadius,
        polygon: this.createCirclePolygon(center.location, config.maxRadius),
        assignedDrivers: [],
        activeOrders: [],
        capacity: this.calculateZoneCapacity(serviceType, center.demandLevel),
        efficiency: 1.0,
        created: new Date(),
      };

      zones.push(zone);
    }

    return zones;
  }

  identifyRestrictedZones(context) {
    // Mock implementation - would check real traffic/construction data
    const restrictedZones = [];

    // Check for known restrictions
    const restrictions = [
      {
        center: { lat: 24.71, lng: 46.68 },
        radius: 0.5,
        reason: 'construction',
        estimatedDuration: 7200000, // 2 hours
      },
      {
        center: { lat: 24.75, lng: 46.72 },
        radius: 0.3,
        reason: 'traffic',
        estimatedDuration: 3600000, // 1 hour
      },
    ];

    for (const restriction of restrictions) {
      restrictedZones.push({
        id: `restricted_${Date.now()}_${restrictedZones.length}`,
        type: 'RESTRICTED',
        ...restriction,
        polygon: this.createCirclePolygon(restriction.center, restriction.radius),
      });
    }

    return restrictedZones;
  }

  optimizeZoneBoundaries(zones, context) {
    // Adjust zone boundaries to minimize overlap and maximize coverage
    for (let i = 0; i < zones.length; i++) {
      for (let j = i + 1; j < zones.length; j++) {
        const zone1 = zones[i];
        const zone2 = zones[j];

        if (this.zonesOverlap(zone1, zone2)) {
          // Adjust boundaries to reduce overlap
          this.adjustZoneBoundaries(zone1, zone2);
        }
      }
    }
  }

  /**
   * Order clustering methods
   */

  clusterOrders(orders) {
    const clusters = [];
    const visited = new Set();

    for (const order of orders) {
      if (visited.has(order.id)) continue;

      const cluster = {
        orders: [order],
        center: order.location,
        radius: 0,
      };

      // Find nearby orders
      for (const other of orders) {
        if (other.id === order.id || visited.has(other.id)) continue;

        const distance = this.calculateDistance(order.location, other.location);
        if (distance <= this.geoConfig.hotspotDetection.radiusMeters / 1000) {
          cluster.orders.push(other);
          visited.add(other.id);
        }
      }

      // Calculate cluster center and radius
      cluster.center = this.calculateCentroid(cluster.orders.map((o) => o.location));
      cluster.radius = this.calculateClusterRadius(cluster);

      visited.add(order.id);
      clusters.push(cluster);
    }

    return clusters;
  }

  calculateHotspotIntensity(cluster) {
    // Intensity based on order density and time concentration
    const area = Math.PI * Math.pow(cluster.radius, 2);
    const density = cluster.orders.length / Math.max(area, 0.1);
    const timeSpread = this.calculateTimeSpread(cluster.orders);

    // Higher density and lower time spread = higher intensity
    const intensity = (density * 10) / Math.max(timeSpread, 1);
    return Math.min(intensity, 1.0);
  }

  classifyHotspot(cluster) {
    const intensity = this.calculateHotspotIntensity(cluster);

    if (intensity > 0.7) return 'critical';
    if (intensity > 0.4) return 'high';
    if (intensity > 0.2) return 'medium';
    return 'low';
  }

  predictHotspotEvolution(cluster, context) {
    // Simple prediction based on historical patterns
    const currentHour = new Date().getHours();
    const dayOfWeek = new Date().getDay();

    // Check if it's during peak hours
    const isPeakHour = this.geoConfig.trafficFactors.peakHours.some(
      (peak) => currentHour >= peak.start && currentHour < peak.end
    );

    let trend = 'stable';
    let confidence = 0.5;

    if (isPeakHour && currentHour < 18) {
      trend = 'increasing';
      confidence = 0.7;
    } else if (currentHour > 20) {
      trend = 'decreasing';
      confidence = 0.8;
    }

    // Weekend adjustment
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      confidence *= 0.8; // Less confident on weekends
    }

    return {
      trend,
      confidence,
      expectedChange: trend === 'increasing' ? 1.3 : trend === 'decreasing' ? 0.7 : 1.0,
      timeHorizon: 3600000, // 1 hour
    };
  }

  calculateRequiredDrivers(cluster) {
    const type = this.classifyHotspot(cluster);
    const orderCount = cluster.orders.length;

    // Calculate based on hotspot type and order count
    let barqDrivers = 0;
    let bulletDrivers = 0;

    if (type === 'critical') {
      barqDrivers = Math.ceil(orderCount / 3); // 1 BARQ driver per 3 orders
      bulletDrivers = Math.ceil(orderCount / 8); // 1 BULLET driver per 8 orders
    } else if (type === 'high') {
      barqDrivers = Math.ceil(orderCount / 5);
      bulletDrivers = Math.ceil(orderCount / 10);
    } else {
      barqDrivers = Math.ceil(orderCount / 8);
      bulletDrivers = Math.ceil(orderCount / 15);
    }

    return { barq: barqDrivers, bullet: bulletDrivers };
  }

  /**
   * Geographical calculation methods
   */

  calculateVoronoiDiagram(driverLocations, hotspotCenters) {
    // Simplified Voronoi calculation
    // In production, use a proper computational geometry library
    const cells = [];
    const allPoints = [...driverLocations, ...hotspotCenters];

    for (let i = 0; i < allPoints.length; i++) {
      const point = allPoints[i];
      const cell = {
        id: i,
        center: point,
        polygon: this.createVoronoiCell(point, allPoints),
        neighbors: [],
      };

      cells.push(cell);
    }

    return cells;
  }

  createVoronoiCell(point, allPoints) {
    // Create a polygon representing the Voronoi cell
    // Simplified implementation - would use proper algorithm in production
    const radius = 2; // 2km default radius
    return this.createCirclePolygon(point, radius);
  }

  createCirclePolygon(center, radius, points = 8) {
    const polygon = [];
    for (let i = 0; i < points; i++) {
      const angle = (2 * Math.PI * i) / points;
      polygon.push({
        lat: center.lat + (radius / 111) * Math.cos(angle),
        lng:
          center.lng + ((radius / 111) * Math.sin(angle)) / Math.cos((center.lat * Math.PI) / 180),
      });
    }
    return polygon;
  }

  calculateCentroid(locations) {
    if (locations.length === 0) return { lat: 0, lng: 0 };

    let sumLat = 0;
    let sumLng = 0;

    for (const loc of locations) {
      sumLat += loc.lat;
      sumLng += loc.lng;
    }

    return {
      lat: sumLat / locations.length,
      lng: sumLng / locations.length,
    };
  }

  calculateClusterRadius(cluster) {
    let maxDistance = 0;

    for (const order of cluster.orders) {
      const distance = this.calculateDistance(cluster.center, order.location);
      maxDistance = Math.max(maxDistance, distance);
    }

    return maxDistance;
  }

  calculateTimeSpread(orders) {
    if (orders.length <= 1) return 0;

    const timestamps = orders.map((o) => new Date(o.createdAt).getTime());
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);

    return (max - min) / 60000; // Return in minutes
  }

  calculateDistance(from, to) {
    // Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = ((to.lat - from.lat) * Math.PI) / 180;
    const dLon = ((to.lng - from.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((from.lat * Math.PI) / 180) *
        Math.cos((to.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Pattern identification methods
   */

  identifyGeographicalPatterns(hotspots) {
    const patterns = [];

    // Linear pattern detection (hotspots along a line, e.g., main road)
    const linearPattern = this.detectLinearPattern(hotspots);
    if (linearPattern) patterns.push(linearPattern);

    // Cluster pattern detection (grouped hotspots)
    const clusterPattern = this.detectClusterPattern(hotspots);
    if (clusterPattern) patterns.push(clusterPattern);

    // Time-based pattern detection
    const temporalPattern = this.detectTemporalPattern(hotspots);
    if (temporalPattern) patterns.push(temporalPattern);

    return patterns;
  }

  detectLinearPattern(hotspots) {
    // Check if hotspots form a linear pattern
    if (hotspots.length < 3) return null;

    // Simplified check - would use proper linear regression in production
    const centers = hotspots.map((h) => h.center);
    const isLinear = this.checkLinearAlignment(centers);

    if (isLinear) {
      return {
        type: 'LINEAR',
        description: 'Hotspots aligned along a corridor (likely main road)',
        confidence: 0.7,
        impact: 'medium',
        recommendation: 'Position drivers along this corridor for quick access',
      };
    }

    return null;
  }

  detectClusterPattern(hotspots) {
    // Check for clustering of hotspots
    if (hotspots.length < 4) return null;

    const avgDistance = this.calculateAverageDistance(hotspots);
    if (avgDistance < 2) {
      // Less than 2km average distance
      return {
        type: 'CLUSTERED',
        description: 'Hotspots concentrated in specific area',
        confidence: 0.8,
        impact: 'high',
        recommendation: 'Create dedicated zone with multiple drivers',
      };
    }

    return null;
  }

  detectTemporalPattern(hotspots) {
    const currentHour = new Date().getHours();

    // Check if current time matches known patterns
    for (const peak of this.geoConfig.trafficFactors.peakHours) {
      if (currentHour >= peak.start && currentHour < peak.end) {
        return {
          type: 'TEMPORAL',
          description: `Peak hour pattern detected (${peak.start}:00 - ${peak.end}:00)`,
          confidence: 0.9,
          impact: 'high',
          recommendation: `Increase driver allocation by ${Math.round((peak.factor - 1) * 100)}%`,
        };
      }
    }

    return null;
  }

  /**
   * Support methods
   */

  isHotspotSuitableForService(hotspot, serviceType) {
    if (serviceType === 'BARQ') {
      return hotspot.intensity > 0.5 || hotspot.type === 'critical';
    } else if (serviceType === 'BULLET') {
      return true; // BULLET can serve any hotspot
    }
    return false;
  }

  findDriversInArea(drivers, polygon) {
    return drivers
      .filter((driver) => this.isPointInPolygon(driver.currentLocation, polygon))
      .map((d) => d.id);
  }

  estimateOrdersInArea(polygon, hotspots) {
    let totalOrders = 0;

    for (const hotspot of hotspots) {
      if (this.isPointInPolygon(hotspot.center, polygon)) {
        totalOrders += hotspot.orderCount;
      }
    }

    return totalOrders;
  }

  calculateAreaEfficiency(cell, drivers, hotspots) {
    const driversInArea = this.findDriversInArea(drivers, cell.polygon).length;
    const ordersInArea = this.estimateOrdersInArea(cell.polygon, hotspots);

    if (driversInArea === 0) return 0;

    // Efficiency based on driver-to-order ratio
    const ratio = ordersInArea / driversInArea;
    const idealRatio = 5; // 5 orders per driver is ideal

    return Math.min(ratio / idealRatio, 1.0);
  }

  getTrafficConditions(hour) {
    for (const peak of this.geoConfig.trafficFactors.peakHours) {
      if (hour >= peak.start && hour < peak.end) {
        return {
          condition: 'heavy',
          factor: peak.factor,
          description: `Peak hours (${peak.start}:00 - ${peak.end}:00)`,
        };
      }
    }

    return {
      condition: 'normal',
      factor: 1.0,
      description: 'Normal traffic conditions',
    };
  }

  identifySlowZones(hour, weather) {
    const slowZones = [];

    // Add zones based on traffic conditions
    const traffic = this.getTrafficConditions(hour);
    if (traffic.factor > 1.3) {
      slowZones.push({
        id: 'slow_traffic_main',
        area: 'Main corridors',
        factor: traffic.factor,
        reason: 'Peak hour traffic',
      });
    }

    // Add zones based on weather
    if (weather === 'rain' || weather === 'heavyRain') {
      slowZones.push({
        id: 'slow_weather_all',
        area: 'City-wide',
        factor: this.geoConfig.trafficFactors.weatherImpact[weather],
        reason: `Weather conditions (${weather})`,
      });
    }

    return slowZones;
  }

  identifyFastCorridors(hour) {
    const corridors = [];

    // Identify fast routes based on time of day
    if (hour < 6 || hour > 22) {
      corridors.push({
        id: 'corridor_night',
        name: 'Night routes',
        timeSaving: '20%',
        description: 'All major routes clear during night hours',
      });
    }

    if (hour > 9 && hour < 12) {
      corridors.push({
        id: 'corridor_midmorning',
        name: 'Mid-morning routes',
        timeSaving: '15%',
        description: 'Optimal time between rush hours',
      });
    }

    return corridors;
  }

  calculateAccessibilityScore(analysis) {
    let score = 1.0;

    // Reduce score based on restrictions
    score -= analysis.restrictedZones.length * 0.05;

    // Reduce score based on slow zones
    score -= analysis.slowZones.length * 0.03;

    // Increase score based on fast corridors
    score += analysis.fastCorridors.length * 0.02;

    // Apply weather impact
    score *= 2 - analysis.weatherImpact;

    return Math.max(0, Math.min(1, score));
  }

  calculateCoveragePercentage() {
    // Mock calculation - would use actual city area in production
    const cityArea = 100; // 100 sq km
    const coveredArea = this.zones.size * 5; // Each zone covers ~5 sq km

    return Math.min(100, (coveredArea / cityArea) * 100);
  }

  calculateZoneCapacity(serviceType, demandLevel) {
    const baseCapacity = serviceType === 'BARQ' ? 20 : 50;
    return Math.ceil(baseCapacity * demandLevel);
  }

  findZoneForLocation(location) {
    for (const [id, zone] of this.zones) {
      if (this.isPointInPolygon(location, zone.polygon)) {
        return zone;
      }
    }
    return null;
  }

  async findAlternativeRoutes(restrictedZone) {
    // Mock implementation - would use routing service in production
    return [
      {
        id: 'alt_route_1',
        description: 'Northern bypass',
        additionalDistance: 2.5,
        additionalTime: 5,
      },
      {
        id: 'alt_route_2',
        description: 'Southern route',
        additionalDistance: 3.0,
        additionalTime: 7,
      },
    ];
  }

  zonesOverlap(zone1, zone2) {
    const distance = this.calculateDistance(zone1.center, zone2.center);
    return distance < zone1.radius + zone2.radius;
  }

  adjustZoneBoundaries(zone1, zone2) {
    const distance = this.calculateDistance(zone1.center, zone2.center);
    const overlap = zone1.radius + zone2.radius - distance;

    if (overlap > 0) {
      // Reduce both zones equally to eliminate overlap
      zone1.radius -= overlap / 2;
      zone2.radius -= overlap / 2;
    }
  }

  isPointInPolygon(point, polygon) {
    // Ray casting algorithm
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng,
        yi = polygon[i].lat;
      const xj = polygon[j].lng,
        yj = polygon[j].lat;

      const intersect =
        yi > point.lat !== yj > point.lat &&
        point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  checkLinearAlignment(centers) {
    // Simplified linear check
    if (centers.length < 3) return false;

    // Calculate variance in angles between consecutive points
    const angles = [];
    for (let i = 1; i < centers.length - 1; i++) {
      const angle = this.calculateAngle(centers[i - 1], centers[i], centers[i + 1]);
      angles.push(angle);
    }

    // If angles are similar, points are linear
    const avgAngle = angles.reduce((a, b) => a + b, 0) / angles.length;
    const variance =
      angles.reduce((sum, angle) => sum + Math.pow(angle - avgAngle, 2), 0) / angles.length;

    return variance < 0.1; // Low variance indicates linear alignment
  }

  calculateAngle(p1, p2, p3) {
    const angle1 = Math.atan2(p2.lat - p1.lat, p2.lng - p1.lng);
    const angle2 = Math.atan2(p3.lat - p2.lat, p3.lng - p2.lng);
    return Math.abs(angle1 - angle2);
  }

  calculateAverageDistance(hotspots) {
    if (hotspots.length < 2) return 0;

    let totalDistance = 0;
    let count = 0;

    for (let i = 0; i < hotspots.length; i++) {
      for (let j = i + 1; j < hotspots.length; j++) {
        totalDistance += this.calculateDistance(hotspots[i].center, hotspots[j].center);
        count++;
      }
    }

    return totalDistance / count;
  }

  identifyDemandCenters(context) {
    // Mock implementation - would analyze actual order data
    return [
      {
        location: { lat: 24.71, lng: 46.67 },
        demandLevel: 0.9,
      },
      {
        location: { lat: 24.73, lng: 46.7 },
        demandLevel: 0.7,
      },
      {
        location: { lat: 24.75, lng: 46.65 },
        demandLevel: 0.6,
      },
    ];
  }

  async getCurrentWeather(context) {
    // Mock implementation - would call weather API
    const weatherOptions = ['clear', 'rain', 'heavyRain', 'sandstorm'];
    return weatherOptions[Math.floor(Math.random() * 2)]; // Mostly clear/rain for testing
  }

  async getRecentOrders(context) {
    // Mock implementation - would fetch from database
    const orders = [];
    const now = new Date();

    for (let i = 0; i < 50; i++) {
      orders.push({
        id: `order_${i}`,
        location: {
          lat: 24.7 + Math.random() * 0.1,
          lng: 46.6 + Math.random() * 0.1,
        },
        createdAt: new Date(now - Math.random() * 3600000), // Within last hour
      });
    }

    return orders;
  }

  /**
   * Check agent health
   */
  isHealthy() {
    return {
      healthy: true,
      name: this.config.name,
      activeZones: this.zones.size,
      identifiedHotspots: this.hotspots.size,
      cacheSize: this.geoCache.size,
    };
  }
}

module.exports = GeoIntelligenceAgent;
