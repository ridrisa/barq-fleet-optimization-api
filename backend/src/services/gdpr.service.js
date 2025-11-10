/**
 * GDPR Compliance Service
 * Implements GDPR requirements for data protection and privacy
 *
 * Features:
 * - Right to Access (Art. 15) - Export user data
 * - Right to Erasure (Art. 17) - Delete user data
 * - Right to Rectification (Art. 16) - Update user data
 * - Right to Data Portability (Art. 20) - Export data in machine-readable format
 * - Data Retention - Automatic deletion after retention period
 * - Consent Management - Track and manage user consent
 * - Data Breach Notification - Log and notify breaches
 */

const { logger } = require('../utils/logger');
const postgres = require('./postgres.service');

class GDPRService {
  constructor() {
    this.retentionPeriods = {
      orderData: 365 * 2, // 2 years for order data
      userData: 365 * 7, // 7 years for user data (regulatory requirement)
      logs: 365, // 1 year for logs
      analyticsData: 365 * 2, // 2 years for analytics
      deletedUserData: 30, // 30 days grace period for deleted users
    };
  }

  /**
   * Export all user data (Right to Access - Article 15)
   * @param {string} userId - User ID
   * @param {string} format - Export format ('json' or 'csv')
   * @returns {Promise<Object>} - User data export
   */
  async exportUserData(userId, format = 'json') {
    try {
      logger.info(`[GDPR] Data export requested for user: ${userId}`);

      // Collect all user data from different tables
      const userData = await this._collectUserData(userId);

      // Format data based on requested format
      const formattedData = format === 'csv' ? this._formatAsCSV(userData) : userData;

      // Log data export request (GDPR requirement)
      await this._logGDPRActivity({
        userId,
        action: 'DATA_EXPORT',
        dataType: 'FULL_EXPORT',
        format,
        status: 'SUCCESS',
      });

      return {
        success: true,
        data: formattedData,
        format,
        exportedAt: new Date().toISOString(),
        dataCategories: Object.keys(userData),
      };
    } catch (error) {
      logger.error(`[GDPR] Data export failed for user ${userId}:`, error);

      await this._logGDPRActivity({
        userId,
        action: 'DATA_EXPORT',
        status: 'FAILED',
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Delete all user data (Right to Erasure - Article 17)
   * @param {string} userId - User ID
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} - Deletion confirmation
   */
  async deleteUserData(userId, options = {}) {
    try {
      logger.info(`[GDPR] Data deletion requested for user: ${userId}`);

      const {
        softDelete = true, // Soft delete with 30-day grace period
        reason = 'USER_REQUEST',
        keepMinimalData = true, // Keep minimal data for legal/regulatory requirements
      } = options;

      // Check if user has pending orders or obligations
      const pendingObligations = await this._checkPendingObligations(userId);

      if (pendingObligations.hasPending && !options.force) {
        return {
          success: false,
          message: 'User has pending obligations. Cannot delete immediately.',
          pendingObligations,
          requiresForce: true,
        };
      }

      const deletionSummary = {
        userId,
        deletedAt: new Date().toISOString(),
        deletionType: softDelete ? 'SOFT_DELETE' : 'HARD_DELETE',
        reason,
        dataCategories: [],
      };

      if (softDelete) {
        // Soft delete: Mark for deletion after grace period
        await this._softDeleteUser(userId, reason);
        deletionSummary.gracePeriodEnds = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString();
        deletionSummary.canRecover = true;
      } else {
        // Hard delete: Permanent removal
        if (keepMinimalData) {
          // Keep minimal data required for legal/regulatory compliance
          deletionSummary.dataCategories = await this._hardDeleteUserWithRetention(userId);
        } else {
          // Complete deletion (use with caution - may violate regulations)
          deletionSummary.dataCategories = await this._completelyDeleteUser(userId);
        }
        deletionSummary.canRecover = false;
      }

      // Log deletion request (GDPR requirement)
      await this._logGDPRActivity({
        userId,
        action: 'DATA_DELETION',
        deletionType: deletionSummary.deletionType,
        reason,
        status: 'SUCCESS',
      });

      // Send confirmation email (GDPR requirement)
      await this._sendDeletionConfirmation(userId, deletionSummary);

      return {
        success: true,
        ...deletionSummary,
      };
    } catch (error) {
      logger.error(`[GDPR] Data deletion failed for user ${userId}:`, error);

      await this._logGDPRActivity({
        userId,
        action: 'DATA_DELETION',
        status: 'FAILED',
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Restore soft-deleted user within grace period
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Restoration confirmation
   */
  async restoreDeletedUser(userId) {
    try {
      logger.info(`[GDPR] User restoration requested: ${userId}`);

      // Check if user is in soft-deleted state
      const deletedUser = await this._getDeletedUser(userId);

      if (!deletedUser) {
        return {
          success: false,
          message: 'User not found in deleted users or grace period expired',
        };
      }

      // Check grace period
      const gracePeriodEnd = new Date(deletedUser.deleted_at);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);

      if (new Date() > gracePeriodEnd) {
        return {
          success: false,
          message: 'Grace period expired. User data has been permanently deleted.',
        };
      }

      // Restore user
      await this._restoreUser(userId);

      await this._logGDPRActivity({
        userId,
        action: 'DATA_RESTORATION',
        status: 'SUCCESS',
      });

      return {
        success: true,
        message: 'User account and data restored successfully',
        restoredAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`[GDPR] User restoration failed for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Record user consent (GDPR requirement)
   * @param {string} userId - User ID
   * @param {Object} consent - Consent details
   * @returns {Promise<Object>} - Consent record
   */
  async recordConsent(userId, consent) {
    try {
      const consentRecord = {
        userId,
        consentType: consent.type, // e.g., 'TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'MARKETING'
        consentGiven: consent.given,
        consentVersion: consent.version,
        consentDate: new Date().toISOString(),
        ipAddress: consent.ipAddress,
        userAgent: consent.userAgent,
        method: consent.method || 'WEB_FORM',
      };

      await this._saveConsentRecord(consentRecord);

      logger.info(`[GDPR] Consent recorded for user ${userId}: ${consent.type}`);

      return {
        success: true,
        consentId: consentRecord.consentId,
        ...consentRecord,
      };
    } catch (error) {
      logger.error(`[GDPR] Failed to record consent for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user consent history
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Consent history
   */
  async getConsentHistory(userId) {
    try {
      const consents = await this._fetchConsentHistory(userId);

      return {
        success: true,
        userId,
        consents,
        hasActiveConsent: consents.some((c) => c.consentGiven && !c.withdrawn),
      };
    } catch (error) {
      logger.error(`[GDPR] Failed to fetch consent history for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Data breach notification (Article 33 & 34)
   * @param {Object} breach - Breach details
   * @returns {Promise<Object>} - Notification confirmation
   */
  async notifyDataBreach(breach) {
    try {
      logger.error(`[GDPR] DATA BREACH DETECTED: ${breach.description}`);

      const breachRecord = {
        breachId: this._generateBreachId(),
        detectedAt: new Date().toISOString(),
        reportedAt: new Date().toISOString(),
        breachType: breach.type, // 'CONFIDENTIALITY', 'INTEGRITY', 'AVAILABILITY'
        severity: breach.severity, // 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
        description: breach.description,
        affectedUsers: breach.affectedUsers || [],
        affectedDataCategories: breach.affectedDataCategories || [],
        immediateActions: breach.immediateActions || [],
        status: 'REPORTED',
      };

      // Save breach record
      await this._saveBreachRecord(breachRecord);

      // Notify supervisory authority if required (within 72 hours for GDPR)
      if (breach.severity === 'HIGH' || breach.severity === 'CRITICAL') {
        await this._notifySupervisoryAuthority(breachRecord);
      }

      // Notify affected users if high risk to their rights and freedoms
      if (breach.severity === 'CRITICAL' && breachRecord.affectedUsers.length > 0) {
        await this._notifyAffectedUsers(breachRecord);
      }

      return {
        success: true,
        breachId: breachRecord.breachId,
        ...breachRecord,
      };
    } catch (error) {
      logger.error('[GDPR] Failed to process data breach notification:', error);
      throw error;
    }
  }

  /**
   * Run automated data retention cleanup
   * @returns {Promise<Object>} - Cleanup summary
   */
  async runDataRetentionCleanup() {
    try {
      logger.info('[GDPR] Starting automated data retention cleanup');

      const summary = {
        startedAt: new Date().toISOString(),
        deletedRecords: {
          orders: 0,
          logs: 0,
          analytics: 0,
          softDeletedUsers: 0,
        },
      };

      // Delete expired order data
      summary.deletedRecords.orders = await this._deleteExpiredOrders();

      // Delete old logs
      summary.deletedRecords.logs = await this._deleteOldLogs();

      // Delete old analytics data
      summary.deletedRecords.analytics = await this._deleteOldAnalytics();

      // Permanently delete soft-deleted users past grace period
      summary.deletedRecords.softDeletedUsers = await this._cleanupSoftDeletedUsers();

      summary.completedAt = new Date().toISOString();

      logger.info('[GDPR] Data retention cleanup completed', summary);

      return {
        success: true,
        ...summary,
      };
    } catch (error) {
      logger.error('[GDPR] Data retention cleanup failed:', error);
      throw error;
    }
  }

  // ================================================================
  // Private Helper Methods
  // ================================================================

  async _collectUserData(userId) {
    // Collect data from all relevant tables
    const data = {
      userProfile: await this._getUserProfile(userId),
      orders: await this._getUserOrders(userId),
      consents: await this._fetchConsentHistory(userId),
      agentActivities: await this._getUserAgentActivities(userId),
      metadata: {
        dataCollectedAt: new Date().toISOString(),
        dataController: 'BARQ Fleet Management',
        dataProcessingPurpose: 'Service delivery and optimization',
      },
    };

    return data;
  }

  async _softDeleteUser(userId, reason) {
    // Mark user for deletion with grace period
    const query = `
      UPDATE users
      SET
        status = 'PENDING_DELETION',
        deletion_requested_at = NOW(),
        deletion_reason = $2,
        updated_at = NOW()
      WHERE id = $1
    `;

    await postgres.query(query, [userId, reason]);
  }

  async _hardDeleteUserWithRetention(userId) {
    const deletedCategories = [];

    // Delete personal data but keep transactional records (anonymized)
    await postgres.transaction(async (client) => {
      // Anonymize user profile
      await client.query(
        `UPDATE users SET
          email = 'deleted_' || id || '@deleted.local',
          name = 'Deleted User',
          phone = NULL,
          address = NULL,
          status = 'DELETED',
          deleted_at = NOW()
        WHERE id = $1`,
        [userId]
      );
      deletedCategories.push('USER_PROFILE');

      // Anonymize order data (keep for analytics but remove PII)
      await client.query(
        `UPDATE orders SET
          customer_name = 'Deleted User',
          customer_phone = NULL,
          customer_email = NULL,
          delivery_address_details = NULL
        WHERE user_id = $1`,
        [userId]
      );
      deletedCategories.push('ORDER_PII');

      // Delete consent records
      await client.query('DELETE FROM user_consents WHERE user_id = $1', [userId]);
      deletedCategories.push('CONSENTS');

      // Delete activity logs (keep system logs)
      await client.query('DELETE FROM agent_activities WHERE user_id = $1', [userId]);
      deletedCategories.push('ACTIVITY_LOGS');
    });

    return deletedCategories;
  }

  async _completelyDeleteUser(userId) {
    const deletedCategories = [];

    await postgres.transaction(async (client) => {
      // Complete deletion - use with extreme caution
      await client.query('DELETE FROM agent_activities WHERE user_id = $1', [userId]);
      deletedCategories.push('AGENT_ACTIVITIES');

      await client.query('DELETE FROM orders WHERE user_id = $1', [userId]);
      deletedCategories.push('ORDERS');

      await client.query('DELETE FROM user_consents WHERE user_id = $1', [userId]);
      deletedCategories.push('CONSENTS');

      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      deletedCategories.push('USER_ACCOUNT');
    });

    return deletedCategories;
  }

  async _logGDPRActivity(activity) {
    const query = `
      INSERT INTO gdpr_activity_log (
        user_id, action, status, details, created_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `;

    await postgres.query(query, [
      activity.userId,
      activity.action,
      activity.status,
      JSON.stringify(activity),
    ]);
  }

  async _sendDeletionConfirmation(userId, summary) {
    // TODO: Implement email notification
    logger.info(`[GDPR] Deletion confirmation should be sent to user ${userId}`, summary);
  }

  async _getUserProfile(userId) {
    const result = await postgres.query('SELECT * FROM users WHERE id = $1', [userId]);
    return result.rows[0] || null;
  }

  async _getUserOrders(userId) {
    const result = await postgres.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  async _getUserAgentActivities(userId) {
    const result = await postgres.query(
      'SELECT * FROM agent_activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [userId]
    );
    return result.rows;
  }

  async _checkPendingObligations(userId) {
    // Check for active orders, pending payments, etc.
    const activeOrders = await postgres.query(
      "SELECT COUNT(*) as count FROM orders WHERE user_id = $1 AND status NOT IN ('DELIVERED', 'CANCELLED')",
      [userId]
    );

    return {
      hasPending: parseInt(activeOrders.rows[0].count) > 0,
      pendingCount: parseInt(activeOrders.rows[0].count),
    };
  }

  async _getDeletedUser(userId) {
    const result = await postgres.query(
      `SELECT * FROM users WHERE id = $1 AND status = 'PENDING_DELETION'`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async _restoreUser(userId) {
    await postgres.query(
      `UPDATE users SET
        status = 'ACTIVE',
        deletion_requested_at = NULL,
        deletion_reason = NULL,
        updated_at = NOW()
      WHERE id = $1`,
      [userId]
    );
  }

  async _saveConsentRecord(consent) {
    const query = `
      INSERT INTO user_consents (
        user_id, consent_type, consent_given, consent_version,
        ip_address, user_agent, method, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `;

    await postgres.query(query, [
      consent.userId,
      consent.consentType,
      consent.consentGiven,
      consent.consentVersion,
      consent.ipAddress,
      consent.userAgent,
      consent.method,
    ]);
  }

  async _fetchConsentHistory(userId) {
    const result = await postgres.query(
      'SELECT * FROM user_consents WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  async _saveBreachRecord(breach) {
    const query = `
      INSERT INTO data_breach_log (
        breach_id, breach_type, severity, description,
        affected_user_count, affected_data_categories,
        detected_at, reported_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await postgres.query(query, [
      breach.breachId,
      breach.breachType,
      breach.severity,
      breach.description,
      breach.affectedUsers.length,
      JSON.stringify(breach.affectedDataCategories),
      breach.detectedAt,
      breach.reportedAt,
      breach.status,
    ]);
  }

  async _notifySupervisoryAuthority(breach) {
    // TODO: Implement actual notification to supervisory authority
    logger.error(
      `[GDPR] CRITICAL: Supervisory authority should be notified of breach ${breach.breachId}`
    );
  }

  async _notifyAffectedUsers(breach) {
    // TODO: Implement user notification
    logger.error(
      `[GDPR] CRITICAL: ${breach.affectedUsers.length} users should be notified of breach ${breach.breachId}`
    );
  }

  async _deleteExpiredOrders() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionPeriods.orderData);

    const result = await postgres.query(
      `DELETE FROM orders WHERE created_at < $1 AND status IN ('DELIVERED', 'CANCELLED')`,
      [cutoffDate]
    );

    return result.rowCount;
  }

  async _deleteOldLogs() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionPeriods.logs);

    const result = await postgres.query(`DELETE FROM agent_activities WHERE created_at < $1`, [
      cutoffDate,
    ]);

    return result.rowCount;
  }

  async _deleteOldAnalytics() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionPeriods.analyticsData);

    const result = await postgres.query(`DELETE FROM system_metrics WHERE date < $1`, [cutoffDate]);

    return result.rowCount;
  }

  async _cleanupSoftDeletedUsers() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionPeriods.deletedUserData);

    // Permanently delete users past grace period
    const deletedUsers = await postgres.query(
      `SELECT id FROM users WHERE status = 'PENDING_DELETION' AND deletion_requested_at < $1`,
      [cutoffDate]
    );

    let count = 0;
    for (const user of deletedUsers.rows) {
      await this._hardDeleteUserWithRetention(user.id);
      count++;
    }

    return count;
  }

  _formatAsCSV(data) {
    // Simple CSV formatting - can be enhanced
    return JSON.stringify(data); // Placeholder
  }

  _generateBreachId() {
    return `BREACH-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
  }
}

// Export singleton instance
module.exports = new GDPRService();
