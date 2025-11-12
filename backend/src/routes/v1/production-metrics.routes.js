/**
 * Production Metrics Routes
 * Endpoints using production-tested queries from BARQ Fleet
 */

const express = require('express');
const router = express.Router();
const ProductionMetricsService = require('../../services/production-metrics.service');
const SLACalculatorService = require('../../services/sla-calculator.service');
const pool = require('../../services/postgres.service');
const logger = require('../../utils/logger');
const { paginationMiddleware, generatePaginationMeta } = require('../../middleware/pagination.middleware');
const { executeMetricsQuery, TIMEOUT_CONFIG } = require('../../utils/query-timeout');

// Apply pagination middleware to all routes
router.use(paginationMiddleware);

/**
 * Helper function to get date range from query params
 * Default to 6 hours (0.25 days) for performance with production data volume
 * GROUP BY queries must scan ALL matching rows before LIMIT applies
 */
function getDateRange(req) {
  const { days = 0.25, start_date, end_date } = req.query;

  if (start_date && end_date) {
    return {
      startDate: new Date(start_date),
      endDate: new Date(end_date),
    };
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));

  return { startDate, endDate };
}

/**
 * GET /api/v1/production-metrics/on-time-delivery
 * Get on-time delivery rate
 */
router.get('/on-time-delivery', async (req, res) => {
  try {
    const { startDate, endDate } = getDateRange(req);
    const metrics = await ProductionMetricsService.getOnTimeDeliveryRate(startDate, endDate);

    res.json({
      success: true,
      period: { start: startDate, end: endDate },
      metrics,
    });
  } catch (error) {
    logger.error('Error getting on-time delivery rate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get on-time delivery rate',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/production-metrics/completion-rate
 * Get order completion rate
 */
router.get('/completion-rate', async (req, res) => {
  try {
    const { startDate, endDate } = getDateRange(req);
    const metrics = await ProductionMetricsService.getOrderCompletionRate(startDate, endDate);

    res.json({
      success: true,
      period: { start: startDate, end: endDate },
      metrics,
    });
  } catch (error) {
    logger.error('Error getting completion rate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get completion rate',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/production-metrics/delivery-time
 * Get average delivery time
 */
router.get('/delivery-time', async (req, res) => {
  try {
    const { startDate, endDate } = getDateRange(req);
    const metrics = await ProductionMetricsService.getAverageDeliveryTime(startDate, endDate);

    res.json({
      success: true,
      period: { start: startDate, end: endDate },
      metrics,
    });
  } catch (error) {
    logger.error('Error getting delivery time:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get delivery time',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/production-metrics/courier-performance
 * Get courier performance rankings
 * Query params: limit, offset, page, days, start_date, end_date
 */
router.get('/courier-performance', async (req, res) => {
  try {
    const { startDate, endDate } = getDateRange(req);
    const { limit, offset } = req.pagination;

    const result = await ProductionMetricsService.getCourierPerformance(
      startDate,
      endDate,
      limit,
      offset
    );

    const meta = generatePaginationMeta(result.total, limit, offset, req.pagination.page);

    res.json({
      success: true,
      period: { start: startDate, end: endDate },
      couriers: result.data,
      ...meta,
    });
  } catch (error) {
    logger.error('Error getting courier performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get courier performance',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/production-metrics/cancellation-rate
 * Get cancellation rate
 */
router.get('/cancellation-rate', async (req, res) => {
  try {
    const { startDate, endDate } = getDateRange(req);
    const metrics = await ProductionMetricsService.getCancellationRate(startDate, endDate);

    res.json({
      success: true,
      period: { start: startDate, end: endDate },
      metrics,
    });
  } catch (error) {
    logger.error('Error getting cancellation rate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cancellation rate',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/production-metrics/return-rate
 * Get return rate
 */
router.get('/return-rate', async (req, res) => {
  try {
    const { startDate, endDate } = getDateRange(req);
    const metrics = await ProductionMetricsService.getReturnRate(startDate, endDate);

    res.json({
      success: true,
      period: { start: startDate, end: endDate },
      metrics,
    });
  } catch (error) {
    logger.error('Error getting return rate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get return rate',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/production-metrics/fleet-utilization
 * Get fleet utilization metrics
 */
router.get('/fleet-utilization', async (req, res) => {
  try {
    const { startDate, endDate } = getDateRange(req);

    const [activeCouriers, deliveriesPerCourier] = await Promise.all([
      ProductionMetricsService.getActiveCouriers(startDate, endDate),
      ProductionMetricsService.getDeliveriesPerCourier(startDate, endDate),
    ]);

    res.json({
      success: true,
      period: { start: startDate, end: endDate },
      metrics: {
        ...activeCouriers,
        ...deliveriesPerCourier,
      },
    });
  } catch (error) {
    logger.error('Error getting fleet utilization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get fleet utilization',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/production-metrics/order-distribution
 * Get order status distribution
 * Query params: limit, offset, page, days, start_date, end_date
 */
router.get('/order-distribution', async (req, res) => {
  try {
    const { startDate, endDate } = getDateRange(req);
    const { limit, offset } = req.pagination;

    const result = await ProductionMetricsService.getOrderStatusDistribution(
      startDate,
      endDate,
      limit,
      offset
    );

    const meta = generatePaginationMeta(result.total, limit, offset, req.pagination.page);

    res.json({
      success: true,
      period: { start: startDate, end: endDate },
      distribution: result.data,
      ...meta,
    });
  } catch (error) {
    logger.error('Error getting order distribution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get order distribution',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/production-metrics/comprehensive
 * Get all metrics in one call
 */
router.get('/comprehensive', async (req, res) => {
  try {
    const { startDate, endDate } = getDateRange(req);
    const dashboard = await ProductionMetricsService.getComprehensiveDashboard(startDate, endDate);

    res.json({
      success: true,
      ...dashboard,
    });
  } catch (error) {
    logger.error('Error getting comprehensive dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get comprehensive dashboard',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/production-metrics/sla/at-risk
 * Get orders at risk of SLA breach
 * Query params: limit, offset, page
 */
router.get('/sla/at-risk', async (req, res) => {
  try {
    const { limit, offset } = req.pagination;

    // Get active orders from last 24 hours with pagination
    const query = `
      SELECT *
      FROM orders
      WHERE status IN ('pending', 'assigned', 'picked_up', 'in_transit')
        AND created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at ASC
      LIMIT $1 OFFSET $2
    `;

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM orders
      WHERE status IN ('pending', 'assigned', 'picked_up', 'in_transit')
        AND created_at >= NOW() - INTERVAL '24 hours'
    `;

    const [result, countResult] = await Promise.all([
      executeMetricsQuery(pool, query, [limit, offset], {
        timeout: TIMEOUT_CONFIG.METRICS,
      }),
      executeMetricsQuery(pool, countQuery, [], {
        timeout: TIMEOUT_CONFIG.SIMPLE,
      }),
    ]);

    const atRiskOrders = SLACalculatorService.getOrdersAtRisk(result.rows);
    const total = parseInt(countResult.rows[0].total) || 0;

    const summary = {
      total_at_risk: atRiskOrders.length,
      critical: atRiskOrders.filter((o) => o.sla.urgency === 'critical').length,
      high: atRiskOrders.filter((o) => o.sla.urgency === 'high').length,
      medium: atRiskOrders.filter((o) => o.sla.urgency === 'medium').length,
      breached: atRiskOrders.filter((o) => o.sla.is_breached).length,
    };

    const meta = generatePaginationMeta(total, limit, offset, req.pagination.page);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
      orders: atRiskOrders,
      ...meta,
    });
  } catch (error) {
    logger.error('Error getting at-risk orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get at-risk orders',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/production-metrics/sla/compliance
 * Get SLA compliance metrics
 * Query params: limit, offset, page, days, start_date, end_date
 */
router.get('/sla/compliance', async (req, res) => {
  try {
    const { startDate, endDate } = getDateRange(req);
    const { limit, offset } = req.pagination;

    // Get completed orders with pagination
    const query = `
      SELECT *
      FROM orders
      WHERE status = 'delivered'
        AND delivered_at IS NOT NULL
        AND created_at BETWEEN $1 AND $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM orders
      WHERE status = 'delivered'
        AND delivered_at IS NOT NULL
        AND created_at BETWEEN $1 AND $2
    `;

    const [result, countResult] = await Promise.all([
      executeMetricsQuery(pool, query, [startDate, endDate, limit, offset], {
        timeout: TIMEOUT_CONFIG.METRICS,
      }),
      executeMetricsQuery(pool, countQuery, [startDate, endDate], {
        timeout: TIMEOUT_CONFIG.SIMPLE,
      }),
    ]);

    const complianceMetrics = SLACalculatorService.calculateComplianceMetrics(result.rows);
    const summaryByServiceType = SLACalculatorService.getSLASummaryByServiceType(result.rows);
    const total = parseInt(countResult.rows[0].total) || 0;

    const meta = generatePaginationMeta(total, limit, offset, req.pagination.page);

    res.json({
      success: true,
      period: { start: startDate, end: endDate },
      overall: complianceMetrics,
      by_service_type: summaryByServiceType,
      ...meta,
    });
  } catch (error) {
    logger.error('Error getting SLA compliance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get SLA compliance',
      message: error.message,
    });
  }
});

module.exports = router;
