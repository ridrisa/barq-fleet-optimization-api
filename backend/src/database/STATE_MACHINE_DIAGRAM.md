# Driver State Machine - Visual Reference

## State Transition Diagram

```
                                    ┌──────────────┐
                                    │              │
                        START ────> │   OFFLINE    │ <──── Emergency/Shift End
                                    │              │
                                    └──────┬───────┘
                                           │
                                    Shift Start
                                    (Driver logs in)
                                           │
                                           ▼
                                    ┌──────────────┐
                          ┌────────>│              │<────────┐
                          │         │  AVAILABLE   │         │
                          │         │              │         │
                          │         └──────┬───────┘         │
                          │                │                 │
                   Delivery Complete       │                 │
                   (Near base)     Order Assigned            │
                          │                │                 │
                          │                ▼                 │
                          │         ┌──────────────┐         │
                          │         │              │         │
                          │         │     BUSY     │         │
                          │         │              │         │
                          │         └──────┬───────┘         │
                          │                │                 │
                          │         Delivery Complete        │
                          │         (Far from base)          │
                          │                │                 │
                          │                ▼                 │
                          │         ┌──────────────┐         │
                          │         │              │         │
                          └─────────│  RETURNING   │─────────┘
                                    │              │
                                    └──────┬───────┘
                                           │
                                    Arrived/Break
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │              │
                                    │   ON_BREAK   │
                                    │              │
                                    └──────────────┘
                                           │
                                    Break Complete
                                           │
                                           ▼
                                    (Returns to AVAILABLE)
```

## State Descriptions

### OFFLINE
**Definition:** Driver not currently working

**Entry Conditions:**
- Initial state for new drivers
- Shift ended normally
- Emergency situation
- System maintenance

**Exit Conditions:**
- Driver starts shift (manual)
- Admin forces online

**Restrictions:**
- Cannot accept orders
- Not visible in available drivers list
- Location updates ignored

**Typical Duration:** Off-shift hours (14-16 hours/day)

---

### AVAILABLE
**Definition:** Driver ready and able to accept new orders

**Entry Conditions:**
- Shift started
- Delivery completed (near base)
- Returned from RETURNING
- Break completed
- Previous order cancelled

**Exit Conditions:**
- Order assigned
- Break started
- Shift ended
- Emergency offline

**Requirements:**
- ✅ is_active = true
- ✅ operational_state = 'AVAILABLE'
- ✅ hours_worked_today < max_working_hours
- ✅ consecutive_deliveries < requires_break_after
- ✅ completed_today < target_deliveries
- ✅ current_location updated recently (< 5 minutes)

**Typical Duration:** 30-60% of shift time

---

### BUSY
**Definition:** Driver actively executing a delivery

**Entry Conditions:**
- Order assigned successfully
- Pickup completed
- In transit to dropoff

**Exit Conditions:**
- Delivery completed (to AVAILABLE if near base)
- Delivery completed (to RETURNING if far from base)
- Order cancelled/failed (return to AVAILABLE)
- Emergency (to OFFLINE)

**Characteristics:**
- Has active_delivery_id
- GPS tracking active
- Cannot accept new orders
- ETA displayed to customer
- consecutive_deliveries incremented

**Typical Duration:** 20-45 minutes per delivery

---

### RETURNING
**Definition:** Driver returning to service area after distant delivery

**Entry Conditions:**
- Delivery completed far from base (>15km)
- Manually set by admin

**Exit Conditions:**
- Arrived in service area
- Break needed
- Shift ended

**Characteristics:**
- No active delivery
- GPS tracking active
- May accept en-route orders
- ETA to available displayed

**Typical Duration:** 15-30 minutes

---

### ON_BREAK
**Definition:** Driver taking mandatory or voluntary rest

**Entry Conditions:**
- Mandatory: consecutive_deliveries >= requires_break_after
- Voluntary: driver requests break
- System-forced: hours_worked_today approaching limit

**Exit Conditions:**
- Break duration met (minimum 15 minutes)
- Driver manually ends break
- Emergency recall

**Characteristics:**
- consecutive_deliveries reset to 0
- break_duration_minutes tracked
- Cannot accept orders
- Location updates optional

**Typical Duration:** 15-30 minutes

---

## Transition Rules Matrix

| From State | To State | Trigger | Validation | Auto/Manual |
|------------|----------|---------|------------|-------------|
| OFFLINE | AVAILABLE | Shift start | Active driver | Manual |
| AVAILABLE | BUSY | Order assigned | Can accept order | System |
| AVAILABLE | ON_BREAK | Break start | No active delivery | Manual |
| AVAILABLE | OFFLINE | Shift end | No active delivery | Manual |
| BUSY | AVAILABLE | Delivery complete | Distance < 15km | System |
| BUSY | RETURNING | Delivery complete | Distance >= 15km | System |
| BUSY | OFFLINE | Emergency | None | Manual |
| RETURNING | AVAILABLE | Arrived | In service area | System/Manual |
| RETURNING | ON_BREAK | Break needed | Arrived + needs break | Manual |
| RETURNING | OFFLINE | Shift end | No active delivery | Manual |
| ON_BREAK | AVAILABLE | Break end | Min 15 min elapsed | Manual |
| ON_BREAK | OFFLINE | Shift end | Break complete | Manual |

## State-Specific Metrics

### AVAILABLE
```javascript
{
  can_accept_order: boolean,
  hours_remaining: number,      // max_working_hours - hours_worked_today
  deliveries_remaining: number, // target_deliveries - completed_today
  consecutive_count: number,    // consecutive_deliveries
  break_in: number,            // requires_break_after - consecutive_deliveries
  location: { lat, lng },
  last_update: timestamp
}
```

### BUSY
```javascript
{
  active_delivery_id: uuid,
  pickup_completed: boolean,
  delivery_started_at: timestamp,
  eta_to_dropoff: timestamp,
  current_location: { lat, lng },
  dropoff_location: { lat, lng },
  estimated_duration: minutes,
  time_elapsed: minutes
}
```

### RETURNING
```javascript
{
  return_started_at: timestamp,
  estimated_arrival: timestamp,
  distance_to_base: km,
  current_location: { lat, lng }
}
```

### ON_BREAK
```javascript
{
  break_started_at: timestamp,
  break_type: 'mandatory' | 'voluntary',
  min_duration: minutes,
  elapsed: minutes,
  can_end: boolean
}
```

## Priority Scoring Algorithm

When finding available drivers, system calculates priority score (0-100):

```
┌─────────────────────────────────────────┐
│  Priority Score Calculation (Max: 100)  │
├─────────────────────────────────────────┤
│                                          │
│  State Factor (40 points)                │
│  ├─ AVAILABLE:  40 points               │
│  └─ RETURNING:  20 points               │
│                                          │
│  Distance Factor (30 points)             │
│  ├─ Formula: 30 × (1 - distance/max)   │
│  ├─ 0 km:     30 points                 │
│  ├─ 5 km:     15 points                 │
│  └─ 10 km:     0 points                 │
│                                          │
│  Rating Factor (15 points)               │
│  ├─ Formula: (rating / 5.0) × 15       │
│  ├─ 5.0 stars: 15 points                │
│  ├─ 4.0 stars: 12 points                │
│  └─ 3.0 stars:  9 points                │
│                                          │
│  Target Gap Factor (15 points)           │
│  ├─ Formula: min(15, gap × 2)          │
│  ├─ Gap 10:   15 points                 │
│  ├─ Gap 5:    10 points                 │
│  └─ Gap 0:     0 points                 │
│                                          │
└─────────────────────────────────────────┘

Example:
Driver A: AVAILABLE, 2km away, 4.5 rating, gap 8
  = 40 + 24 + 13.5 + 15 = 92.5 points

Driver B: RETURNING, 1km away, 5.0 rating, gap 2
  = 20 + 27 + 15 + 4 = 66 points

Driver A wins assignment
```

## Availability Decision Tree

```
                    Check Driver Availability
                             │
                             ▼
                    ┌────────────────┐
                    │  is_active?    │───NO──> ❌ "Driver inactive"
                    └────────┬───────┘
                            YES
                             ▼
                ┌─────────────────────┐
                │ operational_state   │───NOT AVAILABLE──> ❌ "Driver state: {state}"
                │   = AVAILABLE?      │
                └──────────┬──────────┘
                          YES
                           ▼
            ┌──────────────────────────┐
            │ hours_worked_today       │───NO──> ❌ "Max hours reached"
            │ < max_working_hours?     │
            └──────────┬───────────────┘
                      YES
                       ▼
        ┌────────────────────────────────┐
        │ consecutive_deliveries         │───NO──> ❌ "Break required"
        │ < requires_break_after?        │
        └────────────┬───────────────────┘
                    YES
                     ▼
            ┌────────────────────┐
            │ completed_today    │───NO──> ❌ "Target reached"
            │ < target_deliveries?│
            └──────────┬─────────┘
                      YES
                       ▼
                ┌─────────────┐
                │ ✅ AVAILABLE │
                └─────────────┘
```

## Event Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                    Order Assignment Flow                        │
└────────────────────────────────────────────────────────────────┘

  New Order Created
        │
        ▼
  Find Available Drivers
   (within radius)
        │
        ▼
  Calculate Priority Scores
        │
        ▼
  Select Best Driver ──────────────────┐
        │                              │
        ▼                              │
  Assign Order                         │
        │                              │
        ├─> Update operational_state   │
        ├─> Set active_delivery_id     │
        ├─> Increment consecutive      │
        └─> Record state transition    │
        │                              │
        ▼                              ▼
  Emit 'state-changed' event    Notify Driver App
        │                              │
        ▼                              ▼
  Emit 'order-assigned' event   Update Dashboard
        │
        └──> Continue to pickup...


┌────────────────────────────────────────────────────────────────┐
│                    Delivery Completion Flow                     │
└────────────────────────────────────────────────────────────────┘

  Delivery Completed
        │
        ▼
  Calculate Distance from Base
        │
        ├─────> < 15km ────────> AVAILABLE
        │
        └─────> >= 15km ───────> RETURNING
        │
        ▼
  Update Metrics
        │
        ├─> Increment completed_today
        ├─> Calculate hours_worked
        ├─> Update on_time_rate
        └─> Clear active_delivery_id
        │
        ▼
  Check Break Requirement
        │
        ├─> consecutive_deliveries >= 5 ────> Emit 'break-required'
        │
        └─> Otherwise ────> Continue
        │
        ▼
  Emit 'delivery-completed' event
        │
        └──> Driver available for next order
```

## Daily Lifecycle

```
00:00 ─────────────────────────────────────────────────── 24:00
  │                                                          │
  ├─> Daily Reset                                           │
  │   ├─ completed_today = 0                                │
  │   ├─ hours_worked_today = 0                             │
  │   └─ consecutive_deliveries = 0                         │
  │                                                          │
  ├──────> OFFLINE ──────────────────────────────────────> OFFLINE
           (Off-shift)                                       │
              │                                              │
           07:00 Shift Start                              21:00
              │                                              │
              ▼                                              ▼
          AVAILABLE ──> BUSY ──> AVAILABLE ──> ... ──> AVAILABLE
              │          │          │                        │
          15 deliveries  │      Break (15 min)           Shift End
          completed      │          │                        │
              │      20-30 min      │                        │
              │     per cycle       │                        │
              ▼                     ▼                        ▼
          Target: 25           5th delivery              OFFLINE
          Gap: -10             Break required           Day Complete
```

## State Duration Statistics (Typical)

```
╔════════════════════════════════════════════════════════════╗
║  State          │ Avg Duration │ % of Shift │ Transitions/Day ║
╠════════════════════════════════════════════════════════════╣
║  OFFLINE        │    14 hours  │    N/A    │      2         ║
║  AVAILABLE      │  5-10 min    │   30-40%  │     20-30      ║
║  BUSY           │  25-35 min   │   50-60%  │     20-25      ║
║  RETURNING      │  15-20 min   │    5-10%  │      2-5       ║
║  ON_BREAK       │  15-30 min   │    3-5%   │      2-3       ║
╚════════════════════════════════════════════════════════════╝

Total Transitions per Day: ~50-70
Active Shift Duration: 10 hours
Deliveries per Shift: 20-30
```

## Error States & Recovery

```
Error Condition                 System Response              Recovery
─────────────────────────────────────────────────────────────────────
Driver stuck in BUSY > 2 hours  → Alert dispatcher          → Manual state reset
                                                             → Contact driver

No location update > 5 min      → Mark as potentially       → Auto-ping driver
                                  unavailable                → Alert if no response

consecutive_deliveries > 8      → Force break               → Block assignments
                                                             → Notify driver

hours_worked > 12               → Force offline             → Block shift start
                                                             → Alert admin

State transition failed         → Rollback transaction      → Log error
                                                             → Retry after 1 min

Invalid state transition        → Reject with error         → Log to audit
                                                             → Alert development
```

## Database Trigger Flow

```
UPDATE drivers SET operational_state = 'BUSY' WHERE id = ?
                    │
                    ▼
        ┌───────────────────────┐
        │  log_state_transition │ (TRIGGER)
        │       (BEFORE)         │
        └───────┬───────────────┘
                │
                ├─> Compare OLD.state vs NEW.state
                │
                ├─> Insert into driver_state_transitions
                │   ├─ from_state
                │   ├─ to_state
                │   ├─ location
                │   ├─ timestamp
                │   └─ metadata
                │
                ├─> Update state_history JSONB
                │
                ├─> Set state_changed_at = NOW()
                │
                └─> Set previous_state = OLD.state
                │
                ▼
        Transaction COMMIT
                │
                ▼
        Application receives updated driver
                │
                ▼
        Emit 'state-changed' event
```

## Use This Diagram When...

- **Designing features**: Understand state constraints
- **Debugging issues**: Trace state transitions
- **Training team**: Visual reference for system
- **Planning tests**: Cover all transitions
- **Monitoring**: Understand normal vs abnormal patterns
- **Performance tuning**: Identify bottleneck states

---

**Note:** This is a reference diagram. Actual implementation includes additional validations, error handling, and edge cases not shown here for clarity.
