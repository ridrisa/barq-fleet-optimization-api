'use client';

import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '@/store/store';
import {
  setSelectedRoute,
  setSelectedPlan,
  setPaginationSettings,
  fetchLatestOptimization,
  OptimizationResponse,
} from '@/store/slices/routesSlice';
import {
  Truck,
  Package,
  Clock,
  BarChart2,
  ChevronDown,
  ChevronRight,
  Calendar,
  FileText,
  Search,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { PaginationControls } from './pagination-controls';
import { OptimizationDetails } from './optimization-details';

// Define a type that matches the expected state shape
interface RoutesState {
  optimizationResponse: OptimizationResponse | null;
  optimizationPlans: OptimizationResponse[];
  selectedRouteId: string | null;
  selectedPlanId: string | null;
  loading: boolean;
  error: string | null;
  pagination: {
    limit: number;
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}

export function RouteList() {
  const dispatch = useDispatch<AppDispatch>();

  // Use a type assertion to ensure TypeScript understands the shape
  const routes = useSelector((state: RootState) => state.routes as RoutesState);

  // Safely destructure with fallbacks
  const optimizationResponse = routes?.optimizationResponse || null;
  const optimizationPlans = routes?.optimizationPlans || [];
  const selectedRouteId = routes?.selectedRouteId || null;
  const selectedPlanId = routes?.selectedPlanId || null;
  const loading = routes?.loading || false;
  const pagination = routes?.pagination || {
    limit: 10,
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    dispatch(setPaginationSettings({ currentPage: page }));
    dispatch(fetchLatestOptimization({ limit: pagination.limit, page }));
  };

  const handleLimitChange = (limit: number) => {
    dispatch(setPaginationSettings({ limit, currentPage: 1 }));
    dispatch(fetchLatestOptimization({ limit, page: 1 }));
  };

  // Add a simple unique ID generator for plans without requestId
  const generateUniqueId = (prefix: string) => {
    return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
  };

  // Keep track of generated IDs for plans without requestId to maintain consistency
  const [planIdMap] = useState<Record<number, string>>({});

  // Track expanded plans for the collapsible UI
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({});

  // Keep track of plans that user explicitly collapsed
  const [userCollapsedPlans, setUserCollapsedPlans] = useState<Record<string, boolean>>({});

  // State for search request ID
  const [searchRequestId, setSearchRequestId] = useState<string>('');

  // Map to store parsed dates for consistent display
  const [planDates] = useState<Record<string, Date>>({});

  // Filter plans based on search
  const [filteredPlans, setFilteredPlans] = useState<OptimizationResponse[]>([]);

  // Update filtered plans when plans or search criteria change
  useEffect(() => {
    // Apply search filter
    const filtered = searchRequestId
      ? optimizationPlans.filter((plan) =>
          plan.requestId.toLowerCase().includes(searchRequestId.toLowerCase())
        )
      : optimizationPlans;

    setFilteredPlans(filtered);
    console.log(`Updated filtered plans: ${filtered.length} plans total`);

    // Auto-expand newly added plans
    if (filtered.length > 0 && optimizationResponse) {
      const latestPlanId = filtered[0].requestId;
      if (latestPlanId === optimizationResponse.requestId && !expandedPlans[latestPlanId]) {
        setExpandedPlans((prev) => ({
          ...prev,
          [latestPlanId]: true,
        }));
      }
    }
  }, [optimizationPlans, searchRequestId, optimizationResponse]);

  // UseEffect to auto-expand the selected plan, but only if user didn't explicitly collapse it
  useEffect(() => {
    if (selectedPlanId && !expandedPlans[selectedPlanId] && !userCollapsedPlans[selectedPlanId]) {
      setExpandedPlans((prev) => ({
        ...prev,
        [selectedPlanId]: true,
      }));
    }
  }, [selectedPlanId, expandedPlans, userCollapsedPlans]);

  // Toggle the expanded state of a plan
  const togglePlanExpanded = (planId: string) => {
    // Use a callback form to ensure we're always working with the latest state
    setExpandedPlans((prev) => {
      const newState = { ...prev };
      newState[planId] = !prev[planId];

      // If we're collapsing and this is the selected plan, mark it as user-collapsed
      if (planId === selectedPlanId && prev[planId] === true) {
        setUserCollapsedPlans((collapsedPlans) => ({
          ...collapsedPlans,
          [planId]: true,
        }));
      }

      // If we're expanding, remove from user-collapsed list
      if (!prev[planId]) {
        setUserCollapsedPlans((collapsedPlans) => {
          const newCollapsedPlans = { ...collapsedPlans };
          delete newCollapsedPlans[planId];
          return newCollapsedPlans;
        });
      }

      return newState;
    });
  };

  // Handle plan selection
  const handlePlanSelect = (planId: string) => {
    // If we're clicking on the same plan that's already selected, and there's a route selected,
    // we should clear the selected route to show all routes
    if (selectedPlanId === planId && selectedRouteId) {
      dispatch(setSelectedRoute(null));
    }

    dispatch(setSelectedPlan(planId));

    // Also expand the plan when selected to show routes, but only if not user-collapsed
    if (!expandedPlans[planId] && !userCollapsedPlans[planId]) {
      setExpandedPlans((prev) => ({
        ...prev,
        [planId]: true,
      }));
    }
  };

  // Render fleet information for a plan
  const _renderFleetInfo = (plan: OptimizationResponse) => {
    if (!plan.routes || plan.routes.length === 0) return null;

    // Count vehicles by type
    const vehicleCounts: Record<string, number> = {};

    plan.routes.forEach((route) => {
      if (route.vehicleName) {
        // Extract vehicle type from the name (assuming format like "RED TRUCK")
        const vehicleType = route.vehicleName.split(' ').slice(1).join(' ');
        vehicleCounts[vehicleType] = (vehicleCounts[vehicleType] || 0) + 1;
      } else {
        vehicleCounts['Unknown'] = (vehicleCounts['Unknown'] || 0) + 1;
      }
    });

    return (
      <div className="mb-2 px-1">
        <h4 className="text-xs font-medium mb-1 text-muted-foreground">Fleet</h4>
        <div className="flex flex-wrap gap-1">
          {Object.entries(vehicleCounts).map(([type, count], index) => (
            <div
              key={`fleet-type-${plan.id}-${type}-${index}`}
              className="flex items-center bg-primary/5 rounded-full px-1.5 py-0.5 text-[10px]"
            >
              <Truck className="h-2.5 w-2.5 mr-0.5 text-primary" />
              <span>
                {count}x {type}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Fix the route selection handler
  const handleRouteSelect = (routeId: string) => {
    dispatch(setSelectedRoute(routeId));
  };

  // Display empty state if no plans
  if (optimizationPlans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No routes available</p>
        <p className="text-sm text-muted-foreground mt-2">
          Create a new optimization request to see routes here
        </p>
      </div>
    );
  }

  // Render plan metrics
  const renderPlanMetrics = (plan: OptimizationResponse) => {
    const _metrics = plan.metrics;

    // Calculate total deliveries if not already available
    const totalDeliveries = plan.routes.reduce((sum, route) => {
      const deliveryCount = route.stops?.filter((stop) => stop.type === 'delivery').length || 0;
      return sum + deliveryCount;
    }, 0);

    return (
      <div className="grid grid-cols-2 gap-1 mt-1">
        <div className="bg-primary/10 rounded-md p-1">
          <div className="flex items-center justify-center mb-0.5">
            <Truck className="h-2.5 w-2.5 mr-0.5" />
            <span className="text-[10px] font-medium">Vehicles</span>
          </div>
          <p className="text-xs font-semibold text-center">{plan.routes.length}</p>
        </div>
        <div className="bg-primary/10 rounded-md p-1">
          <div className="flex items-center justify-center mb-0.5">
            <Clock className="h-2.5 w-2.5 mr-0.5" />
            <span className="text-[10px] font-medium">Duration</span>
          </div>
          <p className="text-xs font-semibold text-center">
            {formatDuration(plan.routes.reduce((sum, route) => sum + (route.duration || 0), 0))}
          </p>
        </div>
        <div className="bg-primary/10 rounded-md p-1">
          <div className="flex items-center justify-center mb-0.5">
            <BarChart2 className="h-2.5 w-2.5 mr-0.5" />
            <span className="text-[10px] font-medium">Distance</span>
          </div>
          <p className="text-xs font-semibold text-center">
            {formatDistance(plan.routes.reduce((sum, route) => sum + (route.distance || 0), 0))}
          </p>
        </div>
        <div className="bg-primary/10 rounded-md p-1">
          <div className="flex items-center justify-center mb-0.5">
            <Package className="h-2.5 w-2.5 mr-0.5" />
            <span className="text-[10px] font-medium">Deliveries</span>
          </div>
          <p className="text-xs font-semibold text-center">{totalDeliveries}</p>
        </div>
      </div>
    );
  };

  const _renderRoutesList = (plan: OptimizationResponse) => {
    if (!plan.routes || plan.routes.length === 0) {
      return null;
    }

    // Only show routes list if the plan is selected/expanded
    const planId = plan.requestId || '';
    const isExpanded = !!expandedPlans[planId];

    if (!isExpanded) {
      return null;
    }

    return (
      <div className="pb-1 pl-2 pr-1">
        {/* Fleet section with reduced margin */}
        <div className="mb-1 px-1">
          <h4 className="text-xs font-medium mb-1 text-muted-foreground">Fleet</h4>
          <div className="flex flex-wrap gap-1">
            {plan.routes.map((route) => {
              if (!route.vehicleName) return null;

              // Extract vehicle type from the name (assuming format like "RED TRUCK")
              const _vehicleType = route.vehicleName.includes(' ')
                ? route.vehicleName.split(' ').slice(1).join(' ')
                : route.vehicleName;

              return (
                <div
                  key={`fleet-${plan.id}-${route.id}`}
                  className="flex items-center bg-primary/5 rounded-full px-1.5 py-0.5 text-[10px]"
                >
                  <Truck className="h-2.5 w-2.5 mr-0.5 text-primary" />
                  <span>{route.vehicleName}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vehicle routes with improved nesting */}
        <div>
          <h4 className="text-xs font-medium mb-1.5 text-muted-foreground pl-1">
            Routes ({plan.routes.length})
          </h4>
          <div className="space-y-0">
            {plan.routes.map((route, index) => {
              if (!route || !route.id) {
                return null;
              }

              const isRouteSelected = selectedRouteId === route.id;
              // Check if route has deliveries or is depot-only
              const hasDeliveries =
                route.stops && route.stops.filter((stop) => stop.type === 'delivery').length > 0;
              const deliveryCount = hasDeliveries
                ? route.stops?.filter((s) => s.type === 'delivery').length || 0
                : 0;
              const routeStatus = hasDeliveries ? 'Active' : 'Idle';
              const statusColor = hasDeliveries ? 'bg-green-500' : 'bg-amber-500';

              return (
                <div key={`route-${plan.id || index}-${route.id}-${index}`} className="mb-1">
                  <div
                    className={`pl-3 pr-2 py-1.5 cursor-pointer transition-colors border border-l-2 rounded-md ${
                      isRouteSelected
                        ? 'bg-primary/10 border-primary border-l-primary'
                        : 'hover:bg-muted/50 border-muted/30 border-l-muted-foreground/20'
                    }`}
                    onClick={() => handleRouteSelect(route.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-1.5">
                        <Truck className="h-4 w-4 text-primary flex-shrink-0" />
                        <div>
                          <div className="text-sm flex items-center">
                            {route.vehicleName || `Vehicle ${route.id.substring(0, 8)}`}
                            <span
                              className={`ml-1.5 px-1.5 py-0.5 text-[10px] text-white rounded-full ${statusColor}`}
                            >
                              {routeStatus}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Route #{index + 1} • {route.pickupId || 'Unknown Pickup'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-xs mt-1.5">
                      <div className="bg-primary/5 rounded-md p-1">
                        <div className="flex items-center justify-center mb-0.5">
                          <Package className="h-2.5 w-2.5 mr-0.5" />
                          <span className="text-[10px] font-medium">Deliveries</span>
                        </div>
                        <p className="text-xs font-semibold text-center">{deliveryCount}</p>
                      </div>
                      <div className="bg-primary/5 rounded-md p-1">
                        <div className="flex items-center justify-center mb-0.5">
                          <Clock className="h-2.5 w-2.5 mr-0.5" />
                          <span className="text-[10px] font-medium">Duration</span>
                        </div>
                        <p className="text-xs font-semibold text-center">
                          {formatDuration(route.duration || 0)}
                        </p>
                      </div>
                      <div className="bg-primary/5 rounded-md p-1">
                        <div className="flex items-center justify-center mb-0.5">
                          <BarChart2 className="h-2.5 w-2.5 mr-0.5" />
                          <span className="text-[10px] font-medium">Distance</span>
                        </div>
                        <p className="text-xs font-semibold text-center">
                          {formatDistance(route.distance || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Helper function to format date
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Invalid Date';
    try {
      // Use a cached date object if available
      const planId =
        planIdMap[optimizationPlans.findIndex((p) => p.createdAt === dateString)] || dateString;
      if (!planDates[planId]) {
        planDates[planId] = new Date(dateString);
      }
      const date = planDates[planId];
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      });
    } catch {
      return 'Invalid Date';
    }
  };

  // Helper function to format time
  const formatTime = (dateString: string | undefined) => {
    if (!dateString) return '';
    try {
      const planId =
        planIdMap[optimizationPlans.findIndex((p) => p.createdAt === dateString)] || dateString;
      if (!planDates[planId]) {
        planDates[planId] = new Date(dateString);
      }
      const date = planDates[planId];
      return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  // Format duration (total minutes) into "Xh Ym"
  const formatDuration = (minutes: number | undefined): string => {
    if (minutes === undefined || minutes === null || isNaN(minutes)) {
      return '0m';
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);

    if (hours > 0 && remainingMinutes > 0) {
      return `${hours}h ${remainingMinutes}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${remainingMinutes}m`;
    }
  };

  // Format distance (kilometers)
  const formatDistance = (km: number | undefined): string => {
    if (km === undefined || km === null || isNaN(km)) {
      return '0.0 km';
    }
    return `${km.toFixed(1)} km`;
  };

  return (
    <div className="flex flex-col h-full flex-grow overflow-y-auto">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold mb-2">Optimization Plans</h2>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by request ID..."
            value={searchRequestId}
            onChange={(e) => setSearchRequestId(e.target.value)}
            className="w-full pl-8 pr-2 py-1.5 bg-white/90 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Plan list area */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredPlans.map((plan, index) => {
          // Ensure each plan has a unique, stable ID for UI state
          if (!plan.requestId) {
            if (!planIdMap[index]) {
              planIdMap[index] = generateUniqueId(`plan-${index}`);
            }
            plan.requestId = planIdMap[index];
          }

          const planId = plan.requestId;
          const isSelected = selectedPlanId === planId;
          const isExpanded = !!expandedPlans[planId];

          // Use a more reliable date check
          const planDateStr = formatDate(plan.createdAt);
          const planTimeStr = formatTime(plan.createdAt);

          return (
            // Add mb-2 for vertical spacing between plan cards
            <div
              key={planId}
              className={`border rounded-lg overflow-hidden shadow-sm mb-2 ${isSelected ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
            >
              {/* Plan Header */}
              <div
                className={`flex items-center justify-between p-2 cursor-pointer ${isSelected ? 'bg-primary/10' : 'bg-card hover:bg-muted/50'}`}
                onClick={() => handlePlanSelect(planId)}
              >
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {plan.name || `Plan ${planId.substring(0, 6)}`}
                    </p>
                    <div className="flex items-center text-xs text-muted-foreground mt-0.5">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span>{planDateStr}</span>
                      <span className="mx-1">•</span>
                      <span>{planTimeStr}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlanExpanded(planId);
                  }}
                  className="p-1 rounded-full hover:bg-muted"
                  aria-label={isExpanded ? 'Collapse plan details' : 'Expand plan details'}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Expanded Plan Details */}
              {isExpanded && (
                <div className="p-2 border-t border-border bg-card">
                  {renderPlanMetrics(plan)}

                  {/* Optimization Engine Details */}
                  {(plan.optimizationEngine || plan.optimizationMetadata || plan.engineDecision) && (
                    <div className="mt-2">
                      <OptimizationDetails
                        engine={plan.optimizationEngine}
                        metadata={plan.optimizationMetadata}
                        engineDecision={plan.engineDecision}
                        aiInsights={plan.aiInsights}
                        summary={{
                          total_distance: plan.routes.reduce((sum, r) => sum + (r.distance || 0), 0),
                          total_duration: plan.routes.reduce((sum, r) => sum + (r.duration || 0), 0),
                          total_routes: plan.routes.length,
                        }}
                      />
                    </div>
                  )}

                  {/* Routes list section */}
                  {plan.routes && plan.routes.length > 0 && (
                    <div className="mt-2">
                      <h4 className="text-xs font-semibold mb-1 px-1 text-muted-foreground">
                        Routes ({plan.routes.length})
                      </h4>
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {plan.routes.map((route) => {
                          const isRouteSelected = selectedRouteId === route.id;

                          // Determine status based on deliveries/duration
                          const hasDeliveries = route.stops?.some((s) => s.type === 'delivery');
                          const isActive = hasDeliveries && (route.duration || 0) > 0;

                          return (
                            <div
                              key={route.id}
                              className={`flex justify-between items-center py-1.5 pr-1.5 pl-2 rounded-md cursor-pointer border-l-2 ${
                                isRouteSelected
                                  ? 'bg-primary/20 border-l-primary'
                                  : 'hover:bg-muted/50 border-l-transparent'
                              }`}
                              onClick={() => handleRouteSelect(route.id)}
                            >
                              <div className="flex items-center space-x-1.5">
                                <Truck
                                  className={`h-3.5 w-3.5 ${isRouteSelected ? 'text-primary' : 'text-muted-foreground'}`}
                                />
                                <div>
                                  <p className="text-xs font-medium leading-tight">
                                    {route.vehicleName || route.id}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground leading-tight">
                                    {route.name || 'Route details'}
                                  </p>
                                  <div className="flex items-center space-x-1.5 mt-0.5 text-[10px] text-muted-foreground">
                                    {hasDeliveries && (
                                      <>
                                        <span>
                                          <Package className="h-2.5 w-2.5 inline-block mr-0.5" />
                                          {route.stops?.filter((s) => s.type === 'delivery')
                                            .length || 0}
                                        </span>
                                        <span>•</span>
                                      </>
                                    )}
                                    <span>
                                      <Clock className="h-2.5 w-2.5 inline-block mr-0.5" />
                                      {formatDuration(route.duration)}
                                    </span>
                                    <span>•</span>
                                    <span>
                                      <BarChart2 className="h-2.5 w-2.5 inline-block mr-0.5" />
                                      {formatDistance(route.distance)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {/* Status Tag */}
                              <span
                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                  isActive
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {isActive ? 'Active' : 'Idle'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add more details here if needed */}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination controls */}
      {optimizationPlans.length > 0 && (
        <PaginationControls
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          limit={pagination.limit}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
          loading={loading}
        />
      )}
    </div>
  );
}
