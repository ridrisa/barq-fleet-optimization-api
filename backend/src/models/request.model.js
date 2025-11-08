/**
 * Request Model
 * Data validation schema for API requests
 */

const Joi = require('joi');

// Schema for time windows ("HH:MM-HH:MM" format)
const timeWindowSchema = Joi.string()
  .pattern(/^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/)
  .default('09:00-17:00');

// Schema for working hours by day
const workingHoursSchema = Joi.object({
  sun: Joi.alternatives().try(timeWindowSchema, Joi.string().valid('closed')),
  mon: Joi.alternatives().try(timeWindowSchema, Joi.string().valid('closed')),
  tue: Joi.alternatives().try(timeWindowSchema, Joi.string().valid('closed')),
  wed: Joi.alternatives().try(timeWindowSchema, Joi.string().valid('closed')),
  thu: Joi.alternatives().try(timeWindowSchema, Joi.string().valid('closed')),
  fri: Joi.alternatives().try(timeWindowSchema, Joi.string().valid('closed')),
  sat: Joi.alternatives().try(timeWindowSchema, Joi.string().valid('closed')),
}).default({
  sun: '09:00-17:00',
  mon: '09:00-17:00',
  tue: '09:00-17:00',
  wed: '09:00-17:00',
  thu: '09:00-17:00',
  fri: '09:00-17:00',
  sat: '09:00-17:00',
});

// Schema for a pickup point
const pickupPointSchema = Joi.object({
  lat: Joi.number().required().min(-90).max(90),
  lng: Joi.number().required().min(-180).max(180),
  type: Joi.string().valid('outlet', 'warehouse', 'hub', 'depot', 'store').default('outlet'),
  name: Joi.string().max(100).required(),
  working_hours: workingHoursSchema,
});

// Schema for a delivery point
const deliveryPointSchema = Joi.object({
  lat: Joi.number().required().min(-90).max(90),
  lng: Joi.number().required().min(-180).max(180),
  type: Joi.string().valid('delivery', 'pickup').default('delivery'),
  order_id: Joi.string().required().max(50),
  customer_name: Joi.string().max(100).required(),
  load_kg: Joi.number().min(0).max(10000).default(0),
  time_window: timeWindowSchema,
  priority: Joi.string().valid('HIGH', 'MEDIUM', 'LOW').default('MEDIUM'),
});

// Schema for a vehicle in the fleet
const vehicleSchema = Joi.object({
  fleet_id: Joi.string().required().max(50),
  vehicle_type: Joi.string().valid('TRUCK', 'CAR', 'VAN', 'MOTORCYCLE').default('TRUCK'),
  capacity_kg: Joi.number().min(0).max(50000).required(),
  current_latitude: Joi.number().required().min(-90).max(90),
  current_longitude: Joi.number().required().min(-180).max(180),
  outlet_id: Joi.number().integer().min(1).required(),
  status: Joi.string()
    .valid('AVAILABLE', 'UNAVAILABLE', 'DELIVERING', 'RETURNING')
    .default('AVAILABLE'),
});

// Schema for area definition (used for both allowed zones and restricted areas)
const areaDefinitionSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  area: Joi.array().items(Joi.array().length(2).items(Joi.number())).min(3).required(),
  timeRestriction: timeWindowSchema.optional(),
});

// Schema for restricted areas - kept for backward compatibility
const restrictedAreaSchema = Joi.object({
  polygon: Joi.array().items(Joi.array().length(2).items(Joi.number())).min(3).required(),
  timeRestriction: timeWindowSchema,
});

// Schema for business rules
const businessRulesSchema = Joi.object({
  maxDriverHours: Joi.number().min(1).max(24).default(8),
  restPeriodMinutes: Joi.number().min(0).max(120).default(30),
  maxConsecutiveDriveTime: Joi.number().min(1).max(12).default(4),
  allowedZones: Joi.array()
    .items(Joi.alternatives().try(Joi.string(), areaDefinitionSchema))
    .default([]),
  restrictedAreas: Joi.array()
    .items(Joi.alternatives().try(restrictedAreaSchema, areaDefinitionSchema))
    .default([]),
});

// Schema for preferences
const preferencesSchema = Joi.object({
  sustainabilityScore: Joi.number().min(0).max(1).default(0.5),
  costScore: Joi.number().min(0).max(1).default(0.5),
  serviceScore: Joi.number().min(0).max(1).default(0.5),
}).default({
  sustainabilityScore: 0.5,
  costScore: 0.5,
  serviceScore: 0.5,
});

// Schema for context
const contextSchema = Joi.object({
  weatherConditions: Joi.string()
    .valid('sunny', 'rainy', 'cloudy', 'snowy', 'normal')
    .default('normal'),
  trafficData: Joi.string().valid('light', 'medium', 'heavy', 'normal').default('normal'),
  specialEvents: Joi.array().items(Joi.string()).default([]),
  historicalData: Joi.boolean().default(false),
}).default({
  weatherConditions: 'normal',
  trafficData: 'normal',
  specialEvents: [],
  historicalData: false,
});

// Main schema for optimization request
const optimizationRequestSchema = Joi.object({
  pickupPoints: Joi.array().items(pickupPointSchema).min(1).required(),
  deliveryPoints: Joi.array().items(deliveryPointSchema).min(1).required(),
  fleet: Joi.array().items(vehicleSchema).min(1).required(),
  businessRules: businessRulesSchema.required(),
  preferences: preferencesSchema,
  context: contextSchema,
  prompt: Joi.string().max(500).optional(),
});

module.exports = {
  optimizationRequestSchema,
};
