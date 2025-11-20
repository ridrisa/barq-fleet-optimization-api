'use client';

import React, { useState, useCallback } from 'react';
import {
  Agent,
  AgentActivity,
  AgentStatusResponse,
  SystemHealth,
  DashboardFilters,
  AgentControlRequest,
  AgentConfiguration,
  AgentLogEntry,
} from '@/types/agent';
import { AgentCard } from '@/components/admin/AgentCard';
import { AgentActivityLog } from '@/components/admin/AgentActivityLog';
import { HealthScoreGauge } from '@/components/admin/HealthScoreGauge';
import { AgentConfigModal } from '@/components/admin/AgentConfigModal';
import { AgentLogsModal } from '@/components/admin/AgentLogsModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import agentControlAPI from '@/lib/agent-control-api';
import { useRealtimeAgentStatus } from '@/hooks/useRealtimeAgentStatus';
import {
  Activity,
  RefreshCw,
  Search,
  Server,
  AlertCircle,
  Filter,
  TrendingUp,
  Users,
  Brain,
  ArrowRight,
  Wifi,
  WifiOff,
  Settings,
  Play,
  Square,
  RotateCcw,
} from 'lucide-react';
import Link from 'next/link';

export default function AgentMonitoringDashboard() {
  const [recentActivity, setRecentActivity] = useState<AgentActivity[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filters, setFilters] = useState<DashboardFilters>({
    search: '',
    status: [],
    sortBy: 'name',
    sortOrder: 'asc',
  });

  // Modal states
  const [configModalAgent, setConfigModalAgent] = useState<Agent | null>(null);
  const [logsModalAgent, setLogsModalAgent] = useState<Agent | null>(null);
  
  // Control operations state
  const [operatingAgents, setOperatingAgents] = useState<Set<string>>(new Set());

  // Use real-time agent status hook
  const {
    agents,
    systemHealth,
    isConnected,
    isLoading: loading,
    error,
    lastUpdate,
    refreshData,
    startPolling,
    stopPolling,
  } = useRealtimeAgentStatus({
    pollingInterval: 5000,
    enablePolling: autoRefresh,
    onStatusChange: (newAgents) => {
      // Update any additional processing when agents change
      console.log('Agent status updated:', newAgents.length, 'agents');
    },
    onHealthChange: (newHealth) => {
      console.log('System health updated:', newHealth.overall);
    },
    onError: (err) => {
      console.error('Real-time status error:', err.message);
    },
  });

  // Handle auto-refresh toggle
  const handleAutoRefreshToggle = () => {
    const newAutoRefresh = !autoRefresh;
    setAutoRefresh(newAutoRefresh);
    
    if (newAutoRefresh) {
      startPolling();
    } else {
      stopPolling();
    }
  };

  const setMockData = () => {
    // Mock data for development/testing
    const mockAgents: Agent[] = [
      {
        id: '1',
        name: 'Master Orchestrator',
        description: 'Coordinates all AI agents and manages workflow execution',
        status: 'ACTIVE',
        lastRun: new Date(Date.now() - 120000).toISOString(),
        lastDuration: 250,
        healthScore: 0.95,
        successRate: 0.98,
        totalExecutions: 1543,
        failedExecutions: 31,
        averageDuration: 245,
        errors: [],
        enabled: true,
        category: 'Orchestration',
        isControllable: true,
        canRestart: true,
        canConfigure: true,
        configuration: {
          executionInterval: 5000,
          timeout: 30000,
          retryLimit: 3,
          priority: 1,
        },
      },
      {
        id: '2',
        name: 'Route Optimization',
        description: 'Optimizes delivery routes using AI algorithms',
        status: 'ACTIVE',
        lastRun: new Date(Date.now() - 30000).toISOString(),
        lastDuration: 1200,
        healthScore: 0.92,
        successRate: 0.95,
        totalExecutions: 3421,
        failedExecutions: 171,
        averageDuration: 1150,
        errors: [],
        enabled: true,
        category: 'Optimization',
        isControllable: true,
        canRestart: true,
        canConfigure: true,
        configuration: {
          executionInterval: 10000,
          timeout: 60000,
          retryLimit: 2,
          priority: 2,
          maxRoutes: 50,
          optimizationDepth: 3,
        },
      },
      {
        id: '3',
        name: 'Fleet Rebalancer',
        description: 'Rebalances fleet distribution across zones',
        status: 'ERROR',
        lastRun: new Date(Date.now() - 300000).toISOString(),
        lastDuration: 450,
        healthScore: 0.45,
        successRate: 0.67,
        totalExecutions: 892,
        failedExecutions: 294,
        averageDuration: 425,
        errors: [
          {
            timestamp: new Date(Date.now() - 300000).toISOString(),
            message: 'Fleet capacity calculation failed: Invalid zone configuration',
            severity: 'HIGH',
          },
          {
            timestamp: new Date(Date.now() - 600000).toISOString(),
            message: 'Connection timeout to fleet database',
            severity: 'MEDIUM',
          },
        ],
        enabled: true,
        category: 'Fleet Management',
        isControllable: true,
        canRestart: true,
        canConfigure: true,
        configuration: {
          executionInterval: 15000,
          timeout: 45000,
          retryLimit: 4,
          priority: 3,
          balanceThreshold: 75,
          maxMovements: 10,
        },
      },
      {
        id: '4',
        name: 'Demand Forecasting',
        description: 'Predicts delivery demand patterns',
        status: 'ACTIVE',
        lastRun: new Date(Date.now() - 180000).toISOString(),
        lastDuration: 3500,
        healthScore: 0.88,
        successRate: 0.91,
        totalExecutions: 567,
        failedExecutions: 51,
        averageDuration: 3200,
        errors: [],
        enabled: true,
        category: 'Analytics',
        isControllable: false,
        canRestart: false,
        canConfigure: false,
      },
      {
        id: '5',
        name: 'SLA Monitor',
        description: 'Monitors service level agreements and compliance',
        status: 'IDLE',
        lastRun: new Date(Date.now() - 7200000).toISOString(),
        lastDuration: 180,
        healthScore: 0.75,
        successRate: 0.85,
        totalExecutions: 234,
        failedExecutions: 35,
        averageDuration: 165,
        errors: [],
        enabled: true,
        category: 'Monitoring',
        isControllable: true,
        canRestart: true,
        canConfigure: true,
        configuration: {
          executionInterval: 60000,
          timeout: 30000,
          retryLimit: 2,
          priority: 1,
          thresholdWarning: 80,
          thresholdCritical: 90,
        },
      },
    ];

    const mockActivities: AgentActivity[] = [
      {
        id: '1',
        agentId: '2',
        agentName: 'Route Optimization',
        timestamp: new Date(Date.now() - 30000).toISOString(),
        duration: 1200,
        status: 'SUCCESS',
      },
      {
        id: '2',
        agentId: '1',
        agentName: 'Master Orchestrator',
        timestamp: new Date(Date.now() - 120000).toISOString(),
        duration: 250,
        status: 'SUCCESS',
      },
      {
        id: '3',
        agentId: '4',
        agentName: 'Demand Forecasting',
        timestamp: new Date(Date.now() - 180000).toISOString(),
        duration: 3500,
        status: 'SUCCESS',
      },
      {
        id: '4',
        agentId: '3',
        agentName: 'Fleet Rebalancer',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        duration: 450,
        status: 'FAILURE',
        errorMessage: 'Fleet capacity calculation failed',
      },
    ];

    const mockHealth: SystemHealth = {
      overall: 0.85,
      totalAgents: 20,
      activeAgents: 15,
      errorAgents: 2,
      idleAgents: 3,
      disabledAgents: 0,
      uptimePercentage: 99.2,
      lastUpdated: new Date().toISOString(),
    };

    setRecentActivity(mockActivities);
    // Note: agents, systemHealth, and lastUpdate are managed by useRealtimeAgentStatus hook
  };

  // Agent Control Functions
  const handleAgentControl = async (request: AgentControlRequest): Promise<void> => {
    setOperatingAgents(prev => new Set([...Array.from(prev), request.agentId]));
    
    try {
      switch (request.action) {
        case 'start':
          await agentControlAPI.startAgent(request.agentId);
          break;
        case 'stop':
          await agentControlAPI.stopAgent(request.agentId);
          break;
        case 'restart':
          await agentControlAPI.restartAgent(request.agentId);
          break;
        case 'configure':
          if (request.configuration) {
            await agentControlAPI.configureAgent(request.agentId, request.configuration);
          }
          break;
      }
      
      // Refresh agent status after successful operation
      await refreshData();
    } catch (error) {
      console.error(`Failed to ${request.action} agent:`, error);
      throw error;
    } finally {
      setOperatingAgents(prev => {
        const newSet = new Set(prev);
        newSet.delete(request.agentId);
        return newSet;
      });
    }
  };

  const handleConfigureAgent = async (configuration: AgentConfiguration): Promise<void> => {
    if (!configModalAgent) return;
    
    await handleAgentControl({
      action: 'configure',
      agentId: configModalAgent.id,
      configuration,
    });
  };

  const handleFetchLogs = async (agentId: string, params?: any): Promise<AgentLogEntry[]> => {
    try {
      return await agentControlAPI.getAgentLogs(agentId, params);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      // Return mock logs for demonstration
      return [
        {
          id: '1',
          timestamp: new Date(Date.now() - 60000).toISOString(),
          level: 'INFO',
          message: 'Agent execution completed successfully',
          metadata: { duration: 1250, status: 'success' },
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 120000).toISOString(),
          level: 'WARN',
          message: 'High response time detected',
          metadata: { responseTime: 5000, threshold: 3000 },
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 180000).toISOString(),
          level: 'ERROR',
          message: 'Failed to connect to external service',
          metadata: { service: 'traffic-api', error: 'ECONNREFUSED' },
        },
      ];
    }
  };

  const handleRefresh = () => {
    refreshData();
  };

  const filterAgents = (agents: Agent[]) => {
    let filtered = [...agents];

    // Search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(
        (agent) =>
          agent.name.toLowerCase().includes(search) ||
          agent.description.toLowerCase().includes(search) ||
          agent.category.toLowerCase().includes(search)
      );
    }

    // Status filter
    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter((agent) => filters.status!.includes(agent.status));
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'healthScore':
          comparison = a.healthScore - b.healthScore;
          break;
        case 'lastRun': {
          const aTime = a.lastRun ? new Date(a.lastRun).getTime() : 0;
          const bTime = b.lastRun ? new Date(b.lastRun).getTime() : 0;
          comparison = aTime - bTime;
          break;
        }
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const filteredAgents = filterAgents(agents);

  if (loading && !systemHealth) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg font-medium">Loading Agent Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Agent Monitoring Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Real-time monitoring of AI agents in the Route Optimization System
            </p>
          </div>
          
          {/* Connection Status Indicator */}
          <div className="flex items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <Wifi className="w-4 h-4" />
                <span className="text-sm font-medium">Live</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <WifiOff className="w-4 h-4" />
                <span className="text-sm font-medium">Offline</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Bulk Control Actions */}
          <div className="flex items-center gap-2 mr-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                agents.filter(a => a.isControllable && a.status !== 'ACTIVE').forEach(agent => {
                  handleAgentControl({ action: 'start', agentId: agent.id });
                });
              }}
              disabled={loading || !agents.some(a => a.isControllable && a.status !== 'ACTIVE')}
            >
              <Play className="w-3 h-3 mr-1" />
              Start All
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                agents.filter(a => a.isControllable && a.status === 'ACTIVE').forEach(agent => {
                  handleAgentControl({ action: 'stop', agentId: agent.id });
                });
              }}
              disabled={loading || !agents.some(a => a.isControllable && a.status === 'ACTIVE')}
            >
              <Square className="w-3 h-3 mr-1" />
              Stop All
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                agents.filter(a => a.isControllable && a.canRestart).forEach(agent => {
                  handleAgentControl({ action: 'restart', agentId: agent.id });
                });
              }}
              disabled={loading || !agents.some(a => a.isControllable && a.canRestart)}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Restart All
            </Button>
          </div>
          
          <Link href="/admin/agents/ai-monitoring">
            <Button variant="secondary" className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              AI Monitoring
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={handleAutoRefreshToggle}
            className="text-sm font-medium"
          >
            {autoRefresh ? 'Real-time: ON' : 'Real-time: OFF'}
          </Button>
          
          <Button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-900 dark:text-yellow-100">Using Mock Data</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Could not connect to the backend API. Showing sample data for demonstration.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* System Health Overview */}
      {systemHealth && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="col-span-1">
            <CardHeader className="pb-3">
              <CardDescription>Overall Health</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <HealthScoreGauge score={systemHealth.overall} size="md" showLabel={true} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Agents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Server className="w-8 h-8 text-blue-500" />
                <div>
                  <div className="text-3xl font-bold">{systemHealth.totalAgents}</div>
                  <div className="text-xs text-muted-foreground">Registered</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Active Agents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8 text-green-500" />
                <div>
                  <div className="text-3xl font-bold">{systemHealth.activeAgents}</div>
                  <div className="text-xs text-muted-foreground">Running</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Errors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-red-500" />
                <div>
                  <div className="text-3xl font-bold">{systemHealth.errorAgents}</div>
                  <div className="text-xs text-muted-foreground">Failing</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Uptime</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-purple-500" />
                <div>
                  <div className="text-3xl font-bold">{systemHealth.uptimePercentage}%</div>
                  <div className="text-xs text-muted-foreground">Available</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              <CardTitle>Filters</CardTitle>
            </div>
            {lastUpdate && (
              <span className="text-sm text-muted-foreground">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search agents by name, description, or category..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setFilters({
                    ...filters,
                    status: filters.status?.includes('ACTIVE')
                      ? filters.status.filter((s) => s !== 'ACTIVE')
                      : [...(filters.status || []), 'ACTIVE'],
                  })
                }
                className={`px-3 py-2 rounded-md text-sm transition-colors ${
                  filters.status?.includes('ACTIVE')
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                Active
              </button>
              <button
                onClick={() =>
                  setFilters({
                    ...filters,
                    status: filters.status?.includes('ERROR')
                      ? filters.status.filter((s) => s !== 'ERROR')
                      : [...(filters.status || []), 'ERROR'],
                  })
                }
                className={`px-3 py-2 rounded-md text-sm transition-colors ${
                  filters.status?.includes('ERROR')
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                Errors
              </button>
              <button
                onClick={() =>
                  setFilters({
                    ...filters,
                    status: filters.status?.includes('IDLE')
                      ? filters.status.filter((s) => s !== 'IDLE')
                      : [...(filters.status || []), 'IDLE'],
                  })
                }
                className={`px-3 py-2 rounded-md text-sm transition-colors ${
                  filters.status?.includes('IDLE')
                    ? 'bg-yellow-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                Idle
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agents Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Agents ({filteredAgents.length})</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
              className="px-3 py-1 rounded-md border bg-background text-sm"
            >
              <option value="name">Name</option>
              <option value="status">Status</option>
              <option value="healthScore">Health Score</option>
              <option value="lastRun">Last Run</option>
            </select>
            <button
              onClick={() =>
                setFilters({
                  ...filters,
                  sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc',
                })
              }
              className="px-2 py-1 rounded-md border bg-background text-sm"
            >
              {filters.sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {filteredAgents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="w-12 h-12 text-muted-foreground opacity-50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No agents found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your filters or search terms
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => {
              // Determine if agent has a dedicated page
              const getAgentPageUrl = (agentName: string) => {
                const normalizedName = agentName.toLowerCase().replace(/\s+/g, '-');
                switch (normalizedName) {
                  case 'sla-monitor':
                    return '/admin/agents/sla-monitor';
                  case 'order-assignment':
                    return '/admin/agents/order-assignment';
                  // Add more agent pages as they are created
                  default:
                    return null;
                }
              };

              const agentPageUrl = getAgentPageUrl(agent.name);

              return (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onClick={(agent) => {
                    if (agentPageUrl) {
                      window.location.href = agentPageUrl;
                    } else {
                      console.log('Agent clicked:', agent);
                    }
                  }}
                  onControl={handleAgentControl}
                  onConfigure={(agentId) => {
                    const agent = agents.find(a => a.id === agentId);
                    if (agent) setConfigModalAgent(agent);
                  }}
                  onViewLogs={(agentId) => {
                    const agent = agents.find(a => a.id === agentId);
                    if (agent) setLogsModalAgent(agent);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Activity Log */}
      <AgentActivityLog activities={recentActivity} maxItems={50} showAgentName={true} />

      {/* Modals */}
      <AgentConfigModal
        agent={configModalAgent}
        isOpen={!!configModalAgent}
        onClose={() => setConfigModalAgent(null)}
        onSave={handleConfigureAgent}
      />

      <AgentLogsModal
        agent={logsModalAgent}
        isOpen={!!logsModalAgent}
        onClose={() => setLogsModalAgent(null)}
        onFetchLogs={handleFetchLogs}
      />
    </div>
  );
}
