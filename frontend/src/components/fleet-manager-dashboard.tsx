'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Brain,
  Truck,
  Edit,
  Trash2,
  Plus,
  MapPin,
  Calendar,
  Wrench,
  BarChart3,
  Navigation,
  Fuel,
  Battery,
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

interface Vehicle {
  id: string;
  name: string;
  type: string;
  licensePlate: string;
  capacity: number;
  status: 'active' | 'idle' | 'maintenance' | 'offline';
  driverId?: string;
  driverName?: string;
  currentLocation?: { lat: number; lng: number };
  mileage: number;
  fuelLevel?: number;
  lastMaintenance?: string;
  nextMaintenance?: string;
  utilizationRate?: number;
}

interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  date: string;
  type: string;
  description: string;
  cost: number;
  status: 'scheduled' | 'completed' | 'overdue';
}

interface AIRecommendation {
  priority: string;
  action: string;
  expected_impact: string;
  implementation: string;
}

export function FleetManagerDashboard() {
  const [targetStatus, setTargetStatus] = useState<TargetStatus | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isVehicleFormOpen, setIsVehicleFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Vehicle form state
  const [vehicleForm, setVehicleForm] = useState({
    name: '',
    type: 'CAR',
    licensePlate: '',
    capacity: 100,
    mileage: 0,
    fuelLevel: 100,
  });

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

  // Initialize mock vehicle data (replace with actual API call)
  const initializeVehicles = async () => {
    try {
      // Fetch vehicles from API
      const vehiclesResponse = await fetch(`${API_URL}/api/v1/vehicles`);
      const vehiclesData = await vehiclesResponse.json();

      if (vehiclesData.success) {
        // Transform API response to match frontend interface
        const transformedVehicles: Vehicle[] = vehiclesData.data.map((v: any) => ({
          id: v.id,
          name: v.name,
          type: v.type,
          licensePlate: v.licensePlate,
          capacity: v.capacity,
          status: v.status,
          driverId: v.currentDriver,
          mileage: v.mileage,
          fuelLevel: v.fuelLevel,
          lastMaintenance: v.lastMaintenance,
          nextMaintenance: v.nextMaintenance,
          utilizationRate: v.utilization,
        }));
        setVehicles(transformedVehicles);
      }

      // Fetch maintenance schedule
      const maintenanceResponse = await fetch(`${API_URL}/api/v1/vehicles/maintenance/schedule`);
      const maintenanceData = await maintenanceResponse.json();

      if (maintenanceData.success) {
        // Transform maintenance data
        const transformedMaintenance: MaintenanceRecord[] = maintenanceData.data.map((m: any) => ({
          id: m.vehicleId,
          vehicleId: m.vehicleId,
          date: m.nextMaintenance,
          type: 'Scheduled Maintenance',
          description: `Next maintenance for ${m.vehicleName}`,
          cost: 0,
          status: m.status === 'in_progress' ? 'completed' : 'scheduled',
        }));
        setMaintenanceRecords(transformedMaintenance);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }

    // Fallback mock data for development
    const mockVehicles: Vehicle[] = [
      {
        id: 'v1',
        name: 'Fleet Truck 01',
        type: 'TRUCK',
        licensePlate: 'ABC-1234',
        capacity: 1000,
        status: 'active',
        driverId: 'd1',
        driverName: 'John Doe',
        currentLocation: { lat: 33.5731, lng: -7.5898 },
        mileage: 45230,
        fuelLevel: 75,
        lastMaintenance: '2024-10-15',
        nextMaintenance: '2024-12-15',
        utilizationRate: 85,
      },
      {
        id: 'v2',
        name: 'Delivery Van 02',
        type: 'VAN',
        licensePlate: 'XYZ-5678',
        capacity: 500,
        status: 'idle',
        mileage: 32100,
        fuelLevel: 90,
        lastMaintenance: '2024-11-01',
        nextMaintenance: '2025-01-01',
        utilizationRate: 62,
      },
      {
        id: 'v3',
        name: 'City Car 03',
        type: 'CAR',
        licensePlate: 'DEF-9012',
        capacity: 100,
        status: 'maintenance',
        mileage: 67890,
        fuelLevel: 20,
        lastMaintenance: '2024-11-10',
        nextMaintenance: '2024-11-20',
        utilizationRate: 45,
      },
      {
        id: 'v4',
        name: 'Motorcycle 04',
        type: 'MOTORCYCLE',
        licensePlate: 'MNO-3456',
        capacity: 30,
        status: 'active',
        driverId: 'd2',
        driverName: 'Jane Smith',
        currentLocation: { lat: 33.5899, lng: -7.6037 },
        mileage: 12450,
        fuelLevel: 85,
        lastMaintenance: '2024-10-25',
        nextMaintenance: '2024-12-25',
        utilizationRate: 92,
      },
    ];
    setVehicles(mockVehicles);

    const mockMaintenance: MaintenanceRecord[] = [
      {
        id: 'm1',
        vehicleId: 'v3',
        date: '2024-11-20',
        type: 'Oil Change',
        description: 'Regular oil change and filter replacement',
        cost: 150,
        status: 'scheduled',
      },
      {
        id: 'm2',
        vehicleId: 'v1',
        date: '2024-12-15',
        type: 'Tire Rotation',
        description: 'Rotate tires and check alignment',
        cost: 80,
        status: 'scheduled',
      },
    ];
    setMaintenanceRecords(mockMaintenance);
  };

  useEffect(() => {
    fetchTargetStatus();
    checkLLMStatus();
    initializeVehicles();

    const interval = setInterval(() => {
      fetchTargetStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const checkLLMStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/fleet-manager/ai/status`);
      const data = await response.json();
      setLlmEnabled(data.llm_advisor?.enabled || false);
    } catch (error) {
      console.error('Error checking LLM status:', error);
    }
  };

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

  // Vehicle CRUD operations
  const handleAddVehicle = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: vehicleForm.name,
          type: vehicleForm.type,
          licensePlate: vehicleForm.licensePlate,
          capacity: vehicleForm.capacity,
          mileage: vehicleForm.mileage,
          fuelLevel: vehicleForm.fuelLevel,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Transform and add to local state
        const newVehicle: Vehicle = {
          id: data.data.id,
          name: data.data.name,
          type: data.data.type,
          licensePlate: data.data.licensePlate,
          capacity: data.data.capacity,
          status: data.data.status,
          mileage: data.data.mileage,
          fuelLevel: data.data.fuelLevel,
          utilizationRate: data.data.utilization || 0,
        };
        setVehicles([...vehicles, newVehicle]);
        resetVehicleForm();
        setIsVehicleFormOpen(false);
      } else {
        alert('Failed to add vehicle: ' + data.error);
      }
    } catch (error) {
      console.error('Error adding vehicle:', error);
      alert('Error adding vehicle. Please try again.');
    }
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setVehicleForm({
      name: vehicle.name,
      type: vehicle.type,
      licensePlate: vehicle.licensePlate,
      capacity: vehicle.capacity,
      mileage: vehicle.mileage,
      fuelLevel: vehicle.fuelLevel || 100,
    });
    setIsVehicleFormOpen(true);
  };

  const handleUpdateVehicle = async () => {
    if (!selectedVehicle) return;

    try {
      const response = await fetch(`${API_URL}/api/v1/vehicles/${selectedVehicle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: vehicleForm.name,
          type: vehicleForm.type,
          licensePlate: vehicleForm.licensePlate,
          capacity: vehicleForm.capacity,
          mileage: vehicleForm.mileage,
          fuelLevel: vehicleForm.fuelLevel,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const updatedVehicles = vehicles.map(v =>
          v.id === selectedVehicle.id
            ? {
                ...v,
                name: data.data.name,
                type: data.data.type,
                licensePlate: data.data.licensePlate,
                capacity: data.data.capacity,
                mileage: data.data.mileage,
                fuelLevel: data.data.fuelLevel,
                utilizationRate: data.data.utilization || v.utilizationRate,
              }
            : v
        );

        setVehicles(updatedVehicles);
        resetVehicleForm();
        setIsVehicleFormOpen(false);
        setSelectedVehicle(null);
      } else {
        alert('Failed to update vehicle: ' + data.error);
      }
    } catch (error) {
      console.error('Error updating vehicle:', error);
      alert('Error updating vehicle. Please try again.');
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;

    try {
      const response = await fetch(`${API_URL}/api/v1/vehicles/${vehicleId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setVehicles(vehicles.filter(v => v.id !== vehicleId));
      } else {
        alert('Failed to delete vehicle: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      alert('Error deleting vehicle. Please try again.');
    }
  };

  const resetVehicleForm = () => {
    setVehicleForm({
      name: '',
      type: 'CAR',
      licensePlate: '',
      capacity: 100,
      mileage: 0,
      fuelLevel: 100,
    });
    setSelectedVehicle(null);
  };

  // Filter and search
  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = vehicle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          vehicle.licensePlate.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || vehicle.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // Utility functions
  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      available: 'bg-green-100 text-green-700',
      busy: 'bg-yellow-100 text-yellow-700',
      break: 'bg-blue-100 text-blue-700',
      offline: 'bg-gray-100 text-gray-700',
      active: 'bg-green-100 text-green-700',
      idle: 'bg-yellow-100 text-yellow-700',
      maintenance: 'bg-red-100 text-red-700',
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

  const getVehicleIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'TRUCK': return Truck;
      case 'VAN': return Truck;
      case 'CAR': return Truck;
      case 'MOTORCYCLE': return Navigation;
      default: return Truck;
    }
  };

  // Calculate fleet statistics
  const fleetStats = {
    totalVehicles: vehicles.length,
    activeVehicles: vehicles.filter(v => v.status === 'active').length,
    idleVehicles: vehicles.filter(v => v.status === 'idle').length,
    maintenanceVehicles: vehicles.filter(v => v.status === 'maintenance').length,
    avgUtilization: vehicles.reduce((sum, v) => sum + (v.utilizationRate || 0), 0) / vehicles.length || 0,
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
                Comprehensive fleet management with vehicle tracking, driver assignment, and AI-powered optimization
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

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Fleet Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5" />
                <div className="relative p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500 rounded-xl shadow-lg">
                      <Truck className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Fleet</p>
                      <p className="text-3xl font-bold text-blue-600">{fleetStats.totalVehicles}</p>
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
                      <p className="text-sm text-muted-foreground">Active</p>
                      <p className="text-3xl font-bold text-green-600">{fleetStats.activeVehicles}</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5" />
                <div className="relative p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-yellow-500 rounded-xl shadow-lg">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Idle</p>
                      <p className="text-3xl font-bold text-yellow-600">{fleetStats.idleVehicles}</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-red-600/5" />
                <div className="relative p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-500 rounded-xl shadow-lg">
                      <Wrench className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Maintenance</p>
                      <p className="text-3xl font-bold text-red-600">{fleetStats.maintenanceVehicles}</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-purple-600/5" />
                <div className="relative p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-500 rounded-xl shadow-lg">
                      <BarChart3 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg. Utilization</p>
                      <p className="text-3xl font-bold text-purple-600">{fleetStats.avgUtilization.toFixed(0)}%</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* AI Assistant and Recent Activity Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AI Query Interface */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold">AI Fleet Assistant</h2>
                  {!llmEnabled && (
                    <Badge variant="secondary" className="text-xs">Fallback Mode</Badge>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <Textarea
                      placeholder="Ask about your fleet... e.g., 'Which vehicles need maintenance?' or 'Show me underutilized vehicles'"
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

              {/* Quick Fleet Overview */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold">Fleet Status Overview</h2>
                </div>

                <div className="space-y-4">
                  {vehicles.slice(0, 4).map((vehicle) => {
                    const Icon = getVehicleIcon(vehicle.type);
                    return (
                      <div key={vehicle.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold">{vehicle.name}</p>
                              <p className="text-sm text-muted-foreground">{vehicle.licensePlate}</p>
                            </div>
                          </div>
                          <Badge className={getStatusColor(vehicle.status)}>
                            {vehicle.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                          <div className="flex items-center gap-1">
                            <Fuel className="h-3 w-3 text-muted-foreground" />
                            <span>Fuel: {vehicle.fuelLevel}%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <BarChart3 className="h-3 w-3 text-muted-foreground" />
                            <span>Util: {vehicle.utilizationRate}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Vehicles Tab */}
          <TabsContent value="vehicles" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold">Vehicle Management</h2>
                  <p className="text-sm text-muted-foreground">Manage your fleet vehicles and assignments</p>
                </div>
                <Button onClick={() => {
                  resetVehicleForm();
                  setIsVehicleFormOpen(!isVehicleFormOpen);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Vehicle
                </Button>
              </div>

              {/* Search and Filters */}
              <div className="flex gap-4 mb-6">
                <Input
                  placeholder="Search vehicles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-md"
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border rounded-md"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="idle">Idle</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="offline">Offline</option>
                </select>
              </div>

              {/* Vehicle Form */}
              {isVehicleFormOpen && (
                <Card className="p-6 mb-6 bg-muted/50">
                  <h3 className="text-lg font-semibold mb-4">
                    {selectedVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Vehicle Name</label>
                      <Input
                        value={vehicleForm.name}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })}
                        placeholder="e.g., Fleet Truck 01"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Type</label>
                      <select
                        value={vehicleForm.type}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, type: e.target.value })}
                        className="w-full px-4 py-2 border rounded-md"
                      >
                        <option value="MOTORCYCLE">Motorcycle</option>
                        <option value="CAR">Car</option>
                        <option value="VAN">Van</option>
                        <option value="TRUCK">Truck</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">License Plate</label>
                      <Input
                        value={vehicleForm.licensePlate}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, licensePlate: e.target.value })}
                        placeholder="e.g., ABC-1234"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Capacity (kg)</label>
                      <Input
                        type="number"
                        value={vehicleForm.capacity}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, capacity: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Mileage (km)</label>
                      <Input
                        type="number"
                        value={vehicleForm.mileage}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, mileage: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Fuel Level (%)</label>
                      <Input
                        type="number"
                        value={vehicleForm.fuelLevel}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, fuelLevel: parseInt(e.target.value) })}
                        min="0"
                        max="100"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button onClick={selectedVehicle ? handleUpdateVehicle : handleAddVehicle}>
                      {selectedVehicle ? 'Update' : 'Add'} Vehicle
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setIsVehicleFormOpen(false);
                      resetVehicleForm();
                    }}>
                      Cancel
                    </Button>
                  </div>
                </Card>
              )}

              {/* Vehicles Table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>License Plate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Fuel</TableHead>
                      <TableHead>Utilization</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVehicles.map((vehicle) => {
                      const Icon = getVehicleIcon(vehicle.type);
                      return (
                        <TableRow key={vehicle.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{vehicle.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{vehicle.type}</TableCell>
                          <TableCell>{vehicle.licensePlate}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(vehicle.status)}>
                              {vehicle.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {vehicle.driverName ? (
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                <span className="text-sm">{vehicle.driverName}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>{vehicle.capacity} kg</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Fuel className={`h-3 w-3 ${(vehicle.fuelLevel || 0) < 30 ? 'text-red-500' : 'text-muted-foreground'}`} />
                              <span>{vehicle.fuelLevel}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary"
                                  style={{ width: `${vehicle.utilizationRate}%` }}
                                />
                              </div>
                              <span className="text-sm">{vehicle.utilizationRate}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditVehicle(vehicle)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteVehicle(vehicle.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* Drivers Tab */}
          <TabsContent value="drivers" className="space-y-6">
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
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold">Maintenance Schedule</h2>
                  <p className="text-sm text-muted-foreground">Track vehicle maintenance and service records</p>
                </div>
              </div>

              <div className="space-y-4">
                {maintenanceRecords.map((record) => {
                  const vehicle = vehicles.find(v => v.id === record.vehicleId);
                  return (
                    <div key={record.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <Wrench className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">{vehicle?.name || 'Unknown Vehicle'}</p>
                            <p className="text-sm text-muted-foreground">{record.type}</p>
                          </div>
                        </div>
                        <Badge variant={record.status === 'completed' ? 'default' : 'secondary'}>
                          {record.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>{record.date}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span>${record.cost}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{record.description}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-bold mb-4">Fleet Utilization by Vehicle Type</h3>
                <div className="space-y-4">
                  {['TRUCK', 'VAN', 'CAR', 'MOTORCYCLE'].map(type => {
                    const typeVehicles = vehicles.filter(v => v.type === type);
                    const avgUtil = typeVehicles.reduce((sum, v) => sum + (v.utilizationRate || 0), 0) / (typeVehicles.length || 1);
                    return (
                      <div key={type}>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">{type}</span>
                          <span className="text-sm text-muted-foreground">{avgUtil.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${avgUtil}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-bold mb-4">Fleet Status Distribution</h3>
                <div className="space-y-3">
                  {['active', 'idle', 'maintenance', 'offline'].map(status => {
                    const count = vehicles.filter(v => v.status === status).length;
                    const percentage = (count / vehicles.length) * 100;
                    return (
                      <div key={status} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(status)}>{status}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">{count} ({percentage.toFixed(0)}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* AI Recommendations */}
        <Card className="p-6 mt-8">
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
      </div>
    </main>
  );
}
