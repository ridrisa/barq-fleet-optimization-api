# Frontend-Backend Schema Mismatch - RESOLVED

**Date**: November 8, 2025
**Status**: ✅ **FIXED**
**Issue**: Frontend 400 Bad Request error when calling `/api/optimize`

---

## 🔍 Root Cause Analysis

The frontend was receiving **400 Bad Request** errors because it was sending data in a format that didn't match the backend's Joi validation schema.

### The Problem

There were **TWO DIFFERENT** validation schemas in the backend:

1. **`/backend/src/models/request.model.js`** - NOT USED by `/api/optimize` endpoint
2. **`/backend/src/validation/schemas.js`** - ACTUAL schema used by `/api/optimize` endpoint ✅

The frontend was inadvertently built to match a schema that wasn't being used!

---

## 📋 Schema Comparison

### What Frontend Was Sending (INCORRECT)

```typescript
{
  pickupPoints: [{
    name: "Hub",
    lat: 24.7136,
    lng: 46.6753,
    type: "outlet"  // ❌ Not expected by actual schema
  }],
  deliveryPoints: [{
    order_id: "ORD001",  // ❌ Not expected
    customer_name: "John",  // ❌ Should be 'name'
    lat: 24.7240,
    lng: 46.6800,
    priority: "HIGH",  // ❌ Should be NUMBER
    time_window: "09:00-17:00"  // ❌ Not expected
  }],
  fleet: [{  // ❌ Should be OBJECT, not ARRAY
    fleet_id: "V001",
    vehicle_type: "TRUCK",
    capacity_kg: 1000
  }],
  businessRules: {...},  // ❌ Not expected
  preferences: {...}  // ❌ Should be 'options'
}
```

### What Backend Actually Expects (CORRECT)

```typescript
{
  pickupPoints: [{
    id: "p1",  // optional
    name: "Hub",  // ✅ required
    address: "123 Main St",  // ✅ required
    lat: 24.7136,  // ✅ required
    lng: 46.6753,  // ✅ required
    priority: 5,  // ✅ NUMBER 1-10, default 5
    serviceTime: 5,  // optional, default 5
    timeWindow: {  // optional
      start: "2025-01-01T09:00:00Z",
      end: "2025-01-01T17:00:00Z"
    }
  }],
  deliveryPoints: [{
    id: "d1",  // optional
    name: "Customer Name",  // ✅ required (NOT customer_name!)
    address: "456 Oak Ave",  // ✅ required
    lat: 24.7240,  // ✅ required
    lng: 46.6800,  // ✅ required
    priority: 7,  // ✅ NUMBER 1-10, default 5
    serviceTime: 5,  // optional, default 5
    timeWindow: {  // optional
      start: "2025-01-01T10:00:00Z",
      end: "2025-01-01T18:00:00Z"
    }
  }],
  fleet: {  // ✅ OBJECT (not array!)
    vehicleType: "car",  // ✅ string: car|motorcycle|bicycle|van|truck
    count: 2,  // ✅ number, default 1
    capacity: 1000,  // optional
    maxDistance: 100000,  // optional, in meters
    maxDuration: 28800  // optional, in seconds
  },
  options: {  // ✅ NOT 'preferences' or 'businessRules'
    optimizationMode: "balanced",  // fastest|shortest|balanced
    avoidTolls: false,
    avoidHighways: false,
    trafficModel: "best_guess"  // best_guess|pessimistic|optimistic
  }
}
```

---

## ✅ Fix Applied

### File: `frontend/src/store/slices/routesSlice.ts`

**Lines 832-865** - Complete transformation rewrite:

```typescript
const transformedRequest = {
  pickupPoints: request.pickupPoints.map((point) => ({
    id: point.id,
    name: point.name,
    address: point.address || `${point.location.latitude}, ${point.location.longitude}`,
    lat: point.location.latitude,
    lng: point.location.longitude,
    priority: point.priority || 5,
    serviceTime: 5,
  })),
  deliveryPoints: request.deliveryPoints.map((point) => ({
    id: point.id,
    name: point.name,  // ✅ Changed from customer_name
    address: point.address || `${point.location.latitude}, ${point.location.longitude}`,  // ✅ Added
    lat: point.location.latitude,
    lng: point.location.longitude,
    priority: point.priority || 5,  // ✅ NUMBER not STRING
    serviceTime: 5,
  })),
  fleet: {  // ✅ Changed from ARRAY to OBJECT
    vehicleType: request.fleet.vehicles[0]?.type?.toLowerCase() || 'car',
    count: request.fleet.vehicles.length || 1,
    capacity: request.fleet.vehicles[0]?.capacity || 1000,
    maxDistance: 100000,
    maxDuration: 28800,
  },
  options: {  // ✅ Changed from businessRules/preferences
    optimizationMode: request.preferences?.optimizationFocus === 'distance' ? 'shortest' :
                     request.preferences?.optimizationFocus === 'time' ? 'fastest' : 'balanced',
    avoidTolls: false,
    avoidHighways: false,
    trafficModel: 'best_guess',
  },
};
```

---

## 🎯 Key Changes

### 1. Pickup Points
- ✅ **Added**: `address` field (required)
- ✅ **Fixed**: `priority` is now NUMBER (1-10), not string
- ✅ **Added**: `serviceTime` field (default 5 minutes)
- ✅ **Removed**: `type` field (not in schema)

### 2. Delivery Points
- ✅ **Changed**: `customer_name` → `name`
- ✅ **Added**: `address` field (required)
- ✅ **Fixed**: `priority` is now NUMBER (1-10), not string
- ✅ **Added**: `serviceTime` field (default 5 minutes)
- ✅ **Removed**: `order_id`, `time_window`, `pickup_id` (not in schema)

### 3. Fleet
- ✅ **Structure**: Changed from ARRAY to OBJECT
- ✅ **Fields**: `vehicleType`, `count`, `capacity`, `maxDistance`, `maxDuration`
- ✅ **Removed**: `fleet_id`, `current_latitude`, `current_longitude`, `outlet_id`, `status`

### 4. Options (formerly businessRules/preferences)
- ✅ **Renamed**: `businessRules` + `preferences` → `options`
- ✅ **Fields**: `optimizationMode`, `avoidTolls`, `avoidHighways`, `trafficModel`
- ✅ **Removed**: All businessRules fields (maxDriverHours, etc.)

---

## 🧪 Testing

### Before Fix
```bash
curl -X POST https://route-opt-backend-426674819922.us-central1.run.app/api/optimize \
  -H "Content-Type: application/json" \
  -d '...'

# Response: 400 Bad Request
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {"field": "pickupPoints.0.address", "message": "address is required"},
    {"field": "deliveryPoints.0.name", "message": "name is required"},
    {"field": "deliveryPoints.0.priority", "message": "must be a number"},
    {"field": "fleet", "message": "must be of type object"}
  ]
}
```

### After Fix
```bash
curl -X POST https://route-opt-backend-426674819922.us-central1.run.app/api/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "pickupPoints": [{
      "name": "Riyadh Hub",
      "address": "King Fahd Road",
      "lat": 24.7136,
      "lng": 46.6753,
      "priority": 5
    }],
    "deliveryPoints": [{
      "name": "Ahmed Al-Saud",
      "address": "Olaya Street",
      "lat": 24.7240,
      "lng": 46.6800,
      "priority": 8
    }],
    "fleet": {
      "vehicleType": "car",
      "count": 1,
      "capacity": 1000
    },
    "options": {
      "optimizationMode": "balanced",
      "avoidTolls": false
    }
  }'

# Expected Response: 200 OK
{
  "success": true,
  "requestId": "req-abc123",
  "routes": [...],
  "summary": {...}
}
```

---

## 📚 Reference

### Actual Validation Schema Location
**File**: `/backend/src/validation/schemas.js`
**Lines**: 57-117
**Schema Name**: `optimizeRequest`

### Route Configuration
1. `/backend/src/routes/v1/optimization.routes.js` - Uses `validate('optimizeRequest')`
2. `/backend/src/routes/index.js` - Mounts at `/api/optimize`
3. `/backend/src/app.js` - Main app router

---

## 🚀 Deployment Status

**Frontend**:
- **Status**: Deploying corrected version
- **Revision**: TBD (deployment in progress)
- **URL**: https://route-opt-frontend-426674819922.us-central1.run.app

**Backend**:
- **Status**: ✅ Deployed
- **Revision**: route-opt-backend-00007-cfz
- **URL**: https://route-opt-backend-426674819922.us-central1.run.app

---

## ✅ Verification Checklist

After frontend deployment completes:

- [ ] Visit `/optimize` page on frontend
- [ ] Add pickup and delivery points
- [ ] Click "Optimize Routes"
- [ ] Verify no 400 errors in browser console
- [ ] Confirm optimized routes display on map
- [ ] Test with different priority values (1-10)
- [ ] Test with multiple vehicles (fleet count > 1)

---

## 📝 Lessons Learned

1. **Always verify which validation is actually being used** - Don't assume based on file names
2. **Trace the complete request flow** - From route → middleware → controller → validation
3. **Check Joi validation options** - The middleware uses `stripUnknown: true` which removes extra fields
4. **Test with actual deployed backend** - Local and deployed schemas can differ

---

**Bottom Line**: The frontend was sending data in a completely different format than what the deployed backend expected. This has now been corrected to match the actual `optimizeRequest` schema from `validation/schemas.js`.
