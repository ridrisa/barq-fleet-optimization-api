/**
 * SLA Calculator Service
 * Implements production SLA calculation logic from BARQ Fleet
 * Source: barqfleet_db_files/sla_monitor.py
 *
 * SLA Rules:
 * - Standard: 4 hours same-day delivery
 * - Late orders (after 7 PM): Next day 9 AM + grace period
 * - Friday orders: 4 PM deadline instead of 9 AM
 * - Timezone: GMT+3 (Saudi Arabia)
 */

const moment = require('moment-timezone');
const logger = require('../utils/logger');

// Service type SLA targets (in minutes)
const SLA_TARGETS = {
  BARQ: 60,      // 1 hour
  BULLET: 240,   // 4 hours
  EXPRESS: 30,   // 30 minutes
};

class SLACalculatorService {
  /**
   * Calculate SLA deadline for an order
   * @param {Date|string} createdAt - Order creation timestamp
   * @param {string} serviceType - Service type (BARQ, BULLET, EXPRESS)
   * @returns {object} SLA deadline information
   */
  static calculateDeadline(createdAt, serviceType = 'BARQ') {
    // Convert to Saudi Arabia timezone (GMT+3)
    const creationTime = moment(createdAt).tz('Asia/Riyadh');

    // Calculate closing time (11 PM on creation date)
    const closingTime = creationTime.clone()
      .hours(23)
      .minutes(0)
      .seconds(0)
      .milliseconds(0);

    // Seconds left until closing time
    const secondsLeftToClose = closingTime.diff(creationTime, 'seconds');

    // If created within 4 hours of closing (after 7 PM)
    if (secondsLeftToClose <= 14400) { // 14400 seconds = 4 hours
      // Calculate grace period
      const grace = Math.max(0, 14400 - secondsLeftToClose);

      // Next day deadline starts at 9 AM
      let nextDayDeadline = creationTime.clone()
        .add(1, 'day')
        .hours(9)
        .minutes(0)
        .seconds(0)
        .milliseconds(0);

      // Friday rule: 4 PM instead of 9 AM
      if (nextDayDeadline.day() === 5) { // Friday
        nextDayDeadline.hours(16);
      }

      // Add grace period
      nextDayDeadline.add(grace, 'seconds');

      return {
        deadline: nextDayDeadline.toDate(),
        is_same_day: false,
        grace_seconds: grace,
        sla_target_minutes: SLA_TARGETS[serviceType] || SLA_TARGETS.BARQ,
        calculation_method: 'next_day_with_grace',
      };
    }

    // Same day delivery: 4 hours from creation
    const sameDayDeadline = creationTime.clone().add(4, 'hours');

    return {
      deadline: sameDayDeadline.toDate(),
      is_same_day: true,
      grace_seconds: 0,
      sla_target_minutes: SLA_TARGETS[serviceType] || SLA_TARGETS.BARQ,
      calculation_method: 'same_day_4_hours',
    };
  }

  /**
   * Calculate SLA status for an order
   * @param {object} order - Order object with created_at, delivered_at, sla_deadline
   * @returns {object} SLA status information
   */
  static calculateStatus(order) {
    const now = moment();
    const createdAt = moment(order.created_at);

    // Get or calculate deadline
    let deadline;
    if (order.sla_deadline) {
      deadline = moment(order.sla_deadline);
    } else {
      const slaInfo = this.calculateDeadline(order.created_at, order.service_type);
      deadline = moment(slaInfo.deadline);
    }

    // Calculate time metrics
    const elapsedMinutes = now.diff(createdAt, 'minutes');
    const remainingMinutes = deadline.diff(now, 'minutes');

    // Determine status
    let status = 'on_track';
    let urgency = 'low';

    if (order.status === 'delivered' && order.delivered_at) {
      // Order is completed
      const deliveredAt = moment(order.delivered_at);
      const wasOnTime = deliveredAt.isSameOrBefore(deadline);
      const deliveryTimeMinutes = deliveredAt.diff(createdAt, 'minutes');

      status = wasOnTime ? 'delivered_on_time' : 'delivered_late';
      urgency = 'none';

      return {
        status,
        urgency,
        remaining_minutes: 0,
        elapsed_minutes: deliveryTimeMinutes,
        deadline: deadline.toISOString(),
        was_on_time: wasOnTime,
        breach_minutes: wasOnTime ? 0 : deliveredAt.diff(deadline, 'minutes'),
      };
    }

    // Order is still active
    if (remainingMinutes < 0) {
      status = 'breached';
      urgency = 'critical';
    } else if (remainingMinutes < 5) {
      status = 'at_risk_critical';
      urgency = 'critical';
    } else if (remainingMinutes < 15) {
      status = 'at_risk_high';
      urgency = 'high';
    } else if (remainingMinutes < 30) {
      status = 'at_risk_medium';
      urgency = 'medium';
    }

    return {
      status,
      urgency,
      remaining_minutes: Math.max(0, remainingMinutes),
      elapsed_minutes: elapsedMinutes,
      deadline: deadline.toISOString(),
      is_at_risk: remainingMinutes < 15,
      is_breached: remainingMinutes < 0,
    };
  }

  /**
   * Get orders at risk of SLA breach
   * @param {Array} orders - Array of order objects
   * @returns {Array} Orders at risk with SLA information
   */
  static getOrdersAtRisk(orders) {
    const ordersWithSLA = orders.map(order => ({
      ...order,
      sla: this.calculateStatus(order),
    }));

    // Filter for at-risk and breached orders
    const atRiskOrders = ordersWithSLA.filter(
      order => order.sla.is_at_risk || order.sla.is_breached
    );

    // Sort by urgency (critical first, then by remaining time)
    atRiskOrders.sort((a, b) => {
      // Critical orders first
      if (a.sla.urgency === 'critical' && b.sla.urgency !== 'critical') return -1;
      if (b.sla.urgency === 'critical' && a.sla.urgency !== 'critical') return 1;

      // Then by remaining time (least time first)
      return a.sla.remaining_minutes - b.sla.remaining_minutes;
    });

    return atRiskOrders;
  }

  /**
   * Calculate SLA compliance metrics for a period
   * @param {Array} orders - Array of completed order objects
   * @returns {object} SLA compliance metrics
   */
  static calculateComplianceMetrics(orders) {
    const completedOrders = orders.filter(
      order => order.status === 'delivered' && order.delivered_at
    );

    if (completedOrders.length === 0) {
      return {
        total_orders: 0,
        on_time_count: 0,
        late_count: 0,
        compliance_rate: 0,
        avg_delivery_time_minutes: 0,
        avg_breach_minutes: 0,
      };
    }

    let onTimeCount = 0;
    let lateCount = 0;
    let totalDeliveryTime = 0;
    let totalBreachTime = 0;
    let breachCount = 0;

    completedOrders.forEach(order => {
      const sla = this.calculateStatus(order);

      if (sla.was_on_time) {
        onTimeCount++;
      } else {
        lateCount++;
        totalBreachTime += sla.breach_minutes;
        breachCount++;
      }

      totalDeliveryTime += sla.elapsed_minutes;
    });

    const complianceRate = (onTimeCount / completedOrders.length) * 100;
    const avgDeliveryTime = totalDeliveryTime / completedOrders.length;
    const avgBreachTime = breachCount > 0 ? totalBreachTime / breachCount : 0;

    return {
      total_orders: completedOrders.length,
      on_time_count: onTimeCount,
      late_count: lateCount,
      compliance_rate: parseFloat(complianceRate.toFixed(2)),
      avg_delivery_time_minutes: parseFloat(avgDeliveryTime.toFixed(2)),
      avg_breach_minutes: parseFloat(avgBreachTime.toFixed(2)),
    };
  }

  /**
   * Get SLA summary by service type
   * @param {Array} orders - Array of order objects
   * @returns {object} SLA summary by service type
   */
  static getSLASummaryByServiceType(orders) {
    const summary = {};

    orders.forEach(order => {
      const serviceType = order.service_type || 'BARQ';

      if (!summary[serviceType]) {
        summary[serviceType] = {
          service_type: serviceType,
          sla_target_minutes: SLA_TARGETS[serviceType] || SLA_TARGETS.BARQ,
          orders: [],
        };
      }

      summary[serviceType].orders.push(order);
    });

    // Calculate metrics for each service type
    Object.keys(summary).forEach(serviceType => {
      const metrics = this.calculateComplianceMetrics(summary[serviceType].orders);
      summary[serviceType] = {
        ...summary[serviceType],
        ...metrics,
        orders: undefined, // Remove orders array from response
      };
    });

    return summary;
  }
}

module.exports = SLACalculatorService;
