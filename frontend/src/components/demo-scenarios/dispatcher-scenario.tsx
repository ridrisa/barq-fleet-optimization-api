'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { 
  Radio, 
  AlertTriangle, 
  Users, 
  Navigation, 
  Clock, 
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Zap,
  RefreshCw,
  Phone,
  MapPin,
  Truck,
  Brain,
  Settings,
  TrendingUp,
  Shield
} from 'lucide-react';

interface DispatcherScenarioProps {
  step: number;
  metrics: any;
  isRunning: boolean;
}

export default function DispatcherScenario({ step, metrics, isRunning }: DispatcherScenarioProps) {
  const [emergencyOrders, setEmergencyOrders] = useState([
    { id: 'EM001', type: 'Vehicle Breakdown', status: 'escalated', priority: 'critical', eta: '2 min' },
    { id: 'EM002', type: 'Customer Emergency', status: 'assigned', priority: 'high', eta: '5 min' },
    { id: 'EM003', type: 'Traffic Incident', status: 'recovering', priority: 'medium', eta: '12 min' }
  ]);
  
  const [agentActivity, setAgentActivity] = useState([
    { id: 'agent-1', name: 'Emergency Escalation', status: 'active', action: 'Processing critical order EM001' },
    { id: 'agent-2', name: 'Order Recovery', status: 'busy', action: 'Rerouting 12 affected deliveries' },
    { id: 'agent-3', name: 'Traffic Monitor', status: 'active', action: 'Analyzing King Fahd Road congestion' },
    { id: 'agent-4', name: 'Master Orchestrator', status: 'coordinating', action: 'Managing agent priorities' }
  ]);

  const [recoveryStats, setRecoveryStats] = useState({
    ordersRecovered: 0,
    avgRecoveryTime: 0,
    successRate: 0
  });

  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        // Simulate emergency order updates
        setEmergencyOrders(prev => prev.map(order => ({
          ...order,
          eta: order.status === 'escalated' ? 
            Math.max(0, parseInt(order.eta) - 1) + ' min' : 
            order.eta
        })));

        // Update recovery stats
        setRecoveryStats(prev => ({
          ordersRecovered: prev.ordersRecovered + Math.floor(Math.random() * 3),
          avgRecoveryTime: 4.2 + (Math.random() * 2 - 1),
          successRate: 94.7 + (Math.random() * 2 - 1)
        }));
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isRunning]);

  const getStepContent = (currentStep: number) => {
    switch (currentStep) {
      case 0: // Emergency Escalation
        return (
          <div className="space-y-6">
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Emergency Escalation System
                </CardTitle>
                <CardDescription>
                  Automated emergency detection and escalation with 2.3-minute average response time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="space-y-3">
                      {emergencyOrders.map((emergency) => (
                        <div key={emergency.id} className={`p-4 border rounded-lg ${
                          emergency.priority === 'critical' ? 'border-red-300 bg-red-50' :
                          emergency.priority === 'high' ? 'border-orange-300 bg-orange-50' :
                          'border-yellow-300 bg-yellow-50'
                        }`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-medium text-sm">Emergency #{emergency.id}</span>
                                <Badge variant={
                                  emergency.priority === 'critical' ? 'destructive' :
                                  emergency.priority === 'high' ? 'default' : 'secondary'
                                }>
                                  {emergency.priority}
                                </Badge>
                              </div>
                              <div className="text-sm text-gray-700 mb-2">{emergency.type}</div>
                              <div className="flex items-center gap-4 text-xs">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  ETA: {emergency.eta}
                                </span>
                                <span className="flex items-center gap-1">
                                  {emergency.status === 'escalated' ? (
                                    <>
                                      <Zap className="w-3 h-3 text-yellow-600" />
                                      <span className="text-yellow-600">Escalated</span>
                                    </>
                                  ) : emergency.status === 'assigned' ? (
                                    <>
                                      <CheckCircle className="w-3 h-3 text-blue-600" />
                                      <span className="text-blue-600">Assigned</span>
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="w-3 h-3 text-green-600" />
                                      <span className="text-green-600">Recovering</span>
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <Button size="sm" variant="outline" className="h-7">
                                <Phone className="w-3 h-3 mr-1" />
                                Contact
                              </Button>
                              <Button size="sm" variant="outline" className="h-7">
                                <MapPin className="w-3 h-3 mr-1" />
                                Track
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Emergency Response Metrics</div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-red-600">2.3 min</div>
                          <div className="text-xs text-gray-600">Avg Response</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">97.2%</div>
                          <div className="text-xs text-gray-600">Resolution Rate</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">18</div>
                          <div className="text-xs text-gray-600">Active Agents</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Escalation Process</div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>1. Auto-Detection</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <span>2. Risk Assessment</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          <span>3. Agent Assignment</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <span>4. Human Escalation</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Emergency Types</div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Vehicle Issues</span>
                          <span className="text-red-600">4 active</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Traffic Incidents</span>
                          <span className="text-orange-600">2 active</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Customer Issues</span>
                          <span className="text-yellow-600">3 active</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Weather Related</span>
                          <span className="text-blue-600">1 active</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 1: // Agent Orchestration
        return (
          <div className="space-y-6">
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-600" />
                  AI Agent Orchestration Center
                </CardTitle>
                <CardDescription>
                  18+ autonomous agents working in perfect coordination to handle complex scenarios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">Master Orchestrator</span>
                        <Badge variant="outline" className="bg-purple-100">
                          <Activity className="w-3 h-3 mr-1" />
                          Coordinating
                        </Badge>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Agent Coordination Efficiency</span>
                            <span className="text-purple-600 font-medium">96.8%</span>
                          </div>
                          <Progress value={96.8} className="h-2" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Decision Making Speed</span>
                            <span className="text-blue-600 font-medium">1.2 sec</span>
                          </div>
                          <Progress value={85} className="h-2" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Conflict Resolution</span>
                            <span className="text-green-600 font-medium">98.4%</span>
                          </div>
                          <Progress value={98.4} className="h-2" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Active Agent Network</div>
                      <div className="space-y-2">
                        {agentActivity.map((agent) => (
                          <div key={agent.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex-1">
                              <div className="text-xs font-medium">{agent.name}</div>
                              <div className="text-xs text-gray-600">{agent.action}</div>
                            </div>
                            <Badge variant={
                              agent.status === 'active' ? 'default' :
                              agent.status === 'busy' ? 'secondary' : 'outline'
                            } className="text-xs">
                              {agent.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Real-time Agent Communications</div>
                      <div className="space-y-2 text-xs">
                        <div className="p-2 border-l-4 border-blue-400 bg-blue-50 rounded">
                          <div className="font-medium">Order Assignment Agent → Traffic Monitor</div>
                          <div className="text-gray-600">"Route alternate path for order BLT-3928"</div>
                          <div className="text-gray-500 text-xs">2 seconds ago</div>
                        </div>
                        
                        <div className="p-2 border-l-4 border-green-400 bg-green-50 rounded">
                          <div className="font-medium">Emergency Agent → Fleet Rebalancer</div>
                          <div className="text-gray-600">"Dispatch backup vehicle to sector 7"</div>
                          <div className="text-gray-500 text-xs">8 seconds ago</div>
                        </div>
                        
                        <div className="p-2 border-l-4 border-purple-400 bg-purple-50 rounded">
                          <div className="font-medium">Master Orchestrator → All Agents</div>
                          <div className="text-gray-600">"Priority shift: Focus on King Fahd area"</div>
                          <div className="text-gray-500 text-xs">15 seconds ago</div>
                        </div>
                        
                        <div className="p-2 border-l-4 border-orange-400 bg-orange-50 rounded">
                          <div className="font-medium">SLA Monitor → Order Recovery</div>
                          <div className="text-gray-600">"23 orders approaching SLA breach"</div>
                          <div className="text-gray-500 text-xs">22 seconds ago</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Agent Performance</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-center p-2 bg-green-50 rounded">
                          <div className="font-bold text-green-600">18</div>
                          <div>Total Agents</div>
                        </div>
                        <div className="text-center p-2 bg-blue-50 rounded">
                          <div className="font-bold text-blue-600">16</div>
                          <div>Active Now</div>
                        </div>
                        <div className="text-center p-2 bg-purple-50 rounded">
                          <div className="font-bold text-purple-600">1,247</div>
                          <div>Decisions/hr</div>
                        </div>
                        <div className="text-center p-2 bg-orange-50 rounded">
                          <div className="font-bold text-orange-600">99.2%</div>
                          <div>Uptime</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 2: // Traffic Adaptation
        return (
          <div className="space-y-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-blue-600" />
                  Real-time Traffic Adaptation
                </CardTitle>
                <CardDescription>
                  Dynamic route optimization based on live traffic conditions and incidents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">Traffic Intelligence System</span>
                        <Badge variant="outline" className="bg-blue-100">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Live Updates
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Route Adaptation Speed</span>
                            <span className="text-blue-600 font-medium">3.2 sec</span>
                          </div>
                          <Progress value={88} className="h-2" />
                          <div className="text-xs text-gray-600 mt-1">Real-time rerouting</div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Traffic Prediction Accuracy</span>
                            <span className="text-green-600 font-medium">91.7%</span>
                          </div>
                          <Progress value={91.7} className="h-2" />
                          <div className="text-xs text-gray-600 mt-1">Next 30 min forecast</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Live Traffic Incidents</div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <div>
                              <div className="text-sm font-medium">King Fahd Road - Major Congestion</div>
                              <div className="text-xs text-gray-600">12 routes affected, 8 vehicles rerouted</div>
                            </div>
                          </div>
                          <Badge variant="destructive">Critical</Badge>
                        </div>
                        
                        <div className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-600" />
                            <div>
                              <div className="text-sm font-medium">Olaya District - Construction</div>
                              <div className="text-xs text-gray-600">4 routes affected, alternative paths active</div>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-yellow-100">Medium</Badge>
                        </div>
                        
                        <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <div>
                              <div className="text-sm font-medium">Al Malaz - Cleared Incident</div>
                              <div className="text-xs text-gray-600">Normal traffic flow restored</div>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-green-100">Resolved</Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Adaptation Statistics</div>
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <div className="text-lg font-bold text-blue-600">247</div>
                          <div className="text-xs text-gray-600">Routes Adapted</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-green-600">18 min</div>
                          <div className="text-xs text-gray-600">Time Saved</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-purple-600">67</div>
                          <div className="text-xs text-gray-600">Vehicles Rerouted</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-orange-600">92.3%</div>
                          <div className="text-xs text-gray-600">On-time Delivery</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Traffic Data Sources</div>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span>Google Traffic API</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span>HERE Live Traffic</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span>Historical Patterns</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span>Driver Feedback</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span>Weather Conditions</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Predictive Insights</div>
                      <div className="space-y-2 text-xs">
                        <div className="p-2 bg-blue-50 rounded">
                          <div className="font-medium">Peak Hour Prediction</div>
                          <div className="text-gray-600">Expected congestion at 17:30</div>
                        </div>
                        <div className="p-2 bg-yellow-50 rounded">
                          <div className="font-medium">Weather Alert</div>
                          <div className="text-gray-600">Rain expected - 15% slower routes</div>
                        </div>
                        <div className="p-2 bg-green-50 rounded">
                          <div className="font-medium">Route Optimization</div>
                          <div className="text-gray-600">23 alternative paths identified</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 3: // Order Recovery
        return (
          <div className="space-y-6">
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-green-600" />
                  Intelligent Order Recovery System
                </CardTitle>
                <CardDescription>
                  Proactive order recovery with 94.7% success rate and autonomous problem resolution
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">Recovery Performance</span>
                        <Badge variant="outline" className="bg-green-100">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Excellent
                        </Badge>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Success Rate</span>
                            <span className="text-green-600 font-medium">{recoveryStats.successRate.toFixed(1)}%</span>
                          </div>
                          <Progress value={recoveryStats.successRate} className="h-2" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Average Recovery Time</span>
                            <span className="text-blue-600 font-medium">{recoveryStats.avgRecoveryTime.toFixed(1)} min</span>
                          </div>
                          <Progress value={85} className="h-2" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Orders Recovered Today</span>
                            <span className="text-purple-600 font-medium">{recoveryStats.ordersRecovered}</span>
                          </div>
                          <Progress value={Math.min(recoveryStats.ordersRecovered / 5, 100)} className="h-2" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Recovery Methods</div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                          <div className="flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 text-blue-600" />
                            <div>
                              <div className="text-sm font-medium">Automatic Reassignment</div>
                              <div className="text-xs text-gray-600">12 orders reassigned</div>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-blue-100">Active</Badge>
                        </div>
                        
                        <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                          <div className="flex items-center gap-2">
                            <Navigation className="w-4 h-4 text-green-600" />
                            <div>
                              <div className="text-sm font-medium">Route Optimization</div>
                              <div className="text-xs text-gray-600">8 routes optimized</div>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-green-100">Running</Badge>
                        </div>
                        
                        <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-purple-600" />
                            <div>
                              <div className="text-sm font-medium">Backup Vehicle Dispatch</div>
                              <div className="text-xs text-gray-600">3 vehicles dispatched</div>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-purple-100">Emergency</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Recovery Actions (Live)</div>
                      <div className="space-y-2 text-xs">
                        <div className="p-2 border-l-4 border-green-400 bg-green-50 rounded">
                          <div className="font-medium">Order BRQ-7834 - RECOVERED</div>
                          <div className="text-gray-600">Vehicle breakdown → Backup assigned</div>
                          <div className="text-gray-500">Recovery time: 3.2 minutes</div>
                        </div>
                        
                        <div className="p-2 border-l-4 border-blue-400 bg-blue-50 rounded">
                          <div className="font-medium">Order BLT-2947 - IN PROGRESS</div>
                          <div className="text-gray-600">Traffic delay → Route optimized</div>
                          <div className="text-gray-500">Expected completion: 2 min</div>
                        </div>
                        
                        <div className="p-2 border-l-4 border-yellow-400 bg-yellow-50 rounded">
                          <div className="font-medium">Order BRQ-5621 - ESCALATED</div>
                          <div className="text-gray-600">Customer issue → Support contacted</div>
                          <div className="text-gray-500">Human intervention required</div>
                        </div>
                        
                        <div className="p-2 border-l-4 border-purple-400 bg-purple-50 rounded">
                          <div className="font-medium">Batch Recovery - INITIATED</div>
                          <div className="text-gray-600">King Fahd incident → 23 orders</div>
                          <div className="text-gray-500">Multi-agent coordination active</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Recovery Analytics</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-center p-2 bg-green-50 rounded">
                          <div className="font-bold text-green-600">89%</div>
                          <div>Auto-Recovery</div>
                        </div>
                        <div className="text-center p-2 bg-blue-50 rounded">
                          <div className="font-bold text-blue-600">11%</div>
                          <div>Human Assisted</div>
                        </div>
                        <div className="text-center p-2 bg-purple-50 rounded">
                          <div className="font-bold text-purple-600">4.2 min</div>
                          <div>Avg Time</div>
                        </div>
                        <div className="text-center p-2 bg-orange-50 rounded">
                          <div className="font-bold text-orange-600">£127</div>
                          <div>Cost Saved/Order</div>
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
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border">
        <Radio className="w-8 h-8 text-green-600" />
        <div className="flex-1">
          <h2 className="text-xl font-bold text-green-800">Dispatcher Workflow Demo</h2>
          <p className="text-sm text-green-600">Real-time emergency handling with autonomous agent coordination</p>
        </div>
        <Badge variant="outline" className="bg-green-100">
          <Clock className="w-3 h-3 mr-1" />
          ~10 minutes
        </Badge>
      </div>
      
      {/* Step Content */}
      {getStepContent(step)}
      
      {/* Status Indicator */}
      {isRunning && (
        <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center justify-center gap-2 text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Dispatcher Center Active - 18 AI Agents Coordinating Operations</span>
          </div>
        </div>
      )}
    </div>
  );
}