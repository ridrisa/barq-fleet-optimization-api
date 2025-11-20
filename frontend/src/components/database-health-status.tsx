'use client';

import React from 'react';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { 
  FaDatabase, 
  FaCheckCircle, 
  FaExclamationTriangle, 
  FaTimesCircle, 
  FaClock,
  FaShieldAlt,
  FaInfoCircle
} from 'react-icons/fa';

interface ConnectionHealth {
  isHealthy: boolean;
  lastHealthCheck: string | null;
  consecutiveFailures: number;
  lastError: string | null;
  circuitBreaker: {
    isOpen: boolean;
    openSince: string | null;
    timeToResetMs: number;
  };
  recommendation: string;
}

interface SystemStatus {
  service: {
    status: string;
    uptime: number;
    version: string;
  };
  database: {
    health: ConnectionHealth;
    isProduction: boolean;
    fallbackMode: boolean;
  };
  jobs: {
    running: number;
    completed: number;
    maxHistory: number;
  };
  lastUpdated: string;
}

interface DatabaseHealthStatusProps {
  health?: ConnectionHealth;
  systemStatus?: SystemStatus;
}

export const DatabaseHealthStatus: React.FC<DatabaseHealthStatusProps> = ({ 
  health, 
  systemStatus 
}) => {
  if (!health && !systemStatus) {
    return (
      <Alert>
        <FaInfoCircle className="h-4 w-4" />
        <AlertTitle>Connection Status</AlertTitle>
        <AlertDescription>
          Database health information not available
        </AlertDescription>
      </Alert>
    );
  }

  const connectionData = health || systemStatus?.database.health;
  const dbStatus = systemStatus?.database;

  const getHealthIcon = () => {
    if (connectionData?.circuitBreaker.isOpen) {
      return <FaTimesCircle className="h-5 w-5 text-red-500" />;
    } else if ((connectionData?.consecutiveFailures ?? 0) > 0) {
      return <FaExclamationTriangle className="h-5 w-5 text-yellow-500" />;
    } else if (connectionData?.isHealthy) {
      return <FaCheckCircle className="h-5 w-5 text-green-500" />;
    } else {
      return <FaClock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = () => {
    if (dbStatus?.fallbackMode) {
      return <Badge variant="destructive">Demo Mode</Badge>;
    } else if (dbStatus?.isProduction) {
      return <Badge variant="default">Production</Badge>;
    } else if (connectionData?.circuitBreaker.isOpen) {
      return <Badge variant="destructive">Circuit Open</Badge>;
    } else if ((connectionData?.consecutiveFailures ?? 0) > 0) {
      return <Badge variant="secondary">Degraded</Badge>;
    } else {
      return <Badge variant="default">Healthy</Badge>;
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return 'Never';
    return new Date(timeString).toLocaleTimeString();
  };

  return (
    <div className="space-y-4">
      {/* Main Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <FaDatabase className="h-5 w-5" />
            Database Connection
            {getStatusBadge()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Health */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getHealthIcon()}
              <span className="font-medium">
                {dbStatus?.fallbackMode ? 'Demo Data Mode' : 'Production Database'}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Last Check: {formatTime(connectionData?.lastHealthCheck ?? null)}
            </div>
          </div>

          {/* Health Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium">Failures</div>
              <div className="text-muted-foreground">
                {connectionData?.consecutiveFailures || 0}
              </div>
            </div>
            <div>
              <div className="font-medium">Status</div>
              <div className="text-muted-foreground">
                {connectionData?.isHealthy ? 'Healthy' : 'Unhealthy'}
              </div>
            </div>
            {systemStatus && (
              <>
                <div>
                  <div className="font-medium">Uptime</div>
                  <div className="text-muted-foreground">
                    {formatUptime(systemStatus.service.uptime)}
                  </div>
                </div>
                <div>
                  <div className="font-medium">Running Jobs</div>
                  <div className="text-muted-foreground">
                    {systemStatus.jobs.running}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Recommendation */}
          {connectionData?.recommendation && (
            <Alert>
              <FaInfoCircle className="h-4 w-4" />
              <AlertDescription>
                {connectionData.recommendation}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Circuit Breaker Status */}
      {connectionData?.circuitBreaker.isOpen && (
        <Alert variant="destructive">
          <FaShieldAlt className="h-4 w-4" />
          <AlertTitle>Circuit Breaker Open</AlertTitle>
          <AlertDescription>
            Database connectivity issues detected. Analytics will use demo data until connection is restored.
            {connectionData.circuitBreaker.timeToResetMs > 0 && (
              <div className="mt-2">
                Time to reset: {Math.ceil(connectionData.circuitBreaker.timeToResetMs / 1000)}s
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Last Error */}
      {connectionData?.lastError && (connectionData?.consecutiveFailures ?? 0) > 0 && (
        <Alert variant="destructive">
          <FaExclamationTriangle className="h-4 w-4" />
          <AlertTitle>Connection Issues</AlertTitle>
          <AlertDescription className="font-mono text-xs">
            {connectionData.lastError}
          </AlertDescription>
        </Alert>
      )}

      {/* Demo Data Notice */}
      {dbStatus?.fallbackMode && (
        <Alert>
          <FaInfoCircle className="h-4 w-4" />
          <AlertTitle>Demo Data Active</AlertTitle>
          <AlertDescription>
            Analytics are using realistic Saudi Arabian demo data. Results include 52K+ orders, 850+ couriers, and 120+ hubs for demonstration purposes.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default DatabaseHealthStatus;