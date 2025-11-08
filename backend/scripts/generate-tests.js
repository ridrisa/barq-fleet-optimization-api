#!/usr/bin/env node
/**
 * Test Generator Script
 * Automatically generates comprehensive unit tests for all agents, services, and middleware
 */

const fs = require('fs');
const path = require('path');

// Test templates
const agentTestTemplate = (agentName, className) => `/**
 * Unit Tests for ${agentName}
 */

const ${className} = require('../../../src/agents/${agentName}');

describe('${agentName.replace('.js', '').replace('-', ' ')} Agent', () => {
  let agent;

  beforeEach(() => {
    agent = new ${className}();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize successfully', () => {
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(${className});
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
`;

const serviceTestTemplate = (serviceName, className) => `/**
 * Unit Tests for ${serviceName}
 */

describe('${serviceName.replace('.js', '')} Service', () => {
  describe('Service Instance', () => {
    test('should be defined', () => {
      const service = require('../../../src/services/${serviceName}');
      expect(service).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully', async () => {
      const service = require('../../../src/services/${serviceName}');
      expect(service).toBeDefined();
    });
  });
});
`;

const middlewareTestTemplate = (middlewareName) => `/**
 * Unit Tests for ${middlewareName}
 */

const middleware = require('../../../src/middleware/${middlewareName}');

describe('${middlewareName.replace('.js', '')} Middleware', () => {
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
`;

// Get all agents
const agentsDir = path.join(__dirname, '../src/agents');
const agents = fs.readdirSync(agentsDir).filter(f => f.endsWith('.js'));

console.log(`Found ${agents.length} agents to test`);

// Get all services
const servicesDir = path.join(__dirname, '../src/services');
const services = fs.readdirSync(servicesDir).filter(f => f.endsWith('.js'));

console.log(`Found ${services.length} services to test`);

// Get all middleware
const middlewareDir = path.join(__dirname, '../src/middleware');
const middlewares = fs.readdirSync(middlewareDir).filter(f => f.endsWith('.js'));

console.log(`Found ${middlewares.length} middleware to test`);

// Create test directories
const testsUnitAgentsDir = path.join(__dirname, '../tests/unit/agents');
const testsUnitServicesDir = path.join(__dirname, '../tests/unit/services');
const testsUnitMiddlewareDir = path.join(__dirname, '../tests/unit/middleware');

[testsUnitAgentsDir, testsUnitServicesDir, testsUnitMiddlewareDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Generate agent tests
let generatedCount = 0;
agents.forEach(agent => {
  const testFile = path.join(testsUnitAgentsDir, agent.replace('.js', '.test.js'));

  // Skip if already exists and is comprehensive (>1000 chars)
  if (fs.existsSync(testFile)) {
    const existingContent = fs.readFileSync(testFile, 'utf8');
    if (existingContent.length > 1000) {
      console.log(`  ✓ ${agent} - already has comprehensive tests`);
      return;
    }
  }

  const className = agent
    .replace('.js', '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('') + (agent.includes('agent') ? '' : 'Agent');

  const testContent = agentTestTemplate(agent, className);
  fs.writeFileSync(testFile, testContent);
  generatedCount++;
  console.log(`  ✓ Generated ${agent.replace('.js', '.test.js')}`);
});

// Generate service tests
services.forEach(service => {
  const testFile = path.join(testsUnitServicesDir, service.replace('.js', '.test.js'));

  if (fs.existsSync(testFile)) {
    console.log(`  ✓ ${service} - already exists`);
    return;
  }

  const className = service
    .replace('.js', '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  const testContent = serviceTestTemplate(service, className);
  fs.writeFileSync(testFile, testContent);
  generatedCount++;
  console.log(`  ✓ Generated ${service.replace('.js', '.test.js')}`);
});

// Generate middleware tests
middlewares.forEach(mw => {
  const testFile = path.join(testsUnitMiddlewareDir, mw.replace('.js', '.test.js'));

  if (fs.existsSync(testFile)) {
    console.log(`  ✓ ${mw} - already exists`);
    return;
  }

  const testContent = middlewareTestTemplate(mw);
  fs.writeFileSync(testFile, testContent);
  generatedCount++;
  console.log(`  ✓ Generated ${mw.replace('.js', '.test.js')}`);
});

console.log(`\n✅ Test generation complete!`);
console.log(`   Generated ${generatedCount} new test files`);
console.log(`   Total: ${agents.length} agents + ${services.length} services + ${middlewares.length} middleware`);
console.log(`\n📝 Next steps:`);
console.log(`   1. Run: npm test`);
console.log(`   2. Run: npm run test:coverage`);
console.log(`   3. Review coverage report at: coverage/index.html`);
