#!/usr/bin/env node

/**
 * Error Handling Demo
 * Demonstrates the error handling and logging system
 */

const {
  ValidationError,
  NotFoundError,
  ServiceUnavailableError,
  AgentExecutionError,
  OrderAssignmentError,
  NoDriversAvailableError,
  getErrorCode
} = require('./src/middleware/error.middleware');

const { logger } = require('./src/utils/logger');

console.log('\n' + '='.repeat(70));
console.log('  ERROR HANDLING & LOGGING DEMONSTRATION');
console.log('='.repeat(70) + '\n');

// Demo 1: Validation Error
console.log('📋 Demo 1: Validation Error (400)');
console.log('-'.repeat(70));
try {
  throw new ValidationError('Order validation failed', [
    { field: 'pickup', message: 'Pickup location is required' },
    { field: 'delivery', message: 'Delivery location is required' }
  ]);
} catch (error) {
  const response = {
    success: false,
    status: error.status,
    message: error.message,
    code: getErrorCode(error),
    errors: error.errors,
    statusCode: error.statusCode,
    timestamp: new Date().toISOString()
  };

  console.log('Error Response:');
  console.log(JSON.stringify(response, null, 2));

  logger.warn('Validation error occurred', {
    errorCode: response.code,
    errors: error.errors
  });
}

console.log('\n');

// Demo 2: Resource Not Found
console.log('🔍 Demo 2: Not Found Error (404)');
console.log('-'.repeat(70));
try {
  throw new NotFoundError('Order ORD-12345 not found');
} catch (error) {
  const response = {
    success: false,
    status: error.status,
    message: error.message,
    code: getErrorCode(error),
    statusCode: error.statusCode,
    timestamp: new Date().toISOString()
  };

  console.log('Error Response:');
  console.log(JSON.stringify(response, null, 2));

  logger.warn('Resource not found', {
    errorCode: response.code,
    resource: 'order',
    resourceId: 'ORD-12345'
  });
}

console.log('\n');

// Demo 3: Service Unavailable
console.log('⏳ Demo 3: Service Unavailable (503)');
console.log('-'.repeat(70));
try {
  throw new ServiceUnavailableError('Agent system is initializing', 30);
} catch (error) {
  const response = {
    success: false,
    status: error.status,
    message: error.message,
    code: getErrorCode(error),
    retryAfter: error.retryAfter,
    statusCode: error.statusCode,
    timestamp: new Date().toISOString()
  };

  console.log('Error Response:');
  console.log(JSON.stringify(response, null, 2));

  logger.warn('Service unavailable', {
    errorCode: response.code,
    retryAfter: error.retryAfter
  });
}

console.log('\n');

// Demo 4: Agent Execution Error
console.log('🤖 Demo 4: Agent Execution Error (500)');
console.log('-'.repeat(70));
try {
  throw new AgentExecutionError(
    'master-orchestrator',
    'Orchestration failed due to critical agent failure',
    new Error('Fleet status agent timeout')
  );
} catch (error) {
  const response = {
    success: false,
    status: error.status,
    message: error.message,
    code: error.code,
    agentName: error.agentName,
    statusCode: error.statusCode,
    requestId: 'req-demo-123', // Would be real request ID in production
    timestamp: new Date().toISOString()
  };

  console.log('Error Response:');
  console.log(JSON.stringify(response, null, 2));

  logger.error('Agent execution failed', {
    errorCode: error.code,
    agentName: error.agentName,
    originalError: error.originalError?.message,
    requestId: response.requestId
  });
}

console.log('\n');

// Demo 5: No Drivers Available
console.log('🚗 Demo 5: No Drivers Available (503)');
console.log('-'.repeat(70));
try {
  throw new NoDriversAvailableError({
    serviceType: 'BARQ',
    zone: 'north-riyadh',
    timeWindow: '1-hour'
  });
} catch (error) {
  const response = {
    success: false,
    status: error.status,
    message: error.message,
    code: error.code,
    agentName: error.agentName,
    statusCode: error.statusCode,
    timestamp: new Date().toISOString()
  };

  console.log('Error Response:');
  console.log(JSON.stringify(response, null, 2));

  logger.warn('No drivers available', {
    errorCode: error.code,
    agentName: error.agentName,
    criteria: error.criteria
  });

  console.log('\nRecovery Strategy:');
  console.log('→ Queue order for later processing');
  console.log('→ Notify dispatch team');
  console.log('→ Suggest alternative service type or delivery window');
}

console.log('\n');

// Demo 6: Order Assignment Error
console.log('📦 Demo 6: Order Assignment Error (500)');
console.log('-'.repeat(70));
try {
  throw new OrderAssignmentError(
    'Failed to assign order: No suitable driver found within 5km radius',
    'ORD-67890'
  );
} catch (error) {
  const response = {
    success: false,
    status: error.status,
    message: error.message,
    code: error.code,
    agentName: error.agentName,
    orderId: error.orderId,
    statusCode: error.statusCode,
    requestId: 'req-demo-456',
    timestamp: new Date().toISOString()
  };

  console.log('Error Response:');
  console.log(JSON.stringify(response, null, 2));

  logger.error('Order assignment failed', {
    errorCode: error.code,
    agentName: error.agentName,
    orderId: error.orderId,
    requestId: response.requestId
  });

  console.log('\nRecovery Strategy:');
  console.log('→ Expand search radius to 10km');
  console.log('→ Relax driver constraints (capacity, rating)');
  console.log('→ Consider batch assignment with other orders');
}

console.log('\n');

// Demo 7: Logging Levels
console.log('📊 Demo 7: Different Log Levels');
console.log('-'.repeat(70));

logger.debug('Detailed debugging information', {
  function: 'calculateRoute',
  parameters: { start: [24.7136, 46.6753], end: [24.7241, 46.6815] }
});

logger.info('Normal operational event', {
  event: 'order_created',
  orderId: 'ORD-11111',
  serviceType: 'BARQ'
});

logger.warn('Warning that needs attention', {
  warning: 'driver_not_responding',
  driverId: 'DRV-222',
  attemptCount: 3
});

logger.error('Error that requires investigation', {
  error: 'database_timeout',
  query: 'SELECT * FROM orders',
  duration: 5000
});

console.log('✅ Check logs/combined.log for all log entries');
console.log('✅ Check logs/error.log for error/warn entries only');

console.log('\n');

// Demo 8: Error Code Mapping
console.log('🏷️  Demo 8: Error Code Mapping');
console.log('-'.repeat(70));

const errorExamples = [
  new ValidationError('Test'),
  new NotFoundError('Test'),
  new ServiceUnavailableError('Test'),
  new AgentExecutionError('test-agent', 'Test'),
  new NoDriversAvailableError(),
  new OrderAssignmentError('Test')
];

console.log('Error Class → Error Code Mapping:');
errorExamples.forEach(error => {
  console.log(`  ${error.name.padEnd(30)} → ${getErrorCode(error)}`);
});

console.log('\n');

// Summary
console.log('='.repeat(70));
console.log('  SUMMARY');
console.log('='.repeat(70));
console.log('');
console.log('✅ Error Classes: 20+ typed error classes available');
console.log('✅ Error Codes: Standardized codes for all scenarios');
console.log('✅ Logging: Structured Winston logging with file rotation');
console.log('✅ Responses: Consistent JSON format across all errors');
console.log('✅ Context: Request IDs, agent names, and metadata included');
console.log('✅ Recovery: Retry-after hints and recovery strategies');
console.log('');
console.log('📚 Documentation:');
console.log('   - docs/ERROR_CODES.md - Complete error code catalog');
console.log('   - docs/ERROR_HANDLING_GUIDE.md - Developer guide');
console.log('   - docs/ERROR_HANDLING_IMPLEMENTATION.md - Implementation details');
console.log('');
console.log('🧪 Testing:');
console.log('   - Run: npm test tests/error-handling.test.js');
console.log('   - Manual: curl examples in documentation');
console.log('');
console.log('📊 Logs:');
console.log('   - tail -f logs/combined.log  # All logs');
console.log('   - tail -f logs/error.log     # Errors only');
console.log('   - tail -f logs/api.log       # HTTP requests');
console.log('');
console.log('='.repeat(70));
console.log('');
