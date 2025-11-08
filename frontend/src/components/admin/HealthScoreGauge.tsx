'use client';

import React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';

interface HealthScoreGaugeProps {
  score: number; // 0-1
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showTrend?: boolean;
  previousScore?: number;
}

export const HealthScoreGauge: React.FC<HealthScoreGaugeProps> = ({
  score,
  size = 'md',
  showLabel = true,
  showTrend = false,
  previousScore,
}) => {
  const percentage = Math.round(score * 100);

  const getHealthColor = (score: number) => {
    if (score >= 0.9) return { bg: 'bg-green-500', text: 'text-green-600', ring: 'ring-green-500' };
    if (score >= 0.7)
      return { bg: 'bg-yellow-500', text: 'text-yellow-600', ring: 'ring-yellow-500' };
    if (score >= 0.5)
      return { bg: 'bg-orange-500', text: 'text-orange-600', ring: 'ring-orange-500' };
    return { bg: 'bg-red-500', text: 'text-red-600', ring: 'ring-red-500' };
  };

  const getHealthLabel = (score: number) => {
    if (score >= 0.9) return 'Excellent';
    if (score >= 0.7) return 'Good';
    if (score >= 0.5) return 'Fair';
    return 'Poor';
  };

  const getTrend = () => {
    if (!previousScore) return null;
    const diff = score - previousScore;
    if (Math.abs(diff) < 0.01) return null;
    return diff > 0 ? 'up' : 'down';
  };

  const colors = getHealthColor(score);
  const healthLabel = getHealthLabel(score);
  const trend = getTrend();

  const sizes = {
    sm: { width: 60, height: 60, stroke: 4, text: 'text-lg', label: 'text-xs' },
    md: { width: 80, height: 80, stroke: 6, text: 'text-xl', label: 'text-sm' },
    lg: { width: 120, height: 120, stroke: 8, text: 'text-3xl', label: 'text-base' },
  };

  const config = sizes[size];
  const radius = (config.width - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - score * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-flex items-center justify-center">
        <svg width={config.width} height={config.height} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={config.width / 2}
            cy={config.height / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={config.stroke}
            fill="none"
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Progress circle */}
          <circle
            cx={config.width / 2}
            cy={config.height / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={config.stroke}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`${colors.bg} transition-all duration-500`}
            style={{ stroke: 'currentColor' }}
          />
        </svg>
        {/* Center text */}
        <div
          className={`absolute flex flex-col items-center justify-center ${config.text} font-bold ${colors.text}`}
        >
          <span>{percentage}%</span>
        </div>
      </div>

      {showLabel && (
        <div className="flex items-center gap-2">
          <span className={`${config.label} font-medium ${colors.text}`}>{healthLabel}</span>
          {showTrend && trend && (
            <span className={`${config.label}`}>
              {trend === 'up' ? (
                <TrendingUp size={14} className="text-green-500" />
              ) : (
                <TrendingDown size={14} className="text-red-500" />
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
