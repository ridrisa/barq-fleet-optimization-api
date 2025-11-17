/**
 * Optimization Progress Indicator Component
 * Displays real-time progress of route optimization
 */

'use client';

import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface OptimizationProgressProps {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  error?: string;
}

export function OptimizationProgress({
  status,
  progress,
  message,
  error,
}: OptimizationProgressProps) {
  // Determine the display elements based on status
  const getStatusDisplay = () => {
    switch (status) {
      case 'pending':
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />,
          title: 'Preparing Optimization',
          color: 'bg-muted-foreground',
        };
      case 'processing':
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-primary" />,
          title: 'Optimizing Routes',
          color: 'bg-primary',
        };
      case 'completed':
        return {
          icon: <CheckCircle className="h-5 w-5 text-green-500" />,
          title: 'Optimization Complete',
          color: 'bg-green-500',
        };
      case 'failed':
        return {
          icon: <AlertCircle className="h-5 w-5 text-destructive" />,
          title: 'Optimization Failed',
          color: 'bg-destructive',
        };
      default:
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />,
          title: 'Processing',
          color: 'bg-muted-foreground',
        };
    }
  };

  const display = getStatusDisplay();
  const progressPercent = Math.min(100, Math.max(0, progress));

  return (
    <div className="w-full space-y-3">
      {/* Header with icon and title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {display.icon}
          <span className="font-medium text-sm">{display.title}</span>
        </div>
        <span className="text-sm text-muted-foreground">{progressPercent}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${display.color} transition-all duration-500 ease-out`}
          style={{ width: `${progressPercent}%` }}
        >
          {/* Animated stripe effect for processing state */}
          {status === 'processing' && (
            <div
              className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
              style={{
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s infinite',
              }}
            />
          )}
        </div>
      </div>

      {/* Message or error */}
      {message && !error && (
        <p className="text-xs text-muted-foreground">{message}</p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Progress stages indicator */}
      {status === 'processing' && (
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
          <span className={progressPercent >= 25 ? 'text-primary font-medium' : ''}>
            Analyzing
          </span>
          <span className={progressPercent >= 50 ? 'text-primary font-medium' : ''}>
            Computing
          </span>
          <span className={progressPercent >= 75 ? 'text-primary font-medium' : ''}>
            Optimizing
          </span>
          <span className={progressPercent >= 90 ? 'text-primary font-medium' : ''}>
            Finalizing
          </span>
        </div>
      )}
    </div>
  );
}

// Add shimmer animation to global CSS or tailwind config
// @keyframes shimmer {
//   0% { background-position: -200% 0; }
//   100% { background-position: 200% 0; }
// }
