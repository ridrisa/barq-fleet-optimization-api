/**
 * Dynamic Query Service
 * Enables GPT/AI to execute any production query from the BARQ Fleet catalog
 * Source: barqfleet_db_files/queries_external_metrics.py
 */

const pool = require('./postgres.service');
const logger = require('../utils/logger');

// Import all production queries from BARQ Fleet system
const PRODUCTION_QUERIES = {
  // ============================================
  // 1. ORDER INTELLIGENCE
  // ============================================

  total_orders: {
    description: 'Total number of orders in period',
    category: 'order_intelligence',
    query: `
      SELECT COUNT(o.id) AS value
      FROM orders o
      WHERE o.created_at BETWEEN $1 AND $2
    `,
    params: ['start_date', 'end_date'],
  },

  average_packages_per_order: {
    description: 'Average number of packages per order',
    category: 'order_intelligence',
    query: `
      SELECT COALESCE(AVG(packages_count), 1.0) AS value
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
        AND packages_count > 0
    `,
    params: ['start_date', 'end_date'],
  },

  // ============================================
  // 2. FINANCIAL METRICS
  // ============================================

  total_revenue: {
    description: 'Total revenue from delivery fees',
    category: 'financial',
    query: `
      SELECT COALESCE(SUM(o.delivery_fee), 0.0) AS value
      FROM orders o
      WHERE o.created_at BETWEEN $1 AND $2
    `,
    params: ['start_date', 'end_date'],
  },

  average_delivery_fee: {
    description: 'Average delivery fee per order',
    category: 'financial',
    query: `
      SELECT COALESCE(AVG(o.delivery_fee), 0.0) AS value
      FROM orders o
      WHERE o.created_at BETWEEN $1 AND $2
        AND o.delivery_fee > 0
    `,
    params: ['start_date', 'end_date'],
  },

  cod_percentage: {
    description: 'Percentage of cash on delivery orders',
    category: 'financial',
    query: `
      SELECT COALESCE(
        CAST(COUNT(*) FILTER(WHERE payment_type='cash_on_delivery') AS DECIMAL) * 100.0 /
        NULLIF(COUNT(*), 0),
        0.0
      ) AS value
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
    `,
    params: ['start_date', 'end_date'],
  },

  total_cod_collected: {
    description: 'Total cash collected from COD orders',
    category: 'financial',
    query: `
      SELECT COALESCE(SUM(grand_total), 0.0) AS value
      FROM orders
      WHERE payment_type = 'cash_on_delivery'
        AND status IN('delivered', 'returned')
        AND delivered_at BETWEEN $1 AND $2
    `,
    params: ['start_date', 'end_date'],
  },

  // ============================================
  // 3. DELIVERY PERFORMANCE
  // ============================================

  order_completion_rate: {
    description: 'Percentage of orders successfully completed',
    category: 'delivery_performance',
    query: `
      SELECT COALESCE(
        CAST(COUNT(*) FILTER(WHERE status IN('delivered','returned')) AS DECIMAL) * 100.0 /
        NULLIF(COUNT(*) FILTER(WHERE status IN('delivered','failed','returned','cancelled')), 0),
        0.0
      ) AS value
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
    `,
    params: ['start_date', 'end_date'],
  },

  on_time_delivery_rate: {
    description: 'Percentage of deliveries completed on time',
    category: 'delivery_performance',
    query: `
      SELECT COALESCE(
        CAST(COUNT(*) FILTER(WHERE delivered_at <= sla_deadline) AS DECIMAL) * 100.0 /
        NULLIF(COUNT(*) FILTER(WHERE sla_deadline IS NOT NULL), 0),
        0.0
      ) AS value
      FROM orders
      WHERE status = 'delivered'
        AND created_at BETWEEN $1 AND $2
    `,
    params: ['start_date', 'end_date'],
  },

  cancellation_rate: {
    description: 'Percentage of orders cancelled',
    category: 'delivery_performance',
    query: `
      SELECT COALESCE(
        CAST(COUNT(*) FILTER(WHERE status = 'cancelled') AS DECIMAL) * 100.0 /
        NULLIF(COUNT(*), 0),
        0.0
      ) AS value
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
    `,
    params: ['start_date', 'end_date'],
  },

  average_delivery_time: {
    description: 'Average time from pickup to delivery in minutes',
    category: 'delivery_performance',
    query: `
      SELECT COALESCE(
        AVG(EXTRACT(EPOCH FROM (delivered_at - pickup_at)) / 60.0),
        0.0
      ) AS value
      FROM orders
      WHERE status = 'delivered'
        AND delivered_at > pickup_at
        AND created_at BETWEEN $1 AND $2
    `,
    params: ['start_date', 'end_date'],
  },

  return_rate: {
    description: 'Percentage of orders returned',
    category: 'delivery_performance',
    query: `
      SELECT COALESCE(
        CAST(COUNT(*) FILTER(WHERE status = 'returned') AS DECIMAL) * 100.0 /
        NULLIF(COUNT(*), 0),
        0.0
      ) AS value
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
    `,
    params: ['start_date', 'end_date'],
  },

  // ============================================
  // 4. COURIER PERFORMANCE
  // ============================================

  active_couriers: {
    description: 'Number of active couriers in period',
    category: 'courier_performance',
    query: `
      SELECT COUNT(DISTINCT driver_id) AS value
      FROM orders
      WHERE driver_id IS NOT NULL
        AND created_at BETWEEN $1 AND $2
    `,
    params: ['start_date', 'end_date'],
  },

  deliveries_per_courier: {
    description: 'Average deliveries per courier',
    category: 'courier_performance',
    query: `
      SELECT COALESCE(
        CAST(COUNT(*) FILTER(WHERE status IN('delivered','returned')) AS DECIMAL) /
        NULLIF(COUNT(DISTINCT driver_id), 0),
        0.0
      ) AS value
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
        AND driver_id IS NOT NULL
    `,
    params: ['start_date', 'end_date'],
  },

  courier_efficiency_score: {
    description: 'Overall courier efficiency score based on on-time rate and speed',
    category: 'courier_performance',
    query: `
      WITH courier_metrics AS (
        SELECT
          driver_id,
          COUNT(*) as total_deliveries,
          AVG(EXTRACT(EPOCH FROM (delivered_at - pickup_at)) / 60.0) as avg_time,
          COUNT(*) FILTER(WHERE status = 'delivered' AND delivered_at <= sla_deadline) as ontime
        FROM orders
        WHERE created_at BETWEEN $1 AND $2
          AND driver_id IS NOT NULL
          AND delivered_at > pickup_at
        GROUP BY driver_id
      )
      SELECT COALESCE(
        AVG((ontime::DECIMAL / NULLIF(total_deliveries, 0)) * 100.0 -
            (LEAST(avg_time / 120.0, 1) * 20)),
        0.0
      ) AS value
      FROM courier_metrics
      WHERE total_deliveries >= 5
    `,
    params: ['start_date', 'end_date'],
  },

  // ============================================
  // 5. ORDER LIFECYCLE
  // ============================================

  end_to_end_lifecycle_time: {
    description: 'Average time from order creation to completion in hours',
    category: 'order_lifecycle',
    query: `
      SELECT COALESCE(
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600.0),
        0.0
      ) AS value
      FROM orders
      WHERE status IN('delivered', 'failed', 'returned')
        AND updated_at BETWEEN $1 AND $2
    `,
    params: ['start_date', 'end_date'],
  },

  average_time_to_ready: {
    description: 'Average time from creation to ready status in minutes',
    category: 'order_lifecycle',
    query: `
      SELECT COALESCE(
        AVG(EXTRACT(EPOCH FROM (ready_since - created_at)) / 60.0),
        0.0
      ) AS value
      FROM orders
      WHERE ready_since >= created_at
        AND created_at BETWEEN $1 AND $2
    `,
    params: ['start_date', 'end_date'],
  },

  average_time_ready_to_pickup: {
    description: 'Average time from ready to pickup in minutes',
    category: 'order_lifecycle',
    query: `
      SELECT COALESCE(
        AVG(EXTRACT(EPOCH FROM (pickup_at - ready_since)) / 60.0),
        0.0
      ) AS value
      FROM orders
      WHERE pickup_at >= ready_since
        AND created_at BETWEEN $1 AND $2
    `,
    params: ['start_date', 'end_date'],
  },

  // ============================================
  // 6. DISTRIBUTION & BREAKDOWN
  // ============================================

  order_status_distribution: {
    description: 'Distribution of orders by status',
    category: 'distribution',
    query: `
      SELECT
        status as name,
        COUNT(*) as value
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY status
      ORDER BY value DESC
    `,
    params: ['start_date', 'end_date'],
    returns: 'array',
  },

  service_type_distribution: {
    description: 'Distribution of orders by service type',
    category: 'distribution',
    query: `
      SELECT
        service_type as name,
        COUNT(*) as value
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY service_type
      ORDER BY value DESC
    `,
    params: ['start_date', 'end_date'],
    returns: 'array',
  },

  hourly_order_distribution: {
    description: 'Distribution of orders by hour of day',
    category: 'distribution',
    query: `
      SELECT
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as value
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY hour
      ORDER BY hour
    `,
    params: ['start_date', 'end_date'],
    returns: 'array',
  },

  // ============================================
  // 7. GEOGRAPHIC ANALYSIS
  // ============================================

  orders_by_city: {
    description: 'Distribution of orders by city',
    category: 'geographic',
    query: `
      SELECT
        delivery_city as name,
        COUNT(*) as value
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
        AND delivery_city IS NOT NULL
      GROUP BY delivery_city
      ORDER BY value DESC
      LIMIT 20
    `,
    params: ['start_date', 'end_date'],
    returns: 'array',
  },

  orders_by_zone: {
    description: 'Distribution of orders by zone',
    category: 'geographic',
    query: `
      SELECT
        delivery_zone as name,
        COUNT(*) as value
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
        AND delivery_zone IS NOT NULL
      GROUP BY delivery_zone
      ORDER BY value DESC
    `,
    params: ['start_date', 'end_date'],
    returns: 'array',
  },

  // ============================================
  // 8. ADVANCED METRICS
  // ============================================

  peak_hours: {
    description: 'Identify peak order hours',
    category: 'advanced',
    query: `
      SELECT
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as orders,
        AVG(EXTRACT(EPOCH FROM (delivered_at - created_at)) / 60.0) as avg_delivery_time
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
        AND status = 'delivered'
      GROUP BY hour
      ORDER BY orders DESC
      LIMIT 5
    `,
    params: ['start_date', 'end_date'],
    returns: 'array',
  },

  sla_breach_analysis: {
    description: 'Analysis of SLA breaches by service type',
    category: 'advanced',
    query: `
      SELECT
        service_type,
        COUNT(*) as total_orders,
        COUNT(*) FILTER(WHERE delivered_at > sla_deadline) as breached,
        COALESCE(
          CAST(COUNT(*) FILTER(WHERE delivered_at > sla_deadline) AS DECIMAL) * 100.0 /
          NULLIF(COUNT(*), 0),
          0.0
        ) as breach_rate,
        AVG(
          EXTRACT(EPOCH FROM (delivered_at - sla_deadline)) / 60.0
        ) FILTER(WHERE delivered_at > sla_deadline) as avg_breach_minutes
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
        AND status = 'delivered'
        AND sla_deadline IS NOT NULL
      GROUP BY service_type
    `,
    params: ['start_date', 'end_date'],
    returns: 'array',
  },

  top_performing_couriers: {
    description: 'Top 10 couriers by performance',
    category: 'advanced',
    query: `
      SELECT
        driver_id,
        COUNT(*) as total_deliveries,
        COUNT(*) FILTER(WHERE status = 'delivered') as completed,
        COUNT(*) FILTER(WHERE delivered_at <= sla_deadline) as on_time,
        COALESCE(
          CAST(COUNT(*) FILTER(WHERE delivered_at <= sla_deadline) AS DECIMAL) * 100.0 /
          NULLIF(COUNT(*) FILTER(WHERE status = 'delivered'), 0),
          0.0
        ) as on_time_rate,
        AVG(EXTRACT(EPOCH FROM (delivered_at - pickup_at)) / 60.0)
          FILTER(WHERE delivered_at > pickup_at) as avg_delivery_time
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
        AND driver_id IS NOT NULL
      GROUP BY driver_id
      HAVING COUNT(*) >= 5
      ORDER BY on_time_rate DESC, avg_delivery_time ASC
      LIMIT 10
    `,
    params: ['start_date', 'end_date'],
    returns: 'array',
  },

  daily_trends: {
    description: 'Daily order trends with key metrics',
    category: 'advanced',
    query: `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as total_orders,
        COUNT(*) FILTER(WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER(WHERE status = 'cancelled') as cancelled,
        COALESCE(
          CAST(COUNT(*) FILTER(WHERE status = 'delivered') AS DECIMAL) * 100.0 /
          NULLIF(COUNT(*), 0),
          0.0
        ) as completion_rate,
        AVG(EXTRACT(EPOCH FROM (delivered_at - created_at)) / 60.0)
          FILTER(WHERE status = 'delivered') as avg_delivery_time
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY DATE(created_at)
      ORDER BY date
    `,
    params: ['start_date', 'end_date'],
    returns: 'array',
  },
};

class DynamicQueryService {
  /**
   * Execute any production query by name
   */
  static async executeQuery(queryName, params = {}) {
    const queryDef = PRODUCTION_QUERIES[queryName];

    if (!queryDef) {
      throw new Error(`Query '${queryName}' not found. Available queries: ${Object.keys(PRODUCTION_QUERIES).join(', ')}`);
    }

    try {
      // Build parameters array
      const queryParams = queryDef.params.map(paramName => {
        if (!params[paramName]) {
          // Use defaults
          if (paramName === 'start_date') {
            const date = new Date();
            date.setDate(date.getDate() - 7);
            return date;
          }
          if (paramName === 'end_date') {
            return new Date();
          }
        }
        return params[paramName];
      });

      logger.info(`Executing query: ${queryName}`, { params: queryParams });

      const result = await pool.query(queryDef.query, queryParams);

      return {
        query: queryName,
        description: queryDef.description,
        category: queryDef.category,
        data: queryDef.returns === 'array' ? result.rows : result.rows[0],
        row_count: result.rowCount,
        executed_at: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Error executing query ${queryName}:`, error);
      throw error;
    }
  }

  /**
   * Get all available queries with descriptions
   */
  static getAvailableQueries() {
    return Object.entries(PRODUCTION_QUERIES).map(([name, def]) => ({
      name,
      description: def.description,
      category: def.category,
      params: def.params,
      returns: def.returns || 'single_value',
    }));
  }

  /**
   * Get queries by category
   */
  static getQueriesByCategory(category) {
    return Object.entries(PRODUCTION_QUERIES)
      .filter(([_, def]) => def.category === category)
      .map(([name, def]) => ({
        name,
        description: def.description,
        params: def.params,
      }));
  }

  /**
   * Get all categories
   */
  static getCategories() {
    const categories = [...new Set(
      Object.values(PRODUCTION_QUERIES).map(def => def.category)
    )];

    return categories.map(category => ({
      name: category,
      query_count: Object.values(PRODUCTION_QUERIES)
        .filter(def => def.category === category).length,
      queries: this.getQueriesByCategory(category),
    }));
  }

  /**
   * Execute multiple queries in parallel
   */
  static async executeMultiple(queries, params = {}) {
    const results = await Promise.allSettled(
      queries.map(queryName => this.executeQuery(queryName, params))
    );

    return results.map((result, index) => ({
      query: queries[index],
      status: result.status,
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null,
    }));
  }

  /**
   * Natural language query interpretation (AI-powered)
   * Maps user intent to appropriate queries
   */
  static interpretIntent(userQuery) {
    const intent = userQuery.toLowerCase();

    // Order metrics
    if (intent.includes('total orders') || intent.includes('how many orders')) {
      return ['total_orders'];
    }
    if (intent.includes('on time') || intent.includes('on-time')) {
      return ['on_time_delivery_rate'];
    }
    if (intent.includes('completion') || intent.includes('success rate')) {
      return ['order_completion_rate'];
    }
    if (intent.includes('cancel')) {
      return ['cancellation_rate'];
    }
    if (intent.includes('return')) {
      return ['return_rate'];
    }

    // Financial
    if (intent.includes('revenue') || intent.includes('money') || intent.includes('earnings')) {
      return ['total_revenue', 'average_delivery_fee', 'total_cod_collected'];
    }
    if (intent.includes('cod') || intent.includes('cash on delivery')) {
      return ['cod_percentage', 'total_cod_collected'];
    }

    // Courier
    if (intent.includes('courier') || intent.includes('driver')) {
      if (intent.includes('top') || intent.includes('best')) {
        return ['top_performing_couriers'];
      }
      return ['active_couriers', 'deliveries_per_courier', 'courier_efficiency_score'];
    }

    // Performance
    if (intent.includes('performance') || intent.includes('metrics')) {
      return ['on_time_delivery_rate', 'order_completion_rate', 'average_delivery_time'];
    }

    // Trends
    if (intent.includes('trend') || intent.includes('daily') || intent.includes('over time')) {
      return ['daily_trends'];
    }

    // Distribution
    if (intent.includes('distribution') || intent.includes('breakdown')) {
      if (intent.includes('status')) return ['order_status_distribution'];
      if (intent.includes('hour')) return ['hourly_order_distribution'];
      if (intent.includes('city') || intent.includes('location')) return ['orders_by_city'];
      return ['order_status_distribution', 'service_type_distribution'];
    }

    // SLA
    if (intent.includes('sla') || intent.includes('deadline') || intent.includes('late')) {
      return ['on_time_delivery_rate', 'sla_breach_analysis'];
    }

    // Default: return comprehensive metrics
    return ['total_orders', 'on_time_delivery_rate', 'order_completion_rate', 'average_delivery_time'];
  }
}

module.exports = DynamicQueryService;
