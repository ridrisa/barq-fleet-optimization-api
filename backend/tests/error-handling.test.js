/**
 * Error Handling Tests
 * Comprehensive tests for error handling and logging system
 */

const {
  AppError,
  ValidationError,
  NotFoundError,
  ServiceUnavailableError,
  AgentExecutionError,
  OrderAssignmentError,
  getErrorCode
} = require('../src/middleware/error.middleware');

describe('Error Handling System', () => {
  describe('Error Classes', () => {
    test('ValidationError should have correct properties', () => {
      const error = new ValidationError('Invalid input', [
        { field: 'email', message: 'Invalid email format' }
      ]);

      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.errors).toHaveLength(1);
      expect(error.errors[0].field).toBe('email');
    });

    test('NotFoundError should have correct status code', () => {
      const error = new NotFoundError('Order not found');

      expect(error.message).toBe('Order not found');
      expect(error.statusCode).toBe(404);
      expect(error.isOperational).toBe(true);
    });

    test('ServiceUnavailableError should include retry-after', () => {
      const error = new ServiceUnavailableError('Service down', 60);

      expect(error.statusCode).toBe(503);
      expect(error.retryAfter).toBe(60);
      expect(error.isOperational).toBe(false); // Server errors are non-operational
    });

    test('AgentExecutionError should have agent context', () => {
      const error = new AgentExecutionError(
        'fleet-status',
        'Failed to fetch fleet data',
        new Error('Database timeout')
      );

      expect(error.agentName).toBe('fleet-status');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('AGENT_EXECUTION_ERROR');
      expect(error.originalError).toBeDefined();
    });

    test('OrderAssignmentError should include order context', () => {
      const error = new OrderAssignmentError(
        'No suitable driver found',
        'order-123'
      );

      expect(error.agentName).toBe('order-assignment');
      expect(error.orderId).toBe('order-123');
      expect(error.code).toBe('ASSIGNMENT_FAILED');
    });
  });

  describe('Error Code Generation', () => {
    test('should return explicit error code if set', () => {
      const error = new Error('Test');
      error.code = 'CUSTOM_ERROR';

      expect(getErrorCode(error)).toBe('CUSTOM_ERROR');
    });

    test('should map error class name to code', () => {
      const validationError = new ValidationError('Test');
      expect(getErrorCode(validationError)).toBe('VALIDATION_ERROR');

      const notFoundError = new NotFoundError('Test');
      expect(getErrorCode(notFoundError)).toBe('NOT_FOUND');
    });

    test('should return INTERNAL_ERROR for unknown errors', () => {
      const genericError = new Error('Unknown error');
      expect(getErrorCode(genericError)).toBe('INTERNAL_ERROR');
    });
  });

  describe('Error Response Format', () => {
    test('should format operational error correctly', () => {
      const error = new ValidationError('Invalid order data', [
        { field: 'pickup', message: 'Pickup location required' }
      ]);

      // Simulate response structure
      const response = {
        success: false,
        status: error.status,
        message: error.message,
        code: getErrorCode(error),
        errors: error.errors,
        timestamp: new Date().toISOString()
      };

      expect(response.success).toBe(false);
      expect(response.status).toBe('fail');
      expect(response.code).toBe('VALIDATION_ERROR');
      expect(response.errors).toHaveLength(1);
    });

    test('should format agent error correctly', () => {
      const error = new AgentExecutionError('sla-monitor', 'SLA check failed');

      const response = {
        success: false,
        message: error.message,
        code: error.code,
        agentName: error.agentName,
        timestamp: new Date().toISOString()
      };

      expect(response.agentName).toBe('sla-monitor');
      expect(response.code).toBe('AGENT_EXECUTION_ERROR');
    });
  });

  describe('Error Logging Context', () => {
    test('should include all required context for logging', () => {
      const error = new OrderAssignmentError('Assignment failed', 'order-456');

      // Simulate log context
      const logContext = {
        error: error.message,
        errorCode: getErrorCode(error),
        statusCode: error.statusCode,
        agentName: error.agentName,
        orderId: error.orderId,
        timestamp: new Date().toISOString()
      };

      expect(logContext.agentName).toBe('order-assignment');
      expect(logContext.orderId).toBe('order-456');
      expect(logContext.errorCode).toBe('ASSIGNMENT_FAILED');
      expect(logContext.statusCode).toBe(500);
    });
  });
});

describe('Logger Integration', () => {
  const { logger } = require('../src/utils/logger');

  test('logger should have required methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  test('logger should log error with metadata', () => {
    // This would normally check log output, but for now we just verify it doesn't throw
    expect(() => {
      logger.error('Test error', {
        errorCode: 'TEST_ERROR',
        statusCode: 500,
        agentName: 'test-agent'
      });
    }).not.toThrow();
  });
});

describe('AsyncHandler', () => {
  const { asyncHandler } = require('../src/middleware/error.middleware');

  test('should catch and pass errors to next', async () => {
    const failingFunction = asyncHandler(async (req, res, next) => {
      throw new ValidationError('Test error');
    });

    const req = {};
    const res = {};
    const next = jest.fn();

    await failingFunction(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeInstanceOf(ValidationError);
  });

  test('should handle promise rejections', async () => {
    const failingFunction = asyncHandler(async (req, res, next) => {
      return Promise.reject(new Error('Promise rejection'));
    });

    const req = {};
    const res = {};
    const next = jest.fn();

    await failingFunction(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  test('should pass successful responses through', async () => {
    const successFunction = asyncHandler(async (req, res, next) => {
      res.json({ success: true });
    });

    const req = {};
    const res = { json: jest.fn() };
    const next = jest.fn();

    await successFunction(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(next).not.toHaveBeenCalled();
  });
});

// Manual test examples (uncomment to run manually)
/*
console.log('\n=== Error Handling Manual Tests ===\n');

// Test 1: Validation Error
try {
  throw new ValidationError('Order validation failed', [
    { field: 'pickup', message: 'Pickup location is required' },
    { field: 'delivery', message: 'Delivery location is required' }
  ]);
} catch (error) {
  console.log('Validation Error:');
  console.log(JSON.stringify({
    success: false,
    message: error.message,
    code: getErrorCode(error),
    errors: error.errors,
    statusCode: error.statusCode
  }, null, 2));
}

// Test 2: Agent Error
try {
  throw new AgentExecutionError(
    'master-orchestrator',
    'Orchestration failed due to critical agent failure',
    new Error('Fleet status agent timeout')
  );
} catch (error) {
  console.log('\nAgent Execution Error:');
  console.log(JSON.stringify({
    success: false,
    message: error.message,
    code: error.code,
    agentName: error.agentName,
    statusCode: error.statusCode
  }, null, 2));
}

// Test 3: Service Unavailable
try {
  throw new ServiceUnavailableError('Agent system initializing', 30);
} catch (error) {
  console.log('\nService Unavailable Error:');
  console.log(JSON.stringify({
    success: false,
    message: error.message,
    code: getErrorCode(error),
    retryAfter: error.retryAfter,
    statusCode: error.statusCode
  }, null, 2));
}

console.log('\n=== Tests Complete ===\n');
*/
