# Driver State Tracking - Quick Start Guide

## 5-Minute Setup

### 1. Run Migrations

```bash
cd backend/src/database/migrations
node run-migrations.js
```

### 2. Import Services

```javascript
const DriverModel = require('./models/driver.model');
const driverStateService = require('./services/driver-state.service');
```

### 3. Start Using

```javascript
// Find available drivers
const drivers = await driverStateService.getAvailableDrivers(
  { lat: 24.7136, lng: 46.6753 },
  { serviceType: 'BARQ' }
);

// Assign order
const assignment = await driverStateService.assignOrderToDriver('order-123', {
  pickup_location: { lat: 24.7136, lng: 46.6753 },
  dropoff_location: { lat: 24.7500, lng: 46.7000 },
  service_type: 'BARQ'
});

// Complete delivery
await driverStateService.completeDelivery(assignment.driver.id, 'order-123');
```

## Common Operations

### Driver Shift Management

```javascript
// Start shift
await driverStateService.startShift(driverId, {
  lat: 24.7136,
  lng: 46.6753
});

// End shift
await driverStateService.endShift(driverId);
```

### Order Assignment

```javascript
// Automatic (finds best driver)
const assignment = await driverStateService.assignOrderToDriver(orderId, orderDetails);

// Manual (specific driver)
await DriverModel.assignOrder(driverId, orderId, orderDetails);
```

### Availability Check

```javascript
// Check if driver can accept orders
const canAccept = await DriverModel.isAvailable(driverId);

// Get detailed availability info
const availability = await driverStateService.checkAvailability(driverId);
console.log(availability.reason); // Why driver is unavailable
```

### State Transitions

```javascript
// Manual state change
await DriverModel.updateState(driverId, 'ON_BREAK', {
  reason: 'break_started',
  triggeredBy: 'driver'
});

// Valid transitions
DriverModel.isValidTransition('AVAILABLE', 'BUSY'); // true
DriverModel.isValidTransition('BUSY', 'ON_BREAK'); // false (must go through AVAILABLE)
```

### Performance Tracking

```javascript
// Get driver performance
const performance = await driverStateService.getDriverPerformance(driverId);

console.log('Completed today:', performance.completed_today);
console.log('Gap from target:', performance.gap_from_target);
console.log('On-time rate:', performance.on_time_rate + '%');
```

### Fleet Monitoring

```javascript
// Get fleet status
const status = await driverStateService.getFleetStatus();

console.log('Available:', status.by_state.AVAILABLE.count);
console.log('Busy:', status.by_state.BUSY.count);
console.log('Utilization:', status.metrics.utilization_rate + '%');
```

## Event Handling

```javascript
// Listen for state changes
driverStateService.onStateChange((event) => {
  console.log(`Driver ${event.driverId}: ${event.fromState} → ${event.toState}`);
  // Notify driver app, update UI, log analytics, etc.
});

// Listen for completed deliveries
driverStateService.onDeliveryComplete((event) => {
  console.log(`Order ${event.orderId} delivered`);
  // Notify customer, update dashboard, etc.
});

// Listen for break requirements
driverStateService.onBreakRequired((event) => {
  console.log(`Driver ${event.driverId} needs break`);
  // Send notification to driver
});
```

## API Endpoint Examples

### REST API Integration

```javascript
// routes/drivers.routes.js
const express = require('express');
const router = express.Router();
const driverStateService = require('../services/driver-state.service');

// Get available drivers
router.get('/drivers/available', async (req, res) => {
  try {
    const { lat, lng, service_type, radius_km } = req.query;

    const drivers = await driverStateService.getAvailableDrivers(
      { lat: parseFloat(lat), lng: parseFloat(lng) },
      {
        serviceType: service_type,
        radiusKm: parseInt(radius_km) || 10
      }
    );

    res.json({ success: true, drivers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Assign order to driver
router.post('/orders/:orderId/assign', async (req, res) => {
  try {
    const { orderId } = req.params;
    const orderDetails = req.body;

    const assignment = await driverStateService.assignOrderToDriver(
      orderId,
      orderDetails
    );

    res.json({ success: true, assignment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start driver shift
router.post('/drivers/:driverId/shift/start', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { location } = req.body;

    const driver = await driverStateService.startShift(driverId, location);

    res.json({ success: true, driver });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Complete delivery
router.post('/orders/:orderId/complete', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { driver_id, distance_from_base } = req.body;

    const driver = await driverStateService.completeDelivery(driver_id, orderId, {
      distanceFromBase: distance_from_base
    });

    res.json({ success: true, driver });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get fleet status
router.get('/fleet/status', async (req, res) => {
  try {
    const status = await driverStateService.getFleetStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

## WebSocket Integration

```javascript
// Real-time driver location updates
const io = require('socket.io')(server);

// Driver app connects
io.on('connection', (socket) => {
  console.log('Driver connected:', socket.id);

  // Driver sends location update
  socket.on('location:update', async (data) => {
    const { driver_id, location } = data;

    await driverStateService.updateDriverLocation(driver_id, location);

    // Broadcast to admin dashboard
    io.to('admin').emit('driver:location', {
      driver_id,
      location,
      timestamp: new Date()
    });
  });

  // Driver starts shift
  socket.on('shift:start', async (data) => {
    const { driver_id, location } = data;

    const driver = await driverStateService.startShift(driver_id, location);

    socket.emit('shift:started', { driver });
  });

  // Driver completes delivery
  socket.on('delivery:complete', async (data) => {
    const { driver_id, order_id } = data;

    const driver = await driverStateService.completeDelivery(driver_id, order_id);

    socket.emit('delivery:completed', { driver });

    // Notify customer
    io.to(`order:${order_id}`).emit('order:delivered', {
      order_id,
      delivered_at: new Date()
    });
  });
});

// Subscribe to state changes
driverStateService.onStateChange((event) => {
  io.to('admin').emit('driver:state_changed', event);
  io.to(`driver:${event.driverId}`).emit('state_changed', event);
});
```

## Scheduled Jobs

```javascript
// cron/daily-reset.js
const cron = require('node-cron');
const driverStateService = require('../services/driver-state.service');

// Reset daily metrics at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('[CRON] Running daily driver metrics reset...');

  try {
    await driverStateService.resetDailyMetrics();
    console.log('[CRON] Daily reset completed successfully');
  } catch (error) {
    console.error('[CRON] Daily reset failed:', error);
  }
});

// Update on-time rates every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('[CRON] Updating driver on-time rates...');

  try {
    const drivers = await DriverModel.getActiveDrivers();

    for (const driver of drivers) {
      await DriverModel.updateOnTimeRate(driver.id);
    }

    console.log(`[CRON] Updated rates for ${drivers.length} drivers`);
  } catch (error) {
    console.error('[CRON] Rate update failed:', error);
  }
});
```

## Testing Examples

```javascript
// tests/driver-state.test.js
const DriverModel = require('../models/driver.model');
const driverStateService = require('../services/driver-state.service');

describe('Driver State Management', () => {
  let testDriver;

  beforeEach(async () => {
    // Create test driver
    testDriver = await DriverModel.create({
      employee_id: 'TEST-001',
      name: 'Test Driver',
      phone: '+966500000000',
      vehicle_type: 'MOTORCYCLE',
      service_types: ['BARQ']
    });
  });

  test('should start shift successfully', async () => {
    const driver = await driverStateService.startShift(testDriver.id, {
      lat: 24.7136,
      lng: 46.6753
    });

    expect(driver.operational_state).toBe('AVAILABLE');
  });

  test('should assign order to available driver', async () => {
    await driverStateService.startShift(testDriver.id, {
      lat: 24.7136,
      lng: 46.6753
    });

    const assignment = await driverStateService.assignOrderToDriver('order-123', {
      pickup_location: { lat: 24.7136, lng: 46.6753 },
      dropoff_location: { lat: 24.7500, lng: 46.7000 },
      service_type: 'BARQ'
    });

    expect(assignment.driver.operational_state).toBe('BUSY');
    expect(assignment.driver.active_delivery_id).toBe('order-123');
  });

  test('should complete delivery and return to available', async () => {
    // Setup: Start shift and assign order
    await driverStateService.startShift(testDriver.id, {
      lat: 24.7136,
      lng: 46.6753
    });

    await DriverModel.assignOrder(testDriver.id, 'order-123', {
      dropoff_location: { lat: 24.7500, lng: 46.7000 }
    });

    // Complete delivery
    const driver = await driverStateService.completeDelivery(testDriver.id, 'order-123');

    expect(driver.operational_state).toBe('AVAILABLE');
    expect(driver.completed_today).toBe(1);
    expect(driver.active_delivery_id).toBeNull();
  });

  test('should require break after consecutive deliveries', async () => {
    await driverStateService.startShift(testDriver.id, {
      lat: 24.7136,
      lng: 46.6753
    });

    // Complete 5 deliveries
    for (let i = 1; i <= 5; i++) {
      await DriverModel.assignOrder(testDriver.id, `order-${i}`, {});
      await driverStateService.completeDelivery(testDriver.id, `order-${i}`);
    }

    const driver = await DriverModel.getById(testDriver.id);
    expect(driver.consecutive_deliveries).toBe(5);
    expect(await DriverModel.isAvailable(testDriver.id)).toBe(false);
  });
});
```

## Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=barq_logistics
DB_USER=postgres
DB_PASSWORD=your_password

# Optional
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
```

## Troubleshooting

### Driver Not Showing as Available

```javascript
// Debug availability
const driver = await DriverModel.getById(driverId);
const canAccept = await DriverModel.isAvailable(driverId);

console.log('State:', driver.operational_state);
console.log('Active:', driver.is_active);
console.log('Hours worked:', driver.hours_worked_today, '/', driver.max_working_hours);
console.log('Consecutive:', driver.consecutive_deliveries, '/', driver.requires_break_after);
console.log('Completed:', driver.completed_today, '/', driver.target_deliveries);
console.log('Can accept:', canAccept);
```

### State Transition Rejected

```javascript
// Check valid transitions
const currentState = driver.operational_state;
const validNextStates = DriverModel.VALID_TRANSITIONS[currentState];

console.log(`From ${currentState}, valid transitions:`, validNextStates);
```

### No Drivers Found

```javascript
// Adjust search parameters
const drivers = await driverStateService.getAvailableDrivers(
  { lat: 24.7136, lng: 46.6753 },
  {
    radiusKm: 20, // Increase radius
    minRating: 3.0, // Lower rating threshold
    limit: 50 // Check more drivers
  }
);

console.log('Found:', drivers.length);
```

## Next Steps

- Read full documentation: `DRIVER_STATE_SYSTEM.md`
- Review migration files: `migrations/001_add_driver_state_tracking.sql`
- Check API examples: See above REST and WebSocket sections
- Run tests: `npm test`

## Support

For questions or issues:
- Check documentation in `backend/src/database/`
- Review inline code comments
- Contact development team
