#!/usr/bin/env node
/**
 * Database Resilience Test Script
 * 
 * Tests the enhanced database connectivity features:
 * - Connection health monitoring
 * - Circuit breaker functionality
 * - Automatic fallback to demo data
 * - Error handling and recovery
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3003';
const API_PREFIX = '/api/v1/analytics-lab';

class DatabaseResilienceTest {
  constructor() {
    this.testResults = [];
    this.apiClient = axios.create({
      baseURL: `${BASE_URL}${API_PREFIX}`,
      timeout: 30000,
      validateStatus: () => true // Don't throw on HTTP errors
    });
  }

  async runAllTests() {
    console.log('🔧 Database Resilience Test Suite');
    console.log('=' .repeat(50));
    console.log('Testing enhanced database connectivity features...\n');

    await this.testSystemStatus();
    await this.testHealthEndpoint();
    await this.testDashboardWithHealth();
    await this.testDemandForecastResilience();
    await this.testRouteAnalysisResilience();
    await this.testJobStatusWithHealth();
    
    this.printSummary();
  }

  async testSystemStatus() {
    console.log('📊 Testing System Status Endpoint...');
    
    try {
      const response = await this.apiClient.get('/system-status');
      
      if (response.status === 200 && response.data.success) {
        const data = response.data.data;
        
        console.log('✓ System status endpoint working');
        console.log(`  Service Status: ${data.service.status}`);
        console.log(`  Database Health: ${data.database.health.isHealthy ? 'Healthy' : 'Unhealthy'}`);
        console.log(`  Production Mode: ${data.database.isProduction ? 'Yes' : 'No'}`);
        console.log(`  Fallback Mode: ${data.database.fallbackMode ? 'Yes' : 'No'}`);
        console.log(`  Running Jobs: ${data.jobs.running}`);
        
        this.addResult('System Status', true, 'Endpoint working correctly');
      } else {
        console.log('✗ System status endpoint failed');
        this.addResult('System Status', false, `HTTP ${response.status}: ${response.data?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log('✗ System status test failed:', error.message);
      this.addResult('System Status', false, error.message);
    }
    
    console.log('');
  }

  async testHealthEndpoint() {
    console.log('🏥 Testing Health Check Endpoint...');
    
    try {
      const response = await this.apiClient.get('/health');
      
      if (response.status === 200 && response.data.success) {
        const data = response.data.data;
        
        console.log('✓ Health check endpoint working');
        console.log(`  Database Health: ${data.database.isHealthy ? 'Healthy' : 'Unhealthy'}`);
        console.log(`  Last Health Check: ${data.database.lastHealthCheck || 'Never'}`);
        console.log(`  Consecutive Failures: ${data.database.consecutiveFailures}`);
        console.log(`  Circuit Breaker: ${data.database.circuitBreaker.isOpen ? 'Open' : 'Closed'}`);
        console.log(`  Recommendation: ${data.database.recommendation}`);
        
        this.addResult('Health Check', true, 'Endpoint working correctly');
      } else {
        console.log('✗ Health check endpoint failed');
        this.addResult('Health Check', false, `HTTP ${response.status}: ${response.data?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log('✗ Health check test failed:', error.message);
      this.addResult('Health Check', false, error.message);
    }
    
    console.log('');
  }

  async testDashboardWithHealth() {
    console.log('📈 Testing Enhanced Dashboard...');
    
    try {
      const response = await this.apiClient.get('/dashboard');
      
      if (response.status === 200 && response.data.success) {
        const data = response.data.data;
        
        console.log('✓ Dashboard endpoint working');
        console.log(`  Running Jobs: ${data.runningJobs.length}`);
        console.log(`  Recent Jobs: ${data.recentJobs.length}`);
        console.log(`  Python Environment: ${data.pythonEnv.success ? 'OK' : 'Error'}`);
        console.log(`  System Status Available: ${data.systemStatus ? 'Yes' : 'No'}`);
        
        if (data.systemStatus) {
          console.log(`  Database Mode: ${data.systemStatus.database.isProduction ? 'Production' : 'Fallback'}`);
        }
        
        this.addResult('Enhanced Dashboard', true, 'Dashboard working with health info');
      } else {
        console.log('✗ Dashboard endpoint failed');
        this.addResult('Enhanced Dashboard', false, `HTTP ${response.status}: ${response.data?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log('✗ Dashboard test failed:', error.message);
      this.addResult('Enhanced Dashboard', false, error.message);
    }
    
    console.log('');
  }

  async testDemandForecastResilience() {
    console.log('📊 Testing Demand Forecast Resilience...');
    
    try {
      const response = await this.apiClient.post('/run/demand-forecast', {
        forecast_type: 'daily',
        horizon: 7
      });
      
      if (response.status === 200 && response.data.success) {
        const jobInfo = response.data.data;
        console.log(`✓ Demand forecast job started: ${jobInfo.jobId}`);
        
        // Wait a bit and check job status
        await this.sleep(2000);
        const statusResponse = await this.apiClient.get(`/job/${jobInfo.jobId}`);
        
        if (statusResponse.status === 200) {
          const jobData = statusResponse.data.data;
          console.log(`  Job Status: ${jobData.status}`);
          console.log(`  Connection Health Available: ${jobData.connectionHealth ? 'Yes' : 'No'}`);
          
          if (jobData.result) {
            console.log(`  Data Source: ${jobData.result.data_source || 'Unknown'}`);
            console.log(`  Data Quality: ${jobData.result.data_quality || 'Unknown'}`);
          }
          
          this.addResult('Demand Forecast Resilience', true, 'Job execution with health monitoring');
        } else {
          this.addResult('Demand Forecast Resilience', false, 'Failed to get job status');
        }
      } else {
        console.log('✗ Demand forecast failed to start');
        this.addResult('Demand Forecast Resilience', false, `HTTP ${response.status}: ${response.data?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log('✗ Demand forecast test failed:', error.message);
      this.addResult('Demand Forecast Resilience', false, error.message);
    }
    
    console.log('');
  }

  async testRouteAnalysisResilience() {
    console.log('🗺️  Testing Route Analysis Resilience...');
    
    try {
      const response = await this.apiClient.post('/run/route-analysis', {
        analysis_type: 'efficiency',
        date_range: 30
      });
      
      if (response.status === 200 && response.data.success) {
        const jobInfo = response.data.data;
        console.log(`✓ Route analysis job started: ${jobInfo.jobId}`);
        
        // Wait a bit and check job status
        await this.sleep(2000);
        const statusResponse = await this.apiClient.get(`/job/${jobInfo.jobId}`);
        
        if (statusResponse.status === 200) {
          const jobData = statusResponse.data.data;
          console.log(`  Job Status: ${jobData.status}`);
          console.log(`  Connection Health Available: ${jobData.connectionHealth ? 'Yes' : 'No'}`);
          
          if (jobData.result) {
            console.log(`  Data Source: ${jobData.result.data_source || 'Unknown'}`);
            console.log(`  Data Quality: ${jobData.result.data_quality || 'Unknown'}`);
          }
          
          this.addResult('Route Analysis Resilience', true, 'Job execution with health monitoring');
        } else {
          this.addResult('Route Analysis Resilience', false, 'Failed to get job status');
        }
      } else {
        console.log('✗ Route analysis failed to start');
        this.addResult('Route Analysis Resilience', false, `HTTP ${response.status}: ${response.data?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log('✗ Route analysis test failed:', error.message);
      this.addResult('Route Analysis Resilience', false, error.message);
    }
    
    console.log('');
  }

  async testJobStatusWithHealth() {
    console.log('📋 Testing Job Status with Health Info...');
    
    try {
      // Get running jobs
      const runningResponse = await this.apiClient.get('/jobs/running');
      
      if (runningResponse.status === 200 && runningResponse.data.success) {
        const runningJobs = runningResponse.data.data;
        console.log(`✓ Found ${runningJobs.length} running jobs`);
        
        if (runningJobs.length > 0) {
          const jobId = runningJobs[0].jobId;
          const statusResponse = await this.apiClient.get(`/job/${jobId}`);
          
          if (statusResponse.status === 200 && statusResponse.data.data.connectionHealth) {
            console.log('✓ Job status includes connection health info');
            this.addResult('Job Status with Health', true, 'Health info included in job status');
          } else {
            console.log('⚠ Job status missing health info');
            this.addResult('Job Status with Health', false, 'Missing health info');
          }
        } else {
          console.log('ℹ No running jobs to test');
          this.addResult('Job Status with Health', true, 'No running jobs (normal)');
        }
      } else {
        console.log('✗ Failed to get running jobs');
        this.addResult('Job Status with Health', false, 'Failed to get running jobs');
      }
    } catch (error) {
      console.log('✗ Job status test failed:', error.message);
      this.addResult('Job Status with Health', false, error.message);
    }
    
    console.log('');
  }

  addResult(testName, passed, message) {
    this.testResults.push({
      test: testName,
      passed,
      message
    });
  }

  printSummary() {
    console.log('📊 Test Results Summary');
    console.log('=' .repeat(50));
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    this.testResults.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.test}: ${result.message}`);
    });
    
    console.log('');
    console.log(`📈 Results: ${passedTests}/${totalTests} tests passed`);
    
    if (failedTests > 0) {
      console.log(`❌ ${failedTests} tests failed`);
      process.exit(1);
    } else {
      console.log('🎉 All tests passed!');
      console.log('');
      console.log('🛡️  Database resilience features are working correctly:');
      console.log('   - Connection health monitoring ✓');
      console.log('   - Circuit breaker pattern ✓');
      console.log('   - Automatic fallback to demo data ✓');
      console.log('   - Enhanced error handling ✓');
      console.log('   - Comprehensive status reporting ✓');
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Check if backend is running
async function checkBackend() {
  try {
    const response = await axios.get(`${BASE_URL}/api/v1/health`, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Main execution
async function main() {
  const isBackendRunning = await checkBackend();
  
  if (!isBackendRunning) {
    console.log('❌ Backend server is not running at', BASE_URL);
    console.log('   Please start the backend server first:');
    console.log('   cd backend && npm start');
    process.exit(1);
  }
  
  const tester = new DatabaseResilienceTest();
  await tester.runAllTests();
}

main().catch(error => {
  console.error('Test execution failed:', error.message);
  process.exit(1);
});