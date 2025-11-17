'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface CostTrendData {
  date: string;
  cost: number;
  calls: number;
}

interface AICostTrendChartProps {
  data: CostTrendData[];
}

export const AICostTrendChart: React.FC<AICostTrendChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Trend</CardTitle>
          <CardDescription>Daily AI costs over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No cost trend data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxCost = Math.max(...data.map((d) => d.cost));
  const minCost = Math.min(...data.map((d) => d.cost));
  const totalCost = data.reduce((sum, d) => sum + d.cost, 0);
  const avgCost = totalCost / data.length;

  // Calculate trend
  const recentCosts = data.slice(-7);
  const recentAvg = recentCosts.reduce((sum, d) => sum + d.cost, 0) / recentCosts.length;
  const trend = recentAvg > avgCost ? 'up' : 'down';
  const trendPercent = Math.abs(((recentAvg - avgCost) / avgCost) * 100);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Cost Trend</CardTitle>
            <CardDescription>Daily AI costs over time</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {trend === 'up' ? (
              <>
                <TrendingUp className="w-5 h-5 text-red-500" />
                <span className="text-sm font-medium text-red-500">
                  +{trendPercent.toFixed(1)}%
                </span>
              </>
            ) : (
              <>
                <TrendingDown className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium text-green-500">
                  -{trendPercent.toFixed(1)}%
                </span>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
          <div>
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-lg font-bold">${totalCost.toFixed(4)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Average</div>
            <div className="text-lg font-bold">${avgCost.toFixed(4)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Peak</div>
            <div className="text-lg font-bold">${maxCost.toFixed(4)}</div>
          </div>
        </div>

        <div className="h-48 flex items-end gap-1">
          {data.map((day, index) => {
            const height = maxCost > 0 ? (day.cost / maxCost) * 100 : 0;
            const isRecent = index >= data.length - 7;

            return (
              <div
                key={index}
                className="flex-1 min-w-0 group relative"
                title={`${day.date}: $${day.cost.toFixed(4)} (${day.calls} calls)`}
              >
                <div
                  className={`${
                    isRecent ? 'bg-blue-500' : 'bg-blue-400'
                  } rounded-t transition-all hover:opacity-80`}
                  style={{ height: `${height}%` }}
                />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                  {new Date(day.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                  <br />
                  ${day.cost.toFixed(4)}
                  <br />
                  {day.calls} calls
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex justify-between text-xs text-muted-foreground">
          <span>
            {data.length > 0
              ? new Date(data[0].date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : ''}
          </span>
          <span>
            {data.length > 0
              ? new Date(data[data.length - 1].date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : ''}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
