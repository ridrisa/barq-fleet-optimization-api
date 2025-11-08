/**
 * Agent Monitoring Types
 * Type definitions for the Agent Monitoring Dashboard
 */

export type AgentStatus = 'ACTIVE' | 'ERROR' | 'IDLE' | 'DISABLED';

export interface AgentError {
  timestamp: string;
  message: string;
  stack?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  lastRun: string | null;
  lastDuration: number; // in milliseconds
  healthScore: number; // 0-1
  successRate: number; // 0-1
  totalExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  errors: AgentError[];
  enabled: boolean;
  category: string;
}

export interface AgentActivity {
  id: string;
  agentId: string;
  agentName: string;
  timestamp: string;
  duration: number;
  status: 'SUCCESS' | 'FAILURE' | 'TIMEOUT' | 'CANCELLED';
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface SystemHealth {
  overall: number; // 0-1
  totalAgents: number;
  activeAgents: number;
  errorAgents: number;
  idleAgents: number;
  disabledAgents: number;
  uptimePercentage: number;
  lastUpdated: string;
}

export interface AgentStatusResponse {
  agents: Agent[];
  systemHealth: SystemHealth;
  recentActivity: AgentActivity[];
}

export interface AgentMetrics {
  agentId: string;
  agentName: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
  averageResponseTime: number;
  peakResponseTime: number;
  lastHourExecutions: number;
}

export interface DashboardFilters {
  status?: AgentStatus[];
  category?: string[];
  search?: string;
  sortBy?: 'name' | 'status' | 'healthScore' | 'lastRun';
  sortOrder?: 'asc' | 'desc';
}
