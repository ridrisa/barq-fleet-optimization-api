# Driver State Tracking System

## Overview

The Driver State Tracking System provides real-time operational state management for the BARQ Fleet Management platform. It replaces static status tracking with a comprehensive state machine that accurately represents driver availability and activity.

## Architecture

### State Machine

```
OFFLINE → AVAILABLE → BUSY → RETURNING → AVAILABLE
   ↑                                          ↓
   └──────────────────────────────────────────┘
              ↓ ON_BREAK ↓
```

### Valid State Transitions

| From State | To State(s) | Trigger |
|------------|-------------|---------|
| OFFLINE | AVAILABLE | Shift start |
| AVAILABLE | BUSY, ON_BREAK, OFFLINE | Order assigned, Break started, Shift end |
| BUSY | RETURNING, AVAILABLE, OFFLINE | Delivery completed (far/near), Emergency |
| RETURNING | AVAILABLE, ON_BREAK, OFFLINE | Returned to zone, Break needed, Shift end |
| ON_BREAK | AVAILABLE, OFFLINE | Break completed, Shift end |

## Components

### 1. Database Schema

**New Tables:**
- `driver_state_transitions` - Audit log of all state changes

**Enhanced Drivers Table:**
- Operational state tracking
- Performance metrics (daily targets)
- Capacity management
- Work hour tracking
- Break management

**Key Views:**
- `available_drivers_v` - Real-time driver availability
- `driver_performance_dashboard` - Performance metrics
- `fleet_status_realtime` - Fleet-wide statistics

### 2. Driver Model (`driver.model.js`)

**Core Methods:**

**State Management:**
```javascript
// Update driver state with validation
await DriverModel.updateState(driverId, 'AVAILABLE', {
  reason: 'shift_start',
  triggeredBy: 'driver'
});

// Check if state transition is valid
DriverModel.isValidTransition('AVAILABLE', 'BUSY'); // true/false
```

**Order Assignment:**
```javascript
// Assign order and transition to BUSY
await DriverModel.assignOrder(driverId, orderId, {
  dropoff_location: { lat: 24.7136, lng: 46.6753 },
  eta_to_dropoff: new Date('2025-01-15T14:30:00Z')
});

// Mark pickup completed
await DriverModel.completePickup(driverId, orderId);

// Complete delivery
await DriverModel.completeDelivery(driverId, orderId, {
  needsReturn: false // or true if far from base
});
```

**Availability:**
```javascript
// Check if driver can accept order
const isAvailable = await DriverModel.isAvailable(driverId);

// Get available drivers near location
const drivers = await DriverModel.getAvailableDrivers(
  { lat: 24.7136, lng: 46.6753 },
  {
    serviceType: 'BARQ',
    radiusKm: 10,
    minRating: 4.0,
    limit: 20
  }
);
```

**Break Management:**
```javascript
// Start break
await DriverModel.startBreak(driverId);

// End break
await DriverModel.endBreak(driverId);
```

**Performance:**
```javascript
// Get driver performance
const performance = await DriverModel.getPerformance(driverId, '30 days');

// Update on-time rate (call after each delivery)
await DriverModel.updateOnTimeRate(driverId);

// Get state transition history
const history = await DriverModel.getStateHistory(driverId, 50);
```

### 3. Driver State Service (`driver-state.service.js`)

High-level business logic orchestration.

**Order Assignment:**
```javascript
const driverStateService = require('./services/driver-state.service');

// Intelligent order assignment (finds best driver)
const assignment = await driverStateService.assignOrderToDriver(orderId, {
  pickup_location: { lat: 24.7136, lng: 46.6753 },
  dropoff_location: { lat: 24.7500, lng: 46.7000 },
  service_type: 'BARQ',
  vehicle_type_required: 'MOTORCYCLE'
});

// Returns: { driver, assignment: { orderId, assignedAt, estimatedPickupTime } }
```

**Shift Management:**
```javascript
// Start shift
await driverStateService.startShift(driverId, {
  lat: 24.7136,
  lng: 46.6753
});

// End shift
await driverStateService.endShift(driverId);
```

**Delivery Lifecycle:**
```javascript
// Complete pickup
await driverStateService.completePickup(driverId, orderId);

// Complete delivery
await driverStateService.completeDelivery(driverId, orderId, {
  distanceFromBase: 12 // km
});
```

**Fleet Monitoring:**
```javascript
// Get fleet status
const status = await driverStateService.getFleetStatus();
// Returns:
// {
//   total: 50,
//   by_state: {
//     AVAILABLE: { count: 20, avg_completed_today: 15.2 },
//     BUSY: { count: 25, ... },
//     ...
//   },
//   metrics: {
//     available_capacity: 20,
//     utilization_rate: 50
//   }
// }

// Check driver availability
const availability = await driverStateService.checkAvailability(driverId);
// Returns:
// {
//   available: false,
//   state: 'BUSY',
//   reason: 'Driver is BUSY',
//   eta_to_available: Date
// }
```

**Event Listeners:**
```javascript
// Subscribe to events
driverStateService.onStateChange((event) => {
  console.log('State changed:', event);
  // { driverId, orderId, fromState, toState, reason, timestamp }
});

driverStateService.onDeliveryComplete((event) => {
  console.log('Delivery completed:', event);
  // { driverId, orderId, completedToday, gap, nextState, timestamp }
});

driverStateService.onBreakRequired((event) => {
  console.log('Break required:', event);
  // { driverId, consecutiveDeliveries, timestamp }
});
```

## Database Migration

### Running Migrations

```bash
# Navigate to migrations directory
cd backend/src/database/migrations

# Run all pending migrations
node run-migrations.js

# Run specific migration
node run-migrations.js 001

# Check migration status
node run-migrations.js --status
```

### Migration 001: Add Driver State Tracking

Creates:
- New `operational_state` enum
- 20+ new columns in `drivers` table
- `driver_state_transitions` table
- Indexes for performance
- Database functions for business logic
- Triggers for automatic logging
- Views for analytics

## Key Features

### 1. Target-Based Assignment

Drivers have daily targets (default: 25 deliveries). System prioritizes drivers behind on their targets.

```sql
-- Calculated field
gap_from_target = target_deliveries - completed_today
```

**Priority Logic:**
- Drivers with positive gap get higher priority
- Balances workload across fleet
- Ensures fair distribution

### 2. Automatic Break Management

```sql
consecutive_deliveries >= requires_break_after (default: 5)
```

System emits `break-required` event when threshold reached.

### 3. Working Hours Tracking

```sql
hours_worked_today < max_working_hours (default: 10)
```

Automatically prevents assignment when limit reached.

### 4. Capacity Management

```sql
current_load_kg <= capacity_kg
```

Based on vehicle type:
- MOTORCYCLE: 30 kg
- CAR: 100 kg
- VAN: 500 kg
- TRUCK: 1000 kg

### 5. On-Time Performance

```sql
on_time_rate = (on_time_deliveries / total_deliveries) * 100
```

Calculated from last 30 days. Updated after each delivery.

### 6. State Transition Auditing

Every state change logged in `driver_state_transitions`:
- From/To state
- Reason
- Triggered by (system/driver/admin/agent)
- Timestamp
- Metadata

## Usage Examples

### Example 1: Complete Order Flow

```javascript
const DriverModel = require('./models/driver.model');
const driverStateService = require('./services/driver-state.service');

// 1. Find and assign driver
const assignment = await driverStateService.assignOrderToDriver('order-123', {
  pickup_location: { lat: 24.7136, lng: 46.6753 },
  dropoff_location: { lat: 24.7500, lng: 46.7000 },
  service_type: 'BARQ'
});

console.log('Assigned to:', assignment.driver.name);
console.log('ETA to pickup:', assignment.assignment.estimatedPickupTime);

// 2. Driver arrives at pickup
await driverStateService.completePickup(assignment.driver.id, 'order-123');

// 3. Driver completes delivery
const updatedDriver = await driverStateService.completeDelivery(
  assignment.driver.id,
  'order-123',
  { distanceFromBase: 5 }
);

console.log('Completed today:', updatedDriver.completed_today);
console.log('Gap from target:', updatedDriver.gap_from_target);
console.log('New state:', updatedDriver.operational_state); // AVAILABLE
```

### Example 2: Shift Management

```javascript
// Driver starts shift
const driver = await driverStateService.startShift('driver-456', {
  lat: 24.7136,
  lng: 46.6753
});

console.log('Shift started:', driver.operational_state); // AVAILABLE

// ... work throughout the day ...

// Check if can continue
const availability = await driverStateService.checkAvailability('driver-456');

if (!availability.available) {
  console.log('Cannot accept orders:', availability.reason);
  // e.g., "Driver has reached maximum working hours"
}

// End shift
await driverStateService.endShift('driver-456');
```

### Example 3: Fleet Monitoring

```javascript
// Get real-time fleet status
const status = await driverStateService.getFleetStatus();

console.log('Total drivers:', status.total);
console.log('Available:', status.by_state.AVAILABLE.count);
console.log('Busy:', status.by_state.BUSY.count);
console.log('Utilization:', status.metrics.utilization_rate + '%');

// Get driver performance
const performance = await driverStateService.getDriverPerformance('driver-456');

console.log('Completed today:', performance.completed_today);
console.log('Gap from target:', performance.gap_from_target);
console.log('On-time rate:', performance.on_time_rate + '%');
console.log('Avg delivery time:', performance.avg_delivery_time_minutes, 'mins');
```

### Example 4: Event-Driven Architecture

```javascript
// Listen for state changes
driverStateService.onStateChange(async (event) => {
  console.log(`Driver ${event.driverId}: ${event.fromState} → ${event.toState}`);

  // Notify driver app via WebSocket
  websocketServer.emit(`driver:${event.driverId}`, {
    type: 'state_changed',
    state: event.toState
  });

  // Update analytics
  await analyticsService.trackStateChange(event);
});

// Listen for deliveries
driverStateService.onDeliveryComplete(async (event) => {
  console.log(`Delivery ${event.orderId} completed by ${event.driverId}`);

  // Send notification to customer
  await notificationService.sendDeliveryComplete(event.orderId);

  // Update driver performance dashboard
  await dashboardService.updateDriverStats(event.driverId);
});

// Listen for break requirements
driverStateService.onBreakRequired(async (event) => {
  console.log(`Driver ${event.driverId} needs mandatory break`);

  // Notify driver
  await notificationService.notifyDriver(event.driverId, {
    type: 'break_required',
    message: 'You have completed 5 consecutive deliveries. Please take a break.'
  });

  // Auto-transition to break after current delivery
  await driverStateService.startBreak(event.driverId);
});
```

## Performance Considerations

### Database Indexes

Optimized for common queries:

```sql
-- Available driver lookup
idx_drivers_state_location (operational_state, current_location)

-- Availability check
idx_drivers_availability (operational_state, is_active, hours_worked_today, consecutive_deliveries)

-- Performance tracking
idx_drivers_performance (completed_today, target_deliveries, on_time_rate)
```

### Query Optimization

**Finding available drivers:**
- Uses spatial indexes (PostGIS)
- Filters at database level
- Returns enriched data in single query

**State transitions:**
- Validated before DB operation
- Triggers handle automatic logging
- No N+1 query problems

### Caching Strategy

For high-traffic scenarios:

```javascript
// Cache fleet status (1 minute TTL)
const cachedFleetStatus = await cache.get('fleet:status');
if (cachedFleetStatus) {
  return cachedFleetStatus;
}

const status = await driverStateService.getFleetStatus();
await cache.set('fleet:status', status, 60);
```

## Monitoring & Alerts

### Key Metrics to Track

1. **State Distribution**
   - AVAILABLE: Target > 20% during peak hours
   - BUSY: Indicator of demand vs capacity
   - OFFLINE: Should decrease during working hours

2. **Performance Metrics**
   - Average time in each state
   - State transition frequency
   - Gap from target distribution

3. **Operational Alerts**
   - Low available capacity (< 10%)
   - High percentage of drivers at max hours
   - Many drivers requiring breaks

### Sample Monitoring Query

```sql
-- Fleet capacity alert
SELECT
  operational_state,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM drivers
WHERE is_active = true
GROUP BY operational_state
ORDER BY operational_state;

-- Drivers near limits
SELECT
  id,
  name,
  hours_worked_today,
  max_working_hours,
  consecutive_deliveries,
  requires_break_after,
  completed_today,
  target_deliveries
FROM drivers
WHERE is_active = true
  AND (
    hours_worked_today >= max_working_hours * 0.9
    OR consecutive_deliveries >= requires_break_after * 0.8
    OR completed_today >= target_deliveries * 0.9
  );
```

## Scheduled Jobs

### Daily Reset (Midnight)

```javascript
// Reset daily metrics at midnight
const cron = require('node-cron');

cron.schedule('0 0 * * *', async () => {
  console.log('Running daily reset...');
  await driverStateService.resetDailyMetrics();
  console.log('Daily reset completed');
});
```

### Performance Updates (Every 15 minutes)

```javascript
// Update on-time rates periodically
cron.schedule('*/15 * * * *', async () => {
  const activeDrivers = await DriverModel.getActiveDrivers();

  for (const driver of activeDrivers) {
    await DriverModel.updateOnTimeRate(driver.id);
  }

  console.log(`Updated on-time rates for ${activeDrivers.length} drivers`);
});
```

## Testing

### Unit Tests

```javascript
const DriverModel = require('../models/driver.model');

describe('DriverModel State Transitions', () => {
  test('should allow AVAILABLE → BUSY transition', () => {
    expect(DriverModel.isValidTransition('AVAILABLE', 'BUSY')).toBe(true);
  });

  test('should reject BUSY → AVAILABLE → BUSY without intermediate state', () => {
    expect(DriverModel.isValidTransition('BUSY', 'AVAILABLE')).toBe(true);
    expect(DriverModel.isValidTransition('BUSY', 'BUSY')).toBe(false);
  });

  test('should calculate gap from target correctly', async () => {
    const driver = await DriverModel.getById('driver-123');
    expect(driver.gap_from_target).toBe(driver.target_deliveries - driver.completed_today);
  });
});
```

### Integration Tests

```javascript
describe('Driver State Service', () => {
  test('should assign order to best available driver', async () => {
    const assignment = await driverStateService.assignOrderToDriver('order-123', {
      pickup_location: { lat: 24.7136, lng: 46.6753 },
      service_type: 'BARQ'
    });

    expect(assignment.driver).toBeDefined();
    expect(assignment.driver.operational_state).toBe('BUSY');
    expect(assignment.driver.active_delivery_id).toBe('order-123');
  });

  test('should emit events on state change', async () => {
    const events = [];
    driverStateService.onStateChange((event) => events.push(event));

    await driverStateService.startShift('driver-456', { lat: 24.7136, lng: 46.6753 });

    expect(events).toHaveLength(1);
    expect(events[0].toState).toBe('AVAILABLE');
  });
});
```

## Troubleshooting

### Common Issues

**1. State Transition Rejected**
```
Error: Invalid state transition: BUSY → ON_BREAK
```
**Solution:** Driver must complete delivery first. Valid: BUSY → RETURNING/AVAILABLE → ON_BREAK

**2. Driver Cannot Accept Order**
```
Error: Driver cannot accept order. State: AVAILABLE, Hours: 9.5/10, Consecutive: 5
```
**Solution:** Driver needs break. Call `driverStateService.startBreak(driverId)`

**3. No Available Drivers**
```
Error: No available drivers for this order
```
**Solution:**
- Check radius (increase `radiusKm`)
- Lower `minRating` threshold
- Check if drivers are at capacity

### Debug Queries

```sql
-- Why is driver not available?
SELECT
  id,
  name,
  operational_state,
  is_active,
  hours_worked_today,
  max_working_hours,
  consecutive_deliveries,
  requires_break_after,
  completed_today,
  target_deliveries,
  can_accept_order(id) as can_accept
FROM drivers
WHERE id = 'driver-uuid-here';

-- Recent state transitions
SELECT *
FROM driver_state_transitions
WHERE driver_id = 'driver-uuid-here'
ORDER BY transitioned_at DESC
LIMIT 10;
```

## Future Enhancements

1. **Predictive Availability**
   - ML model to predict when drivers will become available
   - Smart pre-assignment based on ETAs

2. **Dynamic Target Adjustment**
   - Adjust targets based on demand forecast
   - Seasonal variations

3. **Zone-Based State Management**
   - Different rules per delivery zone
   - Zone-specific capacity limits

4. **Advanced Break Scheduling**
   - Optimize break timing based on demand
   - Suggest optimal break locations

5. **Performance Gamification**
   - Leaderboards
   - Achievement badges
   - Bonus targets

## Support

For issues or questions:
- Database Schema: Check `schema.sql` and migration files
- Model Methods: See `driver.model.js` inline documentation
- Service Logic: See `driver-state.service.js` JSDoc comments
- Migration Runner: `node run-migrations.js --help`

## License

Part of BARQ Fleet Management System - Internal Use Only
