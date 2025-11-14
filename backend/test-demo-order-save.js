/**
 * Test Script: Demo Order Database Persistence
 * Tests the fix for JSONB type mismatch issue
 */

const demoDatabaseService = require('./src/demo/demo-database.service');
const db = require('./src/database');
const { logger } = require('./src/utils/logger');

async function testDemoOrderSave() {
  console.log('\n=== Testing Demo Order Database Persistence ===\n');

  try {
    // Connect to database
    console.log('1. Connecting to database...');
    await db.connect();
    console.log('✅ Database connected\n');

    // Initialize demo service
    console.log('2. Initializing demo database service...');
    await demoDatabaseService.initialize();
    console.log('✅ Demo service initialized\n');

    // Create a test order
    console.log('3. Creating test demo order...');
    const testOrder = {
      id: `test_order_${Date.now()}`,
      serviceType: 'BULLET',
      pickup: {
        location: {
          lat: 24.7136,
          lng: 46.6753,
        },
        address: 'Test Restaurant, 123 King Fahd Road',
        city: 'Riyadh',
        district: 'Downtown',
      },
      delivery: {
        location: {
          lat: 24.7200,
          lng: 46.6800,
        },
        address: '456 Test Street, Apt 10',
        city: 'Riyadh',
        district: 'Delivery Area',
      },
      distance: 5.2,
      items: [
        { name: 'Test Item 1', quantity: 2, price: 50 },
        { name: 'Test Item 2', quantity: 1, price: 30 },
      ],
      weight: 2.5,
      description: 'Test demo order',
      specialInstructions: 'Handle with care',
      priority: 0,
      codAmount: 0,
    };

    console.log('Test Order Structure:');
    console.log(JSON.stringify(testOrder, null, 2));
    console.log('');

    // Save order to database
    console.log('4. Saving order to database...');
    const savedOrder = await demoDatabaseService.saveOrder(testOrder);

    if (savedOrder) {
      console.log('✅ Order saved successfully!\n');
      console.log('Saved Order Details:');
      console.log(`  - Database ID: ${savedOrder.id}`);
      console.log(`  - Order Number: ${savedOrder.order_number}`);
      console.log(`  - Service Type: ${savedOrder.service_type}`);
      console.log(`  - Status: ${savedOrder.status}`);
      console.log(`  - Estimated Distance: ${savedOrder.estimated_distance} km`);
      console.log(`  - Pickup Address: ${JSON.stringify(savedOrder.pickup_address)}`);
      console.log(`  - Dropoff Address: ${JSON.stringify(savedOrder.dropoff_address)}`);
      console.log(`  - Package Details: ${JSON.stringify(savedOrder.package_details)}`);
      console.log(`  - Delivery Fee: SAR ${savedOrder.delivery_fee}`);
      console.log(`  - Total Amount: SAR ${savedOrder.total_amount}`);
      console.log(`  - SLA Deadline: ${savedOrder.sla_deadline}`);
      console.log('');

      // Verify JSONB fields are objects, not strings
      console.log('5. Verifying JSONB field types...');
      const typeChecks = {
        'pickup_address': typeof savedOrder.pickup_address === 'object',
        'dropoff_address': typeof savedOrder.dropoff_address === 'object',
        'package_details': typeof savedOrder.package_details === 'object',
        'estimated_distance': typeof savedOrder.estimated_distance === 'string' || typeof savedOrder.estimated_distance === 'number', // PostgreSQL returns DECIMAL as string
      };

      let allPassed = true;
      for (const [field, passed] of Object.entries(typeChecks)) {
        const status = passed ? '✅' : '❌';
        console.log(`  ${status} ${field}: ${passed ? 'correct type' : 'WRONG TYPE'}`);
        if (!passed) allPassed = false;
      }
      console.log('');

      // Test JSONB query functionality
      console.log('6. Testing JSONB query functionality...');
      const query = `
        SELECT
          order_number,
          pickup_address->>'city' as pickup_city,
          pickup_address->>'street' as pickup_street,
          dropoff_address->>'city' as dropoff_city,
          package_details->>'description' as package_description
        FROM orders
        WHERE id = $1
      `;
      const result = await db.query(query, [savedOrder.id]);

      if (result.rows.length > 0) {
        console.log('✅ JSONB queries work correctly!');
        console.log('  Query Result:');
        console.log(`    - Order Number: ${result.rows[0].order_number}`);
        console.log(`    - Pickup City: ${result.rows[0].pickup_city}`);
        console.log(`    - Pickup Street: ${result.rows[0].pickup_street}`);
        console.log(`    - Dropoff City: ${result.rows[0].dropoff_city}`);
        console.log(`    - Package Description: ${result.rows[0].package_description}`);
      } else {
        console.log('❌ JSONB query returned no results');
        allPassed = false;
      }
      console.log('');

      // Final result
      if (allPassed) {
        console.log('🎉 ALL TESTS PASSED! Demo order database persistence is working correctly.\n');
        process.exit(0);
      } else {
        console.log('❌ SOME TESTS FAILED. Please review the output above.\n');
        process.exit(1);
      }
    } else {
      console.log('❌ Failed to save order to database');
      console.log('Check logs above for error details\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test failed with error:');
    console.error(`   Message: ${error.message}`);
    console.error(`   Code: ${error.code || 'N/A'}`);
    console.error(`   Detail: ${error.detail || 'N/A'}`);
    console.error(`   Stack: ${error.stack}`);
    console.log('');
    process.exit(1);
  } finally {
    // Disconnect from database
    await db.disconnect();
  }
}

// Run the test
testDemoOrderSave();
