/**
 * Enhanced Error Alert Component with Retry Functionality
 * Displays categorized errors with user-friendly messages and retry options
 */

'use client';

import { AlertCircle, RefreshCw, Info, WifiOff, Server, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { categorizeError, type CategorizedError } from '@/utils/retry';
import { useState } from 'react';

interface ErrorAlertProps {
  error: any;
  onRetry?: () => void | Promise<void>;
  onDismiss?: () => void;
  showDetails?: boolean;
}

export function ErrorAlert({ error, onRetry, onDismiss, showDetails = false }: ErrorAlertProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [showFullError, setShowFullError] = useState(false);

  // Categorize the error for better messaging
  const categorized: CategorizedError = categorizeError(error);

  // Get icon based on error category
  const getIcon = () => {
    switch (categorized.category) {
      case 'network':
      case 'timeout':
        return <WifiOff className="h-5 w-5" />;
      case 'server':
        return <Server className="h-5 w-5" />;
      case 'validation':
        return <AlertTriangle className="h-5 w-5" />;
      case 'client':
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  // Get alert variant based on error category
  const getVariant = (): 'default' | 'destructive' => {
    if (categorized.category === 'validation' || categorized.category === 'client') {
      return 'default';
    }
    return 'destructive';
  };

  // Get title based on error category
  const getTitle = () => {
    switch (categorized.category) {
      case 'network':
        return 'Connection Error';
      case 'timeout':
        return 'Request Timeout';
      case 'server':
        return 'Server Error';
      case 'validation':
        return 'Validation Error';
      case 'client':
        return 'Error';
      default:
        return 'Error';
    }
  };

  // Handle retry with loading state
  const handleRetry = async () => {
    if (!onRetry) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } catch (err) {
      // Error will be handled by the parent component
      console.error('Retry failed:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Alert variant={getVariant()} className="mb-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">{getIcon()}</div>
        <div className="ml-3 flex-1">
          <AlertTitle className="text-sm font-medium">{getTitle()}</AlertTitle>
          <AlertDescription className="mt-2 text-sm">
            <p>{categorized.message}</p>

            {/* Show status code if available */}
            {categorized.statusCode && (
              <p className="mt-1 text-xs text-muted-foreground">
                Status Code: {categorized.statusCode}
              </p>
            )}

            {/* Show retryable status */}
            {categorized.isRetryable && (
              <div className="mt-2 flex items-center text-xs text-muted-foreground">
                <Info className="h-3 w-3 mr-1" />
                <span>This error can be retried</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-3 flex items-center gap-2">
              {/* Retry button - only show if retryable and onRetry is provided */}
              {categorized.isRetryable && onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="h-8"
                >
                  {isRetrying ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1.5" />
                      Retry
                    </>
                  )}
                </Button>
              )}

              {/* Dismiss button */}
              {onDismiss && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDismiss}
                  className="h-8"
                >
                  Dismiss
                </Button>
              )}

              {/* Toggle details button */}
              {showDetails && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowFullError(!showFullError)}
                  className="h-8"
                >
                  {showFullError ? 'Hide' : 'Show'} Details
                </Button>
              )}
            </div>

            {/* Full error details - for debugging */}
            {showFullError && showDetails && (
              <div className="mt-3 p-2 bg-muted rounded-md">
                <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                  {JSON.stringify(
                    {
                      message: categorized.originalError.message,
                      status: categorized.originalError.response?.status,
                      data: categorized.originalError.response?.data,
                      code: categorized.originalError.code,
                    },
                    null,
                    2
                  )}
                </p>
              </div>
            )}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}

/**
 * Inline Error Message Component
 * A simpler, more compact error display for inline use
 */
interface InlineErrorProps {
  message: string;
  onRetry?: () => void | Promise<void>;
  className?: string;
}

export function InlineError({ message, onRetry, className = '' }: InlineErrorProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 text-sm text-destructive ${className}`}>
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
      {onRetry && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRetry}
          disabled={isRetrying}
          className="h-6 px-2 text-xs"
        >
          {isRetrying ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      )}
    </div>
  );
}
