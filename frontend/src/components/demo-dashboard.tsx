'use client';

import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Progress } from './ui/progress';
import { apiClient } from '@/lib/api-client';
import {
  Activity,
  Package,
  Truck,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle,
  XCircle,
  PlayCircle,
  StopCircle,
  RefreshCw,
  Users,
  Settings,
  BarChart3,
  Brain,
  Zap,
  FastForward,
  Pause,
  SkipForward,
  ChevronRight,
  ChevronLeft,
  Crown,
  UserCheck,
  Radio,
  TrendingUp,
  DollarSign,
  Target,
  Shield
} from 'lucide-react';
import { RootState, AppDispatch } from '@/store/store';
import ExecutiveScenario from './demo-scenarios/executive-scenario';
import FleetManagerScenario from './demo-scenarios/fleet-manager-scenario';
import DispatcherScenario from './demo-scenarios/dispatcher-scenario';
import AnalyticsScenario from './demo-scenarios/analytics-scenario';
import AIAgentsScenario from './demo-scenarios/ai-agents-scenario';
import {
  setConnectionStatus,
  setDemoStatus,
  addOrder,
  updateOrder,
  updateDriver,
  updateMetrics,
  addEvent,
  resetDemo,
} from '@/store/demoSlice';
import { useWebSocket } from '@/hooks/useWebSocket';

// Demo scenario definitions
const DEMO_SCENARIOS = [
  {
    id: 'executive',
    title: 'Executive Dashboard',
    subtitle: 'Strategic Overview & ROI Analysis',
    duration: 5,
    icon: Crown,
    description: 'High-level KPIs, cost savings (SAR 10.95M/year), and business impact',
    highlights: ['Real-time KPIs', 'ROI Calculations', 'Performance Benchmarks', 'Cost Savings Analysis'],
    color: 'purple'
  },
  {
    id: 'fleet-manager',
    title: 'Fleet Manager',
    subtitle: 'Operations & Optimization',
    duration: 7,
    icon: Users,
    description: 'Live fleet monitoring (800+ vehicles), route optimization, SLA tracking',
    highlights: ['Fleet Status (800+ vehicles)', 'Order Assignment', 'SLA Compliance', 'CVRP Optimization'],
    color: 'blue'
  },
  {
    id: 'dispatcher',
    title: 'Dispatcher Workflow',
    subtitle: 'Real-time Operations',
    duration: 10,
    icon: Radio,
    description: 'Emergency handling, autonomous agents, traffic adaptation, order recovery',
    highlights: ['Emergency Escalation', 'Agent Orchestration', 'Traffic Adaptation', 'Order Recovery'],
    color: 'green'
  },
  {
    id: 'analytics',
    title: 'Analytics Deep Dive',
    subtitle: 'Data Intelligence',
    duration: 8,
    icon: BarChart3,
    description: 'Demand forecasting, performance insights, predictive analytics with real data',
    highlights: ['Demand Forecasting', 'Route Analysis (7,444 deliveries)', 'Fleet Performance', 'Predictive Analytics'],
    color: 'orange'
  },
  {
    id: 'ai-agents',
    title: 'AI Agent Showcase',
    subtitle: '18+ Autonomous Agents',
    duration: 10,
    icon: Brain,
    description: 'Master orchestrator, agent coordination, autonomous decision-making',
    highlights: ['18+ AI Agents', 'Master Orchestrator', 'Real-time Decisions', 'Autonomous Operations'],
    color: 'pink'
  },
  {
    id: 'integration',
    title: 'Full System Integration',
    subtitle: 'End-to-End Workflow',
    duration: 5,
    icon: Zap,
    description: 'Complete order lifecycle, multi-agent coordination, real-time optimization',
    highlights: ['End-to-End Lifecycle', 'Multi-agent Coordination', 'Real-time Optimization', 'Complete Automation'],
    color: 'indigo'
  }
];

export default function DemoDashboard() {
  const dispatch = useDispatch<AppDispatch>();
  const { isConnected, isRunning, orders, drivers, metrics, events, config } = useSelector(
    (state: RootState) => state.demo
  );

  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [demoAvailable, setDemoAvailable] = useState(false);
  
  // New demo scenario state
  const [currentScenario, setCurrentScenario] = useState<string | null>(null);
  const [scenarioStep, setScenarioStep] = useState(0);
  const [scenarioProgress, setScenarioProgress] = useState(0);
  const [isScenarioRunning, setIsScenarioRunning] = useState(false);
  const [scenarioSpeed, setScenarioSpeed] = useState(1);
  const [showScenarioSelector, setShowScenarioSelector] = useState(true);

  // Check if demo is available (HTTP-only, no WebSocket required)
  React.useEffect(() => {
    const checkDemoAvailability = async () => {
      try {
        const response = await apiClient.get('/demo/status');
        if (response.success !== undefined) {
          setDemoAvailable(true);
          dispatch(setConnectionStatus(true));
          // Update demo status from backend
          if (response.data?.isRunning) {
            dispatch(setDemoStatus(true));
          } else {
            dispatch(setDemoStatus(false));
          }

          // Update metrics from backend stats
          if (response.data?.stats) {
            dispatch(updateMetrics({
              totalOrders: response.data.stats.totalOrders || 0,
              completedOrders: response.data.stats.completedOrders || 0,
              failedOrders: response.data.stats.failedOrders || 0,
              activeOrders: response.data.stats.activeOrders || 0,
              activeDrivers: response.data.stats.activeDrivers || 0,
              busyDrivers: response.data.stats.busyDrivers || 0,
              averageDeliveryTime: response.data.stats.averageDeliveryTime || 0,
              slaCompliance: response.data.stats.slaCompliance || 100,
            }));
          }
        }
      } catch (error) {
        console.error('Demo not available:', error);
        setDemoAvailable(false);
        dispatch(setConnectionStatus(false));
      }
    };

    checkDemoAvailability();

    // Poll status every 5 seconds when demo is running
    const interval = setInterval(() => {
      if (isRunning) {
        checkDemoAvailability();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isRunning, dispatch]);

  // WebSocket connection (optional - gracefully degrades if not available)
  useWebSocket({
    url: apiClient.getWsUrl(),
    onOpen: () => {
      // WebSocket is just a bonus - demo works without it
      console.log('WebSocket connected (enhanced mode)');
    },
    onClose: () => {
      // Demo still works via HTTP polling
      console.log('WebSocket disconnected (using HTTP mode)');
    },
    onMessage: (message) => {
      handleWebSocketMessage(message);
    },
  });

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'orderCreated':
        dispatch(addOrder(message.data.order));
        dispatch(
          addEvent({
            id: `event-${Date.now()}`,
            type: 'order',
            message: `New ${message.data.order.serviceType} order created`,
            timestamp: new Date().toISOString(),
            level: 'info',
          })
        );
        break;

      case 'orderAssigned':
        dispatch(
          updateOrder({
            id: message.data.orderId,
            status: 'assigned',
            driverId: message.data.driverId,
          })
        );
        dispatch(
          addEvent({
            id: `event-${Date.now()}`,
            type: 'assignment',
            message: `Order assigned to driver`,
            timestamp: new Date().toISOString(),
            level: 'success',
          })
        );
        break;

      case 'orderPickedUp':
        dispatch(
          updateOrder({
            id: message.data.orderId,
            status: 'picked_up',
          })
        );
        break;

      case 'orderDelivered':
        dispatch(
          updateOrder({
            id: message.data.orderId,
            status: 'delivered',
          })
        );
        dispatch(
          addEvent({
            id: `event-${Date.now()}`,
            type: 'delivery',
            message: `Order delivered successfully`,
            timestamp: new Date().toISOString(),
            level: 'success',
          })
        );
        break;

      case 'orderFailed':
        dispatch(
          updateOrder({
            id: message.data.orderId,
            status: 'failed',
          })
        );
        dispatch(
          addEvent({
            id: `event-${Date.now()}`,
            type: 'failure',
            message: `Order failed: ${message.data.reason}`,
            timestamp: new Date().toISOString(),
            level: 'error',
          })
        );
        break;

      case 'driverStatusUpdate':
        dispatch(updateDriver(message.data));
        break;

      case 'metricsUpdate':
        dispatch(updateMetrics(message.data));
        break;

      case 'slaAlert':
        dispatch(
          addEvent({
            id: `event-${Date.now()}`,
            type: 'sla',
            message: message.data.message,
            timestamp: new Date().toISOString(),
            level: 'warning',
          })
        );
        break;

      case 'demoStarted':
        dispatch(setDemoStatus(true));
        setIsStarting(false);
        break;

      case 'demoStopped':
        dispatch(setDemoStatus(false));
        setIsStopping(false);
        break;
    }
  };

  const startDemo = async () => {
    setIsStarting(true);
    try {
      // Use main API URL directly
      const data = await apiClient.post('/demo/start', config);
      if (data.success) {
        dispatch(setDemoStatus(true));
        dispatch(
          addEvent({
            id: `event-${Date.now()}`,
            type: 'system',
            message: 'Demo started successfully',
            timestamp: new Date().toISOString(),
            level: 'success',
          })
        );
      }
      setIsStarting(false);
    } catch (error) {
      console.error('Failed to start demo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dispatch(
        addEvent({
          id: `event-${Date.now()}`,
          type: 'system',
          message: `Failed to start demo: ${errorMessage}`,
          timestamp: new Date().toISOString(),
          level: 'error',
        })
      );
      setIsStarting(false);
    }
  };

  const stopDemo = async () => {
    setIsStopping(true);
    try {
      // Use main API URL directly
      const data = await apiClient.post('/demo/stop');
      if (data.success) {
        dispatch(setDemoStatus(false));
        dispatch(
          addEvent({
            id: `event-${Date.now()}`,
            type: 'system',
            message: 'Demo stopped successfully',
            timestamp: new Date().toISOString(),
            level: 'info',
          })
        );
      }
      setIsStopping(false);
    } catch (error) {
      console.error('Failed to stop demo:', error);
      setIsStopping(false);
    }
  };

  const createOrder = async (serviceType: 'BARQ' | 'BULLET') => {
    try {
      // Create order via main API
      const data = await apiClient.post('/demo/order', { serviceType });
      console.log('Order created:', data);
      if (data.success) {
        dispatch(
          addEvent({
            id: `event-${Date.now()}`,
            type: 'order',
            message: `New ${serviceType} order created`,
            timestamp: new Date().toISOString(),
            level: 'info',
          })
        );
      }
    } catch (error) {
      console.error('Failed to create order:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'assigned':
        return <Truck className="w-4 h-4" />;
      case 'picked_up':
        return <Package className="w-4 h-4" />;
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getEventIcon = (level?: string) => {
    switch (level) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-blue-500" />;
    }
  };

  const startScenario = async (scenarioId: string) => {
    setCurrentScenario(scenarioId);
    setScenarioStep(0);
    setScenarioProgress(0);
    setIsScenarioRunning(true);
    setShowScenarioSelector(false);
    
    // Start the demo backend if not running
    if (!isRunning) {
      await startDemo();
    }
    
    // Initialize scenario-specific data
    try {
      await apiClient.post('/demo/scenario', { 
        scenarioId, 
        step: 0,
        speed: scenarioSpeed 
      });
    } catch (error) {
      console.error('Failed to start scenario:', error);
    }
  };

  const pauseScenario = () => {
    setIsScenarioRunning(!isScenarioRunning);
  };

  const nextScenarioStep = async () => {
    const scenario = DEMO_SCENARIOS.find(s => s.id === currentScenario);
    if (scenario && scenarioStep < scenario.highlights.length - 1) {
      const newStep = scenarioStep + 1;
      setScenarioStep(newStep);
      setScenarioProgress((newStep / (scenario.highlights.length - 1)) * 100);
      
      try {
        await apiClient.post('/demo/scenario', { 
          scenarioId: currentScenario, 
          step: newStep,
          speed: scenarioSpeed 
        });
      } catch (error) {
        console.error('Failed to advance scenario:', error);
      }
    }
  };

  const resetScenario = () => {
    setCurrentScenario(null);
    setScenarioStep(0);
    setScenarioProgress(0);
    setIsScenarioRunning(false);
    setShowScenarioSelector(true);
    dispatch(resetDemo());
  };

  const getCurrentScenario = () => {
    return DEMO_SCENARIOS.find(s => s.id === currentScenario);
  };

  const getColorClass = (color: string) => {
    const colors = {
      purple: 'border-purple-500 bg-purple-50 hover:bg-purple-100',
      blue: 'border-blue-500 bg-blue-50 hover:bg-blue-100',
      green: 'border-green-500 bg-green-50 hover:bg-green-100',
      orange: 'border-orange-500 bg-orange-50 hover:bg-orange-100',
      pink: 'border-pink-500 bg-pink-50 hover:bg-pink-100',
      indigo: 'border-indigo-500 bg-indigo-50 hover:bg-indigo-100'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="p-4 space-y-4">
      {!demoAvailable && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 text-yellow-800 p-3">
          Demo backend is unavailable. The demo endpoints may not be deployed or accessible.
        </div>
      )}
      
      {/* Scenario Selector */}
      {showScenarioSelector && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI Route Optimization Platform
            </h1>
            <p className="text-xl text-muted-foreground">
              Choose a demonstration scenario to explore our comprehensive fleet management solution
            </p>
            <div className="flex justify-center gap-4 mt-4">
              <Badge variant="outline" className="bg-green-50">
                <TrendingUp className="w-4 h-4 mr-1" />
                SAR 10.95M Annual Savings
              </Badge>
              <Badge variant="outline" className="bg-blue-50">
                <Target className="w-4 h-4 mr-1" />
                800+ Vehicles Managed
              </Badge>
              <Badge variant="outline" className="bg-purple-50">
                <Brain className="w-4 h-4 mr-1" />
                18+ AI Agents
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DEMO_SCENARIOS.map((scenario) => {
              const IconComponent = scenario.icon;
              return (
                <Card 
                  key={scenario.id} 
                  className={`cursor-pointer transition-all hover:shadow-lg ${getColorClass(scenario.color)} border-2`}
                  onClick={() => startScenario(scenario.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-${scenario.color}-100`}>
                        <IconComponent className={`w-6 h-6 text-${scenario.color}-600`} />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{scenario.title}</CardTitle>
                        <CardDescription className="font-medium">{scenario.subtitle}</CardDescription>
                      </div>
                      <Badge variant="outline">
                        {scenario.duration} min
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{scenario.description}</p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">KEY HIGHLIGHTS:</p>
                      <div className="flex flex-wrap gap-1">
                        {scenario.highlights.map((highlight, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {highlight}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button className="w-full mt-3" variant="outline">
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Start Demo
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Scenario Runner */}
      {!showScenarioSelector && currentScenario && (
        <div className="space-y-6">
          {/* Scenario Header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={resetScenario}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back to Scenarios
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  {React.createElement(getCurrentScenario()?.icon || Activity, { className: 'w-6 h-6' })}
                  {getCurrentScenario()?.title}
                </h1>
                <p className="text-muted-foreground">{getCurrentScenario()?.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant={isConnected ? 'default' : 'destructive'}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
              <Badge variant={isRunning ? 'default' : 'secondary'}>
                {isRunning ? 'Demo Active' : 'Demo Stopped'}
              </Badge>
            </div>
          </div>
          
          {/* Scenario Controls */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Scenario Progress</CardTitle>
                  <CardDescription>
                    Step {scenarioStep + 1} of {getCurrentScenario()?.highlights.length}: {getCurrentScenario()?.highlights[scenarioStep]}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={pauseScenario}
                    disabled={!demoAvailable}
                  >
                    {isScenarioRunning ? <Pause className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                    {isScenarioRunning ? 'Pause' : 'Resume'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={nextScenarioStep}
                    disabled={!demoAvailable || scenarioStep >= (getCurrentScenario()?.highlights.length || 0) - 1}
                  >
                    <SkipForward className="w-4 h-4 mr-1" />
                    Next Step
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setScenarioSpeed(scenarioSpeed === 1 ? 2 : scenarioSpeed === 2 ? 5 : 1)}
                  >
                    <FastForward className="w-4 h-4 mr-1" />
                    {scenarioSpeed}x Speed
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Progress value={scenarioProgress} className="w-full" />
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>Progress: {Math.round(scenarioProgress)}%</span>
                <span>Duration: ~{getCurrentScenario()?.duration} minutes</span>
              </div>
            </CardContent>
          </Card>
          
          {/* Scenario-Specific Content */}
          {currentScenario === 'executive' && (
            <ExecutiveScenario 
              step={scenarioStep} 
              metrics={metrics} 
              isRunning={isRunning && isScenarioRunning} 
            />
          )}
          
          {currentScenario === 'fleet-manager' && (
            <FleetManagerScenario 
              step={scenarioStep} 
              metrics={metrics} 
              isRunning={isRunning && isScenarioRunning} 
            />
          )}
          
          {/* Add placeholders for other scenarios */}
          {currentScenario === 'dispatcher' && (
            <DispatcherScenario 
              step={scenarioStep} 
              metrics={metrics} 
              isRunning={isRunning && isScenarioRunning} 
            />
          )}
          
          {currentScenario === 'analytics' && (
            <AnalyticsScenario 
              step={scenarioStep} 
              metrics={metrics} 
              isRunning={isRunning && isScenarioRunning} 
            />
          )}
          
          {currentScenario === 'ai-agents' && (
            <AIAgentsScenario 
              step={scenarioStep} 
              metrics={metrics} 
              isRunning={isRunning && isScenarioRunning} 
            />
          )}
          
          {currentScenario === 'integration' && (
            <Card className="border-indigo-200 bg-indigo-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-600" />
                  Full System Integration Demo
                </CardTitle>
                <CardDescription>
                  Step {scenarioStep + 1}: End-to-end workflow and multi-agent coordination
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  System integration demo content coming soon...
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      
      {/* Original Header (when scenario is running) */}
      {!showScenarioSelector && (
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">Live Demo Dashboard</h2>
            <p className="text-muted-foreground">
              Real-time fleet management for BARQ and BULLET delivery services
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={isConnected ? 'default' : 'destructive'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
            <Badge variant={isRunning ? 'default' : 'secondary'}>
              {isRunning ? 'Demo Running' : 'Demo Stopped'}
            </Badge>
          </div>
        </div>
      )}

      {/* Control Panel - only show when scenario is running */}
      {!showScenarioSelector && (
        <Card>
          <CardHeader>
            <CardTitle>Demo Control Panel</CardTitle>
            <CardDescription>Configure and control the demo simulation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                onClick={startDemo}
                disabled={isRunning || isStarting || !demoAvailable}
                className="flex items-center gap-2"
              >
                <PlayCircle className="w-4 h-4" />
                {isStarting ? 'Starting...' : 'Start Demo'}
              </Button>
              <Button
                onClick={stopDemo}
                disabled={!isRunning || isStopping}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <StopCircle className="w-4 h-4" />
                {isStopping ? 'Stopping...' : 'Stop Demo'}
              </Button>
              <Button
                onClick={() => createOrder('BARQ')}
                disabled={!isRunning}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Package className="w-4 h-4" />
                Create BARQ Order
              </Button>
              <Button
                onClick={() => createOrder('BULLET')}
                disabled={!isRunning}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Package className="w-4 h-4" />
                Create BULLET Order
              </Button>
              <Button
                onClick={() => dispatch(resetDemo())}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Cards - only show when scenario is running */}
      {!showScenarioSelector && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalOrders}</div>
            <p className="text-xs text-muted-foreground">{metrics.activeOrders} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.completedOrders}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalOrders > 0
                ? `${((metrics.completedOrders / metrics.totalOrders) * 100).toFixed(0)}%`
                : '0%'}{' '}
              success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics.failedOrders}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalOrders > 0
                ? `${((metrics.failedOrders / metrics.totalOrders) * 100).toFixed(0)}%`
                : '0%'}{' '}
              failure rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">SLA Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.slaCompliance.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics.slaCompliance >= 95 ? 'On target' : 'Below target'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeDrivers}</div>
            <p className="text-xs text-muted-foreground">{metrics.busyDrivers} busy</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Delivery</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.averageDeliveryTime}m</div>
            <p className="text-xs text-muted-foreground">Per order</p>
          </CardContent>
        </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders">Active Orders</TabsTrigger>
          <TabsTrigger value="drivers">Driver Fleet</TabsTrigger>
          <TabsTrigger value="events">System Events</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Orders</CardTitle>
              <CardDescription>Real-time tracking of all delivery orders</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {orders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No active orders. Start the demo to generate orders.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(order.status)}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                #{order.id.substring(0, 8)}
                              </span>
                              <Badge variant={order.serviceType === 'BARQ' ? 'warning' : 'default'}>
                                {order.serviceType}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              <MapPin className="w-3 h-3 inline mr-1" />
                              {order.pickup.businessName || order.pickup.address.split(',')[0]}
                              {' → '}
                              {order.dropoff.address.split(',')[0]}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={
                              order.status === 'delivered'
                                ? 'success'
                                : order.status === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {order.status.replace('_', ' ')}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            SLA: {order.sla} min
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drivers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Driver Fleet Status</CardTitle>
              <CardDescription>Real-time driver locations and availability</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {drivers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No drivers online. Start the demo to initialize the fleet.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {drivers.map((driver) => (
                      <div
                        key={driver.id}
                        className={`p-3 rounded-lg text-center transition-all ${
                          driver.status === 'available'
                            ? 'bg-green-50 hover:bg-green-100'
                            : driver.status === 'busy'
                              ? 'bg-yellow-50 hover:bg-yellow-100'
                              : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="text-2xl mb-2">🚗</div>
                        <div className="font-medium text-sm">{driver.name}</div>
                        <Badge
                          variant={
                            driver.status === 'available'
                              ? 'success'
                              : driver.status === 'busy'
                                ? 'warning'
                                : 'secondary'
                          }
                          className="mt-1"
                        >
                          {driver.status}
                        </Badge>
                        {driver.currentOrders && driver.currentOrders.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {driver.currentOrders.length} orders
                          </div>
                        )}
                        {driver.completedToday !== undefined && driver.completedToday > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {driver.completedToday} completed
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Events</CardTitle>
              <CardDescription>Real-time activity log from the agent system</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {events.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No events yet. Start the demo to see live activity.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        {getEventIcon(event.level)}
                        <div className="flex-1">
                          <p className="text-sm">{event.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
