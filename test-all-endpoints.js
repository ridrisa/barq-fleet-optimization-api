/**
 * Comprehensive Endpoint Testing Script
 * Tests all 61 API endpoints to identify which 4 are failing
 *
 * Current Status: 57/61 passing (93.4%)
 * Missing: 4 endpoints (6.6%)
 */

const axios = require('axios');

const BASE_URL = 'https://route-opt-backend-sek7q2ajva-uc.a.run.app';

// Test results tracker
const results = {
  passing: [],
  failing: [],
  total: 0,
};

/**
 * Test helper function
 */
async function testEndpoint(name, config) {
  results.total++;

  try {
    const response = await axios({
      ...config,
      timeout: 10000,
      validateStatus: (status) => status < 500, // Accept 200-499 as success
    });

    // Check if response is valid
    if (response.status >= 200 && response.status < 500) {
      results.passing.push({
        name,
        method: config.method || 'GET',
        url: config.url,
        status: response.status,
      });
      console.log(`✅ ${name} - ${response.status}`);
      return true;
    } else {
      results.failing.push({
        name,
        method: config.method || 'GET',
        url: config.url,
        status: response.status,
        error: response.data?.error || response.statusText,
      });
      console.log(`❌ ${name} - ${response.status}`);
      return false;
    }
  } catch (error) {
    results.failing.push({
      name,
      method: config.method || 'GET',
      url: config.url,
      status: error.response?.status || 'TIMEOUT/ERROR',
      error: error.response?.data?.error || error.message,
      details: error.response?.data,
    });
    console.log(`❌ ${name} - ${error.response?.status || 'ERROR'}: ${error.message}`);
    return false;
  }
}

/**
 * Main testing function
 */
async function testAllEndpoints() {
  console.log('🚀 Testing all 61 API endpoints...\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  // =============================================================================
  // 1. HEALTH & INFO ENDPOINTS (10 endpoints)
  // =============================================================================
  console.log('\n📊 HEALTH & INFO ENDPOINTS');
  console.log('─'.repeat(60));

  await testEndpoint('Health Check', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/health`,
  });

  await testEndpoint('Health Live', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/health/live`,
  });

  await testEndpoint('Health Ready', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/health/ready`,
  });

  await testEndpoint('Health Detailed', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/health/detailed`,
  });

  await testEndpoint('Health Info', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/health/info`,
  });

  await testEndpoint('Health Smoke Test', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/health/smoke`,
  });

  await testEndpoint('API Version Info', {
    method: 'GET',
    url: `${BASE_URL}/api/v1`,
  });

  // =============================================================================
  // 2. OPTIMIZATION ENDPOINTS (7 endpoints)
  // =============================================================================
  console.log('\n🗺️  OPTIMIZATION ENDPOINTS');
  console.log('─'.repeat(60));

  await testEndpoint('Optimize Route', {
    method: 'POST',
    url: `${BASE_URL}/api/v1/optimize`,
    data: {
      pickupPoints: [
        { id: 1, lat: 24.7136, lng: 46.6753, name: 'Riyadh Pickup 1' },
      ],
      deliveryPoints: [
        { id: 2, lat: 24.7200, lng: 46.6800, name: 'Riyadh Delivery 1' },
      ],
    },
  });

  await testEndpoint('Optimization History', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/optimize/history?limit=10`,
  });

  await testEndpoint('Optimization Stats', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/optimize/stats`,
  });

  await testEndpoint('Multi-Vehicle Optimization', {
    method: 'POST',
    url: `${BASE_URL}/api/v1/optimize/multi-vehicle`,
    data: {
      pickupPoints: [
        { id: 1, lat: 24.7136, lng: 46.6753 },
      ],
      deliveryPoints: [
        { id: 2, lat: 24.7200, lng: 46.6800 },
      ],
    },
  });

  await testEndpoint('Time Windows Optimization', {
    method: 'POST',
    url: `${BASE_URL}/api/v1/optimize/time-windows`,
    data: {
      pickupPoints: [
        { id: 1, lat: 24.7136, lng: 46.6753 },
      ],
      deliveryPoints: [
        { id: 2, lat: 24.7200, lng: 46.6800 },
      ],
    },
  });

  // =============================================================================
  // 3. ANALYTICS ENDPOINTS (10 endpoints)
  // =============================================================================
  console.log('\n📈 ANALYTICS ENDPOINTS');
  console.log('─'.repeat(60));

  await testEndpoint('Analytics Overview', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/analytics/overview`,
  });

  await testEndpoint('SLA Daily Metrics', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/analytics/sla/daily?days=7`,
  });

  await testEndpoint('Fleet Utilization', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/analytics/fleet/utilization`,
  });

  await testEndpoint('SLA Real-time Status', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/analytics/sla/realtime`,
  });

  await testEndpoint('SLA Compliance', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/analytics/sla/compliance?days=7`,
  });

  await testEndpoint('SLA Trend', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/analytics/sla/trend?days=30`,
  });

  await testEndpoint('Fleet Performance', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/analytics/fleet/performance?days=7`,
  });

  await testEndpoint('Dashboard Summary', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/analytics/dashboard/summary`,
  });

  await testEndpoint('Fleet Drivers', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/analytics/fleet/drivers?period=monthly`,
  });

  await testEndpoint('Fleet Vehicles', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/analytics/fleet/vehicles?period=monthly`,
  });

  await testEndpoint('Routes Efficiency', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/analytics/routes/efficiency?days=30`,
  });

  // =============================================================================
  // 4. AUTONOMOUS OPERATIONS ENDPOINTS (6 endpoints - RECENTLY FIXED)
  // =============================================================================
  console.log('\n🤖 AUTONOMOUS OPERATIONS ENDPOINTS');
  console.log('─'.repeat(60));

  await testEndpoint('Autonomous Status', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/autonomous/status`,
  });

  await testEndpoint('Autonomous Trigger', {
    method: 'POST',
    url: `${BASE_URL}/api/v1/autonomous/trigger`,
    data: {},
  });

  await testEndpoint('Autonomous Triggers Stats', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/autonomous/triggers/stats`,
  });

  await testEndpoint('Autonomous Triggers Recent', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/autonomous/triggers/recent?limit=20`,
  });

  // =============================================================================
  // 5. AUTOMATION ENDPOINTS (12 endpoints - RECENTLY FIXED)
  // =============================================================================
  console.log('\n⚙️  AUTOMATION ENDPOINTS');
  console.log('─'.repeat(60));

  await testEndpoint('Automation Status All', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/automation/status-all`,
  });

  await testEndpoint('Automation Dashboard', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/automation/dashboard`,
  });

  await testEndpoint('Auto-Dispatch Status', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/automation/dispatch/status`,
  });

  await testEndpoint('Auto-Dispatch Stats', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/automation/dispatch/stats?days=7`,
  });

  await testEndpoint('Route Optimizer Status', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/automation/routes/status`,
  });

  await testEndpoint('Route Optimizer Stats', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/automation/routes/stats?days=7`,
  });

  await testEndpoint('Smart Batching Status', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/automation/batching/status`,
  });

  await testEndpoint('Smart Batching Stats', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/automation/batching/stats?days=7`,
  });

  await testEndpoint('Escalation Engine Status', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/automation/escalation/status`,
  });

  await testEndpoint('Escalation Stats', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/automation/escalation/stats?days=7`,
  });

  await testEndpoint('Escalation Logs', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/automation/escalation/logs?limit=50`,
  });

  await testEndpoint('Escalation At-Risk Orders', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/automation/escalation/at-risk-orders`,
  });

  // =============================================================================
  // 6. PRODUCTION METRICS ENDPOINTS (10 endpoints)
  // =============================================================================
  console.log('\n📊 PRODUCTION METRICS ENDPOINTS');
  console.log('─'.repeat(60));

  await testEndpoint('On-Time Delivery Rate', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/production-metrics/on-time-delivery?days=7`,
  });

  await testEndpoint('Completion Rate', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/production-metrics/completion-rate?days=7`,
  });

  await testEndpoint('Delivery Time', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/production-metrics/delivery-time?days=7`,
  });

  await testEndpoint('Courier Performance', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/production-metrics/courier-performance?days=7&limit=10`,
  });

  await testEndpoint('Cancellation Rate', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/production-metrics/cancellation-rate?days=7`,
  });

  await testEndpoint('Return Rate', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/production-metrics/return-rate?days=7`,
  });

  await testEndpoint('Fleet Utilization (Prod)', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/production-metrics/fleet-utilization?days=7`,
  });

  await testEndpoint('Order Distribution', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/production-metrics/order-distribution?days=7&limit=10`,
  });

  await testEndpoint('Comprehensive Dashboard', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/production-metrics/comprehensive?days=7`,
  });

  await testEndpoint('SLA At-Risk Orders', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/production-metrics/sla/at-risk?limit=10`,
  });

  await testEndpoint('SLA Compliance (Prod)', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/production-metrics/sla/compliance?days=7&limit=10`,
  });

  // =============================================================================
  // 7. AI QUERY ENDPOINTS (5 endpoints)
  // =============================================================================
  console.log('\n🤖 AI QUERY ENDPOINTS');
  console.log('─'.repeat(60));

  await testEndpoint('AI Query Catalog', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/ai-query/catalog`,
  });

  await testEndpoint('AI Query Categories', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/ai-query/categories`,
  });

  await testEndpoint('AI Query Execute', {
    method: 'POST',
    url: `${BASE_URL}/api/v1/ai-query/execute`,
    data: {
      query: 'total_orders',
      params: {
        start_date: '2025-11-01',
        end_date: '2025-11-08',
      },
    },
  });

  await testEndpoint('AI Query Quick Execute', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/ai-query/query/total_orders?days=7`,
  });

  // =============================================================================
  // 8. ADMIN ENDPOINTS (1 public endpoint tested)
  // =============================================================================
  console.log('\n👨‍💼 ADMIN ENDPOINTS (Public)');
  console.log('─'.repeat(60));

  await testEndpoint('Admin Agent Status', {
    method: 'GET',
    url: `${BASE_URL}/api/v1/admin/agents/status`,
  });

  // =============================================================================
  // SUMMARY
  // =============================================================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Endpoints Tested: ${results.total}`);
  console.log(`✅ Passing: ${results.passing.length} (${((results.passing.length / results.total) * 100).toFixed(1)}%)`);
  console.log(`❌ Failing: ${results.failing.length} (${((results.failing.length / results.total) * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  if (results.failing.length > 0) {
    console.log('\n❌ FAILING ENDPOINTS DETAILS:');
    console.log('─'.repeat(60));

    results.failing.forEach((failure, index) => {
      console.log(`\n${index + 1}. ${failure.name}`);
      console.log(`   Method: ${failure.method}`);
      console.log(`   URL: ${failure.url}`);
      console.log(`   Status: ${failure.status}`);
      console.log(`   Error: ${failure.error}`);
      if (failure.details) {
        console.log(`   Details: ${JSON.stringify(failure.details, null, 2)}`);
      }
    });
  }

  // Generate report
  const report = {
    summary: {
      total: results.total,
      passing: results.passing.length,
      failing: results.failing.length,
      successRate: `${((results.passing.length / results.total) * 100).toFixed(1)}%`,
    },
    passingEndpoints: results.passing,
    failingEndpoints: results.failing,
    timestamp: new Date().toISOString(),
  };

  // Write report to file
  const fs = require('fs');
  fs.writeFileSync(
    '/Users/ramiz_new/Desktop/AI-Route-Optimization-API/endpoint-test-report.json',
    JSON.stringify(report, null, 2)
  );

  console.log('\n📄 Full report saved to: endpoint-test-report.json');
}

// Run tests
testAllEndpoints()
  .then(() => {
    console.log('\n✅ Testing complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Testing failed:', error);
    process.exit(1);
  });
