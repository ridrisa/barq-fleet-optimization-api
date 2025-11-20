/**
 * Enhanced Demo Orchestrator Service
 * Comprehensive orchestration of demo scenarios with simulation engine integration
 */

const EventEmitter = require('events');
const { logger } = require('../utils/logger');
const DemoSimulationEngine = require('./demo-simulation-engine');
const DemoGenerator = require('./demo-generator');
const DemoWebSocketServer = require('./websocket-server');
const demoDatabaseService = require('./demo-database.service');
const { v4: uuidv4 } = require('uuid');

class EnhancedDemoOrchestrator extends EventEmitter {
  constructor() {
    super();
    
    this.simulationEngine = new DemoSimulationEngine();
    this.demoGenerator = new DemoGenerator();
    this.wsServer = null;
    this.isRunning = false;
    
    // Demo scenarios with enhanced configurations
    this.scenarios = {
      'executive-dashboard': {
        id: 'executive-dashboard',
        name: 'Executive Dashboard Demonstration',
        description: 'Strategic KPI overview with ROI analysis and performance benchmarks',
        duration: 5, // minutes
        ordersPerMinute: 8,
        timeAcceleration: 10, // 10x speed
        focus: 'high-level-metrics',
        steps: [
          {
            id: 'kpi-overview',
            title: 'Real-time KPI Dashboard',
            duration: 90, // seconds
            highlights: ['order-volume', 'delivery-times', 'cost-savings'],
            dataPoints: {
              totalSavings: 10950000, // SAR
              orderVolume: 15000,
              avgDeliveryTime: 24.7,
              costPerDelivery: 8.5
            }
          },
          {
            id: 'roi-analysis',
            title: 'ROI & Financial Impact',
            duration: 90,
            highlights: ['cost-analysis', 'efficiency-gains', 'profit-margins'],
            dataPoints: {
              monthlyROI: 23.4,
              operationalSavings: 1200000,
              efficiencyGain: 31.2
            }
          },
          {
            id: 'performance-benchmarks',
            title: 'Performance vs Industry Benchmarks',
            duration: 90,
            highlights: ['sla-compliance', 'customer-satisfaction', 'market-position'],
            dataPoints: {
              slaCompliance: 96.8,
              customerSatisfaction: 4.7,
              marketLeadership: 'top-3'
            }
          },
          {
            id: 'predictive-insights',
            title: 'Predictive Analytics & Forecasting',
            duration: 60,
            highlights: ['demand-forecast', 'capacity-planning', 'growth-projections'],
            dataPoints: {
              demandGrowth: 18.5,
              capacityUtilization: 87.2,
              projectedRevenue: 45000000
            }
          }
        ]
      },
      
      'fleet-operations': {
        id: 'fleet-operations',
        name: 'Fleet Manager Operations',
        description: 'Comprehensive fleet management with 800+ vehicles and real-time optimization',
        duration: 7, // minutes
        ordersPerMinute: 12,
        timeAcceleration: 5,
        focus: 'operational-excellence',
        steps: [
          {
            id: 'fleet-overview',
            title: 'Fleet Status & Utilization',
            duration: 105,
            highlights: ['vehicle-distribution', 'utilization-rates', 'maintenance-alerts'],
            dataPoints: {
              totalVehicles: 834,
              activeVehicles: 672,
              utilizationRate: 85.2,
              maintenanceAlerts: 12
            }
          },
          {
            id: 'dynamic-assignment',
            title: 'AI-Powered Order Assignment',
            duration: 120,
            highlights: ['assignment-algorithm', 'load-balancing', 'efficiency-optimization'],
            dataPoints: {
              assignmentTime: 0.8, // seconds
              balancingAccuracy: 94.3,
              routeOptimization: 92.1
            }
          },
          {
            id: 'sla-management',
            title: 'SLA Compliance & Monitoring',
            duration: 120,
            highlights: ['sla-tracking', 'risk-mitigation', 'proactive-alerts'],
            dataPoints: {
              currentCompliance: 96.8,
              riskOrders: 23,
              alertsGenerated: 45
            }
          },
          {
            id: 'batch-optimization',
            title: 'CVRP Batch Optimization',
            duration: 75,
            highlights: ['batch-processing', 'route-planning', 'capacity-optimization'],
            dataPoints: {
              batchSize: 25,
              routeEfficiency: 89.4,
              fuelSavings: 23.7
            }
          }
        ]
      },
      
      'dispatcher-workflow': {
        id: 'dispatcher-workflow',
        name: 'Dispatcher Real-time Operations',
        description: 'Emergency handling, escalation management, and real-time coordination',
        duration: 10, // minutes
        ordersPerMinute: 15,
        timeAcceleration: 3,
        focus: 'crisis-management',
        steps: [
          {
            id: 'emergency-response',
            title: 'Emergency Escalation System',
            duration: 150,
            highlights: ['emergency-detection', 'escalation-protocols', 'response-coordination'],
            dataPoints: {
              emergencyOrders: 3,
              responseTime: 2.3, // minutes
              escalationSuccess: 98.5
            }
          },
          {
            id: 'agent-coordination',
            title: 'Multi-Agent Orchestration',
            duration: 180,
            highlights: ['agent-coordination', 'decision-making', 'conflict-resolution'],
            dataPoints: {
              activeAgents: 18,
              coordinationEfficiency: 96.2,
              conflictResolution: 4.2 // minutes avg
            }
          },
          {
            id: 'traffic-adaptation',
            title: 'Real-time Traffic Adaptation',
            duration: 120,
            highlights: ['traffic-monitoring', 'dynamic-rerouting', 'eta-updates'],
            dataPoints: {
              trafficIncidents: 7,
              reroutedVehicles: 23,
              etaAccuracy: 91.8
            }
          },
          {
            id: 'order-recovery',
            title: 'Order Recovery & Problem Resolution',
            duration: 120,
            highlights: ['failed-order-recovery', 'customer-communication', 'solution-implementation'],
            dataPoints: {
              failedOrders: 8,
              recoveryRate: 94.7,
              customerSatisfaction: 4.6
            }
          }
        ]
      },
      
      'analytics-showcase': {
        id: 'analytics-showcase',
        name: 'Analytics Deep Dive',
        description: 'Advanced analytics with ML insights and predictive intelligence',
        duration: 8, // minutes
        ordersPerMinute: 6,
        timeAcceleration: 7,
        focus: 'data-intelligence',
        steps: [
          {
            id: 'demand-forecasting',
            title: 'ML-Powered Demand Forecasting',
            duration: 120,
            highlights: ['demand-patterns', 'forecasting-accuracy', 'capacity-planning'],
            dataPoints: {
              forecastAccuracy: 89.7,
              demandPeaks: 3,
              capacityOptimization: 15.2
            }
          },
          {
            id: 'route-analytics',
            title: 'Route Performance Analysis',
            duration: 150,
            highlights: ['route-efficiency', 'pattern-analysis', 'optimization-opportunities'],
            dataPoints: {
              analyzedDeliveries: 7444,
              routeEfficiency: 92.3,
              optimizationGains: 18.5
            }
          },
          {
            id: 'fleet-performance',
            title: 'Fleet Performance Intelligence',
            duration: 120,
            highlights: ['vehicle-utilization', 'driver-performance', 'maintenance-insights'],
            dataPoints: {
              fleetUtilization: 87.1,
              driverRating: 4.5,
              maintenanceSavings: 12.3
            }
          },
          {
            id: 'predictive-analytics',
            title: 'Predictive Business Intelligence',
            duration: 90,
            highlights: ['trend-analysis', 'risk-assessment', 'opportunity-identification'],
            dataPoints: {
              trendAccuracy: 88.4,
              riskMitigation: 23.7,
              businessOpportunities: 8
            }
          }
        ]
      },
      
      'ai-agents-showcase': {
        id: 'ai-agents-showcase',
        name: 'AI Agent Ecosystem',
        description: '18+ autonomous agents working in coordination for intelligent operations',
        duration: 12, // minutes
        ordersPerMinute: 10,
        timeAcceleration: 4,
        focus: 'autonomous-intelligence',
        steps: [
          {
            id: 'agent-ecosystem',
            title: 'Multi-Agent System Overview',
            duration: 180,
            highlights: ['agent-types', 'coordination-patterns', 'decision-hierarchies'],
            dataPoints: {
              totalAgents: 18,
              activeAgents: 16,
              coordinationEfficiency: 97.2
            }
          },
          {
            id: 'master-orchestrator',
            title: 'Master Orchestrator Intelligence',
            duration: 180,
            highlights: ['orchestration-logic', 'priority-management', 'resource-allocation'],
            dataPoints: {
              decisionsPerMinute: 45,
              orchestrationAccuracy: 96.8,
              resourceOptimization: 23.4
            }
          },
          {
            id: 'autonomous-decisions',
            title: 'Autonomous Decision Making',
            duration: 180,
            highlights: ['decision-speed', 'accuracy-rates', 'learning-adaptation'],
            dataPoints: {
              avgDecisionTime: 0.7, // seconds
              decisionAccuracy: 94.5,
              adaptationRate: 12.3
            }
          },
          {
            id: 'intelligent-automation',
            title: 'End-to-End Intelligent Automation',
            duration: 180,
            highlights: ['automation-coverage', 'human-intervention', 'continuous-improvement'],
            dataPoints: {
              automationRate: 97.2,
              humanIntervention: 2.8,
              improvementCycles: 8
            }
          }
        ]
      },
      
      'system-integration': {
        id: 'system-integration',
        name: 'Complete System Integration',
        description: 'End-to-end workflow demonstrating full system capabilities',
        duration: 6, // minutes
        ordersPerMinute: 20,
        timeAcceleration: 8,
        focus: 'complete-automation',
        steps: [
          {
            id: 'order-lifecycle',
            title: 'Complete Order Lifecycle',
            duration: 90,
            highlights: ['order-creation', 'optimization', 'delivery-completion'],
            dataPoints: {
              lifecycleSteps: 12,
              automationRate: 98.5,
              completionTime: 23.7 // minutes avg
            }
          },
          {
            id: 'multi-agent-coordination',
            title: 'Multi-Agent Coordination',
            duration: 90,
            highlights: ['agent-collaboration', 'conflict-resolution', 'consensus-building'],
            dataPoints: {
              coordinatingAgents: 18,
              conflictResolution: 99.2,
              consensusTime: 1.3 // seconds
            }
          },
          {
            id: 'real-time-optimization',
            title: 'Real-time System Optimization',
            duration: 90,
            highlights: ['dynamic-optimization', 'performance-tuning', 'adaptive-learning'],
            dataPoints: {
              optimizationCycles: 12,
              performanceGain: 15.7,
              learningRate: 8.9
            }
          },
          {
            id: 'complete-automation',
            title: 'Fully Automated Operations',
            duration: 90,
            highlights: ['zero-touch-operations', 'autonomous-scaling', 'intelligent-monitoring'],
            dataPoints: {
              zeroTouchRate: 99.1,
              autoScalingEvents: 5,
              monitoringCoverage: 100
            }
          }
        ]
      }
    };
    
    // Current demo state
    this.currentDemo = null;
    this.currentStep = 0;
    this.demoStartTime = null;
    this.stepStartTime = null;
    this.demoMetrics = {
      ordersGenerated: 0,
      agentDecisions: 0,
      optimizationRuns: 0,
      emergencyEscalations: 0
    };
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Listen to simulation engine events
    this.simulationEngine.on('agentResponse', (response) => {
      this.handleAgentResponse(response);
    });
    
    this.simulationEngine.on('trafficUpdate', (data) => {
      this.handleTrafficUpdate(data);
    });
    
    this.simulationEngine.on('metricsUpdate', (metrics) => {
      this.handleMetricsUpdate(metrics);
    });
    
    // Listen to demo generator events
    this.demoGenerator.on('orderCreated', (order) => {
      this.demoMetrics.ordersGenerated++;
      this.broadcastEvent('orderCreated', { order, metrics: this.demoMetrics });
    });
    
    this.demoGenerator.on('orderDelivered', (data) => {
      this.broadcastEvent('orderDelivered', data);
    });
    
    this.demoGenerator.on('orderFailed', (data) => {
      this.broadcastEvent('orderFailed', data);
    });
  }
  
  /**
   * Start a specific demo scenario
   */
  async startDemoScenario(scenarioId, config = {}) {
    if (this.isRunning) {
      throw new Error('Demo is already running. Stop current demo first.');
    }
    
    const scenario = this.scenarios[scenarioId];
    if (!scenario) {
      throw new Error(`Unknown scenario: ${scenarioId}`);
    }
    
    logger.info('Starting demo scenario', { scenarioId, scenario: scenario.name });
    
    this.currentDemo = {
      ...scenario,
      ...config
    };
    this.currentStep = 0;
    this.demoStartTime = new Date();
    this.stepStartTime = new Date();
    this.isRunning = true;
    
    // Initialize WebSocket server if not already running
    if (!this.wsServer) {
      await this.initializeWebSocket();
    }
    
    // Configure simulation engine for this scenario
    const simulationConfig = {
      timeAcceleration: this.currentDemo.timeAcceleration || 1,
      ordersPerMinute: this.currentDemo.ordersPerMinute,
      scenarioFocus: this.currentDemo.focus
    };
    
    // Start simulation engine
    await this.simulationEngine.startSimulation(simulationConfig);
    
    // Start demo generator
    this.demoGenerator.start(
      this.currentDemo.ordersPerMinute, 
      this.currentDemo.duration
    );
    
    // Start scenario progression
    this.startScenarioProgression();
    
    // Broadcast demo started
    this.broadcastEvent('demoStarted', {
      scenario: this.currentDemo,
      startTime: this.demoStartTime.toISOString()
    });
    
    this.emit('demoStarted', { scenarioId, scenario: this.currentDemo });
    
    return {
      success: true,
      scenario: this.currentDemo,
      message: `Started ${scenario.name}`
    };
  }
  
  /**
   * Stop current demo
   */
  async stopDemo() {
    if (!this.isRunning) {
      return { success: true, message: 'No demo is running' };
    }
    
    logger.info('Stopping demo scenario', { 
      scenarioId: this.currentDemo?.id,
      step: this.currentStep 
    });
    
    this.isRunning = false;
    
    // Stop simulation engine
    await this.simulationEngine.stopSimulation();
    
    // Stop demo generator
    this.demoGenerator.stop();
    
    // Clear progression timer
    if (this.progressionTimer) {
      clearTimeout(this.progressionTimer);
      this.progressionTimer = null;
    }
    
    // Calculate demo duration
    const endTime = new Date();
    const demoResult = {
      scenario: this.currentDemo,
      startTime: this.demoStartTime?.toISOString(),
      endTime: endTime.toISOString(),
      duration: this.demoStartTime ? endTime.getTime() - this.demoStartTime.getTime() : 0,
      stepsCompleted: this.currentStep,
      totalSteps: this.currentDemo?.steps?.length || 0,
      finalMetrics: this.demoMetrics
    };
    
    // Broadcast demo stopped
    this.broadcastEvent('demoStopped', demoResult);
    
    this.emit('demoStopped', demoResult);
    
    // Reset state
    this.currentDemo = null;
    this.currentStep = 0;
    this.demoStartTime = null;
    this.stepStartTime = null;
    this.demoMetrics = {
      ordersGenerated: 0,
      agentDecisions: 0,
      optimizationRuns: 0,
      emergencyEscalations: 0
    };
    
    return {
      success: true,
      message: 'Demo stopped successfully',
      result: demoResult
    };
  }
  
  /**
   * Control demo playback (pause/resume/speed)
   */
  async controlDemo(action, params = {}) {
    if (!this.isRunning) {
      throw new Error('No demo is running');
    }
    
    switch (action) {
      case 'pause':
        await this.pauseDemo();
        break;
        
      case 'resume':
        await this.resumeDemo();
        break;
        
      case 'speed':
        await this.adjustSpeed(params.multiplier || 1);
        break;
        
      case 'step':
        await this.goToStep(params.step || 0);
        break;
        
      default:
        throw new Error(`Unknown control action: ${action}`);
    }
    
    return {
      success: true,
      action,
      params,
      currentState: this.getDemoStatus()
    };
  }
  
  /**
   * Get current demo status
   */
  getDemoStatus() {
    if (!this.isRunning) {
      return {
        isRunning: false,
        availableScenarios: Object.keys(this.scenarios)
      };
    }
    
    const currentTime = new Date();
    const currentStep = this.currentDemo.steps[this.currentStep];
    
    return {
      isRunning: true,
      scenario: {
        id: this.currentDemo.id,
        name: this.currentDemo.name,
        description: this.currentDemo.description
      },
      progress: {
        currentStep: this.currentStep,
        totalSteps: this.currentDemo.steps.length,
        stepProgress: this.calculateStepProgress(),
        overallProgress: (this.currentStep / this.currentDemo.steps.length) * 100
      },
      currentStepData: currentStep,
      timing: {
        demoStartTime: this.demoStartTime?.toISOString(),
        stepStartTime: this.stepStartTime?.toISOString(),
        demoRuntime: this.demoStartTime ? currentTime.getTime() - this.demoStartTime.getTime() : 0,
        stepRuntime: this.stepStartTime ? currentTime.getTime() - this.stepStartTime.getTime() : 0
      },
      metrics: {
        demo: this.demoMetrics,
        simulation: this.simulationEngine.getStatus()?.metrics || {},
        realTime: this.simulationEngine.performanceMetrics?.realTime || {}
      },
      connectedClients: this.wsServer?.clients?.size || 0
    };
  }
  
  /**
   * Get available scenarios
   */
  getAvailableScenarios() {
    return Object.values(this.scenarios).map(scenario => ({
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      duration: scenario.duration,
      focus: scenario.focus,
      steps: scenario.steps.map(step => ({
        id: step.id,
        title: step.title,
        duration: step.duration,
        highlights: step.highlights
      }))
    }));
  }
  
  /**
   * Get live demo data for analytics
   */
  getLiveDemoData() {
    if (!this.isRunning) {
      return { error: 'No demo is running' };
    }
    
    return {
      scenario: this.currentDemo,
      status: this.getDemoStatus(),
      liveMetrics: {
        orders: this.demoMetrics,
        simulation: this.simulationEngine.getDetailedMetrics(),
        agents: this.getAgentPerformanceData(),
        traffic: this.getTrafficConditionsData(),
        fleet: this.getFleetStatusData()
      },
      recentEvents: this.getRecentEvents()
    };
  }
  
  // Private methods
  
  async initializeWebSocket() {
    this.wsServer = new DemoWebSocketServer(8082); // Different port to avoid conflicts
    await this.wsServer.start();
    
    // Subscribe to WebSocket events
    this.wsServer.on('clientConnected', (client) => {
      // Send current demo state to new client
      if (this.isRunning) {
        client.send(JSON.stringify({
          type: 'demoState',
          data: this.getDemoStatus()
        }));
      }
    });
  }
  
  startScenarioProgression() {
    if (!this.currentDemo || this.currentStep >= this.currentDemo.steps.length) {
      return;
    }
    
    const currentStepData = this.currentDemo.steps[this.currentStep];
    const stepDuration = currentStepData.duration * 1000; // Convert to milliseconds
    
    logger.info('Starting demo step', {
      step: this.currentStep + 1,
      title: currentStepData.title,
      duration: currentStepData.duration
    });
    
    // Broadcast step started
    this.broadcastEvent('stepStarted', {
      step: this.currentStep,
      stepData: currentStepData,
      startTime: this.stepStartTime.toISOString()
    });
    
    // Configure step-specific behaviors
    this.configureStepBehaviors(currentStepData);
    
    // Schedule next step
    this.progressionTimer = setTimeout(() => {
      this.progressToNextStep();
    }, stepDuration);
  }
  
  progressToNextStep() {
    if (!this.isRunning || !this.currentDemo) {
      return;
    }
    
    // Complete current step
    this.broadcastEvent('stepCompleted', {
      step: this.currentStep,
      completedAt: new Date().toISOString()
    });
    
    this.currentStep++;
    this.stepStartTime = new Date();
    
    if (this.currentStep >= this.currentDemo.steps.length) {
      // Demo completed
      this.stopDemo();
    } else {
      // Continue to next step
      this.startScenarioProgression();
    }
  }
  
  configureStepBehaviors(stepData) {
    // Configure simulation engine based on step highlights
    const stepConfig = {};
    
    if (stepData.highlights.includes('high-demand')) {
      stepConfig.ordersPerMinute = this.currentDemo.ordersPerMinute * 1.5;
    }
    
    if (stepData.highlights.includes('emergency-scenario')) {
      stepConfig.emergencyFrequency = 0.1; // 10% of orders become emergencies
    }
    
    if (stepData.highlights.includes('traffic-incidents')) {
      stepConfig.trafficVariability = 0.8; // High traffic variation
    }
    
    // Apply configuration to simulation engine
    if (Object.keys(stepConfig).length > 0) {
      this.simulationEngine.config = { ...this.simulationEngine.config, ...stepConfig };
    }
  }
  
  calculateStepProgress() {
    if (!this.stepStartTime || !this.currentDemo || this.currentStep >= this.currentDemo.steps.length) {
      return 0;
    }
    
    const currentStepData = this.currentDemo.steps[this.currentStep];
    const stepDuration = currentStepData.duration * 1000; // milliseconds
    const elapsed = new Date().getTime() - this.stepStartTime.getTime();
    
    return Math.min(100, (elapsed / stepDuration) * 100);
  }
  
  handleAgentResponse(response) {
    this.demoMetrics.agentDecisions++;
    
    // Generate realistic agent activities based on scenario
    this.broadcastEvent('agentActivity', {
      agent: response.agentId,
      activity: response.trigger,
      confidence: response.confidence,
      successful: response.successful,
      metrics: this.demoMetrics
    });
  }
  
  handleTrafficUpdate(data) {
    this.broadcastEvent('trafficUpdate', {
      zone: data.zone,
      conditions: data.conditions,
      timestamp: new Date().toISOString()
    });
  }
  
  handleMetricsUpdate(metrics) {
    this.broadcastEvent('metricsUpdate', {
      metrics,
      demoMetrics: this.demoMetrics,
      timestamp: new Date().toISOString()
    });
  }
  
  broadcastEvent(eventType, data) {
    if (this.wsServer) {
      this.wsServer.broadcast({
        type: eventType,
        data,
        timestamp: new Date().toISOString()
      });
    }
    
    this.emit(eventType, data);
  }
  
  async pauseDemo() {
    // Implementation for pausing demo
    logger.info('Pausing demo');
    this.broadcastEvent('demoPaused', { timestamp: new Date().toISOString() });
  }
  
  async resumeDemo() {
    // Implementation for resuming demo
    logger.info('Resuming demo');
    this.broadcastEvent('demoResumed', { timestamp: new Date().toISOString() });
  }
  
  async adjustSpeed(multiplier) {
    this.simulationEngine.config.timeAcceleration = multiplier;
    logger.info('Adjusted demo speed', { multiplier });
    this.broadcastEvent('speedChanged', { multiplier, timestamp: new Date().toISOString() });
  }
  
  async goToStep(stepNumber) {
    if (stepNumber < 0 || stepNumber >= this.currentDemo.steps.length) {
      throw new Error('Invalid step number');
    }
    
    this.currentStep = stepNumber;
    this.stepStartTime = new Date();
    
    if (this.progressionTimer) {
      clearTimeout(this.progressionTimer);
    }
    
    this.startScenarioProgression();
    
    logger.info('Jumped to step', { step: stepNumber });
    this.broadcastEvent('stepChanged', { 
      step: stepNumber, 
      timestamp: new Date().toISOString() 
    });
  }
  
  getAgentPerformanceData() {
    return Array.from(this.simulationEngine.activeAgents.values()).map(agent => ({
      id: agent.id,
      totalDecisions: agent.totalDecisions,
      successfulDecisions: agent.successfulDecisions,
      accuracy: agent.totalDecisions > 0 ? agent.successfulDecisions / agent.totalDecisions : 1,
      currentTasks: agent.currentTasks.length,
      lastActivity: agent.lastActivity
    }));
  }
  
  getTrafficConditionsData() {
    return Object.fromEntries(
      Array.from(this.simulationEngine.trafficConditions.entries()).map(([zone, conditions]) => [
        zone,
        {
          congestionLevel: conditions.congestionLevel,
          currentSpeed: conditions.currentSpeed,
          incidents: conditions.incidents.map(incident => ({
            type: incident.type,
            severity: incident.severity,
            timestamp: incident.timestamp
          }))
        }
      ])
    );
  }
  
  getFleetStatusData() {
    const vehicles = Array.from(this.simulationEngine.vehicles.values());
    
    return {
      total: vehicles.length,
      byStatus: vehicles.reduce((acc, vehicle) => {
        acc[vehicle.status] = (acc[vehicle.status] || 0) + 1;
        return acc;
      }, {}),
      utilization: vehicles.filter(v => v.status === 'busy').length / vehicles.length,
      avgBatteryLevel: vehicles.reduce((sum, v) => sum + v.batteryLevel, 0) / vehicles.length,
      avgFuelLevel: vehicles.reduce((sum, v) => sum + v.fuelLevel, 0) / vehicles.length
    };
  }
  
  getRecentEvents() {
    // Return recent events from the last 5 minutes
    return []; // Placeholder - would be implemented with actual event storage
  }
  
  /**
   * Initialize the orchestrator
   */
  async initialize() {
    logger.info('Initializing Enhanced Demo Orchestrator');
    
    // Initialize demo database service
    await demoDatabaseService.initialize();
    
    logger.info('Enhanced Demo Orchestrator initialized');
    return true;
  }
  
  /**
   * Shutdown the orchestrator
   */
  async shutdown() {
    logger.info('Shutting down Enhanced Demo Orchestrator');
    
    // Stop any running demo
    if (this.isRunning) {
      await this.stopDemo();
    }
    
    // Stop WebSocket server
    if (this.wsServer) {
      await this.wsServer.stop();
    }
    
    logger.info('Enhanced Demo Orchestrator shutdown complete');
  }
}

module.exports = EnhancedDemoOrchestrator;