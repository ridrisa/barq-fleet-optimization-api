/**
 * Enhanced Clustering - Practical Integration Example
 *
 * This file demonstrates how to integrate the enhanced clustering algorithm
 * with the existing route optimization API
 */

const { createClusteringIntegration, PRESET_CONFIGS } = require('../backend/src/utils/clustering-integration');

// ============================================================================
// EXAMPLE 1: Basic Usage
// ============================================================================

async function example1_basicUsage() {
  console.log('\n=== EXAMPLE 1: Basic Usage ===\n');

  // Create clustering instance with default weights
  const clustering = createClusteringIntegration();

  // Sample data
  const vehicles = [
    {
      id: 'truck-001',
      name: 'Delivery Truck 1',
      startLocation: { latitude: 24.7136, longitude: 46.6753 },
      capacity_kg: 3000
    },
    {
      id: 'truck-002',
      name: 'Delivery Truck 2',
      startLocation: { latitude: 24.7236, longitude: 46.6853 },
      capacity_kg: 2500
    }
  ];

  const pickupPoints = [
    {
      id: 'warehouse-riyadh',
      name: 'Riyadh Distribution Center',
      location: { latitude: 24.7150, longitude: 46.6770 }
    }
  ];

  const deliveryPoints = [
    {
      id: 'order-001',
      customer_name: 'Customer A',
      location: { latitude: 24.7200, longitude: 46.6800 },
      load_kg: 500,
      pickupId: 'warehouse-riyadh',
      priority: 'HIGH'
    },
    {
      id: 'order-002',
      customer_name: 'Customer B',
      location: { latitude: 24.7250, longitude: 46.6850 },
      load_kg: 600,
      pickupId: 'warehouse-riyadh',
      priority: 'MEDIUM'
    },
    {
      id: 'order-003',
      customer_name: 'Customer C',
      location: { latitude: 24.7300, longitude: 46.6900 },
      load_kg: 700,
      pickupId: 'warehouse-riyadh',
      priority: 'LOW'
    }
  ];

  // Run clustering
  const result = clustering.assignVehiclesForPlanning(
    vehicles,
    pickupPoints,
    deliveryPoints
  );

  // Display results
  console.log('Routes Generated:', result.routes.length);
  console.log('\nSummary:');
  console.log(JSON.stringify(result.summary, null, 2));

  console.log('\nRoute Details:');
  result.routes.forEach((route, index) => {
    console.log(`\nRoute ${index + 1}:`);
    console.log(`  Vehicle: ${route.vehicle.name}`);
    console.log(`  Deliveries: ${route.deliveries.length}`);
    console.log(`  Load: ${route.load_kg}kg`);
    console.log(`  Distance: ${route.distance}km`);
    console.log(`  Cluster Density: ${route.clusteringMetadata?.clusterDensity}`);
  });
}

// ============================================================================
// EXAMPLE 2: Using Preset Configurations
// ============================================================================

async function example2_presetConfigurations() {
  console.log('\n=== EXAMPLE 2: Preset Configurations ===\n');

  const vehicles = [
    {
      id: 'truck-001',
      startLocation: { latitude: 24.7136, longitude: 46.6753 },
      capacity_kg: 3000
    }
  ];

  const pickupPoints = [
    {
      id: 'warehouse-1',
      location: { latitude: 24.7150, longitude: 46.6770 }
    }
  ];

  const deliveryPoints = [
    {
      id: 'order-001',
      location: { latitude: 24.7200, longitude: 46.6800 },
      load_kg: 500,
      pickupId: 'warehouse-1'
    },
    {
      id: 'order-002',
      location: { latitude: 24.7250, longitude: 46.6850 },
      load_kg: 600,
      pickupId: 'warehouse-1'
    }
  ];

  // Test different presets
  const presets = [
    'proximity_focused',
    'load_balanced',
    'cluster_optimized',
    'route_continuation'
  ];

  for (const presetName of presets) {
    console.log(`\n--- Testing Preset: ${presetName} ---`);

    const clustering = createClusteringIntegration(PRESET_CONFIGS[presetName]);
    const result = clustering.assignVehiclesForPlanning(
      vehicles,
      pickupPoints,
      deliveryPoints
    );

    console.log(`Total Distance: ${result.summary.totalDistance}km`);
    console.log(`Vehicles Used: ${result.summary.vehiclesUsed}`);
  }
}

// ============================================================================
// EXAMPLE 3: Handling Existing Routes
// ============================================================================

async function example3_existingRoutes() {
  console.log('\n=== EXAMPLE 3: Handling Existing Routes ===\n');

  // Vehicles with existing routes
  const vehicles = [
    {
      id: 'truck-001',
      startLocation: { latitude: 24.7136, longitude: 46.6753 },
      capacity_kg: 3000,
      currentRoute: {
        pickupId: 'warehouse-riyadh',
        deliveries: [
          { id: 'existing-001', load_kg: 400 }
        ],
        load_kg: 400
      }
    },
    {
      id: 'truck-002',
      startLocation: { latitude: 24.7236, longitude: 46.6853 },
      capacity_kg: 3000
      // No existing route
    }
  ];

  const pickupPoints = [
    {
      id: 'warehouse-riyadh',
      location: { latitude: 24.7150, longitude: 46.6770 }
    }
  ];

  const deliveryPoints = [
    {
      id: 'order-001',
      location: { latitude: 24.7200, longitude: 46.6800 },
      load_kg: 500,
      pickupId: 'warehouse-riyadh'
    },
    {
      id: 'order-002',
      location: { latitude: 24.7250, longitude: 46.6850 },
      load_kg: 600,
      pickupId: 'warehouse-riyadh'
    }
  ];

  // Use route_continuation preset for vehicles with existing routes
  const clustering = createClusteringIntegration(PRESET_CONFIGS.route_continuation);

  const result = clustering.assignVehiclesForPlanning(
    vehicles,
    pickupPoints,
    deliveryPoints
  );

  console.log('Assignment Results:');
  result.routes.forEach(route => {
    const vehicle = vehicles.find(v => v.id === route.vehicle.id);
    const hasExisting = vehicle.currentRoute ? 'YES' : 'NO';

    console.log(`\nVehicle ${route.vehicle.id}:`);
    console.log(`  Had existing route: ${hasExisting}`);
    console.log(`  New deliveries: ${route.deliveries.length}`);
    console.log(`  Total load: ${route.load_kg}kg`);
    console.log(`  Remaining capacity: ${vehicle.capacity_kg - route.load_kg}kg`);
  });
}

// ============================================================================
// EXAMPLE 4: Custom Weight Configuration
// ============================================================================

async function example4_customWeights() {
  console.log('\n=== EXAMPLE 4: Custom Weight Configuration ===\n');

  // Scenario: Time-critical deliveries where proximity is most important
  const customWeights = {
    vehicleToPickupDistance: 0.40,     // Very high priority
    pickupToDeliveryDistance: 0.30,    // High priority
    deliveryClusterDensity: 0.15,      // Medium priority
    vehicleLoadBalance: 0.10,          // Low priority
    existingRouteCompatibility: 0.05   // Very low priority
  };

  const clustering = createClusteringIntegration(customWeights);

  const vehicles = [
    {
      id: 'truck-001',
      startLocation: { latitude: 24.7136, longitude: 46.6753 },
      capacity_kg: 3000
    },
    {
      id: 'truck-002',
      startLocation: { latitude: 24.7500, longitude: 46.7000 }, // Far away
      capacity_kg: 3000
    }
  ];

  const pickupPoints = [
    {
      id: 'warehouse-1',
      location: { latitude: 24.7150, longitude: 46.6770 }
    }
  ];

  const deliveryPoints = [
    {
      id: 'urgent-001',
      location: { latitude: 24.7200, longitude: 46.6800 },
      load_kg: 500,
      pickupId: 'warehouse-1',
      priority: 'HIGH'
    }
  ];

  const result = clustering.assignVehiclesForPlanning(
    vehicles,
    pickupPoints,
    deliveryPoints
  );

  console.log('Custom Weights Applied:');
  console.log(JSON.stringify(customWeights, null, 2));

  console.log('\nResult:');
  console.log(`Assigned to: ${result.routes[0].vehicle.id}`);
  console.log('(Should be truck-001 due to proximity weight)');
}

// ============================================================================
// EXAMPLE 5: Multi-Pickup Scenario
// ============================================================================

async function example5_multiPickup() {
  console.log('\n=== EXAMPLE 5: Multi-Pickup Scenario ===\n');

  const vehicles = [
    {
      id: 'truck-001',
      startLocation: { latitude: 24.7136, longitude: 46.6753 },
      capacity_kg: 3000
    },
    {
      id: 'truck-002',
      startLocation: { latitude: 21.4225, longitude: 39.8262 },
      capacity_kg: 3000
    }
  ];

  const pickupPoints = [
    {
      id: 'warehouse-riyadh',
      location: { latitude: 24.7150, longitude: 46.6770 },
      name: 'Riyadh Warehouse'
    },
    {
      id: 'warehouse-jeddah',
      location: { latitude: 21.4240, longitude: 39.8280 },
      name: 'Jeddah Warehouse'
    }
  ];

  const deliveryPoints = [
    // Riyadh deliveries
    {
      id: 'RUH-001',
      location: { latitude: 24.7200, longitude: 46.6800 },
      load_kg: 500,
      pickupId: 'warehouse-riyadh'
    },
    {
      id: 'RUH-002',
      location: { latitude: 24.7250, longitude: 46.6850 },
      load_kg: 600,
      pickupId: 'warehouse-riyadh'
    },
    // Jeddah deliveries
    {
      id: 'JED-001',
      location: { latitude: 21.4300, longitude: 39.8350 },
      load_kg: 700,
      pickupId: 'warehouse-jeddah'
    },
    {
      id: 'JED-002',
      location: { latitude: 21.4350, longitude: 39.8400 },
      load_kg: 800,
      pickupId: 'warehouse-jeddah'
    }
  ];

  const clustering = createClusteringIntegration(PRESET_CONFIGS.proximity_focused);

  const result = clustering.assignVehiclesForPlanning(
    vehicles,
    pickupPoints,
    deliveryPoints
  );

  console.log('Multi-Pickup Assignment:');
  result.routes.forEach(route => {
    const pickup = pickupPoints.find(p => p.id === route.pickupId);
    console.log(`\nVehicle ${route.vehicle.id}:`);
    console.log(`  Pickup: ${pickup.name}`);
    console.log(`  Deliveries: ${route.deliveries.join(', ')}`);
    console.log(`  Distance: ${route.distance}km`);
  });
}

// ============================================================================
// EXAMPLE 6: Integration with Planning Agent
// ============================================================================

async function example6_planningAgentIntegration() {
  console.log('\n=== EXAMPLE 6: Planning Agent Integration ===\n');

  // This shows how to integrate with planning.agent.js

  const PlanningAgentExample = {
    clustering: createClusteringIntegration(PRESET_CONFIGS.default),

    async createInitialRoutes(pickupPoints, deliveryPoints, vehicles, businessRules, preferences) {
      console.log('Planning Agent: Creating initial routes with enhanced clustering');

      // Check if enhanced clustering is enabled
      if (preferences.useEnhancedClustering !== false) {
        console.log('Using enhanced clustering algorithm');

        const result = this.clustering.assignVehiclesForPlanning(
          vehicles,
          pickupPoints,
          deliveryPoints,
          preferences
        );

        console.log(`Generated ${result.routes.length} optimized routes`);
        return result.routes;
      } else {
        console.log('Enhanced clustering disabled, using fallback');
        // ... existing logic
      }
    }
  };

  // Example usage
  const vehicles = [
    {
      id: 'truck-001',
      startLocation: { latitude: 24.7136, longitude: 46.6753 },
      capacity_kg: 3000
    }
  ];

  const pickupPoints = [
    {
      id: 'warehouse-1',
      location: { latitude: 24.7150, longitude: 46.6770 }
    }
  ];

  const deliveryPoints = [
    {
      id: 'order-001',
      location: { latitude: 24.7200, longitude: 46.6800 },
      load_kg: 500,
      pickupId: 'warehouse-1'
    }
  ];

  const preferences = {
    useEnhancedClustering: true,
    distributionStrategy: 'best_match'
  };

  const routes = await PlanningAgentExample.createInitialRoutes(
    pickupPoints,
    deliveryPoints,
    vehicles,
    {},
    preferences
  );

  console.log(`\nGenerated routes: ${routes.length}`);
}

// ============================================================================
// EXAMPLE 7: Performance Comparison
// ============================================================================

async function example7_performanceComparison() {
  console.log('\n=== EXAMPLE 7: Performance Comparison ===\n');

  // Generate test data
  const vehicles = Array.from({ length: 20 }, (_, i) => ({
    id: `truck-${i + 1}`,
    startLocation: {
      latitude: 24.7 + (Math.random() * 0.1),
      longitude: 46.67 + (Math.random() * 0.1)
    },
    capacity_kg: 3000
  }));

  const pickupPoints = [
    {
      id: 'warehouse-1',
      location: { latitude: 24.7150, longitude: 46.6770 }
    }
  ];

  const deliveryPoints = Array.from({ length: 100 }, (_, i) => ({
    id: `order-${i + 1}`,
    location: {
      latitude: 24.7 + (Math.random() * 0.2),
      longitude: 46.67 + (Math.random() * 0.2)
    },
    load_kg: 100 + Math.random() * 500,
    pickupId: 'warehouse-1'
  }));

  console.log('Test Dataset:');
  console.log(`  Vehicles: ${vehicles.length}`);
  console.log(`  Pickups: ${pickupPoints.length}`);
  console.log(`  Deliveries: ${deliveryPoints.length}`);

  // Test different presets
  const results = {};

  for (const [name, config] of Object.entries(PRESET_CONFIGS)) {
    const clustering = createClusteringIntegration(config);

    const startTime = Date.now();
    const result = clustering.assignVehiclesForPlanning(
      vehicles,
      pickupPoints,
      deliveryPoints
    );
    const endTime = Date.now();

    results[name] = {
      processingTime: endTime - startTime,
      totalDistance: result.summary.totalDistance,
      vehiclesUsed: result.summary.vehiclesUsed,
      avgDeliveriesPerVehicle: result.summary.avgDeliveriesPerVehicle
    };
  }

  console.log('\nPerformance Comparison:');
  console.log('Preset Name              | Time (ms) | Distance (km) | Vehicles | Avg Del/Veh');
  console.log('------------------------|-----------|---------------|----------|-------------');

  Object.entries(results).forEach(([name, data]) => {
    console.log(
      `${name.padEnd(23)} | ${String(data.processingTime).padEnd(9)} | ${String(data.totalDistance.toFixed(1)).padEnd(13)} | ${String(data.vehiclesUsed).padEnd(8)} | ${data.avgDeliveriesPerVehicle.toFixed(1)}`
    );
  });
}

// ============================================================================
// RUN ALL EXAMPLES
// ============================================================================

async function runAllExamples() {
  try {
    await example1_basicUsage();
    await example2_presetConfigurations();
    await example3_existingRoutes();
    await example4_customWeights();
    await example5_multiPickup();
    await example6_planningAgentIntegration();
    await example7_performanceComparison();

    console.log('\n\n=== All Examples Completed Successfully ===\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export for use in other modules
module.exports = {
  example1_basicUsage,
  example2_presetConfigurations,
  example3_existingRoutes,
  example4_customWeights,
  example5_multiPickup,
  example6_planningAgentIntegration,
  example7_performanceComparison,
  runAllExamples
};

// Run if executed directly
if (require.main === module) {
  runAllExamples();
}
