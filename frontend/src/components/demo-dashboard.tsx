'use client';

import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
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
} from 'lucide-react';
import { RootState, AppDispatch } from '@/store/store';
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

export default function DemoDashboard() {
  const dispatch = useDispatch<AppDispatch>();
  const { isConnected, isRunning, orders, drivers, metrics, events, config } = useSelector(
    (state: RootState) => state.demo
  );

  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // WebSocket connection
  useWebSocket({
    url: apiClient.getWsUrl(),
    onOpen: () => {
      dispatch(setConnectionStatus(true));
    },
    onClose: () => {
      dispatch(setConnectionStatus(false));
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
      const data = await apiClient.post('/start', config);
      if (data.success) {
        dispatch(setDemoStatus(true));
      }
    } catch (error) {
      console.error('Failed to start demo:', error);
      setIsStarting(false);
    }
  };

  const stopDemo = async () => {
    setIsStopping(true);
    try {
      const data = await apiClient.post('/stop');
      if (data.success) {
        dispatch(setDemoStatus(false));
      }
    } catch (error) {
      console.error('Failed to stop demo:', error);
      setIsStopping(false);
    }
  };

  const createOrder = async (serviceType: 'BARQ' | 'BULLET') => {
    try {
      const data = await apiClient.post('/order', { serviceType });
      console.log('Order created:', data);
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

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">AI Route Optimization Demo</h1>
          <p className="text-muted-foreground">
            Real-time fleet management for BARQ and BULLET delivery services
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant={isConnected ? 'success' : 'destructive'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          <Badge variant={isRunning ? 'default' : 'secondary'}>
            {isRunning ? 'Demo Running' : 'Demo Stopped'}
          </Badge>
        </div>
      </div>

      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Demo Control Panel</CardTitle>
          <CardDescription>Configure and control the demo simulation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={startDemo}
              disabled={isRunning || isStarting || !isConnected}
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

      {/* Metrics Cards */}
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
    </div>
  );
}
