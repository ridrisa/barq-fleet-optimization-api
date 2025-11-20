/**
 * Agent Control API Client
 * Provides functions for agent control operations
 */

import { 
  Agent, 
  AgentControlRequest, 
  AgentControlResponse, 
  AgentLogEntry, 
  AgentLogsResponse,
  AgentConfiguration
} from '@/types/agent';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

class AgentControlAPI {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Get auth token from localStorage or cookie
    const token = localStorage.getItem('auth_token') || '';
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Start an agent
   */
  async startAgent(agentId: string): Promise<AgentControlResponse> {
    return this.request<AgentControlResponse>('/api/admin/agents/control', {
      method: 'POST',
      body: JSON.stringify({
        action: 'start',
        agentId,
      }),
    });
  }

  /**
   * Stop an agent
   */
  async stopAgent(agentId: string): Promise<AgentControlResponse> {
    return this.request<AgentControlResponse>('/api/admin/agents/control', {
      method: 'POST',
      body: JSON.stringify({
        action: 'stop',
        agentId,
      }),
    });
  }

  /**
   * Restart an agent
   */
  async restartAgent(agentId: string): Promise<AgentControlResponse> {
    return this.request<AgentControlResponse>('/api/admin/agents/control', {
      method: 'POST',
      body: JSON.stringify({
        action: 'restart',
        agentId,
      }),
    });
  }

  /**
   * Update agent configuration
   */
  async configureAgent(agentId: string, configuration: AgentConfiguration): Promise<AgentControlResponse> {
    return this.request<AgentControlResponse>('/api/admin/agents/control', {
      method: 'POST',
      body: JSON.stringify({
        action: 'configure',
        agentId,
        configuration,
      }),
    });
  }

  /**
   * Get agent logs
   */
  async getAgentLogs(agentId: string, params?: {
    limit?: number;
    level?: string;
    since?: string;
  }): Promise<AgentLogEntry[]> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.level) searchParams.set('level', params.level);
    if (params?.since) searchParams.set('since', params.since);

    const response = await this.request<AgentLogsResponse>(
      `/api/admin/agents/${agentId}/logs?${searchParams.toString()}`
    );
    
    return response.logs;
  }

  /**
   * Execute an agent manually
   */
  async executeAgent(agentName: string, context?: any): Promise<any> {
    return this.request(`/api/admin/agents/${agentName}/execute`, {
      method: 'POST',
      body: JSON.stringify({ context }),
    });
  }

  /**
   * Get agent details
   */
  async getAgentDetails(agentName: string): Promise<any> {
    return this.request(`/api/admin/agents/${agentName}`);
  }

  /**
   * Get agent execution history
   */
  async getAgentHistory(agentName: string, limit?: number): Promise<any> {
    const searchParams = new URLSearchParams();
    if (limit) searchParams.set('limit', limit.toString());
    
    return this.request(`/api/admin/agents/${agentName}/history?${searchParams.toString()}`);
  }

  /**
   * Get real-time agent status (WebSocket alternative)
   */
  async pollAgentStatus(): Promise<any> {
    return this.request('/api/admin/agents/status');
  }

  /**
   * Get system health metrics
   */
  async getSystemHealth(): Promise<any> {
    return this.request('/api/admin/system/health');
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<any> {
    return this.request('/api/admin/system/metrics');
  }

  /**
   * Get recent system errors
   */
  async getRecentErrors(limit?: number): Promise<any> {
    const searchParams = new URLSearchParams();
    if (limit) searchParams.set('limit', limit.toString());
    
    return this.request(`/api/admin/system/errors?${searchParams.toString()}`);
  }
}

// Export singleton instance
export const agentControlAPI = new AgentControlAPI();
export default agentControlAPI;