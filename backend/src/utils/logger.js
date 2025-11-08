/**
 * Logger Utility
 * Provides structured logging for the application
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Safe JSON stringify function that handles circular references
 * @param {Object} obj - The object to stringify
 * @returns {String} - JSON string
 */
const safeStringify = (obj) => {
  if (!obj) return undefined;

  const cache = new Set();

  return JSON.stringify(
    obj,
    (key, value) => {
      // Handle undefined
      if (value === undefined) return '[undefined]';

      // Skip large binary data (like buffers) that may be in requests
      if (key === 'buffer' || key === 'data' || key === '_readableState') {
        return '[binary data]';
      }

      // Handle circular references
      if (typeof value === 'object' && value !== null) {
        // For socket objects often found in req/res
        if (value.constructor && value.constructor.name === 'Socket') {
          return '[socket]';
        }

        // Check for circular references
        if (cache.has(value)) {
          return '[circular]';
        }
        cache.add(value);
      }

      return value;
    },
    2
  );
};

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Custom format for console output
const consoleFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  let meta = '';
  if (Object.keys(metadata).length > 0) {
    if (metadata.functionName) {
      meta = `[${metadata.functionName}]`;
    }
    if (metadata.requestId) {
      meta += ` [ReqID: ${metadata.requestId}]`;
    }
  }
  return `${timestamp} [${level.toUpperCase()}]${meta}: ${message}`;
});

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'logistics-api' },
  transports: [
    // Write logs to console
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), consoleFormat),
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Write error logs to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Write API request logs to api.log
    new winston.transports.File({
      filename: path.join(logsDir, 'api.log'),
      level: 'http',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
});

// Custom logger function for tracing function execution
logger.logFunction = (functionName, message, metadata = {}) => {
  logger.debug(message, {
    functionName,
    ...metadata,
  });
};

// Logger wrapper for functions to track execution
const logFunctionExecution = (func, functionName) => {
  const name = functionName || func.name;
  return async function (...args) {
    const startTime = Date.now();

    // Safely stringify the arguments to avoid circular references
    const safeArgs = args.map((arg) => {
      try {
        if (typeof arg === 'object' && arg !== null) {
          return safeStringify(arg);
        }
        return arg;
      } catch (err) {
        return '[unstringifiable]';
      }
    });

    logger.logFunction(name, `Started execution`, { args: safeArgs });

    try {
      const result = await func.apply(this, args);
      const executionTime = Date.now() - startTime;
      logger.logFunction(name, `Completed in ${executionTime}ms`);
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.logFunction(name, `Failed after ${executionTime}ms: ${error.message}`, {
        error: {
          message: error.message,
          stack: error.stack,
        },
      });
      throw error;
    }
  };
};

// Morgan stream for HTTP request logging
const morganStream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Middleware to log request and response details
const logRequestResponse = (req, res, next) => {
  // Capture original request data
  const requestTime = new Date();
  const requestId = req.headers['x-request-id'];

  // Safely extract the request body for logging
  let safeBody;
  if ((req.method === 'POST' || req.method === 'PUT') && req.body) {
    try {
      safeBody = safeStringify(req.body);
    } catch (e) {
      safeBody = '[unable to stringify body]';
    }
  }

  // Safely extract headers
  let safeHeaders;
  try {
    safeHeaders = safeStringify(req.headers);
  } catch (e) {
    safeHeaders = '[unable to stringify headers]';
  }

  // Log the request
  logger.debug('Request received', {
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    headers: safeHeaders,
    query: safeStringify(req.query),
    body: safeBody,
    timestamp: requestTime.toISOString(),
  });

  // Capture the original res.send
  const originalSend = res.send;

  // Override res.send to capture response data
  res.send = function (body) {
    res.responseBody = body;

    // Get response time
    const responseTime = new Date() - requestTime;

    // Safely stringify the response body if needed
    let safeResponseBody;
    if (res.statusCode >= 400 && body) {
      try {
        safeResponseBody = typeof body === 'string' ? body : safeStringify(body);
      } catch (e) {
        safeResponseBody = '[unable to stringify response body]';
      }
    }

    // Log the response
    const logLevel = res.statusCode >= 400 ? 'error' : 'debug';
    logger[logLevel]('Response sent', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      responseHeaders: safeStringify(res.getHeaders()),
      responseBody: safeResponseBody,
    });

    // Call the original send
    return originalSend.call(this, body);
  };

  next();
};

// Legacy export for backward compatibility
logger.stream = morganStream;

module.exports = {
  logger,
  logFunctionExecution,
  morganStream,
  logRequestResponse,
  safeStringify, // Export the safe stringify function for use elsewhere
};
