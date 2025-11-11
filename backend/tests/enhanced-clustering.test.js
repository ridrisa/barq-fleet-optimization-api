/**
 * Unit Tests for Enhanced Clustering Algorithm
 */

const { EnhancedClustering, ClusteringConfig, DEFAULT_WEIGHTS } = require('../src/utils/enhanced-clustering');
const {
  ClusteringIntegration,
  createClusteringIntegration,
  validateClusteringConfig,
  PRESET_CONFIGS
} = require('../src/utils/clustering-integration');

describe('ClusteringConfig', () => {
  test('should initialize with default weights', () => {
    const config = new ClusteringConfig();
    expect(config.weights).toEqual(DEFAULT_WEIGHTS);
  });

  test('should initialize with custom weights', () => {
    const customWeights = {
      vehicleToPickupDistance: 0.3,
      pickupToDeliveryDistance: 0.3,
      deliveryClusterDensity: 0.2,
      vehicleLoadBalance: 0.1,
      existingRouteCompatibility: 0.1
    };
    const config = new ClusteringConfig(customWeights);
    expect(config.weights).toEqual(customWeights);
  });

  test('should validate that weights sum to 1.0', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const invalidWeights = {
      vehicleToPickupDistance: 0.5,
      pickupToDeliveryDistance: 0.5,
      deliveryClusterDensity: 0.2,
      vehicleLoadBalance: 0.1,
      existingRouteCompatibility: 0.1
    };

    new ClusteringConfig(invalidWeights);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('should update weights', () => {
    const config = new ClusteringConfig();
    const newWeights = {
      vehicleToPickupDistance: 0.3
    };

    config.updateWeights(newWeights);
    expect(config.weights.vehicleToPickupDistance).toBe(0.3);
  });
});

describe('EnhancedClustering', () => {
  let clustering;
  let mockVehicles;
  let mockPickups;
  let mockDeliveries;

  beforeEach(() => {
    clustering = new EnhancedClustering();

    mockVehicles = [
      {
        id: 'vehicle-1',
        startLocation: { latitude: 24.7136, longitude: 46.6753 },
        capacity_kg: 3000,
        name: 'Truck 1'
      },
      {
        id: 'vehicle-2',
        startLocation: { latitude: 24.7236, longitude: 46.6853 },
        capacity_kg: 3000,
        name: 'Truck 2'
      }
    ];

    mockPickups = [
      {
        id: 'pickup-1',
        location: { latitude: 24.7150, longitude: 46.6770 },
        name: 'Warehouse A'
      }
    ];

    mockDeliveries = [
      {
        id: 'delivery-1',
        location: { latitude: 24.7200, longitude: 46.6800 },
        customer_name: 'Customer 1',
        load_kg: 500,
        pickupId: 'pickup-1'
      },
      {
        id: 'delivery-2',
        location: { latitude: 24.7250, longitude: 46.6850 },
        customer_name: 'Customer 2',
        load_kg: 600,
        pickupId: 'pickup-1'
      },
      {
        id: 'delivery-3',
        location: { latitude: 24.7300, longitude: 46.6900 },
        customer_name: 'Customer 3',
        load_kg: 700,
        pickupId: 'pickup-1'
      }
    ];
  });

  test('should assign deliveries to vehicles', () => {
    const result = clustering.assignDeliveriesToVehicles(
      mockVehicles,
      mockPickups,
      mockDeliveries
    );

    expect(result).toHaveProperty('assignments');
    expect(result).toHaveProperty('summary');
    expect(Object.keys(result.assignments)).toHaveLength(2);
  });

  test('should throw error if no vehicles provided', () => {
    expect(() => {
      clustering.assignDeliveriesToVehicles([], mockPickups, mockDeliveries);
    }).toThrow('No vehicles available for clustering');
  });

  test('should throw error if no pickup points provided', () => {
    expect(() => {
      clustering.assignDeliveriesToVehicles(mockVehicles, [], mockDeliveries);
    }).toThrow('No pickup points provided');
  });

  test('should throw error if no deliveries provided', () => {
    expect(() => {
      clustering.assignDeliveriesToVehicles(mockVehicles, mockPickups, []);
    }).toThrow('No delivery points provided');
  });

  test('should calculate cluster density correctly', () => {
    const density = clustering.calculateClusterDensity(mockDeliveries);
    expect(density).toBeGreaterThanOrEqual(0);
    expect(density).toBeLessThanOrEqual(100);
  });

  test('should return max density for single delivery', () => {
    const singleDelivery = [mockDeliveries[0]];
    const density = clustering.calculateClusterDensity(singleDelivery);
    expect(density).toBe(100);
  });

  test('should group deliveries by pickup correctly', () => {
    const grouped = clustering.groupDeliveriesByPickup(mockPickups, mockDeliveries);
    expect(grouped.size).toBe(1);
    expect(grouped.get('pickup-1')).toHaveLength(3);
  });

  test('should calculate vehicle scores', () => {
    const assignments = new Map();
    mockVehicles.forEach(v => {
      assignments.set(v.id, {
        vehicle: v,
        pickupId: null,
        deliveries: [],
        totalLoad: 0,
        scores: [],
        metadata: {}
      });
    });

    const scores = clustering.calculateVehicleScores(
      mockVehicles,
      mockPickups[0],
      mockDeliveries,
      assignments
    );

    expect(scores).toHaveLength(2);
    expect(scores[0]).toHaveProperty('vehicleId');
    expect(scores[0]).toHaveProperty('score');
    expect(scores[0]).toHaveProperty('breakdown');
  });

  test('should analyze existing routes', () => {
    const vehicleWithRoute = {
      ...mockVehicles[0],
      currentRoute: {
        pickupId: 'pickup-1',
        deliveries: [mockDeliveries[0]],
        load_kg: 500
      }
    };

    const analysis = clustering.analyzeExistingRoutes(vehicleWithRoute);
    expect(analysis.hasExistingRoute).toBe(true);
    expect(analysis.pickupId).toBe('pickup-1');
    expect(analysis.deliveryCount).toBe(1);
    expect(analysis.currentLoad).toBe(500);
  });

  test('should handle vehicle with no existing route', () => {
    const analysis = clustering.analyzeExistingRoutes(mockVehicles[0]);
    expect(analysis.hasExistingRoute).toBe(false);
    expect(analysis.pickupId).toBeNull();
  });

  test('should calculate route distance', () => {
    const distance = clustering.calculateRouteDistance(
      mockVehicles[0],
      mockPickups[0],
      mockDeliveries
    );
    expect(distance).toBeGreaterThan(0);
  });

  test('should generate summary correctly', () => {
    const result = clustering.assignDeliveriesToVehicles(
      mockVehicles,
      mockPickups,
      mockDeliveries
    );

    expect(result.summary).toHaveProperty('vehiclesUsed');
    expect(result.summary).toHaveProperty('totalDeliveries');
    expect(result.summary).toHaveProperty('totalLoad');
    expect(result.summary).toHaveProperty('totalDistance');
    expect(result.summary.totalDeliveries).toBe(3);
  });
});

describe('ClusteringIntegration', () => {
  let integration;
  let mockVehicles;
  let mockPickups;
  let mockDeliveries;

  beforeEach(() => {
    integration = new ClusteringIntegration();

    mockVehicles = [
      {
        id: 'vehicle-1',
        startLocation: { latitude: 24.7136, longitude: 46.6753 },
        capacity_kg: 3000,
        name: 'Truck 1'
      }
    ];

    mockPickups = [
      {
        id: 'pickup-1',
        location: { latitude: 24.7150, longitude: 46.6770 },
        name: 'Warehouse A'
      }
    ];

    mockDeliveries = [
      {
        id: 'delivery-1',
        location: { latitude: 24.7200, longitude: 46.6800 },
        customer_name: 'Customer 1',
        load_kg: 500,
        pickupId: 'pickup-1'
      }
    ];
  });

  test('should assign vehicles for planning', () => {
    const result = integration.assignVehiclesForPlanning(
      mockVehicles,
      mockPickups,
      mockDeliveries
    );

    expect(result).toHaveProperty('routes');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('algorithm');
    expect(result.algorithm).toBe('enhanced_clustering');
  });

  test('should convert to route format correctly', () => {
    const clusteringResult = {
      assignments: {
        'vehicle-1': {
          vehicle: mockVehicles[0],
          pickupId: 'pickup-1',
          deliveries: mockDeliveries,
          totalLoad: 500,
          scores: [25.5],
          metadata: {
            avgScore: 25.5,
            clusterDensity: 85,
            totalDistance: 10.5
          }
        }
      },
      summary: {
        vehiclesUsed: 1,
        totalDeliveries: 1
      }
    };

    const result = integration.convertToRouteFormat(
      clusteringResult,
      mockVehicles,
      mockPickups
    );

    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]).toHaveProperty('waypoints');
    expect(result.routes[0]).toHaveProperty('clusteringMetadata');
  });

  test('should optimize delivery sequence', () => {
    const deliveries = [
      {
        id: 'del-1',
        location: { latitude: 24.72, longitude: 46.68 },
        priority: 'HIGH'
      },
      {
        id: 'del-2',
        location: { latitude: 24.73, longitude: 46.69 },
        priority: 'LOW'
      },
      {
        id: 'del-3',
        location: { latitude: 24.71, longitude: 46.67 },
        priority: 'MEDIUM'
      }
    ];

    const pickup = {
      location: { latitude: 24.715, longitude: 46.677 }
    };

    const optimized = integration.optimizeDeliverySequence(
      pickup,
      deliveries,
      { latitude: 24.713, longitude: 46.675 }
    );

    expect(optimized).toHaveLength(3);
    // High priority should be first
    expect(optimized[0].id).toBe('del-3'); // Nearest
  });

  test('should update weights', () => {
    const newWeights = {
      vehicleToPickupDistance: 0.3
    };

    integration.updateWeights(newWeights);
    const config = integration.getConfig();

    expect(config.weights.vehicleToPickupDistance).toBe(0.3);
  });
});

describe('Utility Functions', () => {
  test('should create integration instance', () => {
    const instance = createClusteringIntegration();
    expect(instance).toBeInstanceOf(ClusteringIntegration);
  });

  test('should create integration with custom weights', () => {
    const customWeights = {
      vehicleToPickupDistance: 0.3,
      pickupToDeliveryDistance: 0.3,
      deliveryClusterDensity: 0.2,
      vehicleLoadBalance: 0.1,
      existingRouteCompatibility: 0.1
    };

    const instance = createClusteringIntegration(customWeights);
    expect(instance.getConfig().weights).toEqual(customWeights);
  });

  test('should validate valid config', () => {
    const validConfig = {
      vehicleToPickupDistance: 0.25,
      pickupToDeliveryDistance: 0.30,
      deliveryClusterDensity: 0.20,
      vehicleLoadBalance: 0.15,
      existingRouteCompatibility: 0.10
    };

    const validation = validateClusteringConfig(validConfig);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('should detect invalid config - missing field', () => {
    const invalidConfig = {
      vehicleToPickupDistance: 0.5,
      pickupToDeliveryDistance: 0.5
    };

    const validation = validateClusteringConfig(invalidConfig);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  test('should detect invalid config - weights do not sum to 1', () => {
    const invalidConfig = {
      vehicleToPickupDistance: 0.5,
      pickupToDeliveryDistance: 0.5,
      deliveryClusterDensity: 0.2,
      vehicleLoadBalance: 0.1,
      existingRouteCompatibility: 0.1
    };

    const validation = validateClusteringConfig(invalidConfig);
    expect(validation.valid).toBe(false);
  });

  test('should have all preset configs', () => {
    expect(PRESET_CONFIGS).toHaveProperty('proximity_focused');
    expect(PRESET_CONFIGS).toHaveProperty('load_balanced');
    expect(PRESET_CONFIGS).toHaveProperty('cluster_optimized');
    expect(PRESET_CONFIGS).toHaveProperty('route_continuation');
    expect(PRESET_CONFIGS).toHaveProperty('default');
  });

  test('all preset configs should be valid', () => {
    Object.entries(PRESET_CONFIGS).forEach(([name, config]) => {
      const validation = validateClusteringConfig(config);
      expect(validation.valid).toBe(true);
    });
  });
});

describe('Integration with Existing Routes', () => {
  test('should prioritize vehicles with compatible routes', () => {
    const clustering = new EnhancedClustering();

    const vehicles = [
      {
        id: 'vehicle-1',
        startLocation: { latitude: 24.713, longitude: 46.675 },
        capacity_kg: 3000,
        currentRoute: {
          pickupId: 'pickup-1',
          deliveries: [],
          load_kg: 0
        }
      },
      {
        id: 'vehicle-2',
        startLocation: { latitude: 24.723, longitude: 46.685 },
        capacity_kg: 3000
      }
    ];

    const pickups = [
      {
        id: 'pickup-1',
        location: { latitude: 24.715, longitude: 46.677 }
      }
    ];

    const deliveries = [
      {
        id: 'delivery-1',
        location: { latitude: 24.720, longitude: 46.680 },
        load_kg: 500,
        pickupId: 'pickup-1'
      }
    ];

    const result = clustering.assignDeliveriesToVehicles(vehicles, pickups, deliveries);

    // Vehicle 1 should get the delivery since it already has a route to this pickup
    const vehicle1Assignment = result.assignments['vehicle-1'];
    expect(vehicle1Assignment.deliveries.length).toBeGreaterThan(0);
  });
});

// Performance test
describe('Performance Tests', () => {
  test('should handle large dataset efficiently', () => {
    const clustering = new EnhancedClustering();

    // Create 50 vehicles
    const vehicles = Array.from({ length: 50 }, (_, i) => ({
      id: `vehicle-${i}`,
      startLocation: {
        latitude: 24.7 + (Math.random() * 0.1),
        longitude: 46.67 + (Math.random() * 0.1)
      },
      capacity_kg: 3000
    }));

    // Create 10 pickups
    const pickups = Array.from({ length: 10 }, (_, i) => ({
      id: `pickup-${i}`,
      location: {
        latitude: 24.7 + (Math.random() * 0.1),
        longitude: 46.67 + (Math.random() * 0.1)
      }
    }));

    // Create 500 deliveries
    const deliveries = Array.from({ length: 500 }, (_, i) => ({
      id: `delivery-${i}`,
      location: {
        latitude: 24.7 + (Math.random() * 0.2),
        longitude: 46.67 + (Math.random() * 0.2)
      },
      load_kg: 100 + Math.random() * 500,
      pickupId: `pickup-${i % 10}`
    }));

    const startTime = Date.now();
    const result = clustering.assignDeliveriesToVehicles(vehicles, pickups, deliveries);
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    expect(result.summary.totalDeliveries).toBe(500);
  });
});
