/**
 * Demo Server for AI Route Optimization
 * Provides WebSocket and HTTP endpoints for the demo dashboard
 */

const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 8081;

// Middleware
app.use(cors());
app.use(express.json());

// System state
let systemState = {
    orders: [],
    drivers: [],
    metrics: {
        totalOrders: 0,
        completedOrders: 0,
        failedOrders: 0,
        slaCompliance: 100,
        activeDrivers: 0,
        busyDrivers: 0,
        averageDeliveryTime: 0
    },
    recentEvents: [],
    isRunning: false
};

// Demo configuration
let demoConfig = {
    ordersPerMinute: 5,
    duration: 5,
    intervalId: null
};

// Saudi Arabia locations (Riyadh)
const locations = {
    pickupPoints: [
        { name: 'Al Baik - Olaya', lat: 24.6995, lng: 46.6837, address: 'Olaya Street, Riyadh' },
        { name: 'McDonalds - King Fahd', lat: 24.7500, lng: 46.7250, address: 'King Fahd Road, Riyadh' },
        { name: 'Jarir Bookstore', lat: 24.7136, lng: 46.6753, address: 'King Fahd Road, Riyadh' },
        { name: 'Carrefour - Granada', lat: 24.7800, lng: 46.7300, address: 'Granada Mall, Riyadh' },
        { name: 'Starbucks - Tahlia', lat: 24.7000, lng: 46.6900, address: 'Tahlia Street, Riyadh' }
    ],
    deliveryZones: [
        { name: 'Al Malaz', lat: 24.6697, lng: 46.7236 },
        { name: 'Al Sahafa', lat: 24.8049, lng: 46.6359 },
        { name: 'Al Nakheel', lat: 24.7700, lng: 46.7400 },
        { name: 'Al Olaya', lat: 24.6995, lng: 46.6837 },
        { name: 'Al Wadi', lat: 24.7300, lng: 46.6700 },
        { name: 'Al Yasmin', lat: 24.8100, lng: 46.7000 },
        { name: 'King Abdullah', lat: 24.7600, lng: 46.6800 },
        { name: 'Al Muruj', lat: 24.7400, lng: 46.7100 }
    ]
};

// Driver names
const driverNames = [
    'Ahmed Al-Rashid',
    'Mohammed Al-Zahrani',
    'Khalid Al-Qahtani',
    'Abdullah Al-Otaibi',
    'Faisal Al-Harbi',
    'Sara Al-Shehri',
    'Maha Al-Ghamdi',
    'Yousef Al-Maliki',
    'Omar Al-Enezi',
    'Bandar Al-Mutairi'
];

// Initialize drivers
function initializeDrivers() {
    systemState.drivers = [];
    for (let i = 0; i < 10; i++) {
        const driver = {
            driverId: `DRV-${uuidv4().substring(0, 8)}`,
            name: driverNames[i],
            status: 'available',
            location: {
                lat: 24.7136 + (Math.random() - 0.5) * 0.1,
                lng: 46.6753 + (Math.random() - 0.5) * 0.1
            },
            currentOrders: 0
        };
        systemState.drivers.push(driver);
    }
    systemState.metrics.activeDrivers = systemState.drivers.length;
}

// Create a new order
function createOrder(serviceType = null) {
    const types = ['BARQ', 'BULLET'];
    const type = serviceType || types[Math.floor(Math.random() * types.length)];

    const pickup = locations.pickupPoints[Math.floor(Math.random() * locations.pickupPoints.length)];
    const dropoff = locations.deliveryZones[Math.floor(Math.random() * locations.deliveryZones.length)];

    const order = {
        id: `ORD-${uuidv4()}`,
        serviceType: type,
        status: 'pending',
        createdAt: new Date().toISOString(),
        pickup: {
            name: pickup.name,
            address: pickup.address,
            coordinates: { lat: pickup.lat, lng: pickup.lng }
        },
        dropoff: {
            name: `${dropoff.name} Customer`,
            address: `${dropoff.name} District, Riyadh`,
            coordinates: { lat: dropoff.lat, lng: dropoff.lng }
        },
        sla: type === 'BARQ' ? 60 : 30, // minutes
        priority: type === 'BULLET' ? 'HIGH' : 'NORMAL'
    };

    systemState.orders.unshift(order);
    systemState.metrics.totalOrders++;

    // Broadcast to all WebSocket clients
    broadcast({
        type: 'orderCreated',
        data: { order }
    });

    // Add event
    addEvent('orderCreated', `New ${type} order created: ${order.id.substring(0, 13)}`);

    // Simulate order assignment after 2-5 seconds
    setTimeout(() => assignOrder(order.id), 2000 + Math.random() * 3000);

    return order;
}

// Assign order to driver
function assignOrder(orderId) {
    const order = systemState.orders.find(o => o.id === orderId);
    if (!order || order.status !== 'pending') return;

    // Find available driver
    const availableDrivers = systemState.drivers.filter(d => d.status === 'available');
    if (availableDrivers.length === 0) {
        // No available drivers, order remains pending
        addEvent('noDriver', `No driver available for order ${orderId.substring(0, 13)}`);
        return;
    }

    const driver = availableDrivers[Math.floor(Math.random() * availableDrivers.length)];

    // Assign order
    order.status = 'assigned';
    order.driverId = driver.driverId;
    driver.status = 'busy';
    driver.currentOrders++;
    systemState.metrics.busyDrivers++;

    broadcast({
        type: 'orderAssigned',
        data: { orderId: order.id, driverId: driver.driverId }
    });

    addEvent('orderAssigned', `Order ${orderId.substring(0, 13)} assigned to ${driver.name}`);

    // Simulate pickup after 5-10 seconds
    setTimeout(() => pickupOrder(orderId), 5000 + Math.random() * 5000);
}

// Pickup order
function pickupOrder(orderId) {
    const order = systemState.orders.find(o => o.id === orderId);
    if (!order || order.status !== 'assigned') return;

    order.status = 'picked_up';
    order.pickedUpAt = new Date().toISOString();

    broadcast({
        type: 'orderPickedUp',
        data: { orderId: order.id }
    });

    addEvent('orderPickedUp', `Order ${orderId.substring(0, 13)} picked up`);

    // Simulate delivery after 10-20 seconds
    const deliveryTime = 10000 + Math.random() * 10000;
    setTimeout(() => deliverOrder(orderId), deliveryTime);
}

// Deliver order
function deliverOrder(orderId) {
    const order = systemState.orders.find(o => o.id === orderId);
    if (!order || order.status !== 'picked_up') return;

    // Randomly fail 5% of orders
    if (Math.random() < 0.05) {
        order.status = 'failed';
        order.failedAt = new Date().toISOString();
        order.failReason = 'Customer not available';
        systemState.metrics.failedOrders++;

        broadcast({
            type: 'orderFailed',
            data: { orderId: order.id, reason: order.failReason }
        });

        addEvent('orderFailed', `Order ${orderId.substring(0, 13)} failed: ${order.failReason}`);
    } else {
        order.status = 'delivered';
        order.deliveredAt = new Date().toISOString();
        systemState.metrics.completedOrders++;

        // Calculate delivery time
        const deliveryTime = (new Date(order.deliveredAt) - new Date(order.createdAt)) / 60000; // in minutes
        systemState.metrics.averageDeliveryTime =
            (systemState.metrics.averageDeliveryTime * (systemState.metrics.completedOrders - 1) + deliveryTime) /
            systemState.metrics.completedOrders;

        // Check SLA
        const slaViolation = deliveryTime > order.sla;
        if (slaViolation) {
            addEvent('slaViolation', `SLA violation for order ${orderId.substring(0, 13)}`);
            broadcast({
                type: 'slaAlert',
                data: {
                    orderId: order.id,
                    message: `Delivery took ${Math.round(deliveryTime)}m, SLA was ${order.sla}m`
                }
            });
        }

        broadcast({
            type: 'orderDelivered',
            data: { orderId: order.id, deliveryTime }
        });

        addEvent('orderDelivered', `Order ${orderId.substring(0, 13)} delivered in ${Math.round(deliveryTime)}m`);
    }

    // Free up driver
    const driver = systemState.drivers.find(d => d.driverId === order.driverId);
    if (driver) {
        driver.currentOrders--;
        if (driver.currentOrders === 0) {
            driver.status = 'available';
            systemState.metrics.busyDrivers--;
        }

        // Update driver location
        driver.location = {
            lat: order.dropoff.coordinates.lat + (Math.random() - 0.5) * 0.01,
            lng: order.dropoff.coordinates.lng + (Math.random() - 0.5) * 0.01
        };

        broadcast({
            type: 'driverStatusUpdate',
            data: driver
        });
    }

    // Calculate SLA compliance
    const completedOrders = systemState.orders.filter(o =>
        o.status === 'delivered' || o.status === 'failed'
    );
    const onTimeOrders = completedOrders.filter(o => {
        if (o.status === 'failed') return false;
        const time = (new Date(o.deliveredAt) - new Date(o.createdAt)) / 60000;
        return time <= o.sla;
    });
    systemState.metrics.slaCompliance = completedOrders.length > 0
        ? (onTimeOrders.length / completedOrders.length * 100)
        : 100;

    // Send metrics update
    broadcast({
        type: 'metricsUpdate',
        data: systemState.metrics
    });
}

// Add event to recent events
function addEvent(type, message) {
    const event = {
        type,
        data: message,
        timestamp: new Date().toISOString()
    };
    systemState.recentEvents.unshift(event);
    if (systemState.recentEvents.length > 50) {
        systemState.recentEvents.pop();
    }
}

// Start demo
function startDemo(ordersPerMinute = 5, duration = 5) {
    if (systemState.isRunning) {
        return { success: false, message: 'Demo already running' };
    }

    console.log(`Starting demo: ${ordersPerMinute} orders/min for ${duration} minutes`);

    systemState.isRunning = true;
    demoConfig.ordersPerMinute = ordersPerMinute;
    demoConfig.duration = duration;

    // Initialize drivers if not already done
    if (systemState.drivers.length === 0) {
        initializeDrivers();
    }

    // Create orders periodically
    const interval = 60000 / ordersPerMinute; // milliseconds between orders
    demoConfig.intervalId = setInterval(() => {
        createOrder();
    }, interval);

    // Stop after duration
    setTimeout(() => {
        stopDemo();
    }, duration * 60000);

    broadcast({
        type: 'demoStarted',
        data: { ordersPerMinute, duration }
    });

    addEvent('demoStarted', `Demo started: ${ordersPerMinute} orders/min for ${duration} min`);

    return { success: true, message: 'Demo started successfully' };
}

// Stop demo
function stopDemo() {
    if (!systemState.isRunning) {
        return { success: false, message: 'Demo not running' };
    }

    console.log('Stopping demo');

    if (demoConfig.intervalId) {
        clearInterval(demoConfig.intervalId);
        demoConfig.intervalId = null;
    }

    systemState.isRunning = false;

    broadcast({
        type: 'demoStopped',
        data: {}
    });

    addEvent('demoStopped', 'Demo stopped');

    return { success: true, message: 'Demo stopped successfully' };
}

// Reset system
function resetSystem() {
    stopDemo();
    systemState = {
        orders: [],
        drivers: [],
        metrics: {
            totalOrders: 0,
            completedOrders: 0,
            failedOrders: 0,
            slaCompliance: 100,
            activeDrivers: 0,
            busyDrivers: 0,
            averageDeliveryTime: 0
        },
        recentEvents: [],
        isRunning: false
    };
    initializeDrivers();

    broadcast({
        type: 'systemReset',
        data: {}
    });

    return { success: true, message: 'System reset successfully' };
}

// HTTP Routes
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        isRunning: systemState.isRunning,
        metrics: systemState.metrics
    });
});

app.post('/demo/start', (req, res) => {
    const { ordersPerMinute = 5, duration = 5 } = req.body;
    const result = startDemo(ordersPerMinute, duration);
    res.json(result);
});

app.post('/demo/stop', (req, res) => {
    const result = stopDemo();
    res.json(result);
});

app.post('/demo/reset', (req, res) => {
    const result = resetSystem();
    res.json(result);
});

app.get('/state', (req, res) => {
    res.json(systemState);
});

// Start HTTP server
const server = app.listen(PORT, () => {
    console.log(`Demo HTTP server running on port ${PORT}`);
    console.log(`Dashboard URL: http://localhost:${PORT}`);
});

// WebSocket Server
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Set();

// Broadcast to all connected clients
function broadcast(message) {
    const messageStr = JSON.stringify(message);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');
    clients.add(ws);

    // Send initial state
    ws.send(JSON.stringify({
        type: 'connection',
        data: {
            message: 'Connected to demo server',
            systemState
        }
    }));

    // Handle messages from client
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'subscribe':
                    console.log('Client subscribed to events');
                    break;

                case 'getState':
                    ws.send(JSON.stringify({
                        type: 'systemState',
                        data: systemState
                    }));
                    break;

                case 'createOrder':
                    const order = createOrder(data.serviceType);
                    ws.send(JSON.stringify({
                        type: 'orderCreated',
                        data: { order }
                    }));
                    break;

                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
        }
    });

    // Handle client disconnect
    ws.on('close', () => {
        console.log('WebSocket client disconnected');
        clients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });
});

// Initialize system
initializeDrivers();

console.log('===========================================');
console.log('   AI Route Optimization Demo Server');
console.log('===========================================');
console.log(`HTTP Server: http://localhost:${PORT}`);
console.log(`WebSocket: ws://localhost:${PORT}`);
console.log(`Dashboard: Open frontend/demo-dashboard.html`);
console.log('===========================================');

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down demo server...');
    stopDemo();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});