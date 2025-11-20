'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { 
  Users, 
  Truck, 
  Navigation, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  MapPin,
  BarChart3,
  Activity,
  Target,
  Zap,
  TrendingUp,
  Settings
} from 'lucide-react';

interface FleetManagerScenarioProps {
  step: number;
  metrics: any;
  isRunning: boolean;
}

export default function FleetManagerScenario({ step, metrics, isRunning }: FleetManagerScenarioProps) {
  const [activeVehicles, setActiveVehicles] = useState(0);
  const [utilization, setUtilization] = useState(0);
  const [slaCompliance, setSlaCompliance] = useState(0);
  
  // Mock real-time fleet data
  const [fleetData, setFleetData] = useState({
    totalVehicles: 834,
    activeVehicles: 672,
    busyVehicles: 458,
    availableVehicles: 214,
    maintenanceVehicles: 43,
    emergencyVehicles: 119
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (isRunning) {
        setFleetData(prev => ({
          ...prev,
          activeVehicles: Math.max(650, Math.min(690, prev.activeVehicles + Math.random() * 20 - 10)),
          busyVehicles: Math.max(400, Math.min(500, prev.busyVehicles + Math.random() * 30 - 15)),
          availableVehicles: Math.max(150, Math.min(250, prev.availableVehicles + Math.random() * 25 - 12))
        }));
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Animation effects
  useEffect(() => {
    if (metrics?.fleetUtilization) {
      const timer = setInterval(() => {
        setUtilization(prev => {
          const target = metrics.fleetUtilization;
          const increment = 0.5;
          return prev < target ? Math.min(prev + increment, target) : target;
        });
      }, 100);
      return () => clearInterval(timer);
    }
  }, [metrics?.fleetUtilization]);

  const getStepContent = (currentStep: number) => {
    switch (currentStep) {
      case 0: // Fleet Status (800+ vehicles)
        return (
          <div className="space-y-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Fleet Status Overview - 834 Total Vehicles
                </CardTitle>
                <CardDescription>
                  Real-time monitoring of all fleet assets across Riyadh operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Fleet Summary */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-white rounded-lg border">
                        <div className="text-2xl font-bold text-green-600">{fleetData.activeVehicles}</div>
                        <div className="text-sm text-gray-600">Active</div>
                        <Badge variant="outline" className="mt-1 bg-green-50">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Online
                        </Badge>
                      </div>
                      <div className="text-center p-4 bg-white rounded-lg border">
                        <div className="text-2xl font-bold text-blue-600">{fleetData.busyVehicles}</div>
                        <div className="text-sm text-gray-600">Busy</div>
                        <Badge variant="outline" className="mt-1 bg-blue-50">
                          <Activity className="w-3 h-3 mr-1" />
                          Delivering
                        </Badge>
                      </div>
                      <div className="text-center p-4 bg-white rounded-lg border">
                        <div className="text-2xl font-bold text-yellow-600">{fleetData.availableVehicles}</div>
                        <div className="text-sm text-gray-600">Available</div>
                        <Badge variant="outline" className="mt-1 bg-yellow-50">
                          <Clock className="w-3 h-3 mr-1" />
                          Ready
                        </Badge>
                      </div>
                      <div className="text-center p-4 bg-white rounded-lg border">
                        <div className="text-2xl font-bold text-orange-600">{fleetData.maintenanceVehicles}</div>
                        <div className="text-sm text-gray-600">Maintenance</div>
                        <Badge variant="outline" className="mt-1 bg-orange-50">
                          <Settings className="w-3 h-3 mr-1" />
                          Service
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-medium">Fleet Utilization</span>
                        <span className="text-lg font-bold text-blue-600">{utilization.toFixed(1)}%</span>
                      </div>
                      <Progress value={utilization} className="h-3" />
                      <div className="text-xs text-gray-600 mt-1">
                        Target: 85% | Industry Average: 72%
                      </div>
                    </div>
                  </div>
                  
                  {/* Live Fleet Map */}
                  <div className="p-4 bg-white rounded-lg border">
                    <div className="text-sm font-medium mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Live Fleet Distribution
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Central Riyadh</span>
                        <span className="text-blue-600">287 vehicles</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>North Riyadh</span>
                        <span className="text-blue-600">198 vehicles</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>South Riyadh</span>
                        <span className="text-blue-600">156 vehicles</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>East Riyadh</span>
                        <span className="text-blue-600">193 vehicles</span>
                      </div>
                    </div>
                    <div className="mt-3 p-2 bg-blue-50 rounded text-xs">
                      <strong>Live Updates:</strong> Vehicle positions updating every 30 seconds via GPS tracking
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 1: // Order Assignment
        return (
          <div className="space-y-6">
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-green-600" />
                  Smart Order Assignment System
                </CardTitle>
                <CardDescription>
                  AI-powered automatic order assignment with real-time optimization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">Assignment Performance</span>
                        <Badge variant="outline" className="bg-green-100">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Excellent
                        </Badge>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Assignment Speed</span>
                            <span className="text-green-600 font-medium">2.3 sec avg</span>
                          </div>
                          <Progress value={92} className="h-2" />
                          <div className="text-xs text-gray-600 mt-1">Target: &lt;3 seconds</div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Assignment Accuracy</span>
                            <span className="text-green-600 font-medium">97.2%</span>
                          </div>
                          <Progress value={97.2} className="h-2" />
                          <div className="text-xs text-gray-600 mt-1">Optimal driver-order matching</div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Route Efficiency</span>
                            <span className="text-blue-600 font-medium">89.5%</span>
                          </div>
                          <Progress value={89.5} className="h-2" />
                          <div className="text-xs text-gray-600 mt-1">Distance optimization</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Assignment Factors</div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Driver proximity (priority weight: 40%)</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Traffic conditions (weight: 25%)</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Driver performance score (weight: 20%)</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Vehicle capacity match (weight: 15%)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Real-time Assignment Log</div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                          <div>
                            <span className="font-medium">Order #BRQ-7834</span>
                            <div className="text-gray-600">→ Driver Ahmad K.</div>
                          </div>
                          <Badge variant="outline" className="bg-green-100">2.1s</Badge>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                          <div>
                            <span className="font-medium">Order #BLT-2947</span>
                            <div className="text-gray-600">→ Driver Fahad M.</div>
                          </div>
                          <Badge variant="outline" className="bg-blue-100">1.8s</Badge>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                          <div>
                            <span className="font-medium">Order #BRQ-5621</span>
                            <div className="text-gray-600">→ Driver Sara A.</div>
                          </div>
                          <Badge variant="outline" className="bg-yellow-100">2.5s</Badge>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                          <div>
                            <span className="font-medium">Order #BLT-8392</span>
                            <div className="text-gray-600">→ Driver Mohammed R.</div>
                          </div>
                          <Badge variant="outline" className="bg-green-100">1.9s</Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">AI Decision Insights</div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span>Orders processed today</span>
                          <span className="font-medium">{metrics?.totalOrders || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Avg assignment time</span>
                          <span className="font-medium text-green-600">2.3s</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Re-assignments needed</span>
                          <span className="font-medium text-blue-600">2.8%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Driver satisfaction</span>
                          <span className="font-medium text-green-600">94.1%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 2: // SLA Compliance
        return (
          <div className="space-y-6">
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-orange-600" />
                  SLA Compliance Tracking & Management
                </CardTitle>
                <CardDescription>
                  Real-time monitoring and proactive SLA management across all service types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-white rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">BARQ SLA (4 hours)</span>
                          <Badge variant="outline" className="bg-green-100">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            On Track
                          </Badge>
                        </div>
                        <div className="text-2xl font-bold text-green-600 mb-1">96.8%</div>
                        <Progress value={96.8} className="h-2" />
                        <div className="text-xs text-gray-600 mt-1">Target: 95% | Current: 96.8%</div>
                      </div>
                      
                      <div className="p-4 bg-white rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">BULLET SLA (1 hour)</span>
                          <Badge variant="outline" className="bg-yellow-100">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Watch
                          </Badge>
                        </div>
                        <div className="text-2xl font-bold text-yellow-600 mb-1">94.2%</div>
                        <Progress value={94.2} className="h-2" />
                        <div className="text-xs text-gray-600 mt-1">Target: 95% | Current: 94.2%</div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-medium">SLA Risk Analysis</span>
                        <Button size="sm" variant="outline">
                          <Zap className="w-3 h-3 mr-1" />
                          Auto-Escalate
                        </Button>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="p-2 border-l-4 border-red-400 bg-red-50 rounded">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-sm font-medium text-red-700">High Risk Orders</span>
                              <div className="text-xs text-red-600">23 orders approaching SLA breach</div>
                            </div>
                            <Badge variant="destructive">Critical</Badge>
                          </div>
                        </div>
                        
                        <div className="p-2 border-l-4 border-yellow-400 bg-yellow-50 rounded">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-sm font-medium text-yellow-700">Medium Risk Orders</span>
                              <div className="text-xs text-yellow-600">67 orders requiring monitoring</div>
                            </div>
                            <Badge variant="outline" className="bg-yellow-100">Warning</Badge>
                          </div>
                        </div>
                        
                        <div className="p-2 border-l-4 border-green-400 bg-green-50 rounded">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-sm font-medium text-green-700">On Track Orders</span>
                              <div className="text-xs text-green-600">1,247 orders within SLA targets</div>
                            </div>
                            <Badge variant="outline" className="bg-green-100">Healthy</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Proactive Actions</div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs">
                          <Activity className="w-3 h-3 text-blue-600" />
                          <span>Auto-reassigning 12 orders</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Zap className="w-3 h-3 text-yellow-600" />
                          <span>Escalated 5 critical orders</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Navigation className="w-3 h-3 text-green-600" />
                          <span>Optimized 23 routes</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <CheckCircle className="w-3 h-3 text-blue-600" />
                          <span>Dispatched 8 backup drivers</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">SLA Trends (24h)</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>00:00 - 06:00</span>
                          <span className="text-green-600">98.2%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>06:00 - 12:00</span>
                          <span className="text-green-600">96.8%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>12:00 - 18:00</span>
                          <span className="text-yellow-600">94.1%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>18:00 - 24:00</span>
                          <span className="text-green-600">97.3%</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 mt-2">
                        Peak hours (12-18) showing increased pressure
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 3: // CVRP Optimization
        return (
          <div className="space-y-6">
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                  CVRP Route Optimization Engine
                </CardTitle>
                <CardDescription>
                  Advanced Capacitated Vehicle Routing Problem solver with real-time optimization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">Optimization Performance</span>
                        <Badge variant="outline" className="bg-purple-100">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Route Efficiency</span>
                            <span className="text-purple-600 font-medium">92.3%</span>
                          </div>
                          <Progress value={92.3} className="h-2" />
                          <div className="text-xs text-gray-600 mt-1">Distance optimization vs manual routing</div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Vehicle Utilization</span>
                            <span className="text-blue-600 font-medium">87.8%</span>
                          </div>
                          <Progress value={87.8} className="h-2" />
                          <div className="text-xs text-gray-600 mt-1">Capacity optimization</div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Time Window Compliance</span>
                            <span className="text-green-600 font-medium">96.1%</span>
                          </div>
                          <Progress value={96.1} className="h-2" />
                          <div className="text-xs text-gray-600 mt-1">Delivery window adherence</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Optimization Results (Last Run)</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>Orders processed</span>
                          <span className="font-medium">156 orders</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Vehicles used</span>
                          <span className="font-medium text-blue-600">23 vehicles</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Total distance saved</span>
                          <span className="font-medium text-green-600">284 km</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Time saved</span>
                          <span className="font-medium text-green-600">3.2 hours</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Fuel saved</span>
                          <span className="font-medium text-green-600">SAR 1,240</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">CVRP Algorithm Details</div>
                      <div className="space-y-2 text-xs">
                        <div className="p-2 bg-purple-50 rounded">
                          <div className="font-medium">Genetic Algorithm + Machine Learning</div>
                          <div className="text-gray-600 mt-1">
                            Hybrid approach combining evolutionary optimization with AI learning
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-green-600" />
                            <span>Multi-depot support</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-green-600" />
                            <span>Time window constraints</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-green-600" />
                            <span>Vehicle capacity limits</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-green-600" />
                            <span>Real-time traffic integration</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-green-600" />
                            <span>Driver preferences</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Real-time Optimization Queue</div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                          <div>
                            <span className="font-medium">BULLET Batch #247</span>
                            <div className="text-gray-600">34 orders, 5 vehicles</div>
                          </div>
                          <Badge variant="outline" className="bg-blue-100">Processing</Badge>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                          <div>
                            <span className="font-medium">BARQ Batch #145</span>
                            <div className="text-gray-600">67 orders, 12 vehicles</div>
                          </div>
                          <Badge variant="outline" className="bg-yellow-100">Queued</Badge>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                          <div>
                            <span className="font-medium">BULLET Batch #246</span>
                            <div className="text-gray-600">23 orders, 4 vehicles</div>
                          </div>
                          <Badge variant="outline" className="bg-green-100">Completed</Badge>
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
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border">
        <Users className="w-8 h-8 text-blue-600" />
        <div className="flex-1">
          <h2 className="text-xl font-bold text-blue-800">Fleet Manager Operations Demo</h2>
          <p className="text-sm text-blue-600">Live fleet monitoring with 800+ vehicles and advanced optimization</p>
        </div>
        <Badge variant="outline" className="bg-blue-100">
          <Clock className="w-3 h-3 mr-1" />
          ~7 minutes
        </Badge>
      </div>
      
      {/* Step Content */}
      {getStepContent(step)}
      
      {/* Status Indicator */}
      {isRunning && (
        <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-center gap-2 text-blue-600">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Fleet Operations Running - Real-time Data from 834 Vehicles</span>
          </div>
        </div>
      )}
    </div>
  );
}