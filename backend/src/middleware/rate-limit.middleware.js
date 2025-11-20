/**
 * Rate Limiting Middleware
 * Prevents API abuse and protects against DDoS attacks
 */

const rateLimit = require('express-rate-limit');

/**
 * Standard rate limiter for general API endpoints
 * 100 requests per 15 minutes per IP
 */
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests for counting
  skipSuccessfulRequests: false,
  // Skip failed requests for counting
  skipFailedRequests: false,
  // Trust proxy is enabled globally in app.js for Cloud Run compatibility
  validate: { trustProxy: true },
});

/**
 * Strict rate limiter for AI/LLM endpoints
 * 20 requests per 15 minutes per IP (more expensive operations)
 */
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: {
    success: false,
    error: 'AI endpoint rate limit exceeded. These endpoints are resource-intensive.',
    retryAfter: '15 minutes',
    hint: 'Consider batching multiple queries or caching results.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: true, // Don't count failed requests for AI endpoints
  validate: { trustProxy: true },
});

/**
 * Authentication rate limiter
 * 5 attempts per 15 minutes per IP (prevent brute force)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again later.',
    retryAfter: '15 minutes',
    security: 'Multiple failed attempts detected. Account may be locked.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed auth attempts
  skipFailedRequests: false,
  validate: { trustProxy: true },
});

/**
 * Optimization endpoint rate limiter
 * 30 requests per 15 minutes per IP (computationally expensive)
 */
const optimizationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per windowMs
  message: {
    success: false,
    error: 'Route optimization rate limit exceeded.',
    retryAfter: '15 minutes',
    hint: 'Optimization is computationally intensive. Consider caching results.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: true,
  validate: { trustProxy: true },
});

/**
 * Create custom rate limiter with specific configuration
 * @param {Object} options - Rate limit options
 * @returns {Function} Rate limit middleware
 */
function createCustomLimiter(options = {}) {
  const defaults = {
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Rate limit exceeded. Please try again later.',
    },
    validate: { trustProxy: true },
  };

  return rateLimit({ ...defaults, ...options });
}

module.exports = {
  standardLimiter,
  aiLimiter,
  authLimiter,
  optimizationLimiter,
  createCustomLimiter,
};
