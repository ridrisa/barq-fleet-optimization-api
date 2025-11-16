/**
 * LLM Fleet Advisor Service
 *
 * Provides AI-powered intelligent recommendations for:
 * - Driver assignment optimization
 * - SLA violation predictions
 * - Natural language fleet queries
 * - Smart order prioritization
 * - Real-time decision support
 */

const { getUnifiedAdvisor } = require('../ai/unifiedAdvisor');
const { logger } = require('../utils/logger');
const Groq = require('groq-sdk');

class LLMFleetAdvisor {
  constructor() {
    this.unifiedAdvisor = getUnifiedAdvisor();

    // Initialize Groq for fast inference
    this.groq = process.env.GROQ_API_KEY
      ? new Groq({ apiKey: process.env.GROQ_API_KEY })
      : null;

    this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    logger.info('LLM Fleet Advisor initialized', {
      hasGroq: !!this.groq,
      hasUnifiedAdvisor: !!this.unifiedAdvisor,
      model: this.model,
    });
  }

  /**
   * Analyze driver assignment and suggest optimal driver
   *
   * @param {Object} order - Order details
   * @param {Array} availableDrivers - List of available drivers
   * @param {Object} targetStatus - Current target achievement status
   * @returns {Promise<Object>} - AI recommendation
   */
  async suggestDriverAssignment(order, availableDrivers, targetStatus) {
    try {
      if (!this.groq) {
        return this._getFallbackDriverSuggestion(order, availableDrivers, targetStatus);
      }

      const prompt = this._buildDriverAssignmentPrompt(order, availableDrivers, targetStatus);

      const completion = await this.groq.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are an AI fleet management expert specializing in optimal driver assignment for last-mile delivery.

Your goal is to:
1. Ensure ALL drivers meet their daily targets
2. Guarantee all orders are delivered within 1-4 hour SLA
3. Distribute workload fairly across the fleet
4. Minimize total distance and maximize efficiency

Consider:
- Order urgency (remaining time until SLA deadline)
- Driver progress toward targets (deliveries + revenue)
- Driver proximity to pickup/delivery locations
- Current workload balance
- Vehicle capacity and capabilities

Respond ONLY with valid JSON matching this schema:
{
  "recommended_driver": "driver_id",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "risk_level": "low|medium|high",
  "alternative_drivers": ["driver_id_2", "driver_id_3"]
}`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const response = JSON.parse(completion.choices[0].message.content);

      logger.info('LLM driver assignment suggestion generated', {
        order_id: order.order_id,
        recommended: response.recommended_driver,
        confidence: response.confidence,
      });

      return {
        success: true,
        recommendation: response,
        model: this.model,
        ai_powered: true,
      };
    } catch (error) {
      logger.error('LLM driver assignment failed', { error: error.message });
      return this._getFallbackDriverSuggestion(order, availableDrivers, targetStatus);
    }
  }

  /**
   * Predict SLA violations and suggest preventive actions
   *
   * @param {Array} orders - All pending orders
   * @param {Array} drivers - All drivers
   * @param {Object} currentRoutes - Current route assignments
   * @returns {Promise<Object>} - Predictions and recommendations
   */
  async predictSLAViolations(orders, drivers, currentRoutes) {
    try {
      if (!this.groq) {
        return this._getFallbackSLAPrediction(orders, drivers);
      }

      const prompt = this._buildSLAPredictionPrompt(orders, drivers, currentRoutes);

      const completion = await this.groq.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are an AI logistics analyst specializing in SLA compliance prediction and risk management.

Analyze pending orders and predict which orders are at risk of violating 1-4 hour SLA deadlines.

Factors to consider:
- Time remaining until SLA deadline
- Current traffic conditions (assume moderate traffic)
- Driver availability and current workload
- Distance to delivery location
- Number of stops before this order

Respond ONLY with valid JSON matching this schema:
{
  "high_risk_orders": [
    {
      "order_id": "string",
      "violation_probability": 0.0-1.0,
      "estimated_delay_minutes": number,
      "recommended_action": "string"
    }
  ],
  "medium_risk_orders": [...],
  "recommendations": [
    "actionable recommendation 1",
    "actionable recommendation 2"
  ],
  "overall_risk_level": "low|medium|high"
}`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const response = JSON.parse(completion.choices[0].message.content);

      logger.info('LLM SLA prediction generated', {
        high_risk: response.high_risk_orders?.length || 0,
        medium_risk: response.medium_risk_orders?.length || 0,
        overall_risk: response.overall_risk_level,
      });

      return {
        success: true,
        prediction: response,
        model: this.model,
        ai_powered: true,
      };
    } catch (error) {
      logger.error('LLM SLA prediction failed', { error: error.message });
      return this._getFallbackSLAPrediction(orders, drivers);
    }
  }

  /**
   * Natural language query about fleet status
   *
   * @param {string} query - User's natural language question
   * @param {Object} fleetData - Current fleet data (drivers, orders, routes)
   * @returns {Promise<Object>} - AI response
   */
  async queryFleetStatus(query, fleetData) {
    try {
      if (!this.groq) {
        return {
          success: false,
          response: 'LLM service not available. Please check fleet status manually.',
          ai_powered: false,
        };
      }

      const prompt = this._buildFleetQueryPrompt(query, fleetData);

      const completion = await this.groq.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are an AI fleet operations assistant. Answer questions about the current fleet status using the provided data.

Be concise, accurate, and actionable. Provide specific numbers and metrics when relevant.

If asked about recommendations, provide 2-3 actionable suggestions.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 500,
      });

      const response = completion.choices[0].message.content;

      logger.info('LLM fleet query answered', {
        query: query.substring(0, 50),
        response_length: response.length,
      });

      return {
        success: true,
        query: query,
        response: response,
        model: this.model,
        ai_powered: true,
      };
    } catch (error) {
      logger.error('LLM fleet query failed', { error: error.message });
      return {
        success: false,
        query: query,
        response: 'Unable to process query. Please try again or check status manually.',
        error: error.message,
        ai_powered: false,
      };
    }
  }

  /**
   * Get intelligent recommendations for fleet optimization
   *
   * @param {Object} fleetMetrics - Current fleet performance metrics
   * @returns {Promise<Object>} - AI recommendations
   */
  async getOptimizationRecommendations(fleetMetrics) {
    try {
      if (!this.groq) {
        return this._getFallbackOptimizationRecommendations(fleetMetrics);
      }

      const prompt = this._buildOptimizationPrompt(fleetMetrics);

      const completion = await this.groq.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are an AI operations optimization expert for last-mile delivery fleets.

Analyze fleet performance metrics and provide actionable recommendations to:
1. Improve driver target achievement
2. Reduce SLA violations
3. Balance workload more fairly
4. Increase operational efficiency

Respond ONLY with valid JSON matching this schema:
{
  "top_recommendations": [
    {
      "priority": "high|medium|low",
      "action": "specific action to take",
      "expected_impact": "quantified expected improvement",
      "implementation": "how to implement"
    }
  ],
  "performance_insights": {
    "strengths": ["strength 1", "strength 2"],
    "weaknesses": ["weakness 1", "weakness 2"],
    "opportunities": ["opportunity 1", "opportunity 2"]
  },
  "predicted_improvements": {
    "target_achievement": "percentage improvement",
    "sla_compliance": "percentage improvement",
    "efficiency_gain": "percentage improvement"
  }
}`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      });

      const response = JSON.parse(completion.choices[0].message.content);

      logger.info('LLM optimization recommendations generated', {
        num_recommendations: response.top_recommendations?.length || 0,
      });

      return {
        success: true,
        recommendations: response,
        model: this.model,
        ai_powered: true,
      };
    } catch (error) {
      logger.error('LLM optimization recommendations failed', { error: error.message });
      return this._getFallbackOptimizationRecommendations(fleetMetrics);
    }
  }

  /**
   * Optimize multi-vehicle route distribution using LLM
   *
   * @param {Array} pickupPoints - Pickup locations
   * @param {Array} deliveryPoints - Delivery locations
   * @param {Array} vehicles - Available vehicles
   * @param {Object} options - Additional options including SLA constraints
   * @returns {Promise<Object>} - LLM-optimized vehicle distribution strategy
   */
  async optimizeMultiVehicleRoutes(pickupPoints, deliveryPoints, vehicles, options = {}) {
    try {
      if (!this.groq) {
        return this._getFallbackMultiVehicleStrategy(pickupPoints, deliveryPoints, vehicles, options);
      }

      const prompt = this._buildMultiVehicleOptimizationPrompt(
        pickupPoints,
        deliveryPoints,
        vehicles,
        options
      );

      const completion = await this.groq.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are an AI route optimization expert specializing in multi-vehicle logistics.

Your PRIMARY goal is to ensure ALL deliveries meet the 4-HOUR SLA DEADLINE. Secondary goals include efficiency and utilization.

Priority order for optimization:
1. **SLA COMPLIANCE (CRITICAL)**: Ensure EVERY route can be completed within 4 hours from start time
2. **Use adequate vehicles**: Use AS MANY vehicles as needed to meet SLA (don't limit to "balanced" distribution if it violates SLA)
3. **Geographic clustering**: Group nearby deliveries to minimize travel time
4. **Workload balance**: Distribute fairly ONLY if SLA permits
5. **Fleet utilization**: Minimize idle vehicles ONLY if SLA permits

CRITICAL RULES:
- **NEVER violate 4-hour SLA** - this is non-negotiable
- If a balanced distribution would exceed 4 hours per route, use MORE vehicles
- Each route MUST complete all stops within 4 hours (including pickup, travel, service time, deliveries)
- Assume 5 minutes service time per stop, plus actual travel time
- If uncertain about route duration, err on the side of using MORE vehicles
- Group nearby deliveries together (geographic clustering)
- Assign each delivery to exactly ONE vehicle
- Match deliveries to nearest pickup point

Respond ONLY with valid JSON matching this schema:
{
  "strategy": {
    "num_routes": number,
    "vehicles_used": number,
    "clustering_method": "geographic|balanced|hybrid",
    "sla_compliance": "all_compliant|at_risk|violated"
  },
  "vehicle_assignments": [
    {
      "vehicle_id": "vehicle-1",
      "pickup_id": "pickup-X",
      "delivery_ids": ["del-1", "del-2", ...],
      "estimated_deliveries": number,
      "estimated_duration_minutes": number,
      "geographic_zone": "north|south|east|west|central",
      "sla_status": "safe|tight|at_risk",
      "reasoning": "why these deliveries go together and how SLA is met"
    }
  ],
  "optimization_metrics": {
    "utilization_rate": 0.0-1.0,
    "balance_score": 0.0-1.0,
    "efficiency_score": 0.0-1.0,
    "sla_compliance_score": 0.0-1.0,
    "max_route_duration_minutes": number
  },
  "recommendations": ["suggestion 1", "suggestion 2"]
}`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const response = JSON.parse(completion.choices[0].message.content);

      logger.info('LLM multi-vehicle optimization generated', {
        num_pickups: pickupPoints.length,
        num_deliveries: deliveryPoints.length,
        num_vehicles: vehicles.length,
        routes_suggested: response.strategy?.num_routes,
        vehicles_used: response.strategy?.vehicles_used,
      });

      return {
        success: true,
        optimization: response,
        model: this.model,
        ai_powered: true,
      };
    } catch (error) {
      logger.error('LLM multi-vehicle optimization failed', { error: error.message });
      return this._getFallbackMultiVehicleStrategy(pickupPoints, deliveryPoints, vehicles, options);
    }
  }

  /**
   * Calculate ETAs for route stops with time accumulation
   *
   * @param {Object} route - Route with OSRM data
   * @param {Date} startTime - Route start time
   * @returns {Object} - Route with ETA data added to each stop
   */
  calculateRouteETAs(route, startTime = new Date()) {
    try {
      let cumulativeSeconds = 0;
      const serviceTimeMinutes = 5; // Default service time per stop

      route.stops.forEach((stop, index) => {
        if (index === 0) {
          // First stop (pickup) - starts immediately
          stop.estimatedArrival = startTime.toISOString();
          stop.arrivalTime = startTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
          stop.cumulativeDuration = 0;
          stop.timeFromPreviousStop = 0;
        } else {
          // Get duration from OSRM leg data (if available)
          const legDuration = route.osrm?.legs?.[index - 1]?.duration || 0;
          const serviceTimeSeconds = serviceTimeMinutes * 60;

          // Add travel time + service time from previous stop
          cumulativeSeconds += legDuration + serviceTimeSeconds;

          // Calculate arrival time
          const arrivalTime = new Date(startTime.getTime() + cumulativeSeconds * 1000);

          stop.estimatedArrival = arrivalTime.toISOString();
          stop.arrivalTime = arrivalTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
          stop.cumulativeDuration = Math.round(cumulativeSeconds / 60); // minutes
          stop.timeFromPreviousStop = Math.round((legDuration + serviceTimeSeconds) / 60);
        }
      });

      logger.debug('ETAs calculated for route', {
        route_id: route.id,
        num_stops: route.stops.length,
        total_duration: Math.round(cumulativeSeconds / 60),
      });

      return route;
    } catch (error) {
      logger.error('ETA calculation failed', { error: error.message });
      return route; // Return original route if calculation fails
    }
  }

  // ==================== PROMPT BUILDERS ====================

  _buildMultiVehicleOptimizationPrompt(pickupPoints, deliveryPoints, vehicles, options = {}) {
    // Calculate geographic bounds for clustering hints
    const lats = deliveryPoints.map((d) => d.lat);
    const lngs = deliveryPoints.map((d) => d.lng);
    const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
    const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;

    const slaHours = options.slaHours || 4;
    const slaMinutes = slaHours * 60;

    return `Optimization Request:

**SLA CONSTRAINT**: All routes must complete within ${slaHours} hours (${slaMinutes} minutes) from start time.
- Service time per stop: 5 minutes
- Available time budget per route: ${slaMinutes} minutes MAXIMUM

Pickup Points (${pickupPoints.length}):
${pickupPoints
  .map(
    (p, i) =>
      `${i + 1}. ${p.id || p.name} - Location: (${p.lat}, ${p.lng})${p.address ? ` - ${p.address}` : ''}`
  )
  .join('\n')}

Delivery Points (${deliveryPoints.length}):
${deliveryPoints
  .map(
    (d, i) =>
      `${i + 1}. ${d.id || d.name} - Location: (${d.lat}, ${d.lng})${d.address ? ` - ${d.address}` : ''}`
  )
  .join('\n')}

Available Vehicles (${vehicles.length}):
${vehicles
  .map(
    (v, i) =>
      `${i + 1}. ${v.id} - Type: ${v.type || 'van'}, Capacity: ${v.capacity || 1000} kg`
  )
  .join('\n')}

Geographic Center: (${centerLat.toFixed(4)}, ${centerLng.toFixed(4)})

TASK: Create an optimal multi-vehicle distribution strategy that:
1. **PRIMARY GOAL**: ENSURES all routes complete within ${slaMinutes} minutes (${slaHours}-hour SLA)
2. Uses AS MANY vehicles as needed to meet SLA (available: ${vehicles.length} vehicles)
3. Distributes ${deliveryPoints.length} deliveries across vehicles with SLA compliance
4. Groups geographically close deliveries together to minimize travel time
5. Assigns each delivery to the nearest appropriate pickup point
6. Estimates route duration for each vehicle (travel time + service time)
7. If balanced distribution risks exceeding ${slaMinutes} minutes, USE MORE VEHICLES

**CRITICAL**: If you're unsure whether a route fits in ${slaMinutes} minutes, split it into more routes.
Better to use more vehicles and guarantee SLA than to risk violations.

Provide a complete vehicle assignment strategy with duration estimates and SLA status for each route.`;
  }

  _buildDriverAssignmentPrompt(order, drivers, targetStatus) {
    return `Order Details:
- Order ID: ${order.order_id}
- Customer: ${order.customer_name || 'N/A'}
- Created: ${order.created_at}
- SLA Deadline: ${order.sla_hours} hours
- Remaining Time: ${this._calculateRemainingMinutes(order.created_at, order.sla_hours)} minutes
- Pickup Location: ${order.pickup_id}
- Delivery: ${order.delivery_lat}, ${order.delivery_lng}
- Load: ${order.load_kg || 0} kg
- Revenue: $${order.revenue || 0}

Available Drivers:
${drivers
  .map(
    (d, i) => `${i + 1}. ${d.driver_id}
   - Vehicle: ${d.vehicle_type}, Capacity: ${d.capacity_kg} kg
   - Target Progress: ${this._getDriverProgress(d.driver_id, targetStatus)}
   - Status: ${this._getDriverStatus(d.driver_id, targetStatus)}`
  )
  .join('\n')}

Target Achievement Status:
${JSON.stringify(targetStatus, null, 2)}

Which driver should be assigned this order? Provide reasoning and confidence level.`;
  }

  _buildSLAPredictionPrompt(orders, drivers, currentRoutes) {
    return `Pending Orders:
${orders
  .map(
    (o, i) => `${i + 1}. ${o.order_id}
   - Created: ${o.created_at}
   - SLA: ${o.sla_hours} hours
   - Remaining: ${this._calculateRemainingMinutes(o.created_at, o.sla_hours)} minutes
   - Location: ${o.delivery_lat}, ${o.delivery_lng}`
  )
  .join('\n')}

Active Drivers: ${drivers.length}
Current Routes: ${currentRoutes ? Object.keys(currentRoutes).length : 0}

Analyze SLA violation risk and provide actionable recommendations.`;
  }

  _buildFleetQueryPrompt(query, fleetData) {
    const summary = {
      total_drivers: fleetData.drivers?.length || 0,
      pending_orders: fleetData.orders?.length || 0,
      target_achievement: fleetData.targetStatus || {},
      active_routes: fleetData.routes?.length || 0,
    };

    return `User Question: "${query}"

Current Fleet Data:
${JSON.stringify(summary, null, 2)}

Provide a clear, concise answer to the user's question based on the fleet data.`;
  }

  _buildOptimizationPrompt(metrics) {
    return `Fleet Performance Metrics:
${JSON.stringify(metrics, null, 2)}

Analyze performance and provide top 3-5 actionable recommendations for improvement.`;
  }

  // ==================== HELPER METHODS ====================

  _calculateRemainingMinutes(createdAt, slaHours) {
    const now = new Date();
    const created = new Date(createdAt);
    const deadlineMinutes = slaHours * 60;
    const elapsedMinutes = (now - created) / (1000 * 60);
    return Math.max(0, Math.round(deadlineMinutes - elapsedMinutes));
  }

  _getDriverProgress(driverId, targetStatus) {
    const driver = targetStatus?.drivers?.find((d) => d.driver_id === driverId);
    if (!driver) return 'Unknown';
    return `${driver.current_deliveries}/${driver.target_deliveries} deliveries (${driver.delivery_progress})`;
  }

  _getDriverStatus(driverId, targetStatus) {
    const driver = targetStatus?.drivers?.find((d) => d.driver_id === driverId);
    return driver?.status || 'available';
  }

  // ==================== FALLBACK METHODS ====================

  _getFallbackDriverSuggestion(order, drivers, targetStatus) {
    // Simple fallback: choose driver with lowest progress
    const sortedDrivers = drivers.sort((a, b) => {
      const progressA = this._getSimpleProgress(a.driver_id, targetStatus);
      const progressB = this._getSimpleProgress(b.driver_id, targetStatus);
      return progressA - progressB;
    });

    return {
      success: true,
      recommendation: {
        recommended_driver: sortedDrivers[0]?.driver_id || drivers[0]?.driver_id,
        confidence: 0.6,
        reasoning: 'Rule-based assignment (LLM unavailable): Selected driver with lowest target progress',
        risk_level: 'medium',
        alternative_drivers: sortedDrivers.slice(1, 3).map((d) => d.driver_id),
      },
      model: 'fallback',
      ai_powered: false,
    };
  }

  _getFallbackSLAPrediction(orders, drivers) {
    const now = new Date();
    const atRisk = orders.filter((o) => {
      const remaining = this._calculateRemainingMinutes(o.created_at, o.sla_hours);
      return remaining < 60;
    });

    return {
      success: true,
      prediction: {
        high_risk_orders: atRisk
          .filter((o) => this._calculateRemainingMinutes(o.created_at, o.sla_hours) < 30)
          .map((o) => ({
            order_id: o.order_id,
            violation_probability: 0.9,
            estimated_delay_minutes: 15,
            recommended_action: 'Assign to nearest available driver immediately',
          })),
        medium_risk_orders: atRisk
          .filter((o) => {
            const remaining = this._calculateRemainingMinutes(o.created_at, o.sla_hours);
            return remaining >= 30 && remaining < 60;
          })
          .map((o) => ({
            order_id: o.order_id,
            violation_probability: 0.5,
            estimated_delay_minutes: 10,
            recommended_action: 'Prioritize in next assignment batch',
          })),
        recommendations: [
          'Increase driver availability for critical orders',
          'Consider reoptimizing current routes',
          'Monitor traffic conditions for affected areas',
        ],
        overall_risk_level: atRisk.length > 5 ? 'high' : atRisk.length > 2 ? 'medium' : 'low',
      },
      model: 'fallback',
      ai_powered: false,
    };
  }

  _getFallbackOptimizationRecommendations(metrics) {
    return {
      success: true,
      recommendations: {
        top_recommendations: [
          {
            priority: 'high',
            action: 'Rebalance workload across underperforming drivers',
            expected_impact: '15-20% improvement in target achievement',
            implementation: 'Use dynamic assignment to prioritize low-progress drivers',
          },
          {
            priority: 'medium',
            action: 'Increase monitoring frequency for at-risk orders',
            expected_impact: '10% reduction in SLA violations',
            implementation: 'Check at-risk orders every 15 minutes instead of 30',
          },
        ],
        performance_insights: {
          strengths: ['Fair workload distribution active', 'Real-time SLA tracking enabled'],
          weaknesses: ['Some drivers below target pace', 'Traffic conditions not factored'],
          opportunities: ['Implement predictive analytics', 'Add real-time traffic data'],
        },
        predicted_improvements: {
          target_achievement: '15-25% improvement',
          sla_compliance: '10-15% improvement',
          efficiency_gain: '8-12% improvement',
        },
      },
      model: 'fallback',
      ai_powered: false,
    };
  }

  _getFallbackMultiVehicleStrategy(pickupPoints, deliveryPoints, vehicles, options = {}) {
    // Fallback strategy with SLA consideration
    const slaMinutes = (options.slaHours || 4) * 60;
    const serviceTimePerStop = 5; // minutes
    const avgTravelTimePerStop = 10; // Conservative estimate in minutes
    const totalTimePerStop = serviceTimePerStop + avgTravelTimePerStop;

    // Calculate max deliveries per vehicle to meet SLA
    // Formula: (SLA minutes - pickup time) / time per stop
    const maxDeliveriesPerVehicle = Math.floor((slaMinutes - serviceTimePerStop) / totalTimePerStop);

    // Calculate minimum vehicles needed to meet SLA
    const minVehiclesForSLA = Math.ceil(deliveryPoints.length / maxDeliveriesPerVehicle);

    // Use the greater of: vehicles needed for SLA or a reasonable minimum
    const numVehicles = Math.min(
      vehicles.length,
      Math.max(minVehiclesForSLA, Math.ceil(deliveryPoints.length / 10))
    );

    const deliveriesPerVehicle = Math.ceil(deliveryPoints.length / numVehicles);

    logger.info('[LLM Fallback] SLA-aware vehicle allocation', {
      slaMinutes,
      maxDeliveriesPerVehicle,
      minVehiclesForSLA,
      actualVehiclesUsed: numVehicles,
      deliveriesPerVehicle,
    });

    const assignments = [];
    for (let i = 0; i < numVehicles; i++) {
      const start = i * deliveriesPerVehicle;
      const end = Math.min(start + deliveriesPerVehicle, deliveryPoints.length);
      const vehicleDeliveries = deliveryPoints.slice(start, end);

      // Find nearest pickup point for this vehicle's deliveries
      const pickupId =
        pickupPoints.length > 0 ? pickupPoints[i % pickupPoints.length].id : 'pickup-1';

      assignments.push({
        vehicle_id: vehicles[i].id,
        pickup_id: pickupId,
        delivery_ids: vehicleDeliveries.map((d) => d.id),
        estimated_deliveries: vehicleDeliveries.length,
        geographic_zone: 'auto-assigned',
        reasoning: 'Evenly distributed using fallback strategy',
      });
    }

    const estimatedMaxDuration = deliveriesPerVehicle * totalTimePerStop + serviceTimePerStop;
    const slaCompliant = estimatedMaxDuration <= slaMinutes;

    return {
      success: true,
      optimization: {
        strategy: {
          num_routes: numVehicles,
          vehicles_used: numVehicles,
          clustering_method: 'balanced',
          sla_compliance: slaCompliant ? 'all_compliant' : 'at_risk',
        },
        vehicle_assignments: assignments,
        optimization_metrics: {
          utilization_rate: numVehicles / vehicles.length,
          balance_score: 0.8,
          efficiency_score: 0.7,
          sla_compliance_score: slaCompliant ? 1.0 : 0.7,
          max_route_duration_minutes: estimatedMaxDuration,
        },
        recommendations: [
          'Enable LLM optimization for better geographic clustering',
          slaCompliant
            ? 'All routes estimated to meet 4-hour SLA'
            : `Warning: Routes may exceed ${slaMinutes} minute SLA. Consider using more vehicles.`,
        ],
      },
      model: 'fallback',
      ai_powered: false,
    };
  }

  _getSimpleProgress(driverId, targetStatus) {
    const driver = targetStatus?.drivers?.find((d) => d.driver_id === driverId);
    if (!driver) return 0;

    const deliveryProgress = driver.current_deliveries / driver.target_deliveries;
    const revenueProgress = driver.current_revenue / driver.target_revenue;
    return (deliveryProgress + revenueProgress) / 2;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      enabled: !!this.groq,
      model: this.model,
      unified_advisor_status: this.unifiedAdvisor?.getStatus() || null,
      capabilities: {
        driver_assignment: true,
        sla_prediction: true,
        natural_language_queries: !!this.groq,
        optimization_recommendations: true,
        multi_vehicle_optimization: true, // NEW
        eta_calculations: true, // NEW
      },
    };
  }
}

// Export singleton
module.exports = new LLMFleetAdvisor();
