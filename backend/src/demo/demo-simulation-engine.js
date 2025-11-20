/**
 * Demo Simulation Engine - Advanced Simulation with Realistic Patterns
 * Enhanced simulation engine with realistic traffic patterns, agent behaviors, and performance metrics
 */

const EventEmitter = require('events');
const { logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class DemoSimulationEngine extends EventEmitter {
  constructor() {
    super();
    
    // Core simulation state
    this.isRunning = false;
    this.scenarios = new Map();
    this.activeAgents = new Map();
    this.vehicles = new Map();
    this.trafficConditions = new Map();
    this.performanceMetrics = {
      realTime: {},
      hourly: {},
      daily: {}
    };
    
    // Simulation parameters
    this.config = {
      timeAcceleration: 1, // 1x = real time, 10x = 10 minutes in 1 minute
      trafficVariability: 0.3, // How much traffic varies (0-1)
      agentResponseTime: {
        min: 500,
        max: 3000
      },
      slaBreachThreshold: 0.05, // 5% of orders can breach SLA
      emergencyFrequency: 0.02 // 2% of orders become emergencies
    };
    
    // Riyadh traffic zones with realistic patterns
    this.trafficZones = {
      'olaya': {
        name: 'Olaya Business District',
        baseSpeed: 25, // km/h
        peakHours: [7, 8, 9, 17, 18, 19],
        speedMultipliers: {
          peak: 0.6,
          normal: 1.0,
          night: 1.3
        },
        congestionPoints: [
          { lat: 24.6995, lng: 46.6837, radius: 0.5 },
          { lat: 24.7012, lng: 46.6845, radius: 0.3 }
        ]
      },
      'king-fahd': {
        name: 'King Fahd Road',
        baseSpeed: 60,
        peakHours: [7, 8, 17, 18, 19],
        speedMultipliers: {
          peak: 0.7,
          normal: 1.0,
          night: 1.2
        },
        congestionPoints: [
          { lat: 24.75, lng: 46.725, radius: 1.0 }
        ]
      },
      'al-malaz': {
        name: 'Al Malaz',
        baseSpeed: 40,
        peakHours: [8, 9, 17, 18],
        speedMultipliers: {
          peak: 0.8,
          normal: 1.0,
          night: 1.1
        },
        congestionPoints: []
      }
    };
    
    // Agent behavioral patterns
    this.agentBehaviors = {
      'demand-forecasting': {
        responseTime: { min: 2000, max: 5000 },
        accuracy: 0.89,
        confidence: 0.92,
        triggers: ['high-demand-detected', 'pattern-anomaly']
      },
      'route-optimization': {
        responseTime: { min: 1500, max: 4000 },
        accuracy: 0.94,
        confidence: 0.96,
        triggers: ['batch-ready', 'traffic-update', 'vehicle-available']
      },
      'sla-monitor': {
        responseTime: { min: 500, max: 1500 },
        accuracy: 0.98,
        confidence: 0.99,
        triggers: ['sla-risk-detected', 'order-delayed']
      },
      'emergency-escalation': {
        responseTime: { min: 200, max: 800 },
        accuracy: 0.95,
        confidence: 0.97,
        triggers: ['customer-complaint', 'driver-emergency', 'system-failure']
      },
      'fleet-rebalancer': {
        responseTime: { min: 3000, max: 8000 },
        accuracy: 0.87,
        confidence: 0.90,
        triggers: ['demand-imbalance', 'zone-shortage']
      }
    };
    
    // Initialize simulation intervals
    this.intervals = {
      traffic: null,
      agents: null,
      vehicles: null,
      metrics: null
    };
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Handle various simulation events
    this.on('orderCreated', (order) => {
      this.simulateAgentResponse('order-assignment', order);
      this.updateMetrics('ordersCreated', 1);
    });
    
    this.on('trafficUpdate', (zone, conditions) => {
      this.broadcastTrafficUpdate(zone, conditions);
    });
    
    this.on('slaRisk', (order) => {
      this.triggerSLAMonitoring(order);
    });
    
    this.on('emergencyDetected', (emergency) => {
      this.triggerEmergencyEscalation(emergency);
    });
  }
  
  /**
   * Start the comprehensive simulation
   */
  async startSimulation(config = {}) {
    if (this.isRunning) {
      throw new Error('Simulation is already running');
    }
    
    this.config = { ...this.config, ...config };
    this.isRunning = true;
    
    logger.info('Starting comprehensive demo simulation', {
      timeAcceleration: this.config.timeAcceleration,
      trafficZones: Object.keys(this.trafficZones).length,
      agentTypes: Object.keys(this.agentBehaviors).length
    });
    
    // Initialize traffic conditions
    this.initializeTrafficConditions();
    
    // Initialize AI agents
    this.initializeAgents();
    
    // Initialize vehicle fleet
    this.initializeVehicleFleet();
    
    // Start simulation loops
    this.startTrafficSimulation();
    this.startAgentSimulation();
    this.startVehicleSimulation();
    this.startMetricsCollection();
    
    this.emit('simulationStarted', {
      timestamp: new Date().toISOString(),
      config: this.config
    });
  }
  
  /**
   * Stop the simulation
   */
  async stopSimulation() {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    // Clear all intervals
    Object.values(this.intervals).forEach(interval => {
      if (interval) clearInterval(interval);
    });
    
    // Reset intervals
    this.intervals = {
      traffic: null,
      agents: null,
      vehicles: null,
      metrics: null
    };
    
    logger.info('Stopped comprehensive demo simulation');
    
    this.emit('simulationStopped', {
      timestamp: new Date().toISOString(),
      finalMetrics: this.performanceMetrics.realTime
    });
  }
  
  /**
   * Initialize traffic conditions for all zones
   */
  initializeTrafficConditions() {
    Object.entries(this.trafficZones).forEach(([zoneId, zone]) => {
      this.trafficConditions.set(zoneId, {
        currentSpeed: zone.baseSpeed,
        congestionLevel: 0.1, // 10% base congestion
        incidents: [],
        lastUpdated: new Date().toISOString()
      });
    });
    
    logger.info('Initialized traffic conditions for all zones');
  }
  
  /**
   * Initialize AI agents with behavioral patterns
   */
  initializeAgents() {
    Object.entries(this.agentBehaviors).forEach(([agentId, behavior]) => {
      this.activeAgents.set(agentId, {
        id: agentId,
        status: 'active',
        currentTasks: [],
        responseTime: behavior.responseTime,
        accuracy: behavior.accuracy,
        confidence: behavior.confidence,
        triggers: behavior.triggers,
        lastActivity: new Date().toISOString(),
        totalDecisions: 0,
        successfulDecisions: 0
      });
    });
    
    logger.info(`Initialized ${this.activeAgents.size} AI agents`);
  }
  
  /**
   * Initialize vehicle fleet with realistic distribution
   */
  initializeVehicleFleet() {
    const fleetSize = 150;
    const vehicleTypes = [
      { type: 'motorcycle', count: 60, capacity: 1, avgSpeed: 45 },
      { type: 'car', count: 70, capacity: 3, avgSpeed: 40 },
      { type: 'van', count: 20, capacity: 8, avgSpeed: 35 }
    ];
    
    vehicleTypes.forEach(vehicleType => {
      for (let i = 0; i < vehicleType.count; i++) {
        const vehicleId = `${vehicleType.type}-${uuidv4().substr(0, 8)}`;
        
        // Random starting position in Riyadh
        const zone = Object.values(this.trafficZones)[Math.floor(Math.random() * 3)];
        const location = this.generateRandomLocationInZone(zone);
        
        this.vehicles.set(vehicleId, {
          id: vehicleId,
          type: vehicleType.type,
          capacity: vehicleType.capacity,
          currentCapacity: 0,
          avgSpeed: vehicleType.avgSpeed,
          status: 'available', // available, busy, offline, maintenance
          location: location,
          destination: null,
          currentOrders: [],
          driverId: `driver-${uuidv4().substr(0, 8)}`,
          batteryLevel: 80 + Math.random() * 20, // 80-100%
          fuelLevel: 60 + Math.random() * 40, // 60-100%
          lastMaintenance: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000 // Random within 30 days
        });
      }
    });
    
    logger.info(`Initialized fleet of ${this.vehicles.size} vehicles`);
  }
  
  /**
   * Start traffic simulation with realistic patterns
   */
  startTrafficSimulation() {
    this.intervals.traffic = setInterval(() => {
      const currentHour = new Date().getHours();
      
      Object.entries(this.trafficZones).forEach(([zoneId, zone]) => {
        const conditions = this.trafficConditions.get(zoneId);
        
        // Determine current traffic multiplier based on time
        let speedMultiplier;
        if (zone.peakHours.includes(currentHour)) {
          speedMultiplier = zone.speedMultipliers.peak;
        } else if (currentHour >= 22 || currentHour <= 6) {
          speedMultiplier = zone.speedMultipliers.night;
        } else {
          speedMultiplier = zone.speedMultipliers.normal;
        }
        
        // Add random traffic variation
        const variation = (Math.random() - 0.5) * this.config.trafficVariability;
        speedMultiplier += variation;
        speedMultiplier = Math.max(0.3, Math.min(1.5, speedMultiplier));
        
        // Update traffic conditions
        conditions.currentSpeed = zone.baseSpeed * speedMultiplier;
        conditions.congestionLevel = 1 - speedMultiplier;
        conditions.lastUpdated = new Date().toISOString();
        
        // Randomly generate traffic incidents
        if (Math.random() < 0.01) { // 1% chance per update
          this.generateTrafficIncident(zoneId, zone);
        }
        
        // Clean up old incidents
        conditions.incidents = conditions.incidents.filter(
          incident => Date.now() - new Date(incident.timestamp).getTime() < 600000 // 10 minutes
        );
        
        this.emit('trafficUpdate', zoneId, conditions);
      });
      
    }, 10000 / this.config.timeAcceleration); // Every 10 seconds in real time
  }
  
  /**
   * Start AI agent simulation with realistic response patterns
   */
  startAgentSimulation() {
    this.intervals.agents = setInterval(() => {
      this.activeAgents.forEach((agent, agentId) => {
        // Simulate agent processing current tasks
        if (agent.currentTasks.length > 0) {
          this.processAgentTasks(agent);
        }
        
        // Randomly trigger agent activities based on their triggers
        agent.triggers.forEach(trigger => {
          if (this.shouldTriggerAgent(trigger, agent)) {
            this.triggerAgentActivity(agent, trigger);
          }
        });
        
        // Update agent metrics
        this.updateAgentMetrics(agent);
      });
      
    }, 2000 / this.config.timeAcceleration); // Every 2 seconds in real time
  }
  
  /**
   * Start vehicle simulation with realistic movement and status updates
   */
  startVehicleSimulation() {
    this.intervals.vehicles = setInterval(() => {
      this.vehicles.forEach((vehicle, vehicleId) => {
        // Update vehicle position if moving
        if (vehicle.status === 'busy' && vehicle.destination) {
          this.updateVehiclePosition(vehicle);
        }
        
        // Simulate random status changes
        this.simulateVehicleStatusChanges(vehicle);
        
        // Update vehicle metrics (fuel, battery, etc.)
        this.updateVehicleMetrics(vehicle);
      });
      
    }, 5000 / this.config.timeAcceleration); // Every 5 seconds in real time
  }
  
  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    this.intervals.metrics = setInterval(() => {
      this.collectRealtimeMetrics();
    }, 1000); // Every second for real-time metrics
  }
  
  /**
   * Simulate agent response to various triggers
   */
  simulateAgentResponse(trigger, data) {
    // Find relevant agents for this trigger
    const relevantAgents = Array.from(this.activeAgents.values())
      .filter(agent => agent.triggers.includes(trigger));
    
    relevantAgents.forEach(agent => {
      const responseDelay = this.calculateAgentResponseTime(agent);
      
      setTimeout(() => {
        this.processAgentResponse(agent, trigger, data);
      }, responseDelay);
    });
  }
  
  /**
   * Process agent response with realistic outcomes
   */
  processAgentResponse(agent, trigger, data) {
    agent.totalDecisions++;
    
    // Simulate decision accuracy
    const isSuccessful = Math.random() < agent.accuracy;
    if (isSuccessful) {
      agent.successfulDecisions++;
    }
    
    // Create agent decision response
    const response = {
      agentId: agent.id,
      trigger,
      data,
      decision: this.generateAgentDecision(agent, trigger, data),
      confidence: agent.confidence + (Math.random() - 0.5) * 0.1,
      processingTime: this.calculateAgentResponseTime(agent),
      successful: isSuccessful,
      timestamp: new Date().toISOString()
    };
    
    agent.lastActivity = response.timestamp;
    
    this.emit('agentResponse', response);
    
    logger.debug(`Agent ${agent.id} responded to ${trigger}`, {
      confidence: response.confidence,
      successful: isSuccessful
    });
  }
  
  /**
   * Generate realistic agent decisions based on trigger type
   */
  generateAgentDecision(agent, trigger, data) {
    const decisions = {
      'order-assignment': {
        action: 'assign_driver',
        driverId: `driver-${uuidv4().substr(0, 8)}`,
        estimatedTime: 15 + Math.random() * 30,
        priority: data.serviceType === 'BARQ' ? 'high' : 'normal'
      },
      'high-demand-detected': {
        action: 'increase_fleet_allocation',
        zone: this.getRandomZone(),
        additionalVehicles: Math.floor(Math.random() * 5) + 1,
        duration: Math.floor(Math.random() * 120) + 30
      },
      'sla-risk-detected': {
        action: 'escalate_priority',
        newPriority: 'urgent',
        alternativeRoute: true,
        notifyCustomer: true
      },
      'traffic-update': {
        action: 'reroute_vehicles',
        affectedVehicles: Math.floor(Math.random() * 10) + 1,
        estimatedDelay: Math.floor(Math.random() * 15) + 5
      },
      'customer-complaint': {
        action: 'emergency_response',
        responseTeam: 'customer_service',
        escalationLevel: Math.random() > 0.7 ? 'high' : 'medium'
      }
    };
    
    return decisions[trigger] || {
      action: 'monitor',
      details: 'Continuing to monitor situation'
    };
  }
  
  /**
   * Generate traffic incidents
   */
  generateTrafficIncident(zoneId, zone) {
    const incidentTypes = [
      { type: 'accident', severity: 0.8, duration: 1800000 }, // 30 minutes
      { type: 'road_work', severity: 0.6, duration: 3600000 }, // 1 hour
      { type: 'heavy_rain', severity: 0.4, duration: 900000 }, // 15 minutes
      { type: 'protest', severity: 0.9, duration: 7200000 } // 2 hours
    ];
    
    const incident = incidentTypes[Math.floor(Math.random() * incidentTypes.length)];
    const conditions = this.trafficConditions.get(zoneId);
    
    const newIncident = {
      id: uuidv4(),
      type: incident.type,
      severity: incident.severity,
      location: this.generateRandomLocationInZone(zone),
      timestamp: new Date().toISOString(),
      estimatedDuration: incident.duration,
      description: this.generateIncidentDescription(incident.type)
    };
    
    conditions.incidents.push(newIncident);
    
    logger.info(`Traffic incident generated in ${zone.name}`, {
      type: incident.type,
      severity: incident.severity
    });
    
    this.emit('trafficIncident', {
      zoneId,
      incident: newIncident
    });
  }
  
  /**
   * Update vehicle position towards destination
   */
  updateVehiclePosition(vehicle) {
    if (!vehicle.destination) return;
    
    const currentLoc = vehicle.location;
    const destLoc = vehicle.destination;
    
    // Calculate movement based on vehicle speed and traffic conditions
    const distance = this.calculateDistance(currentLoc, destLoc);
    const zoneId = this.getZoneForLocation(currentLoc);
    const trafficConditions = this.trafficConditions.get(zoneId);
    
    // Adjust speed based on traffic
    let effectiveSpeed = vehicle.avgSpeed;
    if (trafficConditions) {
      effectiveSpeed *= (trafficConditions.currentSpeed / this.trafficZones[zoneId].baseSpeed);
    }
    
    // Move towards destination
    const moveDistance = (effectiveSpeed / 3600) * (5 / this.config.timeAcceleration); // km in 5 seconds
    
    if (distance <= moveDistance) {
      // Arrived at destination
      vehicle.location = destLoc;
      vehicle.destination = null;
      this.handleVehicleArrival(vehicle);
    } else {
      // Move towards destination
      const ratio = moveDistance / distance;
      vehicle.location = {
        lat: currentLoc.lat + (destLoc.lat - currentLoc.lat) * ratio,
        lng: currentLoc.lng + (destLoc.lng - currentLoc.lng) * ratio
      };
    }
  }
  
  /**
   * Collect real-time metrics
   */
  collectRealtimeMetrics() {
    const now = new Date();
    
    // Vehicle metrics
    const availableVehicles = Array.from(this.vehicles.values())
      .filter(v => v.status === 'available').length;
    const busyVehicles = Array.from(this.vehicles.values())
      .filter(v => v.status === 'busy').length;
    
    // Agent metrics
    const activeAgentCount = Array.from(this.activeAgents.values())
      .filter(a => a.status === 'active').length;
    
    // Traffic metrics
    const avgCongestion = Array.from(this.trafficConditions.values())
      .reduce((sum, c) => sum + c.congestionLevel, 0) / this.trafficConditions.size;
    
    // Performance metrics
    const totalAgentDecisions = Array.from(this.activeAgents.values())
      .reduce((sum, a) => sum + a.totalDecisions, 0);
    const successfulDecisions = Array.from(this.activeAgents.values())
      .reduce((sum, a) => sum + a.successfulDecisions, 0);
    
    this.performanceMetrics.realTime = {
      timestamp: now.toISOString(),
      vehicles: {
        total: this.vehicles.size,
        available: availableVehicles,
        busy: busyVehicles,
        utilization: busyVehicles / this.vehicles.size
      },
      agents: {
        active: activeAgentCount,
        totalDecisions,
        successfulDecisions,
        accuracy: totalAgentDecisions > 0 ? successfulDecisions / totalAgentDecisions : 1
      },
      traffic: {
        avgCongestion,
        totalIncidents: Array.from(this.trafficConditions.values())
          .reduce((sum, c) => sum + c.incidents.length, 0)
      },
      orders: this.performanceMetrics.orders || {
        total: 0,
        pending: 0,
        assigned: 0,
        delivered: 0,
        failed: 0
      }
    };
    
    this.emit('metricsUpdate', this.performanceMetrics.realTime);
  }
  
  // Helper methods
  calculateAgentResponseTime(agent) {
    const { min, max } = agent.responseTime;
    return min + Math.random() * (max - min);
  }
  
  shouldTriggerAgent(trigger, agent) {
    // Define trigger probabilities
    const triggerProbabilities = {
      'high-demand-detected': 0.001, // 0.1% per check
      'pattern-anomaly': 0.0005, // 0.05% per check
      'batch-ready': 0.005, // 0.5% per check
      'traffic-update': 0.002, // 0.2% per check
      'vehicle-available': 0.003, // 0.3% per check
      'sla-risk-detected': 0.001, // 0.1% per check
      'order-delayed': 0.0015, // 0.15% per check
      'customer-complaint': 0.0003, // 0.03% per check
      'driver-emergency': 0.0001, // 0.01% per check
      'system-failure': 0.00005, // 0.005% per check
      'demand-imbalance': 0.0008, // 0.08% per check
      'zone-shortage': 0.0006 // 0.06% per check
    };
    
    return Math.random() < (triggerProbabilities[trigger] || 0);
  }
  
  triggerAgentActivity(agent, trigger) {
    const task = {
      id: uuidv4(),
      trigger,
      startTime: new Date().toISOString(),
      status: 'processing'
    };
    
    agent.currentTasks.push(task);
    
    // Simulate task completion
    const processingTime = this.calculateAgentResponseTime(agent);
    setTimeout(() => {
      this.completeAgentTask(agent, task);
    }, processingTime);
  }
  
  completeAgentTask(agent, task) {
    task.status = 'completed';
    task.endTime = new Date().toISOString();
    task.duration = new Date(task.endTime).getTime() - new Date(task.startTime).getTime();
    
    // Remove completed task
    agent.currentTasks = agent.currentTasks.filter(t => t.id !== task.id);
    
    this.emit('agentTaskCompleted', { agent: agent.id, task });
  }
  
  generateRandomLocationInZone(zone) {
    const angle = Math.random() * 2 * Math.PI;
    const radius = Math.random() * 2 / 111; // 2km radius in degrees
    
    return {
      lat: zone.lat + radius * Math.cos(angle),
      lng: zone.lng + radius * Math.sin(angle)
    };
  }
  
  calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  getZoneForLocation(location) {
    // Simple zone detection - in real implementation this would be more sophisticated
    const zones = Object.keys(this.trafficZones);
    return zones[Math.floor(Math.random() * zones.length)];
  }
  
  getRandomZone() {
    const zones = Object.keys(this.trafficZones);
    return zones[Math.floor(Math.random() * zones.length)];
  }
  
  generateIncidentDescription(type) {
    const descriptions = {
      accident: 'Multi-vehicle accident blocking two lanes',
      road_work: 'Emergency road repairs in progress',
      heavy_rain: 'Heavy rainfall causing reduced visibility',
      protest: 'Peaceful demonstration affecting traffic flow'
    };
    
    return descriptions[type] || 'Traffic disruption reported';
  }
  
  handleVehicleArrival(vehicle) {
    // Simulate order completion or pickup
    if (vehicle.currentOrders.length > 0) {
      const order = vehicle.currentOrders[0];
      
      if (order.status === 'assigned') {
        // Arrived at pickup
        order.status = 'picked_up';
        vehicle.destination = order.dropoff;
      } else if (order.status === 'picked_up') {
        // Arrived at dropoff
        order.status = 'delivered';
        vehicle.currentOrders = vehicle.currentOrders.slice(1);
        vehicle.currentCapacity--;
        
        if (vehicle.currentOrders.length === 0) {
          vehicle.status = 'available';
        }
      }
    }
  }
  
  simulateVehicleStatusChanges(vehicle) {
    // Randomly simulate maintenance needs, fuel/battery depletion, etc.
    if (Math.random() < 0.0001) { // 0.01% chance per update
      if (vehicle.fuelLevel < 20 || vehicle.batteryLevel < 20) {
        vehicle.status = 'maintenance';
        setTimeout(() => {
          vehicle.status = 'available';
          vehicle.fuelLevel = 100;
          vehicle.batteryLevel = 100;
        }, 300000 / this.config.timeAcceleration); // 5 minutes in simulation time
      }
    }
  }
  
  updateVehicleMetrics(vehicle) {
    // Slowly deplete fuel/battery based on usage
    if (vehicle.status === 'busy') {
      vehicle.fuelLevel = Math.max(0, vehicle.fuelLevel - 0.01);
      vehicle.batteryLevel = Math.max(0, vehicle.batteryLevel - 0.01);
    }
  }
  
  updateAgentMetrics(agent) {
    // Update agent performance metrics
    agent.lastActivity = new Date().toISOString();
  }
  
  updateMetrics(metric, value) {
    if (!this.performanceMetrics.orders) {
      this.performanceMetrics.orders = {
        total: 0,
        pending: 0,
        assigned: 0,
        delivered: 0,
        failed: 0
      };
    }
    
    if (this.performanceMetrics.orders[metric] !== undefined) {
      this.performanceMetrics.orders[metric] += value;
    }
  }
  
  triggerSLAMonitoring(order) {
    this.simulateAgentResponse('sla-risk-detected', order);
  }
  
  triggerEmergencyEscalation(emergency) {
    this.simulateAgentResponse('customer-complaint', emergency);
  }
  
  broadcastTrafficUpdate(zone, conditions) {
    this.emit('trafficBroadcast', {
      zone,
      conditions,
      timestamp: new Date().toISOString()
    });
  }
  
  processAgentTasks(agent) {
    // Process any pending tasks
    agent.currentTasks.forEach(task => {
      if (task.status === 'processing') {
        // Task is still processing, check if it should complete
        const elapsed = Date.now() - new Date(task.startTime).getTime();
        const expectedDuration = this.calculateAgentResponseTime(agent);
        
        if (elapsed >= expectedDuration) {
          this.completeAgentTask(agent, task);
        }
      }
    });
  }
  
  /**
   * Get current simulation status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      metrics: this.performanceMetrics.realTime,
      agents: Array.from(this.activeAgents.values()).map(agent => ({
        id: agent.id,
        status: agent.status,
        totalDecisions: agent.totalDecisions,
        accuracy: agent.successfulDecisions / Math.max(agent.totalDecisions, 1),
        currentTasks: agent.currentTasks.length
      })),
      vehicles: {
        total: this.vehicles.size,
        available: Array.from(this.vehicles.values()).filter(v => v.status === 'available').length,
        busy: Array.from(this.vehicles.values()).filter(v => v.status === 'busy').length,
        maintenance: Array.from(this.vehicles.values()).filter(v => v.status === 'maintenance').length
      },
      traffic: Object.fromEntries(
        Array.from(this.trafficConditions.entries()).map(([zone, conditions]) => [
          zone,
          {
            congestionLevel: conditions.congestionLevel,
            currentSpeed: conditions.currentSpeed,
            incidents: conditions.incidents.length
          }
        ])
      )
    };
  }
  
  /**
   * Get detailed metrics for analytics
   */
  getDetailedMetrics() {
    return {
      realTime: this.performanceMetrics.realTime,
      hourly: this.performanceMetrics.hourly,
      daily: this.performanceMetrics.daily,
      agents: Array.from(this.activeAgents.values()),
      vehicles: Array.from(this.vehicles.values()),
      traffic: Array.from(this.trafficConditions.entries())
    };
  }
}

module.exports = DemoSimulationEngine;