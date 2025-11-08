/**
 * Security Middleware
 * Comprehensive security measures including rate limiting, CORS, helmet, etc.
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const { logger } = require('../utils/logger');
const { RateLimitError } = require('./error.middleware');

/**
 * Rate limiter configurations
 */

// General API rate limiter
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      throw new RateLimitError('Rate limit exceeded', Math.ceil(windowMs / 1000));
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path.startsWith('/health');
    },
  });
};

// Strict rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('user-agent'),
    });
    throw new RateLimitError('Too many authentication attempts', 900);
  },
});

// Order creation rate limiter
const orderLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 orders per minute
  message: 'Too many orders created, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.id || req.ip;
  },
});

// API key rate limiter (higher limits)
const apiKeyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute for API keys
  message: 'API rate limit exceeded.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-api-key'] || req.ip;
  },
  skip: (req) => {
    // Only apply to requests with API keys
    return !req.headers['x-api-key'];
  },
});

// Speed limiter removed - use standard rate limiting instead

/**
 * CORS configuration
 */
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

    // Allow localhost in development
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:3000');
      allowedOrigins.push('http://localhost:3001');
      allowedOrigins.push('http://localhost:3002');
      allowedOrigins.push('http://localhost:3003');
    }

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked origin', { origin, ip: this.ip });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400, // 24 hours
};

/**
 * Helmet configuration
 */
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Set to false if you need to embed resources
});

/**
 * Request sanitization middleware
 */
const sanitizeRequest = (req, res, next) => {
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize params
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

/**
 * Recursively sanitize object
 */
const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sanitized = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];

      if (typeof value === 'string') {
        // Remove potential SQL injection attempts
        sanitized[key] = value
          .replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/gi, '')
          .trim();
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
};

/**
 * IP blocking middleware
 */
const blockedIPs = new Set();
const blockIP = (ip, duration = 3600000) => {
  blockedIPs.add(ip);
  setTimeout(() => blockedIPs.delete(ip), duration);
  logger.warn('IP blocked', { ip, duration });
};

const ipBlocker = (req, res, next) => {
  if (blockedIPs.has(req.ip)) {
    logger.warn('Blocked IP attempted access', {
      ip: req.ip,
      path: req.path,
    });
    return res.status(403).json({
      success: false,
      error: 'Access denied',
    });
  }
  next();
};

/**
 * Request ID middleware
 */
const requestId = (req, res, next) => {
  const id =
    req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
};

/**
 * Security headers middleware
 */
const securityHeaders = (req, res, next) => {
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
};

/**
 * File upload security
 */
const fileUploadSecurity = (req, res, next) => {
  if (!req.files) {
    return next();
  }

  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/json',
  ];

  const maxFileSize = 10 * 1024 * 1024; // 10MB

  for (const file of Object.values(req.files)) {
    // Check file size
    if (file.size > maxFileSize) {
      return res.status(413).json({
        success: false,
        error: 'File size exceeds limit',
      });
    }

    // Check mime type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(415).json({
        success: false,
        error: 'File type not allowed',
      });
    }

    // Sanitize filename
    file.name = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  next();
};

/**
 * API versioning middleware
 */
const apiVersioning = (req, res, next) => {
  const version = req.headers['api-version'] || 'v1';
  req.apiVersion = version;
  res.setHeader('API-Version', version);
  next();
};

/**
 * Brute force protection
 */
const bruteForceProtection = new Map();

const protectAgainstBruteForce = (key, maxAttempts = 5, windowMs = 900000) => {
  return (req, res, next) => {
    const identifier = req[key] || req.ip;
    const now = Date.now();

    if (!bruteForceProtection.has(identifier)) {
      bruteForceProtection.set(identifier, { attempts: 0, resetTime: now + windowMs });
    }

    const protection = bruteForceProtection.get(identifier);

    if (now > protection.resetTime) {
      protection.attempts = 0;
      protection.resetTime = now + windowMs;
    }

    protection.attempts++;

    if (protection.attempts > maxAttempts) {
      logger.warn('Brute force attempt detected', {
        identifier,
        attempts: protection.attempts,
        key,
      });

      // Block the IP
      blockIP(req.ip, windowMs);

      return res.status(429).json({
        success: false,
        error: 'Too many failed attempts',
        retryAfter: Math.ceil((protection.resetTime - now) / 1000),
      });
    }

    next();
  };
};

/**
 * Content type validation
 */
const validateContentType = (allowedTypes = ['application/json']) => {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'DELETE') {
      return next();
    }

    const contentType = req.get('content-type');

    if (!contentType || !allowedTypes.some((type) => contentType.includes(type))) {
      return res.status(415).json({
        success: false,
        error: 'Unsupported content type',
      });
    }

    next();
  };
};

/**
 * Apply all security middleware
 */
const applySecurity = (app) => {
  // Basic security
  app.use(helmetConfig);
  app.use(cors(corsOptions));
  app.use(securityHeaders);
  app.use(requestId);
  app.use(ipBlocker);

  // Rate limiting
  app.use('/api/', createRateLimiter());
  app.use('/api/auth', authLimiter);
  app.use('/api/orders', orderLimiter);
  app.use(apiKeyLimiter);

  // Data sanitization
  app.use(sanitizeRequest);

  // Additional security
  app.use(apiVersioning);
  app.use(validateContentType());

  logger.info('Security middleware applied');
};

module.exports = {
  // Rate limiters
  createRateLimiter,
  authLimiter,
  orderLimiter,
  apiKeyLimiter,

  // Security middleware
  corsOptions,
  helmetConfig,
  sanitizeRequest,
  ipBlocker,
  blockIP,
  requestId,
  securityHeaders,
  fileUploadSecurity,
  apiVersioning,
  protectAgainstBruteForce,
  validateContentType,

  // Main function
  applySecurity,
};
