import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://route-opt-backend-sek7q2ajva-uc.a.run.app';

// Types
export interface Location {
  latitude: number;
  longitude: number;
}

export interface TimeWindow {
  start: string;
  end: string;
}

export interface RoutePoint {
  id: string;
  name: string;
  type: 'pickup' | 'delivery' | 'vehicle' | 'unknown' | string;
  location: {
    latitude: number;
    longitude: number;
  };
  address?: string;
  timeWindow?: {
    start: string;
    end: string;
  } | null;
  priority?: number;
  customer_name?: string;
  unserviceable?: boolean;
  isInRestrictedArea?: boolean;
  restrictedAreaName?: string;
  vehicleInfo?: any;
}

export interface Route {
  id: string;
  name?: string;
  vehicleId?: string;
  vehicleName?: string;
  stops: RoutePoint[];
  distance?: number;
  duration?: number;
  geometry?: string;
  pickupId?: string;
}

export interface OptimizationMetrics {
  totalDistance: number;
  totalDuration: number;
  vehiclesUsed: number;
  costSavings?: number;
}

export interface OptimizationInsights {
  costSavings?: number;
  timeEfficiency?: number;
  environmentalImpact?: {
    co2Reduction: number;
  };
}

export interface OptimizationEngineMetadata {
  engine?: string;
  algorithm?: string;
  aiModel?: string;
  fairDistribution?: boolean;
  capacityConstrained?: boolean;
  multiPickupSupport?: boolean;
  slaAware?: boolean;
  executionTime?: number;
  cost?: number;
  fallback?: boolean;
  fallbackReason?: string;
  provider?: string;
  vehiclesUsed?: number;
  vehiclesAvailable?: number;
  utilizationRate?: number;
}

export interface OptimizationEngineDecision {
  engine: string;
  reason: string;
  fallback?: boolean;
  fallbackReason?: string;
}

export interface AIInsights {
  advisor?: string;
  analyst?: string;
  cost?: number;
  provider?: string;
}

export interface OptimizationResponse {
  id: string;
  requestId: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  createdAt: string;
  name?: string;
  routes: Route[];
  metrics: OptimizationMetrics;
  unassignedStops?: RoutePoint[];
  allowedZones?: AreaDefinition[];
  restrictedAreas?: AreaDefinition[];
  error?: string | null;
  // Engine visibility metadata
  optimizationEngine?: string;
  optimizationMetadata?: OptimizationEngineMetadata;
  engineDecision?: OptimizationEngineDecision;
  aiInsights?: AIInsights;
}

export interface OptimizationRequest {
  pickupPoints: {
    id: string;
    name: string;
    location: Location;
    address?: string;
    timeWindow?: TimeWindow;
    priority?: number;
    serviceTime?: number; // CVRP: Time required at pickup (minutes)
  }[];
  deliveryPoints: {
    id: string;
    name: string;
    location: Location;
    address?: string;
    timeWindow?: TimeWindow;
    priority?: number;
    pickupId?: string;
    serviceTime?: number; // CVRP: Time required at delivery (minutes)
    demand?: number; // CVRP: Package weight/volume demand
  }[];
  fleet: {
    vehicles: {
      id: string;
      name: string;
      type: string;
      startLocation: Location;
      endLocation?: Location;
      capacity?: number; // CVRP: Max weight/volume capacity
      maxDistance?: number; // CVRP: Max distance per vehicle (meters)
      maxDuration?: number; // CVRP: Max duration per vehicle (seconds)
      breakTimes?: TimeWindow[]; // CVRP: Driver break schedules
      costPerKm?: number; // CVRP: Cost per kilometer
      costPerHour?: number; // CVRP: Cost per hour
    }[];
  };
  businessRules?: {
    maxStopsPerRoute?: number;
    balanceRoutes?: boolean;
    prioritizeDeliveryTime?: boolean;
    allowVehicleOvertime?: boolean;
    allowedZones?: AreaDefinition[];
    restrictedAreas?: AreaDefinition[];
  };
  preferences?: {
    optimizationFocus: 'distance' | 'time' | 'balanced';
    preferredEngine?: 'auto' | 'cvrp' | 'osrm' | 'genetic' | 'nearest_neighbor';
    useCVRP?: boolean;
    distributionStrategy?: 'auto' | 'single_vehicle' | 'balanced_vehicles' | 'proximity_based' | 'capacity_based';
  };
  cvrpSettings?: {
    enableTimeWindows: boolean;
    enableCapacityConstraints: boolean;
    enableServiceTimes: boolean;
    enableBreakTimes: boolean;
    enableMaxDistanceDuration: boolean;
    defaultServiceTime?: number; // Default service time in minutes
    capacityUnit?: 'kg' | 'liters' | 'units'; // Unit for capacity measurements
  };
}

export interface MapFilters {
  showRoutes: boolean;
  showPickupPoints: boolean;
  showDeliveryPoints: boolean;
  showRestrictedAreas: boolean;
  showAllowedAreas: boolean;
}

// Area definition for allowed zones and restricted areas
export interface AreaDefinition {
  id: string;
  name: string;
  area: [number, number][]; // Array of [lat, lng] pairs
  timeRestriction?: string;
}

// Change: Add export to RouteState interface
export interface RouteState {
  optimizationRequest: OptimizationRequest | null;
  optimizationResponse: OptimizationResponse | null;
  optimizationPlans: OptimizationResponse[];
  selectedPlanId: string | null;
  selectedRouteId: string | null;
  loading: boolean;
  error: string | null;
  mapFilters: MapFilters;
  optimizationHistoryIds: string[];
  pagination: {
    limit: number;
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
  optimizationCache: Record<string, OptimizationResponse>;
}

const _initialState: RouteState = {
  optimizationRequest: null,
  optimizationResponse: null,
  optimizationPlans: [],
  selectedPlanId: null,
  selectedRouteId: null,
  loading: false,
  error: null,
  mapFilters: {
    showRoutes: true,
    showPickupPoints: true,
    showDeliveryPoints: true,
    showRestrictedAreas: true,
    showAllowedAreas: true,
  },
  optimizationHistoryIds: [],
  optimizationCache: {},
  pagination: {
    limit: 10,
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
  },
};

// Add generateId function at the top of the file before transformToOptimizationResponse
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

// Simple polyline encoding function (simplified version of Google's algorithm)
function _encodePolyline(coordinates: { latitude: number; longitude: number }[]): string {
  let result = '';
  let lastLat = 0;
  let lastLng = 0;

  for (const { latitude, longitude } of coordinates) {
    // Convert to integer representation
    const lat = Math.round(latitude * 1e5);
    const lng = Math.round(longitude * 1e5);

    // Encode the differences
    result += _encodeNumber(lat - lastLat);
    result += _encodeNumber(lng - lastLng);

    lastLat = lat;
    lastLng = lng;
  }

  return result;
}

// Helper for encoding a single number in the polyline format
function _encodeNumber(num: number): string {
  num = num < 0 ? ~(num << 1) : num << 1;
  let result = '';

  while (num >= 0x20) {
    result += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }

  result += String.fromCharCode(num + 63);
  return result;
}

/**
 * Transform backend API response to frontend OptimizationResponse format
 */
export function transformToOptimizationResponse(responseData: any): OptimizationResponse {
  try {
    console.log('DEBUGGING API RESPONSE - Complete raw response:', responseData);

    // Check all possible locations for business rules, zones and restricted areas
    console.log('DEBUGGING ZONES - All possible locations:');

    // Extract business rules from all possible locations upfront
    const businessRules =
      responseData.businessRules ||
      (responseData.data && responseData.data.businessRules) ||
      (responseData.data && responseData.data.request && responseData.data.request.businessRules) ||
      {};

    console.log('CONSOLIDATED BUSINESS RULES:', businessRules);

    // Check top level
    console.log('1. Top level businessRules:', responseData.businessRules);
    console.log('2. Top level allowedZones:', responseData.allowedZones);
    console.log('3. Top level restrictedAreas:', responseData.restrictedAreas);

    // Check data level
    if (responseData.data) {
      console.log('4. data.businessRules:', responseData.data.businessRules);
      console.log('5. data.allowedZones:', responseData.data.allowedZones);
      console.log('6. data.restrictedAreas:', responseData.data.restrictedAreas);

      // Check request level
      if (responseData.data.request) {
        console.log('7. data.request.businessRules:', responseData.data.request.businessRules);
      }
    }

    // Extract relevant data from API response
    const data = JSON.parse(JSON.stringify(responseData));
    console.log('Data structure debugging:', {
      hasData: Boolean(data),
      hasDataData: Boolean(data?.data),
      hasRoutes: Boolean(data?.routes),
      hasDataRoutes: Boolean(data?.data?.routes),
      hasResultRoutes: Boolean(data?.result?.routes),
      dataKeys: data ? Object.keys(data) : [],
      responseDataKeys: Object.keys(responseData),
    });

    // Helper function to process zones/areas arrays - define these first before using them
    const processZones = (zones: any[] | undefined): AreaDefinition[] => {
      if (!zones || !Array.isArray(zones)) return [];

      return zones
        .filter((zone: any) => typeof zone === 'object' && zone.area && Array.isArray(zone.area))
        .map((zone: any) => ({
          id: zone.id || `zone-${generateId()}`,
          name: zone.name || 'Unnamed Zone',
          area: zone.area,
          timeRestriction: zone.timeRestriction,
        }));
    };

    const processRestrictedAreas = (areas: any[] | undefined): AreaDefinition[] => {
      if (!areas || !Array.isArray(areas)) return [];

      return areas
        .filter((area: any) => typeof area === 'object')
        .map((area: any) => {
          // Handle both new and legacy formats
          if (area.id && area.name && Array.isArray(area.area)) {
            return {
              id: area.id,
              name: area.name,
              area: area.area,
              timeRestriction: area.timeRestriction,
            } as AreaDefinition;
          } else if (Array.isArray(area.polygon)) {
            return {
              id: `restricted-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              name: 'Restricted Area',
              area: area.polygon,
              timeRestriction: area.timeRestriction,
            } as AreaDefinition;
          }
          return null;
        })
        .filter((area): area is AreaDefinition => area !== null);
    };

    // IMPORTANT: Extract restricted areas first - we'll check all locations in priority order
    let restrictedAreas: AreaDefinition[] = [];

    // 1. From top level
    if (Array.isArray(responseData.restrictedAreas) && responseData.restrictedAreas.length > 0) {
      console.log(
        '[EXTRACTION] Found restricted areas at top level:',
        responseData.restrictedAreas.length
      );
      restrictedAreas = processRestrictedAreas(responseData.restrictedAreas);
    }
    // 2. From business rules directly
    else if (
      businessRules.restrictedAreas &&
      Array.isArray(businessRules.restrictedAreas) &&
      businessRules.restrictedAreas.length > 0
    ) {
      console.log(
        '[EXTRACTION] Found restricted areas in businessRules:',
        businessRules.restrictedAreas.length
      );
      restrictedAreas = processRestrictedAreas(businessRules.restrictedAreas);
    }
    // 3. From data.restrictedAreas
    else if (
      responseData.data &&
      Array.isArray(responseData.data.restrictedAreas) &&
      responseData.data.restrictedAreas.length > 0
    ) {
      console.log(
        '[EXTRACTION] Found restricted areas in data:',
        responseData.data.restrictedAreas.length
      );
      restrictedAreas = processRestrictedAreas(responseData.data.restrictedAreas);
    }
    // 4. From data.businessRules.restrictedAreas
    else if (
      responseData.data &&
      responseData.data.businessRules &&
      Array.isArray(responseData.data.businessRules.restrictedAreas) &&
      responseData.data.businessRules.restrictedAreas.length > 0
    ) {
      console.log(
        '[EXTRACTION] Found restricted areas in data.businessRules:',
        responseData.data.businessRules.restrictedAreas.length
      );
      restrictedAreas = processRestrictedAreas(responseData.data.businessRules.restrictedAreas);
    }
    // 5. From data.request.businessRules.restrictedAreas
    else if (
      responseData.data &&
      responseData.data.request &&
      responseData.data.request.businessRules &&
      Array.isArray(responseData.data.request.businessRules.restrictedAreas) &&
      responseData.data.request.businessRules.restrictedAreas.length > 0
    ) {
      console.log(
        '[EXTRACTION] Found restricted areas in data.request.businessRules:',
        responseData.data.request.businessRules.restrictedAreas.length
      );
      restrictedAreas = processRestrictedAreas(
        responseData.data.request.businessRules.restrictedAreas
      );
    }

    console.log('[EXTRACTION RESULT] Restricted areas found:', restrictedAreas.length);
    if (restrictedAreas.length > 0) {
      console.log('[SAMPLE RESTRICTED AREA]', restrictedAreas[0]);
    }

    // Get the main data object (different APIs structure this differently)
    // Try to extract from standard formats
    let routesToProcess = data.routes || [];
    let requestId = data.requestId || '';
    let metrics: OptimizationMetrics = {
      totalDistance: 0,
      totalDuration: 0,
      vehiclesUsed: 0,
    };

    // Log what we found in different locations
    console.log('Routes to process:', {
      routesFoundAt: routesToProcess.length > 0 ? 'data.routes' : 'checking other locations',
      routesLength: routesToProcess.length,
    });

    // If routes aren't at the top level, try to find them in data.data
    if (routesToProcess.length === 0 && data.data) {
      if (Array.isArray(data.data)) {
        // Special case: if data.data is an array, it might be the plans array
        return {
          id: data.requestId || data.id || generateId(),
          requestId: data.requestId || data.id || generateId(),
          status: 'completed',
          createdAt: data.timestamp || new Date().toISOString(),
          name: data.name || `Plan ${new Date().toLocaleDateString()}`,
          routes: [],
          metrics: metrics,
        };
      }

      // Try data.data.routes
      if (data.data.routes && Array.isArray(data.data.routes)) {
        routesToProcess = data.data.routes;
        requestId = data.data.requestId || data.requestId || '';

        // Try to get metrics
        if (data.data.metrics) {
          console.log('Found metrics at top level of response:', {
            metrics: data.data.metrics,
          });
          metrics = {
            totalDistance: data.data.metrics.totalDistance || 0,
            totalDuration: data.data.metrics.totalDuration || 0,
            vehiclesUsed: data.data.metrics.vehiclesUsed || routesToProcess.length,
          };
        } else if (data.data.summary) {
          console.log('Found metrics in responseData.summary:', responseData.summary);
          metrics = {
            totalDistance: data.data.summary.total_distance || 0,
            totalDuration: data.data.summary.total_duration || 0,
            vehiclesUsed: data.data.summary.total_routes || routesToProcess.length,
          };
        }
      }
      // Try data.result.routes
      else if (data.result && data.result.routes && Array.isArray(data.result.routes)) {
        routesToProcess = data.result.routes;
        requestId = data.result.requestId || data.requestId || '';

        if (data.result.summary) {
          console.log('Found metrics in data.result.summary:', data.result.summary);
          metrics = {
            totalDistance: data.result.summary.total_distance || 0,
            totalDuration: data.result.summary.total_duration || 0,
            vehiclesUsed: data.result.summary.total_routes || routesToProcess.length,
          };
        }
      }
      // Try for simpler structures that might have nested routes
      else if (data.data) {
        const deepData = data.data;

        if (deepData.routes && Array.isArray(deepData.routes)) {
          routesToProcess = deepData.routes;
          requestId = deepData.requestId || data.requestId || '';

          if (deepData.summary) {
            console.log('Found metrics in data.data.summary:', deepData.summary);
            metrics = {
              totalDistance: deepData.summary.total_distance || 0,
              totalDuration: deepData.summary.total_duration || 0,
              vehiclesUsed: deepData.summary.total_routes || routesToProcess.length,
            };
          }
        }
      }
    }
    // Try other common nesting patterns
    else if (routesToProcess.length === 0 && data.result) {
      if (data.result.routes && Array.isArray(data.result.routes)) {
        routesToProcess = data.result.routes;
        requestId = data.result.requestId || data.requestId || '';

        if (data.result.complete_data && data.result.complete_data.summary) {
          console.log(
            'Found metrics in result.complete_data.summary:',
            data.result.complete_data.summary
          );
          metrics = {
            totalDistance: data.result.complete_data.summary.total_distance || 0,
            totalDuration: data.result.complete_data.summary.total_duration || 0,
            vehiclesUsed: data.result.complete_data.summary.total_routes || routesToProcess.length,
          };
        }
      }
    }
    // Handle simplified API responses that may lack nesting
    else if (data.summary) {
      console.log('Found metrics in data.summary:', data.summary);
      metrics = {
        totalDistance: data.summary.total_distance || 0,
        totalDuration: data.summary.total_duration || 0,
        vehiclesUsed: data.summary.total_routes || (routesToProcess ? routesToProcess.length : 0),
      };
    }
    // Check for metrics in metadata
    else if (data.metadata && data.metadata.metrics) {
      console.log('Found metrics in data.metadata.metrics:', data.metadata.metrics);
      metrics = {
        totalDistance: data.metadata.metrics.totalDistance || 0,
        totalDuration: data.metadata.metrics.totalDuration || 0,
        vehiclesUsed:
          data.metadata.metrics.vehiclesUsed || (routesToProcess ? routesToProcess.length : 0),
      };
    }
    // Check for direct metrics object
    else if (data.metrics) {
      console.log('Found metrics in data.metrics:', data.metrics);
      metrics = {
        totalDistance: data.metrics.totalDistance || 0,
        totalDuration: data.metrics.totalDuration || 0,
        vehiclesUsed: data.metrics.vehiclesUsed || (routesToProcess ? routesToProcess.length : 0),
      };
    }
    // Check for metrics in result
    else if (data.result && data.result.metrics) {
      console.log('Found metrics in result.metrics:', data.result.metrics);
      metrics = {
        totalDistance: data.result.metrics.totalDistance || 0,
        totalDuration: data.result.metrics.totalDuration || 0,
        vehiclesUsed:
          data.result.metrics.vehiclesUsed || (routesToProcess ? routesToProcess.length : 0),
      };
    }

    // If data is still empty after all these checks, return a minimal response
    if (routesToProcess.length === 0) {
      console.error(
        'Could not find valid routes array in the API response:',
        responseData.data || responseData.result || responseData
      );

      // Create a fallback empty response
      return {
        id: data.requestId || data.id || generateId(),
        requestId: data.requestId || data.id || generateId(),
        status: 'completed',
        createdAt: data.timestamp || new Date().toISOString(),
        name: data.name || `Plan ${new Date().toLocaleDateString()}`,
        routes: [],
        metrics: metrics,
      };
    }

    console.log(`Extracted metrics from response:`, {
      totalDistance: metrics.totalDistance,
      totalDuration: metrics.totalDuration,
      vehiclesUsed: metrics.vehiclesUsed,
    });

    // Validate metrics against routes data
    if (routesToProcess && routesToProcess.length > 0) {
      // Correct vehiclesUsed if it doesn't match the routes
      if (metrics.vehiclesUsed !== routesToProcess.length) {
        console.log(
          `Correcting vehiclesUsed from ${metrics.vehiclesUsed} to ${routesToProcess.length} based on actual routes`
        );
        metrics.vehiclesUsed = routesToProcess.length;
      }

      // Calculate total distance from routes if it's zero
      if (metrics.totalDistance === 0) {
        metrics.totalDistance = routesToProcess.reduce(
          (sum: number, route: any) => sum + (route.distance || 0),
          0
        );
        console.log(`Calculated distance from routes: ${metrics.totalDistance}`);
      }

      // Calculate total duration from routes if it's zero
      if (metrics.totalDuration === 0) {
        metrics.totalDuration = routesToProcess.reduce(
          (sum: number, route: any) => sum + (route.duration || 0),
          0
        );
      }
    }

    // Some routes might not have proper stops arrays
    const processedRoutes = routesToProcess.map((route: any) => {
      // Ensure route has an ID
      if (!route.id) {
        route.id = `route-${generateId()}`;
      }

      // Extract vehicle info from nested object if present
      const vehicleId = route.vehicle?.id || route.vehicleId || null;
      const vehicleName = route.vehicle?.name || route.vehicleName || null;

      // Ensure geometry field is explicitly copied
      const geometry = route.geometry || '';

      // Ensure route has a stops array and process each stop
      let processedStops: RoutePoint[] = [];
      if (!route.stops || !Array.isArray(route.stops)) {
        // Try to create stops from waypoints if they exist
        if (route.waypoints && Array.isArray(route.waypoints)) {
          processedStops = route.waypoints.map((wp: any) => {
            // Map waypoint data to RoutePoint structure, including all relevant fields
            return {
              id: wp.id || wp.order_id || `stop-${generateId()}`,
              name: wp.name || wp.customer_name || 'Unnamed Stop',
              type: wp.type || 'unknown',
              location: {
                latitude: wp.location?.latitude || wp.location?.lat || 0,
                longitude: wp.location?.longitude || wp.location?.lng || 0,
              },
              address: wp.address || wp.delivery?.address, // Add address if available
              timeWindow: wp.timeWindow || wp.delivery?.time_window, // Add timeWindow
              priority: wp.priority || wp.delivery?.priority, // Add priority
              // Add other fields like load_kg if needed from wp.delivery
              // pickupId: wp.pickupId // If relevant
            } as RoutePoint;
          });
        } else {
          // Create an empty stops array as a last resort
          processedStops = [];
        }
      } else {
        // If route.stops exists, process them to ensure all fields are present
        processedStops = route.stops.map((stop: any) => {
          return {
            id: stop.id || stop.order_id || `stop-${generateId()}`,
            name: stop.name || stop.customer_name || 'Unnamed Stop',
            type: stop.type || 'unknown',
            location: {
              latitude: stop.location?.latitude || stop.lat || 0,
              longitude: stop.location?.longitude || stop.lng || 0,
            },
            address: stop.address,
            timeWindow: stop.timeWindow || stop.time_window,
            priority: stop.priority,
            // pickupId: stop.pickupId // If relevant
          } as RoutePoint;
        });
      }

      // Return the processed route object, ensuring geometry is included
      return {
        ...route,
        vehicleId: vehicleId, // Use extracted ID
        vehicleName: vehicleName, // Use extracted name
        geometry: geometry,
        stops: processedStops, // Make sure the processed stops array is used
      };
    });

    // Extract allowed zones and restricted areas if they exist in the response
    let allowedZones: AreaDefinition[] = [];

    // 1. First check for zones directly at the top level (new format)
    if (Array.isArray(responseData.allowedZones)) {
      console.log('Found allowed zones at top level:', {
        count: responseData.allowedZones.length,
        sample: responseData.allowedZones.slice(0, 1),
      });
      allowedZones = processZones(responseData.allowedZones);
    }

    // 2. Then check for business rules directly at the top level
    if (responseData.businessRules && allowedZones.length === 0) {
      console.log('Found business rules at top level:', {
        hasAllowedZones: Array.isArray(responseData.businessRules.allowedZones),
        allowedZonesLength: Array.isArray(responseData.businessRules.allowedZones)
          ? responseData.businessRules.allowedZones.length
          : 0,
      });

      if (Array.isArray(responseData.businessRules.allowedZones) && allowedZones.length === 0) {
        allowedZones = processZones(responseData.businessRules.allowedZones);
      }
    }

    // 3. Check inside data level
    if (responseData.data && allowedZones.length === 0) {
      // 3a. Check for direct zones at data level
      if (Array.isArray(responseData.data.allowedZones) && allowedZones.length === 0) {
        console.log('Found allowed zones at data level:', {
          count: responseData.data.allowedZones.length,
        });
        allowedZones = processZones(responseData.data.allowedZones);
      }

      // 3b. Check for business rules at data level
      if (responseData.data.businessRules && allowedZones.length === 0) {
        console.log('Found business rules at data level:', {
          hasAllowedZones: Array.isArray(responseData.data.businessRules.allowedZones),
          allowedZonesLength: Array.isArray(responseData.data.businessRules.allowedZones)
            ? responseData.data.businessRules.allowedZones.length
            : 0,
        });

        if (
          Array.isArray(responseData.data.businessRules.allowedZones) &&
          allowedZones.length === 0
        ) {
          allowedZones = processZones(responseData.data.businessRules.allowedZones);
        }
      }

      // 3c. Check inside data.request
      if (responseData.data.request && allowedZones.length === 0) {
        if (responseData.data.request.businessRules) {
          console.log('Found business rules in data.request:', {
            hasAllowedZones: Array.isArray(responseData.data.request.businessRules.allowedZones),
            allowedZonesLength: Array.isArray(responseData.data.request.businessRules.allowedZones)
              ? responseData.data.request.businessRules.allowedZones.length
              : 0,
          });

          if (
            Array.isArray(responseData.data.request.businessRules.allowedZones) &&
            allowedZones.length === 0
          ) {
            allowedZones = processZones(responseData.data.request.businessRules.allowedZones);
          }
        }
      }
    }

    console.log(
      `ZONES EXTRACTION RESULTS: Found ${allowedZones.length} allowed zones and ${restrictedAreas.length} restricted areas:`,
      {
        allowedZonesExample: allowedZones.length > 0 ? allowedZones[0] : null,
        restrictedAreasExample: restrictedAreas.length > 0 ? restrictedAreas[0] : null,
        allowedZonesArray: allowedZones,
        restrictedAreasArray: restrictedAreas,
      }
    );

    // Final formatted response - check for result.routes case
    let routes = processedRoutes;

    // Special handling for the case where routes are nested in data.result
    if (
      routes.length === 0 &&
      responseData.data &&
      responseData.data.result &&
      Array.isArray(responseData.data.result.routes)
    ) {
      console.log('Using routes from data.result.routes as a fallback');
      routes = responseData.data.result.routes.map((route: any) => {
        if (!route.id) {
          route.id = `route-${generateId()}`;
        }
        if (!route.stops || !Array.isArray(route.stops)) {
          route.stops = [];
        }
        return route;
      });
    }

    const formattedResponse: OptimizationResponse = {
      id: data.requestId || data.id || generateId(),
      requestId: data.requestId || requestId || generateId(),
      status: 'completed',
      createdAt: data.timestamp || new Date().toISOString(),
      name: data.name || `Plan ${new Date().toLocaleDateString()}`,
      routes: routes,
      metrics: metrics,
      allowedZones,
      restrictedAreas,
    };

    // Add detailed logging of the final response
    console.log('DEBUGGING FINAL RESPONSE - Formatted response:', {
      id: formattedResponse.id,
      requestId: formattedResponse.requestId,
      routesCount: formattedResponse.routes.length,
      allowedZonesCount: formattedResponse.allowedZones?.length || 0,
      restrictedAreasCount: formattedResponse.restrictedAreas?.length || 0,
      hasAllowedZones:
        !!formattedResponse.allowedZones && formattedResponse.allowedZones.length > 0,
      hasRestrictedAreas:
        !!formattedResponse.restrictedAreas && formattedResponse.restrictedAreas.length > 0,
      allowedZones: formattedResponse.allowedZones,
      restrictedAreas: formattedResponse.restrictedAreas,
    });

    // DEBUG: Log the structure of the first stop of the first route before returning
    if (
      formattedResponse.routes &&
      formattedResponse.routes.length > 0 &&
      formattedResponse.routes[0].stops &&
      formattedResponse.routes[0].stops.length > 0
    ) {
      console.log('DEBUG TRANSFORM: First stop structure:', formattedResponse.routes[0].stops[0]);
    }

    return formattedResponse;
  } catch (error) {
    console.error('Error transforming optimization response:', error);

    // Return minimal valid response on error
    return {
      id: generateId(),
      requestId: generateId(),
      status: 'error',
      createdAt: new Date().toISOString(),
      name: `Error Plan`,
      routes: [],
      metrics: {
        totalDistance: 0,
        totalDuration: 0,
        vehiclesUsed: 0,
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Add a request timestamp tracker to prevent multiple rapid requests
let lastOptimizationTimestamp = 0;
const OPTIMIZATION_COOLDOWN_MS = 3000; // 3-second cooldown between optimization requests

export const optimizeRoutes = createAsyncThunk(
  'routes/optimizeRoutes',
  async (request: OptimizationRequest, { rejectWithValue }) => {
    try {
      // Implement rate limiting at the thunk level
      const now = Date.now();
      const timeSinceLastRequest = now - lastOptimizationTimestamp;

      if (timeSinceLastRequest < OPTIMIZATION_COOLDOWN_MS) {
        console.warn(
          `Rate limiting: Optimization request rejected (too frequent). Last request was ${timeSinceLastRequest}ms ago.`
        );
        return rejectWithValue(
          `Too many requests, please try again later. (Cooldown: ${Math.ceil((OPTIMIZATION_COOLDOWN_MS - timeSinceLastRequest) / 1000)}s)`
        );
      }

      console.log('Preparing optimization request for backend');

      // Set the timestamp before making the API call
      lastOptimizationTimestamp = now;

      // Transform the request to match backend format
      const transformedRequest = {
        pickupPoints: request.pickupPoints.map((point) => ({
          id: point.id,
          name: point.name,
          address: point.address || `${point.location.latitude}, ${point.location.longitude}`, // Required field
          lat: point.location.latitude,
          lng: point.location.longitude,
          priority: point.priority || 5, // Number 1-10, default 5
          serviceTime: 5, // Default service time in minutes
        })),
        deliveryPoints: request.deliveryPoints.map((point) => ({
          id: point.id,
          name: point.name, // Required: use 'name' not 'customer_name'
          address: point.address || `${point.location.latitude}, ${point.location.longitude}`, // Required field
          lat: point.location.latitude,
          lng: point.location.longitude,
          priority: point.priority || 5, // Number 1-10, default 5
          serviceTime: 5, // Default service time in minutes
        })),
        fleet: {
          vehicleType: request.fleet.vehicles[0]?.type?.toLowerCase() || 'car', // Must be object, not array
          count: request.fleet.vehicles.length || 1,
          capacity: request.fleet.vehicles[0]?.capacity || 1000,
          maxDistance: 100000, // Optional: max distance in meters
          maxDuration: 28800, // Optional: max duration in seconds (8 hours)
        },
        options: {
          optimizationMode: request.preferences?.optimizationFocus === 'distance' ? 'shortest' :
                           request.preferences?.optimizationFocus === 'time' ? 'fastest' : 'balanced',
          avoidTolls: false,
          avoidHighways: false,
          trafficModel: 'best_guess',
        },
      };

      console.log('Sending transformed optimization request to backend:', transformedRequest);

      const response = await axios.post(`${API_BASE_URL}/api/optimize`, transformedRequest);

      console.log('Raw optimization response:', response.data);

      // Check if the response indicates an error
      if (response.data.success === false) {
        console.error('Backend reported error:', response.data.error);
        return rejectWithValue(response.data.error || 'Unknown error from backend');
      }

      // Transform the backend response to our frontend format
      const optimizationResponse = transformToOptimizationResponse(response.data);

      // Log if we have zones in the transformed response
      console.log('Transformed optimization response zones:', {
        hasAllowedZones: !!(
          optimizationResponse.allowedZones && optimizationResponse.allowedZones.length > 0
        ),
        allowedZonesCount: optimizationResponse.allowedZones?.length || 0,
        hasRestrictedAreas: !!(
          optimizationResponse.restrictedAreas && optimizationResponse.restrictedAreas.length > 0
        ),
        restrictedAreasCount: optimizationResponse.restrictedAreas?.length || 0,
      });

      // Return the transformed response
      return optimizationResponse;
    } catch (error: any) {
      console.error('Error during optimization request:', error);
      let errorMessage = 'Failed to optimize routes';

      // Extract a meaningful error message
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Log the full error details for debugging
      console.error('Detailed error information:', {
        message: errorMessage,
        status: error.response?.status,
        data: error.response?.data,
      });

      // Always return a string for the error
      return rejectWithValue(errorMessage);
    }
  }
);

export const getOptimizationStatus = createAsyncThunk(
  'routes/getOptimizationStatus',
  async (requestId: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/optimize/${requestId}`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get optimization status');
    }
  }
);

export const fetchLatestOptimization = createAsyncThunk(
  'routes/fetchLatestOptimization',
  async (params: { limit?: number; page?: number } = {}, { rejectWithValue }) => {
    const limit = params.limit || 10;
    const page = params.page || 1;

    try {
      console.log(
        'Fetching latest optimization from API:',
        `${API_BASE_URL}/api/optimize/history?limit=${limit}&page=${page}`
      );

      // First get the history to find the latest request
      const historyResponse = await axios.get(
        `${API_BASE_URL}/api/optimize/history?limit=${limit}&page=${page}`
      );

      console.log('History response:', historyResponse.data);

      if (!historyResponse.data.data || historyResponse.data.data.length === 0) {
        return rejectWithValue(
          'No optimization history found. Create a new route optimization to get started.'
        );
      }

      // Process all optimization plans in the history
      const optimizationPlans = [];
      let latestOptimizationResponse = null;

      // Find the latest completed request
      const latestRequest = historyResponse.data.data[0];
      console.log('Latest request:', latestRequest);

      // Process each history item
      for (const historyItem of historyResponse.data.data) {
        // Determine the requestId - handle different API response formats
        const requestId = historyItem.requestId || historyItem.id;

        if (!requestId) {
          console.warn('Cannot find requestId in history item:', historyItem);
          continue; // Skip this item and continue with others
        }

        // Fetch the full details of the request
        console.log('Fetching details from:', `${API_BASE_URL}/api/optimize/${requestId}`);

        try {
          const detailsResponse = await axios.get(`${API_BASE_URL}/api/optimize/${requestId}`);

          console.log(`Details response for ${requestId}:`, detailsResponse.data);

          if (!detailsResponse.data) {
            console.warn(`Empty data returned from details API for ${requestId}`);
            continue;
          }

          // In some API formats, the full response may be in history already
          let responseData = detailsResponse.data;

          // Check if we need to use the original history data
          if (
            (!responseData.data || !responseData.data.routes) &&
            historyItem.routes &&
            Array.isArray(historyItem.routes)
          ) {
            console.log('Using routes data from history response instead of details', historyItem);
            responseData = historyItem;
          }

          // Transform backend format to frontend format
          const transformedResponse = transformToOptimizationResponse(responseData);

          // Add to the list of plans
          optimizationPlans.push(transformedResponse);

          // If this is the latest request, save it separately
          if (historyItem === latestRequest) {
            latestOptimizationResponse = transformedResponse;
          }
        } catch (itemError) {
          console.warn(`Error fetching details for ${requestId}:`, itemError);
          // Continue processing other items
        }
      }

      // If we couldn't process any plans, return an error
      if (optimizationPlans.length === 0) {
        return rejectWithValue('Failed to process any optimization plans from history');
      }

      // Extract pagination metadata from backend response
      const totalPages = historyResponse.data.totalPages || 1;
      const totalItems = historyResponse.data.totalItems || optimizationPlans.length;
      const currentPage = historyResponse.data.currentPage || page;

      // Return both the latest response and all plans with pagination
      return {
        latestOptimization: latestOptimizationResponse,
        allPlans: optimizationPlans,
        pagination: {
          limit,
          currentPage,
          totalPages,
          totalItems,
        },
      };
    } catch (error: any) {
      console.error('Error fetching latest optimization:', error);

      // Better error diagnostics
      if (error.response) {
        // Server responded with an error status
        console.error('Response error data:', error.response.data);
        console.error('Response error status:', error.response.status);
        console.error('Response error headers:', error.response.headers);
        return rejectWithValue(
          `API Error (${error.response.status}): ${error.response.data?.error || error.message}`
        );
      } else if (error.request) {
        // Request was made but no response received (server not running or CORS issue)
        console.error('No response received:', error.request);
        return rejectWithValue(
          'Cannot connect to the backend server. Please make sure it is running and accessible.'
        );
      } else {
        // Error in setting up the request
        console.error('Request setup error:', error.message);
        return rejectWithValue(`Request Error: ${error.message}`);
      }
    }
  }
);

// Add caching functions for optimization plans
const CACHE_KEY = 'optimization_plans_cache';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes in milliseconds

// Function to load cached data
const _loadFromCache = (): OptimizationResponse[] | null => {
  try {
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (!cachedData) return null;

    const { data, timestamp } = JSON.parse(cachedData);
    const now = Date.now();

    // Check if cache is still valid
    if (now - timestamp < CACHE_EXPIRY) {
      console.log('Using cached optimization plans from localStorage');
      return data as OptimizationResponse[];
    } else {
      console.log('Cache expired, will fetch fresh data');
      return null;
    }
  } catch (error) {
    console.warn('Error loading from cache:', error);
    return null;
  }
};

// Function to save data to cache
const _saveToCache = (data: OptimizationResponse[]): void => {
  try {
    // Limit the number of plans we cache to prevent storage issues
    const plansToCache = data.slice(0, 20); // Only cache the 20 most recent plans

    // Create a more compact version of the data to save space
    const compactData = plansToCache.map((plan) => {
      // Only keep essential route data to reduce size
      const compactRoutes = plan.routes.map((route) => ({
        id: route.id,
        vehicleName: route.vehicleName,
        distance: route.distance,
        duration: route.duration,
        pickupId: route.pickupId,
        // Only keep minimal stop data - just location and type
        stops: route.stops.map((stop) => ({
          id: stop.id,
          type: stop.type,
          location: stop.location,
        })),
      }));

      // Check if plan has zones and include them in cache
      const hasZones = !!(plan.allowedZones?.length || plan.restrictedAreas?.length);

      console.log(`Caching plan ${plan.requestId}, has zones: ${hasZones}`, {
        allowedZones: plan.allowedZones?.length || 0,
        restrictedAreas: plan.restrictedAreas?.length || 0,
      });

      return {
        id: plan.id,
        requestId: plan.requestId,
        status: plan.status,
        createdAt: plan.createdAt,
        name: plan.name,
        routes: compactRoutes,
        metrics: plan.metrics,
        // Include zone data in the cache
        allowedZones: plan.allowedZones || [],
        restrictedAreas: plan.restrictedAreas || [],
      };
    });

    console.log(`Cached ${compactData.length} plans (compact version)`);

    // Store timestamp with the cache to enable expiration
    const cacheData = {
      timestamp: Date.now(),
      data: compactData,
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (storageError: any) {
    if (
      storageError.name === 'QuotaExceededError' ||
      storageError.toString().includes('quota') ||
      storageError.toString().includes('storage')
    ) {
      console.warn('LocalStorage quota exceeded, clearing cache to make room');
      try {
        // Clear just our cache, not all localStorage
        localStorage.removeItem(CACHE_KEY);

        // Now try again with the most recent 10 plans only
        const reducedPlans = data.slice(0, 10).map((plan) => ({
          id: plan.id,
          requestId: plan.requestId,
          status: plan.status,
          createdAt: plan.createdAt,
          name: plan.name,
          // Extremely minimal route data
          routes: plan.routes.map((route) => ({
            id: route.id,
            vehicleName: route.vehicleName,
          })),
          metrics: {
            totalDistance: plan.metrics.totalDistance,
            totalDuration: plan.metrics.totalDuration,
            vehiclesUsed: plan.metrics.vehiclesUsed,
          },
          // Include minimal zone data even in reduced plans
          allowedZones:
            plan.allowedZones?.map((zone) => ({
              id: zone.id,
              name: zone.name,
              area: zone.area,
            })) || [],
          restrictedAreas:
            plan.restrictedAreas?.map((area) => ({
              id: area.id,
              name: area.name,
              area: area.area,
            })) || [],
        }));

        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            timestamp: Date.now(),
            data: reducedPlans,
          })
        );

        console.log('Successfully saved reduced plans to cache');
      } catch (innerError) {
        console.error('Failed to save even with reduced data:', innerError);
      }
    } else {
      console.error('Error saving to cache:', storageError);
    }
  }
};

// Function to estimate the size of data in localStorage
const getLocalStorageUsage = (): { totalSize: number; itemSizes: Record<string, number> } => {
  if (typeof window === 'undefined') return { totalSize: 0, itemSizes: {} };

  const itemSizes: Record<string, number> = {};
  let totalSize = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      const value = localStorage.getItem(key);
      if (!value) continue;

      // Estimate size in KB (2 bytes per character for UTF-16)
      const size = (value.length * 2) / 1024;
      itemSizes[key] = size;
      totalSize += size;
    }
  } catch (e) {
    console.error('Error estimating localStorage usage:', e);
  }

  return { totalSize, itemSizes };
};

// Function to clean up localStorage when quota is exceeded
const _cleanupLocalStorage = () => {
  if (typeof window === 'undefined') return;

  try {
    // Check current usage
    const { totalSize, itemSizes } = getLocalStorageUsage();
    console.log(`Current localStorage usage: ${totalSize.toFixed(2)} KB`);

    // If we're using less than 4MB, don't need to clean up
    if (totalSize < 4000) return;

    // Log the biggest items
    const sortedItems = Object.entries(itemSizes).sort(([, size1], [, size2]) => size2 - size1);

    console.log('Largest items in localStorage:');
    sortedItems.slice(0, 5).forEach(([key, size]) => {
      console.log(`${key}: ${size.toFixed(2)} KB`);
    });

    // Remove the cache key first if it exists
    if (localStorage.getItem(CACHE_KEY)) {
      console.log(`Removing ${CACHE_KEY} to free up space`);
      localStorage.removeItem(CACHE_KEY);
    }

    // If we still need to free up more space, remove the largest items
    if (totalSize > 4500) {
      // Remove up to 3 of the largest items that aren't essential
      let removed = 0;
      for (const [key, size] of sortedItems) {
        // Skip essential items
        if (key.includes('persist:') || key.includes('auth') || key === CACHE_KEY) continue;

        console.log(`Removing ${key} to free up ${size.toFixed(2)} KB`);
        localStorage.removeItem(key);
        removed++;

        if (removed >= 3) break;
      }
    }
  } catch (e) {
    console.error('Error cleaning up localStorage:', e);
  }
};

// Create the Routes slice with reducer and actions
const routesSlice = createSlice({
  name: 'routes',
  initialState: {
    optimizationRequest: null,
    optimizationResponse: null,
    optimizationPlans: [],
    selectedPlanId: null,
    selectedRouteId: null,
    loading: false,
    error: null,
    mapFilters: {
      showRoutes: true,
      showPickupPoints: true,
      showDeliveryPoints: true,
      showRestrictedAreas: true,
      showAllowedAreas: true,
    },
    optimizationHistoryIds: [],
    optimizationCache: {} as Record<string, OptimizationResponse>,
    pagination: {
      limit: 10,
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
    },
  } as RouteState,
  reducers: {
    setSelectedRoute(state, action) {
      state.selectedRouteId = action.payload;
      // If we clear the selected route, keep the view on the same plan
      if (action.payload === null && state.optimizationResponse) {
        state.selectedPlanId = state.optimizationResponse.requestId;
      }
    },
    setSelectedPlan(state, action) {
      state.selectedPlanId = action.payload;
      console.log(`Setting selected plan to ${action.payload}`);

      // If the selected plan is not the current optimizationResponse, set it
      if (action.payload && state.optimizationCache[action.payload]) {
        const plan = state.optimizationCache[action.payload];
        console.log('Loading plan from cache:', {
          planId: plan.requestId,
          hasAllowedZones: !!(plan.allowedZones && plan.allowedZones.length > 0),
          allowedZonesCount: plan.allowedZones?.length || 0,
          hasRestrictedAreas: !!(plan.restrictedAreas && plan.restrictedAreas.length > 0),
          restrictedAreasCount: plan.restrictedAreas?.length || 0,
          zoneInfo: {
            allowedZones: plan.allowedZones,
            restrictedAreas: plan.restrictedAreas,
          },
        });

        state.optimizationResponse = plan;
        console.log('Zones data after setting optimizationResponse:', {
          hasAllowedZones: !!(
            state.optimizationResponse.allowedZones &&
            state.optimizationResponse.allowedZones.length > 0
          ),
          allowedZonesCount: state.optimizationResponse.allowedZones?.length || 0,
          hasRestrictedAreas: !!(
            state.optimizationResponse.restrictedAreas &&
            state.optimizationResponse.restrictedAreas.length > 0
          ),
          restrictedAreasCount: state.optimizationResponse.restrictedAreas?.length || 0,
        });
      }
    },
    toggleMapFilter(state, action) {
      const filterName = action.payload as keyof MapFilters;
      state.mapFilters[filterName] = !state.mapFilters[filterName];

      // If we're enabling zones and test zones exist, load them
      if (
        (filterName === 'showAllowedAreas' || filterName === 'showRestrictedAreas') &&
        state.mapFilters[filterName] &&
        state.optimizationResponse
      ) {
        // Placeholder for future logic if needed
      }
    },
    setMapFilters(state, action) {
      // Instead of replacing, merge with existing filters
      state.mapFilters = { ...state.mapFilters, ...action.payload };

      // Check if we're enabling zones
      const enablingZones =
        (action.payload.showAllowedAreas && !state.mapFilters.showAllowedAreas) ||
        (action.payload.showRestrictedAreas && !state.mapFilters.showRestrictedAreas);

      // If enabling zones and we have a response, try to load test zones
      if (enablingZones && state.optimizationResponse) {
        // Placeholder for future logic if needed
      }
    },
    setPaginationSettings(state, action) {
      // Update pagination settings
      if (action.payload.limit !== undefined) {
        state.pagination.limit = action.payload.limit;
        // Reset to page 1 when limit changes
        state.pagination.currentPage = 1;
      }
      if (action.payload.currentPage !== undefined) {
        state.pagination.currentPage = action.payload.currentPage;
      }
    },
  },
  extraReducers: (builder) => {
    // Handle optimizeRoutes pending
    builder.addCase(optimizeRoutes.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    // Handle optimizeRoutes fulfilled
    builder.addCase(optimizeRoutes.fulfilled, (state, action) => {
      state.loading = false;
      state.optimizationResponse = action.payload;

      // Add the new optimization to the list of plans
      if (action.payload && action.payload.requestId) {
        // Add to cache
        state.optimizationCache[action.payload.requestId] = action.payload;

        // Add to beginning of plans array so it shows at the top of the list
        state.optimizationPlans = [action.payload, ...state.optimizationPlans];

        // Set as selected plan
        state.selectedPlanId = action.payload.requestId;

        console.log(`Added new optimization to plans: ${action.payload.requestId}`);
      }

      // Reset selected route when a new optimization is loaded
      state.selectedRouteId = null;
    });
    // Handle optimizeRoutes rejected
    builder.addCase(optimizeRoutes.rejected, (state, action) => {
      state.loading = false;
      // Ensure the error is always a string
      state.error =
        typeof action.payload === 'string'
          ? action.payload
          : 'Failed to optimize routes. Please try again.';
    });

    // Handle fetchLatestOptimization pending
    builder.addCase(fetchLatestOptimization.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    // Handle fetchLatestOptimization fulfilled
    builder.addCase(fetchLatestOptimization.fulfilled, (state, action) => {
      state.loading = false;

      // Update the response with the latest optimization
      if (action.payload && action.payload.latestOptimization) {
        state.optimizationResponse = action.payload.latestOptimization;

        // Add to cache and set as selected plan
        if (action.payload.latestOptimization.requestId) {
          state.optimizationCache[action.payload.latestOptimization.requestId] =
            action.payload.latestOptimization;
          state.selectedPlanId = action.payload.latestOptimization.requestId;
        }
      }

      // Load all plans into the plans array and cache
      if (action.payload && action.payload.allPlans && Array.isArray(action.payload.allPlans)) {
        // Start with an empty array and refill it
        state.optimizationPlans = [];

        // Add each plan to the state
        action.payload.allPlans.forEach((plan) => {
          if (plan && plan.requestId) {
            // Add to cache
            state.optimizationCache[plan.requestId] = plan;

            // Add to plans array
            state.optimizationPlans.push(plan);
          }
        });

        console.log(`Loaded ${state.optimizationPlans.length} plans into state`);
      }

      // Update pagination metadata
      if (action.payload && action.payload.pagination) {
        state.pagination = action.payload.pagination;
        console.log('Updated pagination:', state.pagination);
      }

      // Reset selected route when a new optimization is loaded
      state.selectedRouteId = null;
    });
    // Handle fetchLatestOptimization rejected
    builder.addCase(fetchLatestOptimization.rejected, (state, action) => {
      state.loading = false;
      state.error = (action.payload as string) || 'Failed to fetch latest optimization';
    });
  },
});

// Export the action creators
export const { setSelectedRoute, setSelectedPlan, toggleMapFilter, setMapFilters, setPaginationSettings } =
  routesSlice.actions;

// Set up middleware for handling serializable checks
export const routesMiddleware = {
  // Ignore optimizationCache which can contain complex data
  serializableCheck: {
    ignoredPaths: ['routes.optimizationCache'],
  },
};

// Export the reducer
export default routesSlice.reducer;
