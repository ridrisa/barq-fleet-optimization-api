/**
 * Retry Utility with Exponential Backoff
 * Provides automatic retry logic for failed API calls
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryableErrors?: number[]; // HTTP status codes to retry
  onRetry?: (attempt: number, error: any) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
  retryableErrors: [408, 429, 500, 502, 503, 504], // Timeout, Rate limit, Server errors
  onRetry: () => {},
};

/**
 * Sleep for a specified duration
 */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const delay = Math.min(
    options.initialDelay * Math.pow(options.backoffFactor, attempt),
    options.maxDelay
  );
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.3 * delay;
  return delay + jitter;
}

/**
 * Check if error is retryable based on status code
 */
function isRetryableError(error: any, options: Required<RetryOptions>): boolean {
  // Network errors (no response)
  if (!error.response) {
    return true;
  }

  // Check status code
  const status = error.response?.status;
  return options.retryableErrors.includes(status);
}

/**
 * Retry an async function with exponential backoff
 *
 * @param fn - Async function to retry
 * @param options - Retry configuration options
 * @returns Promise that resolves with the function result or rejects after all retries fail
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   () => axios.get('/api/data'),
 *   { maxRetries: 3, onRetry: (attempt) => console.log(`Retry ${attempt}`) }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts: Required<RetryOptions> = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // If this was the last attempt, throw the error
      if (attempt >= opts.maxRetries) {
        throw error;
      }

      // Check if error is retryable
      if (!isRetryableError(error, opts)) {
        throw error;
      }

      // Calculate delay and notify
      const delay = calculateDelay(attempt, opts);
      opts.onRetry(attempt + 1, error);

      console.log(
        `Retry attempt ${attempt + 1}/${opts.maxRetries} after ${Math.round(delay)}ms`,
        (error as any).response?.status || 'Network Error'
      );

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Error categorization helper
 */
export interface CategorizedError {
  category: 'network' | 'server' | 'client' | 'timeout' | 'validation';
  message: string;
  originalError: any;
  isRetryable: boolean;
  statusCode?: number;
}

/**
 * Categorize an error for better user messaging
 */
export function categorizeError(error: any): CategorizedError {
  // Network errors (no response from server)
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return {
        category: 'timeout',
        message: 'Request timed out. Please check your connection and try again.',
        originalError: error,
        isRetryable: true,
      };
    }

    return {
      category: 'network',
      message: 'Network error. Please check your internet connection and try again.',
      originalError: error,
      isRetryable: true,
    };
  }

  const status = error.response.status;
  const serverMessage = error.response.data?.error || error.response.data?.message;

  // Client errors (4xx)
  if (status >= 400 && status < 500) {
    if (status === 408) {
      return {
        category: 'timeout',
        message: 'Request timed out. Please try again.',
        originalError: error,
        isRetryable: true,
        statusCode: status,
      };
    }

    if (status === 422 || status === 400) {
      return {
        category: 'validation',
        message: serverMessage || 'Invalid request data. Please check your input.',
        originalError: error,
        isRetryable: false,
        statusCode: status,
      };
    }

    return {
      category: 'client',
      message: serverMessage || `Client error (${status}). Please try again.`,
      originalError: error,
      isRetryable: false,
      statusCode: status,
    };
  }

  // Server errors (5xx)
  if (status >= 500) {
    return {
      category: 'server',
      message: serverMessage || 'Server error. Please try again in a moment.',
      originalError: error,
      isRetryable: true,
      statusCode: status,
    };
  }

  // Unknown errors
  return {
    category: 'client',
    message: serverMessage || error.message || 'An unexpected error occurred.',
    originalError: error,
    isRetryable: false,
    statusCode: status,
  };
}
