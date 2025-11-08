'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  Download,
  AlertCircle,
  TrendingUp,
  Users,
  Calendar,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { AnalyticsGPTChat } from '@/components/analytics-gpt-chat';
import {
  SLAStatusCard,
  DriverPerformanceCard,
  RouteEfficiencyChart,
  DemandForecastCard,
  VehiclePerformanceCard,
  SLATrendChart,
} from '@/components/analytics-charts';
import analyticsAPI from '@/lib/analytics-api';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [serviceStatus, setServiceStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  // Data states
  const [slaRealtimeData, setSlaRealtimeData] = useState<any>(null);
  const [slaComplianceData, setSlaComplianceData] = useState<any>(null);
  const [slaTrendData, setSlaTrendData] = useState<any>(null);
  const [driverPerformanceData, setDriverPerformanceData] = useState<any>(null);
  const [routeEfficiencyData, setRouteEfficiencyData] = useState<any>(null);
  const [demandForecastData, setDemandForecastData] = useState<any>(null);
  const [vehiclePerformanceData, setVehiclePerformanceData] = useState<any>(null);

  const checkServiceHealth = async () => {
    try {
      await analyticsAPI.health();
      setServiceStatus('online');
    } catch (error) {
      console.error('Analytics service is offline:', error);
      setServiceStatus('offline');
    }
  };

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [slaRealtime, slaCompliance, slaTrend, drivers, routes, demand, vehicles] =
        await Promise.all([
          analyticsAPI.getRealtimeSLAStatus().catch(() => null),
          analyticsAPI.getSLACompliance(7).catch(() => null),
          analyticsAPI.getSLATrend(30).catch(() => null),
          analyticsAPI.getDriverPerformance('monthly').catch(() => null),
          analyticsAPI.getRouteEfficiency(30).catch(() => null),
          analyticsAPI.getDailyForecast(7).catch(() => null),
          analyticsAPI.getVehiclePerformance('monthly').catch(() => null),
        ]);

      setSlaRealtimeData(slaRealtime);
      setSlaComplianceData(slaCompliance);
      setSlaTrendData(slaTrend);
      setDriverPerformanceData(drivers);
      setRouteEfficiencyData(routes);
      setDemandForecastData(demand);
      setVehiclePerformanceData(vehicles);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportDataToCSV = () => {
    const csvData = {
      sla_realtime: slaRealtimeData,
      sla_compliance: slaComplianceData,
      driver_performance: driverPerformanceData,
      route_efficiency: routeEfficiencyData,
      demand_forecast: demandForecastData,
      vehicle_performance: vehiclePerformanceData,
    };

    const dataStr = JSON.stringify(csvData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barq-analytics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    checkServiceHealth();
    loadAllData();
    const interval = setInterval(loadAllData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading && serviceStatus === 'checking') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="text-lg">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fleet Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered insights with natural language queries
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={serviceStatus === 'online' ? 'default' : 'destructive'}>
            {serviceStatus === 'online' ? 'Service Online' : 'Service Offline'}
          </Badge>
          <Button variant="outline" size="sm" onClick={exportDataToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm" onClick={loadAllData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {serviceStatus === 'offline' && (
        <Card className="p-4 border-yellow-600 bg-yellow-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-900">Analytics Service Offline</h3>
              <p className="text-sm text-yellow-800 mt-1">
                The Python analytics service is not responding. Please check deployment status.
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={checkServiceHealth}>
                Retry Connection
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        Last updated: {lastUpdated.toLocaleString()}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sla">
            <AlertCircle className="h-4 w-4 mr-2" />
            SLA
          </TabsTrigger>
          <TabsTrigger value="fleet">
            <Users className="h-4 w-4 mr-2" />
            Fleet
          </TabsTrigger>
          <TabsTrigger value="routes">
            <TrendingUp className="h-4 w-4 mr-2" />
            Routes
          </TabsTrigger>
          <TabsTrigger value="gpt">
            <MessageSquare className="h-4 w-4 mr-2" />
            GPT Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {slaRealtimeData && <SLAStatusCard data={slaRealtimeData} />}
            {driverPerformanceData && <DriverPerformanceCard data={driverPerformanceData} />}
            {routeEfficiencyData && <RouteEfficiencyChart data={routeEfficiencyData} />}
            {demandForecastData && <DemandForecastCard data={demandForecastData} />}
          </div>
        </TabsContent>

        <TabsContent value="sla" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {slaRealtimeData && <SLAStatusCard data={slaRealtimeData} />}
            {slaTrendData && <SLATrendChart data={slaTrendData} />}
          </div>
        </TabsContent>

        <TabsContent value="fleet" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {driverPerformanceData && <DriverPerformanceCard data={driverPerformanceData} />}
            {vehiclePerformanceData && <VehiclePerformanceCard data={vehiclePerformanceData} />}
          </div>
        </TabsContent>

        <TabsContent value="routes" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {routeEfficiencyData && <RouteEfficiencyChart data={routeEfficiencyData} />}
            {demandForecastData && <DemandForecastCard data={demandForecastData} />}
          </div>
        </TabsContent>

        <TabsContent value="gpt" className="space-y-6">
          <AnalyticsGPTChat />
        </TabsContent>
      </Tabs>
    </div>
  );
}
