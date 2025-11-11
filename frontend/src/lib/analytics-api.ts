/**
 * Analytics API Client
 * TypeScript client for BARQ Fleet Analytics Python service
 */

// Use correct backend URL for analytics
const ANALYTICS_API_URL = process.env.NEXT_PUBLIC_ANALYTICS_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://route-opt-backend-426674819922.us-central1.run.app';

// Type Definitions
export interface AnalyticsResponse<T> {
  status: string;
  data?: T;
  error?: string;
}

// SLA Analytics Types
export interface RealtimeSLAStatus {
  active_deliveries: number;
  at_risk_count: number;
  breach_imminent: number;
  compliance_rate: number;
  at_risk_orders: Array<{
    order_id: string;
    customer_name: string;
    service_type: string;
    remaining_time: number;
    risk_level: string;
  }>;
}

export interface SLACompliance {
  period_days: number;
  service_type?: string;
  overall_compliance: number;
  total_deliveries: number;
  on_time: number;
  breached: number;
  by_service_type: Array<{
    service_type: string;
    compliance_rate: number;
    total: number;
  }>;
  by_hub: Array<{
    hub_name: string;
    compliance_rate: number;
    total: number;
  }>;
}

export interface SLABreachRisk {
  hub_id?: number;
  high_risk_patterns: Array<{
    pattern: string;
    frequency: number;
    impact_score: number;
  }>;
  time_of_day_analysis: Array<{
    hour: number;
    breach_rate: number;
    avg_delay: number;
  }>;
  recommendations: string[];
}

export interface SLATrend {
  days: number;
  trend_data: Array<{
    date: string;
    compliance_rate: number;
    total_deliveries: number;
    breaches: number;
  }>;
  trend_direction: 'improving' | 'declining' | 'stable';
  avg_compliance: number;
}

// Route Analytics Types
export interface RouteEfficiency {
  period_days: number;
  hub_id?: number;
  overall_metrics: {
    total_deliveries: number;
    avg_efficiency_score: number;
    avg_on_time_rate: number;
    avg_delivery_hours: number;
  };
  top_performers: Array<{
    hub: string;
    score: number;
  }>;
  bottom_performers: Array<{
    hub: string;
    score: number;
  }>;
}

export interface RouteBottlenecks {
  period_days: number;
  peak_hours: Array<{
    hour: number;
    avg_load: number;
    capacity_used: string;
  }>;
  overload_periods: Array<{
    date: string;
    hour: number;
    drivers_needed: number;
    drivers_available: number;
  }>;
}

export interface RouteABC {
  min_deliveries: number;
  classification: {
    A_routes: { count: number; volume_pct: number };
    B_routes: { count: number; volume_pct: number };
    C_routes: { count: number; volume_pct: number };
  };
}

// Fleet Performance Types
export interface DriverPerformance {
  id: number;
  name: string;
  dpi: number;
  success_rate: number;
  on_time_rate: number;
  productivity: number;
  deliveries: number;
}

export interface DriverPerformanceList {
  period: string;
  drivers: DriverPerformance[];
  averages: {
    dpi: number;
    success_rate: number;
    on_time_rate: number;
    productivity: number;
  };
}

export interface SingleDriverPerformance {
  driver_id: number;
  period: string;
  metrics: DriverPerformance & {
    total_deliveries: number;
    avg_delivery_time: number;
  };
  trend: Array<{
    week: number;
    dpi: number;
  }>;
}

export interface VehiclePerformance {
  period: string;
  vehicles: Array<{
    id: number;
    plate: string;
    vpi: number;
    success_rate: number;
    utilization: number;
    efficiency: number;
    trips: number;
  }>;
  averages: {
    vpi: number;
    success_rate: number;
    utilization: number;
    efficiency: number;
  };
}

export interface DriverCohorts {
  period: string;
  cohorts: {
    top_performers: {
      count: number;
      avg_dpi: number;
      avg_success_rate: number;
    };
    mid_performers: {
      count: number;
      avg_dpi: number;
      avg_success_rate: number;
    };
    low_performers: {
      count: number;
      avg_dpi: number;
      avg_success_rate: number;
    };
  };
  statistical_significance: string;
}

// Demand Forecasting Types
export interface HourlyForecast {
  forecast_type: 'hourly';
  horizon_days: number;
  forecast: Array<{
    date: string;
    hour: number;
    predicted_orders: number;
    confidence: number;
  }>;
}

export interface DailyForecast {
  forecast_type: 'daily';
  horizon_days: number;
  forecast: Array<{
    date: string;
    predicted_orders: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    confidence: number;
  }>;
}

export interface ResourceForecast {
  forecast_type: 'resources';
  horizon_days: number;
  requirements: Array<{
    date: string;
    drivers_needed: number;
    vehicles_needed: number;
    peak_hour: number;
    peak_drivers: number;
  }>;
}

// API Client Class
class AnalyticsAPIClient {
  private baseURL: string;

  constructor(baseURL: string = ANALYTICS_API_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Analytics API request failed:', error);
      throw error;
    }
  }

  // Health & Status
  async health(): Promise<{ status: string; service: string; version: string }> {
    return this.request('/health');
  }

  async apiDocs(): Promise<any> {
    return this.request('/api/docs');
  }

  // SLA Analytics - Available endpoints on backend
  async getRealtimeSLAStatus(): Promise<RealtimeSLAStatus> {
    return this.request('/api/v1/analytics/sla/realtime');
  }

  async getSLACompliance(days: number = 7, serviceType?: string): Promise<SLACompliance> {
    const params = new URLSearchParams({ days: days.toString() });
    if (serviceType) params.append('service_type', serviceType);
    return this.request(`/api/v1/analytics/sla/compliance?${params.toString()}`);
  }

  async getSLATrend(days: number = 30): Promise<SLATrend> {
    return this.request(`/api/v1/analytics/sla/trend?days=${days}`);
  }

  // Fleet Performance - Available endpoint on backend
  async getFleetPerformance(): Promise<any> {
    return this.request('/api/v1/analytics/fleet/performance');
  }

  // Dashboard Summary - Available endpoint on backend
  async getDashboardSummary(): Promise<any> {
    return this.request('/api/v1/analytics/dashboard/summary');
  }

  // Legacy methods that map to available endpoints
  async getSLABreachRisk(hubId?: number): Promise<SLABreachRisk> {
    // Not available - use getSLACompliance() instead
    throw new Error('SLA Breach Risk endpoint not available. Use getSLACompliance() instead.');
  }

  async getRouteEfficiency(days: number = 30, hubId?: number): Promise<RouteEfficiency> {
    const params = new URLSearchParams({ days: days.toString() });
    if (hubId) params.append('hub_id', hubId.toString());
    return this.request(`/api/v1/analytics/routes/efficiency?${params.toString()}`);
  }

  async getRouteBottlenecks(days: number = 30): Promise<RouteBottlenecks> {
    // Not yet implemented on backend
    throw new Error('Route Bottlenecks endpoint not implemented yet.');
  }

  async getRouteABC(minDeliveries: number = 10): Promise<RouteABC> {
    // Not yet implemented on backend
    throw new Error('ABC analysis not implemented yet');
  }

  async getDriverPerformance(period: string = 'monthly'): Promise<DriverPerformanceList> {
    const params = new URLSearchParams({ period });
    return this.request(`/api/v1/analytics/fleet/drivers?${params.toString()}`);
  }

  async getSingleDriverPerformance(
    driverId: number,
    period: string = 'weekly'
  ): Promise<SingleDriverPerformance> {
    const params = new URLSearchParams({ period });
    return this.request(`/api/v1/analytics/fleet/drivers/${driverId}?${params.toString()}`);
  }

  async getVehiclePerformance(period: string = 'monthly'): Promise<VehiclePerformance> {
    const params = new URLSearchParams({ period });
    return this.request(`/api/v1/analytics/fleet/vehicles?${params.toString()}`);
  }

  async getDriverCohorts(period: string = 'monthly'): Promise<DriverCohorts> {
    // Not yet implemented on backend
    throw new Error('Driver Cohorts endpoint not implemented yet.');
  }

  async getHourlyForecast(horizon: number = 7): Promise<HourlyForecast> {
    // Not available - throw error
    throw new Error('Demand forecasting not implemented yet');
  }

  async getDailyForecast(horizon: number = 30): Promise<DailyForecast> {
    // Not available - throw error
    throw new Error('Demand forecasting not implemented yet');
  }

  async getResourceForecast(horizon: number = 14): Promise<ResourceForecast> {
    // Not available - throw error
    throw new Error('Demand forecasting not implemented yet');
  }

  // GPT Chat Interface - Natural Language Queries
  async queryGPT(query: string): Promise<{ response: string; data?: any }> {
    // This will be connected to OpenAI API or custom GPT endpoint
    // For now, parse the query and route to appropriate analytics endpoint
    return this.parseNaturalLanguageQuery(query);
  }

  private async parseNaturalLanguageQuery(query: string): Promise<{ response: string; data?: any }> {
    const lowerQuery = query.toLowerCase();

    try {
      // SLA queries
      if (lowerQuery.includes('sla') || lowerQuery.includes('service level')) {
        if (lowerQuery.includes('realtime') || lowerQuery.includes('current') || lowerQuery.includes('status')) {
          const data = await this.getRealtimeSLAStatus();
          const totalAtRisk = data.at_risk_orders?.length || 0;
          return {
            response: `Current SLA status: ${totalAtRisk} orders at risk. Check the data below for detailed breakdown by service type.`,
            data,
          };
        }
        if (lowerQuery.includes('trend')) {
          const data = await this.getSLATrend(30);
          return {
            response: `SLA trend data for the last 30 days. View the detailed trend below.`,
            data,
          };
        }
        if (lowerQuery.includes('compliance')) {
          const data = await this.getSLACompliance(7);
          return {
            response: `SLA compliance data for the last 7 days. See breakdown by service type and hub below.`,
            data,
          };
        }
      }

      // Driver/Fleet performance queries
      if (lowerQuery.includes('driver') || lowerQuery.includes('fleet') || lowerQuery.includes('performance')) {
        const data = await this.getFleetPerformance();
        return {
          response: `Fleet performance data retrieved. See detailed metrics below.`,
          data,
        };
      }

      // Dashboard/summary queries
      if (lowerQuery.includes('dashboard') || lowerQuery.includes('summary') || lowerQuery.includes('overview')) {
        const data = await this.getDashboardSummary();
        return {
          response: `Dashboard summary retrieved with overall system metrics.`,
          data,
        };
      }

      // Demand forecast queries (not available yet)
      if (lowerQuery.includes('demand') || lowerQuery.includes('forecast')) {
        return {
          response: `Demand forecasting is not yet available in the system. Please check back later or contact support for this feature.`,
        };
      }

      // Default response
      return {
        response: 'I can help you with SLA analytics (realtime, compliance, trends), fleet performance, and dashboard summaries. Try asking:\n\n• "What is the current SLA status?"\n• "Show me driver performance trends"\n• "Display dashboard summary"\n• "Show SLA compliance for last week"',
      };
    } catch (error) {
      console.error('Query parsing error:', error);
      return {
        response: `Error processing your query: ${error instanceof Error ? error.message : 'Unknown error'}. Please try a different question or check if the backend service is running.`,
      };
    }
  }
}

// Export singleton instance
const analyticsAPI = new AnalyticsAPIClient();
export default analyticsAPI;
