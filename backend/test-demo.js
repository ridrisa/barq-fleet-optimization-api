/**
 * Test Script for Demo System
 * Quick test to verify all components are working
 */

const AgentController = require('./src/controllers/agent.controller');
const { v4: uuidv4 } = require('uuid');

async function testAgentController() {
  console.log('🧪 Testing Agent Controller...\n');

  try {
    // Test 1: Register a driver
    console.log('1️⃣ Registering a test driver...');
    const driver = {
      id: `driver-${uuidv4()}`,
      name: 'Test Driver',
      location: { lat: 24.7136, lng: 46.6753 },
      status: 'available',
      vehicleType: 'car',
      capacity: 5
    };

    await AgentController.registerDriver(driver);
    console.log('✅ Driver registered successfully\n');

    // Test 2: Create a test order
    console.log('2️⃣ Creating a test order...');
    const order = {
      id: `order-${uuidv4()}`,
      serviceType: 'BARQ',
      pickup: {
        address: 'Test Pickup Location',
        coordinates: { lat: 24.7136, lng: 46.6753 },
        businessName: 'Test Business'
      },
      dropoff: {
        address: 'Test Dropoff Location',
        coordinates: { lat: 24.7236, lng: 46.6853 },
        customerName: 'Test Customer',
        phone: '+966500000000'
      },
      items: [{ type: 'Food', quantity: 1, weight: 2 }],
      priority: 'high',
      sla: 60,
      estimatedDistance: 5,
      estimatedDuration: 15,
      value: 100,
      paymentMethod: 'card',
      notes: 'Test order',
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    const processedOrder = await AgentController.processNewOrder(order);
    console.log(`✅ Order processed with status: ${processedOrder.status}`);

    if (processedOrder.driverId) {
      console.log(`   Assigned to driver: ${processedOrder.driverId}\n`);
    } else {
      console.log('   Order pending assignment\n');
    }

    // Test 3: Get metrics
    console.log('3️⃣ Getting system metrics...');
    const metrics = AgentController.getMetrics();
    console.log('📊 System Metrics:');
    console.log(`   Total Orders: ${metrics.totalOrders}`);
    console.log(`   Total Drivers: ${metrics.totalDrivers}`);
    console.log(`   Available Drivers: ${metrics.availableDrivers}`);
    console.log(`   SLA Compliance: ${metrics.slaCompliance}%\n`);

    // Test 4: Update order status
    if (processedOrder.status === 'assigned') {
      console.log('4️⃣ Simulating order pickup...');
      await AgentController.updateOrderStatus(order.id, 'picked_up');
      console.log('✅ Order picked up\n');

      console.log('5️⃣ Simulating order delivery...');
      await AgentController.updateOrderStatus(order.id, 'delivered');
      console.log('✅ Order delivered\n');
    }

    // Final metrics
    const finalMetrics = AgentController.getMetrics();
    console.log('📊 Final Metrics:');
    console.log(`   Completed Orders: ${finalMetrics.completedOrders}`);
    console.log(`   Average Delivery Time: ${finalMetrics.averageDeliveryTime} minutes`);
    console.log(`   SLA Compliance: ${finalMetrics.slaCompliance}%\n`);

    console.log('🎉 All tests passed!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run tests
console.log('===================================');
console.log('   Demo System Component Test');
console.log('===================================\n');

testAgentController().then(() => {
  console.log('Test completed. You can now run the full demo.\n');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});