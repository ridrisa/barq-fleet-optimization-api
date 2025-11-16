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

// POST /api/admin/migrations/add-driver-state-tracking
router.post(
  '/add-driver-state-tracking',
  asyncHandler(async (req, res) => {
    try {
      logger.info('[Migration] Starting driver state tracking migration');

      // Check if target_deliveries column already exists
      const checkResult = await db.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'drivers'
        AND column_name = 'target_deliveries'
      `);

      if (checkResult.rows.length > 0) {
        return res.json({
          success: true,
          message: 'Driver state tracking migration already applied',
          status: 'already_exists',
        });
      }

      // Create operational_state enum
      await db.query(`
        DO $$ BEGIN
          CREATE TYPE operational_state AS ENUM (
            'OFFLINE',
            'AVAILABLE',
            'BUSY',
            'RETURNING',
            'ON_BREAK'
          );
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      logger.info('[Migration] Created operational_state enum');

      // Add state tracking columns
      await db.query(`
        ALTER TABLE drivers
          ADD COLUMN IF NOT EXISTS operational_state operational_state DEFAULT 'OFFLINE',
          ADD COLUMN IF NOT EXISTS state_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          ADD COLUMN IF NOT EXISTS previous_state operational_state
      `);
      logger.info('[Migration] Added state tracking columns');

      // Add performance tracking columns
      await db.query(`
        ALTER TABLE drivers
          ADD COLUMN IF NOT EXISTS target_deliveries INTEGER DEFAULT 25,
          ADD COLUMN IF NOT EXISTS completed_today INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS completed_this_week INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS last_daily_reset TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_DATE,
          ADD COLUMN IF NOT EXISTS on_time_rate DECIMAL(5,2) DEFAULT 100.00
      `);
      logger.info('[Migration] Added performance tracking columns');

      // Add capacity tracking columns
      await db.query(`
        ALTER TABLE drivers
          ADD COLUMN IF NOT EXISTS capacity_kg DECIMAL(10,2) DEFAULT 100.00,
          ADD COLUMN IF NOT EXISTS current_load_kg DECIMAL(10,2) DEFAULT 0.00,
          ADD COLUMN IF NOT EXISTS max_volume_m3 DECIMAL(10,2) DEFAULT 2.00,
          ADD COLUMN IF NOT EXISTS current_volume_m3 DECIMAL(10,2) DEFAULT 0.00
      `);
      logger.info('[Migration] Added capacity tracking columns');

      // Add work hours tracking columns
      await db.query(`
        ALTER TABLE drivers
          ADD COLUMN IF NOT EXISTS hours_worked_today DECIMAL(4,2) DEFAULT 0.00,
          ADD COLUMN IF NOT EXISTS shift_started_at TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS last_break_at TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS break_duration_minutes INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS consecutive_deliveries INTEGER DEFAULT 0
      `);
      logger.info('[Migration] Added work hours tracking columns');

      // Add availability constraints
      await db.query(`
        ALTER TABLE drivers
          ADD COLUMN IF NOT EXISTS available_until TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS max_working_hours DECIMAL(4,2) DEFAULT 10.00,
          ADD COLUMN IF NOT EXISTS requires_break_after INTEGER DEFAULT 5
      `);
      logger.info('[Migration] Added availability constraints');

      // Create can_accept_order function
      await db.query(`
        CREATE OR REPLACE FUNCTION can_accept_order(driver_id UUID)
        RETURNS BOOLEAN AS $$
        DECLARE
          driver RECORD;
        BEGIN
          SELECT
            operational_state,
            hours_worked_today,
            max_working_hours,
            consecutive_deliveries,
            requires_break_after,
            target_deliveries,
            completed_today,
            is_active
          INTO driver
          FROM drivers
          WHERE id = driver_id;

          RETURN (
            driver.is_active = true AND
            driver.operational_state = 'AVAILABLE' AND
            driver.hours_worked_today < driver.max_working_hours AND
            driver.consecutive_deliveries < driver.requires_break_after AND
            driver.completed_today < driver.target_deliveries
          );
        END;
        $$ LANGUAGE plpgsql;
      `);
      logger.info('[Migration] Created can_accept_order function');

      // Create indexes
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_drivers_operational_state
          ON drivers(operational_state)
          WHERE operational_state IN ('AVAILABLE', 'RETURNING')
      `);
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_drivers_performance
          ON drivers(completed_today, target_deliveries, on_time_rate)
      `);
      logger.info('[Migration] Created indexes');

      res.json({
        success: true,
        message: 'Driver state tracking migration completed successfully',
        status: 'applied',
      });
    } catch (error) {
      logger.error('[Migration] Failed to add driver state tracking', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

module.exports = router;
