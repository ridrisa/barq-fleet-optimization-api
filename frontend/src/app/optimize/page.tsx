'use client';

import { MapView } from '@/components/map-view';
import { RouteList } from '@/components/route-list';
import { OptimizationForm } from '@/components/optimization-form';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { fetchLatestOptimization } from '@/store/slices/routesSlice';
import { Loader2, Info, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ErrorAlert } from '@/components/error-alert';
import Link from 'next/link';

// Define a type that matches the expected state shape
interface RoutesState {
  optimizationResponse: any | null;
  loading: boolean;
  error: string | null;
  pagination: {
    limit: number;
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}

export default function OptimizePage() {
  const [showOptimizationForm, setShowOptimizationForm] = useState(false);
  const dispatch = useDispatch<AppDispatch>();

  const routesState = useSelector((state: RootState) => state.routes as RoutesState);
  const { loading, error, optimizationResponse, pagination } = routesState || {
    loading: false,
    error: null,
    optimizationResponse: null,
    pagination: { limit: 10, currentPage: 1, totalPages: 1, totalItems: 0 },
  };

  const [apiUrl, setApiUrl] = useState('');
  const [fetchAttempted, setFetchAttempted] = useState(false);

  useEffect(() => {
    setApiUrl(process.env.NEXT_PUBLIC_API_URL || 'Not configured');
    dispatch(
      fetchLatestOptimization({
        limit: pagination.limit,
        page: pagination.currentPage,
      })
    ).finally(() => setFetchAttempted(true));
  }, [dispatch, pagination.limit, pagination.currentPage]);

  const handleRetry = () => {
    dispatch(
      fetchLatestOptimization({
        limit: pagination.limit,
        page: pagination.currentPage,
      })
    );
  };

  const handleNewOptimization = () => {
    setShowOptimizationForm(true);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="w-full flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-lg font-medium">Loading optimization data...</p>
            <p className="text-sm text-muted-foreground">Connecting to {apiUrl}</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="w-full">
          <ErrorAlert
            error={{
              message: error,
              response: {
                data: { error },
                config: { url: apiUrl }
              }
            }}
            onRetry={handleRetry}
            showDetails={true}
          />
          <div className="mt-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Need Help?</AlertTitle>
              <AlertDescription>
                <p className="mb-2">Make sure the backend server is running at: {apiUrl}</p>
                <Button onClick={handleNewOptimization} variant="default" size="sm" className="mt-2">
                  Create New Route Optimization
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }

    if (!optimizationResponse && fetchAttempted) {
      return (
        <div className="w-full">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>No route data found</AlertTitle>
            <AlertDescription>
              <p className="mb-4">
                There are no existing route optimizations. Create a new one to get started.
              </p>
              <Button onClick={handleNewOptimization} variant="default" size="sm">
                Create New Route Optimization
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return (
      <div className="flex flex-1 w-full gap-4">
        <div className="w-1/4 bg-card rounded-lg shadow-md p-0 h-[calc(100vh-160px)] overflow-hidden flex flex-col">
          <RouteList />
        </div>
        <div className="w-3/4 bg-card rounded-lg shadow-md p-2">
          <div className="h-[calc(100vh-160px)]">
            <MapView />
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="flex min-h-screen flex-col">
      <header className="bg-primary p-4 text-white">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                <Home className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Route Optimization</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleNewOptimization}
              className="bg-white text-primary px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors font-medium"
            >
              New Optimization
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 container mx-auto p-4">{renderContent()}</div>

      {showOptimizationForm && <OptimizationForm onClose={() => setShowOptimizationForm(false)} />}
    </main>
  );
}
