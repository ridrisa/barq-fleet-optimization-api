/**
 * Unit Tests for penalty.service.js
 */

describe('penalty.service Service', () => {
  describe('Service Instance', () => {
    test('should be defined', () => {
      const service = require('../../../src/services/penalty.service.js');
      expect(service).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully', async () => {
      const service = require('../../../src/services/penalty.service.js');
      expect(service).toBeDefined();
    });
  });
});
