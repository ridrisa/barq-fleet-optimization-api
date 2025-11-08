const axios = require('axios');

async function debugResponse() {
  try {
    // Get the latest optimization
    const historyResponse = await axios.get('http://localhost:3003/api/optimize/history?limit=1');
    console.log('\n=== HISTORY RESPONSE ===');
    console.log(JSON.stringify(historyResponse.data, null, 2));

    const latestId = historyResponse.data.data[0]?.id;
    if (!latestId) {
      console.log('\nNo optimizations found');
      return;
    }

    console.log(`\n=== FETCHING OPTIMIZATION: ${latestId} ===\n`);

    // Get the detailed result
    const resultResponse = await axios.get(`http://localhost:3003/api/optimize/${latestId}`);

    console.log('\n=== FULL API RESPONSE ===');
    console.log(JSON.stringify(resultResponse.data, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugResponse();
