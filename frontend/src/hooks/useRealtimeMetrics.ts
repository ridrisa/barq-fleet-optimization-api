/**
 * Real-time Metrics Hook
 * Provides live metrics data with auto-refresh functionality
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import axios from 'axios';

export interface SystemHealth {
  api_status: 'online' | 'offline' | 'degraded';
  response_time_ms: number;
  last_check: Date;
  service_uptime: number;
  error_rate: number;
}

export interface ActiveOptimization {
  requestId: string;
  status: 'processing' | 'pending' | 'completed' | 'failed';
  progress: number;
  created_at: Date;
  engine?: string;
  region?: string;
  vehicleCount?: number;
  locationCount?: number;
}

export interface LiveMetrics {
  requests_per_minute: number;
  active_users: number;
  queue_depth: number;
  avg_response_time: number;
  success_rate: number;
  error_count: number;
}

export interface RecentActivity {
  id: string;
  type: 'optimization' | 'error' | 'warning' | 'success';
  message: string;
  timestamp: Date;
  metadata?: any;
}

export interface PerformanceGauges {
  cpu_usage?: number;
  memory_usage?: number;
  api_latency: number;
  active_connections: number;
}

export interface RealtimeMetricsData {
  systemHealth: SystemHealth;
  activeOptimizations: ActiveOptimization[];
  liveMetrics: LiveMetrics;
  recentActivity: RecentActivity[];
  performanceGauges: PerformanceGauges;
  lastUpdated: Date;
}

interface UseRealtimeMetricsOptions {
  refreshInterval?: number; // in milliseconds, default 5000 (5 seconds)
  enabled?: boolean;
  onError?: (error: Error) => void;
}

export function useRealtimeMetrics({
  refreshInterval = 5000,
  enabled = true,
  onError,
}: UseRealtimeMetricsOptions = {}) {
  const [data, setData] = useState<RealtimeMetricsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://route-opt-backend-sek7q2ajva-uc.a.run.app';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Fetch system health
  const fetchSystemHealth = async (): Promise<SystemHealth> => {
    const startTime = Date.now();
    try {
      const response = await axios.get(`${API_BASE_URL}/api/health`, { timeout: 5000 });
      const responseTime = Date.now() - startTime;

      return {
        api_status: response.status === 200 ? 'online' : 'degraded',
        response_time_ms: responseTime,
        last_check: new Date(),
        service_uptime: response.data?.uptime || 0,
        error_rate: 0,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        api_status: 'offline',
        response_time_ms: responseTime,
        last_check: new Date(),
        service_uptime: 0,
        error_rate: 100,
      };
    }
  };

  // Fetch active optimizations
  const fetchActiveOptimizations = async (): Promise<ActiveOptimization[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/optimize/history?limit=50&page=1`);
      const optimizations = response.data.data || [];

      // Filter only processing and pending optimizations
      const activeOpts = optimizations
        .filter((opt: any) => opt.status === 'processing' || opt.status === 'pending')
        .map((opt: any) => ({
          requestId: opt.requestId || opt.id,
          status: opt.status,
          progress: opt.progress || 50,
          created_at: new Date(opt.createdAt || opt.created_at),
          engine: opt.optimizationEngine || opt.engine,
          region: opt.region,
          vehicleCount: opt.vehicles?.length || opt.vehicleCount,
          locationCount: opt.locations?.length || opt.locationCount,
        }))
        .slice(0, 10); // Limit to 10 active optimizations

      return activeOpts;
    } catch (error) {
      console.error('Error fetching active optimizations:', error);
      return [];
    }
  };

  // Calculate live metrics from recent history
  const fetchLiveMetrics = async (): Promise<LiveMetrics> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/optimize/history?limit=100&page=1`);
      const optimizations = response.data.data || [];

      // Calculate metrics from recent data
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      const recentRequests = optimizations.filter((opt: any) => {
        const createdAt = new Date(opt.createdAt || opt.created_at);
        return createdAt >= oneMinuteAgo;
      });

      const completedOptimizations = optimizations.filter((opt: any) => opt.status === 'completed');
      const failedOptimizations = optimizations.filter((opt: any) => opt.status === 'failed');

      const successRate = optimizations.length > 0
        ? (completedOptimizations.length / optimizations.length) * 100
        : 100;

      // Calculate average response time from completed optimizations
      const avgResponseTime = completedOptimizations.length > 0
        ? completedOptimizations.reduce((sum: number, opt: any) => {
            return sum + (opt.optimizationMetadata?.executionTime || 0);
          }, 0) / completedOptimizations.length
        : 0;

      return {
        requests_per_minute: recentRequests.length,
        active_users: Math.floor(Math.random() * 5) + 1, // Simulated for now
        queue_depth: optimizations.filter((opt: any) => opt.status === 'pending').length,
        avg_response_time: avgResponseTime,
        success_rate: successRate,
        error_count: failedOptimizations.length,
      };
    } catch (error) {
      console.error('Error fetching live metrics:', error);
      return {
        requests_per_minute: 0,
        active_users: 0,
        queue_depth: 0,
        avg_response_time: 0,
        success_rate: 100,
        error_count: 0,
      };
    }
  };

  // Fetch recent activity
  const fetchRecentActivity = async (): Promise<RecentActivity[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/optimize/history?limit=10&page=1`);
      const optimizations = response.data.data || [];

      const activities: RecentActivity[] = optimizations.map((opt: any) => {
        let type: 'optimization' | 'error' | 'warning' | 'success' = 'optimization';
        let message = '';

        if (opt.status === 'completed') {
          type = 'success';
          message = `Optimization completed for ${opt.locations?.length || 'N/A'} locations`;
        } else if (opt.status === 'failed') {
          type = 'error';
          message = `Optimization failed: ${opt.error || 'Unknown error'}`;
        } else if (opt.status === 'processing') {
          type = 'optimization';
          message = `Processing optimization with ${opt.engine || 'default'} engine`;
        } else {
          type = 'warning';
          message = `Optimization pending in queue`;
        }

        return {
          id: opt.requestId || opt.id,
          type,
          message,
          timestamp: new Date(opt.createdAt || opt.created_at),
          metadata: {
            engine: opt.optimizationEngine || opt.engine,
            region: opt.region,
            vehicleCount: opt.vehicles?.length || opt.vehicleCount,
          },
        };
      });

      return activities;
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      return [];
    }
  };

  // Fetch performance gauges
  const fetchPerformanceGauges = async (apiLatency: number): Promise<PerformanceGauges> => {
    try {
      // For now, simulate CPU and memory usage
      // In production, these would come from actual monitoring endpoints
      return {
        cpu_usage: Math.random() * 40 + 20, // 20-60%
        memory_usage: Math.random() * 30 + 40, // 40-70%
        api_latency: apiLatency,
        active_connections: Math.floor(Math.random() * 50) + 10, // 10-60
      };
    } catch (error) {
      console.error('Error fetching performance gauges:', error);
      return {
        api_latency: apiLatency,
        active_connections: 0,
      };
    }
  };

  // Main fetch function
  const fetchRealtimeData = useCallback(async (isInitialLoad = false) => {
    if (!mountedRef.current || !enabled) return;

    if (isInitialLoad) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    setError(null);

    try {
      // Fetch all data in parallel
      const [systemHealth, activeOptimizations, liveMetrics, recentActivity] = await Promise.all([
        fetchSystemHealth(),
        fetchActiveOptimizations(),
        fetchLiveMetrics(),
        fetchRecentActivity(),
      ]);

      const performanceGauges = await fetchPerformanceGauges(systemHealth.response_time_ms);

      if (!mountedRef.current) return;

      setData({
        systemHealth,
        activeOptimizations,
        liveMetrics,
        recentActivity,
        performanceGauges,
        lastUpdated: new Date(),
      });
    } catch (err) {
      if (!mountedRef.current) return;

      const error = err instanceof Error ? err : new Error('Failed to fetch realtime metrics');
      setError(error);

      if (onError) {
        onError(error);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [enabled, onError, API_BASE_URL]);

  // Manual refresh function
  const refresh = useCallback(() => {
    fetchRealtimeData(false);
  }, [fetchRealtimeData]);

  // Set up auto-refresh
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial fetch
    fetchRealtimeData(true);

    // Set up interval for subsequent fetches
    intervalRef.current = setInterval(() => {
      fetchRealtimeData(false);
    }, refreshInterval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, refreshInterval, fetchRealtimeData]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    refresh,
    lastUpdated: data?.lastUpdated || null,
  };
}
