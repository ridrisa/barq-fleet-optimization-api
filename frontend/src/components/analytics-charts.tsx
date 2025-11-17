'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Users,
  Truck,
  Clock,
  Target,
} from 'lucide-react';

// SLA Status Card
export function SLAStatusCard({ data }: { data: any }) {
  const complianceRate = data?.compliance_rate || 0;
  const atRiskCount = data?.at_risk_count || 0;
  const breachImminent = data?.breach_imminent || 0;

  const getComplianceColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Real-time SLA Status</h3>
        {complianceRate >= 95 ? (
          <CheckCircle className="h-5 w-5 text-green-600" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
        )}
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-end gap-2 mb-1">
            <span className={`text-4xl font-bold ${getComplianceColor(complianceRate)}`}>
              {complianceRate.toFixed(1)}%
            </span>
            <span className="text-sm text-muted-foreground mb-1">compliance</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                complianceRate >= 95
                  ? 'bg-green-600'
                  : complianceRate >= 85
                    ? 'bg-yellow-600'
                    : 'bg-red-600'
              }`}
              style={{ width: `${complianceRate}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">At Risk</p>
            <p className="text-2xl font-bold text-yellow-600">{atRiskCount}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Breach Imminent</p>
            <p className="text-2xl font-bold text-red-600">{breachImminent}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Driver Performance Card
export function DriverPerformanceCard({ data }: { data: any }) {
  const topDrivers = data?.drivers?.slice(0, 5) || [];
  const averages = data?.averages || {};

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Top Driver Performance</h3>
      </div>

      <div className="mb-4 p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground mb-2">Fleet Average</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">DPI</p>
            <p className="text-lg font-bold">{averages.dpi?.toFixed(1) || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Success Rate</p>
            <p className="text-lg font-bold">{averages.success_rate?.toFixed(1) || 'N/A'}%</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {topDrivers.map((driver: any, index: number) => (
          <div key={driver.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Badge variant={index === 0 ? 'default' : 'secondary'}>#{index + 1}</Badge>
              <div>
                <p className="font-medium">{driver.name || `Driver ${driver.id}`}</p>
                <p className="text-xs text-muted-foreground">
                  {driver.deliveries || 0} deliveries
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg">{driver.dpi?.toFixed(1) || 'N/A'}</p>
              <p className="text-xs text-muted-foreground">DPI</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Route Efficiency Chart
export function RouteEfficiencyChart({ data }: { data: any }) {
  const topPerformers = data?.top_performers || [];
  const bottomPerformers = data?.bottom_performers || [];
  const overallScore = data?.overall_metrics?.avg_efficiency_score || 0;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-green-600';
    if (score >= 80) return 'bg-blue-600';
    if (score >= 70) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Route Efficiency Analysis</h3>
      </div>

      <div className="mb-6 text-center p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground mb-2">Overall Efficiency Score</p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-4xl font-bold">{overallScore.toFixed(1)}</span>
          <span className="text-muted-foreground">/100</span>
        </div>
      </div>

      <div className="space-y-6">
        {topPerformers.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Top Performers
            </p>
            <div className="space-y-2">
              {topPerformers.map((hub: any, index: number) => (
                <div key={index} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{hub.hub}</span>
                    <span className="font-medium">{hub.score?.toFixed(1) || 'N/A'}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getScoreColor(hub.score)}`}
                      style={{ width: `${hub.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {bottomPerformers.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-3 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Needs Improvement
            </p>
            <div className="space-y-2">
              {bottomPerformers.map((hub: any, index: number) => (
                <div key={index} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{hub.hub}</span>
                    <span className="font-medium">{hub.score?.toFixed(1) || 'N/A'}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getScoreColor(hub.score)}`}
                      style={{ width: `${hub.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// Demand Forecast Card
export function DemandForecastCard({ data }: { data: any }) {
  const forecast = data?.forecast?.slice(0, 7) || [];

  const getTrendIcon = (trend: string) => {
    if (trend === 'increasing') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === 'decreasing') return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5" />
        <h3 className="text-lg font-semibold">7-Day Demand Forecast</h3>
      </div>

      <div className="space-y-3">
        {forecast.map((day: any, index: number) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 bg-muted rounded-lg"
          >
            <div>
              <p className="font-medium">
                {new Date(day.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
              <div className="flex items-center gap-1 mt-1">
                {getTrendIcon(day.trend)}
                <p className="text-xs text-muted-foreground capitalize">{day.trend}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{day.predicted_orders || 0}</p>
              <p className="text-xs text-muted-foreground">
                {((day.confidence || 0) * 100).toFixed(0)}% conf.
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Vehicle Performance Card
export function VehiclePerformanceCard({ data }: { data: any }) {
  const vehicles = data?.vehicles?.slice(0, 5) || [];
  const averages = data?.averages || {};

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Truck className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Vehicle Performance</h3>
      </div>

      <div className="mb-4 p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground mb-2">Fleet Average VPI</p>
        <div className="text-3xl font-bold">{averages.vpi?.toFixed(1) || 'N/A'}</div>
      </div>

      <div className="space-y-3">
        {vehicles.map((vehicle: any) => (
          <div key={vehicle.id} className="p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium">{vehicle.plate}</p>
              <Badge variant="outline">{vehicle.vpi?.toFixed(1) || 'N/A'} VPI</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Success</p>
                <p className="font-medium">{vehicle.success_rate?.toFixed(0) || 'N/A'}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">Utilization</p>
                <p className="font-medium">{vehicle.utilization?.toFixed(0) || 'N/A'}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">Trips</p>
                <p className="font-medium">{vehicle.trips || 0}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// SLA Trend Line Chart (Simple visualization)
export function SLATrendChart({ data }: { data: any }) {
  const trendData = data?.trend_data || [];
  const maxCompliance = Math.max(...trendData.map((d: any) => d.compliance_rate || 0));
  const minCompliance = Math.min(...trendData.map((d: any) => d.compliance_rate || 0));

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">SLA Compliance Trend</h3>

      <div className="h-48 flex items-end gap-1">
        {trendData.slice(-30).map((day: any, index: number) => {
          const height = ((day.compliance_rate - minCompliance) / (maxCompliance - minCompliance)) * 100;
          const color =
            day.compliance_rate >= 95
              ? 'bg-green-600'
              : day.compliance_rate >= 85
                ? 'bg-yellow-600'
                : 'bg-red-600';

          return (
            <div
              key={index}
              className="flex-1 min-w-0 group relative"
              title={`${new Date(day.date).toLocaleDateString()}: ${day.compliance_rate.toFixed(1)}%`}
            >
              <div
                className={`${color} rounded-t transition-all hover:opacity-80`}
                style={{ height: `${height}%` }}
              />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                <br />
                {day.compliance_rate.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-between text-xs text-muted-foreground">
        <span>30 days ago</span>
        <span>Today</span>
      </div>
    </Card>
  );
}

// Optimization Metrics Card
export function OptimizationMetricsCard({ data }: { data: any }) {
  const totalOptimizations = data?.totalOptimizations || 0;
  const successRate = data?.successRate || 0;
  const avgCostSavings = data?.avgCostSavings || 0;
  const avgExecutionTime = data?.avgExecutionTime || 0;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-6">Optimization Overview</h3>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Total Optimizations</p>
          <p className="text-3xl font-bold">{totalOptimizations}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Success Rate</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-green-600">{successRate.toFixed(1)}%</p>
            {successRate >= 95 && <CheckCircle className="h-5 w-5 text-green-600" />}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Avg Cost Savings</p>
          <p className="text-3xl font-bold text-blue-600">${avgCostSavings.toFixed(2)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Avg Execution Time</p>
          <p className="text-3xl font-bold">{avgExecutionTime.toFixed(2)}s</p>
        </div>
      </div>
    </Card>
  );
}

// Engine Usage Card
export function EngineUsageCard({ data }: { data: any }) {
  const engineStats = data?.engineStats || [];
  const total = engineStats.reduce((sum: number, e: any) => sum + e.count, 0);

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Optimization Engines</h3>

      <div className="space-y-3">
        {engineStats.map((engine: any, index: number) => {
          const percentage = total > 0 ? (engine.count / total) * 100 : 0;
          return (
            <div key={index}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Badge variant={engine.engine === 'google-or-tools' ? 'default' : 'secondary'}>
                    {engine.engine || 'Unknown'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {engine.count} uses
                  </span>
                </div>
                <span className="text-sm font-medium">{percentage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-blue-600"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Cost Analysis Card
export function CostAnalysisCard({ data }: { data: any }) {
  const totalCost = data?.totalCost || 0;
  const avgCostPerOptimization = data?.avgCostPerOptimization || 0;
  const aiCosts = data?.aiCosts || 0;
  const engineCosts = data?.engineCosts || 0;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-6">Cost Analysis</h3>

      <div className="mb-4 p-4 bg-muted rounded-lg text-center">
        <p className="text-sm text-muted-foreground mb-1">Total Cost</p>
        <p className="text-4xl font-bold">${totalCost.toFixed(4)}</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <span className="text-sm">Avg Cost per Optimization</span>
          <span className="font-bold">${avgCostPerOptimization.toFixed(4)}</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <span className="text-sm">AI Insights Cost</span>
          <span className="font-bold">${aiCosts.toFixed(4)}</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <span className="text-sm">Engine Cost</span>
          <span className="font-bold">${engineCosts.toFixed(4)}</span>
        </div>
      </div>
    </Card>
  );
}

// Performance Metrics Card
export function PerformanceMetricsCard({ data }: { data: any }) {
  const avgDistance = data?.avgDistance || 0;
  const avgDuration = data?.avgDuration || 0;
  const avgVehiclesUsed = data?.avgVehiclesUsed || 0;
  const avgUtilization = data?.avgUtilization || 0;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-6">Performance Metrics</h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Avg Distance</span>
          </div>
          <span className="font-bold">{avgDistance.toFixed(2)} km</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Avg Duration</span>
          </div>
          <span className="font-bold">{(avgDuration / 60).toFixed(2)} hrs</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Avg Vehicles Used</span>
          </div>
          <span className="font-bold">{avgVehiclesUsed.toFixed(1)}</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Avg Utilization</span>
          </div>
          <span className="font-bold">{avgUtilization.toFixed(1)}%</span>
        </div>
      </div>
    </Card>
  );
}

// AI Insights Summary Card
export function AIInsightsSummaryCard({ data }: { data: any }) {
  const totalAIInsights = data?.totalAIInsights || 0;
  const avgAICost = data?.avgAICost || 0;
  const providers = data?.providers || [];

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">AI Insights Summary</h3>

      <div className="mb-4">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-bold">{totalAIInsights}</span>
          <span className="text-sm text-muted-foreground">AI insights generated</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Avg cost: ${avgAICost.toFixed(4)} per insight
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Providers Used:</p>
        {providers.map((provider: any, index: number) => (
          <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
            <Badge variant="outline">{provider.name}</Badge>
            <span className="text-sm">{provider.count} uses</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
