'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AgentStatus } from '@/types/agent';
import { Activity, AlertCircle, Circle, Power } from 'lucide-react';

interface StatusBadgeProps {
  status: AgentStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
}) => {
  const getStatusConfig = (status: AgentStatus) => {
    switch (status) {
      case 'ACTIVE':
        return {
          variant: 'success' as const,
          label: 'Active',
          icon: Activity,
          className: 'bg-green-500 hover:bg-green-600',
        };
      case 'ERROR':
        return {
          variant: 'error' as const,
          label: 'Error',
          icon: AlertCircle,
          className: 'bg-red-500 hover:bg-red-600',
        };
      case 'IDLE':
        return {
          variant: 'warning' as const,
          label: 'Idle',
          icon: Circle,
          className: 'bg-gray-400 hover:bg-gray-500',
        };
      case 'DISABLED':
        return {
          variant: 'secondary' as const,
          label: 'Disabled',
          icon: Power,
          className: 'bg-gray-600 hover:bg-gray-700',
        };
      default:
        return {
          variant: 'secondary' as const,
          label: 'Unknown',
          icon: Circle,
          className: 'bg-gray-400 hover:bg-gray-500',
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  return (
    <Badge
      variant={config.variant}
      className={`${config.className} ${sizeClasses[size]} flex items-center gap-1`}
    >
      {showIcon && <Icon size={iconSizes[size]} />}
      {config.label}
    </Badge>
  );
};
