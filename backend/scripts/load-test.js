/**
 * Load Testing Script
 * Tests system performance under various load conditions
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const API_URL = process.env.API_URL || 'http://localhost:3003';

// Test scenarios
const scenarios = {
  light: { drivers: 10, ordersPerDriver: 5 },
  medium: { drivers: 20, ordersPerDriver: 5 },
  heavy: { drivers: 50, ordersPerDriver: 5 },
  extreme: { drivers: 100, ordersPerDriver: 5 }
};

// Generate random location in Riyadh area
function generateLocation() {
  return {
    lat: 24.7 + (Math.random() - 0.5) * 0.2,
    lng: 46.67 + (Math.random() - 0.5) * 0.2
  };
}

// Generate random order
function generateOrder() {
  return {
    serviceType: Math.random() > 0.5 ? 'BARQ' : 'BULLET',
    pickupPoints: [generateLocation()],
    deliveryPoints: [generateLocation()],
    urgency: Math.random() > 0.7 ? 'high' : 'normal',
    vehicleType: ['BIKE', 'CAR', 'VAN'][Math.floor(Math.random() * 3)]
  };
}

// Run single request
async function runRequest() {
  const start = performance.now();

  try {
    const response = await axios.post(`${API_URL}/api/optimize`, generateOrder(), {
      timeout: 10000 // 10 second timeout
    });

    const duration = performance.now() - start;

    return {
      success: true,
      duration,
      status: response.status
    };
  } catch (error) {
    const duration = performance.now() - start;

    return {
      success: false,
      duration,
      error: error.message,
      status: error.response?.status || 0
    };
  }
}

// Calculate statistics
function calculateStats(results) {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  if (successful.length === 0) {
    return {
      total: results.length,
      successful: 0,
      failed: failed.length,
      successRate: 0,
      avgDuration: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      min: 0,
      max: 0
    };
  }

  const durations = successful.map(r => r.duration).sort((a, b) => a - b);
  const sum = durations.reduce((a, b) => a + b, 0);

  return {
    total: results.length,
    successful: successful.length,
    failed: failed.length,
    successRate: (successful.length / results.length) * 100,
    avgDuration: sum / durations.length,
    p50: durations[Math.floor(durations.length * 0.5)],
    p95: durations[Math.floor(durations.length * 0.95)],
    p99: durations[Math.floor(durations.length * 0.99)],
    min: durations[0],
    max: durations[durations.length - 1]
  };
}

// Format number
function formatNumber(num) {
  return Math.round(num * 100) / 100;
}

// Print results
function printResults(scenarioName, stats, duration) {
  console.log(`\n📊 ${scenarioName.toUpperCase()} LOAD TEST RESULTS`);
  console.log('═'.repeat(50));

  console.log('\n📈 Request Statistics:');
  console.log(`   Total Requests:   ${stats.total}`);
  console.log(`   Successful:       ${stats.successful} (${formatNumber(stats.successRate)}%)`);
  console.log(`   Failed:           ${stats.failed} (${formatNumber(100 - stats.successRate)}%)`);

  console.log('\n⚡ Performance Metrics:');
  console.log(`   Average:          ${formatNumber(stats.avgDuration)}ms`);
  console.log(`   Median (p50):     ${formatNumber(stats.p50)}ms`);
  console.log(`   95th percentile:  ${formatNumber(stats.p95)}ms`);
  console.log(`   99th percentile:  ${formatNumber(stats.p99)}ms`);
  console.log(`   Min:              ${formatNumber(stats.min)}ms`);
  console.log(`   Max:              ${formatNumber(stats.max)}ms`);

  console.log('\n🎯 Throughput:');
  console.log(`   Total Time:       ${formatNumber(duration / 1000)}s`);
  console.log(`   Requests/sec:     ${formatNumber((stats.total / duration) * 1000)}`);

  // Determine status
  let status = '✅ EXCELLENT';
  let emoji = '🟢';

  if (stats.p95 > 1000 || stats.successRate < 95) {
    status = '❌ FAILED';
    emoji = '🔴';
  } else if (stats.p95 > 500 || stats.successRate < 98) {
    status = '⚠️  WARNING';
    emoji = '🟡';
  } else if (stats.p95 > 200) {
    status = '✅ GOOD';
    emoji = '🟢';
  }

  console.log(`\n${emoji} Status: ${status}`);

  // Performance analysis
  console.log('\n💡 Analysis:');
  if (stats.p95 < 100) {
    console.log('   🚀 Outstanding performance! System is well optimized.');
  } else if (stats.p95 < 200) {
    console.log('   ✅ Good performance. System is production ready.');
  } else if (stats.p95 < 500) {
    console.log('   ⚠️  Acceptable but could be optimized.');
  } else if (stats.p95 < 1000) {
    console.log('   ⚠️  Performance issues detected. Optimization needed.');
  } else {
    console.log('   ❌ Critical performance issues! System may fail under load.');
  }

  if (stats.successRate < 95) {
    console.log('   ❌ High failure rate! Check logs for errors.');
  } else if (stats.successRate < 99) {
    console.log('   ⚠️  Some failures detected. Monitor error logs.');
  }

  console.log('');
}

// Run load test scenario
async function runScenario(scenarioName, config) {
  console.log(`\n🔄 Running ${scenarioName.toUpperCase()} load test...`);
  console.log(`   Simulating: ${config.drivers} drivers × ${config.ordersPerDriver} orders`);
  console.log(`   Total requests: ${config.drivers * config.ordersPerDriver}`);

  const results = [];
  const totalRequests = config.drivers * config.ordersPerDriver;
  const startTime = performance.now();

  // Run all requests concurrently
  const promises = [];
  for (let i = 0; i < totalRequests; i++) {
    promises.push(
      runRequest().then(result => {
        results.push(result);

        // Progress indicator
        if (results.length % 10 === 0) {
          process.stdout.write(`\r   Progress: ${results.length}/${totalRequests} requests completed...`);
        }

        return result;
      })
    );
  }

  await Promise.all(promises);
  const duration = performance.now() - startTime;

  console.log(`\r   Progress: ${results.length}/${totalRequests} requests completed ✅\n`);

  const stats = calculateStats(results);
  printResults(scenarioName, stats, duration);

  return { stats, duration };
}

// Check API health
async function checkHealth() {
  try {
    const response = await axios.get(`${API_URL}/health`, { timeout: 5000 });

    if (response.data.status !== 'up') {
      console.error('❌ API is not healthy');
      return false;
    }

    console.log('✅ API is healthy');
    console.log(`   Version: ${response.data.version}`);
    console.log(`   Uptime: ${formatNumber(response.data.uptime)}s\n`);

    return true;
  } catch (error) {
    console.error('❌ Cannot connect to API');
    console.error(`   URL: ${API_URL}`);
    console.error(`   Error: ${error.message}\n`);
    return false;
  }
}

// Main function
async function main() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║        Load Testing Script                    ║');
  console.log('║   AI Route Optimization System                ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  console.log(`🎯 Testing API: ${API_URL}\n`);

  // Check health first
  console.log('🔍 Checking API health...');
  const isHealthy = await checkHealth();

  if (!isHealthy) {
    console.log('💡 Make sure the API is running:');
    console.log('   cd backend && npm start\n');
    process.exit(1);
  }

  // Get scenario from command line or run all
  const scenarioName = process.argv[2];

  if (scenarioName && scenarios[scenarioName]) {
    // Run single scenario
    await runScenario(scenarioName, scenarios[scenarioName]);
  } else {
    // Run all scenarios
    console.log('🚀 Running all load test scenarios...\n');

    const allResults = {};

    for (const [name, config] of Object.entries(scenarios)) {
      const result = await runScenario(name, config);
      allResults[name] = result;

      // Wait 2 seconds between scenarios
      if (name !== 'extreme') {
        console.log('   ⏳ Waiting 2 seconds before next test...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Summary
    console.log('\n╔═══════════════════════════════════════════════╗');
    console.log('║           LOAD TEST SUMMARY                   ║');
    console.log('╚═══════════════════════════════════════════════╝\n');

    console.log('📊 Results by Scenario:\n');
    console.log('Scenario    | Requests | Success | p95 (ms) | Status');
    console.log('------------|----------|---------|----------|----------');

    for (const [name, { stats }] of Object.entries(allResults)) {
      const status = stats.p95 < 200 && stats.successRate > 98 ? '✅' :
                    stats.p95 < 500 && stats.successRate > 95 ? '⚠️ ' : '❌';

      console.log(
        `${name.padEnd(11)} | ` +
        `${String(stats.total).padStart(8)} | ` +
        `${formatNumber(stats.successRate).toString().padStart(6)}% | ` +
        `${formatNumber(stats.p95).toString().padStart(8)} | ` +
        `${status}`
      );
    }

    console.log('');

    // Recommendations
    console.log('💡 Recommendations:\n');

    const extremeStats = allResults.extreme.stats;

    if (extremeStats.p95 < 200 && extremeStats.successRate > 98) {
      console.log('   🚀 System is performing excellently at scale!');
      console.log('   ✅ Production ready for 100+ drivers');
      console.log('   ✅ Consider scaling to 500+ drivers\n');
    } else if (extremeStats.p95 < 500 && extremeStats.successRate > 95) {
      console.log('   ✅ System is production ready for current scale');
      console.log('   💡 Consider these optimizations for better performance:');
      console.log('      - Add Redis caching layer');
      console.log('      - Optimize database queries');
      console.log('      - Enable agent batching\n');
    } else {
      console.log('   ⚠️  System needs optimization before production:');
      console.log('      1. Migrate to PostgreSQL (if using LowDB)');
      console.log('      2. Add database indexes');
      console.log('      3. Implement caching layer');
      console.log('      4. Optimize agent intervals');
      console.log('      5. Review error logs for issues\n');
    }
  }

  console.log('✨ Load testing complete!\n');
}

// Run with error handling
main().catch(error => {
  console.error('\n❌ Load test failed:');
  console.error(`   ${error.message}\n`);
  process.exit(1);
});
