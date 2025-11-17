/**
 * Vehicle Management API Routes
 * CRUD operations for fleet vehicles
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../middleware/error.middleware');
const { logger } = require('../../utils/logger');
const { standardLimiter } = require('../../middleware/rate-limit.middleware');

// In-memory vehicle storage (replace with database in production)
let vehicles = [
  {
    id: 'VH001',
    name: 'Delivery Van 01',
    type: 'VAN',
    licensePlate: 'ABC-1234',
    capacity: 3000,
    fuelLevel: 85,
    mileage: 45230,
    status: 'active',
    currentDriver: null,
    utilization: 78,
    lastMaintenance: '2025-01-10',
    nextMaintenance: '2025-02-10',
    createdAt: '2024-11-15',
    updatedAt: '2025-01-17',
  },
  {
    id: 'VH002',
    name: 'Cargo Truck 01',
    type: 'TRUCK',
    licensePlate: 'XYZ-5678',
    capacity: 8000,
    fuelLevel: 45,
    mileage: 82910,
    status: 'active',
    currentDriver: 'D001',
    utilization: 92,
    lastMaintenance: '2025-01-08',
    nextMaintenance: '2025-02-08',
    createdAt: '2024-10-20',
    updatedAt: '2025-01-17',
  },
  {
    id: 'VH003',
    name: 'Small Van 01',
    type: 'CAR',
    licensePlate: 'DEF-9012',
    capacity: 1500,
    fuelLevel: 92,
    mileage: 28450,
    status: 'idle',
    currentDriver: null,
    utilization: 45,
    lastMaintenance: '2025-01-12',
    nextMaintenance: '2025-02-12',
    createdAt: '2024-12-01',
    updatedAt: '2025-01-17',
  },
  {
    id: 'VH004',
    name: 'Motorcycle 01',
    type: 'MOTORCYCLE',
    licensePlate: 'MTO-3456',
    capacity: 500,
    fuelLevel: 20,
    mileage: 15230,
    status: 'maintenance',
    currentDriver: null,
    utilization: 0,
    lastMaintenance: '2025-01-14',
    nextMaintenance: '2025-01-20',
    createdAt: '2024-11-25',
    updatedAt: '2025-01-17',
  },
];

/**
 * GET /api/v1/vehicles
 * Get all vehicles with optional filtering
 */
router.get(
  '/',
  standardLimiter,
  asyncHandler(async (req, res) => {
    const { status, type, search } = req.query;

    let filteredVehicles = [...vehicles];

    // Filter by status
    if (status) {
      filteredVehicles = filteredVehicles.filter((v) => v.status === status);
    }

    // Filter by type
    if (type) {
      filteredVehicles = filteredVehicles.filter((v) => v.type === type);
    }

    // Search by name or license plate
    if (search) {
      const searchLower = search.toLowerCase();
      filteredVehicles = filteredVehicles.filter(
        (v) =>
          v.name.toLowerCase().includes(searchLower) ||
          v.licensePlate.toLowerCase().includes(searchLower)
      );
    }

    logger.info('Fetched vehicles', {
      total: filteredVehicles.length,
      status,
      type,
      search,
    });

    res.json({
      success: true,
      data: filteredVehicles,
      count: filteredVehicles.length,
    });
  })
);

/**
 * GET /api/v1/vehicles/:id
 * Get a specific vehicle by ID
 */
router.get(
  '/:id',
  standardLimiter,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const vehicle = vehicles.find((v) => v.id === id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found',
      });
    }

    logger.info('Fetched vehicle', { vehicleId: id });

    res.json({
      success: true,
      data: vehicle,
    });
  })
);

/**
 * POST /api/v1/vehicles
 * Create a new vehicle
 */
router.post(
  '/',
  standardLimiter,
  asyncHandler(async (req, res) => {
    const { name, type, licensePlate, capacity, fuelLevel, mileage } = req.body;

    // Validation
    if (!name || !type || !licensePlate) {
      return res.status(400).json({
        success: false,
        error: 'name, type, and licensePlate are required',
      });
    }

    // Check if license plate already exists
    const existing = vehicles.find((v) => v.licensePlate === licensePlate);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'License plate already exists',
      });
    }

    // Generate ID
    const id = `VH${String(vehicles.length + 1).padStart(3, '0')}`;

    const newVehicle = {
      id,
      name,
      type,
      licensePlate,
      capacity: capacity || 1000,
      fuelLevel: fuelLevel !== undefined ? fuelLevel : 100,
      mileage: mileage || 0,
      status: 'idle',
      currentDriver: null,
      utilization: 0,
      lastMaintenance: new Date().toISOString().split('T')[0],
      nextMaintenance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vehicles.push(newVehicle);

    logger.info('Created vehicle', { vehicleId: id, name });

    res.status(201).json({
      success: true,
      data: newVehicle,
      message: 'Vehicle created successfully',
    });
  })
);

/**
 * PUT /api/v1/vehicles/:id
 * Update a vehicle
 */
router.put(
  '/:id',
  standardLimiter,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const index = vehicles.findIndex((v) => v.id === id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found',
      });
    }

    // If updating license plate, check for duplicates
    if (updates.licensePlate && updates.licensePlate !== vehicles[index].licensePlate) {
      const existing = vehicles.find((v) => v.licensePlate === updates.licensePlate);
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'License plate already exists',
        });
      }
    }

    // Update vehicle
    vehicles[index] = {
      ...vehicles[index],
      ...updates,
      id, // Prevent ID change
      updatedAt: new Date().toISOString(),
    };

    logger.info('Updated vehicle', { vehicleId: id });

    res.json({
      success: true,
      data: vehicles[index],
      message: 'Vehicle updated successfully',
    });
  })
);

/**
 * DELETE /api/v1/vehicles/:id
 * Delete a vehicle
 */
router.delete(
  '/:id',
  standardLimiter,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const index = vehicles.findIndex((v) => v.id === id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found',
      });
    }

    const deletedVehicle = vehicles.splice(index, 1)[0];

    logger.info('Deleted vehicle', { vehicleId: id });

    res.json({
      success: true,
      data: deletedVehicle,
      message: 'Vehicle deleted successfully',
    });
  })
);

/**
 * GET /api/v1/vehicles/stats/summary
 * Get fleet statistics summary
 */
router.get(
  '/stats/summary',
  standardLimiter,
  asyncHandler(async (req, res) => {
    const total = vehicles.length;
    const active = vehicles.filter((v) => v.status === 'active').length;
    const idle = vehicles.filter((v) => v.status === 'idle').length;
    const maintenance = vehicles.filter((v) => v.status === 'maintenance').length;
    const offline = vehicles.filter((v) => v.status === 'offline').length;

    const avgUtilization =
      vehicles.reduce((sum, v) => sum + (v.utilization || 0), 0) / (total || 1);

    // Group by type
    const byType = vehicles.reduce((acc, v) => {
      acc[v.type] = (acc[v.type] || 0) + 1;
      return acc;
    }, {});

    logger.info('Fetched fleet statistics');

    res.json({
      success: true,
      data: {
        total,
        active,
        idle,
        maintenance,
        offline,
        avgUtilization: Math.round(avgUtilization * 10) / 10,
        byType,
      },
    });
  })
);

/**
 * GET /api/v1/vehicles/maintenance/schedule
 * Get maintenance schedule
 */
router.get(
  '/maintenance/schedule',
  standardLimiter,
  asyncHandler(async (req, res) => {
    const schedule = vehicles.map((v) => ({
      vehicleId: v.id,
      vehicleName: v.name,
      lastMaintenance: v.lastMaintenance,
      nextMaintenance: v.nextMaintenance,
      status: v.status === 'maintenance' ? 'in_progress' : 'scheduled',
      daysUntilNext: Math.ceil(
        (new Date(v.nextMaintenance).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ),
    }));

    logger.info('Fetched maintenance schedule', { count: schedule.length });

    res.json({
      success: true,
      data: schedule,
    });
  })
);

module.exports = router;
