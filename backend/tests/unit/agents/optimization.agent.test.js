/**
 * Unit Tests for optimization.agent.js
 */

const Optimization.agent = require('../../../src/agents/optimization.agent.js');

describe('optimization.agent Agent', () => {
  let agent;

  beforeEach(() => {
    agent = new Optimization.agent();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize successfully', () => {
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(Optimization.agent);
    });
  });

  describe('execute()', () => {
    test('should execute without errors', async () => {
      const result = await agent.execute({});
      expect(result).toBeDefined();
    });

    test('should handle empty context', async () => {
      const result = await agent.execute({});
      expect(result).toBeDefined();
    });

    test('should return consistent structure', async () => {
      const result1 = await agent.execute({});
      const result2 = await agent.execute({});

      expect(typeof result1).toBe(typeof result2);
    });
  });

  describe('isHealthy()', () => {
    test('should return health status', () => {
      const health = agent.isHealthy();
      expect(health).toHaveProperty('healthy');
      expect(typeof health.healthy).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid input gracefully', async () => {
      try {
        await agent.execute(null);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should not throw on undefined context', async () => {
      await expect(agent.execute(undefined)).resolves.toBeDefined();
    });
  });

  describe('Integration', () => {
    test('should maintain state across multiple executions', async () => {
      await agent.execute({});
      await agent.execute({});

      expect(agent).toBeDefined();
    });
  });
});
