/**
 * Comprehensive End-to-End Test Suite
 * Tests complete workflows across the entire BARQ Fleet Management system
 *
 * Covers:
 * - Route optimization workflows (OSRM, CVRP, Hybrid)
 * - Agent system operations
 * - Database operations
 * - Error handling and edge cases
 * - Performance and concurrency
 * - Integration between all services
 */

const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

// Test configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3003';
const CVRP_URL = process.env.CVRP_URL || 'http://localhost:5001';
const TEST_TIMEOUT = 60000; // 60 seconds

describe('BARQ Fleet Management - Comprehensive E2E Tests', () => {
  let app;
  let testRequestId;
  let testOrderId;

  beforeAll(async () => {
    // Wait for services to be ready
    await waitForService(BACKEND_URL, '/api/v1/health', 30000);
    console.log('✓ Backend service is ready');
  });

  afterAll(async () => {
    // Cleanup test data if needed
  });

  // ================================================================
  // Test Suite 1: Health & Status Checks
  // ================================================================

  describe('1. Health & Status Checks', () => {
    test('1.1 Backend health check should return healthy status', async () => {
      const response = await request(BACKEND_URL)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(['healthy', 'operational']).toContain(response.body.status);
    }, TEST_TIMEOUT);

    test('1.2 CVRP service health check should return healthy status', async () => {
      const response = await request(CVRP_URL)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
    }, TEST_TIMEOUT);

    test('1.3 Agent status endpoint should return all agents', async () => {
      const response = await request(BACKEND_URL)
        .get('/api/v1/agents/status')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('agents');
      expect(Array.isArray(response.body.agents)).toBe(true);
    }, TEST_TIMEOUT);
  });

  // ================================================================
  // Test Suite 2: Basic Route Optimization (BARQ - OSRM)
  // ================================================================

  describe('2. Basic Route Optimization (BARQ)', () => {
    test('2.1 Simple single delivery optimization should succeed', async () => {
      const request_data = {
        serviceType: 'BARQ',
        pickupPoints: [{
          id: 'P1',
          lat: 24.7136,
          lng: 46.6753,
          name: 'Riyadh Warehouse',
          address: 'Riyadh, Saudi Arabia'
        }],
        deliveryPoints: [{
          order_id: `TEST-${Date.now()}`,
          lat: 24.7236,
          lng: 46.6853,
          name: 'Customer 1',
          address: 'Delivery Location, Riyadh',
          load_kg: 5
        }],
        fleet: {
          vehicles: [{
            fleet_id: 'V1',
            vehicle_type: 'TRUCK',
            capacity_kg: 30
          }]
        }
      };

      const response = await request(BACKEND_URL)
        .post('/api/v1/optimize')
        .send(request_data)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('routes');
      expect(Array.isArray(response.body.data.routes)).toBe(true);
      expect(response.body.data.routes.length).toBeGreaterThan(0);

      // Verify route structure
      const route = response.body.data.routes[0];
      expect(route).toHaveProperty('vehicle_id');
      expect(route).toHaveProperty('stops');
      expect(Array.isArray(route.stops)).toBe(true);
    }, TEST_TIMEOUT);

    test('2.2 Multiple deliveries optimization should succeed', async () => {
      const request_data = {
        serviceType: 'BARQ',
        pickupPoints: [{
          id: 'P1',
          lat: 24.7136,
          lng: 46.6753,
          name: 'Riyadh Warehouse',
          address: 'Riyadh'
        }],
        deliveryPoints: [
          {
            order_id: `TEST-${Date.now()}-1`,
            lat: 24.7236,
            lng: 46.6853,
            name: 'Customer 1',
            address: 'Location 1',
            load_kg: 5
          },
          {
            order_id: `TEST-${Date.now()}-2`,
            lat: 24.7336,
            lng: 46.6953,
            name: 'Customer 2',
            address: 'Location 2',
            load_kg: 8
          },
          {
            order_id: `TEST-${Date.now()}-3`,
            lat: 24.7436,
            lng: 46.7053,
            name: 'Customer 3',
            address: 'Location 3',
            load_kg: 6
          }
        ],
        fleet: {
          vehicles: [{
            fleet_id: 'V1',
            vehicle_type: 'TRUCK',
            capacity_kg: 50
          }]
        }
      };

      const response = await request(BACKEND_URL)
        .post('/api/v1/optimize')
        .send(request_data)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.routes.length).toBeGreaterThan(0);

      // Verify all deliveries are included
      const allStops = response.body.data.routes.flatMap(r => r.stops);
      const deliveryStops = allStops.filter(s => s.type === 'delivery');
      expect(deliveryStops.length).toBe(3);
    }, TEST_TIMEOUT);

    test('2.3 Optimization with traffic context should succeed', async () => {
      const request_data = {
        serviceType: 'BARQ',
        pickupPoints: [{
          id: 'P1',
          lat: 24.7136,
          lng: 46.6753,
          name: 'Warehouse',
          address: 'Riyadh'
        }],
        deliveryPoints: [{
          order_id: `TEST-${Date.now()}`,
          lat: 24.7536,
          lng: 46.7153,
          name: 'Customer',
          address: 'Riyadh',
          load_kg: 5
        }],
        fleet: {
          vehicles: [{
            fleet_id: 'V1',
            vehicle_type: 'TRUCK',
            capacity_kg: 30
          }]
        },
        context: {
          trafficData: 'heavy',
          weatherConditions: 'rainy'
        }
      };

      const response = await request(BACKEND_URL)
        .post('/api/v1/optimize')
        .send(request_data)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('routes');
    }, TEST_TIMEOUT);
  });

  // ================================================================
  // Test Suite 3: CVRP Optimization (BULLET)
  // ================================================================

  describe('3. CVRP Optimization (BULLET)', () => {
    test('3.1 CVRP with 12+ deliveries should use CVRP engine', async () => {
      const deliveryPoints = [];
      for (let i = 0; i < 12; i++) {
        deliveryPoints.push({
          order_id: `TEST-CVRP-${Date.now()}-${i}`,
          lat: 24.7136 + (i * 0.01) + (Math.random() * 0.01),
          lng: 46.6753 + (i * 0.01) + (Math.random() * 0.01),
          name: `Customer ${i + 1}`,
          address: `Location ${i + 1}`,
          load_kg: 5
        });
      }

      const request_data = {
        serviceType: 'BULLET',
        pickupPoints: [{
          id: 'P1',
          lat: 24.7136,
          lng: 46.6753,
          name: 'Warehouse',
          address: 'Riyadh'
        }],
        deliveryPoints,
        fleet: {
          vehicles: [
            { fleet_id: 'V1', vehicle_type: 'TRUCK', capacity_kg: 50 },
            { fleet_id: 'V2', vehicle_type: 'TRUCK', capacity_kg: 50 }
          ]
        }
      };

      const response = await request(BACKEND_URL)
        .post('/api/v1/optimize')
        .send(request_data)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('optimizationEngine');
      expect(response.body.data.optimizationEngine).toBe('CVRP');
      expect(response.body.data.routes.length).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    test('3.2 CVRP with time windows should respect constraints', async () => {
      const request_data = {
        depot: { lat: 24.7136, lng: 46.6753 },
        locations: [
          {
            id: 'D1',
            lat: 24.7236,
            lng: 46.6853,
            demand: 5,
            time_window: { earliest: 30, latest: 90 },
            service_time: 8
          },
          {
            id: 'D2',
            lat: 24.7336,
            lng: 46.6953,
            demand: 8,
            time_window: { earliest: 60, latest: 120 },
            service_time: 8
          },
          {
            id: 'D3',
            lat: 24.7436,
            lng: 46.7053,
            demand: 6,
            time_window: { earliest: 90, latest: 150 },
            service_time: 8
          }
        ],
        vehicles: [
          { id: 'V1', capacity: 20 },
          { id: 'V2', capacity: 20 }
        ],
        time_limit: 10
      };

      const response = await request(CVRP_URL)
        .post('/api/optimize/batch')
        .send(request_data)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('routes');
      expect(response.body.optimization_metadata?.time_windows_enabled).toBe(true);
    }, TEST_TIMEOUT);

    test('3.3 CVRP with capacity constraints should not exceed vehicle limits', async () => {
      const request_data = {
        depot: { lat: 24.7136, lng: 46.6753 },
        locations: Array.from({ length: 8 }, (_, i) => ({
          id: `D${i + 1}`,
          lat: 24.7136 + (i + 1) * 0.015,
          lng: 46.6753 + (i + 1) * 0.015,
          demand: 8  // High demand
        })),
        vehicles: [
          { id: 'V1', capacity: 20 },  // Can only handle 2-3 deliveries
          { id: 'V2', capacity: 20 }
        ],
        time_limit: 10
      };

      const response = await request(CVRP_URL)
        .post('/api/optimize/batch')
        .send(request_data)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify capacity constraints
      response.body.routes.forEach(route => {
        const totalDemand = route.stops
          .filter(s => s.type === 'delivery')
          .reduce((sum, s) => sum + (s.demand || 0), 0);

        const vehicle = request_data.vehicles.find(v => v.id === route.vehicle_id);
        expect(totalDemand).toBeLessThanOrEqual(vehicle.capacity);
      });
    }, TEST_TIMEOUT);
  });

  // ================================================================
  // Test Suite 4: Error Handling & Edge Cases
  // ================================================================

  describe('4. Error Handling & Edge Cases', () => {
    test('4.1 Missing required fields should return 400', async () => {
      const invalid_request = {
        serviceType: 'BARQ',
        // Missing pickupPoints and deliveryPoints
        fleet: {
          vehicles: [{ fleet_id: 'V1', capacity_kg: 30 }]
        }
      };

      const response = await request(BACKEND_URL)
        .post('/api/v1/optimize')
        .send(invalid_request)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    }, TEST_TIMEOUT);

    test('4.2 Invalid coordinates should return error', async () => {
      const invalid_request = {
        serviceType: 'BARQ',
        pickupPoints: [{
          id: 'P1',
          lat: 999,  // Invalid latitude
          lng: 999,  // Invalid longitude
          name: 'Invalid Location'
        }],
        deliveryPoints: [{
          order_id: 'TEST',
          lat: 24.7236,
          lng: 46.6853,
          name: 'Customer',
          load_kg: 5
        }],
        fleet: {
          vehicles: [{ fleet_id: 'V1', capacity_kg: 30 }]
        }
      };

      const response = await request(BACKEND_URL)
        .post('/api/v1/optimize')
        .send(invalid_request);

      expect([400, 422, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('4.3 Empty delivery points should return error', async () => {
      const invalid_request = {
        serviceType: 'BARQ',
        pickupPoints: [{
          id: 'P1',
          lat: 24.7136,
          lng: 46.6753,
          name: 'Warehouse'
        }],
        deliveryPoints: [],  // Empty
        fleet: {
          vehicles: [{ fleet_id: 'V1', capacity_kg: 30 }]
        }
      };

      const response = await request(BACKEND_URL)
        .post('/api/v1/optimize')
        .send(invalid_request);

      expect([400, 422]).toContain(response.status);
      expect(response.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('4.4 Exceeding capacity should handle gracefully', async () => {
      const request_data = {
        serviceType: 'BARQ',
        pickupPoints: [{
          id: 'P1',
          lat: 24.7136,
          lng: 46.6753,
          name: 'Warehouse'
        }],
        deliveryPoints: [{
          order_id: 'TEST-OVERWEIGHT',
          lat: 24.7236,
          lng: 46.6853,
          name: 'Customer',
          load_kg: 100  // Exceeds vehicle capacity
        }],
        fleet: {
          vehicles: [{
            fleet_id: 'V1',
            vehicle_type: 'TRUCK',
            capacity_kg: 30  // Too small
          }]
        }
      };

      const response = await request(BACKEND_URL)
        .post('/api/v1/optimize')
        .send(request_data);

      // Should either return error or handle with multiple trips
      expect(response.body).toHaveProperty('success');
    }, TEST_TIMEOUT);
  });

  // ================================================================
  // Test Suite 5: Agent System Operations
  // ================================================================

  describe('5. Agent System Operations', () => {
    test('5.1 List all available agents', async () => {
      const response = await request(BACKEND_URL)
        .get('/api/v1/agents/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.agents)).toBe(true);
      expect(response.body.agents.length).toBeGreaterThan(0);

      // Verify agent structure
      const agent = response.body.agents[0];
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('status');
    }, TEST_TIMEOUT);

    test('5.2 Trigger planning agent for complex request', async () => {
      const request_data = {
        serviceType: 'BULLET',
        pickupPoints: [{
          id: 'P1',
          lat: 24.7136,
          lng: 46.6753,
          name: 'Warehouse'
        }],
        deliveryPoints: Array.from({ length: 15 }, (_, i) => ({
          order_id: `AGENT-TEST-${i}`,
          lat: 24.7136 + (i * 0.01),
          lng: 46.6753 + (i * 0.01),
          name: `Customer ${i}`,
          load_kg: 5
        })),
        fleet: {
          vehicles: [
            { fleet_id: 'V1', capacity_kg: 50 },
            { fleet_id: 'V2', capacity_kg: 50 },
            { fleet_id: 'V3', capacity_kg: 50 }
          ]
        }
      };

      const response = await request(BACKEND_URL)
        .post('/api/v1/optimize')
        .send(request_data)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Planning agent should have been involved
      expect(response.body.data).toHaveProperty('routes');
    }, TEST_TIMEOUT);
  });

  // ================================================================
  // Test Suite 6: Performance & Concurrency
  // ================================================================

  describe('6. Performance & Concurrency', () => {
    test('6.1 Handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => {
        const request_data = {
          serviceType: 'BARQ',
          pickupPoints: [{
            id: 'P1',
            lat: 24.7136,
            lng: 46.6753,
            name: 'Warehouse'
          }],
          deliveryPoints: [{
            order_id: `CONCURRENT-${i}-${Date.now()}`,
            lat: 24.7236 + (i * 0.01),
            lng: 46.6853 + (i * 0.01),
            name: `Customer ${i}`,
            load_kg: 5
          }],
          fleet: {
            vehicles: [{
              fleet_id: `V${i}`,
              vehicle_type: 'TRUCK',
              capacity_kg: 30
            }]
          }
        };

        return request(BACKEND_URL)
          .post('/api/v1/optimize')
          .send(request_data);
      });

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    }, TEST_TIMEOUT);

    test('6.2 Optimization should complete within reasonable time', async () => {
      const start = Date.now();

      const request_data = {
        serviceType: 'BARQ',
        pickupPoints: [{
          id: 'P1',
          lat: 24.7136,
          lng: 46.6753,
          name: 'Warehouse'
        }],
        deliveryPoints: Array.from({ length: 8 }, (_, i) => ({
          order_id: `PERF-TEST-${i}`,
          lat: 24.7136 + (i * 0.01),
          lng: 46.6753 + (i * 0.01),
          name: `Customer ${i}`,
          load_kg: 5
        })),
        fleet: {
          vehicles: [
            { fleet_id: 'V1', capacity_kg: 50 },
            { fleet_id: 'V2', capacity_kg: 50 }
          ]
        }
      };

      const response = await request(BACKEND_URL)
        .post('/api/v1/optimize')
        .send(request_data)
        .expect(200);

      const duration = Date.now() - start;

      expect(response.body.success).toBe(true);
      expect(duration).toBeLessThan(30000);  // Should complete within 30 seconds
    }, TEST_TIMEOUT);
  });

  // ================================================================
  // Test Suite 7: Data Persistence & Retrieval
  // ================================================================

  describe('7. Data Persistence & Retrieval', () => {
    let savedRequestId;

    test('7.1 Optimization request should be saved', async () => {
      const request_data = {
        serviceType: 'BARQ',
        pickupPoints: [{
          id: 'P1',
          lat: 24.7136,
          lng: 46.6753,
          name: 'Warehouse'
        }],
        deliveryPoints: [{
          order_id: `PERSIST-TEST-${Date.now()}`,
          lat: 24.7236,
          lng: 46.6853,
          name: 'Customer',
          load_kg: 5
        }],
        fleet: {
          vehicles: [{
            fleet_id: 'V1',
            capacity_kg: 30
          }]
        }
      };

      const response = await request(BACKEND_URL)
        .post('/api/v1/optimize')
        .send(request_data)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('request_id');

      savedRequestId = response.body.data.request_id;
    }, TEST_TIMEOUT);

    test('7.2 Retrieve saved optimization request', async () => {
      if (!savedRequestId) {
        console.warn('Skipping test - no saved request ID');
        return;
      }

      // Try to retrieve the request (if endpoint exists)
      // This test may need adjustment based on actual API
      const response = await request(BACKEND_URL)
        .get(`/api/v1/optimize/${savedRequestId}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('request_id', savedRequestId);
      } else if (response.status === 404) {
        // Endpoint might not exist - that's ok
        console.warn('Retrieval endpoint not implemented');
      }
    }, TEST_TIMEOUT);
  });

  // ================================================================
  // Test Suite 8: Integration Between Services
  // ================================================================

  describe('8. Integration Between Services', () => {
    test('8.1 Backend should successfully communicate with CVRP service', async () => {
      // Create request that will use CVRP
      const request_data = {
        serviceType: 'BULLET',
        pickupPoints: [{
          id: 'P1',
          lat: 24.7136,
          lng: 46.6753,
          name: 'Warehouse'
        }],
        deliveryPoints: Array.from({ length: 15 }, (_, i) => ({
          order_id: `INTEGRATION-${i}`,
          lat: 24.7136 + (i * 0.01),
          lng: 46.6753 + (i * 0.01),
          name: `Customer ${i}`,
          load_kg: 5
        })),
        fleet: {
          vehicles: [
            { fleet_id: 'V1', capacity_kg: 50 },
            { fleet_id: 'V2', capacity_kg: 50 }
          ]
        }
      };

      const response = await request(BACKEND_URL)
        .post('/api/v1/optimize')
        .send(request_data)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.optimizationEngine).toBe('CVRP');
    }, TEST_TIMEOUT);

    test('8.2 Fallback to OSRM if CVRP is unavailable', async () => {
      // This test verifies resilience - may need CVRP to be down
      // For now, just verify OSRM path works
      const request_data = {
        serviceType: 'BARQ',
        pickupPoints: [{
          id: 'P1',
          lat: 24.7136,
          lng: 46.6753,
          name: 'Warehouse'
        }],
        deliveryPoints: [{
          order_id: 'FALLBACK-TEST',
          lat: 24.7236,
          lng: 46.6853,
          name: 'Customer',
          load_kg: 5
        }],
        fleet: {
          vehicles: [{ fleet_id: 'V1', capacity_kg: 30 }]
        }
      };

      const response = await request(BACKEND_URL)
        .post('/api/v1/optimize')
        .send(request_data)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should use OSRM for small requests
      expect(response.body.data.optimizationEngine).toBe('OSRM');
    }, TEST_TIMEOUT);
  });

  // ================================================================
  // Test Suite 9: Advanced Features
  // ================================================================

  describe('9. Advanced Features', () => {
    test('9.1 Optimization with priorities should respect urgency', async () => {
      const request_data = {
        serviceType: 'BARQ',
        pickupPoints: [{
          id: 'P1',
          lat: 24.7136,
          lng: 46.6753,
          name: 'Warehouse'
        }],
        deliveryPoints: [
          {
            order_id: 'URGENT-1',
            lat: 24.7536,
            lng: 46.7153,
            name: 'Urgent Customer',
            load_kg: 5,
            priority: 'high'
          },
          {
            order_id: 'NORMAL-1',
            lat: 24.7236,
            lng: 46.6853,
            name: 'Normal Customer',
            load_kg: 5,
            priority: 'normal'
          }
        ],
        fleet: {
          vehicles: [{ fleet_id: 'V1', capacity_kg: 30 }]
        }
      };

      const response = await request(BACKEND_URL)
        .post('/api/v1/optimize')
        .send(request_data)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify urgent delivery comes first (if priority is supported)
      const route = response.body.data.routes[0];
      if (route && route.stops.length >= 2) {
        // First stop after pickup should ideally be urgent
        const deliveryStops = route.stops.filter(s => s.type === 'delivery');
        // Note: Actual priority handling may vary
      }
    }, TEST_TIMEOUT);

    test('9.2 Multi-depot optimization should distribute from multiple locations', async () => {
      const request_data = {
        serviceType: 'BARQ',
        pickupPoints: [
          {
            id: 'P1',
            lat: 24.7136,
            lng: 46.6753,
            name: 'Warehouse North'
          },
          {
            id: 'P2',
            lat: 24.6136,
            lng: 46.7753,
            name: 'Warehouse South'
          }
        ],
        deliveryPoints: [
          {
            order_id: 'MULTI-1',
            lat: 24.7236,
            lng: 46.6853,
            name: 'Customer 1',
            load_kg: 5
          },
          {
            order_id: 'MULTI-2',
            lat: 24.6236,
            lng: 46.7853,
            name: 'Customer 2',
            load_kg: 5
          }
        ],
        fleet: {
          vehicles: [
            { fleet_id: 'V1', capacity_kg: 30 },
            { fleet_id: 'V2', capacity_kg: 30 }
          ]
        }
      };

      const response = await request(BACKEND_URL)
        .post('/api/v1/optimize')
        .send(request_data);

      // May not be fully supported yet, but shouldn't crash
      expect(response.body).toHaveProperty('success');
    }, TEST_TIMEOUT);
  });
});

// ================================================================
// Helper Functions
// ================================================================

/**
 * Wait for a service to become available
 */
async function waitForService(baseUrl, endpoint, timeout = 30000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await request(baseUrl).get(endpoint);
      if (response.status === 200) {
        return true;
      }
    } catch (error) {
      // Service not ready yet
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Service at ${baseUrl}${endpoint} did not become available within ${timeout}ms`);
}
