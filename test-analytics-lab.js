#!/usr/bin/env node

/**
 * Analytics Lab Integration Test
 *
 * Tests all 4 Python analytics scripts through the backend API
 */

const axios = require('axios');
const colors = require('colors');

const API_BASE = 'http://localhost:3003/api/v1/analytics-lab';
const MAX_POLL_TIME = 120000; // 2 minutes max
const POLL_INTERVAL = 2000; // 2 seconds

// Test results storage
const testResults = {
  timestamp: new Date().toISOString(),
  endpoints: [],
  summary: {
    total: 4,
    passed: 0,
    failed: 0
  }
};

/**
 * Sleep helper
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Poll job until completion
 */
async function pollJob(jobId, timeout = MAX_POLL_TIME) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await axios.get(`${API_BASE}/job/${jobId}`);
      const job = response.data.job;

      if (job.status === 'completed') {
        return { success: true, job };
      } else if (job.status === 'failed') {
        return { success: false, job, error: job.error };
      }

      // Still running, wait and retry
      await sleep(POLL_INTERVAL);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: 'Timeout waiting for job completion' };
}

/**
 * Test route analysis endpoint
 */
async function testRouteAnalysis() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: Route Analysis'.cyan.bold);
  console.log('='.repeat(60));

  const testCase = {
    name: 'Route Analysis',
    endpoint: '/run/route-analysis',
    params: {
      analysis_type: 'efficiency',
      date_range: 30,
      output: 'json'
    }
  };

  try {
    console.log('Sending request...'.yellow);
    const response = await axios.post(
      `${API_BASE}${testCase.endpoint}`,
      testCase.params
    );

    console.log(`Response:`.cyan, JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.jobId) {
      console.log(`Job started: ${response.data.jobId}`.green);
      console.log('Polling for completion...'.yellow);

      const result = await pollJob(response.data.jobId);

      if (result.success) {
        console.log('✓ PASSED'.green.bold);
        testCase.status = 'PASSED';
        testCase.jobId = response.data.jobId;
        testCase.result = result.job.result;
        testResults.summary.passed++;
      } else {
        console.log('✗ FAILED'.red.bold);
        console.log('Error:'.red, result.error || result.job?.error);
        testCase.status = 'FAILED';
        testCase.error = result.error || result.job?.error;
        testResults.summary.failed++;
      }
    } else {
      throw new Error('No jobId in response');
    }
  } catch (error) {
    console.log('✗ FAILED'.red.bold);
    console.log('Error:'.red, error.message);
    testCase.status = 'FAILED';
    testCase.error = error.message;
    testResults.summary.failed++;
  }

  testResults.endpoints.push(testCase);
}

/**
 * Test fleet performance endpoint
 */
async function testFleetPerformance() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Fleet Performance'.cyan.bold);
  console.log('='.repeat(60));

  const testCase = {
    name: 'Fleet Performance',
    endpoint: '/run/fleet-performance',
    params: {
      analysis_type: 'driver',
      metric: 'delivery_rate',
      period: 'monthly',
      output: 'json'
    }
  };

  try {
    console.log('Sending request...'.yellow);
    const response = await axios.post(
      `${API_BASE}${testCase.endpoint}`,
      testCase.params
    );

    console.log(`Response:`.cyan, JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.jobId) {
      console.log(`Job started: ${response.data.jobId}`.green);
      console.log('Polling for completion...'.yellow);

      const result = await pollJob(response.data.jobId);

      if (result.success) {
        console.log('✓ PASSED'.green.bold);
        testCase.status = 'PASSED';
        testCase.jobId = response.data.jobId;
        testCase.result = result.job.result;
        testResults.summary.passed++;
      } else {
        console.log('✗ FAILED'.red.bold);
        console.log('Error:'.red, result.error || result.job?.error);
        testCase.status = 'FAILED';
        testCase.error = result.error || result.job?.error;
        testResults.summary.failed++;
      }
    } else {
      throw new Error('No jobId in response');
    }
  } catch (error) {
    console.log('✗ FAILED'.red.bold);
    console.log('Error:'.red, error.message);
    testCase.status = 'FAILED';
    testCase.error = error.message;
    testResults.summary.failed++;
  }

  testResults.endpoints.push(testCase);
}

/**
 * Test demand forecast endpoint
 */
async function testDemandForecast() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: Demand Forecast'.cyan.bold);
  console.log('='.repeat(60));

  const testCase = {
    name: 'Demand Forecast',
    endpoint: '/run/demand-forecast',
    params: {
      forecast_type: 'daily',
      horizon: 7,
      output: 'json'
    }
  };

  try {
    console.log('Sending request...'.yellow);
    const response = await axios.post(
      `${API_BASE}${testCase.endpoint}`,
      testCase.params
    );

    console.log(`Response:`.cyan, JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.jobId) {
      console.log(`Job started: ${response.data.jobId}`.green);
      console.log('Polling for completion...'.yellow);

      const result = await pollJob(response.data.jobId);

      if (result.success) {
        console.log('✓ PASSED'.green.bold);
        testCase.status = 'PASSED';
        testCase.jobId = response.data.jobId;
        testCase.result = result.job.result;
        testResults.summary.passed++;
      } else {
        console.log('✗ FAILED'.red.bold);
        console.log('Error:'.red, result.error || result.job?.error);
        testCase.status = 'FAILED';
        testCase.error = result.error || result.job?.error;
        testResults.summary.failed++;
      }
    } else {
      throw new Error('No jobId in response');
    }
  } catch (error) {
    console.log('✗ FAILED'.red.bold);
    console.log('Error:'.red, error.message);
    testCase.status = 'FAILED';
    testCase.error = error.message;
    testResults.summary.failed++;
  }

  testResults.endpoints.push(testCase);
}

/**
 * Test SLA analysis endpoint
 */
async function testSLAAnalysis() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: SLA Analysis'.cyan.bold);
  console.log('='.repeat(60));

  const testCase = {
    name: 'SLA Analysis',
    endpoint: '/run/sla-analysis',
    params: {
      analysis_type: 'compliance',
      date_range: 30,
      output: 'json'
    }
  };

  try {
    console.log('Sending request...'.yellow);
    const response = await axios.post(
      `${API_BASE}${testCase.endpoint}`,
      testCase.params
    );

    console.log(`Response:`.cyan, JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.jobId) {
      console.log(`Job started: ${response.data.jobId}`.green);
      console.log('Polling for completion...'.yellow);

      const result = await pollJob(response.data.jobId);

      if (result.success) {
        console.log('✓ PASSED'.green.bold);
        testCase.status = 'PASSED';
        testCase.jobId = response.data.jobId;
        testCase.result = result.job.result;
        testResults.summary.passed++;
      } else {
        console.log('✗ FAILED'.red.bold);
        console.log('Error:'.red, result.error || result.job?.error);
        testCase.status = 'FAILED';
        testCase.error = result.error || result.job?.error;
        testResults.summary.failed++;
      }
    } else {
      throw new Error('No jobId in response');
    }
  } catch (error) {
    console.log('✗ FAILED'.red.bold);
    console.log('Error:'.red, error.message);
    testCase.status = 'FAILED';
    testCase.error = error.message;
    testResults.summary.failed++;
  }

  testResults.endpoints.push(testCase);
}

/**
 * Print final report
 */
function printReport() {
  console.log('\n' + '='.repeat(60));
  console.log('FINAL TEST REPORT'.cyan.bold);
  console.log('='.repeat(60));

  console.log(`\nTotal Tests: ${testResults.summary.total}`);
  console.log(`Passed: ${testResults.summary.passed}`.green);
  console.log(`Failed: ${testResults.summary.failed}`.red);
  console.log(`Success Rate: ${((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1)}%`);

  console.log('\nDetailed Results:'.cyan.bold);
  testResults.endpoints.forEach((test, index) => {
    const statusIcon = test.status === 'PASSED' ? '✓'.green : '✗'.red;
    console.log(`\n${index + 1}. ${statusIcon} ${test.name}`);
    console.log(`   Endpoint: ${test.endpoint}`);
    console.log(`   Status: ${test.status}`);
    if (test.jobId) {
      console.log(`   Job ID: ${test.jobId}`);
    }
    if (test.error) {
      console.log(`   Error: ${test.error}`.red);
    }
    if (test.result) {
      console.log(`   Result keys: ${Object.keys(test.result).join(', ')}`);
    }
  });

  // Save results to file
  const fs = require('fs');
  fs.writeFileSync(
    '/Users/ramiz_new/Desktop/AI-Route-Optimization-API/analytics-lab-test-results.json',
    JSON.stringify(testResults, null, 2)
  );

  console.log('\n✓ Results saved to analytics-lab-test-results.json'.green);
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('Analytics Lab Integration Test Suite'.cyan.bold);
  console.log(`API Base URL: ${API_BASE}`.gray);
  console.log(`Started: ${new Date().toISOString()}`.gray);

  try {
    await testRouteAnalysis();
    await testFleetPerformance();
    await testDemandForecast();
    await testSLAAnalysis();
  } catch (error) {
    console.error('Unexpected error:'.red, error);
  }

  printReport();

  // Exit with appropriate code
  process.exit(testResults.summary.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests();
