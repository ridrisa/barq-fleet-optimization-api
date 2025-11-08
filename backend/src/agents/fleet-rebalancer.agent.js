/**
 * Fleet Rebalancer Agent
 * Optimizes geographical distribution of drivers to ensure proper coverage
 * Anticipates demand patterns and repositions idle drivers strategically
 * Critical for maintaining SLA compliance across the city
 */

const { logger } = require('../utils/logger');

class FleetRebalancerAgent {
  constructor(config, llmManager) {
    this.config = {
      name: 'Fleet Rebalancer',
      description: 'Optimizes driver geographical distribution',
      version: '1.0.0',
      ...config,
    };
    this.llmManager = llmManager;

    // Rebalancing configuration
    this.rebalanceConfig = {
      // Grid division for city coverage analysis
      gridSize: {
        rows: 10,
        cols: 10,
      },

      // Coverage requirements
      coverage: {
        BARQ: {
          minDriversPerGrid: 2,
          maxDriversPerGrid: 8,
          idealCoverage: 0.85, // 85% of grid cells covered
          maxDistanceToGrid: 3, // km
        },
        BULLET: {
          minDriversPerGrid: 1,
          maxDriversPerGrid: 5,
          idealCoverage: 0.7, // 70% coverage sufficient
          maxDistanceToGrid: 10, // km
        },
      },

      // Rebalancing triggers
      triggers: {
        demandImbalanceThreshold: 0.3, // 30% deviation
        idleTimeThreshold: 600, // 10 minutes idle
        coverageGapThreshold: 0.15, // 15% below ideal
        checkInterval: 300000, // Check every 5 minutes
      },

      // Repositioning strategies
      strategies: {
        PROACTIVE: 'proactive', // Before demand spike
        REACTIVE: 'reactive', // After demand detected
        PREDICTIVE: 'predictive', // Based on forecasts
        EMERGENCY: 'emergency', // Critical coverage gaps
      },
    };

    // City grid state
    this.cityGrid = this.initializeCityGrid();

    // Rebalancing history
    this.rebalanceHistory = [];

    // Active repositioning orders
    this.activeRepositioning = new Map();

    logger.info('[FleetRebalancer] Agent initialized');
  }

  /**
   * Initialize city grid for coverage analysis
   */
  initializeCityGrid() {
    const { rows, cols } = this.rebalanceConfig.gridSize;
    const grid = [];

    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) {
        row.push({
          id: `grid_${i}_${j}`,
          row: i,
          col: j,
          center: this.calculateGridCenter(i, j),
          drivers: [],
          pendingOrders: 0,
          historicalDemand: this.getHistoricalDemand(i, j),
          coverageScore: 0,
          lastUpdated: new Date(),
        });
      }
      grid.push(row);
    }

    return grid;
  }

  /**
   * Main execution method
   */
  async execute(context) {
    const startTime = Date.now();

    try {
      logger.info('[FleetRebalancer] Starting fleet rebalancing analysis');

      // Get current fleet status
      const fleetStatus = await this.getFleetStatus(context);

      // Analyze city coverage
      const coverageAnalysis = this.analyzeCoverage(fleetStatus);

      // Identify rebalancing needs
      const rebalanceNeeds = this.identifyRebalanceNeeds(coverageAnalysis, context.demandForecast);

      // Generate repositioning plan
      const repositioningPlan = await this.generateRepositioningPlan(
        rebalanceNeeds,
        fleetStatus,
        context
      );

      // Execute repositioning if needed
      if (repositioningPlan.actions.length > 0) {
        await this.executeRepositioning(repositioningPlan);
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        executionTime,
        coverageAnalysis,
        rebalanceNeeds,
        repositioningPlan,
        metrics: {
          citywideCoverage: coverageAnalysis.overallCoverage,
          underservedGrids: coverageAnalysis.underservedGrids.length,
          overservedGrids: coverageAnalysis.overservedGrids.length,
          repositioningOrders: repositioningPlan.actions.length,
          estimatedImprovement: repositioningPlan.expectedImprovement,
        },
      };
    } catch (error) {
      logger.error('[FleetRebalancer] Execution failed', { error: error.message });

      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Analyze city coverage
   */
  analyzeCoverage(fleetStatus) {
    logger.info('[FleetRebalancer] Analyzing city coverage');

    // Update grid with current driver positions
    this.updateGridWithDrivers(fleetStatus);

    const analysis = {
      timestamp: new Date(),
      grids: [],
      underservedGrids: [],
      overservedGrids: [],
      optimalGrids: [],
      overallCoverage: 0,
      barqCoverage: 0,
      bulletCoverage: 0,
    };

    let totalCoveredGrids = 0;
    let barqCoveredGrids = 0;
    let bulletCoveredGrids = 0;

    // Analyze each grid cell
    for (const row of this.cityGrid) {
      for (const grid of row) {
        const gridAnalysis = this.analyzeGrid(grid, fleetStatus);

        analysis.grids.push(gridAnalysis);

        // Categorize grids
        if (gridAnalysis.isUnderserved) {
          analysis.underservedGrids.push(gridAnalysis);
        } else if (gridAnalysis.isOverserved) {
          analysis.overservedGrids.push(gridAnalysis);
        } else {
          analysis.optimalGrids.push(gridAnalysis);
        }

        // Calculate coverage
        if (gridAnalysis.barqDrivers > 0) {
          barqCoveredGrids++;
          totalCoveredGrids++;
        } else if (gridAnalysis.bulletDrivers > 0) {
          bulletCoveredGrids++;
          totalCoveredGrids++;
        }
      }
    }

    // Calculate coverage percentages
    const totalGrids = this.rebalanceConfig.gridSize.rows * this.rebalanceConfig.gridSize.cols;
    analysis.overallCoverage = totalCoveredGrids / totalGrids;
    analysis.barqCoverage = barqCoveredGrids / totalGrids;
    analysis.bulletCoverage = bulletCoveredGrids / totalGrids;

    return analysis;
  }

  /**
   * Analyze individual grid
   */
  analyzeGrid(grid, fleetStatus) {
    const barqDrivers = grid.drivers.filter((d) =>
      fleetStatus.drivers.find((fd) => fd.id === d && fd.serviceType === 'BARQ')
    ).length;

    const bulletDrivers = grid.drivers.filter((d) =>
      fleetStatus.drivers.find((fd) => fd.id === d && fd.serviceType === 'BULLET')
    ).length;

    const totalDrivers = barqDrivers + bulletDrivers;

    // Determine service levels
    const barqConfig = this.rebalanceConfig.coverage.BARQ;
    const bulletConfig = this.rebalanceConfig.coverage.BULLET;

    const isUnderserved =
      (barqDrivers < barqConfig.minDriversPerGrid && grid.historicalDemand.barq > 0.1) ||
      (bulletDrivers < bulletConfig.minDriversPerGrid && grid.historicalDemand.bullet > 0.1);

    const isOverserved =
      barqDrivers > barqConfig.maxDriversPerGrid || bulletDrivers > bulletConfig.maxDriversPerGrid;

    // Calculate coverage score (0-1)
    const coverageScore = this.calculateCoverageScore(
      barqDrivers,
      bulletDrivers,
      grid.historicalDemand
    );

    return {
      gridId: grid.id,
      row: grid.row,
      col: grid.col,
      center: grid.center,
      barqDrivers,
      bulletDrivers,
      totalDrivers,
      pendingOrders: grid.pendingOrders,
      historicalDemand: grid.historicalDemand,
      coverageScore,
      isUnderserved,
      isOverserved,
      needsBarq: barqDrivers < barqConfig.minDriversPerGrid,
      needsBullet: bulletDrivers < bulletConfig.minDriversPerGrid,
    };
  }

  /**
   * Identify rebalancing needs
   */
  identifyRebalanceNeeds(coverageAnalysis, demandForecast) {
    const needs = {
      critical: [], // Immediate rebalancing needed
      high: [], // Rebalance soon
      medium: [], // Consider rebalancing
      low: [], // Monitor only
      strategy: null,
    };

    // Check for critical coverage gaps
    for (const grid of coverageAnalysis.underservedGrids) {
      const priority = this.calculateRebalancePriority(grid, demandForecast);

      const need = {
        gridId: grid.gridId,
        location: grid.center,
        currentDrivers: grid.totalDrivers,
        requiredBarq: Math.max(0, 2 - grid.barqDrivers),
        requiredBullet: Math.max(0, 1 - grid.bulletDrivers),
        priority,
        reason: this.determineRebalanceReason(grid),
      };

      // Categorize by priority
      if (priority > 0.8) {
        needs.critical.push(need);
      } else if (priority > 0.6) {
        needs.high.push(need);
      } else if (priority > 0.4) {
        needs.medium.push(need);
      } else {
        needs.low.push(need);
      }
    }

    // Determine rebalancing strategy
    if (needs.critical.length > 0) {
      needs.strategy = this.rebalanceConfig.strategies.EMERGENCY;
    } else if (demandForecast && demandForecast.expectedSpike) {
      needs.strategy = this.rebalanceConfig.strategies.PREDICTIVE;
    } else if (needs.high.length > 3) {
      needs.strategy = this.rebalanceConfig.strategies.PROACTIVE;
    } else {
      needs.strategy = this.rebalanceConfig.strategies.REACTIVE;
    }

    return needs;
  }

  /**
   * Generate repositioning plan
   */
  async generateRepositioningPlan(rebalanceNeeds, fleetStatus, context) {
    logger.info('[FleetRebalancer] Generating repositioning plan', {
      strategy: rebalanceNeeds.strategy,
      criticalNeeds: rebalanceNeeds.critical.length,
    });

    const plan = {
      timestamp: new Date(),
      strategy: rebalanceNeeds.strategy,
      actions: [],
      expectedImprovement: 0,
      estimatedTime: 0,
      cost: 0,
    };

    // Get available drivers for repositioning
    const availableDrivers = this.getAvailableForRepositioning(fleetStatus);

    if (availableDrivers.length === 0) {
      logger.warn('[FleetRebalancer] No drivers available for repositioning');
      return plan;
    }

    // Process critical needs first
    for (const need of rebalanceNeeds.critical) {
      const repositionActions = await this.createRepositionActions(
        need,
        availableDrivers,
        'critical'
      );
      plan.actions.push(...repositionActions);
    }

    // Process high priority needs if drivers available
    if (
      availableDrivers.length > 0 &&
      rebalanceNeeds.strategy !== this.rebalanceConfig.strategies.EMERGENCY
    ) {
      for (const need of rebalanceNeeds.high) {
        const repositionActions = await this.createRepositionActions(
          need,
          availableDrivers,
          'high'
        );
        plan.actions.push(...repositionActions);
      }
    }

    // Calculate expected improvement
    plan.expectedImprovement = this.calculateExpectedImprovement(plan.actions, rebalanceNeeds);

    // Estimate execution time
    plan.estimatedTime = this.estimateRepositioningTime(plan.actions);

    // Calculate cost (incentives, fuel, etc.)
    plan.cost = this.calculateRepositioningCost(plan.actions);

    return plan;
  }

  /**
   * Create reposition actions for a specific need
   */
  async createRepositionActions(need, availableDrivers, priority) {
    const actions = [];

    // Find best drivers to reposition
    const candidateDrivers = this.findBestRepositionCandidates(need, availableDrivers, priority);

    for (const driver of candidateDrivers) {
      if (need.requiredBarq > 0 && driver.serviceType === 'BARQ') {
        actions.push({
          type: 'REPOSITION',
          driverId: driver.id,
          from: driver.currentLocation,
          to: need.location,
          gridId: need.gridId,
          priority: priority,
          reason: need.reason,
          estimatedTime: this.calculateTravelTime(driver.currentLocation, need.location),
          incentive: this.calculateIncentive(priority, driver),
        });
        need.requiredBarq--;

        // Remove driver from available pool
        const index = availableDrivers.indexOf(driver);
        if (index > -1) availableDrivers.splice(index, 1);
      } else if (need.requiredBullet > 0 && driver.serviceType === 'BULLET') {
        actions.push({
          type: 'REPOSITION',
          driverId: driver.id,
          from: driver.currentLocation,
          to: need.location,
          gridId: need.gridId,
          priority: priority,
          reason: need.reason,
          estimatedTime: this.calculateTravelTime(driver.currentLocation, need.location),
          incentive: this.calculateIncentive(priority, driver),
        });
        need.requiredBullet--;

        // Remove driver from available pool
        const index = availableDrivers.indexOf(driver);
        if (index > -1) availableDrivers.splice(index, 1);
      }

      // Stop if need is fulfilled
      if (need.requiredBarq <= 0 && need.requiredBullet <= 0) {
        break;
      }
    }

    return actions;
  }

  /**
   * Execute repositioning plan
   */
  async executeRepositioning(plan) {
    logger.info('[FleetRebalancer] Executing repositioning plan', {
      actions: plan.actions.length,
      strategy: plan.strategy,
    });

    const results = {
      successful: [],
      failed: [],
      declined: [],
    };

    for (const action of plan.actions) {
      try {
        // Send repositioning request to driver
        const response = await this.sendRepositionRequest(action);

        if (response.accepted) {
          results.successful.push({
            ...action,
            acceptedAt: new Date(),
          });

          // Track active repositioning
          this.activeRepositioning.set(action.driverId, {
            ...action,
            status: 'in_progress',
            startedAt: new Date(),
          });
        } else {
          results.declined.push({
            ...action,
            reason: response.reason,
          });
        }
      } catch (error) {
        logger.error('[FleetRebalancer] Failed to send reposition request', {
          action,
          error: error.message,
        });
        results.failed.push({
          ...action,
          error: error.message,
        });
      }
    }

    // Update history
    this.rebalanceHistory.push({
      timestamp: new Date(),
      plan,
      results,
      success_rate: results.successful.length / plan.actions.length,
    });

    return results;
  }

  /**
   * Helper method to get available drivers for repositioning
   */
  getAvailableForRepositioning(fleetStatus) {
    return fleetStatus.drivers.filter((driver) => {
      return (
        driver.status === 'idle' &&
        driver.available &&
        !this.activeRepositioning.has(driver.id) &&
        driver.idleTime > 300 // Idle for more than 5 minutes
      );
    });
  }

  /**
   * Find best candidates for repositioning
   */
  findBestRepositionCandidates(need, availableDrivers, priority) {
    // Score and rank drivers
    const scoredDrivers = availableDrivers.map((driver) => {
      const distance = this.calculateDistance(driver.currentLocation, need.location);

      const score = this.calculateRepositionScore(driver, need, distance, priority);

      return { ...driver, score, distance };
    });

    // Sort by score (higher is better)
    scoredDrivers.sort((a, b) => b.score - a.score);

    // Return top candidates
    const maxCandidates = need.requiredBarq + need.requiredBullet;
    return scoredDrivers.slice(0, maxCandidates);
  }

  /**
   * Calculate repositioning score for a driver
   */
  calculateRepositionScore(driver, need, distance, priority) {
    let score = 100;

    // Distance penalty (closer is better)
    score -= distance * 2;

    // Service type match bonus
    if (need.requiredBarq > 0 && driver.serviceType === 'BARQ') {
      score += 20;
    } else if (need.requiredBullet > 0 && driver.serviceType === 'BULLET') {
      score += 15;
    }

    // Idle time bonus (longer idle gets priority)
    score += Math.min(driver.idleTime / 60, 20); // Max 20 points for idle time

    // Priority multiplier
    if (priority === 'critical') {
      score *= 1.5;
    } else if (priority === 'high') {
      score *= 1.2;
    }

    // Driver rating bonus
    score += (driver.rating - 4) * 5; // Bonus/penalty based on rating

    return Math.max(0, score);
  }

  /**
   * Helper methods
   */

  updateGridWithDrivers(fleetStatus) {
    // Clear existing driver assignments
    for (const row of this.cityGrid) {
      for (const grid of row) {
        grid.drivers = [];
      }
    }

    // Assign drivers to grids based on location
    for (const driver of fleetStatus.drivers) {
      const grid = this.getGridForLocation(driver.currentLocation);
      if (grid) {
        grid.drivers.push(driver.id);
        grid.lastUpdated = new Date();
      }
    }
  }

  getGridForLocation(location) {
    // Mock implementation - convert lat/lng to grid coordinates
    const row = Math.floor(location.lat * 10) % this.rebalanceConfig.gridSize.rows;
    const col = Math.floor(location.lng * 10) % this.rebalanceConfig.gridSize.cols;

    if (
      row >= 0 &&
      row < this.rebalanceConfig.gridSize.rows &&
      col >= 0 &&
      col < this.rebalanceConfig.gridSize.cols
    ) {
      return this.cityGrid[row][col];
    }
    return null;
  }

  calculateGridCenter(row, col) {
    // Mock calculation - would use actual city boundaries
    return {
      lat: 24.7 + row * 0.01, // Example for a city
      lng: 46.6 + col * 0.01,
    };
  }

  getHistoricalDemand(row, col) {
    // Mock historical demand - would query actual data
    return {
      barq: Math.random() * 0.5, // 0-0.5 normalized demand
      bullet: Math.random() * 0.3, // 0-0.3 normalized demand
      peak_hours: [8, 12, 18], // Peak demand hours
      average_orders: Math.floor(Math.random() * 20),
    };
  }

  calculateCoverageScore(barqDrivers, bulletDrivers, historicalDemand) {
    const barqScore = Math.min(barqDrivers / (historicalDemand.barq * 10 + 1), 1);

    const bulletScore = Math.min(bulletDrivers / (historicalDemand.bullet * 10 + 1), 1);

    return barqScore * 0.6 + bulletScore * 0.4;
  }

  calculateRebalancePriority(grid, demandForecast) {
    let priority = 0;

    // Base priority on coverage deficit
    if (grid.barqDrivers === 0 && grid.historicalDemand.barq > 0.3) {
      priority += 0.4;
    }
    if (grid.bulletDrivers === 0 && grid.historicalDemand.bullet > 0.2) {
      priority += 0.3;
    }

    // Boost for pending orders
    priority += Math.min(grid.pendingOrders * 0.1, 0.3);

    // Boost for forecasted demand
    if (demandForecast && demandForecast.hotspots) {
      const isHotspot = demandForecast.hotspots.some((h) => this.isLocationInGrid(h, grid));
      if (isHotspot) priority += 0.2;
    }

    return Math.min(priority, 1);
  }

  determineRebalanceReason(grid) {
    const reasons = [];

    if (grid.barqDrivers === 0) {
      reasons.push('No BARQ coverage');
    }
    if (grid.bulletDrivers === 0) {
      reasons.push('No BULLET coverage');
    }
    if (grid.pendingOrders > 0) {
      reasons.push(`${grid.pendingOrders} pending orders`);
    }
    if (grid.historicalDemand.average_orders > 10) {
      reasons.push('High demand area');
    }

    return reasons.join(', ');
  }

  calculateExpectedImprovement(actions, needs) {
    // Estimate coverage improvement
    const gridsImproved = new Set(actions.map((a) => a.gridId)).size;
    const criticalResolved = needs.critical.filter((n) =>
      actions.some((a) => a.gridId === n.gridId)
    ).length;

    return {
      gridsImproved,
      criticalResolved,
      coverageIncrease: gridsImproved * 0.01, // ~1% per grid
      slaImprovement: criticalResolved * 0.05, // 5% per critical
    };
  }

  estimateRepositioningTime(actions) {
    if (actions.length === 0) return 0;

    // Get maximum travel time
    const maxTime = Math.max(...actions.map((a) => a.estimatedTime));
    return maxTime;
  }

  calculateRepositioningCost(actions) {
    let totalCost = 0;

    for (const action of actions) {
      // Incentive cost
      totalCost += action.incentive || 0;

      // Estimated fuel cost
      const distance = this.calculateDistance(action.from, action.to);
      totalCost += distance * 0.5; // $0.5 per km
    }

    return totalCost;
  }

  calculateIncentive(priority, driver) {
    let incentive = 0;

    if (priority === 'critical') {
      incentive = 10; // $10 for critical repositioning
    } else if (priority === 'high') {
      incentive = 5; // $5 for high priority
    }

    // Additional incentive based on distance
    // Would calculate actual distance in production
    incentive += 2; // Base travel incentive

    return incentive;
  }

  calculateDistance(from, to) {
    // Haversine formula for distance calculation
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

  calculateTravelTime(from, to) {
    const distance = this.calculateDistance(from, to);
    const avgSpeed = 30; // 30 km/h average city speed
    return Math.ceil((distance / avgSpeed) * 60); // Return in minutes
  }

  isLocationInGrid(location, grid) {
    // Check if location falls within grid boundaries
    const gridSize = 0.01; // Approximate grid size in degrees
    return (
      Math.abs(location.lat - grid.center.lat) < gridSize / 2 &&
      Math.abs(location.lng - grid.center.lng) < gridSize / 2
    );
  }

  async sendRepositionRequest(action) {
    // Mock implementation - would send actual request to driver app
    logger.info('[FleetRebalancer] Sending reposition request', {
      driverId: action.driverId,
      to: action.gridId,
      incentive: action.incentive,
    });

    // Simulate driver response
    const acceptanceProbability = action.priority === 'critical' ? 0.9 : 0.7;
    const accepted = Math.random() < acceptanceProbability;

    return {
      accepted,
      reason: accepted ? null : 'Driver declined',
    };
  }

  async getFleetStatus(context) {
    // Get fleet status from context or fetch from service
    if (context.fleetStatus) {
      return context.fleetStatus;
    }

    // Mock fleet status
    return {
      timestamp: new Date(),
      drivers: this.generateMockDrivers(),
      summary: {
        total: 50,
        available: 20,
        busy: 25,
        idle: 5,
      },
    };
  }

  generateMockDrivers() {
    const drivers = [];
    const statuses = ['idle', 'busy', 'available'];
    const serviceTypes = ['BARQ', 'BULLET'];

    for (let i = 1; i <= 50; i++) {
      drivers.push({
        id: `driver_${i}`,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        serviceType: serviceTypes[Math.floor(Math.random() * serviceTypes.length)],
        currentLocation: {
          lat: 24.7 + Math.random() * 0.1,
          lng: 46.6 + Math.random() * 0.1,
        },
        available: Math.random() > 0.3,
        idleTime: Math.floor(Math.random() * 1800),
        rating: 3.5 + Math.random() * 1.5,
      });
    }

    return drivers;
  }

  /**
   * Check agent health
   */
  isHealthy() {
    return {
      healthy: true,
      name: this.config.name,
      activeRepositioning: this.activeRepositioning.size,
      lastRebalance:
        this.rebalanceHistory.length > 0
          ? this.rebalanceHistory[this.rebalanceHistory.length - 1].timestamp
          : null,
    };
  }
}

module.exports = FleetRebalancerAgent;
