'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  DollarSign, 
  TrendingUp, 
  Target, 
  BarChart3, 
  ArrowUp, 
  ArrowDown,
  Crown,
  Shield,
  Clock,
  CheckCircle
} from 'lucide-react';

interface ExecutiveScenarioProps {
  step: number;
  metrics: any;
  isRunning: boolean;
}

export default function ExecutiveScenario({ step, metrics, isRunning }: ExecutiveScenarioProps) {
  const [animatedSavings, setAnimatedSavings] = useState(0);
  const [animatedEfficiency, setAnimatedEfficiency] = useState(0);
  const [animatedSLA, setAnimatedSLA] = useState(0);

  // Animation effects
  useEffect(() => {
    if (metrics?.totalSavings) {
      const timer = setInterval(() => {
        setAnimatedSavings(prev => {
          const target = metrics.totalSavings;
          const increment = target / 100;
          return prev < target ? Math.min(prev + increment, target) : target;
        });
      }, 50);
      return () => clearInterval(timer);
    }
  }, [metrics?.totalSavings]);

  useEffect(() => {
    if (metrics?.benchmarkEfficiency) {
      const timer = setInterval(() => {
        setAnimatedEfficiency(prev => {
          const target = metrics.benchmarkEfficiency;
          const increment = 0.5;
          return prev < target ? Math.min(prev + increment, target) : target;
        });
      }, 100);
      return () => clearInterval(timer);
    }
  }, [metrics?.benchmarkEfficiency]);

  useEffect(() => {
    if (metrics?.slaCompliance) {
      const timer = setInterval(() => {
        setAnimatedSLA(prev => {
          const target = metrics.slaCompliance;
          const increment = 0.3;
          return prev < target ? Math.min(prev + increment, target) : target;
        });
      }, 100);
      return () => clearInterval(timer);
    }
  }, [metrics?.slaCompliance]);

  const getStepContent = (currentStep: number) => {
    switch (currentStep) {
      case 0: // Real-time KPIs
        return (
          <div className="space-y-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Real-time KPIs Overview
                </CardTitle>
                <CardDescription>
                  Live performance indicators across the entire fleet operation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-white rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{metrics?.totalOrders || 0}</div>
                    <div className="text-sm text-gray-600">Total Orders Today</div>
                    <Badge variant="outline" className="mt-1">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      +12.5%
                    </Badge>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{metrics?.completedOrders || 0}</div>
                    <div className="text-sm text-gray-600">Completed Orders</div>
                    <Badge variant="outline" className="mt-1">
                      <ArrowUp className="w-3 h-3 mr-1" />
                      +8.3%
                    </Badge>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{metrics?.activeDrivers || 0}</div>
                    <div className="text-sm text-gray-600">Active Fleet</div>
                    <Badge variant="outline" className="mt-1">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      834 Total
                    </Badge>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{(metrics?.slaCompliance || 0).toFixed(1)}%</div>
                    <div className="text-sm text-gray-600">SLA Compliance</div>
                    <Badge variant="outline" className="mt-1">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      On Target
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 1: // ROI Calculations
        return (
          <div className="space-y-6">
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  ROI Analysis & Financial Impact
                </CardTitle>
                <CardDescription>
                  Comprehensive return on investment calculations and cost-benefit analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Annual Savings</span>
                        <Badge variant="outline" className="bg-green-100">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          +274%
                        </Badge>
                      </div>
                      <div className="text-3xl font-bold text-green-600 mb-1">
                        SAR {(animatedSavings / 1000000).toFixed(2)}M
                      </div>
                      <Progress value={(animatedSavings / 10950000) * 100} className="h-2" />
                      <div className="text-xs text-gray-600 mt-1">
                        Target: SAR 10.95M annually
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-2">Cost Breakdown</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Fuel Optimization</span>
                          <span className="text-green-600">SAR 4.2M</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Route Efficiency</span>
                          <span className="text-green-600">SAR 3.8M</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Labor Optimization</span>
                          <span className="text-green-600">SAR 2.1M</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>SLA Improvements</span>
                          <span className="text-green-600">SAR 0.85M</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-2">Investment ROI</div>
                      <div className="text-2xl font-bold text-blue-600 mb-2">428%</div>
                      <div className="text-xs text-gray-600 mb-3">
                        Return on investment within 18 months
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Initial Investment</span>
                          <span>SAR 2.56M</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Annual Return</span>
                          <span className="text-green-600">SAR 10.95M</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-medium mb-2">Operational Metrics</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Delivery Time Reduction</span>
                          <span className="text-blue-600">-32%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Fleet Utilization</span>
                          <span className="text-blue-600">+45%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Customer Satisfaction</span>
                          <span className="text-blue-600">+28%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 2: // Performance Benchmarks
        return (
          <div className="space-y-6">
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  Performance Benchmarks vs Industry
                </CardTitle>
                <CardDescription>
                  How our AI-powered system compares to industry standards
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <div className="text-center p-4 bg-white rounded-lg border">
                      <div className="text-lg font-semibold text-purple-600 mb-2">Delivery Efficiency</div>
                      <div className="text-3xl font-bold text-green-600 mb-1">
                        {animatedEfficiency.toFixed(1)}%
                      </div>
                      <Progress value={animatedEfficiency} className="h-2 mb-2" />
                      <Badge variant="outline" className="bg-green-100">
                        <ArrowUp className="w-3 h-3 mr-1" />
                        +24% vs Industry
                      </Badge>
                      <div className="text-xs text-gray-600 mt-2">
                        Industry Average: 70.5%
                      </div>
                    </div>
                    
                    <div className="p-3 bg-white rounded border">
                      <div className="text-sm font-medium">Key Factors</div>
                      <div className="text-xs text-gray-600 mt-1 space-y-1">
                        <div>• AI Route Optimization</div>
                        <div>• Real-time Traffic Analysis</div>
                        <div>• Predictive Maintenance</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="text-center p-4 bg-white rounded-lg border">
                      <div className="text-lg font-semibold text-blue-600 mb-2">SLA Performance</div>
                      <div className="text-3xl font-bold text-green-600 mb-1">
                        {animatedSLA.toFixed(1)}%
                      </div>
                      <Progress value={animatedSLA} className="h-2 mb-2" />
                      <Badge variant="outline" className="bg-green-100">
                        <ArrowUp className="w-3 h-3 mr-1" />
                        +18% vs Industry
                      </Badge>
                      <div className="text-xs text-gray-600 mt-2">
                        Industry Average: 78.9%
                      </div>
                    </div>
                    
                    <div className="p-3 bg-white rounded border">
                      <div className="text-sm font-medium">Improvements</div>
                      <div className="text-xs text-gray-600 mt-1 space-y-1">
                        <div>• Autonomous Escalation</div>
                        <div>• Smart Reassignment</div>
                        <div>• Proactive Monitoring</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="text-center p-4 bg-white rounded-lg border">
                      <div className="text-lg font-semibold text-orange-600 mb-2">Cost Efficiency</div>
                      <div className="text-3xl font-bold text-green-600 mb-1">87.3%</div>
                      <Progress value={87.3} className="h-2 mb-2" />
                      <Badge variant="outline" className="bg-green-100">
                        <ArrowUp className="w-3 h-3 mr-1" />
                        +31% vs Industry
                      </Badge>
                      <div className="text-xs text-gray-600 mt-2">
                        Industry Average: 56.2%
                      </div>
                    </div>
                    
                    <div className="p-3 bg-white rounded border">
                      <div className="text-sm font-medium">Cost Savings</div>
                      <div className="text-xs text-gray-600 mt-1 space-y-1">
                        <div>• Fuel Optimization</div>
                        <div>• Route Efficiency</div>
                        <div>• Asset Utilization</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 3: // Cost Savings Analysis
        return (
          <div className="space-y-6">
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-orange-600" />
                  Comprehensive Cost Savings Analysis
                </CardTitle>
                <CardDescription>
                  Detailed breakdown of cost optimization across all operational areas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold">Monthly Savings Breakdown</span>
                        <Badge variant="outline" className="bg-green-100">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Consistent Growth
                        </Badge>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Fuel Costs</span>
                            <span className="text-green-600 font-medium">-SAR 350K</span>
                          </div>
                          <Progress value={85} className="h-1" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Labor Optimization</span>
                            <span className="text-green-600 font-medium">-SAR 175K</span>
                          </div>
                          <Progress value={70} className="h-1" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Vehicle Maintenance</span>
                            <span className="text-green-600 font-medium">-SAR 120K</span>
                          </div>
                          <Progress value={60} className="h-1" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Route Optimization</span>
                            <span className="text-green-600 font-medium">-SAR 285K</span>
                          </div>
                          <Progress value={90} className="h-1" />
                        </div>
                      </div>
                      
                      <div className="border-t pt-3 mt-4">
                        <div className="flex justify-between font-semibold">
                          <span>Total Monthly Savings</span>
                          <span className="text-green-600">SAR 930K</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-semibold mb-3">Year-over-Year Impact</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>2023 Baseline</span>
                          <span className="text-gray-600">SAR 45.2M</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>2024 Projected</span>
                          <span className="text-blue-600">SAR 34.25M</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium">
                          <span>Net Savings</span>
                          <span className="text-green-600">SAR 10.95M</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-semibold mb-3">Operational Efficiency Gains</div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Fleet Utilization</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-green-600">+45%</span>
                            <ArrowUp className="w-4 h-4 text-green-600" />
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Delivery Speed</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-green-600">+32%</span>
                            <ArrowUp className="w-4 h-4 text-green-600" />
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Route Efficiency</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-green-600">+28%</span>
                            <ArrowUp className="w-4 h-4 text-green-600" />
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Customer Satisfaction</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-green-600">+38%</span>
                            <ArrowUp className="w-4 h-4 text-green-600" />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border">
                      <div className="text-sm font-semibold mb-3">Strategic Benefits</div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Market competitive advantage</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Scalable growth platform</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Enhanced data insights</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Future-ready infrastructure</span>
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
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border">
        <Crown className="w-8 h-8 text-purple-600" />
        <div className="flex-1">
          <h2 className="text-xl font-bold text-purple-800">Executive Dashboard Demo</h2>
          <p className="text-sm text-purple-600">Strategic overview with ROI analysis and performance benchmarks</p>
        </div>
        <Badge variant="outline" className="bg-purple-100">
          <Clock className="w-3 h-3 mr-1" />
          ~5 minutes
        </Badge>
      </div>
      
      {/* Step Content */}
      {getStepContent(step)}
      
      {/* Status Indicator */}
      {isRunning && (
        <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center justify-center gap-2 text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Live Demo Running - Data Updating in Real-time</span>
          </div>
        </div>
      )}
    </div>
  );
}