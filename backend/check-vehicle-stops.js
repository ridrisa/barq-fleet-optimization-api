const axios = require('axios');

async function checkVehicleStops() {
  try {
    console.log('🔍 Checking for vehicle stops in API response...\n');

    // Get history
    const historyResponse = await axios.get('http://localhost:3003/api/optimize/history?limit=1');
    const latestRequest = historyResponse.data.data[0];

    if (!latestRequest) {
      console.log('❌ No optimization history found');
      return;
    }

    console.log(`📍 Latest Request ID: ${latestRequest.id}`);
    console.log(`⏰ Created at: ${latestRequest.timestamp}\n`);

    // Get detailed result
    const resultResponse = await axios.get(`http://localhost:3003/api/optimize/${latestRequest.id}`);
    const data = resultResponse.data.data || resultResponse.data;
    const routes = data.routes || [];

    console.log(`📊 Found ${routes.length} routes\n`);
    console.log('═══════════════════════════════════════════════════════════\n');

    let vehicleStopsFound = 0;

    routes.forEach((route, index) => {
      const vehicleName = route.vehicle?.name || route.vehicleName || 'Unknown Vehicle';
      const stops = route.stops || [];

      console.log(`Route ${index + 1}: ${vehicleName}`);
      console.log(`  Total stops: ${stops.length}`);
      console.log(`  Stops:`);

      stops.forEach((stop, stopIndex) => {
        const type = stop.type || 'unknown';
        const emoji = type === 'vehicle' ? '🚚' : type === 'pickup' ? '📦' : type === 'delivery' ? '🏠' : '📍';

        console.log(`    ${stopIndex + 1}. ${emoji} ${stop.name || stop.id} (type: ${type})`);

        if (type === 'vehicle') {
          vehicleStopsFound++;
          console.log(`       ✓ Vehicle stop at [${stop.location.latitude.toFixed(4)}, ${stop.location.longitude.toFixed(4)}]`);
          if (stop.vehicleInfo) {
            console.log(`       ✓ Vehicle info: ${JSON.stringify(stop.vehicleInfo)}`);
          }
        }
      });

      console.log('');
    });

    console.log('═══════════════════════════════════════════════════════════\n');

    if (vehicleStopsFound === 0) {
      console.log('❌ NO VEHICLE STOPS FOUND IN API RESPONSE');
      console.log('   This means the formatting agent is not adding vehicle stops.');
      console.log('   The frontend cannot display what is not in the API response.\n');
    } else {
      console.log(`✅ Found ${vehicleStopsFound} vehicle stops in API response`);
      console.log('   These should be visible on the frontend map.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkVehicleStops();
