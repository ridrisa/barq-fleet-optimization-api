/**
 * Unit Tests for SLA Monitor Agent
 */

const SLAMonitorAgent = require('../../../src/agents/sla-monitor.agent');

describe('SLA Monitor Agent', () => {
  let agent;

  beforeEach(() => {
    agent = new SLAMonitorAgent();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with correct SLA thresholds', () => {
      expect(agent.slaThresholds.BARQ.target).toBe(60);
      expect(agent.slaThresholds.BARQ.warning).toBe(40);
      expect(agent.slaThresholds.BARQ.critical).toBe(50);
      expect(agent.slaThresholds.BARQ.breach).toBe(60);

      expect(agent.slaThresholds.BULLET.target).toBe(240);
      expect(agent.slaThresholds.BULLET.warning).toBe(150);
      expect(agent.slaThresholds.BULLET.critical).toBe(210);
      expect(agent.slaThresholds.BULLET.breach).toBe(240);
    });

    test('should initialize empty breach history', () => {
      expect(agent.breachHistory).toEqual([]);
    });

    test('should initialize active monitoring map', () => {
      expect(agent.activeMonitoring).toBeInstanceOf(Map);
    });
  });

  describe('checkSLA()', () => {
    test('should return normal status for order on track', async () => {
      const request = {
        order: {
          id: 'order-1',
          serviceType: 'BARQ',
          createdAt: new Date(Date.now() - 10 * 60000).toISOString(), // 10 minutes ago
          sla: 60
        },
        currentTime: new Date().toISOString()
      };

      const result = await agent.checkSLA(request);

      expect(result.atRisk).toBe(false);
      expect(result.level).toBe('normal');
      expect(result.remainingMinutes).toBeGreaterThan(40);
    });

    test('should return warning for order approaching SLA', async () => {
      const request = {
        order: {
          id: 'order-2',
          serviceType: 'BARQ',
          createdAt: new Date(Date.now() - 45 * 60000).toISOString(), // 45 minutes ago
          sla: 60
        },
        currentTime: new Date().toISOString()
      };

      const result = await agent.checkSLA(request);

      expect(result.atRisk).toBe(true);
      expect(result.level).toBe('warning');
      expect(result.remainingMinutes).toBeLessThan(20);
    });

    test('should return critical for order near SLA breach', async () => {
      const request = {
        order: {
          id: 'order-3',
          serviceType: 'BARQ',
          createdAt: new Date(Date.now() - 55 * 60000).toISOString(), // 55 minutes ago
          sla: 60
        },
        currentTime: new Date().toISOString()
      };

      const result = await agent.checkSLA(request);

      expect(result.atRisk).toBe(true);
      expect(result.level).toBe('critical');
      expect(result.remainingMinutes).toBeLessThan(10);
    });

    test('should return breach for order past SLA', async () => {
      const request = {
        order: {
          id: 'order-4',
          serviceType: 'BARQ',
          createdAt: new Date(Date.now() - 65 * 60000).toISOString(), // 65 minutes ago
          sla: 60
        },
        currentTime: new Date().toISOString()
      };

      const result = await agent.checkSLA(request);

      expect(result.atRisk).toBe(true);
      expect(result.level).toBe('breach');
      expect(result.remainingMinutes).toBeLessThan(0);
    });

    test('should handle BULLET service type correctly', async () => {
      const request = {
        order: {
          id: 'order-5',
          serviceType: 'BULLET',
          createdAt: new Date(Date.now() - 120 * 60000).toISOString(), // 120 minutes ago
          sla: 240
        },
        currentTime: new Date().toISOString()
      };

      const result = await agent.checkSLA(request);

      expect(result.slaLimit).toBe(240);
      expect(result.remainingMinutes).toBeGreaterThan(100);
      expect(result.level).toBe('normal');
    });
  });

  describe('generateAlert()', () => {
    test('should generate warning alert', () => {
      const order = {
        id: 'order-1',
        serviceType: 'BARQ',
        assignedDriver: 'driver-1'
      };
      const slaStatus = {
        category: 'warning',
        risk: 'high',
        elapsedMinutes: 42,
        remainingMinutes: 18,
        actionRequired: true
      };

      const alert = agent.generateAlert(order, slaStatus);

      expect(alert.orderId).toBe('order-1');
      expect(alert.severity).toBe('medium');
      expect(alert.type).toBe('SLA_WARNING');
      expect(alert.message).toContain('WARNING');
      expect(alert.requiresAction).toBe(true);
    });

    test('should generate critical alert', () => {
      const order = {
        id: 'order-2',
        serviceType: 'BARQ',
        assignedDriver: 'driver-1'
      };
      const slaStatus = {
        category: 'critical',
        risk: 'critical',
        elapsedMinutes: 52,
        remainingMinutes: 8,
        actionRequired: true
      };

      const alert = agent.generateAlert(order, slaStatus);

      expect(alert.severity).toBe('high');
      expect(alert.type).toBe('SLA_CRITICAL');
      expect(alert.message).toContain('CRITICAL');
      expect(alert.customerNotification).toBe(true);
    });

    test('should generate breach alert', () => {
      const order = {
        id: 'order-3',
        serviceType: 'BARQ',
        assignedDriver: 'driver-1'
      };
      const slaStatus = {
        category: 'breached',
        risk: 'breached',
        elapsedMinutes: 65,
        remainingMinutes: -5,
        actionRequired: true
      };

      const alert = agent.generateAlert(order, slaStatus);

      expect(alert.severity).toBe('critical');
      expect(alert.type).toBe('SLA_BREACH');
      expect(alert.message).toContain('BREACHED');
      expect(alert.customerNotification).toBe(true);
    });
  });

  describe('generateCorrectiveActions()', () => {
    test('should generate compensation actions for breached orders', async () => {
      const order = {
        id: 'order-1',
        serviceType: 'BARQ',
        assignedDriver: 'driver-1'
      };
      const slaStatus = {
        category: 'breached',
        risk: 'breached',
        canMeetSLA: false
      };

      const actions = await agent.generateCorrectiveActions(order, slaStatus);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some(a => a.type === 'customer_compensation')).toBe(true);
      expect(actions.some(a => a.type === 'customer_notification')).toBe(true);
      expect(actions.some(a => a.type === 'incident_report')).toBe(true);
    });

    test('should generate emergency reassignment for critical orders that cannot meet SLA', async () => {
      const order = {
        id: 'order-2',
        serviceType: 'BARQ',
        assignedDriver: 'driver-1'
      };
      const slaStatus = {
        category: 'critical',
        risk: 'critical',
        canMeetSLA: false
      };

      const actions = await agent.generateCorrectiveActions(order, slaStatus);

      expect(actions.some(a => a.type === 'emergency_reassignment')).toBe(true);
      expect(actions.some(a => a.priority === 'critical')).toBe(true);
    });

    test('should generate expedite delivery for critical orders that can meet SLA', async () => {
      const order = {
        id: 'order-3',
        serviceType: 'BARQ',
        assignedDriver: 'driver-1'
      };
      const slaStatus = {
        category: 'critical',
        risk: 'critical',
        canMeetSLA: true
      };

      const actions = await agent.generateCorrectiveActions(order, slaStatus);

      expect(actions.some(a => a.type === 'expedite_delivery')).toBe(true);
      expect(actions.some(a => a.type === 'supervisor_alert')).toBe(true);
    });

    test('should generate preventive actions for warning orders', async () => {
      const order = {
        id: 'order-4',
        serviceType: 'BARQ',
        assignedDriver: 'driver-1'
      };
      const slaStatus = {
        category: 'warning',
        risk: 'high'
      };

      const actions = await agent.generateCorrectiveActions(order, slaStatus);

      expect(actions.some(a => a.type === 'optimize_route')).toBe(true);
      expect(actions.some(a => a.type === 'proactive_communication')).toBe(true);
    });

    test('should not generate proactive communication for BULLET warnings', async () => {
      const order = {
        id: 'order-5',
        serviceType: 'BULLET',
        assignedDriver: 'driver-1'
      };
      const slaStatus = {
        category: 'warning',
        risk: 'high'
      };

      const actions = await agent.generateCorrectiveActions(order, slaStatus);

      expect(actions.some(a => a.type === 'proactive_communication')).toBe(false);
    });
  });

  describe('recordBreach()', () => {
    test('should record breach in history', () => {
      const order = {
        id: 'order-1',
        serviceType: 'BARQ',
        assignedDriver: 'driver-1'
      };
      const slaStatus = {
        elapsedMinutes: 65
      };

      agent.recordBreach(order, slaStatus);

      expect(agent.breachHistory.length).toBe(1);
      expect(agent.breachHistory[0].orderId).toBe('order-1');
      expect(agent.breachHistory[0].serviceType).toBe('BARQ');
      expect(agent.breachHistory[0].exceedMinutes).toBe(5);
    });

    test('should limit breach history to 100 entries', () => {
      const order = {
        id: 'order-test',
        serviceType: 'BARQ',
        assignedDriver: 'driver-1'
      };
      const slaStatus = {
        elapsedMinutes: 65
      };

      // Add 105 breaches
      for (let i = 0; i < 105; i++) {
        agent.recordBreach({ ...order, id: `order-${i}` }, slaStatus);
      }

      expect(agent.breachHistory.length).toBe(100);
    });
  });

  describe('getBreachStats()', () => {
    beforeEach(() => {
      // Add some test breaches
      const now = Date.now();
      agent.breachHistory = [
        { timestamp: now - 1000, serviceType: 'BARQ' },
        { timestamp: now - 2000, serviceType: 'BARQ' },
        { timestamp: now - 90000000, serviceType: 'BULLET' }, // Over 24h ago
        { timestamp: now - 3000, serviceType: 'BULLET' }
      ];
    });

    test('should calculate total breaches', () => {
      const stats = agent.getBreachStats();

      expect(stats.total).toBe(4);
    });

    test('should calculate breaches in last 24 hours', () => {
      const stats = agent.getBreachStats();

      expect(stats.last24Hours).toBe(3);
    });

    test('should categorize by service type', () => {
      const stats = agent.getBreachStats();

      expect(stats.byServiceType.BARQ).toBe(2);
      expect(stats.byServiceType.BULLET).toBe(2);
    });
  });

  describe('predictDeliveryTime()', () => {
    test('should predict time for pending order', async () => {
      const order = {
        id: 'order-1',
        serviceType: 'BARQ',
        createdAt: new Date().toISOString()
      };
      const progress = { status: 'pending' };

      const predictedMinutes = await agent.predictDeliveryTime(order, progress);

      expect(predictedMinutes).toBeGreaterThan(15); // At least travel + pickup + delivery
    });

    test('should predict time for assigned order', async () => {
      const order = {
        id: 'order-2',
        serviceType: 'BARQ',
        createdAt: new Date().toISOString()
      };
      const progress = {
        status: 'assigned',
        minutesToPickup: 5,
        minutesToDelivery: 10
      };

      const predictedMinutes = await agent.predictDeliveryTime(order, progress);

      expect(predictedMinutes).toBeGreaterThan(15); // Pickup + delivery
    });

    test('should predict time for order in pickup', async () => {
      const order = {
        id: 'order-3',
        serviceType: 'BARQ',
        createdAt: new Date(Date.now() - 5 * 60000).toISOString() // 5 min ago
      };
      const progress = {
        status: 'pickup_in_progress',
        minutesToDelivery: 15
      };

      const predictedMinutes = await agent.predictDeliveryTime(order, progress);

      expect(predictedMinutes).toBeGreaterThan(15); // Remaining pickup + delivery
    });

    test('should predict time for order in delivery', async () => {
      const order = {
        id: 'order-4',
        serviceType: 'BARQ',
        createdAt: new Date(Date.now() - 15 * 60000).toISOString() // 15 min ago
      };
      const progress = {
        status: 'delivery_in_progress',
        minutesToDelivery: 10
      };

      const predictedMinutes = await agent.predictDeliveryTime(order, progress);

      expect(predictedMinutes).toBeGreaterThanOrEqual(20); // Elapsed + remaining
    });

    test('should use different times for BARQ vs BULLET', async () => {
      const barqOrder = {
        id: 'barq-order',
        serviceType: 'BARQ',
        createdAt: new Date().toISOString()
      };
      const bulletOrder = {
        id: 'bullet-order',
        serviceType: 'BULLET',
        createdAt: new Date().toISOString()
      };
      const progress = { status: 'pending' };

      const barqTime = await agent.predictDeliveryTime(barqOrder, progress);
      const bulletTime = await agent.predictDeliveryTime(bulletOrder, progress);

      expect(bulletTime).toBeGreaterThan(barqTime); // BULLET takes longer
    });
  });

  describe('mapRiskToSeverity()', () => {
    test('should map risk levels correctly', () => {
      expect(agent.mapRiskToSeverity('breached')).toBe('critical');
      expect(agent.mapRiskToSeverity('critical')).toBe('high');
      expect(agent.mapRiskToSeverity('high')).toBe('medium');
      expect(agent.mapRiskToSeverity('medium')).toBe('low');
      expect(agent.mapRiskToSeverity('low')).toBe('info');
      expect(agent.mapRiskToSeverity('unknown')).toBe('info');
    });
  });

  describe('getAlertType()', () => {
    test('should return correct alert types', () => {
      expect(agent.getAlertType({ category: 'breached' })).toBe('SLA_BREACH');
      expect(agent.getAlertType({ category: 'critical' })).toBe('SLA_CRITICAL');
      expect(agent.getAlertType({ category: 'warning' })).toBe('SLA_WARNING');
      expect(agent.getAlertType({ category: 'healthy' })).toBe('SLA_INFO');
    });
  });

  describe('getAtRiskOrders()', () => {
    test('should return at-risk and critical orders', async () => {
      const result = await agent.getAtRiskOrders();

      expect(result).toHaveProperty('atRisk');
      expect(result).toHaveProperty('critical');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('timestamp');
      expect(Array.isArray(result.atRisk)).toBe(true);
      expect(Array.isArray(result.critical)).toBe(true);
    });

    test('should handle errors gracefully', async () => {
      // Mock getActiveOrders to throw error
      jest.spyOn(agent, 'getActiveOrders').mockRejectedValue(new Error('DB error'));

      const result = await agent.getAtRiskOrders();

      expect(result.atRisk).toEqual([]);
      expect(result.critical).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('isHealthy()', () => {
    test('should return healthy when recently checked', () => {
      agent.lastCheck = Date.now();

      const health = agent.isHealthy();

      expect(health.healthy).toBe(true);
      expect(health.message).toContain('healthy');
    });

    test('should return unhealthy when not checked recently', () => {
      agent.lastCheck = Date.now() - 60000; // 1 minute ago

      const health = agent.isHealthy();

      expect(health.healthy).toBe(false);
      expect(health.message).toContain('not checked');
    });
  });

  describe('predictSLACompliance()', () => {
    test('should predict breaches in next 15 and 30 minutes', async () => {
      const monitoring = {
        orders: {
          warning: [
            { orderId: 'order-1', remainingMinutes: 10 },
            { orderId: 'order-2', remainingMinutes: 25 }
          ],
          critical: [
            { orderId: 'order-3', remainingMinutes: 5 }
          ]
        },
        metrics: {
          barqActive: 15
        }
      };

      const predictions = await agent.predictSLACompliance(monitoring);

      expect(predictions).toHaveProperty('next15Minutes');
      expect(predictions).toHaveProperty('next30Minutes');
      expect(predictions).toHaveProperty('recommendations');
      expect(predictions.next15Minutes.expectedBreaches).toBeGreaterThan(0);
    });

    test('should generate urgent recommendations for immediate risk', async () => {
      const monitoring = {
        orders: {
          warning: [{ orderId: 'order-1', remainingMinutes: 5 }],
          critical: [{ orderId: 'order-2', remainingMinutes: 3 }]
        },
        metrics: {
          barqActive: 10
        }
      };

      const predictions = await agent.predictSLACompliance(monitoring);

      expect(predictions.recommendations.length).toBeGreaterThan(0);
      const urgentRec = predictions.recommendations.find(r => r.type === 'urgent');
      expect(urgentRec).toBeDefined();
    });

    test('should generate capacity recommendations for high volume', async () => {
      const monitoring = {
        orders: {
          warning: [],
          critical: []
        },
        metrics: {
          barqActive: 25 // High volume
        }
      };

      const predictions = await agent.predictSLACompliance(monitoring);

      const capacityRec = predictions.recommendations.find(r => r.type === 'capacity');
      expect(capacityRec).toBeDefined();
      expect(capacityRec.message).toContain('BARQ');
    });
  });
});
