'use strict';

const Anthropic = require('@anthropic-ai/sdk');

/**
 * Claude Opus Analyst for executive-level performance analysis
 * Generates dashboard-ready insights and recommendations
 */
class ClaudeAnalyst {
  constructor(model = process.env.AI_ANALYST_MODEL || 'claude-opus-4-20250514') {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('[ClaudeAnalyst] ANTHROPIC_API_KEY not set, analyst will return placeholder analysis');
      this.enabled = false;
    } else {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      this.model = model;
      this.enabled = true;
    }
  }

  /**
   * Generate comprehensive performance analysis from optimization results
   */
  async summarizePerformance(finalPlan) {
    if (!this.enabled) {
      return {
        comments: 'AI analyst disabled (no API key). Analysis unavailable.',
        model: this.model
      };
    }

    try {
      const planJson = JSON.stringify(finalPlan, null, 2).slice(0, 120000); // Limit context size

      const prompt = `You are a senior logistics analyst. Review the route optimization plan JSON below and produce:

1. Executive Summary (2–4 bullets highlighting key achievements and concerns)
2. Route KPIs table (Distance km, Duration min, Unserviceable count, Efficiency score)
3. Actionable Recommendations (bulleted, prioritized by impact)
4. Risk & SLA Watchouts (bulleted, flag critical issues)

Keep it concise and directly usable in a management dashboard.
Focus on business value, not technical details.

PLAN:
${planJson}`;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1200,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const text = response?.content?.[0]?.text || 'No analysis produced.';

      return {
        comments: text,
        model: this.model,
        usage: response.usage
      };
    } catch (error) {
      console.error('[ClaudeAnalyst] Error:', error.message);
      return {
        comments: `Analysis failed: ${error.message}. Review plan metrics manually.`,
        model: this.model,
        error: error.message
      };
    }
  }

  /**
   * Quick summary for real-time monitoring
   */
  async quickSummary(metrics) {
    if (!this.enabled) {
      return 'AI analyst disabled';
    }

    try {
      const prompt = `Summarize these logistics metrics in 1-2 sentences:
${JSON.stringify(metrics)}`;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 200,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }]
      });

      return response?.content?.[0]?.text || 'No summary available';
    } catch (error) {
      console.error('[ClaudeAnalyst] Quick summary error:', error.message);
      return `Summary unavailable: ${error.message}`;
    }
  }
}

module.exports = { ClaudeAnalyst };
