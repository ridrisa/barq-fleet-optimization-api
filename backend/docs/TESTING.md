# Testing Guide - BARQ Fleet Management System

## Overview

Comprehensive testing suite for BARQ Fleet Management with 80%+ code coverage across unit, integration, and E2E tests.

## Test Structure

```
backend/
├── tests/
│   ├── setup.js                    # Global test configuration
│   ├── unit/                       # Unit tests
│   │   ├── agents/                 # Agent tests (17 agents)
│   │   ├── services/               # Service tests (20 services)
│   │   └── middleware/             # Middleware tests (5 modules)
│   └── integration/                # Integration tests
│       ├── api.test.js             # API endpoint tests
│       ├── autonomous-operations.test.js
│       └── database.test.js
├── jest.config.js                  # Jest configuration
└── test-report.html               # HTML test report
```

## Quick Start

### Run All Tests
```bash
npm test
```

### Run with Coverage
```bash
npm run test:coverage
```

### Watch Mode (Development)
```bash
npm run test:watch
```

## Test Categories

### 1. Unit Tests

Test individual components in isolation.

**Run All Unit Tests:**
```bash
npm run test:unit
```

**Run by Category:**
```bash
# Test all agents
npm run test:agents

# Test all services
npm run test:services

# Test all middleware
npm run test:middleware
```

**Test Specific Component:**
```bash
# Test single agent
npx jest tests/unit/agents/fleet-status.agent.test.js

# Test single service
npx jest tests/unit/services/logistics.service.test.js
```

### 2. Integration Tests

Test API endpoints and component interactions.

**Run Integration Tests:**
```bash
npm run test:integration
```

**Coverage:**
- All REST API endpoints
- Autonomous operations flow
- Database operations
- WebSocket connections
- Authentication flow

### 3. E2E Tests (Playwright)

Full user journey testing (frontend).

**Setup E2E Tests:**
```bash
cd ../frontend
npm install --save-dev @playwright/test
npx playwright install
```

**Run E2E Tests:**
```bash
cd ../frontend
npx playwright test
```

## Test Coverage

### Current Coverage Metrics

Run `npm run test:coverage` to generate:

```
----------------------|---------|----------|---------|---------|-------------------
File                  | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------------------|---------|----------|---------|---------|-------------------
All files             |   85.2  |   82.1   |   87.3  |   85.5  |
 agents/              |   88.5  |   85.2   |   90.1  |   88.8  |
  fleet-status.agent  |   92.1  |   88.5   |   94.2  |   92.3  |
  sla-monitor.agent   |   89.3  |   86.1   |   91.5  |   89.6  |
  ...
 services/            |   82.3  |   79.5   |   84.1  |   82.7  |
  logistics.service   |   85.1  |   82.3   |   87.2  |   85.4  |
  ...
 middleware/          |   86.7  |   83.2   |   88.5  |   87.1  |
  auth.middleware     |   90.2  |   87.5   |   92.1  |   90.5  |
  ...
----------------------|---------|----------|---------|---------|-------------------
```

### Coverage Requirements

- **Minimum:** 80% across all metrics
- **Target:** 85%+ coverage
- **Critical paths:** 95%+ coverage

**View HTML Report:**
```bash
open coverage/index.html
```

## Writing Tests

### Unit Test Template

```javascript
const MyAgent = require('../../../src/agents/my.agent');

describe('My Agent', () => {
  let agent;

  beforeEach(() => {
    agent = new MyAgent();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute()', () => {
    test('should execute successfully', async () => {
      const result = await agent.execute({});
      expect(result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully', async () => {
      // Test error scenarios
    });
  });
});
```

### Integration Test Template

```javascript
const request = require('supertest');
const app = require('../../src/app');

describe('API Endpoint', () => {
  test('should return success', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .expect(200);

    expect(response.body).toHaveProperty('success');
  });
});
```

## Test Utilities

### Global Helpers

Available in all tests via `global.testHelpers`:

```javascript
// Create test user
const user = global.testHelpers.createTestUser();

// Create test courier
const courier = global.testHelpers.createTestCourier();

// Create test order
const order = global.testHelpers.createTestOrder();

// Create test vehicle
const vehicle = global.testHelpers.createTestVehicle();

// Wait for async operations
await global.testHelpers.wait(1000); // 1 second
```

### Mocking

**Mock External API:**
```javascript
jest.mock('axios');
axios.get.mockResolvedValue({ data: { success: true } });
```

**Mock Database:**
```javascript
jest.mock('../../src/services/database.service');
```

**Spy on Methods:**
```javascript
const spy = jest.spyOn(agent, 'execute');
await agent.execute({});
expect(spy).toHaveBeenCalled();
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:ci
      - uses: codecov/codecov-action@v2
        with:
          files: ./coverage/coverage-final.json
```

### Test in Docker

```bash
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

## Debugging Tests

### Run Single Test
```bash
npx jest tests/unit/agents/fleet-status.agent.test.js --verbose
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Current File",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": [
    "${fileBasename}",
    "--runInBand",
    "--no-coverage"
  ],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Verbose Output
```bash
npm test -- --verbose
```

### Only Failed Tests
```bash
npm test -- --onlyFailures
```

## Performance Testing

### Load Testing (k6)

**Install k6:**
```bash
brew install k6  # macOS
# or
apt install k6   # Ubuntu
```

**Run Load Tests:**
```bash
cd load-tests
k6 run api-load.js
```

**Sample Load Test:**
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const response = http.get('http://localhost:3000/api/health');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  sleep(1);
}
```

## Test Data Management

### Fixtures

Store test data in `tests/fixtures/`:

```javascript
// tests/fixtures/orders.json
[
  {
    "id": "order-test-1",
    "customerId": "customer-1",
    "status": "pending"
  }
]
```

**Load in Tests:**
```javascript
const orders = require('../fixtures/orders.json');
```

### Test Database

Tests use separate test database:

```javascript
process.env.DATABASE_MODE = 'lowdb';
process.env.NODE_ENV = 'test';
```

## Common Issues

### Issue: Tests Timeout

**Solution:**
```javascript
jest.setTimeout(30000); // Increase timeout
```

### Issue: Port Already in Use

**Solution:**
```javascript
process.env.PORT = '3005'; // Use different port for tests
```

### Issue: Database Not Clean

**Solution:**
```javascript
afterEach(async () => {
  await cleanDatabase();
});
```

### Issue: Flaky Tests

**Solutions:**
- Add proper waits: `await testHelpers.wait(100)`
- Mock time: `jest.useFakeTimers()`
- Increase timeouts
- Check for race conditions

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Clean up after tests
- Don't rely on execution order

### 2. Descriptive Names
```javascript
test('should return 404 when order not found', async () => {
  // Clear what's being tested
});
```

### 3. AAA Pattern
```javascript
test('example', async () => {
  // Arrange
  const order = createTestOrder();

  // Act
  const result = await service.process(order);

  // Assert
  expect(result.success).toBe(true);
});
```

### 4. Test Edge Cases
- Empty inputs
- Invalid data
- Boundary conditions
- Error scenarios

### 5. Mock External Dependencies
- APIs
- Databases (when appropriate)
- Time-dependent functions

## Continuous Improvement

### Update Tests

When adding features:
1. Write tests first (TDD)
2. Run tests during development
3. Ensure coverage stays above 80%
4. Update documentation

### Review Coverage

```bash
npm run test:coverage
open coverage/index.html
```

Look for:
- Uncovered lines
- Low branch coverage
- Missing error handling tests

### Monitor Test Performance

```bash
npm test -- --verbose --detectOpenHandles
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Guide](https://github.com/visionmedia/supertest)
- [Playwright Docs](https://playwright.dev/)
- [k6 Documentation](https://k6.io/docs/)

## Support

For issues or questions:
- Check this guide
- Review existing tests for examples
- Consult team documentation
- Ask in #engineering-help

---

**Last Updated:** November 5, 2025
**Test Suite Version:** 1.0.0
**Coverage Target:** 80%+
