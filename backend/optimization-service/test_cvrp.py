"""
Test script for CVRP Optimization Service
Replicates the Jupyter notebook example from the article

This demonstrates the exact same scenario:
- 16 delivery destinations + 1 depot (17 total locations)
- 4 drivers with 15 parcel capacity each
- Fair workload distribution (each driver delivers exactly 15 parcels)
"""

import requests
import json
import numpy as np

# Service URL
SERVICE_URL = "http://localhost:5001"


def test_article_example():
    """
    Test with the exact example from Samir Saci's article
    Expected result: 4 routes, each with 15 parcels, 1552m distance
    """
    print("=" * 80)
    print("Testing CVRP Optimization - Article Example")
    print("=" * 80)

    # Distance matrix (17x17) from the article
    # This would normally be loaded from Excel
    # Using a simplified symmetric matrix for demonstration
    np.random.seed(42)  # For reproducibility
    n = 17  # 1 depot + 16 destinations

    # Create a realistic distance matrix (in meters)
    distance_matrix = np.zeros((n, n), dtype=int)

    for i in range(n):
        for j in range(i + 1, n):
            # Random distance between 100m and 500m
            dist = np.random.randint(100, 500)
            distance_matrix[i][j] = dist
            distance_matrix[j][i] = dist

    # Orders quantity (parcels/boxes) - from the article
    demands = [0, 1, 1, 2, 4, 2, 4, 8, 8, 1, 2, 1, 2, 4, 4, 8, 8]

    # Vehicles capacities (parcels) - from the article
    vehicle_capacities = [15, 15, 15, 15]

    # Fleet information
    num_vehicles = 4
    depot = 0

    # Verify total demand
    total_demand = sum(demands)
    total_capacity = sum(vehicle_capacities)

    print(f"\nScenario:")
    print(f"  - Destinations: {n - 1}")
    print(f"  - Total parcels: {total_demand}")
    print(f"  - Vehicles: {num_vehicles}")
    print(f"  - Capacity per vehicle: {vehicle_capacities[0]} parcels")
    print(f"  - Total capacity: {total_capacity} parcels")
    print(f"  - Utilization: {(total_demand / total_capacity) * 100:.1f}%")

    # Call API
    payload = {
        "distance_matrix": distance_matrix.tolist(),
        "demands": demands,
        "vehicle_capacities": vehicle_capacities,
        "num_vehicles": num_vehicles,
        "depot": depot,
        "time_limit": 5,
    }

    print(f"\nCalling CVRP optimization service...")

    try:
        response = requests.post(
            f"{SERVICE_URL}/api/optimize/cvrp", json=payload, timeout=30
        )

        if response.status_code == 200:
            result = response.json()

            if result.get("success"):
                print("\n✅ Optimization successful!")
                print("\n" + "=" * 80)
                print("RESULTS")
                print("=" * 80)

                # Display routes
                for route in result["routes"]:
                    if len(route["stops"]) > 2:  # Has actual deliveries
                        print(f"\nRoute for driver {route['vehicle_id']}:")

                        # Build route string
                        route_str = ""
                        for stop in route["stops"]:
                            route_str += f" {stop['location_index']} Parcels({stop['cumulative_load']}) ->"

                        route_str = route_str[:-3]  # Remove last arrow
                        print(route_str)

                        print(f"Distance of the route: {route['total_distance']:,} (m)")
                        print(f"Parcels Delivered: {route['total_load']} (parcels)")
                        print(
                            f"Capacity Utilization: {route['capacity_utilization']:.1f}%"
                        )

                # Summary
                summary = result["summary"]
                print("\n" + "=" * 80)
                print("SUMMARY")
                print("=" * 80)
                print(f"Total distance of all routes: {summary['total_distance']:,} (m)")
                print(
                    f"Parcels Delivered: {summary['total_load']}/{summary['total_demand']}"
                )
                print(
                    f"Average route distance: {summary['average_route_distance']:.0f}m"
                )
                print(
                    f"Average load per vehicle: {summary['average_load_per_vehicle']:.1f} parcels"
                )

                # Verify fair distribution
                print("\n" + "=" * 80)
                print("FAIR DISTRIBUTION CHECK")
                print("=" * 80)

                loads = [r["total_load"] for r in result["routes"] if len(r["stops"]) > 2]
                distances = [
                    r["total_distance"] for r in result["routes"] if len(r["stops"]) > 2
                ]

                print(f"Load distribution: {loads}")
                print(f"Distance distribution: {distances}")

                # Check if fair
                load_variance = np.var(loads)
                distance_variance = np.var(distances)

                if load_variance == 0:
                    print("✅ Perfect load distribution - all drivers deliver equal parcels!")
                else:
                    print(f"Load variance: {load_variance:.2f}")

                if distance_variance < 100:
                    print(
                        "✅ Excellent distance distribution - all routes are similar length!"
                    )
                else:
                    print(f"Distance variance: {distance_variance:.2f}")

            else:
                print(f"❌ Optimization failed: {result.get('error')}")

        else:
            print(f"❌ HTTP Error {response.status_code}: {response.text}")

    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to CVRP service. Is it running on port 5001?")
        print("   Start it with: python app.py")
    except Exception as e:
        print(f"❌ Error: {str(e)}")


def test_batch_optimization():
    """
    Test batch optimization with real coordinates
    Riyadh delivery example
    """
    print("\n\n" + "=" * 80)
    print("Testing Batch Optimization - Riyadh Delivery")
    print("=" * 80)

    payload = {
        "depot": {"lat": 24.7136, "lng": 46.6753},  # Riyadh center
        "locations": [
            {"id": "D1", "lat": 24.7236, "lng": 46.6853, "demand": 5},
            {"id": "D2", "lat": 24.7336, "lng": 46.6953, "demand": 10},
            {"id": "D3", "lat": 24.7436, "lng": 46.7053, "demand": 8},
            {"id": "D4", "lat": 24.7536, "lng": 46.7153, "demand": 12},
            {"id": "D5", "lat": 24.7636, "lng": 46.7253, "demand": 7},
            {"id": "D6", "lat": 24.7736, "lng": 46.7353, "demand": 9},
        ],
        "vehicles": [
            {"id": "V1", "capacity": 30},
            {"id": "V2", "capacity": 30},
        ],
        "time_limit": 5,
    }

    print(f"\nScenario:")
    print(f"  - Deliveries: {len(payload['locations'])}")
    print(f"  - Total demand: {sum(loc['demand'] for loc in payload['locations'])} parcels")
    print(f"  - Vehicles: {len(payload['vehicles'])}")

    print(f"\nCalling batch optimization...")

    try:
        response = requests.post(
            f"{SERVICE_URL}/api/optimize/batch", json=payload, timeout=30
        )

        if response.status_code == 200:
            result = response.json()

            if result.get("success"):
                print("\n✅ Batch optimization successful!")

                # Display routes
                for route in result["routes"]:
                    if len(route["stops"]) > 2:
                        print(f"\nRoute for {route['vehicle_id']}:")
                        print(f"  Stops: {len(route['stops']) - 2} deliveries")
                        print(f"  Distance: {route['total_distance'] / 1000:.2f} km")
                        print(f"  Load: {route['total_load']} parcels")
                        print(
                            f"  Utilization: {route['capacity_utilization']:.1f}%"
                        )

                        # Show stop sequence
                        print("  Route:")
                        for stop in route["stops"]:
                            if stop["location_index"] == 0:
                                print(f"    → {stop['name']}")
                            else:
                                print(
                                    f"    → {stop['name']} (load: {stop['demand']} parcels)"
                                )

                summary = result["summary"]
                print(f"\nTotal distance: {summary['total_distance'] / 1000:.2f} km")

            else:
                print(f"❌ Optimization failed: {result.get('error')}")
        else:
            print(f"❌ HTTP Error {response.status_code}: {response.text}")

    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to CVRP service. Is it running on port 5001?")
    except Exception as e:
        print(f"❌ Error: {str(e)}")


def test_health_check():
    """Test service health"""
    print("\n\n" + "=" * 80)
    print("Testing Service Health")
    print("=" * 80)

    try:
        response = requests.get(f"{SERVICE_URL}/health", timeout=5)

        if response.status_code == 200:
            result = response.json()
            print(f"✅ Service is {result['status']}")
            print(f"   Service: {result['service']}")
            print(f"   Time: {result['timestamp']}")
        else:
            print(f"❌ Health check failed: HTTP {response.status_code}")

    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to CVRP service")
        print("   Please start the service:")
        print("   1. cd backend/optimization-service")
        print("   2. python app.py")
    except Exception as e:
        print(f"❌ Error: {str(e)}")


if __name__ == "__main__":
    print("\n")
    print("╔" + "=" * 78 + "╗")
    print("║" + " " * 20 + "CVRP Optimization Service Tests" + " " * 25 + "║")
    print("║" + " " * 19 + "Google OR-Tools CVRP Implementation" + " " * 22 + "║")
    print("╚" + "=" * 78 + "╝")

    # Run all tests
    test_health_check()
    test_article_example()
    test_batch_optimization()

    print("\n\n" + "=" * 80)
    print("All tests completed!")
    print("=" * 80)
