/**
 * API Client Service
 * Centralized API configuration and request handling
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://route-opt-backend-426674819922.us-central1.run.app';
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://route-opt-backend-426674819922.us-central1.run.app/ws';

export interface ApiClientConfig {
  baseUrl?: string;
  wsUrl?: string;
  version?: string;
  headers?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;
  private wsUrl: string;
  private version: string;
  private defaultHeaders: Record<string, string>;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || API_BASE_URL;
    this.wsUrl = config.wsUrl || WS_URL;
    this.version = config.version || API_VERSION;
    this.defaultHeaders = config.headers || {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Get the base URL for API requests
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Get the WebSocket URL
   */
  getWsUrl(): string {
    return this.wsUrl;
  }

  /**
   * Get HTTP(S) base URL derived from the WebSocket URL.
   * Useful because the demo control endpoints are exposed over HTTP
   * on the same host/port as the WebSocket server.
   */
  getWsHttpBaseUrl(): string {
    try {
      const ws = new URL(this.wsUrl);
      const protocol = ws.protocol === 'wss:' ? 'https:' : 'http:';
      return `${protocol}//${ws.host}`;
    } catch {
      // Fallback: attempt simple replacements
      if (this.wsUrl.startsWith('wss://')) return this.wsUrl.replace('wss://', 'https://');
      if (this.wsUrl.startsWith('ws://')) return this.wsUrl.replace('ws://', 'http://');
      return this.baseUrl;
    }
  }

  /**
   * Get the API version
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * Build versioned endpoint path
   */
  private buildVersionedPath(endpoint: string): string {
    // If endpoint already includes /api/v, don't add version
    if (endpoint.match(/^\/api\/v\d+\//)) {
      return endpoint;
    }

    // If endpoint starts with /api/, add version after it
    if (endpoint.startsWith('/api/')) {
      return endpoint.replace('/api/', `/api/${this.version}/`);
    }

    // Otherwise, prepend /api/version
    return `/api/${this.version}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  }

  /**
   * Get authentication token from localStorage
   */
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  }

  /**
   * Build headers with authentication if available
   */
  private buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    const headers = { ...this.defaultHeaders, ...customHeaders };
    const token = this.getAuthToken();

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add API version preference header
    headers['X-API-Version-Preference'] = this.version;

    return headers;
  }

  /**
   * Check for deprecation warnings in response
   */
  private checkDeprecationWarnings(response: Response): void {
    const deprecated = response.headers.get('X-API-Deprecated');
    const sunsetDate = response.headers.get('X-API-Sunset-Date');
    const warning = response.headers.get('Warning');

    if (deprecated === 'true') {
      console.warn('[API Client] Deprecation Warning:', {
        message: warning,
        sunsetDate,
        currentVersion: this.version,
      });
    }

    // Check for unversioned access warning
    const unversioned = response.headers.get('X-API-Unversioned-Access');
    if (unversioned === 'true') {
      console.warn(
        '[API Client] Using deprecated unversioned endpoint. Please update to use versioned endpoint.'
      );
    }
  }

  /**
   * Generic fetch wrapper with error handling
   */
  async fetch<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    // Build versioned path
    const versionedEndpoint = this.buildVersionedPath(endpoint);
    const url = versionedEndpoint.startsWith('http')
      ? versionedEndpoint
      : `${this.baseUrl}${versionedEndpoint}`;

    const config: RequestInit = {
      ...options,
      headers: this.buildHeaders(options?.headers as Record<string, string>),
    };

    try {
      const response = await fetch(url, config);

      // Check for deprecation warnings
      this.checkDeprecationWarnings(response);

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.message || response.statusText;
        throw new Error(`API Error (${response.status}): ${errorMessage}`);
      }

      // Parse JSON response
      return await response.json();
    } catch (error) {
      // Re-throw with additional context
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred during the API request');
    }
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PATCH request
   */
  async patch<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }

  /**
   * Absolute POST request to a fully-qualified URL, bypassing versioning.
   * Still applies default headers and auth if available.
   */
  async postAbsolute<T = any>(absoluteUrl: string, data?: any, options?: RequestInit): Promise<T> {
    const config: RequestInit = {
      ...options,
      method: 'POST',
      headers: this.buildHeaders(options?.headers as Record<string, string>),
      body: data ? JSON.stringify(data) : undefined,
    };

    const response = await fetch(absoluteUrl, config);
    this.checkDeprecationWarnings(response);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = (errorData as any).error || (errorData as any).message || response.statusText;
      throw new Error(`API Error (${response.status}): ${errorMessage}`);
    }
    return (await response.json()) as T;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for custom instances if needed
export default ApiClient;
