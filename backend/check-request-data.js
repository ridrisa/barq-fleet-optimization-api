const db = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync('./backend/src/db/db.json');
const dbInstance = db(adapter);

console.log('\n🔍 Checking Request Data\n');
console.log('═══════════════════════════════════════════\n');

// Get latest optimization
const opts = dbInstance.get('optimizations').value();
const latest = opts[opts.length - 1];
const requestId = latest.requestId;

// Get the request
const request = dbInstance.get('requests').find({ id: requestId }).value();

if (request) {
  console.log(`Request ID: ${requestId}\n`);
  console.log('Request has fleet:', !!request.fleet);
  console.log('Fleet length:', request.fleet?.length || 0);

  if (request.fleet && request.fleet.length > 0) {
    console.log('\n📦 Fleet vehicles:\n');
    request.fleet.forEach((vehicle, i) => {
      console.log(`Vehicle ${i + 1}:`);
      console.log(`  - id/fleet_id: ${vehicle.id || vehicle.fleet_id}`);
      console.log(`  - type: ${vehicle.type || vehicle.vehicle_type}`);
      console.log(`  - Has startLocation: ${!!vehicle.startLocation}`);
      console.log(`  - Has current_latitude/longitude: ${!!vehicle.current_latitude && !!vehicle.current_longitude}`);

      if (vehicle.startLocation) {
        console.log(`  - startLocation: [${vehicle.startLocation.latitude}, ${vehicle.startLocation.longitude}]`);
      } else if (vehicle.current_latitude && vehicle.current_longitude) {
        console.log(`  - Current position: [${vehicle.current_latitude}, ${vehicle.current_longitude}]`);
      } else {
        console.log(`  - ❌ NO LOCATION DATA!`);
      }
      console.log('');
    });
  } else {
    console.log('\n❌ No fleet data in request!');
  }

  console.log('\n💡 Analysis:');
  console.log('If vehicles have startLocation or current_latitude/longitude,');
  console.log('the formatting agent should add them as vehicle stops.');
  console.log('Check formatting.agent.js lines 335-375 to see why it\'s not working.\n');
} else {
  console.log('Request not found!');
}

console.log('═══════════════════════════════════════════\n');
