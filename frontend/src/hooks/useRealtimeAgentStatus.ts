/**
 * Real-time Agent Status Hook
 * Provides real-time updates for agent status using polling or WebSocket
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Agent, AgentStatusResponse, SystemHealth } from '@/types/agent';
import agentControlAPI from '@/lib/agent-control-api';

interface UseRealtimeAgentStatusOptions {
  pollingInterval?: number;
  enablePolling?: boolean;
  onStatusChange?: (agents: Agent[]) => void;
  onHealthChange?: (health: SystemHealth) => void;
  onError?: (error: Error) => void;
}

interface UseRealtimeAgentStatusReturn {
  agents: Agent[];
  systemHealth: SystemHealth | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  refreshData: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

export function useRealtimeAgentStatus(
  options: UseRealtimeAgentStatusOptions = {}
): UseRealtimeAgentStatusReturn {
  const {
    pollingInterval = 5000,
    enablePolling = true,
    onStatusChange,
    onHealthChange,
    onError,
  } = options;

  const [agents, setAgents] = useState<Agent[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const fetchAgentStatus = useCallback(async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';
      const response = await fetch(`${backendUrl}/api/admin/agents/status`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: AgentStatusResponse = await response.json();
      
      // Update agents with enhanced controllability properties
      const enhancedAgents = data.agents.map(agent => ({
        ...agent,
        isControllable: agent.isControllable ?? true,
        canRestart: agent.canRestart ?? true,
        canConfigure: agent.canConfigure ?? true,
      }));

      setAgents(enhancedAgents);
      setSystemHealth(data.systemHealth);
      setLastUpdate(new Date());
      setError(null);
      setIsConnected(true);
      retryCountRef.current = 0;

      // Trigger callbacks
      onStatusChange?.(enhancedAgents);
      onHealthChange?.(data.systemHealth);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch agent status';
      console.error('Failed to fetch agent status:', errorMessage);
      
      retryCountRef.current += 1;
      
      if (retryCountRef.current <= maxRetries) {
        // Use exponential backoff for retries
        const retryDelay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 30000);
        setTimeout(() => {
          if (isPollingRef.current) {
            fetchAgentStatus();
          }
        }, retryDelay);
      } else {
        setError(errorMessage);
        setIsConnected(false);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      setIsLoading(false);
    }
  }, [onStatusChange, onHealthChange, onError]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    await fetchAgentStatus();
  }, [fetchAgentStatus]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    isPollingRef.current = true;
    retryCountRef.current = 0;
    
    // Initial fetch
    fetchAgentStatus();
    
    // Set up polling
    pollingRef.current = setInterval(() => {
      if (isPollingRef.current) {
        fetchAgentStatus();
      }
    }, pollingInterval);
  }, [fetchAgentStatus, pollingInterval]);

  const stopPolling = useCallback(() => {
    isPollingRef.current = false;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Auto-start polling on mount if enabled
  useEffect(() => {
    if (enablePolling) {
      startPolling();
    } else {
      // Just fetch once if polling is disabled
      fetchAgentStatus();
    }

    return () => {
      stopPolling();
    };
  }, [enablePolling, startPolling, stopPolling, fetchAgentStatus]);

  // Handle visibility change to pause/resume polling when tab is not active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else if (enablePolling) {
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enablePolling, startPolling, stopPolling]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (enablePolling && !isPollingRef.current) {
        startPolling();
      }
    };

    const handleOffline = () => {
      setIsConnected(false);
      setError('Network connection lost');
      stopPolling();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enablePolling, startPolling, stopPolling]);

  return {
    agents,
    systemHealth,
    isConnected,
    isLoading,
    error,
    lastUpdate,
    refreshData,
    startPolling,
    stopPolling,
  };
}