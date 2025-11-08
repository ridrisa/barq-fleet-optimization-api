const axios = require('axios');
const db = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync('./src/db/db.json');
const dbInstance = db(adapter);

async function verifyAPIResponse() {
  console.log('\n🔍 Comparing Database vs API Response\n');
  console.log('═══════════════════════════════════════════\n');

  // Get from database
  const opts = dbInstance.get('optimizations').value();
  const latest = opts[opts.length - 1];
  const requestId = latest.requestId;

  console.log(`📊 Request ID: ${requestId}\n`);

  // Check database
  console.log('1️⃣ DATABASE (what is stored):');
  if (latest.routes && latest.routes[0]) {
    const route = latest.routes[0];
    console.log(`   Route 0: ${route.vehicle.name}`);
    console.log(`   - Has stops: ${!!route.stops} (${route.stops?.length || 0} stops)`);
    console.log(`   - Has waypoints: ${!!route.waypoints} (${route.waypoints?.length || 0} waypoints)`);
    if (route.stops && route.stops[0]) {
      console.log(`   - First stop type: ${route.stops[0].type}`);
      console.log(`   - First stop name: ${route.stops[0].name}`);
    }
  }

  // Get from API
  try {
    console.log('\n2️⃣ API RESPONSE (what is returned):');
    const response = await axios.get(`http://localhost:3003/api/optimize/${requestId}`);
    const data = response.data;

    if (data.result && data.result.routes && data.result.routes[0]) {
      const route = data.result.routes[0];
      console.log(`   Route 0: ${route.vehicle?.name || 'Unknown'}`);
      console.log(`   - Has stops: ${!!route.stops} (${route.stops?.length || 0} stops)`);
      console.log(`   - Has waypoints: ${!!route.waypoints} (${route.waypoints?.length || 0} waypoints)`);
      if (route.stops && route.stops[0]) {
        console.log(`   - First stop type: ${route.stops[0].type}`);
        console.log(`   - First stop name: ${route.stops[0].name}`);
      } else {
        console.log(`   ❌ NO STOPS IN API RESPONSE!`);
      }
    }

    console.log('\n3️⃣ COMPARISON:');
    const dbHasStops = latest.routes[0]?.stops?.length > 0;
    const apiHasStops = data.result?.routes?.[0]?.stops?.length > 0;

    if (dbHasStops && !apiHasStops) {
      console.log('   ❌ PROBLEM: Stops exist in DB but NOT in API response!');
      console.log('   → Data is being lost during retrieval or transformation');
    } else if (dbHasStops && apiHasStops) {
      console.log('   ✅ SUCCESS: Stops exist in both DB and API response');
    } else {
      console.log('   ⚠️  Stops missing in both DB and API');
    }

  } catch (error) {
    console.error('   ❌ Error fetching from API:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('\n═══════════════════════════════════════════\n');
}

verifyAPIResponse();
