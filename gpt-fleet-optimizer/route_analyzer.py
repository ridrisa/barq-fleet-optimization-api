#!/usr/bin/env python3
"""
Route Analyzer - Fleet Optimizer GPT Module
Analyzes historical route performance from BarqFleet production database.

ENHANCED WITH PRODUCTION DATABASE RESILIENCE:
- Robust error handling with retry logic and exponential backoff
- Automatic fallback to realistic Saudi Arabian demo data when production unavailable
- Circuit breaker pattern for repeated database failures
- Comprehensive connection health monitoring
- Graceful degradation with clear data source indicators

**PRODUCTION SCHEMA COMPATIBLE**
Works with actual BarqFleet schema:
- orders table: hub_id, shipment_id, order_status, delivery_start, delivery_finish
- shipments table: courier_id, driving_distance (NO vehicle_id, NO pickup/delivery coords)
- couriers table: vehicle_type, hub_id
- hubs table: code, latitude, longitude

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
import pandas as pd
import numpy as np

# Import our robust database connection handler
from database_connection import DatabaseConnection, get_database_connection


class RouteAnalyzer:
    """Analyzes route efficiency and identifies optimization opportunities with production database resilience."""

    def __init__(self, db_config: Dict[str, str] = None, enable_fallback: bool = None):
        """
        Initialize the Route Analyzer with robust database handling.

        Args:
            db_config: Database configuration. If None, reads from environment.
            enable_fallback: Enable fallback to demo data when production unavailable.
        """
        # Force production only if environment variable is set
        if os.getenv('PRODUCTION_ONLY') == 'true':
            enable_fallback = False
        elif enable_fallback is None:
            enable_fallback = False
            
        self.db = get_database_connection(enable_fallback=enable_fallback)
        self.data_source = 'unknown'

    def connect(self):
        """Establish database connection with resilience."""
        try:
            connected = self.db.connect()
            
            if self.db.is_fallback_mode:
                self.data_source = 'demo'
                print("⚠ Using demo data - Production database unavailable")
                print("📊 Demo data: Realistic Saudi Arabian route analysis data available")
            else:
                self.data_source = 'production'
                print("✓ Connected to BarqFleet production database successfully")
                
            return True
            
        except Exception as e:
            print(f"✗ Database connection failed completely: {e}")
            if not self.db.enable_fallback:
                sys.exit(1)
            return False

    def disconnect(self):
        """Close database connection."""
        self.db.disconnect()
        if not self.db.is_fallback_mode:
            print("✓ Database connection closed")

    def get_connection_info(self) -> Dict:
        """Get current connection status and data source information."""
        status = self.db.get_connection_status()
        status['analyzer_data_source'] = self.data_source
        return status

    def analyze_route_efficiency(self, date_range: int = 30) -> Dict:
        """
        Analyze route efficiency over specified date range.

        Calculates:
        - Route efficiency score (0-100)
        - Average delivery time
        - Deliveries per hub
        - Courier utilization
        - On-time delivery rate

        Args:
            date_range: Number of days to analyze (default: 30)

        Returns:
            Dictionary with efficiency metrics and rankings
        """
        print(f"\n📊 Analyzing route efficiency (last {date_range} days)...")

        end_date = datetime.now()
        start_date = end_date - timedelta(days=date_range)

        # Optimized query for production database performance
        query = """
        WITH delivery_metrics AS (
            SELECT
                o.hub_id,
                h.code as hub_name,
                COUNT(*) as total_deliveries,
                COUNT(DISTINCT s.courier_id) as couriers_used,
                AVG(s.driving_distance) as avg_distance_km,
                AVG(
                    CASE
                        WHEN o.delivery_finish IS NOT NULL AND o.delivery_start IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (o.delivery_finish - o.delivery_start)) / 3600.0
                        ELSE NULL
                    END
                ) as avg_delivery_hours,
                MIN(
                    CASE
                        WHEN o.delivery_finish IS NOT NULL AND o.delivery_start IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (o.delivery_finish - o.delivery_start)) / 3600.0
                        ELSE NULL
                    END
                ) as min_delivery_hours,
                MAX(
                    CASE
                        WHEN o.delivery_finish IS NOT NULL AND o.delivery_start IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (o.delivery_finish - o.delivery_start)) / 3600.0
                        ELSE NULL
                    END
                ) as max_delivery_hours,
                STDDEV(
                    CASE
                        WHEN o.delivery_finish IS NOT NULL AND o.delivery_start IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (o.delivery_finish - o.delivery_start)) / 3600.0
                        ELSE NULL
                    END
                ) as stddev_delivery_hours,
                SUM(CASE WHEN o.order_status = 'delivered' THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as success_rate
            FROM orders o
            INNER JOIN hubs h ON o.hub_id = h.id
            LEFT JOIN shipments s ON o.shipment_id = s.id
            WHERE o.created_at >= %s
            AND o.created_at <= %s
            AND o.order_status IN ('delivered', 'completed', 'cancelled', 'failed')
            AND o.hub_id IS NOT NULL
            GROUP BY o.hub_id, h.code
            HAVING COUNT(*) >= 5
        )
        SELECT
            hub_id,
            hub_name,
            total_deliveries,
            avg_distance_km,
            avg_delivery_hours,
            min_delivery_hours,
            max_delivery_hours,
            stddev_delivery_hours,
            success_rate as on_time_rate,
            couriers_used
        FROM delivery_metrics
        ORDER BY total_deliveries DESC
        LIMIT 50
        """

        try:
            results = self.db.execute_query(query, [start_date, end_date], timeout=30.0)

            if not results:
                print("⚠ No route data found for the specified period")
                return {
                    "error": "No data available",
                    "data_source": self.data_source,
                    "fallback_available": self.db.enable_fallback
                }

            # Calculate efficiency scores
            df = pd.DataFrame(results)

            # Handle null values
            df['avg_delivery_hours'] = df['avg_delivery_hours'].fillna(df['avg_delivery_hours'].median())

            # Efficiency score calculation
            # Higher is better: considers success rate and delivery speed
            min_hours = df['avg_delivery_hours'].min() if df['avg_delivery_hours'].min() > 0 else 1

            df['efficiency_score'] = (
                (df['on_time_rate'] * 0.7) +  # 70% weight on success rate
                ((min_hours / df['avg_delivery_hours']) * 100 * 0.3)  # 30% weight on speed
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
                'data_source': self.data_source,
                'data_quality': 'high' if self.data_source == 'production' else 'demo',
                'overall_metrics': overall_metrics,
                'top_performers': top_performers,
                'bottom_performers': bottom_performers,
                'all_routes': df.to_dict('records'),
                'connection_info': self.get_connection_info()
            }

        except Exception as e:
            print(f"✗ Analysis failed: {e}")
            import traceback
            traceback.print_exc()
            
            return {
                "error": str(e),
                "data_source": self.data_source,
                "fallback_available": self.db.enable_fallback,
                "connection_info": self.get_connection_info() if hasattr(self, 'db') else {},
                "troubleshooting": {
                    "suggestion": "Check database connectivity or try demo mode",
                    "retry_recommended": True,
                    "circuit_breaker_info": "Database may be temporarily unavailable"
                }
            }

    def analyze_bottlenecks(self, hub_id: int = None, date_range: int = 30) -> Dict:
        """
        Identify bottlenecks in delivery operations.

        Analyzes:
        - Peak hour congestion
        - Courier overload times
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

        # Peak hour analysis using actual schema
        query = """
        SELECT
            EXTRACT(HOUR FROM o.created_at) as hour_of_day,
            EXTRACT(DOW FROM o.created_at) as day_of_week,
            COUNT(*) as order_count,
            AVG(
                CASE
                    WHEN o.delivery_finish IS NOT NULL AND o.delivery_start IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (o.delivery_finish - o.delivery_start)) / 3600.0
                    ELSE NULL
                END
            ) as avg_delivery_hours,
            COUNT(DISTINCT s.courier_id) as couriers_active
        FROM orders o
        LEFT JOIN shipments s ON o.shipment_id = s.id
        WHERE o.created_at >= %s
        AND o.created_at <= %s
        AND o.order_status IN ('delivered', 'completed')
        {}
        GROUP BY EXTRACT(HOUR FROM o.created_at), EXTRACT(DOW FROM o.created_at)
        ORDER BY order_count DESC
        """.format("AND o.hub_id = %s" if hub_id else "")

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
            peak_threshold = df['order_count'].quantile(0.75)
            peak_hours = df[df['order_count'] >= peak_threshold]

            # Calculate delivery ratio (orders per courier)
            df['orders_per_courier'] = df['order_count'] / df['couriers_active'].replace(0, 1)
            overload_hours = df[df['orders_per_courier'] > df['orders_per_courier'].quantile(0.90)]

            day_names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

            peak_hours_formatted = [
                {
                    'day': day_names[int(row['day_of_week'])],
                    'hour': f"{int(row['hour_of_day']):02d}:00",
                    'order_count': int(row['order_count']),
                    'avg_delivery_hours': float(row['avg_delivery_hours']) if row['avg_delivery_hours'] else 0,
                    'couriers_active': int(row['couriers_active'])
                }
                for _, row in peak_hours.iterrows()
            ]

            overload_hours_formatted = [
                {
                    'day': day_names[int(row['day_of_week'])],
                    'hour': f"{int(row['hour_of_day']):02d}:00",
                    'orders_per_courier': float(row['orders_per_courier']),
                    'order_count': int(row['order_count']),
                    'couriers_active': int(row['couriers_active'])
                }
                for _, row in overload_hours.iterrows()
            ]

            print(f"✓ Identified {len(peak_hours_formatted)} peak time periods")
            print(f"✓ Found {len(overload_hours_formatted)} potential courier overload periods")

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
            import traceback
            traceback.print_exc()
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

        # Use actual schema - group by hub
        query = """
        WITH route_summary AS (
            SELECT
                o.hub_id,
                h.code as hub_name,
                h.city_id,
                COUNT(*) as delivery_count,
                AVG(
                    CASE
                        WHEN o.delivery_finish IS NOT NULL AND o.delivery_start IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (o.delivery_finish - o.delivery_start)) / 3600.0
                        ELSE NULL
                    END
                ) as avg_delivery_hours,
                SUM(CASE WHEN o.order_status = 'delivered' THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as success_rate
            FROM orders o
            LEFT JOIN hubs h ON o.hub_id = h.id
            WHERE o.order_status IN ('delivered', 'completed', 'cancelled', 'failed')
            AND o.created_at >= CURRENT_DATE - INTERVAL '90 days'
            AND o.hub_id IS NOT NULL
            GROUP BY o.hub_id, h.code, h.city_id
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
                'hub_id': 'count',
                'delivery_count': 'sum',
                'avg_delivery_hours': 'mean',
                'success_rate': 'mean'
            }).round(2)

            abc_summary.rename(columns={'hub_id': 'route_count'}, inplace=True)
            abc_summary['percentage_of_routes'] = (abc_summary['route_count'] / len(df) * 100).round(2)
            abc_summary['percentage_of_deliveries'] = (abc_summary['delivery_count'] / total_deliveries * 100).round(2)

            # Top A routes
            a_routes = df[df['classification'] == 'A'].head(20).to_dict('records')

            print(f"✓ Classified {len(df)} routes into ABC categories")
            if 'A' in abc_summary.index:
                print(f"  A routes: {abc_summary.loc['A', 'route_count']:.0f} ({abc_summary.loc['A', 'percentage_of_routes']:.1f}% of routes, {abc_summary.loc['A', 'percentage_of_deliveries']:.1f}% of deliveries)")

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
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    def _generate_bottleneck_recommendations(self, peak_hours: List, overload_periods: List) -> List[str]:
        """Generate actionable recommendations based on bottleneck analysis."""
        recommendations = []

        if peak_hours:
            peak_times = sorted(peak_hours, key=lambda x: x['order_count'], reverse=True)[:3]
            for peak in peak_times:
                couriers = peak['couriers_active'] if peak['couriers_active'] > 0 else 1
                recommendations.append(
                    f"Consider adding {max(2, peak['order_count'] // couriers)} more couriers on "
                    f"{peak['day']} at {peak['hour']} (current: {peak['order_count']} orders, "
                    f"{peak['couriers_active']} couriers)"
                )

        if overload_periods:
            recommendations.append(
                f"Identified {len(overload_periods)} time periods with courier overload. "
                "Consider shift scheduling optimization or additional courier recruitment."
            )

        if not recommendations:
            recommendations.append("No significant bottlenecks detected. Operations appear well-balanced.")

        return recommendations

    def _generate_abc_recommendations(self, abc_summary: pd.DataFrame, a_routes: List) -> List[str]:
        """Generate actionable recommendations based on ABC analysis."""
        recommendations = []

        try:
            if 'A' in abc_summary.index:
                a_stats = abc_summary.loc['A']
                recommendations.append(
                    f"Focus optimization efforts on A routes ({a_stats['route_count']:.0f} routes) "
                    f"which represent {a_stats['percentage_of_deliveries']:.1f}% of total deliveries."
                )

                if a_stats['success_rate'] < 90:
                    recommendations.append(
                        f"A routes have {a_stats['success_rate']:.1f}% success rate. "
                        "Prioritize improving these high-volume routes for maximum impact."
                    )

            if 'C' in abc_summary.index:
                c_stats = abc_summary.loc['C']
                recommendations.append(
                    f"Consider consolidating or optimizing C routes ({c_stats['route_count']:.0f} routes) "
                    f"which only represent {c_stats['percentage_of_deliveries']:.1f}% of deliveries."
                )

            if len(a_routes) > 0:
                avg_a_route_time = np.mean([r['avg_delivery_hours'] for r in a_routes if r['avg_delivery_hours']])
                if avg_a_route_time and avg_a_route_time > 2:
                    recommendations.append(
                        f"A routes average {avg_a_route_time:.1f} hours delivery time. "
                        "Investigate route optimization opportunities for these key routes."
                    )
        except Exception:
            recommendations.append("Optimize resource allocation based on ABC classification results.")

        return recommendations if recommendations else ["Optimize resource allocation based on ABC classification results."]


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
                        print(f"  {peak['day']} {peak['hour']}: {peak['order_count']} orders, {peak['couriers_active']} couriers")

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
