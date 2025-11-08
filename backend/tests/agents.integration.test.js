/**
 * Integration Tests for All Agents
 * Comprehensive test suite to ensure all agents work together seamlessly
 */

const assert = require('assert');
const sinon = require('sinon');

// Import all agents
const MasterOrchestratorAgent = require('../src/agents/master-orchestrator.agent');
const FleetStatusAgent = require('../src/agents/fleet-status.agent');
const SLAMonitorAgent = require('../src/agents/sla-monitor.agent');
const OrderAssignmentAgent = require('../src/agents/order-assignment.agent');
const RouteOptimizationAgent = require('../src/agents/route-optimization.agent');
const BatchOptimizationAgent = require('../src/agents/batch-optimization.agent');
const DemandForecastingAgent = require('../src/agents/demand-forecasting.agent');
const EmergencyEscalationAgent = require('../src/agents/emergency-escalation.agent');
const FleetRebalancerAgent = require('../src/agents/fleet-rebalancer.agent');
const GeoIntelligenceAgent = require('../src/agents/geo-intelligence.agent');
const OrderRecoveryAgent = require('../src/agents/order-recovery.agent');
const CustomerCommunicationAgent = require('../src/agents/customer-communication.agent');
const TrafficPatternAgent = require('../src/agents/traffic-pattern.agent');
const PerformanceAnalyticsAgent = require('../src/agents/performance-analytics.agent');

// Import services
const AgentManagerService = require('../src/services/agent-manager.service');
const EnhancedLogisticsService = require('../src/services/enhanced-logistics.service');

// Mock LLM Manager
class MockLLMManager {
  async generateResponse(prompt, context) {
    return { success: true, response: 'Mock LLM response' };
  }

  getConfig(agentName) {
    return { model: 'mock', temperature: 0.7 };
  }
}

describe('Agent Integration Tests', () => {
  let agents = {};
  let llmManager;
  let agentManager;
  let logisticsService;

  before(() => {
    // Initialize mock LLM manager
    llmManager = new MockLLMManager();

    // Initialize all agents
    agents.masterOrchestrator = new MasterOrchestratorAgent({}, llmManager);
    agents.fleetStatus = new FleetStatusAgent({}, llmManager);
    agents.slaMonitor = new SLAMonitorAgent({}, llmManager);
    agents.orderAssignment = new OrderAssignmentAgent({}, llmManager);
    agents.routeOptimization = new RouteOptimizationAgent({}, llmManager);
    agents.batchOptimization = new BatchOptimizationAgent({}, llmManager);
    agents.demandForecasting = new DemandForecastingAgent({}, llmManager);
    agents.emergencyEscalation = new EmergencyEscalationAgent({}, llmManager);
    agents.fleetRebalancer = new FleetRebalancerAgent({}, llmManager);
    agents.geoIntelligence = new GeoIntelligenceAgent({}, llmManager);
    agents.orderRecovery = new OrderRecoveryAgent({}, llmManager);
    agents.customerCommunication = new CustomerCommunicationAgent({}, llmManager);
    agents.trafficPattern = new TrafficPatternAgent({}, llmManager);
    agents.performanceAnalytics = new PerformanceAnalyticsAgent({}, llmManager);

    // Initialize services
    agentManager = new AgentManagerService(llmManager);
    logisticsService = new EnhancedLogisticsService();
  });

  describe('Individual Agent Health Checks', () => {
    it('should verify all agents are healthy', () => {
      for (const [name, agent] of Object.entries(agents)) {
        const health = agent.isHealthy();
        assert.strictEqual(health.healthy, true, `${name} should be healthy`);
        assert.ok(health.name, `${name} should have a name`);
      }
    });
  });

  describe('Master Orchestrator Integration', () => {
    it('should orchestrate new order event successfully', async () => {
      const event = {
        type: 'NEW_ORDER',
        data: {
          orderId: 'test_order_001',
          serviceType: 'BARQ',
          pickup: { lat: 24.7136, lng: 46.6753 },
          delivery: { lat: 24.7236, lng: 46.6853 },
          customerId: 'customer_001'
        }
      };

      const result = await agents.masterOrchestrator.orchestrate(event);

      assert.strictEqual(result.success, true);
      assert.ok(result.executionPlan);
      assert.ok(result.results);
      assert.ok(result.summary);
    });

    it('should handle SLA breach event with proper escalation', async () => {
      const event = {
        type: 'SLA_BREACH',
        data: {
          orderId: 'test_order_002',
          serviceType: 'BARQ',
          currentDelay: 15,
          estimatedDelay: 25
        }
      };

      const result = await agents.masterOrchestrator.orchestrate(event);

      assert.strictEqual(result.success, true);
      assert.ok(result.executionPlan.agents.includes('emergency-escalation'));
    });
  });

  describe('Fleet Management Integration', () => {
    it('should coordinate fleet status and rebalancing', async () => {
      const context = {
        timestamp: new Date(),
        activeOrders: [
          { id: 'order_1', serviceType: 'BARQ', status: 'pending' },
          { id: 'order_2', serviceType: 'BULLET', status: 'in_transit' }
        ]
      };

      // Get fleet status
      const fleetStatus = await agents.fleetStatus.execute(context);
      assert.strictEqual(fleetStatus.success, true);
      assert.ok(fleetStatus.fleet);

      // Use fleet status for rebalancing
      context.fleetStatus = fleetStatus.fleet;
      const rebalanceResult = await agents.fleetRebalancer.execute(context);

      assert.strictEqual(rebalanceResult.success, true);
      assert.ok(rebalanceResult.coverageAnalysis);
      assert.ok(rebalanceResult.repositioningPlan);
    });
  });

  describe('Order Assignment Flow', () => {
    it('should assign BARQ orders with priority', async () => {
      const context = {
        order: {
          id: 'barq_order_001',
          serviceType: 'BARQ',
          pickup: { lat: 24.7136, lng: 46.6753 },
          delivery: { lat: 24.7186, lng: 46.6803 },
          createdAt: new Date()
        },
        availableDrivers: [
          {
            id: 'driver_1',
            location: { lat: 24.7140, lng: 46.6760 },
            serviceType: 'BARQ',
            status: 'available',
            activeOrders: 0
          },
          {
            id: 'driver_2',
            location: { lat: 24.7200, lng: 46.6850 },
            serviceType: 'BARQ',
            status: 'available',
            activeOrders: 1
          }
        ]
      };

      const assignment = await agents.orderAssignment.execute(context);

      assert.strictEqual(assignment.success, true);
      assert.ok(assignment.assignment);
      assert.strictEqual(assignment.assignment.driverId, 'driver_1'); // Closer driver
      assert.ok(assignment.assignment.estimatedDeliveryTime);
    });

    it('should batch BULLET orders efficiently', async () => {
      const orders = [
        {
          id: 'bullet_1',
          serviceType: 'BULLET',
          pickup: { lat: 24.7136, lng: 46.6753 },
          delivery: { lat: 24.7236, lng: 46.6853 }
        },
        {
          id: 'bullet_2',
          serviceType: 'BULLET',
          pickup: { lat: 24.7140, lng: 46.6755 },
          delivery: { lat: 24.7240, lng: 46.6855 }
        },
        {
          id: 'bullet_3',
          serviceType: 'BULLET',
          pickup: { lat: 24.7138, lng: 46.6754 },
          delivery: { lat: 24.7238, lng: 46.6854 }
        }
      ];

      const context = { orders, serviceType: 'BULLET' };
      const batches = await agents.batchOptimization.execute(context);

      assert.strictEqual(batches.success, true);
      assert.ok(batches.batches.length > 0);
      assert.ok(batches.batches[0].orders.length > 1); // Orders should be batched
    });
  });

  describe('Route Optimization Integration', () => {
    it('should optimize routes considering traffic patterns', async () => {
      const context = {
        orders: [
          {
            id: 'opt_order_1',
            pickup: { lat: 24.7136, lng: 46.6753 },
            delivery: { lat: 24.7236, lng: 46.6853 },
            serviceType: 'BARQ'
          }
        ],
        driver: {
          id: 'driver_1',
          currentLocation: { lat: 24.7100, lng: 46.6700 }
        }
      };

      // Get traffic patterns
      const trafficResult = await agents.trafficPattern.execute(context);
      assert.strictEqual(trafficResult.success, true);

      // Optimize route with traffic data
      context.trafficData = trafficResult.currentTraffic;
      const routeResult = await agents.routeOptimization.execute(context);

      assert.strictEqual(routeResult.success, true);
      assert.ok(routeResult.optimizedRoutes);
      assert.ok(routeResult.optimizedRoutes[0].route);
    });
  });

  describe('Demand Forecasting and Geo Intelligence', () => {
    it('should forecast demand and identify hotspots', async () => {
      const context = {
        historicalOrders: generateMockHistoricalOrders(100),
        currentTime: new Date()
      };

      // Forecast demand
      const forecastResult = await agents.demandForecasting.execute(context);
      assert.strictEqual(forecastResult.success, true);
      assert.ok(forecastResult.predictions);

      // Use forecast for geo intelligence
      context.demandForecast = forecastResult.predictions;
      const geoResult = await agents.geoIntelligence.execute(context);

      assert.strictEqual(geoResult.success, true);
      assert.ok(geoResult.hotspots);
      assert.ok(geoResult.zones);
      assert.ok(geoResult.recommendations);
    });
  });

  describe('SLA Monitoring and Recovery', () => {
    it('should monitor SLA and trigger recovery for at-risk orders', async () => {
      const context = {
        orders: [
          {
            id: 'sla_risk_order',
            serviceType: 'BARQ',
            createdAt: new Date(Date.now() - 50 * 60000), // 50 minutes old
            status: 'in_transit',
            estimatedDeliveryTime: new Date(Date.now() + 5 * 60000) // 5 minutes left
          }
        ]
      };

      // Monitor SLA
      const slaResult = await agents.slaMonitor.execute(context);
      assert.strictEqual(slaResult.success, true);
      assert.ok(slaResult.breachRisk.length > 0);

      // Trigger recovery for at-risk orders
      context.problematicOrders = slaResult.breachRisk;
      const recoveryResult = await agents.orderRecovery.execute(context);

      assert.strictEqual(recoveryResult.success, true);
      assert.ok(recoveryResult.recoveryStrategies);
      assert.ok(recoveryResult.recoveryResults);
    });
  });

  describe('Customer Communication Flow', () => {
    it('should send appropriate notifications at each stage', async () => {
      const context = {
        activeOrders: [
          {
            id: 'comm_order_1',
            customerId: 'customer_1',
            status: 'confirmed',
            statusChanged: true,
            statusNotified: false,
            serviceType: 'BARQ'
          },
          {
            id: 'comm_order_2',
            customerId: 'customer_2',
            status: 'in_transit',
            driverDistance: 0.5, // Within 1km
            proximityNotified: false,
            serviceType: 'BULLET'
          }
        ]
      };

      const commResult = await agents.customerCommunication.execute(context);

      assert.strictEqual(commResult.success, true);
      assert.ok(commResult.communicationNeeds);
      assert.ok(commResult.messagesSent >= 0);
    });
  });

  describe('Emergency Escalation Scenarios', () => {
    it('should handle multiple emergency levels appropriately', async () => {
      const emergencies = [
        {
          type: 'SLA_CRITICAL',
          level: 'L2',
          orderId: 'emergency_order_1',
          context: { delayMinutes: 30 }
        },
        {
          type: 'DRIVER_EMERGENCY',
          level: 'L3',
          driverId: 'driver_emergency_1',
          context: { reason: 'vehicle_breakdown' }
        }
      ];

      for (const emergency of emergencies) {
        const result = await agents.emergencyEscalation.execute({ emergency });

        assert.strictEqual(result.success, true);
        assert.ok(result.escalation);
        assert.ok(result.actions);
        assert.strictEqual(result.escalation.level, emergency.level);
      }
    });
  });

  describe('Performance Analytics', () => {
    it('should calculate KPIs and generate insights', async () => {
      const context = {
        activeOrders: generateMockOrders(50),
        systemStartTime: Date.now() - 24 * 60 * 60 * 1000 // 24 hours ago
      };

      const analyticsResult = await agents.performanceAnalytics.execute(context);

      assert.strictEqual(analyticsResult.success, true);
      assert.ok(analyticsResult.kpis);
      assert.ok(analyticsResult.performanceScore);
      assert.ok(analyticsResult.insights);
      assert.ok(analyticsResult.report);

      // Verify KPIs are calculated
      assert.ok(analyticsResult.kpis.SLA_COMPLIANCE);
      assert.ok(analyticsResult.kpis.DRIVER_UTILIZATION);
      assert.ok(analyticsResult.kpis.CUSTOMER_SATISFACTION);
    });
  });

  describe('End-to-End Order Flow', () => {
    it('should process BARQ order from creation to delivery', async () => {
      const orderId = 'e2e_barq_order';
      const results = {};

      // Step 1: New order event
      const newOrderEvent = {
        type: 'NEW_ORDER',
        data: {
          orderId,
          serviceType: 'BARQ',
          pickup: { lat: 24.7136, lng: 46.6753 },
          delivery: { lat: 24.7186, lng: 46.6803 },
          customerId: 'e2e_customer'
        }
      };

      results.orchestration = await agents.masterOrchestrator.orchestrate(newOrderEvent);
      assert.strictEqual(results.orchestration.success, true);

      // Step 2: Fleet status check
      results.fleetStatus = await agents.fleetStatus.execute({ orders: [newOrderEvent.data] });
      assert.strictEqual(results.fleetStatus.success, true);

      // Step 3: Order assignment
      const assignmentContext = {
        order: newOrderEvent.data,
        availableDrivers: results.fleetStatus.fleet.drivers.filter(d => d.available)
      };
      results.assignment = await agents.orderAssignment.execute(assignmentContext);
      assert.strictEqual(results.assignment.success, true);

      // Step 4: Route optimization
      const routeContext = {
        orders: [newOrderEvent.data],
        driver: { id: results.assignment.assignment.driverId }
      };
      results.route = await agents.routeOptimization.execute(routeContext);
      assert.strictEqual(results.route.success, true);

      // Step 5: Customer notification
      const commContext = {
        activeOrders: [{
          ...newOrderEvent.data,
          status: 'driver_assigned',
          statusChanged: true,
          driverName: 'Test Driver',
          driverPhone: '+1234567890'
        }]
      };
      results.communication = await agents.customerCommunication.execute(commContext);
      assert.strictEqual(results.communication.success, true);

      // Verify complete flow
      assert.ok(results.assignment.assignment.driverId);
      assert.ok(results.route.optimizedRoutes.length > 0);
    });

    it('should handle BULLET batch order processing', async () => {
      const bulletOrders = [
        {
          id: 'e2e_bullet_1',
          serviceType: 'BULLET',
          pickup: { lat: 24.7136, lng: 46.6753 },
          delivery: { lat: 24.7236, lng: 46.6853 }
        },
        {
          id: 'e2e_bullet_2',
          serviceType: 'BULLET',
          pickup: { lat: 24.7140, lng: 46.6755 },
          delivery: { lat: 24.7240, lng: 46.6855 }
        }
      ];

      // Step 1: Batch optimization
      const batchResult = await agents.batchOptimization.execute({
        orders: bulletOrders,
        serviceType: 'BULLET'
      });
      assert.strictEqual(batchResult.success, true);
      assert.ok(batchResult.batches.length > 0);

      // Step 2: Route optimization for batch
      const batch = batchResult.batches[0];
      const routeResult = await agents.routeOptimization.execute({
        orders: batch.orders,
        algorithm: 'genetic'
      });
      assert.strictEqual(routeResult.success, true);

      // Verify batching efficiency
      assert.ok(batch.efficiency > 0.5);
    });
  });

  describe('Service Integration', () => {
    it('should process order through Enhanced Logistics Service', async () => {
      const requestId = 'service_test_001';
      const request = {
        requestId,
        serviceType: 'BARQ',
        pickupPoints: [{ lat: 24.7136, lng: 46.6753, name: 'Pickup 1' }],
        deliveryPoints: [{
          lat: 24.7236,
          lng: 46.6853,
          customer_name: 'Test Customer',
          time_window: `${new Date().toISOString()}-${new Date(Date.now() + 3600000).toISOString()}`
        }],
        constraints: { maxDeliveryTime: 60 },
        preferences: { deliverySpeed: 'express' }
      };

      const result = await logisticsService.processOptimizationRequest(
        requestId,
        request
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.serviceType, 'BARQ');
      assert.ok(result.data);
    });

    it('should handle concurrent operations through Agent Manager', async () => {
      const orders = [
        {
          id: 'concurrent_1',
          serviceType: 'BARQ',
          pickup: { lat: 24.7136, lng: 46.6753 },
          delivery: { lat: 24.7236, lng: 46.6853 }
        },
        {
          id: 'concurrent_2',
          serviceType: 'BULLET',
          pickup: { lat: 24.7140, lng: 46.6755 },
          delivery: { lat: 24.7240, lng: 46.6855 }
        }
      ];

      const promises = orders.map(order =>
        agentManager.handleNewOrder(order)
      );

      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        assert.ok(result.success !== false, `Order ${orders[index].id} should process`);
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle agent failures gracefully', async () => {
      // Simulate agent failure
      const failingContext = {
        simulateFailure: true,
        orders: null // Invalid data
      };

      const result = await agents.orderAssignment.execute(failingContext);

      // Should handle error gracefully
      assert.ok(result);
      if (!result.success) {
        assert.ok(result.error);
      }
    });

    it('should fallback to legacy system when needed', async () => {
      const request = {
        serviceType: 'STANDARD', // Should use legacy system
        pickupPoints: [{ lat: 24.7136, lng: 46.6753 }],
        deliveryPoints: [{ lat: 24.7236, lng: 46.6853 }]
      };

      const result = await logisticsService.processOptimizationRequest(
        'legacy_test',
        request
      );

      assert.strictEqual(result.serviceType, 'STANDARD');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high volume of concurrent orders', async function() {
      this.timeout(10000); // Increase timeout for performance test

      const orderCount = 100;
      const orders = generateMockOrders(orderCount);

      const startTime = Date.now();

      // Process multiple orders concurrently
      const promises = orders.slice(0, 10).map(order =>
        agents.orderAssignment.execute({
          order,
          availableDrivers: generateMockDrivers(20)
        })
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All should complete within reasonable time
      assert.ok(duration < 5000, `Should process 10 orders in under 5 seconds, took ${duration}ms`);

      results.forEach(result => {
        assert.strictEqual(result.success, true);
      });
    });

    it('should maintain performance with large datasets', async function() {
      this.timeout(5000);

      const context = {
        historicalOrders: generateMockHistoricalOrders(1000),
        currentTime: new Date()
      };

      const startTime = Date.now();
      const result = await agents.demandForecasting.execute(context);
      const duration = Date.now() - startTime;

      assert.strictEqual(result.success, true);
      assert.ok(duration < 3000, `Should process 1000 historical orders in under 3 seconds, took ${duration}ms`);
    });
  });
});

// Helper functions
function generateMockOrders(count) {
  const orders = [];
  for (let i = 0; i < count; i++) {
    orders.push({
      id: `order_${i}`,
      serviceType: Math.random() > 0.3 ? 'BULLET' : 'BARQ',
      pickup: {
        lat: 24.7 + Math.random() * 0.1,
        lng: 46.6 + Math.random() * 0.1
      },
      delivery: {
        lat: 24.7 + Math.random() * 0.1,
        lng: 46.6 + Math.random() * 0.1
      },
      status: ['pending', 'assigned', 'in_transit', 'completed'][Math.floor(Math.random() * 4)],
      createdAt: new Date(Date.now() - Math.random() * 3600000)
    });
  }
  return orders;
}

function generateMockHistoricalOrders(count) {
  const orders = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const createdAt = new Date(now - Math.random() * 7 * 24 * 60 * 60 * 1000); // Past week
    const serviceType = Math.random() > 0.3 ? 'BULLET' : 'BARQ';
    const deliveryTime = serviceType === 'BARQ' ? 45 + Math.random() * 30 : 120 + Math.random() * 120;

    orders.push({
      id: `historical_${i}`,
      serviceType,
      location: {
        lat: 24.7 + Math.random() * 0.1,
        lng: 46.6 + Math.random() * 0.1
      },
      createdAt,
      completedAt: new Date(createdAt.getTime() + deliveryTime * 60000),
      deliveryTime
    });
  }

  return orders;
}

function generateMockDrivers(count) {
  const drivers = [];
  for (let i = 0; i < count; i++) {
    drivers.push({
      id: `driver_${i}`,
      location: {
        lat: 24.7 + Math.random() * 0.1,
        lng: 46.6 + Math.random() * 0.1
      },
      serviceType: Math.random() > 0.5 ? 'BARQ' : 'BULLET',
      status: 'available',
      activeOrders: Math.floor(Math.random() * 3),
      rating: 3.5 + Math.random() * 1.5
    });
  }
  return drivers;
}