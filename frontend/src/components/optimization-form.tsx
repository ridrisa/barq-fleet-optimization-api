'use client';

import { useState, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { optimizeRoutes, OptimizationRequest } from '@/store/slices/routesSlice';
import {
  X,
  Truck,
  Package,
  CheckCircle,
  ChevronDown,
  Plus,
  Minus,
  Trash,
  Info,
  Clock,
} from 'lucide-react';
import type { AppDispatch } from '@/store/store';

interface OptimizationFormProps {
  onClose: () => void;
}

// Extend the OptimizationRequest interface to include the new property
interface ExtendedOptimizationRequest extends OptimizationRequest {
  preferences?: {
    optimizationFocus: 'distance' | 'time' | 'balanced';
    distributionStrategy?:
      | 'auto'
      | 'single_vehicle'
      | 'balanced_vehicles'
      | 'proximity_based'
      | 'capacity_based';
  };
}

export function OptimizationForm({ onClose }: OptimizationFormProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const lastSubmissionTimeRef = useRef<number>(0);
  const COOLDOWN_PERIOD_MS = 5000; // 5 seconds between submissions

  // Base optimization request - ALL LOCATIONS IN RIYADH
  const baseOptimizationRequest: ExtendedOptimizationRequest = {
    pickupPoints: [
      {
        id: 'p1',
        name: 'Central Riyadh Distribution Center',
        location: {
          latitude: 24.7136,
          longitude: 46.6753,
        },
        address: 'King Fahd Road, Central Riyadh',
        timeWindow: {
          start: '08:00',
          end: '18:00',
        },
        priority: 1,
      },
      {
        id: 'p2',
        name: 'North Riyadh Warehouse',
        location: {
          latitude: 24.852,
          longitude: 46.72,
        },
        address: 'Al Olaya District, North Riyadh',
        timeWindow: {
          start: '08:00',
          end: '18:00',
        },
        priority: 1,
      },
      {
        id: 'p3',
        name: 'East Riyadh Distribution Hub',
        location: {
          latitude: 24.75,
          longitude: 46.85,
        },
        address: 'Al Malqa District, East Riyadh',
        timeWindow: {
          start: '08:00',
          end: '18:00',
        },
        priority: 1,
      },
    ],
    deliveryPoints: [
      {
        id: 'd1',
        name: 'Customer A - Al Olaya',
        location: {
          latitude: 24.7741,
          longitude: 46.7388,
        },
        address: 'Al Olaya, Riyadh',
        timeWindow: {
          start: '09:00',
          end: '18:00',
        },
        priority: 2,
        pickupId: 'p1',
      },
      {
        id: 'd2',
        name: 'Customer B - Al Murabba',
        location: {
          latitude: 24.6911,
          longitude: 46.7081,
        },
        address: 'Al Murabba, Riyadh',
        timeWindow: {
          start: '09:00',
          end: '12:00',
        },
        priority: 3,
        pickupId: 'p1',
      },
      {
        id: 'd3',
        name: 'Customer C - Al Nakheel',
        location: {
          latitude: 24.865,
          longitude: 46.745,
        },
        address: 'Al Nakheel District, North Riyadh',
        timeWindow: {
          start: '10:00',
          end: '16:00',
        },
        priority: 1,
        pickupId: 'p2',
      },
      {
        id: 'd4',
        name: 'Customer D - Hittin',
        location: {
          latitude: 24.775,
          longitude: 46.685,
        },
        address: 'Hittin District, Riyadh',
        timeWindow: {
          start: '13:00',
          end: '18:00',
        },
        priority: 2,
        pickupId: 'p2',
      },
      {
        id: 'd5',
        name: 'Customer E - Al Malqa',
        location: {
          latitude: 24.8,
          longitude: 46.62,
        },
        address: 'Al Malqa, North Riyadh',
        timeWindow: {
          start: '09:00',
          end: '14:00',
        },
        priority: 2,
        pickupId: 'p3',
      },
      {
        id: 'd6',
        name: 'Customer F - Granada',
        location: {
          latitude: 24.72,
          longitude: 46.65,
        },
        address: 'Granada District, Riyadh',
        timeWindow: {
          start: '14:00',
          end: '18:00',
        },
        priority: 1,
        pickupId: 'p3',
      },
    ],
    fleet: {
      vehicles: [
        {
          id: 'v1',
          name: 'Riyadh Truck 1',
          type: 'truck',
          startLocation: {
            latitude: 24.7136,
            longitude: 46.6753,
          },
          capacity: 3000,
        },
        {
          id: 'v2',
          name: 'Riyadh Truck 2',
          type: 'truck',
          startLocation: {
            latitude: 24.852,
            longitude: 46.72,
          },
          capacity: 3000,
        },
        {
          id: 'v3',
          name: 'Riyadh Truck 3',
          type: 'truck',
          startLocation: {
            latitude: 24.75,
            longitude: 46.85,
          },
          capacity: 3000,
        },
      ],
    },
    businessRules: {
      maxStopsPerRoute: 10,
      balanceRoutes: true,
      prioritizeDeliveryTime: true,
      allowVehicleOvertime: false,
    },
    preferences: {
      optimizationFocus: 'balanced',
      distributionStrategy: 'auto',
    },
  };

  // Form state
  const [formData, setFormData] = useState<ExtendedOptimizationRequest>(baseOptimizationRequest);

  // State for editing pickup/delivery points
  const [editingPickupPoints, setEditingPickupPoints] = useState(false);
  const [editingDeliveryPoints, setEditingDeliveryPoints] = useState(false);
  const [editingVehicles, setEditingVehicles] = useState(false);

  // Helper function to update business rules
  const updateBusinessRules = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      businessRules: {
        ...prev.businessRules,
        [field]: value,
      },
    }));
  };

  // Helper function to update preferences
  const updatePreferences = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences!,
        [field]: value,
      },
    }));
  };

  // Add a cooldown countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (cooldownRemaining > 0) {
      interval = setInterval(() => {
        setCooldownRemaining((prev) => Math.max(0, prev - 1000));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cooldownRemaining]);

  const handleSubmit = async () => {
    // Check if we're still in cooldown period
    const now = Date.now();
    const timeSinceLastSubmission = now - lastSubmissionTimeRef.current;

    if (timeSinceLastSubmission < COOLDOWN_PERIOD_MS) {
      const remainingTime = Math.ceil((COOLDOWN_PERIOD_MS - timeSinceLastSubmission) / 1000);
      setSubmitError(
        `Please wait ${remainingTime} seconds before submitting again to avoid rate limiting.`
      );
      setCooldownRemaining(COOLDOWN_PERIOD_MS - timeSinceLastSubmission);
      return;
    }

    setIsLoading(true);
    setSubmitError(null);

    console.log(
      'Sending optimization request to:',
      `${process.env.NEXT_PUBLIC_API_URL}/api/optimize`
    );

    try {
      // Make a copy of the form data to avoid modifying the displayed values
      const requestData = JSON.parse(JSON.stringify(formData)) as ExtendedOptimizationRequest;

      // Add slight randomization to prevent exact duplicate requests
      requestData.pickupPoints = requestData.pickupPoints.map((point) => ({
        ...point,
        location: {
          latitude: point.location.latitude + (Math.random() - 0.5) * 0.001, // tiny random offset
          longitude: point.location.longitude + (Math.random() - 0.5) * 0.001,
        },
      }));

      // Add a timestamp to make each request unique
      const requestWithTimestamp = {
        ...requestData,
        requestTimestamp: now,
      };

      console.log('Request payload:', requestWithTimestamp);

      // Cast back to the standard OptimizationRequest type for dispatch
      const result = await dispatch(
        optimizeRoutes(requestWithTimestamp as OptimizationRequest)
      ).unwrap();
      console.log('Optimization successful:', result);

      // Update the last submission time
      lastSubmissionTimeRef.current = now;

      onClose();
    } catch (error: any) {
      console.error('Optimization failed:', error);

      // Ensure we get a string error message
      let errorMessage: string;
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else {
        errorMessage = 'Failed to optimize routes. Please try again.';
      }

      // Special handling for rate limit errors
      if (errorMessage.includes('Too many requests') || errorMessage.includes('rate limit')) {
        errorMessage = 'Rate limit reached. Please wait a few moments before trying again.';
        setCooldownRemaining(COOLDOWN_PERIOD_MS);

        // Still update the last submission time on rate limit errors
        lastSubmissionTimeRef.current = now;
      }

      setSubmitError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Input component for number values
  const NumberInput = ({
    label,
    value,
    onChange,
    min = 1,
    max = 100,
    step = 1,
  }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
  }) => {
    return (
      <div className="flex flex-col space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <div className="flex items-center">
          <button
            className="bg-muted rounded-l-md p-1 hover:bg-muted/80"
            onClick={() => onChange(Math.max(min, value - step))}
            disabled={value <= min}
          >
            <Minus className="h-3 w-3" />
          </button>
          <input
            type="number"
            value={value}
            onChange={(e) => {
              const newValue = parseFloat(e.target.value);
              if (!isNaN(newValue) && newValue >= min && newValue <= max) {
                onChange(newValue);
              }
            }}
            min={min}
            max={max}
            step={step}
            className="w-14 text-center border-y border-muted px-2 py-1 text-sm focus:outline-none bg-background"
          />
          <button
            className="bg-muted rounded-r-md p-1 hover:bg-muted/80"
            onClick={() => onChange(Math.min(max, value + step))}
            disabled={value >= max}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  };

  // Toggle switch component
  const ToggleSwitch = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
  }) => {
    return (
      <div className="flex items-center justify-between space-x-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <button
          onClick={() => onChange(!value)}
          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
            value ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
              value ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    );
  };

  // Dropdown select component
  const Select = ({
    label,
    value,
    options,
    onChange,
  }: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
  }) => {
    return (
      <div className="flex flex-col space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full appearance-none rounded-md border border-muted bg-background px-3 py-1.5 pr-8 text-sm focus:border-primary focus:outline-none"
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>
    );
  };

  // Radio Group component for choosing between multiple options
  const RadioGroup = ({
    label,
    value,
    options,
    onChange,
    description,
  }: {
    label: string;
    value: string;
    options: { value: string; label: string; description?: string }[];
    onChange: (value: string) => void;
    description?: string;
  }) => {
    return (
      <div className="flex flex-col space-y-2">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <div className="space-y-2">
          {options.map((option) => (
            <div
              key={option.value}
              className={`flex items-start p-2 rounded-md cursor-pointer transition-colors ${
                value === option.value
                  ? 'bg-primary/15 border border-primary/30'
                  : 'border border-transparent hover:bg-muted/30'
              }`}
              onClick={() => onChange(option.value)}
            >
              <div className="flex items-center h-5">
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    value === option.value ? 'border-primary' : 'border-muted-foreground'
                  }`}
                >
                  {value === option.value && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
              </div>
              <div className="ml-2">
                <div className="text-sm font-medium">{option.label}</div>
                {option.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
    );
  };

  // Render pickup points editor
  const renderPickupPointsEditor = () => {
    if (!editingPickupPoints) return null;

    return (
      <div className="mt-4 border-t pt-4">
        <h4 className="text-sm font-medium mb-3">Edit Pickup Points</h4>
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {formData.pickupPoints.map((point, index) => (
            <div
              key={point.id}
              className="flex items-center justify-between bg-muted/20 p-2 rounded"
            >
              <div>
                <p className="text-sm font-medium">{point.name}</p>
                <p className="text-xs text-muted-foreground">
                  {point.location.latitude.toFixed(4)}, {point.location.longitude.toFixed(4)}
                </p>
              </div>
              <button
                onClick={() => {
                  // Remove this pickup point
                  const updatedPickups = [...formData.pickupPoints];
                  updatedPickups.splice(index, 1);

                  // Also remove any delivery points associated with this pickup
                  const updatedDeliveries = formData.deliveryPoints.filter(
                    (delivery) => delivery.pickupId !== point.id
                  );

                  setFormData((prev) => ({
                    ...prev,
                    pickupPoints: updatedPickups,
                    deliveryPoints: updatedDeliveries,
                  }));
                }}
                className="text-destructive hover:bg-destructive/10 p-1 rounded"
              >
                <Trash className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            // Add a new pickup point with a random location within Riyadh
            const newId = `p${formData.pickupPoints.length + 1}`;
            const newPickup = {
              id: newId,
              name: `New Pickup ${formData.pickupPoints.length + 1}`,
              location: {
                // Random location within Riyadh city bounds (24.6-24.9 N, 46.5-46.9 E)
                latitude: 24.6 + Math.random() * 0.3,
                longitude: 46.5 + Math.random() * 0.4,
              },
              address: `New Pickup Address ${formData.pickupPoints.length + 1}`,
              timeWindow: {
                start: '08:00',
                end: '18:00',
              },
              priority: 1,
            };

            setFormData((prev) => ({
              ...prev,
              pickupPoints: [...prev.pickupPoints, newPickup],
            }));
          }}
          className="mt-3 w-full py-1.5 bg-primary/10 text-primary text-sm rounded hover:bg-primary/20"
        >
          + Add Pickup Point
        </button>
      </div>
    );
  };

  // Render delivery points editor
  const renderDeliveryPointsEditor = () => {
    if (!editingDeliveryPoints) return null;

    return (
      <div className="mt-4 border-t pt-4">
        <h4 className="text-sm font-medium mb-3">Edit Delivery Points</h4>
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {formData.deliveryPoints.map((point, index) => (
            <div
              key={point.id}
              className="flex items-center justify-between bg-muted/20 p-2 rounded"
            >
              <div>
                <p className="text-sm font-medium">{point.name}</p>
                <p className="text-xs text-muted-foreground">
                  {point.location.latitude.toFixed(4)}, {point.location.longitude.toFixed(4)}
                </p>
                <p className="text-xs text-primary">
                  Pickup:{' '}
                  {formData.pickupPoints.find((p) => p.id === point.pickupId)?.name || 'None'}
                </p>
              </div>
              <button
                onClick={() => {
                  const updatedDeliveries = [...formData.deliveryPoints];
                  updatedDeliveries.splice(index, 1);
                  setFormData((prev) => ({
                    ...prev,
                    deliveryPoints: updatedDeliveries,
                  }));
                }}
                className="text-destructive hover:bg-destructive/10 p-1 rounded"
              >
                <Trash className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {formData.pickupPoints.length > 0 ? (
          <button
            onClick={() => {
              // Add a new delivery point with a random location within Riyadh
              const randomPickupIndex = Math.floor(Math.random() * formData.pickupPoints.length);
              const randomPickup = formData.pickupPoints[randomPickupIndex];

              // Generate location near pickup but constrain to Riyadh bounds
              const offsetLat = (Math.random() - 0.5) * 0.15; // ±0.075 degrees (~8km)
              const offsetLng = (Math.random() - 0.5) * 0.15;
              const newLat = Math.max(
                24.6,
                Math.min(24.9, randomPickup.location.latitude + offsetLat)
              );
              const newLng = Math.max(
                46.5,
                Math.min(46.9, randomPickup.location.longitude + offsetLng)
              );

              const newId = `d${formData.deliveryPoints.length + 1}`;
              const newDelivery = {
                id: newId,
                name: `New Delivery ${formData.deliveryPoints.length + 1}`,
                location: {
                  // Random location within Riyadh city bounds
                  latitude: newLat,
                  longitude: newLng,
                },
                address: `New Delivery Address ${formData.deliveryPoints.length + 1}`,
                timeWindow: {
                  start: '09:00',
                  end: '18:00',
                },
                priority: 2,
                pickupId: randomPickup.id,
              };

              setFormData((prev) => ({
                ...prev,
                deliveryPoints: [...prev.deliveryPoints, newDelivery],
              }));
            }}
            className="mt-3 w-full py-1.5 bg-primary/10 text-primary text-sm rounded hover:bg-primary/20"
          >
            + Add Delivery Point
          </button>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Add pickup points first before adding deliveries.
          </p>
        )}
      </div>
    );
  };

  // Render vehicles editor
  const renderVehiclesEditor = () => {
    if (!editingVehicles) return null;

    return (
      <div className="mt-4 border-t pt-4">
        <h4 className="text-sm font-medium mb-3">Edit Fleet</h4>
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {formData.fleet.vehicles.map((vehicle, index) => (
            <div
              key={vehicle.id}
              className="flex items-center justify-between bg-muted/20 p-2 rounded"
            >
              <div>
                <p className="text-sm font-medium">{vehicle.name}</p>
                <p className="text-xs text-muted-foreground">
                  Type: {vehicle.type} | Capacity: {vehicle.capacity}
                </p>
                <p className="text-xs text-muted-foreground">
                  {vehicle.startLocation.latitude.toFixed(4)},{' '}
                  {vehicle.startLocation.longitude.toFixed(4)}
                </p>
              </div>
              <button
                onClick={() => {
                  const updatedVehicles = [...formData.fleet.vehicles];
                  updatedVehicles.splice(index, 1);
                  setFormData((prev) => ({
                    ...prev,
                    fleet: {
                      ...prev.fleet,
                      vehicles: updatedVehicles,
                    },
                  }));
                }}
                className="text-destructive hover:bg-destructive/10 p-1 rounded"
              >
                <Trash className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {formData.pickupPoints.length > 0 ? (
          <button
            onClick={() => {
              // Add a new vehicle based on a random pickup location in Riyadh
              const randomPickupIndex = Math.floor(Math.random() * formData.pickupPoints.length);
              const randomPickup = formData.pickupPoints[randomPickupIndex];

              const newId = `v${formData.fleet.vehicles.length + 1}`;
              const newVehicle = {
                id: newId,
                name: `Riyadh Truck ${formData.fleet.vehicles.length + 1}`,
                type: 'truck',
                startLocation: {
                  latitude: randomPickup.location.latitude,
                  longitude: randomPickup.location.longitude,
                },
                capacity: 3000,
              };

              setFormData((prev) => ({
                ...prev,
                fleet: {
                  ...prev.fleet,
                  vehicles: [...prev.fleet.vehicles, newVehicle],
                },
              }));
            }}
            className="mt-3 w-full py-1.5 bg-primary/10 text-primary text-sm rounded hover:bg-primary/20"
          >
            + Add Vehicle
          </button>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Add pickup points first before adding vehicles.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card w-full max-w-2xl rounded-lg shadow-lg">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">New Optimization Request</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-6">
            {/* Pickup & Delivery Points Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-primary/5 p-3 rounded-lg">
                <div className="flex items-center mb-2 justify-between">
                  <div className="flex items-center">
                    <Package className="h-5 w-5 mr-2 text-primary" />
                    <h3 className="font-medium">Pickup Points</h3>
                  </div>
                  <button
                    onClick={() => setEditingPickupPoints(!editingPickupPoints)}
                    className="text-xs text-primary hover:underline"
                  >
                    {editingPickupPoints ? 'Done' : 'Edit'}
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formData.pickupPoints.length} locations
                </p>
                {renderPickupPointsEditor()}
              </div>

              <div className="bg-primary/5 p-3 rounded-lg">
                <div className="flex items-center mb-2 justify-between">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2 text-primary" />
                    <h3 className="font-medium">Delivery Points</h3>
                  </div>
                  <button
                    onClick={() => setEditingDeliveryPoints(!editingDeliveryPoints)}
                    className="text-xs text-primary hover:underline"
                  >
                    {editingDeliveryPoints ? 'Done' : 'Edit'}
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formData.deliveryPoints.length} locations
                </p>
                {renderDeliveryPointsEditor()}
              </div>

              <div className="bg-primary/5 p-3 rounded-lg">
                <div className="flex items-center mb-2 justify-between">
                  <div className="flex items-center">
                    <Truck className="h-5 w-5 mr-2 text-primary" />
                    <h3 className="font-medium">Fleet</h3>
                  </div>
                  <button
                    onClick={() => setEditingVehicles(!editingVehicles)}
                    className="text-xs text-primary hover:underline"
                  >
                    {editingVehicles ? 'Done' : 'Edit'}
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formData.fleet.vehicles.length} vehicles
                </p>
                {renderVehiclesEditor()}
              </div>
            </div>

            {/* Business Rules Section */}
            <div className="border-t pt-4">
              <h3 className="font-medium mb-3">Business Rules</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-primary/5 p-3 rounded-lg">
                  <NumberInput
                    label="Max Stops Per Route"
                    value={formData.businessRules?.maxStopsPerRoute || 10}
                    onChange={(value) => updateBusinessRules('maxStopsPerRoute', value)}
                    min={1}
                    max={50}
                  />
                </div>

                <div className="bg-primary/5 p-3 rounded-lg">
                  <ToggleSwitch
                    label="Balance Routes"
                    value={formData.businessRules?.balanceRoutes || false}
                    onChange={(value) => updateBusinessRules('balanceRoutes', value)}
                  />
                </div>

                <div className="bg-primary/5 p-3 rounded-lg">
                  <ToggleSwitch
                    label="Prioritize Delivery Time"
                    value={formData.businessRules?.prioritizeDeliveryTime || false}
                    onChange={(value) => updateBusinessRules('prioritizeDeliveryTime', value)}
                  />
                </div>

                <div className="bg-primary/5 p-3 rounded-lg">
                  <ToggleSwitch
                    label="Allow Vehicle Overtime"
                    value={formData.businessRules?.allowVehicleOvertime || false}
                    onChange={(value) => updateBusinessRules('allowVehicleOvertime', value)}
                  />
                </div>
              </div>
            </div>

            {/* Preferences Section */}
            <div className="border-t pt-4">
              <h3 className="font-medium mb-3">Preferences</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-primary/5 p-3 rounded-lg">
                  <RadioGroup
                    label="Optimization Focus"
                    value={formData.preferences?.optimizationFocus || 'balanced'}
                    options={[
                      {
                        value: 'distance',
                        label: 'Minimize Distance',
                        description: 'Prioritizes shorter routes over time efficiency.',
                      },
                      {
                        value: 'time',
                        label: 'Minimize Time',
                        description: 'Prioritizes faster delivery times over distance.',
                      },
                      {
                        value: 'balanced',
                        label: 'Balanced Approach',
                        description: 'Balances both distance and time considerations.',
                      },
                    ]}
                    onChange={(value) => updatePreferences('optimizationFocus', value)}
                  />
                </div>

                <div className="bg-primary/5 p-3 rounded-lg">
                  <Select
                    label="Distribution Strategy"
                    value={formData.preferences?.distributionStrategy || 'auto'}
                    options={[
                      { value: 'auto', label: 'Automatic' },
                      { value: 'single_vehicle', label: 'Single Vehicle' },
                      { value: 'balanced_vehicles', label: 'Balanced Vehicles' },
                      { value: 'proximity_based', label: 'Proximity Based' },
                      { value: 'capacity_based', label: 'Capacity Based' },
                    ]}
                    onChange={(value) => updatePreferences('distributionStrategy', value)}
                  />
                  <div className="mt-2 text-xs text-muted-foreground flex items-start">
                    <Info className="h-3 w-3 mr-1 mt-0.5 text-primary" />
                    <span>
                      {formData.preferences?.distributionStrategy === 'auto'
                        ? 'System intelligently selects the best strategy.'
                        : formData.preferences?.distributionStrategy === 'single_vehicle'
                          ? 'Assigns all deliveries to a single vehicle when possible.'
                          : formData.preferences?.distributionStrategy === 'balanced_vehicles'
                            ? 'Evenly distributes deliveries across all vehicles.'
                            : formData.preferences?.distributionStrategy === 'proximity_based'
                              ? 'Assigns deliveries based on proximity to vehicle location.'
                              : 'Assigns deliveries based on vehicle capacity.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Notes */}
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Additional Notes</h3>
              <textarea
                className="w-full p-2 border rounded-md text-sm h-20 focus:outline-none focus:ring-1 focus:ring-primary bg-background"
                placeholder="Add any additional notes or requirements for this optimization..."
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || cooldownRemaining > 0}
            className={`px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors ${
              isLoading || cooldownRemaining > 0 ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isLoading
              ? 'Optimizing...'
              : cooldownRemaining > 0
                ? `Wait ${Math.ceil(cooldownRemaining / 1000)}s`
                : 'Optimize Routes'}
          </button>
        </div>

        {submitError && (
          <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            <p className="font-medium mb-1">Optimization Error</p>
            <p>{submitError}</p>
            {cooldownRemaining > 0 && (
              <div className="flex items-center mt-2 text-xs">
                <Clock className="h-3 w-3 mr-1" />
                <span>Cooldown: {Math.ceil(cooldownRemaining / 1000)}s remaining</span>
              </div>
            )}
            <p className="text-xs mt-2">
              API URL: {process.env.NEXT_PUBLIC_API_URL || 'Not configured'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
