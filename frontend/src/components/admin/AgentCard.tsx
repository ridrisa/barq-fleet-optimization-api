'use client';

import React, { useState } from 'react';
import { Agent, AgentError } from '@/types/agent';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from './StatusBadge';
import { HealthScoreGauge } from './HealthScoreGauge';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AgentCardProps {
  agent: Agent;
  onClick?: (agent: Agent) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onClick }) => {
  const [expanded, setExpanded] = useState(false);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getErrorSeverityColor = (severity: AgentError['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500';
      case 'HIGH':
        return 'bg-orange-500';
      case 'MEDIUM':
        return 'bg-yellow-500';
      case 'LOW':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card
      className={`transition-all duration-200 hover:shadow-lg cursor-pointer ${
        agent.status === 'ERROR' ? 'border-red-300 dark:border-red-800' : ''
      }`}
      onClick={() => onClick?.(agent)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg">{agent.name}</CardTitle>
              <StatusBadge status={agent.status} size="sm" />
            </div>
            <CardDescription className="text-xs">{agent.description}</CardDescription>
          </div>
          <HealthScoreGauge score={agent.healthScore} size="sm" showLabel={false} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Last Run</div>
              <div className="font-medium">{formatTimestamp(agent.lastRun)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Duration</div>
              <div className="font-medium">{formatDuration(agent.lastDuration)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <div>
              <div className="text-xs text-muted-foreground">Success Rate</div>
              <div className="font-medium">{Math.round(agent.successRate * 100)}%</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Executions</div>
              <div className="font-medium">{agent.totalExecutions.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Category Badge */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {agent.category}
          </Badge>
          {!agent.enabled && (
            <Badge variant="secondary" className="text-xs">
              Disabled
            </Badge>
          )}
        </div>

        {/* Errors Section */}
        {agent.errors.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:underline w-full"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>
                {agent.errors.length} Error{agent.errors.length > 1 ? 's' : ''}
              </span>
              {expanded ? (
                <ChevronUp className="w-4 h-4 ml-auto" />
              ) : (
                <ChevronDown className="w-4 h-4 ml-auto" />
              )}
            </button>

            {expanded && (
              <div className="mt-2 space-y-2">
                {agent.errors.slice(0, 3).map((error, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-red-50 dark:bg-red-950 rounded-md border border-red-200 dark:border-red-800"
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`w-2 h-2 rounded-full mt-1 ${getErrorSeverityColor(error.severity)}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-red-900 dark:text-red-100">
                          {error.severity}
                        </div>
                        <div className="text-xs text-red-700 dark:text-red-300 mt-1 truncate">
                          {error.message}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatTimestamp(error.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {agent.errors.length > 3 && (
                  <div className="text-xs text-muted-foreground text-center">
                    +{agent.errors.length - 3} more errors
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Performance Indicators */}
        {agent.status === 'ACTIVE' && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  agent.healthScore >= 0.9
                    ? 'bg-green-500'
                    : agent.healthScore >= 0.7
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`}
                style={{ width: `${agent.healthScore * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {Math.round(agent.healthScore * 100)}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
