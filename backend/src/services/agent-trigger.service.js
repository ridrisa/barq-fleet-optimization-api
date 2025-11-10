/**
 * Agent Trigger Service
 *
 * Allows AI agents to trigger autonomous operation cycles when they detect
 * critical conditions that require immediate coordinated response.
 *
 * Features:
 * - Cooldown period to prevent spam/infinite loops
 * - Per-agent tracking of trigger events
 * - Priority-based triggering
 * - Logging and monitoring
 */

const { logger } = require('../utils/logger');

class AgentTriggerService {
  constructor() {
    this.autonomousInitializer = null;

    // Trigger tracking
    this.triggerHistory = []; // Recent triggers
    this.maxHistory = 100;

    // Per-agent tracking
    this.agentTriggers = new Map(); // Map<agentName, Array<timestamp>>

    // Cooldown settings (prevent spam)
    this.globalCooldownMs = 60000; // 1 minute global cooldown
    this.perAgentCooldownMs = 300000; // 5 minutes per-agent cooldown
    this.lastGlobalTrigger = 0;

    // Statistics
    this.stats = {
      totalTriggers: 0,
      triggersBlocked: 0,
      triggersByAgent: new Map(),
      triggersByReason: new Map(),
    };

    logger.info('[AgentTrigger] Service initialized');
  }

  /**
   * Initialize with autonomous initializer reference
   */
  initialize(autonomousInitializer) {
    this.autonomousInitializer = autonomousInitializer;
    logger.info('[AgentTrigger] Linked to autonomous initializer');
  }

  /**
   * Trigger autonomous operation cycle from an agent
   *
   * @param {string} agentName - Name of the agent requesting trigger
   * @param {string} reason - Reason for trigger (e.g., 'SLA_CRITICAL', 'FLEET_SHORTAGE')
   * @param {object} context - Additional context about the trigger
   * @param {string} priority - Priority level: 'low', 'medium', 'high', 'critical'
   * @returns {object} Result of trigger attempt
   */
  async triggerFromAgent(agentName, reason, context = {}, priority = 'medium') {
    const now = Date.now();

    logger.info(`[AgentTrigger] Trigger requested by ${agentName}`, {
      reason,
      priority,
      context,
    });

    // Check if autonomous operations are initialized
    if (!this.autonomousInitializer) {
      logger.warn('[AgentTrigger] Autonomous initializer not set');
      return {
        triggered: false,
        reason: 'NOT_INITIALIZED',
        message: 'Autonomous operations not initialized',
      };
    }

    // Apply cooldown checks (unless critical priority)
    if (priority !== 'critical') {
      const cooldownCheck = this.checkCooldown(agentName, now);

      if (!cooldownCheck.allowed) {
        logger.warn('[AgentTrigger] Trigger blocked by cooldown', {
          agentName,
          reason: cooldownCheck.reason,
          retryAfterMs: cooldownCheck.retryAfterMs,
        });

        this.stats.triggersBlocked++;

        return {
          triggered: false,
          reason: 'COOLDOWN',
          message: cooldownCheck.message,
          retryAfterMs: cooldownCheck.retryAfterMs,
        };
      }
    } else {
      logger.warn('[AgentTrigger] Critical priority - bypassing cooldown', {
        agentName,
        reason,
      });
    }

    // Record trigger attempt
    const triggerRecord = {
      timestamp: now,
      agentName,
      reason,
      priority,
      context,
    };

    this.recordTrigger(triggerRecord);

    // Trigger the autonomous cycle
    try {
      const result = await this.autonomousInitializer.triggerCycle();

      if (result.triggered) {
        logger.info('[AgentTrigger] Autonomous cycle triggered successfully', {
          agentName,
          reason,
          mode: result.mode,
        });

        // Update statistics
        this.stats.totalTriggers++;
        this.incrementStat(this.stats.triggersByAgent, agentName);
        this.incrementStat(this.stats.triggersByReason, reason);

        // Update last trigger time
        this.lastGlobalTrigger = now;

        return {
          triggered: true,
          mode: result.mode,
          agentName,
          reason,
          timestamp: now,
        };
      } else {
        logger.error('[AgentTrigger] Failed to trigger cycle', {
          error: result.error,
        });

        return {
          triggered: false,
          reason: 'TRIGGER_FAILED',
          message: result.error || 'Unknown error',
        };
      }
    } catch (error) {
      logger.error('[AgentTrigger] Exception during trigger', {
        error: error.message,
        agentName,
      });

      return {
        triggered: false,
        reason: 'EXCEPTION',
        message: error.message,
      };
    }
  }

  /**
   * Check if trigger is allowed based on cooldown periods
   */
  checkCooldown(agentName, now) {
    // Check global cooldown
    const timeSinceLastGlobal = now - this.lastGlobalTrigger;

    if (timeSinceLastGlobal < this.globalCooldownMs) {
      return {
        allowed: false,
        reason: 'GLOBAL_COOLDOWN',
        message: `Global cooldown active. Last trigger was ${Math.round(timeSinceLastGlobal / 1000)}s ago`,
        retryAfterMs: this.globalCooldownMs - timeSinceLastGlobal,
      };
    }

    // Check per-agent cooldown
    const agentHistory = this.agentTriggers.get(agentName) || [];

    if (agentHistory.length > 0) {
      const lastAgentTrigger = agentHistory[agentHistory.length - 1];
      const timeSinceLastAgent = now - lastAgentTrigger;

      if (timeSinceLastAgent < this.perAgentCooldownMs) {
        return {
          allowed: false,
          reason: 'AGENT_COOLDOWN',
          message: `Agent ${agentName} cooldown active. Last trigger was ${Math.round(timeSinceLastAgent / 1000)}s ago`,
          retryAfterMs: this.perAgentCooldownMs - timeSinceLastAgent,
        };
      }
    }

    return {
      allowed: true,
    };
  }

  /**
   * Record a trigger event
   */
  recordTrigger(triggerRecord) {
    // Add to global history
    this.triggerHistory.push(triggerRecord);

    if (this.triggerHistory.length > this.maxHistory) {
      this.triggerHistory.shift();
    }

    // Add to per-agent history
    if (!this.agentTriggers.has(triggerRecord.agentName)) {
      this.agentTriggers.set(triggerRecord.agentName, []);
    }

    const agentHistory = this.agentTriggers.get(triggerRecord.agentName);
    agentHistory.push(triggerRecord.timestamp);

    // Keep only last 10 triggers per agent
    if (agentHistory.length > 10) {
      agentHistory.shift();
    }
  }

  /**
   * Increment a statistic counter
   */
  incrementStat(statMap, key) {
    const current = statMap.get(key) || 0;
    statMap.set(key, current + 1);
  }

  /**
   * Get trigger statistics
   */
  getStats() {
    return {
      totalTriggers: this.stats.totalTriggers,
      triggersBlocked: this.stats.triggersBlocked,
      successRate:
        this.stats.totalTriggers > 0
          ? this.stats.totalTriggers / (this.stats.totalTriggers + this.stats.triggersBlocked)
          : 0,
      triggersByAgent: Object.fromEntries(this.stats.triggersByAgent),
      triggersByReason: Object.fromEntries(this.stats.triggersByReason),
      recentTriggers: this.triggerHistory.slice(-10),
      lastGlobalTrigger: this.lastGlobalTrigger,
      cooldownStatus: {
        globalCooldownMs: this.globalCooldownMs,
        perAgentCooldownMs: this.perAgentCooldownMs,
        globalCooldownActive: Date.now() - this.lastGlobalTrigger < this.globalCooldownMs,
        timeUntilGlobalReady: Math.max(
          0,
          this.globalCooldownMs - (Date.now() - this.lastGlobalTrigger)
        ),
      },
    };
  }

  /**
   * Get recent trigger history
   */
  getRecentTriggers(limit = 20) {
    return this.triggerHistory.slice(-limit);
  }

  /**
   * Get triggers by agent
   */
  getAgentTriggers(agentName) {
    const history = this.agentTriggers.get(agentName) || [];
    const count = this.stats.triggersByAgent.get(agentName) || 0;

    return {
      agentName,
      totalTriggers: count,
      recentTriggers: history.map((timestamp) => ({
        timestamp,
        timeAgo: Date.now() - timestamp,
      })),
      canTrigger: this.checkCooldown(agentName, Date.now()).allowed,
    };
  }

  /**
   * Reset cooldowns (for testing/emergency)
   */
  resetCooldowns() {
    logger.warn('[AgentTrigger] Cooldowns reset manually');
    this.lastGlobalTrigger = 0;
    this.agentTriggers.clear();
  }

  /**
   * Update cooldown settings
   */
  updateCooldowns(globalMs, perAgentMs) {
    logger.info('[AgentTrigger] Cooldown settings updated', {
      oldGlobal: this.globalCooldownMs,
      newGlobal: globalMs,
      oldPerAgent: this.perAgentCooldownMs,
      newPerAgent: perAgentMs,
    });

    this.globalCooldownMs = globalMs;
    this.perAgentCooldownMs = perAgentMs;
  }
}

// Singleton instance
const agentTriggerService = new AgentTriggerService();

module.exports = agentTriggerService;
