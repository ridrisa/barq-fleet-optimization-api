/**
 * Driver Model - Enhanced with State Machine
 * Handles all database operations for drivers with operational state tracking
 *
 * State Machine:
 * OFFLINE → AVAILABLE → BUSY → RETURNING → AVAILABLE
 *    ↑                                          ↓
 *    └──────────────────────────────────────────┘
 *                    ↓ ON_BREAK ↓
 */

const db = require('../database');
const { logger } = require('../utils/logger');

// Valid state transitions
const VALID_TRANSITIONS = {
  OFFLINE: ['AVAILABLE'],
  AVAILABLE: ['BUSY', 'ON_BREAK', 'OFFLINE'],
  BUSY: ['RETURNING', 'AVAILABLE', 'OFFLINE'], // Direct to AVAILABLE for single delivery
  RETURNING: ['AVAILABLE', 'ON_BREAK', 'OFFLINE'],
  ON_BREAK: ['AVAILABLE', 'OFFLINE'],
};

// State transition reasons
const TRANSITION_REASONS = {
  SHIFT_START: 'shift_start',
  ORDER_ASSIGNED: 'order_assigned',
  DELIVERY_COMPLETED: 'delivery_completed',
  RETURNING_TO_BASE: 'returning_to_base',
  BREAK_STARTED: 'break_started',
  BREAK_ENDED: 'break_ended',
  SHIFT_END: 'shift_end',
  MANUAL_OVERRIDE: 'manual_override',
  SYSTEM_AUTO: 'system_auto',
};

class DriverModel {
  /**
   * Create a new driver
   */
  static async create(driverData) {
    const {
      employee_id,
      name,
      phone,
      email,
      vehicle_type,
      vehicle_number,
      license_number,
      service_types = ['BARQ', 'BULLET'],
      max_concurrent_orders = 1,
      working_hours = {},
      target_deliveries = 25,
      capacity_kg = null, // Will be set based on vehicle_type if null
    } = driverData;

    // Determine capacity based on vehicle type if not provided
    const defaultCapacity = {
      MOTORCYCLE: 30,
      CAR: 100,
      VAN: 500,
      TRUCK: 1000,
    };

    const query = `
      INSERT INTO drivers (
        employee_id,
        name,
        phone,
        email,
        vehicle_type,
        vehicle_number,
        license_number,
        service_types,
        max_concurrent_orders,
        working_hours,
        target_deliveries,
        capacity_kg,
        operational_state
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'OFFLINE')
      RETURNING *
    `;

    const values = [
      employee_id,
      name,
      phone,
      email,
      vehicle_type,
      vehicle_number,
      license_number,
      service_types,
      max_concurrent_orders,
      JSON.stringify(working_hours),
      target_deliveries,
      capacity_kg || defaultCapacity[vehicle_type] || 100,
    ];

    try {
      const result = await db.query(query, values);
      logger.info(`[DriverModel] Created driver: ${employee_id}`, {
        driverId: result.rows[0].id,
      });
      return result.rows[0];
    } catch (error) {
      logger.error('[DriverModel] Failed to create driver', error);
      throw error;
    }
  }

  /**
   * Get driver by ID with enriched data
   */
  static async getById(driverId) {
    const query = `
      SELECT d.*,
        ST_X(d.current_location::geometry) as longitude,
        ST_Y(d.current_location::geometry) as latitude,
        (d.target_deliveries - d.completed_today) as gap_from_target,
        can_accept_order(d.id) as can_accept_order,
        COUNT(DISTINCT o.id) as active_orders_count,
        ARRAY_AGG(o.id) FILTER (WHERE o.status NOT IN ('delivered', 'cancelled', 'failed')) as active_order_ids
      FROM drivers d
      LEFT JOIN orders o ON d.id = o.driver_id
        AND o.status NOT IN ('delivered', 'cancelled', 'failed')
      WHERE d.id = $1
      GROUP BY d.id
    `;

    try {
      const result = await db.query(query, [driverId]);
      return result.rows[0];
    } catch (error) {
      logger.error('[DriverModel] Failed to get driver', error);
      throw error;
    }
  }

  /**
   * Update driver operational state with validation
   */
  static async updateState(driverId, newState, metadata = {}) {
    // First, get current state
    const driver = await this.getById(driverId);

    if (!driver) {
      throw new Error(`Driver ${driverId} not found`);
    }

    const currentState = driver.operational_state;

    // Validate transition
    if (!this.isValidTransition(currentState, newState)) {
      throw new Error(
        `Invalid state transition: ${currentState} → ${newState}. Valid transitions from ${currentState}: ${VALID_TRANSITIONS[currentState].join(', ')}`
      );
    }

    const query = `
      UPDATE drivers
      SET
        operational_state = $1,
        state_changed_at = CURRENT_TIMESTAMP,
        previous_state = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *,
        ST_X(current_location::geometry) as longitude,
        ST_Y(current_location::geometry) as latitude
    `;

    try {
      const result = await db.query(query, [newState, currentState, driverId]);

      logger.info(`[DriverModel] State transition: ${currentState} → ${newState}`, {
        driverId,
        reason: metadata.reason,
        triggeredBy: metadata.triggeredBy,
      });

      return result.rows[0];
    } catch (error) {
      logger.error('[DriverModel] Failed to update driver state', error);
      throw error;
    }
  }

  /**
   * Validate state transition
   */
  static isValidTransition(fromState, toState) {
    if (!fromState) return true; // Initial state
    return VALID_TRANSITIONS[fromState]?.includes(toState) || false;
  }

  /**
   * Assign order to driver (transition to BUSY)
   */
  static async assignOrder(driverId, orderId, orderDetails) {
    const driver = await this.getById(driverId);

    if (!driver) {
      throw new Error(`Driver ${driverId} not found`);
    }

    // Check if driver can accept order
    if (!driver.can_accept_order) {
      throw new Error(
        `Driver ${driverId} cannot accept order. State: ${driver.operational_state}, Hours: ${driver.hours_worked_today}/${driver.max_working_hours}, Consecutive: ${driver.consecutive_deliveries}`
      );
    }

    const query = `
      UPDATE drivers
      SET
        operational_state = 'BUSY',
        active_delivery_id = $1,
        delivery_started_at = CURRENT_TIMESTAMP,
        eta_to_dropoff = $2,
        dropoff_location = ST_GeogFromText($3),
        consecutive_deliveries = consecutive_deliveries + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *,
        ST_X(current_location::geometry) as longitude,
        ST_Y(current_location::geometry) as latitude
    `;

    const dropoffPoint = orderDetails.dropoff_location
      ? `POINT(${orderDetails.dropoff_location.lng} ${orderDetails.dropoff_location.lat})`
      : null;

    const values = [orderId, orderDetails.eta_to_dropoff || null, dropoffPoint, driverId];

    try {
      const result = await db.query(query, values);

      logger.info(`[DriverModel] Assigned order ${orderId} to driver ${driverId}`, {
        driverName: driver.name,
        currentState: driver.operational_state,
      });

      return result.rows[0];
    } catch (error) {
      logger.error('[DriverModel] Failed to assign order', error);
      throw error;
    }
  }

  /**
   * Mark pickup completed
   */
  static async completePickup(driverId, orderId) {
    const query = `
      UPDATE drivers
      SET
        pickup_completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND active_delivery_id = $2
      RETURNING *
    `;

    try {
      const result = await db.query(query, [driverId, orderId]);

      if (result.rows.length === 0) {
        throw new Error(`No active delivery ${orderId} for driver ${driverId}`);
      }

      logger.info(`[DriverModel] Pickup completed for order ${orderId}`, {
        driverId,
      });

      return result.rows[0];
    } catch (error) {
      logger.error('[DriverModel] Failed to complete pickup', error);
      throw error;
    }
  }

  /**
   * Complete delivery and return to AVAILABLE or RETURNING
   */
  static async completeDelivery(driverId, orderId, options = {}) {
    const driver = await this.getById(driverId);

    if (!driver) {
      throw new Error(`Driver ${driverId} not found`);
    }

    if (driver.active_delivery_id !== orderId) {
      throw new Error(`Order ${orderId} is not active for driver ${driverId}`);
    }

    // Determine next state (RETURNING if far from base, otherwise AVAILABLE)
    const nextState = options.needsReturn ? 'RETURNING' : 'AVAILABLE';

    const query = `
      UPDATE drivers
      SET
        operational_state = $1,
        active_delivery_id = NULL,
        delivery_started_at = NULL,
        pickup_completed_at = NULL,
        eta_to_dropoff = NULL,
        dropoff_location = NULL,
        completed_today = completed_today + 1,
        completed_this_week = completed_this_week + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *,
        ST_X(current_location::geometry) as longitude,
        ST_Y(current_location::geometry) as latitude,
        (target_deliveries - (completed_today + 1)) as gap_from_target
    `;

    try {
      const result = await db.query(query, [nextState, driverId]);

      // Calculate hours worked
      if (driver.delivery_started_at) {
        const duration = (new Date() - new Date(driver.delivery_started_at)) / (1000 * 60 * 60);
        await this.updateWorkingHours(driverId, duration);
      }

      logger.info(`[DriverModel] Delivery completed: ${orderId}`, {
        driverId,
        nextState,
        completedToday: result.rows[0].completed_today,
        gap: result.rows[0].gap_from_target,
      });

      return result.rows[0];
    } catch (error) {
      logger.error('[DriverModel] Failed to complete delivery', error);
      throw error;
    }
  }

  /**
   * Update working hours
   */
  static async updateWorkingHours(driverId, additionalHours) {
    const query = `
      UPDATE drivers
      SET
        hours_worked_today = hours_worked_today + $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING hours_worked_today, max_working_hours
    `;

    try {
      const result = await db.query(query, [additionalHours, driverId]);
      return result.rows[0];
    } catch (error) {
      logger.error('[DriverModel] Failed to update working hours', error);
      throw error;
    }
  }

  /**
   * Start break
   */
  static async startBreak(driverId) {
    await this.updateState(driverId, 'ON_BREAK', {
      reason: TRANSITION_REASONS.BREAK_STARTED,
      triggeredBy: 'driver',
    });

    const query = `
      UPDATE drivers
      SET
        last_break_at = CURRENT_TIMESTAMP,
        consecutive_deliveries = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await db.query(query, [driverId]);
      logger.info(`[DriverModel] Break started for driver ${driverId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('[DriverModel] Failed to start break', error);
      throw error;
    }
  }

  /**
   * End break
   */
  static async endBreak(driverId) {
    const driver = await this.getById(driverId);

    if (driver.last_break_at) {
      const breakDuration = Math.floor((new Date() - new Date(driver.last_break_at)) / (1000 * 60));

      const query = `
        UPDATE drivers
        SET
          break_duration_minutes = break_duration_minutes + $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;

      await db.query(query, [breakDuration, driverId]);
    }

    await this.updateState(driverId, 'AVAILABLE', {
      reason: TRANSITION_REASONS.BREAK_ENDED,
      triggeredBy: 'driver',
    });

    logger.info(`[DriverModel] Break ended for driver ${driverId}`);
    return await this.getById(driverId);
  }

  /**
   * Check if driver is available for new order
   */
  static async isAvailable(driverId) {
    const query = `
      SELECT can_accept_order($1) as is_available
    `;

    try {
      const result = await db.query(query, [driverId]);
      return result.rows[0]?.is_available || false;
    } catch (error) {
      logger.error('[DriverModel] Failed to check availability', error);
      return false;
    }
  }

  /**
   * Calculate ETA to become available
   */
  static async calculateETA(driverId) {
    const driver = await this.getById(driverId);

    if (!driver) return null;

    switch (driver.operational_state) {
      case 'AVAILABLE':
        return new Date(); // Already available

      case 'BUSY':
        return driver.eta_to_dropoff || null;

      case 'RETURNING':
        // Estimate 15-30 minutes return time
        return new Date(Date.now() + 20 * 60 * 1000);

      case 'ON_BREAK':
        // Assume 15 minute break
        const breakElapsed = driver.last_break_at
          ? (new Date() - new Date(driver.last_break_at)) / 1000 / 60
          : 0;
        const breakRemaining = Math.max(0, 15 - breakElapsed);
        return new Date(Date.now() + breakRemaining * 60 * 1000);

      case 'OFFLINE':
        return null; // Not available

      default:
        return null;
    }
  }

  /**
   * Get available drivers near location
   */
  static async getAvailableDrivers(location, options = {}) {
    const {
      serviceType = null,
      radiusKm = 10,
      limit = 20,
      minRating = 0,
      vehicleType = null,
    } = options;

    let query = `
      SELECT
        d.*,
        ST_X(d.current_location::geometry) as longitude,
        ST_Y(d.current_location::geometry) as latitude,
        (d.target_deliveries - d.completed_today) as gap_from_target,
        can_accept_order(d.id) as can_accept_order,
        ST_Distance(
          d.current_location,
          ST_GeogFromText('POINT(${location.lng} ${location.lat})')
        ) / 1000 as distance_km
      FROM drivers d
      WHERE d.is_active = true
        AND d.operational_state IN ('AVAILABLE', 'RETURNING')
        AND can_accept_order(d.id) = true
        AND d.rating >= $1
    `;

    const values = [minRating];
    let valueIndex = 2;

    // Filter by service type
    if (serviceType) {
      query += ` AND $${valueIndex} = ANY(d.service_types)`;
      values.push(serviceType);
      valueIndex++;
    }

    // Filter by vehicle type
    if (vehicleType) {
      query += ` AND d.vehicle_type = $${valueIndex}`;
      values.push(vehicleType);
      valueIndex++;
    }

    // Filter by distance
    query += `
      AND ST_DWithin(
        d.current_location,
        ST_GeogFromText('POINT(${location.lng} ${location.lat})'),
        ${radiusKm * 1000}
      )
    `;

    // Order by priority: AVAILABLE first, then by distance and rating
    query += `
      ORDER BY
        CASE d.operational_state
          WHEN 'AVAILABLE' THEN 0
          WHEN 'RETURNING' THEN 1
          ELSE 2
        END,
        distance_km ASC,
        d.rating DESC,
        d.completed_today ASC
      LIMIT $${valueIndex}
    `;

    values.push(limit);

    try {
      const result = await db.query(query, values);
      logger.debug(`[DriverModel] Found ${result.rows.length} available drivers`, {
        location,
        radiusKm,
      });
      return result.rows;
    } catch (error) {
      logger.error('[DriverModel] Failed to get available drivers', error);
      throw error;
    }
  }

  /**
   * Get driver performance metrics
   */
  static async getPerformance(driverId, period = '30 days') {
    const query = `
      SELECT
        d.id,
        d.name,
        d.operational_state,
        d.completed_today,
        d.target_deliveries,
        (d.target_deliveries - d.completed_today) as gap_from_target,
        d.on_time_rate,
        d.hours_worked_today,
        d.rating,
        d.total_deliveries,
        d.successful_deliveries,
        d.failed_deliveries,
        CASE
          WHEN d.total_deliveries > 0
          THEN (d.successful_deliveries::DECIMAL / d.total_deliveries * 100)
          ELSE 0
        END as success_rate,
        COUNT(DISTINCT o.id) as period_orders,
        COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'delivered') as period_delivered,
        AVG(EXTRACT(EPOCH FROM (o.delivered_at - o.picked_up_at))/60) as avg_delivery_time_minutes,
        SUM(o.actual_distance) as total_distance_km
      FROM drivers d
      LEFT JOIN orders o ON d.id = o.driver_id
        AND o.created_at >= CURRENT_DATE - INTERVAL '${period}'
      WHERE d.id = $1
      GROUP BY d.id
    `;

    try {
      const result = await db.query(query, [driverId]);
      return result.rows[0];
    } catch (error) {
      logger.error('[DriverModel] Failed to get driver performance', error);
      throw error;
    }
  }

  /**
   * Get fleet status summary
   */
  static async getFleetStatus() {
    const query = `
      SELECT * FROM fleet_status_realtime
      ORDER BY operational_state
    `;

    try {
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      // Fallback if view doesn't exist - query drivers table directly
      if (error.message && error.message.includes('does not exist')) {
        logger.warn('[DriverModel] fleet_status_realtime view not found, using fallback query');

        const fallbackQuery = `
          SELECT
            status as operational_state,
            COUNT(*) as driver_count,
            0 as avg_completed_today,
            0 as avg_hours_worked,
            100.00 as avg_on_time_rate,
            ARRAY_AGG(id) as driver_ids
          FROM drivers
          WHERE is_active = true
          GROUP BY status
          ORDER BY status
        `;

        try {
          const fallbackResult = await db.query(fallbackQuery);
          return fallbackResult.rows;
        } catch (fallbackError) {
          logger.error('[DriverModel] Fallback query also failed', fallbackError);
          // Return empty array instead of throwing
          return [];
        }
      }

      logger.error('[DriverModel] Failed to get fleet status', error);
      throw error;
    }
  }

  /**
   * Reset daily metrics (should be run at midnight)
   */
  static async resetDailyMetrics() {
    try {
      await db.query('SELECT reset_daily_driver_metrics()');
      logger.info('[DriverModel] Daily metrics reset completed');
      return true;
    } catch (error) {
      logger.error('[DriverModel] Failed to reset daily metrics', error);
      throw error;
    }
  }

  /**
   * Update driver location
   */
  static async updateLocation(driverId, latitude, longitude) {
    const query = `
      UPDATE drivers
      SET
        current_location = ST_GeogFromText($1),
        last_location_update = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *,
        ST_X(current_location::geometry) as longitude,
        ST_Y(current_location::geometry) as latitude
    `;

    const point = `POINT(${longitude} ${latitude})`;

    try {
      const result = await db.query(query, [point, driverId]);
      logger.debug(`[DriverModel] Updated location for driver ${driverId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('[DriverModel] Failed to update driver location', error);
      throw error;
    }
  }

  /**
   * Get state transition history
   */
  static async getStateHistory(driverId, limit = 50) {
    const query = `
      SELECT *
      FROM driver_state_transitions
      WHERE driver_id = $1
      ORDER BY transitioned_at DESC
      LIMIT $2
    `;

    try {
      const result = await db.query(query, [driverId, limit]);
      return result.rows;
    } catch (error) {
      logger.error('[DriverModel] Failed to get state history', error);
      throw error;
    }
  }

  /**
   * Update on-time rate (call after each delivery)
   */
  static async updateOnTimeRate(driverId) {
    try {
      await db.query('SELECT update_driver_on_time_rate($1)', [driverId]);
      logger.debug(`[DriverModel] Updated on-time rate for driver ${driverId}`);
      return true;
    } catch (error) {
      logger.error('[DriverModel] Failed to update on-time rate', error);
      throw error;
    }
  }

  /**
   * Batch update driver locations (for GPS tracking)
   */
  static async batchUpdateLocations(updates) {
    return await db.transaction(async (client) => {
      const updated = [];

      for (const update of updates) {
        const { driverId, latitude, longitude } = update;
        const query = `
          UPDATE drivers
          SET
            current_location = ST_GeogFromText($1),
            last_location_update = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING id
        `;

        const point = `POINT(${longitude} ${latitude})`;
        const result = await client.query(query, [point, driverId]);

        if (result.rows.length > 0) {
          updated.push(driverId);
        }
      }

      logger.info(`[DriverModel] Batch updated locations for ${updated.length} drivers`);
      return updated;
    });
  }

  /**
   * Get driver by employee ID
   */
  static async getByEmployeeId(employeeId) {
    const query = `
      SELECT d.*,
        ST_X(d.current_location::geometry) as longitude,
        ST_Y(d.current_location::geometry) as latitude,
        (d.target_deliveries - d.completed_today) as gap_from_target
      FROM drivers d
      WHERE d.employee_id = $1
    `;

    try {
      const result = await db.query(query, [employeeId]);
      return result.rows[0];
    } catch (error) {
      logger.error('[DriverModel] Failed to get driver by employee ID', error);
      throw error;
    }
  }
}

// Export model and constants
module.exports = DriverModel;
module.exports.VALID_TRANSITIONS = VALID_TRANSITIONS;
module.exports.TRANSITION_REASONS = TRANSITION_REASONS;
