'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api-client';
import {
  Activity,
  Brain,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Settings,
  BarChart3,
  Users,
  MapPin,
  RefreshCw,
} from 'lucide-react';

interface AutonomousStatus {
  orchestrator: string;
  actionAuth: string;
  autonomousMode: boolean;
  pendingApprovals: number;
  learningRecords: number;
}

interface RecentAction {
  actionId: string;
  timestamp: string;
  action: string;
  orderId?: string;
  agent: string;
  status: string;
  level: number;
  confidence: number;
  outcome?: Record<string, unknown>;
}

interface DashboardData {
  autonomousMode: boolean;
  config: Record<string, unknown>;
  currentIntelligence: Record<string, unknown>;
  executionStats: Record<string, unknown>;
  learningInsights: Array<Record<string, unknown>>;
  lastCycle: Record<string, unknown>;
}

export default function AutonomousOperations() {
  const [health, setHealth] = useState<AutonomousStatus | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [recentActions, setRecentActions] = useState<RecentAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Type alias to bypass strict typing on dynamic dashboard data
  const typedDashboard = dashboard as any;

  const fetchData = async () => {
    try {
      const [healthData, dashboardData, actionsData] = await Promise.all([
        apiClient.get('/api/autonomous/health'),
        apiClient.get('/api/autonomous/dashboard'),
        apiClient.get('/api/autonomous/actions/recent?limit=20'),
      ]);

      if (healthData) {
        setHealth(healthData.data);
      }

      if (dashboardData) {
        setDashboard(dashboardData.data);
      }

      if (actionsData) {
        setRecentActions(actionsData.data || []);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch autonomous data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const toggleAutonomousMode = async () => {
    try {
      await apiClient.post('/api/autonomous/mode', {
        enabled: !dashboard?.autonomousMode,
      });

      fetchData();
    } catch (error) {
      console.error('Failed to toggle autonomous mode:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'READY':
        return 'bg-green-500';
      case 'EXECUTED':
        return 'bg-blue-500';
      case 'ESCALATED':
        return 'bg-yellow-500';
      case 'DENIED':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'REASSIGN_ORDER':
        return <MapPin className="h-4 w-4" />;
      case 'NOTIFY_CUSTOMER':
        return <Users className="h-4 w-4" />;
      case 'REBALANCE_FLEET':
        return <Activity className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading Autonomous Operations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-purple-500" />
            Autonomous Operations
          </h1>
          <p className="text-muted-foreground mt-1">AI-powered fleet management and optimization</p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => setAutoRefresh(!autoRefresh)}>
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* System Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Badge className={health?.orchestrator === 'READY' ? 'bg-green-500' : 'bg-red-500'}>
                  {health?.orchestrator || 'UNKNOWN'}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Orchestrator</p>
              </div>
              {health?.orchestrator === 'READY' ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : (
                <XCircle className="h-8 w-8 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Autonomous Mode */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Autonomous Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Badge className={dashboard?.autonomousMode ? 'bg-blue-500' : 'bg-gray-500'}>
                  {dashboard?.autonomousMode ? 'ENABLED' : 'DISABLED'}
                </Badge>
                <Button
                  size="sm"
                  variant="link"
                  className="text-xs p-0 h-auto mt-1"
                  onClick={toggleAutonomousMode}
                >
                  {dashboard?.autonomousMode ? 'Disable' : 'Enable'}
                </Button>
              </div>
              <Activity
                className={`h-8 w-8 ${dashboard?.autonomousMode ? 'text-blue-500 animate-pulse' : 'text-gray-400'}`}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions Today */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Actions Executed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {(dashboard?.executionStats?.total as number) || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {(((dashboard?.executionStats?.successRate as number) || 0) * 100).toFixed(0)}%
                  success rate
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{health?.pendingApprovals || 0}</div>
                <p className="text-xs text-muted-foreground">Level 3 actions</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="intelligence" className="space-y-4">
        <TabsList>
          <TabsTrigger value="intelligence">
            <Brain className="h-4 w-4 mr-2" />
            Intelligence
          </TabsTrigger>
          <TabsTrigger value="actions">
            <Activity className="h-4 w-4 mr-2" />
            Recent Actions
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="h-4 w-4 mr-2" />
            Statistics
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
        </TabsList>

        {/* Intelligence Tab */}
        <TabsContent value="intelligence" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Fleet Intelligence */}
            <Card>
              <CardHeader>
                <CardTitle>Fleet Status</CardTitle>
                <CardDescription>Real-time fleet availability</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard?.currentIntelligence?.fleet ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Available Drivers</span>
                      <Badge variant="outline">
                        {(dashboard.currentIntelligence as any).fleet.available?.length || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Busy Drivers</span>
                      <Badge variant="outline">
                        {(dashboard.currentIntelligence as any).fleet.busy?.length || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Total Capacity</span>
                      <Badge>{(dashboard.currentIntelligence as any).fleet.total || 0}</Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No fleet data available</p>
                )}
              </CardContent>
            </Card>

            {/* SLA Intelligence */}
            <Card>
              <CardHeader>
                <CardTitle>SLA Compliance</CardTitle>
                <CardDescription>Orders at risk analysis</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard?.currentIntelligence?.sla ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">At Risk</span>
                      <Badge variant="outline" className="bg-yellow-100">
                        {(dashboard.currentIntelligence as any).sla.atRisk?.length || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Critical</span>
                      <Badge variant="destructive">
                        {(dashboard.currentIntelligence as any).sla.critical?.length || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Total Monitored</span>
                      <Badge>{(dashboard.currentIntelligence as any).sla.total || 0}</Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No SLA data available</p>
                )}
              </CardContent>
            </Card>

            {/* Demand Intelligence */}
            <Card>
              <CardHeader>
                <CardTitle>Demand Forecast</CardTitle>
                <CardDescription>Current order patterns</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard?.currentIntelligence?.demand ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Orders/Hour</span>
                      <Badge variant="outline">
                        {(dashboard.currentIntelligence as any).demand.ordersPerHour || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">BARQ Orders</span>
                      <Badge variant="outline">
                        {(dashboard.currentIntelligence as any).demand.currentRate?.barq || 0}/hr
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">BULLET Orders</span>
                      <Badge variant="outline">
                        {(dashboard.currentIntelligence as any).demand.currentRate?.bullet || 0}/hr
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Trend</span>
                      <Badge>
                        {(dashboard.currentIntelligence as any).demand.trend || 'stable'}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No demand data available</p>
                )}
              </CardContent>
            </Card>

            {/* Traffic Intelligence */}
            <Card>
              <CardHeader>
                <CardTitle>Traffic Conditions</CardTitle>
                <CardDescription>Real-time traffic analysis</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard?.currentIntelligence?.traffic ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Overall Condition</span>
                      <Badge
                        className={
                          (dashboard.currentIntelligence as any).traffic.overallCondition ===
                          'NORMAL'
                            ? 'bg-green-500'
                            : (dashboard.currentIntelligence as any).traffic.overallCondition ===
                                'MODERATE'
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }
                      >
                        {(dashboard.currentIntelligence as any).traffic.overallCondition ||
                          'NORMAL'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Congestion Level</span>
                      <Badge variant="outline">
                        {(dashboard.currentIntelligence as any).traffic.congestionLevel || 0}%
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Affected Areas</span>
                      <Badge variant="outline">
                        {(dashboard.currentIntelligence as any).traffic.affectedAreas?.length || 0}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No traffic data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Recent Actions Tab */}
        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Autonomous Actions</CardTitle>
              <CardDescription>Actions taken by AI agents in the last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              {recentActions.length > 0 ? (
                <div className="space-y-3">
                  {recentActions.map((action) => (
                    <div
                      key={action.actionId}
                      className="flex items-start justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-2 rounded-full ${getStatusColor(action.status)}`}>
                          {getActionIcon(action.action)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">
                              {action.action.replace(/_/g, ' ')}
                            </p>
                            <Badge variant="outline" className="text-xs">
                              Level {action.level}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Agent: {action.agent}
                            {action.orderId && ` • Order: ${action.orderId}`}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(action.timestamp).toLocaleTimeString()}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {(action.confidence * 100).toFixed(0)}% confidence
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Badge className={getStatusColor(action.status)}>{action.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No autonomous actions recorded yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Actions by Level</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Level 1 (Auto)</span>
                    <Badge>{(dashboard as any)?.executionStats?.byLevel?.['1'] || 0}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Level 2 (Validated)</span>
                    <Badge>{(dashboard as any)?.executionStats?.byLevel?.['2'] || 0}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Level 3 (Approval)</span>
                    <Badge>{(dashboard as any)?.executionStats?.byLevel?.['3'] || 0}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Execution Outcome</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Successful</span>
                    <Badge className="bg-green-500">
                      {typedDashboard?.executionStats?.byOutcome?.success || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Failed</span>
                    <Badge variant="destructive">
                      {typedDashboard?.executionStats?.byOutcome?.failure || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Success Rate</span>
                    <Badge variant="outline">
                      {((typedDashboard?.executionStats?.successRate || 0) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Learning Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Total Records</span>
                    <Badge>{health?.learningRecords || 0}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Insights Generated</span>
                    <Badge>{typedDashboard?.learningInsights?.length || 0}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Autonomous Configuration</CardTitle>
              <CardDescription>System parameters and thresholds</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Execution Settings</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Confidence Threshold</span>
                      <Badge variant="outline">
                        {(typedDashboard?.config?.confidenceThreshold || 0) * 100}%
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Max Concurrent Actions</span>
                      <Badge variant="outline">
                        {typedDashboard?.config?.maxConcurrentActions || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Learning Enabled</span>
                      <Badge
                        className={
                          typedDashboard?.config?.enableLearning ? 'bg-green-500' : 'bg-gray-500'
                        }
                      >
                        {typedDashboard?.config?.enableLearning ? 'YES' : 'NO'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Last Cycle</h4>
                  <div className="space-y-2">
                    {dashboard?.lastCycle ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sm">Status</span>
                          <Badge className="bg-green-500">
                            {(dashboard as any).lastCycle.cycle}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Actions Planned</span>
                          <Badge variant="outline">
                            {(dashboard as any).lastCycle.actionsPlanned || 0}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Actions Executed</span>
                          <Badge variant="outline">
                            {(dashboard as any).lastCycle.actionsExecuted || 0}
                          </Badge>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No cycle data available</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
