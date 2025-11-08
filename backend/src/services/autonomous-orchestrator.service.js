/**
 * Autonomous Orchestrator Service
 *
 * Extends Master Orchestrator with autonomous decision-making and execution capabilities.
 * Coordinates all AI agents to manage operations end-to-end with minimal human intervention.
 */

const actionAuth = require('./action-authorization.service');
const { logger } = require('../utils/logger');

class AutonomousOrchestratorService {
  constructor(masterOrchestrator, agents) {
    this.masterOrchestrator = masterOrchestrator;
    this.agents = agents || new Map();
    this.intelligence = {};
    this.isAutonomousMode = true; // Can be toggled for manual override
    this.learningData = [];

    // Configuration
    this.config = {
      enableAutonomousExecution: true,
      confidenceThreshold: 0.75, // Min confidence for autonomous actions
      maxConcurrentActions: 5,
      enableLearning: true,
    };

    logger.info('[AutonomousOrchestrator] Initialized');
  }

  /**
   * Main autonomous operation cycle (runs continuously)
   */
  async autonomousOperationCycle() {
    try {
      // Step 1: Gather intelligence from all agents
      const intelligence = await this.gatherIntelligence();

      // Step 2: Analyze current situation
      const situation = await this.analyzeSituation(intelligence);

      // Step 3: Generate action plan
      const actionPlan = await this.generateActionPlan(situation);

      // Step 4: Execute authorized actions autonomously
      const results = await this.executeAutonomously(actionPlan);

      // Step 5: Learn from outcomes
      if (this.config.enableLearning) {
        await this.learnFromOutcomes(results);
      }

      return {
        cycle: 'COMPLETED',
        situation,
        actionsPlanned: actionPlan.length,
        actionsExecuted: results.filter((r) => r.status === 'EXECUTED').length,
        actionsEscalated: results.filter((r) => r.status === 'ESCALATED').length,
      };
    } catch (error) {
      logger.error('[AutonomousOrchestrator] Operation cycle failed', {
        error: error.message,
      });
      return { cycle: 'FAILED', error: error.message };
    }
  }

  /**
   * Step 1: Gather intelligence from all agents
   */
  async gatherIntelligence() {
    logger.debug('[AutonomousOrchestrator] Gathering intelligence');

    const intelligence = {
      timestamp: new Date(),
      fleet: null,
      sla: null,
      demand: null,
      traffic: null,
      performance: null,
      orders: null,
    };

    try {
      // Query all monitoring agents in parallel
      const queries = [
        this.queryAgent('fleetStatus', 'getStatus'),
        this.queryAgent('slaMonitor', 'getAtRiskOrders'),
        this.queryAgent('demandForecasting', 'getCurrentDemand'),
        this.queryAgent('trafficPattern', 'getConditions'),
        this.queryAgent('performanceAnalytics', 'getMetrics'),
        this.queryAgent('orderAssignment', 'getPendingOrders'),
      ];

      const [fleet, sla, demand, traffic, performance, orders] = await Promise.all(queries);

      intelligence.fleet = fleet;
      intelligence.sla = sla;
      intelligence.demand = demand;
      intelligence.traffic = traffic;
      intelligence.performance = performance;
      intelligence.orders = orders;

      this.intelligence = intelligence; // Cache for future reference

      logger.debug('[AutonomousOrchestrator] Intelligence gathered', {
        availableDrivers: fleet?.available?.length || 0,
        atRiskOrders: sla?.atRisk?.length || 0,
        pendingOrders: orders?.pending?.length || 0,
      });

      return intelligence;
    } catch (error) {
      logger.error('[AutonomousOrchestrator] Intelligence gathering failed', {
        error: error.message,
      });
      return intelligence;
    }
  }

  /**
   * Step 2: Analyze situation and identify problems/opportunities
   */
  async analyzeSituation(intelligence) {
    const situation = {
      timestamp: new Date(),
      severity: 'NORMAL',
      problems: [],
      opportunities: [],
      metrics: {},
    };

    // Analyze SLA compliance
    if (intelligence.sla?.critical?.length > 0) {
      situation.problems.push({
        type: 'SLA_BREACH_IMMINENT',
        severity: 'CRITICAL',
        count: intelligence.sla.critical.length,
        orders: intelligence.sla.critical,
      });
      situation.severity = 'CRITICAL';
    } else if (intelligence.sla?.atRisk?.length > 0) {
      situation.problems.push({
        type: 'SLA_AT_RISK',
        severity: 'HIGH',
        count: intelligence.sla.atRisk.length,
        orders: intelligence.sla.atRisk,
      });
      if (situation.severity === 'NORMAL') situation.severity = 'HIGH';
    }

    // Analyze fleet utilization
    const totalDrivers =
      (intelligence.fleet?.available?.length || 0) + (intelligence.fleet?.busy?.length || 0);
    const utilization =
      totalDrivers > 0 ? (intelligence.fleet?.busy?.length || 0) / totalDrivers : 0;

    situation.metrics.fleetUtilization = utilization;

    if (utilization < 0.4) {
      situation.opportunities.push({
        type: 'LOW_UTILIZATION',
        value: utilization,
        recommendation: 'Consider fleet rebalancing or driver repositioning',
      });
    } else if (utilization > 0.9) {
      situation.problems.push({
        type: 'HIGH_UTILIZATION',
        severity: 'MEDIUM',
        value: utilization,
        recommendation: 'May need additional drivers or external courier backup',
      });
    }

    // Analyze demand patterns
    if (intelligence.demand?.hotspots?.length > 0) {
      const imbalance = this.calculateDemandImbalance(
        intelligence.demand.hotspots,
        intelligence.fleet?.available || []
      );

      if (imbalance > 0.3) {
        situation.problems.push({
          type: 'DEMAND_IMBALANCE',
          severity: 'MEDIUM',
          imbalance,
          hotspots: intelligence.demand.hotspots,
        });
      }
    }

    // Analyze traffic conditions
    if (intelligence.traffic?.congestion?.length > 0) {
      const severeCongestion = intelligence.traffic.congestion.filter(
        (c) => c.severity === 'HIGH' || c.severity === 'CRITICAL'
      );

      if (severeCongestion.length > 0) {
        situation.problems.push({
          type: 'TRAFFIC_CONGESTION',
          severity: 'MEDIUM',
          zones: severeCongestion,
        });
      }
    }

    // Analyze performance trends
    if (intelligence.performance?.onTimeRate < 0.85) {
      situation.problems.push({
        type: 'POOR_PERFORMANCE',
        severity: 'MEDIUM',
        onTimeRate: intelligence.performance.onTimeRate,
      });
    }

    // Check for pending orders
    if (intelligence.orders?.pending?.length > 10) {
      situation.problems.push({
        type: 'ORDER_BACKLOG',
        severity: 'MEDIUM',
        count: intelligence.orders.pending.length,
      });
    }

    logger.info('[AutonomousOrchestrator] Situation analyzed', {
      severity: situation.severity,
      problems: situation.problems.length,
      opportunities: situation.opportunities.length,
    });

    return situation;
  }

  /**
   * Step 3: Generate action plan based on situation
   */
  async generateActionPlan(situation) {
    const actions = [];

    // Priority 1: Handle critical SLA breaches (immediate)
    situation.problems
      .filter((p) => p.type === 'SLA_BREACH_IMMINENT')
      .forEach((problem) => {
        problem.orders.forEach((order) => {
          actions.push({
            priority: 'CRITICAL',
            action: 'REASSIGN_ORDER',
            agent: 'slaMonitor',
            context: {
              order,
              slaPercentUsed: 0.95, // Critical threshold
              reason: 'SLA breach imminent',
            },
            executeAt: 'IMMEDIATELY',
            expectedOutcome: 'Order reassigned to faster driver',
            confidence: 0.9,
          });
        });
      });

    // Priority 2: Handle at-risk SLA orders (urgent)
    situation.problems
      .filter((p) => p.type === 'SLA_AT_RISK')
      .forEach((problem) => {
        problem.orders.forEach((order) => {
          actions.push({
            priority: 'HIGH',
            action: 'REASSIGN_ORDER',
            agent: 'slaMonitor',
            context: {
              order,
              slaPercentUsed: 0.8, // At-risk threshold
              reason: 'SLA at risk',
            },
            executeAt: 'WITHIN_5_MIN',
            expectedOutcome: 'Improved ETA to meet SLA',
            confidence: 0.85,
          });
        });
      });

    // Priority 3: Fleet rebalancing (if demand imbalance)
    situation.problems
      .filter((p) => p.type === 'DEMAND_IMBALANCE')
      .forEach((problem) => {
        actions.push({
          priority: 'MEDIUM',
          action: 'REBALANCE_FLEET',
          agent: 'fleetRebalancer',
          context: {
            hotspots: problem.hotspots,
            imbalance: problem.imbalance,
            idleDrivers: situation.metrics.availableDrivers || 0,
          },
          executeAt: 'WITHIN_15_MIN',
          expectedOutcome: 'Balanced driver distribution',
          confidence: 0.75,
        });
      });

    // Priority 4: Proactive driver positioning (if low utilization + demand forecast)
    if (situation.opportunities.find((o) => o.type === 'LOW_UTILIZATION')) {
      const upcomingPeak = this.intelligence.demand?.predictedPeaks?.[0];
      if (upcomingPeak) {
        actions.push({
          priority: 'LOW',
          action: 'PREPOSITION_DRIVERS',
          agent: 'demandForecasting',
          context: {
            targetZones: upcomingPeak.zones,
            peakTime: upcomingPeak.time,
            driversNeeded: upcomingPeak.driversNeeded,
            confidence: upcomingPeak.confidence,
          },
          executeAt: 'BEFORE_PEAK_HOUR',
          expectedOutcome: 'Reduced wait times during peak',
          confidence: upcomingPeak.confidence,
        });
      }
    }

    // Priority 5: Traffic rerouting (if severe congestion)
    situation.problems
      .filter((p) => p.type === 'TRAFFIC_CONGESTION')
      .forEach((problem) => {
        problem.zones.forEach((zone) => {
          actions.push({
            priority: 'HIGH',
            action: 'REROUTE_DRIVER',
            agent: 'trafficPattern',
            context: {
              zone: zone.name,
              severity: zone.severity,
              affectedDrivers: zone.driverIds || [],
            },
            executeAt: 'IMMEDIATELY',
            expectedOutcome: 'Avoid traffic delays',
            confidence: 0.8,
          });
        });
      });

    // Sort by priority
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Limit concurrent actions
    const limitedActions = actions.slice(0, this.config.maxConcurrentActions);

    logger.info('[AutonomousOrchestrator] Action plan generated', {
      totalActions: actions.length,
      critical: actions.filter((a) => a.priority === 'CRITICAL').length,
      high: actions.filter((a) => a.priority === 'HIGH').length,
      medium: actions.filter((a) => a.priority === 'MEDIUM').length,
      limitedTo: limitedActions.length,
    });

    return limitedActions;
  }

  /**
   * Step 4: Execute actions autonomously (with authorization checks)
   */
  async executeAutonomously(actionPlan) {
    if (!this.config.enableAutonomousExecution) {
      logger.warn('[AutonomousOrchestrator] Autonomous execution disabled');
      return [];
    }

    const results = [];

    for (const action of actionPlan) {
      const startTime = Date.now();

      try {
        // Check if confidence meets threshold
        if (action.confidence < this.config.confidenceThreshold) {
          logger.warn('[AutonomousOrchestrator] Action confidence too low', {
            action: action.action,
            confidence: action.confidence,
            threshold: this.config.confidenceThreshold,
          });

          results.push({
            action,
            status: 'SKIPPED',
            reason: 'Confidence below threshold',
          });
          continue;
        }

        // Check authorization
        const auth = await actionAuth.canExecuteAutonomously(
          action.action,
          action.context,
          action.agent
        );

        if (!auth.allowed) {
          logger.warn('[AutonomousOrchestrator] Action not authorized', {
            action: action.action,
            reason: auth.reason,
          });

          results.push({
            action,
            status: auth.requiresApproval ? 'ESCALATED' : 'DENIED',
            reason: auth.reason,
            approvalId: auth.approvalId,
          });
          continue;
        }

        // Execute the action
        logger.info('[AutonomousOrchestrator] Executing autonomous action', {
          action: action.action,
          priority: action.priority,
          agent: action.agent,
        });

        const outcome = await this.executeAction(action);
        const duration = Date.now() - startTime;

        // Record execution
        actionAuth.recordExecution(
          action.action,
          action.context,
          {
            success: outcome.success,
            duration,
            ...outcome,
          },
          action.agent
        );

        results.push({
          action,
          status: 'EXECUTED',
          outcome,
          duration,
        });

        logger.info('[AutonomousOrchestrator] Action executed successfully', {
          action: action.action,
          duration,
          outcome: outcome.summary,
        });
      } catch (error) {
        logger.error('[AutonomousOrchestrator] Action execution failed', {
          action: action.action,
          error: error.message,
        });

        results.push({
          action,
          status: 'FAILED',
          error: error.message,
        });
      }
    }

    logger.info('[AutonomousOrchestrator] Execution batch complete', {
      total: results.length,
      executed: results.filter((r) => r.status === 'EXECUTED').length,
      escalated: results.filter((r) => r.status === 'ESCALATED').length,
      failed: results.filter((r) => r.status === 'FAILED').length,
    });

    return results;
  }

  /**
   * Execute a specific action
   */
  async executeAction(action) {
    const agent = this.agents.get(action.agent);

    if (!agent) {
      throw new Error(`Agent not found: ${action.agent}`);
    }

    // Route to appropriate agent method based on action type
    switch (action.action) {
      case 'REASSIGN_ORDER':
        return await agent.performEmergencyReassignment?.(action.context.order);

      case 'REBALANCE_FLEET':
        return await agent.rebalanceFleet?.(action.context);

      case 'PREPOSITION_DRIVERS':
        return await agent.positionDrivers?.(action.context);

      case 'REROUTE_DRIVER':
        return await agent.rerouteDrivers?.(action.context);

      case 'NOTIFY_CUSTOMER':
        return await agent.notifyCustomer?.(action.context);

      default:
        throw new Error(`Unknown action type: ${action.action}`);
    }
  }

  /**
   * Step 5: Learn from outcomes
   */
  async learnFromOutcomes(results) {
    for (const result of results) {
      if (result.status === 'EXECUTED' && result.outcome) {
        const learningRecord = {
          timestamp: new Date(),
          action: result.action.action,
          context: result.action.context,
          outcome: result.outcome,
          success: result.outcome.success,
          confidence: result.action.confidence,
          duration: result.duration,
        };

        this.learningData.push(learningRecord);

        // Keep last 1000 records
        if (this.learningData.length > 1000) {
          this.learningData.shift();
        }
      }
    }

    // Analyze patterns
    if (this.learningData.length >= 10) {
      const insights = this.analyzeLearningPatterns();
      logger.info('[AutonomousOrchestrator] Learning insights', insights);
    }
  }

  /**
   * Analyze learning patterns
   */
  analyzeLearningPatterns() {
    const byAction = {};

    this.learningData.forEach((record) => {
      if (!byAction[record.action]) {
        byAction[record.action] = {
          total: 0,
          successes: 0,
          avgDuration: 0,
        };
      }

      byAction[record.action].total++;
      if (record.success) {
        byAction[record.action].successes++;
      }
      byAction[record.action].avgDuration += record.duration;
    });

    // Calculate success rates
    const insights = Object.entries(byAction).map(([action, stats]) => ({
      action,
      successRate: `${((stats.successes / stats.total) * 100).toFixed(1)}%`,
      avgDuration: `${(stats.avgDuration / stats.total).toFixed(0)}ms`,
      totalExecutions: stats.total,
    }));

    return insights;
  }

  /**
   * Helper: Query an agent for information
   */
  async queryAgent(agentName, method) {
    const agent = this.agents.get(agentName);

    if (!agent || typeof agent[method] !== 'function') {
      logger.warn(`[AutonomousOrchestrator] Agent or method not found`, {
        agent: agentName,
        method,
      });
      return null;
    }

    try {
      return await agent[method]();
    } catch (error) {
      logger.error(`[AutonomousOrchestrator] Agent query failed`, {
        agent: agentName,
        method,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Helper: Calculate demand imbalance
   */
  calculateDemandImbalance(hotspots, availableDrivers) {
    if (!hotspots || hotspots.length === 0) return 0;

    const zoneDriverCounts = {};
    hotspots.forEach((h) => {
      zoneDriverCounts[h.zone] = 0;
    });

    availableDrivers.forEach((driver) => {
      const zone = this.getDriverZone(driver);
      if (zoneDriverCounts[zone] !== undefined) {
        zoneDriverCounts[zone]++;
      }
    });

    // Calculate coefficient of variation
    const counts = Object.values(zoneDriverCounts);
    const mean = counts.reduce((sum, c) => sum + c, 0) / counts.length;
    const variance = counts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / counts.length;
    const stdDev = Math.sqrt(variance);

    return mean > 0 ? stdDev / mean : 0;
  }

  /**
   * Helper: Get driver's current zone
   */
  getDriverZone(driver) {
    // Simplified zone detection - can be enhanced with actual geo logic
    if (!driver.current_location) return 'UNKNOWN';

    const lat = driver.current_location.latitude;
    const lng = driver.current_location.longitude;

    // Example zones for Riyadh (simplified)
    if (lat > 24.75) return 'NORTH';
    if (lat < 24.65) return 'SOUTH';
    if (lng > 46.72) return 'EAST';
    return 'WEST';
  }

  /**
   * Get autonomous operations dashboard data
   */
  getDashboardData() {
    const stats = actionAuth.getStatistics('24h');

    return {
      autonomousMode: this.isAutonomousMode,
      config: this.config,
      currentIntelligence: this.intelligence,
      executionStats: stats,
      learningInsights: this.analyzeLearningPatterns(),
      lastCycle: {
        timestamp: this.intelligence.timestamp,
        severity: 'NORMAL', // Would come from last analysis
      },
    };
  }

  /**
   * Toggle autonomous mode
   */
  setAutonomousMode(enabled) {
    this.isAutonomousMode = enabled;
    this.config.enableAutonomousExecution = enabled;

    logger.info('[AutonomousOrchestrator] Autonomous mode', {
      enabled: this.isAutonomousMode ? 'ON' : 'OFF',
    });

    return this.isAutonomousMode;
  }
}

module.exports = AutonomousOrchestratorService;
