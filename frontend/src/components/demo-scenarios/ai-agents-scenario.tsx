'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { 
  Brain, 
  Activity, 
  Zap, 
  Users, 
  Settings, 
  CheckCircle,
  AlertCircle,
  Clock,
  Navigation,
  Package,
  Truck,
  Radio,
  BarChart3,
  Target,
  Shield,
  Globe,
  Cpu,
  Network,
  TrendingUp,
  ArrowRight
} from 'lucide-react';

interface AIAgentsScenarioProps {
  step: number;
  metrics: any;
  isRunning: boolean;
}

// Define all 18+ AI agents
const AI_AGENTS = [
  { id: 'master-orchestrator', name: 'Master Orchestrator', category: 'core', status: 'active', priority: 1 },
  { id: 'order-assignment', name: 'Order Assignment Agent', category: 'logistics', status: 'active', priority: 2 },
  { id: 'route-optimization', name: 'Route Optimization Agent', category: 'logistics', status: 'active', priority: 2 },
  { id: 'emergency-escalation', name: 'Emergency Escalation Agent', category: 'emergency', status: 'active', priority: 1 },
  { id: 'sla-monitor', name: 'SLA Monitor Agent', category: 'monitoring', status: 'active', priority: 2 },
  { id: 'fleet-status', name: 'Fleet Status Agent', category: 'monitoring', status: 'active', priority: 3 },
  { id: 'traffic-pattern', name: 'Traffic Pattern Agent', category: 'intelligence', status: 'active', priority: 3 },
  { id: 'demand-forecasting', name: 'Demand Forecasting Agent', category: 'intelligence', status: 'active', priority: 3 },
  { id: 'customer-communication', name: 'Customer Communication Agent', category: 'communication', status: 'active', priority: 2 },
  { id: 'order-recovery', name: 'Order Recovery Agent', category: 'emergency', status: 'active', priority: 1 },
  { id: 'fleet-rebalancer', name: 'Fleet Rebalancer Agent', category: 'logistics', status: 'active', priority: 2 },
  { id: 'performance-analytics', name: 'Performance Analytics Agent', category: 'analytics', status: 'active', priority: 3 },
  { id: 'batch-optimization', name: 'Batch Optimization Agent', category: 'optimization', status: 'active', priority: 2 },
  { id: 'geo-intelligence', name: 'Geo Intelligence Agent', category: 'intelligence', status: 'active', priority: 3 },
  { id: 'planning', name: 'Strategic Planning Agent', category: 'planning', status: 'active', priority: 3 },
  { id: 'formatting', name: 'Data Formatting Agent', category: 'data', status: 'active', priority: 3 },
  { id: 'optimization', name: 'General Optimization Agent', category: 'optimization', status: 'active', priority: 2 },
  { id: 'quality-assurance', name: 'Quality Assurance Agent', category: 'monitoring', status: 'active', priority: 2 }
];

const AGENT_CATEGORIES = {
  core: { color: 'purple', icon: Brain, label: 'Core Orchestration' },
  logistics: { color: 'blue', icon: Navigation, label: 'Logistics' },
  emergency: { color: 'red', icon: AlertCircle, label: 'Emergency Response' },
  monitoring: { color: 'green', icon: Activity, label: 'Monitoring' },
  intelligence: { color: 'orange', icon: Cpu, label: 'Intelligence' },
  communication: { color: 'pink', icon: Radio, label: 'Communication' },
  analytics: { color: 'indigo', icon: BarChart3, label: 'Analytics' },
  optimization: { color: 'teal', icon: Zap, label: 'Optimization' },
  planning: { color: 'yellow', icon: Target, label: 'Planning' },
  data: { color: 'gray', icon: Settings, label: 'Data Processing' }
};

export default function AIAgentsScenario({ step, metrics, isRunning }: AIAgentsScenarioProps) {
  const [agentStats, setAgentStats] = useState({
    totalAgents: 18,
    activeAgents: 16,
    decisionsPerSecond: 0,
    coordinationEfficiency: 0
  });

  const [agentActivity, setAgentActivity] = useState(
    AI_AGENTS.map(agent => ({
      ...agent,
      lastAction: 'Idle',
      performance: Math.random() * 20 + 80,
      decisionsCount: 0
    }))
  );

  const [networkActivity, setNetworkActivity] = useState<Array<{
    id: number;
    from: string;
    to: string;
    message: string;
    timestamp: string;
  }>>([]);
  const [masterOrchestratorLoad, setMasterOrchestratorLoad] = useState(0);

  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        // Update agent statistics
        setAgentStats(prev => ({
          ...prev,
          decisionsPerSecond: Math.floor(Math.random() * 50) + 150,
          coordinationEfficiency: 97.2 + (Math.random() * 2 - 1),
          activeAgents: Math.min(18, Math.max(15, prev.activeAgents + Math.floor(Math.random() * 3 - 1)))
        }));

        // Update master orchestrator load
        setMasterOrchestratorLoad(prev => {
          const newLoad = prev + (Math.random() * 20 - 10);
          return Math.max(40, Math.min(95, newLoad));
        });

        // Simulate agent activities
        setAgentActivity(prev => prev.map(agent => {
          const actions = getAgentActions(agent.category);
          const randomAction = actions[Math.floor(Math.random() * actions.length)];
          return {
            ...agent,
            lastAction: randomAction,
            performance: Math.max(75, Math.min(100, agent.performance + (Math.random() * 4 - 2))),
            decisionsCount: agent.decisionsCount + Math.floor(Math.random() * 3)
          };
        }));

        // Add network activity
        setNetworkActivity(prev => {
          const newActivity = {
            id: Date.now(),
            from: AI_AGENTS[Math.floor(Math.random() * AI_AGENTS.length)].name,
            to: AI_AGENTS[Math.floor(Math.random() * AI_AGENTS.length)].name,
            message: getRandomMessage(),
            timestamp: new Date().toLocaleTimeString()
          };
          return [newActivity, ...prev.slice(0, 9)]; // Keep last 10 messages
        });
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [isRunning]);

  const getAgentActions = (category: string) => {
    const actionMap: Record<string, string[]> = {
      core: ['Coordinating agents', 'Resolving conflicts', 'Setting priorities', 'Monitoring system'],
      logistics: ['Optimizing routes', 'Assigning orders', 'Balancing fleet', 'Calculating ETAs'],
      emergency: ['Handling escalation', 'Recovering orders', 'Managing crisis', 'Alerting humans'],
      monitoring: ['Tracking SLAs', 'Monitoring fleet', 'Checking performance', 'Analyzing metrics'],
      intelligence: ['Processing traffic', 'Forecasting demand', 'Analyzing patterns', 'Learning trends'],
      communication: ['Notifying customers', 'Sending updates', 'Managing feedback', 'Coordinating teams'],
      analytics: ['Analyzing performance', 'Generating insights', 'Processing data', 'Creating reports'],
      optimization: ['Optimizing batches', 'Improving efficiency', 'Reducing costs', 'Enhancing performance'],
      planning: ['Strategic planning', 'Resource allocation', 'Capacity planning', 'Forecasting needs'],
      data: ['Formatting data', 'Validating inputs', 'Cleaning datasets', 'Processing requests']
    };
    return actionMap[category] || ['Processing tasks'];
  };

  const getRandomMessage = () => {
    const messages = [
      'Route optimization request',
      'SLA breach alert',
      'Emergency escalation',
      'Fleet rebalancing needed',
      'Traffic update received',
      'Customer notification sent',
      'Performance analysis complete',
      'Demand forecast updated'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  const getStepContent = (currentStep: number) => {
    switch (currentStep) {
      case 0: // 18+ AI Agents
        return (
          <div className="space-y-6">
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-600" />
                  AI Agent Network Overview - {agentStats.totalAgents} Agents
                </CardTitle>
                <CardDescription>
                  Complete autonomous agent ecosystem working in perfect harmony
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-white rounded-lg border">
                        <div className="text-2xl font-bold text-purple-600">{agentStats.totalAgents}</div>
                        <div className="text-sm text-gray-600">Total Agents</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg border">
                        <div className="text-2xl font-bold text-green-600">{agentStats.activeAgents}</div>
                        <div className="text-sm text-gray-600">Active Now</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg border">
                        <div className="text-2xl font-bold text-blue-600">{agentStats.decisionsPerSecond}</div>
                        <div className="text-sm text-gray-600">Decisions/sec</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg border">
                        <div className="text-2xl font-bold text-orange-600">{agentStats.coordinationEfficiency.toFixed(1)}%</div>
                        <div className="text-sm text-gray-600">Coordination</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(AGENT_CATEGORIES).map(([key, category]) => {
                        const categoryAgents = agentActivity.filter(agent => agent.category === key);
                        const IconComponent = category.icon;
                        return (
                          <div key={key} className="p-3 bg-white rounded-lg border">
                            <div className="flex items-center gap-2 mb-2">
                              <IconComponent className={`w-4 h-4 text-${category.color}-600`} />
                              <span className="text-sm font-medium">{category.label}</span>
                              <Badge variant="outline" className={`bg-${category.color}-50`}>
                                {categoryAgents.length}
                              </Badge>
                            </div>
                            <div className="text-xs text-gray-600">
                              Avg Performance: {(categoryAgents.reduce((sum, agent) => sum + agent.performance, 0) / categoryAgents.length).toFixed(1)}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Agent Performance</div>
                      <div className="space-y-2">
                        {agentActivity.slice(0, 6).map((agent) => (
                          <div key={agent.id} className="flex justify-between items-center text-xs">
                            <span className="truncate flex-1">{agent.name}</span>
                            <Badge 
                              variant={agent.performance > 90 ? 'default' : 'secondary'}
                              className="ml-1"
                            >
                              {agent.performance.toFixed(0)}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                      <Button size="sm" variant="outline" className="w-full mt-3">
                        <Users className="w-3 h-3 mr-1" />
                        View All Agents
                      </Button>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">System Health</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>Network Latency</span>
                          <span className="text-green-600">2.3ms</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Agent Uptime</span>
                          <span className="text-green-600">99.8%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Memory Usage</span>
                          <span className="text-blue-600">67%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>CPU Load</span>
                          <span className="text-orange-600">54%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 1: // Master Orchestrator
        return (
          <div className="space-y-6">
            <Card className="border-indigo-200 bg-indigo-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="w-5 h-5 text-indigo-600" />
                  Master Orchestrator Command Center
                </CardTitle>
                <CardDescription>
                  Central intelligence coordinating all agents with autonomous decision-making
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">Orchestrator Load</span>
                        <Badge variant={masterOrchestratorLoad > 80 ? 'destructive' : 'outline'} 
                               className={masterOrchestratorLoad > 80 ? '' : 'bg-indigo-100'}>
                          {masterOrchestratorLoad.toFixed(1)}%
                        </Badge>
                      </div>
                      
                      <Progress value={masterOrchestratorLoad} className="h-3 mb-2" />
                      <div className="text-xs text-gray-600 mb-4">
                        Managing {agentStats.activeAgents} agents across {Object.keys(AGENT_CATEGORIES).length} categories
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center p-2 bg-blue-50 rounded">
                          <div className="font-bold text-blue-600">{agentStats.decisionsPerSecond}</div>
                          <div>Decisions/sec</div>
                        </div>
                        <div className="text-center p-2 bg-green-50 rounded">
                          <div className="font-bold text-green-600">1.2ms</div>
                          <div>Response Time</div>
                        </div>
                        <div className="text-center p-2 bg-purple-50 rounded">
                          <div className="font-bold text-purple-600">99.2%</div>
                          <div>Success Rate</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Orchestration Functions</div>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                          <span>Priority Management</span>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                          <span>Conflict Resolution</span>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
                          <span>Resource Allocation</span>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="flex items-center justify-between p-2 bg-orange-50 rounded">
                          <span>Performance Monitoring</span>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Real-time Agent Coordination</div>
                      <div className="space-y-2 text-xs max-h-48 overflow-y-auto">
                        {networkActivity.map((activity, index) => (
                          <div key={activity.id} className="p-2 border-l-4 border-indigo-400 bg-indigo-50 rounded">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-medium">{activity.from} → {activity.to}</div>
                                <div className="text-gray-600">{activity.message}</div>
                              </div>
                              <span className="text-gray-500 text-xs">{activity.timestamp}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Decision Matrix</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>Emergency Escalations</span>
                          <Badge variant="destructive">Priority 1</Badge>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>SLA Compliance</span>
                          <Badge variant="outline" className="bg-orange-100">Priority 2</Badge>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Route Optimization</span>
                          <Badge variant="outline" className="bg-blue-100">Priority 2</Badge>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Performance Analytics</span>
                          <Badge variant="outline" className="bg-gray-100">Priority 3</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 2: // Real-time Decisions
        return (
          <div className="space-y-6">
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-green-600" />
                  Real-time Decision Intelligence
                </CardTitle>
                <CardDescription>
                  Millisecond decision-making with autonomous problem resolution
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">Live Decision Stream</span>
                        <Badge variant="outline" className="bg-green-100">
                          <Activity className="w-3 h-3 mr-1" />
                          {agentStats.decisionsPerSecond}/sec
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {agentActivity.filter(agent => agent.status === 'active').map((agent, index) => (
                          <div key={agent.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex items-center gap-2 flex-1">
                              <div className={`w-2 h-2 rounded-full bg-green-500 animate-pulse`}></div>
                              <div className="flex-1">
                                <div className="text-sm font-medium truncate">{agent.name}</div>
                                <div className="text-xs text-gray-600 truncate">{agent.lastAction}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-medium">{agent.decisionsCount}</div>
                              <div className="text-xs text-gray-500">decisions</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-3 bg-white rounded-lg border text-center">
                        <div className="text-lg font-bold text-blue-600">1.2ms</div>
                        <div className="text-xs text-gray-600">Avg Decision Time</div>
                        <TrendingUp className="w-4 h-4 text-green-500 mx-auto mt-1" />
                      </div>
                      
                      <div className="p-3 bg-white rounded-lg border text-center">
                        <div className="text-lg font-bold text-green-600">98.7%</div>
                        <div className="text-xs text-gray-600">Autonomous Resolution</div>
                        <CheckCircle className="w-4 h-4 text-green-500 mx-auto mt-1" />
                      </div>
                      
                      <div className="p-3 bg-white rounded-lg border text-center">
                        <div className="text-lg font-bold text-purple-600">847K</div>
                        <div className="text-xs text-gray-600">Daily Decisions</div>
                        <BarChart3 className="w-4 h-4 text-purple-500 mx-auto mt-1" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Decision Categories</div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span>Route Optimization</span>
                          <span className="text-blue-600 font-medium">34%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Order Assignment</span>
                          <span className="text-green-600 font-medium">28%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Emergency Response</span>
                          <span className="text-red-600 font-medium">12%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Fleet Management</span>
                          <span className="text-purple-600 font-medium">15%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Analytics & Monitoring</span>
                          <span className="text-orange-600 font-medium">11%</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">AI Decision Quality</div>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Accuracy Score</span>
                            <span className="text-green-600 font-medium">96.8%</span>
                          </div>
                          <Progress value={96.8} className="h-1" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Consistency Rating</span>
                            <span className="text-blue-600 font-medium">94.2%</span>
                          </div>
                          <Progress value={94.2} className="h-1" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Learning Rate</span>
                            <span className="text-purple-600 font-medium">91.5%</span>
                          </div>
                          <Progress value={91.5} className="h-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 3: // Autonomous Operations
        return (
          <div className="space-y-6">
            <Card className="border-teal-200 bg-teal-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-teal-600" />
                  Fully Autonomous Operations
                </CardTitle>
                <CardDescription>
                  Complete system autonomy with 97.2% automation rate and minimal human intervention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">Automation Metrics</span>
                        <Badge variant="outline" className="bg-teal-100">
                          <Shield className="w-3 h-3 mr-1" />
                          97.2% Autonomous
                        </Badge>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Fully Automated Tasks</span>
                            <span className="text-teal-600 font-medium">97.2%</span>
                          </div>
                          <Progress value={97.2} className="h-2" />
                          <div className="text-xs text-gray-600 mt-1">No human intervention required</div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Human-Assisted Tasks</span>
                            <span className="text-blue-600 font-medium">2.3%</span>
                          </div>
                          <Progress value={2.3} className="h-2" />
                          <div className="text-xs text-gray-600 mt-1">Requires minimal oversight</div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Manual Override</span>
                            <span className="text-orange-600 font-medium">0.5%</span>
                          </div>
                          <Progress value={0.5} className="h-2" />
                          <div className="text-xs text-gray-600 mt-1">Emergency situations only</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Autonomous Capabilities</div>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Self-healing system recovery</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Predictive maintenance scheduling</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Dynamic resource allocation</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Intelligent failure recovery</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Continuous learning & adaptation</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Self-Management Systems</div>
                      <div className="space-y-2">
                        <div className="p-2 border rounded">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Auto-scaling</span>
                            <Activity className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="text-xs text-gray-600">Adjusts capacity based on demand</div>
                        </div>
                        
                        <div className="p-2 border rounded">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Load Balancing</span>
                            <Activity className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="text-xs text-gray-600">Distributes work across agents</div>
                        </div>
                        
                        <div className="p-2 border rounded">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Health Monitoring</span>
                            <Activity className="w-4 h-4 text-purple-600" />
                          </div>
                          <div className="text-xs text-gray-600">Continuous system health checks</div>
                        </div>
                        
                        <div className="p-2 border rounded">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Performance Tuning</span>
                            <Activity className="w-4 h-4 text-orange-600" />
                          </div>
                          <div className="text-xs text-gray-600">Self-optimizing algorithms</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Operational Impact</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-center p-2 bg-green-50 rounded">
                          <div className="font-bold text-green-600">67%</div>
                          <div>Cost Reduction</div>
                        </div>
                        <div className="text-center p-2 bg-blue-50 rounded">
                          <div className="font-bold text-blue-600">89%</div>
                          <div>Error Reduction</div>
                        </div>
                        <div className="text-center p-2 bg-purple-50 rounded">
                          <div className="font-bold text-purple-600">24/7</div>
                          <div>Uptime</div>
                        </div>
                        <div className="text-center p-2 bg-orange-50 rounded">
                          <div className="font-bold text-orange-600">145%</div>
                          <div>Efficiency Gain</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return <div>Loading scenario content...</div>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Scenario Header */}
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg border">
        <Brain className="w-8 h-8 text-pink-600" />
        <div className="flex-1">
          <h2 className="text-xl font-bold text-pink-800">AI Agent Showcase Demo</h2>
          <p className="text-sm text-pink-600">18+ autonomous agents in perfect coordination with 97.2% automation</p>
        </div>
        <Badge variant="outline" className="bg-pink-100">
          <Clock className="w-3 h-3 mr-1" />
          ~10 minutes
        </Badge>
      </div>
      
      {/* Step Content */}
      {getStepContent(step)}
      
      {/* Status Indicator */}
      {isRunning && (
        <div className="text-center p-3 bg-pink-50 rounded-lg border border-pink-200">
          <div className="flex items-center justify-center gap-2 text-pink-600">
            <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">AI Network Active - {agentStats.activeAgents}/{agentStats.totalAgents} Agents Online - {agentStats.decisionsPerSecond} Decisions/sec</span>
          </div>
        </div>
      )}
    </div>
  );
}