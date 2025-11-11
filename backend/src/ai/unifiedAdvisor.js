'use strict';

const { GPTAdvisor } = require('./gptAdvisor');
const { GeminiAdvisor } = require('./geminiAdvisor');
const { ClaudeAnalyst } = require('./claudeAnalyst');

/**
 * Unified AI Advisor that intelligently selects the best model
 * based on availability, cost, and task requirements
 */
class UnifiedAdvisor {
  constructor(options = {}) {
    this.preferredAdvisor = options.preferred || process.env.AI_PREFERRED_ADVISOR || 'gemini';
    this.preferredAnalyst = options.preferredAnalyst || process.env.AI_PREFERRED_ANALYST || 'claude';

    // Initialize all advisors
    this.advisors = {
      gpt: process.env.OPENAI_API_KEY ? new GPTAdvisor() : null,
      gemini: process.env.GOOGLE_AI_API_KEY ? new GeminiAdvisor() : null
    };

    this.analysts = {
      claude: process.env.ANTHROPIC_API_KEY ? new ClaudeAnalyst() : null
    };

    // Determine available advisors
    this.availableAdvisors = Object.keys(this.advisors).filter(k => this.advisors[k]?.enabled);
    this.availableAnalysts = Object.keys(this.analysts).filter(k => this.analysts[k]?.enabled);

    console.log(`[UnifiedAdvisor] Available advisors: ${this.availableAdvisors.join(', ') || 'none'}`);
    console.log(`[UnifiedAdvisor] Available analysts: ${this.availableAnalysts.join(', ') || 'none'}`);
  }

  /**
   * Get the best available advisor based on preference and availability
   */
  _getBestAdvisor() {
    // Try preferred first
    if (this.advisors[this.preferredAdvisor]?.enabled) {
      return { advisor: this.advisors[this.preferredAdvisor], name: this.preferredAdvisor };
    }

    // Fallback priority: gemini (fast/cheap) -> gpt (accurate/expensive)
    const priority = ['gemini', 'gpt'];
    for (const name of priority) {
      if (this.advisors[name]?.enabled) {
        return { advisor: this.advisors[name], name };
      }
    }

    return { advisor: null, name: null };
  }

  /**
   * Get the best available analyst
   */
  _getBestAnalyst() {
    // Try preferred first
    if (this.analysts[this.preferredAnalyst]?.enabled) {
      return { analyst: this.analysts[this.preferredAnalyst], name: this.preferredAnalyst };
    }

    // Currently only Claude for analysis
    if (this.analysts.claude?.enabled) {
      return { analyst: this.analysts.claude, name: 'claude' };
    }

    return { analyst: null, name: null };
  }

  /**
   * Suggest parameter adjustments using best available advisor
   */
  async suggestAdjustments(plan, preferredModel = null) {
    const { advisor, name } = preferredModel && this.advisors[preferredModel]?.enabled
      ? { advisor: this.advisors[preferredModel], name: preferredModel }
      : this._getBestAdvisor();

    if (!advisor) {
      console.warn('[UnifiedAdvisor] No AI advisor available');
      return {
        adjustments: {
          maxClusterRadiusKm: 3,
          priorityCost: true,
          priorityTime: false,
          costPerKm: 0.5,
          maxDistanceKm: 200,
          maxDurationMin: 600
        },
        comments: 'No AI advisor available - using defaults',
        model: 'fallback'
      };
    }

    console.log(`[UnifiedAdvisor] Using ${name} for parameter tuning`);
    const result = await advisor.suggestAdjustments(plan);
    return { ...result, model: name };
  }

  /**
   * Get performance analysis using best available analyst
   */
  async analyzePerformance(finalPlan, preferredModel = null) {
    const { analyst, name } = preferredModel && this.analysts[preferredModel]?.enabled
      ? { analyst: this.analysts[preferredModel], name: preferredModel }
      : this._getBestAnalyst();

    if (!analyst) {
      console.warn('[UnifiedAdvisor] No AI analyst available');
      return {
        comments: 'No AI analyst available. Review metrics manually.',
        model: 'fallback'
      };
    }

    console.log(`[UnifiedAdvisor] Using ${name} for performance analysis`);
    const result = await analyst.summarizePerformance(finalPlan);
    return { ...result, model: name };
  }

  /**
   * Quick suggestions (uses fastest advisor)
   */
  async quickSuggestions(metrics) {
    // Gemini is fastest and cheapest for quick tasks
    if (this.advisors.gemini?.enabled) {
      return this.advisors.gemini.quickSuggestions(metrics);
    }

    // Fallback to any available
    const { advisor, name } = this._getBestAdvisor();
    if (!advisor || !advisor.quickSuggestions) {
      return 'Quick suggestions unavailable';
    }

    console.log(`[UnifiedAdvisor] Using ${name} for quick suggestions`);
    return advisor.quickSuggestions(metrics);
  }

  /**
   * Compare optimization strategies (uses most capable advisor)
   */
  async compareStrategies(strategies) {
    // GPT-4 is best for complex comparisons, but Gemini is good fallback
    const priority = ['gpt', 'gemini'];

    for (const name of priority) {
      const advisor = this.advisors[name];
      if (advisor?.enabled && advisor.compareStrategies) {
        console.log(`[UnifiedAdvisor] Using ${name} for strategy comparison`);
        return advisor.compareStrategies(strategies);
      }
    }

    return { best: null, reasoning: 'No AI advisor available for comparison' };
  }

  /**
   * Get status of all AI services
   */
  getStatus() {
    return {
      advisors: {
        available: this.availableAdvisors,
        preferred: this.preferredAdvisor,
        gpt: this.advisors.gpt ? { enabled: this.advisors.gpt.enabled, model: this.advisors.gpt.model } : null,
        gemini: this.advisors.gemini ? { enabled: this.advisors.gemini.enabled, model: this.advisors.gemini.modelName } : null
      },
      analysts: {
        available: this.availableAnalysts,
        preferred: this.preferredAnalyst,
        claude: this.analysts.claude ? { enabled: this.analysts.claude.enabled, model: this.analysts.claude.model } : null
      }
    };
  }

  /**
   * Cost estimate for a full optimization cycle
   */
  getCostEstimate(operationsPerDay = 1000) {
    const costs = {
      gpt: {
        perOperation: 0.025,    // ~$0.025 per optimization
        daily: 0.025 * operationsPerDay,
        model: 'GPT-4'
      },
      gemini: {
        perOperation: 0.001,    // ~$0.001 per optimization (25x cheaper!)
        daily: 0.001 * operationsPerDay,
        model: 'Gemini 2.0 Flash'
      },
      claude: {
        perOperation: 0.035,    // ~$0.035 per analysis
        daily: 0.035 * operationsPerDay,
        model: 'Claude Opus'
      }
    };

    const recommended = {
      advisor: 'gemini',  // Best cost/performance for most use cases
      analyst: 'claude',  // Best quality for executive insights
      estimatedCostPerDay: costs.gemini.daily + costs.claude.daily
    };

    return { costs, recommended };
  }
}

// Singleton instance
let instance = null;

function getUnifiedAdvisor(options) {
  if (!instance || options) {
    instance = new UnifiedAdvisor(options);
  }
  return instance;
}

module.exports = { UnifiedAdvisor, getUnifiedAdvisor };
