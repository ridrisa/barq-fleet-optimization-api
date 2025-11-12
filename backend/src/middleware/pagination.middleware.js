/**
 * Pagination Middleware
 * Provides consistent pagination handling across all routes
 */

/**
 * Parse and validate pagination parameters from query string
 * @param {Object} req - Express request object
 * @returns {Object} Pagination config with limit, offset, and page
 */
function getPaginationParams(req) {
  const limit = Math.min(
    Math.max(parseInt(req.query.limit) || 5, 1),
    1000 // Maximum limit to prevent abuse
  );

  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  const page = Math.max(parseInt(req.query.page) || 1, 1);

  // Calculate offset from page if page is provided
  const calculatedOffset = req.query.page ? (page - 1) * limit : offset;

  return {
    limit,
    offset: calculatedOffset,
    page: req.query.page ? page : Math.floor(calculatedOffset / limit) + 1,
  };
}

/**
 * Generate pagination metadata for response
 * @param {number} total - Total count of items
 * @param {number} limit - Items per page
 * @param {number} offset - Current offset
 * @param {number} page - Current page number
 * @returns {Object} Pagination metadata
 */
function generatePaginationMeta(total, limit, offset, page) {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = offset + limit < total;
  const hasPreviousPage = offset > 0;

  return {
    pagination: {
      total,
      limit,
      offset,
      page,
      totalPages,
      hasNextPage,
      hasPreviousPage,
      nextOffset: hasNextPage ? offset + limit : null,
      previousOffset: hasPreviousPage ? Math.max(0, offset - limit) : null,
    },
  };
}

/**
 * Express middleware to attach pagination helpers to request
 */
function paginationMiddleware(req, res, next) {
  req.pagination = getPaginationParams(req);

  // Helper function to add pagination metadata to response
  res.paginate = (data, total) => {
    const meta = generatePaginationMeta(
      total,
      req.pagination.limit,
      req.pagination.offset,
      req.pagination.page
    );

    return {
      success: true,
      data,
      ...meta,
    };
  };

  next();
}

module.exports = {
  paginationMiddleware,
  getPaginationParams,
  generatePaginationMeta,
};
