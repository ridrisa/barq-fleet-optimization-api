/**
 * Global Test Setup
 * Configures test environment and mocks
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_MODE = 'lowdb';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.PORT = '3005'; // Different port for testing
process.env.OPENROUTER_API_KEY = 'test-api-key';
process.env.OPENROUTER_MODEL = 'test-model';

// Increase timeout for all tests
jest.setTimeout(30000);

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn() // Keep errors visible for debugging
};

// Global test utilities
global.testHelpers = {
  /**
   * Generate test user data
   */
  createTestUser: () => ({
    email: `test-${Date.now()}@example.com`,
    password: 'Test@123456',
    name: 'Test User',
    role: 'user'
  }),

  /**
   * Generate test courier data
   */
  createTestCourier: () => ({
    id: `courier-${Date.now()}`,
    name: `Courier ${Date.now()}`,
    email: `courier-${Date.now()}@example.com`,
    phone: '+966501234567',
    status: 'available',
    location: {
      latitude: 24.7136,
      longitude: 46.6753
    }
  }),

  /**
   * Generate test order data
   */
  createTestOrder: () => ({
    id: `order-${Date.now()}`,
    customerId: 'customer-123',
    pickupLocation: {
      latitude: 24.7136,
      longitude: 46.6753,
      address: 'Riyadh, Saudi Arabia'
    },
    deliveryLocation: {
      latitude: 24.7243,
      longitude: 46.6881,
      address: 'Olaya, Riyadh, Saudi Arabia'
    },
    priority: 'normal',
    status: 'pending',
    sla: {
      expectedDeliveryTime: new Date(Date.now() + 3600000).toISOString(),
      pickupTime: new Date().toISOString()
    }
  }),

  /**
   * Generate test vehicle data
   */
  createTestVehicle: () => ({
    id: `vehicle-${Date.now()}`,
    type: 'motorcycle',
    capacity: 20,
    currentLocation: {
      latitude: 24.7136,
      longitude: 46.6753
    },
    status: 'available',
    courierId: null
  }),

  /**
   * Wait for async operations
   */
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// Global test hooks
beforeAll(() => {
  // Setup global test resources
});

afterAll(() => {
  // Cleanup global test resources
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
});
