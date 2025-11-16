/**
 * Validation Schemas
 * Joi schemas for request validation
 */

const Joi = require('joi');

// Common patterns
const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  phone: /^\+?[1-9]\d{1,14}$/,
  coordinates: {
    latitude: Joi.number().min(-90).max(90),
    longitude: Joi.number().min(-180).max(180),
  },
};

// Authentication schemas
const schemas = {
  register: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
    password: Joi.string().min(8).pattern(patterns.password).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.required': 'Password is required',
    }),
    name: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name must not exceed 100 characters',
      'any.required': 'Name is required',
    }),
    role: Joi.string()
      .valid('customer', 'driver', 'dispatcher', 'manager', 'admin')
      .default('customer'),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).pattern(patterns.password).required().messages({
      'string.min': 'New password must be at least 8 characters long',
      'string.pattern.base':
        'New password must contain at least one uppercase letter, one lowercase letter, and one number',
    }),
  }),

  // Optimization request schema
  optimizeRequest: Joi.object({
    pickupPoints: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().optional(),
          name: Joi.string().optional(),
          address: Joi.string().optional(),
          lat: patterns.coordinates.latitude.required(),
          lng: patterns.coordinates.longitude.required(),
          timeWindow: Joi.object({
            start: Joi.string().isoDate().optional(),
            end: Joi.string().isoDate().optional(),
          }).optional(),
          priority: Joi.number().min(1).max(10).default(5),
          serviceTime: Joi.number().min(0).default(5),
        })
      )
      .min(1)
      .required()
      .messages({
        'array.min': 'At least one pickup point is required',
      }),
    deliveryPoints: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().optional(),
          name: Joi.string().optional(),
          address: Joi.string().optional(),
          lat: patterns.coordinates.latitude.required(),
          lng: patterns.coordinates.longitude.required(),
          timeWindow: Joi.object({
            start: Joi.string().isoDate().optional(),
            end: Joi.string().isoDate().optional(),
          }).optional(),
          priority: Joi.number().min(1).max(10).default(5),
          serviceTime: Joi.number().min(0).default(5),
        })
      )
      .min(1)
      .required()
      .messages({
        'array.min': 'At least one delivery point is required',
      }),
    fleet: Joi.object({
      vehicleType: Joi.string()
        .valid('car', 'motorcycle', 'bicycle', 'van', 'truck', 'mixed')
        .default('car'),
      count: Joi.number().min(1).default(1),
      capacity: Joi.number().min(1).optional(),
      maxDistance: Joi.number().min(1).optional(),
      maxDuration: Joi.number().min(1).optional(),
      costPerKm: Joi.number().min(0).optional(),
      costPerHour: Joi.number().min(0).optional(),
      vehicles: Joi.array()
        .items(
          Joi.object({
            id: Joi.string().optional(),
            name: Joi.string().optional(),
            type: Joi.string().valid('car', 'motorcycle', 'bicycle', 'van', 'truck').optional(),
            capacity: Joi.number().min(1).optional(),
            capacity_kg: Joi.number().min(1).optional(),
            lat: patterns.coordinates.latitude.optional(),
            lng: patterns.coordinates.longitude.optional(),
            startLocation: Joi.object({
              latitude: patterns.coordinates.latitude.optional(),
              longitude: patterns.coordinates.longitude.optional(),
            }).optional(),
          })
        )
        .optional(),
    }).optional(),
    // Support vehicles at root level (for multi-vehicle SLA optimization)
    vehicles: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().optional(),
          fleet_id: Joi.string().optional(),
          name: Joi.string().optional(),
          type: Joi.string().valid('car', 'motorcycle', 'bicycle', 'van', 'truck').optional(),
          capacity: Joi.number().min(1).optional(),
          capacity_kg: Joi.number().min(1).optional(),
          lat: patterns.coordinates.latitude.optional(),
          lng: patterns.coordinates.longitude.optional(),
          startLocation: Joi.object({
            latitude: patterns.coordinates.latitude.optional(),
            longitude: patterns.coordinates.longitude.optional(),
          }).optional(),
        })
      )
      .optional(),
    options: Joi.object({
      optimizationMode: Joi.string()
        .valid('fastest', 'shortest', 'balanced', 'distance', 'time', 'priority')
        .default('balanced'),
      avoidTolls: Joi.boolean().default(false),
      avoidHighways: Joi.boolean().default(false),
      trafficModel: Joi.string()
        .valid('best_guess', 'pessimistic', 'optimistic')
        .default('best_guess'),
      clusteringEnabled: Joi.boolean().default(false),
      balanceWorkload: Joi.boolean().default(false),
      respectTimeWindows: Joi.boolean().default(false),
      minimizeCost: Joi.boolean().default(false),
      priorityWeighting: Joi.number().min(0).max(1).default(0.5),
    }).optional(),
  }),

  // Order assignment schema
  orderAssignment: Joi.object({
    order: Joi.object({
      id: Joi.string().required(),
      serviceType: Joi.string().valid('BARQ', 'BULLET').required(),
      pickup: Joi.object({
        lat: patterns.coordinates.latitude.required(),
        lng: patterns.coordinates.longitude.required(),
        address: Joi.string().required(),
      }).required(),
      delivery: Joi.object({
        lat: patterns.coordinates.latitude.required(),
        lng: patterns.coordinates.longitude.required(),
        address: Joi.string().required(),
      }).required(),
      priority: Joi.number().min(1).max(10).default(5),
      scheduledPickupTime: Joi.string().isoDate().optional(),
    }).required(),
  }),

  // Batch optimization schema
  batchOptimization: Joi.object({
    orders: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().required(),
          pickup: Joi.object({
            lat: patterns.coordinates.latitude.required(),
            lng: patterns.coordinates.longitude.required(),
          }).required(),
          delivery: Joi.object({
            lat: patterns.coordinates.latitude.required(),
            lng: patterns.coordinates.longitude.required(),
          }).required(),
          priority: Joi.number().min(1).max(10).default(5),
        })
      )
      .min(1)
      .required()
      .messages({
        'array.min': 'At least one order is required',
      }),
    serviceType: Joi.string().valid('BARQ', 'BULLET').default('BULLET'),
  }),

  // Emergency escalation schema
  emergencyEscalation: Joi.object({
    type: Joi.string()
      .valid('SLA_CRITICAL', 'DRIVER_EMERGENCY', 'SYSTEM_FAILURE', 'MAJOR_INCIDENT')
      .required(),
    level: Joi.string().valid('L1', 'L2', 'L3', 'L4').required(),
    context: Joi.object().optional(),
  }),

  // Order recovery schema
  orderRecovery: Joi.object({
    orderId: Joi.string().required(),
    reason: Joi.string().max(500).optional(),
  }),

  // Agent execution schema
  agentExecution: Joi.object({
    context: Joi.object().optional(),
  }),

  // Orchestration event schema
  orchestrationEvent: Joi.object({
    event: Joi.object({
      type: Joi.string().required(),
      data: Joi.object().optional(),
    }).required(),
  }),

  // Autonomous mode toggle schema
  autonomousMode: Joi.object({
    enabled: Joi.boolean().required(),
  }),

  // Approval action schema
  approvalAction: Joi.object({
    approvedBy: Joi.string().required(),
  }),

  rejectionAction: Joi.object({
    rejectedBy: Joi.string().required(),
    reason: Joi.string().min(10).max(500).required(),
  }),

  // Pagination schema
  pagination: Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
  }),

  // Date range schema
  dateRange: Joi.object({
    startDate: Joi.string().isoDate().optional(),
    endDate: Joi.string().isoDate().optional(),
  }),

  // ID parameter schema
  idParam: Joi.object({
    id: Joi.string().required(),
  }),
};

module.exports = schemas;
