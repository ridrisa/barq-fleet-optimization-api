/**
 * Authentication Controller
 * Handles user registration, login, token refresh, and logout
 */

const bcrypt = require('bcrypt');
const {
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  ROLE_PERMISSIONS,
} = require('../middleware/auth.middleware');
const db = require('../database');
const { logger } = require('../utils/logger');
const { auditService } = require('../services/audit.service');

const SALT_ROUNDS = 12;

/**
 * Register a new user
 * POST /api/auth/register
 */
exports.register = async (req, res, next) => {
  try {
    const { email, password, name, role = 'customer' } = req.body;

    // Check if user already exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, email, name, role, created_at`,
      [email, hashedPassword, name, role]
    );

    const user = result.rows[0];

    // Get permissions for role
    const permissions = ROLE_PERMISSIONS[role] || [];

    // Generate tokens
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      permissions,
    });

    const refreshToken = generateRefreshToken({
      id: user.id,
      email: user.email,
    });

    // Log audit event
    await auditService.logAuthEvent(user.id, 'register', 'success', {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.headers['x-request-id'],
    });

    logger.info('[Auth] User registered successfully', {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.created_at,
        },
        token,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      },
    });
  } catch (error) {
    logger.error('[Auth] Registration failed', {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Get user from database
    const result = await db.query(
      'SELECT id, email, name, role, password_hash, active FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      await auditService.logAuthEvent(null, 'login', 'failed', {
        reason: 'user_not_found',
        email,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.headers['x-request-id'],
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.active) {
      await auditService.logAuthEvent(user.id, 'login', 'failed', {
        reason: 'user_inactive',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.headers['x-request-id'],
      });

      return res.status(403).json({
        success: false,
        error: 'Account is disabled',
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      await auditService.logAuthEvent(user.id, 'login', 'failed', {
        reason: 'invalid_password',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.headers['x-request-id'],
      });

      logger.warn('[Auth] Invalid password attempt', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Get permissions for role
    const permissions = ROLE_PERMISSIONS[user.role] || [];

    // Generate tokens
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      permissions,
    });

    const refreshToken = generateRefreshToken({
      id: user.id,
      email: user.email,
    });

    // Update last login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Log audit event
    await auditService.logAuthEvent(user.id, 'login', 'success', {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.headers['x-request-id'],
    });

    logger.info('[Auth] User logged in successfully', {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      },
    });
  } catch (error) {
    logger.error('[Auth] Login failed', {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body || { refreshToken: req.cookies.refreshToken };

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required',
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Get user from database
    const result = await db.query('SELECT id, email, name, role, active FROM users WHERE id = $1', [
      decoded.id,
    ]);

    if (result.rows.length === 0 || !result.rows[0].active) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
      });
    }

    const user = result.rows[0];

    // Get permissions for role
    const permissions = ROLE_PERMISSIONS[user.role] || [];

    // Generate new tokens
    const newToken = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      permissions,
    });

    const newRefreshToken = generateRefreshToken({
      id: user.id,
      email: user.email,
    });

    logger.info('[Auth] Token refreshed', {
      userId: user.id,
      email: user.email,
    });

    // Set new refresh token as httpOnly cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      },
    });
  } catch (error) {
    logger.error('[Auth] Token refresh failed', {
      error: error.message,
    });

    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token',
      });
    }

    next(error);
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 */
exports.logout = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (userId) {
      await auditService.logAuthEvent(userId, 'logout', 'success', {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.headers['x-request-id'],
      });

      logger.info('[Auth] User logged out', { userId });
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('[Auth] Logout failed', {
      error: error.message,
    });
    next(error);
  }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT id, email, name, role, created_at, last_login, active
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = result.rows[0];
    const permissions = ROLE_PERMISSIONS[user.role] || [];

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions,
          createdAt: user.created_at,
          lastLogin: user.last_login,
          active: user.active,
        },
      },
    });
  } catch (error) {
    logger.error('[Auth] Get profile failed', {
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

/**
 * Change password
 * POST /api/auth/change-password
 */
exports.changePassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Get user with current password hash
    const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = result.rows[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isValidPassword) {
      await auditService.logAuthEvent(userId, 'password_change', 'failed', {
        reason: 'invalid_current_password',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.headers['x-request-id'],
      });

      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect',
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      hashedPassword,
      userId,
    ]);

    // Log audit event
    await auditService.logAuthEvent(userId, 'password_change', 'success', {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.headers['x-request-id'],
    });

    logger.info('[Auth] Password changed successfully', { userId });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('[Auth] Password change failed', {
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};
