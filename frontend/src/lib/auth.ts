/**
 * Authentication Service
 * Handles user authentication and authorization
 */

export interface AuthToken {
  token: string;
  expiresAt: number;
  userId?: string;
  role?: string;
}

export class AuthService {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly USER_KEY = 'auth_user';

  /**
   * Set authentication token in localStorage
   */
  static setToken(token: string, expiresIn?: number): void {
    if (typeof window === 'undefined') return;

    const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : Date.now() + 24 * 60 * 60 * 1000; // Default 24 hours

    const authToken: AuthToken = {
      token,
      expiresAt,
    };

    localStorage.setItem(this.TOKEN_KEY, JSON.stringify(authToken));
  }

  /**
   * Get authentication token from localStorage
   */
  static getToken(): string | null {
    if (typeof window === 'undefined') return null;

    try {
      const tokenData = localStorage.getItem(this.TOKEN_KEY);
      if (!tokenData) return null;

      const authToken: AuthToken = JSON.parse(tokenData);

      // Check if token is expired
      if (authToken.expiresAt && authToken.expiresAt < Date.now()) {
        this.removeToken();
        return null;
      }

      return authToken.token;
    } catch (error) {
      console.error('Error parsing auth token:', error);
      return null;
    }
  }

  /**
   * Remove authentication token from localStorage
   */
  static removeToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Set user information
   */
  static setUser(user: any): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  /**
   * Get user information
   */
  static getUser(): any | null {
    if (typeof window === 'undefined') return null;

    try {
      const userData = localStorage.getItem(this.USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  }

  /**
   * Clear all authentication data
   */
  static clearAuth(): void {
    this.removeToken();
  }
}

// Export convenience functions
export const auth = {
  setToken: AuthService.setToken.bind(AuthService),
  getToken: AuthService.getToken.bind(AuthService),
  removeToken: AuthService.removeToken.bind(AuthService),
  isAuthenticated: AuthService.isAuthenticated.bind(AuthService),
  setUser: AuthService.setUser.bind(AuthService),
  getUser: AuthService.getUser.bind(AuthService),
  clearAuth: AuthService.clearAuth.bind(AuthService),
};

export default auth;
