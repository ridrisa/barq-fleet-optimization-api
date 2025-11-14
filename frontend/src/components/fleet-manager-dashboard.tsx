'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Target,
  Sparkles,
  Send,
  RefreshCw,
  Activity,
  DollarSign,
  Package,
  Brain
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://route-opt-backend-sek7q2ajva-uc.a.run.app';

interface Driver {
  driver_id: string;
  target_deliveries: number;
  current_deliveries: number;
  target_revenue: number;
  current_revenue: number;
  delivery_progress: string;
  revenue_progress: string;
  status: string;
}

interface TargetStatus {
  drivers_on_track: number;
  total_drivers: number;
  percentage: string;
  drivers: Driver[];
}

interface AtRiskOrder {
  order_id: string;
  customer_name?: string;
  remaining_minutes: number;
  urgency_level: string;
  sla_hours: number;
}

interface AIRecommendation {
  priority: string;
  action: string;
  expected_impact: string;
  implementation: string;
}

export function FleetManagerDashboard() {
  const [targetStatus, setTargetStatus] = useState<TargetStatus | null>(null);
  const [atRiskOrders, setAtRiskOrders] = useState<AtRiskOrder[]>([]);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [llmEnabled, setLlmEnabled] = useState(false);

  // Fetch target status
  const fetchTargetStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/fleet-manager/targets/status`);
      const data = await response.json();
      if (data.success) {
        setTargetStatus(data.target_status);
      }
    } catch (error) {
      console.error('Error fetching target status:', error);
    }
  };

  // Fetch dashboard data on mount
  useEffect(() => {
    fetchTargetStatus();
    checkLLMStatus();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchTargetStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Check LLM service status
  const checkLLMStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/fleet-manager/ai/status`);
      const data = await response.json();
      setLlmEnabled(data.llm_advisor?.enabled || false);
    } catch (error) {
      console.error('Error checking LLM status:', error);
    }
  };

  // Get AI recommendations
  const fetchAIRecommendations = async () => {
    if (!targetStatus) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/fleet-manager/ai/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fleetMetrics: {
            targetStatus: targetStatus,
            drivers_on_track: targetStatus.drivers_on_track,
            total_drivers: targetStatus.total_drivers,
          }
        })
      });
      const data = await response.json();
      if (data.success && data.recommendations?.top_recommendations) {
        setRecommendations(data.recommendations.top_recommendations);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle AI query
  const handleAIQuery = async () => {
    if (!aiQuery.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/fleet-manager/ai/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiQuery })
      });
      const data = await response.json();
      if (data.success) {
        setAiResponse(data.response);
      } else {
        setAiResponse(data.response || 'Unable to process query. LLM service may be unavailable.');
      }
    } catch (error) {
      setAiResponse('Error processing query. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      available: 'bg-green-100 text-green-700',
      busy: 'bg-yellow-100 text-yellow-700',
      break: 'bg-blue-100 text-blue-700',
      offline: 'bg-gray-100 text-gray-700',
    };
    return statusMap[status.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  const getProgressColor = (progress: string) => {
    const percentage = parseFloat(progress);
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPriorityColor = (priority: string): "destructive" | "default" | "secondary" => {
    const priorityMap: Record<string, "destructive" | "default" | "secondary"> = {
      high: 'destructive',
      medium: 'default',
      low: 'secondary',
    };
    return priorityMap[priority.toLowerCase()] || 'secondary';
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">Fleet Manager</h1>
              <p className="text-muted-foreground">
                Dynamic fleet management with AI-powered optimization and SLA compliance
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={fetchTargetStatus} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {llmEnabled && (
                <Badge variant="default" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI Enabled
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5" />
            <div className="relative p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500 rounded-xl shadow-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Drivers</p>
                  <p className="text-3xl font-bold text-blue-600">{targetStatus?.total_drivers || 0}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-green-600/5" />
            <div className="relative p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500 rounded-xl shadow-lg">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">On Track</p>
                  <p className="text-3xl font-bold text-green-600">{targetStatus?.drivers_on_track || 0}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5" />
            <div className="relative p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500 rounded-xl shadow-lg">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Behind Target</p>
                  <p className="text-3xl font-bold text-yellow-600">
                    {targetStatus ? targetStatus.total_drivers - targetStatus.drivers_on_track : 0}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-purple-600/5" />
            <div className="relative p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500 rounded-xl shadow-lg">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Achievement</p>
                  <p className="text-3xl font-bold text-purple-600">{targetStatus?.percentage || '0%'}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Driver Target Tracking */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Activity className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Driver Target Progress</h2>
              </div>

              <div className="space-y-4">
                {targetStatus?.drivers && targetStatus.drivers.length > 0 ? (
                  targetStatus.drivers.map((driver) => (
                    <div key={driver.driver_id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">{driver.driver_id}</p>
                            <Badge className={`text-xs ${getStatusColor(driver.status)}`}>
                              {driver.status}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Deliveries</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold">
                              {driver.current_deliveries}/{driver.target_deliveries}
                            </span>
                            <span className={`text-sm font-medium ${getProgressColor(driver.delivery_progress)}`}>
                              {driver.delivery_progress}
                            </span>
                          </div>
                          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: driver.delivery_progress }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Revenue</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold">
                              ${driver.current_revenue}/${driver.target_revenue}
                            </span>
                            <span className={`text-sm font-medium ${getProgressColor(driver.revenue_progress)}`}>
                              {driver.revenue_progress}
                            </span>
                          </div>
                          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 transition-all"
                              style={{ width: driver.revenue_progress }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No driver targets set</p>
                    <p className="text-sm mt-2">Use the API to set driver targets</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* AI Query Interface */}
          <div className="lg:col-span-1">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">AI Assistant</h2>
                {!llmEnabled && (
                  <Badge variant="secondary" className="text-xs">Fallback Mode</Badge>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <Textarea
                    placeholder="Ask about your fleet... e.g., 'Which drivers need more orders?' or 'What's causing SLA violations?'"
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                <Button
                  onClick={handleAIQuery}
                  disabled={loading || !aiQuery.trim()}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Ask AI
                    </>
                  )}
                </Button>

                {aiResponse && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{aiResponse}</p>
                  </div>
                )}

                {!aiResponse && (
                  <div className="mt-4 p-4 border-2 border-dashed rounded-lg text-center text-sm text-muted-foreground">
                    <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Ask questions about your fleet</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* AI Recommendations */}
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">AI Optimization Recommendations</h2>
            </div>
            <Button
              onClick={fetchAIRecommendations}
              disabled={loading || !targetStatus}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Get Recommendations
            </Button>
          </div>

          {recommendations.length > 0 ? (
            <div className="space-y-4">
              {recommendations.map((rec, index) => (
                <div key={index} className="border-l-4 border-primary pl-4 py-2">
                  <div className="flex items-start gap-3 mb-2">
                    <Badge variant={getPriorityColor(rec.priority)}>
                      {rec.priority}
                    </Badge>
                    <div className="flex-1">
                      <p className="font-semibold mb-1">{rec.action}</p>
                      <p className="text-sm text-muted-foreground mb-2">
                        <strong>Expected Impact:</strong> {rec.expected_impact}
                      </p>
                      <p className="text-sm">
                        <strong>Implementation:</strong> {rec.implementation}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Click "Get Recommendations" to receive AI-powered optimization suggestions</p>
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="justify-start gap-2">
              <Target className="h-4 w-4" />
              Set Driver Targets
            </Button>
            <Button variant="outline" className="justify-start gap-2">
              <AlertTriangle className="h-4 w-4" />
              View At-Risk Orders
            </Button>
            <Button variant="outline" className="justify-start gap-2">
              <TrendingUp className="h-4 w-4" />
              View Analytics
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
