'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  Loader2,
  MemoryStick,
  Server,
  TrendingUp,
  Users,
  Zap,
  AlertTriangle,
  XCircle,
  Info,
} from 'lucide-react';
import type {
  SystemHealth,
  ActiveOptimization,
  LiveMetrics,
  RecentActivity,
  PerformanceGauges,
} from '@/hooks/useRealtimeMetrics';

// Pulse animation for live indicators
const PulseDot = ({ status }: { status: 'online' | 'offline' | 'degraded' }) => {
  const colors = {
    online: 'bg-green-500',
    offline: 'bg-red-500',
    degraded: 'bg-yellow-500',
  };

  return (
    <span className="relative flex h-3 w-3">
      <span
        className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors[status]} opacity-75`}
      />
      <span className={`relative inline-flex rounded-full h-3 w-3 ${colors[status]}`} />
    </span>
  );
};

// System Health Card
export function SystemHealthCard({ data }: { data: SystemHealth }) {
  const statusColors = {
    online: 'text-green-600',
    offline: 'text-red-600',
    degraded: 'text-yellow-600',
  };

  const statusLabels = {
    online: 'All Systems Operational',
    offline: 'System Offline',
    degraded: 'Degraded Performance',
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          <h3 className="text-lg font-semibold">System Health</h3>
        </div>
        <PulseDot status={data.api_status} />
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-lg font-bold ${statusColors[data.api_status]}`}>
              {statusLabels[data.api_status]}
            </span>
            {data.api_status === 'online' && <CheckCircle className="h-5 w-5 text-green-600" />}
            {data.api_status === 'offline' && <XCircle className="h-5 w-5 text-red-600" />}
            {data.api_status === 'degraded' && (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Response Time</p>
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-bold">{data.response_time_ms}</p>
              <span className="text-xs text-muted-foreground">ms</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Error Rate</p>
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-bold">{data.error_rate.toFixed(1)}</p>
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Last checked</span>
            <span>{new Date(data.last_check).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Active Optimizations Card
export function ActiveOptimizationsCard({ data }: { data: ActiveOptimization[] }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing':
        return 'bg-blue-600';
      case 'pending':
        return 'bg-yellow-600';
      case 'completed':
        return 'bg-green-600';
      case 'failed':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Active Optimizations</h3>
        </div>
        <Badge variant={data.length > 0 ? 'default' : 'secondary'}>{data.length}</Badge>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">No active optimizations</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {data.map((opt) => (
            <div key={opt.requestId} className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(opt.status)}
                  <span className="text-sm font-medium">
                    {opt.engine || 'Default Engine'}
                  </span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {opt.status}
                </Badge>
              </div>

              {opt.status === 'processing' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{opt.progress}%</span>
                  </div>
                  <Progress value={opt.progress} className="h-1" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{opt.vehicleCount || 0} vehicles</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  <span>{opt.locationCount || 0} locations</span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Started {new Date(opt.created_at).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// Live Metrics Card
export function LiveMetricsCard({ data }: { data: LiveMetrics }) {
  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Zap className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Live Metrics</h3>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Requests/min</p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-bold">{data.requests_per_minute}</p>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Active Users</p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-bold">{data.active_users}</p>
            <Users className="h-4 w-4 text-blue-600" />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Queue Depth</p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-bold">{data.queue_depth}</p>
            <Database className="h-4 w-4 text-yellow-600" />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Avg Response</p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-bold">{data.avg_response_time.toFixed(2)}</p>
            <span className="text-xs text-muted-foreground">s</span>
          </div>
        </div>

        <div className="space-y-1 col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Success Rate</p>
            <span className={`text-lg font-bold ${getSuccessRateColor(data.success_rate)}`}>
              {data.success_rate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                data.success_rate >= 95
                  ? 'bg-green-600'
                  : data.success_rate >= 85
                    ? 'bg-yellow-600'
                    : 'bg-red-600'
              }`}
              style={{ width: `${data.success_rate}%` }}
            />
          </div>
        </div>

        {data.error_count > 0 && (
          <div className="col-span-2 p-3 bg-red-50 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <p className="text-sm text-red-900">
                <span className="font-bold">{data.error_count}</span> errors in the last period
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// Performance Gauges Card
export function PerformanceGaugesCard({ data }: { data: PerformanceGauges }) {
  const getGaugeColor = (value: number, thresholds = { warning: 70, danger: 90 }) => {
    if (value >= thresholds.danger) return 'bg-red-600';
    if (value >= thresholds.warning) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  const GaugeBar = ({
    label,
    value,
    unit,
    icon: Icon,
  }: {
    label: string;
    value: number;
    unit: string;
    icon: any;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <span className="text-sm font-bold">
          {value.toFixed(0)}
          {unit}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${getGaugeColor(value)}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Performance Gauges</h3>
      </div>

      <div className="space-y-4">
        {data.cpu_usage !== undefined && (
          <GaugeBar label="CPU Usage" value={data.cpu_usage} unit="%" icon={Cpu} />
        )}

        {data.memory_usage !== undefined && (
          <GaugeBar label="Memory Usage" value={data.memory_usage} unit="%" icon={MemoryStick} />
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">API Latency</span>
            </div>
            <span className="text-sm font-bold">{data.api_latency}ms</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getGaugeColor(
                data.api_latency / 10,
                { warning: 50, danger: 100 }
              )}`}
              style={{ width: `${Math.min((data.api_latency / 1000) * 100, 100)}%` }}
            />
          </div>
        </div>

        <div className="p-3 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Active Connections</span>
            </div>
            <span className="text-2xl font-bold">{data.active_connections}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Recent Activity Feed Card
export function RecentActivityCard({ data }: { data: RecentActivity[] }) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'optimization':
        return <Activity className="h-4 w-4 text-blue-600" />;
      default:
        return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'optimization':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Recent Activity</h3>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {data.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No recent activity</p>
          </div>
        ) : (
          data.map((activity) => (
            <div
              key={activity.id}
              className={`p-3 border rounded-lg ${getActivityColor(activity.type)}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{activity.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </span>
                    {activity.metadata?.engine && (
                      <Badge variant="outline" className="text-xs">
                        {activity.metadata.engine}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
