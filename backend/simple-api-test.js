const axios = require('axios');

async function testAPI() {
  try {
    // Get latest request ID
    const historyResponse = await axios.get('http://localhost:3003/api/optimize/history?limit=1');
    const latestId = historyResponse.data.data[0]?.id;

    if (!latestId) {
      console.log('No optimizations found');
      return;
    }

    console.log('\n🔍 Testing API Response Structure\n');
    console.log(`Request ID: ${latestId}\n`);

    // Get the result
    const response = await axios.get(`http://localhost:3003/api/optimize/${latestId}`);
    const data = response.data;

    console.log('Top-level keys:', Object.keys(data).join(', '));
    console.log('\nChecking routes location:');
    console.log('  - data.routes exists:', !!data.routes);
    console.log('  - data.result exists:', !!data.result);
    console.log('  - data.result.routes exists:', !!data.result?.routes);

    if (data.result?.routes) {
      console.log('\n✓ Routes found at: data.result.routes');
      console.log(`  Total routes: ${data.result.routes.length}`);

      if (data.result.routes[0]) {
        const route = data.result.routes[0];
        console.log(`\n  First route: ${route.vehicle?.name || 'Unknown'}`);
        console.log(`    - Has stops: ${!!route.stops} (${route.stops?.length || 0} stops)`);
        console.log(`    - Has waypoints: ${!!route.waypoints} (${route.waypoints?.length || 0} waypoints)`);

        if (route.stops && route.stops.length > 0) {
          console.log('\n  First 3 stops:');
          route.stops.slice(0, 3).forEach((stop, i) => {
            console.log(`    ${i + 1}. ${stop.name} (type: ${stop.type})`);
          });
        } else {
          console.log('\n  ❌ NO STOPS IN ROUTE!');
        }
      }
    } else if (data.routes) {
      console.log('\n✓ Routes found at: data.routes');
    } else {
      console.log('\n❌ Routes not found!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error('   Code:', error.code);
    }
  }
}

testAPI();
