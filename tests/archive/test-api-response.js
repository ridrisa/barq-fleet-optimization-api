const axios = require('axios');

const API_URL = 'https://route-opt-backend-426674819922.us-central1.run.app/api/v1/optimize';

async function testApiResponse() {
  console.log('Testing API response structure...\n');

  const testPayload = {
    pickupPoints: [
      {
        name: "Central Hub",
        address: "King Fahd Road",
        lat: 24.7136,
        lng: 46.6753,
        priority: 10
      }
    ],
    deliveryPoints: [
      // Three distinct geographic clusters
      // North cluster
      { name: "North 1", address: "N1", lat: 24.8136, lng: 46.6753, priority: 9 },
      { name: "North 2", address: "N2", lat: 24.8236, lng: 46.6853, priority: 8 },
      { name: "North 3", address: "N3", lat: 24.8336, lng: 46.6653, priority: 7 },

      // South cluster
      { name: "South 1", address: "S1", lat: 24.6136, lng: 46.6753, priority: 9 },
      { name: "South 2", address: "S2", lat: 24.6036, lng: 46.6653, priority: 8 },
      { name: "South 3", address: "S3", lat: 24.5936, lng: 46.6853, priority: 7 },

      // East cluster
      { name: "East 1", address: "E1", lat: 24.7136, lng: 46.7753, priority: 9 },
      { name: "East 2", address: "E2", lat: 24.7236, lng: 46.7853, priority: 8 },
      { name: "East 3", address: "E3", lat: 24.7036, lng: 46.7953, priority: 7 }
    ],
    fleet: {
      vehicleType: "van",
      count: 3,
      capacity: 1000
    },
    options: {
      optimizationMode: "shortest"
    }
  };

  try {
    const response = await axios.post(API_URL, testPayload, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('Response received. Analyzing...\n');
    console.log('Full response:', JSON.stringify(response.data, null, 2));

    console.log('\n═══════════════════════════════════════════\n');
    console.log('ANALYSIS:\n');

    const result = response.data;

    // Check if routes exist
    if (!result.routes || result.routes.length === 0) {
      console.log('❌ No routes returned');
      return;
    }

    console.log(`✅ ${result.routes.length} routes generated\n`);

    // Analyze each route
    result.routes.forEach((route, idx) => {
      console.log(`Route ${idx + 1}:`);
      console.log(`  Vehicle: ${route.vehicleId || 'N/A'}`);
      console.log(`  Total stops: ${route.stops ? route.stops.length : 0}`);

      if (route.stops && route.stops.length > 0) {
        const deliveries = route.stops.filter(s => s.type === 'delivery');
        const pickups = route.stops.filter(s => s.type === 'pickup');

        console.log(`  Pickups: ${pickups.length}`);
        console.log(`  Deliveries: ${deliveries.length}`);

        // Check what fields are available
        if (deliveries.length > 0) {
          console.log(`  First delivery structure:`, JSON.stringify(deliveries[0], null, 4));

          // Try to identify which cluster these deliveries belong to
          const deliveryNames = deliveries.map(d => d.name || 'unnamed').join(', ');
          console.log(`  Delivery names: ${deliveryNames}`);

          // Check for geographic clustering
          const hasNorth = deliveries.some(d => d.name && d.name.includes('North'));
          const hasSouth = deliveries.some(d => d.name && d.name.includes('South'));
          const hasEast = deliveries.some(d => d.name && d.name.includes('East'));

          if ((hasNorth && !hasSouth && !hasEast) ||
              (!hasNorth && hasSouth && !hasEast) ||
              (!hasNorth && !hasSouth && hasEast)) {
            console.log(`  ✅ Good clustering - single region`);
          } else if ((hasNorth && hasSouth) || (hasNorth && hasEast) || (hasSouth && hasEast)) {
            console.log(`  ⚠️  Mixed regions - suboptimal clustering`);
          }
        }
      }

      console.log('');
    });

    // Check if deliveries are evenly distributed
    const deliveriesPerRoute = result.routes.map(r =>
      r.stops ? r.stops.filter(s => s.type === 'delivery').length : 0
    );

    console.log('Distribution Analysis:');
    console.log(`  Deliveries per route: ${deliveriesPerRoute.join(', ')}`);

    const totalDeliveries = deliveriesPerRoute.reduce((a, b) => a + b, 0);
    console.log(`  Total deliveries covered: ${totalDeliveries}/9`);

    const avg = totalDeliveries / result.routes.length;
    const maxDiff = Math.max(...deliveriesPerRoute.map(d => Math.abs(d - avg)));

    if (maxDiff <= 1) {
      console.log(`  ✅ Well balanced distribution`);
    } else {
      console.log(`  ⚠️  Imbalanced distribution (max diff: ${maxDiff})`);
    }

    // Final assessment
    console.log('\n═══════════════════════════════════════════\n');
    console.log('OPTIMIZATION ASSESSMENT:\n');

    // Count how many routes have good clustering
    let goodClustering = 0;
    result.routes.forEach((route) => {
      if (route.stops) {
        const deliveries = route.stops.filter(s => s.type === 'delivery');
        const hasNorth = deliveries.some(d => d.name && d.name.includes('North'));
        const hasSouth = deliveries.some(d => d.name && d.name.includes('South'));
        const hasEast = deliveries.some(d => d.name && d.name.includes('East'));

        const regionCount = [hasNorth, hasSouth, hasEast].filter(Boolean).length;
        if (regionCount === 1) goodClustering++;
      }
    });

    const clusteringScore = (goodClustering / result.routes.length) * 100;

    console.log(`Clustering Score: ${clusteringScore.toFixed(0)}%`);

    if (clusteringScore >= 80) {
      console.log('✅ OPTIMIZATION IS WORKING - Routes are geographically clustered');
    } else if (clusteringScore >= 50) {
      console.log('⚠️  PARTIAL OPTIMIZATION - Some clustering present');
    } else {
      console.log('❌ NO OPTIMIZATION - Routes appear random');
    }

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testApiResponse().catch(console.error);