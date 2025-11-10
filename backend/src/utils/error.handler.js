/**
 * Error Handler
 * Handles API errors and generates appropriate responses
 */

// Custom error classes
class ApiError extends Error {
  constructor(message, statusCode, errorCode = 'GENERIC_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends ApiError {
  constructor(message, errorCode = 'BAD_REQUEST') {
    super(message, 400, errorCode);
  }
}

class ValidationError extends BadRequestError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR');
  }
}

class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class RateLimitError extends ApiError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

class InternalServerError extends ApiError {
  constructor(message = 'Internal server error') {
    super(message, 500, 'INTERNAL_SERVER_ERROR');
  }
}

// Generate a unique error ID for tracking
const generateErrorId = () => {
  return `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Main error handler middleware for Express
const errorHandler = (err, req, res, _next) => {
  // Default to 500 internal server error if status is not defined
  const statusCode = err.statusCode || 500;
  const errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
  const errorId = generateErrorId();

  // Remove unused parameter from function signature
  // eslint-disable-next-line no-unused-vars

  // Log error details for server-side debugging
  console.error(`[ERROR ${errorId}]`, {
    message: err.message,
    stack: err.stack,
    errorCode,
    statusCode,
    path: req.path,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    timestamp: new Date().toISOString(),
  });

  // Send error response to client
  res.status(statusCode).json({
    success: false,
    error: err.message,
    errorCode,
    errorId: statusCode >= 500 ? errorId : undefined, // Only include error ID for 500-level errors
    statusCode,
    timestamp: new Date().toISOString(),
  });
};

// Function to handle errors from async express routes
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  ApiError,
  BadRequestError,
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  RateLimitError,
  InternalServerError,
  generateErrorId,
  errorHandler,
  asyncHandler,
};
