/**
 * Authentication Routes
 * Handles user authentication and authorization
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate, optionalAuthenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { logger } = require('../utils/logger');

// Log all auth requests
router.use((req, res, next) => {
  logger.debug(`Auth API request: ${req.method} ${req.originalUrl}`, {
    requestId: req.headers['x-request-id'],
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
  });
  next();
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [customer, driver, dispatcher, manager, admin]
 *                 default: customer
 *     responses:
 *       201:
 *         description: User registered successfully
 *       409:
 *         description: User already exists
 *       400:
 *         description: Validation error
 */
router.post('/register', validate('register'), authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticate user and receive access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account disabled
 */
router.post('/login', validate('login'), authController.login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Get a new access token using refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', authController.refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Invalidate current session
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', optionalAuthenticate, authController.logout);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     description: Retrieve authenticated user's profile information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 */
router.get('/me', authenticate, authController.getProfile);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change password
 *     description: Change authenticated user's password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Current password is incorrect
 */
router.post(
  '/change-password',
  authenticate,
  validate('changePassword'),
  authController.changePassword
);

module.exports = router;
