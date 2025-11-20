/**
 * Error Handling Middleware
 * Centralized error handling with proper logging and responses
 */

const { logger } = require('../utils/logger');
const { errorMonitoringService } = require('../services/error-monitoring.service');

/**
 * Custom error classes
 */
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter = 60) {
    super(message, 429);
    this.retryAfter = retryAfter;
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', originalError = null) {
    super(message, 500, false);
    this.originalError = originalError;
  }
}

class ExternalServiceError extends AppError {
  constructor(service, message = 'External service error', statusCode = 502) {
    super(message, statusCode, false);
    this.service = service;
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', retryAfter = 30) {
    super(message, 503, false);
    this.retryAfter = retryAfter;
  }
}

class TimeoutError extends AppError {
  constructor(message = 'Request timeout', operation = null) {
    super(message, 504, false);
    this.operation = operation;
  }
}

/**
 * Agent-specific error classes
 */
class AgentError extends AppError {
  constructor(agentName, message, statusCode = 500, code = 'AGENT_ERROR') {
    super(message, statusCode, false);
    this.agentName = agentName;
    this.code = code;
  }
}

class AgentExecutionError extends AgentError {
  constructor(agentName, message, originalError = null) {
    super(agentName, message, 500, 'AGENT_EXECUTION_ERROR');
    this.originalError = originalError;
  }
}

class AgentTimeoutError extends AgentError {
  constructor(agentName, timeout) {
    super(agentName, `Agent execution timeout (${timeout}ms)`, 504, 'AGENT_TIMEOUT');
    this.timeout = timeout;
  }
}

class NoDriversAvailableError extends AgentError {
  constructor(criteria = {}) {
    super('fleet-status', 'No drivers available matching criteria', 503, 'NO_DRIVERS_AVAILABLE');
    this.criteria = criteria;
  }
}

class OrderAssignmentError extends AgentError {
  constructor(message, orderId = null) {
    super('order-assignment', message, 500, 'ASSIGNMENT_FAILED');
    this.orderId = orderId;
  }
}

class RouteOptimizationError extends AgentError {
  constructor(message, routeData = null) {
    super('route-optimization', message, 500, 'ROUTE_OPTIMIZATION_FAILED');
    this.routeData = routeData;
  }
}

class SLABreachError extends AgentError {
  constructor(message, orderId, severity = 'high') {
    super('sla-monitor', message, 500, 'SLA_BREACH_IMMINENT');
    this.orderId = orderId;
    this.severity = severity;
  }
}

class OrchestrationError extends AgentError {
  constructor(message, failedAgents = []) {
    super('master-orchestrator', message, 500, 'ORCHESTRATION_FAILED');
    this.failedAgents = failedAgents;
  }
}

/**
 * Async error handler wrapper
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error handler for express-validator
 */
const handleValidationErrors = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => ({
      field: error.param,
      message: error.msg,
      value: error.value,
    }));

    throw new ValidationError('Validation failed', errorMessages);
  }

  next();
};

/**
 * Database error handler
 */
const handleDatabaseError = (error) => {
  // PostgreSQL error codes
  const pgErrorCodes = {
    23505: 'Duplicate entry',
    23503: 'Foreign key violation',
    23502: 'Not null violation',
    '22P02': 'Invalid input syntax',
    '42P01': 'Table does not exist',
    42703: 'Column does not exist',
    '08003': 'Connection does not exist',
    '08006': 'Connection failure',
    '57P03': 'Database is shutting down',
  };

  const message = pgErrorCodes[error.code] || 'Database operation failed';
  const isOperational = error.code && error.code.startsWith('23');

  return new DatabaseError(message, error);
};

/**
 * Not found handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

/**
 * Generate error code from error type
 */
const getErrorCode = (err) => {
  // Return explicit error code if set
  if (err.code) return err.code;

  // Map error classes to codes
  const errorCodeMap = {
    ValidationError: 'VALIDATION_ERROR',
    AuthenticationError: 'UNAUTHORIZED',
    AuthorizationError: 'FORBIDDEN',
    NotFoundError: 'NOT_FOUND',
    ConflictError: 'CONFLICT',
    RateLimitError: 'RATE_LIMIT_EXCEEDED',
    DatabaseError: 'DATABASE_ERROR',
    ExternalServiceError: 'EXTERNAL_SERVICE_ERROR',
    ServiceUnavailableError: 'SERVICE_UNAVAILABLE',
    TimeoutError: 'TIMEOUT_ERROR',
    AgentError: 'AGENT_ERROR',
    AgentExecutionError: 'AGENT_EXECUTION_ERROR',
    AgentTimeoutError: 'AGENT_TIMEOUT',
    NoDriversAvailableError: 'NO_DRIVERS_AVAILABLE',
    OrderAssignmentError: 'ASSIGNMENT_FAILED',
    RouteOptimizationError: 'ROUTE_OPTIMIZATION_FAILED',
    SLABreachError: 'SLA_BREACH_IMMINENT',
    OrchestrationError: 'ORCHESTRATION_FAILED',
  };

  return errorCodeMap[err.name] || 'INTERNAL_ERROR';
};

/**
 * Development error response
 */
const sendErrorDev = (err, req, res) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';
  const errorCode = getErrorCode(err);

  // Log to error monitoring service
  errorMonitoringService.logError({
    message: err.message,
    stack: err.stack,
    statusCode,
    code: errorCode,
    agentName: err.agentName,
    service: err.service,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    requestId: req.headers['x-request-id'],
    isOperational: err.isOperational,
    metadata: {
      body: req.body,
      query: req.query,
      errors: err.errors,
    },
  });

  // Log error details in development
  logger.error('Error occurred', {
    error: err.message,
    errorCode,
    statusCode,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    user: req.user,
    agentName: err.agentName,
    requestId: req.headers['x-request-id'],
  });

  const response = {
    success: false,
    status,
    message: err.message,
    code: errorCode,
    path: req.path,
    timestamp: new Date().toISOString(),
  };

  // Add optional fields
  if (err.errors) response.errors = err.errors;
  if (err.agentName) response.agentName = err.agentName;
  if (err.service) response.service = err.service;
  if (statusCode >= 500) response.requestId = req.headers['x-request-id'];

  // Include stack trace in development
  response.stack = err.stack;

  res.status(statusCode).json(response);
};

/**
 * Production error response
 */
const sendErrorProd = (err, req, res) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';
  const errorCode = getErrorCode(err);

  // Log to error monitoring service
  errorMonitoringService.logError({
    message: err.message,
    stack: err.stack,
    statusCode,
    code: errorCode,
    agentName: err.agentName,
    service: err.service,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    requestId: req.headers['x-request-id'],
    isOperational: err.isOperational,
    metadata: {
      errors: err.errors,
    },
  });

  // Operational errors - safe to send to client
  if (err.isOperational) {
    logger.warn('Operational error', {
      error: err.message,
      errorCode,
      statusCode,
      path: req.path,
      method: req.method,
      user: req.user,
      agentName: err.agentName,
      requestId: req.headers['x-request-id'],
    });

    const response = {
      success: false,
      status,
      message: err.message,
      code: errorCode,
      timestamp: new Date().toISOString(),
    };

    // Add optional fields
    if (err.errors) response.errors = err.errors;
    if (err.retryAfter) response.retryAfter = err.retryAfter;
    if (statusCode >= 500) response.requestId = req.headers['x-request-id'];

    res.status(statusCode).json(response);
  } else {
    // Programming or unknown errors - don't leak details
    logger.error('Non-operational error occurred', {
      error: err.message,
      errorCode,
      stack: err.stack,
      path: req.path,
      method: req.method,
      user: req.user,
      agentName: err.agentName,
      requestId: req.headers['x-request-id'],
    });

    res.status(500).json({
      success: false,
      status: 'error',
      message: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      requestId: req.headers['x-request-id'],
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Handle specific error types
  if (err.name === 'CastError') {
    const message = 'Invalid resource ID';
    error = new AppError(message, 400);
  }

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
    error = new ValidationError(message);
  }

  if (err.code === 11000) {
    const message = 'Duplicate field value';
    error = new ConflictError(message);
  }

  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new AuthenticationError(message);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new AuthenticationError(message);
  }

  // Database errors
  if (err.code && typeof err.code === 'string' && err.code.length === 5) {
    error = handleDatabaseError(err);
  }

  // Send error response
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, req, res);
  } else {
    sendErrorProd(error, req, res);
  }
};

/**
 * Uncaught exception handler
 */
const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION! Shutting down...', {
      error: err.message,
      stack: err.stack,
    });

    // Give time to log the error
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
};

/**
 * Unhandled rejection handler
 */
const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! Shutting down...', {
      error: err.message || err,
      stack: err.stack,
    });

    // Give time to log the error
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
};

/**
 * Graceful shutdown handler
 */
const handleGracefulShutdown = (server) => {
  const gracefulShutdown = (signal) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed');

      // Close database connections
      const db = require('../database');
      db.disconnect()
        .then(() => {
          logger.info('Database connections closed');
          process.exit(0);
        })
        .catch((err) => {
          logger.error('Error during database disconnect', err);
          process.exit(1);
        });
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;

    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id,
    };

    if (res.statusCode >= 400) {
      logger.error('Request failed', logData);
    } else if (duration > 1000) {
      logger.warn('Slow request', logData);
    } else {
      logger.debug('Request completed', logData);
    }
  });

  next();
};

/**
 * CORS error handler
 */
const corsErrorHandler = (err, req, res, next) => {
  if (err && err.status === 500 && err.message === 'CORS') {
    return res.status(403).json({
      success: false,
      error: 'CORS policy violation',
    });
  }
  next(err);
};

/**
 * Payload size error handler
 */
const payloadErrorHandler = (err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Payload too large',
    });
  }
  next(err);
};

module.exports = {
  // Base error classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  ServiceUnavailableError,
  TimeoutError,

  // Agent-specific error classes
  AgentError,
  AgentExecutionError,
  AgentTimeoutError,
  NoDriversAvailableError,
  OrderAssignmentError,
  RouteOptimizationError,
  SLABreachError,
  OrchestrationError,

  // Middleware
  asyncHandler,
  handleValidationErrors,
  notFoundHandler,
  errorHandler,
  requestLogger,
  corsErrorHandler,
  payloadErrorHandler,

  // Process handlers
  handleUncaughtException,
  handleUnhandledRejection,
  handleGracefulShutdown,

  // Utilities
  getErrorCode,
};
