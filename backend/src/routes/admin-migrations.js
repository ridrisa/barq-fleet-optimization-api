/**
 * Admin Migration Routes
 * Temporary endpoint to run database migrations
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const { asyncHandler } = require('../utils/error.handler');
const { logger } = require('../utils/logger');

// POST /api/admin/migrations/enable-postgis
router.post(
  '/enable-postgis',
  asyncHandler(async (req, res) => {
    try {
      // Enable PostGIS extension
      await db.query('CREATE EXTENSION IF NOT EXISTS postgis');
      logger.info('[Migration] PostGIS extension enabled');

      // Enable PostGIS Topology
      await db.query('CREATE EXTENSION IF NOT EXISTS postgis_topology');
      logger.info('[Migration] PostGIS Topology extension enabled');

      // Verify PostGIS version
      const result = await db.query('SELECT PostGIS_version()');
      const version = result.rows[0]?.postgis_version || 'unknown';

      res.json({
        success: true,
        message: 'PostGIS enabled successfully',
        version,
      });
    } catch (error) {
      logger.error('[Migration] Failed to enable PostGIS', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

module.exports = router;
