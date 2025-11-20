/**
 * Agent Monitoring Types
 * Type definitions for the Agent Monitoring Dashboard
 */

export type AgentStatus = 'ACTIVE' | 'ERROR' | 'IDLE' | 'DISABLED' | 'STARTING' | 'STOPPING';

export interface AgentError {
  timestamp: string;
  message: string;
  stack?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface AgentConfiguration {
  [key: string]: any;
  executionInterval?: number;
  retryLimit?: number;
  timeout?: number;
}

export interface AgentLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  metadata?: Record<string, any>;
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
  configuration?: AgentConfiguration;
  logs?: AgentLogEntry[];
  isControllable?: boolean;
  canRestart?: boolean;
  canConfigure?: boolean;
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

export interface AgentControlRequest {
  action: 'start' | 'stop' | 'restart' | 'configure';
  agentId: string;
  configuration?: AgentConfiguration;
}

export interface AgentControlResponse {
  success: boolean;
  message: string;
  agent?: Agent;
  error?: string;
}

export interface AgentLogsRequest {
  agentId: string;
  limit?: number;
  level?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  since?: string;
}

export interface AgentLogsResponse {
  success: boolean;
  logs: AgentLogEntry[];
  total: number;
}
