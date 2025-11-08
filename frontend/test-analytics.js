#!/usr/bin/env node

/**
 * BARQ Fleet Analytics - Frontend Accessibility Test
 *
 * This script tests all analytics endpoints to ensure they are accessible
 * from the frontend application.
 */

const ANALYTICS_URL = 'https://barq-fleet-analytics-426674819922.us-central1.run.app';

// Color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

const testEndpoints = [
  {
    name: 'Health Check',
    url: '/health',
    method: 'GET',
    expectedStatus: 200,
  },
  {
    name: 'SLA Realtime Status',
    url: '/api/sla/realtime',
    method: 'GET',
    expectedStatus: 200,
  },
  {
    name: 'SLA Compliance (7 days)',
    url: '/api/sla/compliance?days=7',
    method: 'GET',
    expectedStatus: 200,
  },
  {
    name: 'SLA Trend (30 days)',
    url: '/api/sla/trend?days=30',
    method: 'GET',
    expectedStatus: 200,
  },
  {
    name: 'Driver Performance (Monthly)',
    url: '/api/drivers/performance?period=monthly',
    method: 'GET',
    expectedStatus: 200,
  },
  {
    name: 'Top Drivers',
    url: '/api/drivers/top?limit=10',
    method: 'GET',
    expectedStatus: 200,
  },
  {
    name: 'Route Efficiency (30 days)',
    url: '/api/routes/efficiency?days=30',
    method: 'GET',
    expectedStatus: 200,
  },
  {
    name: 'Daily Demand Forecast (7 days)',
    url: '/api/demand/forecast/daily?days=7',
    method: 'GET',
    expectedStatus: 200,
  },
  {
    name: 'Vehicle Performance (Monthly)',
    url: '/api/vehicles/performance?period=monthly',
    method: 'GET',
    expectedStatus: 200,
  },
];

async function testEndpoint(endpoint) {
  const fullUrl = `${ANALYTICS_URL}${endpoint.url}`;

  try {
    const startTime = Date.now();
    const response = await fetch(fullUrl, {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const duration = Date.now() - startTime;

    const status = response.status;
    const success = status === endpoint.expectedStatus || status === 200;

    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = await response.text();
    }

    return {
      name: endpoint.name,
      url: endpoint.url,
      success,
      status,
      duration,
      data: typeof data === 'object' ? JSON.stringify(data).substring(0, 100) : data.substring(0, 100),
    };
  } catch (error) {
    return {
      name: endpoint.name,
      url: endpoint.url,
      success: false,
      status: 0,
      duration: 0,
      error: error.message,
    };
  }
}

async function runAllTests() {
  console.log(`${colors.bold}${colors.blue}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}║  BARQ Fleet Analytics - Frontend Accessibility Test           ║${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}╚════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  console.log(`${colors.yellow}Testing Analytics Service: ${colors.reset}${ANALYTICS_URL}\n`);

  const results = [];

  for (const endpoint of testEndpoints) {
    process.stdout.write(`Testing: ${endpoint.name}...`);
    const result = await testEndpoint(endpoint);
    results.push(result);

    if (result.success) {
      console.log(` ${colors.green}✓ PASS${colors.reset} (${result.duration}ms)`);
    } else {
      console.log(` ${colors.red}✗ FAIL${colors.reset} (${result.error || `Status: ${result.status}`})`);
    }
  }

  // Summary
  const passCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  const avgDuration = Math.round(
    results.reduce((sum, r) => sum + r.duration, 0) / results.length
  );

  console.log(`\n${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}Test Summary:${colors.reset}`);
  console.log(`  ${colors.green}Passed:${colors.reset} ${passCount}/${testEndpoints.length}`);
  console.log(`  ${colors.red}Failed:${colors.reset} ${failCount}/${testEndpoints.length}`);
  console.log(`  ${colors.yellow}Average Response Time:${colors.reset} ${avgDuration}ms`);
  console.log(`${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

  if (failCount > 0) {
    console.log(`${colors.red}${colors.bold}Failed Tests:${colors.reset}`);
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  ${colors.red}✗${colors.reset} ${r.name}`);
        console.log(`    URL: ${r.url}`);
        console.log(`    Error: ${r.error || `Unexpected status: ${r.status}`}`);
      });
    console.log();
  }

  // CORS Test
  console.log(`${colors.blue}${colors.bold}Testing CORS Configuration...${colors.reset}`);
  try {
    const corsResponse = await fetch(`${ANALYTICS_URL}/health`, {
      method: 'OPTIONS',
    });
    const corsHeaders = corsResponse.headers.get('access-control-allow-origin');
    if (corsHeaders) {
      console.log(`  ${colors.green}✓${colors.reset} CORS is configured: ${corsHeaders}`);
    } else {
      console.log(`  ${colors.yellow}⚠${colors.reset} CORS headers not found (may still work)`);
    }
  } catch (error) {
    console.log(`  ${colors.red}✗${colors.reset} CORS test failed: ${error.message}`);
  }

  console.log();

  // Frontend Integration Instructions
  if (passCount === testEndpoints.length) {
    console.log(`${colors.green}${colors.bold}✓ All tests passed! Frontend integration ready.${colors.reset}\n`);
    console.log(`${colors.blue}Next Steps:${colors.reset}`);
    console.log(`  1. Copy environment file: ${colors.yellow}cp .env.analytics.example .env.local${colors.reset}`);
    console.log(`  2. Start dev server: ${colors.yellow}npm run dev${colors.reset}`);
    console.log(`  3. Visit: ${colors.yellow}http://localhost:3000/analytics${colors.reset}\n`);
  } else {
    console.log(`${colors.red}${colors.bold}⚠ Some tests failed. Please check the service logs.${colors.reset}\n`);
    console.log(`${colors.blue}Troubleshooting:${colors.reset}`);
    console.log(`  1. Check service status: ${colors.yellow}gcloud run services describe barq-fleet-analytics --region=us-central1${colors.reset}`);
    console.log(`  2. View logs: ${colors.yellow}gcloud run logs read barq-fleet-analytics --region=us-central1${colors.reset}`);
    console.log(`  3. Verify database connection in Cloud Run environment variables\n`);
  }

  return passCount === testEndpoints.length ? 0 : 1;
}

// Run tests
runAllTests()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error(`${colors.red}${colors.bold}Fatal Error:${colors.reset} ${error.message}`);
    process.exit(1);
  });
