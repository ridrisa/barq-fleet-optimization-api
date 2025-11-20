#!/usr/bin/env node

/**
 * Test Analytics Lab UI Integration
 * 
 * Tests the complete flow:
 * 1. Dashboard loading
 * 2. Job creation
 * 3. Job status polling
 * 4. Results retrieval
 */

const API_BASE_URL = 'http://localhost:3003';

async function testAnalyticsLabAPI() {
  console.log('🧪 Testing Analytics Lab API Integration...\n');

  try {
    // Test 1: Dashboard endpoint
    console.log('📊 Testing dashboard endpoint...');
    const dashboardResponse = await fetch(`${API_BASE_URL}/api/v1/analytics-lab/dashboard`);
    const dashboardData = await dashboardResponse.json();
    
    if (dashboardData.success) {
      console.log('✅ Dashboard loaded successfully');
      console.log(`   - Running jobs: ${dashboardData.data.runningJobs.length}`);
      console.log(`   - Recent jobs: ${dashboardData.data.recentJobs.length}`);
      console.log(`   - Python env: ${dashboardData.data.pythonEnv?.success ? 'Ready' : 'Error'}\n`);
    } else {
      console.log('❌ Dashboard failed:', dashboardData.error);
      return;
    }

    // Test 2: Job creation (Route Analysis)
    console.log('🚀 Testing route analysis job creation...');
    const routeJobResponse = await fetch(`${API_BASE_URL}/api/v1/analytics-lab/run/route-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysis_type: 'efficiency',
        date_range: 7,
        min_deliveries: 5
      })
    });
    
    const routeJobData = await routeJobResponse.json();
    
    if (routeJobData.success && routeJobData.data) {
      console.log('✅ Route analysis job created');
      console.log(`   - Job ID: ${routeJobData.data.jobId}`);
      console.log(`   - Status: ${routeJobData.data.status}\n`);
      
      // Test 3: Job status polling
      console.log('⏳ Testing job status polling...');
      const jobId = routeJobData.data.jobId;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const statusResponse = await fetch(`${API_BASE_URL}/api/v1/analytics-lab/job/${jobId}`);
        const statusData = await statusResponse.json();
        
        if (statusData.success && statusData.data) {
          const job = statusData.data;
          console.log(`   - Attempt ${attempts + 1}: Status = ${job.status}`);
          
          if (job.status === 'completed') {
            console.log('✅ Job completed successfully');
            console.log(`   - Duration: ${job.duration?.toFixed(2)}s`);
            console.log(`   - Result available: ${!!job.result}\n`);
            break;
          } else if (job.status === 'failed') {
            console.log('❌ Job failed:', job.error);
            break;
          }
        } else {
          console.log('❌ Failed to get job status:', statusData.error);
          break;
        }
        
        attempts++;
      }
      
      if (attempts >= maxAttempts) {
        console.log('⚠️ Job still running after maximum attempts');
      }
    } else {
      console.log('❌ Route analysis job creation failed:', routeJobData.error);
      return;
    }

    // Test 4: Test other analytics modules
    console.log('🔍 Testing other analytics modules...');
    
    const modules = [
      {
        name: 'Fleet Performance',
        endpoint: 'fleet-performance',
        params: {
          analysis_type: 'courier',
          metric: 'delivery_rate',
          period: 'daily'
        }
      },
      {
        name: 'Demand Forecast',
        endpoint: 'demand-forecast',
        params: {
          forecast_type: 'daily',
          horizon: 3
        }
      },
      {
        name: 'SLA Analysis',
        endpoint: 'sla-analysis',
        params: {
          analysis_type: 'compliance',
          date_range: 7
        }
      }
    ];

    for (const module of modules) {
      const response = await fetch(`${API_BASE_URL}/api/v1/analytics-lab/run/${module.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(module.params)
      });
      
      const data = await response.json();
      
      if (data.success && data.data) {
        console.log(`✅ ${module.name} job created: ${data.data.jobId}`);
      } else {
        console.log(`❌ ${module.name} job failed:`, data.error);
      }
    }

    console.log('\n🎉 Analytics Lab API integration test completed!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testAnalyticsLabAPI();
}

module.exports = { testAnalyticsLabAPI };