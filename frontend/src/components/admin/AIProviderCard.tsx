'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, TrendingUp, Clock, DollarSign } from 'lucide-react';

interface AIProvider {
  provider: string;
  calls: number;
  tokens: number;
  cost: number;
  avgCost: number;
  avgResponseTime: number;
  successRate: number;
}

interface AIProviderCardProps {
  providers: AIProvider[];
}

export const AIProviderCard: React.FC<AIProviderCardProps> = ({ providers }) => {
  const getProviderIcon = (provider: string) => {
    const icons: Record<string, string> = {
      groq: '⚡',
      gemini: '✨',
      claude: '🤖',
      gpt: '🧠',
      unknown: '❓',
    };
    return icons[provider] || icons.unknown;
  };

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      groq: 'bg-orange-500',
      gemini: 'bg-blue-500',
      claude: 'bg-purple-500',
      gpt: 'bg-green-500',
      unknown: 'bg-gray-500',
    };
    return colors[provider] || colors.unknown;
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Provider Usage</CardTitle>
        <CardDescription>
          Performance and cost breakdown by AI provider
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {providers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No AI provider data available
            </div>
          ) : (
            providers.map((provider, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full ${getProviderColor(provider.provider)} flex items-center justify-center text-2xl`}
                    >
                      {getProviderIcon(provider.provider)}
                    </div>
                    <div>
                      <div className="font-semibold capitalize">{provider.provider}</div>
                      <div className="text-sm text-muted-foreground">
                        {provider.calls.toLocaleString()} calls
                      </div>
                    </div>
                  </div>
                  <Badge variant={provider.successRate >= 95 ? 'default' : 'secondary'}>
                    {provider.successRate.toFixed(1)}% Success
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <div>
                      <div className="text-xs text-muted-foreground">Total Cost</div>
                      <div className="font-semibold">{formatCost(provider.cost)}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-yellow-500" />
                    <div>
                      <div className="text-xs text-muted-foreground">Avg Cost</div>
                      <div className="font-semibold">{formatCost(provider.avgCost)}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <div>
                      <div className="text-xs text-muted-foreground">Avg Time</div>
                      <div className="font-semibold">{provider.avgResponseTime}ms</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-500" />
                    <div>
                      <div className="text-xs text-muted-foreground">Tokens</div>
                      <div className="font-semibold">{provider.tokens.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {/* Progress bar for success rate */}
                <div className="mt-3">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        provider.successRate >= 95
                          ? 'bg-green-500'
                          : provider.successRate >= 85
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${provider.successRate}%` }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
