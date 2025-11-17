'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AIMetricsCard } from '@/components/admin/AIMetricsCard';
import { AIProviderCard } from '@/components/admin/AIProviderCard';
import { AICostTrendChart } from '@/components/admin/AICostTrendChart';
import { AIRecentCallsTable } from '@/components/admin/AIRecentCallsTable';
import {
  RefreshCw,
  Calendar,
  Filter,
  Download,
  AlertCircle,
  Brain,
  DollarSign,
} from 'lucide-react';

interface AIMetricsData {
  summary: {
    totalCalls: number;
    totalTokens: number;
    totalCost: number;
    avgCostPerCall: number;
    avgTokensPerCall: number;
    dateRange: {
      start: string;
      end: string;
    };
  };
  providers: any[];
  costTrend: any[];
  recentCalls: any[];
}

export default function AIMonitoringDashboard() {
  const [metricsData, setMetricsData] = useState<AIMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [providerFilter, setProviderFilter] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchAIMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (providerFilter) params.append('provider', providerFilter);

      const response = await fetch(`${backendUrl}/api/v1/admin/ai/metrics?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setMetricsData(data.data);
        setLastUpdate(new Date());
        setError(null);
      } else {
        throw new Error(data.error || 'Failed to fetch AI metrics');
      }
    } catch (err) {
      console.error('Failed to fetch AI metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch AI metrics');

      // Mock data for development
      setMetricsData({
        summary: {
          totalCalls: 1234,
          totalTokens: 567890,
          totalCost: 12.3456,
          avgCostPerCall: 0.01,
          avgTokensPerCall: 460,
          dateRange: {
            start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            end: endDate || new Date().toISOString(),
          },
        },
        providers: [
          {
            provider: 'groq',
            calls: 856,
            tokens: 392840,
            cost: 0.0393,
            avgCost: 0.000046,
            avgResponseTime: 234,
            successRate: 99.3,
          },
          {
            provider: 'gemini',
            calls: 245,
            tokens: 112550,
            cost: 0.1126,
            avgCost: 0.00046,
            avgResponseTime: 567,
            successRate: 97.6,
          },
          {
            provider: 'claude',
            calls: 98,
            tokens: 45120,
            cost: 1.5792,
            avgCost: 0.0161,
            avgResponseTime: 890,
            successRate: 100,
          },
          {
            provider: 'gpt',
            calls: 35,
            tokens: 17380,
            cost: 0.6145,
            avgCost: 0.0176,
            avgResponseTime: 1234,
            successRate: 94.3,
          },
        ],
        costTrend: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          cost: Math.random() * 2 + 0.5,
          calls: Math.floor(Math.random() * 100) + 20,
        })),
        recentCalls: Array.from({ length: 50 }, (_, i) => ({
          request_id: `req-${i + 1}`,
          timestamp: new Date(Date.now() - i * 60000).toISOString(),
          provider: ['groq', 'gemini', 'claude', 'gpt'][Math.floor(Math.random() * 4)],
          model: 'llama-3.3-70b-versatile',
          tokens: Math.floor(Math.random() * 1000) + 100,
          cost: Math.random() * 0.05,
          response_time: Math.floor(Math.random() * 2000) + 100,
          success: Math.random() > 0.05,
        })),
      });
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, providerFilter]);

  useEffect(() => {
    fetchAIMetrics();
  }, [fetchAIMetrics]);

  const handleRefresh = () => {
    fetchAIMetrics();
  };

  const handleExportData = () => {
    if (!metricsData) return;

    const csvData = [
      ['Date', 'Provider', 'Calls', 'Tokens', 'Cost'],
      ...metricsData.providers.map((p) => [
        new Date().toISOString().split('T')[0],
        p.provider,
        p.calls,
        p.tokens,
        p.cost,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-metrics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !metricsData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg font-medium">Loading AI Metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-500" />
            AI Monitoring Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Track AI usage, costs, and performance across all providers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleExportData} variant="outline" disabled={!metricsData}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-900 dark:text-yellow-100">Using Mock Data</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Could not connect to the backend API. Showing sample data for demonstration.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            <CardTitle>Filters</CardTitle>
          </div>
          {lastUpdate && (
            <CardDescription>Last updated: {lastUpdate.toLocaleTimeString()}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Provider</label>
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-md border bg-background"
              >
                <option value="">All Providers</option>
                <option value="groq">Groq</option>
                <option value="gemini">Gemini</option>
                <option value="claude">Claude</option>
                <option value="gpt">GPT</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleRefresh} className="w-full">
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Summary */}
      {metricsData && <AIMetricsCard summary={metricsData.summary} />}

      {/* Provider Stats and Cost Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {metricsData && <AIProviderCard providers={metricsData.providers} />}
        {metricsData && <AICostTrendChart data={metricsData.costTrend} />}
      </div>

      {/* Recent Calls */}
      {metricsData && <AIRecentCallsTable calls={metricsData.recentCalls} maxItems={20} />}
    </div>
  );
}
