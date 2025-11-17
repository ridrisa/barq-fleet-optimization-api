'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface AICall {
  request_id: string;
  timestamp: string;
  provider: string;
  model: string;
  tokens: number;
  cost: number;
  response_time: number;
  success: boolean;
}

interface AIRecentCallsTableProps {
  calls: AICall[];
  maxItems?: number;
}

export const AIRecentCallsTable: React.FC<AIRecentCallsTableProps> = ({
  calls,
  maxItems = 20,
}) => {
  const displayCalls = calls.slice(0, maxItems);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
  };

  const getProviderBadgeVariant = (provider: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      groq: 'default',
      gemini: 'secondary',
      claude: 'outline',
      gpt: 'default',
    };
    return variants[provider] || 'outline';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent AI Calls</CardTitle>
        <CardDescription>Latest AI API requests and their performance</CardDescription>
      </CardHeader>
      <CardContent>
        {displayCalls.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No recent calls available</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 text-xs font-medium text-muted-foreground">Time</th>
                  <th className="text-left p-2 text-xs font-medium text-muted-foreground">
                    Provider
                  </th>
                  <th className="text-left p-2 text-xs font-medium text-muted-foreground">
                    Model
                  </th>
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground">
                    Tokens
                  </th>
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground">
                    Cost
                  </th>
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground">
                    Time
                  </th>
                  <th className="text-center p-2 text-xs font-medium text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayCalls.map((call, index) => (
                  <tr
                    key={index}
                    className="border-b hover:bg-muted/50 transition-colors"
                    title={`Request ID: ${call.request_id}`}
                  >
                    <td className="p-2 text-sm">{formatTimestamp(call.timestamp)}</td>
                    <td className="p-2">
                      <Badge variant={getProviderBadgeVariant(call.provider)} className="text-xs">
                        {call.provider}
                      </Badge>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground max-w-[150px] truncate">
                      {call.model || 'unknown'}
                    </td>
                    <td className="p-2 text-right text-sm font-mono">
                      {call.tokens.toLocaleString()}
                    </td>
                    <td className="p-2 text-right text-sm font-mono font-semibold">
                      ${call.cost.toFixed(4)}
                    </td>
                    <td className="p-2 text-right text-sm">
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span>{call.response_time}ms</span>
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      {call.success ? (
                        <CheckCircle className="w-4 h-4 text-green-500 inline" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 inline" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {displayCalls.length > 0 && calls.length > maxItems && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Showing {displayCalls.length} of {calls.length} calls
          </div>
        )}
      </CardContent>
    </Card>
  );
};
