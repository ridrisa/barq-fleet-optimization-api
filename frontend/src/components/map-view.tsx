'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Map, { Source, Layer, Marker, Popup, NavigationControl } from 'react-map-gl';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '@/store/store';
import { RoutePoint, toggleMapFilter, RouteState } from '@/store/slices/routesSlice';
import { decodePolyline } from '@/lib/utils';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Truck,
  Package,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  Clock,
  Ban as BanIcon,
} from 'lucide-react';

// Define the AreaDefinition interface
interface AreaDefinition {
  id: string;
  name: string;
  area: number[][];
  timeRestriction?: string;
}

// Colors for routes - expanded palette with more variety
const routeColors = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ef4444', // red-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
  '#a855f7', // purple-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
  '#f43f5e', // rose-500
  '#6366f1', // indigo-500
  '#0ea5e9', // sky-500
  '#22c55e', // green-500
  '#eab308', // yellow-500
];

// Add more verbose debug logging for areas
const debugCoordinates = (coordinates: number[][], areaType: string, areaId: string) => {
  console.log(`Processing ${areaType} area coordinates for ${areaId}:`, {
    originalCoordinates: coordinates,
    coordinateCount: coordinates.length,
    firstPoint: coordinates.length > 0 ? coordinates[0] : null,
    lastPoint: coordinates.length > 0 ? coordinates[coordinates.length - 1] : null,
    rawCoordinates: `${JSON.stringify(coordinates).substring(0, 100)}...`, // Log the raw coordinates for debugging
  });

  // Verify coordinates array
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
    console.error(`Invalid ${areaType} area coordinates for ${areaId}:`, coordinates);
    return [];
  }

  // Check if each coordinate is a valid [lat, lng] pair
  const validCoordinates = coordinates.filter(
    (coord) =>
      Array.isArray(coord) &&
      coord.length === 2 &&
      typeof coord[0] === 'number' &&
      typeof coord[1] === 'number' &&
      !isNaN(coord[0]) &&
      !isNaN(coord[1])
  );

  if (validCoordinates.length < 3) {
    console.error(`Not enough valid coordinates for ${areaType} area ${areaId}:`, validCoordinates);
    return [];
  }

  // Transform coordinates from [lat, lng] to [lng, lat] for Mapbox
  const transformedCoordinates = validCoordinates.map((coord, index) => {
    const lat = coord[0];
    const lng = coord[1];
    console.log(`Transforming coordinate ${index}: [${lat}, ${lng}] to [${lng}, ${lat}]`);
    return [lng, lat]; // Swap lat/lng to lng/lat for Mapbox
  });

  // Make a deep copy to avoid modifying the original
  const processedCoordinates = JSON.parse(JSON.stringify(transformedCoordinates));

  // Check if the polygon is closed (first point equals last point)
  const firstPoint = processedCoordinates[0];
  const lastPoint = processedCoordinates[processedCoordinates.length - 1];

  const isClosed = firstPoint[0] === lastPoint[0] && firstPoint[1] === lastPoint[1];
  console.log(`Is polygon closed? ${isClosed}`);

  // If not closed, close it by adding the first point again
  if (!isClosed) {
    console.log(`Closing polygon for ${areaType} area ${areaId} by adding first point at the end`);
    processedCoordinates.push([...firstPoint]);
  }

  console.log(`Final ${areaType} area coordinates for ${areaId}:`, {
    coordinateCount: processedCoordinates.length,
    isClosed:
      processedCoordinates[0][0] === processedCoordinates[processedCoordinates.length - 1][0] &&
      processedCoordinates[0][1] === processedCoordinates[processedCoordinates.length - 1][1],
    firstCoordinate: processedCoordinates[0],
    lastCoordinate: processedCoordinates[processedCoordinates.length - 1],
    coordinates: processedCoordinates,
  });

  return processedCoordinates;
};

// Component for rendering allowed zones
const _AllowedZones: React.FC<{
  zones: AreaDefinition[];
}> = ({ zones }) => {
  console.log('Rendering allowed zones:', zones);
  return (
    <>
      {zones.map((zone) => {
        if (!Array.isArray(zone.area) || zone.area.length < 3) {
          console.log('Invalid zone area format:', zone.area);
          return null;
        }

        // Transform coordinates for Mapbox with enhanced debugging
        const coordinates = debugCoordinates(zone.area, 'ALLOWED', zone.id);

        if (coordinates.length < 3) return null;

        // The coordinates are already closed by debugCoordinates
        console.log('Final coordinates for allowed zone:', coordinates);

        return (
          <Source
            key={`allowed-zone-source-${zone.id}`}
            id={`allowed-zone-source-${zone.id}`}
            type="geojson"
            data={{
              type: 'Feature',
              properties: {
                id: zone.id,
                name: zone.name,
                timeRestriction: zone.timeRestriction,
              },
              geometry: {
                type: 'Polygon',
                coordinates: [coordinates],
              },
            }}
          >
            {/* Fill layer for the allowed zone */}
            <Layer
              id={`allowed-zone-fill-${zone.id}`}
              type="fill"
              paint={{
                'fill-color': '#10b981', // Green color
                'fill-opacity': 0.3,
              }}
            />

            {/* Border layer for the allowed zone */}
            <Layer
              id={`allowed-zone-border-${zone.id}`}
              type="line"
              paint={{
                'line-color': '#10b981', // Green color
                'line-width': 2,
                'line-opacity': 0.6,
              }}
            />
          </Source>
        );
      })}
    </>
  );
};

// Component for rendering restricted areas
const _RestrictedAreas: React.FC<{
  areas: AreaDefinition[];
}> = ({ areas }) => {
  console.log('Rendering restricted areas:', {
    areasCount: areas?.length || 0,
    areasData: areas,
  });

  if (!areas || areas.length === 0) {
    console.log('No restricted areas to render');
    return null;
  }

  // Make sure the areas are properly processed
  return (
    <>
      {areas.map((area) => {
        // Add debug logging
        console.log(`Processing restricted area ${area.id || 'unknown'}:`, {
          id: area.id,
          name: area.name,
          hasArea: Boolean(area.area && area.area.length > 0),
          areaLength: area.area?.length || 0,
          areaSample: area.area?.slice(0, 3),
        });

        // Skip invalid areas
        if (!area.area || !Array.isArray(area.area) || area.area.length < 3) {
          console.log('Invalid area format - skipping', area);
          return null;
        }

        // Ensure area coordinates are properly closed for rendering
        const coordinates = debugCoordinates(area.area, 'restricted', area.id || 'unknown');

        // Skip if the coordinates are invalid after processing
        if (coordinates.length < 3) {
          console.log('Invalid coordinates after processing - skipping', coordinates);
          return null;
        }

        console.log('Final coordinates for restricted area:', coordinates);

        return (
          <Source
            key={`restricted-area-${area.id || Math.random().toString(36).substring(2, 9)}`}
            id={`restricted-area-${area.id || Math.random().toString(36).substring(2, 9)}`}
            type="geojson"
            data={{
              type: 'Feature',
              properties: {
                name: area.name || 'Restricted Area',
                id: area.id || 'unknown',
                timeRestriction: area.timeRestriction,
              },
              geometry: {
                type: 'Polygon',
                coordinates: [coordinates],
              },
            }}
          >
            <Layer
              id={`restricted-area-fill-${area.id || Math.random().toString(36).substring(2, 9)}`}
              type="fill"
              paint={{
                'fill-color': '#ff5252',
                'fill-opacity': 0.3,
              }}
            />
            <Layer
              id={`restricted-area-line-${area.id || Math.random().toString(36).substring(2, 9)}`}
              type="line"
              paint={{
                'line-color': '#ff0000',
                'line-width': 2,
                'line-dasharray': [2, 2],
              }}
            />
          </Source>
        );
      })}
    </>
  );
};

export function MapView() {
  const dispatch = useDispatch<AppDispatch>();
  const mapRef = useRef<any>(null);
  const [popupInfo, setPopupInfo] = useState<RoutePoint | null>(null);
  const [hiddenRouteIds, setHiddenRouteIds] = useState<string[]>([]);
  const optimizationLoaded = useRef(false);

  // Add direct state for manual restricted areas
  const [manualRestrictedAreas, setManualRestrictedAreas] = useState<AreaDefinition[]>([]);
  const [_forceRenderZones, setForceRenderZones] = useState<boolean>(false);

  // Get API base URL from environment
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

  // Add state for selected stop
  const [selectedStop, setSelectedStop] = useState<{
    route: any;
    stop: any;
    stopIndex: number;
  } | null>(null);

  // Add hover info state
  const [hoverInfo, setHoverInfo] = useState<{
    id: string;
    content: string;
  } | null>(null);

  // Add a state for area hover information
  const [hoveredArea, setHoveredArea] = useState<{
    id: string;
    name: string;
    type: 'allowed' | 'restricted';
    coordinates: [number, number];
    timeRestriction?: string;
  } | null>(null);

  // Add state to track clicked area data for inspection
  const [clickedAreaInfo, setClickedAreaInfo] = useState<{
    id: string;
    name: string;
    type: 'allowed' | 'restricted';
    area: number[][];
  } | null>(null);

  // Use a type assertion to ensure TypeScript understands the shape
  const routes = useSelector((state: RootState) => state.routes as RouteState);

  // Safely destructure with fallbacks
  const optimizationResponse = routes?.optimizationResponse || null;
  const selectedRouteId = routes?.selectedRouteId || null;
  const mapFilters = routes?.mapFilters || {
    showRoutes: true,
    showPickupPoints: true,
    showDeliveryPoints: true,
    showRestrictedAreas: true,
    showAllowedAreas: true,
  };

  // Inside the MapView function, after the state and selector declarations but before the useEffects
  // Add this debugging effect to log details about the zones from the optimization response
  const loadCurrentRequestAreas = useCallback(() => {
    if (!optimizationResponse) return;

    console.log('EMERGENCY FIX: Loading restricted areas directly from current response data');
    try {
      // Check for full API response data in browser console
      console.log('Current optimization response:', optimizationResponse);

      // Get all possible ID fields from the response
      const id = optimizationResponse.id || null;
      const requestId = optimizationResponse.requestId || null;

      console.log('EMERGENCY FIX: Available IDs:', { id, requestId });

      // Try to get data using the id first (more likely to work) and fall back to requestId
      const idToUse = id || requestId;

      if (idToUse) {
        console.log(`EMERGENCY FIX: Using ID ${idToUse} to fetch data`);

        // Force a request to the API to get the most recent data
        fetch(`${API_BASE_URL}/api/optimize/${idToUse}`)
          .then((response) => response.json())
          .then((data) => {
            console.log('Direct API data for emergency fix:', data);

            // If the first attempt failed and we have both IDs, try the other one
            if (data.success === false && id && requestId && id !== requestId) {
              console.log(`EMERGENCY FIX: First ID failed, trying alternate ID ${requestId}`);
              return fetch(`${API_BASE_URL}/api/optimize/${requestId}`).then((response) =>
                response.json()
              );
            }

            return data;
          })
          .then((data) => {
            // Look for restricted areas in all possible locations
            let restrictedAreas: AreaDefinition[] = [];

            // 1. Top level restrictedAreas
            if (
              data.restrictedAreas &&
              Array.isArray(data.restrictedAreas) &&
              data.restrictedAreas.length > 0
            ) {
              restrictedAreas = data.restrictedAreas;
              console.log('FOUND RESTRICTED AREAS IN: top level');
            }
            // 2. businessRules.restrictedAreas
            else if (
              data.businessRules &&
              data.businessRules.restrictedAreas &&
              Array.isArray(data.businessRules.restrictedAreas)
            ) {
              restrictedAreas = data.businessRules.restrictedAreas;
              console.log('FOUND RESTRICTED AREAS IN: businessRules');
            }
            // 3. data.businessRules.restrictedAreas
            else if (
              data.data &&
              data.data.businessRules &&
              data.data.businessRules.restrictedAreas
            ) {
              restrictedAreas = data.data.businessRules.restrictedAreas;
              console.log('FOUND RESTRICTED AREAS IN: data.businessRules');
            }
            // 4. data.request.businessRules.restrictedAreas (most likely location)
            else if (
              data.data &&
              data.data.request &&
              data.data.request.businessRules &&
              data.data.request.businessRules.restrictedAreas
            ) {
              restrictedAreas = data.data.request.businessRules.restrictedAreas;
              console.log('FOUND RESTRICTED AREAS IN: data.request.businessRules');
            }

            console.log('MANUAL LOAD: Found restricted areas:', restrictedAreas);

            if (restrictedAreas.length > 0) {
              // Format them properly for the map
              const formattedAreas = restrictedAreas.map((area) => ({
                id: area.id || `area-${Math.random().toString(36).substring(2, 9)}`,
                name: area.name || 'Restricted Area',
                area: area.area,
                timeRestriction: area.timeRestriction,
              }));

              setManualRestrictedAreas(formattedAreas);
              setForceRenderZones(true);
              console.log(
                'EMERGENCY FIX: Loaded',
                formattedAreas.length,
                'restricted areas manually'
              );
            } else {
              console.log('EMERGENCY FIX: No restricted areas found in any location');
            }
          })
          .catch((error) => {
            console.error('Error fetching direct API data:', error);
          });
      } else {
        console.error('EMERGENCY FIX: No valid ID available to fetch data');
      }
    } catch (e) {
      console.error('Error in emergency load of restricted areas:', e);
    }
  }, [optimizationResponse]);

  // Create a function to handle unserviceable points for rendering
  const getUnserviceablePoints = useCallback(() => {
    if (!optimizationResponse) return [];

    const unserviceable: any[] = [];

    // First add any unserviceable points from the top level
    // if (optimizationResponse.unserviceablePoints && Array.isArray(optimizationResponse.unserviceablePoints)) {
    //   unserviceable.push(...optimizationResponse.unserviceablePoints);
    // }

    // Then add unserviceable stops from each route
    optimizationResponse.routes.forEach((route: any) => {
      // Check if the entire route is unserviceable
      if (route.fullyUnserviceable) {
        console.log(`Adding all stops from unserviceable route ${route.id}`);
        if (route.stops) {
          route.stops.forEach((stop: any) => {
            if (stop.unserviceable || stop.isInRestrictedArea) {
              unserviceable.push({
                id: stop.id,
                location: stop.location,
                reason: `In restricted area: ${stop.restrictedAreaName || 'Unknown'}`,
                type: stop.type,
              });
            }
          });
        }
      } else if (route.unserviceableStops && Array.isArray(route.unserviceableStops)) {
        // Add individual unserviceable stops from this route
        unserviceable.push(...route.unserviceableStops);
      }
    });

    console.log(`Found ${unserviceable.length} unserviceable points in total`);
    return unserviceable;
  }, [optimizationResponse]);

  // Try to initialize manual areas when optimization response changes
  useEffect(() => {
    if (optimizationResponse && manualRestrictedAreas.length === 0) {
      loadCurrentRequestAreas();
    }
  }, [optimizationResponse, manualRestrictedAreas.length, loadCurrentRequestAreas]);

  useEffect(() => {
    if (optimizationResponse) {
      console.log('MAPVIEW: Optimization response zones:', {
        hasAllowedZones: !!(
          optimizationResponse.allowedZones && optimizationResponse.allowedZones.length > 0
        ),
        allowedZonesCount: optimizationResponse.allowedZones?.length || 0,
        allowedZonesDetails: optimizationResponse.allowedZones,
        hasRestrictedAreas: !!(
          optimizationResponse.restrictedAreas && optimizationResponse.restrictedAreas.length > 0
        ),
        restrictedAreasCount: optimizationResponse.restrictedAreas?.length || 0,
        restrictedAreasDetails: optimizationResponse.restrictedAreas,
        requestId: optimizationResponse.requestId,
      });
    }
  }, [optimizationResponse]);

  const [viewState] = useState({
    longitude: 45.0, // Middle East
    latitude: 25.0,
    zoom: 4,
  });

  // Helper function to render a route with direct lines based on stops
  const renderDirectRoute = (route: any, index: number, isSelected: boolean = false) => {
    // If no stops or only one stop, we can't draw a route
    if (!route.stops || route.stops.length < 2) return null;

    // Skip fully unserviceable routes
    if (route.fullyUnserviceable) {
      console.log(`Route ${route.id} is fully unserviceable and won't be rendered as a route`);
      return null;
    }

    // Get the polyline if available
    const hasPolyline = route.geometry && route.geometry !== '';

    // Generate a GeoJSON route from stops
    const routeGeoJSON: any = {
      type: 'Feature',
      properties: {
        id: route.id,
        index,
        isSelected,
        restrictedAreasAvoided: route.restrictedAreasAvoided,
      },
      geometry: {
        type: 'LineString',
        coordinates: [],
      },
    };

    // If we have a polyline from OSRM, use it
    if (hasPolyline) {
      try {
        // Check the polyline data for debugging
        console.log(`Route ${route.id} has polyline geometry of length: ${route.geometry.length}`);

        // Try to decode the polyline
        const decoded = decodePolyline(route.geometry);

        // Log the decoded data
        console.log(`Decoded ${decoded.length} points from polyline for route ${route.id}`);

        if (decoded.length > 0) {
          routeGeoJSON.geometry.coordinates = decoded;
          console.log(`Using polyline-based coordinates for route ${route.id}`);
        } else {
          // Fall back to direct connections if decoding returned empty array
          console.warn(
            `Decoding returned no points for route ${route.id}, falling back to direct connections`
          );
          routeGeoJSON.geometry.coordinates = route.stops.map((stop: any) => [
            stop.location.longitude,
            stop.location.latitude,
          ]);
        }
      } catch (error) {
        console.error(`Error decoding polyline for route ${route.id}:`, error);

        // Fall back to direct connections between stops
        routeGeoJSON.geometry.coordinates = route.stops.map((stop: any) => [
          stop.location.longitude,
          stop.location.latitude,
        ]);
      }
    } else {
      console.warn(`Route ${route.id} has no polyline geometry, using direct connections`);
      // Direct connections between stops
      routeGeoJSON.geometry.coordinates = route.stops.map((stop: any) => [
        stop.location.longitude,
        stop.location.latitude,
      ]);
    }

    return routeGeoJSON;
  };

  useEffect(() => {
    // Fit map to route bounds when a route is selected
    if (!optimizationResponse || !selectedRouteId) return;

    const selectedRoute = optimizationResponse.routes.find((route) => route.id === selectedRouteId);
    if (!selectedRoute || selectedRoute.stops.length === 0) return;

    // Calculate bounds
    const coordinates = selectedRoute.stops.map((stop) => ({
      longitude: stop.location.longitude,
      latitude: stop.location.latitude,
    }));

    // Add a small buffer around the route for better visibility
    const bounds = coordinates.reduce(
      (bounds: any, coord: any) => {
        bounds.sw.longitude = Math.min(bounds.sw.longitude, coord.longitude);
        bounds.sw.latitude = Math.min(bounds.sw.latitude, coord.latitude);
        bounds.ne.longitude = Math.max(bounds.ne.longitude, coord.longitude);
        bounds.ne.latitude = Math.max(bounds.ne.latitude, coord.latitude);
        return bounds;
      },
      {
        sw: { longitude: Infinity, latitude: Infinity },
        ne: { longitude: -Infinity, latitude: -Infinity },
      }
    );

    // Add buffer for small routes (0.002 degrees ≈ 220 meters)
    const MIN_SIZE_DEGREES = 0.002;
    const lonDelta = bounds.ne.longitude - bounds.sw.longitude;
    const latDelta = bounds.ne.latitude - bounds.sw.latitude;

    if (lonDelta < MIN_SIZE_DEGREES) {
      const center = (bounds.ne.longitude + bounds.sw.longitude) / 2;
      bounds.sw.longitude = center - MIN_SIZE_DEGREES / 2;
      bounds.ne.longitude = center + MIN_SIZE_DEGREES / 2;
    }

    if (latDelta < MIN_SIZE_DEGREES) {
      const center = (bounds.ne.latitude + bounds.sw.latitude) / 2;
      bounds.sw.latitude = center - MIN_SIZE_DEGREES / 2;
      bounds.ne.latitude = center + MIN_SIZE_DEGREES / 2;
    }

    // Add padding based on the route size
    const padding = {
      top: 100,
      bottom: 100,
      left: 100,
      right: 100,
    };

    mapRef.current?.fitBounds(
      [
        [bounds.sw.longitude, bounds.sw.latitude],
        [bounds.ne.longitude, bounds.ne.latitude],
      ],
      {
        padding,
        duration: 1000,
        maxZoom: 15, // Limit maximum zoom level to avoid zooming in too much on small routes
      }
    );

    console.log(
      `Auto-zoomed to selected route ${selectedRouteId} with padding ${JSON.stringify(padding)}`
    );
  }, [optimizationResponse, selectedRouteId]);

  // Auto-fit the map to display all routes on initial load or when plan changes
  useEffect(() => {
    // Skip if we don't have any routes to show
    if (!optimizationResponse || optimizationResponse.routes.length === 0) return;

    // Only auto-zoom when no specific route is selected
    if (selectedRouteId === null) {
      // Calculate bounds from all visible routes
      let allCoordinates: { longitude: number; latitude: number }[] = [];

      optimizationResponse.routes.forEach((route: any) => {
        // Skip hidden routes
        if (hiddenRouteIds.includes(route.id)) return;

        allCoordinates = [
          ...allCoordinates,
          ...route.stops.map((stop: any) => ({
            longitude: stop.location.longitude,
            latitude: stop.location.latitude,
          })),
        ];
      });

      // Also include unassigned stops if available
      if (optimizationResponse.unassignedStops) {
        allCoordinates = [
          ...allCoordinates,
          ...optimizationResponse.unassignedStops.map((stop: any) => ({
            longitude: stop.location.longitude,
            latitude: stop.location.latitude,
          })),
        ];
      }

      if (allCoordinates.length === 0) return;

      const bounds = allCoordinates.reduce(
        (bounds: any, coord: any) => {
          bounds.sw.longitude = Math.min(bounds.sw.longitude, coord.longitude);
          bounds.sw.latitude = Math.min(bounds.sw.latitude, coord.latitude);
          bounds.ne.longitude = Math.max(bounds.ne.longitude, coord.longitude);
          bounds.ne.latitude = Math.max(bounds.ne.latitude, coord.latitude);
          return bounds;
        },
        {
          sw: { longitude: Infinity, latitude: Infinity },
          ne: { longitude: -Infinity, latitude: -Infinity },
        }
      );

      // Add padding
      const padding = 50;
      mapRef.current?.fitBounds(
        [
          [bounds.sw.longitude, bounds.sw.latitude],
          [bounds.ne.longitude, bounds.ne.latitude],
        ],
        { padding, duration: 1000 }
      );

      console.log('Auto-zoomed to show all visible routes');
    }
  }, [optimizationResponse, selectedRouteId, hiddenRouteIds]);

  // Force enable routes filter when plan changes - ONLY ON INITIAL LOAD, not constantly
  useEffect(() => {
    if (optimizationResponse && !mapFilters.showRoutes && !optimizationLoaded.current) {
      console.log('Enabling routes filter on initial plan load');
      dispatch({ type: 'routes/setMapFilters', payload: { showRoutes: true } });
      optimizationLoaded.current = true;
    }
  }, [optimizationResponse, mapFilters.showRoutes, dispatch]);

  // Toggle handler for map filters
  const handleToggleFilter = (filterName: keyof typeof mapFilters) => {
    dispatch(toggleMapFilter(filterName));
  };

  // Toggle route visibility when clicking on legend items
  const toggleRouteVisibility = (routeId: string) => {
    setHiddenRouteIds((prev) => {
      if (prev.includes(routeId)) {
        return prev.filter((id) => id !== routeId); // Remove to show the route
      } else {
        return [...prev, routeId]; // Add to hide the route
      }
    });
  };

  // Render map toggle controls
  const renderMapControls = () => {
    return (
      <div className="flex items-center justify-center space-x-1">
        <button
          className={`flex items-center px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
            mapFilters.showRoutes
              ? 'bg-primary text-primary-foreground border-transparent'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted border-dashed border-muted-foreground/30'
          }`}
          onClick={() => handleToggleFilter('showRoutes')}
          title={mapFilters.showRoutes ? 'Hide routes' : 'Show routes'}
        >
          {mapFilters.showRoutes ? (
            <EyeIcon className="h-2.5 w-2.5 mr-0.5" />
          ) : (
            <EyeOffIcon className="h-2.5 w-2.5 mr-0.5" />
          )}
          <span>Routes</span>
        </button>

        <button
          className={`flex items-center px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
            mapFilters.showPickupPoints
              ? 'bg-primary text-primary-foreground border-transparent'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted border-dashed border-muted-foreground/30'
          }`}
          onClick={() => handleToggleFilter('showPickupPoints')}
          title={mapFilters.showPickupPoints ? 'Hide pickup points' : 'Show pickup points'}
        >
          {mapFilters.showPickupPoints ? (
            <EyeIcon className="h-2.5 w-2.5 mr-0.5" />
          ) : (
            <EyeOffIcon className="h-2.5 w-2.5 mr-0.5" />
          )}
          <span>Pickups</span>
        </button>

        <button
          className={`flex items-center px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
            mapFilters.showDeliveryPoints
              ? 'bg-primary text-primary-foreground border-transparent'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted border-dashed border-muted-foreground/30'
          }`}
          onClick={() => handleToggleFilter('showDeliveryPoints')}
          title={mapFilters.showDeliveryPoints ? 'Hide delivery points' : 'Show delivery points'}
        >
          {mapFilters.showDeliveryPoints ? (
            <EyeIcon className="h-2.5 w-2.5 mr-0.5" />
          ) : (
            <EyeOffIcon className="h-2.5 w-2.5 mr-0.5" />
          )}
          <span>Deliveries</span>
        </button>

        <button
          className={`flex items-center px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
            mapFilters.showRestrictedAreas
              ? 'bg-primary text-primary-foreground border-transparent'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted border-dashed border-muted-foreground/30'
          }`}
          onClick={() => handleToggleFilter('showRestrictedAreas')}
          title={mapFilters.showRestrictedAreas ? 'Hide restricted areas' : 'Show restricted areas'}
        >
          {mapFilters.showRestrictedAreas ? (
            <EyeIcon className="h-2.5 w-2.5 mr-0.5" />
          ) : (
            <EyeOffIcon className="h-2.5 w-2.5 mr-0.5" />
          )}
          <span className="whitespace-nowrap">Restricted areas</span>
        </button>

        <button
          className={`flex items-center px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
            mapFilters.showAllowedAreas
              ? 'bg-primary text-primary-foreground border-transparent'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted border-dashed border-muted-foreground/30'
          }`}
          onClick={() => handleToggleFilter('showAllowedAreas')}
          title={mapFilters.showAllowedAreas ? 'Hide allowed areas' : 'Show allowed areas'}
        >
          {mapFilters.showAllowedAreas ? (
            <EyeIcon className="h-2.5 w-2.5 mr-0.5" />
          ) : (
            <EyeOffIcon className="h-2.5 w-2.5 mr-0.5" />
          )}
          <span className="whitespace-nowrap">Allowed areas</span>
        </button>
      </div>
    );
  };

  // Render route legend
  const renderRouteLegend = () => {
    if (!optimizationResponse?.routes || optimizationResponse.routes.length === 0) return null;

    return (
      <div className="flex items-center space-x-1">
        {optimizationResponse.routes.map((route: any, index: number) => {
          const routeColor = routeColors[index % routeColors.length];
          // Determine if this is a depot-only route (no deliveries)
          const isDepotOnly =
            !route.stops ||
            route.stops.filter((stop: RoutePoint) => stop.type === 'delivery').length === 0;
          // Check if route is hidden
          const isHidden = hiddenRouteIds.includes(route.id);

          // DEBUG: Log vehicleName before creating shortName
          console.log(`[Legend] Route ID: ${route.id}, Vehicle Name: ${route.vehicleName}`);

          // Extract just the vehicle identifier for briefer display
          // Example: "TRUCK DMM-VEH-001" becomes "DMM-VEH-001"
          const shortName = route.vehicleName?.includes('TRUCK ')
            ? route.vehicleName.replace('TRUCK ', '')
            : route.vehicleName;

          return (
            <div
              key={route.id}
              className={`flex items-center px-1.5 py-0.5 rounded-full cursor-pointer transition-all hover:bg-muted/50 border ${
                isHidden
                  ? 'border-dashed border-muted-foreground/30 bg-muted/20'
                  : 'border-transparent bg-card/60'
              }`}
              onClick={() => toggleRouteVisibility(route.id)}
              title={isHidden ? `Show ${route.vehicleName}` : `Hide ${route.vehicleName}`}
            >
              {isHidden ? (
                <EyeOffIcon className="h-2.5 w-2.5 mr-0.5 text-muted-foreground" />
              ) : (
                <EyeIcon className="h-2.5 w-2.5 mr-0.5 text-primary" />
              )}
              <span
                className={`w-2.5 h-2.5 rounded-full mr-0.5 ${isDepotOnly ? 'border border-solid' : ''}`}
                style={{
                  borderColor: isDepotOnly ? routeColor : 'transparent',
                  backgroundColor: isHidden
                    ? 'transparent'
                    : isDepotOnly
                      ? 'transparent'
                      : routeColor,
                }}
              />
              <span
                className={`text-xs whitespace-nowrap ${isHidden ? 'text-muted-foreground' : ''}`}
              >
                {shortName}
                {isDepotOnly && ' (P)'}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Debug map filter state
  useEffect(() => {
    console.log('Current map filters:', mapFilters);
  }, [mapFilters]);

  // useEffect to debug routes data when routes change
  useEffect(() => {
    if (optimizationResponse?.routes) {
      console.log(`Got ${optimizationResponse.routes.length} routes to render`);
      optimizationResponse.routes.forEach((route: any, idx: number) => {
        console.log(`Route ${idx} (${route.id}):`, {
          vehicleName: route.vehicleName,
          stops: route.stops?.length || 0,
          unserviceableStops: route.unserviceableStops?.length || 0,
          fullyUnserviceable: route.fullyUnserviceable || false,
          hasGeometry: !!route.geometry,
          geometryLength: route.geometry?.length || 0,
        });
      });

      // Log a summary of unserviceable points
      const unserviceablePoints = getUnserviceablePoints();
      if (unserviceablePoints.length > 0) {
        console.log(`Found ${unserviceablePoints.length} unserviceable points`);
      }
    }
  }, [optimizationResponse?.routes, getUnserviceablePoints]);

  // Debug when a route is selected
  useEffect(() => {
    if (selectedRouteId) {
      console.log(`Route ${selectedRouteId} selected`);
    }
  }, [selectedRouteId]);

  // Debug mapRef initialization
  useEffect(() => {
    console.log('Map reference state:', mapRef.current ? 'initialized' : 'not initialized');
  }, [mapRef.current]);

  // Create routes data for all routes to display
  const routesData = useMemo(() => {
    if (!optimizationResponse?.routes) return []; // Simplified check

    // Map over original routes to preserve original index for color mapping
    return optimizationResponse.routes
      .map((route: any, originalIndex: number) => {
        // Skip hidden routes by returning null
        if (hiddenRouteIds.includes(route.id)) return null;

        // If not hidden, process the route
        const isSelected = route.id === selectedRouteId;
        return {
          route,
          originalIndex, // Store the original index
          isSelected,
          geoJson: renderDirectRoute(route, originalIndex, isSelected),
        };
      })
      .filter((item: any): item is NonNullable<typeof item> => item !== null); // Filter out nulls (hidden routes)
  }, [optimizationResponse?.routes, selectedRouteId, mapFilters.showRoutes, hiddenRouteIds]);

  // Function to zoom to selected route
  const focusSelectedRoute = useCallback(() => {
    if (!selectedRouteId || !optimizationResponse) return;

    const selectedRoute = optimizationResponse.routes.find((r: any) => r.id === selectedRouteId);
    if (!selectedRoute || !selectedRoute.stops || selectedRoute.stops.length < 2) return;

    // Calculate bounds for the selected route
    const bounds: {
      sw: { latitude: number; longitude: number };
      ne: { latitude: number; longitude: number };
    } = {
      sw: {
        latitude: Infinity,
        longitude: Infinity,
      },
      ne: {
        latitude: -Infinity,
        longitude: -Infinity,
      },
    };

    // Include all stops in the bounds
    selectedRoute.stops.forEach((stop: any) => {
      const lat = stop.location.latitude;
      const lng = stop.location.longitude;

      bounds.sw.latitude = Math.min(bounds.sw.latitude, lat);
      bounds.sw.longitude = Math.min(bounds.sw.longitude, lng);
      bounds.ne.latitude = Math.max(bounds.ne.latitude, lat);
      bounds.ne.longitude = Math.max(bounds.ne.longitude, lng);
    });

    // Add padding for better visualization
    const padding = { top: 100, bottom: 100, left: 100, right: 100 };

    // Fit map to the bounds
    mapRef.current?.fitBounds(
      [
        [bounds.sw.longitude, bounds.sw.latitude],
        [bounds.ne.longitude, bounds.ne.latitude],
      ],
      { padding, duration: 1000 }
    );
  }, [selectedRouteId, optimizationResponse]);

  // Zoom to selected route when it changes
  useEffect(() => {
    focusSelectedRoute();
  }, [selectedRouteId, focusSelectedRoute]);

  // Add Mapbox GL animation for selected routes
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.getMap) return;

    try {
      const map = mapRef.current.getMap();
      if (!map || !map.isStyleLoaded()) return;

      // Check if the style is loaded before trying to add an image
      if (!map.hasImage('animated-line')) {
        try {
          // Create a 256x8 pixel image with gradient pattern
          const size = 256;
          const height = 8;
          const data = new Uint8Array(size * height * 4);

          for (let x = 0; x < size; x++) {
            const t = x / size;
            // Create a white to transparent gradient pattern
            const c = t < 0.5 ? 255 : 0;
            for (let y = 0; y < height; y++) {
              const offset = (y * size + x) * 4;
              data[offset + 0] = 255; // red
              data[offset + 1] = 255; // green
              data[offset + 2] = 255; // blue
              data[offset + 3] = c; // alpha (transparent or white)
            }
          }

          map.addImage('animated-line', { width: size, height, data }, { pixelRatio: 1 });
        } catch (e) {
          console.error('Failed to add animated-line image', e);
        }
      }

      // Custom animation system with reduced frame rate
      let animationPhase = 0;
      let rafId: number | null = null;
      let lastFrameTime = 0;

      const animate = (timestamp: number) => {
        // Limit animation to 10 frames per second
        if (timestamp - lastFrameTime < 100) {
          rafId = requestAnimationFrame(animate);
          return;
        }

        lastFrameTime = timestamp;

        // Continuously update animation phase
        animationPhase = (animationPhase + 1) % 40;

        // Update specifically only when we have a selected route
        if (selectedRouteId) {
          // Find any layers that might need animation
          const animationLayerId = `route-${selectedRouteId}-animation`;

          if (map.getLayer(animationLayerId)) {
            try {
              map.setPaintProperty(animationLayerId, 'line-dasharray', [4, 4]);

              // Only set these properties if needed to reduce state changes
              if (
                map.getPaintProperty(animationLayerId, 'line-pattern-offset') !== animationPhase
              ) {
                map.setPaintProperty(animationLayerId, 'line-pattern', 'animated-line');

                map.setPaintProperty(animationLayerId, 'line-pattern-offset', animationPhase);
              }
            } catch {
              // Silent catch - layer might not exist yet
            }
          }
        }

        // Continue animation loop
        rafId = requestAnimationFrame(animate);
      };

      // Start animation
      rafId = requestAnimationFrame(animate);

      // Cleanup
      return () => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
      };
    } catch (error) {
      console.error('Error in animation effect:', error);
    }
  }, [selectedRouteId]);

  // Add click and hover handlers for the allowed zones and restricted areas
  const handleAreaHover = (e: any) => {
    if (e.features && e.features.length > 0 && e.lngLat) {
      const feature = e.features[0];
      const props = feature.properties;

      // Determine if it's an allowed zone or restricted area based on the layer ID
      const layerId = feature.layer.id;
      const type = layerId.includes('allowed-zone') ? 'allowed' : 'restricted';

      setHoveredArea({
        id: props.id || 'unknown',
        name: props.name || 'Unnamed Area',
        type,
        coordinates: [e.lngLat.lng, e.lngLat.lat],
        timeRestriction: props.timeRestriction,
      });
    }
  };

  const handleAreaLeave = () => {
    setHoveredArea(null);
  };

  // Function to handle stop selection and show popup info
  const selectStop = (route: any, stop: any, stopIndex: number) => {
    // Set the selected stop
    setSelectedStop({
      route,
      stop,
      stopIndex,
    });

    // Also show the popup for the stop
    setPopupInfo(stop);

    // Clear any hover info
    setHoverInfo(null);
  };

  // Function to handle stop hover
  const handleStopHover = (routeId: string, stopIndex: number, stopName: string) => {
    setHoverInfo({
      id: `${routeId}-stop-${stopIndex}`,
      content: stopName,
    });
  };

  // Function to handle stop hover end
  const handleStopLeave = () => {
    setHoverInfo(null);
  };

  // Add a handler for focusing the map on zones
  const focusMapOnZones = useCallback(() => {
    if (
      !optimizationResponse ||
      (!optimizationResponse.allowedZones?.length && !optimizationResponse.restrictedAreas?.length)
    ) {
      return;
    }

    try {
      // Collect all coordinates from both allowed zones and restricted areas
      const allCoordinates: [number, number][] = [];

      // Add coordinates from allowed zones
      if (optimizationResponse.allowedZones?.length) {
        optimizationResponse.allowedZones.forEach((zone) => {
          if (zone.area && Array.isArray(zone.area)) {
            zone.area.forEach((coord) => {
              allCoordinates.push([coord[1], coord[0]]); // Convert to [lng, lat]
            });
          }
        });
      }

      // Add coordinates from restricted areas
      if (optimizationResponse.restrictedAreas?.length) {
        optimizationResponse.restrictedAreas.forEach((area) => {
          if (area.area && Array.isArray(area.area)) {
            area.area.forEach((coord) => {
              allCoordinates.push([coord[1], coord[0]]); // Convert to [lng, lat]
            });
          }
        });
      }

      // If we have coordinates, calculate the bounds
      if (allCoordinates.length > 0) {
        console.log(`Focusing map on ${allCoordinates.length} zone coordinates`);

        // Calculate bounds
        const bounds = allCoordinates.reduce(
          (bounds: any, coord: any) => {
            bounds.sw.longitude = Math.min(bounds.sw.longitude, coord[0]);
            bounds.sw.latitude = Math.min(bounds.sw.latitude, coord[1]);
            bounds.ne.longitude = Math.max(bounds.ne.longitude, coord[0]);
            bounds.ne.latitude = Math.max(bounds.ne.latitude, coord[1]);
            return bounds;
          },
          {
            sw: { longitude: Infinity, latitude: Infinity },
            ne: { longitude: -Infinity, latitude: -Infinity },
          }
        );

        // Add padding to the bounds
        const paddingFactor = 0.1; // 10% padding
        const lonDelta = bounds.ne.longitude - bounds.sw.longitude;
        const latDelta = bounds.ne.latitude - bounds.sw.latitude;

        const paddedBounds = {
          sw: {
            longitude: bounds.sw.longitude - lonDelta * paddingFactor,
            latitude: bounds.sw.latitude - latDelta * paddingFactor,
          },
          ne: {
            longitude: bounds.ne.longitude + lonDelta * paddingFactor,
            latitude: bounds.ne.latitude + latDelta * paddingFactor,
          },
        };

        console.log('Calculated bounds for zones:', paddedBounds);

        // Fit the map to the bounds
        if (mapRef.current) {
          mapRef.current.fitBounds(
            [
              [paddedBounds.sw.longitude, paddedBounds.sw.latitude],
              [paddedBounds.ne.longitude, paddedBounds.ne.latitude],
            ],
            { padding: 40, duration: 1000 }
          );
        }
      }
    } catch (error) {
      console.error('Error focusing map on zones:', error);
    }
  }, [optimizationResponse]);

  // Monitor for changes to allowed zones and restricted areas
  useEffect(() => {
    const hasZones =
      (optimizationResponse?.allowedZones && optimizationResponse.allowedZones.length > 0) ||
      (optimizationResponse?.restrictedAreas && optimizationResponse.restrictedAreas.length > 0);

    const zonesVisible = mapFilters.showAllowedAreas || mapFilters.showRestrictedAreas;

    if (hasZones && zonesVisible) {
      // Focus the map on the zones after a short delay to ensure they're rendered
      const timeoutId = setTimeout(() => {
        focusMapOnZones();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [
    optimizationResponse?.allowedZones,
    optimizationResponse?.restrictedAreas,
    mapFilters.showAllowedAreas,
    mapFilters.showRestrictedAreas,
    focusMapOnZones,
  ]);

  // When the map is rendering, add debug info for zones
  useEffect(() => {
    // Add debug logging for zones
    console.log('MAP DEBUG - Restricted Areas:', {
      hasRestrictedAreas: Boolean(
        optimizationResponse?.restrictedAreas && optimizationResponse.restrictedAreas.length > 0
      ),
      restrictedAreasCount: optimizationResponse?.restrictedAreas?.length || 0,
      restrictedAreasData: optimizationResponse?.restrictedAreas || [],
      isFilterEnabled: mapFilters.showRestrictedAreas,
    });

    console.log('MAP DEBUG - Allowed Zones:', {
      hasAllowedZones: Boolean(
        optimizationResponse?.allowedZones && optimizationResponse.allowedZones.length > 0
      ),
      allowedZonesCount: optimizationResponse?.allowedZones?.length || 0,
      allowedZonesData: optimizationResponse?.allowedZones || [],
      isFilterEnabled: mapFilters.showAllowedAreas,
    });
  }, [optimizationResponse, selectedRouteId, mapFilters]);

  // Add this debug logging to the map initialization useEffect, before the return statement
  // Add this at the end of the useEffect that initializes the map
  console.log('Map filters state when rendering zones:', {
    showAllowedAreas: mapFilters.showAllowedAreas,
    showRestrictedAreas: mapFilters.showRestrictedAreas,
    allowedZonesAvailable: !!(
      optimizationResponse?.allowedZones && optimizationResponse.allowedZones.length > 0
    ),
    restrictedAreasAvailable: !!(
      optimizationResponse?.restrictedAreas && optimizationResponse.restrictedAreas.length > 0
    ),
  });

  // Add a handler for clicking on areas
  const handleAreaClick = (e: any) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0];
      const props = feature.properties;
      const layerId = feature.layer.id;
      const type = layerId.includes('allowed-zone') ? 'allowed' : 'restricted';

      // Find the corresponding area data from state
      const areas =
        type === 'allowed'
          ? optimizationResponse?.allowedZones || []
          : optimizationResponse?.restrictedAreas || [];

      const areaData = areas.find((area) => area.id === props.id);

      if (areaData) {
        console.log(`Clicked on ${type} area:`, areaData);
        setClickedAreaInfo({
          id: areaData.id,
          name: areaData.name,
          type,
          area: areaData.area,
        });
      }
    }
  };

  // Add function to close the area info modal
  const closeAreaInfo = () => {
    setClickedAreaInfo(null);
  };

  if (!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
    return (
      <div className="flex h-full items-center justify-center bg-muted rounded-lg">
        <p className="text-muted-foreground">
          Please add your Mapbox access token to the .env.local file
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Map Controls - Top of the map */}
      <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10 w-auto">
        <div className="bg-card/40 backdrop-blur-sm rounded-full px-1.5 py-1 shadow-sm">
          {/* Map Controls Label - simplified and integrated with the controls */}
          <div className="flex items-center space-x-1">
            <div className="text-xs flex items-center mr-0.5">
              <EyeIcon className="h-2.5 w-2.5 mr-0.5 text-primary" />
              <span>Toggle:</span>
            </div>

            {renderMapControls()}
          </div>
        </div>
      </div>

      <div className="flex-1 relative w-full h-full">
        <Map
          ref={mapRef}
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
          initialViewState={viewState}
          style={{ width: '100%', height: '100%', borderRadius: '0.25rem' }}
          mapStyle="mapbox://styles/mapbox/streets-v11"
          onClick={(e) => {
            setPopupInfo(null);
            setHoveredArea(null);
            // If a feature is clicked, pass to the handleAreaClick function
            if (e.features && e.features.length > 0) {
              handleAreaClick(e);
            }
          }}
          interactiveLayerIds={[
            // Make both area fill layers interactive for click events
            'allowed-zones-fill',
            'restricted-areas-fill',
            ...(optimizationResponse?.allowedZones?.map((zone) => `allowed-zone-fill-${zone.id}`) ||
              []),
            ...(optimizationResponse?.restrictedAreas?.map(
              (area) => `restricted-area-fill-${area.id}`
            ) || []),
          ]}
          onMouseMove={handleAreaHover}
          onMouseLeave={handleAreaLeave}
          maxZoom={18}
          minZoom={3}
        >
          <NavigationControl position="top-right" />

          {/* Render all routes */}
          {routesData.map(({ route, geoJson, isSelected, originalIndex }) => {
            // Add check: Skip rendering if geoJson is null
            if (!geoJson) {
              console.warn(`Skipping rendering route ${route.id} because geoJson is null.`);
              return null;
            }

            // DEBUG: Log geometry presence for each route
            console.log(
              `Rendering route ${route.id}. Geometry present: ${!!route.geometry}, Length: ${route.geometry?.length || 0}`
            );

            // Use originalIndex for consistent color assignment
            const color = routeColors[originalIndex % routeColors.length];

            // Debug the route's GeoJSON data to see if we have coordinates
            const coordinateCount = geoJson.geometry.coordinates.length;
            console.log(`Rendering route ${route.id} with ${coordinateCount} coordinates`);

            return (
              <Source
                key={`route-${route.id}`}
                type="geojson"
                data={{
                  type: 'Feature',
                  properties: {},
                  geometry: geoJson.geometry,
                }}
              >
                {/* Base route layer */}
                <Layer
                  id={`route-${route.id}`}
                  type="line"
                  layout={{
                    'line-join': 'round',
                    'line-cap': 'round',
                  }}
                  paint={{
                    'line-color': color,
                    'line-width': isSelected ? 6 : 4,
                    'line-opacity': isSelected ? 0.9 : 0.7,
                    'line-dasharray': [1, 0], // Solid line for all routes
                  }}
                />

                {/* Animated white stripes layer for selected routes */}
                {isSelected && (
                  <Layer
                    id={`route-${route.id}-animation`}
                    type="line"
                    layout={{
                      'line-join': 'round',
                      'line-cap': 'round',
                    }}
                    paint={{
                      'line-color': 'white',
                      'line-width': 4,
                      'line-opacity': 0.9,
                      'line-dasharray': [4, 4],
                      'line-pattern': 'animated-line',
                    }}
                  />
                )}
              </Source>
            );
          })}

          {/* Render allowed zones when toggled */}
          {mapFilters.showAllowedAreas &&
            optimizationResponse?.allowedZones &&
            optimizationResponse.allowedZones.length > 0 && (
              <Source
                id="allowed-zones-source"
                type="geojson"
                data={{
                  type: 'FeatureCollection',
                  features: optimizationResponse.allowedZones.map((zone: any) => {
                    console.log('Processing allowed zone:', zone.id, zone.name);
                    console.log('Zone area:', zone.area);

                    // Transform coordinates for Mapbox with enhanced debugging
                    const transformedCoordinates = debugCoordinates(zone.area, 'ALLOWED', zone.id);

                    console.log('Final coordinates for allowed zone:', transformedCoordinates);

                    return {
                      type: 'Feature',
                      properties: {
                        id: zone.id,
                        name: zone.name,
                        type: 'allowed',
                        timeRestriction: zone.timeRestriction,
                      },
                      geometry: {
                        type: 'Polygon',
                        coordinates: [transformedCoordinates],
                      },
                    };
                  }),
                }}
              >
                <Layer
                  id="allowed-zones-fill"
                  type="fill"
                  paint={{
                    'fill-color': '#10b981', // Green color
                    'fill-opacity': 0.3,
                  }}
                />
                <Layer
                  id="allowed-zones-border"
                  type="line"
                  paint={{
                    'line-color': '#10b981',
                    'line-width': 2,
                    'line-opacity': 0.7,
                  }}
                />
              </Source>
            )}

          {/* Render restricted areas when toggled */}
          {mapFilters.showRestrictedAreas &&
            optimizationResponse?.restrictedAreas &&
            optimizationResponse.restrictedAreas.length > 0 && (
              <Source
                id="restricted-areas-source"
                type="geojson"
                data={{
                  type: 'FeatureCollection',
                  features: optimizationResponse.restrictedAreas.map((area: any) => {
                    console.log('Processing restricted area:', area.id, area.name);
                    console.log('Area coordinates:', area.area);

                    // Transform coordinates for Mapbox with enhanced debugging
                    const transformedCoordinates = debugCoordinates(
                      area.area,
                      'RESTRICTED',
                      area.id
                    );

                    console.log('Final coordinates for restricted area:', transformedCoordinates);

                    return {
                      type: 'Feature',
                      properties: {
                        id: area.id,
                        name: area.name,
                        type: 'restricted',
                        timeRestriction: area.timeRestriction,
                      },
                      geometry: {
                        type: 'Polygon',
                        coordinates: [transformedCoordinates],
                      },
                    };
                  }),
                }}
              >
                <Layer
                  id="restricted-areas-fill"
                  type="fill"
                  paint={{
                    'fill-color': '#ff5252',
                    'fill-opacity': 0.3,
                  }}
                />
                <Layer
                  id="restricted-areas-line"
                  type="line"
                  paint={{
                    'line-color': '#ff0000',
                    'line-width': 2,
                    'line-dasharray': [2, 2],
                  }}
                />
              </Source>
            )}

          {/* EMERGENCY FIX: Render manually loaded restricted areas */}
          {mapFilters.showRestrictedAreas && manualRestrictedAreas.length > 0 && (
            <Source
              id="manual-restricted-areas-source"
              type="geojson"
              data={{
                type: 'FeatureCollection',
                features: manualRestrictedAreas.map((area: any) => {
                  console.log('Processing manual restricted area:', area.id, area.name);
                  console.log('Manual area coordinates:', area.area);

                  // Transform coordinates for Mapbox with enhanced debugging
                  const transformedCoordinates = debugCoordinates(
                    area.area,
                    'MANUAL_RESTRICTED',
                    area.id
                  );

                  return {
                    type: 'Feature',
                    properties: {
                      id: area.id,
                      name: area.name,
                      type: 'restricted',
                      timeRestriction: area.timeRestriction,
                      isManual: true,
                    },
                    geometry: {
                      type: 'Polygon',
                      coordinates: [transformedCoordinates],
                    },
                  };
                }),
              }}
            >
              <Layer
                id="manual-restricted-areas-fill"
                type="fill"
                paint={{
                  'fill-color': '#ef4444',
                  'fill-opacity': 0.3,
                }}
              />
              <Layer
                id="manual-restricted-areas-border"
                type="line"
                paint={{
                  'line-color': '#ef4444',
                  'line-width': 3,
                  'line-opacity': 0.8,
                  'line-dasharray': [2, 2],
                }}
              />
            </Source>
          )}

          {/* Render all stops from all routes or just the selected route */}
          {optimizationResponse?.routes.map((route: any, index: number) => {
            // Skip hidden routes
            if (hiddenRouteIds.includes(route.id)) return null;

            // Skip fully unserviceable routes
            if (route.fullyUnserviceable) return null;

            // Get the route color for this route
            const routeColor = routeColors[index % routeColors.length];
            const isSelected = selectedRouteId === route.id;

            return route.stops.map((stop: RoutePoint, stopIndex: number) => {
              // Skip based on filters
              if (stop.type === 'pickup' && !mapFilters.showPickupPoints) return null;
              if (stop.type === 'delivery' && !mapFilters.showDeliveryPoints) return null;
              // Always show vehicle stops
              if (stop.type === 'vehicle') {
                // Vehicle stops are always visible
              }

              // Skip unserviceable stops - they're rendered separately
              if (stop.unserviceable || stop.isInRestrictedArea) return null;

              // FIXED: Show all delivery points regardless of selected route
              // Only filter vehicle/pickup icons for clarity when a route is selected
              const showMarker =
                // Always show vehicle stops
                stop.type === 'vehicle' ||
                // Always show if it's a delivery point
                stop.type === 'delivery' ||
                // Always show first stop (which has the vehicle icon)
                stopIndex === 0 ||
                // Or if this route is selected or no route is selected
                isSelected ||
                !selectedRouteId;

              if (!showMarker) return null;

              // Position
              const lng = stop.location.longitude;
              const lat = stop.location.latitude;

              return (
                <Marker
                  key={`${route.id}-stop-${stopIndex}-${stop.id}`}
                  latitude={lat}
                  longitude={lng}
                  onClick={() => selectStop(route, stop, stopIndex)}
                >
                  <div
                    className="relative"
                    onMouseEnter={() =>
                      handleStopHover(
                        route.id,
                        stopIndex,
                        stop.type === 'delivery'
                          ? stop.customer_name || `Delivery ${stopIndex}`
                          : stop.name || `Stop ${stopIndex}`
                      )
                    }
                    onMouseLeave={handleStopLeave}
                  >
                    {/* Stop marker */}
                    <div
                      className={`
                      h-8 w-8 flex items-center justify-center rounded-full
                      ${
                        stop.type === 'vehicle'
                          ? 'bg-blue-500'
                          : stop.type === 'pickup'
                            ? 'bg-amber-400'
                            : 'bg-white border border-gray-300'
                      }
                      relative
                      ${selectedStop && selectedStop.stop.id === stop.id ? 'ring-2 ring-offset-2 ring-offset-white ring-blue-400' : ''}
                    `}
                    >
                      {/* Stop icon */}
                      {stop.type === 'vehicle' ? (
                        <Truck className="h-4 w-4 text-white" />
                      ) : stop.type === 'pickup' ? (
                        <Package className="h-4 w-4 text-white" />
                      ) : (
                        <span
                          className="h-5 w-5 flex items-center justify-center rounded-full"
                          style={{ backgroundColor: routeColor }}
                        >
                          <span className="text-white text-xs font-medium">{stopIndex}</span>
                        </span>
                      )}
                    </div>

                    {/* Hover info tooltip */}
                    {hoverInfo && hoverInfo.id === `${route.id}-stop-${stopIndex}` && (
                      // Restore original positioning classes
                      <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-white px-2 py-1 rounded shadow-md text-xs whitespace-nowrap pointer-events-none">
                        {stop.name || `Stop ${stopIndex}`}
                      </div>
                    )}
                  </div>
                </Marker>
              );
            });
          })}

          {/* Render unassigned stops */}
          {optimizationResponse?.unassignedStops?.map((stop: any, index: number) => {
            // Skip based on filters
            if (stop.type === 'pickup' && !mapFilters.showPickupPoints) return null;
            if (stop.type === 'delivery' && !mapFilters.showDeliveryPoints) return null;

            // Skip if unserviceable - these are rendered separately
            if (stop.unserviceable || stop.isInRestrictedArea) return null;

            return (
              <Marker
                key={`unassigned-${index}-${stop.id}`}
                latitude={stop.location.latitude}
                longitude={stop.location.longitude}
              >
                <div className="h-8 w-8 flex items-center justify-center bg-red-500 border-2 border-white rounded-full">
                  <BanIcon className="h-4 w-4 text-white" />
                </div>
              </Marker>
            );
          })}

          {popupInfo &&
            // Log the popupInfo object to the console for debugging
            (() => {
              console.log('Popup Info:', popupInfo);
              return null;
            })()}
          {popupInfo && (
            <Popup
              longitude={popupInfo.location.longitude}
              latitude={popupInfo.location.latitude}
              closeButton={true}
              closeOnClick={false}
              onClose={() => setPopupInfo(null)}
              anchor="bottom"
              className="z-50 stop-popup"
            >
              {/* Conditional rendering for different stop types */}
              {popupInfo.type === 'delivery' ? (
                <div className="p-1 max-w-xs">
                  <h3 className="text-sm font-semibold mb-1">
                    {popupInfo.customer_name || popupInfo.name || 'Delivery'}
                  </h3>
                  <p className="text-xs text-muted-foreground">ID: {popupInfo.id}</p>
                  {popupInfo.address && (
                    <p className="text-xs text-muted-foreground">Address: {popupInfo.address}</p>
                  )}
                  {popupInfo.timeWindow && (
                    <p className="text-xs text-muted-foreground">
                      Time Window: {popupInfo.timeWindow.start} - {popupInfo.timeWindow.end}
                    </p>
                  )}
                  {popupInfo.priority && (
                    <p className="text-xs text-muted-foreground">Priority: {popupInfo.priority}</p>
                  )}
                  {/* Add other fields like load if available */}
                </div>
              ) : popupInfo.type === 'pickup' ? (
                <div className="p-1 max-w-xs">
                  <h3 className="text-sm font-semibold mb-1">{popupInfo.name || 'Pickup'}</h3>
                  <p className="text-xs text-muted-foreground">ID: {popupInfo.id}</p>
                  {popupInfo.address && (
                    <p className="text-xs text-muted-foreground">Address: {popupInfo.address}</p>
                  )}
                  {/* Add pickup specific info if needed */}
                </div>
              ) : (
                // Default/Vehicle Start Tooltip
                <div className="p-1 max-w-xs">
                  <h3 className="text-sm font-semibold mb-1">{popupInfo.name || 'Location'}</h3>
                  <p className="text-xs text-muted-foreground">
                    Type: {popupInfo.type || 'Start/End'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Coordinates: {popupInfo.location.latitude.toFixed(4)},{' '}
                    {popupInfo.location.longitude.toFixed(4)}
                  </p>
                </div>
              )}
            </Popup>
          )}

          {/* Popup for hovered areas (corrected to use hoveredArea state) */}
          {hoveredArea && (
            <Popup
              longitude={hoveredArea.coordinates[0]}
              latitude={hoveredArea.coordinates[1]}
              closeButton={false}
              closeOnClick={false}
              className="area-popup"
              anchor="bottom"
            >
              <div className="text-sm font-medium">
                <div className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-1.5"
                    style={{
                      backgroundColor: hoveredArea.type === 'allowed' ? '#10b981' : '#ff5252',
                      opacity: 0.7,
                    }}
                  />
                  <span>{hoveredArea.name}</span>
                </div>
                {hoveredArea.timeRestriction && hoveredArea.type === 'restricted' && (
                  <div className="text-xs text-muted-foreground flex items-center mt-1">
                    <Clock className="w-3 h-3 mr-1" />
                    <span>Restricted time: {hoveredArea.timeRestriction}</span>
                  </div>
                )}
              </div>
            </Popup>
          )}
        </Map>

        {/* Position the route legend in the bottom-center of the map */}
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-white bg-opacity-90 backdrop-blur-sm rounded-lg px-2 py-1.5 shadow-sm">
            {/* Route visibility label - simplified and integrated with controls */}
            <div className="flex items-center">
              <div className="text-xs flex items-center whitespace-nowrap mr-1.5 font-medium">
                <EyeIcon className="h-2.5 w-2.5 mr-0.5 text-primary" />
                <span>Routes:</span>
              </div>

              <div
                className="overflow-x-auto max-w-[calc(min(600px,70vw))]"
                style={{
                  scrollbarWidth: 'thin',
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {renderRouteLegend()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add this modal for inspecting clicked area data */}
      {clickedAreaInfo && (
        <div className="absolute bottom-4 left-4 bg-white p-4 rounded-lg shadow-lg max-w-xs z-50">
          <h3 className="font-bold text-sm mb-2">{clickedAreaInfo.name}</h3>
          <p className="text-xs text-muted-foreground">
            Type: {clickedAreaInfo.type === 'allowed' ? 'Allowed Zone' : 'Restricted Area'}
          </p>
          <p className="text-xs text-muted-foreground mb-2">ID: {clickedAreaInfo.id}</p>
          <details className="text-xs mb-2">
            <summary className="cursor-pointer">View coordinates</summary>
            <pre className="mt-1 p-1 bg-gray-100 rounded text-xs overflow-auto max-h-24">
              {JSON.stringify(clickedAreaInfo.area, null, 2)}
            </pre>
          </details>
          <button
            onClick={closeAreaInfo}
            className="mt-2 px-2 py-1 bg-primary/80 text-white rounded text-xs"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
