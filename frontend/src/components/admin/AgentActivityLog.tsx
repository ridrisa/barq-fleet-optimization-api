'use client';

import React from 'react';
import { AgentActivity } from '@/types/agent';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, Clock, Ban, AlertCircle } from 'lucide-react';

interface AgentActivityLogProps {
  activities: AgentActivity[];
  maxItems?: number;
  showAgentName?: boolean;
}

export const AgentActivityLog: React.FC<AgentActivityLogProps> = ({
  activities,
  maxItems = 50,
  showAgentName = true,
}) => {
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleString();
  };

  const getStatusIcon = (status: AgentActivity['status']) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'FAILURE':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'TIMEOUT':
        return <Clock className="w-4 h-4 text-orange-500" />;
      case 'CANCELLED':
        return <Ban className="w-4 h-4 text-gray-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: AgentActivity['status']) => {
    switch (status) {
      case 'SUCCESS':
        return <Badge variant="success">Success</Badge>;
      case 'FAILURE':
        return <Badge variant="error">Failure</Badge>;
      case 'TIMEOUT':
        return <Badge variant="warning">Timeout</Badge>;
      case 'CANCELLED':
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const displayActivities = activities.slice(0, maxItems);

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>Recent agent executions and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Clock className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">No activity recorded yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
        <CardDescription>
          Showing {displayActivities.length} of {activities.length} recent activities
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Status</TableHead>
                {showAgentName && <TableHead>Agent</TableHead>}
                <TableHead>Timestamp</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayActivities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      {getStatusIcon(activity.status)}
                    </div>
                  </TableCell>
                  {showAgentName && (
                    <TableCell className="font-medium">{activity.agentName}</TableCell>
                  )}
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{formatTimestamp(activity.timestamp)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-mono">{formatDuration(activity.duration)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(activity.status)}
                      {activity.errorMessage && (
                        <span className="text-xs text-red-600 dark:text-red-400 truncate max-w-xs">
                          {activity.errorMessage}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {activities.length > maxItems && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {activities.length - maxItems} more activities not shown
          </div>
        )}
      </CardContent>
    </Card>
  );
};
