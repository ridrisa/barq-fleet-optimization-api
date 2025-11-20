'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaDatabase,
  FaRobot,
  FaChartLine,
  FaServer,
  FaNetworkWired,
  FaRefresh,
  FaClock,
  FaBolt,
  FaExclamationCircle,
  FaInfoCircle,
} from 'react-icons/fa';

interface ErrorMetrics {
  window: string;
  totalErrors: number;
  errorRate: string;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  byStatusCode: Record<string, number>;
  topErrors: Array<{
    category: string;
    severity: string;
    errorCode?: string;
    statusCode?: number;
    message: string;
    count: number;
    lastOccurred: string;
  }>;
  recentErrors: Array<any>;
}

interface DashboardData {
  summary: {
    totalErrors: number;
    last5min: number;
    last1hour: number;
    last24hour: number;
    errorRate: string;
    uptime: number;
  };
  metrics: {
    '5min': ErrorMetrics;
    '1hour': ErrorMetrics;
    '24hour': ErrorMetrics;
  };
  trends: Array<{
    timestamp: string;
    count: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }>;
  categoryBreakdown: Record<
    string,
    {
      total: number;
      critical: number;
      high: number;
      healthScore: number;
      status: string;
    }
  >;
  recentErrors: Array<any>;
  alerts: Array<{
    type: string;
    severity: string;
    message: string;
    active: boolean;
    since?: string;
  }>;
}

interface ComponentHealth {
  status: string;
  score: number;
  details?: any;
  error?: string;
}

interface SystemHealth {
  timestamp: string;
  components: {
    database?: ComponentHealth;
    agents?: ComponentHealth;
    analytics?: ComponentHealth;
    websocket?: ComponentHealth;
    errorMonitoring?: ComponentHealth;
  };
  overallStatus: string;
  overallScore: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

export default function MonitoringDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedTimeWindow, setSelectedTimeWindow] = useState<'5min' | '1hour' | '24hour'>(
    '1hour'
  );

  const fetchDashboardData = async () => {
    try {
      const [dashResponse, healthResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/monitoring/dashboard`),
        fetch(`${API_BASE_URL}/api/v1/monitoring/health`),
      ]);

      if (dashResponse.ok) {
        const dashData = await dashResponse.json();
        setDashboardData(dashData.data);
      }

      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        setSystemHealth(healthData.data);
      }

      setLastUpdate(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    if (autoRefresh) {
      const interval = setInterval(fetchDashboardData, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'text-red-600 bg-red-50';
      case 'high':
        return 'text-orange-600 bg-orange-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
        return <FaCheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <FaExclamationTriangle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
        return <FaTimesCircle className="h-5 w-5 text-red-500" />;
      default:
        return <FaInfoCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'database':
        return <FaDatabase className="h-4 w-4" />;
      case 'agent':
      case 'agents':
        return <FaRobot className="h-4 w-4" />;
      case 'analytics':
        return <FaChartLine className="h-4 w-4" />;
      case 'websocket':
        return <FaNetworkWired className="h-4 w-4" />;
      case 'api':
      case 'system':
        return <FaServer className="h-4 w-4" />;
      default:
        return <FaExclamationCircle className="h-4 w-4" />;
    }
  };

  if (loading || !dashboardData || !systemHealth) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading monitoring dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  const currentMetrics = dashboardData.metrics[selectedTimeWindow];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Error Monitoring Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Real-time system health and error tracking
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            <FaClock className="inline mr-1" />
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDashboardData()}
            disabled={loading}
          >
            <FaRefresh className="mr-2" />
            Refresh
          </Button>
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <FaBolt className="mr-2" />
            {autoRefresh ? 'Auto' : 'Manual'}
          </Button>
        </div>
      </div>

      {/* Active Alerts */}
      {dashboardData.alerts && dashboardData.alerts.length > 0 && (
        <Alert variant="destructive">
          <FaExclamationTriangle className="h-4 w-4" />
          <AlertTitle>Active Alerts ({dashboardData.alerts.length})</AlertTitle>
          <AlertDescription>
            {dashboardData.alerts.map((alert, index) => (
              <div key={index} className="mt-2">
                <strong>{alert.type}:</strong> {alert.message}
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Overall Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                {getStatusIcon(systemHealth.overallStatus)}
                <p className="text-xs text-gray-600 mt-1 capitalize">
                  {systemHealth.overallStatus}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{systemHealth.overallScore}</p>
                <p className="text-xs text-gray-600">Health Score</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Last 5 Min</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.summary.last5min}</div>
            <p className="text-xs text-gray-600">errors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Last Hour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.summary.last1hour}</div>
            <p className="text-xs text-gray-600">errors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Last 24 Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.summary.last24hour}</div>
            <p className="text-xs text-gray-600">errors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.summary.errorRate}</div>
            <p className="text-xs text-gray-600">errors/min</p>
          </CardContent>
        </Card>
      </div>

      {/* System Health Components */}
      <Card>
        <CardHeader>
          <CardTitle>System Components Health</CardTitle>
          <CardDescription>Health status of all system components</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {Object.entries(systemHealth.components).map(([name, component]) => (
              <div key={name} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium capitalize">{name}</span>
                  {getStatusIcon(component.status)}
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold">{component.score}</div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        component.score >= 80
                          ? 'bg-green-500'
                          : component.score >= 50
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${component.score}%` }}
                    ></div>
                  </div>
                  {component.error && (
                    <p className="text-xs text-red-600 mt-1">{component.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error Breakdown by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Error Breakdown by Category</CardTitle>
          <CardDescription>Last hour error distribution and health scores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(dashboardData.categoryBreakdown)
              .filter(([_, data]) => data.total > 0)
              .map(([category, data]) => (
                <div key={category} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(category)}
                      <span className="text-sm font-medium capitalize">{category}</span>
                    </div>
                    <Badge
                      variant={
                        data.status === 'healthy'
                          ? 'default'
                          : data.status === 'degraded'
                            ? 'secondary'
                            : 'destructive'
                      }
                    >
                      {data.status}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold">{data.total}</div>
                    <div className="flex justify-between text-xs">
                      <span className="text-red-600">Critical: {data.critical}</span>
                      <span className="text-orange-600">High: {data.high}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          data.healthScore >= 80
                            ? 'bg-green-500'
                            : data.healthScore >= 50
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${data.healthScore}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics Tabs */}
      <Tabs value={selectedTimeWindow} onValueChange={(v: any) => setSelectedTimeWindow(v)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="5min">Last 5 Minutes</TabsTrigger>
          <TabsTrigger value="1hour">Last Hour</TabsTrigger>
          <TabsTrigger value="24hour">Last 24 Hours</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTimeWindow} className="space-y-4">
          {/* Metrics Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Total Errors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{currentMetrics.totalErrors}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Error Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{currentMetrics.errorRate}</div>
                <p className="text-xs text-gray-600">errors/min</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">By Severity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {Object.entries(currentMetrics.bySeverity).map(([severity, count]) => (
                    <div key={severity} className="flex justify-between text-sm">
                      <span className="capitalize">{severity}:</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Errors */}
          {currentMetrics.topErrors && currentMetrics.topErrors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Recurring Errors</CardTitle>
                <CardDescription>Most frequent errors in this time window</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {currentMetrics.topErrors.slice(0, 10).map((error, index) => (
                    <div
                      key={index}
                      className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 rounded"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            className={getSeverityColor(error.severity)}
                          >
                            {error.severity}
                          </Badge>
                          <Badge variant="outline">{error.category}</Badge>
                          {error.statusCode && (
                            <Badge variant="secondary">{error.statusCode}</Badge>
                          )}
                        </div>
                        <span className="text-sm font-bold text-red-600">
                          {error.count}x
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{error.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Last occurred: {new Date(error.lastOccurred).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Errors */}
          {dashboardData.recentErrors && dashboardData.recentErrors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Errors</CardTitle>
                <CardDescription>Latest 20 errors across all categories</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {dashboardData.recentErrors.map((error, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge className={getSeverityColor(error.severity)}>
                            {error.severity}
                          </Badge>
                          <Badge variant="outline">{error.category}</Badge>
                          {error.statusCode && (
                            <Badge variant="secondary">{error.statusCode}</Badge>
                          )}
                          {error.errorCode && (
                            <Badge variant="outline">{error.errorCode}</Badge>
                          )}
                        </div>
                        <span className="text-xs text-gray-600">
                          {new Date(error.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-1">{error.message}</p>
                      {error.path && (
                        <p className="text-xs text-gray-500">
                          {error.method} {error.path}
                        </p>
                      )}
                      {error.agentName && (
                        <p className="text-xs text-gray-500">Agent: {error.agentName}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Uptime:</span>
              <span className="ml-2 font-medium">
                {formatUptime(dashboardData.summary.uptime)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Total Errors Tracked:</span>
              <span className="ml-2 font-medium">{dashboardData.summary.totalErrors}</span>
            </div>
            <div>
              <span className="text-gray-600">Active Alerts:</span>
              <span className="ml-2 font-medium">{dashboardData.alerts.length}</span>
            </div>
            <div>
              <span className="text-gray-600">Last Updated:</span>
              <span className="ml-2 font-medium">{lastUpdate.toLocaleTimeString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
