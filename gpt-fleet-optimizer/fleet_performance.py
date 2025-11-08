#!/usr/bin/env python3
"""
Fleet Performance Analyzer - Fleet Optimizer GPT Module
Analyzes driver and vehicle performance metrics from barqfleet_db.

Usage:
    python fleet_performance.py --metric delivery_rate --period monthly
    python fleet_performance.py --metric time_compliance --driver_id 123
    python fleet_performance.py --metric efficiency --vehicle_id 456
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta
from typing import Dict, List
import psycopg2
from psycopg2.extras import RealDictCursor
import pandas as pd
import numpy as np
from scipy import stats


class FleetPerformanceAnalyzer:
    """Analyzes fleet (driver and vehicle) performance metrics."""

    def __init__(self, db_config: Dict[str, str] = None):
        """
        Initialize the Fleet Performance Analyzer.

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

    def analyze_driver_performance(self, period: str = 'monthly', driver_id: int = None) -> Dict:
        """
        Analyze driver performance with comprehensive metrics.

        Metrics:
        - Delivery success rate (first attempt)
        - On-time delivery rate
        - Average deliveries per day
        - Average delivery time
        - Customer satisfaction (if available)

        Args:
            period: Analysis period ('weekly', 'monthly', 'quarterly')
            driver_id: Specific driver to analyze (optional)

        Returns:
            Dictionary with driver performance rankings and statistics
        """
        print(f"\n👨‍✈️ Analyzing driver performance ({period})...")

        # Calculate date range based on period
        end_date = datetime.now()
        if period == 'weekly':
            start_date = end_date - timedelta(days=7)
        elif period == 'monthly':
            start_date = end_date - timedelta(days=30)
        elif period == 'quarterly':
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=30)

        query = """
        WITH driver_metrics AS (
            SELECT
                s.driver_id,
                COUNT(*) as total_deliveries,
                SUM(CASE WHEN s.status = 'delivered' THEN 1 ELSE 0 END) as successful_deliveries,
                SUM(CASE
                    WHEN s.delivered_at <= s.sla_deadline THEN 1
                    ELSE 0
                END) as on_time_deliveries,
                AVG(EXTRACT(EPOCH FROM (s.delivered_at - s.created_at)) / 3600.0) as avg_delivery_hours,
                STDDEV(EXTRACT(EPOCH FROM (s.delivered_at - s.created_at)) / 3600.0) as stddev_delivery_hours,
                MIN(EXTRACT(EPOCH FROM (s.delivered_at - s.created_at)) / 3600.0) as min_delivery_hours,
                MAX(EXTRACT(EPOCH FROM (s.delivered_at - s.created_at)) / 3600.0) as max_delivery_hours,
                COUNT(DISTINCT DATE(s.created_at)) as active_days,
                SUM(
                    ST_Distance(
                        ST_SetSRID(ST_MakePoint(s.pickup_longitude, s.pickup_latitude), 4326)::geography,
                        ST_SetSRID(ST_MakePoint(s.delivery_longitude, s.delivery_latitude), 4326)::geography
                    ) / 1000.0
                ) as total_distance_km
            FROM orders s
            WHERE s.created_at >= %s
            AND s.created_at <= %s
            AND s.driver_id IS NOT NULL
            {}
            GROUP BY s.driver_id
            HAVING COUNT(*) >= 5
        )
        SELECT
            dm.*,
            (dm.successful_deliveries::float / dm.total_deliveries * 100) as success_rate,
            (dm.on_time_deliveries::float / dm.total_deliveries * 100) as on_time_rate,
            (dm.total_deliveries::float / dm.active_days) as deliveries_per_day,
            (dm.total_distance_km / dm.total_deliveries) as avg_distance_per_delivery_km
        FROM driver_metrics dm
        ORDER BY success_rate DESC, on_time_rate DESC
        """.format("AND s.driver_id = %s" if driver_id else "")

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            params = [start_date, end_date]
            if driver_id:
                params.append(driver_id)

            cursor.execute(query, params)
            results = cursor.fetchall()
            cursor.close()

            if not results:
                print("⚠ No driver performance data found")
                return {"error": "No data available"}

            df = pd.DataFrame(results)

            # Calculate Driver Performance Index (DPI)
            # Composite score: success_rate (40%) + on_time_rate (30%) + deliveries_per_day normalized (20%) + speed (10%)
            max_deliveries_per_day = df['deliveries_per_day'].max()
            min_avg_hours = df['avg_delivery_hours'].min()

            df['dpi'] = (
                (df['success_rate'] * 0.40) +
                (df['on_time_rate'] * 0.30) +
                ((df['deliveries_per_day'] / max_deliveries_per_day) * 100 * 0.20) +
                ((min_avg_hours / df['avg_delivery_hours']) * 100 * 0.10)
            ).clip(0, 100)

            # Rank drivers
            df = df.sort_values('dpi', ascending=False)
            df['rank'] = range(1, len(df) + 1)

            # Statistical analysis
            # Identify outliers using z-score
            z_scores = np.abs(stats.zscore(df['dpi']))
            df['is_outlier'] = z_scores > 2

            # Top and bottom performers
            top_performers = df.head(10).to_dict('records')
            bottom_performers = df.tail(10).to_dict('records')

            # Overall statistics
            overall_stats = {
                'total_drivers_analyzed': len(df),
                'avg_dpi': float(df['dpi'].mean()),
                'median_dpi': float(df['dpi'].median()),
                'std_dpi': float(df['dpi'].std()),
                'avg_success_rate': float(df['success_rate'].mean()),
                'avg_on_time_rate': float(df['on_time_rate'].mean()),
                'avg_deliveries_per_day': float(df['deliveries_per_day'].mean()),
                'total_deliveries': int(df['total_deliveries'].sum())
            }

            # Performance tiers
            df['tier'] = pd.cut(
                df['dpi'],
                bins=[0, 70, 85, 100],
                labels=['Needs Improvement', 'Good', 'Excellent']
            )

            tier_distribution = df['tier'].value_counts().to_dict()

            print(f"✓ Analyzed {len(df)} drivers with {overall_stats['total_deliveries']} total deliveries")

            return {
                'analysis_type': 'driver_performance',
                'period': period,
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'overall_stats': overall_stats,
                'tier_distribution': {str(k): int(v) for k, v in tier_distribution.items()},
                'top_performers': top_performers,
                'bottom_performers': bottom_performers,
                'all_drivers': df.to_dict('records'),
                'recommendations': self._generate_driver_recommendations(df)
            }

        except Exception as e:
            if self.conn:
                self.conn.rollback()
            print(f"✗ Driver performance analysis failed: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    def analyze_vehicle_performance(self, period: str = 'monthly', vehicle_id: int = None) -> Dict:
        """
        Analyze vehicle performance and utilization.

        Metrics:
        - Utilization rate
        - Average deliveries per vehicle
        - Efficiency (deliveries per km)
        - Maintenance needs (inferred from patterns)

        Args:
            period: Analysis period
            vehicle_id: Specific vehicle to analyze (optional)

        Returns:
            Dictionary with vehicle performance metrics
        """
        print(f"\n🚚 Analyzing vehicle performance ({period})...")

        end_date = datetime.now()
        if period == 'weekly':
            start_date = end_date - timedelta(days=7)
        elif period == 'monthly':
            start_date = end_date - timedelta(days=30)
        elif period == 'quarterly':
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=30)

        query = """
        WITH vehicle_metrics AS (
            SELECT
                s.vehicle_id,
                COUNT(*) as total_trips,
                COUNT(DISTINCT s.driver_id) as drivers_used,
                COUNT(DISTINCT DATE(s.created_at)) as active_days,
                SUM(CASE WHEN s.status = 'delivered' THEN 1 ELSE 0 END) as successful_deliveries,
                AVG(EXTRACT(EPOCH FROM (s.delivered_at - s.created_at)) / 3600.0) as avg_trip_hours,
                SUM(
                    ST_Distance(
                        ST_SetSRID(ST_MakePoint(s.pickup_longitude, s.pickup_latitude), 4326)::geography,
                        ST_SetSRID(ST_MakePoint(s.delivery_longitude, s.delivery_latitude), 4326)::geography
                    ) / 1000.0
                ) as total_distance_km
            FROM orders s
            WHERE s.created_at >= %s
            AND s.created_at <= %s
            AND s.vehicle_id IS NOT NULL
            {}
            GROUP BY s.vehicle_id
            HAVING COUNT(*) >= 5
        )
        SELECT
            vm.*,
            (vm.successful_deliveries::float / vm.total_trips * 100) as success_rate,
            (vm.total_trips::float / vm.active_days) as trips_per_day,
            (vm.total_distance_km / vm.total_trips) as avg_distance_per_trip_km,
            (vm.total_trips::float / vm.total_distance_km) as deliveries_per_km_efficiency
        FROM vehicle_metrics vm
        ORDER BY success_rate DESC, trips_per_day DESC
        """.format("AND s.vehicle_id = %s" if vehicle_id else "")

        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            params = [start_date, end_date]
            if vehicle_id:
                params.append(vehicle_id)

            cursor.execute(query, params)
            results = cursor.fetchall()
            cursor.close()

            if not results:
                print("⚠ No vehicle performance data found")
                return {"error": "No data available"}

            df = pd.DataFrame(results)

            # Calculate Vehicle Performance Index (VPI)
            # success_rate (50%) + utilization (30%) + efficiency (20%)
            max_trips_per_day = df['trips_per_day'].max()
            max_efficiency = df['deliveries_per_km_efficiency'].max()

            df['vpi'] = (
                (df['success_rate'] * 0.50) +
                ((df['trips_per_day'] / max_trips_per_day) * 100 * 0.30) +
                ((df['deliveries_per_km_efficiency'] / max_efficiency) * 100 * 0.20)
            ).clip(0, 100)

            # Rank vehicles
            df = df.sort_values('vpi', ascending=False)
            df['rank'] = range(1, len(df) + 1)

            # Utilization categories
            df['utilization'] = pd.cut(
                df['trips_per_day'],
                bins=[0, df['trips_per_day'].quantile(0.33), df['trips_per_day'].quantile(0.66), float('inf')],
                labels=['Low', 'Medium', 'High']
            )

            top_performers = df.head(10).to_dict('records')
            underutilized = df[df['utilization'] == 'Low'].to_dict('records')

            overall_stats = {
                'total_vehicles_analyzed': len(df),
                'avg_vpi': float(df['vpi'].mean()),
                'avg_success_rate': float(df['success_rate'].mean()),
                'avg_trips_per_day': float(df['trips_per_day'].mean()),
                'total_trips': int(df['total_trips'].sum()),
                'total_distance_km': float(df['total_distance_km'].sum())
            }

            utilization_dist = df['utilization'].value_counts().to_dict()

            print(f"✓ Analyzed {len(df)} vehicles with {overall_stats['total_trips']} total trips")

            return {
                'analysis_type': 'vehicle_performance',
                'period': period,
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'overall_stats': overall_stats,
                'utilization_distribution': {str(k): int(v) for k, v in utilization_dist.items()},
                'top_performers': top_performers,
                'underutilized_vehicles': underutilized,
                'all_vehicles': df.to_dict('records'),
                'recommendations': self._generate_vehicle_recommendations(df, underutilized)
            }

        except Exception as e:
            if self.conn:
                self.conn.rollback()
            print(f"✗ Vehicle performance analysis failed: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    def compare_driver_cohorts(self, metric: str = 'dpi', period: str = 'monthly') -> Dict:
        """
        Compare driver performance across cohorts with statistical testing.

        Performs:
        - ANOVA to detect significant differences
        - T-tests for pairwise comparisons
        - Cohort segmentation

        Args:
            metric: Metric to compare ('dpi', 'success_rate', 'on_time_rate')
            period: Analysis period

        Returns:
            Dictionary with statistical comparison results
        """
        print(f"\n📊 Comparing driver cohorts on metric: {metric}...")

        # First get driver performance data
        driver_data = self.analyze_driver_performance(period=period)

        if 'error' in driver_data:
            return driver_data

        df = pd.DataFrame(driver_data['all_drivers'])

        if metric not in df.columns:
            return {"error": f"Metric {metric} not found in driver data"}

        # Create cohorts based on tier
        cohorts = df.groupby('tier')[metric].apply(list).to_dict()

        # Perform ANOVA
        cohort_values = [values for values in cohorts.values() if len(values) > 0]
        if len(cohort_values) < 2:
            return {"error": "Insufficient cohorts for comparison"}

        f_stat, p_value = stats.f_oneway(*cohort_values)

        # Pairwise t-tests
        tier_names = list(cohorts.keys())
        pairwise_comparisons = []

        for i in range(len(tier_names)):
            for j in range(i + 1, len(tier_names)):
                tier1 = tier_names[i]
                tier2 = tier_names[j]

                if len(cohorts[tier1]) > 0 and len(cohorts[tier2]) > 0:
                    t_stat, t_p_value = stats.ttest_ind(cohorts[tier1], cohorts[tier2])

                    pairwise_comparisons.append({
                        'cohort_1': str(tier1),
                        'cohort_2': str(tier2),
                        'cohort_1_mean': float(np.mean(cohorts[tier1])),
                        'cohort_2_mean': float(np.mean(cohorts[tier2])),
                        'difference': float(np.mean(cohorts[tier1]) - np.mean(cohorts[tier2])),
                        't_statistic': float(t_stat),
                        'p_value': float(t_p_value),
                        'significant': t_p_value < 0.05
                    })

        cohort_summary = {
            str(tier): {
                'count': len(values),
                'mean': float(np.mean(values)),
                'median': float(np.median(values)),
                'std': float(np.std(values)),
                'min': float(np.min(values)),
                'max': float(np.max(values))
            }
            for tier, values in cohorts.items() if len(values) > 0
        }

        print(f"✓ Compared {len(cohorts)} cohorts with {len(df)} total drivers")

        return {
            'analysis_type': 'cohort_comparison',
            'metric': metric,
            'period': period,
            'anova': {
                'f_statistic': float(f_stat),
                'p_value': float(p_value),
                'significant': p_value < 0.05
            },
            'cohort_summary': cohort_summary,
            'pairwise_comparisons': pairwise_comparisons,
            'interpretation': self._interpret_cohort_comparison(f_stat, p_value, pairwise_comparisons)
        }

    def _generate_driver_recommendations(self, df: pd.DataFrame) -> List[str]:
        """Generate actionable recommendations based on driver performance."""
        recommendations = []

        # Check bottom 10% performers
        bottom_10_pct = df[df['rank'] > len(df) * 0.9]
        if len(bottom_10_pct) > 0:
            avg_dpi_bottom = bottom_10_pct['dpi'].mean()
            recommendations.append(
                f"Bottom 10% drivers ({len(bottom_10_pct)} drivers) have avg DPI of {avg_dpi_bottom:.1f}. "
                "Consider providing additional training or reassignment."
            )

        # Check on-time rate
        low_on_time = df[df['on_time_rate'] < 80]
        if len(low_on_time) > 0:
            recommendations.append(
                f"{len(low_on_time)} drivers have on-time rate below 80%. "
                "Review route assignments and time estimates for these drivers."
            )

        # Check success rate
        low_success = df[df['success_rate'] < 85]
        if len(low_success) > 0:
            recommendations.append(
                f"{len(low_success)} drivers have success rate below 85%. "
                "Investigate common failure patterns and provide support."
            )

        # Recognize top performers
        top_5 = df.head(5)
        if len(top_5) > 0:
            recommendations.append(
                f"Top 5 drivers have avg DPI of {top_5['dpi'].mean():.1f}. "
                "Consider using them as trainers or for high-priority deliveries."
            )

        return recommendations if recommendations else ["All drivers performing within acceptable ranges."]

    def _generate_vehicle_recommendations(self, df: pd.DataFrame, underutilized: List) -> List[str]:
        """Generate actionable recommendations based on vehicle performance."""
        recommendations = []

        if len(underutilized) > 0:
            recommendations.append(
                f"{len(underutilized)} vehicles are underutilized (low trips per day). "
                "Consider reallocating to higher-demand areas or reviewing vehicle pool size."
            )

        low_success = df[df['success_rate'] < 85]
        if len(low_success) > 0:
            recommendations.append(
                f"{len(low_success)} vehicles have success rate below 85%. "
                "Check for mechanical issues or driver training needs."
            )

        high_distance = df[df['avg_distance_per_trip_km'] > df['avg_distance_per_trip_km'].quantile(0.75)]
        if len(high_distance) > 0:
            recommendations.append(
                f"{len(high_distance)} vehicles have unusually high distance per trip. "
                "Review route assignments for these vehicles to optimize fuel efficiency."
            )

        return recommendations if recommendations else ["All vehicles performing within acceptable ranges."]

    def _interpret_cohort_comparison(self, f_stat: float, p_value: float, comparisons: List) -> str:
        """Interpret statistical comparison results."""
        if p_value < 0.05:
            interpretation = f"ANOVA shows significant differences between cohorts (p={p_value:.4f}). "

            significant_pairs = [c for c in comparisons if c['significant']]
            if significant_pairs:
                largest_diff = max(significant_pairs, key=lambda x: abs(x['difference']))
                interpretation += f"Largest significant difference: {largest_diff['cohort_1']} vs {largest_diff['cohort_2']} "
                interpretation += f"({abs(largest_diff['difference']):.2f} points, p={largest_diff['p_value']:.4f})."

            return interpretation
        else:
            return f"No significant differences detected between cohorts (p={p_value:.4f})."


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='Analyze fleet (driver/vehicle) performance')
    parser.add_argument(
        '--metric',
        choices=['delivery_rate', 'time_compliance', 'efficiency'],
        required=True,
        help='Performance metric to analyze'
    )
    parser.add_argument(
        '--period',
        choices=['weekly', 'monthly', 'quarterly'],
        default='monthly',
        help='Analysis period (default: monthly)'
    )
    parser.add_argument(
        '--driver_id',
        type=int,
        help='Specific driver ID to analyze'
    )
    parser.add_argument(
        '--vehicle_id',
        type=int,
        help='Specific vehicle ID to analyze'
    )
    parser.add_argument(
        '--analysis_type',
        choices=['driver', 'vehicle', 'cohort'],
        default='driver',
        help='Type of performance analysis (default: driver)'
    )
    parser.add_argument(
        '--output',
        choices=['console', 'json'],
        default='console',
        help='Output format (default: console)'
    )

    args = parser.parse_args()

    # Initialize analyzer
    analyzer = FleetPerformanceAnalyzer()
    analyzer.connect()

    try:
        # Perform analysis
        if args.analysis_type == 'driver':
            results = analyzer.analyze_driver_performance(period=args.period, driver_id=args.driver_id)
        elif args.analysis_type == 'vehicle':
            results = analyzer.analyze_vehicle_performance(period=args.period, vehicle_id=args.vehicle_id)
        elif args.analysis_type == 'cohort':
            results = analyzer.compare_driver_cohorts(metric='dpi', period=args.period)

        # Output results
        if args.output == 'json':
            print("\n" + json.dumps(results, indent=2, default=str))
        else:
            print("\n" + "="*80)
            print(f"FLEET PERFORMANCE ANALYSIS: {args.analysis_type.upper()}")
            print("="*80)

            if 'error' in results:
                print(f"\n❌ Error: {results['error']}")
            else:
                if args.analysis_type == 'driver':
                    print(f"\n📊 Overall Statistics:")
                    for key, value in results['overall_stats'].items():
                        print(f"  {key}: {value}")

                    print(f"\n🏆 Top 10 Drivers:")
                    for driver in results['top_performers']:
                        print(f"  Driver {driver['driver_id']}: DPI={driver['dpi']:.1f}, Success={driver['success_rate']:.1f}%, OnTime={driver['on_time_rate']:.1f}%")

                    print(f"\n💡 Recommendations:")
                    for rec in results['recommendations']:
                        print(f"  • {rec}")

                elif args.analysis_type == 'vehicle':
                    print(f"\n📊 Overall Statistics:")
                    for key, value in results['overall_stats'].items():
                        print(f"  {key}: {value}")

                    print(f"\n🏆 Top 10 Vehicles:")
                    for vehicle in results['top_performers']:
                        print(f"  Vehicle {vehicle['vehicle_id']}: VPI={vehicle['vpi']:.1f}, Trips/Day={vehicle['trips_per_day']:.1f}")

                    print(f"\n💡 Recommendations:")
                    for rec in results['recommendations']:
                        print(f"  • {rec}")

                elif args.analysis_type == 'cohort':
                    print(f"\n📊 ANOVA Results:")
                    print(f"  F-statistic: {results['anova']['f_statistic']:.2f}")
                    print(f"  P-value: {results['anova']['p_value']:.4f}")
                    print(f"  Significant: {results['anova']['significant']}")

                    print(f"\n💡 Interpretation:")
                    print(f"  {results['interpretation']}")

            print("\n" + "="*80)

    finally:
        analyzer.disconnect()


if __name__ == "__main__":
    main()
