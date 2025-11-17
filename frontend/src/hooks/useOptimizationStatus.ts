/**
 * Custom hook for real-time optimization status polling
 * Polls the backend for optimization progress and updates
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { getOptimizationStatus } from '@/store/slices/routesSlice';
import type { AppDispatch } from '@/store/store';

interface OptimizationStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  error?: string;
  result?: any;
}

interface UseOptimizationStatusOptions {
  requestId: string | null;
  isProcessing: boolean;
  pollInterval?: number; // Polling interval in milliseconds
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

export function useOptimizationStatus({
  requestId,
  isProcessing,
  pollInterval = 2000, // Poll every 2 seconds by default
  onComplete,
  onError,
}: UseOptimizationStatusOptions) {
  const dispatch = useDispatch<AppDispatch>();
  const [status, setStatus] = useState<OptimizationStatus>({
    status: 'pending',
    progress: 0,
  });
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Polling function
  const pollStatus = useCallback(async () => {
    if (!requestId || !mountedRef.current) return;

    try {
      const result = await dispatch(getOptimizationStatus(requestId)).unwrap();

      if (!mountedRef.current) return;

      // Update status based on result
      if (result.success && result.data) {
        const data = result.data;

        // If optimization is completed
        if (data.status === 'completed' || data.completed === true) {
          setStatus({
            status: 'completed',
            progress: 100,
            message: 'Optimization completed successfully',
            result: data,
          });

          // Stop polling
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsPolling(false);

          // Call onComplete callback
          if (onComplete) {
            onComplete(data);
          }
        }
        // If optimization failed
        else if (data.status === 'failed' || data.error) {
          setStatus({
            status: 'failed',
            progress: 0,
            error: data.error || 'Optimization failed',
            message: data.error || 'Optimization failed',
          });

          // Stop polling
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsPolling(false);

          // Call onError callback
          if (onError) {
            onError(data.error || 'Optimization failed');
          }
        }
        // If still processing
        else {
          setStatus({
            status: 'processing',
            progress: data.progress || 50, // Default to 50% if no progress info
            message: data.message || 'Optimizing routes...',
          });
        }
      } else {
        // If no data or not successful, assume still processing
        setStatus((prev) => ({
          ...prev,
          status: 'processing',
          message: 'Optimizing routes...',
        }));
      }
    } catch (error: any) {
      if (!mountedRef.current) return;

      console.error('Error polling optimization status:', error);

      // Don't fail on polling errors, just continue
      // The optimization might still be processing
      setStatus((prev) => ({
        ...prev,
        status: 'processing',
        message: 'Checking optimization status...',
      }));
    }
  }, [requestId, dispatch, onComplete, onError]);

  // Start/stop polling based on processing state
  useEffect(() => {
    if (!requestId || !isProcessing) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPolling(false);
      return;
    }

    // Start polling
    setIsPolling(true);
    setStatus({
      status: 'processing',
      progress: 10,
      message: 'Starting optimization...',
    });

    // Poll immediately
    pollStatus();

    // Set up interval for subsequent polls
    intervalRef.current = setInterval(() => {
      pollStatus();
    }, pollInterval);

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [requestId, isProcessing, pollInterval, pollStatus]);

  return {
    status: status.status,
    progress: status.progress || 0,
    message: status.message,
    error: status.error,
    result: status.result,
    isPolling,
  };
}
