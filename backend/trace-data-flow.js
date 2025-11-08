const db = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync('./src/db/db.json');
const dbInstance = db(adapter);

console.log('\n🔍 Tracing Data Flow Issue\n');
console.log('═══════════════════════════════════════════\n');

const opts = dbInstance.get('optimizations').value();
if (opts && opts.length > 0) {
  const latest = opts[opts.length - 1];

  console.log('📦 What is stored in database:\n');
  console.log('Keys in optimization record:', Object.keys(latest));
  console.log('\n1. result.routes:');
  console.log('   - Type:', typeof latest.routes);
  console.log('   - Is Array:', Array.isArray(latest.routes));
  if (Array.isArray(latest.routes) && latest.routes.length > 0) {
    console.log('   - Length:', latest.routes.length);
    console.log('   - First route keys:', Object.keys(latest.routes[0]));
    console.log('   - First route has stops:', !!latest.routes[0].stops);
    console.log('   - First route has waypoints:', !!latest.routes[0].waypoints);
  }

  console.log('\n2. result.complete_data:');
  console.log('   - Type:', typeof latest.complete_data);
  console.log('   - Keys:', Object.keys(latest.complete_data || {}));
  console.log('   - Has routes:', !!latest.complete_data?.routes);

  console.log('\n3. result.total_distance:', latest.total_distance);
  console.log('4. result.total_duration:', latest.total_duration);

  console.log('\n\n🔧 The Problem:\n');
  console.log('According to storeResult code (line 232):');
  console.log('   routes: result.data?.routes?.length || 0');
  console.log('\nBut routes is stored as a FULL ARRAY, not a number!');
  console.log('This means the code is NOT following its own logic.');
  console.log('\n💡 Root Cause:');
  console.log('The storeResult method expects { data: { routes: [...] } }');
  console.log('But it\'s being called with { routes: [...] } directly');
  console.log('\n✅ Solution:');
  console.log('Update getOptimizationResult (line 462) to use:');
  console.log('   routes: Array.isArray(result.routes) ? result.routes : (result.complete_data?.routes || [])');

  console.log('\n═══════════════════════════════════════════\n');
} else {
  console.log('No optimizations found');
}
