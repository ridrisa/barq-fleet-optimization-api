/**
 * AI Metrics Routes
 * API endpoints for AI agent usage monitoring, cost tracking, and performance metrics
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize, ROLES } = require('../../middleware/auth.middleware');
const { logger } = require('../../utils/logger');
const { asyncHandler } = require('../../middleware/error.middleware');
const databaseService = require('../../services/database.service');

/**
 * @swagger
 * /api/admin/ai/metrics:
 *   get:
 *     summary: Get AI usage metrics and costs
 *     description: Retrieve aggregated AI insights usage, costs, and performance metrics
 *     tags: [Admin, AI]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for metrics (ISO format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for metrics (ISO format)
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *         description: Filter by AI provider (groq, gemini, claude, gpt)
 *     responses:
 *       200:
 *         description: AI metrics retrieved successfully
 */
router.get(
  '/metrics',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const { startDate, endDate, provider } = req.query;

    try {
      // Calculate date range
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days

      logger.info('[AI Metrics] Fetching AI usage metrics', {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        provider,
      });

      // Get all optimization history with AI insights
      const query = `
        SELECT
          id,
          request_id,
          metadata,
          created_at,
          optimized_at,
          status
        FROM route_optimizations
        WHERE created_at >= $1 AND created_at <= $2
        ORDER BY created_at DESC
      `;

      const result = await databaseService.query(query, [start, end]);
      const optimizations = result.rows;

      // Extract AI insights from metadata
      const aiInsights = [];
      const providerStats = {};
      let totalCost = 0;
      let totalTokens = 0;
      let totalCalls = 0;

      optimizations.forEach((opt) => {
        const metadata = opt.metadata || {};
        const aiData = metadata.aiInsights || metadata.ai_insights || {};

        if (aiData && Object.keys(aiData).length > 0) {
          // Extract provider information
          const aiProvider = aiData.model?.includes('gemini')
            ? 'gemini'
            : aiData.model?.includes('claude')
              ? 'claude'
              : aiData.model?.includes('gpt')
                ? 'gpt'
                : aiData.provider || 'unknown';

          // Skip if filtering by provider and this doesn't match
          if (provider && aiProvider !== provider) {
            return;
          }

          const insight = {
            request_id: opt.request_id,
            timestamp: opt.created_at,
            provider: aiProvider,
            model: aiData.model || 'unknown',
            tokens: aiData.tokens || aiData.usage?.total_tokens || 0,
            cost: aiData.cost || 0,
            response_time: aiData.response_time || aiData.responseTime || 0,
            success: aiData.success !== false,
          };

          aiInsights.push(insight);
          totalCalls++;
          totalTokens += insight.tokens;
          totalCost += insight.cost;

          // Aggregate by provider
          if (!providerStats[aiProvider]) {
            providerStats[aiProvider] = {
              provider: aiProvider,
              calls: 0,
              tokens: 0,
              cost: 0,
              avgResponseTime: 0,
              successRate: 0,
              successCount: 0,
            };
          }

          const stats = providerStats[aiProvider];
          stats.calls++;
          stats.tokens += insight.tokens;
          stats.cost += insight.cost;
          stats.avgResponseTime += insight.response_time;
          if (insight.success) stats.successCount++;
        }
      });

      // Calculate averages
      Object.values(providerStats).forEach((stats) => {
        stats.avgResponseTime = stats.calls > 0 ? stats.avgResponseTime / stats.calls : 0;
        stats.successRate = stats.calls > 0 ? (stats.successCount / stats.calls) * 100 : 0;
      });

      // Get agent-specific metrics from LLM Fleet Advisor calls
      const agentMetrics = {
        fleetAdvisor: {
          name: 'Fleet Advisor',
          calls: 0,
          avgCost: 0,
          provider: 'groq',
        },
        analyst: {
          name: 'Performance Analyst',
          calls: 0,
          avgCost: 0,
          provider: 'claude',
        },
      };

      // Cost trend by day
      const costByDay = {};
      aiInsights.forEach((insight) => {
        const day = new Date(insight.timestamp).toISOString().split('T')[0];
        if (!costByDay[day]) {
          costByDay[day] = { date: day, cost: 0, calls: 0 };
        }
        costByDay[day].cost += insight.cost;
        costByDay[day].calls++;
      });

      const responseTime = Date.now() - startTime;
      logger.info('[AI Metrics] Metrics calculated successfully', {
        totalCalls,
        totalCost: totalCost.toFixed(4),
        providers: Object.keys(providerStats).length,
        responseTime,
      });

      res.json({
        success: true,
        data: {
          summary: {
            totalCalls,
            totalTokens,
            totalCost: parseFloat(totalCost.toFixed(4)),
            avgCostPerCall: totalCalls > 0 ? parseFloat((totalCost / totalCalls).toFixed(4)) : 0,
            avgTokensPerCall: totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0,
            dateRange: {
              start: start.toISOString(),
              end: end.toISOString(),
            },
          },
          providers: Object.values(providerStats).map((stats) => ({
            ...stats,
            cost: parseFloat(stats.cost.toFixed(4)),
            avgCost: parseFloat((stats.cost / stats.calls).toFixed(4)),
            avgResponseTime: Math.round(stats.avgResponseTime),
            successRate: parseFloat(stats.successRate.toFixed(2)),
          })),
          agents: Object.values(agentMetrics),
          costTrend: Object.values(costByDay).sort((a, b) => a.date.localeCompare(b.date)),
          recentCalls: aiInsights.slice(0, 50).map((insight) => ({
            ...insight,
            cost: parseFloat(insight.cost.toFixed(4)),
          })),
        },
        meta: {
          timestamp: Date.now(),
          responseTime,
          optimizationsAnalyzed: optimizations.length,
        },
      });
    } catch (error) {
      logger.error('[AI Metrics] Failed to fetch AI metrics', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

/**
 * @swagger
 * /api/admin/ai/providers:
 *   get:
 *     summary: Get available AI providers status
 *     description: Check status and configuration of all AI providers
 *     tags: [Admin, AI]
 *     responses:
 *       200:
 *         description: Provider status retrieved successfully
 */
router.get(
  '/providers',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const providers = [
      {
        name: 'Groq',
        id: 'groq',
        enabled: !!process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        use_case: 'Fast inference for Fleet Advisor',
        estimatedCostPer1k: 0.0001,
      },
      {
        name: 'Google Gemini',
        id: 'gemini',
        enabled: !!process.env.GOOGLE_AI_API_KEY,
        model: 'gemini-2.0-flash-exp',
        use_case: 'Parameter tuning and quick suggestions',
        estimatedCostPer1k: 0.001,
      },
      {
        name: 'Anthropic Claude',
        id: 'claude',
        enabled: !!process.env.ANTHROPIC_API_KEY,
        model: 'claude-opus',
        use_case: 'Performance analysis and insights',
        estimatedCostPer1k: 0.035,
      },
      {
        name: 'OpenAI GPT',
        id: 'gpt',
        enabled: !!process.env.OPENAI_API_KEY,
        model: 'gpt-4',
        use_case: 'Complex strategy comparison',
        estimatedCostPer1k: 0.025,
      },
    ];

    res.json({
      success: true,
      data: {
        providers,
        activeProviders: providers.filter((p) => p.enabled).length,
        totalProviders: providers.length,
      },
    });
  })
);

/**
 * @swagger
 * /api/admin/ai/cost-analysis:
 *   get:
 *     summary: Get detailed cost analysis
 *     description: Breakdown of AI costs by provider, agent, and time period
 *     tags: [Admin, AI]
 *     parameters:
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *         description: Time period grouping
 *     responses:
 *       200:
 *         description: Cost analysis retrieved successfully
 */
router.get(
  '/cost-analysis',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { groupBy = 'day' } = req.query;
    const startTime = Date.now();

    try {
      // Get last 90 days of data
      const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const end = new Date();

      const query = `
        SELECT
          metadata,
          created_at
        FROM route_optimizations
        WHERE created_at >= $1 AND created_at <= $2
        AND metadata IS NOT NULL
        ORDER BY created_at DESC
      `;

      const result = await databaseService.query(query, [start, end]);

      // Process cost data
      const costData = {};
      let totalSpend = 0;

      result.rows.forEach((row) => {
        const aiData = row.metadata?.aiInsights || row.metadata?.ai_insights || {};
        const cost = aiData.cost || 0;

        if (cost > 0) {
          const date = new Date(row.created_at);
          let key;

          switch (groupBy) {
            case 'week':
              const weekNum = Math.floor((date - new Date(date.getFullYear(), 0, 1)) / 604800000);
              key = `${date.getFullYear()}-W${weekNum}`;
              break;
            case 'month':
              key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              break;
            default:
              key = date.toISOString().split('T')[0];
          }

          if (!costData[key]) {
            costData[key] = { period: key, cost: 0, calls: 0 };
          }

          costData[key].cost += cost;
          costData[key].calls++;
          totalSpend += cost;
        }
      });

      const costTrend = Object.values(costData).sort((a, b) => a.period.localeCompare(b.period));

      // Project monthly cost
      const daysElapsed = Math.min(30, (end - start) / (24 * 60 * 60 * 1000));
      const projectedMonthlyCost = daysElapsed > 0 ? (totalSpend / daysElapsed) * 30 : 0;

      res.json({
        success: true,
        data: {
          totalSpend: parseFloat(totalSpend.toFixed(4)),
          projectedMonthlyCost: parseFloat(projectedMonthlyCost.toFixed(2)),
          costTrend,
          groupBy,
        },
        meta: {
          timestamp: Date.now(),
          responseTime: Date.now() - startTime,
        },
      });
    } catch (error) {
      logger.error('[AI Metrics] Failed to fetch cost analysis', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

module.exports = router;
