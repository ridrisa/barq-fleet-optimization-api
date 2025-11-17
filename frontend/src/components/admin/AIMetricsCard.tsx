'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, DollarSign, Zap, TrendingUp, Activity, Clock } from 'lucide-react';

interface AIMetricsSummary {
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  avgCostPerCall: number;
  avgTokensPerCall: number;
  dateRange: {
    start: string;
    end: string;
  };
}

interface AIMetricsCardProps {
  summary: AIMetricsSummary;
}

export const AIMetricsCard: React.FC<AIMetricsCardProps> = ({ summary }) => {
  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardDescription>Total AI Calls</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-500" />
            <div>
              <div className="text-3xl font-bold">{formatNumber(summary.totalCalls)}</div>
              <div className="text-xs text-muted-foreground">API Requests</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardDescription>Total Cost</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-500" />
            <div>
              <div className="text-3xl font-bold">{formatCost(summary.totalCost)}</div>
              <div className="text-xs text-muted-foreground">Accumulated</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardDescription>Avg Cost per Call</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Zap className="w-8 h-8 text-yellow-500" />
            <div>
              <div className="text-3xl font-bold">{formatCost(summary.avgCostPerCall)}</div>
              <div className="text-xs text-muted-foreground">Per Request</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardDescription>Total Tokens</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-500" />
            <div>
              <div className="text-3xl font-bold">{formatNumber(summary.totalTokens)}</div>
              <div className="text-xs text-muted-foreground">Processed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardDescription>Avg Tokens per Call</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-indigo-500" />
            <div>
              <div className="text-3xl font-bold">{formatNumber(summary.avgTokensPerCall)}</div>
              <div className="text-xs text-muted-foreground">Per Request</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardDescription>Date Range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-gray-500" />
            <div>
              <div className="text-sm font-medium">
                {new Date(summary.dateRange.start).toLocaleDateString()}
              </div>
              <div className="text-sm font-medium">
                to {new Date(summary.dateRange.end).toLocaleDateString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
