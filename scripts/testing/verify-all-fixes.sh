#!/bin/bash

# Quick Vehicle Format Test
echo "Testing vehicle parsing..."

echo "Vehicle from demo-request.json:"
cat demo-request.json | jq '.vehicles[0]'

echo ""
echo "Testing in Node.js:"
node -e "
const v = $(cat demo-request.json | jq '.vehicles[0]');
console.log('Vehicle object:', v);
console.log('Has id?', v && (v.id || v.fleet_id));
console.log('Has lat?', typeof v.lat === 'number');
console.log('Has lng?', typeof v.lng === 'number');
console.log('Would pass filter?', v && (v.id || v.fleet_id) && (typeof v.lat === 'number' && typeof v.lng === 'number'));
"

echo ""
echo "All vehicles:"
cat demo-request.json | jq '.vehicles[]' | node -e "
const stdin = process.stdin;
let data = '';
stdin.on('data', chunk => data += chunk);
stdin.on('end', () => {
  const vehicles = data.trim().split('}{').map((v, i, arr) => {
    if (i > 0) v = '{' + v;
    if (i < arr.length - 1) v = v + '}';
    return JSON.parse(v);
  });
  
  console.log('Total vehicles:', vehicles.length);
  const valid = vehicles.filter(v => 
    v && (v.id || v.fleet_id) && 
    (typeof v.lat === 'number' && typeof v.lng === 'number')
  );
  console.log('Valid vehicles after filter:', valid.length);
  console.log('Valid vehicle IDs:', valid.map(v => v.id).join(', '));
});
"
