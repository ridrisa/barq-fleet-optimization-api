#!/usr/bin/env python3
"""
API Connector - Fleet Optimizer GPT Module
Connects to the BARQ Route Optimization API for real-time optimization requests.

Usage:
    python api_connector.py --action get_history --limit 10
    python api_connector.py --action optimize_route --input_file route_request.json
    python api_connector.py --action get_status --request_id abc123
"""

import os
import sys
import json
import argparse
from typing import Dict, List
import requests
from datetime import datetime


class APIConnector:
    """Connects to BARQ Route Optimization API."""

    def __init__(self, api_url: str = None):
        """
        Initialize the API Connector.

        Args:
            api_url: Base URL of the API. If None, reads from environment or uses default.
        """
        if api_url is None:
            api_url = os.getenv(
                'BARQ_API_URL',
                'https://route-opt-backend-426674819922.us-central1.run.app'
            )

        self.api_url = api_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'Fleet-Optimizer-GPT/1.0'
        })

    def get_optimization_history(self, limit: int = 10, page: int = 1) -> Dict:
        """
        Retrieve optimization history.

        Args:
            limit: Number of items to retrieve
            page: Page number

        Returns:
            Dictionary with historical optimization results
        """
        print(f"\n📊 Fetching optimization history (limit: {limit}, page: {page})...")

        endpoint = f"{self.api_url}/api/optimize/history"
        params = {'limit': limit, 'page': page}

        try:
            response = self.session.get(endpoint, params=params, timeout=30)
            response.raise_for_status()

            data = response.json()
            print(f"✓ Retrieved {len(data.get('data', []))} optimization records")

            return {
                'success': True,
                'data': data,
                'count': len(data.get('data', [])),
                'timestamp': datetime.now().isoformat()
            }

        except requests.exceptions.RequestException as e:
            print(f"✗ Failed to fetch history: {e}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }

    def optimize_route(self, request_data: Dict) -> Dict:
        """
        Submit a route optimization request.

        Args:
            request_data: Optimization request payload with pickup and delivery points

        Returns:
            Dictionary with optimization result
        """
        print(f"\n🚀 Submitting route optimization request...")
        print(f"   Pickup points: {len(request_data.get('pickupPoints', []))}")
        print(f"   Delivery points: {len(request_data.get('deliveryPoints', []))}")

        endpoint = f"{self.api_url}/api/optimize"

        try:
            response = self.session.post(endpoint, json=request_data, timeout=120)
            response.raise_for_status()

            data = response.json()
            print(f"✓ Optimization completed successfully")

            if 'routes' in data:
                print(f"   Generated {len(data['routes'])} optimized routes")

            return {
                'success': True,
                'data': data,
                'request_id': data.get('requestId'),
                'timestamp': datetime.now().isoformat()
            }

        except requests.exceptions.RequestException as e:
            print(f"✗ Optimization request failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }

    def get_optimization_status(self, request_id: str) -> Dict:
        """
        Check the status of an optimization request.

        Args:
            request_id: Unique request identifier

        Returns:
            Dictionary with status information
        """
        print(f"\n🔍 Checking status for request: {request_id}...")

        endpoint = f"{self.api_url}/api/optimize/status/{request_id}"

        try:
            response = self.session.get(endpoint, timeout=30)
            response.raise_for_status()

            data = response.json()
            status = data.get('status', 'unknown')
            print(f"✓ Status: {status}")

            return {
                'success': True,
                'data': data,
                'status': status,
                'timestamp': datetime.now().isoformat()
            }

        except requests.exceptions.RequestException as e:
            print(f"✗ Failed to fetch status: {e}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }

    def get_optimization_result(self, request_id: str) -> Dict:
        """
        Retrieve complete optimization result by ID.

        Args:
            request_id: Unique request identifier

        Returns:
            Dictionary with full optimization result
        """
        print(f"\n📦 Fetching optimization result: {request_id}...")

        endpoint = f"{self.api_url}/api/optimize/{request_id}"

        try:
            response = self.session.get(endpoint, timeout=30)
            response.raise_for_status()

            data = response.json()
            print(f"✓ Retrieved optimization result")

            if 'routes' in data:
                print(f"   Routes: {len(data['routes'])}")
                if data['routes']:
                    total_distance = sum(r.get('totalDistance', 0) for r in data['routes'])
                    total_duration = sum(r.get('totalDuration', 0) for r in data['routes'])
                    print(f"   Total Distance: {total_distance:.2f} km")
                    print(f"   Total Duration: {total_duration:.2f} minutes")

            return {
                'success': True,
                'data': data,
                'timestamp': datetime.now().isoformat()
            }

        except requests.exceptions.RequestException as e:
            print(f"✗ Failed to fetch result: {e}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }

    def health_check(self) -> Dict:
        """
        Check API health status.

        Returns:
            Dictionary with health status
        """
        print(f"\n💓 Checking API health...")

        endpoint = f"{self.api_url}/health"

        try:
            response = self.session.get(endpoint, timeout=10)
            response.raise_for_status()

            data = response.json()
            print(f"✓ API is healthy")
            print(f"   Status: {data.get('status')}")

            return {
                'success': True,
                'healthy': True,
                'data': data,
                'timestamp': datetime.now().isoformat()
            }

        except requests.exceptions.RequestException as e:
            print(f"✗ Health check failed: {e}")
            return {
                'success': False,
                'healthy': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }


def load_json_file(file_path: str) -> Dict:
    """Load JSON data from file."""
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"✗ Failed to load file {file_path}: {e}")
        sys.exit(1)


def save_json_file(data: Dict, file_path: str):
    """Save JSON data to file."""
    try:
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=2, default=str)
        print(f"✓ Saved result to {file_path}")
    except Exception as e:
        print(f"✗ Failed to save file {file_path}: {e}")


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='Connect to BARQ Route Optimization API')
    parser.add_argument(
        '--action',
        choices=['get_history', 'optimize_route', 'get_status', 'get_result', 'health_check'],
        required=True,
        help='API action to perform'
    )
    parser.add_argument(
        '--api_url',
        help='API base URL (default: from env or production URL)'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=10,
        help='Number of history items to retrieve (default: 10)'
    )
    parser.add_argument(
        '--page',
        type=int,
        default=1,
        help='Page number for history (default: 1)'
    )
    parser.add_argument(
        '--request_id',
        help='Request ID for status/result lookup'
    )
    parser.add_argument(
        '--input_file',
        help='JSON file with optimization request data'
    )
    parser.add_argument(
        '--output_file',
        help='File to save response (default: print to console)'
    )

    args = parser.parse_args()

    # Initialize connector
    connector = APIConnector(api_url=args.api_url)

    # Execute action
    result = None

    if args.action == 'health_check':
        result = connector.health_check()

    elif args.action == 'get_history':
        result = connector.get_optimization_history(limit=args.limit, page=args.page)

    elif args.action == 'optimize_route':
        if not args.input_file:
            print("✗ --input_file required for optimize_route action")
            sys.exit(1)

        request_data = load_json_file(args.input_file)
        result = connector.optimize_route(request_data)

    elif args.action == 'get_status':
        if not args.request_id:
            print("✗ --request_id required for get_status action")
            sys.exit(1)

        result = connector.get_optimization_status(args.request_id)

    elif args.action == 'get_result':
        if not args.request_id:
            print("✗ --request_id required for get_result action")
            sys.exit(1)

        result = connector.get_optimization_result(args.request_id)

    # Output result
    print("\n" + "="*80)

    if args.output_file:
        save_json_file(result, args.output_file)
    else:
        print(json.dumps(result, indent=2, default=str))

    print("="*80)

    # Exit with appropriate code
    sys.exit(0 if result.get('success') else 1)


if __name__ == "__main__":
    main()
