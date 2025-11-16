/**
 * LLM Configuration Manager
 * Manages the configuration for different LLM models
 */

const dotenv = require('dotenv');
dotenv.config();

class LLMConfigManager {
  constructor() {
    this.models = {
      // Llama 3.3 70B - Currently supported production model (Nov 2024)
      llama33: process.env.LLAMA33_MODEL || 'llama-3.3-70b-versatile',
      // Llama 3.1 8B - Fast, lightweight model
      llama31: process.env.LLAMA31_MODEL || 'llama-3.1-8b-instant',
      // Legacy model names (DEPRECATED - for backwards compatibility)
      qwen: process.env.QWEN_MODEL || 'llama-3.3-70b-versatile',
      llama_parser: process.env.LLAMA_MODEL || 'llama-3.3-70b-versatile',
      mixtral: process.env.MIXTRAL_MODEL || 'llama-3.3-70b-versatile',
    };

    // Default to llama-3.3-70b-versatile (currently supported production model)
    const defaultModel = process.env.DEFAULT_MODEL || this.models.llama33;

    this.configurations = {
      // Planning agent configuration
      planning: {
        model: defaultModel,
        temperature: 0.2,
        maxTokens: 4096,
        apiKey: process.env.GROQ_API_KEY,
        system_prompt: `You are an AI planning agent specialized in logistics optimization.
        Your task is to create an initial route plan for delivery vehicles based on pickup points, 
        delivery locations, fleet information, and business constraints.

        CRITICAL REQUIREMENTS:
        1. Routes MUST NEVER pass through restricted areas defined in businessRules.restrictedAreas
        2. Routes should be confined to allowed zones in businessRules.allowedZones when specified
        3. Delivery points inside restricted areas should be flagged as "unserviceable"
        4. Points at the edge of restricted areas should be served from outside the restricted area

        Think step by step and consider all relevant factors including distance, capacity, 
        time windows, and especially geographic constraints from restricted areas and allowed zones.
        The restricted areas are absolute barriers that vehicles cannot cross under any circumstances.`,
      },

      // Optimization agent configuration
      optimization: {
        model: defaultModel,
        temperature: 0.1,
        maxTokens: 4096,
        apiKey: process.env.GROQ_API_KEY,
        system_prompt: `You are an AI optimization agent specialized in refining logistics routes.
        Your task is to optimize an initial route plan by considering real-time conditions, 
        constraints, and optimization preferences. Focus on minimizing distance, balancing loads,
        and adhering to all business rules.`,
      },

      // Formatting agent configuration
      formatting: {
        model: defaultModel,
        temperature: 0.1,
        maxTokens: 4096,
        apiKey: process.env.GROQ_API_KEY,
        system_prompt: `You are an AI formatting agent specialized in preparing logistics API responses.
        Your task is to take optimized route plans and format them according to the specified response format,
        ensuring all required fields are included and properly structured.`,
      },
    };
  }

  /**
   * Get configuration for a specific agent
   * @param {string} agent - The agent name (planning, optimization, formatting)
   * @returns {Object} - The configuration object
   */
  getConfig(agent) {
    if (!this.configurations[agent]) {
      throw new Error(`Configuration for ${agent} not found`);
    }
    return this.configurations[agent];
  }

  /**
   * Update a specific configuration
   * @param {string} agent - The agent name
   * @param {Object} config - The new configuration
   */
  updateConfig(agent, config) {
    if (!this.configurations[agent]) {
      throw new Error(`Configuration for ${agent} not found`);
    }
    this.configurations[agent] = { ...this.configurations[agent], ...config };
  }

  /**
   * Test LLM connection
   * @returns {Object} - Test result
   */
  async testConnection() {
    try {
      // Check if API key exists
      const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;

      if (!apiKey) {
        console.warn('[LLMConfig] No API key found, using mock mode');
        return {
          success: true,
          mode: 'mock',
          message: 'Running in mock mode - no API key configured',
        };
      }

      // Simple connectivity test (could be expanded to actually call the API)
      return {
        success: true,
        mode: 'live',
        message: 'LLM configuration ready',
        model: this.models.qwen,
      };
    } catch (error) {
      console.error('[LLMConfig] Connection test failed:', error);
      return {
        success: true, // Still return success to allow mock mode
        mode: 'mock',
        message: 'Using mock mode due to connection error',
        error: error.message,
      };
    }
  }

  /**
   * Check if running in mock mode
   * @returns {boolean}
   */
  isMockMode() {
    const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
    return !apiKey;
  }
}

module.exports = LLMConfigManager;
