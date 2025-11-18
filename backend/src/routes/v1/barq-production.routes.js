/**
 * BarqFleet Production Data Routes
 *
 * API endpoints for accessing real production data from BarqFleet database.
 * This provides the data source for route optimization, fleet management,
 * and autonomous operations.
 */

const express = require('express');
const router = express.Router();
const barqProductionDB = require('../../services/barqfleet-production.service');
const { logger } = require('../../utils/logger');

/**
 * @route GET /api/v1/barq-production/test-connection
 * @desc Test connection to BarqFleet production database
 * @access Public
 */
router.get('/test-connection', async (req, res) => {
  try {
    const result = await barqProductionDB.testConnection();

    res.json({
      success: result.success,
      timestamp: result.timestamp,
      message: result.success
        ? 'Successfully connected to BarqFleet production database'
        : 'Failed to connect to BarqFleet production database',
      error: result.error,
    });
  } catch (error) {
    logger.error('Error testing production database connection', {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/v1/barq-production/statistics
 * @desc Get overall database statistics
 * @access Public
 */
router.get('/statistics', async (req, res) => {
  try {
    const stats = await barqProductionDB.getStatistics();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching statistics', {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/v1/barq-production/hubs
 * @desc Get hubs (pickup locations)
 * @access Public
 */
router.get('/hubs', async (req, res) => {
  try {
    const filters = {
      is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
      city_id: req.query.city_id ? parseInt(req.query.city_id) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : 100,
    };

    // Remove undefined values
    Object.keys(filters).forEach((key) => filters[key] === undefined && delete filters[key]);

    const hubs = await barqProductionDB.getHubs(filters);

    res.json({
      success: true,
      count: hubs.length,
      data: hubs,
    });
  } catch (error) {
    logger.error('Error fetching hubs', {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/v1/barq-production/couriers
 * @desc Get couriers (delivery personnel)
 * @access Public
 */
router.get('/couriers', async (req, res) => {
  try {
    const filters = {
      is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
      is_online: req.query.is_online === 'true' ? true : req.query.is_online === 'false' ? false : undefined,
      is_banned: req.query.is_banned === 'true' ? true : req.query.is_banned === 'false' ? false : undefined,
      city_id: req.query.city_id ? parseInt(req.query.city_id) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : 100,
    };

    // Remove undefined values
    Object.keys(filters).forEach((key) => filters[key] === undefined && delete filters[key]);

    const couriers = await barqProductionDB.getCouriers(filters);

    res.json({
      success: true,
      count: couriers.length,
      data: couriers,
    });
  } catch (error) {
    logger.error('Error fetching couriers', {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/v1/barq-production/couriers/available
 * @desc Get available couriers (online, not busy, not banned)
 * @access Public
 */
router.get('/couriers/available', async (req, res) => {
  try {
    const cityId = req.query.city_id ? parseInt(req.query.city_id) : null;
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;

    const couriers = await barqProductionDB.getAvailableCouriers(cityId, limit);

    res.json({
      success: true,
      count: couriers.length,
      data: couriers,
    });
  } catch (error) {
    logger.error('Error fetching available couriers', {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/v1/barq-production/orders
 * @desc Get orders
 * @access Public
 */
router.get('/orders', async (req, res) => {
  try {
    const filters = {
      order_status: req.query.order_status,
      hub_id: req.query.hub_id ? parseInt(req.query.hub_id) : undefined,
      merchant_id: req.query.merchant_id ? parseInt(req.query.merchant_id) : undefined,
      created_after: req.query.created_after,
      created_before: req.query.created_before,
      limit: req.query.limit ? parseInt(req.query.limit) : 100,
    };

    // Remove undefined values
    Object.keys(filters).forEach((key) => filters[key] === undefined && delete filters[key]);

    const orders = await barqProductionDB.getOrders(filters);

    res.json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    logger.error('Error fetching orders', {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/v1/barq-production/orders/pending
 * @desc Get pending orders that need assignment
 * @access Public
 */
router.get('/orders/pending', async (req, res) => {
  try {
    const hubId = req.query.hub_id ? parseInt(req.query.hub_id) : null;
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;

    const orders = await barqProductionDB.getPendingOrders(hubId, limit);

    res.json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    logger.error('Error fetching pending orders', {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/v1/barq-production/shipments
 * @desc Get shipments (bundled orders assigned to couriers)
 * @access Public
 */
router.get('/shipments', async (req, res) => {
  try {
    const filters = {
      is_completed:
        req.query.is_completed === 'true' ? true : req.query.is_completed === 'false' ? false : undefined,
      is_assigned: req.query.is_assigned === 'true' ? true : req.query.is_assigned === 'false' ? false : undefined,
      courier_id: req.query.courier_id ? parseInt(req.query.courier_id) : undefined,
      hub_id: req.query.hub_id ? parseInt(req.query.hub_id) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : 100,
    };

    // Remove undefined values
    Object.keys(filters).forEach((key) => filters[key] === undefined && delete filters[key]);

    const shipments = await barqProductionDB.getShipments(filters);

    res.json({
      success: true,
      count: shipments.length,
      data: shipments,
    });
  } catch (error) {
    logger.error('Error fetching shipments', {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/v1/barq-production/shipments/active
 * @desc Get active shipments (assigned but not completed)
 * @access Public
 */
router.get('/shipments/active', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;

    const shipments = await barqProductionDB.getActiveShipments(limit);

    res.json({
      success: true,
      count: shipments.length,
      data: shipments,
    });
  } catch (error) {
    logger.error('Error fetching active shipments', {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/v1/barq-production/order-logs
 * @desc Get order logs (status change history)
 * @access Public
 */
router.get('/order-logs', async (req, res) => {
  try {
    const filters = {
      order_id: req.query.order_id ? parseInt(req.query.order_id) : undefined,
      created_after: req.query.created_after,
      limit: req.query.limit ? parseInt(req.query.limit) : 100,
    };

    // Remove undefined values
    Object.keys(filters).forEach((key) => filters[key] === undefined && delete filters[key]);

    const logs = await barqProductionDB.getOrderLogs(filters);

    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    logger.error('Error fetching order logs', {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
