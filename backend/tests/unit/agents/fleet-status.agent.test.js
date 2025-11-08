/**
 * Unit Tests for Fleet Status Agent
 */

const FleetStatusAgent = require('../../../src/agents/fleet-status.agent');

describe('Fleet Status Agent', () => {
  let agent;

  beforeEach(() => {
    agent = new FleetStatusAgent();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with correct capacity config', () => {
      expect(agent.capacityConfig).toBeDefined();
      expect(agent.capacityConfig.BIKE.barq).toBe(5);
      expect(agent.capacityConfig.CAR.barq).toBe(8);
      expect(agent.capacityConfig.VAN.barq).toBe(10);
    });

    test('should initialize driver states map', () => {
      expect(agent.driverStates).toBeInstanceOf(Map);
      expect(agent.driverStates.size).toBe(0);
    });
  });

  describe('execute()', () => {
    test('should return fleet snapshot with all required fields', async () => {
      const result = await agent.execute({});

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('drivers');
      expect(result).toHaveProperty('capacity');
      expect(result).toHaveProperty('geographical');
      expect(result).toHaveProperty('serviceCapability');
      expect(result).toHaveProperty('predictions');
      expect(result.timestamp).toBeGreaterThan(0);
    });

    test('should categorize drivers by status', async () => {
      const result = await agent.execute({});

      expect(result.drivers).toHaveProperty('total');
      expect(result.drivers).toHaveProperty('available');
      expect(result.drivers).toHaveProperty('busy');
      expect(result.drivers).toHaveProperty('offline');
      expect(result.drivers).toHaveProperty('breakTime');
    });

    test('should calculate capacity metrics', async () => {
      const result = await agent.execute({});

      expect(result.capacity).toHaveProperty('barq');
      expect(result.capacity).toHaveProperty('bullet');
      expect(result.capacity.barq).toHaveProperty('available');
      expect(result.capacity.barq).toHaveProperty('utilized');
      expect(result.capacity.barq).toHaveProperty('percentage');
    });
  });

  describe('determineStatus()', () => {
    test('should return available for driver with no orders', () => {
      const driver = {
        id: 'driver-1',
        vehicleType: 'BIKE',
        lastLocationUpdate: Date.now()
      };
      const currentOrders = [];
      const workHistory = { continuousHours: 3, barqSuccessRate: 0.95 };

      const status = agent.determineStatus(driver, currentOrders, workHistory);

      expect(status).toBe('available');
    });

    test('should return busy for driver with active orders', () => {
      const driver = {
        id: 'driver-1',
        vehicleType: 'BIKE',
        lastLocationUpdate: Date.now()
      };
      const currentOrders = [{ id: 'order-1', serviceType: 'BARQ' }];
      const workHistory = { continuousHours: 3, barqSuccessRate: 0.95 };

      const status = agent.determineStatus(driver, currentOrders, workHistory);

      expect(status).toBe('busy');
    });

    test('should return offline for driver with old location update', () => {
      const driver = {
        id: 'driver-1',
        vehicleType: 'BIKE',
        lastLocationUpdate: Date.now() - 400000 // 6+ minutes ago
      };
      const currentOrders = [];
      const workHistory = { continuousHours: 3, barqSuccessRate: 0.95 };

      const status = agent.determineStatus(driver, currentOrders, workHistory);

      expect(status).toBe('offline');
    });

    test('should return break for driver on break', () => {
      const driver = {
        id: 'driver-1',
        vehicleType: 'BIKE',
        lastLocationUpdate: Date.now(),
        onBreak: true
      };
      const currentOrders = [];
      const workHistory = { continuousHours: 3, barqSuccessRate: 0.95 };

      const status = agent.determineStatus(driver, currentOrders, workHistory);

      expect(status).toBe('break');
    });

    test('should return break for driver who worked 6+ hours with no orders', () => {
      const driver = {
        id: 'driver-1',
        vehicleType: 'BIKE',
        lastLocationUpdate: Date.now()
      };
      const currentOrders = [];
      const workHistory = { continuousHours: 6.5, barqSuccessRate: 0.95 };

      const status = agent.determineStatus(driver, currentOrders, workHistory);

      expect(status).toBe('break');
    });
  });

  describe('determineSLACapability()', () => {
    test('should allow BARQ for high-performing driver with low hours', () => {
      const driver = { id: 'driver-1', vehicleType: 'BIKE' };
      const workHistory = {
        barqSuccessRate: 0.92,
        continuousHours: 4
      };
      const currentOrders = [];

      const capabilities = agent.determineSLACapability(driver, workHistory, currentOrders);

      expect(capabilities).toContain('BARQ');
      expect(capabilities).toContain('BULLET');
    });

    test('should not allow BARQ for low-performing driver', () => {
      const driver = { id: 'driver-1', vehicleType: 'BIKE' };
      const workHistory = {
        barqSuccessRate: 0.85,
        continuousHours: 3
      };
      const currentOrders = [];

      const capabilities = agent.determineSLACapability(driver, workHistory, currentOrders);

      expect(capabilities).not.toContain('BARQ');
      expect(capabilities).toContain('BULLET');
    });

    test('should not allow BARQ for fatigued driver', () => {
      const driver = { id: 'driver-1', vehicleType: 'BIKE' };
      const workHistory = {
        barqSuccessRate: 0.95,
        continuousHours: 7
      };
      const currentOrders = [];

      const capabilities = agent.determineSLACapability(driver, workHistory, currentOrders);

      expect(capabilities).not.toContain('BARQ');
      expect(capabilities).toContain('BULLET');
    });

    test('should not allow BARQ for driver with 3+ BARQ orders', () => {
      const driver = { id: 'driver-1', vehicleType: 'BIKE' };
      const workHistory = {
        barqSuccessRate: 0.95,
        continuousHours: 3
      };
      const currentOrders = [
        { serviceType: 'BARQ' },
        { serviceType: 'BARQ' },
        { serviceType: 'BARQ' }
      ];

      const capabilities = agent.determineSLACapability(driver, workHistory, currentOrders);

      expect(capabilities).not.toContain('BARQ');
      expect(capabilities).toContain('BULLET');
    });
  });

  describe('calculateFatigue()', () => {
    test('should return low fatigue for fresh driver', () => {
      const workHistory = {
        continuousHours: 2,
        ordersToday: 10,
        lastBreakTime: Date.now() - 60000 // 1 minute ago
      };

      const fatigue = agent.calculateFatigue(workHistory);

      expect(fatigue.level).toBe('low');
      expect(fatigue.score).toBeLessThan(0.4);
      expect(fatigue.needsBreak).toBe(false);
    });

    test('should return high fatigue for tired driver', () => {
      const workHistory = {
        continuousHours: 8,
        ordersToday: 50,
        lastBreakTime: Date.now() - 4 * 60 * 60000 // 4 hours ago
      };

      const fatigue = agent.calculateFatigue(workHistory);

      expect(fatigue.level).toBe('high');
      expect(fatigue.score).toBeGreaterThan(0.7);
      expect(fatigue.needsBreak).toBe(true);
    });

    test('should return medium fatigue for moderately tired driver', () => {
      const workHistory = {
        continuousHours: 4,
        ordersToday: 25,
        lastBreakTime: Date.now() - 2 * 60 * 60000 // 2 hours ago
      };

      const fatigue = agent.calculateFatigue(workHistory);

      expect(fatigue.level).toBe('medium');
      expect(fatigue.score).toBeGreaterThan(0.4);
      expect(fatigue.score).toBeLessThan(0.7);
    });

    test('should recommend break when needed', () => {
      const workHistory = {
        continuousHours: 6,
        ordersToday: 40,
        lastBreakTime: Date.now() - 3 * 60 * 60000 // 3 hours ago
      };

      const fatigue = agent.calculateFatigue(workHistory);

      expect(fatigue.recommendation).toMatch(/break/i);
    });
  });

  describe('calculateDriverScore()', () => {
    test('should return high score for excellent driver', async () => {
      const driver = { id: 'driver-1' };
      const state = {
        fatigue: { score: 0.2, level: 'low' },
        performance: { rating: 0.95 },
        battery: 100,
        ordersDeliveredToday: 20
      };

      const score = await agent.calculateDriverScore(driver, state);

      expect(score).toBeGreaterThan(0.8);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    test('should return low score for fatigued driver', async () => {
      const driver = { id: 'driver-1' };
      const state = {
        fatigue: { score: 0.9, level: 'high' },
        performance: { rating: 0.7 },
        battery: 20,
        ordersDeliveredToday: 5
      };

      const score = await agent.calculateDriverScore(driver, state);

      expect(score).toBeLessThan(0.6);
    });

    test('should weight factors correctly', async () => {
      const driver = { id: 'driver-1' };
      const state = {
        fatigue: { score: 0, level: 'low' },
        performance: { rating: 1.0 },
        battery: 100,
        ordersDeliveredToday: 20
      };

      const score = await agent.calculateDriverScore(driver, state);

      // With perfect scores, should be close to 1.0
      expect(score).toBeGreaterThan(0.95);
    });
  });

  describe('estimateNextAvailability()', () => {
    test('should return immediate for driver with no orders', () => {
      const driver = { id: 'driver-1' };
      const currentOrders = [];

      const availability = agent.estimateNextAvailability(driver, currentOrders);

      expect(availability).toBe('immediate');
    });

    test('should estimate based on BARQ orders', () => {
      const driver = { id: 'driver-1' };
      const currentOrders = [
        { serviceType: 'BARQ' },
        { serviceType: 'BARQ' }
      ];

      const availability = agent.estimateNextAvailability(driver, currentOrders);

      // Should be ISO string for 30 minutes from now (2 BARQ × 15 min)
      const estimatedTime = new Date(availability).getTime();
      const now = Date.now();
      const difference = estimatedTime - now;

      expect(difference).toBeGreaterThan(25 * 60000); // ~25 minutes
      expect(difference).toBeLessThan(35 * 60000); // ~35 minutes
    });

    test('should estimate based on BULLET orders', () => {
      const driver = { id: 'driver-1' };
      const currentOrders = [
        { serviceType: 'BULLET' },
        { serviceType: 'BULLET' }
      ];

      const availability = agent.estimateNextAvailability(driver, currentOrders);

      const estimatedTime = new Date(availability).getTime();
      const now = Date.now();
      const difference = estimatedTime - now;

      expect(difference).toBeGreaterThan(45 * 60000); // ~45 minutes
      expect(difference).toBeLessThan(55 * 60000); // ~55 minutes
    });
  });

  describe('estimateCompletionTime()', () => {
    test('should return 0 for no orders', () => {
      const currentOrders = [];
      const time = agent.estimateCompletionTime(currentOrders);

      expect(time).toBe(0);
    });

    test('should calculate time for BARQ orders', () => {
      const currentOrders = [
        { serviceType: 'BARQ' },
        { serviceType: 'BARQ' }
      ];

      const time = agent.estimateCompletionTime(currentOrders);

      expect(time).toBe(30); // 2 × 15 minutes
    });

    test('should calculate time for BULLET orders', () => {
      const currentOrders = [
        { serviceType: 'BULLET' },
        { serviceType: 'BULLET' }
      ];

      const time = agent.estimateCompletionTime(currentOrders);

      expect(time).toBe(50); // 2 × 25 minutes
    });

    test('should prioritize BARQ orders', () => {
      const currentOrders = [
        { serviceType: 'BULLET' },
        { serviceType: 'BARQ' },
        { serviceType: 'BULLET' }
      ];

      const time = agent.estimateCompletionTime(currentOrders);

      expect(time).toBe(65); // 1 BARQ (15) + 2 BULLET (50)
    });
  });

  describe('calculateDistance()', () => {
    test('should calculate distance between two coordinates', () => {
      const coord1 = { lat: 24.7136, lng: 46.6753 }; // Riyadh
      const coord2 = { lat: 24.7243, lng: 46.6881 }; // Nearby location

      const distance = agent.calculateDistance(coord1, coord2);

      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(5); // Should be less than 5km
    });

    test('should return 999 for invalid coordinates', () => {
      const coord1 = null;
      const coord2 = { lat: 24.7136, lng: 46.6753 };

      const distance = agent.calculateDistance(coord1, coord2);

      expect(distance).toBe(999);
    });

    test('should return 0 for same coordinates', () => {
      const coord1 = { lat: 24.7136, lng: 46.6753 };
      const coord2 = { lat: 24.7136, lng: 46.6753 };

      const distance = agent.calculateDistance(coord1, coord2);

      expect(distance).toBeLessThan(0.1); // Almost 0
    });
  });

  describe('getZoneForLocation()', () => {
    test('should return north for northern coordinates', () => {
      const location = { lat: 24.85, lng: 46.72 };
      const zone = agent.getZoneForLocation(location);

      expect(zone).toBe('north');
    });

    test('should return south for southern coordinates', () => {
      const location = { lat: 24.60, lng: 46.72 };
      const zone = agent.getZoneForLocation(location);

      expect(zone).toBe('south');
    });

    test('should return east for eastern coordinates', () => {
      const location = { lat: 24.71, lng: 46.80 };
      const zone = agent.getZoneForLocation(location);

      expect(zone).toBe('east');
    });

    test('should return west for western coordinates', () => {
      const location = { lat: 24.71, lng: 46.60 };
      const zone = agent.getZoneForLocation(location);

      expect(zone).toBe('west');
    });

    test('should return central for central coordinates', () => {
      const location = { lat: 24.71, lng: 46.67 };
      const zone = agent.getZoneForLocation(location);

      expect(zone).toBe('central');
    });

    test('should return central for invalid location', () => {
      const location = null;
      const zone = agent.getZoneForLocation(location);

      expect(zone).toBe('central');
    });
  });

  describe('registerDriver()', () => {
    test('should register new driver successfully', async () => {
      const driverData = {
        id: 'driver-test-1',
        name: 'Test Driver',
        location: { lat: 24.7136, lng: 46.6753 },
        vehicleType: 'CAR',
        capacity: 10
      };

      const result = await agent.registerDriver(driverData);

      expect(result.success).toBe(true);
      expect(result.driverId).toBe('driver-test-1');
      expect(agent.driverStates.has('driver-test-1')).toBe(true);
    });

    test('should handle registration errors gracefully', async () => {
      const invalidData = null;

      await expect(agent.registerDriver(invalidData)).rejects.toThrow();
    });
  });

  describe('updateDriverLocation()', () => {
    beforeEach(async () => {
      // Register a driver first
      await agent.registerDriver({
        id: 'driver-location-test',
        name: 'Test Driver',
        location: { lat: 24.7136, lng: 46.6753 },
        vehicleType: 'BIKE'
      });
    });

    test('should update driver location successfully', async () => {
      const newLocation = { lat: 24.7243, lng: 46.6881 };

      const result = await agent.updateDriverLocation({
        driverId: 'driver-location-test',
        location: newLocation
      });

      expect(result.success).toBe(true);

      const driver = agent.driverStates.get('driver-location-test');
      expect(driver.location).toEqual(newLocation);
    });

    test('should handle non-existent driver gracefully', async () => {
      const result = await agent.updateDriverLocation({
        driverId: 'non-existent-driver',
        location: { lat: 24.7136, lng: 46.6753 }
      });

      expect(result.success).toBe(true); // Doesn't throw error
    });
  });

  describe('getAvailableDrivers()', () => {
    beforeEach(async () => {
      // Register multiple drivers
      await agent.registerDriver({
        id: 'driver-available-1',
        name: 'Driver 1',
        location: { lat: 24.7136, lng: 46.6753 },
        status: 'available',
        vehicleType: 'BIKE'
      });

      await agent.registerDriver({
        id: 'driver-available-2',
        name: 'Driver 2',
        location: { lat: 24.7243, lng: 46.6881 },
        status: 'available',
        vehicleType: 'CAR'
      });

      await agent.registerDriver({
        id: 'driver-busy',
        name: 'Driver 3',
        location: { lat: 24.7100, lng: 46.6700 },
        status: 'busy',
        vehicleType: 'BIKE'
      });
    });

    test('should return only available drivers', async () => {
      const criteria = {
        location: { lat: 24.7136, lng: 46.6753 },
        serviceType: 'BULLET'
      };

      const drivers = await agent.getAvailableDrivers(criteria);

      expect(drivers.length).toBeGreaterThan(0);
      drivers.forEach(driver => {
        expect(driver.status).toBe('available');
      });
    });

    test('should sort drivers by distance', async () => {
      const criteria = {
        location: { lat: 24.7136, lng: 46.6753 },
        serviceType: 'BULLET'
      };

      const drivers = await agent.getAvailableDrivers(criteria);

      if (drivers.length > 1) {
        for (let i = 1; i < drivers.length; i++) {
          expect(drivers[i].distance).toBeGreaterThanOrEqual(drivers[i - 1].distance);
        }
      }
    });

    test('should filter BARQ drivers by 5km radius', async () => {
      const criteria = {
        location: { lat: 24.7136, lng: 46.6753 },
        serviceType: 'BARQ'
      };

      const drivers = await agent.getAvailableDrivers(criteria);

      drivers.forEach(driver => {
        expect(driver.distance).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('getStatus()', () => {
    test('should return fleet status summary', async () => {
      const status = await agent.getStatus();

      expect(status).toHaveProperty('available');
      expect(status).toHaveProperty('busy');
      expect(status).toHaveProperty('offline');
      expect(status).toHaveProperty('total');
      expect(status).toHaveProperty('timestamp');
      expect(Array.isArray(status.available)).toBe(true);
    });

    test('should handle errors gracefully', async () => {
      // Mock execute to throw error
      jest.spyOn(agent, 'execute').mockRejectedValue(new Error('Test error'));

      const status = await agent.getStatus();

      expect(status.available).toEqual([]);
      expect(status.busy).toEqual([]);
      expect(status.offline).toEqual([]);
      expect(status.total).toBe(0);
    });
  });

  describe('isHealthy()', () => {
    test('should return healthy when recently updated', () => {
      agent.lastUpdate = Date.now();

      const health = agent.isHealthy();

      expect(health.healthy).toBe(true);
      expect(health.message).toContain('healthy');
    });

    test('should return unhealthy when not updated recently', () => {
      agent.lastUpdate = Date.now() - 120000; // 2 minutes ago

      const health = agent.isHealthy();

      expect(health.healthy).toBe(false);
      expect(health.message).toContain('not updated');
    });
  });

  describe('predictFleetAvailability()', () => {
    test('should predict availability for next 15 and 30 minutes', async () => {
      const fleetSnapshot = {
        drivers: {
          available: [{ id: 'driver-1' }, { id: 'driver-2' }],
          busy: [
            { id: 'driver-3', estimatedFreeTime: 10 },
            { id: 'driver-4', estimatedFreeTime: 25 }
          ],
          breakTime: [
            {
              id: 'driver-5',
              expectedReturn: new Date(Date.now() + 20 * 60000).toISOString()
            }
          ]
        }
      };

      const predictions = await agent.predictFleetAvailability(fleetSnapshot);

      expect(predictions).toHaveProperty('in15Minutes');
      expect(predictions).toHaveProperty('in30Minutes');
      expect(predictions.in15Minutes.available).toBeGreaterThan(0);
      expect(predictions.in30Minutes.available).toBeGreaterThanOrEqual(predictions.in15Minutes.available);
    });
  });
});
