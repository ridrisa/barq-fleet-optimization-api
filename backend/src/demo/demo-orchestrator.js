/**
 * Demo Orchestrator - Connects Demo Generator to Real Agent System
 * This orchestrator creates real orders that are processed by the actual agent system
 */

const express = require('express');
const cors = require('cors');
const { logger } = require('../utils/logger');
const AgentController = require('../controllers/agent.controller');
const AgentInitializer = require('../services/agent-initializer');
const DemoWebSocketServer = require('./websocket-server');
const { v4: uuidv4 } = require('uuid');

class DemoOrchestrator {
  constructor() {
    this.app = express();
    this.port = process.env.DEMO_PORT || 3003;
    this.wsServer = null;
    this.agentController = AgentController;
    this.isRunning = false;
    this.orderInterval = null;
    this.driverInterval = null;

    // Demo configuration
    this.config = {
      ordersPerMinute: 5,
      durationMinutes: 5,
      driverCount: 20,
      serviceTypeMix: {
        BARQ: 0.6, // 60% BARQ orders
        BULLET: 0.4, // 40% BULLET orders
      },
    };

    // Saudi Arabia locations (Riyadh focused)
    this.locations = {
      riyadh: {
        center: { lat: 24.7136, lng: 46.6753 },
        zones: [
          { name: 'Olaya', lat: 24.6995, lng: 46.6837, radius: 3 },
          { name: 'Al Malaz', lat: 24.6697, lng: 46.7236, radius: 2.5 },
          { name: 'Al Sahafa', lat: 24.8049, lng: 46.6359, radius: 3 },
          { name: 'King Fahd', lat: 24.75, lng: 46.725, radius: 4 },
          { name: 'Al Nakheel', lat: 24.77, lng: 46.74, radius: 2 },
        ],
        businesses: [
          'Al Baik Restaurant',
          'Kudu',
          'Herfy',
          'Shawarma House',
          'Jarir Bookstore',
          'Al Othaim Mall',
          'Carrefour',
          'Panda',
          'Al Sawani',
          'Dunkin Donuts',
          'Starbucks',
          "McDonald's",
        ],
      },
    };

    // Driver pool and orders
    this.drivers = [];
    this.orders = new Map();
    this.driverNames = [
      'Ahmed Al-Rashid',
      'Mohammed Al-Zahrani',
      'Khalid Al-Qahtani',
      'Abdullah Al-Otaibi',
      'Faisal Al-Harbi',
      'Noura Al-Dosari',
      'Sara Al-Shehri',
      'Maha Al-Ghamdi',
      'Yousef Al-Maliki',
      'Omar Al-Enezi',
      'Bandar Al-Mutairi',
      'Reem Al-Asmari',
    ];

    this.setupApp();
  }

  setupApp() {
    this.app.use(cors());
    this.app.use(express.json());

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        isRunning: this.isRunning,
        activeDrivers: this.drivers.length,
        uptime: process.uptime(),
      });
    });

    // Start demo endpoint
    this.app.post('/start', async (req, res) => {
      try {
        const config = req.body || {};
        await this.startDemo(config);
        res.json({
          success: true,
          message: 'Demo started',
          config: this.config,
        });
      } catch (error) {
        logger.error('Failed to start demo', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Stop demo endpoint
    this.app.post('/stop', async (req, res) => {
      try {
        await this.stopDemo();
        res.json({
          success: true,
          message: 'Demo stopped',
        });
      } catch (error) {
        logger.error('Failed to stop demo', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get demo status
    this.app.get('/status', (req, res) => {
      res.json({
        isRunning: this.isRunning,
        config: this.config,
        drivers: this.drivers.map((d) => ({
          id: d.id,
          name: d.name,
          status: d.status,
          location: d.location,
          currentOrders: d.currentOrders?.length || 0,
        })),
      });
    });

    // Create single order endpoint
    this.app.post('/order', async (req, res) => {
      try {
        const { serviceType } = req.body;
        const order = await this.createOrder(serviceType);
        res.json({
          success: true,
          order,
        });
      } catch (error) {
        logger.error('Failed to create order', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });
  }

  async startDemo(config = {}) {
    if (this.isRunning) {
      throw new Error('Demo is already running');
    }

    logger.info('Starting demo orchestrator');

    // Update configuration
    this.config = { ...this.config, ...config };

    // Reset agent controller for fresh start
    this.agentController.reset();

    // Subscribe to agent controller events
    this.subscribeToAgentEvents();

    // Initialize drivers
    this.initializeDrivers();

    // Start generating orders
    this.startOrderGeneration();

    // Start driver movement simulation
    this.startDriverMovement();

    // Broadcast demo started event
    if (this.wsServer) {
      this.wsServer.broadcast({
        type: 'demoStarted',
        data: {
          config: this.config,
          drivers: this.drivers.length,
          timestamp: new Date().toISOString(),
        },
      });
    }

    this.isRunning = true;

    // Auto-stop after duration
    if (this.config.durationMinutes > 0) {
      setTimeout(
        () => {
          this.stopDemo();
        },
        this.config.durationMinutes * 60 * 1000
      );
    }
  }

  async stopDemo() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping demo orchestrator');

    // Stop order generation
    if (this.orderInterval) {
      clearInterval(this.orderInterval);
      this.orderInterval = null;
    }

    // Stop driver movement
    if (this.driverInterval) {
      clearInterval(this.driverInterval);
      this.driverInterval = null;
    }

    // Mark all drivers as offline
    this.drivers.forEach((driver) => {
      driver.status = 'offline';
      this.broadcastDriverUpdate(driver);
    });

    // Broadcast demo stopped event
    if (this.wsServer) {
      this.wsServer.broadcast({
        type: 'demoStopped',
        data: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    this.isRunning = false;
    this.drivers = [];
  }

  initializeDrivers() {
    const driverCount = this.config.driverCount || 20;

    this.drivers = [];

    for (let i = 0; i < driverCount; i++) {
      const zone = this.getRandomZone();
      const driver = {
        id: `driver-${uuidv4()}`,
        name: this.driverNames[i % this.driverNames.length],
        status: 'available',
        location: this.getRandomLocationInZone(zone),
        currentOrders: [],
        capacity: 5,
        vehicleType: Math.random() > 0.5 ? 'motorcycle' : 'car',
        zone: zone.name,
        rating: 4.0 + Math.random(),
        completedToday: 0,
        earnings: 0,
      };

      this.drivers.push(driver);

      // Register driver with the agent system
      this.registerDriver(driver);

      // Broadcast driver creation
      this.broadcastDriverUpdate(driver);
    }

    logger.info(`Initialized ${driverCount} drivers`);
  }

  async registerDriver(driver) {
    try {
      // Register driver with Agent Controller
      await this.agentController.registerDriver(driver);
    } catch (error) {
      logger.error('Failed to register driver', {
        driverId: driver.id,
        error: error.message,
      });
    }
  }

  subscribeToAgentEvents() {
    // Subscribe to agent controller events for WebSocket broadcasting
    this.agentController.on('orderCreated', (order) => {
      if (this.wsServer) {
        this.wsServer.broadcast({
          type: 'orderCreated',
          data: { order },
        });
      }
    });

    this.agentController.on('orderAssigned', (data) => {
      if (this.wsServer) {
        this.wsServer.broadcast({
          type: 'orderAssigned',
          data,
        });
      }
    });

    this.agentController.on('orderPickedUp', (data) => {
      if (this.wsServer) {
        this.wsServer.broadcast({
          type: 'orderPickedUp',
          data,
        });
      }
    });

    this.agentController.on('orderDelivered', (data) => {
      if (this.wsServer) {
        this.wsServer.broadcast({
          type: 'orderDelivered',
          data,
        });
      }
    });

    this.agentController.on('orderFailed', (data) => {
      if (this.wsServer) {
        this.wsServer.broadcast({
          type: 'orderFailed',
          data,
        });
      }
    });

    this.agentController.on('slaAlert', (data) => {
      if (this.wsServer) {
        this.wsServer.broadcast({
          type: 'slaAlert',
          data,
        });
      }
    });

    this.agentController.on('driverLocationUpdated', (data) => {
      if (this.wsServer) {
        this.wsServer.broadcast({
          type: 'driverStatusUpdate',
          data,
        });
      }
    });
  }

  startOrderGeneration() {
    const intervalMs = 60000 / this.config.ordersPerMinute; // Convert to milliseconds

    // Generate first order immediately
    this.createOrder();

    // Set up interval for subsequent orders
    this.orderInterval = setInterval(() => {
      this.createOrder();
    }, intervalMs);

    logger.info(`Started order generation: ${this.config.ordersPerMinute} orders/minute`);
  }

  async createOrder(specificServiceType = null) {
    try {
      // Determine service type
      const serviceType =
        specificServiceType ||
        (Math.random() < this.config.serviceTypeMix.BARQ ? 'BARQ' : 'BULLET');

      // Generate pickup and dropoff locations
      const pickupZone = this.getRandomZone();
      const pickup = this.generateBusinessLocation(pickupZone);

      // For BARQ, dropoff should be within 5km
      // For BULLET, dropoff can be anywhere in the city
      const dropoffZone = serviceType === 'BARQ' ? pickupZone : this.getRandomZone();
      const dropoff = this.generateResidentialLocation(dropoffZone);

      // Calculate distance
      const distance = this.calculateDistance(pickup.coordinates, dropoff.coordinates);

      // Create order object
      const order = {
        id: `order-${uuidv4()}`,
        serviceType,
        pickup: {
          address: pickup.address,
          coordinates: pickup.coordinates,
          businessName: pickup.businessName,
        },
        dropoff: {
          address: dropoff.address,
          coordinates: dropoff.coordinates,
          customerName: dropoff.customerName,
          phone: dropoff.phone,
        },
        items: this.generateOrderItems(serviceType),
        priority: serviceType === 'BARQ' ? 'high' : 'normal',
        sla: serviceType === 'BARQ' ? 60 : 240, // minutes
        estimatedDistance: distance,
        estimatedDuration: Math.ceil(distance * 3), // rough estimate
        value: Math.floor(Math.random() * 200) + 50,
        paymentMethod: Math.random() > 0.3 ? 'card' : 'cash',
        notes: this.generateOrderNotes(),
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      // Send order to the real agent system
      const processedOrder = await this.agentController.processNewOrder(order);

      logger.info(`Created ${serviceType} order`, {
        orderId: order.id,
        from: order.pickup.businessName,
        to: order.dropoff.address,
        status: processedOrder.status,
      });

      // Store processed order
      this.orders.set(order.id, processedOrder);

      // If order was assigned, update driver's destination
      if (processedOrder.status === 'assigned' && processedOrder.driverId) {
        const driver = this.drivers.find((d) => d.id === processedOrder.driverId);
        if (driver) {
          driver.currentOrder = processedOrder;
          driver.currentDestination = processedOrder.pickup.coordinates;
        }
      }

      return processedOrder;
    } catch (error) {
      logger.error('Failed to create order', { error: error.message });
      throw error;
    }
  }

  startDriverMovement() {
    // Update driver positions every 5 seconds
    this.driverInterval = setInterval(() => {
      this.drivers.forEach((driver) => {
        if (driver.status === 'busy' && driver.currentOrders.length > 0) {
          // Move driver towards their current destination
          this.moveDriverTowardsDestination(driver);
        } else if (driver.status === 'available') {
          // Random movement within zone
          this.moveDriverRandomly(driver);
        }

        // Send location update to agent system
        this.updateDriverLocation(driver);
      });
    }, 5000); // Every 5 seconds

    logger.info('Started driver movement simulation');
  }

  moveDriverTowardsDestination(driver) {
    if (!driver.currentDestination) return;

    const currentLat = driver.location.lat;
    const currentLng = driver.location.lng;
    const destLat = driver.currentDestination.lat;
    const destLng = driver.currentDestination.lng;

    // Move 10% closer to destination
    const newLat = currentLat + (destLat - currentLat) * 0.1;
    const newLng = currentLng + (destLng - currentLng) * 0.1;

    driver.location = { lat: newLat, lng: newLng };

    // Check if reached destination (within 100 meters)
    const distance = this.calculateDistance(driver.location, driver.currentDestination);
    if (distance < 0.1) {
      this.handleDriverArrival(driver);
    }
  }

  moveDriverRandomly(driver) {
    // Small random movement within current zone
    const deltaLat = (Math.random() - 0.5) * 0.001;
    const deltaLng = (Math.random() - 0.5) * 0.001;

    driver.location.lat += deltaLat;
    driver.location.lng += deltaLng;
  }

  async updateDriverLocation(driver) {
    try {
      // Send location update to Agent Controller
      await this.agentController.updateDriverLocation(driver.id, driver.location);

      // Broadcast to WebSocket clients
      this.broadcastDriverUpdate(driver);
    } catch (error) {
      logger.error('Failed to update driver location', {
        driverId: driver.id,
        error: error.message,
      });
    }
  }

  async handleDriverArrival(driver) {
    if (!driver.currentOrder) return;

    const order = driver.currentOrder;

    try {
      if (order.status === 'assigned') {
        // Driver arrived at pickup
        await this.agentController.updateOrderStatus(order.id, 'picked_up');
        driver.currentDestination = order.dropoff.coordinates;
      } else if (order.status === 'picked_up') {
        // Driver arrived at dropoff - order delivered
        await this.agentController.updateOrderStatus(order.id, 'delivered');

        driver.status = 'available';
        driver.currentOrder = null;
        driver.currentDestination = null;
        driver.completedToday++;
      }
    } catch (error) {
      logger.error('Failed to handle driver arrival', {
        driverId: driver.id,
        orderId: order.id,
        error: error.message,
      });
    }
  }

  broadcastDriverUpdate(driver) {
    if (this.wsServer) {
      this.wsServer.broadcast({
        type: 'driverStatusUpdate',
        data: {
          driverId: driver.id,
          name: driver.name,
          status: driver.status,
          location: driver.location,
          currentOrders: driver.currentOrders?.length || 0,
        },
      });
    }
  }

  // Location generation helpers
  getRandomZone() {
    const zones = this.locations.riyadh.zones;
    return zones[Math.floor(Math.random() * zones.length)];
  }

  getRandomLocationInZone(zone) {
    const angle = Math.random() * 2 * Math.PI;
    const radius = (Math.random() * zone.radius) / 111; // Convert km to degrees

    return {
      lat: zone.lat + radius * Math.cos(angle),
      lng: zone.lng + radius * Math.sin(angle),
    };
  }

  generateBusinessLocation(zone) {
    const businesses = this.locations.riyadh.businesses;
    const businessName = businesses[Math.floor(Math.random() * businesses.length)];
    const location = this.getRandomLocationInZone(zone);

    return {
      businessName,
      address: `${businessName}, ${zone.name} District, Riyadh`,
      coordinates: location,
    };
  }

  generateResidentialLocation(zone) {
    const location = this.getRandomLocationInZone(zone);
    const buildingNumber = Math.floor(Math.random() * 500) + 1;
    const streetNumber = Math.floor(Math.random() * 20) + 1;

    const firstNames = ['Ahmed', 'Mohammed', 'Khalid', 'Abdullah', 'Sara', 'Noura'];
    const lastNames = ['Al-Rashid', 'Al-Zahrani', 'Al-Qahtani', 'Al-Otaibi'];

    return {
      customerName: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
      address: `Building ${buildingNumber}, Street ${streetNumber}, ${zone.name} District, Riyadh`,
      coordinates: location,
      phone: `+966 5${Math.floor(Math.random() * 100000000)}`,
    };
  }

  generateOrderItems(serviceType) {
    const items = [];
    const itemCount = Math.floor(Math.random() * 3) + 1;

    const itemTypes =
      serviceType === 'BARQ'
        ? ['Food', 'Medicine', 'Documents', 'Electronics']
        : ['Furniture', 'Appliances', 'Boxes', 'Equipment'];

    for (let i = 0; i < itemCount; i++) {
      items.push({
        type: itemTypes[Math.floor(Math.random() * itemTypes.length)],
        quantity: Math.floor(Math.random() * 3) + 1,
        weight: Math.floor(Math.random() * 10) + 1,
      });
    }

    return items;
  }

  generateOrderNotes() {
    const notes = [
      'Please call before arrival',
      'Leave at door',
      'Cash on delivery',
      'Fragile items',
      'Ring doorbell twice',
      '',
    ];

    return notes[Math.floor(Math.random() * notes.length)];
  }

  calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in km
    const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
    const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((coord1.lat * Math.PI) / 180) *
        Math.cos((coord2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  async start() {
    // Initialize agents first
    logger.info('Initializing agent system for demo...');
    try {
      await AgentInitializer.initialize();
      logger.info('Agent system initialized');
    } catch (error) {
      logger.error('Failed to initialize agents', { error: error.message });
    }

    // Start WebSocket server
    this.wsServer = new DemoWebSocketServer();
    await this.wsServer.start();

    // Start HTTP server
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        logger.info(`Demo orchestrator started on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop() {
    await this.stopDemo();

    if (this.wsServer) {
      await this.wsServer.stop();
    }

    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('Demo orchestrator stopped');
          resolve();
        });
      });
    }
  }
}

// Export for use as module
module.exports = DemoOrchestrator;

// If run directly, start the orchestrator
if (require.main === module) {
  const orchestrator = new DemoOrchestrator();

  orchestrator.start().then(() => {
    console.log('');
    console.log('🚀 Demo Orchestrator is running!');
    console.log('');
    console.log('📍 Services:');
    console.log(`   API: http://localhost:${orchestrator.port}`);
    console.log(`   WebSocket: ws://localhost:8081`);
    console.log(`   Dashboard: Open frontend/demo-dashboard.html in browser`);
    console.log('');
    console.log('🎮 Control endpoints:');
    console.log(`   POST http://localhost:${orchestrator.port}/start - Start demo`);
    console.log(`   POST http://localhost:${orchestrator.port}/stop - Stop demo`);
    console.log(`   GET  http://localhost:${orchestrator.port}/status - Get status`);
    console.log(`   POST http://localhost:${orchestrator.port}/order - Create single order`);
    console.log('');
    console.log('Press Ctrl+C to stop');
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await orchestrator.stop();
    process.exit(0);
  });
}
