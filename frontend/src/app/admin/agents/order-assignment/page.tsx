'use client';

import React, { useState, useEffect } from 'react';
import { Agent, AgentLogEntry, AgentConfiguration } from '@/types/agent';
import { AgentConfigModal } from '@/components/admin/AgentConfigModal';
import { AgentLogsModal } from '@/components/admin/AgentLogsModal';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { HealthScoreGauge } from '@/components/admin/HealthScoreGauge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import agentControlAPI from '@/lib/agent-control-api';
import {
  ArrowLeft,
  Users,
  Truck,
  Clock,
  TrendingUp,
  Target,
  Settings,
  ScrollText,
  Play,
  Square,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  MapPin,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export default function OrderAssignmentAgentPage() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [isOperating, setIsOperating] = useState(false);
  
  // Order Assignment specific metrics
  const [assignmentMetrics, setAssignmentMetrics] = useState({
    totalAssignments: 3247,
    successfulAssignments: 3089,
    failedAssignments: 158,
    assignmentRate: 95.1,
    averageAssignmentTime: 2.3,
    optimizedAssignments: 2847,
    optimizationRate: 87.7,
    availableDrivers: 156,
    busyDrivers: 89,
    zones: {
      'Zone A': { drivers: 45, assignments: 423 },
      'Zone B': { drivers: 38, assignments: 367 },
      'Zone C': { drivers: 42, assignments: 389 },
      'Zone D': { drivers: 31, assignments: 298 },
    },
  });

  useEffect(() => {
    fetchAgentDetails();
    fetchAssignmentMetrics();
  }, []);

  const fetchAgentDetails = async () => {
    try {
      setLoading(true);
      // For demo purposes, use mock data
      const mockAgent: Agent = {
        id: '6',
        name: 'Order Assignment',
        description: 'Intelligently assigns orders to optimal drivers using AI algorithms',
        status: 'ACTIVE',
        lastRun: new Date(Date.now() - 45000).toISOString(),
        lastDuration: 1250,
        healthScore: 0.94,
        successRate: 0.97,
        totalExecutions: 15234,
        failedExecutions: 457,
        averageDuration: 1180,
        errors: [],
        enabled: true,
        category: 'Order Management',
        isControllable: true,
        canRestart: true,
        canConfigure: true,
        configuration: {
          executionInterval: 5000,
          timeout: 15000,
          retryLimit: 3,
          priority: 2,
          maxAssignmentDistance: 10,
          preferredDriverTypes: ['premium', 'standard'],
          optimizationWeight: 0.8,
          balanceLoad: true,
          considerTraffic: true,
        },
      };
      
      setAgent(mockAgent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agent details');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignmentMetrics = async () => {
    // Simulate fetching assignment metrics
    // In real implementation, this would call the Order Assignment API
  };

  const handleAgentControl = async (action: 'start' | 'stop' | 'restart') => {
    if (!agent || isOperating) return;
    
    setIsOperating(true);
    try {
      switch (action) {
        case 'start':
          await agentControlAPI.startAgent(agent.id);
          break;
        case 'stop':
          await agentControlAPI.stopAgent(agent.id);
          break;
        case 'restart':
          await agentControlAPI.restartAgent(agent.id);
          break;
      }
      
      await fetchAgentDetails();
    } catch (error) {
      console.error(`Failed to ${action} agent:`, error);
    } finally {
      setIsOperating(false);
    }
  };

  const handleConfigureAgent = async (configuration: AgentConfiguration) => {
    if (!agent) return;
    
    try {
      await agentControlAPI.configureAgent(agent.id, configuration);
      await fetchAgentDetails();
    } catch (error) {
      console.error('Failed to configure agent:', error);
      throw error;
    }
  };

  const handleFetchLogs = async (agentId: string, params?: any): Promise<AgentLogEntry[]> => {
    try {
      return await agentControlAPI.getAgentLogs(agentId, params);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      // Return mock assignment-specific logs
      return [
        {
          id: '1',
          timestamp: new Date(Date.now() - 60000).toISOString(),
          level: 'INFO',
          message: 'Successfully assigned order #12345 to driver D789 in Zone A',
          metadata: { orderId: '12345', driverId: 'D789', zone: 'Zone A', distance: 2.3, estimatedTime: 18 },
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 120000).toISOString(),
          level: 'WARN',
          message: 'No available drivers in Zone C, expanding search radius',
          metadata: { zone: 'Zone C', originalRadius: 5, expandedRadius: 10 },
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 180000).toISOString(),
          level: 'INFO',
          message: 'Batch assignment completed: 15 orders assigned to 12 drivers',
          metadata: { batchId: 'B001', ordersProcessed: 15, driversAssigned: 12, avgTime: 1.8 },
        },
      ];
    }
  };

  const canStart = agent?.status === 'DISABLED' || agent?.status === 'ERROR' || agent?.status === 'IDLE';
  const canStop = agent?.status === 'ACTIVE';
  const canRestart = agent?.status === 'ACTIVE' || agent?.status === 'ERROR';
  const isTransitioning = agent?.status === 'STARTING' || agent?.status === 'STOPPING' || isOperating;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg font-medium">Loading Order Assignment Agent...</p>
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900 dark:text-red-100">Failed to Load Agent</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {error || 'Agent not found'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/agents">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Agents
            </Button>
          </Link>
          
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
            <p className="text-muted-foreground mt-1">{agent.description}</p>
          </div>
          
          <div className="flex items-center gap-3">
            <StatusBadge status={agent.status} size="lg" />
            <Badge variant="outline" className="text-sm">
              {agent.category}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            disabled={!canStart || isTransitioning}
            onClick={() => handleAgentControl('start')}
          >
            <Play className="w-4 h-4 mr-2" />
            Start
          </Button>
          
          <Button
            variant="outline"
            disabled={!canStop || isTransitioning}
            onClick={() => handleAgentControl('stop')}
          >
            <Square className="w-4 h-4 mr-2" />
            Stop
          </Button>
          
          <Button
            variant="outline"
            disabled={!canRestart || isTransitioning}
            onClick={() => handleAgentControl('restart')}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Restart
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => setConfigModalOpen(true)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => setLogsModalOpen(true)}
          >
            <ScrollText className="w-4 h-4 mr-2" />
            View Logs
          </Button>
        </div>
      </div>

      {/* Agent Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Health Score</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <HealthScoreGauge score={agent.healthScore} size="lg" showLabel={true} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Success Rate</span>
                <span className="text-sm font-medium">{Math.round(agent.successRate * 100)}%</span>
              </div>
              <Progress value={agent.successRate * 100} className="h-2" />
              
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Avg Duration</span>
                <span className="text-sm font-medium">{agent.averageDuration}ms</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Executions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{agent.totalExecutions.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">
                {agent.failedExecutions} failed
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Last Run</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-sm font-medium">
                {agent.lastRun ? new Date(agent.lastRun).toLocaleString() : 'Never'}
              </div>
              <div className="text-sm text-muted-foreground">
                Duration: {agent.lastDuration}ms
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assignment Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Assignment Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {assignmentMetrics.assignmentRate}%
                </div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-lg font-semibold text-green-600">
                    {assignmentMetrics.successfulAssignments.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Successful</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-red-600">
                    {assignmentMetrics.failedAssignments}
                  </div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Assignment Speed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {assignmentMetrics.averageAssignmentTime}s
                </div>
                <div className="text-sm text-muted-foreground">Avg Assignment Time</div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Optimized</span>
                  <span className="text-sm font-medium">
                    {assignmentMetrics.optimizationRate}%
                  </span>
                </div>
                <Progress value={assignmentMetrics.optimizationRate} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Driver Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {assignmentMetrics.availableDrivers}
                  </div>
                  <div className="text-xs text-muted-foreground">Available</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {assignmentMetrics.busyDrivers}
                  </div>
                  <div className="text-xs text-muted-foreground">Busy</div>
                </div>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full"
                  style={{ 
                    width: `${(assignmentMetrics.availableDrivers / (assignmentMetrics.availableDrivers + assignmentMetrics.busyDrivers)) * 100}%` 
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Zone Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Zone Distribution
          </CardTitle>
          <CardDescription>
            Driver distribution and assignment activity across zones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Object.entries(assignmentMetrics.zones).map(([zone, data]) => (
              <div key={zone} className="text-center p-4 border rounded-lg">
                <div className="font-semibold text-lg mb-2">{zone}</div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Drivers</span>
                    <span className="text-sm font-medium">{data.drivers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Assignments</span>
                    <span className="text-sm font-medium">{data.assignments}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Avg/Driver</span>
                    <span className="text-sm font-medium">
                      {Math.round(data.assignments / data.drivers)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Current Configuration</CardTitle>
          <CardDescription>
            Active configuration parameters for the Order Assignment agent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-muted-foreground">Execution Interval</div>
              <div className="font-medium">{agent.configuration?.executionInterval}ms</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Max Distance</div>
              <div className="font-medium">{agent.configuration?.maxAssignmentDistance}km</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Optimization Weight</div>
              <div className="font-medium">{agent.configuration?.optimizationWeight}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Timeout</div>
              <div className="font-medium">{agent.configuration?.timeout}ms</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Load Balancing</div>
              <div className="font-medium">
                {agent.configuration?.balanceLoad ? 'Enabled' : 'Disabled'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Traffic Consideration</div>
              <div className="font-medium">
                {agent.configuration?.considerTraffic ? 'Enabled' : 'Disabled'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Retry Limit</div>
              <div className="font-medium">{agent.configuration?.retryLimit}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Priority</div>
              <div className="font-medium">{agent.configuration?.priority}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <AgentConfigModal
        agent={agent}
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        onSave={handleConfigureAgent}
      />

      <AgentLogsModal
        agent={agent}
        isOpen={logsModalOpen}
        onClose={() => setLogsModalOpen(false)}
        onFetchLogs={handleFetchLogs}
      />
    </div>
  );
};