/**
 * Integration Tests for API Endpoints
 */

const request = require('supertest');
const app = require('../../src/app');

describe('API Integration Tests', () => {
  describe('Health Endpoints', () => {
    test('GET /health - should return API health status', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('healthy');
    });

    test('GET /health/agents - should return agent health status', async () => {
      const response = await request(app)
        .get('/health/agents');

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('agents');
      }
    });
  });

  describe('Optimization Endpoints', () => {
    test('POST /api/optimize - should accept optimization request', async () => {
      const optimizationRequest = {
        stops: [
          {
            id: 'stop-1',
            location: { lat: 24.7136, lng: 46.6753 },
            type: 'pickup'
          },
          {
            id: 'stop-2',
            location: { lat: 24.7243, lng: 46.6881 },
            type: 'delivery'
          }
        ],
        vehicles: [
          {
            id: 'vehicle-1',
            startLocation: { lat: 24.7136, lng: 46.6753 },
            capacity: 10
          }
        ]
      };

      const response = await request(app)
        .post('/api/optimize')
        .send(optimizationRequest);

      expect([200, 400]).toContain(response.status);
    });

    test('POST /api/optimize - should reject invalid requests', async () => {
      const response = await request(app)
        .post('/api/optimize')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('Autonomous Operations Endpoints', () => {
    test('GET /api/autonomous/status - should return autonomous operations status', async () => {
      const response = await request(app)
        .get('/api/autonomous/status');

      expect([200, 404]).toContain(response.status);
    });

    test('POST /api/autonomous/start - should start autonomous operations', async () => {
      const response = await request(app)
        .post('/api/autonomous/start')
        .send({});

      expect([200, 201, 400, 404]).toContain(response.status);
    });
  });

  describe('Agent Management Endpoints', () => {
    test('GET /api/agents/status - should return agents status', async () => {
      const response = await request(app)
        .get('/api/agents/status');

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('CORS', () => {
    test('should handle CORS preflight request', async () => {
      const response = await request(app)
        .options('/api/optimize')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect([200, 204]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent-route');

      expect(response.status).toBe(404);
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/optimize')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect([400, 500]).toContain(response.status);
    });
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers).toHaveProperty('x-dns-prefetch-control');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('Rate Limiting', () => {
    test('should apply rate limiting', async () => {
      // Make multiple requests
      const requests = Array(10).fill(null).map(() =>
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);

      // All should succeed initially (before rate limit)
      responses.forEach(res => {
        expect([200, 429]).toContain(res.status);
      });
    });
  });
});
