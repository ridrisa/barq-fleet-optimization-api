/**
 * Test script for new production-metrics endpoints
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3002/api/v1/production-metrics';

async function testEndpoint(name, path) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`Endpoint: GET ${path}`);
  console.log('='.repeat(60));

  const startTime = Date.now();

  try {
    const response = await axios.get(path, { timeout: 15000 });
    const duration = Date.now() - startTime;

    console.log(`✓ Status: ${response.status} ${response.statusText}`);
    console.log(`✓ Duration: ${duration}ms`);
    console.log(`✓ Success: ${response.data.success}`);

    if (response.data.data) {
      console.log(`\n📊 Response Data Structure:`);
      console.log(JSON.stringify(response.data.data, null, 2).slice(0, 500) + '...');
    }

    return { success: true, status: response.status, duration, data: response.data };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`✗ Failed after ${duration}ms`);

    if (error.response) {
      console.log(`✗ Status: ${error.response.status}`);
      console.log(`✗ Error: ${error.response.data.error || error.response.data.message}`);
      console.log(`✗ Details:`, JSON.stringify(error.response.data, null, 2));
      return { success: false, status: error.response.status, error: error.response.data };
    } else if (error.code === 'ECONNABORTED') {
      console.log(`✗ Request timed out`);
      return { success: false, error: 'Timeout' };
    } else {
      console.log(`✗ Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

async function runTests() {
  console.log('\n🧪 Testing New Production Metrics Endpoints');
  console.log('='.repeat(60));

  const tests = [
    { name: 'Fleet Performance', path: `${BASE_URL}/fleet-performance` },
    { name: 'Driver Efficiency', path: `${BASE_URL}/driver-efficiency` },
    { name: 'On-Time Delivery (existing)', path: `${BASE_URL}/on-time-delivery` },
  ];

  const results = [];

  for (const test of tests) {
    const result = await testEndpoint(test.name, test.path);
    results.push({ ...test, ...result });
  }

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));

  results.forEach(result => {
    const status = result.success ? '✓ PASS' : '✗ FAIL';
    const statusCode = result.status || 'N/A';
    const duration = result.duration ? `${result.duration}ms` : 'N/A';
    console.log(`${status} | ${result.name.padEnd(30)} | ${statusCode} | ${duration}`);
  });

  const passCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${results.length} | Passed: ${passCount} | Failed: ${failCount}`);
  console.log('='.repeat(60));

  process.exit(failCount > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
