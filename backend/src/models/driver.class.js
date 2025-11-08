/**
 * Driver Class - In-Memory State Management
 * Lightweight driver state tracking for instant delivery operations
 * Sprint 0 Task 1.2 - Driver State Tracking
 *
 * States: AVAILABLE, BUSY, RETURNING, OFFLINE, ON_BREAK
 *
 * State Transitions:
 * - AVAILABLE → BUSY (order assigned)
 * - BUSY → RETURNING (delivery completed, returning to hub)
 * - BUSY → AVAILABLE (delivery completed, already at hub)
 * - RETURNING → AVAILABLE (arrived at hub)
 * - AVAILABLE → ON_BREAK (driver break)
 * - ON_BREAK → AVAILABLE (break ended)
 * - Any → OFFLINE (shift end)
 * - OFFLINE → AVAILABLE (shift start)
 */

class Driver {
  /**
   * Create a new driver instance
   * @param {Object} data - Driver initialization data
   */
  constructor(data) {
    // Core identification
    this.fleet_id = data.fleet_id;
    this.name = data.name || `Driver ${data.fleet_id}`;
    this.employee_id = data.employee_id || data.fleet_id;

    // Operational state
    this.status = data.status || 'AVAILABLE';
    this.previous_status = null;
    this.state_changed_at = data.state_changed_at || new Date().toISOString();

    // Location tracking
    this.current_location = data.current_location || {
      latitude: data.current_latitude || 0,
      longitude: data.current_longitude || 0,
    };

    // Active delivery tracking
    this.active_delivery = data.active_delivery || null;
    this.active_delivery_id = data.active_delivery_id || null;

    // Performance metrics
    this.target_deliveries = data.target_deliveries || 25;
    this.completed_today = data.completed_today || 0;
    this.gap_from_target = this.target_deliveries - this.completed_today;
    this.on_time_rate = data.on_time_rate || 1.0;

    // Vehicle information
    this.vehicle_type = data.vehicle_type || 'TRUCK';
    this.capacity_kg = data.capacity_kg || 3000;

    // Working hours tracking
    this.hours_worked_today = data.hours_worked_today || 0;
    this.max_working_hours = data.max_working_hours || 8;
    this.consecutive_deliveries = data.consecutive_deliveries || 0;
    this.max_consecutive_deliveries = data.max_consecutive_deliveries || 5;

    // Break tracking
    this.last_break_at = data.last_break_at || null;
    this.break_duration_minutes = data.break_duration_minutes || 0;

    // Timestamps
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
  }

  /**
   * Check if driver is available for assignment
   * @returns {boolean}
   */
  isAvailable() {
    return (
      this.status === 'AVAILABLE' &&
      this.gap_from_target > 0 &&
      this.hours_worked_today < this.max_working_hours &&
      this.active_delivery === null
    );
  }

  /**
   * Check if driver can accept a new order
   * Stricter than isAvailable - includes performance checks
   * @returns {boolean}
   */
  canAcceptOrder() {
    if (!this.isAvailable()) {
      return false;
    }

    // Check on-time performance (must be >= 90%)
    if (this.on_time_rate < 0.9) {
      return false;
    }

    // Check if needs mandatory break
    if (this.consecutive_deliveries >= this.max_consecutive_deliveries) {
      return false;
    }

    // Check working hours limit
    if (this.hours_worked_today >= this.max_working_hours) {
      return false;
    }

    return true;
  }

  /**
   * Assign an order to this driver
   * Transitions: AVAILABLE → BUSY
   * @param {Object} order - Order details
   * @returns {Object} Updated driver state
   */
  assignOrder(order) {
    if (!this.canAcceptOrder()) {
      throw new Error(
        `Driver ${this.fleet_id} cannot accept order. ` +
          `Status: ${this.status}, Gap: ${this.gap_from_target}, ` +
          `Hours: ${this.hours_worked_today}/${this.max_working_hours}, ` +
          `On-time: ${(this.on_time_rate * 100).toFixed(1)}%`
      );
    }

    this.updateState('BUSY', {
      reason: 'order_assigned',
      order_id: order.id || order.order_id,
    });

    this.active_delivery = order;
    this.active_delivery_id = order.id || order.order_id;
    this.consecutive_deliveries += 1;

    return this.toJSON();
  }

  /**
   * Mark delivery as completed
   * Transitions: BUSY → RETURNING or BUSY → AVAILABLE
   * @param {Object} options - Completion options
   * @returns {Object} Updated driver state
   */
  completeDelivery(options = {}) {
    if (this.status !== 'BUSY') {
      throw new Error(`Driver ${this.fleet_id} is not busy. Current status: ${this.status}`);
    }

    if (!this.active_delivery) {
      throw new Error(`Driver ${this.fleet_id} has no active delivery to complete`);
    }

    // Update metrics
    this.completed_today += 1;
    this.gap_from_target = this.target_deliveries - this.completed_today;

    // Update on-time rate if delivery time info provided
    if (options.on_time !== undefined) {
      const totalDeliveries = this.completed_today;
      const previousOnTimeCount = Math.floor(this.on_time_rate * (totalDeliveries - 1));
      const currentOnTimeCount = previousOnTimeCount + (options.on_time ? 1 : 0);
      this.on_time_rate = currentOnTimeCount / totalDeliveries;
    }

    // Clear active delivery
    const completedOrder = this.active_delivery;
    this.active_delivery = null;
    this.active_delivery_id = null;

    // Determine next state
    const needsReturn = options.needs_return || false;
    const nextState = needsReturn ? 'RETURNING' : 'AVAILABLE';

    this.updateState(nextState, {
      reason: 'delivery_completed',
      completed_order: completedOrder.id || completedOrder.order_id,
    });

    // Check if driver needs mandatory break
    if (this.consecutive_deliveries >= this.max_consecutive_deliveries) {
      this.updateState('ON_BREAK', {
        reason: 'mandatory_break',
        consecutive_deliveries: this.consecutive_deliveries,
      });
      this.last_break_at = new Date().toISOString();
      this.consecutive_deliveries = 0;
    }

    return this.toJSON();
  }

  /**
   * Mark driver as returned to base
   * Transitions: RETURNING → AVAILABLE
   * @returns {Object} Updated driver state
   */
  returnToBase() {
    if (this.status !== 'RETURNING') {
      throw new Error(`Driver ${this.fleet_id} is not returning. Current status: ${this.status}`);
    }

    this.updateState('AVAILABLE', {
      reason: 'returned_to_base',
    });

    return this.toJSON();
  }

  /**
   * Start a break
   * Transitions: AVAILABLE → ON_BREAK
   * @returns {Object} Updated driver state
   */
  startBreak() {
    if (this.status !== 'AVAILABLE') {
      throw new Error(
        `Driver ${this.fleet_id} must be available to start break. Current status: ${this.status}`
      );
    }

    this.updateState('ON_BREAK', {
      reason: 'break_started',
    });

    this.last_break_at = new Date().toISOString();
    this.consecutive_deliveries = 0;

    return this.toJSON();
  }

  /**
   * End a break
   * Transitions: ON_BREAK → AVAILABLE
   * @returns {Object} Updated driver state
   */
  endBreak() {
    if (this.status !== 'ON_BREAK') {
      throw new Error(`Driver ${this.fleet_id} is not on break. Current status: ${this.status}`);
    }

    // Calculate break duration
    if (this.last_break_at) {
      const breakStart = new Date(this.last_break_at);
      const breakEnd = new Date();
      const breakMinutes = Math.floor((breakEnd - breakStart) / 60000);
      this.break_duration_minutes += breakMinutes;
    }

    this.updateState('AVAILABLE', {
      reason: 'break_ended',
    });

    return this.toJSON();
  }

  /**
   * Go offline (end shift)
   * Transitions: Any → OFFLINE
   * @returns {Object} Updated driver state
   */
  goOffline() {
    this.updateState('OFFLINE', {
      reason: 'shift_ended',
    });

    return this.toJSON();
  }

  /**
   * Go online (start shift)
   * Transitions: OFFLINE → AVAILABLE
   * @returns {Object} Updated driver state
   */
  goOnline() {
    if (this.status !== 'OFFLINE') {
      throw new Error(`Driver ${this.fleet_id} is already online. Current status: ${this.status}`);
    }

    this.updateState('AVAILABLE', {
      reason: 'shift_started',
    });

    return this.toJSON();
  }

  /**
   * Update driver state with validation
   * @param {string} newStatus - New status
   * @param {Object} metadata - Additional metadata
   * @private
   */
  updateState(newStatus, metadata = {}) {
    const validStates = ['AVAILABLE', 'BUSY', 'RETURNING', 'OFFLINE', 'ON_BREAK'];

    if (!validStates.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}. Valid states: ${validStates.join(', ')}`);
    }

    this.previous_status = this.status;
    this.status = newStatus;
    this.state_changed_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
  }

  /**
   * Update driver location
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @returns {Object} Updated driver state
   */
  updateLocation(latitude, longitude) {
    this.current_location = {
      latitude,
      longitude,
      updated_at: new Date().toISOString(),
    };

    this.updated_at = new Date().toISOString();

    return this.toJSON();
  }

  /**
   * Update working hours
   * @param {number} hours - Hours to add
   * @returns {Object} Updated driver state
   */
  addWorkingHours(hours) {
    this.hours_worked_today += hours;
    this.updated_at = new Date().toISOString();

    return this.toJSON();
  }

  /**
   * Reset daily metrics (called at end of day)
   * @returns {Object} Updated driver state
   */
  resetDailyMetrics() {
    this.completed_today = 0;
    this.gap_from_target = this.target_deliveries;
    this.hours_worked_today = 0;
    this.consecutive_deliveries = 0;
    this.break_duration_minutes = 0;
    this.last_break_at = null;
    this.updated_at = new Date().toISOString();

    return this.toJSON();
  }

  /**
   * Get driver performance summary
   * @returns {Object} Performance metrics
   */
  getPerformance() {
    return {
      fleet_id: this.fleet_id,
      name: this.name,
      status: this.status,
      completed_today: this.completed_today,
      target_deliveries: this.target_deliveries,
      gap_from_target: this.gap_from_target,
      progress_percentage: Math.round((this.completed_today / this.target_deliveries) * 100),
      on_time_rate: this.on_time_rate,
      on_time_percentage: Math.round(this.on_time_rate * 100),
      hours_worked_today: this.hours_worked_today,
      max_working_hours: this.max_working_hours,
      consecutive_deliveries: this.consecutive_deliveries,
      max_consecutive_deliveries: this.max_consecutive_deliveries,
      break_duration_minutes: this.break_duration_minutes,
      can_accept_order: this.canAcceptOrder(),
      is_available: this.isAvailable(),
    };
  }

  /**
   * Convert driver to JSON object
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      fleet_id: this.fleet_id,
      name: this.name,
      employee_id: this.employee_id,
      status: this.status,
      previous_status: this.previous_status,
      state_changed_at: this.state_changed_at,
      current_location: this.current_location,
      active_delivery: this.active_delivery,
      active_delivery_id: this.active_delivery_id,
      target_deliveries: this.target_deliveries,
      completed_today: this.completed_today,
      gap_from_target: this.gap_from_target,
      on_time_rate: this.on_time_rate,
      vehicle_type: this.vehicle_type,
      capacity_kg: this.capacity_kg,
      hours_worked_today: this.hours_worked_today,
      max_working_hours: this.max_working_hours,
      consecutive_deliveries: this.consecutive_deliveries,
      max_consecutive_deliveries: this.max_consecutive_deliveries,
      last_break_at: this.last_break_at,
      break_duration_minutes: this.break_duration_minutes,
      created_at: this.created_at,
      updated_at: this.updated_at,
      // Computed properties
      is_available: this.isAvailable(),
      can_accept_order: this.canAcceptOrder(),
    };
  }

  /**
   * Create Driver instance from fleet vehicle data
   * @param {Object} vehicle - Vehicle data from fleet
   * @returns {Driver} New Driver instance
   */
  static fromVehicle(vehicle) {
    return new Driver({
      fleet_id: vehicle.fleet_id || vehicle.id,
      vehicle_type: vehicle.vehicle_type || vehicle.type,
      capacity_kg: vehicle.capacity_kg,
      current_latitude: vehicle.current_latitude,
      current_longitude: vehicle.current_longitude,
      status: vehicle.status || 'AVAILABLE',
      name: vehicle.driver_name || `Driver ${vehicle.fleet_id || vehicle.id}`,
      employee_id: vehicle.driver_id || vehicle.fleet_id || vehicle.id,
    });
  }
}

module.exports = Driver;
