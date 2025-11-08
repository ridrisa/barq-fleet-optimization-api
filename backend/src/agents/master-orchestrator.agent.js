/**
 * Master Orchestrator Agent
 * Central coordination agent for all instant delivery operations
 * Manages BARQ (1-hour) and BULLET (2-4 hour) deliveries
 */

const { generateId } = require('../utils/helper');
const { logger } = require('../utils/logger');

class MasterOrchestratorAgent {
  constructor() {
    this.agents = new Map();
    this.systemState = {
      mode: 'normal', // 'normal', 'peak', 'emergency'
      activeOrders: {
        barq: 0,
        bullet: 0,
      },
      fleetUtilization: 0,
      slaRisk: 'low',
      lastUpdate: Date.now(),
    };

    console.log('Master Orchestrator Agent initialized');
  }

  /**
   * Initialize and register all agents
   */
  registerAgent(name, agent) {
    this.agents.set(name, agent);
    logger.info(`Registered agent: ${name}`);
  }

  /**
   * Main orchestration method for handling events
   */
  async orchestrate(event) {
    const startTime = Date.now();
    logger.info(`[MasterOrchestrator] Processing event: ${event.type}`, {
      eventType: event.type,
      orderId: event.orderId,
      serviceType: event.serviceType,
    });

    try {
      // Update system state
      await this.updateSystemState(event);

      // Determine which agents to activate
      const agentPlan = await this.createAgentExecutionPlan(event);

      // Execute agents based on plan
      const results = await this.executeAgentPlan(agentPlan, event);

      // Aggregate and return final decision
      const decision = this.aggregateDecisions(results);

      const executionTime = Date.now() - startTime;
      logger.info(`[MasterOrchestrator] Completed in ${executionTime}ms`, {
        eventType: event.type,
        executionTime,
        decision: decision.action,
      });

      return decision;
    } catch (error) {
      logger.error('[MasterOrchestrator] Orchestration failed', {
        error: error.message,
        event,
      });

      // Fallback to emergency mode
      return this.handleEmergencyMode(event, error);
    }
  }

  /**
   * Create execution plan based on event type
   */
  async createAgentExecutionPlan(event) {
    const plan = {
      parallel: [],
      sequential: [],
      conditional: [],
    };

    switch (event.type) {
      case 'NEW_ORDER':
        // For new orders, determine urgency based on service type
        if (event.serviceType === 'BARQ') {
          // BARQ orders need immediate processing
          plan.parallel = [
            { agent: 'fleet-status', priority: 'critical' },
            { agent: 'sla-feasibility', priority: 'critical' },
            { agent: 'geo-intelligence', priority: 'high' },
          ];
          plan.sequential = [
            { agent: 'order-assignment', deps: ['fleet-status', 'sla-feasibility'] },
            { agent: 'route-optimization', deps: ['order-assignment'] },
          ];
        } else if (event.serviceType === 'BULLET') {
          // BULLET orders can be batched
          plan.parallel = [
            { agent: 'fleet-status', priority: 'high' },
            { agent: 'batch-optimization', priority: 'high' },
            { agent: 'demand-forecasting', priority: 'medium' },
          ];
          plan.sequential = [
            { agent: 'order-assignment', deps: ['batch-optimization'] },
            { agent: 'route-optimization', deps: ['order-assignment'] },
          ];
        }
        break;

      case 'SLA_WARNING':
        plan.parallel = [
          { agent: 'sla-monitor', priority: 'critical' },
          { agent: 'fleet-status', priority: 'critical' },
        ];
        plan.sequential = [
          { agent: 'emergency-escalation', deps: ['sla-monitor'] },
          { agent: 'order-recovery', deps: ['emergency-escalation'] },
        ];
        break;

      case 'DRIVER_STATUS_CHANGE':
        plan.parallel = [
          { agent: 'fleet-status', priority: 'high' },
          { agent: 'fleet-rebalancer', priority: 'medium' },
        ];
        if (event.status === 'offline' && event.hasActiveOrders) {
          plan.sequential = [{ agent: 'order-recovery', deps: ['fleet-status'] }];
        }
        break;

      case 'BATCH_OPTIMIZATION':
        plan.parallel = [
          { agent: 'batch-optimization', priority: 'high' },
          { agent: 'fleet-status', priority: 'high' },
        ];
        plan.sequential = [{ agent: 'route-optimization', deps: ['batch-optimization'] }];
        break;
    }

    return plan;
  }

  /**
   * Execute agents according to plan
   */
  async executeAgentPlan(plan, event) {
    const results = {};

    // Execute parallel agents
    if (plan.parallel.length > 0) {
      const parallelPromises = plan.parallel.map(async (task) => {
        const agent = this.agents.get(task.agent);
        if (!agent) {
          logger.warn(`Agent not found: ${task.agent}`);
          return null;
        }

        try {
          const result = await agent.execute(event);
          return { agent: task.agent, result };
        } catch (error) {
          logger.error(`Agent ${task.agent} failed`, { error: error.message });
          return { agent: task.agent, error: error.message };
        }
      });

      const parallelResults = await Promise.all(parallelPromises);
      parallelResults.forEach((r) => {
        if (r) results[r.agent] = r.result || r.error;
      });
    }

    // Execute sequential agents
    for (const task of plan.sequential) {
      const agent = this.agents.get(task.agent);
      if (!agent) {
        logger.warn(`Agent not found: ${task.agent}`);
        continue;
      }

      try {
        // Gather dependencies
        const deps = {};
        if (task.deps) {
          task.deps.forEach((depName) => {
            deps[depName] = results[depName];
          });
        }

        // Execute agent with dependencies
        results[task.agent] = await agent.execute(event, deps);
      } catch (error) {
        logger.error(`Agent ${task.agent} failed`, { error: error.message });
        results[task.agent] = { error: error.message };
      }
    }

    return results;
  }

  /**
   * Aggregate decisions from all agents
   */
  aggregateDecisions(results) {
    const decision = {
      action: null,
      assignedDriver: null,
      route: null,
      confidence: 0,
      risks: [],
      recommendations: [],
    };

    // Check for critical failures
    const criticalErrors = Object.entries(results).filter(
      ([agent, result]) => result?.error && this.isCriticalAgent(agent)
    );

    if (criticalErrors.length > 0) {
      decision.action = 'FAILED';
      decision.risks = criticalErrors.map(([agent, result]) => ({
        agent,
        error: result.error,
      }));
      return decision;
    }

    // Extract assignment decision
    if (results['order-assignment']) {
      decision.assignedDriver = results['order-assignment'].assignedDriver;
      decision.confidence = results['order-assignment'].confidence || 0.5;
    }

    // Extract route
    if (results['route-optimization']) {
      decision.route = results['route-optimization'].optimizedRoute;
    }

    // Compile risks and recommendations
    Object.values(results).forEach((result) => {
      if (result?.risks) {
        decision.risks.push(...result.risks);
      }
      if (result?.recommendations) {
        decision.recommendations.push(...result.recommendations);
      }
    });

    // Determine final action
    if (decision.assignedDriver && decision.route) {
      decision.action = 'ASSIGNED';
    } else if (decision.assignedDriver) {
      decision.action = 'ASSIGNED_PENDING_ROUTE';
    } else {
      decision.action = 'QUEUED';
    }

    return decision;
  }

  /**
   * Update system state based on events
   */
  async updateSystemState(event) {
    this.systemState.lastUpdate = Date.now();

    switch (event.type) {
      case 'NEW_ORDER':
        if (event.serviceType === 'BARQ') {
          this.systemState.activeOrders.barq++;
        } else {
          this.systemState.activeOrders.bullet++;
        }
        break;

      case 'ORDER_COMPLETED':
        if (event.serviceType === 'BARQ') {
          this.systemState.activeOrders.barq--;
        } else {
          this.systemState.activeOrders.bullet--;
        }
        break;
    }

    // Update system mode based on load
    const totalOrders = this.systemState.activeOrders.barq + this.systemState.activeOrders.bullet;

    if (totalOrders > 100 || this.systemState.activeOrders.barq > 30) {
      this.systemState.mode = 'peak';
    } else if (totalOrders < 20) {
      this.systemState.mode = 'normal';
    }

    // Update SLA risk
    if (event.type === 'SLA_WARNING') {
      this.systemState.slaRisk = 'high';
    }
  }

  /**
   * Handle emergency mode when orchestration fails
   */
  async handleEmergencyMode(event, error) {
    logger.error('[MasterOrchestrator] Entering emergency mode', {
      event,
      error: error.message,
    });

    // Simple fallback logic
    return {
      action: 'EMERGENCY_QUEUE',
      message: 'Order queued for manual processing',
      error: error.message,
      requiresManualIntervention: true,
    };
  }

  /**
   * Check if an agent is critical for operations
   */
  isCriticalAgent(agentName) {
    const criticalAgents = ['order-assignment', 'fleet-status', 'sla-monitor'];
    return criticalAgents.includes(agentName);
  }

  /**
   * Get current system state
   */
  getSystemState() {
    return {
      ...this.systemState,
      agentStatus: this.getAgentStatus(),
    };
  }

  /**
   * Get status of all registered agents
   */
  getAgentStatus() {
    const status = {};
    this.agents.forEach((agent, name) => {
      status[name] = {
        registered: true,
        healthy: agent.isHealthy ? agent.isHealthy() : true,
      };
    });
    return status;
  }

  /**
   * Check agent health
   */
  isHealthy() {
    const agentCount = this.agents.size;
    // Allow orchestrator to be healthy even with 0 agents initially
    const isHealthy = true;
    return {
      healthy: isHealthy,
      registeredAgents: agentCount,
      message:
        agentCount > 0
          ? `Orchestrator healthy with ${agentCount} agents`
          : 'Orchestrator initialized, awaiting agent registration',
      lastUpdate: Date.now(),
    };
  }
}

module.exports = MasterOrchestratorAgent;
