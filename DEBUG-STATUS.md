# SLA Optimization - Debug Status

**Date:** 2025-11-16 19:30
**Status:** ✅ STOPS ARRAY FIX - All three root causes identified and resolved!

## Update: Final Root Cause Found - Missing Stops Array!

The validation schema fix (commit 8d3d5e6) allowed vehicles to pass through, and the LLM Fleet Advisor was working correctly. However, routes created by the LLM ended up with 0 stops/deliveries after optimization.

### The Real Problem: Optimization Agent Expects `stops` Array

**File:** `backend/src/agents/optimization.agent.js` (line 60)
**Condition:** `if (route && route.stops && route.stops.length > 0)`

The optimization agent ONLY processes routes that have a `route.stops` array. The LLM was creating routes with:
- ✓ `pickupPoints` array
- ✓ `deliveryPoints` array
- ✓ `waypoints` array
- ✗ NO `stops` array!

So routes failed the condition at line 60, fell through to line 157, and were added without enhancement (resulting in 0 stops).

### The Fix (Current Commit)

**File:** `backend/src/services/enhanced-logistics.service.js` (lines 267-290)

Added `stops` array creation when building LLM routes:
```javascript
// CRITICAL: Create stops array for optimization agent
// The optimization agent expects routes to have a 'stops' array (line 60 of optimization.agent.js)
const stops = waypoints.map(wp => ({
  ...wp,
  id: wp.id,
  name: wp.name || wp.address || `Stop ${wp.id}`,
  location: {
    latitude: wp.lat,
    longitude: wp.lng
  },
  lat: wp.lat,
  lng: wp.lng,
  type: wp.type,
  serviceTime: wp.serviceTime || 5
}));

// Create a route with this vehicle's assigned deliveries
return {
  id: `route-${generateId()}`,
  vehicle: vehicle,
  pickupPoints: pickup ? [pickup] : [],
  deliveryPoints: assignedDeliveries,
  waypoints: waypoints,
  stops: stops, // Required for optimization agent to process the route
  llm_assigned: true,
};
```

Now the optimization agent will:
1. Find `route.stops` (condition passes)
2. Process the route with OSRM data
3. Calculate distance, duration, ETA
4. Return enhanced routes with geometry

---

## Summary of All Three Fixes

### Fix 1: Vehicle Extraction Timing (Commit 5ffbd4b)

**Problem:** Vehicles extracted AFTER planning agent was called
**Solution:** Reordered code to extract vehicles BEFORE calling planning agent
**Result:** Planning agent now receives vehicles correctly

### Fix 2: Validation Schema (Commit 8d3d5e6)

**Problem:** Joi validation stripped `vehicles` field because not defined at root level
**Solution:** Added `vehicles` as optional root-level field in schema
**Result:** Vehicles pass through validation

### Fix 3: Missing Stops Array (Current Commit)

**Problem:** LLM routes had no `stops` array, so optimization agent skipped them

The vehicle extraction fix (commit 5ffbd4b) was correct, but vehicles were being stripped BEFORE reaching the enhanced logistics service.

### The Real Problem: Joi Validation Schema

**File:** `backend/src/validation/schemas.js`
**Schema:** `optimizeRequest` (lines 57-141)

The validation schema only allowed vehicles inside `fleet.vehicles` but NOT at the root level:
- ✓ `request.fleet.vehicles` - allowed
- ✗ `request.vehicles` - **NOT DEFINED** → stripped by Joi!

Our demo request uses `request.vehicles` (top-level array), so Joi validation removed it before it reached `processLegacyOptimization()`.

### The Fix (Current Commit)

Added `vehicles` as an optional root-level field in the validation schema:
```javascript
// Support vehicles at root level (for multi-vehicle SLA optimization)
vehicles: Joi.array()
  .items(
    Joi.object({
      id: Joi.string().optional(),
      fleet_id: Joi.string().optional(),
      lat: patterns.coordinates.latitude.optional(),
      lng: patterns.coordinates.longitude.optional(),
      capacity: Joi.number().min(1).optional(),
      // ... other fields
    })
  )
  .optional(),
```

Also added `lat` and `lng` to nested `fleet.vehicles` schema for consistency.

---

## Previous Fix (Commit 5ffbd4b) - Still Valid!

## Problem Identified

The LLM Fleet Advisor (multi-vehicle optimization) is not being triggered because the planning agent only receives 1 vehicle instead of 5.

### Evidence from Logs:
```
Planning with 3 pickups, 23 deliveries, and 0 vehicles
No valid vehicles found in request, creating a default vehicle
Planning with 3 pickups, 23 deliveries, and 1 vehicles
```

### Request Contains:
- `demo-request.json` has 5 vehicles with correct format:
  ```json
  {"id": "vehicle-001", "capacity": 8, "lat": 24.7500, "lng": 46.6500}
  ```

### Vehicle Format Test Results:
Vehicle format is CORRECT and SHOULD pass the planning agent's filter:
```
Vehicle object: { id: 'vehicle-001', capacity: 8, lat: 24.75, lng: 46.65 }
Has id? vehicle-001
Has lat? true
Has lng? true
Would pass filter? true
```

## Debug Findings (Commit: 364a629)

Debug logs revealed the root cause:
```
DEBUG: Vehicle extraction - data.vehicles: undefined not-array
DEBUG: Vehicle extraction - data.fleet: undefined not-array
```

**CRITICAL DISCOVERY:** Both `data.vehicles` and `data.fleet` were **undefined** when planning agent was called!

## The Fix (Commit: 5ffbd4b)

**File:** `backend/src/services/enhanced-logistics.service.js`
**Method:** `processLegacyOptimization()`

**Problem:** In the original code, vehicles were extracted AFTER calling the planning agent:
```javascript
// Line 204: Planning agent called FIRST
const initialPlan = await this.planningAgent.plan(request);

// Line 213: Vehicles extracted AFTER (too late!)
const vehicles = request.fleet?.vehicles || request.fleet || request.vehicles || [];
```

**Solution:** Extract vehicles BEFORE calling planning agent and create proper request structure:
```javascript
// Extract vehicles FIRST (line 205-207)
const vehicles = request.fleet?.vehicles || request.fleet || request.vehicles || [];
const pickupPoints = request.pickupPoints || [];
const deliveryPoints = request.deliveryPoints || [];

// Create properly structured request (line 211-215)
const planningRequest = {
  ...request,
  vehicles: vehicles,  // Direct array
  fleet: request.fleet || { vehicles }  // Nested structure
};

// NOW call planning agent with vehicles (line 220)
const initialPlan = await this.planningAgent.plan(planningRequest);
```

## Deployment Status

**Commit:** 364a629 - "debug: Add vehicle extraction logging to planning agent"
**Pushed:** 2025-11-16 15:24
**Expected Deployment:** ~5 minutes (around 15:29)

## Next Steps

1. **Wait for deployment** to complete (~4 more minutes)
2. **Run demo test** with `./run-demo.sh`
3. **Check logs** for DEBUG messages:
   ```bash
   gcloud run services logs read route-opt-backend \
     --region us-central1 \
     --limit=100 | grep -i "debug"
   ```
4. **Analyze results** to determine:
   - Why vehicles aren't being extracted
   - Where the data transformation is happening
   - What fix is needed

## What's Working

- Environment Variables: `ENABLE_GROQ_OPTIMIZATION=true`, `DISABLE_AUTONOMOUS_AGENTS=false`
- GROQ API Key: Configured in Secret Manager
- GROQ Optimization: Working for delivery sequence optimization
- UI Features: All SLA optimization features implemented and ready
- Demo Files: Complete scenario with request/response templates

## What's Broken

- Vehicle extraction from request in planning agent
- LLM Fleet Advisor not being called (condition not met: needs >1 vehicle)
- Multi-vehicle route creation not happening

## Expected Log Output

After deployment, we should see:
```
DEBUG: Vehicle extraction - data.fleet: ...
DEBUG: Vehicle extraction - data.vehicles: array(5)
DEBUG: First vehicle in data.vehicles: {"id":"vehicle-001",...}
DEBUG: Extracting from data.vehicles array, length: 5
DEBUG: After filter: X/5 vehicles passed
```

This will tell us exactly where the problem is.
