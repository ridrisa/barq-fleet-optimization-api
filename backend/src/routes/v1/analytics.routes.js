/**
 * Analytics Routes - v1
 * Real-time SLA analytics and fleet performance data for dashboard
 */

const express = require('express');
const router = express.Router();
const pool = require('../../services/postgres.service');
const { logger } = require('../../utils/logger');

// SLA Targets (in minutes)
const SLA_TARGETS = {
  BARQ: 60, // 1 hour
  BULLET: 240, // 4 hours
  EXPRESS: 30, // 30 minutes
  STANDARD: 120, // 2 hours
};

/**
 * GET /api/v1/analytics/overview
 * Get comprehensive analytics overview
 */
router.get('/overview', async (req, res) => {
  try {
    logger.info('Fetching analytics overview');

    const query = `
      SELECT
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status IN ('pending', 'assigned', 'picked_up') THEN 1 END) as active_orders,
        AVG(CASE WHEN delivered_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (delivered_at - created_at)) / 60 END) as avg_delivery_time,
        COUNT(CASE WHEN delivered_at <= sla_deadline THEN 1 END)::float / NULLIF(COUNT(CASE WHEN delivered_at IS NOT NULL THEN 1 END), 0) * 100 as sla_compliance_rate
      FROM orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    `;

    const { rows } = await pool.query(query);
    const overview = rows[0];

    res.json({
      success: true,
      data: {
        total_orders: parseInt(overview.total_orders) || 0,
        completed_orders: parseInt(overview.completed_orders) || 0,
        active_orders: parseInt(overview.active_orders) || 0,
        avg_delivery_time_minutes: parseFloat(overview.avg_delivery_time) || 0,
        sla_compliance_rate: parseFloat(overview.sla_compliance_rate) || 0,
        period: '30 days',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching analytics overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics overview',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/analytics/sla/daily
 * Get daily SLA metrics
 */
router.get('/sla/daily', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    logger.info(`Fetching daily SLA metrics for last ${days} days`);

    const query = `
      SELECT
        DATE(delivered_at) as date,
        COUNT(*) as total_deliveries,
        COUNT(CASE WHEN delivered_at <= sla_deadline THEN 1 END) as on_time_deliveries,
        (COUNT(CASE WHEN delivered_at <= sla_deadline THEN 1 END)::float / COUNT(*) * 100) as compliance_rate
      FROM orders
      WHERE delivered_at IS NOT NULL
      AND delivered_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(delivered_at)
      ORDER BY date DESC
    `;

    const { rows } = await pool.query(query);

    res.json({
      success: true,
      data: rows.map(row => ({
        date: row.date,
        total_deliveries: parseInt(row.total_deliveries),
        on_time_deliveries: parseInt(row.on_time_deliveries),
        compliance_rate: parseFloat(row.compliance_rate),
      })),
      period_days: parseInt(days),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching daily SLA metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch daily SLA metrics',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/analytics/fleet/utilization
 * Get fleet utilization metrics
 */
router.get('/fleet/utilization', async (req, res) => {
  try {
    const { period = 'weekly' } = req.query;
    logger.info(`Fetching fleet utilization (${period})`);

    let days = period === 'weekly' ? 7 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const query = `
      WITH fleet_metrics AS (
        SELECT
          COUNT(DISTINCT d.id) as total_drivers,
          COUNT(DISTINCT CASE WHEN o.driver_id IS NOT NULL THEN d.id END) as active_drivers,
          COUNT(DISTINCT d.vehicle_type) as vehicle_types_in_use,
          COUNT(o.id) as total_trips
        FROM drivers d
        LEFT JOIN orders o ON o.driver_id = d.id AND o.created_at >= $1
        WHERE d.is_active = true
      )
      SELECT
        total_drivers,
        active_drivers,
        vehicle_types_in_use,
        total_trips,
        ROUND((active_drivers::numeric / NULLIF(total_drivers, 0) * 100)::numeric, 2) as driver_utilization,
        ROUND((total_trips::numeric / NULLIF(active_drivers, 0))::numeric, 2) as avg_trips_per_driver
      FROM fleet_metrics
    `;

    const { rows } = await pool.query(query, [startDate]);
    const metrics = rows[0] || {
      total_drivers: 0,
      active_drivers: 0,
      vehicle_types_in_use: 0,
      total_trips: 0,
      driver_utilization: 0,
      avg_trips_per_driver: 0,
    };

    res.json({
      success: true,
      data: {
        total_drivers: parseInt(metrics.total_drivers) || 0,
        active_drivers: parseInt(metrics.active_drivers) || 0,
        vehicle_types_in_use: parseInt(metrics.vehicle_types_in_use) || 0,
        total_trips: parseInt(metrics.total_trips) || 0,
        driver_utilization_percent: parseFloat(metrics.driver_utilization) || 0,
        avg_trips_per_driver: parseFloat(metrics.avg_trips_per_driver) || 0,
      },
      period,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching fleet utilization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fleet utilization',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/analytics/sla/realtime
 * Get real-time SLA status for active deliveries
 */
router.get('/sla/realtime', async (req, res) => {
  try {
    logger.info('Fetching real-time SLA status');

    const query = `
      WITH active_deliveries AS (
        SELECT
          o.id,
          o.order_number as tracking_number,
          o.service_type,
          o.created_at,
          o.sla_deadline as promised_delivery_at,
          o.status,
          o.driver_id,
          NULL as hub_id,
          'Main Hub' as hub_name,
          EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60 as elapsed_minutes,
          EXTRACT(EPOCH FROM (o.sla_deadline - NOW())) / 60 as remaining_minutes,
          CASE
            WHEN o.service_type = 'BARQ' THEN 60
            WHEN o.service_type = 'BULLET' THEN 240
            WHEN o.service_type = 'EXPRESS' THEN 30
            WHEN o.service_type = 'STANDARD' THEN 120
            ELSE 60
          END as sla_target_minutes
        FROM orders o
        WHERE o.status IN ('pending', 'assigned', 'picked_up', 'in_transit')
        AND o.created_at >= NOW() - INTERVAL '24 hours'
      )
      SELECT
        service_type,
        COUNT(*) as active_count,
        AVG(elapsed_minutes) as avg_elapsed_minutes,
        COUNT(CASE WHEN remaining_minutes < 15 THEN 1 END) as at_risk_count,
        COUNT(CASE WHEN remaining_minutes < 0 THEN 1 END) as breached_count,
        MIN(remaining_minutes) as min_remaining_minutes,
        MAX(elapsed_minutes) as max_elapsed_minutes
      FROM active_deliveries
      GROUP BY service_type
      ORDER BY service_type
    `;

    const { rows } = await pool.query(query);

    // Get at-risk deliveries details
    const atRiskQuery = `
      SELECT
        o.id,
        o.order_number as tracking_number,
        o.service_type,
        o.status,
        o.driver_id,
        NULL as hub_id,
        'Main Hub' as hub_name,
        EXTRACT(EPOCH FROM (o.sla_deadline - NOW())) / 60 as remaining_minutes,
        EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60 as elapsed_minutes
      FROM orders o
      WHERE o.status IN ('pending', 'assigned', 'picked_up', 'in_transit')
      AND o.sla_deadline - NOW() < INTERVAL '15 minutes'
      ORDER BY remaining_minutes ASC
      LIMIT 20
    `;

    const { rows: atRiskRows } = await pool.query(atRiskQuery);

    // Build response
    const response = {
      status: 'active',
      timestamp: new Date().toISOString(),
      by_service_type: {},
      at_risk_deliveries: [],
      overall: {
        total_active: 0,
        total_at_risk: 0,
        total_breached: 0,
      },
    };

    rows.forEach((row) => {
      response.by_service_type[row.service_type] = {
        active_count: parseInt(row.active_count),
        avg_elapsed_minutes: parseFloat(row.avg_elapsed_minutes),
        at_risk_count: parseInt(row.at_risk_count),
        breached_count: parseInt(row.breached_count),
        min_remaining_minutes: parseFloat(row.min_remaining_minutes) || 0,
        max_elapsed_minutes: parseFloat(row.max_elapsed_minutes),
        sla_target: SLA_TARGETS[row.service_type] || 60,
      };

      response.overall.total_active += parseInt(row.active_count);
      response.overall.total_at_risk += parseInt(row.at_risk_count);
      response.overall.total_breached += parseInt(row.breached_count);
    });

    // Add at-risk delivery details
    atRiskRows.forEach((delivery) => {
      const remaining = parseFloat(delivery.remaining_minutes);
      response.at_risk_deliveries.push({
        id: delivery.id,
        tracking_number: delivery.tracking_number,
        service_type: delivery.service_type,
        status: delivery.status,
        driver_id: delivery.driver_id,
        hub_name: delivery.hub_name || 'Unknown',
        remaining_minutes: remaining,
        elapsed_minutes: parseFloat(delivery.elapsed_minutes),
        urgency: remaining < 5 ? 'critical' : remaining < 10 ? 'high' : 'medium',
      });
    });

    // Determine overall status
    if (response.overall.total_breached > 0) {
      response.status = 'critical';
    } else if (response.overall.total_at_risk > 5) {
      response.status = 'warning';
    } else {
      response.status = 'healthy';
    }

    logger.info(`Real-time SLA status: ${response.status}`);
    res.json(response);
  } catch (error) {
    logger.error('Error fetching real-time SLA status:', error);
    res.status(500).json({
      error: 'Failed to fetch real-time SLA status',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/analytics/sla/compliance
 * Get historical SLA compliance metrics
 */
router.get('/sla/compliance', async (req, res) => {
  try {
    const { days = 7, service_type } = req.query;
    logger.info(`Fetching SLA compliance for last ${days} days`);

    const endDate = new Date();
    const startDate = new Date(endDate - days * 24 * 60 * 60 * 1000);

    let query = `
      WITH delivery_performance AS (
        SELECT
          o.id,
          o.service_type,
          o.created_at,
          o.sla_deadline as promised_delivery_at,
          o.delivered_at as actual_delivery_at,
          EXTRACT(EPOCH FROM (o.delivered_at - o.created_at)) / 60 as actual_duration_minutes,
          CASE
            WHEN o.service_type = 'BARQ' THEN 60
            WHEN o.service_type = 'BULLET' THEN 240
            WHEN o.service_type = 'EXPRESS' THEN 30
            WHEN o.service_type = 'STANDARD' THEN 120
            ELSE 60
          END as sla_target_minutes,
          CASE
            WHEN o.delivered_at <= o.sla_deadline THEN 1
            ELSE 0
          END as sla_met,
          EXTRACT(EPOCH FROM (o.delivered_at - o.sla_deadline)) / 60 as breach_minutes
        FROM orders o
        WHERE o.delivered_at IS NOT NULL
        AND o.delivered_at >= $1
        AND o.delivered_at <= $2
    `;

    const params = [startDate, endDate];

    if (service_type) {
      query += ` AND o.service_type = $3`;
      params.push(service_type);
    }

    query += `
      )
      SELECT
        service_type,
        COUNT(*) as total_deliveries,
        SUM(sla_met) as deliveries_on_time,
        COUNT(*) - SUM(sla_met) as deliveries_breached,
        (SUM(sla_met)::float / COUNT(*) * 100) as compliance_rate,
        AVG(actual_duration_minutes) as avg_duration_minutes,
        AVG(sla_target_minutes) as sla_target,
        AVG(CASE WHEN sla_met = 0 THEN breach_minutes ELSE 0 END) as avg_breach_minutes,
        MAX(breach_minutes) as max_breach_minutes,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY actual_duration_minutes) as median_duration,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY actual_duration_minutes) as p95_duration
      FROM delivery_performance
      GROUP BY service_type
      ORDER BY service_type
    `;

    const { rows } = await pool.query(query, params);

    // Process results
    const response = {
      analysis_period: {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        days: parseInt(days),
      },
      by_service_type: {},
      overall: {
        total_deliveries: 0,
        deliveries_on_time: 0,
        deliveries_breached: 0,
        compliance_rate: 0,
      },
    };

    rows.forEach((row) => {
      const complianceRate = parseFloat(row.compliance_rate);
      response.by_service_type[row.service_type] = {
        total_deliveries: parseInt(row.total_deliveries),
        deliveries_on_time: parseInt(row.deliveries_on_time),
        deliveries_breached: parseInt(row.deliveries_breached),
        compliance_rate: complianceRate,
        avg_duration_minutes: parseFloat(row.avg_duration_minutes),
        sla_target_minutes: parseFloat(row.sla_target),
        avg_breach_minutes: parseFloat(row.avg_breach_minutes) || 0,
        max_breach_minutes: parseFloat(row.max_breach_minutes) || 0,
        median_duration: parseFloat(row.median_duration),
        p95_duration: parseFloat(row.p95_duration),
        status:
          complianceRate >= 95
            ? 'excellent'
            : complianceRate >= 90
              ? 'good'
              : complianceRate >= 85
                ? 'warning'
                : 'critical',
      };

      response.overall.total_deliveries += parseInt(row.total_deliveries);
      response.overall.deliveries_on_time += parseInt(row.deliveries_on_time);
      response.overall.deliveries_breached += parseInt(row.deliveries_breached);
    });

    // Calculate overall compliance
    if (response.overall.total_deliveries > 0) {
      response.overall.compliance_rate =
        (response.overall.deliveries_on_time / response.overall.total_deliveries) * 100;
    }

    logger.info(`SLA compliance: ${response.overall.compliance_rate.toFixed(1)}%`);
    res.json(response);
  } catch (error) {
    logger.error('Error fetching SLA compliance:', error);
    res.status(500).json({
      error: 'Failed to fetch SLA compliance',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/analytics/sla/trend
 * Get SLA compliance trend over time
 */
router.get('/sla/trend', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    logger.info(`Fetching SLA trend for last ${days} days`);

    const query = `
      WITH daily_compliance AS (
        SELECT
          DATE(delivered_at) as delivery_date,
          service_type,
          COUNT(*) as total_deliveries,
          SUM(CASE WHEN delivered_at <= sla_deadline THEN 1 ELSE 0 END) as on_time_deliveries,
          (SUM(CASE WHEN delivered_at <= sla_deadline THEN 1 ELSE 0 END)::float / COUNT(*) * 100) as compliance_rate
        FROM orders
        WHERE delivered_at IS NOT NULL
        AND delivered_at >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(delivered_at), service_type
      )
      SELECT
        delivery_date,
        service_type,
        total_deliveries,
        on_time_deliveries,
        compliance_rate
      FROM daily_compliance
      ORDER BY delivery_date ASC, service_type
    `;

    const { rows } = await pool.query(query);

    // Group by service type
    const trendsByServiceType = {};
    rows.forEach((row) => {
      if (!trendsByServiceType[row.service_type]) {
        trendsByServiceType[row.service_type] = {
          daily_data: [],
          avg_rate: 0,
        };
      }

      trendsByServiceType[row.service_type].daily_data.push({
        date: row.delivery_date,
        total_deliveries: parseInt(row.total_deliveries),
        on_time_deliveries: parseInt(row.on_time_deliveries),
        compliance_rate: parseFloat(row.compliance_rate),
      });
    });

    // Calculate averages and trends
    Object.keys(trendsByServiceType).forEach((serviceType) => {
      const data = trendsByServiceType[serviceType].daily_data;
      const rates = data.map((d) => d.compliance_rate);

      trendsByServiceType[serviceType].avg_rate = rates.reduce((a, b) => a + b, 0) / rates.length;
      trendsByServiceType[serviceType].current_rate = data[data.length - 1].compliance_rate;
      trendsByServiceType[serviceType].previous_rate = data[0].compliance_rate;

      // Simple trend calculation
      const slope =
        (trendsByServiceType[serviceType].current_rate -
          trendsByServiceType[serviceType].previous_rate) /
        days;
      trendsByServiceType[serviceType].trend_direction =
        slope > 0.1 ? 'improving' : slope < -0.1 ? 'declining' : 'stable';
    });

    logger.info(
      `SLA trend analysis complete for ${Object.keys(trendsByServiceType).length} service types`
    );
    res.json({
      analysis_period_days: parseInt(days),
      trends_by_service_type: trendsByServiceType,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching SLA trend:', error);
    res.status(500).json({
      error: 'Failed to fetch SLA trend',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/analytics/fleet/performance
 * Get driver and vehicle performance summary
 */
router.get('/fleet/performance', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    logger.info(`Fetching fleet performance for last ${days} days`);

    const endDate = new Date();
    const startDate = new Date(endDate - days * 24 * 60 * 60 * 1000);

    const query = `
      WITH driver_metrics AS (
        SELECT
          o.driver_id,
          COUNT(*) as total_deliveries,
          SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) as successful_deliveries,
          SUM(CASE WHEN o.delivered_at <= o.sla_deadline THEN 1 ELSE 0 END) as on_time_deliveries,
          AVG(EXTRACT(EPOCH FROM (o.delivered_at - o.created_at)) / 3600.0) as avg_delivery_hours,
          COUNT(DISTINCT DATE(o.created_at)) as active_days
        FROM orders o
        WHERE o.created_at >= $1
        AND o.created_at <= $2
        AND o.driver_id IS NOT NULL
        GROUP BY o.driver_id
        HAVING COUNT(*) >= 5
      )
      SELECT
        driver_id,
        total_deliveries,
        successful_deliveries,
        on_time_deliveries,
        (successful_deliveries::float / total_deliveries * 100) as success_rate,
        (on_time_deliveries::float / total_deliveries * 100) as on_time_rate,
        (total_deliveries::float / active_days) as deliveries_per_day,
        avg_delivery_hours
      FROM driver_metrics
      ORDER BY success_rate DESC, on_time_rate DESC
      LIMIT 10
    `;

    const { rows } = await pool.query(query, [startDate, endDate]);

    const topDrivers = rows.map((row) => ({
      driver_id: row.driver_id,
      total_deliveries: parseInt(row.total_deliveries),
      success_rate: parseFloat(row.success_rate),
      on_time_rate: parseFloat(row.on_time_rate),
      deliveries_per_day: parseFloat(row.deliveries_per_day),
      avg_delivery_hours: parseFloat(row.avg_delivery_hours),
      performance_index:
        parseFloat(row.success_rate) * 0.4 +
        parseFloat(row.on_time_rate) * 0.3 +
        (parseFloat(row.deliveries_per_day) / 20) * 100 * 0.2 +
        (1 / parseFloat(row.avg_delivery_hours)) * 100 * 0.1,
    }));

    logger.info(`Fleet performance: ${topDrivers.length} top drivers identified`);
    res.json({
      analysis_period: {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        days: parseInt(days),
      },
      top_drivers: topDrivers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching fleet performance:', error);
    res.status(500).json({
      error: 'Failed to fetch fleet performance',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/analytics/dashboard/summary
 * Get comprehensive dashboard summary
 */
router.get('/dashboard/summary', async (req, res) => {
  try {
    logger.info('Fetching dashboard summary');

    // Get today's metrics
    const todayQuery = `
      SELECT
        COUNT(*) as total_deliveries,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as completed,
        COUNT(CASE WHEN status IN ('pending', 'assigned', 'picked_up', 'in_transit') THEN 1 END) as active,
        COUNT(CASE WHEN delivered_at <= sla_deadline THEN 1 END) as on_time,
        COUNT(CASE WHEN delivered_at > sla_deadline THEN 1 END) as breached
      FROM orders
      WHERE created_at >= CURRENT_DATE
    `;

    const { rows: todayRows } = await pool.query(todayQuery);
    const todayMetrics = todayRows[0];

    // Get week comparison
    const weekQuery = `
      SELECT
        COUNT(*) as total_deliveries,
        (COUNT(CASE WHEN delivered_at <= sla_deadline THEN 1 END)::float / COUNT(*) * 100) as compliance_rate
      FROM orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      AND delivered_at IS NOT NULL
    `;

    const { rows: weekRows } = await pool.query(weekQuery);
    const weekMetrics = weekRows[0];

    // Get active drivers count
    const driversQuery = `
      SELECT COUNT(DISTINCT driver_id) as active_drivers
      FROM orders
      WHERE created_at >= CURRENT_DATE
      AND driver_id IS NOT NULL
    `;

    const { rows: driversRows } = await pool.query(driversQuery);

    const summary = {
      today: {
        total_deliveries: parseInt(todayMetrics.total_deliveries) || 0,
        completed: parseInt(todayMetrics.completed) || 0,
        active: parseInt(todayMetrics.active) || 0,
        on_time: parseInt(todayMetrics.on_time) || 0,
        breached: parseInt(todayMetrics.breached) || 0,
        compliance_rate:
          todayMetrics.total_deliveries > 0
            ? (parseInt(todayMetrics.on_time) / parseInt(todayMetrics.total_deliveries)) * 100
            : 0,
      },
      week: {
        total_deliveries: parseInt(weekMetrics.total_deliveries) || 0,
        compliance_rate: parseFloat(weekMetrics.compliance_rate) || 0,
      },
      active_drivers: parseInt(driversRows[0].active_drivers) || 0,
      timestamp: new Date().toISOString(),
    };

    logger.info('Dashboard summary generated successfully');
    res.json(summary);
  } catch (error) {
    logger.error('Error fetching dashboard summary:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard summary',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/analytics/fleet/drivers
 * Get driver performance metrics
 */
router.get('/fleet/drivers', async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;

    logger.info(`Fetching driver performance metrics (${period})`);

    // Calculate period boundaries
    let startDate;
    switch (period) {
      case 'weekly':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const query = `
      WITH driver_stats AS (
        SELECT
          d.id,
          d.name,
          COUNT(o.id) as total_deliveries,
          COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as successful_deliveries,
          COUNT(CASE WHEN o.status = 'delivered' AND NOT o.sla_breached THEN 1 END) as on_time_deliveries,
          AVG(CASE
            WHEN o.status = 'delivered' AND o.delivered_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (o.delivered_at - o.created_at)) / 60
          END) as avg_delivery_time_minutes
        FROM drivers d
        LEFT JOIN orders o ON o.driver_id = d.id
          AND o.created_at >= $1
        WHERE d.is_active = true
        GROUP BY d.id, d.name
      )
      SELECT
        id,
        name,
        total_deliveries as deliveries,
        ROUND((successful_deliveries::numeric / NULLIF(total_deliveries, 0) * 100)::numeric, 2) as success_rate,
        ROUND((on_time_deliveries::numeric / NULLIF(successful_deliveries, 0) * 100)::numeric, 2) as on_time_rate,
        ROUND((successful_deliveries::numeric / NULLIF(total_deliveries, 0) * 100)::numeric, 2) as productivity,
        ROUND((
          (successful_deliveries::numeric / NULLIF(total_deliveries, 0) * 50) +
          (on_time_deliveries::numeric / NULLIF(successful_deliveries, 0) * 50)
        )::numeric, 2) as dpi
      FROM driver_stats
      WHERE total_deliveries > 0
      ORDER BY dpi DESC NULLS LAST
      LIMIT 50;
    `;

    const result = await pool.query(query, [startDate]);

    // Calculate system averages
    const drivers = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      dpi: parseFloat(row.dpi) || 0,
      success_rate: parseFloat(row.success_rate) || 0,
      on_time_rate: parseFloat(row.on_time_rate) || 0,
      productivity: parseFloat(row.productivity) || 0,
      deliveries: parseInt(row.deliveries) || 0,
    }));

    const averages = {
      dpi: drivers.length > 0
        ? drivers.reduce((sum, d) => sum + d.dpi, 0) / drivers.length
        : 0,
      success_rate: drivers.length > 0
        ? drivers.reduce((sum, d) => sum + d.success_rate, 0) / drivers.length
        : 0,
      on_time_rate: drivers.length > 0
        ? drivers.reduce((sum, d) => sum + d.on_time_rate, 0) / drivers.length
        : 0,
      productivity: drivers.length > 0
        ? drivers.reduce((sum, d) => sum + d.productivity, 0) / drivers.length
        : 0,
    };

    res.json({
      period,
      drivers,
      averages: {
        dpi: Math.round(averages.dpi * 100) / 100,
        success_rate: Math.round(averages.success_rate * 100) / 100,
        on_time_rate: Math.round(averages.on_time_rate * 100) / 100,
        productivity: Math.round(averages.productivity * 100) / 100,
      },
    });
  } catch (error) {
    logger.error('Error fetching driver performance:', error);
    res.status(500).json({
      error: 'Failed to fetch driver performance',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/analytics/fleet/drivers/:id
 * Get single driver performance with trends
 */
router.get('/fleet/drivers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { period = 'weekly' } = req.query;

    logger.info(`Fetching driver ${id} performance (${period})`);

    // Calculate period boundaries
    let startDate;
    switch (period) {
      case 'weekly':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    const query = `
      WITH driver_stats AS (
        SELECT
          d.id,
          d.name,
          COUNT(o.id) as total_deliveries,
          COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as successful_deliveries,
          COUNT(CASE WHEN o.status = 'delivered' AND NOT o.sla_breached THEN 1 END) as on_time_deliveries,
          AVG(CASE
            WHEN o.status = 'delivered' AND o.delivered_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (o.delivered_at - o.created_at)) / 60
          END) as avg_delivery_time_minutes
        FROM drivers d
        LEFT JOIN orders o ON o.driver_id = d.id
          AND o.created_at >= $2
        WHERE d.id = $1
        GROUP BY d.id, d.name
      )
      SELECT
        id,
        name,
        total_deliveries,
        ROUND((successful_deliveries::numeric / NULLIF(total_deliveries, 0) * 100)::numeric, 2) as success_rate,
        ROUND((on_time_deliveries::numeric / NULLIF(successful_deliveries, 0) * 100)::numeric, 2) as on_time_rate,
        ROUND((successful_deliveries::numeric / NULLIF(total_deliveries, 0) * 100)::numeric, 2) as productivity,
        ROUND((
          (successful_deliveries::numeric / NULLIF(total_deliveries, 0) * 50) +
          (on_time_deliveries::numeric / NULLIF(successful_deliveries, 0) * 50)
        )::numeric, 2) as dpi,
        COALESCE(avg_delivery_time_minutes, 0) as avg_delivery_time
      FROM driver_stats;
    `;

    const result = await pool.query(query, [id, startDate]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Driver not found',
      });
    }

    const driver = result.rows[0];

    // Get weekly trend
    const trendQuery = `
      SELECT
        DATE_TRUNC('week', o.created_at) as week,
        ROUND((
          (COUNT(CASE WHEN o.status = 'delivered' THEN 1 END)::numeric / NULLIF(COUNT(o.id), 0) * 50) +
          (COUNT(CASE WHEN o.status = 'delivered' AND NOT o.sla_breached THEN 1 END)::numeric / NULLIF(COUNT(CASE WHEN o.status = 'delivered' THEN 1 END), 0) * 50)
        )::numeric, 2) as dpi
      FROM orders o
      WHERE o.driver_id = $1
        AND o.created_at >= $2
      GROUP BY DATE_TRUNC('week', o.created_at)
      ORDER BY week;
    `;

    const trendResult = await pool.query(trendQuery, [id, startDate]);

    res.json({
      driver_id: parseInt(id),
      period,
      metrics: {
        id: driver.id,
        name: driver.name,
        dpi: parseFloat(driver.dpi) || 0,
        success_rate: parseFloat(driver.success_rate) || 0,
        on_time_rate: parseFloat(driver.on_time_rate) || 0,
        productivity: parseFloat(driver.productivity) || 0,
        total_deliveries: parseInt(driver.total_deliveries) || 0,
        avg_delivery_time: parseFloat(driver.avg_delivery_time) || 0,
      },
      trend: trendResult.rows.map((row, index) => ({
        week: index + 1,
        dpi: parseFloat(row.dpi) || 0,
      })),
    });
  } catch (error) {
    logger.error(`Error fetching driver ${req.params.id} performance:`, error);
    res.status(500).json({
      error: 'Failed to fetch driver performance',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/analytics/fleet/vehicles
 * Get vehicle performance metrics
 */
router.get('/fleet/vehicles', async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;

    logger.info(`Fetching vehicle performance metrics (${period})`);

    // Calculate period boundaries
    let startDate;
    switch (period) {
      case 'weekly':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const query = `
      WITH vehicle_stats AS (
        SELECT
          v.id,
          v.license_plate as plate,
          COUNT(DISTINCT o.id) as total_trips,
          COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END) as successful_trips,
          COUNT(DISTINCT DATE(o.created_at)) as days_active
        FROM vehicles v
        LEFT JOIN drivers d ON d.vehicle_id = v.id
        LEFT JOIN orders o ON o.driver_id = d.id
          AND o.created_at >= $1
        WHERE v.status = 'active'
        GROUP BY v.id, v.license_plate
      )
      SELECT
        id,
        plate,
        total_trips as trips,
        ROUND((successful_trips::numeric / NULLIF(total_trips, 0) * 100)::numeric, 2) as success_rate,
        ROUND((days_active::numeric / 30 * 100)::numeric, 2) as utilization,
        ROUND((successful_trips::numeric / NULLIF(total_trips, 0) * 100)::numeric, 2) as efficiency,
        ROUND((
          (successful_trips::numeric / NULLIF(total_trips, 0) * 40) +
          (days_active::numeric / 30 * 30) +
          (successful_trips::numeric / NULLIF(total_trips, 0) * 30)
        )::numeric, 2) as vpi
      FROM vehicle_stats
      WHERE total_trips > 0
      ORDER BY vpi DESC NULLS LAST
      LIMIT 50;
    `;

    const result = await pool.query(query, [startDate]);

    // Calculate system averages
    const vehicles = result.rows.map(row => ({
      id: row.id,
      plate: row.plate,
      vpi: parseFloat(row.vpi) || 0,
      success_rate: parseFloat(row.success_rate) || 0,
      utilization: parseFloat(row.utilization) || 0,
      efficiency: parseFloat(row.efficiency) || 0,
      trips: parseInt(row.trips) || 0,
    }));

    const averages = {
      vpi: vehicles.length > 0
        ? vehicles.reduce((sum, v) => sum + v.vpi, 0) / vehicles.length
        : 0,
      success_rate: vehicles.length > 0
        ? vehicles.reduce((sum, v) => sum + v.success_rate, 0) / vehicles.length
        : 0,
      utilization: vehicles.length > 0
        ? vehicles.reduce((sum, v) => sum + v.utilization, 0) / vehicles.length
        : 0,
      efficiency: vehicles.length > 0
        ? vehicles.reduce((sum, v) => sum + v.efficiency, 0) / vehicles.length
        : 0,
    };

    res.json({
      period,
      vehicles,
      averages: {
        vpi: Math.round(averages.vpi * 100) / 100,
        success_rate: Math.round(averages.success_rate * 100) / 100,
        utilization: Math.round(averages.utilization * 100) / 100,
        efficiency: Math.round(averages.efficiency * 100) / 100,
      },
    });
  } catch (error) {
    logger.error('Error fetching vehicle performance:', error);
    res.status(500).json({
      error: 'Failed to fetch vehicle performance',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/analytics/routes/efficiency
 * Get route efficiency metrics
 */
router.get('/routes/efficiency', async (req, res) => {
  try {
    const { days = 30, hub_id } = req.query;
    const period_days = parseInt(days);

    logger.info(`Fetching route efficiency metrics (${period_days} days, hub: ${hub_id || 'all'})`);

    const startDate = new Date(Date.now() - period_days * 24 * 60 * 60 * 1000);

    const query = `
      WITH route_stats AS (
        SELECT
          'Main Hub' as hub,
          COUNT(o.id) as total_deliveries,
          AVG(CASE
            WHEN o.status = 'delivered' AND o.delivered_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (o.delivered_at - o.created_at)) / 3600
          END) as avg_delivery_hours,
          ROUND((COUNT(CASE WHEN o.status = 'delivered' AND NOT o.sla_breached THEN 1 END)::numeric / NULLIF(COUNT(CASE WHEN o.status = 'delivered' THEN 1 END), 0) * 100)::numeric, 2) as on_time_rate,
          ROUND((
            (COUNT(CASE WHEN o.status = 'delivered' THEN 1 END)::numeric / NULLIF(COUNT(o.id), 0) * 40) +
            (COUNT(CASE WHEN o.status = 'delivered' AND NOT o.sla_breached THEN 1 END)::numeric / NULLIF(COUNT(CASE WHEN o.status = 'delivered' THEN 1 END), 0) * 40) +
            (CASE WHEN AVG(CASE WHEN o.status = 'delivered' AND o.delivered_at IS NOT NULL THEN EXTRACT(EPOCH FROM (o.delivered_at - o.created_at)) / 3600 END) < 2 THEN 20 ELSE 10 END)
          )::numeric, 2) as efficiency_score
        FROM orders o
        WHERE o.created_at >= $1
      )
      SELECT * FROM route_stats WHERE total_deliveries > 0;
    `;

    const result = await pool.query(query, [startDate]);

    const stats = result.rows[0] || {
      total_deliveries: 0,
      avg_efficiency_score: 0,
      avg_on_time_rate: 0,
      avg_delivery_hours: 0,
    };

    res.json({
      period_days,
      hub_id: hub_id ? parseInt(hub_id) : null,
      overall_metrics: {
        total_deliveries: parseInt(stats.total_deliveries) || 0,
        avg_efficiency_score: parseFloat(stats.efficiency_score) || 0,
        avg_on_time_rate: parseFloat(stats.on_time_rate) || 0,
        avg_delivery_hours: parseFloat(stats.avg_delivery_hours) || 0,
      },
      top_performers: [
        {
          hub: stats.hub || 'Main Hub',
          score: parseFloat(stats.efficiency_score) || 0,
        },
      ],
      bottom_performers: [],
    });
  } catch (error) {
    logger.error('Error fetching route efficiency:', error);
    res.status(500).json({
      error: 'Failed to fetch route efficiency',
      message: error.message,
    });
  }
});

module.exports = router;
