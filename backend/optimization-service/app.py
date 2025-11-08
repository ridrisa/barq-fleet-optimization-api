"""
Python OR-Tools CVRP Optimization Service
Flask microservice for capacitated vehicle routing optimization
Based on Google OR-Tools CVRP solver

Author: BARQ Fleet Management Team
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
import pandas as pd
import numpy as np
import logging
from datetime import datetime
import os

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class CVRPOptimizer:
    """
    Capacitated Vehicle Routing Problem Optimizer
    Implements fair workload distribution and capacity constraints
    """

    def __init__(self):
        self.solution_cache = {}
        logger.info("CVRP Optimizer initialized")

    def optimize(self, distance_matrix, demands, vehicle_capacities, num_vehicles, depot=0, time_limit=5, time_windows=None, service_times=None):
        """
        Solve CVRP problem using Google OR-Tools with optional time windows

        Args:
            distance_matrix: 2D array of distances between locations
            demands: Array of demand at each location (parcels/weight)
            vehicle_capacities: Array of vehicle capacities
            num_vehicles: Number of vehicles
            depot: Index of depot location (default: 0)
            time_limit: Maximum solve time in seconds
            time_windows: Optional list of (earliest, latest) time tuples for each location in minutes
            service_times: Optional list of service time at each location in minutes

        Returns:
            dict: Optimized routes with metrics
        """
        try:
            logger.info(f"Starting CVRP optimization: {len(distance_matrix)-1} locations, {num_vehicles} vehicles")

            # Prepare data
            data = {
                'distance_matrix': distance_matrix,
                'demands': demands,
                'vehicle_capacities': vehicle_capacities,
                'num_vehicles': num_vehicles,
                'depot': depot
            }

            # Create the routing index manager
            manager = pywrapcp.RoutingIndexManager(
                len(data['distance_matrix']),
                data['num_vehicles'],
                data['depot']
            )

            # Create Routing Model
            routing = pywrapcp.RoutingModel(manager)

            # Create distance callback
            def distance_callback(from_index, to_index):
                """Returns the distance between the two nodes."""
                from_node = manager.IndexToNode(from_index)
                to_node = manager.IndexToNode(to_index)
                return int(data['distance_matrix'][from_node][to_node])

            transit_callback_index = routing.RegisterTransitCallback(distance_callback)
            routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

            # Add Capacity constraint
            def demand_callback(from_index):
                """Returns the demand of the node."""
                from_node = manager.IndexToNode(from_index)
                return data['demands'][from_node]

            demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
            routing.AddDimensionWithVehicleCapacity(
                demand_callback_index,
                0,  # null capacity slack
                data['vehicle_capacities'],  # vehicle maximum capacities
                True,  # start cumul to zero
                'Capacity'
            )

            # Add Time Window constraints (if provided)
            if time_windows is not None:
                logger.info("Adding time window constraints")

                # Convert distance matrix to time matrix (assuming average speed)
                # Average speed: 40 km/h in urban areas = 0.667 km/min
                # Distance in meters, so meters/min = 40000/60 = 667 m/min
                speed_m_per_min = 667
                time_matrix = [[int(dist / speed_m_per_min) for dist in row] for row in distance_matrix]

                # Add service times if provided
                if service_times is None:
                    service_times = [0] * len(distance_matrix)

                def time_callback(from_index, to_index):
                    """Returns the travel time + service time."""
                    from_node = manager.IndexToNode(from_index)
                    to_node = manager.IndexToNode(to_index)
                    return time_matrix[from_node][to_node] + service_times[from_node]

                time_callback_index = routing.RegisterTransitCallback(time_callback)

                # Create time dimension
                horizon = 480  # 8 hours in minutes (maximum route duration)
                routing.AddDimension(
                    time_callback_index,
                    30,  # allow 30 minutes of waiting time
                    horizon,  # maximum time per vehicle
                    False,  # Don't force start cumul to zero
                    'Time'
                )

                time_dimension = routing.GetDimensionOrDie('Time')

                # Add time window constraints for each location
                for location_idx, time_window in enumerate(time_windows):
                    if location_idx == depot:
                        continue  # Skip depot

                    index = manager.NodeToIndex(location_idx)
                    earliest, latest = time_window
                    time_dimension.CumulVar(index).SetRange(int(earliest), int(latest))

                logger.info(f"Time windows added for {len(time_windows)} locations")

            # Set search parameters
            search_parameters = pywrapcp.DefaultRoutingSearchParameters()
            search_parameters.first_solution_strategy = (
                routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
            )
            search_parameters.local_search_metaheuristic = (
                routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
            )
            search_parameters.time_limit.FromSeconds(time_limit)

            # Solve the problem
            solution = routing.SolveWithParameters(search_parameters)

            if solution:
                has_time_dimension = time_windows is not None
                return self._extract_solution(data, manager, routing, solution, has_time_dimension)
            else:
                logger.error("No solution found")
                return {'success': False, 'error': 'No solution found'}

        except Exception as e:
            logger.error(f"CVRP optimization error: {str(e)}")
            return {'success': False, 'error': str(e)}

    def _extract_solution(self, data, manager, routing, solution, has_time_dimension=False):
        """Extract solution from OR-Tools solver"""
        routes = []
        total_distance = 0
        total_load = 0
        total_time = 0

        # Get time dimension if it exists
        time_dimension = None
        if has_time_dimension:
            time_dimension = routing.GetDimensionOrDie('Time')

        for vehicle_id in range(data['num_vehicles']):
            index = routing.Start(vehicle_id)
            route_distance = 0
            route_load = 0
            route_time = 0
            route_stops = []

            while not routing.IsEnd(index):
                node_index = manager.IndexToNode(index)
                route_load += data['demands'][node_index]

                stop_data = {
                    'location_index': node_index,
                    'cumulative_load': route_load,
                    'demand': data['demands'][node_index]
                }

                # Add time information if available
                if time_dimension:
                    time_var = time_dimension.CumulVar(index)
                    stop_data['arrival_time'] = solution.Min(time_var)
                    stop_data['departure_time'] = solution.Max(time_var)

                route_stops.append(stop_data)

                previous_index = index
                index = solution.Value(routing.NextVar(index))
                route_distance += routing.GetArcCostForVehicle(
                    previous_index, index, vehicle_id
                )

            # Add final depot return
            final_stop = {
                'location_index': manager.IndexToNode(index),
                'cumulative_load': route_load,
                'demand': 0
            }

            if time_dimension:
                time_var = time_dimension.CumulVar(index)
                final_stop['arrival_time'] = solution.Min(time_var)
                route_time = solution.Min(time_var)

            route_stops.append(final_stop)

            route_data = {
                'vehicle_id': vehicle_id,
                'stops': route_stops,
                'total_distance': route_distance,
                'total_load': route_load,
                'capacity_utilization': (route_load / data['vehicle_capacities'][vehicle_id]) * 100
            }

            if time_dimension:
                route_data['total_time'] = route_time
                total_time += route_time

            routes.append(route_data)

            total_distance += route_distance
            total_load += route_load

        summary = {
            'total_distance': total_distance,
            'total_load': total_load,
            'total_demand': sum(data['demands']),
            'num_vehicles_used': len([r for r in routes if len(r['stops']) > 2]),
            'average_route_distance': total_distance / data['num_vehicles'],
            'average_load_per_vehicle': total_load / data['num_vehicles']
        }

        if time_dimension:
            summary['total_time'] = total_time
            summary['average_route_time'] = total_time / data['num_vehicles']

        return {
            'success': True,
            'routes': routes,
            'summary': summary,
            'optimization_metadata': {
                'algorithm': 'OR-Tools CVRP',
                'strategy': 'PATH_CHEAPEST_ARC + GUIDED_LOCAL_SEARCH',
                'time_windows_enabled': has_time_dimension,
                'timestamp': datetime.now().isoformat()
            }
        }


# Initialize optimizer
optimizer = CVRPOptimizer()


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'OR-Tools CVRP Optimizer',
        'timestamp': datetime.now().isoformat()
    })


@app.route('/api/optimize/cvrp', methods=['POST'])
def optimize_cvrp():
    """
    CVRP optimization endpoint

    Request body:
    {
        "distance_matrix": [[0, 100, 200], [100, 0, 150], [200, 150, 0]],
        "demands": [0, 5, 10],
        "vehicle_capacities": [15, 15],
        "num_vehicles": 2,
        "depot": 0,
        "time_limit": 5
    }
    """
    try:
        data = request.json

        # Validate required fields
        required_fields = ['distance_matrix', 'demands', 'vehicle_capacities', 'num_vehicles']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400

        # Extract parameters
        distance_matrix = data['distance_matrix']
        demands = data['demands']
        vehicle_capacities = data['vehicle_capacities']
        num_vehicles = data['num_vehicles']
        depot = data.get('depot', 0)
        time_limit = data.get('time_limit', 5)

        # Validate inputs
        if len(distance_matrix) != len(demands):
            return jsonify({
                'success': False,
                'error': 'Distance matrix and demands must have same length'
            }), 400

        if len(vehicle_capacities) != num_vehicles:
            return jsonify({
                'success': False,
                'error': 'Vehicle capacities must match number of vehicles'
            }), 400

        # Optimize
        result = optimizer.optimize(
            distance_matrix=distance_matrix,
            demands=demands,
            vehicle_capacities=vehicle_capacities,
            num_vehicles=num_vehicles,
            depot=depot,
            time_limit=time_limit
        )

        if result.get('success'):
            return jsonify(result), 200
        else:
            return jsonify(result), 500

    except Exception as e:
        logger.error(f"API error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/optimize/batch', methods=['POST'])
def optimize_batch():
    """
    Batch optimization with location coordinates
    Automatically generates distance matrix using Haversine formula

    Request body:
    {
        "depot": {"lat": 24.7136, "lng": 46.6753},
        "locations": [
            {
                "id": "loc1",
                "lat": 24.7236,
                "lng": 46.6853,
                "demand": 5,
                "time_window": {"earliest": 60, "latest": 180},  # minutes from start
                "service_time": 8  # minutes to complete service
            }
        ],
        "vehicles": [
            {"id": "v1", "capacity": 15},
            {"id": "v2", "capacity": 15}
        ],
        "time_limit": 5
    }
    """
    try:
        data = request.json

        # Extract data
        depot = data['depot']
        locations = data['locations']
        vehicles = data['vehicles']
        time_limit = data.get('time_limit', 5)

        # Build distance matrix using Haversine
        all_points = [depot] + locations
        distance_matrix = []

        for i, point1 in enumerate(all_points):
            row = []
            for j, point2 in enumerate(all_points):
                if i == j:
                    row.append(0)
                else:
                    distance = calculate_haversine_distance(
                        point1['lat'], point1['lng'],
                        point2['lat'], point2['lng']
                    )
                    row.append(int(distance))  # Convert to meters
            distance_matrix.append(row)

        # Build demands (depot has 0 demand)
        demands = [0] + [loc['demand'] for loc in locations]

        # Build vehicle capacities
        vehicle_capacities = [v['capacity'] for v in vehicles]

        # Build time windows if provided (depot has no constraint)
        time_windows = None
        service_times = None

        if any('time_window' in loc for loc in locations):
            # Depot has wide time window (0 to 480 minutes = 8 hours)
            time_windows = [(0, 480)]
            service_times = [0]  # No service time at depot

            for loc in locations:
                if 'time_window' in loc:
                    tw = loc['time_window']
                    time_windows.append((tw['earliest'], tw['latest']))
                else:
                    # Default: anytime within 8 hours
                    time_windows.append((0, 480))

                service_times.append(loc.get('service_time', 8))  # Default 8 minutes

            logger.info(f"Time windows configured for {len(time_windows)} locations")

        # Optimize
        result = optimizer.optimize(
            distance_matrix=distance_matrix,
            demands=demands,
            vehicle_capacities=vehicle_capacities,
            num_vehicles=len(vehicles),
            depot=0,
            time_limit=time_limit,
            time_windows=time_windows,
            service_times=service_times
        )

        if result.get('success'):
            # Enrich with location data
            for route in result['routes']:
                for stop in route['stops']:
                    idx = stop['location_index']
                    if idx == 0:
                        stop['location'] = depot
                        stop['name'] = 'Depot'
                    else:
                        stop['location'] = {
                            'lat': locations[idx-1]['lat'],
                            'lng': locations[idx-1]['lng']
                        }
                        stop['name'] = locations[idx-1].get('id', f'Location {idx}')
                        stop['location_id'] = locations[idx-1].get('id')

            return jsonify(result), 200
        else:
            return jsonify(result), 500

    except Exception as e:
        logger.error(f"Batch optimization error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


def calculate_haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points using Haversine formula"""
    R = 6371000  # Earth radius in meters

    lat1_rad = np.radians(lat1)
    lat2_rad = np.radians(lat2)
    delta_lat = np.radians(lat2 - lat1)
    delta_lon = np.radians(lon2 - lon1)

    a = np.sin(delta_lat/2)**2 + np.cos(lat1_rad) * np.cos(lat2_rad) * np.sin(delta_lon/2)**2
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1-a))

    return R * c


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
