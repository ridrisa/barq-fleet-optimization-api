#!/usr/bin/env python3
"""
Route Analyzer - Fleet Optimizer GPT Module
Analyzes historical route performance from barqfleet_db to identify optimization opportunities.

Usage:
    python route_analyzer.py --analysis_type efficiency --date_range 30
    python route_analyzer.py --analysis_type bottlenecks --hub_id 5
    python route_analyzer.py --analysis_type abc --min_deliveries 10
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import psycopg2
from psycopg2.extras import RealDictCursor
import pandas as pd
import numpy as np


class RouteAnalyzer:
    """Analyzes route efficiency and identifies optimization opportunities."""

    def __init__(self, db_config: Dict[str, str] = None):
        """
        Initialize the Route Analyzer.

        Args:
            db_config: Database configuration. If None, reads from environment.
        """
        if db_config is None:
            db_config = {
                'host': os.getenv('DB_HOST', 'localhost'),
                'port': int(os.getenv('DB_PORT', 5432)),
                'database': os.getenv('DB_NAME', 'barq_logistics'),
                'user': os.getenv('DB_USER', 'postgres'),
                'password': os.getenv('DB_PASSWORD', 'postgres')
            }

        self.db_config = db_config
        self.conn = None

    def connect(self):
        """Establish database connection."""
        try:
            self.conn = psycopg2.connect(**self.db_config)
            print("✓ Connected to database successfully")
        except Exception as e:
            print(f"✗ Database connection failed: {e}")
            sys.exit(1)

    def disconnect(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()
            print("✓ Database connection closed")

    def analyze_route_efficiency(self, date_range: int = 30) -> Dict:
        """
        Analyze route efficiency over specified date range.

        Calculates:
        - Route efficiency score (0-100)
        - Distance vs. optimal distance ratio
        - Time vs. optimal time ratio
        - Stops per route
        - Average delivery time

        Args:
            date_range: Number of days to analyze (default: 30)

        Returns:
            Dictionary with efficiency metrics and rankings
        """
        print(f"\n📊 Analyzing route efficiency (last {date_range} days)...")

        end_date = datetime.now()
        start_date = end_date - timedelta(days=date_range)

        query = """
        WITH route_metrics AS (
            SELECT
                s.id as shipment_id,
                s.order_number,
                s.hub_id,
                h.code as hub_name,
                s.driver_id,
                s.vehicle_id,
                s.created_at,
                s.delivered_at,
                s.sla_deadline,
                s.status,
                ST_Distance(
                    ST_SetSRID(ST_MakePoint(s.pickup_longitude, s.pickup_latitude), 4326)::geography,
                    ST_SetSRID(ST_MakePoint(s.delivery_longitude, s.delivery_latitude), 4326)::geography
                ) / 1000.0 as distance_km,
                EXTRACT(EPOCH FROM (s.delivered_at - s.created_at)) / 3600.0 as actual_hours,
                CASE
                    WHEN s.delivered_at <= s.sla_deadline THEN 1
                    ELSE 0
                END as on_time
            FROM orders s
            LEFT JOIN hubs h ON s.hub_id = h.id
            WHERE s.created_at >= %s
            AND s.created_at <= %s
            AND s.status IN ('delivered', 'completed')
            AND s.delivered_at IS NOT NULL
        )
        SELECT
            hub_id,
            hub_name,
            COUNT(*) as total_deliveries,
            AVG(distance_km) as avg_distance_km,
            AVG(actual_hours) as avg_delivery_hours,
            MIN(actual_hours) as min_delivery_hours,
            MAX(actual_hours) as max_delivery_hours,
            STDDEV(actual_hours) as stddev_delivery_hours,
            AVG(on_time::int) * 100 as on_time_rate,
            COUNT(DISTINCT driver_id) as drivers_used,
            COUNT(DISTINCT vehicle_id) as vehicles_used
        FROM route_metrics
        GROUP BY hub_id, hub_name
        HAVING COUNT(*) >= 5
        ORDER BY total_deliveries DESC
        """

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(query, (start_date, end_date))
            results = cursor.fetchall()
            cursor.close()

            if not results:
                print("⚠ No route data found for the specified period")
                return {"error": "No data available"}

            # Calculate efficiency scores
            df = pd.DataFrame(results)

            # Efficiency score calculation
            # Higher is better: considers on-time rate and delivery speed
            df['efficiency_score'] = (
                (df['on_time_rate'] * 0.6) +  # 60% weight on on-time delivery
                ((1 / (df['avg_delivery_hours'] / df['avg_delivery_hours'].min())) * 40)  # 40% weight on speed
            ).clip(0, 100)

            # Rank routes
            df = df.sort_values('efficiency_score', ascending=False)
            df['rank'] = range(1, len(df) + 1)

            # Identify top and bottom performers
            top_performers = df.head(5).to_dict('records')
            bottom_performers = df.tail(5).to_dict('records')

            # Calculate overall metrics
            overall_metrics = {
                'total_deliveries': int(df['total_deliveries'].sum()),
                'avg_efficiency_score': float(df['efficiency_score'].mean()),
                'avg_on_time_rate': float(df['on_time_rate'].mean()),
                'avg_delivery_hours': float(df['avg_delivery_hours'].mean()),
                'total_hubs_analyzed': len(df)
            }

            print(f"✓ Analyzed {overall_metrics['total_deliveries']} deliveries across {overall_metrics['total_hubs_analyzed']} hubs")

            return {
                'analysis_type': 'route_efficiency',
                'period': f'{date_range} days',
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'overall_metrics': overall_metrics,
                'top_performers': top_performers,
                'bottom_performers': bottom_performers,
                'all_routes': df.to_dict('records')
            }

        except Exception as e:
            if self.conn:
                self.conn.rollback()
            print(f"✗ Analysis failed: {e}")
            return {"error": str(e)}

    def analyze_bottlenecks(self, hub_id: int = None, date_range: int = 30) -> Dict:
        """
        Identify bottlenecks in delivery operations.

        Analyzes:
        - Peak hour congestion
        - Driver overload times
        - Vehicle utilization gaps
        - Geographic bottlenecks

        Args:
            hub_id: Specific hub to analyze (optional)
            date_range: Number of days to analyze

        Returns:
            Dictionary with bottleneck analysis
        """
        print(f"\n🚦 Analyzing operational bottlenecks (last {date_range} days)...")

        end_date = datetime.now()
        start_date = end_date - timedelta(days=date_range)

        # Peak hour analysis
        query = """
        SELECT
            EXTRACT(HOUR FROM created_at) as hour_of_day,
            EXTRACT(DOW FROM created_at) as day_of_week,
            COUNT(*) as shipment_count,
            AVG(EXTRACT(EPOCH FROM (delivered_at - created_at)) / 3600.0) as avg_delivery_hours,
            COUNT(DISTINCT driver_id) as drivers_active
        FROM orders
        WHERE created_at >= %s
        AND created_at <= %s
        AND status IN ('delivered', 'completed')
        {}
        GROUP BY EXTRACT(HOUR FROM created_at), EXTRACT(DOW FROM created_at)
        ORDER BY shipment_count DESC
        """.format("AND hub_id = %s" if hub_id else "")

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            params = [start_date, end_date]
            if hub_id:
                params.append(hub_id)

            cursor.execute(query, params)
            results = cursor.fetchall()
            cursor.close()

            if not results:
                print("⚠ No bottleneck data found")
                return {"error": "No data available"}

            df = pd.DataFrame(results)

            # Identify peak hours (top 25% by volume)
            peak_threshold = df['shipment_count'].quantile(0.75)
            peak_hours = df[df['shipment_count'] >= peak_threshold]

            # Calculate delivery ratio (shipments per driver)
            df['shipments_per_driver'] = df['shipment_count'] / df['drivers_active']
            overload_hours = df[df['shipments_per_driver'] > df['shipments_per_driver'].quantile(0.90)]

            day_names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

            peak_hours_formatted = [
                {
                    'day': day_names[int(row['day_of_week'])],
                    'hour': f"{int(row['hour_of_day']):02d}:00",
                    'shipment_count': int(row['shipment_count']),
                    'avg_delivery_hours': float(row['avg_delivery_hours']),
                    'drivers_active': int(row['drivers_active'])
                }
                for _, row in peak_hours.iterrows()
            ]

            overload_hours_formatted = [
                {
                    'day': day_names[int(row['day_of_week'])],
                    'hour': f"{int(row['hour_of_day']):02d}:00",
                    'shipments_per_driver': float(row['shipments_per_driver']),
                    'shipment_count': int(row['shipment_count']),
                    'drivers_active': int(row['drivers_active'])
                }
                for _, row in overload_hours.iterrows()
            ]

            print(f"✓ Identified {len(peak_hours_formatted)} peak time periods")
            print(f"✓ Found {len(overload_hours_formatted)} potential driver overload periods")

            return {
                'analysis_type': 'bottlenecks',
                'period': f'{date_range} days',
                'hub_id': hub_id,
                'peak_hours': peak_hours_formatted,
                'overload_periods': overload_hours_formatted,
                'recommendations': self._generate_bottleneck_recommendations(
                    peak_hours_formatted,
                    overload_hours_formatted
                )
            }

        except Exception as e:
            if self.conn:
                self.conn.rollback()
            print(f"✗ Bottleneck analysis failed: {e}")
            return {"error": str(e)}

    def analyze_abc_routes(self, min_deliveries: int = 10) -> Dict:
        """
        Perform ABC/Pareto analysis on routes.

        Classifies routes as:
        - A routes: Top 20% by volume (typically 80% of deliveries)
        - B routes: Middle 30% by volume
        - C routes: Bottom 50% by volume

        Args:
            min_deliveries: Minimum deliveries to include route in analysis

        Returns:
            Dictionary with ABC classification
        """
        print(f"\n📈 Performing ABC/Pareto analysis on routes...")

        query = """
        WITH route_summary AS (
            SELECT
                CONCAT(
                    ROUND(pickup_latitude::numeric, 2), ',',
                    ROUND(pickup_longitude::numeric, 2),
                    ' → ',
                    ROUND(delivery_latitude::numeric, 2), ',',
                    ROUND(delivery_longitude::numeric, 2)
                ) as route_key,
                hub_id,
                COUNT(*) as delivery_count,
                AVG(EXTRACT(EPOCH FROM (delivered_at - created_at)) / 3600.0) as avg_delivery_hours,
                SUM(CASE WHEN delivered_at <= sla_deadline THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as on_time_rate
            FROM orders
            WHERE status IN ('delivered', 'completed')
            AND delivered_at IS NOT NULL
            AND created_at >= CURRENT_DATE - INTERVAL '90 days'
            GROUP BY route_key, hub_id
            HAVING COUNT(*) >= %s
        )
        SELECT * FROM route_summary
        ORDER BY delivery_count DESC
        """

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(query, (min_deliveries,))
            results = cursor.fetchall()
            cursor.close()

            if not results:
                print("⚠ No route data found meeting minimum delivery threshold")
                return {"error": "Insufficient data"}

            df = pd.DataFrame(results)
            total_deliveries = df['delivery_count'].sum()

            # Calculate cumulative percentage
            df = df.sort_values('delivery_count', ascending=False)
            df['cumulative_deliveries'] = df['delivery_count'].cumsum()
            df['cumulative_percentage'] = (df['cumulative_deliveries'] / total_deliveries) * 100

            # ABC Classification
            df['classification'] = 'C'
            df.loc[df['cumulative_percentage'] <= 80, 'classification'] = 'A'
            df.loc[(df['cumulative_percentage'] > 80) & (df['cumulative_percentage'] <= 95), 'classification'] = 'B'

            # Summary by classification
            abc_summary = df.groupby('classification').agg({
                'route_key': 'count',
                'delivery_count': 'sum',
                'avg_delivery_hours': 'mean',
                'on_time_rate': 'mean'
            }).round(2)

            abc_summary['percentage_of_routes'] = (abc_summary['route_key'] / len(df) * 100).round(2)
            abc_summary['percentage_of_deliveries'] = (abc_summary['delivery_count'] / total_deliveries * 100).round(2)

            # Top A routes
            a_routes = df[df['classification'] == 'A'].head(20).to_dict('records')

            print(f"✓ Classified {len(df)} routes into ABC categories")
            print(f"  A routes: {len(df[df['classification'] == 'A'])} ({abc_summary.loc['A', 'percentage_of_routes']:.1f}% of routes, {abc_summary.loc['A', 'percentage_of_deliveries']:.1f}% of deliveries)")

            return {
                'analysis_type': 'abc_pareto',
                'total_routes_analyzed': len(df),
                'total_deliveries': int(total_deliveries),
                'abc_summary': abc_summary.to_dict('index'),
                'top_a_routes': a_routes,
                'recommendations': self._generate_abc_recommendations(abc_summary, a_routes)
            }

        except Exception as e:
            if self.conn:
                self.conn.rollback()
            print(f"✗ ABC analysis failed: {e}")
            return {"error": str(e)}

    def _generate_bottleneck_recommendations(self, peak_hours: List, overload_periods: List) -> List[str]:
        """Generate actionable recommendations based on bottleneck analysis."""
        recommendations = []

        if peak_hours:
            peak_times = sorted(peak_hours, key=lambda x: x['shipment_count'], reverse=True)[:3]
            for peak in peak_times:
                recommendations.append(
                    f"Consider adding {max(2, peak['shipment_count'] // peak['drivers_active'])} more drivers on "
                    f"{peak['day']} at {peak['hour']} (current: {peak['shipment_count']} shipments, "
                    f"{peak['drivers_active']} drivers)"
                )

        if overload_periods:
            recommendations.append(
                f"Identified {len(overload_periods)} time periods with driver overload. "
                "Consider shift scheduling optimization or additional driver recruitment."
            )

        if not recommendations:
            recommendations.append("No significant bottlenecks detected. Operations appear well-balanced.")

        return recommendations

    def _generate_abc_recommendations(self, abc_summary: pd.DataFrame, a_routes: List) -> List[str]:
        """Generate actionable recommendations based on ABC analysis."""
        recommendations = []

        try:
            a_stats = abc_summary.loc['A']
            c_stats = abc_summary.loc['C']

            recommendations.append(
                f"Focus optimization efforts on A routes ({a_stats['route_key']:.0f} routes) "
                f"which represent {a_stats['percentage_of_deliveries']:.1f}% of total deliveries."
            )

            if a_stats['on_time_rate'] < 90:
                recommendations.append(
                    f"A routes have {a_stats['on_time_rate']:.1f}% on-time rate. "
                    "Prioritize improving these high-volume routes for maximum impact."
                )

            recommendations.append(
                f"Consider consolidating or eliminating C routes ({c_stats['route_key']:.0f} routes) "
                f"which only represent {c_stats['percentage_of_deliveries']:.1f}% of deliveries."
            )

            if len(a_routes) > 0:
                avg_a_route_time = np.mean([r['avg_delivery_hours'] for r in a_routes])
                if avg_a_route_time > 2:
                    recommendations.append(
                        f"A routes average {avg_a_route_time:.1f} hours delivery time. "
                        "Investigate route optimization opportunities for these key routes."
                    )
        except:
            recommendations.append("Optimize resource allocation based on ABC classification results.")

        return recommendations


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='Analyze route performance and efficiency')
    parser.add_argument(
        '--analysis_type',
        choices=['efficiency', 'bottlenecks', 'abc'],
        required=True,
        help='Type of analysis to perform'
    )
    parser.add_argument(
        '--date_range',
        type=int,
        default=30,
        help='Number of days to analyze (default: 30)'
    )
    parser.add_argument(
        '--hub_id',
        type=int,
        help='Specific hub ID to analyze (for bottleneck analysis)'
    )
    parser.add_argument(
        '--min_deliveries',
        type=int,
        default=10,
        help='Minimum deliveries for ABC analysis (default: 10)'
    )
    parser.add_argument(
        '--output',
        default='console',
        choices=['console', 'json'],
        help='Output format (default: console)'
    )

    args = parser.parse_args()

    # Initialize analyzer
    analyzer = RouteAnalyzer()
    analyzer.connect()

    try:
        # Perform analysis
        if args.analysis_type == 'efficiency':
            results = analyzer.analyze_route_efficiency(date_range=args.date_range)
        elif args.analysis_type == 'bottlenecks':
            results = analyzer.analyze_bottlenecks(hub_id=args.hub_id, date_range=args.date_range)
        elif args.analysis_type == 'abc':
            results = analyzer.analyze_abc_routes(min_deliveries=args.min_deliveries)

        # Output results
        if args.output == 'json':
            print("\n" + json.dumps(results, indent=2, default=str))
        else:
            print("\n" + "="*80)
            print(f"ANALYSIS RESULTS: {args.analysis_type.upper()}")
            print("="*80)

            if 'error' in results:
                print(f"\n❌ Error: {results['error']}")
            else:
                # Pretty print results based on type
                if args.analysis_type == 'efficiency':
                    print(f"\n📊 Overall Metrics:")
                    for key, value in results['overall_metrics'].items():
                        print(f"  {key}: {value}")

                    print(f"\n🏆 Top 5 Performers:")
                    for i, route in enumerate(results['top_performers'], 1):
                        print(f"  {i}. {route.get('hub_name', 'Unknown')} - Score: {route['efficiency_score']:.1f}")

                    print(f"\n⚠️  Bottom 5 Performers:")
                    for i, route in enumerate(results['bottom_performers'], 1):
                        print(f"  {i}. {route.get('hub_name', 'Unknown')} - Score: {route['efficiency_score']:.1f}")

                elif args.analysis_type == 'bottlenecks':
                    print(f"\n🚦 Peak Hours Identified: {len(results['peak_hours'])}")
                    for peak in results['peak_hours'][:5]:
                        print(f"  {peak['day']} {peak['hour']}: {peak['shipment_count']} shipments, {peak['drivers_active']} drivers")

                    print(f"\n💡 Recommendations:")
                    for rec in results['recommendations']:
                        print(f"  • {rec}")

                elif args.analysis_type == 'abc':
                    print(f"\n📈 ABC Classification Summary:")
                    print(f"  Total Routes: {results['total_routes_analyzed']}")
                    print(f"  Total Deliveries: {results['total_deliveries']}")

                    print(f"\n💡 Recommendations:")
                    for rec in results['recommendations']:
                        print(f"  • {rec}")

            print("\n" + "="*80)

    finally:
        analyzer.disconnect()


if __name__ == "__main__":
    main()
