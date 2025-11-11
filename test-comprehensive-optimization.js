const axios = require('axios');

// Test configuration
const API_URL = 'https://route-opt-backend-426674819922.us-central1.run.app/api/v1/optimize';
// const API_URL = 'http://localhost:3002/api/v1/optimize';

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Test scenarios
const testScenarios = [
  {
    name: "Scenario 1: Single Pickup, Multiple Vehicles (Original Issue)",
    description: "1 pickup, 3 vehicles, 13 deliveries",
    payload: {
      pickupPoints: [
        { name: "Central Hub", address: "King Fahd Road", lat: 24.7136, lng: 46.6753, priority: 10 }
      ],
      deliveryPoints: Array.from({ length: 13 }, (_, i) => ({
        name: `Customer ${i + 1}`,
        address: `Address ${i + 1}`,
        lat: 24.7136 + (Math.random() - 0.5) * 0.1,
        lng: 46.6753 + (Math.random() - 0.5) * 0.1,
        priority: Math.floor(Math.random() * 10) + 1,
        timeWindow: i % 3 === 0 ? { start: "09:00", end: "12:00" } : null
      })),
      fleet: {
        vehicleType: "van",
        count: 3,
        capacity: 1000
      },
      options: {
        optimizationMode: "balanced",
        considerTimeWindows: true
      }
    },
    expectedVehicles: 3,
    checkOptimization: true
  },
  {
    name: "Scenario 2: Multiple Pickups, Multiple Vehicles",
    description: "3 pickups, 4 vehicles, 20 deliveries",
    payload: {
      pickupPoints: [
        { name: "Hub 1", address: "North Hub", lat: 24.7636, lng: 46.6753, priority: 10 },
        { name: "Hub 2", address: "South Hub", lat: 24.6636, lng: 46.6753, priority: 8 },
        { name: "Hub 3", address: "East Hub", lat: 24.7136, lng: 46.7253, priority: 9 }
      ],
      deliveryPoints: Array.from({ length: 20 }, (_, i) => ({
        name: `Customer ${i + 1}`,
        address: `Address ${i + 1}`,
        lat: 24.7136 + (Math.random() - 0.5) * 0.2,
        lng: 46.6753 + (Math.random() - 0.5) * 0.2,
        priority: Math.floor(Math.random() * 10) + 1,
        demandSize: Math.floor(Math.random() * 50) + 10,
        timeWindow: i % 4 === 0 ? {
          start: `0${9 + Math.floor(i/4)}:00`,
          end: `${11 + Math.floor(i/4)}:00`
        } : null
      })),
      fleet: {
        vehicleType: "truck",
        count: 4,
        capacity: 2000
      },
      options: {
        optimizationMode: "fastest",
        considerTimeWindows: true,
        considerDemand: true
      }
    },
    expectedVehicles: 4,
    checkOptimization: true
  },
  {
    name: "Scenario 3: More Vehicles than Pickups",
    description: "2 pickups, 5 vehicles, 30 deliveries",
    payload: {
      pickupPoints: [
        { name: "Main Warehouse", address: "Central", lat: 24.7136, lng: 46.6753, priority: 10 },
        { name: "Secondary Warehouse", address: "West", lat: 24.7136, lng: 46.6253, priority: 8 }
      ],
      deliveryPoints: Array.from({ length: 30 }, (_, i) => ({
        name: `Customer ${i + 1}`,
        address: `Address ${i + 1}`,
        lat: 24.7136 + (Math.random() - 0.5) * 0.3,
        lng: 46.6753 + (Math.random() - 0.5) * 0.3,
        priority: Math.floor(Math.random() * 10) + 1,
        demandSize: Math.floor(Math.random() * 100) + 20
      })),
      fleet: {
        vehicleType: "car",
        count: 5,
        capacity: 500
      },
      options: {
        optimizationMode: "shortest",
        considerDemand: true
      }
    },
    expectedVehicles: 5,
    checkOptimization: true
  },
  {
    name: "Scenario 4: Complex with Time Windows and Priorities",
    description: "4 pickups, 6 vehicles, 40 deliveries with mixed constraints",
    payload: {
      pickupPoints: [
        { name: "Hub North", address: "North", lat: 24.8136, lng: 46.6753, priority: 10 },
        { name: "Hub South", address: "South", lat: 24.6136, lng: 46.6753, priority: 9 },
        { name: "Hub East", address: "East", lat: 24.7136, lng: 46.7753, priority: 8 },
        { name: "Hub West", address: "West", lat: 24.7136, lng: 46.5753, priority: 7 }
      ],
      deliveryPoints: Array.from({ length: 40 }, (_, i) => {
        const quadrant = i % 4; // Distribute across quadrants
        const latOffset = quadrant < 2 ? 0.05 : -0.05;
        const lngOffset = quadrant % 2 === 0 ? 0.05 : -0.05;

        return {
          name: `Customer ${i + 1}`,
          address: `Zone ${quadrant + 1}, Stop ${i + 1}`,
          lat: 24.7136 + latOffset + (Math.random() * 0.02),
          lng: 46.6753 + lngOffset + (Math.random() * 0.02),
          priority: 10 - (i % 10), // Varied priorities
          demandSize: 20 + Math.floor(Math.random() * 30),
          timeWindow: i % 3 === 0 ? {
            start: `${String(8 + Math.floor(i/10)).padStart(2, '0')}:00`,
            end: `${String(12 + Math.floor(i/10)).padStart(2, '0')}:00`
          } : null
        };
      }),
      fleet: {
        vehicleType: "van",
        count: 6,
        capacity: 400
      },
      options: {
        optimizationMode: "balanced",
        considerTimeWindows: true,
        considerDemand: true,
        considerPriority: true
      }
    },
    expectedVehicles: 6,
    checkOptimization: true
  },
  {
    name: "Scenario 5: Edge Case - Single Vehicle, Multiple Pickups",
    description: "3 pickups, 1 vehicle, 10 deliveries",
    payload: {
      pickupPoints: [
        { name: "Pickup 1", address: "P1", lat: 24.7136, lng: 46.6753, priority: 10 },
        { name: "Pickup 2", address: "P2", lat: 24.7236, lng: 46.6853, priority: 9 },
        { name: "Pickup 3", address: "P3", lat: 24.7036, lng: 46.6653, priority: 8 }
      ],
      deliveryPoints: Array.from({ length: 10 }, (_, i) => ({
        name: `Delivery ${i + 1}`,
        address: `D${i + 1}`,
        lat: 24.7136 + (Math.random() - 0.5) * 0.05,
        lng: 46.6753 + (Math.random() - 0.5) * 0.05,
        priority: 5
      })),
      fleet: {
        vehicleType: "bike",
        count: 1,
        capacity: 100
      },
      options: {
        optimizationMode: "shortest"
      }
    },
    expectedVehicles: 1,
    checkOptimization: true
  }
];

// Function to calculate total distance of a route
function calculateRouteDistance(route) {
  let totalDistance = 0;
  const stops = route.stops || [];

  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i];
    const to = stops[i + 1];
    // Simple Euclidean distance
    const distance = Math.sqrt(
      Math.pow(to.location.lat - from.location.lat, 2) +
      Math.pow(to.location.lng - from.location.lng, 2)
    ) * 111; // Rough conversion to km
    totalDistance += distance;
  }

  return totalDistance;
}

// Function to check if optimization is working
function analyzeOptimization(result, scenario) {
  const analysis = {
    isOptimized: true,
    reasons: [],
    metrics: {}
  };

  // Check 1: Vehicle utilization
  const activeVehicles = result.routes.filter(r => r.stops.length > 2); // More than just pickup and return
  analysis.metrics.vehicleUtilization = `${activeVehicles.length}/${scenario.expectedVehicles}`;

  // Check 2: Distance optimization - routes shouldn't be random
  const distances = result.routes.map(r => calculateRouteDistance(r));
  const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
  const maxDistance = Math.max(...distances);
  const minDistance = Math.min(...distances.filter(d => d > 0));

  analysis.metrics.avgDistance = avgDistance.toFixed(2) + ' km';
  analysis.metrics.distanceRange = `${minDistance.toFixed(2)}-${maxDistance.toFixed(2)} km`;

  // If distances vary too much, might not be optimized
  if (maxDistance > minDistance * 3 && minDistance > 0) {
    analysis.reasons.push("Large variance in route distances suggests suboptimal distribution");
  }

  // Check 3: Time windows (if applicable)
  if (scenario.payload.options.considerTimeWindows) {
    let timeWindowViolations = 0;
    result.routes.forEach(route => {
      route.stops.forEach(stop => {
        if (stop.timeWindow && stop.estimatedArrival) {
          const arrival = stop.estimatedArrival;
          const window = stop.timeWindow;
          // Simple check - would need proper time parsing in production
          if (arrival < window.start || arrival > window.end) {
            timeWindowViolations++;
          }
        }
      });
    });

    if (timeWindowViolations > 0) {
      analysis.isOptimized = false;
      analysis.reasons.push(`${timeWindowViolations} time window violations found`);
    }
    analysis.metrics.timeWindowViolations = timeWindowViolations;
  }

  // Check 4: Priority ordering
  if (scenario.payload.options.considerPriority) {
    let priorityScore = 0;
    result.routes.forEach(route => {
      const priorities = route.stops
        .filter(s => s.type === 'delivery')
        .map(s => s.priority || 0);

      // Check if higher priority deliveries come first
      for (let i = 0; i < priorities.length - 1; i++) {
        if (priorities[i] >= priorities[i + 1]) {
          priorityScore++;
        }
      }
    });

    analysis.metrics.priorityAdherence = `${priorityScore} correctly ordered`;
  }

  // Check 5: Capacity constraints
  if (scenario.payload.options.considerDemand) {
    let capacityViolations = 0;
    result.routes.forEach(route => {
      const totalDemand = route.stops
        .filter(s => s.type === 'delivery')
        .reduce((sum, s) => sum + (s.demandSize || 0), 0);

      if (totalDemand > scenario.payload.fleet.capacity) {
        capacityViolations++;
        analysis.isOptimized = false;
        analysis.reasons.push(`Vehicle ${route.vehicleId} exceeds capacity`);
      }
    });

    analysis.metrics.capacityViolations = capacityViolations;
  }

  // Check 6: Clustering - deliveries should be geographically grouped
  result.routes.forEach((route, idx) => {
    const lats = route.stops.filter(s => s.type === 'delivery').map(s => s.location.lat);
    const lngs = route.stops.filter(s => s.type === 'delivery').map(s => s.location.lng);

    if (lats.length > 0) {
      const latRange = Math.max(...lats) - Math.min(...lats);
      const lngRange = Math.max(...lngs) - Math.min(...lngs);
      const spread = Math.sqrt(latRange * latRange + lngRange * lngRange) * 111;

      analysis.metrics[`route${idx + 1}Spread`] = spread.toFixed(2) + ' km';

      if (spread > 20) { // If spread is more than 20km
        analysis.reasons.push(`Route ${idx + 1} has wide geographic spread (${spread.toFixed(2)}km)`);
      }
    }
  });

  return analysis;
}

// Main test function
async function runComprehensiveTests() {
  console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  COMPREHENSIVE OPTIMIZATION TEST SUITE ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}\n`);
  console.log(`Testing endpoint: ${colors.yellow}${API_URL}${colors.reset}\n`);

  const results = [];

  for (const scenario of testScenarios) {
    console.log(`${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}${colors.magenta}${scenario.name}${colors.reset}`);
    console.log(`${colors.yellow}${scenario.description}${colors.reset}`);
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

    try {
      const startTime = Date.now();
      const response = await axios.post(API_URL, scenario.payload, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });
      const endTime = Date.now();

      const result = response.data;
      const executionTime = endTime - startTime;

      // Basic validation
      const vehiclesUsed = result.routes ? result.routes.length : 0;
      const totalDeliveries = result.routes.reduce((sum, route) =>
        sum + route.stops.filter(s => s.type === 'delivery').length, 0
      );
      const expectedDeliveries = scenario.payload.deliveryPoints.length;

      console.log(`\n${colors.bright}Results:${colors.reset}`);
      console.log(`  • Vehicles requested: ${scenario.expectedVehicles}`);
      console.log(`  • Vehicles used: ${vehiclesUsed} ${vehiclesUsed === scenario.expectedVehicles ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
      console.log(`  • Deliveries covered: ${totalDeliveries}/${expectedDeliveries} ${totalDeliveries === expectedDeliveries ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
      console.log(`  • Response time: ${executionTime}ms`);

      // Detailed route breakdown
      console.log(`\n${colors.bright}Route Distribution:${colors.reset}`);
      result.routes.forEach((route, idx) => {
        const deliveries = route.stops.filter(s => s.type === 'delivery');
        const pickups = route.stops.filter(s => s.type === 'pickup');
        const distance = calculateRouteDistance(route);

        console.log(`  ${colors.cyan}Route ${idx + 1}${colors.reset} (${route.vehicleId}):`);
        console.log(`    • Pickups: ${pickups.length}`);
        console.log(`    • Deliveries: ${deliveries.length}`);
        console.log(`    • Distance: ${distance.toFixed(2)}km`);
        console.log(`    • Total stops: ${route.stops.length}`);
      });

      // Optimization analysis
      if (scenario.checkOptimization) {
        const optimization = analyzeOptimization(result, scenario);

        console.log(`\n${colors.bright}Optimization Analysis:${colors.reset}`);
        console.log(`  • Status: ${optimization.isOptimized ? colors.green + 'OPTIMIZED' : colors.red + 'SUBOPTIMAL'}${colors.reset}`);

        if (Object.keys(optimization.metrics).length > 0) {
          console.log(`  • Metrics:`);
          Object.entries(optimization.metrics).forEach(([key, value]) => {
            console.log(`    - ${key}: ${value}`);
          });
        }

        if (optimization.reasons.length > 0) {
          console.log(`  • Issues:`);
          optimization.reasons.forEach(reason => {
            console.log(`    ${colors.yellow}⚠ ${reason}${colors.reset}`);
          });
        }
      }

      // Check for specific optimization indicators
      console.log(`\n${colors.bright}Optimization Indicators:${colors.reset}`);

      // Are routes balanced?
      const routeLengths = result.routes.map(r => r.stops.filter(s => s.type === 'delivery').length);
      const avgRouteLength = routeLengths.reduce((a, b) => a + b, 0) / routeLengths.length;
      const maxDeviation = Math.max(...routeLengths.map(l => Math.abs(l - avgRouteLength)));
      const isBalanced = maxDeviation <= Math.ceil(avgRouteLength * 0.3);

      console.log(`  • Load balancing: ${isBalanced ? colors.green + 'BALANCED' : colors.yellow + 'IMBALANCED'} ${colors.reset}(max deviation: ${maxDeviation.toFixed(1)})`);

      // Geographic clustering
      const avgSpread = result.routes.map(r => {
        const deliveries = r.stops.filter(s => s.type === 'delivery');
        if (deliveries.length === 0) return 0;

        const lats = deliveries.map(d => d.location.lat);
        const lngs = deliveries.map(d => d.location.lng);
        const latRange = Math.max(...lats) - Math.min(...lats);
        const lngRange = Math.max(...lngs) - Math.min(...lngs);
        return Math.sqrt(latRange * latRange + lngRange * lngRange) * 111;
      }).reduce((a, b) => a + b, 0) / vehiclesUsed;

      console.log(`  • Geographic clustering: ${avgSpread < 10 ? colors.green + 'TIGHT' : avgSpread < 20 ? colors.yellow + 'MODERATE' : colors.red + 'SPREAD'} ${colors.reset}(avg: ${avgSpread.toFixed(2)}km)`);

      // Store results
      results.push({
        scenario: scenario.name,
        passed: vehiclesUsed === scenario.expectedVehicles && totalDeliveries === expectedDeliveries,
        vehiclesUsed,
        expectedVehicles: scenario.expectedVehicles,
        deliveriesCovered: totalDeliveries,
        expectedDeliveries,
        executionTime,
        optimized: optimization?.isOptimized || false
      });

      console.log(`\n${colors.green}✓ Scenario completed${colors.reset}\n`);

    } catch (error) {
      console.error(`${colors.red}✗ Test failed:${colors.reset}`, error.response?.data || error.message);
      results.push({
        scenario: scenario.name,
        passed: false,
        error: error.message
      });
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Final summary
  console.log(`\n${colors.bright}${colors.cyan}========================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}           TEST SUMMARY                 ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}\n`);

  const passed = results.filter(r => r.passed).length;
  const optimized = results.filter(r => r.optimized).length;

  console.log(`Total scenarios: ${results.length}`);
  console.log(`Passed: ${colors.green}${passed}${colors.reset}`);
  console.log(`Failed: ${colors.red}${results.length - passed}${colors.reset}`);
  console.log(`Optimized: ${colors.green}${optimized}${colors.reset}`);
  console.log(`Suboptimal: ${colors.yellow}${results.length - optimized}${colors.reset}`);

  console.log(`\n${colors.bright}Detailed Results:${colors.reset}`);
  results.forEach(r => {
    const status = r.passed ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
    const optStatus = r.optimized ? `${colors.green}OPT${colors.reset}` : `${colors.yellow}SUB${colors.reset}`;
    console.log(`  • ${r.scenario}: ${status} | ${optStatus} | ${r.executionTime}ms`);
    if (!r.passed) {
      if (r.error) {
        console.log(`    Error: ${r.error}`);
      } else {
        console.log(`    Expected ${r.expectedVehicles} vehicles, got ${r.vehiclesUsed}`);
        console.log(`    Expected ${r.expectedDeliveries} deliveries, got ${r.deliveriesCovered}`);
      }
    }
  });

  console.log(`\n${colors.bright}${colors.cyan}========================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}         TESTS COMPLETED                ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}\n`);

  // Overall conclusion
  if (passed === results.length) {
    console.log(`${colors.bright}${colors.green}✅ ALL TESTS PASSED - System is working correctly!${colors.reset}`);
    console.log(`${colors.green}The optimization handles multiple vehicles, pickups, and deliveries properly.${colors.reset}`);
  } else {
    console.log(`${colors.bright}${colors.red}⚠️  SOME TESTS FAILED - System needs attention${colors.reset}`);
  }

  if (optimized < results.length) {
    console.log(`${colors.yellow}Note: Some scenarios show suboptimal routing. Consider tuning optimization parameters.${colors.reset}`);
  }
}

// Run tests
runComprehensiveTests().catch(console.error);