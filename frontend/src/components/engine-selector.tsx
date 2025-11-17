'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Info, Cpu, Zap, Activity, Database, Brain } from 'lucide-react';

interface EngineSelectorProps {
  value: string;
  onChange: (value: string) => void;
  showAdvanced?: boolean;
}

export function EngineSelector({ value, onChange, showAdvanced = false }: EngineSelectorProps) {
  const engines = [
    {
      id: 'auto',
      name: 'Auto (Intelligent Selection)',
      icon: Brain,
      description: 'System automatically selects the best optimization engine based on your request',
      color: 'blue',
      recommended: true,
      features: [
        'CVRP for large batches (50+ deliveries)',
        'OSRM for real-time urgent deliveries',
        'Automatic fallback on failures',
      ],
    },
    {
      id: 'cvrp',
      name: 'OR-Tools CVRP',
      icon: Database,
      description: 'Google OR-Tools Capacitated Vehicle Routing Problem solver',
      color: 'purple',
      recommended: false,
      features: [
        'Best for large batches (50+ deliveries)',
        'Fair workload distribution',
        'Capacity constraints supported',
        'Time window optimization',
      ],
      advanced: true,
    },
    {
      id: 'osrm',
      name: 'OSRM Real-Time',
      icon: Zap,
      description: 'Open Source Routing Machine for fast real-time routing',
      color: 'green',
      recommended: false,
      features: [
        'Ultra-fast real-time routing',
        'Best for small batches (<50 deliveries)',
        'Immediate results',
        'Lower computational cost',
      ],
      advanced: true,
    },
    {
      id: 'genetic',
      name: 'Genetic Algorithm',
      icon: Activity,
      description: 'Evolutionary optimization for efficiency-focused routes',
      color: 'orange',
      recommended: false,
      features: [
        'BULLET service optimization',
        'Efficiency-focused (50 population, 100 generations)',
        'Explores multiple solutions',
        'Best for complex routing scenarios',
      ],
      advanced: true,
    },
    {
      id: 'nearest_neighbor',
      name: 'Nearest Neighbor',
      icon: Cpu,
      description: 'Fast greedy algorithm for urgent deliveries',
      color: 'red',
      recommended: false,
      features: [
        'BARQ service (urgent deliveries)',
        'Fastest execution time',
        'Max detour: 2km, 60 minutes',
        'Simple and reliable',
      ],
      advanced: true,
    },
  ];

  const selectedEngine = engines.find((e) => e.id === value) || engines[0];
  const SelectedIcon = selectedEngine.icon;

  return (
    <div className="space-y-4">
      {/* Engine Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Optimization Engine</label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {engines
            .filter((engine) => !engine.advanced || showAdvanced)
            .map((engine) => {
              const Icon = engine.icon;
              const isSelected = engine.id === value;

              return (
                <button
                  key={engine.id}
                  type="button"
                  onClick={() => onChange(engine.id)}
                  className={`relative p-4 text-left rounded-lg border-2 transition-all ${
                    isSelected
                      ? `border-${engine.color}-500 bg-${engine.color}-50 dark:bg-${engine.color}-950 shadow-md`
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {/* Recommended Badge */}
                  {engine.recommended && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="default" className="text-xs">
                        Recommended
                      </Badge>
                    </div>
                  )}

                  {/* Engine Icon */}
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected
                          ? `bg-${engine.color}-100 dark:bg-${engine.color}-900`
                          : 'bg-gray-100 dark:bg-gray-800'
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 ${
                          isSelected
                            ? `text-${engine.color}-600 dark:text-${engine.color}-400`
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{engine.name}</div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground mb-3">{engine.description}</p>

                  {/* Features (only for selected) */}
                  {isSelected && (
                    <div className="space-y-1 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      {engine.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs">
                          <div className="w-1 h-1 rounded-full bg-current mt-1.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
        </div>
      </div>

      {/* Selected Engine Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${selectedEngine.color}-100 dark:bg-${selectedEngine.color}-900`}>
              <SelectedIcon className={`w-5 h-5 text-${selectedEngine.color}-600 dark:text-${selectedEngine.color}-400`} />
            </div>
            <div>
              <CardTitle className="text-base">{selectedEngine.name}</CardTitle>
              <CardDescription className="text-xs">{selectedEngine.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs space-y-2">
                {selectedEngine.id === 'auto' && (
                  <>
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      Intelligent Engine Selection
                    </p>
                    <p className="text-blue-700 dark:text-blue-300">
                      The system will automatically choose between CVRP (for large batches), OSRM (for
                      real-time), Genetic Algorithm (for BULLET efficiency), or Nearest Neighbor (for BARQ
                      urgency) based on your delivery count, service type, and requirements.
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="bg-white dark:bg-gray-900 rounded p-2">
                        <div className="font-medium text-blue-900 dark:text-blue-100">50+ deliveries</div>
                        <div className="text-blue-600 dark:text-blue-400 text-xs">→ CVRP Engine</div>
                      </div>
                      <div className="bg-white dark:bg-gray-900 rounded p-2">
                        <div className="font-medium text-blue-900 dark:text-blue-100">&lt;50 deliveries</div>
                        <div className="text-blue-600 dark:text-blue-400 text-xs">→ OSRM Engine</div>
                      </div>
                    </div>
                  </>
                )}
                {selectedEngine.id === 'cvrp' && (
                  <>
                    <p className="font-medium text-blue-900 dark:text-blue-100">OR-Tools CVRP Engine</p>
                    <p className="text-blue-700 dark:text-blue-300">
                      Uses Google's Operations Research tools with Guided Local Search. Best for large batch
                      optimization with fair workload distribution across vehicles. Supports capacity
                      constraints and time windows.
                    </p>
                  </>
                )}
                {selectedEngine.id === 'osrm' && (
                  <>
                    <p className="font-medium text-blue-900 dark:text-blue-100">OSRM Real-Time Engine</p>
                    <p className="text-blue-700 dark:text-blue-300">
                      Uses Open Source Routing Machine for ultra-fast routing. Perfect for small batches and
                      urgent deliveries requiring immediate results. Lower computational cost but may not
                      optimize as deeply as CVRP for large batches.
                    </p>
                  </>
                )}
                {selectedEngine.id === 'genetic' && (
                  <>
                    <p className="font-medium text-blue-900 dark:text-blue-100">Genetic Algorithm Engine</p>
                    <p className="text-blue-700 dark:text-blue-300">
                      Evolutionary optimization with 50 population size and 100 generations. Uses tournament
                      selection, order crossover, and swap mutation. Ideal for BULLET service efficiency
                      optimization.
                    </p>
                  </>
                )}
                {selectedEngine.id === 'nearest_neighbor' && (
                  <>
                    <p className="font-medium text-blue-900 dark:text-blue-100">Nearest Neighbor Engine</p>
                    <p className="text-blue-700 dark:text-blue-300">
                      Fast greedy algorithm for urgent BARQ deliveries. Builds routes by always selecting the
                      nearest unvisited delivery. Max detour 2km, max duration 60 minutes. Fastest execution
                      time.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
