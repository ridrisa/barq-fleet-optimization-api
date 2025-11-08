const db = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync('./src/db/db.json');
const dbInstance = db(adapter);

const opts = dbInstance.get('optimizations').value();
if (opts && opts.length > 0) {
  const latest = opts[opts.length - 1];
  console.log('\n🔍 Database Structure Check\n');
  console.log('═══════════════════════════════════════════');
  console.log('result.routes type:', typeof latest.routes);
  console.log('result.routes value:', latest.routes);
  console.log('\nHas complete_data:', !!latest.complete_data);
  console.log('Has complete_data.routes:', !!latest.complete_data?.routes);

  if (latest.complete_data?.routes) {
    console.log('\n✓ complete_data.routes exists!');
    console.log('  Length:', latest.complete_data.routes.length);

    if (latest.complete_data.routes[0]) {
      const firstRoute = latest.complete_data.routes[0];
      console.log('\n📊 First Route Structure:');
      console.log('  Has waypoints:', !!firstRoute.waypoints);
      console.log('  Has stops:', !!firstRoute.stops);
      console.log('  Waypoints length:', firstRoute.waypoints?.length || 0);
      console.log('  Stops length:', firstRoute.stops?.length || 0);

      if (firstRoute.stops && firstRoute.stops.length > 0) {
        console.log('\n🚚 Stops in database:');
        firstRoute.stops.forEach((stop, i) => {
          console.log(`    ${i + 1}. ${stop.name} (type: ${stop.type})`);
        });
      }
    }
  } else {
    console.log('\n❌ complete_data.routes NOT found!');
  }
  console.log('═══════════════════════════════════════════\n');
} else {
  console.log('No optimizations found in database');
}
