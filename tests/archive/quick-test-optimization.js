const fetch = require('node-fetch');

const testData = {
  pickups: [
    { address: '25.276987, 55.296249', id: 'P1' },
    { address: '25.197197, 55.274376', id: 'P2' },
    { address: '25.262776, 55.287447', id: 'P3' }
  ],
  depot: { lat: 25.276987, lng: 55.296249 }
};

async function test() {
  console.log('Testing /api/optimize endpoint...\n');

  try {
    const response = await fetch('http://localhost:3002/api/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    const data = await response.json();

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✓ Optimization endpoint is WORKING!');
    } else {
      console.log('\n✗ Optimization endpoint failed');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
