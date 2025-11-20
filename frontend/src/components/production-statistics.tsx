'use client';

/**
 * Production Statistics Component
 *
 * Displays real-time statistics from BarqFleet production database
 */

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  Users,
  MapPin,
  Truck,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { productionAPI, type ProductionStatistics } from '@/lib/production-api';

export function ProductionStatistics() {
  const [stats, setStats] = useState<ProductionStatistics['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        // Test connection first
        const connectionTest = await productionAPI.testConnection();
        setConnected(connectionTest.success);

        if (connectionTest.success) {
          // Fetch statistics
          const response = await productionAPI.getStatistics();
          if (response.success) {
            setStats(response.data);
          }
        } else {
          setError(connectionTest.error || 'Failed to connect to production database');
        }
      } catch (err) {
        console.error('Error fetching production statistics:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setConnected(false);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <Card className="p-8 bg-gradient-to-br from-primary/5 via-purple-500/5 to-background">
        <div className="flex items-center justify-center">
          <Activity className="h-8 w-8 text-primary animate-spin mr-3" />
          <div>
            <h2 className="text-xl font-bold">Loading Production Data...</h2>
            <p className="text-sm text-muted-foreground mt-1">Connecting to BarqFleet database</p>
          </div>
        </div>
      </Card>
    );
  }

  if (error || !connected) {
    return (
      <Card className="p-8 border-2 border-yellow-200 bg-yellow-50">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-yellow-100 rounded-lg">
            <Activity className="h-6 w-6 text-yellow-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-yellow-900 mb-2">Production Data Unavailable</h2>
            <p className="text-sm text-yellow-700">
              {error || 'Unable to connect to production database. Using demo mode.'}
            </p>
            <p className="text-xs text-yellow-600 mt-2">
              Ensure the backend server is running on http://localhost:3003
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  return (
    <Card className="p-8 bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 border-2 border-green-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-green-100 rounded-xl">
            <Activity className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Live Production Data</h2>
            <p className="text-sm text-muted-foreground">Real-time statistics from BarqFleet</p>
          </div>
        </div>
        <Badge className="bg-green-100 text-green-800 border-green-200 px-4 py-2">
          <CheckCircle className="h-4 w-4 mr-2" />
          Connected
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_orders)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Total Couriers</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_couriers)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <MapPin className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Active Hubs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total_hubs}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Truck className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Total Shipments</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_shipments)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase opacity-90">Today's Orders</p>
          </div>
          <p className="text-3xl font-bold">{stats.today_orders}</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase opacity-90">Pending Orders</p>
          </div>
          <p className="text-3xl font-bold">{stats.pending_orders}</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase opacity-90">Online Couriers</p>
          </div>
          <p className="text-3xl font-bold">{stats.online_couriers}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase opacity-90">Active Shipments</p>
          </div>
          <p className="text-3xl font-bold">{stats.active_shipments}</p>
        </div>
      </div>

      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          Auto-refreshing every 30 seconds • Last updated: {new Date().toLocaleTimeString()}
        </p>
      </div>
    </Card>
  );
}
