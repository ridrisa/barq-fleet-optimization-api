/**
 * Agent Initialization Service
 * Bootstraps all agents in the correct order with proper configuration
 * Ensures system readiness before starting operations
 */

const { logger } = require('../utils/logger');
const LLMConfigManager = require('../config/llm.config');

// Import all agents
const MasterOrchestratorAgent = require('../agents/master-orchestrator.agent');
const FleetStatusAgent = require('../agents/fleet-status.agent');
const SLAMonitorAgent = require('../agents/sla-monitor.agent');
const OrderAssignmentAgent = require('../agents/order-assignment.agent');
const RouteOptimizationAgent = require('../agents/route-optimization.agent');
const BatchOptimizationAgent = require('../agents/batch-optimization.agent');
const DemandForecastingAgent = require('../agents/demand-forecasting.agent');
const EmergencyEscalationAgent = require('../agents/emergency-escalation.agent');
const FleetRebalancerAgent = require('../agents/fleet-rebalancer.agent');
const GeoIntelligenceAgent = require('../agents/geo-intelligence.agent');
const OrderRecoveryAgent = require('../agents/order-recovery.agent');
const CustomerCommunicationAgent = require('../agents/customer-communication.agent');
const TrafficPatternAgent = require('../agents/traffic-pattern.agent');
const PerformanceAnalyticsAgent = require('../agents/performance-analytics.agent');

// Import services
const AgentManagerService = require('./agent-manager.service');
const EnhancedLogisticsService = require('./enhanced-logistics.service');

class AgentInitializer {
  constructor() {
    this.agents = {};
    this.services = {};
    this.initialized = false;
    this.startTime = Date.now();

    // Initialization order (dependencies first)
    this.initOrder = [
      // Core infrastructure agents
      'fleetStatus',
      'trafficPattern',
      'geoIntelligence',

      // Monitoring agents
      'slaMonitor',
      'performanceAnalytics',

      // Operational agents
      'orderAssignment',
      'routeOptimization',
      'batchOptimization',
      'demandForecasting',

      // Support agents
      'customerCommunication',
      'orderRecovery',
      'fleetRebalancer',
      'emergencyEscalation',

      // Master coordinator (last)
      'masterOrchestrator',
    ];

    // Health check configuration
    this.healthCheckConfig = {
      interval: 60000, // Check every minute
      timeout: 5000, // 5 second timeout per check
      maxRetries: 3, // Max retries for failed agents
      criticalAgents: [
        // System cannot run without these
        'masterOrchestrator',
        'fleetStatus',
        'orderAssignment',
        'slaMonitor',
      ],
    };

    logger.info('[AgentInitializer] Service created');
  }

  /**
   * Initialize all agents and services
   */
  async initialize() {
    try {
      logger.info('[AgentInitializer] Starting system initialization...');

      // Step 1: Initialize LLM configuration
      await this.initializeLLMConfig();

      // Step 2: Initialize core services
      await this.initializeServices();

      // Step 3: Initialize agents in order
      await this.initializeAgents();

      // Step 4: Verify system health
      await this.verifySystemHealth();

      // Step 5: Start continuous monitoring
      await this.startMonitoring();

      // Step 6: Start agent manager
      await this.startAgentManager();

      this.initialized = true;
      const initTime = Date.now() - this.startTime;

      logger.info('[AgentInitializer] System initialization complete', {
        initializationTime: `${initTime}ms`,
        agentsInitialized: Object.keys(this.agents).length,
        servicesInitialized: Object.keys(this.services).length,
      });

      return {
        success: true,
        initializationTime: initTime,
        agents: Object.keys(this.agents),
        services: Object.keys(this.services),
        status: 'ready',
      };
    } catch (error) {
      logger.error('[AgentInitializer] Initialization failed', {
        error: error.message,
        stack: error.stack,
      });

      // Attempt graceful shutdown
      await this.shutdown();

      throw error;
    }
  }

  /**
   * Initialize LLM configuration
   */
  async initializeLLMConfig() {
    logger.info('[AgentInitializer] Initializing LLM configuration');

    this.llmManager = new LLMConfigManager();

    // Verify LLM connectivity
    const testResponse = await this.llmManager.testConnection();
    if (!testResponse.success) {
      throw new Error('Failed to connect to LLM service');
    }

    logger.info('[AgentInitializer] LLM configuration initialized successfully');
  }

  /**
   * Initialize core services
   */
  async initializeServices() {
    logger.info('[AgentInitializer] Initializing core services');

    // Initialize Agent Manager Service
    this.services.agentManager = new AgentManagerService(this.llmManager);

    // Initialize Enhanced Logistics Service with the same agent manager
    this.services.logisticsService = new EnhancedLogisticsService(this.services.agentManager);

    // Wait for services to be ready
    await this.waitForServices();

    logger.info('[AgentInitializer] Core services initialized');
  }

  /**
   * Initialize all agents in dependency order
   */
  async initializeAgents() {
    logger.info('[AgentInitializer] Initializing agents in dependency order');

    const agentConfigs = {
      masterOrchestrator: {
        class: MasterOrchestratorAgent,
        config: { priority: 'critical', timeout: 30000 },
      },
      fleetStatus: {
        class: FleetStatusAgent,
        config: { updateInterval: 30000, priority: 'high' },
      },
      slaMonitor: {
        class: SLAMonitorAgent,
        config: { checkInterval: 60000, priority: 'critical' },
      },
      orderAssignment: {
        class: OrderAssignmentAgent,
        config: { maxRetries: 3, priority: 'critical' },
      },
      routeOptimization: {
        class: RouteOptimizationAgent,
        config: { algorithms: ['nearest', 'genetic', 'kmeans'], priority: 'high' },
      },
      batchOptimization: {
        class: BatchOptimizationAgent,
        config: { maxBatchSize: 10, priority: 'medium' },
      },
      demandForecasting: {
        class: DemandForecastingAgent,
        config: { horizons: [30, 120, 240], priority: 'medium' },
      },
      emergencyEscalation: {
        class: EmergencyEscalationAgent,
        config: { levels: ['L1', 'L2', 'L3', 'L4'], priority: 'critical' },
      },
      fleetRebalancer: {
        class: FleetRebalancerAgent,
        config: { rebalanceInterval: 300000, priority: 'low' },
      },
      geoIntelligence: {
        class: GeoIntelligenceAgent,
        config: { gridSize: { rows: 10, cols: 10 }, priority: 'medium' },
      },
      orderRecovery: {
        class: OrderRecoveryAgent,
        config: { maxRetryAttempts: 3, priority: 'high' },
      },
      customerCommunication: {
        class: CustomerCommunicationAgent,
        config: { channels: ['SMS', 'WHATSAPP', 'EMAIL', 'IN_APP'], priority: 'high' },
      },
      trafficPattern: {
        class: TrafficPatternAgent,
        config: { updateInterval: 300000, priority: 'medium' },
      },
      performanceAnalytics: {
        class: PerformanceAnalyticsAgent,
        config: { reportingInterval: 3600000, priority: 'low' },
      },
    };

    // Initialize agents in order
    for (const agentName of this.initOrder) {
      const agentConfig = agentConfigs[agentName];

      if (!agentConfig) {
        logger.warn(`[AgentInitializer] No configuration for agent: ${agentName}`);
        continue;
      }

      try {
        logger.info(`[AgentInitializer] Initializing ${agentName}...`);

        const agent = new agentConfig.class(agentConfig.config, this.llmManager);

        // Verify agent health
        const health = agent.isHealthy();
        if (!health.healthy) {
          throw new Error(`Agent ${agentName} failed health check`);
        }

        this.agents[agentName] = agent;

        // Register with Agent Manager
        await this.services.agentManager.registerAgent(agentName, agent);

        logger.info(`[AgentInitializer] ${agentName} initialized successfully`);
      } catch (error) {
        logger.error(`[AgentInitializer] Failed to initialize ${agentName}`, {
          error: error.message,
        });

        // Check if it's a critical agent
        if (this.healthCheckConfig.criticalAgents.includes(agentName)) {
          throw new Error(`Critical agent ${agentName} failed to initialize: ${error.message}`);
        }
      }
    }

    logger.info('[AgentInitializer] All agents initialized', {
      total: Object.keys(this.agents).length,
      successful: Object.keys(this.agents).length,
      failed: this.initOrder.length - Object.keys(this.agents).length,
    });
  }

  /**
   * Verify system health after initialization
   */
  async verifySystemHealth() {
    logger.info('[AgentInitializer] Verifying system health');

    const healthChecks = {
      agents: {},
      services: {},
      critical: [],
      warnings: [],
    };

    // Check all agents
    for (const [name, agent] of Object.entries(this.agents)) {
      const health = agent.isHealthy();
      healthChecks.agents[name] = health;

      if (!health.healthy) {
        if (this.healthCheckConfig.criticalAgents.includes(name)) {
          healthChecks.critical.push({
            component: name,
            type: 'agent',
            issue: 'Health check failed',
          });
        } else {
          healthChecks.warnings.push({
            component: name,
            type: 'agent',
            issue: 'Health check failed',
          });
        }
      }
    }

    // Check services
    healthChecks.services.agentManager = this.services.agentManager.getSystemStatus();
    healthChecks.services.logisticsService = this.services.logisticsService.getSystemStatus();

    // Evaluate overall health
    if (healthChecks.critical.length > 0) {
      logger.error('[AgentInitializer] Critical components unhealthy', healthChecks.critical);
      throw new Error('System health check failed: critical components unhealthy');
    }

    if (healthChecks.warnings.length > 0) {
      logger.warn('[AgentInitializer] Non-critical components unhealthy', healthChecks.warnings);
    }

    logger.info('[AgentInitializer] System health verified', {
      healthyAgents: Object.values(healthChecks.agents).filter((h) => h.healthy).length,
      totalAgents: Object.keys(healthChecks.agents).length,
      warnings: healthChecks.warnings.length,
    });

    return healthChecks;
  }

  /**
   * Start continuous monitoring
   */
  async startMonitoring() {
    logger.info('[AgentInitializer] Starting continuous monitoring');

    // Start health check interval
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.performHealthCheck();

        if (health.unhealthyAgents.length > 0) {
          logger.warn('[AgentInitializer] Unhealthy agents detected', {
            unhealthy: health.unhealthyAgents,
          });

          // Attempt recovery
          await this.recoverUnhealthyAgents(health.unhealthyAgents);
        }
      } catch (error) {
        logger.error('[AgentInitializer] Health check failed', {
          error: error.message,
        });
      }
    }, this.healthCheckConfig.interval);

    // Start performance monitoring
    this.performanceInterval = setInterval(() => {
      this.logPerformanceMetrics();
    }, 300000); // Every 5 minutes

    logger.info('[AgentInitializer] Monitoring started');
  }

  /**
   * Start Agent Manager continuous operations
   */
  async startAgentManager() {
    logger.info('[AgentInitializer] Starting Agent Manager operations');

    // Initialize the agent manager fully
    await this.services.agentManager.initialize();

    // Start continuous agents (monitoring, forecasting, etc.)
    await this.services.agentManager.startContinuousAgents();

    logger.info('[AgentInitializer] Agent Manager operations started');
  }

  /**
   * Perform health check on all agents
   */
  async performHealthCheck() {
    const results = {
      timestamp: new Date(),
      healthyAgents: [],
      unhealthyAgents: [],
      recoveredAgents: [],
      metrics: {},
    };

    for (const [name, agent] of Object.entries(this.agents)) {
      try {
        const health = agent.isHealthy();

        if (health.healthy) {
          results.healthyAgents.push(name);
        } else {
          results.unhealthyAgents.push({
            name,
            health,
            critical: this.healthCheckConfig.criticalAgents.includes(name),
          });
        }

        // Collect metrics
        results.metrics[name] = health;
      } catch (error) {
        logger.error(`[AgentInitializer] Health check failed for ${name}`, {
          error: error.message,
        });

        results.unhealthyAgents.push({
          name,
          error: error.message,
          critical: this.healthCheckConfig.criticalAgents.includes(name),
        });
      }
    }

    return results;
  }

  /**
   * Attempt to recover unhealthy agents
   */
  async recoverUnhealthyAgents(unhealthyAgents) {
    logger.info('[AgentInitializer] Attempting agent recovery', {
      agents: unhealthyAgents.map((a) => a.name),
    });

    for (const unhealthy of unhealthyAgents) {
      const { name, critical } = unhealthy;

      try {
        logger.info(`[AgentInitializer] Recovering ${name}...`);

        // Get agent class
        const agentClass = this.agents[name].constructor;
        const config = this.agents[name].config;

        // Reinitialize agent
        const newAgent = new agentClass(config, this.llmManager);

        // Verify new agent health
        const health = newAgent.isHealthy();

        if (health.healthy) {
          // Replace old agent
          this.agents[name] = newAgent;

          // Re-register with Agent Manager
          await this.services.agentManager.registerAgent(name, newAgent);

          logger.info(`[AgentInitializer] ${name} recovered successfully`);
        } else {
          throw new Error('Recovery failed - agent still unhealthy');
        }
      } catch (error) {
        logger.error(`[AgentInitializer] Failed to recover ${name}`, {
          error: error.message,
        });

        if (critical) {
          logger.error(
            '[AgentInitializer] Critical agent recovery failed - system may be unstable'
          );
          // Could trigger emergency procedures here
        }
      }
    }
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetrics() {
    const metrics = {
      uptime: Date.now() - this.startTime,
      agents: {},
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    };

    // Collect agent metrics
    for (const [name, agent] of Object.entries(this.agents)) {
      const health = agent.isHealthy();
      metrics.agents[name] = {
        healthy: health.healthy,
        ...health,
      };
    }

    logger.info('[AgentInitializer] Performance metrics', metrics);
  }

  /**
   * Wait for services to be ready
   */
  async waitForServices(maxWait = 30000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      try {
        // Check if services are responsive
        const agentStatus = this.services.agentManager.getSystemStatus();
        const logisticsStatus = this.services.logisticsService.getSystemStatus();

        if (agentStatus && logisticsStatus) {
          return true;
        }
      } catch (error) {
        // Services not ready yet
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error('Services failed to become ready');
  }

  /**
   * Get system status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      uptime: Date.now() - this.startTime,
      agents: Object.keys(this.agents),
      services: Object.keys(this.services),
      health: this.getHealthSummary(),
    };
  }

  /**
   * Get health summary
   */
  getHealthSummary() {
    const summary = {
      healthy: 0,
      unhealthy: 0,
      critical: [],
    };

    for (const [name, agent] of Object.entries(this.agents)) {
      try {
        const health = agent.isHealthy();
        if (health.healthy) {
          summary.healthy++;
        } else {
          summary.unhealthy++;
          if (this.healthCheckConfig.criticalAgents.includes(name)) {
            summary.critical.push(name);
          }
        }
      } catch (error) {
        summary.unhealthy++;
      }
    }

    return summary;
  }

  /**
   * Get the agent manager instance
   */
  getAgentManager() {
    return this.services.agentManager;
  }

  /**
   * Get all initialized agents
   * Returns agents as a Map for compatibility with autonomous orchestrator
   */
  getAgents() {
    const agentsMap = new Map();
    for (const [name, agent] of Object.entries(this.agents)) {
      agentsMap.set(name, agent);
    }
    return agentsMap;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('[AgentInitializer] Starting graceful shutdown');

    try {
      // Stop monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      if (this.performanceInterval) {
        clearInterval(this.performanceInterval);
      }

      // Shutdown Agent Manager
      if (this.services.agentManager) {
        await this.services.agentManager.shutdown();
      }

      // Shutdown Logistics Service
      if (this.services.logisticsService) {
        await this.services.logisticsService.shutdown();
      }

      // Clear agent references
      this.agents = {};
      this.services = {};
      this.initialized = false;

      logger.info('[AgentInitializer] Shutdown complete');
    } catch (error) {
      logger.error('[AgentInitializer] Error during shutdown', {
        error: error.message,
      });
      throw error;
    }
  }
}

// Export singleton instance
let instance = null;

module.exports = {
  /**
   * Get or create the agent initializer instance
   */
  getInstance: () => {
    if (!instance) {
      instance = new AgentInitializer();
    }
    return instance;
  },

  /**
   * Initialize the system
   */
  initialize: async () => {
    const initializer = module.exports.getInstance();
    return await initializer.initialize();
  },

  /**
   * Get system status
   */
  getStatus: () => {
    const initializer = module.exports.getInstance();
    return initializer.getStatus();
  },

  /**
   * Get the agent manager instance
   */
  getAgentManager: () => {
    const initializer = module.exports.getInstance();
    return initializer.getAgentManager();
  },

  /**
   * Get all initialized agents as a Map
   */
  getAgents: () => {
    const initializer = module.exports.getInstance();
    return initializer.getAgents();
  },

  /**
   * Shutdown the system
   */
  shutdown: async () => {
    const initializer = module.exports.getInstance();
    return await initializer.shutdown();
  },
};

// Handle process signals for graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[AgentInitializer] SIGTERM received, shutting down gracefully');
  await module.exports.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('[AgentInitializer] SIGINT received, shutting down gracefully');
  await module.exports.shutdown();
  process.exit(0);
});
