'use client';

/**
 * Phase 4 Automation Monitoring Dashboard
 *
 * Real-time monitoring and control interface for:
 * - Auto-Dispatch Engine
 * - Dynamic Route Optimizer
 * - Smart Batching Engine
 * - Autonomous Escalation Engine
 */

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import {
  PlayCircle,
  StopCircle,
  Activity,
  TrendingUp,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Users,
  Zap,
} from 'lucide-react';

interface EngineStatus {
  isRunning: boolean;
  initialized: boolean;
}

interface AllEngineStatus {
  autoDispatch: EngineStatus;
  routeOptimizer: EngineStatus;
  smartBatching: EngineStatus;
  escalation: EngineStatus;
}

interface DashboardData {
  engines: {
    autoDispatch: boolean;
    routeOptimizer: boolean;
    smartBatching: boolean;
    escalation: boolean;
  };
  today: {
    dispatch: {
      total_assignments: number;
      auto_assigned: number;
      avg_score: number;
    };
    routes: {
      total_optimizations: number;
      distance_saved_km: number;
      time_saved_minutes: number;
    };
    batching: {
      total_batches: number;
      orders_batched: number;
    };
    escalation: {
      total_escalations: number;
      sla_risk: number;
    };
  };
  alerts: {
    pending: number;
    atRiskOrders: number;
    criticalRiskOrders: number;
  };
  timestamp: string;
}

interface DispatchAlert {
  id: number;
  order_id: number;
  driver_id: number;
  alert_type: string;
  severity: string;
  message: string;
  created_at: string;
  order_number: string;
  customer_name: string;
  driver_name: string;
}

export default function AutomationDashboard() {
  const [engineStatus, setEngineStatus] = useState<AllEngineStatus | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [alerts, setAlerts] = useState<DispatchAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  // Fetch engine status
  const fetchEngineStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/automation/status-all`);
      if (!response.ok) throw new Error('Failed to fetch engine status');
      const data = await response.json();
      setEngineStatus(data);
    } catch (err) {
      console.error('Error fetching engine status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/automation/dashboard`);
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };

  // Fetch alerts
  const fetchAlerts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/automation/escalation/alerts?status=PENDING`);
      if (!response.ok) throw new Error('Failed to fetch alerts');
      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      await Promise.all([fetchEngineStatus(), fetchDashboardData(), fetchAlerts()]);
      setLoading(false);
    };

    fetchAllData();

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchEngineStatus();
      fetchDashboardData();
      fetchAlerts();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Start all engines
  const handleStartAll = async () => {
    setActionLoading('start-all');
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/automation/start-all`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to start engines');
      await fetchEngineStatus();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start engines');
    } finally {
      setActionLoading(null);
    }
  };

  // Stop all engines
  const handleStopAll = async () => {
    setActionLoading('stop-all');
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/automation/stop-all`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to stop engines');
      await fetchEngineStatus();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to stop engines');
    } finally {
      setActionLoading(null);
    }
  };

  // Start individual engine
  const handleStartEngine = async (engine: string) => {
    setActionLoading(`start-${engine}`);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/automation/${engine}/start`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(`Failed to start ${engine}`);
      await fetchEngineStatus();
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to start ${engine}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Stop individual engine
  const handleStopEngine = async (engine: string) => {
    setActionLoading(`stop-${engine}`);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/automation/${engine}/stop`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(`Failed to stop ${engine}`);
      await fetchEngineStatus();
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to stop ${engine}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Resolve alert
  const handleResolveAlert = async (alertId: number) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/automation/escalation/alerts/${alertId}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resolution: 'MANUAL',
            notes: 'Resolved from dashboard',
          }),
        }
      );
      if (!response.ok) throw new Error('Failed to resolve alert');
      await fetchAlerts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resolve alert');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading automation dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <Alert className="bg-red-50 border-red-200">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <p className="text-red-800 ml-2">Error: {error}</p>
        </Alert>
      </div>
    );
  }

  const allEnginesRunning =
    engineStatus?.autoDispatch?.isRunning &&
    engineStatus?.routeOptimizer?.isRunning &&
    engineStatus?.smartBatching?.isRunning &&
    engineStatus?.escalation?.isRunning;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Zap className="w-8 h-8 text-yellow-500" />
                Phase 4 Automation Dashboard
              </h1>
              <p className="text-gray-600 mt-2">
                Real-time monitoring and control for autonomous operations
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleStartAll}
                disabled={allEnginesRunning || actionLoading === 'start-all'}
                className="bg-green-600 hover:bg-green-700"
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                {actionLoading === 'start-all' ? 'Starting...' : 'Start All'}
              </Button>
              <Button
                onClick={handleStopAll}
                disabled={!allEnginesRunning || actionLoading === 'stop-all'}
                variant="outline"
                className="border-red-600 text-red-600 hover:bg-red-50"
              >
                <StopCircle className="w-4 h-4 mr-2" />
                {actionLoading === 'stop-all' ? 'Stopping...' : 'Stop All'}
              </Button>
            </div>
          </div>
        </div>

        {/* Critical Alerts Banner */}
        {dashboardData && dashboardData.alerts.criticalRiskOrders > 0 && (
          <Alert className="mb-6 bg-red-50 border-red-200">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div className="ml-2">
              <p className="font-semibold text-red-900">Critical SLA Risk Detected</p>
              <p className="text-red-700 text-sm">
                {dashboardData.alerts.criticalRiskOrders} orders at critical risk of SLA breach
                (&lt;15 minutes)
              </p>
            </div>
          </Alert>
        )}

        {/* Engine Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Auto-Dispatch Engine */}
          <Card className="p-6 border-2 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Auto-Dispatch</h3>
              </div>
              {engineStatus?.autoDispatch?.isRunning ? (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Running
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                  <XCircle className="w-3 h-3 mr-1" />
                  Stopped
                </Badge>
              )}
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Today's Assignments:</span>
                <span className="font-semibold">
                  {dashboardData?.today?.dispatch?.total_assignments || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Auto-Assigned:</span>
                <span className="font-semibold">
                  {dashboardData?.today?.dispatch?.auto_assigned || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Avg Score:</span>
                <span className="font-semibold">
                  {dashboardData?.today?.dispatch?.avg_score?.toFixed(1) || '0.0'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {engineStatus?.autoDispatch?.isRunning ? (
                <Button
                  onClick={() => handleStopEngine('dispatch')}
                  disabled={actionLoading === 'stop-dispatch'}
                  size="sm"
                  variant="outline"
                  className="flex-1 border-red-600 text-red-600"
                >
                  <StopCircle className="w-3 h-3 mr-1" />
                  Stop
                </Button>
              ) : (
                <Button
                  onClick={() => handleStartEngine('dispatch')}
                  disabled={actionLoading === 'start-dispatch'}
                  size="sm"
                  className="flex-1 bg-green-600"
                >
                  <PlayCircle className="w-3 h-3 mr-1" />
                  Start
                </Button>
              )}
            </div>
          </Card>

          {/* Route Optimizer */}
          <Card className="p-6 border-2 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-gray-900">Route Optimizer</h3>
              </div>
              {engineStatus?.routeOptimizer?.isRunning ? (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Running
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                  <XCircle className="w-3 h-3 mr-1" />
                  Stopped
                </Badge>
              )}
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Optimizations:</span>
                <span className="font-semibold">
                  {dashboardData?.today?.routes?.total_optimizations || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Distance Saved:</span>
                <span className="font-semibold">
                  {dashboardData?.today?.routes?.distance_saved_km?.toFixed(1) || '0.0'} km
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Time Saved:</span>
                <span className="font-semibold">
                  {dashboardData?.today?.routes?.time_saved_minutes?.toFixed(0) || 0} min
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {engineStatus?.routeOptimizer?.isRunning ? (
                <Button
                  onClick={() => handleStopEngine('routes')}
                  disabled={actionLoading === 'stop-routes'}
                  size="sm"
                  variant="outline"
                  className="flex-1 border-red-600 text-red-600"
                >
                  <StopCircle className="w-3 h-3 mr-1" />
                  Stop
                </Button>
              ) : (
                <Button
                  onClick={() => handleStartEngine('routes')}
                  disabled={actionLoading === 'start-routes'}
                  size="sm"
                  className="flex-1 bg-green-600"
                >
                  <PlayCircle className="w-3 h-3 mr-1" />
                  Start
                </Button>
              )}
            </div>
          </Card>

          {/* Smart Batching */}
          <Card className="p-6 border-2 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900">Smart Batching</h3>
              </div>
              {engineStatus?.smartBatching?.isRunning ? (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Running
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                  <XCircle className="w-3 h-3 mr-1" />
                  Stopped
                </Badge>
              )}
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Batches Created:</span>
                <span className="font-semibold">
                  {dashboardData?.today?.batching?.total_batches || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Orders Batched:</span>
                <span className="font-semibold">
                  {dashboardData?.today?.batching?.orders_batched || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Avg Batch Size:</span>
                <span className="font-semibold">
                  {dashboardData?.today?.batching?.total_batches
                    ? (
                        (dashboardData?.today?.batching?.orders_batched || 0) /
                        dashboardData?.today?.batching?.total_batches
                      ).toFixed(1)
                    : '0.0'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {engineStatus?.smartBatching?.isRunning ? (
                <Button
                  onClick={() => handleStopEngine('batching')}
                  disabled={actionLoading === 'stop-batching'}
                  size="sm"
                  variant="outline"
                  className="flex-1 border-red-600 text-red-600"
                >
                  <StopCircle className="w-3 h-3 mr-1" />
                  Stop
                </Button>
              ) : (
                <Button
                  onClick={() => handleStartEngine('batching')}
                  disabled={actionLoading === 'start-batching'}
                  size="sm"
                  className="flex-1 bg-green-600"
                >
                  <PlayCircle className="w-3 h-3 mr-1" />
                  Start
                </Button>
              )}
            </div>
          </Card>

          {/* Autonomous Escalation */}
          <Card className="p-6 border-2 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="font-semibold text-gray-900">Escalation</h3>
              </div>
              {engineStatus?.escalation?.isRunning ? (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Running
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                  <XCircle className="w-3 h-3 mr-1" />
                  Stopped
                </Badge>
              )}
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Escalations:</span>
                <span className="font-semibold">
                  {dashboardData?.today?.escalation?.total_escalations || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">SLA Risks:</span>
                <span className="font-semibold text-red-600">
                  {dashboardData?.today?.escalation?.sla_risk || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Pending Alerts:</span>
                <span className="font-semibold">
                  {dashboardData?.alerts?.pending || 0}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {engineStatus?.escalation?.isRunning ? (
                <Button
                  onClick={() => handleStopEngine('escalation')}
                  disabled={actionLoading === 'stop-escalation'}
                  size="sm"
                  variant="outline"
                  className="flex-1 border-red-600 text-red-600"
                >
                  <StopCircle className="w-3 h-3 mr-1" />
                  Stop
                </Button>
              ) : (
                <Button
                  onClick={() => handleStartEngine('escalation')}
                  disabled={actionLoading === 'start-escalation'}
                  size="sm"
                  className="flex-1 bg-green-600"
                >
                  <PlayCircle className="w-3 h-3 mr-1" />
                  Start
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Active Alerts */}
        {alerts.length > 0 && (
          <Card className="p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              Active Alerts ({alerts.length})
            </h2>
            <div className="space-y-3">
              {alerts.slice(0, 10).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        className={
                          alert.severity === 'CRITICAL'
                            ? 'bg-red-100 text-red-800 border-red-200'
                            : alert.severity === 'HIGH'
                              ? 'bg-orange-100 text-orange-800 border-orange-200'
                              : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                        }
                      >
                        {alert.severity}
                      </Badge>
                      <span className="font-semibold text-gray-900">{alert.alert_type}</span>
                    </div>
                    <p className="text-sm text-gray-700 mb-1">{alert.message}</p>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>Order: {alert.order_number}</span>
                      <span>Customer: {alert.customer_name}</span>
                      {alert.driver_name && <span>Driver: {alert.driver_name}</span>}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleResolveAlert(alert.id)}
                    size="sm"
                    className="bg-blue-600"
                  >
                    Resolve
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Statistics Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Efficiency Gains
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Distance Saved Today</p>
                <p className="text-2xl font-bold text-green-600">
                  {dashboardData?.today?.routes?.distance_saved_km?.toFixed(1) || '0.0'} km
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Time Saved Today</p>
                <p className="text-2xl font-bold text-green-600">
                  {dashboardData?.today?.routes?.time_saved_minutes?.toFixed(0) || 0} min
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Operations Summary
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Auto Assignments</p>
                <p className="text-2xl font-bold text-blue-600">
                  {dashboardData?.today?.dispatch?.auto_assigned || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Batches Created</p>
                <p className="text-2xl font-bold text-blue-600">
                  {dashboardData?.today?.batching?.total_batches || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              Risk Monitor
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">At-Risk Orders</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {dashboardData?.alerts?.atRiskOrders || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Critical Risk</p>
                <p className="text-2xl font-bold text-red-600">
                  {dashboardData?.alerts?.criticalRiskOrders || 0}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Last updated: {dashboardData?.timestamp ? new Date(dashboardData.timestamp).toLocaleString() : 'Never'}
          </p>
          <p>Auto-refresh every 10 seconds</p>
        </div>
      </div>
    </div>
  );
}
