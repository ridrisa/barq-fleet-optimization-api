/**
 * Batch Optimization Agent
 * Groups orders efficiently for batch delivery
 * Optimizes for BULLET orders while respecting BARQ urgency
 */

const { generateId } = require('../utils/helper');
const { logger } = require('../utils/logger');

class BatchOptimizationAgent {
  constructor() {
    // Batching rules by service type
    this.batchingRules = {
      BARQ: {
        enabled: true,
        maxBatchSize: 3, // Maximum 3 BARQ orders per batch
        maxDetour: 2, // Maximum 2km detour
        maxDelay: 10, // Maximum 10 minute delay
        maxRadius: 3, // Cluster radius of 3km
        minSimilarity: 0.7, // Minimum 70% route similarity
      },
      BULLET: {
        enabled: true,
        maxBatchSize: 8, // Maximum 8 BULLET orders per batch
        maxDetour: 5, // Maximum 5km detour
        maxDelay: 30, // Maximum 30 minute delay
        maxRadius: 8, // Cluster radius of 8km
        minSimilarity: 0.5, // Minimum 50% route similarity
      },
    };

    // Clustering algorithms
    this.clusteringMethods = {
      kmeans: this.kMeansClustering.bind(this),
      dbscan: this.dbscanClustering.bind(this),
      hierarchical: this.hierarchicalClustering.bind(this),
    };

    // Batch quality metrics
    this.qualityMetrics = {
      excellent: { efficiency: 0.9, density: 0.8 },
      good: { efficiency: 0.7, density: 0.6 },
      acceptable: { efficiency: 0.5, density: 0.4 },
    };

    this.activeBatches = new Map();

    console.log('Batch Optimization Agent initialized');
  }

  /**
   * Main execution method
   */
  async execute(context) {
    const startTime = Date.now();
    logger.info('[BatchOptimization] Finding optimal batches', {
      orderCount: context.pendingOrders?.length || 0,
    });

    const batchingResult = {
      timestamp: Date.now(),
      batches: {
        created: [],
        modified: [],
        unbatchable: [],
      },
      metrics: {
        totalOrders: 0,
        batchedOrders: 0,
        totalBatches: 0,
        avgBatchSize: 0,
        efficiency: 0,
      },
      recommendations: [],
      savings: {},
    };

    try {
      // Get pending orders
      const pendingOrders = context.pendingOrders || (await this.getPendingOrders());
      batchingResult.metrics.totalOrders = pendingOrders.length;

      if (pendingOrders.length === 0) {
        logger.info('[BatchOptimization] No pending orders to batch');
        return batchingResult;
      }

      // Get available fleet capacity
      const fleetCapacity = context.fleetStatus || (await this.getFleetCapacity());

      // Separate orders by service type
      const ordersByType = this.categorizeOrdersByType(pendingOrders);

      // Process BARQ orders (limited batching due to urgency)
      if (ordersByType.BARQ.length > 0) {
        const barqBatches = await this.processBARQBatches(ordersByType.BARQ, fleetCapacity);
        batchingResult.batches.created.push(...barqBatches);
      }

      // Process BULLET orders (aggressive batching)
      if (ordersByType.BULLET.length > 0) {
        const bulletBatches = await this.processBULLETBatches(ordersByType.BULLET, fleetCapacity);
        batchingResult.batches.created.push(...bulletBatches);
      }

      // Identify unbatchable orders
      batchingResult.batches.unbatchable = this.identifyUnbatchableOrders(
        pendingOrders,
        batchingResult.batches.created
      );

      // Calculate metrics
      batchingResult.metrics = this.calculateBatchingMetrics(batchingResult);

      // Calculate savings
      batchingResult.savings = await this.calculateBatchingSavings(batchingResult);

      // Generate recommendations
      batchingResult.recommendations = this.generateRecommendations(batchingResult, fleetCapacity);

      // Store active batches
      this.storeActiveBatches(batchingResult.batches.created);

      const executionTime = Date.now() - startTime;
      logger.info(`[BatchOptimization] Completed in ${executionTime}ms`, {
        totalBatches: batchingResult.batches.created.length,
        efficiency: batchingResult.metrics.efficiency,
      });

      return batchingResult;
    } catch (error) {
      logger.error('[BatchOptimization] Batching failed', {
        error: error.message,
      });

      batchingResult.error = error.message;
      return batchingResult;
    }
  }

  /**
   * Process BARQ orders with limited batching
   */
  async processBARQBatches(barqOrders, fleetCapacity) {
    logger.info('[BatchOptimization] Processing BARQ batches', {
      orderCount: barqOrders.length,
    });

    const batches = [];
    const rules = this.batchingRules.BARQ;

    if (!rules.enabled) {
      // No batching for BARQ - each order gets its own batch
      return barqOrders.map((order) => this.createSingleOrderBatch(order, 'BARQ'));
    }

    // Use strict clustering for BARQ orders
    const clusters = await this.clusterOrders(barqOrders, {
      method: 'dbscan',
      maxRadius: rules.maxRadius,
      minPoints: 2,
      maxSize: rules.maxBatchSize,
    });

    for (const cluster of clusters) {
      // Validate time windows compatibility
      if (!this.validateTimeWindows(cluster.orders, rules.maxDelay)) {
        // Split cluster if time windows incompatible
        const subClusters = this.splitByTimeWindows(cluster.orders, rules.maxDelay);
        for (const subCluster of subClusters) {
          const batch = await this.createBatch(subCluster, 'BARQ');
          if (batch.qualityScore >= 0.7) {
            // High quality threshold for BARQ
            batches.push(batch);
          } else {
            // Create individual batches if quality too low
            batches.push(...subCluster.map((o) => this.createSingleOrderBatch(o, 'BARQ')));
          }
        }
      } else {
        // Create batch from cluster
        const batch = await this.createBatch(cluster.orders, 'BARQ');

        // Verify SLA compliance
        if (this.verifySLACompliance(batch, 'BARQ')) {
          batches.push(batch);
        } else {
          // Break down if SLA at risk
          const safeBatches = await this.breakDownForSLA(batch, 'BARQ');
          batches.push(...safeBatches);
        }
      }
    }

    return batches;
  }

  /**
   * Process BULLET orders with aggressive batching
   */
  async processBULLETBatches(bulletOrders, fleetCapacity) {
    logger.info('[BatchOptimization] Processing BULLET batches', {
      orderCount: bulletOrders.length,
    });

    const batches = [];
    const rules = this.batchingRules.BULLET;

    // Use k-means clustering for BULLET orders
    const clusters = await this.clusterOrders(bulletOrders, {
      method: 'kmeans',
      k: Math.ceil(bulletOrders.length / rules.maxBatchSize),
      maxIterations: 100,
      maxSize: rules.maxBatchSize,
    });

    for (const cluster of clusters) {
      // Optimize cluster composition
      const optimizedCluster = await this.optimizeClusterComposition(cluster.orders, rules);

      // Create batch from optimized cluster
      const batch = await this.createBatch(optimizedCluster, 'BULLET');

      // Apply TSP optimization for delivery sequence
      batch.optimizedSequence = await this.solveTSP(batch.orders);

      // Calculate efficiency score
      batch.efficiencyScore = this.calculateBatchEfficiency(batch);

      // Only keep high-efficiency batches
      if (batch.efficiencyScore >= 0.5) {
        batches.push(batch);
      } else {
        // Try alternative batching strategies
        const alternativeBatches = await this.tryAlternativeStrategies(optimizedCluster, 'BULLET');
        batches.push(...alternativeBatches);
      }
    }

    // Try to merge small batches
    const mergedBatches = await this.mergeSmallBatches(batches, rules);

    return mergedBatches;
  }

  /**
   * Cluster orders using specified method
   */
  async clusterOrders(orders, config) {
    const method = this.clusteringMethods[config.method] || this.kMeansClustering;
    return await method(orders, config);
  }

  /**
   * K-means clustering algorithm
   */
  async kMeansClustering(orders, config) {
    const k = config.k || Math.ceil(orders.length / 5);
    const maxIterations = config.maxIterations || 100;
    const clusters = [];

    // Initialize centroids
    let centroids = this.initializeCentroids(orders, k);

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Assign orders to nearest centroid
      const assignments = new Array(k).fill(null).map(() => []);

      for (const order of orders) {
        const nearestIndex = this.findNearestCentroid(order, centroids);
        assignments[nearestIndex].push(order);
      }

      // Update centroids
      const newCentroids = assignments.map((cluster) => this.calculateCentroid(cluster));

      // Check convergence
      if (this.hasConverged(centroids, newCentroids)) {
        break;
      }

      centroids = newCentroids;
    }

    // Create final clusters
    for (let i = 0; i < centroids.length; i++) {
      const clusterOrders = [];
      for (const order of orders) {
        if (this.findNearestCentroid(order, centroids) === i) {
          clusterOrders.push(order);
        }
      }

      if (clusterOrders.length > 0) {
        // Respect max size constraint
        if (clusterOrders.length > config.maxSize) {
          // Split large clusters
          const subClusters = this.splitLargeCluster(clusterOrders, config.maxSize);
          clusters.push(...subClusters);
        } else {
          clusters.push({
            id: generateId(),
            centroid: centroids[i],
            orders: clusterOrders,
          });
        }
      }
    }

    return clusters;
  }

  /**
   * DBSCAN clustering algorithm
   */
  async dbscanClustering(orders, config) {
    const eps = config.maxRadius || 5;
    const minPoints = config.minPoints || 2;
    const clusters = [];
    const visited = new Set();
    const noise = new Set();

    for (const order of orders) {
      if (visited.has(order.id)) continue;
      visited.add(order.id);

      const neighbors = this.getNeighbors(order, orders, eps);

      if (neighbors.length < minPoints) {
        noise.add(order.id);
      } else {
        // Create new cluster
        const cluster = {
          id: generateId(),
          orders: [],
        };

        // Expand cluster
        const queue = [...neighbors];
        const clusterSet = new Set([order.id]);

        while (queue.length > 0) {
          const neighbor = queue.shift();

          if (!visited.has(neighbor.id)) {
            visited.add(neighbor.id);

            const neighborNeighbors = this.getNeighbors(neighbor, orders, eps);
            if (neighborNeighbors.length >= minPoints) {
              queue.push(...neighborNeighbors.filter((n) => !visited.has(n.id)));
            }
          }

          if (!clusterSet.has(neighbor.id)) {
            clusterSet.add(neighbor.id);
            cluster.orders.push(neighbor);
          }
        }

        cluster.orders.push(order);

        // Respect max size
        if (cluster.orders.length > config.maxSize) {
          const subClusters = this.splitLargeCluster(cluster.orders, config.maxSize);
          clusters.push(...subClusters);
        } else {
          clusters.push(cluster);
        }
      }
    }

    return clusters;
  }

  /**
   * Hierarchical clustering algorithm
   */
  async hierarchicalClustering(orders, config) {
    // Simplified implementation
    return this.kMeansClustering(orders, config);
  }

  /**
   * Create batch from orders
   */
  async createBatch(orders, serviceType) {
    const batch = {
      id: generateId(),
      serviceType: serviceType,
      createdAt: Date.now(),
      orders: orders,
      status: 'pending',
      metrics: {},
    };

    // Calculate batch center
    batch.center = this.calculateCentroid(orders);

    // Calculate batch radius
    batch.radius = this.calculateBatchRadius(orders, batch.center);

    // Estimate delivery time
    batch.estimatedDeliveryTime = this.estimateDeliveryTime(orders, serviceType);

    // Calculate density
    batch.density = this.calculateDensity(orders, batch.radius);

    // Calculate quality score
    batch.qualityScore = this.calculateBatchQuality(batch);

    // Find optimal pickup points
    batch.pickupPoints = await this.identifyPickupPoints(orders);

    // Calculate route preview
    batch.routePreview = await this.generateRoutePreview(batch);

    return batch;
  }

  /**
   * Create single order batch
   */
  createSingleOrderBatch(order, serviceType) {
    return {
      id: generateId(),
      serviceType: serviceType,
      createdAt: Date.now(),
      orders: [order],
      status: 'pending',
      isSingleOrder: true,
      center: order.location || order,
      radius: 0,
      estimatedDeliveryTime: serviceType === 'BARQ' ? 60 : 240,
      density: 1,
      qualityScore: 1,
    };
  }

  /**
   * Optimize cluster composition
   */
  async optimizeClusterComposition(orders, rules) {
    // Remove outliers
    const filtered = this.removeOutliers(orders);

    // Balance by priority
    const balanced = this.balanceByPriority(filtered);

    // Ensure capacity constraints
    const capacityChecked = this.checkCapacityConstraints(balanced, rules);

    return capacityChecked;
  }

  /**
   * Calculate batch efficiency
   */
  calculateBatchEfficiency(batch) {
    // Factors for efficiency calculation
    const factors = {
      density: this.calculateDensityScore(batch),
      timeWindow: this.calculateTimeWindowScore(batch),
      distance: this.calculateDistanceScore(batch),
      capacity: this.calculateCapacityScore(batch),
    };

    // Weighted average
    const weights = {
      density: 0.3,
      timeWindow: 0.25,
      distance: 0.25,
      capacity: 0.2,
    };

    let efficiency = 0;
    for (const [factor, score] of Object.entries(factors)) {
      efficiency += score * weights[factor];
    }

    return efficiency;
  }

  /**
   * Verify SLA compliance for batch
   */
  verifySLACompliance(batch, serviceType) {
    const maxTime = serviceType === 'BARQ' ? 60 : 240;

    // Check if all orders can be delivered within SLA
    const estimatedTime = batch.estimatedDeliveryTime;

    if (estimatedTime > maxTime * 0.9) {
      // 90% of SLA time
      return false;
    }

    // Check individual order SLAs
    for (const order of batch.orders) {
      const orderDeadline = this.getOrderDeadline(order, serviceType);
      if (estimatedTime > orderDeadline) {
        return false;
      }
    }

    return true;
  }

  /**
   * Break down batch to meet SLA
   */
  async breakDownForSLA(batch, serviceType) {
    const safeBatches = [];
    const maxTime = serviceType === 'BARQ' ? 50 : 200; // Conservative limits

    // Sort orders by urgency
    const sortedOrders = [...batch.orders].sort((a, b) => {
      const aUrgency = this.calculateUrgency(a);
      const bUrgency = this.calculateUrgency(b);
      return bUrgency - aUrgency;
    });

    let currentBatch = [];
    let currentTime = 0;

    for (const order of sortedOrders) {
      const orderTime = this.estimateOrderDeliveryTime(order);

      if (currentTime + orderTime <= maxTime) {
        currentBatch.push(order);
        currentTime += orderTime;
      } else {
        // Start new batch
        if (currentBatch.length > 0) {
          safeBatches.push(await this.createBatch(currentBatch, serviceType));
        }
        currentBatch = [order];
        currentTime = orderTime;
      }
    }

    // Add remaining orders
    if (currentBatch.length > 0) {
      safeBatches.push(await this.createBatch(currentBatch, serviceType));
    }

    return safeBatches;
  }

  /**
   * Try alternative batching strategies
   */
  async tryAlternativeStrategies(orders, serviceType) {
    const strategies = [
      { name: 'priority-based', fn: this.priorityBasedBatching },
      { name: 'time-window-based', fn: this.timeWindowBasedBatching },
      { name: 'geographic-based', fn: this.geographicBasedBatching },
    ];

    let bestBatches = [];
    let bestScore = 0;

    for (const strategy of strategies) {
      const batches = await strategy.fn.call(this, orders, serviceType);
      const score = this.evaluateBatchingStrategy(batches);

      if (score > bestScore) {
        bestScore = score;
        bestBatches = batches;
      }
    }

    return bestBatches;
  }

  /**
   * Merge small batches for efficiency
   */
  async mergeSmallBatches(batches, rules) {
    const merged = [];
    const processed = new Set();

    for (let i = 0; i < batches.length; i++) {
      if (processed.has(i)) continue;

      const batch1 = batches[i];

      if (batch1.orders.length >= rules.maxBatchSize * 0.7) {
        // Batch is large enough
        merged.push(batch1);
        processed.add(i);
        continue;
      }

      // Try to merge with another small batch
      for (let j = i + 1; j < batches.length; j++) {
        if (processed.has(j)) continue;

        const batch2 = batches[j];
        const combinedSize = batch1.orders.length + batch2.orders.length;

        if (combinedSize <= rules.maxBatchSize) {
          // Check if merging makes sense geographically
          const distance = this.calculateDistance(batch1.center, batch2.center);

          if (distance <= rules.maxRadius) {
            // Merge batches
            const mergedBatch = await this.createBatch(
              [...batch1.orders, ...batch2.orders],
              batch1.serviceType
            );

            merged.push(mergedBatch);
            processed.add(i);
            processed.add(j);
            break;
          }
        }
      }

      if (!processed.has(i)) {
        merged.push(batch1);
        processed.add(i);
      }
    }

    return merged;
  }

  /**
   * Calculate batching metrics
   */
  calculateBatchingMetrics(batchingResult) {
    const metrics = {
      totalOrders: batchingResult.metrics.totalOrders || 0,
      batchedOrders: 0,
      totalBatches: batchingResult.batches.created.length,
      avgBatchSize: 0,
      efficiency: 0,
      compressionRatio: 0,
    };

    // Count batched orders
    for (const batch of batchingResult.batches.created) {
      metrics.batchedOrders += batch.orders.length;
    }

    // Calculate average batch size
    if (metrics.totalBatches > 0) {
      metrics.avgBatchSize = metrics.batchedOrders / metrics.totalBatches;
    }

    // Calculate efficiency (orders batched vs total)
    if (metrics.totalOrders > 0) {
      metrics.efficiency = metrics.batchedOrders / metrics.totalOrders;
    }

    // Calculate compression ratio
    if (metrics.batchedOrders > 0) {
      metrics.compressionRatio = metrics.totalBatches / metrics.batchedOrders;
    }

    return metrics;
  }

  /**
   * Calculate batching savings
   */
  async calculateBatchingSavings(batchingResult) {
    const savings = {
      distanceReduction: 0,
      timeReduction: 0,
      vehiclesReduced: 0,
      costSavings: 0,
    };

    // Compare batched vs individual delivery
    const individualDistance = batchingResult.metrics.batchedOrders * 10; // Avg 10km per order
    const batchedDistance = batchingResult.batches.created.length * 15; // Avg 15km per batch

    savings.distanceReduction = Math.max(0, individualDistance - batchedDistance);

    // Time savings
    const individualTime = batchingResult.metrics.batchedOrders * 30; // 30 min per order
    const batchedTime = batchingResult.batches.created.length * 45; // 45 min per batch

    savings.timeReduction = Math.max(0, individualTime - batchedTime);

    // Vehicle reduction
    savings.vehiclesReduced = Math.max(
      0,
      batchingResult.metrics.batchedOrders - batchingResult.batches.created.length
    );

    // Cost savings (simplified)
    const costPerKm = 0.5;
    const costPerHour = 20;

    savings.costSavings =
      savings.distanceReduction * costPerKm + (savings.timeReduction / 60) * costPerHour;

    return savings;
  }

  /**
   * Generate batching recommendations
   */
  generateRecommendations(batchingResult, fleetCapacity) {
    const recommendations = [];

    // Check batch efficiency
    if (batchingResult.metrics.efficiency < 0.5) {
      recommendations.push({
        type: 'efficiency',
        priority: 'high',
        message: 'Low batching efficiency detected',
        action: 'Consider adjusting batching rules or time windows',
      });
    }

    // Check unbatchable orders
    if (batchingResult.batches.unbatchable.length > 5) {
      recommendations.push({
        type: 'unbatchable',
        priority: 'medium',
        message: `${batchingResult.batches.unbatchable.length} orders could not be batched`,
        action: 'Review order distribution and consider individual assignment',
      });
    }

    // Check fleet capacity
    if (batchingResult.batches.created.length > fleetCapacity.availableDrivers) {
      recommendations.push({
        type: 'capacity',
        priority: 'critical',
        message: 'More batches than available drivers',
        action: 'Activate additional drivers or delay some deliveries',
      });
    }

    // Suggest optimal batch size
    if (batchingResult.metrics.avgBatchSize < 3) {
      recommendations.push({
        type: 'optimization',
        priority: 'low',
        message: 'Small average batch size',
        action: 'Consider wider clustering radius for better batching',
      });
    }

    return recommendations;
  }

  /**
   * Helper methods
   */
  categorizeOrdersByType(orders) {
    const categorized = {
      BARQ: [],
      BULLET: [],
      STANDARD: [],
    };

    for (const order of orders) {
      const type = order.serviceType || 'STANDARD';
      if (categorized[type]) {
        categorized[type].push(order);
      } else {
        categorized.STANDARD.push(order);
      }
    }

    return categorized;
  }

  calculateDistance(point1, point2) {
    if (!point1 || !point2) return 999;

    const lat1 = point1.lat || point1.latitude;
    const lng1 = point1.lng || point1.longitude;
    const lat2 = point2.lat || point2.latitude;
    const lng2 = point2.lng || point2.longitude;

    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  calculateCentroid(orders) {
    if (orders.length === 0) return null;

    let sumLat = 0;
    let sumLng = 0;

    for (const order of orders) {
      const location = order.location || order;
      sumLat += location.lat || location.latitude || 0;
      sumLng += location.lng || location.longitude || 0;
    }

    return {
      lat: sumLat / orders.length,
      lng: sumLng / orders.length,
    };
  }

  initializeCentroids(orders, k) {
    // K-means++ initialization
    const centroids = [];
    const indices = new Set();

    // First centroid random
    const firstIndex = Math.floor(Math.random() * orders.length);
    indices.add(firstIndex);
    centroids.push(orders[firstIndex].location || orders[firstIndex]);

    // Rest based on distance
    for (let i = 1; i < k; i++) {
      let maxMinDistance = 0;
      let bestIndex = -1;

      for (let j = 0; j < orders.length; j++) {
        if (indices.has(j)) continue;

        const order = orders[j];
        const location = order.location || order;

        const minDistance = Math.min(...centroids.map((c) => this.calculateDistance(location, c)));

        if (minDistance > maxMinDistance) {
          maxMinDistance = minDistance;
          bestIndex = j;
        }
      }

      if (bestIndex !== -1) {
        indices.add(bestIndex);
        centroids.push(orders[bestIndex].location || orders[bestIndex]);
      }
    }

    return centroids;
  }

  findNearestCentroid(order, centroids) {
    const location = order.location || order;
    let minDistance = Infinity;
    let nearestIndex = 0;

    for (let i = 0; i < centroids.length; i++) {
      const distance = this.calculateDistance(location, centroids[i]);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }

    return nearestIndex;
  }

  hasConverged(oldCentroids, newCentroids) {
    const threshold = 0.001;

    for (let i = 0; i < oldCentroids.length; i++) {
      const distance = this.calculateDistance(oldCentroids[i], newCentroids[i]);
      if (distance > threshold) {
        return false;
      }
    }

    return true;
  }

  getNeighbors(order, orders, radius) {
    const neighbors = [];
    const location = order.location || order;

    for (const other of orders) {
      if (other.id === order.id) continue;

      const distance = this.calculateDistance(location, other.location || other);

      if (distance <= radius) {
        neighbors.push(other);
      }
    }

    return neighbors;
  }

  splitLargeCluster(orders, maxSize) {
    const subClusters = [];

    for (let i = 0; i < orders.length; i += maxSize) {
      subClusters.push({
        id: generateId(),
        orders: orders.slice(i, Math.min(i + maxSize, orders.length)),
      });
    }

    return subClusters;
  }

  validateTimeWindows(orders, maxDelay) {
    // Check if all orders have compatible time windows
    const windows = orders.map((o) => o.timeWindow).filter(Boolean);

    if (windows.length === 0) return true;

    // Find earliest and latest windows
    const earliest = Math.min(...windows.map((w) => new Date(w.start).getTime()));
    const latest = Math.max(...windows.map((w) => new Date(w.end).getTime()));

    const span = (latest - earliest) / 60000; // Minutes

    return span <= maxDelay;
  }

  splitByTimeWindows(orders, maxDelay) {
    // Group by similar time windows
    const groups = [];
    const used = new Set();

    for (const order of orders) {
      if (used.has(order.id)) continue;

      const group = [order];
      used.add(order.id);

      for (const other of orders) {
        if (used.has(other.id)) continue;

        if (this.areTimeWindowsCompatible(order, other, maxDelay)) {
          group.push(other);
          used.add(other.id);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  areTimeWindowsCompatible(order1, order2, maxDelay) {
    if (!order1.timeWindow || !order2.timeWindow) return true;

    const start1 = new Date(order1.timeWindow.start).getTime();
    const start2 = new Date(order2.timeWindow.start).getTime();

    return Math.abs(start1 - start2) / 60000 <= maxDelay;
  }

  calculateBatchRadius(orders, center) {
    let maxDistance = 0;

    for (const order of orders) {
      const distance = this.calculateDistance(order.location || order, center);
      maxDistance = Math.max(maxDistance, distance);
    }

    return maxDistance;
  }

  calculateDensity(orders, radius) {
    if (radius === 0) return 1;

    const area = Math.PI * radius * radius;
    return orders.length / area;
  }

  calculateBatchQuality(batch) {
    const factors = {
      density: Math.min(1, batch.density / 0.5), // 0.5 orders per sq km is good
      size: batch.orders.length / this.batchingRules[batch.serviceType].maxBatchSize,
      compactness: 1 - batch.radius / 10, // Smaller radius is better
    };

    return factors.density * 0.4 + factors.size * 0.3 + factors.compactness * 0.3;
  }

  estimateDeliveryTime(orders, serviceType) {
    const baseTime = serviceType === 'BARQ' ? 30 : 60;
    const perOrderTime = serviceType === 'BARQ' ? 5 : 8;

    return baseTime + orders.length * perOrderTime;
  }

  identifyUnbatchableOrders(allOrders, batches) {
    const batchedOrderIds = new Set();

    for (const batch of batches) {
      for (const order of batch.orders) {
        batchedOrderIds.add(order.id);
      }
    }

    return allOrders.filter((order) => !batchedOrderIds.has(order.id));
  }

  storeActiveBatches(batches) {
    for (const batch of batches) {
      this.activeBatches.set(batch.id, batch);
    }

    // Cleanup old batches
    const oneHourAgo = Date.now() - 3600000;
    for (const [id, batch] of this.activeBatches.entries()) {
      if (batch.createdAt < oneHourAgo) {
        this.activeBatches.delete(id);
      }
    }
  }

  /**
   * Mock methods - replace with actual implementations
   */
  async getPendingOrders() {
    return [];
  }

  async getFleetCapacity() {
    return {
      availableDrivers: 10,
      totalCapacity: 100,
    };
  }

  async identifyPickupPoints(orders) {
    // Identify common pickup points
    const pickupMap = new Map();

    for (const order of orders) {
      const pickupId = order.pickupId || 'default';
      if (!pickupMap.has(pickupId)) {
        pickupMap.set(pickupId, []);
      }
      pickupMap.get(pickupId).push(order.id);
    }

    return Array.from(pickupMap.entries()).map(([id, orderIds]) => ({
      pickupId: id,
      orderCount: orderIds.length,
      orderIds: orderIds,
    }));
  }

  async generateRoutePreview(batch) {
    return {
      estimatedDistance: batch.radius * 2.5,
      estimatedDuration: batch.estimatedDeliveryTime,
      stopCount: batch.orders.length,
    };
  }

  async solveTSP(orders) {
    // Simplified TSP - nearest neighbor
    const sequence = [];
    const unvisited = [...orders];
    let current = unvisited.shift();
    sequence.push(current);

    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const distance = this.calculateDistance(
          current.location || current,
          unvisited[i].location || unvisited[i]
        );

        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = i;
        }
      }

      current = unvisited.splice(nearestIndex, 1)[0];
      sequence.push(current);
    }

    return sequence;
  }

  // Strategy implementations
  priorityBasedBatching(orders, serviceType) {
    // Group by priority
    const groups = {};

    for (const order of orders) {
      const priority = order.priority || 'normal';
      if (!groups[priority]) {
        groups[priority] = [];
      }
      groups[priority].push(order);
    }

    const batches = [];
    for (const group of Object.values(groups)) {
      batches.push(this.createBatch(group, serviceType));
    }

    return Promise.all(batches);
  }

  timeWindowBasedBatching(orders, serviceType) {
    // Group by time window
    const hourlyGroups = {};

    for (const order of orders) {
      const hour = new Date(order.timeWindow?.start || Date.now()).getHours();
      if (!hourlyGroups[hour]) {
        hourlyGroups[hour] = [];
      }
      hourlyGroups[hour].push(order);
    }

    const batches = [];
    for (const group of Object.values(hourlyGroups)) {
      if (group.length > 0) {
        batches.push(this.createBatch(group, serviceType));
      }
    }

    return Promise.all(batches);
  }

  geographicBasedBatching(orders, serviceType) {
    // Simple geographic grouping
    return this.kMeansClustering(orders, {
      k: Math.ceil(orders.length / 5),
      maxSize: this.batchingRules[serviceType].maxBatchSize,
    }).then((clusters) =>
      Promise.all(clusters.map((c) => this.createBatch(c.orders, serviceType)))
    );
  }

  evaluateBatchingStrategy(batches) {
    let score = 0;

    for (const batch of batches) {
      score += batch.qualityScore * batch.orders.length;
    }

    return score / batches.length;
  }

  removeOutliers(orders) {
    // Remove orders too far from cluster center
    const center = this.calculateCentroid(orders);
    const distances = orders.map((o) => ({
      order: o,
      distance: this.calculateDistance(o.location || o, center),
    }));

    const avgDistance = distances.reduce((sum, d) => sum + d.distance, 0) / distances.length;
    const threshold = avgDistance * 2;

    return distances.filter((d) => d.distance <= threshold).map((d) => d.order);
  }

  balanceByPriority(orders) {
    // Sort to ensure high priority orders are included
    return orders.sort((a, b) => {
      const priorityOrder = { critical: 3, high: 2, normal: 1, low: 0 };
      const aPriority = priorityOrder[a.priority] || 1;
      const bPriority = priorityOrder[b.priority] || 1;
      return bPriority - aPriority;
    });
  }

  checkCapacityConstraints(orders, rules) {
    // Ensure batch doesn't exceed capacity
    if (orders.length <= rules.maxBatchSize) {
      return orders;
    }

    return orders.slice(0, rules.maxBatchSize);
  }

  calculateUrgency(order) {
    const now = Date.now();
    const deadline = order.deadline || order.timeWindow?.end;

    if (!deadline) return 0;

    const timeRemaining = new Date(deadline).getTime() - now;
    return 1 / (1 + timeRemaining / 3600000); // Urgency increases as deadline approaches
  }

  estimateOrderDeliveryTime(order) {
    // Estimate individual order delivery time
    return order.serviceType === 'BARQ' ? 15 : 25;
  }

  getOrderDeadline(order, serviceType) {
    if (order.deadline) {
      return (new Date(order.deadline).getTime() - Date.now()) / 60000;
    }

    return serviceType === 'BARQ' ? 60 : 240;
  }

  // Score calculation helpers
  calculateDensityScore(batch) {
    const idealDensity = 0.5; // orders per sq km
    return Math.min(1, batch.density / idealDensity);
  }

  calculateTimeWindowScore(batch) {
    const compatible = this.validateTimeWindows(batch.orders, 30);
    return compatible ? 1 : 0.5;
  }

  calculateDistanceScore(batch) {
    const maxAcceptableRadius = 10; // km
    return Math.max(0, 1 - batch.radius / maxAcceptableRadius);
  }

  calculateCapacityScore(batch) {
    const maxSize = this.batchingRules[batch.serviceType].maxBatchSize;
    return batch.orders.length / maxSize;
  }

  /**
   * Check agent health
   */
  isHealthy() {
    const isHealthy = true;
    return {
      healthy: isHealthy,
      lastUpdate: this.lastUpdate || Date.now(),
      message: isHealthy ? 'Agent is healthy' : 'Agent health check failed',
    };
  }
}

module.exports = BatchOptimizationAgent;
