/**
 * AI-Powered Query Routes
 * Enables GPT/AI to execute any production query dynamically
 */

const express = require('express');
const router = express.Router();
const DynamicQueryService = require('../../services/dynamic-query.service');
const { logger } = require('../../utils/logger');

/**
 * GET /api/v1/ai-query/catalog
 * Get complete catalog of available queries
 */
router.get('/catalog', (req, res) => {
  try {
    const queries = DynamicQueryService.getAvailableQueries();

    res.json({
      success: true,
      total_queries: queries.length,
      queries,
      usage: {
        execute_single: 'POST /api/v1/ai-query/execute',
        execute_multiple: 'POST /api/v1/ai-query/execute-batch',
        natural_language: 'POST /api/v1/ai-query/ask',
      },
    });
  } catch (error) {
    logger.error('Error getting query catalog:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get query catalog',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/ai-query/categories
 * Get queries organized by category
 */
router.get('/categories', (req, res) => {
  try {
    const categories = DynamicQueryService.getCategories();

    res.json({
      success: true,
      total_categories: categories.length,
      categories,
    });
  } catch (error) {
    logger.error('Error getting categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get categories',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/ai-query/execute
 * Execute a specific query by name
 *
 * Body:
 * {
 *   "query": "total_orders",
 *   "params": {
 *     "start_date": "2025-11-01",
 *     "end_date": "2025-11-08"
 *   }
 * }
 */
router.post('/execute', async (req, res) => {
  try {
    const { query, params = {} } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query name is required',
        example: {
          query: 'total_orders',
          params: {
            start_date: '2025-11-01',
            end_date: '2025-11-08',
          },
        },
      });
    }

    // Convert string dates to Date objects if provided
    const processedParams = {};
    if (params.start_date) {
      processedParams.start_date = new Date(params.start_date);
    }
    if (params.end_date) {
      processedParams.end_date = new Date(params.end_date);
    }

    const result = await DynamicQueryService.executeQuery(query, processedParams);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Error executing query:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute query',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/ai-query/execute-batch
 * Execute multiple queries in parallel
 *
 * Body:
 * {
 *   "queries": ["total_orders", "on_time_delivery_rate", "active_couriers"],
 *   "params": {
 *     "start_date": "2025-11-01",
 *     "end_date": "2025-11-08"
 *   }
 * }
 */
router.post('/execute-batch', async (req, res) => {
  try {
    const { queries, params = {} } = req.body;

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Queries array is required',
        example: {
          queries: ['total_orders', 'on_time_delivery_rate'],
          params: {
            start_date: '2025-11-01',
            end_date: '2025-11-08',
          },
        },
      });
    }

    // Convert string dates to Date objects if provided
    const processedParams = {};
    if (params.start_date) {
      processedParams.start_date = new Date(params.start_date);
    }
    if (params.end_date) {
      processedParams.end_date = new Date(params.end_date);
    }

    const results = await DynamicQueryService.executeMultiple(queries, processedParams);

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    res.json({
      success: true,
      total_queries: queries.length,
      successful,
      failed,
      results,
      executed_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error executing batch queries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute batch queries',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/ai-query/ask
 * Natural language query - AI interprets intent and executes appropriate queries
 *
 * Body:
 * {
 *   "question": "What's the on-time delivery rate for last week?",
 *   "params": {
 *     "start_date": "2025-11-01",
 *     "end_date": "2025-11-08"
 *   }
 * }
 */
router.post('/ask', async (req, res) => {
  try {
    const { question, params = {} } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Question is required',
        examples: [
          "What's the on-time delivery rate?",
          'Show me top performing couriers',
          'How many orders were cancelled?',
          'What are the daily trends?',
          'Show me revenue metrics',
        ],
      });
    }

    // AI interprets the question to determine which queries to run
    const suggestedQueries = DynamicQueryService.interpretIntent(question);

    logger.info('Natural language query', {
      question,
      interpreted_queries: suggestedQueries,
    });

    // Convert string dates to Date objects if provided
    const processedParams = {};
    if (params.start_date) {
      processedParams.start_date = new Date(params.start_date);
    }
    if (params.end_date) {
      processedParams.end_date = new Date(params.end_date);
    }

    // Execute all suggested queries
    const results = await DynamicQueryService.executeMultiple(suggestedQueries, processedParams);

    const successful = results.filter((r) => r.status === 'fulfilled');

    // Format response in natural language
    const answer = this.formatNaturalLanguageResponse(question, successful);

    res.json({
      success: true,
      question,
      interpreted_queries: suggestedQueries,
      answer,
      raw_results: successful.map((r) => r.data),
      executed_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error processing natural language query:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process question',
      message: error.message,
    });
  }
});

/**
 * Helper function to format results as natural language
 */
router.formatNaturalLanguageResponse = function (question, results) {
  if (results.length === 0) {
    return 'No data available for the specified period.';
  }

  const responses = results.map((result) => {
    const data = result.data.data;

    if (result.data.query === 'total_orders') {
      return `Total orders: ${Math.round(data.value)}`;
    }
    if (result.data.query === 'on_time_delivery_rate') {
      return `On-time delivery rate: ${data.value.toFixed(1)}%`;
    }
    if (result.data.query === 'order_completion_rate') {
      return `Order completion rate: ${data.value.toFixed(1)}%`;
    }
    if (result.data.query === 'average_delivery_time') {
      return `Average delivery time: ${Math.round(data.value)} minutes`;
    }
    if (result.data.query === 'active_couriers') {
      return `Active couriers: ${data.value}`;
    }
    if (result.data.query === 'cancellation_rate') {
      return `Cancellation rate: ${data.value.toFixed(1)}%`;
    }
    if (result.data.query === 'return_rate') {
      return `Return rate: ${data.value.toFixed(1)}%`;
    }
    if (result.data.query === 'total_revenue') {
      return `Total revenue: $${data.value.toFixed(2)}`;
    }
    if (result.data.query === 'courier_efficiency_score') {
      return `Courier efficiency score: ${data.value.toFixed(1)}`;
    }

    return `${result.data.description}: ${JSON.stringify(data)}`;
  });

  return responses.join('. ');
};

/**
 * GET /api/v1/ai-query/query/:queryName
 * Quick execute a query by name (GET method for convenience)
 */
router.get('/query/:queryName', async (req, res) => {
  try {
    const { queryName } = req.params;
    const { days = 7, start_date, end_date } = req.query;

    const params = {};
    if (start_date && end_date) {
      params.start_date = new Date(start_date);
      params.end_date = new Date(end_date);
    } else {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));
      params.start_date = startDate;
      params.end_date = endDate;
    }

    const result = await DynamicQueryService.executeQuery(queryName, params);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Error executing query:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute query',
      message: error.message,
    });
  }
});

module.exports = router;
