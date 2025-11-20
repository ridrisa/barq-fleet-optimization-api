'use client';

import React, { useState, useEffect } from 'react';
import { Agent, AgentConfiguration, AgentControlRequest } from '@/types/agent';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Save, X } from 'lucide-react';

interface AgentConfigModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: AgentConfiguration) => Promise<void>;
}

export const AgentConfigModal: React.FC<AgentConfigModalProps> = ({
  agent,
  isOpen,
  onClose,
  onSave,
}) => {
  const [configuration, setConfiguration] = useState<AgentConfiguration>({});
  const [loading, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (agent) {
      setConfiguration(agent.configuration || {});
      setError(null);
    }
  }, [agent]);

  const handleSave = async () => {
    if (!agent) return;
    
    setSaving(true);
    setError(null);
    
    try {
      await onSave(configuration);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const updateConfiguration = (key: string, value: any) => {
    setConfiguration(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  if (!agent) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Configure {agent.name}
          </DialogTitle>
          <DialogDescription>
            Modify the configuration parameters for this agent. Changes will take effect immediately.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
              <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
            </div>
          </div>
        )}

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {/* Common Configuration Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Execution Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="executionInterval">Execution Interval (ms)</Label>
                  <Input
                    id="executionInterval"
                    type="number"
                    value={configuration.executionInterval || ''}
                    onChange={(e) => updateConfiguration('executionInterval', parseInt(e.target.value) || 0)}
                    placeholder="5000"
                  />
                </div>
                <div>
                  <Label htmlFor="timeout">Timeout (ms)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={configuration.timeout || ''}
                    onChange={(e) => updateConfiguration('timeout', parseInt(e.target.value) || 0)}
                    placeholder="30000"
                  />
                </div>
                <div>
                  <Label htmlFor="retryLimit">Retry Limit</Label>
                  <Input
                    id="retryLimit"
                    type="number"
                    value={configuration.retryLimit || ''}
                    onChange={(e) => updateConfiguration('retryLimit', parseInt(e.target.value) || 0)}
                    placeholder="3"
                  />
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={configuration.priority || ''}
                    onChange={(e) => updateConfiguration('priority', parseInt(e.target.value) || 0)}
                    placeholder="1"
                    min="1"
                    max="10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Agent-Specific Configuration */}
          {agent.name === 'SLA Monitor' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">SLA Monitor Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="thresholdWarning">Warning Threshold (%)</Label>
                    <Input
                      id="thresholdWarning"
                      type="number"
                      value={configuration.thresholdWarning || ''}
                      onChange={(e) => updateConfiguration('thresholdWarning', parseInt(e.target.value) || 0)}
                      placeholder="80"
                      min="1"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="thresholdCritical">Critical Threshold (%)</Label>
                    <Input
                      id="thresholdCritical"
                      type="number"
                      value={configuration.thresholdCritical || ''}
                      onChange={(e) => updateConfiguration('thresholdCritical', parseInt(e.target.value) || 0)}
                      placeholder="90"
                      min="1"
                      max="100"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {agent.name === 'Route Optimization' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Route Optimization Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="maxRoutes">Max Routes per Batch</Label>
                    <Input
                      id="maxRoutes"
                      type="number"
                      value={configuration.maxRoutes || ''}
                      onChange={(e) => updateConfiguration('maxRoutes', parseInt(e.target.value) || 0)}
                      placeholder="50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="optimizationDepth">Optimization Depth</Label>
                    <Input
                      id="optimizationDepth"
                      type="number"
                      value={configuration.optimizationDepth || ''}
                      onChange={(e) => updateConfiguration('optimizationDepth', parseInt(e.target.value) || 0)}
                      placeholder="3"
                      min="1"
                      max="5"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {agent.name === 'Fleet Rebalancer' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Fleet Rebalancer Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="balanceThreshold">Balance Threshold (%)</Label>
                    <Input
                      id="balanceThreshold"
                      type="number"
                      value={configuration.balanceThreshold || ''}
                      onChange={(e) => updateConfiguration('balanceThreshold', parseInt(e.target.value) || 0)}
                      placeholder="75"
                      min="1"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxMovements">Max Movements per Cycle</Label>
                    <Input
                      id="maxMovements"
                      type="number"
                      value={configuration.maxMovements || ''}
                      onChange={(e) => updateConfiguration('maxMovements', parseInt(e.target.value) || 0)}
                      placeholder="10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Additional Custom Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Custom Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(configuration)
                .filter(([key]) => !['executionInterval', 'timeout', 'retryLimit', 'priority', 'thresholdWarning', 'thresholdCritical', 'maxRoutes', 'optimizationDepth', 'balanceThreshold', 'maxMovements'].includes(key))
                .map(([key, value]) => (
                  <div key={key} className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{key}</Label>
                      <Input
                        value={String(value)}
                        onChange={(e) => updateConfiguration(key, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Saving...' : 'Save Configuration'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};