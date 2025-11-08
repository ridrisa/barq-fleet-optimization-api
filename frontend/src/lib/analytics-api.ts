/**
 * Analytics API Client
 * TypeScript client for BARQ Fleet Analytics Python service
 */

const ANALYTICS_API_URL = process.env.NEXT_PUBLIC_ANALYTICS_API_URL || 'http://localhost:8080';

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

  // SLA Analytics
  async getRealtimeSLAStatus(): Promise<RealtimeSLAStatus> {
    return this.request('/api/sla/realtime');
  }

  async getSLACompliance(days: number = 7, serviceType?: string): Promise<SLACompliance> {
    const params = new URLSearchParams({ days: days.toString() });
    if (serviceType) params.append('service_type', serviceType);
    return this.request(`/api/sla/compliance?${params.toString()}`);
  }

  async getSLABreachRisk(hubId?: number): Promise<SLABreachRisk> {
    const params = hubId ? `?hub_id=${hubId}` : '';
    return this.request(`/api/sla/breach-risk${params}`);
  }

  async getSLATrend(days: number = 30): Promise<SLATrend> {
    return this.request(`/api/sla/trend?days=${days}`);
  }

  // Route Analytics
  async getRouteEfficiency(days: number = 30, hubId?: number): Promise<RouteEfficiency> {
    const params = new URLSearchParams({ days: days.toString() });
    if (hubId) params.append('hub_id', hubId.toString());
    return this.request(`/api/routes/efficiency?${params.toString()}`);
  }

  async getRouteBottlenecks(days: number = 30): Promise<RouteBottlenecks> {
    return this.request(`/api/routes/bottlenecks?days=${days}`);
  }

  async getRouteABC(minDeliveries: number = 10): Promise<RouteABC> {
    return this.request(`/api/routes/abc?min_deliveries=${minDeliveries}`);
  }

  // Fleet Performance
  async getDriverPerformance(period: string = 'monthly'): Promise<DriverPerformanceList> {
    return this.request(`/api/fleet/drivers?period=${period}`);
  }

  async getSingleDriverPerformance(
    driverId: number,
    period: string = 'weekly'
  ): Promise<SingleDriverPerformance> {
    return this.request(`/api/fleet/driver/${driverId}?period=${period}`);
  }

  async getVehiclePerformance(period: string = 'monthly'): Promise<VehiclePerformance> {
    return this.request(`/api/fleet/vehicles?period=${period}`);
  }

  async getDriverCohorts(period: string = 'monthly'): Promise<DriverCohorts> {
    return this.request(`/api/fleet/cohorts?period=${period}`);
  }

  // Demand Forecasting
  async getHourlyForecast(horizon: number = 7): Promise<HourlyForecast> {
    return this.request(`/api/demand/hourly?horizon=${horizon}`);
  }

  async getDailyForecast(horizon: number = 30): Promise<DailyForecast> {
    return this.request(`/api/demand/daily?horizon=${horizon}`);
  }

  async getResourceForecast(horizon: number = 14): Promise<ResourceForecast> {
    return this.request(`/api/demand/resources?horizon=${horizon}`);
  }

  // GPT Chat Interface - Natural Language Queries
  async queryGPT(query: string): Promise<{ response: string; data?: any }> {
    // This will be connected to OpenAI API or custom GPT endpoint
    // For now, parse the query and route to appropriate analytics endpoint
    return this.parseNaturalLanguageQuery(query);
  }

  private async parseNaturalLanguageQuery(query: string): Promise<{ response: string; data?: any }> {
    const lowerQuery = query.toLowerCase();

    // SLA queries
    if (lowerQuery.includes('sla') || lowerQuery.includes('service level')) {
      if (lowerQuery.includes('realtime') || lowerQuery.includes('current')) {
        const data = await this.getRealtimeSLAStatus();
        return {
          response: `Current SLA status: ${data.compliance_rate.toFixed(1)}% compliance rate with ${data.at_risk_count} orders at risk.`,
          data,
        };
      }
      if (lowerQuery.includes('trend')) {
        const data = await this.getSLATrend(30);
        return {
          response: `SLA trend over last 30 days is ${data.trend_direction} with ${data.avg_compliance.toFixed(1)}% average compliance.`,
          data,
        };
      }
    }

    // Driver performance queries
    if (lowerQuery.includes('driver') && lowerQuery.includes('performance')) {
      const data = await this.getDriverPerformance('monthly');
      return {
        response: `Average driver performance: DPI ${data.averages.dpi.toFixed(1)}, ${data.averages.success_rate.toFixed(1)}% success rate across ${data.drivers.length} drivers.`,
        data,
      };
    }

    // Demand forecast queries
    if (lowerQuery.includes('demand') || lowerQuery.includes('forecast')) {
      const data = await this.getDailyForecast(7);
      return {
        response: `7-day demand forecast shows an average of ${Math.round(data.forecast.reduce((sum: number, f: any) => sum + f.predicted_orders, 0) / data.forecast.length)} orders per day.`,
        data,
      };
    }

    // Default response
    return {
      response: 'I can help you with SLA analytics, driver performance, route efficiency, and demand forecasting. Try asking about "SLA status", "driver performance", or "demand forecast".',
    };
  }
}

// Export singleton instance
const analyticsAPI = new AnalyticsAPIClient();
export default analyticsAPI;
