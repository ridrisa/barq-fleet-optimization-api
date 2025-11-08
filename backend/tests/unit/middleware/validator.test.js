/**
 * Unit Tests for validator.js
 */

const middleware = require('../../../src/middleware/validator.js');

describe('validator Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      body: {},
      params: {},
      query: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  describe('Middleware Function', () => {
    test('should be defined', () => {
      expect(middleware).toBeDefined();
    });

    test('should be a function or object', () => {
      expect(['function', 'object']).toContain(typeof middleware);
    });
  });
});
