/**
 * API Versioning Test Script
 * Tests all versioning functionality including v1 endpoints, backward compatibility, and headers
 */

const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3003;

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Make HTTP request
 */
function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsed
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Test result reporter
 */
class TestReporter {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
  }

  test(name, passed, message = '') {
    this.tests.push({ name, passed, message });
    if (passed) {
      this.passed++;
      console.log(`${colors.green}✓${colors.reset} ${name}`);
      if (message) console.log(`  ${colors.cyan}${message}${colors.reset}`);
    } else {
      this.failed++;
      console.log(`${colors.red}✗${colors.reset} ${name}`);
      if (message) console.log(`  ${colors.red}${message}${colors.reset}`);
    }
  }

  summary() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${colors.cyan}Test Summary${colors.reset}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total Tests: ${this.passed + this.failed}`);
    console.log(`${colors.green}Passed: ${this.passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${this.failed}${colors.reset}`);
    console.log(`Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);
    console.log(`${'='.repeat(60)}\n`);

    return this.failed === 0;
  }
}

/**
 * Main test suite
 */
async function runTests() {
  const reporter = new TestReporter();

  console.log(`\n${colors.cyan}${'='.repeat(60)}`);
  console.log(`API Versioning Test Suite`);
  console.log(`${'='.repeat(60)}${colors.reset}\n`);

  try {
    // Test 1: Check if server is running
    console.log(`${colors.yellow}[1] Server Health Checks${colors.reset}`);
    try {
      const health = await makeRequest('/health');
      reporter.test(
        'Server is running',
        health.statusCode === 200,
        `Status: ${health.statusCode}`
      );
    } catch (error) {
      reporter.test('Server is running', false, `Error: ${error.message}`);
      console.log(`\n${colors.red}Cannot connect to server at ${BASE_URL}:${PORT}${colors.reset}`);
      console.log(`${colors.yellow}Please start the server with: npm run dev${colors.reset}\n`);
      return;
    }

    // Test 2: API Root
    console.log(`\n${colors.yellow}[2] API Root Endpoints${colors.reset}`);
    const apiRoot = await makeRequest('/api');
    reporter.test(
      'GET /api returns API information',
      apiRoot.statusCode === 200 && apiRoot.body.currentVersion === 'v1',
      `Current version: ${apiRoot.body.currentVersion}`
    );

    // Test 3: Version Information
    const versions = await makeRequest('/api/versions');
    reporter.test(
      'GET /api/versions returns version details',
      versions.statusCode === 200 && versions.body.versions,
      `Supported versions: ${versions.body.supportedVersions?.join(', ')}`
    );

    // Test 4: Version Headers
    console.log(`\n${colors.yellow}[3] Version Headers${colors.reset}`);
    reporter.test(
      'Response includes X-API-Version header',
      apiRoot.headers['x-api-version'] === 'v1',
      `Header value: ${apiRoot.headers['x-api-version']}`
    );

    reporter.test(
      'Response includes X-API-Versions-Supported header',
      apiRoot.headers['x-api-versions-supported']?.includes('v1'),
      `Supported: ${apiRoot.headers['x-api-versions-supported']}`
    );

    // Test 5: V1 Endpoints
    console.log(`\n${colors.yellow}[4] V1 Endpoints${colors.reset}`);

    const v1Root = await makeRequest('/api/v1');
    reporter.test(
      'GET /api/v1 returns v1 information',
      v1Root.statusCode === 200 && v1Root.body.version === 'v1',
      `Version: ${v1Root.body.version}, Status: ${v1Root.body.status}`
    );

    // Test 6: Versioned Route Examples
    console.log(`\n${colors.yellow}[5] Versioned Route Tests${colors.reset}`);

    // Test health endpoint (v1)
    const v1Health = await makeRequest('/api/v1/health/status');
    reporter.test(
      'GET /api/v1/health/status works',
      v1Health.statusCode === 200 || v1Health.statusCode === 503,
      `Status: ${v1Health.statusCode}`
    );

    // Test 7: Backward Compatibility
    console.log(`\n${colors.yellow}[6] Backward Compatibility${colors.reset}`);

    const unversionedHealth = await makeRequest('/api/health/status');
    reporter.test(
      'Unversioned /api/health/status still works',
      unversionedHealth.statusCode === 200 || unversionedHealth.statusCode === 503,
      `Status: ${unversionedHealth.statusCode}`
    );

    reporter.test(
      'Unversioned route includes deprecation header',
      unversionedHealth.headers['x-api-unversioned-access'] === 'true',
      `Deprecation header: ${unversionedHealth.headers['x-api-unversioned-access']}`
    );

    reporter.test(
      'Unversioned route includes Warning header',
      unversionedHealth.headers['warning']?.includes('deprecated'),
      `Warning: ${unversionedHealth.headers['warning']?.substring(0, 50)}...`
    );

    // Test 8: Invalid Version
    console.log(`\n${colors.yellow}[7] Invalid Version Handling${colors.reset}`);

    const invalidVersion = await makeRequest('/api/v99/optimize');
    reporter.test(
      'Invalid version returns 400',
      invalidVersion.statusCode === 400,
      `Status: ${invalidVersion.statusCode}`
    );

    reporter.test(
      'Invalid version error message is clear',
      invalidVersion.body.error?.includes('not supported'),
      `Error: ${invalidVersion.body.error}`
    );

    // Test 9: Version Consistency
    console.log(`\n${colors.yellow}[8] Version Consistency${colors.reset}`);

    const endpoints = [
      '/api/v1',
      '/api/v1/health/status'
    ];

    for (const endpoint of endpoints) {
      const response = await makeRequest(endpoint);
      reporter.test(
        `${endpoint} includes version headers`,
        response.headers['x-api-version'] === 'v1',
        `Version: ${response.headers['x-api-version']}`
      );
    }

    // Test 10: Routes Structure
    console.log(`\n${colors.yellow}[9] Routes Structure Validation${colors.reset}`);

    const v1Info = await makeRequest('/api/v1');
    const expectedEndpoints = ['auth', 'optimize', 'agents', 'admin', 'autonomous', 'health'];

    if (v1Info.body.endpoints) {
      const hasAllEndpoints = expectedEndpoints.every(ep =>
        Object.values(v1Info.body.endpoints).some(url => url.includes(ep))
      );

      reporter.test(
        'V1 includes all expected endpoint categories',
        hasAllEndpoints,
        `Found endpoints: ${Object.keys(v1Info.body.endpoints).join(', ')}`
      );
    }

  } catch (error) {
    console.error(`\n${colors.red}Test suite error: ${error.message}${colors.reset}`);
    console.error(error.stack);
  }

  // Print summary
  const success = reporter.summary();

  if (success) {
    console.log(`${colors.green}✓ All versioning tests passed!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}✗ Some tests failed. Please review the output above.${colors.reset}\n`);
    process.exit(1);
  }
}

// Run tests
console.log(`${colors.cyan}Starting API Versioning Tests...${colors.reset}`);
console.log(`${colors.cyan}Target: ${BASE_URL}:${PORT}${colors.reset}\n`);

runTests().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});
