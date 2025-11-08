const axios = require('axios');

async function checkVehicleStops() {
  try {
    // Get latest request ID
    const historyResponse = await axios.get('http://localhost:3003/api/optimize/history?limit=1');
    const latestId = historyResponse.data.data[0]?.id;

    if (!latestId) {
      console.log('No optimizations found');
      return;
    }

    console.log('\n🔍 Checking for Vehicle Stops\n');
    console.log(`Request ID: ${latestId}\n`);

    // Get the result
    const response = await axios.get(`http://localhost:3003/api/optimize/${latestId}`);
    const routes = response.data.result.routes;

    console.log(`Found ${routes.length} routes\n`);
    console.log('═══════════════════════════════════════════\n');

    let totalVehicleStops = 0;

    routes.forEach((route, routeIndex) => {
      console.log(`Route ${routeIndex + 1}: ${route.vehicle.name}`);
      console.log(`  Total stops: ${route.stops.length}`);

      const vehicleStops = route.stops.filter(stop => stop.type === 'vehicle');
      totalVehicleStops += vehicleStops.length;

      if (vehicleStops.length > 0) {
        console.log(`  ✅ Vehicle stops found: ${vehicleStops.length}`);
        vehicleStops.forEach(vs => {
          console.log(`     - ${vs.name} at [${vs.location.latitude.toFixed(4)}, ${vs.location.longitude.toFixed(4)}]`);
        });
      } else {
        console.log(`  ❌ NO vehicle stops`);
      }

      console.log('\n  All stops:');
      route.stops.forEach((stop, i) => {
        const emoji = stop.type === 'vehicle' ? '🚚' : stop.type === 'pickup' ? '📦' : '🏠';
        console.log(`    ${i + 1}. ${emoji} ${stop.name} (${stop.type})`);
      });

      console.log('');
    });

    console.log('═══════════════════════════════════════════\n');
    console.log(`\n📊 Summary: ${totalVehicleStops} total vehicle stops across all routes\n`);

    if (totalVehicleStops === 0) {
      console.log('❌ PROBLEM: No vehicle stops found!');
      console.log('   The formatting agent should be adding vehicle starting locations.');
      console.log('   Check formatting.agent.js lines 335-375\n');
    } else {
      console.log('✅ SUCCESS: Vehicle stops are present in the API response!');
      console.log('   The frontend should be able to display them.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkVehicleStops();
