/**
 * WebSocket Server for Real-time Demo Updates
 * Broadcasts events from the demo generator to connected UI clients
 */

const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { logger } = require('../utils/logger');
const DemoGenerator = require('./demo-generator');

class DemoWebSocketServer {
  constructor(port = 8081) {
    this.port = port;
    this.app = express();
    this.server = null;
    this.wss = null;
    this.clients = new Set();
    this.demoGenerator = null;
    this.isRunning = false;

    // System state for new connections
    this.systemState = {
      orders: new Map(),
      drivers: new Map(),
      metrics: {
        totalOrders: 0,
        completedOrders: 0,
        failedOrders: 0,
        averageDeliveryTime: 0,
        slaCompliance: 100,
        activeDrivers: 0,
        busyDrivers: 0,
      },
      zones: new Map(),
      recentEvents: [],
    };

    this.setupServer();
  }

  setupServer() {
    // Configure Express
    this.app.use(cors());
    this.app.use(express.json());

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        clients: this.clients.size,
        isRunning: this.isRunning,
        uptime: process.uptime(),
      });
    });

    // Control endpoints
    this.app.post('/demo/start', (req, res) => {
      const { ordersPerMinute = 5, duration = 300 } = req.body;
      this.startDemo(ordersPerMinute, duration);
      res.json({ status: 'started', ordersPerMinute, duration });
    });

    this.app.post('/demo/stop', (req, res) => {
      this.stopDemo();
      res.json({ status: 'stopped' });
    });

    this.app.get('/demo/status', (req, res) => {
      res.json({
        isRunning: this.isRunning,
        systemState: {
          ordersCount: this.systemState.orders.size,
          driversCount: this.systemState.drivers.size,
          metrics: this.systemState.metrics,
          connectedClients: this.clients.size,
        },
      });
    });

    // Create HTTP server
    this.server = http.createServer(this.app);

    // Create WebSocket server
    this.wss = new WebSocket.Server({ server: this.server });

    this.wss.on('connection', (ws, req) => {
      this.handleNewConnection(ws, req);
    });
  }

  handleNewConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientIp = req.socket.remoteAddress;

    logger.info(`WebSocket client connected`, { clientId, clientIp });

    // Add client to set
    ws.clientId = clientId;
    ws.isAlive = true;
    this.clients.add(ws);

    // Send initial state to new client
    ws.send(
      JSON.stringify({
        type: 'connection',
        data: {
          clientId,
          message: 'Connected to Demo WebSocket Server',
          systemState: this.getSystemSnapshot(),
        },
      })
    );

    // Handle client messages
    ws.on('message', (message) => {
      this.handleClientMessage(ws, message);
    });

    // Handle pong for heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle client disconnect
    ws.on('close', () => {
      logger.info(`WebSocket client disconnected`, { clientId });
      this.clients.delete(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error(`WebSocket client error`, { clientId, error: error.message });
    });
  }

  handleClientMessage(ws, message) {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        case 'subscribe':
          // Client wants to subscribe to specific event types
          ws.subscribedEvents = data.events || ['all'];
          ws.send(
            JSON.stringify({
              type: 'subscribed',
              data: { events: ws.subscribedEvents },
            })
          );
          break;

        case 'getState':
          // Client requests current system state
          ws.send(
            JSON.stringify({
              type: 'systemState',
              data: this.getSystemSnapshot(),
            })
          );
          break;

        case 'createOrder':
          // Client manually creates an order
          if (this.demoGenerator) {
            const order = this.demoGenerator.generateRandomOrder(data.serviceType);
            ws.send(
              JSON.stringify({
                type: 'orderCreated',
                data: { order },
              })
            );
          }
          break;

        default:
          logger.warn(`Unknown message type from client`, {
            clientId: ws.clientId,
            type: data.type,
          });
      }
    } catch (error) {
      logger.error(`Error handling client message`, {
        clientId: ws.clientId,
        error: error.message,
      });
    }
  }

  startDemo(ordersPerMinute = 5, durationMinutes = 5) {
    if (this.isRunning) {
      logger.warn('Demo is already running');
      return;
    }

    logger.info('Starting demo', { ordersPerMinute, durationMinutes });

    this.isRunning = true;
    this.demoGenerator = new DemoGenerator();

    // Subscribe to demo generator events
    this.subscribeToGeneratorEvents();

    // Start the demo
    this.demoGenerator.start(ordersPerMinute, durationMinutes);

    // Broadcast demo started
    this.broadcast({
      type: 'demoStarted',
      data: {
        ordersPerMinute,
        durationMinutes,
        startTime: new Date().toISOString(),
      },
    });

    // Start heartbeat interval
    this.startHeartbeat();
  }

  stopDemo() {
    if (!this.isRunning) {
      logger.warn('Demo is not running');
      return;
    }

    logger.info('Stopping demo');

    if (this.demoGenerator) {
      this.demoGenerator.stop();
      this.demoGenerator = null;
    }

    this.isRunning = false;

    // Broadcast demo stopped
    this.broadcast({
      type: 'demoStopped',
      data: {
        stopTime: new Date().toISOString(),
        finalMetrics: this.systemState.metrics,
      },
    });

    // Stop heartbeat
    this.stopHeartbeat();
  }

  subscribeToGeneratorEvents() {
    if (!this.demoGenerator) return;

    // Order events
    this.demoGenerator.on('orderCreated', (order) => {
      this.systemState.orders.set(order.id, order);
      this.systemState.metrics.totalOrders++;
      this.addRecentEvent('orderCreated', order);

      this.broadcast({
        type: 'orderCreated',
        data: { order },
      });
    });

    this.demoGenerator.on('orderAssigned', (data) => {
      const order = this.systemState.orders.get(data.orderId);
      if (order) {
        order.status = 'assigned';
        order.driverId = data.driverId;
      }
      this.addRecentEvent('orderAssigned', data);

      this.broadcast({
        type: 'orderAssigned',
        data,
      });
    });

    this.demoGenerator.on('orderPickedUp', (data) => {
      const order = this.systemState.orders.get(data.orderId);
      if (order) {
        order.status = 'picked_up';
      }
      this.addRecentEvent('orderPickedUp', data);

      this.broadcast({
        type: 'orderPickedUp',
        data,
      });
    });

    this.demoGenerator.on('orderDelivered', (data) => {
      const order = this.systemState.orders.get(data.orderId);
      if (order) {
        order.status = 'delivered';
        this.systemState.metrics.completedOrders++;
      }
      this.addRecentEvent('orderDelivered', data);

      this.broadcast({
        type: 'orderDelivered',
        data,
      });
    });

    this.demoGenerator.on('orderFailed', (data) => {
      const order = this.systemState.orders.get(data.orderId);
      if (order) {
        order.status = 'failed';
        this.systemState.metrics.failedOrders++;
      }
      this.addRecentEvent('orderFailed', data);

      this.broadcast({
        type: 'orderFailed',
        data,
      });
    });

    // Driver events
    this.demoGenerator.on('driverStatusUpdate', (data) => {
      this.systemState.drivers.set(data.driverId, data);
      this.updateDriverMetrics();

      this.broadcast({
        type: 'driverStatusUpdate',
        data,
      });
    });

    // Route events
    this.demoGenerator.on('routeOptimized', (data) => {
      this.addRecentEvent('routeOptimized', data);

      this.broadcast({
        type: 'routeOptimized',
        data,
      });
    });

    // Batch events
    this.demoGenerator.on('batchCreated', (data) => {
      this.addRecentEvent('batchCreated', data);

      this.broadcast({
        type: 'batchCreated',
        data,
      });
    });

    // Alert events
    this.demoGenerator.on('slaAlert', (data) => {
      this.addRecentEvent('slaAlert', data);

      this.broadcast({
        type: 'slaAlert',
        data,
      });
    });

    // Stats updates
    this.demoGenerator.on('statsUpdate', (stats) => {
      this.systemState.metrics = {
        ...this.systemState.metrics,
        ...stats,
      };

      this.broadcast({
        type: 'metricsUpdate',
        data: this.systemState.metrics,
      });
    });
  }

  updateDriverMetrics() {
    let activeDrivers = 0;
    let busyDrivers = 0;

    for (const driver of this.systemState.drivers.values()) {
      if (driver.status === 'available' || driver.status === 'busy') {
        activeDrivers++;
      }
      if (driver.status === 'busy') {
        busyDrivers++;
      }
    }

    this.systemState.metrics.activeDrivers = activeDrivers;
    this.systemState.metrics.busyDrivers = busyDrivers;
  }

  addRecentEvent(type, data) {
    const event = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    this.systemState.recentEvents.push(event);

    // Keep only last 100 events
    if (this.systemState.recentEvents.length > 100) {
      this.systemState.recentEvents.shift();
    }
  }

  getSystemSnapshot() {
    return {
      orders: Array.from(this.systemState.orders.values()).slice(-50),
      drivers: Array.from(this.systemState.drivers.values()),
      metrics: this.systemState.metrics,
      recentEvents: this.systemState.recentEvents.slice(-20),
      timestamp: new Date().toISOString(),
    };
  }

  broadcast(message) {
    const messageStr = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        // Check if client has subscribed to specific events
        if (
          !client.subscribedEvents ||
          client.subscribedEvents.includes('all') ||
          client.subscribedEvents.includes(message.type)
        ) {
          client.send(messageStr);
        }
      }
    });
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((ws) => {
        if (!ws.isAlive) {
          logger.info('Terminating inactive client', { clientId: ws.clientId });
          ws.terminate();
          this.clients.delete(ws);
          return;
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  generateClientId() {
    return `client-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  start() {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        logger.info(`WebSocket server started on port ${this.port}`);
        logger.info(`Demo control API available at http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      // Stop demo if running
      this.stopDemo();

      // Close all client connections
      this.clients.forEach((client) => {
        client.close();
      });
      this.clients.clear();

      // Close WebSocket server
      if (this.wss) {
        this.wss.close(() => {
          logger.info('WebSocket server closed');
        });
      }

      // Close HTTP server
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Export for use as module
module.exports = DemoWebSocketServer;

// If run directly, start the server
if (require.main === module) {
  const server = new DemoWebSocketServer();

  server.start().then(() => {
    console.log('Demo WebSocket Server is running');
    console.log('Control endpoints:');
    console.log('  POST http://localhost:8081/demo/start - Start demo');
    console.log('  POST http://localhost:8081/demo/stop - Stop demo');
    console.log('  GET  http://localhost:8081/demo/status - Get status');
    console.log('WebSocket: ws://localhost:8081');
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
  });
}
