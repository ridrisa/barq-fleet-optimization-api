/**
 * Agent Management API Test Suite
 * Comprehensive tests for the new agent management endpoints
 */

const axios = require('axios');
const WebSocket = require('ws');

const BASE_URL = 'http://localhost:3003/api/v1';
const WS_URL = 'ws://localhost:3003/ws/agents';

// Test configuration
const TEST_CONFIG = {
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test-token' // Replace with actual token
  }
};

class AgentManagementAPITester {
  constructor() {
    this.axios = axios.create(TEST_CONFIG);
    this.testResults = [];
    this.testAgentId = 'sla-monitor'; // Test with SLA monitor agent
  }

  async runAllTests() {
    console.log('🚀 Starting Agent Management API Tests...\n');
    
    try {
      // Test agent control operations
      await this.testAgentControlOperations();
      
      // Test configuration management
      await this.testConfigurationManagement();
      
      // Test monitoring and metrics
      await this.testMonitoringAndMetrics();
      
      // Test bulk operations
      await this.testBulkOperations();
      
      // Test individual agent APIs
      await this.testIndividualAgentAPIs();
      
      // Test system monitoring
      await this.testSystemMonitoring();
      
      // Test WebSocket connection
      await this.testWebSocketConnection();
      
      this.printTestResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
    }
  }

  async testAgentControlOperations() {
    console.log('📋 Testing Agent Control Operations...');

    // Test get agent status
    await this.runTest('GET Agent Status', async () => {
      const response = await this.axios.get(`/agents/${this.testAgentId}/status`);
      this.validateResponse(response, 200);
      return response.data;
    });

    // Test start agent
    await this.runTest('Start Agent', async () => {
      const response = await this.axios.post(`/agents/${this.testAgentId}/start`);
      this.validateResponse(response, 200);
      return response.data;
    });

    // Test stop agent
    await this.runTest('Stop Agent', async () => {
      const response = await this.axios.post(`/agents/${this.testAgentId}/stop`);
      this.validateResponse(response, 200);
      return response.data;
    });

    // Test restart agent
    await this.runTest('Restart Agent', async () => {
      const response = await this.axios.post(`/agents/${this.testAgentId}/restart`);
      this.validateResponse(response, 200);
      return response.data;
    });

    // Test get agent logs
    await this.runTest('Get Agent Logs', async () => {
      const response = await this.axios.get(`/agents/${this.testAgentId}/logs?limit=10`);
      this.validateResponse(response, 200);
      return response.data;
    });
  }

  async testConfigurationManagement() {
    console.log('⚙️ Testing Configuration Management...');

    // Test get configuration
    await this.runTest('Get Agent Configuration', async () => {
      const response = await this.axios.get(`/agents/${this.testAgentId}/config`);
      this.validateResponse(response, 200);
      return response.data;
    });

    // Test update configuration
    await this.runTest('Update Agent Configuration', async () => {
      const config = {
        interval: 15000,
        timeout: 30000,
        logLevel: 'debug',
        enabled: true
      };
      const response = await this.axios.put(`/agents/${this.testAgentId}/config`, config);
      this.validateResponse(response, 200);
      return response.data;
    });

    // Test reset configuration
    await this.runTest('Reset Agent Configuration', async () => {
      const response = await this.axios.post(`/agents/${this.testAgentId}/config/reset`);
      this.validateResponse(response, 200);
      return response.data;
    });
  }

  async testMonitoringAndMetrics() {
    console.log('📊 Testing Monitoring and Metrics...');

    // Test get agent health
    await this.runTest('Get Agent Health', async () => {
      const response = await this.axios.get(`/agents/${this.testAgentId}/health`);
      this.validateResponse(response, 200);
      return response.data;
    });

    // Test get agent metrics
    await this.runTest('Get Agent Metrics', async () => {
      const response = await this.axios.get(`/agents/${this.testAgentId}/metrics`);
      this.validateResponse(response, 200);
      return response.data;
    });

    // Test get agent history
    await this.runTest('Get Agent History', async () => {
      const response = await this.axios.get(`/agents/${this.testAgentId}/history?limit=5`);
      this.validateResponse(response, 200);
      return response.data;
    });
  }

  async testBulkOperations() {
    console.log('📦 Testing Bulk Operations...');

    const agentIds = ['sla-monitor', 'fleet-status', 'order-assignment'];

    // Test bulk status
    await this.runTest('Bulk Get Status', async () => {
      const response = await this.axios.post('/agents/bulk/status', { agentIds });
      this.validateResponse(response, 200);
      return response.data;
    });

    // Test bulk start
    await this.runTest('Bulk Start Agents', async () => {
      const response = await this.axios.post('/agents/bulk/start', { agentIds });
      this.validateResponse(response, 200);
      return response.data;
    });

    // Test bulk stop
    await this.runTest('Bulk Stop Agents', async () => {
      const response = await this.axios.post('/agents/bulk/stop', { agentIds });
      this.validateResponse(response, 200);
      return response.data;
    });
  }

  async testIndividualAgentAPIs() {
    console.log('🎯 Testing Individual Agent APIs...');

    // Test SLA Monitor Dashboard
    await this.runTest('SLA Monitor Dashboard', async () => {
      const response = await this.axios.get('/agents/individual/sla-monitor/dashboard');
      this.validateResponse(response, 200);
      return response.data;
    });

    // Test Fleet Status Summary
    await this.runTest('Fleet Status Summary', async () => {
      const response = await this.axios.get('/agents/individual/fleet-status/summary');
      this.validateResponse(response, 200);
      return response.data;
    });

    // Test Traffic Pattern Insights
    await this.runTest('Traffic Pattern Insights', async () => {
      const response = await this.axios.get('/agents/individual/traffic-pattern/insights?forecast=true');
      this.validateResponse(response, 200);
      return response.data;
    });

    // Test Order Assignment
    await this.runTest('Order Assignment', async () => {
      const orderData = {
        order: {
          id: 'test-order-123',
          serviceType: 'BARQ',
          pickup: { lat: 40.7128, lng: -74.0060, address: 'New York, NY' },
          delivery: { lat: 40.7589, lng: -73.9851, address: 'Central Park, NY' }
        }
      };
      const response = await this.axios.post('/agents/individual/order-assignment/assign', orderData);
      this.validateResponse(response, 200);
      return response.data;
    });
  }

  async testSystemMonitoring() {
    console.log('🖥️ Testing System Monitoring...');

    // Test system metrics
    await this.runTest('Get System Metrics', async () => {
      const response = await this.axios.get('/agents/system/metrics');
      this.validateResponse(response, 200);
      return response.data;
    });

    // Test real-time updates
    await this.runTest('Get Real-time Updates', async () => {
      const response = await this.axios.get('/agents/system/realtime');
      this.validateResponse(response, 200);
      return response.data;
    });
  }

  async testWebSocketConnection() {
    console.log('🌐 Testing WebSocket Connection...');

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      let isConnected = false;
      let isAuthenticated = false;

      const timeout = setTimeout(() => {
        ws.close();
        if (!isConnected) {
          this.addTestResult('WebSocket Connection', false, 'Connection timeout');
        }
        resolve();
      }, 5000);

      ws.on('open', () => {
        console.log('  ✓ WebSocket connected');
        isConnected = true;

        // Send authentication message
        ws.send(JSON.stringify({
          type: 'auth',
          data: {
            token: 'test-token',
            userId: 'test-user',
            role: 'admin'
          }
        }));
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('  📨 Received message:', message.type);

          if (message.type === 'welcome') {
            console.log('  ✓ Welcome message received');
          } else if (message.type === 'authSuccess') {
            console.log('  ✓ Authentication successful');
            isAuthenticated = true;

            // Subscribe to agent events
            ws.send(JSON.stringify({
              type: 'subscribe',
              data: {
                topics: ['agent.*.status', 'system.alerts']
              }
            }));
          } else if (message.type === 'subscribed') {
            console.log('  ✓ Subscription successful');
            this.addTestResult('WebSocket Connection', true, 'Full WebSocket flow completed');
            clearTimeout(timeout);
            ws.close();
            resolve();
          } else if (message.type === 'error') {
            console.log('  ❌ WebSocket error:', message.data.message);
            this.addTestResult('WebSocket Connection', false, message.data.message);
            clearTimeout(timeout);
            ws.close();
            resolve();
          }
        } catch (error) {
          console.log('  ❌ Message parsing error:', error.message);
        }
      });

      ws.on('error', (error) => {
        console.log('  ❌ WebSocket error:', error.message);
        this.addTestResult('WebSocket Connection', false, error.message);
        clearTimeout(timeout);
        resolve();
      });

      ws.on('close', () => {
        console.log('  🔌 WebSocket connection closed');
        if (!this.testResults.some(t => t.name === 'WebSocket Connection')) {
          this.addTestResult('WebSocket Connection', isAuthenticated, 'Connection closed');
        }
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  async runTest(testName, testFunction) {
    try {
      console.log(`  Running: ${testName}`);
      const result = await testFunction();
      this.addTestResult(testName, true, 'Passed');
      console.log(`  ✅ ${testName} - Passed`);
      return result;
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      this.addTestResult(testName, false, errorMessage);
      console.log(`  ❌ ${testName} - Failed: ${errorMessage}`);
      return null;
    }
  }

  validateResponse(response, expectedStatus) {
    if (response.status !== expectedStatus) {
      throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
    }
    if (!response.data.success && expectedStatus < 400) {
      throw new Error(`Response indicated failure: ${response.data.error}`);
    }
  }

  addTestResult(name, passed, message) {
    this.testResults.push({
      name,
      passed,
      message,
      timestamp: Date.now()
    });
  }

  printTestResults() {
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    
    const passed = this.testResults.filter(t => t.passed).length;
    const failed = this.testResults.filter(t => !t.passed).length;
    const total = this.testResults.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(t => !t.passed)
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.message}`);
        });
    }
    
    console.log('\n🎉 Test suite completed!');
  }
}

// Error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new AgentManagementAPITester();
  tester.runAllTests().catch(console.error);
}

module.exports = AgentManagementAPITester;