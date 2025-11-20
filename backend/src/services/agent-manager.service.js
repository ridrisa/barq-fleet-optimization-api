/**
 * Agent Manager Service
 * Initializes, coordinates, and manages all agents for instant delivery operations
 * Handles both BARQ and BULLET service types with real-time optimization
 */

const { logger } = require('../utils/logger');
const EventEmitter = require('events');

// Import existing agents (keep compatibility)
const PlanningAgent = require('../agents/planning.agent');
const OptimizationAgent = require('../agents/optimization.agent');
const FormatResponseAgent = require('../agents/formatting.agent');

// Import new instant delivery agents
const MasterOrchestratorAgent = require('../agents/master-orchestrator.agent');
const FleetStatusAgent = require('../agents/fleet-status.agent');
const SLAMonitorAgent = require('../agents/sla-monitor.agent');
const OrderAssignmentAgent = require('../agents/order-assignment.agent');

class AgentManagerService extends EventEmitter {
  constructor(llmConfig) {
    super();

    this.agents = new Map();
    this.continuousAgents = new Map();
    this.agentStatus = new Map();
    this.agentConfigs = new Map();
    this.agentLogs = new Map();
    this.agentMetrics = new Map();
    this.llmConfig = llmConfig;

    // Operating modes
    this.mode = 'normal'; // 'normal', 'peak', 'emergency', 'maintenance'

    // Agent states
    this.AGENT_STATES = {
      IDLE: 'idle',
      RUNNING: 'running',
      STOPPED: 'stopped',
      ERROR: 'error',
      STARTING: 'starting',
      STOPPING: 'stopping'
    };

    // Agent execution intervals
    this.intervals = {
      fleetStatus: 10000, // 10 seconds
      slaMonitor: 10000, // 10 seconds
      demandForecast: 300000, // 5 minutes
      fleetRebalance: 300000, // 5 minutes
      performance: 3600000, // 1 hour
    };

    this.isRunning = false;

    // Execution tracking
    this.executionHistory = new Map(); // Map<agentName, Array<ExecutionRecord>>
    this.executionStats = new Map(); // Map<agentName, StatsObject>
    this.maxHistoryPerAgent = 100; // Keep last 100 executions per agent
    this.recentErrors = []; // Keep last 50 errors across all agents
    this.maxRecentErrors = 50;

    // Initialize agent logs storage
    this.maxLogEntriesPerAgent = 1000;

    console.log('Agent Manager Service initialized');
  }

  /**
   * Initialize all agents
   */
  async initialize() {
    try {
      logger.info('[AgentManager] Initializing all agents');

      // Initialize existing agents (for backward compatibility)
      this.initializeLegacyAgents();

      // Initialize new instant delivery agents
      this.initializeInstantDeliveryAgents();

      // Register all agents with master orchestrator
      this.registerAgentsWithOrchestrator();

      // Set up event handlers
      this.setupEventHandlers();

      logger.info('[AgentManager] All agents initialized successfully');

      return {
        success: true,
        agentCount: this.agents.size,
        agents: Array.from(this.agents.keys()),
      };
    } catch (error) {
      logger.error('[AgentManager] Initialization failed', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Initialize legacy agents for backward compatibility
   */
  initializeLegacyAgents() {
    // Keep existing agents functional
    if (this.llmConfig) {
      this.agents.set(
        'planning',
        new PlanningAgent(this.llmConfig.getConfig('planning'), this.llmConfig)
      );

      this.agents.set(
        'optimization',
        new OptimizationAgent(this.llmConfig.getConfig('optimization'), this.llmConfig)
      );

      this.agents.set(
        'formatting',
        new FormatResponseAgent(this.llmConfig.getConfig('formatting'), this.llmConfig)
      );
    }

    logger.info('[AgentManager] Legacy agents initialized');
  }

  /**
   * Initialize instant delivery agents
   */
  initializeInstantDeliveryAgents() {
    // Core agents for instant delivery
    this.agents.set('master-orchestrator', new MasterOrchestratorAgent());
    this.agents.set('fleet-status', new FleetStatusAgent());
    this.agents.set('sla-monitor', new SLAMonitorAgent());
    this.agents.set('order-assignment', new OrderAssignmentAgent());

    // Future agents (stubbed for now)
    // this.agents.set('route-optimization', new RouteOptimizationAgent());
    // this.agents.set('batch-optimization', new BatchOptimizationAgent());
    // this.agents.set('demand-forecasting', new DemandForecastingAgent());
    // this.agents.set('emergency-escalation', new EmergencyEscalationAgent());
    // this.agents.set('fleet-rebalancer', new FleetRebalancerAgent());

    logger.info('[AgentManager] Instant delivery agents initialized');
  }

  /**
   * Register a single agent
   */
  async registerAgent(name, agent) {
    // Check if agent already exists
    if (this.agents.has(name)) {
      logger.warn(`[AgentManager] Agent ${name} already registered`);
      return;
    }

    // Register the agent
    this.agents.set(name, agent);
    logger.info(`[AgentManager] Registered agent: ${name}`);

    // If orchestrator exists, register with it
    const orchestrator = this.agents.get('master-orchestrator');
    if (orchestrator && name !== 'master-orchestrator') {
      orchestrator.registerAgent(name, agent);
    }
  }

  /**
   * Register agents with master orchestrator
   */
  registerAgentsWithOrchestrator() {
    const orchestrator = this.agents.get('master-orchestrator');

    if (!orchestrator) {
      logger.warn('[AgentManager] Master orchestrator not found');
      return;
    }

    // Register each agent except the orchestrator itself
    this.agents.forEach((agent, name) => {
      if (name !== 'master-orchestrator') {
        orchestrator.registerAgent(name, agent);
      }
    });

    logger.info(`[AgentManager] Registered ${this.agents.size - 1} agents with orchestrator`);
  }

  /**
   * Start continuous monitoring agents
   */
  async startContinuousAgents() {
    if (this.isRunning) {
      logger.warn('[AgentManager] Continuous agents already running');
      return;
    }

    logger.info('[AgentManager] Starting continuous monitoring agents');

    // Fleet Status Agent - updates every 10 seconds
    this.continuousAgents.set(
      'fleet-status',
      setInterval(async () => {
        try {
          const fleetStatus = await this.agents.get('fleet-status').execute();
          this.emit('fleet-update', fleetStatus);

          // Store latest fleet status for other agents
          this.latestFleetStatus = fleetStatus;
        } catch (error) {
          logger.error('[AgentManager] Fleet status update failed', { error: error.message });
        }
      }, this.intervals.fleetStatus)
    );

    // SLA Monitor Agent - checks every 10 seconds
    this.continuousAgents.set(
      'sla-monitor',
      setInterval(async () => {
        try {
          const slaStatus = await this.agents.get('sla-monitor').execute();
          this.emit('sla-update', slaStatus);

          // Check for critical alerts
          if (slaStatus.alerts.length > 0) {
            await this.handleSLAAlerts(slaStatus.alerts);
          }
        } catch (error) {
          logger.error('[AgentManager] SLA monitoring failed', { error: error.message });
        }
      }, this.intervals.slaMonitor)
    );

    this.isRunning = true;
    logger.info('[AgentManager] Continuous agents started');
  }

  /**
   * Stop continuous monitoring agents
   */
  stopContinuousAgents() {
    logger.info('[AgentManager] Stopping continuous agents');

    this.continuousAgents.forEach((interval, name) => {
      clearInterval(interval);
      logger.info(`[AgentManager] Stopped ${name} agent`);
    });

    this.continuousAgents.clear();
    this.isRunning = false;
  }

  /**
   * Handle new order for instant delivery
   */
  async handleNewOrder(order) {
    const startTime = Date.now();
    logger.info(`[AgentManager] Processing new ${order.serviceType} order ${order.id}`);

    try {
      // Prepare order context
      const orderContext = {
        type: 'NEW_ORDER',
        orderId: order.id,
        serviceType: order.serviceType,
        pickup: order.pickupPoints?.[0] || order.pickup,
        delivery: order.deliveryPoints?.[0] || order.delivery,
        createdAt: Date.now(),
        priority: order.serviceType === 'BARQ' ? 'critical' : 'normal',
      };

      // Use master orchestrator for coordinated assignment
      const orchestrator = this.agents.get('master-orchestrator');
      const decision = await orchestrator.orchestrate(orderContext);

      // Process the decision
      const result = await this.processOrchestratorDecision(decision, order);

      const executionTime = Date.now() - startTime;
      logger.info(`[AgentManager] Order processed in ${executionTime}ms`, {
        orderId: order.id,
        action: decision.action,
        assignedDriver: decision.assignedDriver,
      });

      return result;
    } catch (error) {
      logger.error('[AgentManager] Failed to handle new order', {
        error: error.message,
        orderId: order.id,
      });

      // Fallback to legacy system for reliability
      return this.fallbackToLegacySystem(order);
    }
  }

  /**
   * Process orchestrator decision
   */
  async processOrchestratorDecision(decision, order) {
    const result = {
      success: false,
      orderId: order.id,
      action: decision.action,
      assignedDriver: null,
      route: null,
      message: '',
      warnings: decision.warnings || [],
    };

    switch (decision.action) {
      case 'ASSIGNED':
        result.success = true;
        result.assignedDriver = decision.assignedDriver;
        result.route = decision.route;
        result.message = `Order assigned to driver ${decision.assignedDriver}`;

        // Update order status in database
        await this.updateOrderAssignment(order.id, decision.assignedDriver);

        // Send notifications
        await this.sendAssignmentNotifications(order, decision);
        break;

      case 'ASSIGNED_PENDING_ROUTE':
        result.success = true;
        result.assignedDriver = decision.assignedDriver;
        result.message = 'Order assigned, route optimization pending';
        break;

      case 'QUEUED':
        result.success = true;
        result.message = 'Order queued for next available driver';

        // Add to priority queue
        await this.addToQueue(order, decision.priority || 'normal');
        break;

      case 'EMERGENCY_QUEUE':
        result.success = false;
        result.message = 'Order requires manual intervention';
        result.warnings.push('Manual assignment required');

        // Escalate to supervisor
        await this.escalateToSupervisor(order, decision.error);
        break;

      case 'FAILED':
        result.success = false;
        result.message = 'Order assignment failed';
        result.warnings = decision.risks.map((r) => r.error);
        break;

      default:
        result.message = `Unknown action: ${decision.action}`;
    }

    return result;
  }

  /**
   * Fallback to legacy optimization system
   */
  async fallbackToLegacySystem(order) {
    logger.warn('[AgentManager] Using legacy system fallback');

    try {
      // Use existing planning agent
      const planningAgent = this.agents.get('planning');
      const initialPlan = await planningAgent.plan(order);

      // Use existing optimization agent
      const optimizationAgent = this.agents.get('optimization');
      const optimizedPlan = await optimizationAgent.optimize({
        plan: initialPlan,
        context: order.context || {},
        preferences: order.preferences || {},
        businessRules: order.businessRules || {},
      });

      // Use existing formatting agent
      const formatAgent = this.agents.get('formatting');
      const formattedResponse = await formatAgent.format({
        optimizedPlan: optimizedPlan,
        request: order,
      });

      return {
        success: true,
        data: formattedResponse,
        message: 'Processed using legacy system',
        fallbackUsed: true,
      };
    } catch (error) {
      logger.error('[AgentManager] Legacy fallback also failed', {
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
        message: 'All processing methods failed',
      };
    }
  }

  /**
   * Handle SLA alerts from monitor
   */
  async handleSLAAlerts(alerts) {
    for (const alert of alerts) {
      logger.warn(`[AgentManager] Processing SLA alert`, alert);

      if (alert.severity === 'critical') {
        // Trigger emergency response
        await this.triggerEmergencyResponse(alert);
      } else if (alert.severity === 'high') {
        // Try to expedite order
        await this.expediteOrder(alert.orderId);
      }

      // Send notifications
      if (alert.customerNotification) {
        await this.notifyCustomer(alert.orderId, alert.message);
      }
    }
  }

  /**
   * Trigger emergency response for critical SLA
   */
  async triggerEmergencyResponse(alert) {
    const orchestrator = this.agents.get('master-orchestrator');

    await orchestrator.orchestrate({
      type: 'SLA_WARNING',
      orderId: alert.orderId,
      severity: 'critical',
      serviceType: alert.serviceType,
    });
  }

  /**
   * Get system status
   */
  getSystemStatus() {
    const status = {
      mode: this.mode,
      isRunning: this.isRunning,
      agents: {},
      continuousAgents: {},
      metrics: {},
    };

    // Check each agent's health
    this.agents.forEach((agent, name) => {
      status.agents[name] = {
        registered: true,
        healthy: agent.isHealthy ? agent.isHealthy() : true,
      };
    });

    // Check continuous agents
    this.continuousAgents.forEach((interval, name) => {
      status.continuousAgents[name] = {
        running: true,
        interval: this.intervals[name],
      };
    });

    // Add system metrics
    const orchestrator = this.agents.get('master-orchestrator');
    if (orchestrator) {
      status.metrics = orchestrator.getSystemState();
    }

    return status;
  }

  /**
   * Set operating mode
   */
  setOperatingMode(mode) {
    const validModes = ['normal', 'peak', 'emergency', 'maintenance'];

    if (!validModes.includes(mode)) {
      throw new Error(`Invalid mode: ${mode}`);
    }

    this.mode = mode;
    logger.info(`[AgentManager] Operating mode changed to: ${mode}`);

    // Adjust intervals based on mode
    if (mode === 'peak' || mode === 'emergency') {
      // Faster monitoring in peak/emergency
      this.intervals.fleetStatus = 5000;
      this.intervals.slaMonitor = 5000;
    } else {
      // Normal intervals
      this.intervals.fleetStatus = 10000;
      this.intervals.slaMonitor = 10000;
    }

    // Restart continuous agents with new intervals
    if (this.isRunning) {
      this.stopContinuousAgents();
      this.startContinuousAgents();
    }

    this.emit('mode-changed', mode);
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Handle fleet updates
    this.on('fleet-update', (fleetStatus) => {
      // Update dashboard or send to WebSocket clients
      this.broadcastFleetUpdate(fleetStatus);
    });

    // Handle SLA updates
    this.on('sla-update', (slaStatus) => {
      // Update monitoring dashboard
      this.broadcastSLAUpdate(slaStatus);
    });

    // Handle mode changes
    this.on('mode-changed', (mode) => {
      // Notify all relevant services
      this.broadcastModeChange(mode);
    });
  }

  /**
   * Broadcast updates (implement WebSocket in production)
   */
  broadcastFleetUpdate(fleetStatus) {
    // This would send to WebSocket clients in production
    logger.debug('[AgentManager] Fleet update broadcast', {
      availableDrivers: fleetStatus.drivers.available.length,
      busyDrivers: fleetStatus.drivers.busy.length,
    });
  }

  broadcastSLAUpdate(slaStatus) {
    logger.debug('[AgentManager] SLA update broadcast', {
      healthy: slaStatus.orders.healthy.length,
      atRisk: slaStatus.orders.warning.length + slaStatus.orders.critical.length,
      breached: slaStatus.orders.breached.length,
    });
  }

  broadcastModeChange(mode) {
    logger.info('[AgentManager] Mode change broadcast', { mode });
  }

  /**
   * Mock helper methods - Replace with actual implementations
   */
  async updateOrderAssignment(orderId, driverId) {
    // Update in database
    logger.info(`Order ${orderId} assigned to driver ${driverId}`);
  }

  async sendAssignmentNotifications(order, decision) {
    // Send notifications to driver and customer
    logger.info(`Notifications sent for order ${order.id}`);
  }

  async addToQueue(order, priority) {
    // Add to priority queue
    logger.info(`Order ${order.id} added to ${priority} queue`);
  }

  async escalateToSupervisor(order, error) {
    // Escalate to supervisor
    logger.error(`Order ${order.id} escalated: ${error}`);
  }

  async expediteOrder(orderId) {
    // Expedite order processing
    logger.info(`Expediting order ${orderId}`);
  }

  async notifyCustomer(orderId, message) {
    // Send customer notification
    logger.info(`Customer notified for order ${orderId}: ${message}`);
  }

  /**
   * Shutdown service
   */
  async shutdown() {
    logger.info('[AgentManager] Shutting down agent manager');

    // Stop continuous agents
    this.stopContinuousAgents();

    // Clear all agents
    this.agents.clear();

    // Remove all listeners
    this.removeAllListeners();

    logger.info('[AgentManager] Agent manager shut down complete');
  }

  /**
   * Execute agent with tracking
   */
  async executeAgentWithTracking(agentName, context = {}) {
    const startTime = Date.now();
    const executionId = `${agentName}-${startTime}`;

    const executionRecord = {
      id: executionId,
      agentName,
      startTime,
      endTime: null,
      duration: null,
      status: 'RUNNING',
      result: null,
      error: null,
      context: {
        type: context.type || 'unknown',
        requestId: context.requestId || null,
      },
    };

    try {
      const agent = this.agents.get(agentName);
      if (!agent) {
        throw new Error(`Agent ${agentName} not found`);
      }

      // Execute the agent
      const result = await agent.execute(context);

      // Record success
      executionRecord.endTime = Date.now();
      executionRecord.duration = executionRecord.endTime - executionRecord.startTime;
      executionRecord.status = 'SUCCESS';
      executionRecord.result = result;

      // Update stats
      this.updateExecutionStats(agentName, executionRecord);

      return result;
    } catch (error) {
      // Record failure
      executionRecord.endTime = Date.now();
      executionRecord.duration = executionRecord.endTime - executionRecord.startTime;
      executionRecord.status = 'FAILURE';
      executionRecord.error = {
        message: error.message,
        stack: error.stack,
      };

      // Update stats
      this.updateExecutionStats(agentName, executionRecord);

      // Add to recent errors
      this.addRecentError({
        agentName,
        timestamp: executionRecord.endTime,
        error: error.message,
        context: executionRecord.context,
      });

      throw error;
    } finally {
      // Add to execution history
      this.addExecutionHistory(agentName, executionRecord);
    }
  }

  /**
   * Add execution to history
   */
  addExecutionHistory(agentName, executionRecord) {
    if (!this.executionHistory.has(agentName)) {
      this.executionHistory.set(agentName, []);
    }

    const history = this.executionHistory.get(agentName);
    history.unshift(executionRecord); // Add to beginning

    // Keep only last N executions
    if (history.length > this.maxHistoryPerAgent) {
      history.pop();
    }
  }

  /**
   * Update execution statistics
   */
  updateExecutionStats(agentName, executionRecord) {
    if (!this.executionStats.has(agentName)) {
      this.executionStats.set(agentName, {
        totalExecutions: 0,
        successCount: 0,
        failureCount: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        lastExecution: null,
        lastSuccess: null,
        lastFailure: null,
      });
    }

    const stats = this.executionStats.get(agentName);
    stats.totalExecutions++;
    stats.totalDuration += executionRecord.duration;
    stats.avgDuration = Math.round(stats.totalDuration / stats.totalExecutions);
    stats.minDuration = Math.min(stats.minDuration, executionRecord.duration);
    stats.maxDuration = Math.max(stats.maxDuration, executionRecord.duration);
    stats.lastExecution = executionRecord.endTime;

    if (executionRecord.status === 'SUCCESS') {
      stats.successCount++;
      stats.lastSuccess = executionRecord.endTime;
    } else {
      stats.failureCount++;
      stats.lastFailure = executionRecord.endTime;
    }
  }

  /**
   * Add recent error
   */
  addRecentError(errorRecord) {
    this.recentErrors.unshift(errorRecord);
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors.pop();
    }
  }

  /**
   * Get all agent status for monitoring
   */
  getAllAgentStatus() {
    const statuses = [];

    for (const [name, agent] of this.agents.entries()) {
      const stats = this.executionStats.get(name) || {};
      const history = this.executionHistory.get(name) || [];
      const lastExecution = history[0] || null;
      const agentState = this.agentStatus.get(name) || this.AGENT_STATES.IDLE;

      // Calculate health score
      const healthScore = this.calculateHealthScore(name, stats, lastExecution);

      // Determine status
      let status = agentState;
      if (lastExecution) {
        if (lastExecution.status === 'RUNNING') {
          status = this.AGENT_STATES.RUNNING;
        } else if (lastExecution.status === 'FAILURE') {
          status = this.AGENT_STATES.ERROR;
        }
      }

      // Check if agent is disabled
      if (agent.disabled) {
        status = 'DISABLED';
      }

      statuses.push({
        name,
        status,
        state: agentState,
        lastRun: lastExecution?.endTime || null,
        lastDuration: lastExecution?.duration || null,
        lastResult: lastExecution?.status || null,
        healthScore: healthScore,
        successRate: this.calculateSuccessRate(stats),
        avgDuration: stats.avgDuration || 0,
        executionCount: stats.totalExecutions || 0,
        errorCount: stats.failureCount || 0,
        lastError: this.getLastError(name),
        isContinuous: this.continuousAgents.has(name),
        interval: this.intervals[name] || null,
        uptime: this.calculateUptime(name),
      });
    }

    return statuses;
  }

  /**
   * Start a specific agent
   */
  async startAgent(agentName) {
    if (!this.agents.has(agentName)) {
      throw new Error(`Agent ${agentName} not found`);
    }

    const currentState = this.agentStatus.get(agentName);
    if (currentState === this.AGENT_STATES.RUNNING) {
      return { success: true, message: `Agent ${agentName} is already running` };
    }

    try {
      this.agentStatus.set(agentName, this.AGENT_STATES.STARTING);
      this.addAgentLog(agentName, 'info', `Starting agent ${agentName}`);

      const agent = this.agents.get(agentName);
      
      // Initialize agent if it has an initialize method
      if (typeof agent.initialize === 'function') {
        await agent.initialize();
      }

      // Start continuous monitoring if it's a continuous agent
      if (this.intervals[agentName]) {
        this.startSingleContinuousAgent(agentName);
      }

      this.agentStatus.set(agentName, this.AGENT_STATES.RUNNING);
      this.addAgentLog(agentName, 'info', `Agent ${agentName} started successfully`);
      
      this.emit('agentStarted', { agentName, timestamp: Date.now() });
      
      return { success: true, message: `Agent ${agentName} started successfully` };
    } catch (error) {
      this.agentStatus.set(agentName, this.AGENT_STATES.ERROR);
      this.addAgentLog(agentName, 'error', `Failed to start agent ${agentName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop a specific agent
   */
  async stopAgent(agentName) {
    if (!this.agents.has(agentName)) {
      throw new Error(`Agent ${agentName} not found`);
    }

    const currentState = this.agentStatus.get(agentName);
    if (currentState === this.AGENT_STATES.STOPPED) {
      return { success: true, message: `Agent ${agentName} is already stopped` };
    }

    try {
      this.agentStatus.set(agentName, this.AGENT_STATES.STOPPING);
      this.addAgentLog(agentName, 'info', `Stopping agent ${agentName}`);

      // Stop continuous monitoring if it exists
      if (this.continuousAgents.has(agentName)) {
        clearInterval(this.continuousAgents.get(agentName));
        this.continuousAgents.delete(agentName);
      }

      const agent = this.agents.get(agentName);
      
      // Shutdown agent if it has a shutdown method
      if (typeof agent.shutdown === 'function') {
        await agent.shutdown();
      }

      this.agentStatus.set(agentName, this.AGENT_STATES.STOPPED);
      this.addAgentLog(agentName, 'info', `Agent ${agentName} stopped successfully`);
      
      this.emit('agentStopped', { agentName, timestamp: Date.now() });
      
      return { success: true, message: `Agent ${agentName} stopped successfully` };
    } catch (error) {
      this.agentStatus.set(agentName, this.AGENT_STATES.ERROR);
      this.addAgentLog(agentName, 'error', `Failed to stop agent ${agentName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Restart a specific agent
   */
  async restartAgent(agentName) {
    if (!this.agents.has(agentName)) {
      throw new Error(`Agent ${agentName} not found`);
    }

    try {
      this.addAgentLog(agentName, 'info', `Restarting agent ${agentName}`);
      
      // Stop the agent first
      await this.stopAgent(agentName);
      
      // Wait a moment for clean shutdown
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Start the agent
      await this.startAgent(agentName);
      
      this.addAgentLog(agentName, 'info', `Agent ${agentName} restarted successfully`);
      this.emit('agentRestarted', { agentName, timestamp: Date.now() });
      
      return { success: true, message: `Agent ${agentName} restarted successfully` };
    } catch (error) {
      this.agentStatus.set(agentName, this.AGENT_STATES.ERROR);
      this.addAgentLog(agentName, 'error', `Failed to restart agent ${agentName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get specific agent status
   */
  getAgentStatus(agentName) {
    if (!this.agents.has(agentName)) {
      throw new Error(`Agent ${agentName} not found`);
    }

    const state = this.agentStatus.get(agentName) || this.AGENT_STATES.IDLE;
    const stats = this.executionStats.get(agentName) || {};
    const history = this.executionHistory.get(agentName) || [];
    const lastExecution = history[0] || null;
    const config = this.agentConfigs.get(agentName) || {};
    const metrics = this.agentMetrics.get(agentName) || {};

    return {
      name: agentName,
      state,
      isRunning: state === this.AGENT_STATES.RUNNING,
      isContinuous: this.continuousAgents.has(agentName),
      interval: this.intervals[agentName] || null,
      lastExecution: lastExecution ? {
        id: lastExecution.id,
        startTime: lastExecution.startTime,
        endTime: lastExecution.endTime,
        duration: lastExecution.duration,
        status: lastExecution.status,
        error: lastExecution.error
      } : null,
      statistics: {
        totalExecutions: stats.totalExecutions || 0,
        successCount: stats.successCount || 0,
        failureCount: stats.failureCount || 0,
        successRate: this.calculateSuccessRate(stats),
        avgDuration: stats.avgDuration || 0,
        lastSuccess: stats.lastSuccess || null,
        lastFailure: stats.lastFailure || null
      },
      configuration: config,
      metrics,
      healthScore: this.calculateHealthScore(agentName, stats, lastExecution),
      uptime: this.calculateUptime(agentName),
      logs: this.getAgentLogs(agentName, 10)
    };
  }

  /**
   * Get agent logs
   */
  getAgentLogs(agentName, limit = 50) {
    if (!this.agentLogs.has(agentName)) {
      return [];
    }

    const logs = this.agentLogs.get(agentName);
    return logs.slice(0, limit);
  }

  /**
   * Add log entry for an agent
   */
  addAgentLog(agentName, level, message, metadata = {}) {
    if (!this.agentLogs.has(agentName)) {
      this.agentLogs.set(agentName, []);
    }

    const logs = this.agentLogs.get(agentName);
    const logEntry = {
      timestamp: Date.now(),
      level,
      message,
      metadata
    };

    logs.unshift(logEntry);

    // Keep only the last N log entries
    if (logs.length > this.maxLogEntriesPerAgent) {
      logs.splice(this.maxLogEntriesPerAgent);
    }

    // Emit log event for real-time monitoring
    this.emit('agentLog', { agentName, logEntry });
  }

  /**
   * Update agent configuration
   */
  updateAgentConfig(agentName, config) {
    if (!this.agents.has(agentName)) {
      throw new Error(`Agent ${agentName} not found`);
    }

    const currentConfig = this.agentConfigs.get(agentName) || {};
    const newConfig = { ...currentConfig, ...config, updatedAt: Date.now() };
    
    this.agentConfigs.set(agentName, newConfig);
    
    // Update interval if provided
    if (config.interval && typeof config.interval === 'number') {
      this.intervals[agentName] = config.interval;
      
      // Restart continuous agent if it's running to apply new interval
      if (this.continuousAgents.has(agentName)) {
        this.stopSingleContinuousAgent(agentName);
        this.startSingleContinuousAgent(agentName);
      }
    }

    this.addAgentLog(agentName, 'info', 'Configuration updated', config);
    this.emit('agentConfigUpdated', { agentName, config: newConfig });
    
    return { success: true, config: newConfig };
  }

  /**
   * Reset agent configuration to defaults
   */
  resetAgentConfig(agentName) {
    if (!this.agents.has(agentName)) {
      throw new Error(`Agent ${agentName} not found`);
    }

    const defaultConfig = this.getDefaultAgentConfig(agentName);
    this.agentConfigs.set(agentName, defaultConfig);
    
    this.addAgentLog(agentName, 'info', 'Configuration reset to defaults');
    this.emit('agentConfigReset', { agentName, config: defaultConfig });
    
    return { success: true, config: defaultConfig };
  }

  /**
   * Get agent configuration
   */
  getAgentConfig(agentName) {
    if (!this.agents.has(agentName)) {
      throw new Error(`Agent ${agentName} not found`);
    }

    return this.agentConfigs.get(agentName) || this.getDefaultAgentConfig(agentName);
  }

  /**
   * Get default configuration for an agent
   */
  getDefaultAgentConfig(agentName) {
    const defaults = {
      enabled: true,
      interval: this.intervals[agentName] || null,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      logLevel: 'info',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Agent-specific defaults
    switch (agentName) {
      case 'fleetStatus':
        return { ...defaults, interval: 10000, priority: 'high' };
      case 'slaMonitor':
        return { ...defaults, interval: 10000, priority: 'critical' };
      case 'demandForecast':
        return { ...defaults, interval: 300000, priority: 'medium' };
      default:
        return defaults;
    }
  }

  /**
   * Get agent health status
   */
  getAgentHealth(agentName) {
    if (!this.agents.has(agentName)) {
      throw new Error(`Agent ${agentName} not found`);
    }

    const stats = this.executionStats.get(agentName) || {};
    const history = this.executionHistory.get(agentName) || [];
    const lastExecution = history[0] || null;
    const state = this.agentStatus.get(agentName) || this.AGENT_STATES.IDLE;

    const healthScore = this.calculateHealthScore(agentName, stats, lastExecution);
    const isHealthy = healthScore > 0.7 && state !== this.AGENT_STATES.ERROR;

    return {
      agentName,
      isHealthy,
      healthScore,
      state,
      lastExecution: lastExecution?.endTime || null,
      successRate: this.calculateSuccessRate(stats),
      errorCount: stats.failureCount || 0,
      uptime: this.calculateUptime(agentName),
      issues: this.getAgentIssues(agentName),
      recommendations: this.getAgentRecommendations(agentName)
    };
  }

  /**
   * Get agent performance metrics
   */
  getAgentMetrics(agentName) {
    if (!this.agents.has(agentName)) {
      throw new Error(`Agent ${agentName} not found`);
    }

    const stats = this.executionStats.get(agentName) || {};
    const history = this.executionHistory.get(agentName) || [];
    const metrics = this.agentMetrics.get(agentName) || {};

    // Calculate performance metrics
    const recentExecutions = history.slice(0, 10);
    const recentSuccesses = recentExecutions.filter(e => e.status === 'SUCCESS');
    const recentFailures = recentExecutions.filter(e => e.status === 'FAILURE');

    return {
      agentName,
      performance: {
        totalExecutions: stats.totalExecutions || 0,
        successCount: stats.successCount || 0,
        failureCount: stats.failureCount || 0,
        successRate: this.calculateSuccessRate(stats),
        avgDuration: stats.avgDuration || 0,
        minDuration: stats.minDuration === Infinity ? 0 : stats.minDuration || 0,
        maxDuration: stats.maxDuration || 0,
      },
      recent: {
        executions: recentExecutions.length,
        successes: recentSuccesses.length,
        failures: recentFailures.length,
        avgDuration: recentExecutions.length > 0 
          ? Math.round(recentExecutions.reduce((sum, e) => sum + e.duration, 0) / recentExecutions.length)
          : 0
      },
      health: {
        score: this.calculateHealthScore(agentName, stats, history[0]),
        uptime: this.calculateUptime(agentName),
        lastSuccess: stats.lastSuccess || null,
        lastFailure: stats.lastFailure || null
      },
      custom: metrics
    };
  }

  /**
   * Start a single continuous agent
   */
  startSingleContinuousAgent(agentName) {
    const interval = this.intervals[agentName];
    if (!interval) return;

    const agentInterval = setInterval(async () => {
      try {
        const agent = this.agents.get(agentName);
        if (agent && this.agentStatus.get(agentName) === this.AGENT_STATES.RUNNING) {
          await this.executeAgentWithTracking(agentName, {
            type: 'CONTINUOUS',
            timestamp: Date.now()
          });
        }
      } catch (error) {
        this.addAgentLog(agentName, 'error', `Continuous execution failed: ${error.message}`);
      }
    }, interval);

    this.continuousAgents.set(agentName, agentInterval);
  }

  /**
   * Stop a single continuous agent
   */
  stopSingleContinuousAgent(agentName) {
    if (this.continuousAgents.has(agentName)) {
      clearInterval(this.continuousAgents.get(agentName));
      this.continuousAgents.delete(agentName);
    }
  }

  /**
   * Calculate agent uptime
   */
  calculateUptime(agentName) {
    const history = this.executionHistory.get(agentName) || [];
    if (history.length === 0) return 0;

    const firstExecution = history[history.length - 1];
    const lastExecution = history[0];
    
    if (!firstExecution || !lastExecution) return 0;

    const totalTime = lastExecution.endTime - firstExecution.startTime;
    const failures = history.filter(e => e.status === 'FAILURE');
    const failureTime = failures.reduce((sum, f) => sum + (f.duration || 0), 0);

    return totalTime > 0 ? Math.max(0, (totalTime - failureTime) / totalTime) : 1;
  }

  /**
   * Get agent issues
   */
  getAgentIssues(agentName) {
    const issues = [];
    const stats = this.executionStats.get(agentName) || {};
    const state = this.agentStatus.get(agentName);
    const successRate = this.calculateSuccessRate(stats);

    if (state === this.AGENT_STATES.ERROR) {
      issues.push({ type: 'error', message: 'Agent is in error state', severity: 'high' });
    }

    if (successRate < 0.8) {
      issues.push({ type: 'performance', message: `Low success rate: ${Math.round(successRate * 100)}%`, severity: 'medium' });
    }

    if (stats.avgDuration > 5000) {
      issues.push({ type: 'performance', message: `High average duration: ${stats.avgDuration}ms`, severity: 'medium' });
    }

    const recentErrors = this.getAgentErrors(agentName, 5);
    if (recentErrors.length >= 3) {
      issues.push({ type: 'reliability', message: `Multiple recent errors: ${recentErrors.length}`, severity: 'high' });
    }

    return issues;
  }

  /**
   * Get agent recommendations
   */
  getAgentRecommendations(agentName) {
    const recommendations = [];
    const stats = this.executionStats.get(agentName) || {};
    const config = this.agentConfigs.get(agentName) || {};
    const successRate = this.calculateSuccessRate(stats);

    if (successRate < 0.8) {
      recommendations.push('Consider increasing timeout or retry attempts');
    }

    if (stats.avgDuration > 5000) {
      recommendations.push('Optimize agent execution for better performance');
    }

    if (!config.interval && this.intervals[agentName]) {
      recommendations.push('Configure monitoring interval for consistent execution');
    }

    if (stats.failureCount > stats.successCount) {
      recommendations.push('Review agent implementation for stability issues');
    }

    return recommendations;
  }

  /**
   * Get specific agent details
   */
  getAgentDetails(agentName) {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

    const stats = this.executionStats.get(agentName) || {};
    const history = this.executionHistory.get(agentName) || [];
    const lastExecution = history[0] || null;

    const healthScore = this.calculateHealthScore(agentName, stats, lastExecution);

    return {
      name: agentName,
      status: this.determineAgentStatus(agentName, lastExecution),
      healthScore,
      statistics: {
        totalExecutions: stats.totalExecutions || 0,
        successCount: stats.successCount || 0,
        failureCount: stats.failureCount || 0,
        successRate: this.calculateSuccessRate(stats),
        avgDuration: stats.avgDuration || 0,
        minDuration: stats.minDuration === Infinity ? 0 : stats.minDuration,
        maxDuration: stats.maxDuration || 0,
        lastExecution: stats.lastExecution || null,
        lastSuccess: stats.lastSuccess || null,
        lastFailure: stats.lastFailure || null,
      },
      lastExecution: lastExecution
        ? {
            id: lastExecution.id,
            startTime: lastExecution.startTime,
            endTime: lastExecution.endTime,
            duration: lastExecution.duration,
            status: lastExecution.status,
            error: lastExecution.error,
          }
        : null,
      recentErrors: this.getAgentErrors(agentName, 10),
      configuration: {
        interval: this.intervals[agentName] || null,
        isContinuous: this.continuousAgents.has(agentName),
        isRegistered: true,
      },
    };
  }

  /**
   * Get execution history for an agent
   */
  getExecutionHistory(agentName, limit = 20) {
    const history = this.executionHistory.get(agentName) || [];
    return history.slice(0, limit).map((exec) => ({
      id: exec.id,
      startTime: exec.startTime,
      endTime: exec.endTime,
      duration: exec.duration,
      status: exec.status,
      error: exec.error ? exec.error.message : null,
      context: exec.context,
    }));
  }

  /**
   * Get system health overview
   */
  getSystemHealth() {
    const allAgents = this.getAllAgentStatus();
    const activeAgents = allAgents.filter((a) => a.status === 'ACTIVE' || a.status === 'IDLE');
    const errorAgents = allAgents.filter((a) => a.status === 'ERROR');
    const disabledAgents = allAgents.filter((a) => a.status === 'DISABLED');

    const totalExecutions = allAgents.reduce((sum, a) => sum + a.executionCount, 0);
    const totalErrors = allAgents.reduce((sum, a) => sum + a.errorCount, 0);
    const avgHealthScore = allAgents.reduce((sum, a) => sum + a.healthScore, 0) / allAgents.length;

    return {
      overall: {
        status: errorAgents.length > allAgents.length * 0.3 ? 'DEGRADED' : 'HEALTHY',
        healthScore: Math.round(avgHealthScore * 100) / 100,
        timestamp: Date.now(),
      },
      agents: {
        total: allAgents.length,
        active: activeAgents.length,
        error: errorAgents.length,
        disabled: disabledAgents.length,
        idle: allAgents.filter((a) => a.status === 'IDLE').length,
      },
      performance: {
        totalExecutions,
        totalErrors,
        successRate: totalExecutions > 0 ? (totalExecutions - totalErrors) / totalExecutions : 1,
        avgResponseTime: this.calculateAvgResponseTime(allAgents),
      },
      mode: this.mode,
      isRunning: this.isRunning,
      continuousAgents: this.continuousAgents.size,
    };
  }

  /**
   * Get recent errors across all agents
   */
  getRecentErrors(limit = 20) {
    return this.recentErrors.slice(0, limit);
  }

  /**
   * Calculate health score for an agent
   */
  calculateHealthScore(agentName, stats, lastExecution) {
    const now = Date.now();

    // Success rate component (50%)
    const successRate = this.calculateSuccessRate(stats);
    const successScore = successRate;

    // Performance component (30%)
    const avgDuration = stats.avgDuration || 0;
    const expectedDuration = 200; // 200ms baseline
    const performanceScore =
      avgDuration > 0 ? Math.max(0, Math.min(1, expectedDuration / avgDuration)) : 1;

    // Freshness component (20%)
    const lastRun = lastExecution?.endTime || stats.lastExecution || 0;
    const timeSinceLastRun = now - lastRun;
    const maxAcceptableGap = 3600000; // 1 hour
    const freshnessScore =
      timeSinceLastRun < maxAcceptableGap
        ? Math.max(0, 1 - timeSinceLastRun / maxAcceptableGap)
        : 0;

    // Weighted average
    const healthScore = successScore * 0.5 + performanceScore * 0.3 + freshnessScore * 0.2;

    return Math.round(healthScore * 100) / 100;
  }

  /**
   * Calculate success rate
   */
  calculateSuccessRate(stats) {
    const total = stats.totalExecutions || 0;
    if (total === 0) return 1.0;

    const success = stats.successCount || 0;
    return Math.round((success / total) * 100) / 100;
  }

  /**
   * Determine agent status
   */
  determineAgentStatus(agentName, lastExecution) {
    const agent = this.agents.get(agentName);
    if (!agent) return 'UNKNOWN';
    if (agent.disabled) return 'DISABLED';

    if (!lastExecution) return 'IDLE';

    const timeSinceLastRun = Date.now() - lastExecution.endTime;

    if (lastExecution.status === 'RUNNING') return 'ACTIVE';
    if (lastExecution.status === 'FAILURE') return 'ERROR';
    if (timeSinceLastRun < 60000) return 'ACTIVE';

    return 'IDLE';
  }

  /**
   * Get last error for an agent
   */
  getLastError(agentName) {
    const errors = this.recentErrors.filter((e) => e.agentName === agentName);
    if (errors.length === 0) return null;

    const lastError = errors[0];
    return {
      message: lastError.error,
      timestamp: lastError.timestamp,
    };
  }

  /**
   * Get errors for a specific agent
   */
  getAgentErrors(agentName, limit = 10) {
    return this.recentErrors.filter((e) => e.agentName === agentName).slice(0, limit);
  }

  /**
   * Calculate average response time
   */
  calculateAvgResponseTime(allAgents) {
    const avgDurations = allAgents.map((a) => a.avgDuration).filter((d) => d > 0);

    if (avgDurations.length === 0) return 0;

    const sum = avgDurations.reduce((acc, d) => acc + d, 0);
    return Math.round(sum / avgDurations.length);
  }

  /**
   * Bulk operations - Start multiple agents
   */
  async startAgents(agentNames) {
    const results = [];
    for (const agentName of agentNames) {
      try {
        const result = await this.startAgent(agentName);
        results.push({ agentName, ...result });
      } catch (error) {
        results.push({ agentName, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * Bulk operations - Stop multiple agents
   */
  async stopAgents(agentNames) {
    const results = [];
    for (const agentName of agentNames) {
      try {
        const result = await this.stopAgent(agentName);
        results.push({ agentName, ...result });
      } catch (error) {
        results.push({ agentName, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * Bulk operations - Get status of multiple agents
   */
  getBulkAgentStatus(agentNames) {
    const results = [];
    for (const agentName of agentNames) {
      try {
        const status = this.getAgentStatus(agentName);
        results.push({ agentName, success: true, data: status });
      } catch (error) {
        results.push({ agentName, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * Get system-wide metrics
   */
  getSystemMetrics() {
    const allAgents = this.getAllAgentStatus();
    const totalExecutions = allAgents.reduce((sum, a) => sum + a.executionCount, 0);
    const totalErrors = allAgents.reduce((sum, a) => sum + a.errorCount, 0);
    const runningAgents = allAgents.filter(a => a.state === this.AGENT_STATES.RUNNING);
    const errorAgents = allAgents.filter(a => a.state === this.AGENT_STATES.ERROR);

    return {
      overview: {
        totalAgents: allAgents.length,
        runningAgents: runningAgents.length,
        errorAgents: errorAgents.length,
        stoppedAgents: allAgents.filter(a => a.state === this.AGENT_STATES.STOPPED).length,
        systemHealth: errorAgents.length === 0 ? 'healthy' : errorAgents.length < allAgents.length * 0.3 ? 'degraded' : 'critical'
      },
      performance: {
        totalExecutions,
        totalErrors,
        systemSuccessRate: totalExecutions > 0 ? (totalExecutions - totalErrors) / totalExecutions : 1,
        avgResponseTime: this.calculateAvgResponseTime(allAgents),
        continuousAgents: this.continuousAgents.size
      },
      resources: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        mode: this.mode,
        isRunning: this.isRunning
      },
      agents: allAgents
    };
  }

  /**
   * Update agent metrics (for custom metrics)
   */
  updateAgentMetrics(agentName, metrics) {
    if (!this.agents.has(agentName)) {
      throw new Error(`Agent ${agentName} not found`);
    }

    const currentMetrics = this.agentMetrics.get(agentName) || {};
    const updatedMetrics = { ...currentMetrics, ...metrics, updatedAt: Date.now() };
    
    this.agentMetrics.set(agentName, updatedMetrics);
    this.emit('agentMetricsUpdated', { agentName, metrics: updatedMetrics });
    
    return { success: true, metrics: updatedMetrics };
  }

  /**
   * Clear agent logs
   */
  clearAgentLogs(agentName) {
    if (!this.agents.has(agentName)) {
      throw new Error(`Agent ${agentName} not found`);
    }

    this.agentLogs.set(agentName, []);
    this.addAgentLog(agentName, 'info', 'Logs cleared');
    
    return { success: true, message: 'Logs cleared successfully' };
  }

  /**
   * Get real-time agent updates (for WebSocket)
   */
  getRealtimeUpdates() {
    return {
      timestamp: Date.now(),
      systemStatus: this.getSystemHealth(),
      agentStatuses: this.getAllAgentStatus(),
      recentErrors: this.getRecentErrors(5),
      systemMetrics: {
        mode: this.mode,
        isRunning: this.isRunning,
        continuousAgents: this.continuousAgents.size,
        totalAgents: this.agents.size
      }
    };
  }
}

module.exports = AgentManagerService;
