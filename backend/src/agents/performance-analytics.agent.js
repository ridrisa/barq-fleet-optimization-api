/**
 * Performance Analytics Agent
 * Tracks, analyzes, and reports on system performance and KPIs
 * Provides insights for continuous improvement and optimization
 */

const { logger } = require('../utils/logger');

class PerformanceAnalyticsAgent {
  constructor(config, llmManager) {
    this.config = {
      name: 'Performance Analytics',
      description: 'Analyzes system performance and generates insights',
      version: '1.0.0',
      ...config,
    };
    this.llmManager = llmManager;

    // Analytics configuration
    this.analyticsConfig = {
      // KPI definitions
      kpis: {
        SLA_COMPLIANCE: {
          target: { BARQ: 0.95, BULLET: 0.9 },
          critical: { BARQ: 0.85, BULLET: 0.8 },
          calculation: 'on_time_deliveries / total_deliveries',
          weight: 0.25,
        },
        DELIVERY_SPEED: {
          target: { BARQ: 45, BULLET: 180 }, // minutes
          critical: { BARQ: 60, BULLET: 240 },
          calculation: 'average_delivery_time',
          weight: 0.2,
        },
        DRIVER_UTILIZATION: {
          target: 0.75,
          critical: 0.6,
          calculation: 'active_time / available_time',
          weight: 0.15,
        },
        CUSTOMER_SATISFACTION: {
          target: 4.5,
          critical: 4.0,
          calculation: 'average_rating',
          weight: 0.2,
        },
        ORDER_COMPLETION: {
          target: 0.98,
          critical: 0.95,
          calculation: 'completed_orders / total_orders',
          weight: 0.1,
        },
        COST_PER_DELIVERY: {
          target: { BARQ: 5.0, BULLET: 3.0 }, // dollars
          critical: { BARQ: 7.0, BULLET: 4.5 },
          calculation: 'total_costs / completed_deliveries',
          weight: 0.1,
        },
      },

      // Metrics collection
      metrics: {
        operational: [
          'total_orders',
          'completed_orders',
          'failed_orders',
          'average_delivery_time',
          'sla_breaches',
          'driver_idle_time',
          'route_optimization_savings',
        ],
        financial: [
          'revenue',
          'costs',
          'profit_margin',
          'driver_incentives',
          'fuel_costs',
          'compensation_payouts',
        ],
        customer: [
          'average_rating',
          'complaints',
          'repeat_customers',
          'nps_score',
          'feedback_response_rate',
        ],
        system: [
          'api_response_time',
          'system_uptime',
          'agent_performance',
          'optimization_accuracy',
          'prediction_accuracy',
        ],
      },

      // Reporting configuration
      reporting: {
        intervals: ['hourly', 'daily', 'weekly', 'monthly'],
        formats: ['dashboard', 'detailed', 'executive'],
        alertThresholds: {
          critical: 0.85,
          warning: 0.9,
          info: 0.95,
        },
      },

      // Benchmarking
      benchmarks: {
        industry: {
          sla_compliance: 0.85,
          customer_satisfaction: 4.2,
          driver_utilization: 0.65,
          cost_per_delivery: 6.0,
        },
      },
    };

    // Performance data storage
    this.performanceData = new Map();

    // Historical trends
    this.trends = new Map();

    // Alerts and anomalies
    this.alerts = [];

    // Performance scores
    this.scores = new Map();

    // Analytics cache
    this.analyticsCache = new Map();

    logger.info('[PerformanceAnalytics] Agent initialized');
  }

  /**
   * Main execution method
   */
  async execute(context) {
    const startTime = Date.now();

    try {
      logger.info('[PerformanceAnalytics] Starting performance analysis');

      // Collect current metrics
      const metrics = await this.collectMetrics(context);

      // Calculate KPIs
      const kpis = this.calculateKPIs(metrics);

      // Analyze trends
      const trends = this.analyzeTrends(metrics, kpis);

      // Detect anomalies
      const anomalies = this.detectAnomalies(metrics, trends);

      // Generate performance score
      const performanceScore = this.calculatePerformanceScore(kpis);

      // Create benchmarking analysis
      const benchmarking = this.performBenchmarking(kpis);

      // Generate insights and recommendations
      const insights = await this.generateInsights(kpis, trends, anomalies, benchmarking, context);

      // Create performance report
      const report = this.createPerformanceReport(
        metrics,
        kpis,
        trends,
        insights,
        performanceScore
      );

      // Generate alerts if needed
      const alerts = this.generateAlerts(kpis, anomalies);

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        executionTime,
        metrics,
        kpis,
        trends,
        anomalies,
        performanceScore,
        benchmarking,
        insights,
        report,
        alerts,
      };
    } catch (error) {
      logger.error('[PerformanceAnalytics] Execution failed', { error: error.message });

      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Collect current metrics
   */
  async collectMetrics(context) {
    logger.info('[PerformanceAnalytics] Collecting metrics');

    const metrics = {
      timestamp: new Date(),
      period: this.determinePeriod(),
      operational: {},
      financial: {},
      customer: {},
      system: {},
      byServiceType: {
        BARQ: {},
        BULLET: {},
      },
    };

    // Collect operational metrics
    metrics.operational = await this.collectOperationalMetrics(context);

    // Collect financial metrics
    metrics.financial = await this.collectFinancialMetrics(context);

    // Collect customer metrics
    metrics.customer = await this.collectCustomerMetrics(context);

    // Collect system metrics
    metrics.system = await this.collectSystemMetrics(context);

    // Segment by service type
    metrics.byServiceType.BARQ = await this.collectServiceTypeMetrics('BARQ', context);
    metrics.byServiceType.BULLET = await this.collectServiceTypeMetrics('BULLET', context);

    // Store metrics
    this.storeMetrics(metrics);

    return metrics;
  }

  /**
   * Collect operational metrics
   */
  async collectOperationalMetrics(context) {
    const orders = await this.getOrders(context);
    const drivers = await this.getDrivers(context);

    const completed = orders.filter((o) => o.status === 'completed');
    const failed = orders.filter((o) => o.status === 'failed');
    const onTime = completed.filter((o) => this.isOnTime(o));

    // Calculate delivery times
    const deliveryTimes = completed.map((o) => this.calculateDeliveryTime(o));
    const avgDeliveryTime =
      deliveryTimes.length > 0
        ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
        : 0;

    // Calculate driver utilization
    const totalAvailable = drivers.reduce((sum, d) => sum + d.availableTime, 0);
    const totalActive = drivers.reduce((sum, d) => sum + d.activeTime, 0);
    const utilization = totalAvailable > 0 ? totalActive / totalAvailable : 0;

    return {
      total_orders: orders.length,
      completed_orders: completed.length,
      failed_orders: failed.length,
      on_time_deliveries: onTime.length,
      average_delivery_time: Math.round(avgDeliveryTime),
      sla_compliance: completed.length > 0 ? onTime.length / completed.length : 0,
      driver_utilization: utilization,
      active_drivers: drivers.filter((d) => d.status === 'active').length,
      idle_drivers: drivers.filter((d) => d.status === 'idle').length,
      orders_per_driver: drivers.length > 0 ? orders.length / drivers.length : 0,
    };
  }

  /**
   * Collect financial metrics
   */
  async collectFinancialMetrics(context) {
    const orders = await this.getOrders(context);
    const completed = orders.filter((o) => o.status === 'completed');

    // Calculate revenue
    const revenue = completed.reduce((sum, o) => {
      const price = o.serviceType === 'BARQ' ? 10 : 6; // Base prices
      return sum + price;
    }, 0);

    // Calculate costs
    const driverCosts = completed.length * 2.5; // Average driver cost
    const fuelCosts = completed.length * 0.8; // Average fuel cost
    const incentives = completed.filter((o) => o.incentivePaid).length * 2;
    const compensations = orders
      .filter((o) => o.compensationPaid)
      .reduce((sum, o) => sum + (o.compensationAmount || 0), 0);

    const totalCosts = driverCosts + fuelCosts + incentives + compensations;
    const profit = revenue - totalCosts;

    return {
      revenue: Math.round(revenue * 100) / 100,
      total_costs: Math.round(totalCosts * 100) / 100,
      driver_costs: Math.round(driverCosts * 100) / 100,
      fuel_costs: Math.round(fuelCosts * 100) / 100,
      incentives: Math.round(incentives * 100) / 100,
      compensations: Math.round(compensations * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      profit_margin: revenue > 0 ? profit / revenue : 0,
      cost_per_delivery: completed.length > 0 ? totalCosts / completed.length : 0,
    };
  }

  /**
   * Collect customer metrics
   */
  async collectCustomerMetrics(context) {
    const feedback = await this.getCustomerFeedback(context);
    const complaints = await this.getComplaints(context);

    // Calculate ratings
    const ratings = feedback.map((f) => f.rating).filter((r) => r > 0);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    // Calculate NPS
    const promoters = ratings.filter((r) => r >= 4.5).length;
    const detractors = ratings.filter((r) => r < 3.5).length;
    const nps = ratings.length > 0 ? ((promoters - detractors) / ratings.length) * 100 : 0;

    // Calculate repeat customer rate
    const customers = await this.getCustomers(context);
    const repeatCustomers = customers.filter((c) => c.orderCount > 1).length;
    const repeatRate = customers.length > 0 ? repeatCustomers / customers.length : 0;

    return {
      average_rating: Math.round(avgRating * 10) / 10,
      total_feedback: feedback.length,
      complaints: complaints.length,
      complaint_rate: feedback.length > 0 ? complaints.length / feedback.length : 0,
      nps_score: Math.round(nps),
      repeat_customer_rate: repeatRate,
      feedback_response_rate:
        feedback.filter((f) => f.responded).length / Math.max(feedback.length, 1),
      satisfaction_score: this.calculateSatisfactionScore(avgRating, nps, complaints.length),
    };
  }

  /**
   * Collect system metrics
   */
  async collectSystemMetrics(context) {
    const apiCalls = await this.getAPICalls(context);
    const agentExecutions = await this.getAgentExecutions(context);

    // Calculate API performance
    const responseTimes = apiCalls.map((call) => call.responseTime);
    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    // Calculate system uptime
    const totalTime = Date.now() - context.systemStartTime;
    const downtime = context.totalDowntime || 0;
    const uptime = (totalTime - downtime) / totalTime;

    // Calculate agent performance
    const successfulAgents = agentExecutions.filter((e) => e.success).length;
    const agentSuccessRate =
      agentExecutions.length > 0 ? successfulAgents / agentExecutions.length : 1;

    return {
      api_response_time: Math.round(avgResponseTime),
      api_success_rate: apiCalls.filter((c) => c.success).length / Math.max(apiCalls.length, 1),
      system_uptime: uptime,
      agent_success_rate: agentSuccessRate,
      total_agent_executions: agentExecutions.length,
      optimization_accuracy: this.calculateOptimizationAccuracy(context),
      prediction_accuracy: this.calculatePredictionAccuracy(context),
      error_rate: apiCalls.filter((c) => c.error).length / Math.max(apiCalls.length, 1),
    };
  }

  /**
   * Collect service type specific metrics
   */
  async collectServiceTypeMetrics(serviceType, context) {
    const orders = await this.getOrders(context);
    const serviceOrders = orders.filter((o) => o.serviceType === serviceType);
    const completed = serviceOrders.filter((o) => o.status === 'completed');

    const deliveryTimes = completed.map((o) => this.calculateDeliveryTime(o));
    const avgTime =
      deliveryTimes.length > 0
        ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
        : 0;

    const onTime = completed.filter((o) => this.isOnTime(o));

    return {
      total_orders: serviceOrders.length,
      completed: completed.length,
      failed: serviceOrders.filter((o) => o.status === 'failed').length,
      average_delivery_time: Math.round(avgTime),
      sla_compliance: completed.length > 0 ? onTime.length / completed.length : 0,
      cancellation_rate:
        serviceOrders.filter((o) => o.cancelled).length / Math.max(serviceOrders.length, 1),
    };
  }

  /**
   * Calculate KPIs
   */
  calculateKPIs(metrics) {
    logger.info('[PerformanceAnalytics] Calculating KPIs');

    const kpis = {};

    // SLA Compliance
    kpis.SLA_COMPLIANCE = {
      value: {
        overall: metrics.operational.sla_compliance,
        BARQ: metrics.byServiceType.BARQ.sla_compliance,
        BULLET: metrics.byServiceType.BULLET.sla_compliance,
      },
      target: this.analyticsConfig.kpis.SLA_COMPLIANCE.target,
      status: this.getKPIStatus(
        metrics.operational.sla_compliance,
        this.analyticsConfig.kpis.SLA_COMPLIANCE
      ),
    };

    // Delivery Speed
    kpis.DELIVERY_SPEED = {
      value: {
        overall: metrics.operational.average_delivery_time,
        BARQ: metrics.byServiceType.BARQ.average_delivery_time,
        BULLET: metrics.byServiceType.BULLET.average_delivery_time,
      },
      target: this.analyticsConfig.kpis.DELIVERY_SPEED.target,
      status: this.getDeliverySpeedStatus(metrics),
    };

    // Driver Utilization
    kpis.DRIVER_UTILIZATION = {
      value: metrics.operational.driver_utilization,
      target: this.analyticsConfig.kpis.DRIVER_UTILIZATION.target,
      status: this.getKPIStatus(
        metrics.operational.driver_utilization,
        this.analyticsConfig.kpis.DRIVER_UTILIZATION
      ),
    };

    // Customer Satisfaction
    kpis.CUSTOMER_SATISFACTION = {
      value: metrics.customer.average_rating,
      target: this.analyticsConfig.kpis.CUSTOMER_SATISFACTION.target,
      status: this.getKPIStatus(
        metrics.customer.average_rating,
        this.analyticsConfig.kpis.CUSTOMER_SATISFACTION
      ),
    };

    // Order Completion
    kpis.ORDER_COMPLETION = {
      value: metrics.operational.completed_orders / Math.max(metrics.operational.total_orders, 1),
      target: this.analyticsConfig.kpis.ORDER_COMPLETION.target,
      status: this.getKPIStatus(
        metrics.operational.completed_orders / Math.max(metrics.operational.total_orders, 1),
        this.analyticsConfig.kpis.ORDER_COMPLETION
      ),
    };

    // Cost per Delivery
    kpis.COST_PER_DELIVERY = {
      value: {
        overall: metrics.financial.cost_per_delivery,
        BARQ: this.calculateServiceCost('BARQ', metrics),
        BULLET: this.calculateServiceCost('BULLET', metrics),
      },
      target: this.analyticsConfig.kpis.COST_PER_DELIVERY.target,
      status: this.getCostStatus(metrics.financial.cost_per_delivery),
    };

    return kpis;
  }

  /**
   * Analyze trends
   */
  analyzeTrends(metrics, kpis) {
    logger.info('[PerformanceAnalytics] Analyzing trends');

    const trends = {
      period: 'last_24_hours',
      improvements: [],
      deteriorations: [],
      stable: [],
    };

    // Get historical data
    const historicalKPIs = this.getHistoricalKPIs();

    // Compare each KPI
    for (const [key, current] of Object.entries(kpis)) {
      const historical = historicalKPIs[key];

      if (!historical) {
        trends.stable.push({ kpi: key, value: current.value });
        continue;
      }

      const trend = this.calculateTrend(current.value, historical.value);

      if (trend.direction === 'improving') {
        trends.improvements.push({
          kpi: key,
          current: current.value,
          previous: historical.value,
          change: trend.percentage,
        });
      } else if (trend.direction === 'deteriorating') {
        trends.deteriorations.push({
          kpi: key,
          current: current.value,
          previous: historical.value,
          change: trend.percentage,
        });
      } else {
        trends.stable.push({
          kpi: key,
          value: current.value,
        });
      }
    }

    // Store trends
    this.trends.set(new Date().toISOString(), trends);

    return trends;
  }

  /**
   * Detect anomalies
   */
  detectAnomalies(metrics, trends) {
    logger.info('[PerformanceAnalytics] Detecting anomalies');

    const anomalies = [];

    // Check for sudden changes
    if (metrics.operational.failed_orders > metrics.operational.total_orders * 0.1) {
      anomalies.push({
        type: 'HIGH_FAILURE_RATE',
        severity: 'critical',
        value: metrics.operational.failed_orders / metrics.operational.total_orders,
        threshold: 0.1,
        message: 'Failure rate exceeds 10%',
        recommendation: 'Investigate system issues and driver availability',
      });
    }

    // Check for utilization issues
    if (metrics.operational.driver_utilization < 0.5) {
      anomalies.push({
        type: 'LOW_UTILIZATION',
        severity: 'warning',
        value: metrics.operational.driver_utilization,
        threshold: 0.5,
        message: 'Driver utilization below 50%',
        recommendation: 'Optimize driver scheduling or reduce fleet size',
      });
    } else if (metrics.operational.driver_utilization > 0.9) {
      anomalies.push({
        type: 'OVER_UTILIZATION',
        severity: 'warning',
        value: metrics.operational.driver_utilization,
        threshold: 0.9,
        message: 'Driver utilization above 90%',
        recommendation: 'Consider increasing fleet size to prevent burnout',
      });
    }

    // Check for cost anomalies
    if (metrics.financial.cost_per_delivery > 7) {
      anomalies.push({
        type: 'HIGH_COST',
        severity: 'warning',
        value: metrics.financial.cost_per_delivery,
        threshold: 7,
        message: 'Cost per delivery exceeds $7',
        recommendation: 'Review operational efficiency and compensation structure',
      });
    }

    // Check for customer satisfaction issues
    if (metrics.customer.average_rating < 4.0) {
      anomalies.push({
        type: 'LOW_SATISFACTION',
        severity: 'critical',
        value: metrics.customer.average_rating,
        threshold: 4.0,
        message: 'Customer satisfaction below 4.0',
        recommendation: 'Review service quality and customer feedback',
      });
    }

    // Check for system issues
    if (metrics.system.api_response_time > 1000) {
      anomalies.push({
        type: 'SLOW_API',
        severity: 'warning',
        value: metrics.system.api_response_time,
        threshold: 1000,
        message: 'API response time exceeds 1 second',
        recommendation: 'Optimize API performance and database queries',
      });
    }

    return anomalies;
  }

  /**
   * Calculate performance score
   */
  calculatePerformanceScore(kpis) {
    logger.info('[PerformanceAnalytics] Calculating performance score');

    let totalScore = 0;
    let totalWeight = 0;

    for (const [key, kpi] of Object.entries(kpis)) {
      const config = this.analyticsConfig.kpis[key];
      if (!config) continue;

      // Calculate score based on achievement vs target
      let score = 0;

      if (key === 'DELIVERY_SPEED' || key === 'COST_PER_DELIVERY') {
        // Lower is better
        const value = typeof kpi.value === 'object' ? kpi.value.overall : kpi.value;
        const target = typeof config.target === 'object' ? config.target.BARQ : config.target;
        score = Math.max(0, Math.min(1, target / value));
      } else {
        // Higher is better
        const value = typeof kpi.value === 'object' ? kpi.value.overall : kpi.value;
        score = Math.max(0, Math.min(1, value / config.target));
      }

      totalScore += score * config.weight;
      totalWeight += config.weight;
    }

    const overallScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    const performanceScore = {
      overall: Math.round(overallScore * 100),
      grade: this.getPerformanceGrade(overallScore),
      breakdown: {},
      timestamp: new Date(),
    };

    // Add breakdown by KPI
    for (const [key, kpi] of Object.entries(kpis)) {
      performanceScore.breakdown[key] = {
        status: kpi.status,
        achievement: this.calculateAchievement(kpi),
      };
    }

    // Store score
    this.scores.set(new Date().toISOString(), performanceScore);

    return performanceScore;
  }

  /**
   * Perform benchmarking
   */
  performBenchmarking(kpis) {
    logger.info('[PerformanceAnalytics] Performing benchmarking');

    const benchmarking = {
      vs_industry: {},
      vs_target: {},
      competitive_position: null,
    };

    const industryBenchmarks = this.analyticsConfig.benchmarks.industry;

    // Compare against industry benchmarks
    benchmarking.vs_industry.sla_compliance = {
      ours: kpis.SLA_COMPLIANCE.value.overall,
      industry: industryBenchmarks.sla_compliance,
      delta: kpis.SLA_COMPLIANCE.value.overall - industryBenchmarks.sla_compliance,
      position:
        kpis.SLA_COMPLIANCE.value.overall > industryBenchmarks.sla_compliance ? 'above' : 'below',
    };

    benchmarking.vs_industry.customer_satisfaction = {
      ours: kpis.CUSTOMER_SATISFACTION.value,
      industry: industryBenchmarks.customer_satisfaction,
      delta: kpis.CUSTOMER_SATISFACTION.value - industryBenchmarks.customer_satisfaction,
      position:
        kpis.CUSTOMER_SATISFACTION.value > industryBenchmarks.customer_satisfaction
          ? 'above'
          : 'below',
    };

    benchmarking.vs_industry.driver_utilization = {
      ours: kpis.DRIVER_UTILIZATION.value,
      industry: industryBenchmarks.driver_utilization,
      delta: kpis.DRIVER_UTILIZATION.value - industryBenchmarks.driver_utilization,
      position:
        kpis.DRIVER_UTILIZATION.value > industryBenchmarks.driver_utilization ? 'above' : 'below',
    };

    // Compare against targets
    for (const [key, kpi] of Object.entries(kpis)) {
      const value = typeof kpi.value === 'object' ? kpi.value.overall : kpi.value;
      const target = typeof kpi.target === 'object' ? kpi.target.BARQ : kpi.target;

      benchmarking.vs_target[key] = {
        value,
        target,
        achievement: this.calculateAchievement(kpi),
        gap: Math.abs(value - target),
      };
    }

    // Determine competitive position
    const aboveIndustry = Object.values(benchmarking.vs_industry).filter(
      (b) => b.position === 'above'
    ).length;

    if (aboveIndustry >= 3) {
      benchmarking.competitive_position = 'LEADER';
    } else if (aboveIndustry >= 2) {
      benchmarking.competitive_position = 'COMPETITIVE';
    } else if (aboveIndustry >= 1) {
      benchmarking.competitive_position = 'AVERAGE';
    } else {
      benchmarking.competitive_position = 'LAGGING';
    }

    return benchmarking;
  }

  /**
   * Generate insights
   */
  async generateInsights(kpis, trends, anomalies, benchmarking, context) {
    logger.info('[PerformanceAnalytics] Generating insights');

    const insights = [];

    // KPI-based insights
    for (const [key, kpi] of Object.entries(kpis)) {
      if (kpi.status === 'critical') {
        insights.push({
          type: 'KPI_CRITICAL',
          kpi: key,
          priority: 'high',
          message: `${key} is in critical state`,
          recommendation: this.getKPIRecommendation(key, kpi),
          impact: 'Immediate action required to prevent service degradation',
        });
      }
    }

    // Trend-based insights
    if (trends.deteriorations.length > 2) {
      insights.push({
        type: 'MULTIPLE_DETERIORATIONS',
        priority: 'high',
        metrics: trends.deteriorations.map((d) => d.kpi),
        message: 'Multiple KPIs showing negative trends',
        recommendation: 'Conduct comprehensive operational review',
        impact: 'Risk of overall service quality decline',
      });
    }

    if (trends.improvements.length > 3) {
      insights.push({
        type: 'STRONG_IMPROVEMENT',
        priority: 'info',
        metrics: trends.improvements.map((i) => i.kpi),
        message: 'Strong positive performance trend',
        recommendation: 'Document and replicate successful strategies',
        impact: 'Opportunity to set new performance standards',
      });
    }

    // Anomaly-based insights
    for (const anomaly of anomalies) {
      insights.push({
        type: `ANOMALY_${anomaly.type}`,
        priority: anomaly.severity,
        message: anomaly.message,
        recommendation: anomaly.recommendation,
        impact: this.assessAnomalyImpact(anomaly),
      });
    }

    // Benchmarking insights
    if (benchmarking.competitive_position === 'LEADER') {
      insights.push({
        type: 'MARKET_LEADER',
        priority: 'info',
        message: 'Performance exceeds industry standards',
        recommendation: 'Maintain excellence and consider premium positioning',
        impact: 'Strong competitive advantage',
      });
    } else if (benchmarking.competitive_position === 'LAGGING') {
      insights.push({
        type: 'BELOW_INDUSTRY',
        priority: 'high',
        message: 'Performance below industry standards',
        recommendation: 'Urgent improvement program required',
        impact: 'Risk of losing market share',
      });
    }

    // Service-specific insights
    if (kpis.SLA_COMPLIANCE.value.BARQ < kpis.SLA_COMPLIANCE.value.BULLET) {
      insights.push({
        type: 'BARQ_UNDERPERFORMING',
        priority: 'high',
        message: 'BARQ service underperforming compared to BULLET',
        recommendation: 'Review BARQ operations and driver allocation',
        impact: 'Premium service not meeting expectations',
      });
    }

    // Cost efficiency insights
    const costEfficiency = kpis.COST_PER_DELIVERY.value.overall;
    const revenue = context.metrics?.financial?.revenue || 0;

    if (costEfficiency > 0 && revenue > 0) {
      const margin = (revenue - costEfficiency * kpis.ORDER_COMPLETION.value) / revenue;

      if (margin < 0.2) {
        insights.push({
          type: 'LOW_MARGIN',
          priority: 'high',
          message: `Profit margin only ${Math.round(margin * 100)}%`,
          recommendation: 'Optimize costs or increase pricing',
          impact: 'Business sustainability at risk',
        });
      }
    }

    return insights;
  }

  /**
   * Create performance report
   */
  createPerformanceReport(metrics, kpis, trends, insights, performanceScore) {
    logger.info('[PerformanceAnalytics] Creating performance report');

    const report = {
      id: `report_${Date.now()}`,
      timestamp: new Date(),
      period: this.determinePeriod(),
      executive_summary: {
        overall_score: performanceScore.overall,
        grade: performanceScore.grade,
        key_achievements: this.identifyAchievements(kpis),
        critical_issues: insights.filter((i) => i.priority === 'high'),
        recommendations: this.prioritizeRecommendations(insights),
      },
      detailed_metrics: {
        operational: metrics.operational,
        financial: metrics.financial,
        customer: metrics.customer,
        system: metrics.system,
      },
      kpi_performance: kpis,
      trend_analysis: trends,
      insights: insights,
      action_items: this.generateActionItems(insights, kpis),
      next_review: this.getNextReviewDate(),
    };

    // Cache report
    this.analyticsCache.set('latest_report', report);

    return report;
  }

  /**
   * Generate alerts
   */
  generateAlerts(kpis, anomalies) {
    logger.info('[PerformanceAnalytics] Generating alerts');

    const alerts = [];

    // Check KPI alerts
    for (const [key, kpi] of Object.entries(kpis)) {
      if (kpi.status === 'critical') {
        alerts.push({
          id: `alert_${Date.now()}_${key}`,
          type: 'KPI_CRITICAL',
          kpi: key,
          severity: 'critical',
          message: `${key} has reached critical level`,
          value: kpi.value,
          threshold: kpi.target,
          timestamp: new Date(),
          actions: ['notify_management', 'escalate_to_operations'],
        });
      } else if (kpi.status === 'warning') {
        alerts.push({
          id: `alert_${Date.now()}_${key}`,
          type: 'KPI_WARNING',
          kpi: key,
          severity: 'warning',
          message: `${key} approaching critical threshold`,
          value: kpi.value,
          threshold: kpi.target,
          timestamp: new Date(),
          actions: ['monitor_closely'],
        });
      }
    }

    // Check anomaly alerts
    for (const anomaly of anomalies) {
      if (anomaly.severity === 'critical') {
        alerts.push({
          id: `alert_${Date.now()}_${anomaly.type}`,
          type: 'ANOMALY',
          anomaly: anomaly.type,
          severity: anomaly.severity,
          message: anomaly.message,
          value: anomaly.value,
          threshold: anomaly.threshold,
          timestamp: new Date(),
          actions: ['investigate', 'implement_countermeasures'],
        });
      }
    }

    // Store alerts
    this.alerts.push(...alerts);

    return alerts;
  }

  /**
   * Helper methods
   */

  determinePeriod() {
    const now = new Date();
    const hour = now.getHours();

    if (hour === 0) return 'daily';
    if (now.getDay() === 1 && hour === 0) return 'weekly';
    if (now.getDate() === 1 && hour === 0) return 'monthly';
    return 'hourly';
  }

  isOnTime(order) {
    if (!order.deliveredAt || !order.promisedAt) return false;

    const delivered = new Date(order.deliveredAt);
    const promised = new Date(order.promisedAt);

    return delivered <= promised;
  }

  calculateDeliveryTime(order) {
    if (!order.createdAt || !order.deliveredAt) return 0;

    const created = new Date(order.createdAt);
    const delivered = new Date(order.deliveredAt);

    return (delivered - created) / 60000; // Return in minutes
  }

  getKPIStatus(value, kpiConfig) {
    const target = typeof kpiConfig.target === 'object' ? kpiConfig.target.BARQ : kpiConfig.target;
    const critical =
      typeof kpiConfig.critical === 'object' ? kpiConfig.critical.BARQ : kpiConfig.critical;

    if (value >= target) return 'good';
    if (value >= critical) return 'warning';
    return 'critical';
  }

  getDeliverySpeedStatus(metrics) {
    const barqTime = metrics.byServiceType.BARQ.average_delivery_time;
    const bulletTime = metrics.byServiceType.BULLET.average_delivery_time;

    const barqTarget = this.analyticsConfig.kpis.DELIVERY_SPEED.target.BARQ;
    const bulletTarget = this.analyticsConfig.kpis.DELIVERY_SPEED.target.BULLET;

    if (barqTime <= barqTarget && bulletTime <= bulletTarget) return 'good';
    if (barqTime <= barqTarget * 1.2 && bulletTime <= bulletTarget * 1.2) return 'warning';
    return 'critical';
  }

  getCostStatus(cost) {
    const target = this.analyticsConfig.kpis.COST_PER_DELIVERY.target.BARQ;
    const critical = this.analyticsConfig.kpis.COST_PER_DELIVERY.critical.BARQ;

    if (cost <= target) return 'good';
    if (cost <= critical) return 'warning';
    return 'critical';
  }

  calculateServiceCost(serviceType, metrics) {
    const orders = metrics.byServiceType[serviceType].completed;
    if (orders === 0) return 0;

    // Estimate service-specific costs
    const baseCost = serviceType === 'BARQ' ? 3.5 : 2.0;
    const operationalCost = metrics.financial.total_costs / metrics.operational.completed_orders;

    return baseCost + operationalCost * 0.5;
  }

  calculateSatisfactionScore(rating, nps, complaints) {
    // Weighted satisfaction score
    const ratingScore = (rating / 5) * 0.5;
    const npsScore = ((nps + 100) / 200) * 0.3;
    const complaintScore = Math.max(0, 1 - complaints / 100) * 0.2;

    return Math.round((ratingScore + npsScore + complaintScore) * 100);
  }

  calculateOptimizationAccuracy(context) {
    // Mock calculation - would check actual vs predicted optimization savings
    return 0.85 + Math.random() * 0.1;
  }

  calculatePredictionAccuracy(context) {
    // Mock calculation - would check actual vs predicted metrics
    return 0.8 + Math.random() * 0.15;
  }

  calculateTrend(current, historical) {
    if (typeof current === 'object') {
      current = current.overall || current.BARQ || 0;
    }
    if (typeof historical === 'object') {
      historical = historical.overall || historical.BARQ || 0;
    }

    const change = current - historical;
    const percentage = historical !== 0 ? (change / historical) * 100 : 0;

    return {
      direction: change > 0 ? 'improving' : change < 0 ? 'deteriorating' : 'stable',
      percentage: Math.round(percentage),
    };
  }

  getPerformanceGrade(score) {
    if (score >= 0.95) return 'A+';
    if (score >= 0.9) return 'A';
    if (score >= 0.85) return 'B+';
    if (score >= 0.8) return 'B';
    if (score >= 0.75) return 'C+';
    if (score >= 0.7) return 'C';
    if (score >= 0.65) return 'D';
    return 'F';
  }

  calculateAchievement(kpi) {
    const value = typeof kpi.value === 'object' ? kpi.value.overall : kpi.value;
    const target = typeof kpi.target === 'object' ? kpi.target.BARQ : kpi.target;

    // For metrics where lower is better
    if (kpi.target.BARQ && value > target) {
      return Math.max(0, Math.min(1, target / value));
    }

    return Math.min(1, value / target);
  }

  getKPIRecommendation(key, kpi) {
    const recommendations = {
      SLA_COMPLIANCE: 'Increase driver capacity and optimize route planning',
      DELIVERY_SPEED: 'Review traffic patterns and implement dynamic routing',
      DRIVER_UTILIZATION: 'Balance workload distribution and scheduling',
      CUSTOMER_SATISFACTION: 'Enhance communication and service quality',
      ORDER_COMPLETION: 'Improve order assignment and recovery processes',
      COST_PER_DELIVERY: 'Optimize routes and reduce operational inefficiencies',
    };

    return recommendations[key] || 'Review operational processes';
  }

  assessAnomalyImpact(anomaly) {
    const impacts = {
      HIGH_FAILURE_RATE: 'Revenue loss and customer dissatisfaction',
      LOW_UTILIZATION: 'Increased operational costs',
      OVER_UTILIZATION: 'Driver burnout and service degradation',
      HIGH_COST: 'Reduced profitability',
      LOW_SATISFACTION: 'Customer churn and reputation damage',
      SLOW_API: 'Poor user experience',
    };

    return impacts[anomaly.type] || 'Operational efficiency impact';
  }

  identifyAchievements(kpis) {
    const achievements = [];

    for (const [key, kpi] of Object.entries(kpis)) {
      if (kpi.status === 'good' && this.calculateAchievement(kpi) >= 1) {
        achievements.push(`${key} exceeds target`);
      }
    }

    return achievements;
  }

  prioritizeRecommendations(insights) {
    return insights
      .filter((i) => i.recommendation)
      .sort((a, b) => {
        const priorityOrder = { high: 0, warning: 1, info: 2 };
        return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
      })
      .slice(0, 5)
      .map((i) => i.recommendation);
  }

  generateActionItems(insights, kpis) {
    const actionItems = [];

    // Generate actions based on insights
    for (const insight of insights) {
      if (insight.priority === 'high') {
        actionItems.push({
          action: insight.recommendation,
          priority: insight.priority,
          owner: 'Operations Team',
          deadline: new Date(Date.now() + 24 * 3600000), // 24 hours
        });
      }
    }

    // Add KPI-specific actions
    for (const [key, kpi] of Object.entries(kpis)) {
      if (kpi.status === 'critical') {
        actionItems.push({
          action: `Improve ${key} performance`,
          priority: 'critical',
          owner: 'Management',
          deadline: new Date(Date.now() + 12 * 3600000), // 12 hours
        });
      }
    }

    return actionItems;
  }

  getNextReviewDate() {
    const now = new Date();
    const period = this.determinePeriod();

    switch (period) {
      case 'hourly':
        return new Date(now.getTime() + 3600000);
      case 'daily':
        return new Date(now.getTime() + 24 * 3600000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 3600000);
      case 'monthly':
        return new Date(now.getTime() + 30 * 24 * 3600000);
      default:
        return new Date(now.getTime() + 3600000);
    }
  }

  storeMetrics(metrics) {
    const key = `metrics_${new Date().toISOString()}`;
    this.performanceData.set(key, metrics);

    // Keep only last 100 entries
    if (this.performanceData.size > 100) {
      const keys = Array.from(this.performanceData.keys());
      this.performanceData.delete(keys[0]);
    }
  }

  getHistoricalKPIs() {
    // Get previous KPIs for comparison
    const historical = {};

    // Mock historical data - would retrieve from database
    historical.SLA_COMPLIANCE = { value: { overall: 0.92, BARQ: 0.9, BULLET: 0.94 } };
    historical.DELIVERY_SPEED = { value: { overall: 35, BARQ: 50, BULLET: 150 } };
    historical.DRIVER_UTILIZATION = { value: 0.7 };
    historical.CUSTOMER_SATISFACTION = { value: 4.3 };
    historical.ORDER_COMPLETION = { value: 0.96 };
    historical.COST_PER_DELIVERY = { value: { overall: 4.5, BARQ: 5.5, BULLET: 3.5 } };

    return historical;
  }

  // Mock data retrieval methods

  async getOrders(context) {
    // Mock orders data
    const orders = [];
    const count = 100 + Math.floor(Math.random() * 50);

    for (let i = 0; i < count; i++) {
      const isCompleted = Math.random() > 0.05;
      const serviceType = Math.random() > 0.3 ? 'BULLET' : 'BARQ';
      const createdAt = new Date(Date.now() - Math.random() * 3600000);
      const deliveredAt = isCompleted
        ? new Date(
            createdAt.getTime() +
              (serviceType === 'BARQ' ? 45 : 120) * 60000 +
              Math.random() * 30 * 60000
          )
        : null;

      orders.push({
        id: `order_${i}`,
        serviceType,
        status: isCompleted ? 'completed' : Math.random() > 0.5 ? 'in_progress' : 'failed',
        createdAt,
        deliveredAt,
        promisedAt: new Date(createdAt.getTime() + (serviceType === 'BARQ' ? 60 : 240) * 60000),
        compensationPaid: Math.random() > 0.95,
        compensationAmount: Math.random() > 0.95 ? 5 + Math.random() * 10 : 0,
        incentivePaid: Math.random() > 0.8,
      });
    }

    return orders;
  }

  async getDrivers(context) {
    // Mock drivers data
    const drivers = [];
    const count = 20 + Math.floor(Math.random() * 10);

    for (let i = 0; i < count; i++) {
      drivers.push({
        id: `driver_${i}`,
        status: Math.random() > 0.3 ? 'active' : 'idle',
        availableTime: 8 * 60, // 8 hours in minutes
        activeTime: Math.floor(Math.random() * 7 * 60), // 0-7 hours
        completedDeliveries: Math.floor(Math.random() * 20),
        rating: 3.5 + Math.random() * 1.5,
      });
    }

    return drivers;
  }

  async getCustomerFeedback(context) {
    // Mock feedback data
    const feedback = [];
    const count = 30 + Math.floor(Math.random() * 20);

    for (let i = 0; i < count; i++) {
      feedback.push({
        id: `feedback_${i}`,
        rating: Math.floor(3 + Math.random() * 2.5),
        responded: Math.random() > 0.3,
        timestamp: new Date(Date.now() - Math.random() * 86400000),
      });
    }

    return feedback;
  }

  async getComplaints(context) {
    // Mock complaints data
    const complaints = [];
    const count = Math.floor(Math.random() * 10);

    for (let i = 0; i < count; i++) {
      complaints.push({
        id: `complaint_${i}`,
        type: ['late_delivery', 'damaged_package', 'driver_behavior'][
          Math.floor(Math.random() * 3)
        ],
        resolved: Math.random() > 0.4,
        timestamp: new Date(Date.now() - Math.random() * 86400000),
      });
    }

    return complaints;
  }

  async getCustomers(context) {
    // Mock customers data
    const customers = [];
    const count = 50 + Math.floor(Math.random() * 50);

    for (let i = 0; i < count; i++) {
      customers.push({
        id: `customer_${i}`,
        orderCount: Math.floor(1 + Math.random() * 20),
        joinedAt: new Date(Date.now() - Math.random() * 365 * 86400000),
      });
    }

    return customers;
  }

  async getAPICalls(context) {
    // Mock API calls data
    const calls = [];
    const count = 500 + Math.floor(Math.random() * 500);

    for (let i = 0; i < count; i++) {
      calls.push({
        id: `api_${i}`,
        endpoint: ['/optimize', '/status', '/assign'][Math.floor(Math.random() * 3)],
        responseTime: 50 + Math.random() * 500,
        success: Math.random() > 0.02,
        error: Math.random() < 0.02,
        timestamp: new Date(Date.now() - Math.random() * 3600000),
      });
    }

    return calls;
  }

  async getAgentExecutions(context) {
    // Mock agent executions data
    const executions = [];
    const count = 100 + Math.floor(Math.random() * 100);

    for (let i = 0; i < count; i++) {
      executions.push({
        id: `exec_${i}`,
        agent: ['fleet-status', 'sla-monitor', 'order-assignment'][Math.floor(Math.random() * 3)],
        success: Math.random() > 0.05,
        executionTime: 100 + Math.random() * 2000,
        timestamp: new Date(Date.now() - Math.random() * 3600000),
      });
    }

    return executions;
  }

  /**
   * Check agent health
   */
  isHealthy() {
    const latestReport = this.analyticsCache.get('latest_report');

    return {
      healthy: true,
      name: this.config.name,
      metricsCollected: this.performanceData.size,
      alertsActive: this.alerts.filter((a) => a.severity === 'critical').length,
      lastReport: latestReport?.timestamp || null,
      overallScore: latestReport?.executive_summary?.overall_score || 0,
    };
  }

  /**
   * Get current performance metrics (for autonomous orchestrator)
   */
  async getMetrics() {
    try {
      const performance = await this.execute({});
      return {
        onTimeDeliveryRate: performance.slaCompliance?.onTimeRate || 0.95,
        averageDeliveryTime: performance.deliveryMetrics?.avgTime || 25,
        courierUtilization: performance.courierMetrics?.utilization || 0.75,
        customerSatisfaction: performance.customerMetrics?.satisfaction || 4.5,
        activeOrders: performance.orderMetrics?.active || 0,
        completedToday: performance.orderMetrics?.completedToday || 0,
        timestamp: performance.timestamp || Date.now(),
      };
    } catch (error) {
      const { logger } = require('../utils/logger');
      logger.error('[PerformanceAnalytics] getMetrics() failed', { error: error.message });
      return {
        onTimeDeliveryRate: 0.95,
        averageDeliveryTime: 25,
        courierUtilization: 0.75,
        customerSatisfaction: 4.5,
        activeOrders: 0,
        completedToday: 0,
        timestamp: Date.now(),
      };
    }
  }
}

module.exports = PerformanceAnalyticsAgent;
