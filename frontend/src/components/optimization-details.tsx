'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import {
  Cpu,
  Zap,
  Brain,
  Settings,
  Clock,
  TrendingUp,
  Database,
  Activity,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface OptimizationMetadata {
  engine?: string;
  algorithm?: string;
  aiModel?: string;
  fairDistribution?: boolean;
  capacityConstrained?: boolean;
  multiPickupSupport?: boolean;
  slaAware?: boolean;
  executionTime?: number;
  cost?: number;
  fallback?: boolean;
  fallbackReason?: string;
  provider?: string;
  vehiclesUsed?: number;
  vehiclesAvailable?: number;
  utilizationRate?: number;
}

interface OptimizationDetailsProps {
  engine?: string;
  metadata?: OptimizationMetadata;
  engineDecision?: {
    engine: string;
    reason: string;
    fallback?: boolean;
    fallbackReason?: string;
  };
  aiInsights?: {
    advisor?: string;
    analyst?: string;
    cost?: number;
  };
  summary?: {
    total_distance?: number;
    total_duration?: number;
    total_routes?: number;
  };
  compact?: boolean;
}

export function OptimizationDetails({
  engine,
  metadata = {},
  engineDecision,
  aiInsights,
  summary,
  compact = false,
}: OptimizationDetailsProps) {
  // Determine the engine used
  const usedEngine = engine || engineDecision?.engine || metadata?.engine || 'Unknown';

  // Get engine icon and color
  const getEngineConfig = (engineName: string) => {
    const name = engineName.toUpperCase();
    if (name.includes('CVRP')) {
      return {
        icon: Database,
        color: 'blue',
        label: 'OR-Tools CVRP',
        description: 'Capacitated Vehicle Routing Problem solver',
      };
    } else if (name.includes('OSRM')) {
      return {
        icon: Zap,
        color: 'green',
        label: 'OSRM Real-Time',
        description: 'Open Source Routing Machine',
      };
    } else if (name.includes('GENETIC')) {
      return {
        icon: Activity,
        color: 'purple',
        label: 'Genetic Algorithm',
        description: 'Evolutionary optimization',
      };
    } else if (name.includes('HUNGARIAN')) {
      return {
        icon: TrendingUp,
        color: 'orange',
        label: 'Hungarian Algorithm',
        description: 'Optimal assignment problem',
      };
    } else {
      return {
        icon: Cpu,
        color: 'gray',
        label: engineName,
        description: 'Optimization engine',
      };
    }
  };

  const engineConfig = getEngineConfig(usedEngine);
  const EngineIcon = engineConfig.icon;

  // Compact view for inline display
  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="flex items-center gap-1">
          <EngineIcon className="w-3 h-3" />
          {engineConfig.label}
        </Badge>
        {metadata?.algorithm && (
          <Badge variant="secondary" className="text-xs">
            {metadata.algorithm}
          </Badge>
        )}
        {aiInsights?.advisor && (
          <Badge variant="default" className="flex items-center gap-1 text-xs">
            <Brain className="w-3 h-3" />
            {aiInsights.advisor}
          </Badge>
        )}
        {metadata?.executionTime && (
          <span className="text-xs text-muted-foreground">
            {metadata.executionTime}ms
          </span>
        )}
      </div>
    );
  }

  // Full detailed view
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${engineConfig.color}-100 dark:bg-${engineConfig.color}-900`}>
              <EngineIcon className={`w-6 h-6 text-${engineConfig.color}-600 dark:text-${engineConfig.color}-400`} />
            </div>
            <div>
              <CardTitle className="text-lg">Optimization Details</CardTitle>
              <CardDescription>{engineConfig.description}</CardDescription>
            </div>
          </div>
          {engineDecision?.fallback && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Fallback Mode
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Engine Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Cpu className="w-4 h-4 text-muted-foreground" />
              Optimization Engine
            </div>
            <div className="pl-6">
              <Badge className={`bg-${engineConfig.color}-100 text-${engineConfig.color}-800 dark:bg-${engineConfig.color}-900 dark:text-${engineConfig.color}-200`}>
                {engineConfig.label}
              </Badge>
              {engineDecision?.reason && (
                <p className="text-xs text-muted-foreground mt-1">
                  {engineDecision.reason}
                </p>
              )}
            </div>
          </div>

          {/* Algorithm Used */}
          {metadata?.algorithm && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Settings className="w-4 h-4 text-muted-foreground" />
                Algorithm
              </div>
              <div className="pl-6">
                <Badge variant="secondary">{metadata.algorithm}</Badge>
              </div>
            </div>
          )}

          {/* AI Model */}
          {(aiInsights?.advisor || metadata?.aiModel) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Brain className="w-4 h-4 text-muted-foreground" />
                AI Model
              </div>
              <div className="pl-6 space-y-1">
                {aiInsights?.advisor && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Advisor:</span>
                    <Badge variant="default">{aiInsights.advisor}</Badge>
                  </div>
                )}
                {aiInsights?.analyst && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Analyst:</span>
                    <Badge variant="default">{aiInsights.analyst}</Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Execution Time */}
          {metadata?.executionTime && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Execution Time
              </div>
              <div className="pl-6">
                <span className="text-2xl font-bold">{metadata.executionTime}</span>
                <span className="text-sm text-muted-foreground ml-1">ms</span>
              </div>
            </div>
          )}
        </div>

        {/* Features */}
        {(metadata?.fairDistribution || metadata?.capacityConstrained || metadata?.multiPickupSupport || metadata?.slaAware) && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Features</div>
            <div className="flex flex-wrap gap-2">
              {metadata.fairDistribution && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  Fair Distribution
                </Badge>
              )}
              {metadata.capacityConstrained && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  Capacity Constraints
                </Badge>
              )}
              {metadata.multiPickupSupport && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  Multi-Pickup
                </Badge>
              )}
              {metadata.slaAware && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  SLA-Aware
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Vehicle Utilization */}
        {metadata?.vehiclesUsed && metadata?.vehiclesAvailable && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Vehicle Utilization</div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {metadata.vehiclesUsed} / {metadata.vehiclesAvailable} vehicles used
                </span>
                <span className="font-medium">
                  {metadata.utilizationRate ? `${(metadata.utilizationRate * 100).toFixed(1)}%` : 'N/A'}
                </span>
              </div>
              {metadata.utilizationRate && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${metadata.utilizationRate * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cost Information */}
        {aiInsights?.cost && (
          <div className="space-y-2">
            <div className="text-sm font-medium">AI Cost</div>
            <div className="pl-6">
              <span className="text-lg font-bold">${aiInsights.cost.toFixed(4)}</span>
              <span className="text-xs text-muted-foreground ml-1">per optimization</span>
            </div>
          </div>
        )}

        {/* Fallback Warning */}
        {engineDecision?.fallback && engineDecision?.fallbackReason && (
          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <p className="font-medium text-yellow-900 dark:text-yellow-100">Fallback Activated</p>
                <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                  {engineDecision.fallbackReason}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Summary Stats (if provided) */}
        {summary && (
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            {summary.total_distance !== undefined && (
              <div className="text-center">
                <div className="text-2xl font-bold">{summary.total_distance.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">km</div>
              </div>
            )}
            {summary.total_duration !== undefined && (
              <div className="text-center">
                <div className="text-2xl font-bold">{Math.round(summary.total_duration)}</div>
                <div className="text-xs text-muted-foreground">minutes</div>
              </div>
            )}
            {summary.total_routes !== undefined && (
              <div className="text-center">
                <div className="text-2xl font-bold">{summary.total_routes}</div>
                <div className="text-xs text-muted-foreground">routes</div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
