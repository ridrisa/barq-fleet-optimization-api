'use client';

import React, { useState, useEffect } from 'react';
import { Agent, AgentLogEntry } from '@/types/agent';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertCircle, 
  Info, 
  AlertTriangle, 
  Bug, 
  RefreshCw, 
  Search,
  Download,
  Filter,
  X
} from 'lucide-react';

interface AgentLogsModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onFetchLogs: (agentId: string, params?: any) => Promise<AgentLogEntry[]>;
}

export const AgentLogsModal: React.FC<AgentLogsModalProps> = ({
  agent,
  isOpen,
  onClose,
  onFetchLogs,
}) => {
  const [logs, setLogs] = useState<AgentLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');

  const logLevels = ['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'];

  useEffect(() => {
    if (agent && isOpen) {
      fetchLogs();
    }
  }, [agent, isOpen]);

  const fetchLogs = async () => {
    if (!agent) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const fetchedLogs = await onFetchLogs(agent.id, {
        limit: 100,
        level: levelFilter === 'ALL' ? undefined : levelFilter,
      });
      setLogs(fetchedLogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchTerm === '' || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.metadata && JSON.stringify(log.metadata).toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesLevel = levelFilter === 'ALL' || log.level === levelFilter;
    
    return matchesSearch && matchesLevel;
  });

  const getLevelIcon = (level: AgentLogEntry['level']) => {
    switch (level) {
      case 'INFO':
        return Info;
      case 'WARN':
        return AlertTriangle;
      case 'ERROR':
        return AlertCircle;
      case 'DEBUG':
        return Bug;
      default:
        return Info;
    }
  };

  const getLevelColor = (level: AgentLogEntry['level']) => {
    switch (level) {
      case 'INFO':
        return 'bg-blue-500';
      case 'WARN':
        return 'bg-yellow-500';
      case 'ERROR':
        return 'bg-red-500';
      case 'DEBUG':
        return 'bg-gray-500';
      default:
        return 'bg-blue-500';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const exportLogs = () => {
    const logText = filteredLogs
      .map(log => `[${formatTimestamp(log.timestamp)}] [${log.level}] ${log.message}${
        log.metadata ? `\nMetadata: ${JSON.stringify(log.metadata, null, 2)}` : ''
      }`)
      .join('\n\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agent?.name || 'agent'}-logs-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!agent) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Logs for {agent.name}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLogs}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportLogs}
                disabled={filteredLogs.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription>
            Real-time logs and debug information for this agent
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <div className="flex gap-1">
              {logLevels.map((level) => (
                <Button
                  key={level}
                  variant={levelFilter === level ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLevelFilter(level)}
                  className="text-xs"
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
              <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
            </div>
          </div>
        )}

        {/* Logs Content */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span className="ml-2">Loading logs...</span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Info className="w-8 h-8 mb-2" />
                <p>No logs found</p>
                <p className="text-sm">Try adjusting your filters or refresh the logs</p>
              </div>
            ) : (
              <div className="space-y-2 p-2">
                {filteredLogs.map((log) => {
                  const Icon = getLevelIcon(log.level);
                  return (
                    <Card key={log.id} className="p-0">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-2 ${getLevelColor(log.level)}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getLevelColor(log.level)} text-white border-transparent`}
                              >
                                <Icon className="w-3 h-3 mr-1" />
                                {log.level}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatTimestamp(log.timestamp)}
                              </span>
                            </div>
                            <div className="text-sm font-mono break-words">
                              {log.message}
                            </div>
                            {log.metadata && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                  View metadata
                                </summary>
                                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Showing {filteredLogs.length} of {logs.length} logs
          </div>
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};