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
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Activity,
  Settings,
  ScrollText,
  Play,
  Square,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';

export default function SLAMonitorAgentPage() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [isOperating, setIsOperating] = useState(false);
  
  // SLA Monitor specific metrics
  const [slaMetrics, setSlaMetrics] = useState({
    totalOrders: 1247,
    compliantOrders: 1089,
    atRiskOrders: 158,
    breachedOrders: 23,
    complianceRate: 87.3,
    averageDeliveryTime: 28.5,
    slaThreshold: 30,
    criticalAlerts: 5,
    warningAlerts: 12,
  });

  useEffect(() => {
    fetchAgentDetails();
    fetchSLAMetrics();
  }, []);

  const fetchAgentDetails = async () => {
    try {
      setLoading(true);
      // For demo purposes, use mock data
      const mockAgent: Agent = {
        id: '5',
        name: 'SLA Monitor',
        description: 'Monitors service level agreements and compliance in real-time',
        status: 'ACTIVE',
        lastRun: new Date(Date.now() - 30000).toISOString(),
        lastDuration: 180,
        healthScore: 0.92,
        successRate: 0.95,
        totalExecutions: 2847,
        failedExecutions: 142,
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
          alertChannels: ['email', 'webhook'],
          escalationDelay: 300,
        },
      };
      
      setAgent(mockAgent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agent details');
    } finally {
      setLoading(false);
    }
  };

  const fetchSLAMetrics = async () => {
    // Simulate fetching SLA metrics
    // In real implementation, this would call the SLA Monitor API
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
      // Return mock SLA-specific logs
      return [
        {
          id: '1',
          timestamp: new Date(Date.now() - 60000).toISOString(),
          level: 'WARN',
          message: 'SLA breach detected: Order #12345 exceeded 30 min threshold',
          metadata: { orderId: '12345', actualTime: 35, threshold: 30 },
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 120000).toISOString(),
          level: 'INFO',
          message: 'SLA compliance check completed - 87.3% compliance rate',
          metadata: { totalOrders: 1247, compliantOrders: 1089, complianceRate: 87.3 },
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 180000).toISOString(),
          level: 'ERROR',
          message: 'Critical SLA alert: Multiple orders at risk in Zone A',
          metadata: { zone: 'Zone A', atRiskCount: 15, urgency: 'critical' },
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
          <p className="text-lg font-medium">Loading SLA Monitor Agent...</p>
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

      {/* SLA Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              SLA Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {slaMetrics.complianceRate}%
                </div>
                <div className="text-sm text-muted-foreground">Overall Compliance</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-lg font-semibold text-green-600">
                    {slaMetrics.compliantOrders}
                  </div>
                  <div className="text-xs text-muted-foreground">Compliant</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-red-600">
                    {slaMetrics.breachedOrders}
                  </div>
                  <div className="text-xs text-muted-foreground">Breached</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              At Risk Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">
                  {slaMetrics.atRiskOrders}
                </div>
                <div className="text-sm text-muted-foreground">Orders at Risk</div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Critical Alerts</span>
                  <span className="text-sm font-medium text-red-600">
                    {slaMetrics.criticalAlerts}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Warning Alerts</span>
                  <span className="text-sm font-medium text-yellow-600">
                    {slaMetrics.warningAlerts}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Delivery Times
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold">
                  {slaMetrics.averageDeliveryTime}m
                </div>
                <div className="text-sm text-muted-foreground">Avg Delivery Time</div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">SLA Threshold</span>
                  <span className="text-sm font-medium">
                    {slaMetrics.slaThreshold}m
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full"
                    style={{ 
                      width: `${Math.min(100, (slaMetrics.averageDeliveryTime / slaMetrics.slaThreshold) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Current Configuration</CardTitle>
          <CardDescription>
            Active configuration parameters for the SLA Monitor agent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-muted-foreground">Execution Interval</div>
              <div className="font-medium">{agent.configuration?.executionInterval}ms</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Warning Threshold</div>
              <div className="font-medium">{agent.configuration?.thresholdWarning}%</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Critical Threshold</div>
              <div className="font-medium">{agent.configuration?.thresholdCritical}%</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Timeout</div>
              <div className="font-medium">{agent.configuration?.timeout}ms</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Retry Limit</div>
              <div className="font-medium">{agent.configuration?.retryLimit}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Priority</div>
              <div className="font-medium">{agent.configuration?.priority}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Escalation Delay</div>
              <div className="font-medium">{agent.configuration?.escalationDelay}s</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Alert Channels</div>
              <div className="font-medium">
                {Array.isArray(agent.configuration?.alertChannels) 
                  ? agent.configuration.alertChannels.join(', ') 
                  : 'N/A'
                }
              </div>
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