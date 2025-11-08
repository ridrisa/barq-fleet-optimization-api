/**
 * Demo Data Generator
 * Generates random test orders and simulates real-world scenarios
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const EventEmitter = require('events');

class DemoGenerator extends EventEmitter {
  constructor() {
    super();

    // Saudi Arabia major cities coordinates
    this.cities = {
      riyadh: { lat: 24.7136, lng: 46.6753, name: 'Riyadh' },
      jeddah: { lat: 21.4858, lng: 39.1925, name: 'Jeddah' },
      mecca: { lat: 21.4225, lng: 39.8262, name: 'Mecca' },
      medina: { lat: 24.4672, lng: 39.6024, name: 'Medina' },
      dammam: { lat: 26.3927, lng: 49.9777, name: 'Dammam' },
    };

    // For demo, we'll focus on Riyadh
    this.defaultCity = this.cities.riyadh;

    // Customer names for demo
    this.customerNames = [
      'Ahmed Al-Rashid',
      'Fatima Al-Zahrani',
      'Mohammed Al-Qahtani',
      'Sara Al-Otaibi',
      'Abdullah Al-Harbi',
      'Noura Al-Dosari',
      'Khalid Al-Shehri',
      'Maha Al-Ghamdi',
      'Omar Al-Maliki',
      'Layla Al-Enezi',
      'Faisal Al-Mutairi',
      'Reem Al-Asmari',
    ];

    // Business names
    this.businessNames = [
      'Al-Baik Restaurant',
      'Kudu',
      'Herfy',
      'Pizza Hut',
      'Starbucks',
      'Tim Hortons',
      "McDonald's",
      'KFC',
      'Jarir Bookstore',
      'Extra Store',
      'Panda',
      'Othaim Markets',
      'Al-Danube',
      'Carrefour',
      'IKEA',
      'Al-Sawani',
    ];

    // Product categories
    this.productCategories = {
      food: ['Pizza', 'Burger', 'Shawarma', 'Kabsa', 'Grilled Chicken', 'Salad', 'Pasta'],
      beverages: ['Coffee', 'Tea', 'Juice', 'Soft Drinks', 'Water'],
      groceries: ['Fruits', 'Vegetables', 'Dairy', 'Bread', 'Meat'],
      electronics: ['Phone', 'Laptop', 'Headphones', 'Charger'],
      documents: ['Contract', 'Passport', 'Certificate', 'Package'],
    };

    // Demo scenarios
    this.scenarios = {
      normal: { weight: 60, description: 'Normal order flow' },
      rush_hour: { weight: 20, description: 'Rush hour with delays' },
      sla_risk: { weight: 10, description: 'Order at risk of SLA breach' },
      driver_issue: { weight: 5, description: 'Driver becomes unavailable' },
      customer_unavailable: { weight: 3, description: 'Customer not available' },
      emergency: { weight: 2, description: 'Emergency escalation needed' },
    };

    // Active orders tracking
    this.activeOrders = new Map();

    // Driver pool
    this.drivers = this.generateDriverPool();

    // Statistics
    this.stats = {
      totalGenerated: 0,
      barqOrders: 0,
      bulletOrders: 0,
      completed: 0,
      failed: 0,
      inProgress: 0,
    };
  }

  /**
   * Generate driver pool
   */
  generateDriverPool() {
    const drivers = [];

    // Generate BARQ drivers (fast delivery)
    for (let i = 1; i <= 20; i++) {
      drivers.push({
        id: `barq_driver_${i}`,
        name: `BARQ Driver ${i}`,
        serviceType: 'BARQ',
        vehicle: Math.random() > 0.5 ? 'Motorcycle' : 'Car',
        status: 'available',
        location: this.generateRandomLocation(this.defaultCity, 10),
        rating: 4 + Math.random(),
        completedToday: Math.floor(Math.random() * 10),
        activeOrders: 0,
        capacity: 1, // BARQ drivers handle 1 order at a time
        speed: 40 + Math.random() * 20, // 40-60 km/h
      });
    }

    // Generate BULLET drivers (batch delivery)
    for (let i = 1; i <= 15; i++) {
      drivers.push({
        id: `bullet_driver_${i}`,
        name: `BULLET Driver ${i}`,
        serviceType: 'BULLET',
        vehicle: 'Van',
        status: 'available',
        location: this.generateRandomLocation(this.defaultCity, 15),
        rating: 4 + Math.random(),
        completedToday: Math.floor(Math.random() * 20),
        activeOrders: 0,
        capacity: 10, // BULLET drivers can handle multiple orders
        speed: 30 + Math.random() * 20, // 30-50 km/h
      });
    }

    return drivers;
  }

  /**
   * Generate random location near a center point
   */
  generateRandomLocation(center, radiusKm) {
    // Convert radius from km to degrees
    const radiusInDegrees = radiusKm / 111;

    const angle = Math.random() * 2 * Math.PI;
    const r = Math.sqrt(Math.random()) * radiusInDegrees;

    return {
      lat: center.lat + r * Math.cos(angle),
      lng: center.lng + r * Math.sin(angle),
    };
  }

  /**
   * Generate a random order
   */
  generateRandomOrder(serviceType = null) {
    const orderId = `order_${Date.now()}_${uuidv4().substr(0, 8)}`;

    // Randomly choose service type if not specified
    if (!serviceType) {
      serviceType = Math.random() > 0.3 ? 'BULLET' : 'BARQ';
    }

    // Determine scenario
    const scenario = this.selectScenario();

    // Generate locations based on service type
    const maxDistance = serviceType === 'BARQ' ? 5 : 20;
    const pickup = this.generateRandomLocation(this.defaultCity, maxDistance);
    const delivery = this.generateRandomLocation(this.defaultCity, maxDistance);

    // Calculate estimated distance
    const distance = this.calculateDistance(pickup, delivery);

    // Select random customer and business
    const customer = this.customerNames[Math.floor(Math.random() * this.customerNames.length)];
    const business = this.businessNames[Math.floor(Math.random() * this.businessNames.length)];

    // Select random products
    const category = Object.keys(this.productCategories)[Math.floor(Math.random() * 5)];
    const products = this.productCategories[category];
    const selectedProducts = [];
    const numProducts = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < numProducts; i++) {
      selectedProducts.push({
        name: products[Math.floor(Math.random() * products.length)],
        quantity: Math.floor(Math.random() * 3) + 1,
        price: Math.floor(Math.random() * 100) + 10,
      });
    }

    // Calculate order value
    const orderValue = selectedProducts.reduce((sum, p) => sum + p.price * p.quantity, 0);

    const order = {
      id: orderId,
      serviceType,
      status: 'pending',
      scenario: scenario.type,
      customer: {
        name: customer,
        phone: `+966${Math.floor(Math.random() * 900000000 + 100000000)}`,
        email: `${customer.toLowerCase().replace(' ', '.')}@example.com`,
      },
      pickup: {
        location: pickup,
        address: `${business}, ${Math.floor(Math.random() * 999) + 1} King Fahd Road`,
        business: business,
        instructions: 'Please collect from counter',
      },
      delivery: {
        location: delivery,
        address: `${Math.floor(Math.random() * 999) + 1} ${this.getRandomStreet()}, Apt ${Math.floor(Math.random() * 99) + 1}`,
        instructions: this.getRandomInstructions(),
      },
      products: selectedProducts,
      orderValue,
      distance: Math.round(distance * 10) / 10,
      estimatedDuration: this.estimateDeliveryTime(distance, serviceType),
      priority: serviceType === 'BARQ' ? 'high' : 'normal',
      createdAt: new Date(),
      timeWindow: this.generateTimeWindow(serviceType),
      specialRequirements: this.getRandomRequirements(),
      paymentMethod: Math.random() > 0.3 ? 'Credit Card' : 'Cash on Delivery',
    };

    // Update statistics
    this.stats.totalGenerated++;
    if (serviceType === 'BARQ') {
      this.stats.barqOrders++;
    } else {
      this.stats.bulletOrders++;
    }
    this.stats.inProgress++;

    // Track order
    this.activeOrders.set(orderId, order);

    // Emit order created event
    this.emit('orderCreated', order);

    logger.info(`[DemoGenerator] Generated ${serviceType} order ${orderId}`, {
      scenario: scenario.type,
      distance: order.distance,
      estimatedTime: order.estimatedDuration,
    });

    return order;
  }

  /**
   * Select scenario based on weights
   */
  selectScenario() {
    const totalWeight = Object.values(this.scenarios).reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;

    for (const [type, scenario] of Object.entries(this.scenarios)) {
      random -= scenario.weight;
      if (random <= 0) {
        return { type, ...scenario };
      }
    }

    return { type: 'normal', ...this.scenarios.normal };
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(point1, point2) {
    const R = 6371; // Earth's radius in km
    const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const dLon = ((point2.lng - point1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((point1.lat * Math.PI) / 180) *
        Math.cos((point2.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Estimate delivery time based on distance and service type
   */
  estimateDeliveryTime(distance, serviceType) {
    const avgSpeed = serviceType === 'BARQ' ? 40 : 30; // km/h
    const baseTime = (distance / avgSpeed) * 60; // minutes
    const prepTime = 5 + Math.random() * 10; // 5-15 minutes prep

    return Math.round(baseTime + prepTime);
  }

  /**
   * Generate time window
   */
  generateTimeWindow(serviceType) {
    const now = new Date();
    const start = new Date(now.getTime() + 10 * 60000); // 10 minutes from now

    let end;
    if (serviceType === 'BARQ') {
      end = new Date(start.getTime() + 60 * 60000); // 1 hour window
    } else {
      end = new Date(start.getTime() + 240 * 60000); // 4 hour window
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  /**
   * Get random street name
   */
  getRandomStreet() {
    const streets = [
      'King Abdullah Street',
      'Prince Sultan Street',
      'Olaya Street',
      'King Fahd Street',
      'Takhassusi Street',
      'Al Imam Saud Street',
      'Prince Mohammed Street',
      'King Abdulaziz Street',
    ];
    return streets[Math.floor(Math.random() * streets.length)];
  }

  /**
   * Get random delivery instructions
   */
  getRandomInstructions() {
    const instructions = [
      'Ring the doorbell twice',
      'Call upon arrival',
      'Leave at door',
      'Hand to security',
      'Building entrance code: 1234',
      'Meet at lobby',
      'Side entrance',
      'Call 5 minutes before arrival',
    ];
    return instructions[Math.floor(Math.random() * instructions.length)];
  }

  /**
   * Get random special requirements
   */
  getRandomRequirements() {
    const requirements = [];

    if (Math.random() > 0.7) {
      requirements.push('Handle with care');
    }
    if (Math.random() > 0.8) {
      requirements.push('Keep upright');
    }
    if (Math.random() > 0.9) {
      requirements.push('Fragile items');
    }
    if (Math.random() > 0.85) {
      requirements.push('Signature required');
    }

    return requirements;
  }

  /**
   * Simulate order lifecycle
   */
  async simulateOrderLifecycle(order) {
    const delays = {
      assignDriver: 2000 + Math.random() * 3000,
      driverAccept: 1000 + Math.random() * 2000,
      pickupReached: order.estimatedDuration * 200,
      pickupComplete: 2000 + Math.random() * 3000,
      deliveryReached: order.estimatedDuration * 400,
      deliveryComplete: 1000 + Math.random() * 2000,
    };

    // Simulate driver assignment
    setTimeout(() => {
      const driver = this.findAvailableDriver(order.serviceType);
      if (driver) {
        order.assignedDriver = driver.id;
        order.status = 'assigned';
        driver.status = 'busy';
        driver.activeOrders++;

        this.emit('orderAssigned', { order, driver });
        logger.info(`[DemoGenerator] Order ${order.id} assigned to ${driver.id}`);

        // Simulate driver acceptance
        setTimeout(() => {
          order.status = 'accepted';
          order.acceptedAt = new Date();
          this.emit('orderAccepted', { order, driver });

          // Simulate pickup
          setTimeout(() => {
            order.status = 'pickup_reached';
            this.emit('pickupReached', { order, driver });

            setTimeout(() => {
              order.status = 'in_transit';
              order.pickedUpAt = new Date();
              this.emit('orderPickedUp', { order, driver });

              // Simulate delivery
              setTimeout(() => {
                order.status = 'delivery_reached';
                this.emit('deliveryReached', { order, driver });

                setTimeout(() => {
                  // Apply scenario outcomes
                  if (order.scenario === 'customer_unavailable') {
                    order.status = 'failed';
                    order.failureReason = 'Customer not available';
                    this.stats.failed++;
                    this.emit('orderFailed', { order, reason: order.failureReason });
                  } else {
                    order.status = 'completed';
                    order.completedAt = new Date();
                    order.actualDuration = Math.round(
                      (order.completedAt - order.createdAt) / 60000
                    );
                    this.stats.completed++;
                    this.emit('orderCompleted', { order, driver });

                    // Generate customer rating
                    order.customerRating = 3 + Math.random() * 2;
                    this.emit('orderRated', { order, rating: order.customerRating });
                  }

                  // Free up driver
                  driver.status = 'available';
                  driver.activeOrders--;
                  driver.completedToday++;

                  // Update stats
                  this.stats.inProgress--;
                  this.activeOrders.delete(order.id);
                }, delays.deliveryComplete);
              }, delays.deliveryReached);
            }, delays.pickupComplete);
          }, delays.pickupReached);
        }, delays.driverAccept);
      } else {
        // No driver available - trigger escalation
        order.status = 'unassigned';
        this.emit('noDriverAvailable', { order });
        logger.warn(`[DemoGenerator] No driver available for order ${order.id}`);
      }
    }, delays.assignDriver);
  }

  /**
   * Find available driver
   */
  findAvailableDriver(serviceType) {
    const availableDrivers = this.drivers.filter(
      (d) =>
        d.serviceType === serviceType && d.status === 'available' && d.activeOrders < d.capacity
    );

    if (availableDrivers.length === 0) return null;

    // Return random available driver
    return availableDrivers[Math.floor(Math.random() * availableDrivers.length)];
  }

  /**
   * Start continuous order generation
   */
  startContinuousGeneration(config = {}) {
    const {
      ordersPerMinute = 2,
      barqRatio = 0.3,
      duration = 3600000, // 1 hour default
    } = config;

    logger.info('[DemoGenerator] Starting continuous order generation', config);

    const interval = 60000 / ordersPerMinute;
    let elapsed = 0;

    this.generationInterval = setInterval(() => {
      const serviceType = Math.random() < barqRatio ? 'BARQ' : 'BULLET';
      const order = this.generateRandomOrder(serviceType);

      // Start lifecycle simulation
      this.simulateOrderLifecycle(order);

      elapsed += interval;
      if (elapsed >= duration) {
        this.stopGeneration();
      }
    }, interval);

    // Also generate initial batch
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const serviceType = Math.random() < barqRatio ? 'BARQ' : 'BULLET';
        const order = this.generateRandomOrder(serviceType);
        this.simulateOrderLifecycle(order);
      }, i * 2000);
    }
  }

  /**
   * Stop order generation
   */
  stopGeneration() {
    if (this.generationInterval) {
      clearInterval(this.generationInterval);
      logger.info('[DemoGenerator] Stopped order generation');
    }
  }

  /**
   * Start method - alias for startContinuousGeneration for compatibility
   */
  start(ordersPerMinute = 5, durationMinutes = 5) {
    const config = {
      ordersPerMinute,
      maxOrders: ordersPerMinute * durationMinutes,
      durationMs: durationMinutes * 60 * 1000,
      serviceTypeMix: {
        BARQ: 0.6,
        BULLET: 0.4,
      },
    };

    this.startContinuousGeneration(config);
  }

  /**
   * Stop method - alias for stopGeneration for compatibility
   */
  stop() {
    this.stopGeneration();
  }

  /**
   * Get current statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      activeOrders: Array.from(this.activeOrders.values()),
      drivers: {
        total: this.drivers.length,
        available: this.drivers.filter((d) => d.status === 'available').length,
        busy: this.drivers.filter((d) => d.status === 'busy').length,
        barq: this.drivers.filter((d) => d.serviceType === 'BARQ').length,
        bullet: this.drivers.filter((d) => d.serviceType === 'BULLET').length,
      },
      performance: {
        avgCompletionTime: this.calculateAverageCompletionTime(),
        slaCompliance: this.calculateSLACompliance(),
        utilizationRate: this.calculateUtilizationRate(),
      },
    };
  }

  /**
   * Calculate average completion time
   */
  calculateAverageCompletionTime() {
    const completedOrders = Array.from(this.activeOrders.values()).filter(
      (o) => o.status === 'completed' && o.actualDuration
    );

    if (completedOrders.length === 0) return 0;

    const totalTime = completedOrders.reduce((sum, o) => sum + o.actualDuration, 0);
    return Math.round(totalTime / completedOrders.length);
  }

  /**
   * Calculate SLA compliance
   */
  calculateSLACompliance() {
    const completedOrders = Array.from(this.activeOrders.values()).filter(
      (o) => o.status === 'completed'
    );

    if (completedOrders.length === 0) return 100;

    const onTimeOrders = completedOrders.filter((o) => {
      const slaTime = o.serviceType === 'BARQ' ? 60 : 240;
      return o.actualDuration <= slaTime;
    });

    return Math.round((onTimeOrders.length / completedOrders.length) * 100);
  }

  /**
   * Calculate driver utilization rate
   */
  calculateUtilizationRate() {
    const busyDrivers = this.drivers.filter((d) => d.status === 'busy').length;
    return Math.round((busyDrivers / this.drivers.length) * 100);
  }

  /**
   * Reset demo
   */
  reset() {
    this.stopGeneration();
    this.activeOrders.clear();
    this.stats = {
      totalGenerated: 0,
      barqOrders: 0,
      bulletOrders: 0,
      completed: 0,
      failed: 0,
      inProgress: 0,
    };
    this.drivers = this.generateDriverPool();
    logger.info('[DemoGenerator] Demo reset complete');
  }
}

module.exports = DemoGenerator;
