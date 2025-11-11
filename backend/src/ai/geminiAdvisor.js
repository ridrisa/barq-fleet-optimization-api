'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const Ajv = require('ajv');

const ajv = new Ajv({ allErrors: true, removeAdditional: 'failing' });

// JSON schema for route optimization parameter adjustments
const ADJUSTMENTS_SCHEMA = {
  type: 'object',
  required: ['adjustments', 'comments'],
  additionalProperties: false,
  properties: {
    adjustments: {
      type: 'object',
      additionalProperties: false,
      properties: {
        maxClusterRadiusKm: { type: 'number', minimum: 0.5, maximum: 20 },
        priorityCost: { type: 'boolean' },
        priorityTime: { type: 'boolean' },
        costPerKm: { type: 'number', minimum: 0, maximum: 20 },
        maxDistanceKm: { type: 'number', minimum: 10, maximum: 1000 },
        maxDurationMin: { type: 'number', minimum: 30, maximum: 1440 }
      }
    },
    comments: { type: 'string', minLength: 1 }
  }
};

const validateAdjustments = ajv.compile(ADJUSTMENTS_SCHEMA);

/**
 * Google Gemini Advisor for intelligent route optimization parameter tuning
 * Fast, cost-effective alternative to GPT-4
 * Uses strict JSON schema validation for reliable outputs
 */
class GeminiAdvisor {
  constructor(model = process.env.AI_GEMINI_MODEL || 'gemini-2.0-flash-exp') {
    if (!process.env.GOOGLE_AI_API_KEY) {
      console.warn('[GeminiAdvisor] GOOGLE_AI_API_KEY not set, advisor will return defaults');
      this.enabled = false;
    } else {
      this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
      this.model = this.genAI.getGenerativeModel({
        model,
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 800,
        }
      });
      this.modelName = model;
      this.enabled = true;
    }
  }

  /**
   * Analyze plan and suggest optimization parameter adjustments
   */
  async suggestAdjustments(plan) {
    if (!this.enabled) {
      return this._getDefaultAdjustments('AI advisor disabled (no API key)');
    }

    try {
      const summary = this._summarize(plan);

      const prompt = `You are an operations optimization expert analyzing route plans.
Given the plan summary below, suggest parameter adjustments to improve efficiency.

Return ONLY valid JSON matching this exact structure (no markdown, no explanations):
{
  "adjustments": {
    "maxClusterRadiusKm": <number between 0.5-20>,
    "priorityCost": <boolean>,
    "priorityTime": <boolean>,
    "costPerKm": <number between 0-20>,
    "maxDistanceKm": <number between 10-1000>,
    "maxDurationMin": <number between 30-1440>
  },
  "comments": "<brief reasoning for adjustments>"
}

Guidelines:
• Reduce cluster radius in dense areas (high stops/route) to avoid detours
• Increase radius in sparse areas (low stops/route) to improve efficiency
• Balance priorityTime vs priorityCost based on stop density
• Keep costPerKm realistic (0.2–2.0 typical for logistics)
• If average stops per route > 18, reduce radius; if < 8, increase
• Respect maxDistanceKm and maxDurationMin caps

Plan Summary:
${summary}

Return only the JSON object:`;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      let parsed;
      try {
        // Try to extract JSON if wrapped in markdown code blocks
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[1] || jsonMatch[0] : text);
      } catch {
        parsed = { adjustments: {}, comments: 'Parse fallback' };
      }

      // Validate with AJV schema
      if (!validateAdjustments(parsed)) {
        const errs = ajv.errorsText(validateAdjustments.errors);
        console.warn(`[GeminiAdvisor] Schema validation failed: ${errs}`);
        return this._getDefaultAdjustments(`Schema validation fallback: ${errs}`);
      }

      return parsed;
    } catch (error) {
      console.error('[GeminiAdvisor] Error:', error.message);
      return this._getDefaultAdjustments(`Error fallback: ${error.message}`);
    }
  }

  /**
   * Quick tactical suggestions for immediate optimization
   */
  async quickSuggestions(metrics) {
    if (!this.enabled) {
      return 'AI advisor disabled';
    }

    try {
      const prompt = `Analyze these logistics metrics and provide 2-3 quick tactical suggestions:
${JSON.stringify(metrics)}

Focus on immediate, actionable improvements. Be concise (max 3 sentences).`;

      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('[GeminiAdvisor] Quick suggestions error:', error.message);
      return `Suggestions unavailable: ${error.message}`;
    }
  }

  /**
   * Compare multiple optimization strategies
   */
  async compareStrategies(strategies) {
    if (!this.enabled) {
      return { best: null, reasoning: 'AI advisor disabled' };
    }

    try {
      const prompt = `You are a logistics optimization expert. Compare these optimization strategies and recommend the best one:

${JSON.stringify(strategies, null, 2)}

Return ONLY valid JSON:
{
  "best": "<strategy name>",
  "reasoning": "<brief explanation>",
  "tradeoffs": "<key tradeoffs to consider>"
}`;

      const result = await this.model.generateContent(prompt);
      const text = result.response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { best: null, reasoning: 'Parse error' };
    } catch (error) {
      console.error('[GeminiAdvisor] Compare strategies error:', error.message);
      return { best: null, reasoning: error.message };
    }
  }

  _summarize(plan) {
    const routes = plan?.routes || [];
    const rCount = routes.length;
    const stops = routes.reduce((a, r) => a + (r.stops?.length || 0), 0);
    const avgStops = rCount ? (stops / rCount).toFixed(1) : 0;
    const rules = plan?.businessRules || {};

    return `routes=${rCount}, avgStops=${avgStops}, totalStops=${stops}, rules=${JSON.stringify(rules)}`;
  }

  _getDefaultAdjustments(reason) {
    return {
      adjustments: {
        maxClusterRadiusKm: 3,
        priorityCost: true,
        priorityTime: false,
        costPerKm: 0.5,
        maxDistanceKm: 200,
        maxDurationMin: 600
      },
      comments: reason
    };
  }

  /**
   * Get model information
   */
  getModelInfo() {
    return {
      model: this.modelName,
      enabled: this.enabled,
      provider: 'Google Gemini'
    };
  }
}

module.exports = { GeminiAdvisor, ADJUSTMENTS_SCHEMA };
