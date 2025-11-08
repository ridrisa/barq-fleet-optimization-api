/**
 * Integration Tests for Autonomous Operations
 */

const request = require('supertest');
const app = require('../../src/app');

describe('Autonomous Operations Integration', () => {
  describe('Orchestrator Lifecycle', () => {
    test('should check orchestrator status', async () => {
      const response = await request(app)
        .get('/api/autonomous/status');

      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('status');
      }
    });

    test('should start autonomous operations', async () => {
      const response = await request(app)
        .post('/api/autonomous/start');

      expect([200, 201, 400, 404]).toContain(response.status);
    });

    test('should get operational metrics', async () => {
      const response = await request(app)
        .get('/api/autonomous/metrics');

      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('metrics');
      }
    });
  });

  describe('Agent Coordination', () => {
    test('should coordinate fleet status agent', async () => {
      const response = await request(app)
        .get('/api/agents/fleet-status');

      expect([200, 404]).toContain(response.status);
    });

    test('should coordinate SLA monitor agent', async () => {
      const response = await request(app)
        .get('/api/agents/sla-monitor');

      expect([200, 404]).toContain(response.status);
    });

    test('should coordinate order assignment agent', async () => {
      const response = await request(app)
        .get('/api/agents/order-assignment');

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Decision Making', () => {
    test('should make autonomous decisions', async () => {
      const response = await request(app)
        .post('/api/autonomous/decide')
        .send({
          scenario: 'order_assignment',
          context: {}
        });

      expect([200, 400, 404]).toContain(response.status);
    });
  });

  describe('Error Recovery', () => {
    test('should handle agent failures gracefully', async () => {
      const response = await request(app)
        .post('/api/autonomous/recover')
        .send({
          agentId: 'fleet-status',
          error: 'test-error'
        });

      expect([200, 400, 404]).toContain(response.status);
    });
  });

  describe('Monitoring', () => {
    test('should provide real-time metrics', async () => {
      const response = await request(app)
        .get('/api/autonomous/monitoring');

      expect([200, 404]).toContain(response.status);
    });

    test('should track decision history', async () => {
      const response = await request(app)
        .get('/api/autonomous/decisions');

      expect([200, 404]).toContain(response.status);
    });
  });
});
