'use strict';

const OpenAI = require('openai');
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
 * GPT-4 Advisor for intelligent route optimization parameter tuning
 * Uses strict JSON schema validation to ensure reliable AI outputs
 */
class GPTAdvisor {
  constructor(model = process.env.AI_ADVISOR_MODEL || 'gpt-4-1106-preview') {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('[GPTAdvisor] OPENAI_API_KEY not set, advisor will return defaults');
      this.enabled = false;
    } else {
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      this.model = model;
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

      const prompt = `
You are an operations optimization expert analyzing route plans.
Given the plan summary, suggest parameter adjustments to improve efficiency.

Guidelines:
• Reduce cluster radius in dense areas to avoid detours
• Balance priorityTime vs priorityCost based on stop density and average leg lengths
• Keep costPerKm realistic (0.2–2.0 typical for logistics)
• If average stops per route > 18, reduce radius; if < 8, increase slightly
• Respect maxDistanceKm and maxDurationMin caps

Plan Summary:
${summary}

Return ONLY valid JSON matching this structure:
{
  "adjustments": {
    "maxClusterRadiusKm": <number 0.5-20>,
    "priorityCost": <boolean>,
    "priorityTime": <boolean>,
    "costPerKm": <number 0-20>,
    "maxDistanceKm": <number 10-1000>,
    "maxDurationMin": <number 30-1440>
  },
  "comments": "<reasoning for adjustments>"
}
`.trim();

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a logistics optimization expert. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 800
      });

      const text = response.choices[0]?.message?.content || '{}';
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
        console.warn(`[GPTAdvisor] Schema validation failed: ${errs}`);
        return this._getDefaultAdjustments(`Schema validation fallback: ${errs}`);
      }

      return parsed;
    } catch (error) {
      console.error('[GPTAdvisor] Error:', error.message);
      return this._getDefaultAdjustments(`Error fallback: ${error.message}`);
    }
  }

  _summarize(plan) {
    const routes = plan?.routes || [];
    const rCount = routes.length;
    const stops = routes.reduce((a, r) => a + (r.stops?.length || 0), 0);
    const avgStops = rCount ? (stops / rCount).toFixed(1) : 0;
    const rules = plan?.businessRules || {};

    return `routes=${rCount}, avgStops=${avgStops}, rules=${JSON.stringify(rules)}`;
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
}

module.exports = { GPTAdvisor, ADJUSTMENTS_SCHEMA };
