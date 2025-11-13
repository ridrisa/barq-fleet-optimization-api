/**
 * Pagination Tests for Production Metrics Endpoints
 * Tests pagination middleware and timeout handling
 */

const request = require('supertest');
const { getPaginationParams, generatePaginationMeta } = require('../backend/src/middleware/pagination.middleware');
const { TIMEOUT_CONFIG } = require('../backend/src/utils/query-timeout');

// Mock Express request for unit tests
function mockRequest(query = {}) {
  return { query };
}

describe('Pagination Middleware', () => {
  describe('getPaginationParams', () => {
    test('should return default values when no params provided', () => {
      const req = mockRequest({});
      const result = getPaginationParams(req);

      expect(result).toEqual({
        limit: 100,
        offset: 0,
        page: 1,
      });
    });

    test('should parse limit and offset from query', () => {
      const req = mockRequest({ limit: '50', offset: '100' });
      const result = getPaginationParams(req);

      expect(result).toEqual({
        limit: 50,
        offset: 100,
        page: 3, // (100 / 50) + 1
      });
    });

    test('should calculate offset from page number', () => {
      const req = mockRequest({ limit: '25', page: '3' });
      const result = getPaginationParams(req);

      expect(result).toEqual({
        limit: 25,
        offset: 50, // (3 - 1) * 25
        page: 3,
      });
    });

    test('should enforce minimum limit of 1', () => {
      const req = mockRequest({ limit: '0' });
      const result = getPaginationParams(req);

      expect(result.limit).toBe(1);
    });

    test('should enforce maximum limit of 1000', () => {
      const req = mockRequest({ limit: '5000' });
      const result = getPaginationParams(req);

      expect(result.limit).toBe(1000);
    });

    test('should handle negative offset by setting to 0', () => {
      const req = mockRequest({ offset: '-10' });
      const result = getPaginationParams(req);

      expect(result.offset).toBe(0);
    });

    test('should handle invalid string values', () => {
      const req = mockRequest({ limit: 'abc', offset: 'xyz' });
      const result = getPaginationParams(req);

      expect(result).toEqual({
        limit: 100, // default when NaN
        offset: 0, // default when NaN
        page: 1,
      });
    });
  });

  describe('generatePaginationMeta', () => {
    test('should generate correct pagination metadata', () => {
      const result = generatePaginationMeta(500, 100, 0, 1);

      expect(result).toEqual({
        pagination: {
          total: 500,
          limit: 100,
          offset: 0,
          page: 1,
          totalPages: 5,
          hasNextPage: true,
          hasPreviousPage: false,
          nextOffset: 100,
          previousOffset: null,
        },
      });
    });

    test('should indicate last page correctly', () => {
      const result = generatePaginationMeta(500, 100, 400, 5);

      expect(result.pagination).toMatchObject({
        hasNextPage: false,
        hasPreviousPage: true,
        nextOffset: null,
        previousOffset: 300,
      });
    });

    test('should handle single page of results', () => {
      const result = generatePaginationMeta(50, 100, 0, 1);

      expect(result.pagination).toMatchObject({
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        nextOffset: null,
        previousOffset: null,
      });
    });

    test('should handle empty results', () => {
      const result = generatePaginationMeta(0, 100, 0, 1);

      expect(result.pagination).toMatchObject({
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });
  });
});

describe('Query Timeout Configuration', () => {
  test('should have valid timeout values', () => {
    expect(TIMEOUT_CONFIG.DEFAULT).toBe(10000);
    expect(TIMEOUT_CONFIG.METRICS).toBe(8000);
    expect(TIMEOUT_CONFIG.ANALYTICS).toBe(15000);
    expect(TIMEOUT_CONFIG.SIMPLE).toBe(5000);
  });

  test('timeout values should be in ascending order', () => {
    expect(TIMEOUT_CONFIG.SIMPLE).toBeLessThan(TIMEOUT_CONFIG.METRICS);
    expect(TIMEOUT_CONFIG.METRICS).toBeLessThan(TIMEOUT_CONFIG.DEFAULT);
    expect(TIMEOUT_CONFIG.DEFAULT).toBeLessThan(TIMEOUT_CONFIG.ANALYTICS);
  });
});

// Integration tests would go here if you have a test server running
describe('Production Metrics Pagination Integration', () => {
  // These tests require a running server and database
  // Uncomment and configure if you have a test environment

  /*
  const app = require('../backend/src/app');
  const baseUrl = '/api/v1/production-metrics';

  describe('GET /courier-performance', () => {
    test('should return paginated courier performance data', async () => {
      const response = await request(app)
        .get(`${baseUrl}/courier-performance`)
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.couriers).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.offset).toBe(0);
    });

    test('should handle page parameter', async () => {
      const response = await request(app)
        .get(`${baseUrl}/courier-performance`)
        .query({ limit: 25, page: 2 })
        .expect(200);

      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.offset).toBe(25);
    });

    test('should enforce maximum limit', async () => {
      const response = await request(app)
        .get(`${baseUrl}/courier-performance`)
        .query({ limit: 5000 })
        .expect(200);

      expect(response.body.pagination.limit).toBe(1000);
    });
  });

  describe('GET /order-distribution', () => {
    test('should return paginated order distribution', async () => {
      const response = await request(app)
        .get(`${baseUrl}/order-distribution`)
        .query({ limit: 20, offset: 0 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.distribution).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('GET /sla/at-risk', () => {
    test('should return paginated at-risk orders', async () => {
      const response = await request(app)
        .get(`${baseUrl}/sla/at-risk`)
        .query({ limit: 50, offset: 0 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.orders).toBeInstanceOf(Array);
      expect(response.body.summary).toBeDefined();
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('GET /sla/compliance', () => {
    test('should return paginated compliance data', async () => {
      const response = await request(app)
        .get(`${baseUrl}/sla/compliance`)
        .query({ limit: 100, page: 1, days: 7 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.overall).toBeDefined();
      expect(response.body.by_service_type).toBeDefined();
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('Timeout Handling', () => {
    test('should handle query timeout gracefully', async () => {
      // This test would need a way to simulate a slow query
      // You might need to adjust timeout values or use a large date range
      const response = await request(app)
        .get(`${baseUrl}/courier-performance`)
        .query({ days: 3650 }) // Very large date range
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/timeout|timed out/i);
    });
  });
  */
});

describe('Pagination Edge Cases', () => {
  test('should handle limit larger than total results', () => {
    const result = generatePaginationMeta(10, 100, 0, 1);

    expect(result.pagination).toMatchObject({
      total: 10,
      totalPages: 1,
      hasNextPage: false,
    });
  });

  test('should handle offset beyond total results', () => {
    const result = generatePaginationMeta(100, 50, 200, 5);

    expect(result.pagination).toMatchObject({
      total: 100,
      hasNextPage: false,
      nextOffset: null,
    });
  });

  test('should calculate correct totalPages with remainder', () => {
    const result = generatePaginationMeta(105, 50, 0, 1);

    expect(result.pagination.totalPages).toBe(3); // Math.ceil(105/50)
  });
});
