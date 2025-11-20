'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Database, 
  Brain,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
  Zap,
  ArrowUp,
  ArrowDown,
  Calendar,
  Users,
  Navigation,
  Package
} from 'lucide-react';

interface AnalyticsScenarioProps {
  step: number;
  metrics: any;
  isRunning: boolean;
}

export default function AnalyticsScenario({ step, metrics, isRunning }: AnalyticsScenarioProps) {
  const [animatedMetrics, setAnimatedMetrics] = useState({
    totalDeliveries: 0,
    routeEfficiency: 0,
    forecastAccuracy: 0
  });

  const [realTimeData, setRealTimeData] = useState({
    currentDeliveries: 7444,
    avgRouteDistance: 0,
    predictedDemand: 0,
    efficiencyGain: 0
  });

  // BarqFleet production data simulation
  const [productionInsights, setProductionInsights] = useState({
    peakHours: ['12:00-14:00', '18:00-20:00'],
    topPerformingAreas: ['Central Riyadh', 'Al Malaz', 'King Fahd District'],
    demandPatterns: [
      { time: '06:00', demand: 45 },
      { time: '12:00', demand: 189 },
      { time: '18:00', demand: 234 },
      { time: '22:00', demand: 123 }
    ]
  });

  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        setRealTimeData(prev => ({
          currentDeliveries: 7444 + Math.floor(Math.random() * 100),
          avgRouteDistance: 12.3 + (Math.random() * 2 - 1),
          predictedDemand: 1250 + Math.floor(Math.random() * 200 - 100),
          efficiencyGain: 92.3 + (Math.random() * 3 - 1.5)
        }));
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isRunning]);

  // Animation effects
  useEffect(() => {
    if (metrics?.totalAnalyzedDeliveries) {
      const timer = setInterval(() => {
        setAnimatedMetrics(prev => ({
          totalDeliveries: Math.min(prev.totalDeliveries + 50, metrics.totalAnalyzedDeliveries),
          routeEfficiency: Math.min(prev.routeEfficiency + 0.5, metrics.routeEfficiency || 92.3),
          forecastAccuracy: Math.min(prev.forecastAccuracy + 0.3, metrics.forecastAccuracy || 89.7)
        }));
      }, 100);
      return () => clearInterval(timer);
    }
  }, [metrics?.totalAnalyzedDeliveries, metrics?.routeEfficiency, metrics?.forecastAccuracy]);

  const getStepContent = (currentStep: number) => {
    switch (currentStep) {
      case 0: // Demand Forecasting
        return (
          <div className="space-y-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-blue-600" />
                  Advanced Demand Forecasting Engine
                </CardTitle>
                <CardDescription>
                  AI-powered demand prediction using historical data, weather, events, and market trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">Forecast Accuracy</span>
                        <Badge variant="outline" className="bg-green-100">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          {animatedMetrics.forecastAccuracy.toFixed(1)}%
                        </Badge>
                      </div>
                      
                      <Progress value={animatedMetrics.forecastAccuracy} className="h-3 mb-2" />
                      <div className="text-xs text-gray-600 mb-4">
                        Industry benchmark: 78.2% | Our AI: {animatedMetrics.forecastAccuracy.toFixed(1)}%
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-2 bg-blue-50 rounded">
                          <div className="text-lg font-bold text-blue-600">{realTimeData.predictedDemand}</div>
                          <div className="text-xs text-gray-600">Next Hour Demand</div>
                        </div>
                        <div className="text-center p-2 bg-green-50 rounded">
                          <div className="text-lg font-bold text-green-600">+15.2%</div>
                          <div className="text-xs text-gray-600">vs Last Week</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-white rounded-lg border">
                        <div className="text-sm font-medium mb-3">Peak Demand Windows</div>
                        <div className="space-y-2">
                          {productionInsights.peakHours.map((hour, index) => (
                            <div key={index} className="flex justify-between items-center p-2 bg-orange-50 rounded">
                              <span className="text-sm">{hour}</span>
                              <Badge variant="outline" className="bg-orange-100">
                                <Clock className="w-3 h-3 mr-1" />
                                Peak
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="p-4 bg-white rounded-lg border">
                        <div className="text-sm font-medium mb-3">Demand Factors</div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span>Weather Impact</span>
                            <span className="text-blue-600 font-medium">12%</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span>Event Influence</span>
                            <span className="text-green-600 font-medium">8%</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span>Seasonal Trends</span>
                            <span className="text-purple-600 font-medium">25%</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span>Historical Patterns</span>
                            <span className="text-orange-600 font-medium">55%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Live Demand Analysis</div>
                      <div className="space-y-3">
                        {productionInsights.demandPatterns.map((pattern, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-xs">{pattern.time}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full" 
                                  style={{ width: `${(pattern.demand / 250) * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-medium w-8">{pattern.demand}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">AI Model Performance</div>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span>LSTM Neural Network</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span>XGBoost Ensemble</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span>Time Series Analysis</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span>External Data Integration</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 1: // Route Analysis (7,444 deliveries)
        return (
          <div className="space-y-6">
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-green-600" />
                  Route Efficiency Analysis - 7,444 Deliveries
                </CardTitle>
                <CardDescription>
                  Comprehensive analysis of BarqFleet production route data with performance insights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">Overall Route Efficiency</span>
                        <Badge variant="outline" className="bg-green-100">
                          <ArrowUp className="w-3 h-3 mr-1" />
                          Excellent
                        </Badge>
                      </div>
                      
                      <div className="text-center mb-4">
                        <div className="text-4xl font-bold text-green-600 mb-1">
                          {animatedMetrics.routeEfficiency.toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-600">
                          Analyzing {realTimeData.currentDeliveries.toLocaleString()} deliveries
                        </div>
                      </div>
                      
                      <Progress value={animatedMetrics.routeEfficiency} className="h-3 mb-2" />
                      <div className="text-xs text-gray-600">
                        Target: 85% | Achieved: {animatedMetrics.routeEfficiency.toFixed(1)}%
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Route Optimization Results</div>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Distance Reduction</span>
                            <span className="text-green-600 font-medium">-28.4%</span>
                          </div>
                          <Progress value={71.6} className="h-2" />
                          <div className="text-xs text-gray-600 mt-1">vs Manual routing</div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Time Savings</span>
                            <span className="text-blue-600 font-medium">-32.1%</span>
                          </div>
                          <Progress value={67.9} className="h-2" />
                          <div className="text-xs text-gray-600 mt-1">Average delivery time</div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Fuel Efficiency</span>
                            <span className="text-purple-600 font-medium">+34.7%</span>
                          </div>
                          <Progress value={87.3} className="h-2" />
                          <div className="text-xs text-gray-600 mt-1">Cost per kilometer</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Performance by Area (Production Data)</div>
                      <div className="space-y-2">
                        {productionInsights.topPerformingAreas.map((area, index) => {
                          const efficiency = [94.2, 91.8, 89.3][index];
                          return (
                            <div key={index} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>{area}</span>
                                <span className="font-medium text-green-600">{efficiency}%</span>
                              </div>
                              <Progress value={efficiency} className="h-1" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Route Analysis Insights</div>
                      <div className="space-y-2 text-xs">
                        <div className="p-2 bg-green-50 rounded border-l-4 border-green-400">
                          <div className="font-medium">Optimal Routes Identified</div>
                          <div className="text-gray-600">2,847 routes optimized for peak efficiency</div>
                        </div>
                        
                        <div className="p-2 bg-blue-50 rounded border-l-4 border-blue-400">
                          <div className="font-medium">Traffic Pattern Learning</div>
                          <div className="text-gray-600">AI learned from 45,000+ traffic scenarios</div>
                        </div>
                        
                        <div className="p-2 bg-purple-50 rounded border-l-4 border-purple-400">
                          <div className="font-medium">Dynamic Adaptation</div>
                          <div className="text-gray-600">Real-time route adjustments every 2.3 seconds</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Cost Impact</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-center p-2 bg-green-50 rounded">
                          <div className="font-bold text-green-600">SAR 3.8M</div>
                          <div>Annual Savings</div>
                        </div>
                        <div className="text-center p-2 bg-blue-50 rounded">
                          <div className="font-bold text-blue-600">28.4%</div>
                          <div>Cost Reduction</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 2: // Fleet Performance
        return (
          <div className="space-y-6">
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  Fleet Performance Intelligence
                </CardTitle>
                <CardDescription>
                  Advanced analytics on driver performance, vehicle efficiency, and operational metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-white rounded-lg border text-center">
                        <div className="text-2xl font-bold text-purple-600">834</div>
                        <div className="text-sm text-gray-600 mb-2">Total Vehicles</div>
                        <Badge variant="outline" className="bg-purple-100">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          +12% YoY
                        </Badge>
                      </div>
                      
                      <div className="p-4 bg-white rounded-lg border text-center">
                        <div className="text-2xl font-bold text-blue-600">87.3%</div>
                        <div className="text-sm text-gray-600 mb-2">Fleet Utilization</div>
                        <Badge variant="outline" className="bg-blue-100">
                          <ArrowUp className="w-3 h-3 mr-1" />
                          +45% vs Target
                        </Badge>
                      </div>
                      
                      <div className="p-4 bg-white rounded-lg border text-center">
                        <div className="text-2xl font-bold text-green-600">98.2%</div>
                        <div className="text-sm text-gray-600 mb-2">Vehicle Uptime</div>
                        <Badge variant="outline" className="bg-green-100">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Excellent
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">Driver Performance Analytics</span>
                        <Button size="sm" variant="outline">
                          <BarChart3 className="w-3 h-3 mr-1" />
                          View Details
                        </Button>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Top 10% Performers</span>
                            <span className="text-green-600 font-medium">95.2% efficiency</span>
                          </div>
                          <Progress value={95.2} className="h-2" />
                          <div className="text-xs text-gray-600 mt-1">84 drivers in top tier</div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Average Performance</span>
                            <span className="text-blue-600 font-medium">87.8% efficiency</span>
                          </div>
                          <Progress value={87.8} className="h-2" />
                          <div className="text-xs text-gray-600 mt-1">623 drivers meeting standards</div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Improvement Needed</span>
                            <span className="text-orange-600 font-medium">78.1% efficiency</span>
                          </div>
                          <Progress value={78.1} className="h-2" />
                          <div className="text-xs text-gray-600 mt-1">127 drivers in training program</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Performance Factors</div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span>Route Adherence</span>
                          <span className="font-medium text-green-600">92.4%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>On-time Delivery</span>
                          <span className="font-medium text-blue-600">89.7%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Fuel Efficiency</span>
                          <span className="font-medium text-purple-600">94.1%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Customer Rating</span>
                          <span className="font-medium text-orange-600">4.6/5</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">AI Insights</div>
                      <div className="space-y-2 text-xs">
                        <div className="p-2 bg-blue-50 rounded">
                          <div className="font-medium">Pattern Recognition</div>
                          <div className="text-gray-600">Identified 12 efficiency patterns</div>
                        </div>
                        <div className="p-2 bg-green-50 rounded">
                          <div className="font-medium">Predictive Maintenance</div>
                          <div className="text-gray-600">23 vehicles flagged for service</div>
                        </div>
                        <div className="p-2 bg-purple-50 rounded">
                          <div className="font-medium">Training Recommendations</div>
                          <div className="text-gray-600">Personalized plans for 127 drivers</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 3: // Predictive Analytics
        return (
          <div className="space-y-6">
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-orange-600" />
                  Predictive Analytics Engine
                </CardTitle>
                <CardDescription>
                  Advanced machine learning models predicting future trends and optimizing operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">Prediction Accuracy</span>
                        <Badge variant="outline" className="bg-orange-100">
                          <Brain className="w-3 h-3 mr-1" />
                          AI Powered
                        </Badge>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Demand Forecasting (24h)</span>
                            <span className="text-orange-600 font-medium">94.2%</span>
                          </div>
                          <Progress value={94.2} className="h-2" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Route Optimization (Real-time)</span>
                            <span className="text-blue-600 font-medium">96.8%</span>
                          </div>
                          <Progress value={96.8} className="h-2" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>SLA Breach Prediction</span>
                            <span className="text-green-600 font-medium">91.3%</span>
                          </div>
                          <Progress value={91.3} className="h-2" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Predictive Models</div>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                          <div>
                            <div className="font-medium">LSTM Deep Learning</div>
                            <div className="text-gray-600">Time series forecasting</div>
                          </div>
                          <Badge variant="outline" className="bg-blue-100">Active</Badge>
                        </div>
                        
                        <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                          <div>
                            <div className="font-medium">Random Forest</div>
                            <div className="text-gray-600">Route optimization</div>
                          </div>
                          <Badge variant="outline" className="bg-green-100">Active</Badge>
                        </div>
                        
                        <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
                          <div>
                            <div className="font-medium">XGBoost Ensemble</div>
                            <div className="text-gray-600">Performance prediction</div>
                          </div>
                          <Badge variant="outline" className="bg-purple-100">Active</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Future Predictions (Next 7 Days)</div>
                      <div className="space-y-3">
                        <div className="p-2 border rounded">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium">Expected Orders</span>
                            <TrendingUp className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="text-lg font-bold text-blue-600">18,450</div>
                          <div className="text-xs text-gray-600">+12.3% vs last week</div>
                        </div>
                        
                        <div className="p-2 border rounded">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium">Peak Load Day</span>
                            <AlertCircle className="w-4 h-4 text-orange-600" />
                          </div>
                          <div className="text-lg font-bold text-orange-600">Thursday</div>
                          <div className="text-xs text-gray-600">Prepare 15% more capacity</div>
                        </div>
                        
                        <div className="p-2 border rounded">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium">Efficiency Gain</span>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="text-lg font-bold text-green-600">+8.7%</div>
                          <div className="text-xs text-gray-600">Continuous improvement</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-3">Risk Assessment</div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                          <span>High Traffic Areas</span>
                          <Badge variant="destructive">3 zones</Badge>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                          <span>Weather Impact</span>
                          <Badge variant="outline" className="bg-yellow-100">Medium</Badge>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                          <span>Overall Risk</span>
                          <Badge variant="outline" className="bg-green-100">Low</Badge>
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
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border">
        <BarChart3 className="w-8 h-8 text-orange-600" />
        <div className="flex-1">
          <h2 className="text-xl font-bold text-orange-800">Analytics Deep Dive Demo</h2>
          <p className="text-sm text-orange-600">BarqFleet production data insights with 7,444 deliveries analyzed</p>
        </div>
        <Badge variant="outline" className="bg-orange-100">
          <Clock className="w-3 h-3 mr-1" />
          ~8 minutes
        </Badge>
      </div>
      
      {/* Step Content */}
      {getStepContent(step)}
      
      {/* Status Indicator */}
      {isRunning && (
        <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-center justify-center gap-2 text-orange-600">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Analytics Engine Active - Processing {realTimeData.currentDeliveries.toLocaleString()} Delivery Records</span>
          </div>
        </div>
      )}
    </div>
  );
}