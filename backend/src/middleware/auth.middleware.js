/**
 * Authentication Middleware
 * JWT-based authentication with role-based access control
 */

const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Generate JWT token
 */
const generateToken = (payload, expiresIn = JWT_EXPIRES_IN) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
    issuer: 'barq-logistics',
    audience: 'barq-api',
  });
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'barq-logistics',
    audience: 'barq-api-refresh',
  });
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'barq-logistics',
      audience: 'barq-api',
    });
  } catch (error) {
    logger.error('[Auth] Token verification failed', error);
    throw error;
  }
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'barq-logistics',
      audience: 'barq-api-refresh',
    });
  } catch (error) {
    logger.error('[Auth] Refresh token verification failed', error);
    throw error;
  }
};

/**
 * Extract token from request
 */
const extractToken = (req) => {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookies
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  // Check query parameter (for WebSocket connections)
  if (req.query && req.query.token) {
    return req.query.token;
  }

  return null;
};

/**
 * Authentication middleware
 */
const authenticate = (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const decoded = verifyToken(token);
    req.user = decoded;

    // Log authentication
    logger.debug('[Auth] User authenticated', {
      userId: decoded.id,
      role: decoded.role,
    });

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
    }

    logger.error('[Auth] Authentication failed', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

/**
 * Optional authentication middleware
 * Sets user if token is valid, but doesn't block if missing
 */
const optionalAuthenticate = (req, res, next) => {
  try {
    const token = extractToken(req);

    if (token) {
      const decoded = verifyToken(token);
      req.user = decoded;
    }

    next();
  } catch (error) {
    // Ignore token errors for optional auth
    next();
  }
};

/**
 * Role-based authorization middleware
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const userRole = req.user.role;

    // Check if user has one of the allowed roles
    if (!allowedRoles.includes(userRole)) {
      logger.warn('[Auth] Authorization failed', {
        userId: req.user.id,
        userRole,
        requiredRoles: allowedRoles,
      });

      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }

    next();
  };
};

/**
 * Permission-based authorization middleware
 */
const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const userPermissions = req.user.permissions || [];

    if (!userPermissions.includes(permission)) {
      logger.warn('[Auth] Permission check failed', {
        userId: req.user.id,
        requiredPermission: permission,
        userPermissions,
      });

      return res.status(403).json({
        success: false,
        error: `Permission required: ${permission}`,
      });
    }

    next();
  };
};

/**
 * API key authentication for external services
 */
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required',
    });
  }

  // Validate API key (implement your logic here)
  const validApiKeys = (process.env.VALID_API_KEYS || '').split(',');

  if (!validApiKeys.includes(apiKey)) {
    logger.warn('[Auth] Invalid API key attempted', {
      apiKey: `${apiKey.substring(0, 8)}...`,
      ip: req.ip,
    });

    return res.status(401).json({
      success: false,
      error: 'Invalid API key',
    });
  }

  // Set API key user context
  req.user = {
    type: 'api_key',
    apiKey: `${apiKey.substring(0, 8)}...`,
    role: 'external_service',
  };

  next();
};

/**
 * Rate limiting by user
 */
const userRateLimit = new Map();

const checkUserRateLimit = (maxRequests = 100, windowMs = 60000) => {
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const userLimits = userRateLimit.get(userId) || { count: 0, resetTime: now + windowMs };

    // Reset if window expired
    if (now > userLimits.resetTime) {
      userLimits.count = 0;
      userLimits.resetTime = now + windowMs;
    }

    userLimits.count++;

    if (userLimits.count > maxRequests) {
      logger.warn('[Auth] Rate limit exceeded', {
        userId,
        requests: userLimits.count,
        limit: maxRequests,
      });

      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((userLimits.resetTime - now) / 1000),
      });
    }

    userRateLimit.set(userId, userLimits);
    next();
  };
};

/**
 * Refresh token endpoint handler
 */
const refreshTokenHandler = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required',
      });
    }

    const decoded = verifyRefreshToken(refreshToken);

    // Generate new access token
    const newToken = generateToken({
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions,
    });

    // Optionally generate new refresh token
    const newRefreshToken = generateRefreshToken({
      id: decoded.id,
      email: decoded.email,
    });

    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
        expiresIn: JWT_EXPIRES_IN,
      },
    });
  } catch (error) {
    logger.error('[Auth] Refresh token failed', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Refresh token expired',
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid refresh token',
    });
  }
};

/**
 * Logout handler
 */
const logoutHandler = (req, res) => {
  // Clear cookie if used
  res.clearCookie('token');

  // You might want to blacklist the token here
  // or invalidate it in a Redis cache

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
};

// User roles
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  DISPATCHER: 'dispatcher',
  DRIVER: 'driver',
  CUSTOMER: 'customer',
  EXTERNAL_SERVICE: 'external_service',
};

// Permissions
const PERMISSIONS = {
  // Order permissions
  CREATE_ORDER: 'orders.create',
  READ_ORDER: 'orders.read',
  UPDATE_ORDER: 'orders.update',
  DELETE_ORDER: 'orders.delete',
  ASSIGN_ORDER: 'orders.assign',

  // Driver permissions
  CREATE_DRIVER: 'drivers.create',
  READ_DRIVER: 'drivers.read',
  UPDATE_DRIVER: 'drivers.update',
  DELETE_DRIVER: 'drivers.delete',

  // Fleet management
  MANAGE_FLEET: 'fleet.manage',
  VIEW_FLEET: 'fleet.view',

  // Analytics
  VIEW_ANALYTICS: 'analytics.view',
  EXPORT_ANALYTICS: 'analytics.export',

  // System
  MANAGE_SYSTEM: 'system.manage',
  VIEW_LOGS: 'system.logs',
  MANAGE_AGENTS: 'agents.manage',
};

// Role-permission mapping
const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [ROLES.ADMIN]: [
    PERMISSIONS.CREATE_ORDER,
    PERMISSIONS.READ_ORDER,
    PERMISSIONS.UPDATE_ORDER,
    PERMISSIONS.DELETE_ORDER,
    PERMISSIONS.ASSIGN_ORDER,
    PERMISSIONS.CREATE_DRIVER,
    PERMISSIONS.READ_DRIVER,
    PERMISSIONS.UPDATE_DRIVER,
    PERMISSIONS.MANAGE_FLEET,
    PERMISSIONS.VIEW_FLEET,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.EXPORT_ANALYTICS,
  ],
  [ROLES.MANAGER]: [
    PERMISSIONS.CREATE_ORDER,
    PERMISSIONS.READ_ORDER,
    PERMISSIONS.UPDATE_ORDER,
    PERMISSIONS.ASSIGN_ORDER,
    PERMISSIONS.READ_DRIVER,
    PERMISSIONS.VIEW_FLEET,
    PERMISSIONS.VIEW_ANALYTICS,
  ],
  [ROLES.DISPATCHER]: [
    PERMISSIONS.CREATE_ORDER,
    PERMISSIONS.READ_ORDER,
    PERMISSIONS.UPDATE_ORDER,
    PERMISSIONS.ASSIGN_ORDER,
    PERMISSIONS.READ_DRIVER,
    PERMISSIONS.VIEW_FLEET,
  ],
  [ROLES.DRIVER]: [PERMISSIONS.READ_ORDER, PERMISSIONS.UPDATE_ORDER],
  [ROLES.CUSTOMER]: [PERMISSIONS.CREATE_ORDER, PERMISSIONS.READ_ORDER],
  [ROLES.EXTERNAL_SERVICE]: [PERMISSIONS.CREATE_ORDER, PERMISSIONS.READ_ORDER],
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  extractToken,
  authenticate,
  optionalAuthenticate,
  authorize,
  checkPermission,
  authenticateApiKey,
  checkUserRateLimit,
  refreshTokenHandler,
  logoutHandler,
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
};
