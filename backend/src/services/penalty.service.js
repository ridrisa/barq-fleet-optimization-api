/**
 * Penalty Service
 * Calculates SLA breach penalties and manages compensation
 */

const { logger } = require('../utils/logger');
const db = require('../database');

class PenaltyService {
  constructor() {
    this.penaltyRates = {
      BARQ: {
        // Express delivery: 1 hour SLA
        sla_minutes: 60,
        penalty_per_minute: 10, // 10 SAR per minute late
        max_penalty: 200, // Cap at 200 SAR
        min_penalty: 20, // Minimum 20 SAR for any breach
      },
      BULLET: {
        // Standard delivery: 2-4 hours SLA
        sla_minutes: 240,
        penalty_per_minute: 5, // 5 SAR per minute late
        max_penalty: 150, // Cap at 150 SAR
        min_penalty: 15, // Minimum 15 SAR for any breach
      },
    };

    this.penaltyHistory = [];
    this.totalPenaltiesIssued = 0;
    this.totalCompensationPaid = 0;
  }

  /**
   * Calculate penalty for SLA breach
   */
  calculatePenalty(order, actualDeliveryTime) {
    try {
      const serviceType = order.service_type;
      const rates = this.penaltyRates[serviceType];

      if (!rates) {
        logger.warn(`[PenaltyService] Unknown service type: ${serviceType}`);
        return null;
      }

      // Calculate delivery time
      const orderCreatedAt = new Date(order.created_at);
      const deliveredAt = actualDeliveryTime ? new Date(actualDeliveryTime) : new Date();
      const actualMinutes = Math.floor((deliveredAt - orderCreatedAt) / 60000);

      // Check if SLA was breached
      if (actualMinutes <= rates.sla_minutes) {
        logger.info(
          `[PenaltyService] No SLA breach for order ${order.id}. Actual: ${actualMinutes}min, SLA: ${rates.sla_minutes}min`
        );
        return {
          breached: false,
          actualMinutes,
          slaMinutes: rates.sla_minutes,
          penaltyAmount: 0,
          reason: 'On-time delivery',
        };
      }

      // Calculate breach duration
      const breachMinutes = actualMinutes - rates.sla_minutes;

      // Calculate penalty amount
      let penaltyAmount = breachMinutes * rates.penalty_per_minute;

      // Apply minimum penalty
      if (penaltyAmount < rates.min_penalty) {
        penaltyAmount = rates.min_penalty;
      }

      // Apply maximum penalty cap
      if (penaltyAmount > rates.max_penalty) {
        penaltyAmount = rates.max_penalty;
      }

      // Determine if preventable
      const preventable = this.isPreventable(order, breachMinutes);

      logger.info(`[PenaltyService] SLA breach penalty calculated for order ${order.id}`, {
        serviceType,
        actualMinutes,
        slaMinutes: rates.sla_minutes,
        breachMinutes,
        penaltyAmount,
        preventable,
      });

      return {
        breached: true,
        serviceType,
        slaMinutes: rates.sla_minutes,
        actualMinutes,
        breachMinutes,
        penaltyAmount,
        preventable,
        reason: this.determineBreachReason(order),
        calculation: {
          ratePerMinute: rates.penalty_per_minute,
          rawAmount: breachMinutes * rates.penalty_per_minute,
          cappedAmount: penaltyAmount,
        },
      };
    } catch (error) {
      logger.error('[PenaltyService] Failed to calculate penalty', error);
      return null;
    }
  }

  /**
   * Determine if breach was preventable
   */
  isPreventable(order, breachMinutes) {
    // Check reassignment history
    const reassignmentCount = order.reassignment_count || 0;

    // If order was never reassigned and breach was significant, it was likely preventable
    if (reassignmentCount === 0 && breachMinutes > 10) {
      return true;
    }

    // If order was reassigned multiple times, system tried to prevent
    if (reassignmentCount >= 2) {
      return false;
    }

    // Check if there were available drivers at the time
    // TODO: Query historical driver availability

    // Default: assume preventable if minor breach
    return breachMinutes <= 15;
  }

  /**
   * Determine breach reason
   */
  determineBreachReason(order) {
    // Check order metadata for failure reasons
    if (order.failure_reason) {
      return order.failure_reason;
    }

    // Check reassignment history
    if (order.last_reassignment_reason) {
      return order.last_reassignment_reason;
    }

    // Check driver issues
    if (order.driver_cancelled) {
      return 'Driver cancelled';
    }

    // Default
    return 'Late delivery';
  }

  /**
   * Record SLA breach and penalty
   */
  async recordBreach(order, penalty) {
    try {
      const breachRecord = {
        order_id: order.id,
        order_number: order.order_number,
        customer_id: order.customer_id,
        driver_id: order.driver_id,
        service_type: order.service_type,
        sla_minutes: penalty.slaMinutes,
        actual_minutes: penalty.actualMinutes,
        breach_minutes: penalty.breachMinutes,
        penalty_amount: penalty.penaltyAmount,
        preventable: penalty.preventable,
        reason: penalty.reason,
        created_at: new Date(),
        compensation_paid: false,
      };

      // Save to database
      const query = `
        INSERT INTO sla_breaches (
          order_id,
          order_number,
          customer_id,
          driver_id,
          service_type,
          sla_minutes,
          actual_minutes,
          breach_minutes,
          penalty_amount,
          preventable,
          reason,
          compensation_paid
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `;

      const result = await db.query(query, [
        breachRecord.order_id,
        breachRecord.order_number,
        breachRecord.customer_id,
        breachRecord.driver_id,
        breachRecord.service_type,
        breachRecord.sla_minutes,
        breachRecord.actual_minutes,
        breachRecord.breach_minutes,
        breachRecord.penalty_amount,
        breachRecord.preventable,
        breachRecord.reason,
        breachRecord.compensation_paid,
      ]);

      breachRecord.id = result.rows[0].id;

      // Update in-memory history
      this.penaltyHistory.push(breachRecord);
      this.totalPenaltiesIssued += penalty.penaltyAmount;

      // Keep only last 100 in memory
      if (this.penaltyHistory.length > 100) {
        this.penaltyHistory.shift();
      }

      logger.info(`[PenaltyService] SLA breach recorded`, {
        breachId: breachRecord.id,
        orderId: order.id,
        penaltyAmount: penalty.penaltyAmount,
      });

      return breachRecord;
    } catch (error) {
      logger.error('[PenaltyService] Failed to record breach', error);
      throw error;
    }
  }

  /**
   * Process customer compensation
   */
  async processCompensation(breachId, paymentMethod = 'ACCOUNT_CREDIT') {
    try {
      // Get breach record
      const query = 'SELECT * FROM sla_breaches WHERE id = $1';
      const result = await db.query(query, [breachId]);

      if (result.rows.length === 0) {
        logger.warn(`[PenaltyService] Breach record not found: ${breachId}`);
        return { success: false, reason: 'BREACH_NOT_FOUND' };
      }

      const breach = result.rows[0];

      if (breach.compensation_paid) {
        logger.info(`[PenaltyService] Compensation already paid for breach ${breachId}`);
        return { success: false, reason: 'ALREADY_PAID' };
      }

      // Process payment
      const compensation = {
        breach_id: breachId,
        customer_id: breach.customer_id,
        amount: breach.penalty_amount,
        payment_method: paymentMethod,
        processed_at: new Date(),
        transaction_id: `COMP-${Date.now()}-${breachId}`,
      };

      // TODO: Integrate with payment gateway
      logger.info(`[PenaltyService] Processing compensation payment`, compensation);

      // Record compensation
      const compensationQuery = `
        INSERT INTO compensations (
          breach_id,
          customer_id,
          amount,
          payment_method,
          transaction_id,
          processed_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;

      const compResult = await db.query(compensationQuery, [
        compensation.breach_id,
        compensation.customer_id,
        compensation.amount,
        compensation.payment_method,
        compensation.transaction_id,
        compensation.processed_at,
      ]);

      compensation.id = compResult.rows[0].id;

      // Update breach record
      await db.query(
        'UPDATE sla_breaches SET compensation_paid = true, compensation_paid_at = $1 WHERE id = $2',
        [new Date(), breachId]
      );

      // Update totals
      this.totalCompensationPaid += breach.penalty_amount;

      logger.info(`[PenaltyService] Compensation processed successfully`, {
        compensationId: compensation.id,
        breachId,
        amount: compensation.amount,
      });

      return {
        success: true,
        compensation,
      };
    } catch (error) {
      logger.error('[PenaltyService] Failed to process compensation', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get penalty statistics
   */
  async getStatistics(startDate, endDate) {
    try {
      const query = `
        SELECT
          service_type,
          COUNT(*) as total_breaches,
          SUM(penalty_amount) as total_penalties,
          AVG(breach_minutes) as avg_breach_minutes,
          COUNT(*) FILTER (WHERE preventable = true) as preventable_count,
          COUNT(*) FILTER (WHERE compensation_paid = true) as compensated_count,
          SUM(penalty_amount) FILTER (WHERE compensation_paid = true) as total_compensated
        FROM sla_breaches
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY service_type
      `;

      const result = await db.query(query, [startDate, endDate]);

      const stats = {
        overall: {
          totalBreaches: 0,
          totalPenalties: 0,
          totalCompensated: 0,
          preventableCount: 0,
          avgBreachMinutes: 0,
        },
        byServiceType: {},
      };

      result.rows.forEach((row) => {
        stats.byServiceType[row.service_type] = {
          totalBreaches: parseInt(row.total_breaches),
          totalPenalties: parseFloat(row.total_penalties),
          avgBreachMinutes: parseFloat(row.avg_breach_minutes),
          preventableCount: parseInt(row.preventable_count),
          compensatedCount: parseInt(row.compensated_count),
          totalCompensated: parseFloat(row.total_compensated || 0),
        };

        // Update overall stats
        stats.overall.totalBreaches += parseInt(row.total_breaches);
        stats.overall.totalPenalties += parseFloat(row.total_penalties);
        stats.overall.totalCompensated += parseFloat(row.total_compensated || 0);
        stats.overall.preventableCount += parseInt(row.preventable_count);
      });

      // Calculate average
      if (result.rows.length > 0) {
        const totalBreachMinutes = result.rows.reduce((sum, row) => {
          return sum + parseFloat(row.avg_breach_minutes) * parseInt(row.total_breaches);
        }, 0);
        stats.overall.avgBreachMinutes = totalBreachMinutes / stats.overall.totalBreaches;
      }

      logger.info('[PenaltyService] Statistics calculated', {
        startDate,
        endDate,
        totalBreaches: stats.overall.totalBreaches,
      });

      return stats;
    } catch (error) {
      logger.error('[PenaltyService] Failed to get statistics', error);
      throw error;
    }
  }

  /**
   * Get top breach reasons
   */
  async getTopBreachReasons(limit = 10) {
    try {
      const query = `
        SELECT
          reason,
          COUNT(*) as count,
          SUM(penalty_amount) as total_penalties
        FROM sla_breaches
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY reason
        ORDER BY count DESC
        LIMIT $1
      `;

      const result = await db.query(query, [limit]);

      return result.rows.map((row) => ({
        reason: row.reason,
        count: parseInt(row.count),
        totalPenalties: parseFloat(row.total_penalties),
      }));
    } catch (error) {
      logger.error('[PenaltyService] Failed to get breach reasons', error);
      return [];
    }
  }

  /**
   * Get preventable breach analysis
   */
  async getPreventableBreachAnalysis() {
    try {
      const query = `
        SELECT
          preventable,
          COUNT(*) as count,
          SUM(penalty_amount) as total_penalties,
          AVG(breach_minutes) as avg_breach_minutes
        FROM sla_breaches
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY preventable
      `;

      const result = await db.query(query);

      const analysis = {
        preventable: {},
        nonPreventable: {},
        preventableRate: 0,
      };

      result.rows.forEach((row) => {
        const data = {
          count: parseInt(row.count),
          totalPenalties: parseFloat(row.total_penalties),
          avgBreachMinutes: parseFloat(row.avg_breach_minutes),
        };

        if (row.preventable) {
          analysis.preventable = data;
        } else {
          analysis.nonPreventable = data;
        }
      });

      // Calculate preventable rate
      const totalCount = (analysis.preventable.count || 0) + (analysis.nonPreventable.count || 0);
      if (totalCount > 0) {
        analysis.preventableRate = (analysis.preventable.count || 0) / totalCount;
      }

      logger.info('[PenaltyService] Preventable breach analysis calculated', {
        preventableRate: `${(analysis.preventableRate * 100).toFixed(2)}%`,
      });

      return analysis;
    } catch (error) {
      logger.error('[PenaltyService] Failed to get preventable analysis', error);
      throw error;
    }
  }

  /**
   * Get penalty history
   */
  getPenaltyHistory(limit = 50) {
    return this.penaltyHistory.slice(-limit).reverse();
  }

  /**
   * Get total penalties issued
   */
  getTotalPenaltiesIssued() {
    return this.totalPenaltiesIssued;
  }

  /**
   * Get total compensation paid
   */
  getTotalCompensationPaid() {
    return this.totalCompensationPaid;
  }

  /**
   * Estimate potential penalty for order
   */
  estimatePotentialPenalty(order, estimatedDelayMinutes) {
    const serviceType = order.service_type;
    const rates = this.penaltyRates[serviceType];

    if (!rates || estimatedDelayMinutes <= 0) {
      return 0;
    }

    let penalty = estimatedDelayMinutes * rates.penalty_per_minute;
    penalty = Math.max(penalty, rates.min_penalty);
    penalty = Math.min(penalty, rates.max_penalty);

    return penalty;
  }
}

// Export singleton instance
let instance = null;

module.exports = {
  PenaltyService,
  getInstance: () => {
    if (!instance) {
      instance = new PenaltyService();
    }
    return instance;
  },
};
