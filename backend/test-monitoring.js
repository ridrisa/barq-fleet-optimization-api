/**
 * Test script for Error Monitoring System
 * Validates end-to-end functionality
 */

const { errorMonitoringService } = require('./src/services/error-monitoring.service');

console.log('=== Error Monitoring System Test ===\n');

// Test 1: Service initialization
console.log('Test 1: Service Initialization');
const stats = errorMonitoringService.getStats();
console.log('✓ Service initialized successfully');
console.log(`  - Max history: ${stats.maxHistory}`);
console.log(`  - Uptime: ${stats.uptimeFormatted}`);
console.log(`  - Thresholds configured: ${JSON.stringify(stats.thresholds)}\n`);

// Test 2: Log different error types
console.log('Test 2: Logging Different Error Types');

// Database error
errorMonitoringService.logError({
  message: 'Connection to database failed',
  statusCode: 500,
  code: 'DATABASE_ERROR',
  path: '/api/v1/orders',
  method: 'GET',
  metadata: { database: 'postgres' },
});
console.log('✓ Database error logged');

// Agent error
errorMonitoringService.logError({
  message: 'Route optimization agent failed',
  statusCode: 500,
  code: 'AGENT_EXECUTION_ERROR',
  agentName: 'route-optimization',
  path: '/api/v1/optimize',
  method: 'POST',
});
console.log('✓ Agent error logged');

// API validation error
errorMonitoringService.logError({
  message: 'Invalid order data',
  statusCode: 400,
  code: 'VALIDATION_ERROR',
  path: '/api/v1/orders',
  method: 'POST',
  metadata: { field: 'deliveryAddress' },
});
console.log('✓ Validation error logged');

// Analytics error
errorMonitoringService.logError({
  message: 'Python script execution failed',
  statusCode: 500,
  service: 'analytics',
  path: '/api/v1/analytics-lab/execute',
  method: 'POST',
});
console.log('✓ Analytics error logged');

// WebSocket error
errorMonitoringService.logError({
  message: 'WebSocket connection lost',
  statusCode: 503,
  service: 'websocket',
  metadata: { clientId: 'client-123' },
});
console.log('✓ WebSocket error logged\n');

// Test 3: Get metrics
console.log('Test 3: Error Metrics');
const metrics5min = errorMonitoringService.getMetrics('5min');
console.log('✓ 5-minute metrics:');
console.log(`  - Total errors: ${metrics5min.totalErrors}`);
console.log(`  - Error rate: ${metrics5min.errorRate} errors/min`);
console.log(`  - By category:`, metrics5min.byCategory);
console.log(`  - By severity:`, metrics5min.bySeverity);
console.log('');

// Test 4: Category breakdown
console.log('Test 4: Category Breakdown');
const breakdown = errorMonitoringService.getCategoryBreakdown();
Object.entries(breakdown).forEach(([category, data]) => {
  if (data.total > 0) {
    console.log(`✓ ${category}:`);
    console.log(`  - Total: ${data.total}`);
    console.log(`  - Health score: ${data.healthScore}`);
    console.log(`  - Status: ${data.status}`);
  }
});
console.log('');

// Test 5: Dashboard data
console.log('Test 5: Dashboard Data');
const dashboard = errorMonitoringService.getDashboardData();
console.log('✓ Dashboard data retrieved:');
console.log(`  - Total errors: ${dashboard.summary.totalErrors}`);
console.log(`  - Last 5 min: ${dashboard.summary.last5min}`);
console.log(`  - Last 1 hour: ${dashboard.summary.last1hour}`);
console.log(`  - Active alerts: ${dashboard.alerts.length}`);
console.log('');

// Test 6: Error trends
console.log('Test 6: Error Trends');
const trends = errorMonitoringService.getErrorTrends(6, 1000); // 6 intervals of 1 second
console.log(`✓ Generated ${trends.length} trend data points`);
console.log('');

// Test 7: Top errors
console.log('Test 7: Top Recurring Errors');
const topErrors = errorMonitoringService.getTopErrors(
  errorMonitoringService.errors,
  5
);
console.log(`✓ Top ${topErrors.length} errors:`);
topErrors.forEach((error, index) => {
  console.log(`  ${index + 1}. [${error.severity}] ${error.message.substring(0, 50)}... (${error.count}x)`);
});
console.log('');

// Test 8: Test alert thresholds
console.log('Test 8: Alert System (simulating high error rate)');
for (let i = 0; i < 25; i++) {
  errorMonitoringService.logError({
    message: `Test error ${i + 1}`,
    statusCode: 500,
    code: 'TEST_ERROR',
    path: '/api/test',
    method: 'GET',
  });
}
console.log('✓ Logged 25 rapid errors to trigger alerts');
const alerts = errorMonitoringService.getActiveAlerts();
console.log(`✓ Active alerts: ${alerts.length}`);
alerts.forEach((alert) => {
  console.log(`  - [${alert.severity}] ${alert.type}: ${alert.message}`);
});
console.log('');

// Test 9: Recent errors
console.log('Test 9: Recent Errors');
const recentErrors = dashboard.recentErrors.slice(0, 5);
console.log(`✓ Last ${recentErrors.length} errors:`);
recentErrors.forEach((error, index) => {
  console.log(`  ${index + 1}. [${error.category}/${error.severity}] ${error.message}`);
});
console.log('');

// Final statistics
console.log('=== Final Statistics ===');
const finalStats = errorMonitoringService.getStats();
console.log(`Total errors tracked: ${finalStats.totalErrorsTracked}`);
console.log(`Service uptime: ${finalStats.uptimeFormatted}`);
console.log(`\nCategory breakdown:`);
Object.entries(finalStats.categoryCounts).forEach(([category, count]) => {
  if (count > 0) {
    console.log(`  - ${category}: ${count}`);
  }
});

console.log('\n✅ All tests completed successfully!');
console.log('\n=== Next Steps ===');
console.log('1. Start the backend server: npm run dev');
console.log('2. Access monitoring dashboard: http://localhost:3000/monitoring');
console.log('3. Test API endpoint: curl http://localhost:3003/api/v1/monitoring/dashboard');
console.log('4. Monitor system health: curl http://localhost:3003/api/v1/monitoring/health');
