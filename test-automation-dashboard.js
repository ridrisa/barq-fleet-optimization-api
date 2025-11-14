#!/usr/bin/env node

/**
 * Test Script: Automation Dashboard Endpoint
 *
 * Purpose: Verify that the /api/v1/automation/dashboard endpoint
 *          returns 200 after fixing the schema issue
 *
 * Issue Fixed: route_optimizations table was missing created_at column
 * Migration: 003_add_created_at_to_route_optimizations.sql
 */

const http = require('http');

const API_BASE_URL = 'localhost';
const API_PORT = 3002;
const ENDPOINT = '/api/v1/automation/dashboard';

function testDashboardEndpoint() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_BASE_URL,
      port: API_PORT,
      path: ENDPOINT,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    console.log('\n🧪 Testing Automation Dashboard Endpoint');
    console.log('=' .repeat(60));
    console.log(`URL: http://${API_BASE_URL}:${API_PORT}${ENDPOINT}`);
    console.log('Expected: 200 OK with dashboard data');
    console.log('Previous Issue: 500 - column "created_at" does not exist');
    console.log('=' .repeat(60));

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`\n✅ Response Status: ${res.statusCode}`);

        try {
          const jsonData = JSON.parse(data);

          if (res.statusCode === 200) {
            console.log('\n✅ SUCCESS: Dashboard endpoint is working!');
            console.log('\n📊 Dashboard Summary:');
            console.log(JSON.stringify(jsonData.summary, null, 2));

            console.log('\n🤖 Engine Status:');
            console.log(JSON.stringify(jsonData.engines, null, 2));

            console.log('\n⚠️  Alerts:');
            console.log(JSON.stringify(jsonData.alerts, null, 2));

            console.log('\n📈 Today\'s Activity:');
            console.log(JSON.stringify(jsonData.today, null, 2));

            resolve({
              success: true,
              statusCode: res.statusCode,
              data: jsonData,
            });
          } else {
            console.log(`\n❌ FAILED: Expected 200 but got ${res.statusCode}`);
            console.log('\nError Response:');
            console.log(JSON.stringify(jsonData, null, 2));

            resolve({
              success: false,
              statusCode: res.statusCode,
              error: jsonData,
            });
          }
        } catch (error) {
          console.log('\n❌ FAILED: Invalid JSON response');
          console.log('Raw Response:', data);

          resolve({
            success: false,
            statusCode: res.statusCode,
            error: 'Invalid JSON response',
            rawData: data,
          });
        }
      });
    });

    req.on('error', (error) => {
      console.log('\n❌ REQUEST FAILED');
      console.log('Error:', error.message);
      console.log('\n⚠️  Make sure the backend server is running:');
      console.log('   cd backend && npm start');

      reject(error);
    });

    req.end();
  });
}

// Run the test
(async () => {
  try {
    const result = await testDashboardEndpoint();

    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULT:', result.success ? '✅ PASS' : '❌ FAIL');
    console.log('='.repeat(60) + '\n');

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.log('\n❌ Test execution failed:', error.message);
    process.exit(1);
  }
})();
