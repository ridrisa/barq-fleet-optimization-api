'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Agent,
  AgentActivity,
  AgentStatusResponse,
  SystemHealth,
  DashboardFilters,
} from '@/types/agent';
import { AgentCard } from '@/components/admin/AgentCard';
import { AgentActivityLog } from '@/components/admin/AgentActivityLog';
import { HealthScoreGauge } from '@/components/admin/HealthScoreGauge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Activity,
  RefreshCw,
  Search,
  Server,
  AlertCircle,
  Filter,
  TrendingUp,
  Users,
} from 'lucide-react';

export default function AgentMonitoringDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [recentActivity, setRecentActivity] = useState<AgentActivity[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({
    search: '',
    status: [],
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const fetchAgentStatus = useCallback(async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      const response = await fetch(`${backendUrl}/api/admin/agents/status`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: AgentStatusResponse = await response.json();

      setAgents(data.agents);
      setSystemHealth(data.systemHealth);
      setRecentActivity(data.recentActivity || []);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch agent status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch agent status');

      // Use mock data for development
      setMockData();
    } finally {
      setLoading(false);
    }
  }, []);

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

    setAgents(mockAgents);
    setRecentActivity(mockActivities);
    setSystemHealth(mockHealth);
    setLastUpdate(new Date());
  };

  useEffect(() => {
    fetchAgentStatus();
  }, [fetchAgentStatus]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchAgentStatus();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, fetchAgentStatus]);

  const handleRefresh = () => {
    setLoading(true);
    fetchAgentStatus();
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agent Monitoring Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Real-time monitoring of AI agents in the Route Optimization System
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              autoRefresh
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {autoRefresh ? 'Auto-Refresh: ON' : 'Auto-Refresh: OFF'}
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
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
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onClick={(agent) => console.log('Agent clicked:', agent)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Activity Log */}
      <AgentActivityLog activities={recentActivity} maxItems={50} showAgentName={true} />
    </div>
  );
}
